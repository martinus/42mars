// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// bench/native-loops.mjs compares the machine code of the three hot loops
// and of exec_more of two builds. Here on small C files with functions of those names.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loopCode } from '../bench/native-loops.mjs';
import { hasCc } from './native.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'native-loops-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

test('loopCode takes a function with its parts and masks addresses', () => {
  const disassembly = [
    '0000000000000010 <execute>:',
    '  10:\tmov    0x20(%rip),%eax        # 30 <data>',
    '  17:\tcall   40 <helper>',
    '',
    '0000000000000040 <execute2_any>:',
    '  40:\tret',
    '',
    '0000000000000050 <execute.cold>:',
    '  50:\tjmp    10 <execute>',
  ].join('\n');
  assert.deepEqual(loopCode(disassembly, 'execute'), [
    '<execute>:', 'mov RIP,%eax # ADDR', 'call ADDR', '<execute.cold>:', 'jmp ADDR',
  ]);
  assert.deepEqual(loopCode(disassembly, 'execute2'), []);
});

const source = (loop, other, more = 0) => `
__attribute__((noinline)) int other(int x) { return x * ${other}; }
__attribute__((noinline)) int execute(int x) { return x + 1; }
__attribute__((noinline)) int execute2_8000(int x) { return x ^ 7; }
__attribute__((noinline)) int execute2_any(int x) { return x * ${loop} + other(x); }
${more ? `__attribute__((noinline)) int exec_more(int x) { return x * ${more}; }` : ''}
`;
const tool = (a, b) => spawnSync('node', [join(root, 'bench/native-loops.mjs'), '--cc', 'cc', '--files', a, b], { encoding: 'utf8' });

test('bench/native-loops.mjs: same when only another function changed, DIFFERS for a loop', { skip: !hasCc && 'no cc' }, () => {
  const files = [[3, 5], [3, 9], [5, 5]].map(([loop, other], k) => {
    const f = join(tmp, `${k}.c`);
    writeFileSync(f, source(loop, other));
    return f;
  });
  const same = tool(files[0], files[1]);
  assert.equal(same.status, 0, same.stderr);
  assert.equal(same.stdout.split('\n').filter((l) => / same \(\d+ lines\)$/.test(l)).length, 6, same.stdout);
  const differs = tool(files[0], files[2]);
  assert.equal(differs.status, 1, differs.stderr);
  assert.match(differs.stdout, /^cc execute2_any: DIFFERS$/m);
  assert.match(differs.stdout, /^cc -DM42_FIXED_CONTEXT execute2_any: DIFFERS$/m);
  assert.match(differs.stdout, /^cc execute: same/m);
  assert.doesNotMatch(same.stdout, /exec_more/); // neither file has it
});

test('bench/native-loops.mjs compares exec_more where a build has it', { skip: !hasCc && 'no cc' }, () => {
  const files = [[3, 5, 7], [3, 5, 9], [3, 5, 0]].map(([loop, other, more], k) => {
    const f = join(tmp, `more-${k}.c`);
    writeFileSync(f, source(loop, other, more));
    return f;
  });
  const same = tool(files[0], files[0]);
  assert.equal(same.status, 0, same.stderr);
  assert.match(same.stdout, /^cc exec_more: same/m);
  for (const other of [files[1], files[2]]) { // another exec_more, and none
    const differs = tool(files[0], other);
    assert.equal(differs.status, 1, differs.stderr);
    assert.match(differs.stdout, /^cc exec_more: DIFFERS$/m);
    assert.match(differs.stdout, /^cc execute: same/m);
  }
});

test('bench/native-loops.mjs refuses unknown options', () => {
  const r = spawnSync('node', [join(root, 'bench/native-loops.mjs'), '--bogus'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown argument --bogus/);
});
