// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// permute (pmars -P): the positions and first movers of the rounds. The
// expected sequences in test/fixtures/permute.json are pMARS 0.9.5's, read
// from the per-round core hashes of its trace build; the file says how.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWasmMarsSync, assembleWasm as assemble } from '../wasm/42mars.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/permute.json', import.meta.url), 'utf8'));
const small = { coreSize: fixture.coreSize, minDistance: fixture.minDistance, maxLength: 5 };
const pair = ['dat #1, #2', 'mov.ab #7, $1\ndat #3, #4'].map((t) => assemble(t, small));
// with and without a watch: the two loops of the stepping interface
const engines = (opts) => [['wasm', createWasmMarsSync(opts)], ['watch', createWasmMarsSync({ ...opts, watch: true })]];

test('permute: positions and first movers of 330 rounds are pMARS -P\'s (two full draws and a third begun)', () => {
  for (const run of fixture.runs) {
    const expected = run.combos.split(' ').map(Number);
    for (const [name, m] of engines(small)) {
      m.load(pair, { seed: run.seed, permute: true });
      const got = [];
      for (let r = 0; r < expected.length; r++) {
        m.startRound();
        assert.equal(m.warriors[0].position, 0);
        got.push(2 * (m.warriors[1].position - fixture.minDistance) + m.current);
        m.endRound();
      }
      assert.deepEqual(got, expected, `${name}, pmars ${run.pmars}`);
    }
  }
});

const opts = { maxCycles: 8000 }; // the warriors assert core size 8000
const warriors = ['lantern', 'origami'].map((n) => assemble(readFileSync(new URL(`../warriors/${n}.red`, import.meta.url), 'latin1'), opts));

test('permute: runMatch in blocks of rounds gives the rounds of the whole match, and stepping the same', () => {
  const seed = 1234;
  const w = createWasmMarsSync(opts);
  const whole = w.runMatch(warriors, { rounds: 40, seed, permute: true });
  const blocks = [0, 7, 19, 33].flatMap((first, i, a) => w.runMatch(warriors, { rounds: (a[i + 1] ?? 40) - first, seed, permute: true, firstRound: first }).results);
  assert.deepEqual(blocks, whole.results);
  // round by round on the stepping interface
  const m = createWasmMarsSync(opts);
  m.load(warriors, { seed, permute: true });
  for (let r = 0; r < 40; r++) {
    m.startRound();
    while (!m.roundOver) m.run(1e6);
  }
  assert.deepEqual(m.results, whole.results);
  // and the rounds are not those without permute
  assert.notDeepEqual(w.runMatch(warriors, { rounds: 40, seed }).results, whole.results);
});

test('permute needs two warriors and no fixed positions', () => {
  const three = [...warriors, warriors[0]];
  for (const [name, m] of engines({ coreSize: 8000 })) {
    assert.throws(() => m.load(three, { seed: 1, permute: true }), RangeError, name);
    assert.throws(() => m.load(warriors, { positions: [0, 4000], permute: true }), RangeError, name);
  }
  assert.throws(() => createWasmMarsSync().runMatch(three, { seed: 1, permute: true }), RangeError);
});
