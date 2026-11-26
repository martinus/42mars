// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --migrate-pick and --migrate-to, split from evolver-migrate.test.js so
// that CI runs them at the same time (#161). What the evolver's test files
// share is in test/evolver-common.js; built with cc, or prebuilt in M42_BIN
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
