// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// the defaults (the best run of E5), --diversity panel and --member-games none: the longer runs of
// evolver.test.js in a file of their own, so that the files take about as long (#161). What the evolver's
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

before(setup);
after(cleanup);

test('--diversity panel --panel-rounds 250: the distance over the panel, longer matches against it in blocks; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.diversity, 'all');
  assert.equal(base[0].params.panelRounds, 40);
  for (const stage of ['0', '10']) {
    const args = [...TINY, '--diversity', 'panel', '--panel-rounds', '250', '--stage', stage, '--list', '8'];
    run(join(tmp, `dp1-${stage}`), [...args, '--threads', '1', '--batches', '5']);
    const one = events(join(tmp, `dp1-${stage}`));
    assert.equal(one[0].params.diversity, 'panel');
    assert.equal(one[0].params.panelRounds, 250);
    assert.equal(checkValues(one), 5); // the values against tools/diversity.js with the panel's columns, every pair complete
    // a match against a panel warrior has 250 rounds, played in blocks of 100: the same in the WebAssembly engine
    const st = one[0], P = new Set(st.panel.map((w) => w.id));
    const code = new Map(st.panel.map((w) => [w.id, w.source]));
    const m = createMarsSync(RULES);
    let replayed = 0;
    for (const e of one.filter((x) => x.type === (stage === '0' ? 'enter' : 'complete')).slice(2, 5)) {
      const me = stage === '0' ? `;name x\n${e.code}` : `;name x\n${one.find((x) => x.type === 'enter' && x.id === e.id).code}`;
      const [o, w, l, t, seed] = e.scores.find(([x, a, b, c]) => P.has(x) && [a, b, c].filter((v) => v > 0).length > 1) ?? e.scores.find(([x]) => P.has(x));
      const r = m.runMatch([assemble(me, RULES), assemble(code.get(o), RULES)], { seed, rounds: 250 });
      assert.deepEqual([r.warriors[0].wins, r.warriors[0].losses, r.warriors[0].ties], [w, l, t], `${e.id} against panel ${o}`);
      replayed++;
    }
    assert.equal(replayed, 3);
    run(join(tmp, `dp3-${stage}`), [...args, '--threads', '3', '--batches', '5']);
    assert.deepEqual(stable(events(join(tmp, `dp3-${stage}`))), stable(one));
    run(join(tmp, `dp-resumed-${stage}`), [...args, '--threads', '2', '--batches', '2']);
    run(join(tmp, `dp-resumed-${stage}`), ['--threads', '4', '--batches', '3']);
    assert.deepEqual(stable(events(join(tmp, `dp-resumed-${stage}`))), stable(one));
  }
  const bad = spawnSync(evolve, [join(tmp, 'dp-bad'), ...TINY, '--panel-rounds', '20'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});

test('--member-games none: members never play each other, a screen of the panel only; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.memberGames, 'all');
  const BATCHES = 12;
  const args = [...TINY, '--average', 'panel', '--diversity', 'panel', '--member-games', 'none', '--list', '16', '--survivors', '8'];
  run(join(tmp, 'mg1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'mg1'));
  assert.equal(one[0].params.memberGames, 'none');
  assert.equal(one[0].params.screenMembers, 0);
  // the screen of the panel only also by default (TINY sets --screen-members 0 itself)
  run(join(tmp, 'mg-default'), [...without(args, '--screen-members'), '--batches', '1']);
  assert.equal(events(join(tmp, 'mg-default'))[0].params.screenMembers, 0);
  // every newcomer played the panel only, no two members ever played, and
  // every value and push-off is that of the panel columns
  assert.equal(checkValues(one), BATCHES);
  assert.ok(checkValues.pushoffs >= 20, `${checkValues.pushoffs} push-offs`);
  // and they are not played either: far fewer rounds a batch than the same
  // settings with the games among members (the speed events count them)
  run(join(tmp, 'mg-all'), [...args.map((x) => (x === 'none' ? 'all' : x)), '--threads', '2', '--batches', '5']);
  const perBatch = (evs) => { const s = evs.filter((e) => e.type === 'speed' && e.batch >= 2 && e.batch < 5); return s.reduce((a, e) => a + e.rounds, 0) / s.length; };
  const all = events(join(tmp, 'mg-all'));
  assert.equal(all[0].params.memberGames, 'all');
  assert.ok(perBatch(one) < 0.75 * perBatch(all), `${perBatch(one)} rounds a batch without member games, ${perBatch(all)} with`);
  // the same with --stage: the rest of the rounds against the panel only
  run(join(tmp, 'mg-stage'), [...args, '--panel-rounds', '100', '--stage', '20', '--threads', '2', '--batches', '8']);
  const st = events(join(tmp, 'mg-stage'));
  assert.equal(checkValues(st), 8);
  assert.ok(st.some((e) => e.type === 'complete'), 'no complete event');
  run(join(tmp, 'mg-resumed'), [...args, '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'mg-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'mg-resumed'))), stable(one));
  // refused where member games would count: the list average, the SD-score
  // over everyone, duels between parents, members in the screen
  for (const [name, extra] of [['avg', ['--average', 'all']], ['div', ['--diversity', 'all']], ['duel', ['--parents', 'duel']], ['screen', ['--screen-members', '5']]]) {
    const r = spawnSync(evolve, [join(tmp, `mg-no-${name}`), ...args, ...extra, '--batches', '1'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, `--member-games none with ${extra.join(' ')}`);
  }
});

test('the defaults: the settings of gen-var16-rnd; a panel picked from a round robin; the same on any thread count', { skip }, () => {
  const rules = TINY.slice(0, TINY.indexOf('--panel'));
  // a new run: generators, a panel of 30 by kinds, batches of 128 (docs/evolver-gen.md); a sample of 60
  // for the pick, not the 300 of the default: its round robin was 100 of the 120 s of this test (#161)
  run(join(tmp, 'def-new'), [...rules, '--seed', '5', '--pick-sample', '60', '--threads', '4', '--batches', '1']);
  const fresh = events(join(tmp, 'def-new'))[0];
  const q = fresh.params;
  assert.deepEqual([q.genome, q.panel, q.panelChoice, q.batch, q.survivors, fresh.panel.length], ['gen', 30, 'kinds', 128, 16, 30]);
  // islands: half exploit, half explore, every 5 batches a member drawn from an island drawn; --migrate 0 none
  run(join(tmp, 'def-isl'), [...rules, '--seed', '5', '--panel-choice', 'random', '--batch', '16', '--islands', '2', '--threads', '4', '--batches', '1']);
  const isl = events(join(tmp, 'def-isl'), 'islands.jsonl')[0];
  assert.deepEqual([isl.migrate, isl.migratePick, isl.migrateTo, isl.variants], [5, 'random', 'random', ['', '--screen-members 80 --screen-rounds 8']]);
  assert.deepEqual([1, 2].map((i) => events(join(tmp, 'def-isl', `island-0${i}`))[0].params.screenMembers), [10, 80]);
  run(join(tmp, 'def-isl0'), [...rules, '--seed', '5', '--panel-choice', 'random', '--batch', '16', '--islands', '2', '--migrate', '0', '--threads', '4', '--batches', '1']);
  assert.equal(events(join(tmp, 'def-isl0'), 'islands.jsonl')[0].migrate, 0);
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
