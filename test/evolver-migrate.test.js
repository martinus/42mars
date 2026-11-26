// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// migration between islands and --explorers, split from evolver-tune.test.js
// so that CI runs the two files at the same time (#161). What the evolver's
// test files share is in test/evolver-common.js; built with cc, or prebuilt
// in M42_BIN (test/native.js). POSIX only.

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

test('--start with a folder island-NN in it: island NN starts from that folder, the others from the folder itself', { skip }, () => {
  const start = join(tmp, 'island-starts');
  mkdirSync(join(start, 'island-02'), { recursive: true });
  copyFileSync(join(root, 'warriors', 'imp.red'), join(start, 'imp.red'));
  copyFileSync(join(root, 'warriors', 'dwarf.red'), join(start, 'island-02', 'dwarf.red'));
  const args = [...TINY, '--start', start, '--islands', '3', '--migrate', '0', '--island-variant', ''];
  const dir = join(tmp, 'island-starts-run');
  run(dir, [...args, '--threads', '2', '--batches', '2']);
  const all = [1, 2, 3].map((i) => events(join(dir, `island-0${i}`)));
  assert.deepEqual(all.map((ev) => ev[0].params.start ?? ev[0].start), [start, join(start, 'island-02'), start]);
  assert.deepEqual(all.map((ev) => ev[0].startWarriors.map((w) => w.name)), [['Imp'], ['Dwarf'], ['Imp']]);
  all.forEach((ev, k) => {
    const first = ev.filter((e) => e.type === 'enter' && e.batch === 0);
    assert.ok(first.some((e) => e.ops === 'start') && first.every((e) => e.ops === 'start' || !e.ops.includes('random')), `island ${k + 1}`);
  });
  // the same stopped and continued on another thread count
  const again = join(tmp, 'island-starts-resumed');
  run(again, [...args, '--threads', '3', '--batches', '1']);
  run(again, ['--threads', '1', '--batches', '1']);
  all.forEach((ev, k) => assert.deepEqual(stable(events(join(again, `island-0${k + 1}`))), stable(ev), `island ${k + 1}`));
});
