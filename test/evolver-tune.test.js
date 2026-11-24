// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --tune-novel, --optimize, --islands. What the evolver's test files share is in
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
import { setup, cleanup, root, tmp, evolve, skip, RULES, TINY, run, events, without, stable, checkValues } from './evolver-common.js';

before(setup);
after(cleanup);

test('--tune-novel 1: the most novel survivor that left is tuned, and comes back first in the next batch; the same run on any thread count and after a resume', { skip }, () => {
  // seeded with the stone whose step of 100 bombs 8 cells: its children have a constant to tune
  const seeds = join(tmp, 'tn-seeds');
  mkdirSync(seeds, { recursive: true });
  writeFileSync(join(seeds, 'badstep.red'), ';redcode\n;name bad step\nstep equ 100\nloop add.ab #step, bomb\nmov.i bomb, @bomb\njmp loop\nbomb dat #0, #step\n');
  const args = [...TINY.slice(0, TINY.indexOf('--panel')), '--panel', '12', '--holdout', '8', '--batch', '24', '--rounds', '60', '--screen-rounds', '10',
    '--panel-rounds', '60', '--list', '6', '--survivors', '6', '--seed', '3', '--start', seeds, '--tune-novel', '1', '--changes', 'insert=1,delete=1,a-operand=1',
    '--screen-members', '0', '--diversity', 'all', '--no-fill', '--panel-choice', 'random', '--stage', '0', '--positions', 'pmars', '--genome', 'list'];
  run(join(tmp, 'tn1'), [...args, '--threads', '1', '--batches', '8']);
  const evs = events(join(tmp, 'tn1'));
  assert.equal(evs[0].params.tuneNovel, 1);
  let tuned = 0, back = 0;
  for (const t of evs.filter((e) => e.type === 'tune')) {
    // the survivor: entered in that batch and left in it, the largest distance (estimate / screen, alpha 1)
    const left = new Set(evs.filter((e) => e.type === 'leave' && e.batch === t.batch).map((e) => e.id));
    const went = evs.filter((e) => e.type === 'enter' && e.batch === t.batch && left.has(e.id) && e.screen > 0);
    const dist = (e) => e.estimate / e.screen;
    const max = Math.max(...went.map(dist));
    const from = went.find((e) => e.id === t.from);
    assert.ok(from && Math.abs(dist(from) - t.distance) < 1e-3 * Math.max(1, t.distance) && dist(from) >= max - 1e-3 * Math.max(1, max), `batch ${t.batch}: ${t.from}`);
    if (!t.steps) continue;
    tuned++;
    assert.ok(t.tuned > t.avg, `${t.avg} to ${t.tuned}`);
    // the first candidate of the next batch: bred as `tuned`, entered with the tuned code if it passed the screen
    const next = evs.find((e) => e.type === 'batch' && e.batch === t.batch + 1);
    if (!next) continue;
    assert.equal(next.ops.tuned?.[0], 1, `batch ${t.batch + 1}`);
    const e = evs.find((x) => x.type === 'enter' && x.batch === t.batch + 1 && x.ops === 'tuned');
    if (e) {
      assert.deepEqual([e.code, e.parents[0]], [t.code, t.from]);
      back++;
    }
  }
  assert.ok(tuned >= 2 && back >= 1, `${tuned} tuned, ${back} entered`);
  assert.equal(checkValues(evs), 8);
  // a resume while a tuned warrior waits for the next batch
  const cut = evs.find((e) => e.type === 'tune' && e.steps).batch + 1;
  run(join(tmp, 'tn-resumed'), [...args, '--threads', '2', '--batches', String(cut)]);
  assert.match(readFileSync(join(tmp, 'tn-resumed', 'state.txt'), 'latin1'), /^tuned /m);
  run(join(tmp, 'tn-resumed'), ['--threads', '4', '--batches', String(8 - cut)]);
  assert.deepEqual(stable(events(join(tmp, 'tn-resumed'))), stable(evs));
});

test('--islands: runs in one process with the same panel and holdout, in rounds; the best go on after their scores against the folder; the same on any thread count and after a resume', { skip }, () => {
  const N = 3, EVERY = 4, KEEP = 2, BATCHES = 9, SCORE = 5;
  // a picked panel, to see it picked once
  const args = [...without(TINY, '--panel-choice'), '--panel-choice', 'picked', '--pick-sample', '40',
    '--average', 'panel', '--list', '16', '--survivors', '8'];
  // islands alike and without migration, so that an island is the run alone
  const isl = ['--islands', String(N), '--select-after', String(EVERY), '--keep', String(KEEP), '--score-rounds', String(SCORE), '--migrate', '0', '--island-variant', ''];
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
    assert.deepEqual(x.warriors.filter((w) => w.tag !== 'best').map((w) => w.id), top, `island ${x.island}: its members best against the panel`);
    const benched = upTo.filter((e) => e.type === 'bench').sort((a, b) => b.avg - a.avg)[0];
    assert.deepEqual(x.warriors.filter((w) => w.tag === 'best').map((w) => w.id), benched ? [benched.id] : [], `island ${x.island}: its best.red`);
    assert.equal(x.score, Math.max(...x.warriors.map((w) => w.score)));
    for (const w of x.warriors) assert.equal(w.score, x.warriors.find((y) => y.id === w.id).score, `island ${x.island}: ${w.id} scored once`);
    twice += x.warriors.length - new Set(x.warriors.map((w) => w.id)).size;
  }
  assert.ok(twice >= 1, 'no warrior was both best.red and one of the three');
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

test('--migrate: every M batches each island plays the best member of every other one first; the same on any thread count and after a resume', { skip }, () => {
  const N = 3, M = 2, BATCHES = 7;
  const isl = ['--islands', String(N), '--migrate', String(M), '--migrate-pick', 'best', '--migrate-to', 'all', '--island-variant', ''];
  const args = (list) => [...TINY, '--genome', 'gen', '--list', String(list), '--survivors', '8'];
  // a list of 40 is not full before batch 6 (the threshold is open), one of 12 pushes migrants off again
  const check = (list) => {
  const dir = join(tmp, `mig-${list}`);
  run(dir, [...args(list), ...isl, '--threads', '2', '--batches', String(BATCHES)]);
  const re = events(dir, 'islands.jsonl');
  assert.equal(re[0].migrate, M);
  const all = [1, 2, 3].map((i) => events(join(dir, `island-0${i}`)));
  const panel = new Set(all[0][0].panel.map((w) => w.id));
  let moved = 0, entered = 0, open = 0, again = 0;
  all.forEach((ev, k) => {
    const migrations = ev.filter((e) => e.type === 'migrate');
    assert.deepEqual(migrations.map((e) => e.batch), [2, 4, 6], `island ${k + 1}`);
    for (const m of migrations) {
      assert.deepEqual(m.from.map(([j]) => j), [1, 2, 3].filter((j) => j !== k + 1));
      for (const [j, id] of m.from) {
        // the islands play in rounds: every island as the round before left it
        const src = all[j - 1], upTo = m.batch - 1;
        const vals = src.filter((e) => e.type === 'values' && e.batch <= upTo).at(-1).values.filter((v) => !panel.has(v[0]));
        const best = vals.reduce((a, b) => (b[5] > a[5] ? b : a));
        assert.equal(id, best[0], `island ${k + 1}, batch ${m.batch}: the best of island ${j}`);
        const from = src.find((e) => e.type === 'enter' && e.id === id);
        const came = ev.find((e) => e.type === 'enter' && e.batch === m.batch && e.ops === 'migrant' && e.code === from.code);
        if (came) {
          assert.equal(came.gen, from.gen, 'a migrant keeps its generator');
          assert.deepEqual(came.parents, []);
          entered++;
        }
        moved++;
      }
      // every one is bred; played unless its code is in the list (also one sent twice), whatever this island saw before;
      // past the screen whatever its rank while the threshold is open (as a start warrior)
      const b = ev.find((e) => e.type === 'batch' && e.batch === m.batch), [bred, played, passed] = b.ops.migrant;
      const inList = new Map(), before = new Set();
      for (const e of ev) {
        if (e.batch >= m.batch) break;
        if (e.type === 'enter') inList.set(e.id, e.code), before.add(e.code);
        if (e.type === 'leave') inList.delete(e.id);
      }
      const codes = new Set(inList.values());
      let fresh = 0;
      for (const [j, id] of m.from) {
        const code = all[j - 1].find((e) => e.type === 'enter' && e.id === id).code;
        if (!codes.has(code)) fresh++, codes.add(code), again += before.has(code);
      }
      assert.deepEqual([bred, played], [m.from.length, fresh], `island ${k + 1}, batch ${m.batch}`);
      if (b.threshold < 0) assert.equal(passed, played, `island ${k + 1}, batch ${m.batch}: an open threshold`), open++;
    }
    assert.equal(ev.filter((e) => e.type === 'batch' && e.ops.migrant).length, migrations.length, 'migrants in those batches only');
    // a migrant whose code is in the list already is not played again: never two members with one code
    const alive = new Map();
    for (const e of ev) {
      if (e.type === 'enter') {
        assert.ok(![...alive.values()].includes(e.code) || e.ops !== 'migrant', `island ${k + 1}, batch ${e.batch}: ${e.id} is a copy`);
        alive.set(e.id, e.code);
      }
      if (e.type === 'leave') alive.delete(e.id);
    }
  });
  assert.ok(moved === 18 && entered >= 3, `${moved} sent, ${entered} entered`);
  return { all, open, again };
  };
  const big = check(40), small = check(12);
  assert.ok(big.open >= 1, 'no migration with an open threshold');
  assert.ok(small.again >= 1, 'no migrant that had left the island before'); // played again: the island may have changed
  // the same stopped and continued on other thread counts, across a migration
  const resumed = join(tmp, 'mig-resumed');
  run(resumed, [...args(40), ...isl, '--threads', '3', '--batches', '3']);
  run(resumed, ['--threads', '1', '--batches', '4']);
  [1, 2, 3].forEach((i) => assert.deepEqual(stable(events(join(resumed, `island-0${i}`))), stable(big.all[i - 1]), `island ${i}`));
  // without islands, with one, or with --tune-novel: refused
  for (const extra of [['--migrate', '2'], ['--islands', '1', '--migrate', '2'], [...isl, '--tune-novel', '1']]) {
    const r = spawnSync(evolve, [join(tmp, 'mig-no'), ...(extra.includes('--tune-novel') ? TINY : args(40)), ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, extra.join(' '));
  }
  assert.ok(!existsSync(join(tmp, 'mig-no')));
});

test('--migrate-pick random --migrate-to next: a member drawn, from the island before only; the same on any thread count and after a resume', { skip }, () => {
  const args = [...TINY, '--genome', 'gen', '--list', '16', '--survivors', '8'];
  const isl = ['--islands', '3', '--migrate', '2', '--migrate-pick', 'random', '--migrate-to', 'next'];
  const dir = join(tmp, 'ring');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', '7']);
  const re = events(dir, 'islands.jsonl');
  assert.deepEqual([re[0].migrate, re[0].migratePick, re[0].migrateTo], [2, 'random', 'next']);
  const all = [1, 2, 3].map((i) => events(join(dir, `island-0${i}`)));
  const panel = new Set(all[0][0].panel.map((w) => w.id));
  let notBest = 0, notFirst = 0;
  all.forEach((ev, k) => {
    const migrations = ev.filter((e) => e.type === 'migrate');
    assert.deepEqual(migrations.map((e) => e.batch), [2, 4, 6]);
    for (const m of migrations) {
      // one migrant, from the island before (the first takes from the last)
      const j = k === 0 ? 3 : k;
      assert.deepEqual(m.from.map(([i]) => i), [j], `island ${k + 1}, batch ${m.batch}`);
      const [, id] = m.from[0];
      // a member of that island then, as the round before left it
      const src = all[j - 1], upTo = m.batch - 1;
      const vals = src.filter((e) => e.type === 'values' && e.batch <= upTo).at(-1).values.filter((v) => !panel.has(v[0]));
      assert.ok(vals.some((v) => v[0] === id), `island ${k + 1}, batch ${m.batch}: ${id} is no member of island ${j}`);
      if (id !== vals.reduce((a, b) => (b[5] > a[5] ? b : a))[0]) notBest++;
      if (id !== vals[0][0]) notFirst++; // drawn from the whole list, not one place of it
    }
  });
  assert.ok(notBest >= 4 && notFirst >= 4, `of 9 migrants ${notBest} not the best of their island, ${notFirst} not its first member`);
  // the same stopped and continued on other thread counts
  const again = join(tmp, 'ring-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '3']);
  run(again, ['--threads', '1', '--batches', '4']);
  [1, 2, 3].forEach((i) => assert.deepEqual(stable(events(join(again, `island-0${i}`))), stable(all[i - 1]), `island ${i}`));
  // with --migrate 0, or another value: refused
  for (const extra of [['--islands', '3', '--migrate', '0', '--migrate-pick', 'random'], ['--islands', '3', '--migrate', '0', '--migrate-to', 'next'], ['--islands', '3', '--migrate', '2', '--migrate-pick', 'worst']]) {
    const r = spawnSync(evolve, [join(tmp, 'ring-no'), ...args, ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, extra.join(' '));
  }
  assert.ok(!existsSync(join(tmp, 'ring-no')));
});

test('--migrate 1 --migrate-to random: every batch one member from one other island drawn; the same on any thread count and after a resume', { skip }, () => {
  const args = [...TINY, '--genome', 'gen', '--list', '16', '--survivors', '8'];
  const isl = ['--islands', '4', '--migrate', '1', '--migrate-pick', 'random', '--migrate-to', 'random'];
  const dir = join(tmp, 'anywhere');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', '7']);
  assert.equal(events(dir, 'islands.jsonl')[0].migrateTo, 'random');
  const all = [1, 2, 3, 4].map((i) => events(join(dir, `island-0${i}`)));
  const from = new Map(); // island -> the islands it took from
  all.forEach((ev, k) => {
    const migrations = ev.filter((e) => e.type === 'migrate');
    assert.deepEqual(migrations.map((e) => e.batch), [1, 2, 3, 4, 5, 6], `island ${k + 1}: every batch after the first`);
    for (const m of migrations) {
      assert.equal(m.from.length, 1);
      assert.notEqual(m.from[0][0], k + 1, 'not from itself');
      from.set(k + 1, [...(from.get(k + 1) ?? []), m.from[0][0]]);
    }
  });
  // drawn: each island takes from more than one other, and not always from the one before it
  for (const [k, js] of from) assert.ok(new Set(js).size >= 2, `island ${k} took only from ${js}`);
  const ring = [...from].every(([k, js]) => js.every((j) => j === (k === 1 ? 4 : k - 1)));
  assert.ok(!ring);
  const again = join(tmp, 'anywhere-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '3']);
  run(again, ['--threads', '1', '--batches', '4']);
  [1, 2, 3, 4].forEach((i) => assert.deepEqual(stable(events(join(again, `island-0${i}`))), stable(all[i - 1]), `island ${i}`));
});

test('--island-variant: islands with their own settings, each the run alone with them; the same on any thread count and after a resume', { skip }, () => {
  // a picked panel: picked once, every island has it
  const args = [...without(TINY, '--panel-choice'), '--panel-choice', 'picked', '--pick-sample', '40', '--list', '16', '--survivors', '8'];
  const variant = '--screen-rounds 5  --list 12 --tie-points 0.5';
  const isl = ['--islands', '3', '--island-variant', '', '--island-variant', variant, '--migrate', '0'];
  const dir = join(tmp, 'var');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', '6']);
  const re = events(dir, 'islands.jsonl');
  assert.deepEqual(re[0].variants, ['', variant]);
  const all = [1, 2, 3].map((i) => events(join(dir, `island-0${i}`)));
  // islands 1 and 3 have the settings of the command line, island 2 those and the variant's
  const params = all.map((ev) => ev[0].params);
  assert.deepEqual([params[0].screenRounds, params[0].list, params[0].tiePoints], [10, 16, 1]);
  assert.deepEqual([params[1].screenRounds, params[1].list, params[1].tiePoints], [5, 12, 0.5]);
  assert.deepEqual({ ...params[2], seed: 0 }, { ...params[0], seed: 0 });
  assert.deepEqual(params.map((x) => x.seed), [7, 8, 9]);
  // island 2 is the run alone with the variant, the panel and holdout of the islands
  const panel = all[0][0].panel.map((w) => w.file).join(',');
  run(join(tmp, 'var-alone'), [...args, ...variant.split(/\s+/), '--seed', '8', '--draw-seed', '7', '--panel-files', panel, '--threads', '3', '--batches', '6']);
  const alone = events(join(tmp, 'var-alone'));
  assert.deepEqual(stable(all[1]).slice(1), stable(alone).slice(1));
  assert.deepEqual(all[1][0].panel, alone[0].panel);
  for (const ev of all) assert.deepEqual(ev[0].panel.map((w) => w.file), re[0].panel.split(','));
  // the same stopped and continued on other thread counts
  const again = join(tmp, 'var-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '2']);
  run(again, ['--threads', '1', '--batches', '4']);
  [1, 2, 3].forEach((i) => assert.deepEqual(stable(events(join(again, `island-0${i}`))), stable(all[i - 1]), `island ${i}`));
  // with --migrate: migrants between islands of other settings
  run(join(tmp, 'var-mig'), [...args, ...isl, '--migrate', '2', '--threads', '2', '--batches', '3']);
  assert.ok(events(join(tmp, 'var-mig', 'island-02')).some((e) => e.type === 'migrate'));
  // what must be alike, the options of the islands, more variants than islands, a word that is no option: refused
  const refused = [
    [['--island-variant', '--size 400'], /--island-variant '--size 400': --size, --cycles, --processes, --length or --distance the same for every island/],
    [['--island-variant', '--panel 12'], /--panel, --holdout, --panel-choice, --pick-sample or --panel-files the same/],
    [['--island-variant', '--genome gen'], /--genome the same/],
    [['--island-variant', '--seed 3'], /--seed or --draw-seed the same/],
    [['--island-variant', '--migrate 2'], /an option of the islands the same/],
    [['--island-variant', '--batches 9'], /--batches, --seconds/],
    [['--island-variant', '--screen-rounds 50'], /--screen-rounds at most --rounds/],
    [['--island-variant', '', '--island-variant', '', '--island-variant', '', '--island-variant', ''], /at most once per island/],
    [['--island-variant', 'elsewhere'], /usage/],
    [['--island-variant', '--tune-novel 1', '--migrate', '2'], /not with --tune-novel/],
  ];
  for (const [extra, message] of refused) {
    const r = spawnSync(evolve, [join(tmp, 'var-no'), ...args, '--islands', '3', ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, extra.join(' '));
    assert.match(r.stderr, message, extra.join(' '));
  }
  assert.ok(!existsSync(join(tmp, 'var-no')));
  // a variant without --islands
  assert.equal(spawnSync(evolve, [join(tmp, 'var-no'), ...args, '--island-variant', '--list 12', '--batches', '1'], { encoding: 'utf8', timeout: 60000 }).status, 2);
});

test('--island-panels own: each island its own panel from one round robin, one holdout for all in no panel; the same on any thread count and after a resume', { skip }, () => {
  // a picked panel of 6 from the strongest quarter of 80: 20 candidates, each island chooses from 10 of them
  const args = [...without(without(TINY, '--panel-choice'), '--panel'), '--panel-choice', 'picked', '--pick-sample', '80', '--panel', '6',
    '--list', '16', '--survivors', '8'];
  const isl = ['--islands', '4', '--island-panels', 'own', '--migrate', '0', '--island-variant', ''];
  const dir = join(tmp, 'own');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', '4']);
  const re = events(dir, 'islands.jsonl');
  assert.equal(re[0].islandPanels, 'own');
  assert.ok(!re.some((e) => e.type === 'pick'), 'no panel for all');
  const all = [1, 2, 3, 4].map((i) => events(join(dir, `island-0${i}`)));
  const files = (ws) => ws.map((w) => w.file);
  const panels = all.map((ev) => files(ev[0].panel));
  all.forEach((ev, k) => {
    // its panel is what its event pick names: 6 of the strongest quarter of the one round robin
    const pick = ev.find((e) => e.type === 'pick');
    assert.ok(pick, `island ${k + 1}: its pick`);
    assert.deepEqual(files(pick.picked), panels[k]);
    assert.equal(panels[k].length, 6);
    assert.ok(pick.picked.every((p) => p.rank < 20), `island ${k + 1}: ranks ${pick.picked.map((p) => p.rank)}`);
    assert.equal(pick.cut, all[0].find((e) => e.type === 'pick').cut);
    // the holdout: the same for every island, 8 warriors in no island's panel
    assert.deepEqual(files(ev[0].holdout), files(all[0][0].holdout));
    assert.equal(ev[0].holdout.length, 8);
    for (const p of panels) assert.ok(!files(ev[0].holdout).some((f) => p.includes(f)), 'a holdout warrior in a panel');
  });
  // the panels differ: no two islands have the same
  assert.equal(new Set(panels.map((p) => [...p].sort().join())).size, 4, panels.join(' | '));
  // shared: one panel, picked once
  const shared = join(tmp, 'own-shared');
  run(shared, [...args, ...isl.map((x) => (x === 'own' ? 'shared' : x)), '--threads', '2', '--batches', '1']);
  assert.equal(events(shared, 'islands.jsonl')[0].islandPanels, 'shared');
  assert.equal(new Set([1, 2, 3, 4].map((i) => files(events(join(shared, `island-0${i}`))[0].panel).join())).size, 1);
  // the same stopped and continued on other thread counts
  const again = join(tmp, 'own-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '1']);
  run(again, ['--threads', '1', '--batches', '3']);
  [1, 2, 3, 4].forEach((i) => assert.deepEqual(stable(events(join(again, `island-0${i}`))), stable(all[i - 1]), `island ${i}`));
  // a panel drawn or given, one island, or in a variant: refused
  const refused = [
    [['--islands', '3', '--island-panels', 'own', '--panel-choice', 'random'], /--island-panels own with 2 islands or more, a panel that is picked/],
    [['--islands', '3', '--island-panels', 'own', '--panel-files', 'imp.red,dwarf.red'], /--island-panels own with 2 islands or more/],
    [['--islands', '1', '--island-panels', 'own'], /--island-panels own with 2 islands or more/],
    [['--islands', '3', '--island-variant', '--island-panels own'], /an option of the islands the same/],
    [['--island-panels', 'own'], /usage/],
    [['--islands', '3', '--island-panels', 'mine'], /usage/],
  ];
  for (const [extra, message] of refused) {
    const r = spawnSync(evolve, [join(tmp, 'own-no'), ...args, ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, extra.join(' '));
    assert.match(r.stderr, message, extra.join(' '));
  }
  assert.ok(!existsSync(join(tmp, 'own-no')));
});

test('--migrate-to tree --leaf-restart: each island takes the best of its children, the leaves start over from random warriors in turns; the same on any thread count and after a resume', { skip }, () => {
  // warriors come back often (--reintroduce 0.3), to see that a leaf that started over has none of its old ones
  const args = [...TINY, '--list', '16', '--survivors', '8', '--reintroduce', '0.3'];
  const isl = ['--islands', '7', '--migrate', '2', '--migrate-to', 'tree', '--leaf-restart', '4', '--island-variant', ''];
  const dir = join(tmp, 'tree');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', '9']);
  const re = events(dir, 'islands.jsonl');
  assert.deepEqual([re[0].migrateTo, re[0].migratePick, re[0].leafRestart], ['tree', 'best', 4], 'a tree sends the best by default');
  const all = [1, 2, 3, 4, 5, 6, 7].map((i) => events(join(dir, `island-0${i}`)));
  const members = (ev, e) => e.values.map((v) => v[0]).filter((id) => !ev[0].panel.some((p) => p.id === id));
  // island i takes from 2i and 2i + 1, every 2 batches, the member best against the panel (the first on a tie)
  // after their batch before; the leaves 4 to 7 take from none
  const children = { 1: [2, 3], 2: [4, 5], 3: [6, 7] };
  all.forEach((ev, k) => {
    const mig = ev.filter((e) => e.type === 'migrate');
    if (!children[k + 1]) return assert.equal(mig.length, 0, `island ${k + 1} is a leaf`);
    assert.deepEqual(mig.map((e) => e.batch), [2, 4, 6, 8], `island ${k + 1}`);
    for (const m of mig) {
      assert.deepEqual(m.from.map((f) => f[0]), children[k + 1], `island ${k + 1} at batch ${m.batch}`);
      for (const [j, id] of m.from) {
        const cev = all[j - 1], vals = cev.filter((e) => e.type === 'values' && e.batch === m.batch - 1).at(-1);
        const ms = members(cev, vals), avg = new Map(vals.values.map((v) => [v[0], v[5]]));
        const best = ms.reduce((a, b) => (avg.get(b) > avg.get(a) ? b : a));
        assert.equal(id, best, `island ${k + 1} at batch ${m.batch}: the best of island ${j}`);
      }
    }
  });
  // leaf j of the 4 (islands 4 to 7) restarts at the batches b > 0 with b mod 4 = j
  const turns = { 4: [4, 8], 5: [1, 5], 6: [2, 6], 7: [3, 7] };
  all.forEach((ev, k) => {
    const rs = ev.filter((e) => e.type === 'restart');
    assert.deepEqual(rs.map((e) => e.batch), turns[k + 1] ?? [], `island ${k + 1}`);
    for (const r of rs) {
      // every member of the list leaves, then the batch fills the list with random warriors only
      const at = ev.indexOf(r), before = members(ev, ev.slice(0, at).filter((e) => e.type === 'values').at(-1));
      assert.equal(r.members, before.length);
      assert.deepEqual(ev.slice(at + 1, at + 1 + before.length).map((e) => [e.type, e.id]), before.map((id) => ['leave', id]));
      const entered = ev.filter((e) => e.type === 'enter' && e.batch === r.batch);
      assert.ok(entered.length > 0 && entered.every((e) => e.ops === 'random' && !e.parents.length), `island ${k + 1} at batch ${r.batch}`);
    }
    // the archive is forgotten too: a warrior that comes back (--reintroduce) was born after the leaf's last restart
    const born = new Map(ev.filter((e) => e.type === 'enter').map((e) => [e.id, e.batch]));
    for (const e of ev.filter((x) => x.type === 'enter' && x.ops === 'reintroduce')) {
      const last = rs.filter((x) => x.batch <= e.batch).at(-1);
      if (last) assert.ok(born.get(e.parents[0]) >= last.batch, `island ${k + 1}: ${e.id} at batch ${e.batch} brings back ${e.parents[0]}`);
    }
  });
  const back = all.slice(3).flatMap((ev) => {
    const first = ev.find((e) => e.type === 'restart')?.batch;
    return ev.filter((e) => e.type === 'enter' && e.ops === 'reintroduce' && e.batch > first);
  });
  assert.ok(back.length >= 3, `warriors that came back to a leaf after a restart: ${back.length}`);
  // the same stopped and continued on other thread counts
  const again = join(tmp, 'tree-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '5']);
  run(again, ['--threads', '1', '--batches', '4']);
  all.forEach((ev, k) => assert.deepEqual(stable(events(join(again, `island-0${k + 1}`))), stable(ev), `island ${k + 1}`));
  // restarts without a tree, a tree of 2, or in a variant: refused
  const refused = [
    [['--islands', '7', '--leaf-restart', '4'], /--leaf-restart with --migrate-to tree/],
    [['--islands', '7', '--migrate-to', 'next', '--leaf-restart', '4'], /--leaf-restart with --migrate-to tree/],
    [['--islands', '2', '--migrate-to', 'tree'], /--migrate-to tree with 3 islands or more/],
    [['--islands', '7', '--migrate-to', 'tree', '--island-variant', '--leaf-restart 4'], /an option of the islands the same/],
    [['--leaf-restart', '4'], /usage/],
  ];
  for (const [extra, message] of refused) {
    const r = spawnSync(evolve, [join(tmp, 'tree-no'), ...args, ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, extra.join(' '));
    assert.match(r.stderr, message, extra.join(' '));
  }
  assert.ok(!existsSync(join(tmp, 'tree-no')));
});

test('--nemesis-every: the weakest island makes way for one whose panel is what the champion does worst against; the same on any thread count and after a resume', { skip }, () => {
  const N = 4, SCORE = 5, BATCHES = 17;
  const args = [...TINY, '--list', '16', '--survivors', '8'];
  const isl = ['--islands', '4', '--select-after', '2', '--score-rounds', String(SCORE), '--nemesis-every', String(N), '--migrate', '1', '--island-variant', ''];
  const dir = join(tmp, 'nemesis');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', String(BATCHES)]);
  const re = events(dir, 'islands.jsonl');
  assert.equal(re[0].nemesisEvery, N);
  const nem = re.filter((e) => e.type === 'nemesis'), scores = re.filter((e) => e.type === 'score');
  assert.deepEqual(nem.map((e) => e.batch), [4, 8, 12, 16], 'at every N-th batch, at a score');
  const island = (i) => events(join(dir, `island-${String(i).padStart(2, '0')}`));
  const holdout = island(1)[0].holdout.map((w) => w.file);
  const live = new Set([1, 2, 3, 4]), since = new Map();
  let count = 4;
  const m = createMarsSync(RULES);
  for (const n of nem) {
    const s = scores.find((x) => x.batch === n.batch);
    // the champion: the best warrior of that score, the first on a tie
    const ws = s.islands.flatMap((x) => x.warriors.map((w) => ({ ...w, island: x.island })));
    const c = ws.reduce((a, b) => (b.score > a.score ? b : a));
    assert.deepEqual(n.champion, { island: c.island, id: c.id, score: c.score }, `batch ${n.batch}`);
    // the island that stops: the weakest by its score, not the champion's, not a nemesis island younger than 2 N
    const can = s.islands.filter((x) => live.has(x.island) && x.island !== c.island && !(since.has(x.island) && n.batch < since.get(x.island) + 2 * N));
    const weak = can.reduce((a, b) => (b.score < a.score ? b : a));
    assert.equal(n.stopped, weak.island, `batch ${n.batch}`);
    assert.equal(n.island, ++count, 'the next number');
    live.delete(n.stopped), live.add(n.island), since.set(n.island, n.batch);
    // its panel: the champion's matches against the folder replayed with the score's seeds, the worst first (the
    // folder's order on a tie), none of the holdout, as many as the panel
    const src = island(c.island).find((e) => e.type === 'enter' && e.id === c.id).code, me = assemble(`;redcode\n;name x\n${src}`, RULES);
    const pts = s.files.map((file, o) => {
      const r = m.runMatch([me, assemble(readFileSync(join(root, 'warriors/koenigstuhl/tiny', file), 'latin1'), RULES)], { seed: s.seeds[o], rounds: SCORE });
      return { file, points: ((3 * r.warriors[0].wins + r.warriors[0].ties) * 100) / SCORE, o };
    });
    const want = pts.filter((x) => !holdout.includes(x.file)).sort((a, b) => a.points - b.points || a.o - b.o).slice(0, 10);
    assert.deepEqual(n.panel.map((x) => x.file), want.map((x) => x.file), `batch ${n.batch}: the panel`);
    assert.deepEqual(n.panel.map((x) => x.points), want.map((x) => x.points));
    // the new island: that panel, the islands' holdout, the settings and seed of an island, from the batch of the others
    const ev = island(n.island);
    assert.deepEqual(ev[0].panel.map((w) => w.file), want.map((x) => x.file));
    assert.deepEqual(ev[0].holdout.map((w) => w.file), holdout);
    assert.equal(ev[0].params.seed, 7 + n.island - 1);
    assert.equal(ev.find((e) => e.type === 'batch').batch, n.batch, 'its first batch is the batch of the others');
    assert.ok(ev.filter((e) => e.type === 'enter' && e.batch === n.batch).every((e) => e.ops === 'random'), 'it starts from random warriors');
    // no migrants for its first N batches, then as every island
    const mig = ev.filter((e) => e.type === 'migrate').map((e) => e.batch);
    assert.ok(mig.every((b) => b >= n.batch + N), `island ${n.island} took migrants at ${mig}`);
    if (n.batch + N < BATCHES) assert.ok(mig.includes(n.batch + N), `island ${n.island} took no migrants at ${n.batch + N}`);
  }
  assert.ok([...since.keys()].some((i) => !live.has(i)), 'a nemesis island stopped too, once 2 N old');
  // 2 islands, N = 2: at every score the rule; where the only island that could stop is the champion's (the other
  // is a nemesis island younger than 2 N), none stops (here at batch 6)
  const two = join(tmp, 'nemesis-two');
  run(two, [...args, '--islands', '2', '--select-after', '2', '--score-rounds', String(SCORE), '--nemesis-every', '2', '--migrate', '1',
    '--island-variant', '', '--threads', '2', '--batches', '11']);
  const re2 = events(two, 'islands.jsonl'), live2 = new Set([1, 2]), since2 = new Map();
  let none = 0, count2 = 2;
  for (const s of re2.filter((e) => e.type === 'score')) {
    const c = s.islands.flatMap((x) => x.warriors.map((w) => ({ ...w, island: x.island }))).reduce((a, b) => (b.score > a.score ? b : a));
    const can = s.islands.filter((x) => live2.has(x.island) && x.island !== c.island && !(since2.has(x.island) && s.batch < since2.get(x.island) + 4));
    const n = re2.find((e) => e.type === 'nemesis' && e.batch === s.batch);
    if (!can.length) {
      assert.equal(n, undefined, `batch ${s.batch}: only the champion's island could stop`);
      none++;
      continue;
    }
    assert.equal(n.stopped, can.reduce((a, b) => (b.score < a.score ? b : a)).island, `batch ${s.batch}`);
    live2.delete(n.stopped), live2.add(++count2), since2.set(count2, s.batch);
  }
  assert.ok(none >= 1, 'a score where no island could stop');
  // the same stopped and continued on other thread counts, also across a nemesis
  const again = join(tmp, 'nemesis-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '6']);
  run(again, ['--threads', '1', '--batches', String(BATCHES - 6)]);
  for (let i = 1; i <= count; i++) assert.deepEqual(stable(events(join(again, `island-${String(i).padStart(2, '0')}`))), stable(island(i)), `island ${i}`);
  assert.deepEqual(stable(events(again, 'islands.jsonl')).map((e) => ({ ...e, threads: 0 })), stable(re).map((e) => ({ ...e, threads: 0 })));
  // not at a score, without scores, with --keep or a tree, in a variant, without --islands: refused
  const refused = [
    [['--islands', '4', '--select-after', '2', '--nemesis-every', '3'], /--nemesis-every with 2 islands or more, a multiple of --select-after/],
    [['--islands', '4', '--nemesis-every', '4'], /--nemesis-every with 2 islands or more, a multiple of --select-after/],
    [['--islands', '4', '--select-after', '2', '--keep', '2', '--nemesis-every', '4'], /not with --keep or --migrate-to tree/],
    [['--islands', '4', '--select-after', '2', '--migrate-to', 'tree', '--nemesis-every', '4'], /not with --keep or --migrate-to tree/],
    [['--islands', '4', '--select-after', '2', '--island-variant', '--nemesis-every 4'], /an option of the islands the same/],
    [['--nemesis-every', '4'], /usage/],
  ];
  for (const [extra, message] of refused) {
    const r = spawnSync(evolve, [join(tmp, 'nemesis-no'), ...args, ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, extra.join(' '));
    assert.match(r.stderr, message, extra.join(' '));
  }
  assert.ok(!existsSync(join(tmp, 'nemesis-no')));
});

test('--explorers: the last K islands take no migrants, the others take from all of them; the same on any thread count and after a resume', { skip }, () => {
  const args = [...TINY, '--list', '16', '--survivors', '8'];
  const isl = ['--islands', '5', '--explorers', '3', '--migrate', '1', '--island-variant', ''];
  const dir = join(tmp, 'explorers');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', '9']);
  assert.equal(events(dir, 'islands.jsonl')[0].explorers, 3);
  const all = [1, 2, 3, 4, 5].map((i) => events(join(dir, `island-0${i}`)));
  const from = all.map((ev) => ev.filter((e) => e.type === 'migrate'));
  for (const k of [2, 3, 4]) assert.equal(from[k].length, 0, `island ${k + 1} is an explorer`);
  // the core (islands 1 and 2) takes a member every batch, from an island drawn among all others, explorers too
  for (const k of [0, 1]) {
    assert.deepEqual(from[k].map((e) => e.batch), [1, 2, 3, 4, 5, 6, 7, 8], `island ${k + 1}`);
    const sources = new Set(from[k].flatMap((e) => e.from.map((f) => f[0])));
    assert.ok([3, 4, 5].some((j) => sources.has(j)), `island ${k + 1} took from ${[...sources]}`);
    assert.ok(!sources.has(k + 1));
  }
  // an explorer is the run alone: no warrior of another island ever enters it
  for (const k of [2, 3, 4]) assert.ok(!all[k].some((e) => e.type === 'enter' && e.ops === 'migrant'), `island ${k + 1}`);
  // the same stopped and continued on other thread counts
  const again = join(tmp, 'explorers-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '4']);
  run(again, ['--threads', '1', '--batches', '5']);
  all.forEach((ev, k) => assert.deepEqual(stable(events(join(again, `island-0${k + 1}`))), stable(ev), `island ${k + 1}`));
  // no core, no migration, a tree, nemesis islands, --keep, in a variant, without --islands: refused
  const refused = [
    [['--islands', '3', '--explorers', '3'], /--explorers fewer than the islands/],
    [['--islands', '3', '--explorers', '1', '--migrate', '0'], /--explorers fewer than the islands, with migration/],
    [['--islands', '3', '--explorers', '1', '--migrate-to', 'tree'], /not with --migrate-to tree/],
    [['--islands', '3', '--explorers', '1', '--select-after', '2', '--nemesis-every', '2'], /not with --migrate-to tree, --nemesis-every/],
    [['--islands', '3', '--explorers', '1', '--select-after', '2', '--keep', '2'], /--nemesis-every or --keep/],
    [['--islands', '3', '--island-variant', '--explorers 1'], /an option of the islands the same/],
    [['--explorers', '1'], /usage/],
  ];
  for (const [extra, message] of refused) {
    const r = spawnSync(evolve, [join(tmp, 'explorers-no'), ...args, ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, extra.join(' '));
    assert.match(r.stderr, message, extra.join(' '));
  }
  assert.ok(!existsSync(join(tmp, 'explorers-no')));
});

test('--optimize: the constants of a warrior, steps confirmed with other seeds, the same on any thread count', { skip }, () => {
  // a stone whose step of 100 bombs 8 cells of a core of 800
  const file = join(tmp, 'badstep.red');
  writeFileSync(file, ';redcode\n;name bad step\nstep equ 100\nloop add.ab #step, bomb\nmov.i bomb, @bomb\njmp loop\nbomb dat #0, #step\n');
  const args = ['--optimize', file, ...TINY.slice(0, TINY.indexOf('--panel')), '--panel', '12', '--holdout', '8', '--rounds', '60', '--seed', '3', '--positions', 'pmars'];
  run(join(tmp, 'opt1'), [...args, '--threads', '1']);
  const one = events(join(tmp, 'opt1'));
  const start = one[0], end = one.at(-1), steps = one.filter((e) => e.type === 'optimize-step');
  assert.equal(start.type, 'optimize');
  assert.equal(end.type, 'optimize-end');
  assert.ok(steps.length >= 1 && end.avg > start.avg + 20, `${steps.length} steps, ${start.avg} to ${end.avg}`);
  for (const s of steps) assert.ok(s.gain > 2 * s.se && s.confirm > 2 * s.confirmSe, JSON.stringify(s));
  // the optimized warrior against the panel, replayed in the WebAssembly engine with the logged seeds
  const opt = assemble(readFileSync(join(tmp, 'opt1', 'optimized.red'), 'latin1'), RULES);
  assert.ok(opt.ok);
  const m = createMarsSync(RULES);
  let sum = 0;
  for (const p of start.panel) {
    const r = m.runMatch([opt, assemble(readFileSync(join(root, 'warriors/koenigstuhl/tiny', p.file), 'latin1'), RULES)], { seed: p.seed, rounds: start.rounds });
    sum += ((3 * r.warriors[0].wins + r.warriors[0].ties) * 100) / start.rounds;
  }
  assert.ok(Math.abs(sum / start.panel.length - end.avg) < 1e-6, `replayed ${sum / start.panel.length}, logged ${end.avg}`);
  assert.match(readFileSync(join(tmp, 'opt1', 'optimized.red'), 'latin1'), /;strategy bad step with its constants optimized by 42evolve: \d+ steps/);
  run(join(tmp, 'opt3'), [...args, '--threads', '3']);
  assert.deepEqual(events(join(tmp, 'opt3')), one);
  // a hill warrior whose constants are good already: what it might accept is
  // near the noise, and every step taken must be clear of it twice
  const hill = ['--optimize', join(root, 'warriors/koenigstuhl/tiny/afterstorm.red'), ...args.slice(2)];
  run(join(tmp, 'opt-hill'), [...hill, '--threads', '4']);
  const h = events(join(tmp, 'opt-hill'));
  for (const s of h.filter((e) => e.type === 'optimize-step')) assert.ok(s.gain > 2 * s.se && s.confirm > 2 * s.confirmSe, JSON.stringify(s));
  assert.ok(h.at(-1).avg >= h[0].avg, `${h[0].avg} to ${h.at(-1).avg}`);
});
