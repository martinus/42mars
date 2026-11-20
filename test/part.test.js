// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// test/part.mjs, the parts of the tests of the C programs that CI runs at
// the same time (#161): every file of `make test` in exactly one part.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { files, parts, SECONDS } from './part.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('every test file of make test is in exactly one part, for 1 to 5 parts', () => {
  // the files are the Makefile's list, expanded
  assert.match(readFileSync(`${root}/Makefile`, 'utf8'), /^TESTS = test\/c-api\.test\.js test\/cli\.test\.js test\/evolver\*\.test\.js$/m);
  const expected = ['test/c-api.test.js', 'test/cli.test.js', ...readdirSync(`${root}/test`).filter((f) => /^evolver.*\.test\.js$/.test(f)).sort().map((f) => `test/${f}`)];
  assert.deepEqual(files(), expected);
  for (let n = 1; n <= 5; n++) {
    const p = parts(n);
    assert.equal(p.length, n);
    assert.deepEqual(p.flat().sort(), [...expected].sort(), `${n} parts`);
    for (const x of p) assert.ok(x.length > 0, `${n} parts: an empty one`);
  }
  // a file that is not in the table still gets a part
  const more = [...expected, 'test/evolver-new.test.js'];
  assert.deepEqual(parts(3, more).flat().sort(), [...more].sort());
});

test('the parts are about even, and the table names only files that exist', () => {
  for (const f of Object.keys(SECONDS)) assert.ok(existsSync(`${root}/${f}`), `${f} is in the table of part.mjs but not in test/`);
  const t = (list) => list.reduce((s, f) => s + (SECONDS[f] ?? 5), 0);
  const p = parts(3).map(t);
  assert.ok(Math.max(...p) - Math.min(...p) <= Math.max(...Object.values(SECONDS)), `3 parts of ${p.join(', ')} seconds`);
});

test('the command prints part k of n, and refuses a part that does not exist', () => {
  const run = (arg) => spawnSync(process.execPath, [`${root}/test/part.mjs`, arg], { encoding: 'utf8' });
  assert.equal(execFileSync(process.execPath, [`${root}/test/part.mjs`, '2/3'], { encoding: 'utf8' }).trim(), parts(3)[1].join(' '));
  for (const bad of ['0/3', '4/3', '1', 'x/2']) {
    const r = run(bad);
    assert.equal(r.status, 2, bad);
    assert.match(r.stderr, /usage/);
  }
});
