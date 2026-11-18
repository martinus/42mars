// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --select value with --rotate, --screen-check and --screen-stop, --simple. What the evolver's test files share is in
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
import { setup, cleanup, tmp, evolve, skip, RULES, TINY, run, events, without, stable, base, checkValues, checkOrder, checkOps, checkSimple, CLASSIC } from './evolver-common.js';

before(setup);
after(cleanup);

test('--select value --rotate 2: survivors by estimated value, a panel that changes, the same run on any thread count', { skip }, () => {
  const args = [...TINY, '--select', 'value', '--rotate', '2', '--survivors', '8'];
  run(join(tmp, 'rot1'), [...args, '--threads', '1', '--batches', '6']);
  const one = events(join(tmp, 'rot1'));
  assert.equal(one[0].params.select, 'value');
  assert.equal(one[0].params.rotate, 2);
  // rotations before batches 2 and 4, each of the oldest panel warrior
  const rot = one.filter((e) => e.type === 'rotate');
  assert.deepEqual(rot.map((e) => e.batch), [2, 4]);
  assert.deepEqual(rot.map((e) => e.out), one[0].panel.slice(0, 2).map((p) => p.id));
  assert.equal(checkValues(one), 6);
  assert.equal(checkOps(one), 6);
  checkOrder(one, 'estimate');
  // and that is another order than the screen's in some batch
  const enters = one.filter((e) => e.type === 'enter');
  assert.ok(enters.some((e, i) => i && enters[i - 1].batch === e.batch && enters[i - 1].screen < e.screen - 1e-4), 'estimate and screen agree everywhere');
  // the new panel warriors' matches play the same in the WebAssembly engine
  const code = new Map(one[0].panel.map((w) => [w.id, w.source]));
  for (const e of one) {
    if (e.type === 'enter') code.set(e.id, `;name x\n${e.code}`);
    if (e.type === 'rotate') code.set(e.panel.id, e.panel.source);
  }
  const m = createMarsSync(RULES);
  let replayed = 0;
  for (const e of rot) {
    const members = e.scores.filter(([o]) => !one[0].panel.some((p) => p.id === o));
    assert.ok(members.length > 0);
    for (const [o, w, l, t, seed] of [e.scores[0], ...members.slice(0, 3)]) {
      const r = m.runMatch([assemble(e.panel.source, RULES), assemble(code.get(o), RULES)], { seed, rounds: one[0].params.rounds });
      assert.deepEqual([r.warriors[0].wins, r.warriors[0].losses, r.warriors[0].ties], [w, l, t], `${e.panel.name} against ${o}`);
      replayed++;
    }
  }
  assert.ok(replayed >= 6);
  run(join(tmp, 'rot-resumed'), [...args, '--threads', '3', '--batches', '3']);
  run(join(tmp, 'rot-resumed'), ['--threads', '2', '--batches', '3']);
  assert.deepEqual(stable(events(join(tmp, 'rot-resumed'))), stable(one));
});

test('--simple: a candidate plays the panel in checkpoints and stops when it cannot make it; no games among members; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.simple, false);
  const BATCHES = 8, CHECKED = 16, F = 100, P = 10;
  // --simple sets the screen's members, the stage and the diversity itself
  // 8000 cycles (CLASSIC): with 2000, 15 children that the value bound would have stopped stayed (many rounds
  // are all ties, so their spread looks small), which this test does not allow
  const args = [...without(CLASSIC, '--screen-members', '--stage', '--diversity', '--panel-rounds'), '--simple', '--panel-rounds', String(F), '--list', '16'];
  // --screen-check: everyone plays the whole match, every row is logged, the rule replayed
  run(join(tmp, 'simple-check'), [...args, '--screen-check', '3', '--threads', '2', '--batches', String(CHECKED)]);
  const chk = events(join(tmp, 'simple-check'));
  assert.deepEqual([chk[0].params.simple, chk[0].params.average, chk[0].params.diversity, chk[0].params.memberGames, chk[0].params.screenMembers],
    [true, 'panel', 'panel', 'none', 0]);
  assert.deepEqual([chk[0].params.rounds, chk[0].params.panelRounds, chk[0].params.stage], [F, F, 10]); // one length of match
  assert.deepEqual(chk.find((e) => e.type === 'simple').checkpoints, [5, 10, 50, F]);
  const seen = checkSimple(chk);
  assert.equal(seen.steps, 4 * CHECKED);
  assert.ok(seen.stops[0] >= 5 && seen.stops[1] >= 5 && seen.stops[2] >= 3, `stops by strength ${seen.stops[0]}, as twins ${seen.stops[1]}, by value ${seen.stops[2]}`);
  // none that would have stopped by strength or by value stayed past its batch (a twin may: in the place of the member it plays like)
  const missed = chk.filter((e) => e.type === 'simple').reduce((a, e) => a.map((x, i) => x + e.missed[i]), [0, 0, 0]);
  assert.deepEqual([missed[0], missed[2]], [0, 0]);
  assert.equal(checkValues(chk), CHECKED);
  // with --screen-stop (the default, z 3) those stop: fewer rounds, and whoever enters has played its whole match
  run(join(tmp, 'simple1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'simple1'));
  assert.equal(one[0].params.screenStop, 3);
  assert.equal(checkValues(one), BATCHES);
  const simples = one.filter((e) => e.type === 'simple');
  assert.equal(simples.length, BATCHES);
  const sum = (k) => simples.reduce((a, e) => a + e[k], 0);
  assert.ok(sum('rounds') < 0.9 * sum('full'), `${sum('rounds')} of ${sum('full')} rounds played`);
  for (const e of simples) { // the rounds played: each candidate up to the checkpoint where it stopped
    const batch = one.find((x) => x.type === 'batch' && x.batch === e.batch);
    let left = batch.evaluated, rounds = 0;
    e.stopped.forEach((s, k) => { const n = s[0] + s[1] + s[2]; rounds += n * e.checkpoints[k] * P; left -= n; });
    assert.equal(e.rounds, rounds + left * F * P, `rounds of batch ${e.batch}`);
    assert.equal(e.full, batch.evaluated * F * P);
    // everyone that did not stop was a survivor: no quota
    assert.equal(batch.survivors, left, `survivors of batch ${e.batch}`);
  }
  // the children of each parent: bred, evaluated, past the test, stayed
  const pe = one.filter((e) => e.type === 'parents');
  assert.ok(pe.length >= BATCHES - 2);
  for (const e of pe) {
    for (const [, bred, evaluated, past, stayed] of e.parents) assert.ok(bred >= evaluated && evaluated >= past && past >= stayed && bred > 0);
    const enters = one.filter((x) => x.type === 'enter' && x.batch === e.batch && x.parents.length && x.ops !== 'reintroduce');
    const byParent = new Map();
    for (const x of enters) byParent.set(x.parents[0], (byParent.get(x.parents[0]) ?? 0) + 1);
    assert.deepEqual(new Map(e.parents.filter((x) => x[3]).map((x) => [x[0], x[3]])), byParent, `parents of batch ${e.batch}`);
  }
  run(join(tmp, 'simple-resumed'), [...args, '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'simple-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'simple-resumed'))), stable(one));
  // refused with what it replaces
  for (const extra of [['--race', '5'], ['--select', 'value'], ['--specialists'], ['--niche', '2'], ['--rotate', '2'], ['--sd', 'sum'], ['--sharing', '20'], ['--parents', 'duel'], ['--screen-members', '3'], ['--diversity', 'all']]) {
    const r = spawnSync(evolve, [join(tmp, 'simple-no'), ...args, ...extra, '--batches', '1'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, `--simple with ${extra.join(' ')}`);
  }
});

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
  // not with --race
  assert.notEqual(spawnSync(evolve, [join(tmp, 'sc-race'), ...args, '--screen-stop', '3', '--race', '5', '--batches', '1'], { encoding: 'utf8' }).status, 0);
});
