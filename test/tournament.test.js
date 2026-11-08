// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'tournament-test-'));

function run(engine, seed, name) {
  const out = join(dir, `${name}.json`);
  execFileSync(process.execPath, [join(root, 'tools/tournament.mjs'), join(root, 'warriors'),
    '--rounds', '20', '--jobs', '3', '--seed', String(seed), '--engine', engine, '--json', out], { stdio: 'ignore' });
  return JSON.parse(readFileSync(out, 'utf8'));
}

const pairings = (t) => t.results.map((r) => [r.a, r.b]);

test('tournament: js and wasm engines give the same result for every pairing', () => {
  const js = run('js', 5, 'js');
  const wasm = run('wasm', 5, 'wasm');
  assert.equal(js.pairs.length, 10); // 5 sample warriors
  assert.deepEqual(js.pairs, wasm.pairs);
  assert.deepEqual(pairings(js), pairings(wasm));
  for (const [a, b] of pairings(js)) {
    assert.equal(a[0] + a[1] + a[2], 20);
    assert.deepEqual([a[0], a[1], a[2]], [b[1], b[0], b[2]]);
  }
  assert.deepEqual(js.ranking.map((r) => [r.name, r.score]), wasm.ranking.map((r) => [r.name, r.score]));
});

test('tournament: the same seed gives the same results, another seed other positions', () => {
  const a = run('wasm', 9, 'a');
  const b = run('wasm', 9, 'b');
  const c = run('wasm', 10, 'c');
  assert.deepEqual(pairings(a), pairings(b));
  assert.deepEqual(a.pairs, b.pairs);
  assert.notDeepEqual(a.pairs.map((p) => p.pos), c.pairs.map((p) => p.pos));
});
