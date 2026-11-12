// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// readBy and bump of the watch, the per-cell footprints that the visualizer
// draws (semantics doc, sections 3.4 and 3.7): who read a cell last (warrior
// + 1, 0 none), and whether its last store was an increment, a decrement or
// a write.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble, createMarsSync } from '../wasm/42mars.js';

function warrior(src) {
  const w = assemble(src);
  assert.ok(w.ok, JSON.stringify(w.errors));
  return w;
}

// Warrior 0 idles at 0, warrior 1 runs `src` at 4000.
function duel(src) {
  const m = createMarsSync({ watch: true });
  m.load([warrior('jmp 0\n'), warrior(src)], { positions: [0, 4000] });
  m.startRound();
  return m;
}

const SRC = `
        mov.i   }10, <20
        cmp.ab  #0, 30
        jmp     0
`;

test('readBy names the reader of A and compared B targets', () => {
  const m = duel(SRC);
  m.run(4); // two instructions of each warrior
  const { readBy } = m.watch();
  assert.equal(readBy[0], 1, 'jmp 0 reads its A target');
  assert.equal(readBy[4010], 2, '} reads through the A-field of 4010, which is 0');
  assert.equal(readBy[4031], 2, 'cmp reads its B target');
  assert.equal(readBy[4019], 0, 'a MOV target is written, not read');
  assert.equal(readBy[4020], 0, 'the pointer cell of < is changed, not read');
});

test('bump tells increments and decrements from writes', () => {
  const m = duel(SRC);
  m.run(2);
  const { bump, owner, tWrite } = m.watch();
  assert.equal(bump[4010], 1, '} incremented the A-field of 4010');
  assert.equal(bump[4020], -1, '< decremented the B-field of 4020');
  assert.equal(bump[4019], 0, 'the MOV wrote 4019');
  assert.equal(owner[4010], 2);
  assert.equal(owner[4020], 2);
  assert.equal(owner[4019], 2);
  assert.equal(tWrite[4019], 2);
});

test('a write after an increment in the same instruction leaves bump 0', () => {
  // >0 increments the B-field of cell 0 and makes cell 0 the target
  const m = duel('mov.i 1, >0\njmp 0\n');
  m.run(2);
  assert.equal(m.watch().bump[4000], 0);
  assert.equal(m.watch().bump[4001], 0);
});

test('footprints are reset at round start', () => {
  const m = duel(SRC);
  m.run(4);
  assert.ok(m.watch().readBy.some((x) => x !== 0));
  m.startRound();
  assert.ok(m.watch().readBy.every((x) => x === 0));
  assert.ok(m.watch().bump.every((x) => x === 0));
});
