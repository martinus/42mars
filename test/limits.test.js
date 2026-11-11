// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Read and write limits (readLimit, writeLimit; pmars -R -W). The expected
// cells are pMARS 0.9.5's: `pmars-trace -s 80 -R r -W w -F 60` ran the
// warrior below against `dat #0, #0` for one round, and of all copies of one
// cell to another (and +-1 on one field), exactly the one given here gives
// the core hash it printed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mars } from '../js/mars.js';
import { createWasmMarsSync, assembleWasm as assemble } from '../wasm/42mars.js';

// The instruction, then distinct cells 1..11: dat #11, #1 .. dat #21, #11.
const warrior = (ins) => ` ${ins}\n` + Array.from({ length: 11 }, (_, i) => ` dat #${11 + i}, #${i + 1}\n`).join('');

// Runs the first instruction and returns the cells asked for, as
// [opcode, A value, B value].
function run(engine, ins, readLimit, writeLimit, cells) {
  const opts = { coreSize: 80, maxLength: 12, minDistance: 12, readLimit, writeLimit };
  const w = assemble(warrior(ins), opts);
  assert.ok(w.ok, ins);
  const m = engine === 'wasm' ? createWasmMarsSync(opts) : new Mars({ ...opts, headless: engine === 'headless' });
  m.load([w], { positions: [0] });
  m.startRound();
  m.step();
  return cells.map((a) => { const c = m.cell(a); return [c.op, c.aVal, c.bVal]; });
}

const DAT = 12;
const CASES = [
  // offsets folded into the limit's window: 5 with -W 8 is -3
  { ins: 'mov.ab #7, $5', r: 80, w: 8, cells: { 77: [DAT, 0, 7] } },
  { ins: 'mov.ab #7, $9', r: 80, w: 8, cells: { 1: [DAT, 11, 7] } },
  // -R 4: the source $5 is cell 1; @3 adds the pointer cell at the read
  // offset (-1, empty) to the write offset 3
  { ins: 'mov.i $5, @3', r: 4, w: 80, cells: { 3: [DAT, 11, 1] } },
  // -W 4: the write offset of @3 is -1, plus the pointer cell 3 at the
  // read offset: 2
  { ins: 'mov.i $5, @3', r: 80, w: 4, cells: { 2: [DAT, 15, 5], 79: [DAT, 0, 0] } },
  // < with -W 4: the pointer cell is at the write offset 1, decremented to
  // 0, and the read address starts from there too: cell 1 goes to -1
  { ins: 'mov.i <5, $3', r: 80, w: 4, cells: { 1: [DAT, 11, 0], 79: [DAT, 11, 0] } },
  // > with -W 4: the same cell, incremented after the read
  { ins: 'mov.i >5, $3', r: 80, w: 4, cells: { 1: [DAT, 11, 2], 79: [DAT, 12, 2] } },
  // { on the A field: cell 1's A field 11 becomes 10, the source is 1 + 10
  { ins: 'mov.i {5, $3', r: 80, w: 4, cells: { 1: [DAT, 10, 1], 79: [DAT, 21, 11] } },
];

test('read and write limits: folded offsets and the pointer cells of pMARS', () => {
  for (const engine of ['mars.js', 'headless', 'wasm']) {
    for (const c of CASES) {
      const at = Object.keys(c.cells).map(Number);
      assert.deepEqual(run(engine, c.ins, c.r, c.w, at), Object.values(c.cells), `${engine}: ${c.ins} -R ${c.r} -W ${c.w}`);
    }
  }
});

test('read and write limits: the visualizer bookkeeping marks the cell written', () => {
  // -W 4: mov.i $5, @3 writes cell 2 and reads cell 5 (see above)
  const opts = { coreSize: 80, maxLength: 12, minDistance: 12, readLimit: 80, writeLimit: 4 };
  const m = new Mars(opts);
  m.load([assemble(warrior('mov.i $5, @3'), opts)], { positions: [0] });
  m.startRound();
  m.owner.fill(-1, 1, 12); // as if cells 1..11 were not the warrior's
  m.step();
  assert.equal(m.owner[2], 0);
  assert.equal(m.tWrite[2], 1);
  assert.equal(m.owner[5], -1);
});

test('a read or write limit must divide the core size, as pmars -R and -W want', () => {
  for (const opts of [{ readLimit: 3 }, { writeLimit: 8001 }, { coreSize: 800, readLimit: 30 }]) {
    assert.throws(() => new Mars(opts), RangeError, JSON.stringify(opts));
    assert.throws(() => createWasmMarsSync(opts).load([assemble(' dat 0\n')], { seed: 1 }), RangeError, JSON.stringify(opts));
  }
  new Mars({ readLimit: 500, writeLimit: 1 });
});

test('read and write limits equal to the core size change nothing', () => {
  for (const engine of ['mars.js', 'wasm']) {
    // cell 5's B field 5 becomes 4, cell 9 goes to cell 3
    assert.deepEqual(run(engine, 'mov.i <5, $3', 80, 80, [3, 5]), [[DAT, 19, 9], [DAT, 15, 4]], engine);
  }
});
