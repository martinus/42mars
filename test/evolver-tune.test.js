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
    '--screen-members', '0', '--diversity', 'all', '--no-fill', '--panel-choice', 'random', '--stage', '0', '--positions', 'pmars'];
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

test('--islands: runs in one process with the same panel and holdout, in turns; the best go on after their scores against the folder; the same on any thread count and after a resume', { skip }, () => {
  const N = 3, EVERY = 4, KEEP = 2, BATCHES = 9, SCORE = 5;
  // a picked panel, to see it picked once
  const args = [...without(TINY, '--panel-choice'), '--panel-choice', 'picked', '--pick-sample', '40',
    '--average', 'panel', '--list', '16', '--survivors', '8'];
  const isl = ['--islands', String(N), '--select-after', String(EVERY), '--keep', String(KEEP), '--score-rounds', String(SCORE)];
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
  all.forEach((ev, k) => assert.equal(batchesOf(ev), s1.kept.includes(k + 1) ? BATCHES : EVERY, `batches of island ${k + 1}: in turns`));
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
  const isl = ['--islands', String(N), '--migrate', String(M)];
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
        // the islands take turns: one before this one has played its batch m.batch already, one after it not yet
        const src = all[j - 1], upTo = j < k + 1 ? m.batch : m.batch - 1;
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
