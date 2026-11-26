// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --islands, split from evolver-tune.test.js so that CI runs them at the
// same time (#161). What the evolver's test files share is in
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

test('--islands: runs in one process with the same panel and holdout, in rounds; the best go on after their scores against the folder; the same on any thread count and after a resume', { skip }, () => {
  const N = 3, EVERY = 4, KEEP = 2, BATCHES = 9, SCORE = 5;
  // a picked panel, to see it picked once
  const args = [...without(TINY, '--panel-choice'), '--panel-choice', 'picked', '--pick-sample', '40',
    '--average', 'panel', '--list', '16', '--survivors', '8'];
  // islands alike and without migration, so that an island is the run alone
  // designs of 1 member and more: many, most of them not among the four of their island
  const isl = ['--islands', String(N), '--select-after', String(EVERY), '--keep', String(KEEP), '--score-rounds', String(SCORE), '--score-designs', '1', '--migrate', '0', '--island-variant', ''];
  const rdir = join(tmp, 'isl');
  run(rdir, [...args, ...isl, '--threads', '2', '--batches', String(BATCHES)]);
  const rootEvents = (dir) => events(dir, 'islands.jsonl');
  const island = (dir, i) => events(join(dir, `island-0${i}`));
  const re = rootEvents(rdir);
  assert.deepEqual(re.map((e) => e.type), ['islands', 'pick', 'score', 'score']);
  assert.deepEqual([re[0].islands, re[0].keep, re[0].selectAfter, re[0].seed, re[0].drawSeed], [N, KEEP, EVERY, 7, 7]);
  const all = [1, 2, 3].map((i) => island(rdir, i));
  // every island: its own seed, the folder in the order of the first, so the same panel (the one picked once) and holdout
  all.forEach((ev, k) => {
    assert.deepEqual([ev[0].params.seed, ev[0].params.drawSeed], [7 + k, 7]);
    assert.deepEqual(ev[0].panel.map((w) => w.file), re[0].panel.split(','));
    assert.deepEqual(ev[0].panel.map((w) => w.file), re[1].picked.map((w) => w.file));
    assert.deepEqual(ev[0].holdout.map((w) => w.file), all[0][0].holdout.map((w) => w.file));
    assert.ok(!ev.some((e) => e.type === 'pick'), 'an island picks no panel');
  });
  // an island is the run alone with those settings
  run(join(tmp, 'isl-alone'), [...args.map((x, i, a) => (a[i - 1] === '--seed' ? '9' : x)), '--draw-seed', '7', '--panel-files', re[0].panel, '--threads', '3', '--batches', String(BATCHES)]);
  const alone = events(join(tmp, 'isl-alone'));
  const startOf = (ev) => ({ ...ev[0], params: { ...ev[0].params, panelChoice: 0 } }); // files alone, picked in the islands
  assert.deepEqual(stable(all[2]).slice(1), stable(alone).slice(1));
  assert.deepEqual(startOf(all[2]), startOf(alone));
  // the scores: the best.red of each island and its 3 members best against the panel, against every warrior of the folder
  const [s1, s2] = re.slice(2);
  assert.deepEqual([s1.batch, s2.batch, s1.rounds, s1.files.length, s1.seeds.length], [EVERY, 2 * EVERY, SCORE, s1.opponents, s1.opponents]);
  assert.ok(s1.opponents > 100 && new Set(s1.files).size === s1.opponents);
  assert.deepEqual(s1.islands.map((x) => x.island), [1, 2, 3]);
  let twice = 0; // warriors that are a best.red and one of its island's three
  for (const x of s1.islands) {
    const ev = all[x.island - 1], upTo = ev.slice(0, ev.findIndex((e) => e.type === 'batch' && e.batch === EVERY - 1) + 1);
    const vals = upTo.filter((e) => e.type === 'values').at(-1).values.filter((v) => !ev[0].panel.some((p) => p.id === v[0]));
    const top = [...vals].sort((a, b) => b[5] - a[5] || vals.indexOf(a) - vals.indexOf(b)).slice(0, 3).map((v) => v[0]);
    assert.deepEqual(x.warriors.filter((w) => /^p\d$/.test(w.tag)).map((w) => w.id), top, `island ${x.island}: its members best against the panel`);
    const benched = upTo.filter((e) => e.type === 'bench').sort((a, b) => b.avg - a.avg)[0];
    assert.deepEqual(x.warriors.filter((w) => w.tag === 'best').map((w) => w.id), benched ? [benched.id] : [], `island ${x.island}: its best.red`);
    assert.equal(x.score, Math.max(...x.warriors.filter((w) => w.tag !== 'design').map((w) => w.score)), 'a design does not count for the island');
    for (const w of x.warriors) assert.equal(w.score, x.warriors.find((y) => y.id === w.id).score, `island ${x.island}: ${w.id} scored once`);
    twice += x.warriors.length - new Set(x.warriors.map((w) => w.id)).size;
  }
  assert.ok(twice >= 1, 'no warrior was both best.red and one of the three');
  // #220: every warrior's points and wins per opponent, in the order of files, once per island (at the first place
  // of a warrior that is there twice), their mean is its score; and the best member of each design (family noun and
  // kind of style) with --score-designs members (1 here), the best against the panel first; a design does not count
  // for its island's score
  assert.equal(re[0].scoreDesigns, 1);
  let designs = 0, played = 0;
  for (const s of [s1, s2]) {
    for (const x of s.islands) {
      const had = new Set();
      for (const w of x.warriors) {
        if (!w.points) {
          assert.ok(had.has(w.id), `island ${x.island}, batch ${s.batch}: ${w.tag} ${w.id} without points, and not before`);
          continue;
        }
        assert.ok(!had.has(w.id), `island ${x.island}, batch ${s.batch}: ${w.id} played twice`);
        had.add(w.id);
        assert.deepEqual([w.points.length, w.wins.length], [s.files.length, s.files.length]);
        w.points.forEach((p, o) => assert.ok(p >= 3 * w.wins[o] && p - 2 * w.wins[o] <= SCORE, `${w.id} against ${s.files[o]}: ${p} points, ${w.wins[o]} wins`));
        const mean = (w.points.reduce((a, b) => a + b, 0) * 100) / SCORE / s.files.length;
        assert.ok(Math.abs(mean - w.score) < 1e-3, `${w.id}: score ${w.score}, mean of its points ${mean}`);
        assert.ok(typeof w.code === 'string' && w.code.length > 0);
      }
      const ev = all[x.island - 1], upTo = ev.slice(0, ev.findIndex((e) => e.type === 'batch' && e.batch === s.batch - 1) + 1);
      const vals = upTo.filter((e) => e.type === 'values').at(-1).values.filter((v) => !ev[0].panel.some((p) => p.id === v[0]));
      const entered = new Map(upTo.filter((e) => e.type === 'enter').map((e) => [e.id, e]));
      const groups = new Map();
      for (const v of vals) {
        const e = entered.get(v[0]), key = `${e.name.split(' ')[1]} ${e.style.kind}`;
        const g = groups.get(key) ?? { best: v, members: 0, noun: e.name.split(' ')[1], kind: e.style.kind };
        if (v[5] > g.best[5]) g.best = v;
        g.members++;
        groups.set(key, g);
      }
      const want = [...groups.values()].filter((g) => g.members >= 1).sort((a, b) => b.best[5] - a.best[5]).map((g) => [g.best[0], g.noun, g.kind, g.members]);
      const got = x.warriors.filter((w) => w.tag === 'design');
      assert.deepEqual(got.map((w) => [w.id, w.noun, w.kind, w.members]), want, `island ${x.island}, batch ${s.batch}: the designs`);
      designs += got.length;
      played += got.filter((w) => w.points).length;
    }
  }
  assert.ok(designs >= 2 && played >= 1, `${designs} designs, ${played} of them not among the four`);
  // the KEEP best islands go on, the other stops where it was scored
  const ranked = [...s1.islands].sort((a, b) => b.score - a.score || a.island - b.island);
  assert.deepEqual(s1.kept, ranked.slice(0, KEEP).map((x) => x.island).sort());
  assert.equal(s2.kept, undefined);
  assert.deepEqual(s2.islands.map((x) => x.island), s1.kept);
  const batchesOf = (ev) => ev.filter((e) => e.type === 'batch').length;
  all.forEach((ev, k) => assert.equal(batchesOf(ev), s1.kept.includes(k + 1) ? BATCHES : EVERY, `batches of island ${k + 1}: in rounds`));
  // one score as it was played: that warrior against every warrior of the folder with the logged seeds, in the WebAssembly engine
  const bestOf = [...s2.islands].sort((a, b) => b.score - a.score)[0], bw = [...bestOf.warriors].sort((a, b) => b.score - a.score)[0];
  const src = all[bestOf.island - 1].find((e) => e.type === 'enter' && e.id === bw.id).code;
  const m = createMarsSync(RULES), me = assemble(`;redcode\n;name x\n${src}`, RULES);
  let sum = 0;
  s2.files.forEach((file, o) => {
    const other = assemble(readFileSync(join(root, 'warriors/koenigstuhl/tiny', file), 'latin1'), RULES);
    const r = m.runMatch([me, other], { seed: s2.seeds[o], rounds: SCORE });
    sum += ((3 * r.warriors[0].wins + r.warriors[0].ties) * 100) / SCORE;
  });
  assert.ok(Math.abs(sum / s2.files.length - bw.score) < 1e-3, `score of ${bw.id}: ${bw.score}, replayed ${sum / s2.files.length}`);
  // the root's best.red: the best warrior scored so far
  const scored = [s1, s2].flatMap((s) => s.islands.flatMap((x) => x.warriors.map((w) => ({ ...w, island: x.island }))));
  const top = scored.reduce((a, b) => (b.score > a.score ? b : a));
  const red = readFileSync(join(rdir, 'best.red'), 'latin1');
  assert.ok(red.includes(`;name island-0${top.island} ${top.tag} ${top.id}\n`) && red.includes(`;strategy ${top.score.toFixed(1)} against the ${s1.opponents} warriors`), red.slice(0, 300));
  // the same stopped and continued on other thread counts (also across the selection)
  const same = (dir) => {
    [1, 2, 3].forEach((i) => assert.deepEqual(stable(island(dir, i)), stable(all[i - 1]), `island ${i} of ${dir}`));
    assert.deepEqual(stable(rootEvents(dir)).map((e) => ({ ...e, threads: 0 })), stable(re).map((e) => ({ ...e, threads: 0 })));
    assert.equal(readFileSync(join(dir, 'best.red'), 'latin1'), red);
  };
  // --score-designs 0: the four of each island only
  // (stopped before the score: the option is in islands.txt)
  run(join(tmp, 'isl-d0'), [...without(args), ...without(isl, '--score-designs', '--keep'), '--keep', '0', '--score-designs', '0', '--threads', '4', '--batches', '2']);
  run(join(tmp, 'isl-d0'), ['--threads', '4', '--batches', String(EVERY - 1)]);
  const d0 = rootEvents(join(tmp, 'isl-d0'));
  assert.equal(d0[0].scoreDesigns, 0);
  assert.deepEqual(d0.find((e) => e.type === 'score').islands.map((x) => x.warriors.map((w) => w.tag)), s1.islands.map((x) => x.warriors.filter((w) => w.tag !== 'design').map((w) => w.tag)));
  run(join(tmp, 'isl-resumed'), [...args, ...isl, '--threads', '3', '--batches', '3']);
  run(join(tmp, 'isl-resumed'), ['--threads', '1', '--batches', '3']); // past the selection at 4
  run(join(tmp, 'isl-resumed'), ['--threads', '4', '--batches', '3']);
  same(join(tmp, 'isl-resumed'));
  // a root of islands takes no new options, and the options of islands need --islands
  const refused = [
    [rdir, ['--islands', '2']],
    [rdir, ['--list', '20']],
    [join(tmp, 'isl-no1'), [...args, '--keep', '2']],
    [join(tmp, 'isl-no2'), [...args, '--islands', '3', '--keep', '3', '--select-after', '2']],
    [join(tmp, 'isl-no3'), [...args, '--islands', '3', '--keep', '2']],
  ];
  for (const [dir, extra] of refused) {
    const r = spawnSync(evolve, [dir, ...extra, '--batches', '1'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, extra.join(' '));
  }
});

test('without --pushoff, a run says when the push-off is value because pareto does not go with an option, also per island variant (#199)', { skip }, () => {
  const args = without(TINY, '--pushoff');
  const said = /--average panel: the push-off is value, pareto does not go with it/;
  const one = run(join(tmp, 'fallback'), [...args, '--average', 'panel', '--batches', '1']);
  assert.match(one.stderr, new RegExp(`^42evolve: ${said.source}$`, 'm'));
  assert.equal(events(join(tmp, 'fallback'))[0].params.pushoff, 'value');
  // given, or where pareto goes, nothing is said
  assert.doesNotMatch(run(join(tmp, 'fallback-given'), [...args, '--average', 'panel', '--pushoff', 'value', '--batches', '1']).stderr, /the push-off is value/);
  assert.doesNotMatch(run(join(tmp, 'fallback-none'), [...args, '--batches', '1']).stderr, /the push-off is value/);
  // every island has --average panel; islands 1 and 3 say --pushoff value, island 2 does not: only it is named
  const dir = join(tmp, 'fallback-islands');
  const isl = run(dir, [...args, '--average', 'panel', '--islands', '3', '--island-variant', '--pushoff value', '--island-variant', '',
    '--migrate', '0', '--batches', '1']);
  assert.match(isl.stderr, new RegExp(`^42evolve: --island-variant '', islands 2: ${said.source}$`, 'm'));
  assert.equal(isl.stderr.match(/the push-off is value/g).length, 1);
  assert.deepEqual([1, 2, 3].map((i) => events(join(dir, `island-0${i}`))[0].params.pushoff), ['value', 'value', 'value']);
  // a variant without the option: pareto-sd there, and only the other one is named
  const dir2 = join(tmp, 'fallback-islands2');
  const isl2 = run(dir2, [...args, '--islands', '3', '--island-variant', '--average panel', '--island-variant', '', '--migrate', '0', '--batches', '1']);
  assert.match(isl2.stderr, new RegExp(`^42evolve: --island-variant '--average panel', islands 1, 3: ${said.source}$`, 'm'));
  assert.equal(isl2.stderr.match(/the push-off is value/g).length, 1);
  assert.deepEqual([1, 2, 3].map((i) => events(join(dir2, `island-0${i}`))[0].params.pushoff), ['value', 'pareto-sd', 'value']);
});
