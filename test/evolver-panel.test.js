// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --diversity panel and --member-games none, split from
// evolver-defaults.test.js so that CI runs them at the same time (#161; the
// defaults from before generators are in evolver-picked.test.js).
// What the evolver's test files share is in test/evolver-common.js; built
// with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

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
