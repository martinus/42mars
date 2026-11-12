// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The simulator of the library (wasm/42mars.js) on small warriors: pMARS's
// rules, scoring, placement and p-space, and the watch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { assemble, createMarsSync, rng } from '../wasm/42mars.js';
import { formatInstruction } from '../tools/opcodes.js';

// An engine with the watch (watch(), events()).
const engine = (opts = {}) => createMarsSync({ ...opts, watch: true });

function warrior(src, opts) {
  const w = assemble(src, opts);
  assert.ok(w.ok, JSON.stringify(w.errors));
  return w;
}

// Single warrior at address 0.
function solo(src, opts = {}) {
  const m = engine(opts);
  m.load([warrior(src, opts)], { positions: [0] });
  m.startRound();
  return m;
}

const cellText = (m, a) => {
  const c = m.cell(a);
  return formatInstruction(c.op, c.mod, c.aMode, c.aVal, c.bMode, c.bVal, m.coreSize);
};

test('imp copies itself forward', () => {
  const m = solo('mov.i 0, 1\n');
  m.run(3);
  for (let a = 0; a <= 3; a++) assert.equal(cellText(m, a), 'MOV.I $0, $1');
  assert.equal(cellText(m, 4), 'DAT.F $0, $0');
  assert.deepEqual(m.warriors[0].processes(), [3]);
});

test('dwarf bombs every fourth cell', () => {
  const m = solo('bomb dat #0\ndwarf add #4, bomb\nmov bomb, @bomb\njmp dwarf\nend dwarf\n');
  m.run(3 * 5);
  for (const k of [4, 8, 12, 16, 20]) assert.equal(cellText(m, k), `DAT.F #0, #${k}`);
  assert.equal(cellText(m, 0), 'DAT.F #0, #20');
});

test('MOV.I uses in-register values: a postincrement does not leak into the copy', () => {
  const m = solo('mov.i }0, 1\n');
  m.run(1);
  assert.equal(cellText(m, 0), 'MOV.I }1, $1');
  assert.equal(cellText(m, 1), 'MOV.I }0, $1');
});

test('immediate B operand reads the current core, after the A postincrement', () => {
  // A: >0 increments cell 0's B field before B (#) is read: pMARS behavior.
  const m = solo('add.ab >0, #5\n');
  m.run(1);
  // AA = A-field of the A target (cell 0) = 0; B target is cell 0 with B already incremented to 6.
  assert.equal(cellText(m, 0), 'ADD.AB >0, #6');
});

test('SPL queues the next instruction first, then the new process', () => {
  const m = solo('spl 2\njmp 0\njmp 0\n');
  m.run(1);
  assert.deepEqual(m.warriors[0].processes(), [1, 2]);
  assert.equal(m.warriors[0].tasks, 2);
});

test('SPL respects the process limit', () => {
  const m = solo('spl 0\njmp -1\n', { maxProcesses: 3 });
  m.run(50);
  assert.equal(m.warriors[0].tasks, 3);
});

test('DAT and division by zero kill the process', () => {
  for (const src of ['dat 0, 0\n', 'div #0, 1\n', 'mod.ab #0, 1\n', 'div.f 1, 2\n']) {
    const m = solo(src);
    m.run(1);
    assert.equal(m.roundOver, true, src);
    assert.deepEqual(m.roundResult.survivors, [], src);
  }
});

test('DIV.F writes the field with a non-zero divisor before the process dies', () => {
  const m = solo('div.f dv, 1\ndat #3, #10\ndv dat #0, #2\n');
  m.run(1);
  assert.equal(cellText(m, 1), 'DAT.F #3, #5');
  assert.equal(m.roundOver, true);
});

test('DJN loops until the counter reaches zero', () => {
  const m = solo('djn 0, #3\ndat 0\n');
  m.run(3);
  assert.deepEqual(m.warriors[0].processes(), [1]);
  assert.equal(m.bv[0], 0);
});

test('SEQ/SNE/CMP.I compare whole instructions, SLT compares fields', () => {
  let m = solo('seq.i a, b\ndat 0\njmp 0\na mov 1, 2\nb mov 1, 2\n');
  m.run(1);
  assert.deepEqual(m.warriors[0].processes(), [2]);
  m = solo('seq.i a, b\ndat 0\njmp 0\na mov 1, 2\nb add 1, 2\n');
  m.run(1);
  assert.deepEqual(m.warriors[0].processes(), [1]);
  m = solo('sne.a a, b\ndat 0\njmp 0\na dat 1, 2\nb dat 1, 9\n');
  m.run(1);
  assert.deepEqual(m.warriors[0].processes(), [1]);
  m = solo('slt.ab #3, a\ndat 0\njmp 0\na dat 0, 4\n');
  m.run(1);
  assert.deepEqual(m.warriors[0].processes(), [2]);
});

test('A-field indirect modes', () => {
  const m = solo('mov.i *p, {p\np dat 2, 3\ndat 7, 7\ndat 8, 8\n');
  m.run(1);
  // A: *p -> p + p.a = 3. B: {p predecrements p.a to 1 -> target p + 1 = 2.
  assert.equal(cellText(m, 2), 'DAT.F $8, $8');
  assert.equal(cellText(m, 1), 'DAT.F $1, $3');
});

test('two survivors tie after warriors * MAXCYCLES cycles', () => {
  const m = engine();
  m.load([warrior('jmp 0\n'), warrior('jmp 0\n')], { seed: 0 });
  m.startRound();
  m.run(1e6);
  assert.equal(m.roundOver, true);
  assert.equal(m.time, 2 * 80000);
  assert.deepEqual(m.roundResult.survivors, [0, 1]);
  assert.equal(m.warriors[0].ties, 1);
});

test('the last warrior standing wins, and death shortens the cycle budget', () => {
  const m = engine();
  m.load([warrior('jmp 0\n'), warrior('dat 0\n'), warrior('jmp 0\n')], { seed: 1 });
  m.startRound();
  m.run(2); // warrior 0 runs, warrior 1 dies
  assert.equal(m.warriors[1].alive, false);
  // pMARS: cycle = cycle - 1 - (cycle - 1) / warriorsLeft, then the loop decrements once more
  const before = 3 * 80000 - 1;
  const expected = before - 1 - Math.trunc((before - 1) / 3) - 1;
  assert.equal(m.cyclesLeft, expected);
  assert.ok(m.events().some((e) => e.type === 'death' && e.warrior === 1));
});

test('placement of the second warrior follows pMARS for a given seed', () => {
  const m = engine();
  m.load([warrior('jmp 0\n'), warrior('jmp 0\n')], { seed: 5 });
  m.startRound();
  assert.equal(m.warriors[1].position, 105); // like pmars -F 105
  m.endRound();
  m.startRound();
  assert.equal(m.warriors[1].position, 100 + (rng(5) % 7801));
});

test('a warrior that does not fit the rules is refused, with the reason', async () => {
  // Assembled for a core of 8000 and played in one of 800, the engine read
  // and wrote outside the watch's memory (#86).
  const { packWarrior } = await import('../wasm/42mars.js');
  const imp = assemble('mov 0, 1');
  const far = assemble('mov 7000, 7999\nmov @7000, }7999\njmp -2\n');
  const m = engine({ coreSize: 800, maxProcesses: 800 });
  const fit = /does not fit the rules/;
  assert.throws(() => m.runMatch([far, imp]), /warrior 'Unknown' does not fit the rules: instruction 0 has A value 7000 \(core size 800\)/);
  assert.throws(() => m.load([imp, far]), fit);
  const one = (change) => ({ ...imp, instructions: [{ ...imp.instructions[0], ...change }] });
  for (const change of [{ op: 19 }, { mod: 7 }, { aMode: 8 }, { bMode: 8 }, { aVal: 800 }, { bVal: -1 }, { aVal: 1.5 }]) {
    assert.throws(() => m.load([one(change), imp]), fit, JSON.stringify(change));
  }
  assert.throws(() => m.load([{ ...imp, start: 800 }, imp]), /start 800/);
  const packed = packWarrior(imp);
  packed.packed[0] = (1 << 3) | 7; // modifier 7
  assert.throws(() => m.load([packed, imp]), /modifier 7/);
  packed.packed[0] = 19 << 3; // opcode 19
  assert.throws(() => m.load([packed, imp]), /opcode word 152/);
  assert.throws(() => m.runMatch([imp, imp], { positions: [0, 800] }), RangeError);
  assert.equal(m.runMatch([imp, imp], { positions: [0, 799] }).warriors.length, 2);
  assert.equal(m.runMatch([imp, assemble('mov 7, 799', { coreSize: 800 })]).warriors.length, 2);
});

test('sourceEnd: where the next warrior of a stream starts', () => {
  // pMARS reads several warriors from stdin: each one ends before its second
  // ;redcode line, and the next one starts there (#93).
  const stream = ';redcode\n;name A\nmov 0, 1\n;redcode\n;name B\ndat 5\n';
  const a = assemble(stream);
  assert.equal(a.sourceEnd, stream.indexOf(';redcode', 1));
  const b = assemble(stream.slice(a.sourceEnd));
  assert.deepEqual([a.name, b.name, b.sourceEnd], ['A', 'B', stream.length - a.sourceEnd]);
  // in characters, also when the source is UTF-8
  const u = ';redcode\n;name Ä€\nmov 0, 1\n;redcode\ndat 5\n';
  assert.equal(assemble(u).sourceEnd, u.indexOf(';redcode', 1));
});

test('every method called before a load throws with the status text', () => {
  // m42_start_round() and m42_end_round() returned M42_ERR_STATE and the JS
  // interface ignored it; run() returned 0 and state() a made-up round (#90).
  const m = createMarsSync({ watch: true });
  const calls = {
    startRound: () => m.startRound(), run: () => m.run(10), step: () => m.step(), endRound: () => m.endRound(),
    state: () => m.state(), round: () => m.round, roundOver: () => m.roundOver, time: () => m.time,
    cyclesLeft: () => m.cyclesLeft, warriorsLeft: () => m.warriorsLeft, current: () => m.current,
    core: () => m.core(), watch: () => m.watch(),
  };
  for (const [method, call] of Object.entries(calls)) {
    assert.throws(call, (e) => e instanceof Error && e.message === `${method}: no warriors loaded`, method);
  }
  // after a load they work
  m.load([assemble('mov 0, 1'), assemble('mov 0, 1')], { seed: 1 });
  m.startRound();
  assert.equal(m.run(10), 10);
  assert.equal(m.time, 10);
  m.endRound();
  assert.equal(m.roundOver, true);
});

test('p-space values from outside are below the core size', () => {
  // LDP copies a p-space value into a cell field, and the engine does not
  // reduce it again: a value of the core size or more made it address
  // outside the core (found by the fuzz target fuzz_make of #88).
  const imp = assemble('mov 0, 1', { coreSize: 800 });
  const m = engine({ coreSize: 800, maxProcesses: 800, pSpaceSize: 50 });
  const cells = (v) => [0, 1].map(() => Int32Array.from({ length: 50 }, (_, k) => (k === 7 ? v : 0)));
  assert.equal(m.runMatch([imp, imp], { pspace: cells(799) }).warriors.length, 2);
  assert.throws(() => m.runMatch([imp, imp], { pspace: cells(800) }), RangeError);
  assert.throws(() => m.runMatch([imp, imp], { pspace: cells(-1) }), RangeError);
});

test('p-space: last result starts at CORESIZE-1 and survives into the next round', () => {
  const src = 'ldp.ab #0, res\nstp.ab #42, #1\nldp.ab #1, res2\njmp 0\nres dat 0, 0\nres2 dat 0, 0\n';
  const m = engine({ maxCycles: 100 });
  m.load([warrior(src)], { positions: [0] });
  m.startRound();
  m.run(3);
  assert.equal(m.bv[4], 7999);
  assert.equal(m.bv[5], 42);
  m.run(1e6);
  m.startRound();
  m.run(1);
  assert.equal(m.bv[4], 1, 'solo survivor sees 1 as the last result');
});

test('the watch: owner, origin and territory', () => {
  const m = engine();
  m.load([warrior('mov.i 0, 1\n'), warrior('jmp 0\n')], { positions: [0, 4000] });
  m.startRound();
  m.run(10);
  const v = m.watch();
  assert.equal(v.owner[3], 1); // warrior 0, as index + 1
  assert.equal(v.origin[3], 0); // copy of warrior 0, instruction 0
  assert.equal(m.warriors[0].territory, 1 + 5);
  assert.ok(v.tExec[4000] > 0);
});

// pMARS ships validate.red (GPL, not in this repository). It loops forever on
// a compliant MARS and kills itself otherwise. Point PMARS_VALIDATE at it.
const validate = process.env.PMARS_VALIDATE;
test('pMARS validate.red self-ties', { skip: !validate || !existsSync(validate) ? 'PMARS_VALIDATE not set' : false }, () => {
  const m = engine();
  m.load([warrior(readFileSync(validate, 'latin1'), { warriors: 1 })], { positions: [0] });
  m.startRound();
  m.run(1e6);
  assert.deepEqual(m.roundResult.survivors, [0]);
  assert.equal(m.time, 80000);
});

// assemble() of a source without instructions returns such an object.
const empty = (name) => ({ ok: true, instructions: [], start: 0, pin: null, name, author: 'nobody' });

for (const watch of [true, false]) {
  test(`a warrior without instructions runs whatever is at its position${watch ? ' (watched)' : ''}`, () => {
    // Placed onto warrior 0's imp loop: it executes that code and survives.
    let m = createMarsSync({ watch });
    m.load([warrior('jmp 0\n'), empty('ghost')], { positions: [0, 0] });
    m.startRound();
    const ghost = m.warriors[1];
    if (watch) {
      assert.equal(ghost.execCount.length, 0);
      assert.equal(ghost.territory, 0);
    }
    assert.deepEqual(ghost.processes(), [0]);
    assert.equal(m.run(4), 4);
    assert.deepEqual(ghost.processes(), [0]);
    assert.equal(ghost.alive, true);
    if (watch) {
      assert.equal(m.warriors[0].execCount[0], 4); // counted for the warrior whose code it is
      assert.equal(m.watch().execBy[0], 2); // warrior 1, as index + 1
    }
    m.run(1e6);
    assert.deepEqual(m.roundResult.survivors, [0, 1]);

    // In an empty part of the core it executes DAT and dies.
    m = createMarsSync({ watch });
    m.load([warrior('jmp 0\n'), empty('ghost')], { positions: [0, 4000] });
    m.startRound();
    m.run(1e6);
    assert.equal(m.time, 2);
    assert.deepEqual(m.roundResult.survivors, [0]);
    assert.equal(m.warriors[1].diedAt, 2);

    // Only empty warriors: two die, then the round ends with the third.
    m = createMarsSync({ watch, warriors: 3 });
    m.load([empty('a'), empty('b'), empty('c')], { positions: [0, 100, 200] });
    m.startRound();
    m.run(1e6);
    assert.deepEqual(m.roundResult.survivors, [2]);
    assert.equal(m.time, 2);
    m.startRound(); // warrior 1 starts
    m.run(1e6);
    assert.deepEqual(m.roundResult.survivors, [0]);
  });
}
