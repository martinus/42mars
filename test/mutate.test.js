// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// .claude/skills/engine-check/mutate.mjs, the mutation runner of the
// engine-check skill: one caught and one surviving mutant on a file in a
// temporary folder, the file restored afterwards.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../.claude/skills/engine-check/mutate.mjs', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'mutate-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

test('mutate.mjs: reports caught and surviving mutants and restores the file', () => {
  writeFileSync(join(tmp, 'x.txt'), 'a=1\n');
  writeFileSync(join(tmp, 'mutants.json'), JSON.stringify([
    { name: 'caught', file: 'x.txt', old: 'a=1', new: 'a=2' },
    { name: 'survives', file: 'x.txt', old: 'a=1', new: 'a=3' },
    { name: 'missing', file: 'x.txt', old: 'b=1', new: 'b=2' },
  ]));
  const check = "const t = require('fs').readFileSync('x.txt', 'utf8'); if (t.includes('a=2')) { console.log('not ok 1 - a is 2'); process.exit(1); }";
  const r = spawnSync('node', [script, 'mutants.json', '--timeout', '30', '--', 'node', '-e', check], { cwd: tmp, encoding: 'utf8' });
  assert.equal(r.status, 1, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n'), [
    '== caught: FAILS: not ok 1 - a is 2',
    '== survives: SURVIVED',
    '== missing: "old" occurs 0 times in x.txt, skipped',
  ]);
  assert.equal(readFileSync(join(tmp, 'x.txt'), 'utf8'), 'a=1\n');
});

test('mutate.mjs refuses an unknown option and a missing command', () => {
  for (const args of [['m.json', '--fast', '--', 'true'], ['m.json'], ['m.json', '--timeout', '--', 'true']]) {
    assert.equal(spawnSync('node', [script, ...args], { cwd: tmp }).status, 2, args.join(' '));
  }
});
