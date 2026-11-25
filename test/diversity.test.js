// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// tools/diversity.js, the diversity push-off of Tournament Weekend 2026, and
// tools/pushoff.mjs on a tournament of the warriors in warriors/.

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paretoFronts, pushoff, pushoffValues, sdDistance, weakest } from '../tools/diversity.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'diversity-test-'));
after(() => rmSync(dir, { recursive: true, force: true }));

// Expected values computed by hand with the formulas of the paper (Python).
const S = [
  [null, 10, 20, 30],
  [5, null, 25, 35],
  [0, 15, null, 40],
  [1, 2, 3, null],
];

test('SD-score, each column by its own standard deviation (pseudocode)', () => {
  assert.ok(Math.abs(sdDistance(S, [0, 1, 2, 3], 0, 1) - 1.7557391154451805) < 1e-12);
  assert.ok(Math.abs(sdDistance(S, [0, 1, 2, 3], 2, 3) - 2.890943994708568) < 1e-12);
  assert.equal(sdDistance(S, [0, 1, 2, 3], 1, 0), sdDistance(S, [0, 1, 2, 3], 0, 1));
});

test('SD-score, sum of differences over sum of standard deviations (Eq. 6)', () => {
  assert.ok(Math.abs(sdDistance(S, [0, 1, 2, 3], 0, 1, 'sum') - 0.7408076421173693) < 1e-12);
  assert.ok(Math.abs(sdDistance(S, [0, 1, 2, 3], 2, 3, 'sum') - 1.8630962205724457) < 1e-12);
});

test('--diversity panel: only the columns given count', () => {
  // 0 and 1 against column 2 only: |20 - 25| over the sigma of 20, 25, 3
  // (rows 0, 1, 3), 9.4162... ; against column 3 only: |30 - 35| over the
  // sigma of 30, 35, 40; together the whole SD-score of the first test
  const all = [0, 1, 2, 3];
  assert.ok(Math.abs(sdDistance(S, all, 0, 1, 'opponent', [false, false, true, false]) - 0.5309942440535915) < 1e-12);
  assert.ok(Math.abs(sdDistance(S, all, 0, 1, 'opponent', [false, false, false, true]) - 1.224744871391589) < 1e-12);
  // the average stays over all columns
  const v = pushoffValues(S, all, { columns: [false, false, true, true] });
  assert.deepEqual(v.map((x) => x.avg), pushoffValues(S, all).map((x) => x.avg));
});

test('--pushoff pareto: fronts and crowding of NSGA-II, a copy the most crowded (evolver-test.c has the same)', () => {
  // 0, 1 and 2 are not dominated, 3 is (by 0), 4 is a copy of 0. Crowding
  // of 0: by the first objective 2, 0, 4, 1 gives (1 - 0) / 2, by the second
  // 1, 0, 4, 2 gives (1 - 0) / 2; the copy 0
  const r = paretoFronts([[1, 1], [2, 0], [0, 2], [0.5, 0.5], [1, 1]]);
  assert.deepEqual(r.front, [0, 0, 0, 1, 0]);
  assert.deepEqual(r.crowd, [1, Infinity, Infinity, Infinity, 0]);
  // three objectives, one front of five on a line: the inner ones by their two gaps over the range 4, three times
  const l = paretoFronts([[0, 4, 0], [1, 3, 1], [2, 2, 2], [3, 1, 3], [4, 0, 4]]);
  assert.deepEqual(l.front, [0, 0, 0, 0, 0]);
  assert.deepEqual(l.crowd, [Infinity, 1.5, 1.5, 1.5, Infinity]);
});

test('a column where everyone scores the same adds nothing', () => {
  const T = [
    [null, 7, 1],
    [7, null, 2],
    [7, 7, null],
  ];
  // column 0 for the pair (1, 2): both 7, sigma 0
  assert.equal(sdDistance(T, [0, 1, 2], 1, 2), 0);
  assert.equal(sdDistance(T, [0, 1, 2], 1, 2, 'sum'), 0);
});

test('a clone of the strongest warrior leaves first', () => {
  // 0 and 1 have the same row; both beat everyone else.
  const C = [
    [null, 100, 250, 260, 240],
    [100, null, 250, 260, 240],
    [10, 10, null, 150, 90],
    [5, 5, 140, null, 160],
    [20, 20, 80, 170, null],
  ];
  const v = pushoffValues(C, [0, 1, 2, 3, 4]);
  assert.equal(v[0].distance, 0);
  assert.equal(v[1].distance, 0);
  assert.equal(weakest(v), 1); // equal values and averages: the higher index
  assert.equal(weakest(v, new Set([1])), 0);
  const order = pushoff(C).map((x) => x.index);
  assert.equal(order[0], 1);
  assert.equal(order.at(-1), 0); // with its clone gone, the strongest wins
});

test('alpha 0 is a push-off by average score alone', () => {
  const order = pushoff(S, { alpha: 0 }).map((x) => x.index);
  // averages over the warriors still in: 3 has 2.0; then 2 has 7.5 against
  // 15 and 15; then 1 has 5 against 10
  assert.deepEqual(order, [3, 2, 1, 0]);
});

test('tools/pushoff.mjs ranks a tournament of warriors/', () => {
  const t = join(dir, 't.json');
  execFileSync(process.execPath, [join(root, 'tools/tournament.mjs'), join(root, 'warriors'), '--rounds', '20', '--jobs', '2', '--json', t], { stdio: 'ignore' });
  const out = join(dir, 'p.json');
  execFileSync(process.execPath, [join(root, 'tools/pushoff.mjs'), t, '--json', out], { stdio: 'ignore' });
  const tournament = JSON.parse(readFileSync(t, 'utf8'));
  const { ranking } = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(ranking.map((r) => r.name).sort(), [...tournament.names].sort());
  assert.deepEqual(ranking.map((r) => r.rank), ranking.map((_, i) => i + 1));
  // the same order as the module on the scores per 100 rounds
  const score = tournament.matrix.map((row) => row.map((v) => (v === null ? null : v * 5)));
  assert.deepEqual(ranking.map((r) => r.name), pushoff(score).reverse().map((x) => tournament.names[x.index]));
  const bad = (args) => {
    try {
      execFileSync(process.execPath, [join(root, 'tools/pushoff.mjs'), ...args], { stdio: 'pipe' });
    } catch (e) {
      return e.status;
    }
    return 0;
  };
  assert.equal(bad([t, '--sd', 'euclid']), 2);
  assert.equal(bad([]), 2);
});
