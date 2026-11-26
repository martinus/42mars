// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --island-variant, split from evolver-tune.test.js so that CI runs them at
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


test('--island-variant: islands with their own settings, each the run alone with them; the same on any thread count and after a resume', { skip }, () => {
  // a picked panel: picked once, every island has it
  const args = [...without(TINY, '--panel-choice'), '--panel-choice', 'picked', '--pick-sample', '40', '--list', '16', '--survivors', '8'];
  const variant = '--screen-rounds 5  --list 12 --tie-points 0.5';
  const isl = ['--islands', '3', '--island-variant', '', '--island-variant', variant, '--migrate', '0'];
  const dir = join(tmp, 'var');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', '6']);
  const re = events(dir, 'islands.jsonl');
  assert.deepEqual(re[0].variants, ['', variant]);
  const all = [1, 2, 3].map((i) => events(join(dir, `island-0${i}`)));
  // islands 1 and 3 have the settings of the command line, island 2 those and the variant's
  const params = all.map((ev) => ev[0].params);
  assert.deepEqual([params[0].screenRounds, params[0].list, params[0].tiePoints], [10, 16, 1]);
  assert.deepEqual([params[1].screenRounds, params[1].list, params[1].tiePoints], [5, 12, 0.5]);
  assert.deepEqual({ ...params[2], seed: 0 }, { ...params[0], seed: 0 });
  assert.deepEqual(params.map((x) => x.seed), [7, 8, 9]);
  // island 2 is the run alone with the variant, the panel and holdout of the islands
  const panel = all[0][0].panel.map((w) => w.file).join(',');
  run(join(tmp, 'var-alone'), [...args, ...variant.split(/\s+/), '--seed', '8', '--draw-seed', '7', '--panel-files', panel, '--threads', '3', '--batches', '6']);
  const alone = events(join(tmp, 'var-alone'));
  assert.deepEqual(stable(all[1]).slice(1), stable(alone).slice(1));
  assert.deepEqual(all[1][0].panel, alone[0].panel);
  for (const ev of all) assert.deepEqual(ev[0].panel.map((w) => w.file), re[0].panel.split(','));
  // the same stopped and continued on other thread counts
  const again = join(tmp, 'var-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '2']);
  run(again, ['--threads', '1', '--batches', '4']);
  [1, 2, 3].forEach((i) => assert.deepEqual(stable(events(join(again, `island-0${i}`))), stable(all[i - 1]), `island ${i}`));
  // with --migrate: migrants between islands of other settings
  run(join(tmp, 'var-mig'), [...args, ...isl, '--migrate', '2', '--threads', '2', '--batches', '3']);
  assert.ok(events(join(tmp, 'var-mig', 'island-02')).some((e) => e.type === 'migrate'));
  // what must be alike, the options of the islands, more variants than islands, a word that is no option: refused
  const refused = [
    [['--island-variant', '--size 400'], /--island-variant '--size 400': --size, --cycles, --processes, --length or --distance the same for every island/],
    [['--island-variant', '--panel 12'], /--panel, --holdout, --panel-choice, --pick-sample or --panel-files the same/],
    [['--island-variant', '--genome gen'], /--genome the same/],
    [['--island-variant', '--seed 3'], /--seed or --draw-seed the same/],
    [['--island-variant', '--migrate 2'], /an option of the islands the same/],
    [['--island-variant', '--batches 9'], /--batches, --seconds/],
    [['--island-variant', '--screen-rounds 50'], /--screen-rounds at most --rounds/],
    [['--island-variant', '', '--island-variant', '', '--island-variant', '', '--island-variant', ''], /at most once per island/],
    [['--island-variant', 'elsewhere'], /usage/],
  ];
  refuses(join(tmp, 'var-no'), [...args, '--islands', '3'], refused);
  // a variant without --islands
  assert.equal(spawnSync(evolve, [join(tmp, 'var-no'), ...args, '--island-variant', '--list 12', '--batches', '1'], { encoding: 'utf8', timeout: 60000 }).status, 2);
});
