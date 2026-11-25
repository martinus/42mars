// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// tools/designs.js (#222): the designs of a run of islands from its events
// `score` (42evolve --score-designs), their score against each kind of hill
// warrior, and two designs side by side with their best-of bound.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byKind, compareDesigns, designTable, designsAt } from '../tools/designs.js';

// Two islands, four opponents of two kinds, 10 rounds. Island 1: a Kernel
// that is also p0 (its points at p0, its first place) and a paper; island 2
// the Kernel design again, weaker, and a scanner. Points are 3 a win, 1 a tie.
const files = ['a.red', 'b.red', 'c.red', 'd.red'];
const kindOf = { 'a.red': 'scanner', 'b.red': 'scanner', 'c.red': 'paper', 'd.red': 'stone' };
const score = (batch, island2 = true) => ({
  type: 'score', batch, rounds: 10, opponents: 4, files,
  islands: [
    { island: 1, score: 50, warriors: [
      { tag: 'p0', id: 7, score: 50, name: 'Undying Kernel', code: 'k', points: [30, 30, 0, 0], wins: [10, 10, 0, 0] },
      { tag: 'design', id: 7, score: 50, noun: 'Kernel', kind: 'copies itself', members: 5 },
      { tag: 'design', id: 9, score: 40, noun: 'Ant', kind: 'paper', members: 3, name: 'Scarlet Ant', code: 'a', points: [0, 6, 30, 12], wins: [0, 2, 10, 4] },
    ] },
    ...(island2 ? [{ island: 2, score: 30, warriors: [
      { tag: 'design', id: 3, score: 30, noun: 'Kernel', kind: 'copies itself', members: 4, name: 'Small Kernel', code: 'k2', points: [12, 12, 0, 0], wins: [4, 4, 0, 0] },
    ] }] : []),
  ],
});

test('designsAt: one row per family and kind over all islands, the best of them, its points from its first place', () => {
  const ds = designsAt(score(100));
  assert.deepEqual(ds.map((d) => [d.key, d.islands, d.members, d.best.island, d.best.id, d.best.name, d.best.score]), [
    ['Kernel · copies itself', [1, 2], 9, 1, 7, 'Undying Kernel', 50],
    ['Ant · paper', [1], 3, 1, 9, 'Scarlet Ant', 40],
  ]);
  assert.deepEqual(ds[0].best.points, [30, 30, 0, 0]);
  // the best whatever the order of the islands
  const s = score(100);
  assert.deepEqual(designsAt({ ...s, islands: [...s.islands].reverse() }).map((d) => [d.best.island, d.best.id]), [[1, 7], [1, 9]]);
  assert.deepEqual(designsAt({ ...score(100), islands: [{ island: 1, score: 9, warriors: [{ tag: 'best', id: 1, score: 9 }] }] }), []);
});

test('byKind: points per 100 rounds against each kind, a file without a kind counts as ""', () => {
  assert.deepEqual(byKind([30, 30, 0, 0], files, 10, kindOf), { scanner: { n: 2, mean: 300 }, paper: { n: 1, mean: 0 }, stone: { n: 1, mean: 0 } });
  assert.deepEqual(byKind([0, 6, 30, 12], files, 10, { 'c.red': 'paper' }), { '': { n: 3, mean: 60 }, paper: { n: 1, mean: 300 } });
  assert.deepEqual(byKind(null, files, 10, kindOf), {});
});

test('designTable: the last score with the kinds, new designs marked, the history of each', () => {
  const t = designTable([score(100, false), score(200)], kindOf);
  assert.deepEqual(t.map((d) => [d.key, d.isNew, d.history]), [
    ['Kernel · copies itself', false, [{ batch: 100, members: 5, score: 50 }, { batch: 200, members: 9, score: 50 }]],
    ['Ant · paper', false, [{ batch: 100, members: 3, score: 40 }, { batch: 200, members: 3, score: 40 }]],
  ]);
  assert.deepEqual(t[1].kinds, { scanner: { n: 2, mean: 30 }, paper: { n: 1, mean: 300 }, stone: { n: 1, mean: 120 } });
  const first = { ...score(100), islands: [score(100).islands[1]] }; // only the Kernel of island 2 before
  assert.deepEqual(designTable([first, score(200)]).map((d) => [d.key, d.isNew]), [['Kernel · copies itself', false], ['Ant · paper', true]]);
  assert.deepEqual(designTable([score(200)]).map((d) => d.isNew), [false, false]); // nothing before: nothing is new
  assert.deepEqual(designTable([]), []);
});

test('compareDesigns: where each is better by more than 10 points per 100 rounds, by kind, and the best-of bound', () => {
  const [kernel, ant] = designsAt(score(200));
  const c = compareDesigns(kernel, ant, files, 10, kindOf);
  // per 100 rounds: Kernel 300 300 0 0, Ant 0 60 300 120; the better of each: 300 300 300 120
  assert.equal(c.bound, (300 + 300 + 300 + 120) / 4);
  assert.deepEqual(c.aBetter.map((r) => [r.file, r.kind, r.a, r.b]), [['a.red', 'scanner', 300, 0], ['b.red', 'scanner', 300, 60]]);
  assert.deepEqual(c.bBetter.map((r) => [r.file, r.kind, r.a, r.b]), [['c.red', 'paper', 0, 300], ['d.red', 'stone', 0, 120]]);
  assert.deepEqual([c.aKinds, c.bKinds], [{ scanner: 2 }, { paper: 1, stone: 1 }]);
  // the largest difference first, whatever the order of the files
  const rev = (d) => ({ ...d, best: { ...d.best, points: [...d.best.points].reverse() } });
  assert.deepEqual(compareDesigns(rev(kernel), rev(ant), [...files].reverse(), 10, kindOf).aBetter.map((r) => r.file), ['a.red', 'b.red']);
  assert.deepEqual(compareDesigns(rev(kernel), rev(ant), [...files].reverse(), 10, kindOf).bBetter.map((r) => r.file), ['c.red', 'd.red']);
  // a margin: within it neither is better
  assert.deepEqual(compareDesigns(kernel, ant, files, 10, kindOf, 250).aBetter.map((r) => r.file), ['a.red']);
  assert.equal(compareDesigns(kernel, { ...ant, best: { ...ant.best, points: null } }, files, 10), null);
});
