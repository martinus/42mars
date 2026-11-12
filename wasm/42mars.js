// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The 42mars library (lib/42mars.h) in WebAssembly: the assembler and the
// simulator with pMARS's results, the npm package `42mars`. The API is in
// 42mars.d.ts and in docs/redcode-semantics.md, sections 2 and 3.
//
//   const m = await createWasmMars({ coreSize: 8000 });
//   m.load(codes, { seed });            // codes: assembleWasm() results
//   m.startRound(); while (!m.roundOver) m.run(1e6);
//   m.runMatch(codes, { rounds: 200, seed })   // whole match inside wasm
//   m.runMatch(codes, { rounds: 50, seed, firstRound: 150 }) // its last 50 rounds
//   m.runMatch(codes.map((c) => packWarrior(c)), ...)        // prepared warriors
//   createWasmMars({ watch: true })     // records what a visualizer shows: watch(), events()
//
// - The core size is at most 65536 (cells hold 16-bit values), maxProcesses
//   and pSpaceSize at most 2^24, and there are 1 to 255 warriors.
// - `seed` must be a non-negative safe integer and fixed positions
//   non-negative integers; anything else throws a RangeError.
// - core() and op, am, bm, av, bv are snapshots: typed arrays decoded from
//   the wasm core (op = opcode << 3 | modifier), reused until the next
//   load(), startRound(), run(), step(), endRound() or runMatch(). Do not
//   write into them, and read them again after running.
// - Warrior objects have getters instead of fields; `score` and `pspace`
//   return copies. `processes()` returns the queued addresses, the next one
//   to run first; `queue()` the same as a view of engine memory.
// - runMatch() stops tie rounds early by default, see there.

// The rules of pMARS 0.9.5 without options (ICWS'94), as option names.
export const DEFAULT_OPTIONS = Object.freeze({
  coreSize: 8000, maxProcesses: 8000, maxCycles: 80000, maxLength: 100,
  minDistance: 100, rounds: 1, warriors: 2,
  pSpaceSize: 0, // 0 means floor(coreSize / 16)
  readLimit: 0, // 0 means coreSize
  writeLimit: 0, // 0 means coreSize
});

// Park-Miller minimal standard generator, used for warrior placement.
export function rng(seed) {
  const t = 16807 * (seed % 127773) - 2836 * Math.trunc(seed / 127773);
  return t < 0 ? t + 2147483647 : t;
}

const WASM_URL = new URL('./42mars.wasm', import.meta.url);
const MAX_CORE = 65536;
const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

let compiled = null; // WebAssembly.Module once compiled

// Compiles 42mars.wasm once (fetch in browsers, the file system in Node) and
// returns the WebAssembly.Module.
export async function compileWasmMars() {
  if (compiled) return compiled;
  let bytes;
  if (isNode) {
    const { readFile } = await import('node:fs/promises');
    bytes = await readFile(WASM_URL);
  } else {
    const response = await fetch(WASM_URL);
    if (!response.ok) throw new Error(`cannot load ${WASM_URL}: ${response.status}`);
    bytes = await response.arrayBuffer();
  }
  compiled = await WebAssembly.compile(bytes);
  return compiled;
}

function compileSync() {
  if (compiled) return compiled;
  const fs = isNode && typeof process.getBuiltinModule === 'function' ? process.getBuiltinModule('node:fs') : null;
  if (!fs) throw new Error('createWasmMarsSync: call compileWasmMars() first or pass a WebAssembly.Module');
  compiled = new WebAssembly.Module(fs.readFileSync(WASM_URL));
  return compiled;
}

// Async constructor, works in Node and browsers.
export async function createWasmMars(options = {}) {
  return new WasmMars(new WebAssembly.Instance(await compileWasmMars()), options);
}

// Synchronous constructor: with a module from compileWasmMars(), or in Node
// 20.16+ / 22.3+ without one (reads the file synchronously).
export function createWasmMarsSync(options = {}, module = undefined) {
  return new WasmMars(new WebAssembly.Instance(module ?? compileSync()), options);
}

// A warrior in the form the engine loads: 5 integers per instruction (op
// byte, A mode, A value, B mode, B value) in `packed`, an Int32Array. load()
// and runMatch() copy `packed` into the engine with one block copy; a warrior
// from assemble() is converted on every load. The array may be a view into a
// SharedArrayBuffer, so that worker threads share one copy of all warriors
// (tools/tournament.mjs).
export function packWarrior(code, packed = new Int32Array(5 * code.instructions.length)) {
  let k = 0;
  for (const ins of code.instructions) {
    packed[k++] = (ins.op << 3) | ins.mod;
    packed[k++] = ins.aMode;
    packed[k++] = ins.aVal;
    packed[k++] = ins.bMode;
    packed[k++] = ins.bVal;
  }
  return { ok: code.ok, name: code.name, author: code.author, start: code.start, pin: code.pin, packed };
}

const lengthOf = (code) => (code.packed ? code.packed.length / 5 : code.instructions.length);

// Why a warrior does not fit a core of `size` cells, or null: the fields of
// m42_instruction (42mars.h) and the start, which m42_load() checks too.
function misfit(code, size) {
  const inRange = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
  if (!inRange(code.start, size)) return `start ${code.start} is not below the core size ${size}`;
  for (let k = 0; k < lengthOf(code); k++) {
    let op, mod, aMode, aVal, bMode, bVal;
    if (code.packed) {
      const p = code.packed, j = 5 * k;
      if (!inRange(p[j], 19 << 3)) return `instruction ${k} has the opcode word ${p[j]}`;
      [op, mod, aMode, aVal, bMode, bVal] = [p[j] >> 3, p[j] & 7, p[j + 1], p[j + 2], p[j + 3], p[j + 4]];
    } else {
      ({ op, mod, aMode, aVal, bMode, bVal } = code.instructions[k]);
    }
    const bad = !inRange(op, 19) ? `opcode ${op}` : !inRange(mod, 7) ? `modifier ${mod}`
      : !inRange(aMode, 8) ? `A mode ${aMode}` : !inRange(bMode, 8) ? `B mode ${bMode}`
      : !inRange(aVal, size) ? `A value ${aVal}` : !inRange(bVal, size) ? `B value ${bVal}` : null;
    if (bad) return `instruction ${k} has ${bad} (core size ${size})`;
  }
  return null;
}

function effectiveOptions(options) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  if (!o.pSpaceSize) o.pSpaceSize = Math.floor(o.coreSize / 16);
  if (!o.readLimit) o.readLimit = o.coreSize;
  if (!o.writeLimit) o.writeLimit = o.coreSize;
  return o;
}

const isCount = (v) => Number.isSafeInteger(v) && v >= 0;

// ---------------------------------------------------------------- memory

// The memory of one instance. lib/42mars.h takes all its memory from the
// caller: here the linear memory above __heap_base, grown when needed.
// keep() is for the life of the instance (the context's heap), scratch()
// for one call, until the next reset().
class Memory {
  constructor(x) {
    this.x = x;
    this.top = (x.__heap_base.value + 63) & ~63;
    this.mark = this.top;
    this.buffer = null;
  }

  keep(bytes) {
    const at = this.top;
    this.top = (at + bytes + 63) & ~63;
    this.mark = this.top;
    this.ensure(this.top);
    return at;
  }

  reset() {
    this.mark = this.top;
  }

  scratch(bytes) {
    const at = (this.mark + 7) & ~7;
    this.mark = at + bytes;
    this.ensure(this.mark);
    return at;
  }

  // Only here does the memory grow (the C code has no memory.grow): the
  // views are renewed here, and views() does not ask the memory each time.
  ensure(end) {
    const have = this.x.memory.buffer.byteLength;
    if (end > have) {
      this.x.memory.grow(Math.ceil((end - have) / 65536));
      this.buffer = null;
    }
  }

  // Views of the linear memory.
  views() {
    if (!this.buffer) {
      this.buffer = this.x.memory.buffer;
      this.u8 = new Uint8Array(this.buffer);
      this.dv = new DataView(this.buffer);
    }
    return this;
  }

  // A 0-terminated string at `at`.
  cString(at) {
    const { u8 } = this.views();
    let end = at;
    while (u8[end]) end++;
    return latin1Decoder.decode(u8.subarray(at, end));
  }
}

const memories = new WeakMap(); // exports -> Memory
const memoryOf = (x) => {
  let m = memories.get(x);
  if (!m) memories.set(x, (m = new Memory(x)));
  return m;
};

// m42_rules (11 uint32, 44 bytes) for the options, see lib/42mars.h.
function writeRules(mem, at, o, warriors) {
  const { dv } = mem.views();
  [44, o.coreSize, o.maxCycles, o.maxProcesses, o.maxLength, o.minDistance, o.pSpaceSize, o.readLimit, o.writeLimit,
    o.rounds, warriors].forEach((v, i) => dv.setUint32(at + 4 * i, v, true));
}

const M42_OK = 0;
const M42_ERR_MEMORY = -1;
// M42_TRACE_SIZE and M42_DEATH_SIZE of 42mars.h: the watch's trace
// entries and process deaths
const TRACE_SIZE = 4096;
const DEATH_SIZE = 1024;

function check(x, mem, status) {
  if (status === M42_OK) return;
  if (status === M42_ERR_MEMORY) throw new Error('wasm engine: out of memory');
  throw new Error(`wasm engine: ${mem.cString(x.m42_status_text(status))}`);
}

// ---------------------------------------------------------------- simulator

// Offsets in the struct area of an instance: m42_rules, m42_match_options
// (40 bytes: size, rounds, first_round, early_tie, int64 seed at 16,
// positions at 24, log at 28, permute at 32, pspace at 36), m42_state (32 bytes),
// m42_warrior_state (40 bytes), and room for single values.
const S_RULES = 0, S_OPTIONS = 48, S_STATE = 88, S_WARRIOR = 120, S_VALUE = 160, S_SIZE = 192;
// sizeof m42_state and m42_warrior_state, passed to the getters
const STATE_SIZE = 32, WARRIOR_STATE_SIZE = 40;

class WasmMars {
  constructor(instance, options) {
    this.opt = effectiveOptions(options);
    const o = this.opt;
    if (!Number.isInteger(o.coreSize) || o.coreSize < 1 || o.coreSize > MAX_CORE) {
      throw new RangeError(`the wasm engine supports core sizes 1 to ${MAX_CORE}`);
    }
    for (const k of ['maxProcesses', 'maxCycles', 'minDistance', 'maxLength', 'pSpaceSize']) {
      if (!isCount(o[k]) || o[k] > 0xffffffff) throw new RangeError(`bad option ${k}: ${o[k]}`);
    }
    // Queues and p-spaces live in a 32-bit linear memory.
    if (o.maxProcesses > 1 << 24) throw new RangeError('the wasm engine supports maxProcesses up to 2^24');
    if (o.pSpaceSize > 1 << 24) throw new RangeError('the wasm engine supports pSpaceSize up to 2^24');
    this.coreSize = o.coreSize;
    this.x = instance.exports;
    this.mem = memoryOf(this.x);
    this.structs = this.mem.keep(S_SIZE);
    this.ctx = 0;
    this.capacity = 0; // warriors the context was made for
    this.warriors = [];
    this.results = [];
    this.roundResult = null;
    this.version = 0; // bumped by everything that can change the core
    this.snapshot = null;
    this.snapshotVersion = -1;
    // options.watch: a watch (42mars.h) attached to the context, see watch()
    this.watching = Boolean(options.watch);
    this.watchAt = 0; // its m42_watch header
    this.watchViews = null;
    this.deathsRead = 0; // deaths of the round that events() returned
  }

  // The status a function that returns a pointer left in S_VALUE.
  statusValue() {
    return this.mem.views().dv.getInt32(this.structs + S_VALUE, true);
  }

  // Byte view of the linear memory, renewed after it grew.
  bytes() {
    return this.mem.views().u8;
  }

  // The context, made again with a larger heap when a load has more
  // warriors than it was made for.
  context(n) {
    if (n <= this.capacity) return;
    const x = this.x;
    writeRules(this.mem, this.structs + S_RULES, this.opt, n);
    const size = x.m42_ctx_size(this.structs + S_RULES);
    if (!size) throw new RangeError('wasm engine: rules out of range');
    const heap = this.mem.keep(size);
    const ctx = x.m42_ctx_init(heap, size, this.structs + S_RULES, this.structs + S_VALUE);
    if (!ctx) check(x, this.mem, this.statusValue());
    this.ctx = ctx;
    this.capacity = n;
    if (this.watching) {
      const wsize = x.m42_watch_size(this.structs + S_RULES);
      const block = this.mem.keep(wsize);
      this.watchAt = x.m42_watch_attach(ctx, block, wsize, this.structs + S_VALUE);
      if (!this.watchAt) check(x, this.mem, this.statusValue());
      this.watchViews = null;
    }
  }

  // Checks the warriors and writes them, their pointers and the options
  // into scratch memory: m42_warrior_make() per warrior. Returns the
  // address of the pointer array.
  prepare(codes, { seed, positions, permute = false, rounds = 1, firstRound = 0, earlyTie = true, log = 0 }) {
    const o = this.opt;
    for (const c of codes) {
      if (!c.ok) throw new Error(`warrior '${c.name}' did not assemble`);
      if (lengthOf(c) > o.maxLength) throw new Error(`warrior '${c.name}' is longer than ${o.maxLength}`);
      const why = misfit(c, o.coreSize);
      if (why) throw new Error(`warrior '${c.name}' does not fit the rules: ${why}`);
    }
    if (codes.length * o.minDistance > o.coreSize) throw new Error('too many warriors for the core size and minimum distance');
    if (codes.length < 1 || codes.length > 255) throw new RangeError('the wasm engine supports 1 to 255 warriors');
    if (seed !== undefined && !isCount(seed)) throw new RangeError(`seed must be a non-negative safe integer: ${seed}`);
    if (positions && (positions.length < codes.length || !positions.every((p) => isCount(p) && p < o.coreSize))) {
      throw new RangeError(`positions must be integers from 0 to ${o.coreSize - 1}, one per warrior`);
    }
    if (permute && (codes.length !== 2 || positions)) throw new RangeError('permute needs two warriors and no fixed positions');
    const n = codes.length;
    this.context(n);
    const x = this.x;
    const mem = this.mem;
    mem.reset();
    const ws = mem.scratch(4 * n);
    for (let i = 0; i < n; i++) {
      const c = codes[i];
      const len = lengthOf(c);
      const code = mem.scratch(16 * len);
      const pin = c.pin !== null && c.pin !== undefined ? mem.scratch(8) : 0;
      const size = x.m42_warrior_make_size(len);
      const at = mem.scratch(size);
      const { u8, dv } = mem.views();
      // m42_instruction: opcode, modifier, A mode, B mode, then uint32 A, B, line
      const put = (k, op, aMode, aVal, bMode, bVal) => {
        const p = code + 16 * k;
        u8[p] = op >> 3; u8[p + 1] = op & 7; u8[p + 2] = aMode; u8[p + 3] = bMode;
        dv.setUint32(p + 4, aVal, true); dv.setUint32(p + 8, bVal, true); dv.setInt32(p + 12, 0, true);
      };
      if (c.packed) {
        for (let k = 0, j = 0; k < len; k++, j += 5) put(k, c.packed[j], c.packed[j + 1], c.packed[j + 2], c.packed[j + 3], c.packed[j + 4]);
      } else {
        c.instructions.forEach((ins, k) => put(k, (ins.op << 3) | ins.mod, ins.aMode, ins.aVal, ins.bMode, ins.bVal));
      }
      if (pin) dv.setBigInt64(pin, BigInt(c.pin), true);
      const w = x.m42_warrior_make(code, len, c.start, pin, at, size);
      if (!w) throw new Error(`wasm engine: cannot load warrior '${c.name}'`);
      mem.views().dv.setUint32(ws + 4 * i, w, true);
    }
    let pos = 0;
    if (positions) {
      pos = mem.scratch(4 * n);
      for (let i = 0; i < n; i++) mem.views().dv.setUint32(pos + 4 * i, positions[i], true);
    }
    const s = seed === undefined ? rng(1 + Math.floor(Math.random() * 2147483646)) : seed;
    const { dv } = mem.views();
    const opt = this.structs + S_OPTIONS;
    [40, rounds, firstRound, earlyTie ? 1 : 0].forEach((v, i) => dv.setUint32(opt + 4 * i, v, true));
    dv.setBigInt64(opt + 16, BigInt(s), true);
    dv.setUint32(opt + 24, pos, true);
    dv.setUint32(opt + 28, log, true);
    dv.setUint32(opt + 32, permute ? 1 : 0, true);
    dv.setUint32(opt + 36, 0, true); // pspace: runMatch() sets it
    return ws;
  }

  load(codes, { seed, positions, permute } = {}) {
    const ws = this.prepare(codes, { seed, positions, permute });
    check(this.x, this.mem, this.x.m42_load(this.ctx, ws, codes.length, this.structs + S_OPTIONS));
    this.warriors = codes.map((code, index) => new WarriorView(this, index, code));
    this.results = [];
    this.roundResult = null;
    this.version++;
  }

  startRound() {
    this.x.m42_start_round(this.ctx);
    this.roundResult = null;
    this.version++;
    this.deathsRead = 0;
  }

  // Executes up to n instructions; returns how many. Stops early when the
  // round ends. A fraction rounds up.
  run(n) {
    if (this.roundResult !== null || this.roundOver || !(n > 0)) return 0;
    const count = n >= 1.8e19 ? 2n ** 64n - 1n : BigInt(Math.ceil(n));
    const done = Number(this.x.m42_run(this.ctx, count));
    this.version++;
    if (this.roundOver) this.recordResult();
    return done;
  }

  step() {
    this.run(1);
  }

  endRound() {
    if (this.roundOver) return;
    this.x.m42_end_round(this.ctx);
    this.version++;
    this.recordResult();
  }

  recordResult() {
    const survivors = [];
    for (let i = 0; i < this.warriors.length; i++) if (this.warriors[i].alive) survivors.push(i);
    this.roundResult = { round: this.round, cycles: this.time, survivors };
    this.results.push(this.roundResult);
  }

  // Loads the warriors and plays the whole match inside wasm. Returns
  // { warriors: [{ name, wins, losses, ties, score }], results, instructions }
  // where results are the round results as in `results` and instructions
  // the number actually executed.
  //
  // earlyTie (default true): a round that can only end in a tie stops as
  // soon as that is certain: every living warrior has more processes than
  // it has turns left (only when no warrior's code contains STP), or the
  // core has no DAT, DIV, MOD or STP left. Checked at most every 4096
  // instructions. Scores, round
  // results (including cycles), p-space and the following rounds are the
  // same; the core and the process queues at the end of such a round are
  // not, so pass false to compare cores.
  //
  // firstRound (default 0): play rounds firstRound + 1 to firstRound +
  // rounds of the match, with the positions and first movers of those
  // rounds, but with p-space and the last results starting empty. Only LDP
  // reads them, so for warriors without LDP in their code the result of
  // every round is the same as in the whole match, and the rounds can run
  // in blocks on several engines (tools/tournament.mjs does that).
  //
  // pspace: carries p-space and the last results from one call to the
  // next, so that blocks of rounds give the rounds of the whole match also
  // with LDP. true starts as a match starts; else one Int32Array per warrior
  // (pSpaceSize cells, at least 1, cell 0 the last result), as a previous
  // call returned it. With it, each warrior of the result has `pspace` after
  // the last round. Warriors with the same PIN share cells 1 and up.
  //
  // permute (default false, also for load()): pmars -P, two warriors only.
  // Each position and first mover comes once before any of them repeats
  // (semantics doc, 3.2); the seed of pmars -P -F x is 2 * (x - minDistance).
  runMatch(codes, { rounds = this.opt.rounds, seed, positions, permute, earlyTie = true, firstRound = 0, pspace } = {}) {
    if (!isCount(rounds) || !isCount(firstRound) || rounds + firstRound > 0xffffffff) {
      throw new RangeError(`bad rounds or firstRound: ${rounds}, ${firstRound}`);
    }
    const x = this.x;
    const nw = codes.length;
    // The log goes behind the warriors in scratch memory; prepare() resets it.
    const ws = this.prepare(codes, { seed, positions, permute, rounds, firstRound, earlyTie });
    const log = this.mem.scratch(x.m42_log_size(nw, rounds));
    const scores = this.mem.scratch(12 * nw); // m42_score: wins, losses, ties
    const counters = this.mem.scratch(4 * (2 * nw - 1));
    this.mem.views().dv.setUint32(this.structs + S_OPTIONS + 28, log, true);
    const cells = Math.max(1, this.opt.pSpaceSize);
    let ps = 0;
    if (pspace) {
      if (pspace !== true && (!Array.isArray(pspace) || pspace.length !== nw || pspace.some((p) => p.length !== cells))) {
        throw new RangeError(`pspace: true, or one array of ${cells} cells per warrior`);
      }
      if (pspace !== true && pspace.some((p) => p.some((v) => !Number.isInteger(v) || v < 0 || v >= this.coreSize))) {
        throw new RangeError(`pspace: every value must be from 0 to ${this.coreSize - 1}`);
      }
      ps = this.mem.scratch(4 * cells * nw);
      const view = new Int32Array(this.bytes().buffer, ps, cells * nw);
      for (let i = 0; i < nw; i++) {
        if (pspace === true) { view.fill(0, i * cells, (i + 1) * cells); view[i * cells] = this.coreSize - 1; } // as load() starts
        else view.set(pspace[i], i * cells);
      }
      this.mem.views().dv.setUint32(this.structs + S_OPTIONS + 36, ps, true);
    }
    check(x, this.mem, x.m42_match(this.ctx, ws, nw, this.structs + S_OPTIONS, scores, this.structs + S_VALUE));
    this.version++;
    const { u8, dv } = this.mem.views();
    const instructions = Number(dv.getBigUint64(this.structs + S_VALUE, true));
    const stride = x.m42_log_stride(nw);
    const results = [];
    for (let r = 0; r < rounds; r++) {
      const at = log + r * stride;
      const survivors = [];
      for (let i = 0; i < nw; i++) if (u8[at + 8 + i]) survivors.push(i);
      results.push({ round: firstRound + r + 1, cycles: Number(dv.getBigUint64(at, true)), survivors });
    }
    this.warriors = codes.map((code, index) => new WarriorView(this, index, code));
    this.results = results;
    this.roundResult = results.length ? results[results.length - 1] : null;
    // The scores from m42_match, the counters with one call per warrior:
    // tournaments call this once per block of rounds.
    const warriors = this.warriors.map((w, i) => {
      x.m42_get_scores(this.ctx, i, counters, 2 * nw - 1);
      const { dv: v } = this.mem.views();
      const score = [];
      for (let k = 0; k < 2 * nw - 1; k++) score.push(v.getUint32(counters + 4 * k, true));
      const r = { name: w.name, wins: v.getUint32(scores + 12 * i, true), losses: v.getUint32(scores + 12 * i + 4, true), ties: v.getUint32(scores + 12 * i + 8, true), score };
      if (ps) r.pspace = new Int32Array(this.bytes().buffer, ps + 4 * cells * i, cells).slice();
      return r;
    });
    return { warriors, results, instructions };
  }

  // m42_state; before the first load: round 0, round over.
  state() {
    const at = this.structs + S_STATE;
    if (!this.ctx || this.x.m42_get_state(this.ctx, at, STATE_SIZE) !== M42_OK) {
      return { round: 0, roundOver: true, current: 0, warriorsLeft: 0, time: 0, cyclesLeft: 0 };
    }
    const { dv } = this.mem.views();
    return {
      round: dv.getUint32(at, true),
      roundOver: dv.getUint32(at + 4, true) !== 0,
      current: dv.getUint32(at + 8, true),
      warriorsLeft: dv.getUint32(at + 12, true),
      time: Number(dv.getBigUint64(at + 16, true)),
      cyclesLeft: Number(dv.getBigInt64(at + 24, true)),
    };
  }

  get round() { return this.state().round; }
  get roundOver() { return this.state().roundOver; }
  get time() { return this.state().time; }
  get cyclesLeft() { return this.state().cyclesLeft; }
  get warriorsLeft() { return this.state().warriorsLeft; }
  get current() { return this.state().current; }

  // Decodes the core into arrays per field; cached until the core can change.
  core() {
    if (this.snapshotVersion === this.version && this.snapshot) return this.snapshot;
    const n = this.coreSize;
    const s = this.snapshot ?? {
      op: new Uint8Array(n), am: new Uint8Array(n), bm: new Uint8Array(n),
      av: new Int32Array(n), bv: new Int32Array(n),
    };
    const base = this.ctx ? this.x.m42_core(this.ctx) : 0;
    if (base) {
      // m42_cell: uint16 a, b, word, pad
      const u16 = new Uint16Array(this.bytes().buffer, base, 4 * n);
      for (let a = 0, k = 0; a < n; a++, k += 4) {
        const ins = u16[k + 2];
        s.av[a] = u16[k];
        s.bv[a] = u16[k + 1];
        s.op[a] = ins & 0xff;
        s.am[a] = (ins >> 8) & 7;
        s.bm[a] = ins >> 11;
      }
    }
    this.snapshot = s;
    this.snapshotVersion = this.version;
    return s;
  }

  get op() { return this.core().op; }
  get am() { return this.core().am; }
  get bm() { return this.core().bm; }
  get av() { return this.core().av; }
  get bv() { return this.core().bv; }

  cell(addr) {
    const n = this.coreSize;
    const a = ((addr % n) + n) % n;
    const c = this.core();
    return { op: c.op[a] >> 3, mod: c.op[a] & 7, aMode: c.am[a], aVal: c.av[a], bMode: c.bm[a], bVal: c.bv[a] };
  }

  // With options.watch: typed array views of the watch (42mars.h,
  // m42_watch), live: run() changes them in place. New views after the
  // memory grew. Per cell owner, execBy, readBy (warrior + 1, 0 none), bump,
  // origin, tWrite, tRead, tExec (time in the round, 0 never); territory
  // per warrior; execCount[w * codeStride + i]; trace, 4 numbers per entry
  // (pc, A pointer, B pointer, meta), instruction t at entry t %
  // TRACE_SIZE; death, 4 numbers per entry (address, warrior, time, last),
  // the deaths-th death of the round at entry deaths % DEATH_SIZE (deaths is
  // read from the engine on each access).
  watch() {
    if (!this.watching) throw new Error('wasm engine: created without { watch: true }');
    if (!this.watchAt) throw new Error('wasm engine: the watch comes with the first load()');
    const { buffer, dv } = this.mem.views();
    let v = this.watchViews;
    if (!v || v.owner.buffer !== buffer) {
      // m42_watch in wasm32: uint32 core_size, warriors, code_stride, pad,
      // uint64 deaths at 16, then 12 pointers from 24 (api.c checks them)
      const h = this.watchAt;
      const n = dv.getUint32(h, true), nw = dv.getUint32(h + 4, true), stride = dv.getUint32(h + 8, true);
      const ptr = (k) => dv.getUint32(h + 24 + 4 * k, true);
      v = this.watchViews = {
        codeStride: stride,
        get deaths() { return Number(dv.getBigUint64(h + 16, true)); },
        owner: new Uint8Array(buffer, ptr(0), n),
        execBy: new Uint8Array(buffer, ptr(1), n),
        readBy: new Uint8Array(buffer, ptr(2), n),
        bump: new Int8Array(buffer, ptr(3), n),
        origin: new Int32Array(buffer, ptr(4), n),
        tWrite: new Uint32Array(buffer, ptr(5), n),
        tRead: new Uint32Array(buffer, ptr(6), n),
        tExec: new Uint32Array(buffer, ptr(7), n),
        territory: new Uint32Array(buffer, ptr(8), nw),
        execCount: new Uint32Array(buffer, ptr(9), nw * stride),
        trace: new Uint32Array(buffer, ptr(10), 4 * TRACE_SIZE),
        death: new Uint32Array(buffer, ptr(11), 4 * DEATH_SIZE),
      };
    }
    return v;
  }

  // The process deaths since the last call in this round, as events: { type: 'kill', addr, warrior, time } for each, and a 'death'
  // after the kill of a warrior's last process. At most the last
  // DEATH_SIZE: a warrior's end also shows in warriors[i].alive and .diedAt.
  events() {
    const { death, deaths } = this.watch();
    const out = [];
    for (let k = Math.max(this.deathsRead, deaths - DEATH_SIZE); k < deaths; k++) {
      const e = 4 * (k % DEATH_SIZE);
      const addr = death[e], warrior = death[e + 1], time = death[e + 2];
      out.push({ type: 'kill', addr, warrior, time });
      if (death[e + 3]) out.push({ type: 'death', addr, warrior, time });
    }
    this.deathsRead = deaths;
    return out;
  }
}

class WarriorView {
  constructor(mars, index, code) {
    this.mars = mars;
    this.x = mars.x;
    this.index = index;
    this.code = code;
    this.name = code.name;
    this.author = code.author;
  }

  // m42_warrior_state: alive, processes, position, last_result, int64
  // died_at at 16, wins, losses, ties at 24.
  state() {
    const m = this.mars;
    const at = m.structs + S_WARRIOR;
    check(this.x, m.mem, this.x.m42_get_warrior(m.ctx, this.index, at, WARRIOR_STATE_SIZE));
    const { dv } = m.mem.views();
    const died = Number(dv.getBigInt64(at + 16, true));
    return {
      alive: dv.getUint32(at, true) !== 0,
      tasks: dv.getUint32(at + 4, true),
      position: dv.getUint32(at + 8, true),
      lastResult: dv.getUint32(at + 12, true),
      diedAt: died < 0 ? null : died,
      wins: dv.getUint32(at + 24, true),
      losses: dv.getUint32(at + 28, true),
      ties: dv.getUint32(at + 32, true),
    };
  }

  get position() { return this.state().position; }
  get tasks() { return this.state().tasks; }
  get alive() { return this.state().alive; }
  get diedAt() { return this.state().diedAt; }
  get wins() { return this.state().wins; }
  get losses() { return this.state().losses; }
  get ties() { return this.state().ties; }
  get lastResult() { return this.state().lastResult; }
  // With the watch: the cells it owns, and executions of copies of each of
  // its instructions (a view, live).
  get territory() { return this.mars.watch().territory[this.index]; }
  get execCount() {
    const v = this.mars.watch();
    if (this.execCountOf !== v) {
      this.execCountOf = v;
      this.execCountView = v.execCount.subarray(this.index * v.codeStride, this.index * v.codeStride + lengthOf(this.code));
    }
    return this.execCountView;
  }

  get score() {
    const m = this.mars;
    const count = this.x.m42_get_scores(m.ctx, this.index, 0, 0);
    m.mem.reset(); // scratch memory for this call only
    const at = m.mem.scratch(4 * count);
    this.x.m42_get_scores(m.ctx, this.index, at, count);
    return Array.from(new Uint32Array(m.bytes().buffer, at, count));
  }

  // Cells 0 .. pSpaceSize-1; cell 0 is unused (index 0 is the last result).
  get pspace() {
    const m = this.mars;
    const out = new Int32Array(m.opt.pSpaceSize);
    const at = m.structs + S_VALUE;
    for (let i = 1; i < out.length; i++) {
      check(this.x, m.mem, this.x.m42_pspace_get(m.ctx, this.index, i, at));
      out[i] = m.mem.views().dv.getInt32(at, true);
    }
    return out;
  }

  // The queued addresses, the next one first, as a view of engine memory:
  // no copy, valid until the next call into the engine (for a visualizer
  // that reads the queues every frame).
  queue() {
    const m = this.mars;
    const count = this.x.m42_queue(m.ctx, this.index, 0, 0);
    m.mem.reset(); // scratch memory for this call only
    const at = m.mem.scratch(4 * count);
    this.x.m42_queue(m.ctx, this.index, at, count);
    return new Uint32Array(m.bytes().buffer, at, count);
  }

  // The queued addresses as an array, the next one first.
  processes() {
    return Array.from(this.queue());
  }
}

// ---------------------------------------------------------------- assembler

// The C assembler and evaluator (lib/src/asm.c):
//   assembleWasm(source, options)  the warrior object (Warrior in 42mars.d.ts)
//   evaluateWasm(text)             { status, value } of one expression
// Both use one module instance per module, created on first use. In a
// browser, call compileWasmMars() first or pass the module.
//
// Text goes in as Latin-1 bytes when every character is below 256 (warrior
// files are read as latin1), else as UTF-8; the result strings are decoded
// the same way.

const asmInstances = new WeakMap();

// Calls fn with the exports of the module's assembler instance. An exception
// inside wasm (V8 out of stack, a trap) leaves the C stack pointer where it
// was, so that instance is thrown away and the next call gets a new one.
function withAsm(module, fn) {
  const mod = module ?? compileSync();
  let x = asmInstances.get(mod);
  if (!x) {
    x = new WebAssembly.Instance(mod).exports;
    asmInstances.set(mod, x);
  }
  try {
    return fn(x, memoryOf(x));
  } catch (e) {
    asmInstances.delete(mod);
    throw e;
  }
}

function encodeText(text) {
  let latin1 = true;
  for (let i = 0; i < text.length && latin1; i++) latin1 = text.charCodeAt(i) < 256;
  if (!latin1) return { bytes: new TextEncoder().encode(text), utf8: true };
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return { bytes, utf8: false };
}

const latin1Decoder = new TextDecoder('latin1');
const utf8Decoder = new TextDecoder('utf-8');

export function assembleWasm(source, options = {}, module = undefined) {
  return withAsm(module, (x, mem) => assembleWith(x, mem, source, options));
}

function assembleWith(x, mem, source, options) {
  const o = effectiveOptions(options);
  if (!(o.coreSize >= 1)) throw new RangeError('assembleWasm: coreSize must be at least 1');
  const { bytes, utf8 } = encodeText(source);
  mem.reset();
  const rules = mem.scratch(48);
  writeRules(mem, rules, o, o.warriors);
  const src = mem.scratch(bytes.length);
  mem.views().u8.set(bytes, src);
  // Registers to start with, e.g. { s: 2, w: 2 }; the others start at 0.
  let regs = 0;
  if (o.registers) {
    regs = mem.scratch(8 * 26);
    const { dv } = mem.views();
    for (let i = 0; i < 26; i++) dv.setBigInt64(regs + 8 * i, 0n, true);
    for (const [name, v] of Object.entries(o.registers)) {
      const i = name.toLowerCase().charCodeAt(0) - 97;
      if (name.length !== 1 || i < 0 || i > 25) throw new RangeError(`registers: not a register name: ${name}`);
      dv.setBigInt64(regs + 8 * i, BigInt.asIntN(64, BigInt(v)), true);
    }
  }
  const out = mem.scratch(8);
  const start = mem.mark;
  // The working memory grows by 4 until the assembler fits, up to 128 MB
  // plus 64 bytes per source byte, as m42_assemble_new() (42mars.h).
  const most = 2 ** 27 + 64 * bytes.length;
  for (let size = Math.min(Math.max(1 << 20, 16 * bytes.length), most); ; size = Math.min(size * 4, most)) {
    if (size > 2 ** 31) throw new Error('assembleWasm: out of memory');
    mem.mark = start;
    const work = mem.scratch(size);
    // flags: M42_UTF8 1, M42_ICWS88 2
    const status = x.m42_assemble(src, bytes.length, rules, (utf8 ? 1 : 0) | (o.icws88 ? 2 : 0), regs, work, size, out);
    if (status === M42_ERR_MEMORY) {
      if (size === most) throw new Error('assembleWasm: out of memory');
      continue;
    }
    check(x, mem, status);
    return readWarrior(x, mem, mem.views().dv.getUint32(out, true), utf8 ? utf8Decoder : latin1Decoder, o);
  }
}

// The assemble() object of an m42_warrior, through the functions of 42mars.h.
function readWarrior(x, mem, w, decoder, options) {
  const value = mem.scratch(8);
  // A text by a function that copies it like snprintf: size first, then the text.
  const text = (copy) => {
    const n = copy(0, 0);
    const buf = mem.scratch(n + 1);
    copy(buf, n + 1);
    return decoder.decode(mem.views().u8.subarray(buf, buf + n));
  };
  const instructions = [];
  const code = x.m42_warrior_code(w);
  for (let k = 0; k < x.m42_warrior_length(w); k++) {
    const { u8, dv } = mem.views();
    const p = code + 16 * k;
    instructions.push({ op: u8[p], mod: u8[p + 1], aMode: u8[p + 2], aVal: dv.getUint32(p + 4, true), bMode: u8[p + 3], bVal: dv.getUint32(p + 8, true), line: dv.getInt32(p + 12, true) });
  }
  const errors = [];
  const warnings = [];
  const nErrors = x.m42_warrior_errors(w);
  for (let i = 0; i < nErrors + x.m42_warrior_warnings(w); i++) {
    const t = text((buf, n) => x.m42_warrior_message(w, i, value, 0, buf, n));
    const line = mem.views().dv.getInt32(value, true);
    (i < nErrors ? errors : warnings).push({ severity: i < nErrors ? 'error' : 'warning', line: line === 0 ? null : line, text: t });
  }
  const expanded = [];
  for (let i = 0; i < x.m42_warrior_statements(w); i++) expanded.push(text((buf, n) => x.m42_warrior_statement(w, i, buf, n)));
  const field = (which) => text((buf, n) => x.m42_warrior_text(w, which, buf, n));
  return {
    ok: x.m42_warrior_ok(w) !== 0,
    name: field(0),
    author: field(1),
    date: field(2),
    version: field(3),
    strategy: field(4),
    instructions,
    start: x.m42_warrior_start(w),
    pin: x.m42_warrior_pin(w, value) ? Number(mem.views().dv.getBigInt64(value, true)) : null,
    errors,
    warnings,
    expanded,
    options,
  };
}

export function evaluateWasm(text, module = undefined) {
  return withAsm(module, (x, mem) => {
    const { bytes } = encodeText(text);
    mem.reset();
    const at = mem.scratch(bytes.length);
    mem.views().u8.set(bytes, at);
    const value = mem.scratch(8);
    const status = x.m42_evaluate(at, bytes.length, value);
    return { status, value: mem.views().dv.getBigInt64(value, true) };
  });
}
