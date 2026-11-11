// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The watch of the library (42mars.h, m42_watch; wasm/42mars.js with
// { watch: true }) against the visualizer bookkeeping of mars.js: owner,
// execBy, readBy, bump, origin, the times, territory, execHeat, the trace
// and the process deaths, compared after every chunk of random length, for
// random warriors with 2 to 4 warriors and with read and write limits.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mars } from '../js/mars.js';
import { compileWasmMars, createWasmMarsSync, assembleWasm as assemble } from '../wasm/42mars.js';

const module = await compileWasmMars();

let state = 0x2545f491;
const rand = (k) => {
  state ^= state << 13; state >>>= 0;
  state ^= state >>> 17;
  state ^= state << 5; state >>>= 0;
  return state % k;
};
const pick = (a) => a[rand(a.length)];

const OPS = ['mov', 'add', 'sub', 'mul', 'div', 'mod', 'jmz', 'jmn', 'djn', 'cmp', 'slt', 'spl', 'dat', 'jmp', 'seq', 'sne', 'nop', 'ldp', 'stp'];
const MODS = ['', '.a', '.b', '.ab', '.ba', '.f', '.x', '.i'];
const MODES = ['#', '$', '@', '<', '>', '*', '{', '}'];

// A random warrior; loop: no DAT, DIV or MOD, and a jump back at the end.
function randomWarrior(len, coreSize, loop) {
  const operand = () => `${pick(MODES)}${rand(3) ? rand(9) - 4 : rand(coreSize) - (coreSize >> 1)}`;
  const lines = [`;name r${rand(1e6)}`];
  for (let i = 0; i < len; i++) {
    let op = rand(8) === 0 ? pick(['spl', 'mov', 'djn', 'jmp']) : pick(OPS);
    if (loop && (op === 'dat' || op === 'div' || op === 'mod')) op = 'mov';
    lines.push(`${op}${pick(MODS)} ${operand()}, ${operand()}`);
  }
  if (loop) lines.push(`jmp ${-len}`);
  lines.push(`org ${loop ? 0 : rand(len)}`);
  return lines.join('\n') + '\n';
}

const RULES = [
  { coreSize: 80, maxCycles: 800, maxProcesses: 80, maxLength: 5, minDistance: 5 },
  { coreSize: 800, maxCycles: 8000, maxProcesses: 800, maxLength: 20, minDistance: 20 },
  { coreSize: 200, maxCycles: 2000, maxProcesses: 3, maxLength: 10, minDistance: 10 },
  { coreSize: 8000, maxCycles: 80000, maxProcesses: 8000, maxLength: 100, minDistance: 100 },
  { coreSize: 11, maxCycles: 300, maxProcesses: 4, maxLength: 2, minDistance: 2 }, // pSpaceSize 0
  { coreSize: 1, maxCycles: 50, maxProcesses: 4, maxLength: 1, minDistance: 0 },
  { coreSize: 800, maxCycles: 8000, maxProcesses: 64, maxLength: 20, minDistance: 20, readLimit: 400, writeLimit: 100 },
  { coreSize: 120, maxCycles: 1000, maxProcesses: 16, maxLength: 8, minDistance: 8, readLimit: 30, writeLimit: 60 },
];

const NEVER = -0x40000000; // mars.js's time of a cell not touched yet

function compareWatch(m, w, where) {
  const v = w.watch();
  const n = m.coreSize;
  for (let i = 0; i < n; i++) {
    const at = `${where}, cell ${i}`;
    if (v.owner[i] !== m.owner[i] + 1) assert.fail(`${at}: owner ${v.owner[i] - 1}, mars.js ${m.owner[i]}`);
    if (v.execBy[i] !== m.execBy[i] + 1) assert.fail(`${at}: execBy ${v.execBy[i] - 1}, mars.js ${m.execBy[i]}`);
    if (v.readBy[i] !== m.readBy[i] + 1) assert.fail(`${at}: readBy ${v.readBy[i] - 1}, mars.js ${m.readBy[i]}`);
    if (v.bump[i] !== m.bump[i]) assert.fail(`${at}: bump ${v.bump[i]}, mars.js ${m.bump[i]}`);
    if (v.origin[i] !== m.origin[i]) assert.fail(`${at}: origin ${v.origin[i]}, mars.js ${m.origin[i]}`);
    for (const k of ['tWrite', 'tRead', 'tExec']) {
      const want = m[k][i] === NEVER ? 0 : m[k][i];
      if (v[k][i] !== want) assert.fail(`${at}: ${k} ${v[k][i]}, mars.js ${m[k][i]}`);
    }
  }
  m.warriors.forEach((M, i) => {
    const W = w.warriors[i];
    assert.equal(W.territory, M.territory, `${where}, warrior ${i}: territory`);
    assert.deepEqual(Array.from(W.execCount), Array.from(M.execHeat), `${where}, warrior ${i}: execCount`);
  });
  // The trace of the instructions of this round that it still holds.
  for (let t = Math.max(1, m.time - 4095); t <= m.time; t++) {
    const k = t & 4095;
    const got = Array.from(v.trace.subarray(4 * k, 4 * k + 4));
    const want = [m.tracePc[k], m.traceA[k], m.traceB[k], m.traceMeta[k]];
    if (got.join() !== want.join()) assert.fail(`${where}: trace at time ${t}: ${got}, mars.js ${want}`);
  }
}

// Plays a match on both engines in random chunks and compares the watch
// after each chunk.
function compareMatch(o, codes, seed, rounds) {
  const m = new Mars(o);
  const w = createWasmMarsSync({ ...o, watch: true }, module);
  m.load(codes, { seed });
  w.load(codes, { seed });
  const where = `${JSON.stringify(o)} seed ${seed}`;
  for (let r = 0; r < rounds; r++) {
    m.startRound();
    w.startRound();
    compareWatch(m, w, `${where} round ${r + 1} start`);
    while (!m.roundOver) {
      // at most 1000 instructions: the watch keeps the last 1024 deaths
      const n = 1 + rand(rand(2) ? 5 : 1000);
      assert.equal(w.run(n), m.run(n), `${where} round ${r + 1}: executed count`);
      const at = `${where} round ${r + 1} time ${m.time}`;
      assert.equal(w.time, m.time, `${at}: time`);
      assert.deepEqual(w.events(), m.events, `${at}: events`);
      m.events = [];
      compareWatch(m, w, at);
    }
  }
  assert.deepEqual(w.results, m.results, `${where}: results`);
}

test('the watch agrees with the bookkeeping of mars.js on random battles', () => {
  let battles = 0;
  for (let i = 0; i < 150; i++) {
    const o = RULES[i % RULES.length];
    const most = Math.max(1, Math.min(4, o.minDistance ? Math.floor(o.coreSize / o.minDistance) : 4));
    const nw = most === 1 ? 1 : 2 + rand(most - 1);
    const codes = Array.from({ length: nw }, () => assemble(randomWarrior(1 + rand(o.maxLength), o.coreSize, rand(2) === 0), { ...o, warriors: nw }));
    if (!codes.every((c) => c.ok && c.instructions.length <= o.maxLength)) continue;
    compareMatch(o, codes, rand(2147483646) + 1, 1 + rand(3));
    battles++;
  }
  assert.ok(battles > 100, `only ${battles} battles assembled`);
});

test('the watch agrees with mars.js on the sample warriors', () => {
  const read = (f) => assemble(readFileSync(new URL(`../warriors/${f}.red`, import.meta.url), 'latin1'));
  const all = ['dwarf', 'imp', 'lantern', 'origami', 'seeker'].map(read);
  for (let i = 0; i < all.length; i++) {
    compareMatch({}, [all[i], all[(i + 1) % all.length]], 1000 + i, 2);
  }
  compareMatch({ warriors: 3 }, all.slice(0, 3), 77, 1);
});

test('runMatch with a watch attached gives the same match and leaves the watch alone', () => {
  const codes = ['dwarf', 'imp'].map((f) => assemble(readFileSync(new URL(`../warriors/${f}.red`, import.meta.url), 'latin1')));
  const plain = createWasmMarsSync({}, module).runMatch(codes, { rounds: 20, seed: 5 });
  const w = createWasmMarsSync({ watch: true }, module);
  w.load(codes, { seed: 5 });
  w.startRound();
  w.run(100);
  const before = w.watch().tExec.slice();
  const watched = w.runMatch(codes, { rounds: 20, seed: 5 });
  assert.deepEqual(watched.warriors, plain.warriors);
  assert.deepEqual(w.watch().tExec, before);
});

test('watch() needs { watch: true }', () => {
  const w = createWasmMarsSync({}, module);
  assert.throws(() => w.watch(), /watch: true/);
});
