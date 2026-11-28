// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --parsimony (#172), of two warriors with the same results the shorter one
// stays. What the evolver's test files share is in test/evolver-common.js;
// built with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setup, cleanup, root, tmp, skip, TINY, run, events, without, stable, base, checkValues, stateParam } from './evolver-common.js';

before(setup);
after(cleanup);

test('--parsimony: of a newcomer and its twin the longer one leaves, the newcomer when they are as long; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.parsimony, false);
  assert.ok(base.every((e) => e.twin === undefined));
  const BATCHES = 8;
  const args = [...TINY, '--parsimony'];
  run(join(tmp, 'twins1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'twins1'));
  assert.equal(one[0].params.parsimony, true);
  // every push-off replayed, every twin leave by the rule, and no newcomer with a twin that stayed beside it
  assert.equal(checkValues(one), BATCHES);
  const twins = one.filter((e) => e.type === 'leave' && e.twin !== undefined);
  assert.equal(checkValues.twinLeaves, twins.length);
  assert.ok(checkValues.twinChecks > 3 * twins.length, `${checkValues.twinChecks} newcomers checked`);
  assert.ok(twins.length >= 3 && twins.every((e) => e.id > e.twin), 'the newcomers that left as twins');
  assert.equal(stateParam(readFileSync(join(tmp, 'twins1', 'state.txt'), 'latin1'), 'parsimony'), '1');
  run(join(tmp, 'twins-resumed'), [...args, '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'twins-resumed'), ['--threads', '3', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'twins-resumed'))), stable(one));
  // both ways, from start warriors with cells of empty core (DAT.F $0, $0) behind them, which play like those
  // without: a longer twin that entered first leaves for the shorter one, a longer newcomer leaves at once
  const dir = join(tmp, 'padded');
  mkdirSync(dir);
  const pad = (file, n) => readFileSync(join(root, 'warriors', file), 'latin1').replace(/^(\s*end\b)/m, `${'        dat.f $0, $0\n'.repeat(n)}$1`);
  writeFileSync(join(dir, 'a-dwarf-padded.red'), pad('dwarf.red', 3), 'latin1');
  writeFileSync(join(dir, 'b-dwarf.red'), readFileSync(join(root, 'warriors/dwarf.red'), 'latin1'), 'latin1');
  writeFileSync(join(dir, 'c-imp.red'), readFileSync(join(root, 'warriors/imp.red'), 'latin1'), 'latin1');
  writeFileSync(join(dir, 'd-imp-padded.red'), pad('imp.red', 2), 'latin1');
  run(join(tmp, 'twins-start'), [...args, '--start', dir, '--threads', '2', '--batches', '2']);
  const ts = events(join(tmp, 'twins-start'));
  assert.equal(checkValues(ts), 2);
  const starts = ts.filter((e) => e.type === 'enter' && e.ops === 'start');
  const id = (length, name) => starts.find((e) => e.length === length && e.code.includes(name)).id;
  const left = ts.filter((e) => e.type === 'leave' && e.twin !== undefined && e.batch === 0).map((e) => [e.id, e.twin]);
  assert.deepEqual(starts.map((e) => e.length), [7, 4, 1, 3]);
  assert.deepEqual(left, [[id(7, 'ADD'), id(4, 'ADD')], [id(3, 'MOV'), id(1, 'MOV')]]);
  // with a panel of 3 some warriors are twins against the panel and not against the members
  run(join(tmp, 'twins-panel3'), [...without(args, '--panel'), '--panel', '3', '--threads', '2', '--batches', String(BATCHES)]);
  assert.equal(checkValues(events(join(tmp, 'twins-panel3'))), BATCHES);
  assert.ok(checkValues.twinLeaves > 0, `${checkValues.twinLeaves} twins left`);
  // with --stage the twins are told after the rest of the rounds, on the whole results
  run(join(tmp, 'twins-stage'), [...without(args, '--stage'), '--stage', '20', '--threads', '2', '--batches', String(BATCHES)]);
  const st = events(join(tmp, 'twins-stage'));
  assert.equal(checkValues(st), BATCHES);
  assert.ok(checkValues.twinLeaves > 0 && st.some((e) => e.type === 'complete'), `${checkValues.twinLeaves} twins left`);
});
