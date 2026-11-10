// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Headless simulator in WebAssembly (lib/src/mars.c), with a subset
// of the Mars API of mars.js. Same results as `new Mars({ headless: true })`:
// core, process queues, scores and round results. No visualizer
// bookkeeping, no events, no trace.
//
//   const m = await createWasmMars({ coreSize: 8000 });
//   m.load(codes, { seed });            // codes: assemble() results
//   m.startRound(); while (!m.roundOver) m.run(1e6);
//   m.runMatch(codes, { rounds: 200, seed })   // whole match inside wasm
//   m.runMatch(codes, { rounds: 50, seed, firstRound: 150 }) // its last 50 rounds
//   m.runMatch(codes.map((c) => packWarrior(c)), ...)        // prepared warriors
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

import { DEFAULT_OPTIONS } from '../js/assembler.js';
import { rng } from '../js/mars.js';

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
      if (lengthOf(c) > o.maxLength) throw new Error(`warrior '${c.name}' is longer than ${o.maxLength}`);
    }
    if (codes.length * o.minDistance > o.coreSize) throw new Error('too many warriors for the core size and minimum distance');
    if (codes.length < 1 || codes.length > 255) throw new RangeError('the wasm engine supports 1 to 255 warriors');
    if (seed !== undefined && !isCount(seed)) throw new RangeError(`seed must be a non-negative safe integer: ${seed}`);
    if (positions && (positions.length < codes.length || !positions.every((p) => isCount(p) && p < 2 ** 31))) {
      throw new RangeError('positions must be non-negative integers, one per warrior');
    }

    const nw = codes.length;
    const total = codes.reduce((s, c) => s + lengthOf(c), 0);
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
      i32[k++] = lengthOf(code);
      i32[k++] = code.start;
      i32[k++] = group;
      i32[k++] = positions ? positions[i] : 0;
    });
    for (const code of codes) {
      if (code.packed) {
        i32.set(code.packed, k);
        k += code.packed.length;
        continue;
      }
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
  runMatch(codes, { rounds = this.opt.rounds, seed, positions, earlyTie = true, firstRound = 0 } = {}) {
    if (!isCount(rounds) || !isCount(firstRound) || rounds + firstRound > 0xffffffff) {
      throw new RangeError(`bad rounds or firstRound: ${rounds}, ${firstRound}`);
    }
    this.load(codes, { seed, positions });
    const log = this.x.mars_reserve_log(rounds);
    if (!log && rounds > 0) throw new Error('wasm engine: out of memory');
    const instructions = this.x.mars_run_match(rounds, earlyTie ? 1 : 0, firstRound);
    this.version++;
    const u8 = this.bytes();
    const stride = this.x.mars_log_stride();
    const nw = codes.length;
    const results = [];
    for (let r = 0; r < rounds; r++) {
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

// ---------------------------------------------------------------- assembler

// The C assembler and evaluator (lib/src/asm.c) with the interface of
// js/assembler.js and js/expr.js:
//   assembleWasm(source, options)  same object as assemble()
//   evaluateWasm(text)             same { status, value } as Evaluator.evaluate()
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
    return fn(x);
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
  return withAsm(module, (x) => assembleWith(x, source, options));
}

function assembleWith(x, source, options) {
  const o = effectiveOptions(options);
  const { bytes, utf8 } = encodeText(source);
  for (let size = Math.max(1 << 20, 16 * bytes.length); ; size *= 4) {
    if (size > 2 ** 31) throw new Error('assembleWasm: out of memory');
    const base = x.mars_scratch(bytes.length + 8 + size);
    if (!base) throw new Error('assembleWasm: out of memory');
    new Uint8Array(x.memory.buffer, base, bytes.length).set(bytes);
    const mem = (base + bytes.length + 7) & ~7;
    const r = x.m42_assemble(base, bytes.length, mem, size, o.coreSize, o.maxProcesses, o.maxCycles, o.maxLength,
      o.minDistance, o.warriors, o.rounds, o.pSpaceSize, o.readLimit, o.writeLimit, utf8 ? 1 : 0);
    if (!r) {
      if (!(o.coreSize >= 1)) throw new RangeError('assembleWasm: coreSize must be at least 1');
      continue; // the working memory was too small
    }
    return readAsmResult(x, r, utf8, o);
  }
}

function readAsmResult(x, r, utf8, options) {
  const dv = new DataView(x.memory.buffer);
  const u8 = new Uint8Array(x.memory.buffer);
  const decoder = utf8 ? utf8Decoder : latin1Decoder;
  const u32 = (at) => dv.getUint32(at, true);
  const text = (at) => decoder.decode(u8.subarray(u32(at), u32(at) + u32(at + 4)));
  const messages = (count, at, severity) => {
    const out = [];
    for (let k = 0, p = u32(at); k < u32(count); k++, p += 12) {
      const line = dv.getInt32(p, true);
      out.push({ severity, line: line === 0 ? null : line, text: text(p + 4) });
    }
    return out;
  };
  const instructions = [];
  for (let k = 0, p = u32(r + 40); k < u32(r + 24); k++, p += 16) {
    instructions.push({ op: u8[p], mod: u8[p + 1], aMode: u8[p + 2], aVal: u32(p + 4), bMode: u8[p + 3], bVal: u32(p + 8), line: dv.getInt32(p + 12, true) });
  }
  const expanded = [];
  for (let k = 0, p = u32(r + 52); k < u32(r + 36); k++, p += 8) expanded.push(text(p));
  return {
    ok: dv.getInt32(r, true) !== 0,
    name: text(r + 56),
    author: text(r + 64),
    date: text(r + 72),
    version: text(r + 80),
    strategy: text(r + 88),
    instructions,
    start: u32(r + 4),
    pin: dv.getInt32(r + 8, true) ? Number(dv.getBigInt64(r + 16, true)) : null,
    errors: messages(r + 28, r + 44, 'error'),
    warnings: messages(r + 32, r + 48, 'warning'),
    expanded,
    options,
  };
}

export function evaluateWasm(text, module = undefined) {
  return withAsm(module, (x) => evaluateWith(x, text));
}

function evaluateWith(x, text) {
  const { bytes } = encodeText(text);
  const base = x.mars_scratch(bytes.length + 16);
  if (!base) throw new Error('evaluateWasm: out of memory');
  new Uint8Array(x.memory.buffer, base, bytes.length).set(bytes);
  const at = (base + bytes.length + 7) & ~7;
  const status = x.m42_evaluate(base, bytes.length, at);
  return { status, value: new DataView(x.memory.buffer).getBigInt64(at, true) };
}
