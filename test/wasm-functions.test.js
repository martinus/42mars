// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// bench/wasm-functions.mjs compares the function bodies of two wasm
// modules; its last line says whether the four largest (the hot loops and
// exec_more) are the same, differ only in call operands, or differ. Modules here are
// built by hand: the tool reads only the code section.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'wasm-functions-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const leb = (n) => {
  const out = [];
  do { let b = n & 127; n >>>= 7; if (n) b |= 128; out.push(b); } while (n);
  return out;
};
// A module with only a code section holding these function bodies.
function module(name, bodies) {
  const code = [...leb(bodies.length), ...bodies.flatMap((b) => [...leb(b.length), ...b])];
  const bytes = Uint8Array.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 10, ...leb(code.length), ...code]);
  const file = join(tmp, name);
  writeFileSync(file, bytes);
  return file;
}
// A body of n bytes of `nop` (0x01) with a call to function f at 10.
const body = (n, f) => {
  const b = new Array(n).fill(1);
  b.splice(10, 3, 0x10, ...leb(f).concat([1, 1]).slice(0, 2));
  return b;
};
const last = (a, b) => spawnSync('node', [join(root, 'bench/wasm-functions.mjs'), a, b], { encoding: 'utf8' }).stdout.trim().split('\n').at(-1);

test('wasm-functions: the four largest functions, matched by size', () => {
  const small = [1, 2, 3];
  const base = module('base.wasm', [small, body(300, 200), body(500, 200), body(400, 200), body(200, 200)]);
  assert.equal(last(base, base), 'the four largest (the loops and exec_more): 2 same, 3 same, 1 same, 4 same');
  // a new function in front, and the call index +1 (as for a new export)
  const shifted = module('shifted.wasm', [small, [1], body(300, 201), body(500, 201), body(400, 201), body(200, 201)]);
  assert.equal(last(base, shifted), 'the four largest (the loops and exec_more): 2->3 call operands only (1), 3->4 call operands only (1), 1->2 call operands only (1), 4->5 call operands only (1)');
  // another byte than a call operand
  const changed = body(500, 200);
  changed[100] = 0x0b;
  const other = module('other.wasm', [small, body(300, 200), changed, body(400, 200), body(200, 200)]);
  assert.equal(last(base, other), 'the four largest (the loops and exec_more): 2 differs, 3 same, 1 same, 4 same');
  // the fourth one, which is exec_more in 42mars.wasm
  const fourth = body(200, 200);
  fourth[100] = 0x0b;
  const more = module('more.wasm', [small, body(300, 200), body(500, 200), body(400, 200), fourth]);
  assert.equal(last(base, more), 'the four largest (the loops and exec_more): 2 same, 3 same, 1 same, 4 differs');
});

test('wasm-functions refuses a third argument', () => {
  const r = spawnSync('node', [join(root, 'bench/wasm-functions.mjs'), 'a', 'b', 'c'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});
