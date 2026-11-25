// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --optimize, --islands. What the evolver's test files share is in
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

before(setup);
after(cleanup);

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
  // without islands, or with one: refused
  for (const extra of [['--migrate', '2'], ['--islands', '1', '--migrate', '2']]) {
    const r = spawnSync(evolve, [join(tmp, 'mig-no'), ...args(40), ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, extra.join(' '));
  }
  assert.ok(!existsSync(join(tmp, 'mig-no')));
});

test('--migrate-pick random --migrate-to all: a member drawn from every other island; the same on any thread count and after a resume', { skip }, () => {
  const args = [...TINY, '--genome', 'gen', '--list', '16', '--survivors', '8'];
  const isl = ['--islands', '3', '--migrate', '2', '--migrate-pick', 'random', '--migrate-to', 'all'];
  const dir = join(tmp, 'ring');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', '7']);
  const re = events(dir, 'islands.jsonl');
  assert.deepEqual([re[0].migrate, re[0].migratePick, re[0].migrateTo], [2, 'random', 'all']);
  const all = [1, 2, 3].map((i) => events(join(dir, `island-0${i}`)));
  const panel = new Set(all[0][0].panel.map((w) => w.id));
  let notBest = 0, notFirst = 0;
  all.forEach((ev, k) => {
    const migrations = ev.filter((e) => e.type === 'migrate');
    assert.deepEqual(migrations.map((e) => e.batch), [2, 4, 6]);
    for (const m of migrations) {
      // one migrant from each other island
      assert.deepEqual(m.from.map(([i]) => i), [1, 2, 3].filter((i) => i !== k + 1), `island ${k + 1}, batch ${m.batch}`);
      for (const [j, id] of m.from) {
        // a member of that island then, as the round before left it
        const src = all[j - 1], upTo = m.batch - 1;
        const vals = src.filter((e) => e.type === 'values' && e.batch <= upTo).at(-1).values.filter((v) => !panel.has(v[0]));
        assert.ok(vals.some((v) => v[0] === id), `island ${k + 1}, batch ${m.batch}: ${id} is no member of island ${j}`);
        if (id !== vals.reduce((a, b) => (b[5] > a[5] ? b : a))[0]) notBest++;
        if (id !== vals[0][0]) notFirst++; // drawn from the whole list, not one place of it
      }
    }
  });
  assert.ok(notBest >= 8 && notFirst >= 8, `of 18 migrants ${notBest} not the best of their island, ${notFirst} not its first member`);
  // the same stopped and continued on other thread counts
  const again = join(tmp, 'ring-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '3']);
  run(again, ['--threads', '1', '--batches', '4']);
  [1, 2, 3].forEach((i) => assert.deepEqual(stable(events(join(again, `island-0${i}`))), stable(all[i - 1]), `island ${i}`));
  // with --migrate 0, or another value: refused
  for (const extra of [['--islands', '3', '--migrate', '0', '--migrate-pick', 'random'], ['--islands', '3', '--migrate', '0', '--migrate-to', 'all'], ['--islands', '3', '--migrate', '2', '--migrate-pick', 'worst']]) {
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
  ];
  refuses(join(tmp, 'var-no'), [...args, '--islands', '3'], refused);
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
  refuses(join(tmp, 'own-no'), args, refused);
  // too few candidates (10 of a sample of 40 for a panel of 10): every island would get the same panel
  const few = spawnSync(evolve, [join(tmp, 'own-few'), ...without(args, '--pick-sample', '--panel'), '--pick-sample', '40', '--panel', '10', ...isl, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
  assert.notEqual(few.status, 0);
  assert.match(few.stderr, /--island-panels own: 10 candidates of a sample of 40 for a panel of 10; it needs twice the panel/);
  // a holdout of 420, more than the warriors in no panel (of the 436 files, those that fit the rules): each island the
  // same, as many as there are, in no panel
  const big = join(tmp, 'own-holdout');
  run(big, [...without(args, '--holdout'), '--holdout', '420', ...isl, '--threads', '4', '--batches', '1']);
  const starts = [1, 2, 3, 4].map((i) => events(join(big, `island-0${i}`))[0]);
  const inPanels = new Set(starts.flatMap((e) => files(e.panel)));
  for (const e of starts) {
    assert.deepEqual(files(e.holdout), files(starts[0].holdout));
    assert.ok(!files(e.holdout).some((x) => inPanels.has(x)), 'a holdout warrior in a panel');
  }
  // of the warriors that fit the rules all are in a panel or the holdout: fewer than 420 are left
  assert.ok(starts[0].holdout.length < 420, `a holdout of ${starts[0].holdout.length}`);
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
  // no core, no migration, --keep, in a variant, without --islands: refused
  const refused = [
    [['--islands', '3', '--explorers', '3'], /--explorers fewer than the islands/],
    [['--islands', '3', '--explorers', '1', '--migrate', '0'], /needs migration \(not with --migrate 0\)/],
    [['--islands', '3', '--explorers', '1', '--select-after', '2', '--keep', '2'], /--explorers fewer than the islands, not with --keep/],
    [['--islands', '3', '--island-variant', '--explorers 1'], /an option of the islands the same/],
    [['--explorers', '1'], /usage/],
  ];
  refuses(join(tmp, 'explorers-no'), args, refused);
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
