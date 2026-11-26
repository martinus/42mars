// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --screen-check and --screen-stop. What the evolver's test files share is in
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
import { setup, cleanup, tmp, evolve, skip, RULES, TINY, run, events, without, stable, base, checkValues, checkOrder, checkOps } from './evolver-common.js';

before(() => setup({ base: false })); // no test here reads the base run
after(cleanup);

test('--screen-check 3 is the run without it and logs every bound; --screen-stop 3 stops those children; the same run on any thread count and after a resume', { skip }, () => {
  const BATCHES = 8;
  const args = [...TINY, '--screen-rounds', '20', '--rounds', '40', '--panel-rounds', '40', '--batch', '48', '--list', '20'];
  run(join(tmp, 'sc0'), [...args, '--threads', '2', '--batches', String(BATCHES)]);
  run(join(tmp, 'sc1'), [...args, '--screen-check', '3', '--threads', '2', '--batches', String(BATCHES)]);
  const plain = events(join(tmp, 'sc0')), check = events(join(tmp, 'sc1'));
  const same = (evs) => stable(evs).filter((e) => e.type !== 'screen' && e.type !== 'start');
  assert.deepEqual(same(check), same(plain)); // the check plays everything
  assert.equal(check[0].params.screenCheck, 3);
  const P = check[0].panel.length, F = 20;
  // every child it would stop: its bound from its results so far, below the threshold or the cut
  let stops = 0, cuts = 0;
  for (const s of check.filter((e) => e.type === 'screen')) {
    assert.equal(s.check, true);
    assert.equal(s.stopped, s.steps.reduce((a, st) => a + st.stopped.length, 0));
    for (const st of s.steps) {
      // the cut: the 16th largest lower bound of the children still in
      const sorted = [...st.lo].sort((a, b) => b - a);
      assert.equal(st.cut, sorted.length > check[0].params.survivors ? sorted[check[0].params.survivors - 1] : -1e300);
      for (const row of st.stopped) {
        const q = row.length / 3, n = st.rounds;
        assert.equal(q, P); // TINY: no members in the screen
        let x = 0, s2 = 0;
        for (let k = 0; k < q; k++) {
          const [w, , t] = row.slice(3 * k, 3 * k + 3);
          assert.equal(row[3 * k] + row[3 * k + 1] + row[3 * k + 2], n);
          x += ((3 * w + t) * 100) / n;
          const pw = (w + 1) / (n + 3), pt = (t + 1) / (n + 3), mu = 300 * pw + 100 * pt;
          s2 += 90000 * pw + 10000 * pt - mu * mu;
        }
        x /= q;
        s2 /= q * q;
        const hi = x + 3 * Math.sqrt((s2 * (F - n)) / (F * n));
        assert.ok(hi < Math.max(st.threshold, st.cut) + 1e-9, `batch ${s.batch}, after ${n}: ${hi} against ${st.threshold}, ${st.cut}`);
        if (hi >= st.threshold) cuts++;
        stops++;
      }
    }
    assert.ok(s.rounds <= s.full);
    // the check played on: the whole screen of each child it would have stopped
    assert.equal(s.finals.length, s.stopped);
    for (const [screen, ...row] of s.finals) {
      let x = 0;
      for (let k = 0; k < P; k++) {
        const [w, l, t] = row.slice(3 * k, 3 * k + 3);
        assert.equal(w + l + t, F);
        x += ((3 * w + t) * 100) / F;
      }
      assert.ok(Math.abs(x / P - screen) < 1e-9);
    }
  }
  assert.ok(stops >= 20 && cuts >= 5, `${stops} would stop, ${cuts} by the cut`);
  // --screen-stop: the same decisions, so with no survivor missed the same run
  run(join(tmp, 'sc2'), [...args, '--screen-stop', '3', '--threads', '1', '--batches', String(BATCHES)]);
  const stop = events(join(tmp, 'sc2'));
  const sc = (evs) => evs.filter((e) => e.type === 'screen').map(({ stopped, rounds, full }) => [stopped, rounds, full]);
  assert.ok(check.filter((e) => e.type === 'screen').every((s) => s.missed === 0)); // in this fixture
  assert.deepEqual(same(stop), same(plain));
  assert.deepEqual(sc(stop), sc(check));
  assert.equal(checkValues(stop), BATCHES);
  run(join(tmp, 'sc3'), [...args, '--screen-stop', '3', '--threads', '3', '--batches', String(BATCHES)]);
  assert.deepEqual(stable(events(join(tmp, 'sc3'))), stable(stop));
  run(join(tmp, 'sc-resumed'), [...args, '--screen-stop', '3', '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'sc-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'sc-resumed'))), stable(stop));
});
