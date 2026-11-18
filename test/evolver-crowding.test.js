// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --map-elites crowding. What the evolver's test files share is in
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
import { setup, cleanup, tmp, skip, TINY, run, events, stable } from './evolver-common.js';

before(setup);
after(cleanup);

test('--map-elites crowding: a child competes with its nearest by SD-score; one unlike all replaces the weaker of the closest pair; the same run on any thread count and after a resume', { skip }, () => {
  const rules = TINY.slice(0, TINY.indexOf('--panel'));
  // 24 panel warriors at 60 rounds, batches of 32: 17 s of CPU instead of 58 (40 at 100, batches of 48), with 6
  // children that replaced their nearest and 17 that replaced the weaker of the closest pair
  const args = ['--map-elites', 'crowding', ...rules, '--seed', '9', '--panel', '24', '--holdout', '8', '--rounds', '40', '--screen-rounds', '10',
    '--panel-rounds', '60', '--batch', '32', '--list', '12', '--bench-every', '3'];
  run(join(tmp, 'cr1'), [...args, '--threads', '1', '--batches', '14']);
  const one = events(join(tmp, 'cr1'));
  assert.deepEqual([one[0].params.mapElites, one[0].params.crowding], [true, true]);
  const P = one[0].panel.length;
  const pts = (scores) => scores.map(([, w, l, t]) => (3 * w + t) * 100 / (w + l + t));
  const places = new Map(); // place -> { id, avg, row }
  const sigmaOf = () => [...Array(P).keys()].map((j) => {
    const xs = [...places.keys()].sort((a, b) => a - b).map((c) => places.get(c).row[j]);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
  });
  const dist = (a, b, sigma) => a.reduce((s, x, j) => (sigma[j] > 0 ? s + Math.abs(x - b[j]) / sigma[j] : s), 0);
  const close = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
  const count = { empty: 0, near: 0, far: 0 };
  let sigma = null, batch = -1;
  for (const e of one.filter((x) => x.type === 'elite')) {
    if (e.batch !== batch) batch = e.batch, sigma = null;
    const row = pts(e.scores);
    assert.equal(row.length, P);
    assert.ok(close(row.reduce((a, b) => a + b, 0) / P, e.avg), e.name);
    count[e.rule]++;
    if (e.rule === 'empty') {
      assert.ok(places.size < 12 && !places.has(e.index), e.name);
      assert.ok([...Array(e.index).keys()].every((c) => places.has(c)), `${e.name}: the first free place`);
      assert.equal(e.replaced, undefined);
    } else {
      assert.equal(places.size, 12);
      sigma ??= sigmaOf(); // once a batch, from the full archive
      const order = [...places.keys()].sort((a, b) => a - b);
      let near = -1, dn = Infinity, pa = -1, pb = -1, dp = Infinity;
      for (const c of order) { const d = dist(row, places.get(c).row, sigma); if (d < dn) dn = d, near = c; }
      for (const a of order) for (const b of order) {
        if (b <= a) continue;
        const d = dist(places.get(a).row, places.get(b).row, sigma);
        if (d < dp) dp = d, pa = a, pb = b;
      }
      assert.ok(close(e.distance, dn) && close(e.pair, dp), `${e.name}: ${e.distance} ${e.pair} against ${dn} ${dp}`);
      const old = places.get(e.index);
      assert.equal(e.replaced.id, old.id);
      if (e.rule === 'near') { // its nearest, beaten by more than 2 standard errors of the paired differences
        assert.ok(dn <= dp && e.index === near, `${e.name}: nearest ${near}, took ${e.index}`);
        const d = row.map((x, j) => x - old.row[j]);
        const mean = d.reduce((a, b) => a + b, 0) / P, se = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (P - 1) / P);
        assert.ok(close(mean, e.replaced.gain) && mean > 2 * se, `${e.name}: ${mean} ${se}`);
        assert.equal(e.newFamily, false);
      } else { // farther than the closest pair: the weaker of that pair, by a higher average, and above half of the archive
        assert.ok(dn > dp, e.name);
        const weak = places.get(pa).avg < places.get(pb).avg ? pa : pb;
        assert.equal(e.index, weak, `${e.name}: the pair ${pa} ${pb}`);
        assert.ok(e.avg > old.avg, e.name);
        assert.ok(2 * [...places.values()].filter((x) => x.avg < e.avg).length >= 12, `${e.name}: ${e.avg} below the median`);
        assert.equal(e.newFamily, e.parents.length > 0);
      }
    }
    places.set(e.index, { id: e.id, avg: e.avg, row });
  }
  assert.ok(count.empty === 12 && count.near > 2 && count.far > 2, JSON.stringify(count));
  run(join(tmp, 'cr-resumed'), [...args, '--threads', '2', '--batches', '6']);
  run(join(tmp, 'cr-resumed'), ['--threads', '3', '--batches', '8']);
  assert.deepEqual(stable(events(join(tmp, 'cr-resumed'))), stable(one));
});
