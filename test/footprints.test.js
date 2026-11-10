// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// readBy and bump, the per-cell footprints that the visualizer draws (semantics
// doc, section 3.4): who read a cell last, and whether its last store was an
// increment, a decrement or a write.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble } from '../js/assembler.js';
import { Mars } from '../js/mars.js';

function warrior(src) {
  const w = assemble(src);
  assert.ok(w.ok, JSON.stringify(w.errors));
  return w;
}

// Warrior 0 idles at 0, warrior 1 runs `src` at 4000.
function duel(src, options = {}) {
  const m = new Mars(options);
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
  assert.equal(m.readBy[0], 0, 'jmp 0 reads its A target');
  assert.equal(m.readBy[4010], 1, '} reads through the A-field of 4010, which is 0');
  assert.equal(m.readBy[4031], 1, 'cmp reads its B target');
  assert.equal(m.readBy[4019], -1, 'a MOV target is written, not read');
  assert.equal(m.readBy[4020], -1, 'the pointer cell of < is changed, not read');
});

test('bump tells increments and decrements from writes', () => {
  const m = duel(SRC);
  m.run(2);
  assert.equal(m.bump[4010], 1, '} incremented the A-field of 4010');
  assert.equal(m.bump[4020], -1, '< decremented the B-field of 4020');
  assert.equal(m.bump[4019], 0, 'the MOV wrote 4019');
  assert.equal(m.owner[4010], 1);
  assert.equal(m.owner[4020], 1);
  assert.equal(m.owner[4019], 1);
  assert.equal(m.tWrite[4019], 2);
});

test('a write after an increment in the same instruction leaves bump 0', () => {
  // >0 increments the B-field of cell 0 and makes cell 0 the target
  const m = duel('mov.i 1, >0\njmp 0\n');
  m.run(2);
  assert.equal(m.bump[4000], 0);
  assert.equal(m.bump[4001], 0);
});

test('footprints are reset at round start and not kept in headless mode', () => {
  const m = duel(SRC);
  m.run(4);
  m.startRound();
  assert.ok(m.readBy.every((x) => x === -1));
  assert.ok(m.bump.every((x) => x === 0));
  const h = duel(SRC, { headless: true });
  h.run(4);
  assert.ok(h.readBy.every((x) => x === -1));
  assert.ok(h.bump.every((x) => x === 0));
});
