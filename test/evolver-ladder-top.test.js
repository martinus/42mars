// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --ladder (#247) to the top of the ladder, and with islands that have
// panels of their own (test/evolver-ladder.test.js has the rule itself).
// What the evolver's test files share is in test/evolver-common.js; built
// with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { setup, cleanup, tmp, skip, TINY, run, events, without, stable, checkLadder, rungs } from './evolver-common.js';

before(() => setup({ base: false })); // no test here reads the base run
after(cleanup);

// a panel of 10 picked by kinds from a sample of 40, a step before every batch
const BASE = [...without(TINY, '--panel-choice'), '--panel-choice', 'kinds', '--pick-sample', '40', '--ladder', '--ladder-every', '1'];

test('--ladder to the top: a kind without a stronger candidate takes the strongest one left of any kind, and when none is left nothing changes', { skip }, () => {
  // every panel warrior the list scores a point against counts as beaten: the ladder of about 39 candidates is used up
  const dir = join(tmp, 'ladder-top'), args = [...without(BASE, '--batch'), '--batch', '16', '--ladder-above', '1'];
  run(dir, [...args, '--threads', '4', '--batches', '16']);
  const evs = events(dir);
  const r = checkLadder(dir, evs, { every: 1, above: 1 });
  assert.equal(r.steps, 15);
  assert.ok(r.tops > 0, 'no kind ran out of stronger candidates');
  assert.ok(r.stuck > 0, 'no beaten panel warrior stayed for want of a stronger candidate');
  const steps = evs.filter((e) => e.type === 'ladder');
  assert.ok(steps.at(-1).replaced.length === 0 && steps.at(-1).beaten > 0, 'the last step still replaced one');
  // the panel only got stronger
  for (let k = 1; k < steps.length; k++) assert.ok(steps[k].strength >= steps[k - 1].strength);
});

test('--ladder with --islands and --island-panels own: each island climbs through candidates of its own, the holdout is outside the sample; the same on any thread count and after a resume', { skip }, () => {
  const N = 2, B = 7;
  const args = [...without(BASE, '--batch', '--pick-sample'), '--batch', '16', '--pick-sample', '80', '--ladder-above', '60', '--islands', String(N), '--island-panels', 'own',
    '--migrate', '2', '--stage', '10'];
  const dir = join(tmp, 'ladder-islands');
  run(dir, [...args, '--threads', '1', '--batches', String(B)]);
  const all = Array.from({ length: N }, (_, i) => events(join(dir, `island-0${i + 1}`)));
  const ladders = [];
  let replaced = 0;
  for (let k = 0; k < N; k++) {
    const r = checkLadder(join(dir, `island-0${k + 1}`), all[k], { every: 1, above: 60 });
    assert.equal(r.steps, B - 1, `island ${k + 1}`);
    replaced += r.replaced;
    ladders.push(rungs(join(dir, `island-0${k + 1}`)).map((g) => g.file));
    // one holdout for all
    assert.deepEqual(all[k][0].holdout.map((h) => h.file), all[0][0].holdout.map((h) => h.file));
    // --stage: a member that is in between batches played the new panel warrior its whole match, the first stage apart
    for (const e of all[k].filter((x) => x.type === 'rotate')) assert.equal(e.scores1.length, e.scores.length);
  }
  assert.ok(replaced >= N, `${replaced} replaced on ${N} islands`);
  // a random half of the sample each: 40 of the 80 less those that die at once, and not the same ones
  for (const l of ladders) assert.ok(l.length > 30 && l.length <= 40, `${l.length} candidates`);
  assert.notDeepEqual(ladders[0], ladders[1]);
  const resumed = join(tmp, 'ladder-islands-resumed');
  run(resumed, [...args, '--threads', '2', '--batches', '4']);
  run(resumed, ['--threads', '4', '--batches', String(B - 4)]);
  for (let k = 0; k < N; k++) assert.deepEqual(stable(events(join(resumed, `island-0${k + 1}`))), stable(all[k]), `island ${k + 1}, resumed on other threads`);
});
