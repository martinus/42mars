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

// nw random warriors that assemble for rules o, or null.
function randomCodes(o, nw) {
  const codes = Array.from({ length: nw }, () => assemble(randomWarrior(1 + rand(o.maxLength), o.coreSize, rand(2) === 0), { ...o, warriors: nw }));
  return codes.every((c) => c.ok && c.instructions.length <= o.maxLength) ? codes : null;
}

const sample = (name) => assemble(readFileSync(new URL(`../warriors/${name}.red`, import.meta.url), 'latin1'));

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
const queue = (W) => Array.from({ length: W.tasks }, (_, k) => W.queue[(W.head + k) % W.queue.length]);

// The watch, the core and the queues against mars.js. The messages are
// made only for a difference: this runs after every chunk.
function compareWatch(m, w, where) {
  const v = w.watch();
  const c = w.core();
  const n = m.coreSize;
  const fail = (what, got, want) => assert.fail(`${where}, ${what}: ${got}, mars.js ${want}`);
  for (let i = 0; i < n; i++) {
    if (v.owner[i] !== m.owner[i] + 1) fail(`cell ${i} owner`, v.owner[i] - 1, m.owner[i]);
    if (v.execBy[i] !== m.execBy[i] + 1) fail(`cell ${i} execBy`, v.execBy[i] - 1, m.execBy[i]);
    if (v.readBy[i] !== m.readBy[i] + 1) fail(`cell ${i} readBy`, v.readBy[i] - 1, m.readBy[i]);
    if (v.bump[i] !== m.bump[i]) fail(`cell ${i} bump`, v.bump[i], m.bump[i]);
    if (v.origin[i] !== m.origin[i]) fail(`cell ${i} origin`, v.origin[i], m.origin[i]);
    if (v.tWrite[i] !== (m.tWrite[i] === NEVER ? 0 : m.tWrite[i])) fail(`cell ${i} tWrite`, v.tWrite[i], m.tWrite[i]);
    if (v.tRead[i] !== (m.tRead[i] === NEVER ? 0 : m.tRead[i])) fail(`cell ${i} tRead`, v.tRead[i], m.tRead[i]);
    if (v.tExec[i] !== (m.tExec[i] === NEVER ? 0 : m.tExec[i])) fail(`cell ${i} tExec`, v.tExec[i], m.tExec[i]);
    if (c.op[i] !== m.op[i] || c.am[i] !== m.am[i] || c.bm[i] !== m.bm[i] || c.av[i] !== m.av[i] || c.bv[i] !== m.bv[i]) {
      fail(`cell ${i}`, JSON.stringify(w.cell(i)), JSON.stringify(m.cell(i)));
    }
  }
  m.warriors.forEach((M, i) => {
    const W = w.warriors[i];
    assert.equal(W.territory, M.territory, `${where}, warrior ${i}: territory`);
    assert.deepEqual(Array.from(W.execCount), Array.from(M.execHeat), `${where}, warrior ${i}: execCount`);
    assert.deepEqual(W.processes(), queue(M), `${where}, warrior ${i}: queue`);
  });
  // The trace of the instructions of this round that it still holds.
  const T = v.trace.length / 4;
  for (let t = Math.max(1, m.time - T + 1); t <= m.time; t++) {
    const k = t % T;
    if (v.trace[4 * k] !== m.tracePc[k] || v.trace[4 * k + 1] !== m.traceA[k] || v.trace[4 * k + 2] !== m.traceB[k] || v.trace[4 * k + 3] !== m.traceMeta[k]) {
      fail(`trace at time ${t}`, v.trace.subarray(4 * k, 4 * k + 4).join(), [m.tracePc[k], m.traceA[k], m.traceB[k], m.traceMeta[k]].join());
    }
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
    const codes = randomCodes(o, nw);
    if (!codes) continue;
    compareMatch(o, codes, rand(2147483646) + 1, 1 + rand(3));
    battles++;
  }
  assert.ok(battles > 100, `only ${battles} battles assembled`);
});

test('the watch agrees with mars.js on the sample warriors', () => {
  const all = ['dwarf', 'imp', 'lantern', 'origami', 'seeker'].map(sample);
  for (let i = 0; i < all.length; i++) {
    compareMatch({}, [all[i], all[(i + 1) % all.length]], 1000 + i, 2);
  }
  compareMatch({ warriors: 3 }, all.slice(0, 3), 77, 1);
});

// Without mars.js: the flags of each trace entry against what the
// instruction did to its warrior's queue, one instruction at a time. The
// queue loses its head and gains what the instruction queued: nothing when
// the process died, the A pointer for a jump, pc + 2 for a skip, pc + 1 and
// the A pointer for SPL with room for a process, else pc + 1.
test('the trace flags agree with what each instruction did to its queue', () => {
  const DIED = 0x40000, NEW_PROCESS = 0x20000, SKIPPED = 0x80000;
  let checked = 0;
  for (let i = 0; i < 60; i++) {
    const o = [RULES[0], RULES[1], RULES[2], RULES[6], RULES[7]][i % 5];
    const nw = 2 + rand(2);
    const codes = randomCodes(o, nw);
    if (!codes) continue;
    const w = createWasmMarsSync({ ...o, watch: true }, module);
    w.load(codes, { seed: rand(2147483646) + 1 });
    const n = o.coreSize;
    for (let round = 0; round < 4; round++) {
      w.startRound();
      for (let step = 0; step < 2000 && !w.roundOver; step++) {
        const cur = w.current;
        const before = w.warriors[cur].processes();
        w.run(1);
        const added = w.warriors[cur].processes().slice(before.length - 1);
        const k = 4 * (w.time % (w.watch().trace.length / 4));
        const [pc, a, , meta] = w.watch().trace.subarray(k, k + 4);
        const opcode = (meta >> 11) & 31;
        const at = `${JSON.stringify(o)} time ${w.time}: opcode ${opcode}, meta ${meta.toString(16)}, queued ${added}`;
        assert.equal(pc, before[0], `${at}: pc`);
        assert.equal(meta & 0xff, cur, `${at}: warrior`);
        let want = [(pc + 1) % n];
        if (meta & DIED) want = [];
        else if (opcode === 11) want = meta & NEW_PROCESS ? [(pc + 1) % n, a] : [(pc + 1) % n];
        else if (opcode === 13 || ([6, 7, 8].includes(opcode) && meta & NEW_PROCESS)) want = [a];
        else if (meta & SKIPPED) want = [(pc + 2) % n];
        assert.deepEqual(added, want, at);
        if (meta & SKIPPED) assert.ok([9, 10, 14, 15].includes(opcode), `${at}: a skip`);
        if (meta & NEW_PROCESS) assert.ok([6, 7, 8, 11, 13].includes(opcode), `${at}: a new process`);
        checked++;
      }
    }
  }
  assert.ok(checked > 20000, `only ${checked} instructions`);
});

test('runMatch with a watch attached gives the same match and leaves the watch alone', () => {
  const codes = ['dwarf', 'imp'].map(sample);
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

test('the trace and the deaths have the sizes of 42mars.h', () => {
  const header = readFileSync(new URL('../lib/42mars.h', import.meta.url), 'latin1');
  const size = (name) => Number(header.match(new RegExp(`#define ${name} (\\d+)`))[1]);
  const w = createWasmMarsSync({ watch: true }, module);
  w.load([sample('imp')]);
  assert.equal(w.watch().trace.length, 4 * size('M42_TRACE_SIZE'));
  assert.equal(w.watch().death.length, 4 * size('M42_DEATH_SIZE'));
});

test('watch() needs { watch: true } and a load()', () => {
  assert.throws(() => createWasmMarsSync({}, module).watch(), /watch: true/);
  assert.throws(() => createWasmMarsSync({ watch: true }, module).watch(), /first load/);
  // a maxLength the watch cannot number
  const w = createWasmMarsSync({ watch: true, maxLength: 65537 }, module);
  assert.throws(() => w.load([assemble(' dat 0\n')]), /rule out of range/);
});
