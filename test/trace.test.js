// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble } from '../js/assembler.js';
import { Mars } from '../js/mars.js';
import { OP, MOD } from '../js/opcodes.js';

const STORED = 1 << 16;
const NEW_PROCESS = 1 << 17;
const DIED = 1 << 18;
const SKIPPED = 1 << 19;
const FLAGS = STORED | NEW_PROCESS | DIED | SKIPPED;

function battle(sources, opts = {}, positions = [0, 4000]) {
  const m = new Mars(opts);
  m.load(sources.map((s) => {
    const w = assemble(s, opts);
    assert.ok(w.ok, JSON.stringify(w.errors));
    return w;
  }), { positions: positions.slice(0, sources.length) });
  m.startRound();
  return m;
}

// Trace entry of the instruction executed at time t.
function entry(m, t) {
  const slot = t & (m.traceSize - 1);
  const meta = m.traceMeta[slot];
  return { pc: m.tracePc[slot], a: m.traceA[slot], b: m.traceB[slot], warrior: meta & 0xff, op: (meta >> 8) & 0xff, flags: meta & FLAGS };
}

test('trace: a store sets bit 16 and records the pointers', () => {
  const m = battle(['mov.i 0, 1\n']);
  m.run(1);
  assert.deepEqual(entry(m, 1), { pc: 0, a: 0, b: 1, warrior: 0, op: (OP.MOV << 3) | MOD.I, flags: STORED });
  const only = battle(['mov.ab #5, 1\njmp -1\n']); // stores the B field only
  only.run(1);
  assert.equal(entry(only, 1).flags, STORED);
});

test('trace: JMP and a taken JMZ set bit 17, a JMZ that falls through does not', () => {
  let m = battle(['jmp 2\ndat 0\njmp -2\n']);
  m.run(1);
  assert.deepEqual(entry(m, 1), { pc: 0, a: 2, b: 0, warrior: 0, op: (OP.JMP << 3) | MOD.B, flags: NEW_PROCESS });
  m = battle(['jmz 2, #0\ndat 0\njmp -2\n']);
  m.run(1);
  assert.equal(entry(m, 1).flags, NEW_PROCESS);
  m = battle(['jmz 2, #1\njmp -1\n']);
  m.run(1);
  assert.equal(entry(m, 1).flags, 0);
});

test('trace: SPL sets bit 17 only when a new process was created', () => {
  let m = battle(['spl 2\njmp -1\njmp -2\n']);
  m.run(1);
  assert.equal(entry(m, 1).flags, NEW_PROCESS);
  m = battle(['spl 2\njmp -1\njmp -2\n'], { maxProcesses: 1 });
  m.run(1);
  assert.equal(entry(m, 1).flags, 0);
});

test('trace: a dying process sets bit 18', () => {
  const m = battle(['dat 0, 0\n', 'jmp 0\n']);
  m.run(1);
  assert.equal(entry(m, 1).flags, DIED);
  assert.equal(entry(m, 1).op, (OP.DAT << 3) | MOD.F);
});

test('trace: a skip sets bit 19', () => {
  let m = battle(['seq #1, #1\ndat 0\njmp -2\n']);
  m.run(1);
  assert.equal(entry(m, 1).flags, SKIPPED);
  m = battle(['seq #1, #2\njmp -1\n']);
  m.run(1);
  assert.equal(entry(m, 1).flags, 0);
});

test('trace: DJN stores, and sets bit 17 only while it loops', () => {
  const m = battle(['djn 0, #2\njmp -1\n']);
  m.run(2);
  assert.equal(entry(m, 1).flags, STORED | NEW_PROCESS);
  assert.equal(entry(m, 2).flags, STORED);
});

test('trace: entries carry the index of the executing warrior', () => {
  const m = battle(['jmp 0\n', 'jmp 0\n']);
  m.run(4);
  assert.deepEqual([1, 2, 3, 4].map((t) => entry(m, t).warrior), [0, 1, 0, 1]);
  assert.deepEqual([1, 2, 3, 4].map((t) => entry(m, t).pc), [0, 4000, 0, 4000]);
});

test('trace: the slot is time & (traceSize - 1), older entries are overwritten', () => {
  const m = battle(['mov.i 0, 1\n']);
  const n = m.traceSize + 10;
  m.run(n);
  // a solo imp executes address t - 1 at time t
  for (const t of [n, n - 1, m.traceSize + 1, 11]) assert.equal(entry(m, t).pc, t - 1, `time ${t}`);
});
