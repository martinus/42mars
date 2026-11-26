// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --explorers, split from evolver-migrate.test.js so that CI runs them at
// the same time (#161). What the evolver's test files share is in
// test/evolver-common.js; built with cc, or prebuilt in M42_BIN
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
import { paretoFronts, pushoffValues, sdDistance, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { bestRedInfo } from '../tools/progress.js';
import { setup, cleanup, root, tmp, evolve, skip, RULES, TINY, run, events, without, stable, checkValues } from './evolver-common.js';

// Each [extra, message] of cases is refused: exit code 2, the message on stderr, no folder made.
function refuses(dir, base, cases) {
  for (const [extra, message] of cases) {
    const r = spawnSync(evolve, [dir, ...base, ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, extra.join(' '));
    assert.match(r.stderr, message, extra.join(' '));
  }
  assert.ok(!existsSync(dir));
}

before(() => setup({ base: false })); // no test here reads the base run
after(cleanup);


test('--explorers: the last K islands take no migrants, the others take from all of them; the same on any thread count and after a resume', { skip }, () => {
  const args = [...TINY, '--list', '16', '--survivors', '8'];
  const isl = ['--islands', '5', '--explorers', '3', '--migrate', '1', '--island-variant', ''];
  const dir = join(tmp, 'explorers');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', '9']);
  assert.equal(events(dir, 'islands.jsonl')[0].explorers, 3);
  const all = [1, 2, 3, 4, 5].map((i) => events(join(dir, `island-0${i}`)));
  const from = all.map((ev) => ev.filter((e) => e.type === 'migrate'));
  for (const k of [2, 3, 4]) assert.equal(from[k].length, 0, `island ${k + 1} is an explorer`);
  // the core (islands 1 and 2) takes a member every batch, from an island drawn among all others, explorers too
  for (const k of [0, 1]) {
    assert.deepEqual(from[k].map((e) => e.batch), [1, 2, 3, 4, 5, 6, 7, 8], `island ${k + 1}`);
    const sources = new Set(from[k].flatMap((e) => e.from.map((f) => f[0])));
    assert.ok([3, 4, 5].some((j) => sources.has(j)), `island ${k + 1} took from ${[...sources]}`);
    assert.ok(!sources.has(k + 1));
  }
  // an explorer is the run alone: no warrior of another island ever enters it
  for (const k of [2, 3, 4]) assert.ok(!all[k].some((e) => e.type === 'enter' && e.ops === 'migrant'), `island ${k + 1}`);
  // the same stopped and continued on other thread counts
  const again = join(tmp, 'explorers-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '4']);
  run(again, ['--threads', '1', '--batches', '5']);
  all.forEach((ev, k) => assert.deepEqual(stable(events(join(again, `island-0${k + 1}`))), stable(ev), `island ${k + 1}`));
  // no core, no migration, --keep, in a variant, without --islands: refused
  const refused = [
    [['--islands', '3', '--explorers', '3'], /--explorers fewer than the islands/],
    [['--islands', '3', '--explorers', '1', '--migrate', '0'], /needs migration \(not with --migrate 0\)/],
    [['--islands', '3', '--explorers', '1', '--select-after', '2', '--keep', '2'], /--explorers fewer than the islands, not with --keep/],
    [['--islands', '3', '--island-variant', '--explorers 1'], /an option of the islands the same/],
    [['--explorers', '1'], /usage/],
  ];
  refuses(join(tmp, 'explorers-no'), args, refused);
});
