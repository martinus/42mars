// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// the defaults of a new run and of islands, in a file of their own, so that the files take about as
// long (#161); those before generators are in evolver-panel.test.js. What the evolver's
// test files share is in test/evolver-common.js; built with cc, or prebuilt in M42_BIN (test/native.js).
// POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { paretoFronts, pushoffValues, sdDistance, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { bestRedInfo } from '../tools/progress.js';
import { setup, cleanup, root, tmp, evolve, unit, spectrum, skip, RULES, TINY, run, events, without, stable, base, checkValues, checkOrder, checkOps, checkEarly, mirrored, CLASSIC, RULES_CLASSIC, classic } from './evolver-common.js';

before(() => setup({ base: false })); // no test here reads the base run
after(cleanup);


// the rules of the tiny hill without the settings of TINY
const rules = TINY.slice(0, TINY.indexOf('--panel'));

test('the defaults of a new run: the settings of gen-var16-rnd, generators, a panel of 30 by kinds, batches of 128', { skip }, () => {
  // a new run: generators, a panel of 30 by kinds, batches of 128 (docs/evolver-gen.md); a sample of 60
  // for the pick, not the 300 of the default: its round robin was 100 of the 120 s of this test (#161)
  run(join(tmp, 'def-new'), [...rules, '--seed', '5', '--pick-sample', '60', '--threads', '4', '--batches', '1']);
  const fresh = events(join(tmp, 'def-new'))[0];
  const q = fresh.params;
  assert.deepEqual([q.genome, q.panel, q.panelChoice, q.batch, q.survivors, fresh.panel.length], ['gen', 30, 'kinds', 128, 16, 30]);
});

test('the defaults of islands: half exploit, half explore, every 5 batches a member drawn from an island drawn', { skip }, () => {
  // islands: half exploit, half explore, every 5 batches a member drawn from an island drawn; --migrate 0 none
  run(join(tmp, 'def-isl'), [...rules, '--seed', '5', '--panel-choice', 'random', '--batch', '16', '--islands', '2', '--threads', '4', '--batches', '1']);
  const isl = events(join(tmp, 'def-isl'), 'islands.jsonl')[0];
  assert.deepEqual([isl.migrate, isl.migratePick, isl.migrateTo, isl.variants], [5, 'random', 'random', ['', '--screen-members 80 --screen-rounds 8']]);
  assert.deepEqual([1, 2].map((i) => events(join(tmp, 'def-isl', `island-0${i}`))[0].params.screenMembers), [10, 80]);
  run(join(tmp, 'def-isl0'), [...rules, '--seed', '5', '--panel-choice', 'random', '--batch', '16', '--islands', '2', '--migrate', '0', '--threads', '4', '--batches', '1']);
  assert.equal(events(join(tmp, 'def-isl0'), 'islands.jsonl')[0].migrate, 0);
});
