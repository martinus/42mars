// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// MARS simulator: executes assembled warriors in a circular core, with the
// bookkeeping the visualizer needs (ownership, timestamps, trace buffer).
// The constructor option `headless: true` turns that bookkeeping off, for
// tournaments and tests: then execution does not update owner, execBy,
// readBy, bump, origin, tWrite, tRead, tExec, territory, execHeat and the
// trace buffer.

import { OP, MOD } from './opcodes.js';
import { DEFAULT_OPTIONS, rng } from '../wasm/42mars.js';

export { rng };

const NEVER = -0x40000000; // initial timestamp: "long ago"
const EMPTY_CELL = (OP.DAT << 3) | MOD.F;
const DIRECT = 1;
const EVENT_KILL = 0, EVENT_DEATH = 1;
const CHUNK = 4096; // run() executes in chunks of at most this many instructions
const TRACE_SIZE = 4096; // entries in the trace ring buffer, a power of two

// The record of a warrior in Mars.wq: REC ints, at these offsets.
const REC = 4;
const R_HEAD = 0, R_TAIL = 1, R_TASKS = 2; // process queue, mirrored into the warrior object
const R_NEXT = 3; // execution order: the next living warrior

// traceMeta flag bits
export const TRACE_STORED = 1 << 16; // step 4 stored something at the B pointer
export const TRACE_NEW_PROCESS = 1 << 17; // a jump to, or SPL of, the A pointer
export const TRACE_DIED = 1 << 18; // the process died
export const TRACE_SKIPPED = 1 << 19; // the next instruction was skipped

// Opcode numbers as plain constants.
const MUL = OP.MUL, DIV = OP.DIV, LDP = OP.LDP, STP = OP.STP;

// What a modifier selects, as bits. Every modifier works on the A field, the
// B field or both of the B target; the source value for each is either the
// A-value or the B-value of the A operand:
//   .A: A <- A   .B: B <- B   .AB: B <- A   .BA: A <- B
//   .F and .I: A <- A, B <- B   .X: A <- B, B <- A
const USE_A = 1; // the A field of the target takes part
const USE_B = 2; // the B field of the target takes part
const A_FROM_B = 4; // the A field pairs with the B-value of the source
const B_FROM_A = 8; // the B field pairs with the A-value of the source
const MOD_BITS = new Uint8Array(7);
MOD_BITS[MOD.A] = USE_A;
MOD_BITS[MOD.B] = USE_B;
MOD_BITS[MOD.AB] = USE_B | B_FROM_A;
MOD_BITS[MOD.BA] = USE_A | A_FROM_B;
MOD_BITS[MOD.F] = USE_A | USE_B;
MOD_BITS[MOD.X] = USE_A | USE_B | A_FROM_B | B_FROM_A;
MOD_BITS[MOD.I] = USE_A | USE_B;

// target <op> source for MUL, DIV and MOD, modulo n. Returns -1 for a
// division by zero.
function combine(opcode, target, source, n) {
  switch (opcode) {
    case MUL: return (target * source) % n;
    case DIV: return source === 0 ? -1 : Math.trunc(target / source);
    default: return source === 0 ? -1 : target % source; // MOD
  }
}

// MUL, DIV, MOD, NOP, LDP and STP: the opcodes that execute() does not
// handle itself. Returns the trace flags, with TRACE_DIED when the process
// dies.
// Operands with read and write limits below the core size (pMARS's -R and
// -W, semantics doc 3.3): each operand has a read address, where its values
// come from (and the A operand's jump target), and a write address, where
// the B operand's stores go. The offset is folded with each limit; @ and *
// add the pointer cell at the read offset to both, < > { } change the
// pointer cell at the write offset and add it to the write offset for both.
// Returns the addresses in `out` (claimA and claimB: the cells the operands
// incremented or decremented, -1: none).
function limitedOperands(m, pc, aMode, irA, bMode, irB, out) {
  const n = m.coreSize, R = m.opt.readLimit, W = m.opt.writeLimit, av = m.av, bv = m.bv;
  const fold = (x, L) => { const r = x % L; return r > L >> 1 ? r + n - L : r; };
  const operand = (mode, value) => {
    let rp = fold(value, R), wp = fold(value, W), post = -1, cell = -1;
    const onA = mode >= 5;
    if (mode === 2 || mode === 5) {
      const c = (pc + rp) % n, v = onA ? av[c] : bv[c];
      rp = fold(rp + v, R);
      wp = fold(wp + v, W);
    } else if (mode !== 1) {
      const c = (pc + wp) % n;
      if (mode === 3 || mode === 6) { if (onA) av[c] = av[c] === 0 ? n - 1 : av[c] - 1; else bv[c] = bv[c] === 0 ? n - 1 : bv[c] - 1; } else post = c;
      cell = c;
      const v = onA ? av[c] : bv[c];
      rp = fold(wp + v, R);
      wp = fold(wp + v, W);
    }
    return { r: (pc + rp) % n, w: (pc + wp) % n, post, onA, cell };
  };
  const increment = (o) => {
    if (o.post < 0) return;
    if (o.onA) av[o.post] = av[o.post] + 1 === n ? 0 : av[o.post] + 1;
    else bv[o.post] = bv[o.post] + 1 === n ? 0 : bv[o.post] + 1;
  };
  out.aPtr = pc; out.AA = irA; out.AB = irB; out.claimA = -1;
  if (aMode !== 0) {
    const a = operand(aMode, irA);
    out.aPtr = a.r; out.AA = av[a.r]; out.AB = bv[a.r]; out.claimA = a.cell;
    increment(a);
  }
  out.bPtr = pc; out.bW = pc; out.claimB = -1;
  if (bMode !== 0) {
    const b = operand(bMode, irB);
    out.bPtr = b.r; out.bW = b.w; out.claimB = b.cell;
    out.BA = av[b.r]; out.BB = bv[b.r];
    increment(b);
  } else { out.BA = av[pc]; out.BB = bv[pc]; }
}

function otherOpcode(m, W, ir, aPtr, bPtr, AA, AB, BA, BB) {
  const opcode = ir >> 3;
  const bits = MOD_BITS[ir & 7];
  const srcA = (bits & A_FROM_B) !== 0 ? AB : AA; // source for the A field
  const srcB = (bits & B_FROM_A) !== 0 ? AA : AB; // source for the B field
  const useA = (bits & USE_A) !== 0;
  const useB = (bits & USE_B) !== 0;
  let flags = 0;
  if (opcode === LDP || opcode === STP) {
    // Only .A and .BA work on A fields; .F, .X and .I act like .B.
    // Index 0 of the p-space is the result of the last round.
    const pSpaceSize = m.opt.pSpaceSize;
    const onA = !useB;
    const src = onA ? srcA : useA ? AB : srcB;
    if (opcode === LDP) {
      const index = src % pSpaceSize;
      const v = index === 0 ? W.lastResult : W.pspace[index];
      if (onA) m.av[bPtr] = v; else m.bv[bPtr] = v;
      flags = TRACE_STORED;
    } else {
      const index = (onA ? BA : BB) % pSpaceSize;
      if (index === 0) W.lastResult = src; else W.pspace[index] = src;
    }
  } else if (opcode <= OP.MOD) {
    // DIV and MOD store the field with a non-zero divisor and then kill the
    // process if the other divisor was zero.
    const n = m.coreSize;
    if (useA) {
      const r = combine(opcode, BA, srcA, n);
      if (r < 0) flags = TRACE_DIED; else { m.av[bPtr] = r; flags = TRACE_STORED; }
    }
    if (useB) {
      const r = combine(opcode, BB, srcB, n);
      if (r < 0) flags |= TRACE_DIED; else { m.bv[bPtr] = r; flags |= TRACE_STORED; }
    }
  } // else NOP
  return flags;
}

// Marks a store into cell `addr` by warrior `w` at `time`. Takes the arrays
// and the offset of tWrite in i32 that execute() works with.
function claim(owner, i32, territory, tWrite, addr, w, time) {
  i32[tWrite + addr] = time;
  const o = owner[addr];
  if (o !== w) {
    if (o >= 0) territory[o]--;
    territory[w]++;
    owner[addr] = w;
  }
}

function effectiveOptions(options) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  if (!o.pSpaceSize) o.pSpaceSize = Math.floor(o.coreSize / 16);
  if (!o.readLimit) o.readLimit = o.coreSize;
  if (!o.writeLimit) o.writeLimit = o.coreSize;
  return o;
}

export class Mars {
  constructor(options = {}) {
    this.opt = effectiveOptions(options);
    this.track = !this.opt.headless; // do the visualizer bookkeeping

    const n = (this.coreSize = this.opt.coreSize);
    for (const k of ['readLimit', 'writeLimit']) {
      const l = this.opt[k];
      if (!Number.isInteger(l) || l < 1 || l > n || n % l !== 0) throw new RangeError(`${k} must divide the core size: ${l}`);
    }
    const T = (this.traceSize = TRACE_SIZE);
    // The per-cell arrays of one element type are views into one buffer, and
    // execute() indexes that buffer at offsets. Each typed array the hot loop
    // touches costs a map check, length and data pointer loads and registers;
    // with three buffers instead of fifteen arrays it ran 15 to 20 % faster.
    this.u8 = new Uint8Array(3 * n); // op, am, bm
    this.i8 = new Int8Array(4 * n); // owner, execBy, readBy, bump
    this.i32 = new Int32Array(6 * n + 4 * T); // av, bv, origin, tWrite, tRead, tExec, trace
    this.op = this.u8.subarray(0, n);
    this.am = this.u8.subarray(n, 2 * n);
    this.bm = this.u8.subarray(2 * n, 3 * n);
    this.owner = this.i8.subarray(0, n);
    this.execBy = this.i8.subarray(n, 2 * n);
    this.readBy = this.i8.subarray(2 * n, 3 * n);
    this.bump = this.i8.subarray(3 * n, 4 * n);
    this.av = this.i32.subarray(0, n);
    this.bv = this.i32.subarray(n, 2 * n);
    this.origin = this.i32.subarray(2 * n, 3 * n);
    this.tWrite = this.i32.subarray(3 * n, 4 * n);
    this.tRead = this.i32.subarray(4 * n, 5 * n);
    this.tExec = this.i32.subarray(5 * n, 6 * n);
    this.tracePc = this.i32.subarray(6 * n, 6 * n + T);
    this.traceA = this.i32.subarray(6 * n + T, 6 * n + 2 * T);
    this.traceB = this.i32.subarray(6 * n + 2 * T, 6 * n + 3 * T);
    this.traceMeta = this.i32.subarray(6 * n + 3 * T, 6 * n + 4 * T);

    this.warriors = [];
    // Events are recorded as numbers (type, addr, warrior, time) and become
    // objects only when `events` is read, so that step() does not allocate.
    this.eventList = [];
    this.eventBuffer = new Int32Array(256);
    this.eventCount = 0;
    this.round = 0;
    this.roundOver = true;
    this.roundResult = null;
    this.results = [];
    this.time = 0;
    this.cyclesLeft = 0;
    this.warriorsLeft = 0;
    this.current = 0;
    this.starter = 0;
    this.seed = 1;
    this.fixedPositions = null;
    this.limitedOut = { aPtr: 0, AA: 0, AB: 0, claimA: -1, bPtr: 0, bW: 0, BA: 0, BB: 0, claimB: -1 };
    this.permutation = null;
    this.lastDied = -1; // set by execute(): address where a warrior lost its last process

    // Per-match state of the hot loop: a record and the process queue of
    // each warrior in one Int32Array (see load()).
    this.wq = new Int32Array(0);
    this.wqStride = REC;
    this.territory = new Int32Array(0); // per warrior
    this.heatAll = new Float32Array(0); // all execHeat arrays
    this.heatStride = 1;
    this.clearCore();
  }

  // Array of { type: 'kill' | 'death', addr, warrior, time }. The reader may
  // empty it or assign a new array.
  get events() {
    const buf = this.eventBuffer;
    for (let i = 0; i < this.eventCount; i++) {
      const k = i * 4;
      this.eventList.push({ type: buf[k] === EVENT_KILL ? 'kill' : 'death', addr: buf[k + 1], warrior: buf[k + 2], time: buf[k + 3] });
    }
    this.eventCount = 0;
    return this.eventList;
  }

  set events(list) {
    this.eventCount = 0;
    this.eventList = list;
  }

  // Makes room for `more` further events in eventBuffer.
  reserveEvents(more) {
    const need = (this.eventCount + more) * 4;
    if (need <= this.eventBuffer.length) return;
    const bigger = new Int32Array(Math.max(need, this.eventBuffer.length * 2));
    bigger.set(this.eventBuffer);
    this.eventBuffer = bigger;
  }

  addEvent(type, addr, warrior, time) {
    this.reserveEvents(1);
    const buf = this.eventBuffer;
    let k = this.eventCount * 4;
    buf[k++] = type;
    buf[k++] = addr;
    buf[k++] = warrior;
    buf[k] = time;
    this.eventCount++;
  }

  clearCore() {
    this.op.fill(EMPTY_CELL);
    this.am.fill(DIRECT);
    this.bm.fill(DIRECT);
    this.av.fill(0);
    this.bv.fill(0);
    this.owner.fill(-1);
    this.execBy.fill(-1);
    this.readBy.fill(-1);
    this.bump.fill(0);
    this.origin.fill(-1);
    this.tWrite.fill(NEVER);
    this.tRead.fill(NEVER);
    this.tExec.fill(NEVER);
  }

  load(codes, { seed, positions, permute = false } = {}) {
    const o = this.opt;
    if (permute && (codes.length !== 2 || positions)) throw new RangeError('permute needs two warriors and no fixed positions');
    for (const c of codes) {
      if (!c.ok) throw new Error(`warrior '${c.name}' did not assemble`);
      if (c.instructions.length > o.maxLength) throw new Error(`warrior '${c.name}' is longer than ${o.maxLength}`);
    }
    if (codes.length * o.minDistance > o.coreSize) throw new Error('too many warriors for the core size and minimum distance');

    // wq holds per warrior a record of REC ints (see the R_* offsets) and
    // then its process queue, maxProcesses + 1 long; warrior.queue is a view
    // of it. During execute() head, tail and tasks live in the record.
    const nw = codes.length;
    const qlen = o.maxProcesses + 1;
    const stride = (this.wqStride = REC + qlen);
    const wq = (this.wq = new Int32Array(nw * stride));
    const queueStart = (i) => i * stride + REC;
    this.territory = new Int32Array(nw);

    // The execHeat arrays are views into one buffer, heatStride apart, so
    // that the hot loop finds the entry of origin (w << 16) | i at
    // w * heatStride + i.
    this.heatStride = codes.reduce((m, c) => Math.max(m, c.instructions.length), 1);
    this.heatAll = new Float32Array(nw * this.heatStride);

    // Warriors with the same PIN share their p-space cells (not the last result).
    const shared = new Map();
    this.warriors = codes.map((code, index) => {
      let pspace;
      if (code.pin !== null && code.pin !== undefined && shared.has(code.pin)) pspace = shared.get(code.pin);
      else {
        pspace = new Int32Array(o.pSpaceSize);
        if (code.pin !== null && code.pin !== undefined) shared.set(code.pin, pspace);
      }
      return {
        index, code, name: code.name, author: code.author, position: 0,
        queue: wq.subarray(queueStart(index), queueStart(index) + qlen), head: 0, tail: 0, tasks: 0,
        alive: false, pspace, lastResult: o.coreSize - 1,
        score: new Array(2 * codes.length - 1).fill(0), wins: 0, losses: 0, ties: 0,
        territory: 0, execHeat: this.heatAll.subarray(index * this.heatStride, index * this.heatStride + code.instructions.length), diedAt: null,
      };
    });
    this.seed = seed === undefined ? rng(1 + Math.floor(Math.random() * 2147483646)) : seed;
    this.fixedPositions = positions ?? null;
    // permute (pmars -P): the draw list of placeWarriors() and its entries left
    this.permutation = permute ? { list: null, left: 0 } : null;
    this.round = 0;
    this.results = [];
    this.roundResult = null;
    this.roundOver = true;
    this.starter = 0;
  }

  // ---- placement

  placeWarriors() {
    const ws = this.warriors;
    const n = ws.length;
    if (this.fixedPositions) {
      for (let i = 0; i < n; i++) ws[i].position = this.fixedPositions[i];
      return;
    }
    if (this.permutation) {
      this.drawPermuted();
      return;
    }
    const pos = new Array(n).fill(0);
    if (n === 2) {
      const { coreSize, minDistance } = this.opt;
      pos[1] = minDistance + (this.seed % (coreSize + 1 - 2 * minDistance));
      this.seed = rng(this.seed);
    } else if (n > 2 && !this.placeRandom(pos)) {
      this.placeSpread(pos);
    }
    for (let i = 0; i < n; i++) ws[i].position = pos[i];
  }

  // permute, two warriors: the 2 * (coreSize + 1 - 2 * minDistance)
  // combinations c = 2 * (position - minDistance) + (warrior 1 moves first)
  // are drawn without repeats, from a list in which a drawn entry is replaced
  // by the last one; a new list once all were drawn (semantics doc, 3.2).
  drawPermuted() {
    const { coreSize, minDistance } = this.opt;
    const p = this.permutation;
    if (!p.left) {
      p.left = 2 * (coreSize + 1 - 2 * minDistance);
      p.list = Uint32Array.from({ length: p.left }, (_, i) => i);
    }
    const i = this.seed % p.left;
    const c = p.list[i];
    p.list[i] = p.list[--p.left];
    this.seed = rng(this.seed);
    this.warriors[0].position = 0;
    this.warriors[1].position = minDistance + (c >> 1);
    this.starter = c & 1;
  }

  // Method A: random positions, retried while too close to an earlier one.
  placeRandom(pos) {
    const { coreSize, minDistance } = this.opt;
    const n = pos.length;
    const range = coreSize - 2 * minDistance + 1;
    let retries = 20;
    let backtracks = 4;
    for (let i = 1; i < n;) {
      this.seed = rng(this.seed);
      pos[i] = (this.seed % range) + minDistance;
      let conflict = 0;
      for (let j = 1; j < i; j++) {
        if (Math.abs(pos[i] - pos[j]) < minDistance) { conflict = j; break; }
      }
      if (!conflict) { i++; retries = 20; continue; }
      if (retries-- > 0) continue;
      // Out of retries: restart from the warrior it collided with.
      if (backtracks-- <= 0) return false;
      i = conflict;
      retries = 20;
    }
    return true;
  }

  // Method B: sorted random gaps, then shuffled.
  placeSpread(pos) {
    const { coreSize, minDistance } = this.opt;
    const n = pos.length;
    const room = coreSize - minDistance * n + 1;
    for (let i = 1; i < n; i++) {
      this.seed = rng(this.seed);
      const t = this.seed % room;
      let j = i - 1;
      while (j >= 1 && !(t > pos[j])) { pos[j + 1] = pos[j]; j--; }
      pos[j + 1] = t;
    }
    for (let i = 1; i < n; i++) pos[i] += minDistance * i;
    for (let i = 1; i < n; i++) {
      this.seed = rng(this.seed);
      const j = (this.seed % (n - i)) + i;
      const tmp = pos[i]; pos[i] = pos[j]; pos[j] = tmp;
    }
  }
  // ---- rounds

  startRound() {
    this.round++;
    this.placeWarriors();
    this.clearCore();
    this.events = [];
    this.time = 0;
    this.roundOver = false;
    this.roundResult = null;
    const n = this.coreSize;
    const ws = this.warriors;
    const count = ws.length;
    this.cyclesLeft = count * this.opt.maxCycles;
    this.warriorsLeft = count;
    for (const w of ws) {
      const code = w.code.instructions;
      for (let i = 0; i < code.length; i++) {
        const a = (w.position + i) % n;
        const ins = code[i];
        this.op[a] = (ins.op << 3) | ins.mod;
        this.am[a] = ins.aMode;
        this.bm[a] = ins.bMode;
        this.av[a] = ins.aVal;
        this.bv[a] = ins.bVal;
        this.owner[a] = w.index;
        this.origin[a] = (w.index << 16) | i;
      }
      this.territory[w.index] = w.territory = code.length;
      this.wq[w.index * this.wqStride + R_NEXT] = (w.index + 1) % count;
      w.head = 0;
      w.tail = 1;
      w.tasks = 1;
      w.queue[0] = (w.position + w.code.start) % n;
      w.alive = true;
      w.diedAt = null;
    }
    this.heatAll.fill(0);
    this.current = this.starter;
  }

  endRound() {
    if (this.roundOver) return;
    const ws = this.warriors;
    const survivors = [];
    for (const w of ws) {
      w.territory = this.territory[w.index];
      if (w.alive) {
        w.score[this.warriorsLeft - 1]++;
        w.lastResult = this.warriorsLeft;
        survivors.push(w.index);
      } else {
        w.lastResult = 0;
      }
    }
    // A single survivor wins, otherwise the survivors tie; the dead lose.
    for (const w of ws) {
      if (!w.alive) w.losses++;
      else if (ws.length > 1 && survivors.length === 1) w.wins++;
      else w.ties++;
    }
    this.roundResult = { round: this.round, cycles: this.time, survivors };
    this.results.push(this.roundResult);
    this.starter = (this.starter + 1) % ws.length;
    this.roundOver = true;
  }

  // Bookkeeping after warrior `w` lost its last process at `addr`.
  warriorDied(w, addr) {
    const W = this.warriors[w];
    W.alive = false;
    W.diedAt = this.time;
    W.score[this.warriorsLeft + this.warriors.length - 2]++;
    this.addEvent(EVENT_DEATH, addr, w, this.time);
    this.cyclesLeft = this.cyclesLeft - 1 - Math.trunc((this.cyclesLeft - 1) / this.warriorsLeft);
    this.warriorsLeft--;
    if (this.warriorsLeft < 2) { this.endRound(); return; }
    // Unlink w from the execution order.
    const wq = this.wq, stride = this.wqStride;
    let prev = w;
    while (wq[prev * stride + R_NEXT] !== w) prev = wq[prev * stride + R_NEXT];
    wq[prev * stride + R_NEXT] = wq[w * stride + R_NEXT];
    this.current = wq[w * stride + R_NEXT];
    if (--this.cyclesLeft <= 0) this.endRound();
  }

  step() {
    this.run(1);
  }

  // ---- execution

  // Executes up to `count` instructions; returns how many were executed.
  // Stops early when the round ends.
  run(count) {
    let done = 0;
    while (done < count && !this.roundOver) {
      const r = this.execute(Math.min(count - done, CHUNK));
      done += r;
      if (this.lastDied >= 0) {
        // The current warrior lost its last process.
        const pc = this.lastDied;
        this.lastDied = -1;
        this.addEvent(EVENT_KILL, pc, this.current, this.time);
        this.warriorDied(this.current, pc);
      } else if (this.cyclesLeft <= 0) this.endRound();
    }
    for (const W of this.warriors) W.territory = this.territory[W.index];
    return done;
  }

  // The hot loop: executes up to `count` instructions of the running round
  // and returns how many it executed. It stops early when the cycle budget
  // runs out or when a warrior loses its last process; then lastDied is the
  // address of that process and the caller does the rest. Allocates nothing.
  //
  // Everything is inlined into one loop over typed arrays, and execution is
  // specialized on the whole opcode byte, so that no modifier is decoded at
  // run time. Kills of processes other than a warrior's last one are handled
  // in the loop.
  execute(count) {
    const n = this.coreSize;
    const track = this.track;
    // The TRACE_* flags and EVENT_KILL as literals: those compile to
    // immediates, exported constants to loads.
    const STORED = 0x10000, NEW_PROCESS = 0x20000, DIED = 0x40000, SKIPPED = 0x80000, KILL = 0;
    // Buffers and the offsets of the arrays in them (see the constructor).
    const U = this.u8, S = this.i8, I = this.i32, Q = this.wq, heat = this.heatAll, territory = this.territory;
    const OP = 0, AM = n, BM = 2 * n; // in U
    const EXECBY = n, READBY = 2 * n, BUMP = 3 * n; // in S, after owner
    const AV = 0, BV = n, ORIGIN = 2 * n, TWRITE = 3 * n, TREAD = 4 * n, TEXEC = 5 * n; // in I
    const TRACE = 6 * n; // in I: tracePc, traceA, traceB, traceMeta, each TRACE_SIZE long
    // Read or write limits: the operands of limitedOperands(), into lo.
    const limited = this.opt.readLimit < n || this.opt.writeLimit < n;
    const lo = this.limitedOut;
    const heatStride = this.heatStride;
    const ws = this.warriors;
    const nw = ws.length;
    const maxProcesses = this.opt.maxProcesses;
    const qlen = maxProcesses + 1;
    const stride = this.wqStride;
    for (let i = 0; i < nw; i++) {
      const W = ws[i];
      Q[i * stride + R_HEAD] = W.head; Q[i * stride + R_TAIL] = W.tail; Q[i * stride + R_TASKS] = W.tasks;
    }
    // Every instruction may kill a process, so there is room for that many
    // events. Then the loop can record them without a size check.
    this.reserveEvents(count);
    const events = this.eventBuffer;
    let eventCount = this.eventCount;

    // Each instruction that does not end the warrior uses up one cycle, so
    // the loop runs at most min(count, cyclesLeft) times (but at least once,
    // like a loop that tests the budget after the instruction).
    const cyclesLeft = this.cyclesLeft;
    // count is in (0, CHUNK]; like `while (done < count)`, a fraction rounds up.
    const limit = Math.min(Math.ceil(count), Math.max(cyclesLeft, 1)) | 0;
    let time = this.time;
    let current = this.current;
    let done = 0;
    let lastDied = -1;
    for (;;) {
      const w = current;
      time++;

      // Take the next process of the current warrior.
      const rec = Math.imul(w, stride);
      const qBase = rec + REC;
      const head = Q[rec + R_HEAD];
      const pc = Q[qBase + head];
      Q[rec + R_HEAD] = head + 1 === qlen ? 0 : head + 1;
      let tail = Q[rec + R_TAIL];
      let tasks = Q[rec + R_TASKS] - 1;

      if (track) {
        I[TEXEC + pc] = time;
        S[EXECBY + pc] = w;
        const org = I[ORIGIN + pc];
        if (org >= 0) heat[Math.imul(org >> 16, heatStride) + (org & 0xffff)] += 1;
      }

      // Fetch into the instruction register.
      const ir = U[OP + pc];
      const aMode = U[AM + pc];
      const bMode = U[BM + pc];
      const irA = I[AV + pc];
      const irB = I[BV + pc];

      // A operand: pointer and values. For an immediate operand the core
      // still equals the register. claimA and claimB: the cells that the
      // increments and decrements of the operands changed (-1: none), for
      // the bookkeeping below.
      let aPtr = pc, AA = irA, AB = irB, claimA = -1, claimB = -1;
      // bPtr: the B read address; bW: where the stores go, bPtr without limits
      let bPtr = pc, BA, BB, bW;
      if (limited) {
        limitedOperands(this, pc, aMode, irA, bMode, irB, lo);
        aPtr = lo.aPtr; AA = lo.AA; AB = lo.AB; claimA = lo.claimA;
        bPtr = lo.bPtr; bW = lo.bW; BA = lo.BA; BB = lo.BB; claimB = lo.claimB;
        if (track && aMode !== 0) { I[TREAD + aPtr] = time; S[READBY + aPtr] = w; }
      } else {
      if (aMode !== 0) {
        let p = pc + irA; if (p >= n) p -= n;
        switch (aMode) {
          case 1: // $
            aPtr = p; AA = I[AV + p]; AB = I[BV + p];
            break;
          case 2: { // @
            const q = p + I[BV + p];
            aPtr = q >= n ? q - n : q; AA = I[AV + aPtr]; AB = I[BV + aPtr];
            break;
          }
          case 3: { // <
            let f = I[BV + p];
            f = f === 0 ? n - 1 : f - 1;
            I[BV + p] = f;
            claimA = p;
            const q = p + f;
            aPtr = q >= n ? q - n : q; AA = I[AV + aPtr]; AB = I[BV + aPtr];
            break;
          }
          case 4: { // >: read, then increment
            const f = I[BV + p];
            const q = p + f;
            aPtr = q >= n ? q - n : q; AA = I[AV + aPtr]; AB = I[BV + aPtr];
            I[BV + p] = f + 1 === n ? 0 : f + 1;
            claimA = p;
            break;
          }
          case 5: { // *
            const q = p + I[AV + p];
            aPtr = q >= n ? q - n : q; AA = I[AV + aPtr]; AB = I[BV + aPtr];
            break;
          }
          case 6: { // {
            let f = I[AV + p];
            f = f === 0 ? n - 1 : f - 1;
            I[AV + p] = f;
            claimA = p;
            const q = p + f;
            aPtr = q >= n ? q - n : q; AA = I[AV + aPtr]; AB = I[BV + aPtr];
            break;
          }
          default: { // }: read, then increment
            const f = I[AV + p];
            const q = p + f;
            aPtr = q >= n ? q - n : q; AA = I[AV + aPtr]; AB = I[BV + aPtr];
            I[AV + p] = f + 1 === n ? 0 : f + 1;
            claimA = p;
            break;
          }
        }
        if (track) { I[TREAD + aPtr] = time; S[READBY + aPtr] = w; }
      }

      // B operand, the same on the core as the A operand left it.
      if (bMode === 0) {
        BA = I[AV + pc]; BB = I[BV + pc];
      } else {
        let p = pc + irB; if (p >= n) p -= n;
        switch (bMode) {
          case 1:
            bPtr = p; BA = I[AV + p]; BB = I[BV + p];
            break;
          case 2: {
            const q = p + I[BV + p];
            bPtr = q >= n ? q - n : q; BA = I[AV + bPtr]; BB = I[BV + bPtr];
            break;
          }
          case 3: {
            let f = I[BV + p];
            f = f === 0 ? n - 1 : f - 1;
            I[BV + p] = f;
            claimB = p;
            const q = p + f;
            bPtr = q >= n ? q - n : q; BA = I[AV + bPtr]; BB = I[BV + bPtr];
            break;
          }
          case 4: {
            const f = I[BV + p];
            const q = p + f;
            bPtr = q >= n ? q - n : q; BA = I[AV + bPtr]; BB = I[BV + bPtr];
            I[BV + p] = f + 1 === n ? 0 : f + 1;
            claimB = p;
            break;
          }
          case 5: {
            const q = p + I[AV + p];
            bPtr = q >= n ? q - n : q; BA = I[AV + bPtr]; BB = I[BV + bPtr];
            break;
          }
          case 6: {
            let f = I[AV + p];
            f = f === 0 ? n - 1 : f - 1;
            I[AV + p] = f;
            claimB = p;
            const q = p + f;
            bPtr = q >= n ? q - n : q; BA = I[AV + bPtr]; BB = I[BV + bPtr];
            break;
          }
          default: {
            const f = I[AV + p];
            const q = p + f;
            bPtr = q >= n ? q - n : q; BA = I[AV + bPtr]; BB = I[BV + bPtr];
            I[AV + p] = f + 1 === n ? 0 : f + 1;
            claimB = p;
            break;
          }
        }
      }

      bW = bPtr;
      }

      // Execute, specialized on the opcode byte (opcode << 3 | modifier),
      // written in octal: the last digit is the modifier, A B AB BA F X I =
      // 0..6. `next` is the address queued afterwards; -1: the process dies,
      // -2: SPL queued already. cmp is 1 for a compare that does not skip, 2
      // for one that skips.
      let next = pc + 1 === n ? 0 : pc + 1;
      let flags = 0;
      let cmp = 0;
      let r;
      switch (ir) {
        // MOV
        case 0o00: I[AV + bW] = AA; flags = STORED; break;
        case 0o01: I[BV + bW] = AB; flags = STORED; break;
        case 0o02: I[BV + bW] = AA; flags = STORED; break;
        case 0o03: I[AV + bW] = AB; flags = STORED; break;
        case 0o04: I[AV + bW] = AA; I[BV + bW] = AB; flags = STORED; break;
        case 0o05: I[AV + bW] = AB; I[BV + bW] = AA; flags = STORED; break;
        case 0o06: // MOV.I also takes opcode and modes from the A cell as it is now
          I[AV + bW] = AA; I[BV + bW] = AB;
          U[OP + bW] = U[OP + aPtr]; U[AM + bW] = U[AM + aPtr]; U[BM + bW] = U[BM + aPtr];
          if (track) I[ORIGIN + bW] = I[ORIGIN + aPtr];
          flags = STORED;
          break;

        // ADD
        case 0o10: r = BA + AA; I[AV + bW] = r >= n ? r - n : r; flags = STORED; break;
        case 0o11: r = BB + AB; I[BV + bW] = r >= n ? r - n : r; flags = STORED; break;
        case 0o12: r = BB + AA; I[BV + bW] = r >= n ? r - n : r; flags = STORED; break;
        case 0o13: r = BA + AB; I[AV + bW] = r >= n ? r - n : r; flags = STORED; break;
        case 0o14: case 0o16:
          r = BA + AA; I[AV + bW] = r >= n ? r - n : r;
          r = BB + AB; I[BV + bW] = r >= n ? r - n : r;
          flags = STORED;
          break;
        case 0o15:
          r = BA + AB; I[AV + bW] = r >= n ? r - n : r;
          r = BB + AA; I[BV + bW] = r >= n ? r - n : r;
          flags = STORED;
          break;

        // SUB: target minus source
        case 0o20: r = BA - AA; I[AV + bW] = r < 0 ? r + n : r; flags = STORED; break;
        case 0o21: r = BB - AB; I[BV + bW] = r < 0 ? r + n : r; flags = STORED; break;
        case 0o22: r = BB - AA; I[BV + bW] = r < 0 ? r + n : r; flags = STORED; break;
        case 0o23: r = BA - AB; I[AV + bW] = r < 0 ? r + n : r; flags = STORED; break;
        case 0o24: case 0o26:
          r = BA - AA; I[AV + bW] = r < 0 ? r + n : r;
          r = BB - AB; I[BV + bW] = r < 0 ? r + n : r;
          flags = STORED;
          break;
        case 0o25:
          r = BA - AB; I[AV + bW] = r < 0 ? r + n : r;
          r = BB - AA; I[BV + bW] = r < 0 ? r + n : r;
          flags = STORED;
          break;

        // JMZ: .A/.BA test the A field, .B/.AB the B field, .F/.X/.I both
        case 0o60: case 0o63: if (BA === 0) { next = aPtr; flags = NEW_PROCESS; } break;
        case 0o61: case 0o62: if (BB === 0) { next = aPtr; flags = NEW_PROCESS; } break;
        case 0o64: case 0o65: case 0o66: if (BA === 0 && BB === 0) { next = aPtr; flags = NEW_PROCESS; } break;

        // JMN
        case 0o70: case 0o73: if (BA !== 0) { next = aPtr; flags = NEW_PROCESS; } break;
        case 0o71: case 0o72: if (BB !== 0) { next = aPtr; flags = NEW_PROCESS; } break;
        case 0o74: case 0o75: case 0o76: if (BA !== 0 || BB !== 0) { next = aPtr; flags = NEW_PROCESS; } break;

        // DJN decrements the core cell; the jump test uses the values read before.
        case 0o100: case 0o103:
          r = I[AV + bW]; I[AV + bW] = r === 0 ? n - 1 : r - 1;
          if (BA !== 1) { next = aPtr; flags = STORED | NEW_PROCESS; } else flags = STORED;
          break;
        case 0o101: case 0o102:
          r = I[BV + bW]; I[BV + bW] = r === 0 ? n - 1 : r - 1;
          if (BB !== 1) { next = aPtr; flags = STORED | NEW_PROCESS; } else flags = STORED;
          break;
        case 0o104: case 0o105: case 0o106:
          r = I[AV + bW]; I[AV + bW] = r === 0 ? n - 1 : r - 1;
          r = I[BV + bW]; I[BV + bW] = r === 0 ? n - 1 : r - 1;
          if (BA !== 1 || BB !== 1) { next = aPtr; flags = STORED | NEW_PROCESS; } else flags = STORED;
          break;

        // CMP and SEQ: skip when equal
        case 0o110: case 0o160: cmp = BA === AA ? 2 : 1; break;
        case 0o111: case 0o161: cmp = BB === AB ? 2 : 1; break;
        case 0o112: case 0o162: cmp = BB === AA ? 2 : 1; break;
        case 0o113: case 0o163: cmp = BA === AB ? 2 : 1; break;
        case 0o114: case 0o164: cmp = BA === AA && BB === AB ? 2 : 1; break;
        case 0o115: case 0o165: cmp = BB === AA && BA === AB ? 2 : 1; break;
        case 0o116: case 0o166:
          cmp = BA === AA && BB === AB && U[OP + aPtr] === U[OP + bPtr] &&
            U[AM + aPtr] === U[AM + bPtr] && U[BM + aPtr] === U[BM + bPtr] ? 2 : 1;
          break;

        // SNE: skip when not equal
        case 0o170: cmp = BA !== AA ? 2 : 1; break;
        case 0o171: cmp = BB !== AB ? 2 : 1; break;
        case 0o172: cmp = BB !== AA ? 2 : 1; break;
        case 0o173: cmp = BA !== AB ? 2 : 1; break;
        case 0o174: cmp = BA !== AA || BB !== AB ? 2 : 1; break;
        case 0o175: cmp = BB !== AA || BA !== AB ? 2 : 1; break;
        case 0o176:
          cmp = BA !== AA || BB !== AB || U[OP + aPtr] !== U[OP + bPtr] ||
            U[AM + aPtr] !== U[AM + bPtr] || U[BM + aPtr] !== U[BM + bPtr] ? 2 : 1;
          break;

        // SLT: skip when less
        case 0o120: cmp = AA < BA ? 2 : 1; break;
        case 0o121: cmp = AB < BB ? 2 : 1; break;
        case 0o122: cmp = AA < BB ? 2 : 1; break;
        case 0o123: cmp = AB < BA ? 2 : 1; break;
        case 0o124: case 0o126: cmp = AA < BA && AB < BB ? 2 : 1; break;
        case 0o125: cmp = AA < BB && AB < BA ? 2 : 1; break;

        // SPL queues the next instruction, then the new process if the
        // warrior has fewer than maxProcesses.
        case 0o130: case 0o131: case 0o132: case 0o133: case 0o134: case 0o135: case 0o136:
          Q[qBase + tail] = next;
          tail = tail + 1 === qlen ? 0 : tail + 1;
          tasks++;
          if (tasks < maxProcesses) {
            Q[qBase + tail] = aPtr;
            tail = tail + 1 === qlen ? 0 : tail + 1;
            tasks++;
            flags = NEW_PROCESS;
          }
          next = -2;
          break;

        // DAT
        case 0o140: case 0o141: case 0o142: case 0o143: case 0o144: case 0o145: case 0o146:
          next = -1;
          break;

        // JMP
        case 0o150: case 0o151: case 0o152: case 0o153: case 0o154: case 0o155: case 0o156:
          next = aPtr;
          flags = NEW_PROCESS;
          break;

        default: // MUL, DIV, MOD, NOP, LDP, STP
          flags = otherOpcode(this, ws[w], ir, aPtr, bW, AA, AB, BA, BB);
          if ((flags & DIED) !== 0) { next = -1; flags -= DIED; }
          break;
      }
      if (cmp !== 0) {
        if (track) { I[TREAD + bPtr] = time; S[READBY + bPtr] = w; }
        if (cmp === 2) { next = next + 1 === n ? 0 : next + 1; flags = SKIPPED; }
      }

      if (track) {
        // All stores of one instruction are by the same warrior at the
        // same time, so their order does not matter here.
        // bump: +1 for the increments of > and }, -1 for the decrements of
        // < and {, 0 for a store of step 4, the last one wins.
        if (claimA >= 0) { claim(S, I, territory, TWRITE, claimA, w, time); S[BUMP + claimA] = aMode === 3 || aMode === 6 ? -1 : 1; }
        if (claimB >= 0) { claim(S, I, territory, TWRITE, claimB, w, time); S[BUMP + claimB] = bMode === 3 || bMode === 6 ? -1 : 1; }
        if (flags & STORED) { claim(S, I, territory, TWRITE, bW, w, time); S[BUMP + bW] = 0; }
        const slot = TRACE + (time & (TRACE_SIZE - 1));
        I[slot] = pc;
        I[slot + TRACE_SIZE] = aPtr;
        I[slot + 2 * TRACE_SIZE] = bW;
        I[slot + 3 * TRACE_SIZE] = w | (ir << 8) | flags | (next === -1 ? DIED : 0);
      }

      if (next >= 0) {
        Q[qBase + tail] = next;
        tail = tail + 1 === qlen ? 0 : tail + 1;
        tasks++;
      }
      Q[rec + R_TAIL] = tail;
      Q[rec + R_TASKS] = tasks;
      done++;
      if (next === -1) {
        if (tasks === 0) { lastDied = pc; break; }
        const k = eventCount * 4;
        events[k] = KILL;
        events[k + 1] = pc;
        events[k + 2] = w;
        events[k + 3] = time;
        eventCount++;
      }
      current = Q[rec + R_NEXT];
      if (done >= limit) break;
    }
    for (let i = 0; i < nw; i++) {
      const W = ws[i];
      W.head = Q[i * stride + R_HEAD]; W.tail = Q[i * stride + R_TAIL]; W.tasks = Q[i * stride + R_TASKS];
    }
    this.eventCount = eventCount;
    this.time = time;
    this.current = current;
    // The instruction that ended a warrior does not count here; see
    // warriorDied(). (Arithmetic only on paths that run every time: the
    // first run of an operation in a rare branch would discard the optimized
    // code, and code compiled for the loop alone would keep doing so.)
    this.cyclesLeft = cyclesLeft - done + (lastDied >= 0 ? 1 : 0);
    this.lastDied = lastDied;
    return done;
  }

  cell(addr) {
    const a = ((addr % this.coreSize) + this.coreSize) % this.coreSize;
    return {
      op: this.op[a] >> 3, mod: this.op[a] & 7,
      aMode: this.am[a], aVal: this.av[a], bMode: this.bm[a], bVal: this.bv[a],
    };
  }
}
