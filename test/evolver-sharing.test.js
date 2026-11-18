// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --sharing, --average panel. What the evolver's test files share is in
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

test('--sharing 20: the average weighted by how hard each panel warrior is for the members; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.sharing, 0);
  const BATCHES = 10;
  const args = [...TINY, '--sharing', '20', '--list', '16', '--panel-rounds', '100', '--survivors', '8'];
  run(join(tmp, 'share1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'share1'));
  assert.equal(one[0].params.sharing, 20);
  // every weight from the members' means, every push-off and value with them
  assert.equal(checkValues(one), BATCHES);
  assert.equal(checkValues.sharings, BATCHES);
  assert.ok(checkValues.sharedLeaves >= 2, `the weights changed who left in ${checkValues.sharedLeaves} push-offs`);
  // an early leave (--stage) is decided on the first-stage results, weighted
  // the same: the leaver's average is its entering row with the weights
  run(join(tmp, 'share-stage'), [...args, '--stage', '20', '--threads', '2', '--batches', '8']);
  const st = events(join(tmp, 'share-stage'));
  assert.equal(checkValues(st), 8);
  let weights = null, early = 0;
  const P = new Set(st[0].panel.map((x) => x.id));
  const enters = new Map(st.filter((e) => e.type === 'enter').map((e) => [e.id, e]));
  for (const e of st) {
    if (e.type === 'sharing') weights = { w: new Map(e.weights.map(([o, x]) => [o, x])), member: e.member };
    if (e.type === 'leave' && e.early) {
      let num = 0, den = 0;
      for (const [o, wi, l, t] of enters.get(e.id).scores) {
        const x = weights ? (P.has(o) ? weights.w.get(o) : weights.member) : 1;
        num += x * ((3 * wi + t) * 100) / (wi + l + t), den += x;
      }
      assert.ok(Math.abs(num / den - e.avg) < 1e-4, `early leave of ${e.id}: ${e.avg}, weighted ${num / den}`);
      if (weights) early++;
    }
  }
  assert.ok(early >= 3, `${early} early leaves with weights`);
  const w = one.filter((e) => e.type === 'sharing').at(-1).weights.map((x) => x[1]);
  assert.ok(Math.max(...w) / Math.min(...w) > 1.5 && Math.max(...w) / Math.min(...w) <= 300 / 20 + 1, `weights ${Math.min(...w)} to ${Math.max(...w)}`);
  run(join(tmp, 'share-resumed'), [...args, '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'share-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'share-resumed'))), stable(one));
  // refused together with --rotate
  const r = spawnSync(evolve, [join(tmp, 'share-rot'), ...args, '--rotate', '2', '--batches', '1'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
});

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
  // refused together with --sharing
  const r = spawnSync(evolve, [join(tmp, 'avgp-share'), ...args, '--sharing', '20', '--batches', '1'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
});
