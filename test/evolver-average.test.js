// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --average panel. What the evolver's test files share is in
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
import { paretoFronts, pushoffValues, sdDistance, standardError, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { bestRedInfo } from '../tools/progress.js';
import { setup, cleanup, tmp, evolve, skip, TINY, run, events, stable, base, checkValues, checkEarly } from './evolver-common.js';

before(setup);
after(cleanup);

test('--average panel: the push-off average over the panel only; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.average, 'all');
  const BATCHES = 12;
  const args = [...TINY, '--average', 'panel', '--list', '16', '--survivors', '8'];
  run(join(tmp, 'avgp1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'avgp1'));
  assert.equal(one[0].params.average, 'panel');
  // every value and push-off with the average over the panel's columns
  assert.equal(checkValues(one), BATCHES);
  assert.ok(checkValues.panelLeaves >= 2, `the panel average changed who left in ${checkValues.panelLeaves} push-offs`);
  // the logged average is the sixth number, the average against the panel
  for (const e of one.filter((x) => x.type === 'values')) for (const v of e.values) assert.ok(Math.abs(v[1] - v[5]) < 1e-5, `average of ${v[0]}`);
  // an early leave (--stage) is decided on the first-stage results: the
  // average of its entering row against the panel
  run(join(tmp, 'avgp-stage'), [...args, '--panel-rounds', '100', '--stage', '20', '--threads', '2', '--batches', '12']);
  const st = events(join(tmp, 'avgp-stage'));
  assert.equal(checkValues(st), 12);
  const P = new Set(st[0].panel.map((x) => x.id));
  const enters = new Map(st.filter((e) => e.type === 'enter').map((e) => [e.id, e]));
  let early = 0;
  for (const e of st.filter((x) => x.type === 'leave' && x.early)) {
    const row = enters.get(e.id).scores.filter(([o]) => P.has(o)).map(([, w, l, t]) => ((3 * w + t) * 100) / (w + l + t));
    const avg = row.reduce((a, b) => a + b, 0) / row.length;
    assert.ok(Math.abs(avg - e.avg) < 1e-4, `early leave of ${e.id}: ${e.avg}, against the panel ${avg}`);
    early++;
  }
  assert.ok(early >= 3, `${early} early leaves`);
  // and the early rule holds with everyone's average over the panel on the first stage
  const rule = checkEarly(st);
  assert.ok(rule.decisions === early && rule.kept >= 3, `${rule.decisions} early decisions of ${early}, ${rule.kept} completed with a full list`);
  run(join(tmp, 'avgp-resumed'), [...args, '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'avgp-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'avgp-resumed'))), stable(one));
});
