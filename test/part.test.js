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
import { files, NATIVE, parts, SECONDS } from './part.mjs';

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

test('the parts are about even, and the tables name only files that exist', () => {
  for (const [name, table] of [['SECONDS', SECONDS], ['NATIVE', NATIVE]]) {
    for (const f of Object.keys(table)) assert.ok(existsSync(`${root}/${f}`), `${f} is in ${name} of part.mjs but not in test/`);
    const time = (f) => table[f] ?? 20;
    const t = (list) => list.reduce((s, f) => s + time(f), 0);
    for (let n = 2; n <= 8; n++) {
      const p = parts(n, files(), table), sums = p.map(t), top = Math.max(...sums), k = sums.indexOf(top);
      // with two parts at the top (up to rounding) no single move makes the longest part shorter
      if (sums.filter((x) => Math.abs(x - top) < 1e-6).length > 1) continue;
      // no single file that moves from the longest part to another, or swaps with one there, makes it shorter
      for (let q = 0; q < n; q++) {
        if (q === k) continue;
        for (const f of p[k]) {
          for (const g of [null, ...p[q]]) {
            const d = time(f) - (g ? time(g) : 0);
            assert.ok(!(d > 0 && Math.max(top - d, sums[q] + d) < top - 1e-9), `${name}, ${n} parts of ${sums.join(', ')} s: ${f} to part ${q + 1}${g ? ` for ${g}` : ''} is shorter`);
          }
        }
      }
    }
  }
});

test('the command prints part k of n, and refuses a part that does not exist', () => {
  assert.equal(execFileSync(process.execPath, [`${root}/test/part.mjs`, '2/3'], { encoding: 'utf8' }).trim(), parts(3)[1].join(' '));
  // native: the times of the native build
  assert.equal(execFileSync(process.execPath, [`${root}/test/part.mjs`, '1/2', 'native'], { encoding: 'utf8' }).trim(), parts(2, files(), NATIVE)[0].join(' '));
  assert.notDeepEqual(parts(3, files(), NATIVE), parts(3));
  for (const bad of [['0/3'], ['4/3'], ['1'], ['x/2'], ['1/2', 'asan'], ['1/2', 'native', 'x']]) {
    const r = spawnSync(process.execPath, [`${root}/test/part.mjs`, ...bad], { encoding: 'utf8' });
    assert.equal(r.status, 2, bad);
    assert.match(r.stderr, /usage/);
  }
});
