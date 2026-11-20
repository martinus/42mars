// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --difference ahead and shape, out of evolver-pareto.test.js so that the files take about as long (#161).
// What the evolver's test files share is in test/evolver-common.js; built with cc, or prebuilt in M42_BIN
// (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { paretoFronts, pushoffValues, sdDistance, standardError, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { bestRedInfo } from '../tools/progress.js';
import { setup, cleanup, tmp, evolve, skip, TINY, run, events, without, stable, base, checkValues, checkEarly } from './evolver-common.js';

before(setup);
after(cleanup);

test('--difference ahead: the SD-score only where a warrior scores more; from the start, and from a resume on', { skip }, () => {
  assert.equal(base[0].params.difference, 'abs');
  const BATCHES = 12;
  const args = [...TINY, '--difference', 'ahead', '--list', '16', '--survivors', '8'];
  run(join(tmp, 'ahead1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'ahead1'));
  assert.equal(one[0].params.difference, 'ahead');
  // every value, estimate and push-off with the one-sided SD-score
  assert.equal(checkValues(one), BATCHES);
  assert.ok(checkValues.differenceLeaves >= 2, `ahead changed who left in ${checkValues.differenceLeaves} push-offs`);
  run(join(tmp, 'ahead3'), [...args, '--threads', '3', '--batches', String(BATCHES)]);
  assert.deepEqual(stable(events(join(tmp, 'ahead3'))), stable(one));
  // a run that continues with it: the run so far is the one without, then
  // an event and the values of the list with it, and the state keeps it
  const sw = join(tmp, 'ahead-switch');
  run(sw, [...TINY, '--threads', '2', '--batches', '6']);
  run(sw, ['--threads', '2', '--batches', '6', '--difference', 'ahead']);
  run(sw, ['--threads', '2', '--batches', '2']);
  const evs = events(sw);
  assert.deepEqual(stable(evs).slice(0, stable(base).length), stable(base));
  const k = evs.findIndex((e) => e.type === 'difference');
  assert.deepEqual([evs[k].difference, evs[k].batch, evs[k + 1].type], ['ahead', 6, 'values']);
  assert.equal(evs.filter((e) => e.type === 'difference').length, 1);
  assert.equal(checkValues(evs), 6 + 1 + 6 + 2);
  assert.ok(checkValues.differenceLeaves >= 1, `ahead changed who left in ${checkValues.differenceLeaves} push-offs`);
  // refused with --simple (--diversity panel, which --simple needs), and a value other than abs and ahead
  for (const [bad, why] of [[['--simple', '--diversity', 'panel'], /--difference ahead not with --simple/], [['--difference', 'sideways'], /usage/]]) {
    const r = spawnSync(evolve, [join(tmp, 'ahead-bad'), ...args, ...bad, '--batches', '1'], { encoding: 'utf8' });
    assert.equal(r.status, 2, bad.join(' '));
    assert.match(r.stderr, why);
  }
});

test('--difference shape: the SD-score less the shift that makes it smallest; with value and pareto-sd, also from a resume on', { skip }, () => {
  const BATCHES = 12;
  const args = [...TINY, '--difference', 'shape', '--list', '16', '--survivors', '8'];
  run(join(tmp, 'shape1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'shape1'));
  assert.equal(one[0].params.difference, 'shape');
  // every value, estimate and push-off with the shifted SD-score (tools/diversity.js)
  assert.equal(checkValues(one), BATCHES);
  assert.ok(checkValues.differenceLeaves >= 1, `shape changed who left in ${checkValues.differenceLeaves} push-offs`);
  run(join(tmp, 'shape3'), [...args, '--threads', '3', '--batches', String(BATCHES)]);
  assert.deepEqual(stable(events(join(tmp, 'shape3'))), stable(one));
  // pareto-sd takes it as its third objective
  const sd = join(tmp, 'shape-sd');
  run(sd, [...without(args, '--pushoff'), '--pushoff', 'pareto-sd', '--threads', '2', '--batches', '6']);
  const sde = events(sd);
  assert.deepEqual([sde[0].params.pushoff, sde[0].params.difference], ['pareto-sd', 'shape']);
  assert.equal(checkValues(sde), 6);
  // a run that continues with it, and keeps it
  run(sd, ['--threads', '2', '--batches', '2']);
  const sw = join(tmp, 'shape-switch');
  run(sw, [...TINY, '--threads', '2', '--batches', '6']);
  run(sw, ['--threads', '2', '--batches', '6', '--difference', 'shape']);
  run(sw, ['--threads', '2', '--batches', '2']);
  const evs = events(sw);
  assert.deepEqual(stable(evs).slice(0, stable(base).length), stable(base));
  const k = evs.findIndex((e) => e.type === 'difference');
  assert.deepEqual([evs[k].difference, evs[k].batch, evs[k + 1].type], ['shape', 6, 'values']);
  assert.equal(checkValues(evs), 6 + 1 + 6 + 2);
  for (const [bad, why] of [[['--simple', '--diversity', 'panel'], /--difference shape not with --simple/], [['--pushoff', 'pareto'], /--difference shape with --pushoff pareto-sd only/]]) {
    const r = spawnSync(evolve, [join(tmp, 'shape-bad'), ...without(args, '--pushoff'), ...bad, '--batches', '1'], { encoding: 'utf8' });
    assert.equal(r.status, 2, bad.join(' '));
    assert.match(r.stderr, why);
  }
});
