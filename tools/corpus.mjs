#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// Assembles every .red file below a directory and reports which ones fail.
// Usage: node tools/corpus.mjs <dir> [--verbose]
// With the assembler of lib/src/asm.c, through wasm/42mars.js.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assembleWasm as assemble, compileWasmMars } from '../wasm/42mars.js';

await compileWasmMars();
const dir = process.argv[2];
const verbose = process.argv.includes('--verbose');
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(red|rc)$/i.test(e)) files.push(p);
  }
})(dir);
let ok = 0;
const failures = [];
for (const f of files.sort()) {
  const source = readFileSync(f, 'latin1');
  const w = assemble(source);
  if (w.ok) ok++;
  else failures.push([f, w.errors]);
}
for (const [f, errs] of failures) {
  console.log(`FAIL ${f}`);
  for (const e of errs.slice(0, verbose ? 99 : 2)) console.log(`   line ${e.line ?? '-'}: ${e.text}`);
}
console.log(`${ok}/${files.length} assembled`);
