// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --ladder (#247), a panel that climbs the hill with the list. It starts
// from the weakest third of the pick's candidates, and before every
// --ladder-every-th batch the panel warriors the list has beaten are replaced
// by the next stronger candidates of their kind.
// What the evolver's test files share is in test/evolver-common.js; built
// with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setup, cleanup, tmp, evolve, skip, TINY, run, events, without, stable, checkValues, checkLadder } from './evolver-common.js';

before(() => setup({ base: false })); // no test here reads the base run
after(cleanup);

// a panel of 10 picked by kinds from a sample of 40, a step before every batch
const BASE = [...without(TINY, '--panel-choice'), '--panel-choice', 'kinds', '--pick-sample', '40', '--ladder', '--ladder-every', '1'];

test('--ladder: the panel starts from the weakest third and climbs; a beaten warrior is replaced by the next stronger one of its kind, at most 3 a step; the same on any thread count and after a resume', { skip }, () => {
  const B = 10, args = [...BASE, '--ladder-above', '60'];
  const dir = join(tmp, 'ladder1');
  run(dir, [...args, '--threads', '1', '--batches', String(B)]);
  const evs = events(dir);
  const r = checkLadder(dir, evs, { every: 1, above: 60 });
  assert.equal(r.steps, B - 1); // before every batch but the first
  assert.ok(r.replaced >= 4, `${r.replaced} replaced`);
  // the values after each step that changed the panel, and after every batch: the replay of the matrix agrees
  assert.equal(checkValues(evs), B + evs.filter((e) => e.type === 'ladder' && e.replaced.length).length);
  // a threshold nobody reaches: steps, and no change
  const none = join(tmp, 'ladder-none');
  run(none, [...without(BASE, '--ladder-every'), '--ladder-every', '2', '--ladder-above', '299', '--threads', '4', '--batches', '6']);
  const quiet = checkLadder(none, events(none), { every: 2, above: 299 }); // a step before batches 2 and 4
  assert.deepEqual([quiet.steps, quiet.replaced], [2, 0]);
  assert.ok(!events(none).some((e) => e.type === 'rotate'));
  // the same on other thread counts and after a resume: the ladder comes from the state
  const resumed = join(tmp, 'ladder-resumed');
  run(resumed, [...args, '--threads', '2', '--batches', '5']);
  run(resumed, ['--threads', '4', '--batches', String(B - 5)]);
  assert.deepEqual(stable(events(resumed)), stable(evs));
  assert.deepEqual(readFileSync(join(resumed, 'state.txt'), 'utf8').split('\n').filter((l) => l.startsWith('ladder ')),
    readFileSync(join(dir, 'state.txt'), 'utf8').split('\n').filter((l) => l.startsWith('ladder ')));
});

test('--ladder: what it refuses', { skip }, () => {
  const plain = without(BASE, '--ladder', '--ladder-every');
  const cases = [
    [[...without(plain, '--panel-choice'), '--panel-choice', 'random', '--ladder'], /--ladder with --panel-choice kinds, not with --panel-files/],
    [[...plain, '--ladder', '--panel-files', 'ttb.red,poke01.red'], /--ladder with --panel-choice kinds, not with --panel-files/],
    [[...plain, '--ladder', '--ladder-every', '0'], /--ladder-every 1 or more, --ladder-above more than 0/],
    [[...plain, '--ladder', '--ladder-above', '0'], /--ladder-every 1 or more, --ladder-above more than 0/],
    [[...plain, '--ladder-every', '5'], /--ladder-every and --ladder-above with --ladder/],
    [[...plain, '--ladder-above', '150'], /--ladder-every and --ladder-above with --ladder/],
    [[...without(plain, '--pick-sample'), '--pick-sample', '1000', '--ladder'], /--ladder: .* has 0 warriors outside the sample of \d+, the holdout needs 8/],
    [[...without(plain, '--pick-sample'), '--pick-sample', '1000', '--ladder', '--islands', '2', '--island-panels', 'own'], /--ladder: .* has 0 warriors outside the sample/],
    [[...plain, '--ladder', '--islands', '2'], /--ladder with --islands needs --island-panels own, and does not go with --groups/],
    [[...plain, '--ladder', '--islands', '4', '--island-panels', 'own', '--groups', '2'], /--ladder with --islands needs --island-panels own, and does not go with --groups/],
    [[...plain, '--islands', '2', '--island-panels', 'own', '--island-variant', '', '--island-variant', '--ladder'], /--island-variant '--ladder': --ladder the same for every island/],
  ];
  cases.forEach(([args, message], k) => {
    const d = join(tmp, `ladder-no-${k}`);
    const r = spawnSync(evolve, [d, ...args, '--batches', '1'], { encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 2, `${args.slice(-4).join(' ')}: ${r.stderr}`);
    assert.match(r.stderr, message);
    assert.ok(!existsSync(join(d, 'state.txt')) && !existsSync(join(d, 'islands.txt')), args.slice(-4).join(' '));
  });
});
