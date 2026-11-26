// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// the defaults from before generators, a panel picked from a round robin,
// split from evolver-panel.test.js so that CI runs them at the same time
// (#161). What the evolver's test files share is in test/evolver-common.js;
// built with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

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

test('the defaults before generators: a panel picked from a round robin, the pareto-sd push-off, --screen-stop 3; the same on any thread count', { skip }, () => {
  // the defaults before them, with a panel picked from a round robin
  const args = [...rules, '--seed', '5', '--panel-choice', 'picked', '--panel', '20', '--pick-sample', '40', '--batch', '16', '--batches', '1'];
  run(join(tmp, 'def4'), [...args, '--threads', '4']);
  const one = events(join(tmp, 'def4'));
  const p = one[0].params;
  assert.deepEqual([p.list, p.panel, p.screenMembers, p.diversity, p.panelRounds, p.fill, p.stage, p.panelChoice, p.positions, p.pushoff, p.screenStop, p.screenCheck], [80, 20, 10, 'panel', 500, true, p.screenRounds, 'picked', 'mirror', 'pareto-sd', 3, 0]);
  const pick = one[1];
  assert.equal(pick.type, 'pick');
  assert.equal(pick.sample, 40);
  assert.equal(pick.picked.length, 20);
  assert.deepEqual(one[0].panel.map((w) => w.file), pick.picked.map((x) => x.file), 'the panel is the picked, in the order picked');
  assert.equal(new Set(pick.picked.map((x) => x.file)).size, 20);
  // the strongest first; all from the strongest quarter, at least as many as the panel (20 of the 40); each the farthest from the ones before it
  assert.equal(pick.picked[0].rank, 0);
  assert.ok(pick.picked.every((x) => x.rank < Math.max(Math.ceil(40 / 4), 20) && x.avg <= pick.picked[0].avg + 1e-9), JSON.stringify(pick.picked.map((x) => x.rank)));
  assert.equal(pick.picked[0].distance, 0);
  for (let i = 2; i < 20; i++) assert.ok(pick.picked[i].distance <= pick.picked[i - 1].distance + 1e-9, `pick ${i} is farther than the one before`);
  assert.ok(!one[0].holdout.some((h) => pick.picked.some((x) => x.file === h.file)), 'a picked warrior in the holdout');
  run(join(tmp, 'def1'), [...args, '--threads', '1']);
  assert.deepEqual(stable(events(join(tmp, 'def1'))), stable(one));
  // the value push-off where pareto does not go; these runs check a default each, without a pick (#161)
  const quick = [...without(args, '--panel-choice', '--pick-sample'), '--panel-choice', 'random'];
  run(join(tmp, 'def-avg'), [...quick, '--average', 'panel', '--threads', '4']);
  assert.equal(events(join(tmp, 'def-avg'))[0].params.pushoff, 'value');
  // --screen-stop 3 by default; 0 is off, also for a run that continues
  for (const [extra, stop] of [[['--screen-stop', '0'], 0], [['--screen-stop', '1.5'], 1.5], [['--screen-check', '2'], 0]]) {
    const d = join(tmp, `def-stop-${extra.join('')}`);
    run(d, [...quick, ...extra, '--threads', '2']);
    assert.equal(events(d)[0].params.screenStop, stop, extra.join(' '));
  }
  run(join(tmp, 'def4'), ['--screen-stop', '0', '--threads', '2', '--batches', '2']);
  const off = events(join(tmp, 'def4')).find((e) => e.type === 'screen-options');
  assert.deepEqual([off.batch, off.screenStop, off.screenCheck], [1, 0, 0]);
});
