// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// MARS simulator: executes assembled warriors in a circular core, with the
// bookkeeping the visualizer needs (ownership, timestamps, trace buffer).

import { OP, MOD } from './opcodes.js';
import { DEFAULT_OPTIONS } from './assembler.js';

// Park-Miller minimal standard generator, used for warrior placement.
export function rng(seed) {
  const t = 16807 * (seed % 127773) - 2836 * Math.trunc(seed / 127773);
  return t < 0 ? t + 2147483647 : t;
}

const NEVER = -0x40000000; // initial timestamp: "long ago"
const EMPTY_CELL = (OP.DAT << 3) | MOD.F;
const DIRECT = 1;
const EVENT_KILL = 0, EVENT_DEATH = 1;
const CHUNK = 4096; // run() executes in chunks of at most this many instructions

// traceMeta flag bits
export const TRACE_STORED = 1 << 16; // step 4 stored something at the B pointer
export const TRACE_NEW_PROCESS = 1 << 17; // a jump to, or SPL of, the A pointer
export const TRACE_DIED = 1 << 18; // the process died
export const TRACE_SKIPPED = 1 << 19; // the next instruction was skipped

// Opcode numbers as plain constants for the hot loop.
const MOV = OP.MOV, ADD = OP.ADD, SUB = OP.SUB, MUL = OP.MUL, DIV = OP.DIV, MODOP = OP.MOD;
const JMZ = OP.JMZ, JMN = OP.JMN, DJN = OP.DJN, CMP = OP.CMP, SLT = OP.SLT, SPL = OP.SPL;
const DAT = OP.DAT, JMP = OP.JMP, SEQ = OP.SEQ, SNE = OP.SNE, NOP = OP.NOP, LDP = OP.LDP, STP = OP.STP;

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

// target <op> source for the MOV and arithmetic opcodes, modulo n.
// Returns -1 for a division by zero.
function combine(opcode, target, source, n) {
  switch (opcode) {
    case MOV: return source;
    case ADD: { const r = target + source; return r >= n ? r - n : r; }
    case SUB: { const r = target - source; return r < 0 ? r + n : r; }
    case MUL: return (target * source) % n;
    case DIV: return source === 0 ? -1 : Math.trunc(target / source);
    default: return source === 0 ? -1 : target % source; // MOD
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
    const n = (this.coreSize = this.opt.coreSize);
    this.op = new Uint8Array(n);
    this.am = new Uint8Array(n);
    this.bm = new Uint8Array(n);
    this.av = new Int32Array(n);
    this.bv = new Int32Array(n);
    this.owner = new Int8Array(n);
    this.execBy = new Int8Array(n);
    this.origin = new Int32Array(n);
    this.tWrite = new Int32Array(n);
    this.tRead = new Int32Array(n);
    this.tExec = new Int32Array(n);

    this.traceSize = 4096;
    this.tracePc = new Int32Array(this.traceSize);
    this.traceA = new Int32Array(this.traceSize);
    this.traceB = new Int32Array(this.traceSize);
    this.traceMeta = new Int32Array(this.traceSize);

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

    // Hot-loop state, mirrored into the warrior objects after each run().
    this.territory = new Int32Array(0); // per warrior
    this.nextLive = new Int32Array(0); // execution order: next living warrior
    this.heatAll = new Float32Array(0); // all execHeat arrays
    this.heatBase = new Int32Array(0); // start of each warrior's execHeat in heatAll
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

  addEvent(type, addr, warrior, time) {
    let k = this.eventCount * 4;
    if (k === this.eventBuffer.length) {
      const bigger = new Int32Array(k * 2);
      bigger.set(this.eventBuffer);
      this.eventBuffer = bigger;
    }
    const buf = this.eventBuffer;
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
    this.origin.fill(-1);
    this.tWrite.fill(NEVER);
    this.tRead.fill(NEVER);
    this.tExec.fill(NEVER);
  }

  load(codes, { seed, positions } = {}) {
    const o = this.opt;
    for (const c of codes) {
      if (!c.ok) throw new Error(`warrior '${c.name}' did not assemble`);
      if (c.instructions.length > o.maxLength) throw new Error(`warrior '${c.name}' is longer than ${o.maxLength}`);
    }
    if (codes.length * o.minDistance > o.coreSize) throw new Error('too many warriors for the core size and minimum distance');

    // The execHeat arrays are views into one buffer, indexed in the hot loop
    // by heatBase[warrior] + instruction.
    this.heatBase = new Int32Array(codes.length);
    let total = 0;
    codes.forEach((c, i) => { this.heatBase[i] = total; total += c.instructions.length; });
    this.heatAll = new Float32Array(total);

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
        queue: new Int32Array(o.maxProcesses + 1), head: 0, tail: 0, tasks: 0,
        alive: false, pspace, lastResult: o.coreSize - 1,
        score: new Array(2 * codes.length - 1).fill(0), wins: 0, losses: 0, ties: 0,
        territory: 0, execHeat: this.heatAll.subarray(this.heatBase[index], this.heatBase[index] + code.instructions.length), diedAt: null,
      };
    });
    this.seed = seed === undefined ? rng(1 + Math.floor(Math.random() * 2147483646)) : seed;
    this.fixedPositions = positions ?? null;
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
    this.territory = new Int32Array(count);
    this.nextLive = new Int32Array(count);
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
      this.nextLive[w.index] = (w.index + 1) % count;
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
    const next = this.nextLive;
    let prev = w;
    while (next[prev] !== w) prev = next[prev];
    next[prev] = next[w];
    this.current = next[w];
    if (--this.cyclesLeft <= 0) this.endRound();
  }

  step() {
    this.run(1);
  }

  // ---- execution

  // Marks a store into cell `addr` by warrior `w` at `time`.
  claim(addr, w, time) {
    this.tWrite[addr] = time;
    const owner = this.owner;
    const o = owner[addr];
    if (o !== w) {
      if (o >= 0) this.territory[o]--;
      this.territory[w]++;
      owner[addr] = w;
    }
  }

  // Pointer of an operand of the instruction at `pc` with addressing `mode`
  // and field value `value`. Does the pre-decrement of `<` and `{`; the
  // caller reads the cell and then calls postIncrement() for `>` and `}`.
  pointer(pc, mode, value, w, time) {
    if (mode === 0) return pc; // #: the instruction itself
    const n = this.coreSize;
    let p = pc + value; if (p >= n) p -= n;
    if (mode === 1) return p; // $
    let f;
    if (mode <= 4) { // @ < > indirect through the B field of p
      f = this.bv[p];
      if (mode === 3) { f = f === 0 ? n - 1 : f - 1; this.bv[p] = f; this.claim(p, w, time); }
    } else { // * { } indirect through the A field of p
      f = this.av[p];
      if (mode === 6) { f = f === 0 ? n - 1 : f - 1; this.av[p] = f; this.claim(p, w, time); }
    }
    p += f;
    return p >= n ? p - n : p;
  }

  // The post-increment of an operand with mode `>` or `}`.
  postIncrement(pc, mode, value, w, time) {
    const n = this.coreSize;
    let p = pc + value; if (p >= n) p -= n;
    const field = mode === 4 ? this.bv : this.av;
    const f = field[p] + 1;
    field[p] = f === n ? 0 : f;
    this.claim(p, w, time);
  }

  // Executes up to `count` instructions; returns how many were executed.
  // Stops early when the round ends.
  run(count) {
    let done = 0;
    while (done < count && !this.roundOver) {
      const r = this.execute(Math.min(count - done, CHUNK));
      done += r >> 1;
      if (r & 1) this.processDied();
      else if (this.cyclesLeft <= 0) this.endRound();
    }
    for (const W of this.warriors) W.territory = this.territory[W.index];
    return done;
  }

  // Handles the process of the current warrior that execute() saw die.
  processDied() {
    const w = this.current;
    const slot = this.time & (this.traceSize - 1);
    const pc = this.tracePc[slot];
    this.addEvent(EVENT_KILL, pc, w, this.time);
    if (this.warriors[w].tasks === 0) {
      this.warriorDied(w, pc);
      return;
    }
    this.current = this.nextLive[w];
    if (--this.cyclesLeft <= 0) this.endRound();
  }

  // The hot loop: executes up to `count` instructions of the running round.
  // Returns 2 * executed, plus 1 if the last one killed its process; the
  // caller does the bookkeeping for that (and for the end of the round, when
  // cyclesLeft reached 0). Allocates nothing.
  //
  // Rarely taken branches avoid operations that need type feedback, because
  // the first visit of such a branch would discard the optimized code.
  execute(count) {
    const n = this.coreSize;
    const op = this.op, am = this.am, bm = this.bm, av = this.av, bv = this.bv;
    const execBy = this.execBy, origin = this.origin, tRead = this.tRead, tExec = this.tExec;
    const tracePc = this.tracePc, traceA = this.traceA, traceB = this.traceB, traceMeta = this.traceMeta;
    const traceMask = this.traceSize - 1;
    const ws = this.warriors, heatAll = this.heatAll, heatBase = this.heatBase, nextLive = this.nextLive;
    const maxProcesses = this.opt.maxProcesses;
    const pSpaceSize = this.opt.pSpaceSize;
    const qlen = maxProcesses + 1;

    let time = this.time;
    let current = this.current;
    let cyclesLeft = this.cyclesLeft;
    let done = 0;
    let died = 0;
    while (done < count) {
      done++;
      const w = current;
      const W = ws[w];
      const queue = W.queue;
      time++;

      // Take the next process of the current warrior.
      const pc = queue[W.head];
      W.head = W.head + 1 === qlen ? 0 : W.head + 1;
      W.tasks--;

      tExec[pc] = time;
      execBy[pc] = w;
      const org = origin[pc];
      if (org >= 0) heatAll[heatBase[org >> 16] + (org & 0xffff)] += 1;

      // Fetch into the instruction register. For an immediate A operand the
      // core still equals the register when it is read.
      const ir = op[pc];
      const opcode = ir >> 3;
      const bits = MOD_BITS[ir & 7];
      const irA = av[pc];
      const irB = bv[pc];
      const aMode = am[pc];
      const bMode = bm[pc];

      const aPtr = this.pointer(pc, aMode, irA, w, time);
      const AA = av[aPtr], AB = bv[aPtr];
      if (aMode === 4 || aMode === 7) this.postIncrement(pc, aMode, irA, w, time);
      if (aMode !== 0) tRead[aPtr] = time;
      const bPtr = this.pointer(pc, bMode, irB, w, time);
      const BA = av[bPtr], BB = bv[bPtr];
      if (bMode === 4 || bMode === 7) this.postIncrement(pc, bMode, irB, w, time);

      // The pairs of field values selected by the modifier.
      const srcA = (bits & A_FROM_B) !== 0 ? AB : AA; // source for the A field
      const srcB = (bits & B_FROM_A) !== 0 ? AA : AB; // source for the B field
      const useA = (bits & USE_A) !== 0;
      const useB = (bits & USE_B) !== 0;

      // `next` is the address queued afterwards; -1: the process dies,
      // -2: SPL queued already.
      let next = pc + 1 === n ? 0 : pc + 1;
      let flags = 0;
      switch (opcode) {
        case DAT:
          next = -1;
          break;

        case MOV: case ADD: case SUB: case MUL: case DIV: case MODOP: {
          // DIV and MOD store the field with a non-zero divisor and then kill
          // the process if the other divisor was zero.
          if (useA) {
            const r = combine(opcode, BA, srcA, n);
            if (r < 0) next = -1; else { av[bPtr] = r; flags = TRACE_STORED; }
          }
          if (useB) {
            const r = combine(opcode, BB, srcB, n);
            if (r < 0) next = -1; else { bv[bPtr] = r; flags = TRACE_STORED; }
          }
          if (opcode === MOV && (ir & 7) === MOD.I) {
            // MOV.I takes opcode and modes from the A cell as it is now.
            op[bPtr] = op[aPtr]; am[bPtr] = am[aPtr]; bm[bPtr] = bm[aPtr];
            origin[bPtr] = origin[aPtr];
          }
          if (flags !== 0) this.claim(bPtr, w, time);
          break;
        }

        case JMP:
          next = aPtr;
          flags = TRACE_NEW_PROCESS;
          break;

        case JMZ: case JMN: {
          // .A/.BA test the A field, .B/.AB the B field, .F/.X/.I both.
          const zeroA = BA === 0;
          const zeroB = BB === 0;
          const zero = (!useA || zeroA) && (!useB || zeroB);
          const jump = opcode === JMZ ? zero : (useA && !zeroA) || (useB && !zeroB);
          if (jump) { next = aPtr; flags = TRACE_NEW_PROCESS; }
          break;
        }

        case DJN: {
          // Decrements the core cell; the jump test uses the values read before.
          const fa = av[bPtr];
          const fb = bv[bPtr];
          if (useA) av[bPtr] = fa === 0 ? n - 1 : fa - 1;
          if (useB) bv[bPtr] = fb === 0 ? n - 1 : fb - 1;
          this.claim(bPtr, w, time);
          const oneA = BA === 1;
          const oneB = BB === 1;
          if ((useA && !oneA) || (useB && !oneB)) { next = aPtr; flags = TRACE_STORED | TRACE_NEW_PROCESS; }
          else flags = TRACE_STORED;
          break;
        }

        case CMP: case SEQ: case SNE: case SLT: {
          let skip;
          if (opcode === SLT) {
            const lessA = srcA < BA;
            const lessB = srcB < BB;
            skip = (!useA || lessA) && (!useB || lessB);
          } else {
            const sameA = BA === srcA;
            const sameB = BB === srcB;
            const sameI = op[aPtr] === op[bPtr] && am[aPtr] === am[bPtr] && bm[aPtr] === bm[bPtr];
            const equal = (!useA || sameA) && (!useB || sameB) && ((ir & 7) !== MOD.I || sameI);
            skip = equal !== (opcode === SNE);
          }
          tRead[bPtr] = time;
          if (skip) { next = next + 1 === n ? 0 : next + 1; flags = TRACE_SKIPPED; }
          break;
        }

        case SPL: {
          queue[W.tail] = next;
          W.tail = W.tail + 1 === qlen ? 0 : W.tail + 1;
          W.tasks++;
          if (W.tasks < maxProcesses) {
            queue[W.tail] = aPtr;
            W.tail = W.tail + 1 === qlen ? 0 : W.tail + 1;
            W.tasks++;
            flags = TRACE_NEW_PROCESS;
          }
          next = -2;
          break;
        }

        case LDP: case STP: {
          // Only .A and .BA work on A fields; .F, .X and .I act like .B.
          // Index 0 of the p-space is the result of the last round.
          const onA = !useB;
          const src = onA ? srcA : useA ? AB : srcB;
          if (opcode === LDP) {
            const index = src % pSpaceSize;
            const v = index === 0 ? W.lastResult : W.pspace[index];
            if (onA) av[bPtr] = v; else bv[bPtr] = v;
            this.claim(bPtr, w, time);
            flags = TRACE_STORED;
          } else {
            const index = (onA ? BA : BB) % pSpaceSize;
            if (index === 0) W.lastResult = src; else W.pspace[index] = src;
          }
          break;
        }

        default: // NOP
          break;
      }

      const slot = time & traceMask;
      tracePc[slot] = pc;
      traceA[slot] = aPtr;
      traceB[slot] = bPtr;
      traceMeta[slot] = w | (ir << 8) | flags | (next === -1 ? TRACE_DIED : 0);

      if (next === -1) { died = 1; break; }
      if (next >= 0) {
        queue[W.tail] = next;
        W.tail = W.tail + 1 === qlen ? 0 : W.tail + 1;
        W.tasks++;
      }
      current = nextLive[w];
      if (--cyclesLeft <= 0) break;
    }
    this.time = time;
    this.current = current;
    this.cyclesLeft = cyclesLeft;
    return done * 2 + died;
  }

  cell(addr) {
    const a = ((addr % this.coreSize) + this.coreSize) % this.coreSize;
    return {
      op: this.op[a] >> 3, mod: this.op[a] & 7,
      aMode: this.am[a], aVal: this.av[a], bMode: this.bm[a], bVal: this.bv[a],
    };
  }
}
