// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --parents yield (#248), parents by what their children did. Every member
// counts its evaluated children and those that were a success (still in the
// list after their batch and no twin of it), and the tournament of two is
// decided by a draw from Beta(1 + successes, 1 + failures) for each.
// What the evolver's test files share is in test/evolver-common.js; built
// with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setup, cleanup, tmp, evolve, skip, TINY, run, events, without, stable, checkValues } from './evolver-common.js';

before(() => setup({ base: false })); // no test here reads the base run
after(cleanup);

// The counts of a run replayed from its events: the successes of every parents event, the counts the state has
// at the end, and the children per batch that members with a poor record and new members got as first parent.
// Returns { children, successes, twins (stayed, and no success), halvings, poor: [batches, children], fresh: [...] }.
// The children counted are all that a member's tournaments bred (the second number of a row of the parents
// event), not only those past the screen: those would favour the parents whose children pass.
function checkYield(dir, evs, half) {
  const start = evs[0];
  assert.deepEqual([start.params.parents, start.params.yieldHalf], ['yield', half]);
  const panel = new Set(start.panel.map((p) => p.id));
  const first = new Map(); // id -> its results against the panel when it entered: the first stage with --stage
  const alive = new Set(), counts = new Map(); // id -> [children evaluated, successes]
  const out = { children: 0, successes: 0, twins: 0, halvings: 0, poor: [0, 0], fresh: [0, 0] };
  let born = [], left = new Set(), batchStart = new Map(), aliveStart = new Set();
  for (const e of evs) {
    if (e.type === 'enter') {
      first.set(e.id, e.scores.filter((x) => panel.has(x[0])).map((x) => x.slice(0, 4).join(',')).join(' '));
      alive.add(e.id);
      born.push(e);
    }
    if (e.type === 'leave') alive.delete(e.id), left.add(e.id);
    if (e.type === 'parents') {
      // a poor record: 6 children or more and no success (a mean of 1/8 or less); new: no children yet
      const bred = new Map(e.parents.map((row) => [row[0], row[1]]));
      for (const id of aliveStart) {
        const [n, s] = batchStart.get(id) ?? [0, 0], k = n >= 6 && s === 0 ? 'poor' : n === 0 ? 'fresh' : null;
        if (k) out[k][0]++, out[k][1] += bred.get(id) ?? 0;
      }
      for (const row of e.parents) {
        assert.equal(row.length, 6, 'a parents row with the successes');
        const [pid, , evaluated, past, stayed, ok] = row;
        const kids = born.filter((x) => x.parents[0] === pid && x.ops !== 'reintroduce');
        assert.equal(kids.length, past, `batch ${e.batch}: the children of ${pid} past the screen`);
        const staying = kids.filter((x) => !left.has(x.id));
        assert.equal(staying.length, stayed);
        const good = staying.filter((x) => !alive.has(pid) || first.get(x.id) !== first.get(pid));
        assert.equal(ok, good.length, `batch ${e.batch}: the successes of ${pid}`);
        out.children += evaluated, out.successes += ok, out.twins += stayed - ok;
        if (alive.has(pid)) {
          const c = counts.get(pid) ?? [0, 0];
          counts.set(pid, [c[0] + evaluated, c[1] + ok]);
        }
      }
    }
    if (e.type === 'batch') { // the end of a batch: the halving, then the next batch draws from these counts
      if (half && (e.batch + 1) % half === 0) {
        for (const [id, [n, s]] of counts) counts.set(id, [Math.floor(n / 2), Math.floor(s / 2)]);
        out.halvings++;
      }
      born = [], left = new Set();
      batchStart = new Map(counts);
      aliveStart = new Set(alive);
    }
  }
  // the state: a yield line after the member line of every member with children
  const state = new Map();
  let last = null;
  for (const l of readFileSync(join(dir, 'state.txt'), 'utf8').split('\n')) {
    if (l.startsWith('member ')) last = Number(l.split(' ')[1]);
    if (l.startsWith('yield ')) state.set(last, l.split(' ').slice(1).map(Number));
  }
  const want = new Map([...counts].filter(([id, [n]]) => alive.has(id) && n > 0));
  assert.deepEqual([...state].sort((a, b) => a[0] - b[0]), [...want].sort((a, b) => a[0] - b[0]), 'the counts of the state');
  return out;
}

test('--parents yield: a success is a child that stays and is no twin of its parent; the counts are halved, kept in the state, and decide the tournament; the same on any thread count and after a resume', { skip }, () => {
  const B = 16, args = [...without(TINY, '--stage'), '--stage', '10', '--parents', 'yield', '--yield-half', '4'];
  const dir = join(tmp, 'yield1');
  run(dir, [...args, '--threads', '1', '--batches', String(B)]);
  const evs = events(dir);
  const r = checkYield(dir, evs, 4);
  assert.equal(r.halvings, 4);
  assert.ok(r.children > 100 && r.successes > 10, JSON.stringify(r));
  assert.ok(r.twins > 0, 'no child stayed as a twin of its parent');
  // a member whose children keep failing gets far fewer children than a new one: per batch 0.67 against 2.80
  // (0.24 of it) on this seed; with the draws ignored 0.54 of it, with --parents value 0.51
  assert.ok(r.poor[0] >= 20 && r.fresh[0] >= 20, JSON.stringify(r));
  assert.ok(r.poor[1] / r.poor[0] <= 0.35 * (r.fresh[1] / r.fresh[0]), JSON.stringify(r));
  assert.equal(checkValues(evs), B);
  const resumed = join(tmp, 'yield-resumed');
  run(resumed, [...args, '--threads', '2', '--batches', '6']); // between two halvings: the counts come from the state
  run(resumed, ['--threads', '4', '--batches', String(B - 6)]);
  assert.deepEqual(stable(events(resumed)), stable(evs));
});

test('--parents yield without --stage: twins by the whole matches; --yield-half 0 never halves', { skip }, () => {
  const dir = join(tmp, 'yield-whole');
  run(dir, [...TINY, '--parents', 'yield', '--yield-half', '0', '--threads', '4', '--batches', '8']);
  const r = checkYield(dir, events(dir), 0);
  assert.equal(r.halvings, 0);
  assert.ok(r.successes > 5, JSON.stringify(r));
});

test('--yield-half without --parents yield is refused', { skip }, () => {
  const d = join(tmp, 'yield-no');
  const r = spawnSync(evolve, [d, ...TINY, '--yield-half', '10', '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /--yield-half with --parents yield/);
  assert.ok(!existsSync(join(d, 'state.txt')));
});
