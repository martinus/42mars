// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Reference results for 4031 expressions and 146 small Redcode sources. They
// pin down pMARS behavior, quirks included, so that refactoring the engine
// cannot change it unnoticed. Recorded from the first engine of this project;
// a rewrite under the MIT license reproduces all of them. Snippets where a
// differential test showed that pMARS behaves differently were corrected to
// the pMARS result (metadata whitespace, lone CR, warriors without
// instructions and the warning counts that follow from that).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assembleWasm, evaluateWasm } from '../wasm/42mars.js';

const load = (f) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));

// The C assembler and evaluator, lib/src/asm.c, through the wasm build.
test('expressions match the reference results', () => {
  const bad = [];
  for (const [expr, status, value] of load('expressions.json')) {
    const r = evaluateWasm(expr);
    if (r.status !== status || (status >= 0 && r.value.toString() !== value)) {
      bad.push(`${JSON.stringify(expr)}: want ${status}/${value}, got ${r.status}/${r.value}`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

for (const { name, src, opts, result } of load('snippets.json')) {
  test(`snippet ${name}`, () => {
    const w = assembleWasm(src, opts);
    const got = {
      ok: w.ok, name: w.name, author: w.author, strategy: w.strategy, start: w.start, pin: w.pin,
      instructions: w.instructions.map((i) => [i.op, i.mod, i.aMode, i.aVal, i.bMode, i.bVal, i.line]),
      // pMARS has no counterpart of our warnings about its own limits
      // (texts that start with "pMARS")
      warnings: w.warnings.filter((m) => !m.text.startsWith('pMARS ')).length,
    };
    assert.deepEqual(got, result);
  });
}
