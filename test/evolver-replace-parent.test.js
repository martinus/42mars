// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --replace-parent, a newcomer whose nearest warrior is its first parent
// duels it, and the one with the lower average against the panel leaves.
// checkValues (test/evolver-common.js) replays every duel and every
// newcomer that did not duel from the logged scores. What the evolver's test
// files share is in test/evolver-common.js; built with cc, or prebuilt in
// M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setup, cleanup, tmp, skip, TINY, run, events, without, stable, base, checkValues, checkOps } from './evolver-common.js';

before(setup);
after(cleanup);

// the duels of a run, checked by the replay: at least `least` of them, the child and the parent both winning some
function checkDuels(evs, least) {
  checkValues(evs);
  const { parentDuels, childWon, duelChecks, duelUnsure } = checkValues;
  assert.ok(parentDuels >= least, `${parentDuels} duels`);
  assert.ok(childWon > 0 && childWon < parentDuels, `the child won ${childWon} of ${parentDuels} duels`);
  console.log(`duels ${parentDuels}, the child won ${childWon}, checked without a duel ${duelChecks}, unsure ${duelUnsure}`);
  assert.ok(duelChecks > 0, `${duelChecks} newcomers checked to have another nearest, ${duelUnsure} too close to call`);
  return parentDuels;
}

test('--replace-parent: a newcomer nearest to its first parent duels it by the average against the panel; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.replaceParent, false);
  assert.ok(base.every((e) => e.duel === undefined));
  const B = 10;
  const args = [...TINY, '--replace-parent'];
  run(join(tmp, 'duel1'), [...args, '--threads', '1', '--batches', String(B)]);
  const one = events(join(tmp, 'duel1'));
  assert.equal(one[0].params.replaceParent, true);
  assert.match(readFileSync(join(tmp, 'duel1', 'state.txt'), 'latin1'), /^params .* 0 1 0$/m); // --survivors-by, this, then --events
  checkDuels(one, 10);
  checkOps(one);
  run(join(tmp, 'duel-resumed'), [...args, '--threads', '2', '--batches', String(B >> 1)]);
  run(join(tmp, 'duel-resumed'), ['--threads', '3', '--batches', String(B - (B >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'duel-resumed'))), stable(one));
  // without it the same children enter otherwise
  run(join(tmp, 'duel-off'), [...TINY, '--threads', '2', '--batches', String(B)]);
  const leaves = (evs) => evs.filter((e) => e.type === 'leave').map((e) => e.id);
  assert.notDeepEqual(leaves(events(join(tmp, 'duel-off'))), leaves(one));
});

test('--replace-parent with --stage, --parsimony, the pareto-sd push-off and --survivors-by pushoff: the duel on the whole results, before the twins', { skip }, () => {
  const args = [...without(TINY, '--pushoff', '--screen-members', '--diversity', '--stage', '--list'), '--list', '8', '--pushoff', 'pareto-sd', '--screen-members', '5',
    '--diversity', 'panel', '--stage', '20', '--survivors-by', 'pushoff', '--parsimony', '--replace-parent', '--threads', '2', '--batches', '10'];
  run(join(tmp, 'duel-all'), args);
  const evs = events(join(tmp, 'duel-all'));
  checkDuels(evs, 10);
  assert.ok(checkValues.twinChecks > 0, 'no newcomer checked for twins');
  // an early leave of --stage is no duel: the duel needs the whole results
  assert.ok(evs.some((e) => e.type === 'leave' && e.early), 'no early leave');
  assert.ok(evs.every((e) => !(e.early && e.duel !== undefined)));
});
