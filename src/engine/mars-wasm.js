// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Headless simulator in WebAssembly (src/engine/wasm/mars.c), with a subset
// of the Mars API of mars.js. Same results as `new Mars({ headless: true })`:
// core, process queues, scores and round results. No visualizer
// bookkeeping, no events, no trace.
//
//   const m = await createWasmMars({ coreSize: 8000 });
//   m.load(codes, { seed });            // codes: assemble() results
//   m.startRound(); while (!m.roundOver) m.run(1e6);
//   m.runMatch(codes, { rounds: 200, seed })   // whole match inside wasm
//   m.runMatch(codes, { rounds: 50, seed, firstRound: 150 }) // its last 50 rounds
//
// Differences from Mars:
// - The core size is at most 65536 (cells hold 16-bit values), maxProcesses
//   and pSpaceSize at most 2^24, and there are 1 to 255 warriors.
// - `seed` must be a non-negative safe integer and fixed positions
//   non-negative integers; anything else throws a RangeError.
// - op, am, bm, av, bv are snapshots: each read returns typed arrays decoded
//   from the wasm core (same encoding as mars.js), reused until the next
//   load(), startRound(), run(), step(), endRound() or runMatch(). Do not
//   write into them, and read them again after running.
// - Warrior objects have getters instead of fields; `score` and `pspace`
//   return copies. `processes()` returns the queued addresses, the next one
//   to run first.
// - runMatch() stops tie rounds early by default, see there.

import { DEFAULT_OPTIONS } from './assembler.js';
import { rng } from './mars.js';

const WASM_URL = new URL('./wasm/mars.wasm', import.meta.url);
const MAX_CORE = 65536;
const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

let compiled = null; // WebAssembly.Module once compiled

// Compiles mars.wasm once (fetch in browsers, the file system in Node) and
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

function effectiveOptions(options) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  if (!o.pSpaceSize) o.pSpaceSize = Math.floor(o.coreSize / 16);
  if (!o.readLimit) o.readLimit = o.coreSize;
  if (!o.writeLimit) o.writeLimit = o.coreSize;
  return o;
}

const isCount = (v) => Number.isSafeInteger(v) && v >= 0;

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
    this.memory = this.x.memory;
    this.buffer = null;
    this.warriors = [];
    this.results = [];
    this.roundResult = null;
    this.version = 0; // bumped by everything that can change the core
    this.snapshot = null;
    this.snapshotVersion = -1;
  }

  // Byte view of the linear memory, renewed after it grew.
  bytes() {
    if (this.buffer !== this.memory.buffer) {
      this.buffer = this.memory.buffer;
      this.u8 = new Uint8Array(this.buffer);
      this.u32 = new Uint32Array(this.buffer);
      this.i32 = new Int32Array(this.buffer);
      this.f64 = new Float64Array(this.buffer);
    }
    return this.u8;
  }

  load(codes, { seed, positions } = {}) {
    const o = this.opt;
    for (const c of codes) {
      if (!c.ok) throw new Error(`warrior '${c.name}' did not assemble`);
      if (c.instructions.length > o.maxLength) throw new Error(`warrior '${c.name}' is longer than ${o.maxLength}`);
    }
    if (codes.length * o.minDistance > o.coreSize) throw new Error('too many warriors for the core size and minimum distance');
    if (codes.length < 1 || codes.length > 255) throw new RangeError('the wasm engine supports 1 to 255 warriors');
    if (seed !== undefined && !isCount(seed)) throw new RangeError(`seed must be a non-negative safe integer: ${seed}`);
    if (positions && (positions.length < codes.length || !positions.every((p) => isCount(p) && p < 2 ** 31))) {
      throw new RangeError('positions must be non-negative integers, one per warrior');
    }

    const nw = codes.length;
    const total = codes.reduce((s, c) => s + c.instructions.length, 0);
    const input = this.x.mars_config(o.coreSize, o.maxProcesses, o.maxCycles, o.minDistance, o.pSpaceSize, nw, total);
    if (!input) throw new Error('wasm engine: out of memory');
    this.bytes();
    // Warriors with the same PIN share their p-space cells (not the last result).
    const groups = new Map();
    const i32 = this.i32;
    let k = input >> 2;
    codes.forEach((code, i) => {
      let group = i;
      if (code.pin !== null && code.pin !== undefined) {
        if (groups.has(code.pin)) group = groups.get(code.pin);
        else groups.set(code.pin, i);
      }
      i32[k++] = code.instructions.length;
      i32[k++] = code.start;
      i32[k++] = group;
      i32[k++] = positions ? positions[i] : 0;
    });
    for (const code of codes) {
      for (const ins of code.instructions) {
        i32[k++] = (ins.op << 3) | ins.mod;
        i32[k++] = ins.aMode;
        i32[k++] = ins.aVal;
        i32[k++] = ins.bMode;
        i32[k++] = ins.bVal;
      }
    }
    const s = seed === undefined ? rng(1 + Math.floor(Math.random() * 2147483646)) : seed;
    this.x.mars_load(s, positions ? 1 : 0);
    this.warriors = codes.map((code, index) => new WarriorView(this, index, code));
    this.results = [];
    this.roundResult = null;
    this.version++;
  }

  startRound() {
    this.x.mars_start_round();
    this.roundResult = null;
    this.version++;
  }

  // Executes up to n instructions; returns how many. Stops early when the
  // round ends.
  run(n) {
    if (this.roundResult !== null || this.x.mars_round_over()) return 0;
    const done = this.x.mars_run(n);
    this.version++;
    if (this.x.mars_round_over()) this.recordResult();
    return done;
  }

  step() {
    this.run(1);
  }

  endRound() {
    if (this.x.mars_round_over()) return;
    this.x.mars_end_round();
    this.version++;
    this.recordResult();
  }

  recordResult() {
    const survivors = [];
    for (let i = 0; i < this.warriors.length; i++) if (this.x.mars_w_alive(i)) survivors.push(i);
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
  // stop: { width, minRounds = 20 } (default off, two warriors only) stops
  // the match early, which changes results against pMARS: warrior 0 gets 3,
  // 1 or 0 points per round, and from round max(minRounds, 2) on, after
  // every round, the match stops when the 95% interval of its points per
  // 100 rounds, 2 * 1.96 * sqrt(variance / n) * 100 (sample variance), is at
  // most `width` wide. `rounds` in the result is the number of rounds
  // played; their results are exact. Width 0 stops exactly when the first
  // minRounds rounds all ended the same way.
  runMatch(codes, { rounds = this.opt.rounds, seed, positions, earlyTie = true, firstRound = 0, stop } = {}) {
    if (!isCount(rounds) || !isCount(firstRound) || rounds + firstRound > 0xffffffff) {
      throw new RangeError(`bad rounds or firstRound: ${rounds}, ${firstRound}`);
    }
    let width = -1;
    let minRounds = 0;
    if (stop != null) {
      ({ width, minRounds = 20 } = stop);
      if (codes.length !== 2 || typeof width !== 'number' || !(width >= 0) || !Number.isFinite(width) || !isCount(minRounds)) {
        throw new RangeError(`bad stop for ${codes.length} warriors: ${JSON.stringify(stop)}`);
      }
    }
    this.load(codes, { seed, positions });
    const log = this.x.mars_reserve_log(rounds);
    if (!log && rounds > 0) throw new Error('wasm engine: out of memory');
    const instructions = this.x.mars_run_match(rounds, earlyTie ? 1 : 0, firstRound, width, Math.min(minRounds, 0xffffffff));
    this.version++;
    const u8 = this.bytes();
    const stride = this.x.mars_log_stride();
    const nw = codes.length;
    const played = this.x.mars_round() - firstRound;
    const results = [];
    for (let r = 0; r < played; r++) {
      const at = log + r * stride;
      const survivors = [];
      for (let i = 0; i < nw; i++) if (u8[at + 8 + i]) survivors.push(i);
      results.push({ round: firstRound + r + 1, cycles: this.f64[at >> 3], survivors });
    }
    this.results = results;
    this.roundResult = results.length ? results[results.length - 1] : null;
    return {
      warriors: this.warriors.map((w) => ({ name: w.name, wins: w.wins, losses: w.losses, ties: w.ties, score: w.score })),
      results,
      instructions,
      rounds: played,
    };
  }

  get round() { return this.x.mars_round(); }
  get roundOver() { return this.x.mars_round_over() !== 0; }
  get time() { return this.x.mars_time(); }
  get cyclesLeft() { return this.x.mars_cycles_left(); }
  get warriorsLeft() { return this.x.mars_warriors_left(); }
  get current() { return this.x.mars_current(); }

  // Decodes the core into mars.js arrays; cached until the core can change.
  core() {
    if (this.snapshotVersion === this.version && this.snapshot) return this.snapshot;
    const n = this.coreSize;
    const s = this.snapshot ?? {
      op: new Uint8Array(n), am: new Uint8Array(n), bm: new Uint8Array(n),
      av: new Int32Array(n), bv: new Int32Array(n),
    };
    const u8 = this.bytes();
    const base = this.x.mars_core();
    const u16 = new Uint16Array(u8.buffer, base, 4 * n);
    for (let a = 0, k = 0; a < n; a++, k += 4) {
      const ins = u16[k + 2];
      s.av[a] = u16[k];
      s.bv[a] = u16[k + 1];
      s.op[a] = ins & 0xff;
      s.am[a] = (ins >> 8) & 7;
      s.bm[a] = ins >> 11;
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

  get position() { return this.x.mars_w_position(this.index); }
  get tasks() { return this.x.mars_w_tasks(this.index); }
  get alive() { return this.x.mars_w_alive(this.index) !== 0; }
  get diedAt() { const t = this.x.mars_w_died_at(this.index); return t < 0 ? null : t; }
  get wins() { return this.x.mars_w_wins(this.index); }
  get losses() { return this.x.mars_w_losses(this.index); }
  get ties() { return this.x.mars_w_ties(this.index); }
  get lastResult() { return this.x.mars_w_last_result(this.index); }

  get score() {
    this.mars.bytes();
    const at = this.x.mars_w_score(this.index) >> 2;
    return Array.from(this.mars.u32.subarray(at, at + 2 * this.mars.warriors.length - 1));
  }

  get pspace() {
    this.mars.bytes();
    const at = this.x.mars_w_pspace(this.index) >> 2;
    return Int32Array.from(this.mars.u32.subarray(at, at + this.mars.opt.pSpaceSize));
  }

  processes() {
    const out = [];
    for (let k = 0; k < this.tasks; k++) out.push(this.x.mars_w_process(this.index, k));
    return out;
  }
}
