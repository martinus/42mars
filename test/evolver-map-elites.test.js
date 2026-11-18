// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --map-elites. What the evolver's test files share is in
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
import { setup, cleanup, tmp, skip, RULES, TINY, run, events, stable } from './evolver-common.js';

before(setup);
after(cleanup);

test('--map-elites: cells by style, each with its best warrior; the same run on any thread count and after a resume', { skip }, () => {
  const rules = TINY.slice(0, TINY.indexOf('--panel'));
  // the defaults of --map-elites: a panel of 80 drawn at random (one small batch, short matches: the panel
  // plays itself first, at 100 rounds that took 14 s)
  run(join(tmp, 'me-defaults'), ['--map-elites', ...rules, '--seed', '9', '--holdout', '8', '--rounds', '10', '--screen-rounds', '5', '--panel-rounds', '10', '--batch', '4', '--threads', '1', '--batches', '1']);
  const def = events(join(tmp, 'me-defaults'))[0].params;
  assert.deepEqual([def.mapElites, def.panel, def.panelChoice], [true, 80, 'random']);
  // the run itself on a smaller panel and shorter matches: 6 s of CPU instead of 52, with 19 warriors that took
  // cells, 10 that replaced one, 9 cells
  const args = ['--map-elites', ...rules, '--seed', '9', '--pick-sample', '40', '--panel', '24', '--holdout', '8', '--rounds', '40', '--screen-rounds', '10',
    '--panel-rounds', '50', '--batch', '32', '--bench-every', '3'];
  run(join(tmp, 'me1'), [...args, '--threads', '1', '--batches', '10']);
  const one = events(join(tmp, 'me1'));
  assert.equal(one[0].params.mapElites, true);
  const st = one[0], P = st.panel.length;
  const scoresOf = new Map();
  const opp = st.panel.slice(0, 3).map((w) => assemble(w.source, RULES));
  const m = createMarsSync({ ...RULES, watch: true });
  const bin = (x, edges) => edges.filter((e) => x >= e).length;
  const cells = new Map(); // index -> [id, avg]
  let elites = 0, replaced = 0;
  for (const e of one.filter((x) => x.type === 'elite')) {
    // the cell follows from the style, and the style is that of tools/style.js
    const s = e.style;
    assert.equal(e.index, bin(s.copies, [20, 200, 600]) * 12 + bin(s.tasks, [2, 50, 250]) * 3 + bin(s.read, [50, 300]), e.name);
    assert.deepEqual(e.cell, [Math.floor(e.index / 12), Math.floor(e.index / 3) % 4, e.index % 3]);
    if (elites % 4 === 0) {
      const js = measureStyle(m, assemble(`;name x\n${e.code}`, RULES), opp);
      for (const [k, v] of Object.entries(js)) assert.ok(Math.abs(s[k] - v) < 1e-5, `${e.name}: ${k}`);
    }
    // its average: the logged matches against the panel, all panel rounds each, points per 100 rounds
    assert.equal(e.scores.length, P);
    for (const [, w, l, t] of e.scores) assert.equal(w + l + t, 50);
    const per100 = (w, t) => ((3 * w + t) * 100) / 50;
    const avg = e.scores.reduce((sum, [, w, , t]) => sum + per100(w, t), 0) / P;
    assert.ok(Math.abs(avg - e.avg) < 1e-6, `${e.name}: ${avg} against ${e.avg}`);
    // better than the one it replaced, which was the cell's warrior: by more
    // than 2 standard errors of the differences per panel warrior
    const before = cells.get(e.index);
    scoresOf.set(e.id, e.scores);
    if (before) {
      assert.deepEqual([e.replaced.id, e.replaced.avg.toFixed(4)], [before[0], before[1].toFixed(4)]);
      const old = scoresOf.get(e.replaced.id);
      const d = e.scores.map(([o, w, , t], j) => { assert.equal(old[j][0], o); return per100(w, t) - per100(old[j][1], old[j][3]); });
      const mean = d.reduce((a, b) => a + b, 0) / P, se = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (P - 1) / P);
      assert.ok(Math.abs(mean - e.replaced.gain) < 1e-6 && Math.abs(se - e.replaced.se) < 1e-6, `${e.name}: ${mean} ${se} against ${JSON.stringify(e.replaced)}`);
      assert.ok(mean > 2 * se, `${e.name} took a cell by ${mean}, standard error ${se}`);
      replaced++;
    } else assert.equal(e.replaced, undefined);
    cells.set(e.index, [e.id, e.avg]);
    elites++;
  }
  assert.ok(elites > 10 && replaced > 3 && cells.size > 3, `${elites} warriors took cells, ${replaced} replaced one, ${cells.size} cells`);
  const last = one.filter((x) => x.type === 'batch').at(-1);
  assert.equal(last.cells, cells.size);
  assert.ok(Math.abs(last.best - Math.max(...[...cells.values()].map((c) => c[1]))) < 1e-6);
  assert.ok(one.some((x) => x.type === 'bench'));
  run(join(tmp, 'me-resumed'), [...args, '--threads', '2', '--batches', '4']);
  run(join(tmp, 'me-resumed'), ['--threads', '3', '--batches', '6']);
  assert.deepEqual(stable(events(join(tmp, 'me-resumed'))), stable(one));
});
