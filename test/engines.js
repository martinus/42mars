// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Comparison of two engines of wasm/42mars.js for the tests: test/wasm.test.js
// and test/watch.test.js run an engine without a watch (the specialized
// loops) next to one with a watch (the generic operand code).

import assert from 'node:assert/strict';

export const CORE = ['op', 'am', 'bm', 'av', 'bv'];
const bytes = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);

// The cores of engines a and b as bytes (fast); the first different cell
// only when they differ.
export function compareCore(a, b, where) {
  const x = a.core(), y = b.core();
  for (const k of CORE) {
    if (bytes(x[k]).equals(bytes(y[k]))) continue;
    const i = x[k].findIndex((v, j) => v !== y[k][j]);
    assert.fail(`${where}: ${k}[${i}] is ${y[k][i]}, the other engine has ${x[k][i]}`);
  }
}
