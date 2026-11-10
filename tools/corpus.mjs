#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// Assembles every .red file below a directory and reports which ones fail.
// Usage: node tools/corpus.mjs <dir> [--verbose] [--compare-c]
// --compare-c also assembles each file with the C assembler (lib/src/asm.c
// through wasm/42mars.js) and reports every file whose result object
// differs from js/assembler.js; exit code 1 then.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assemble } from '../js/assembler.js';
import { assembleWasm } from '../wasm/42mars.js';

const dir = process.argv[2];
const verbose = process.argv.includes('--verbose');
const compareC = process.argv.includes('--compare-c');
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
const differ = [];
for (const f of files.sort()) {
  const source = readFileSync(f, 'latin1');
  const w = assemble(source);
  if (w.ok) ok++;
  else failures.push([f, w.errors]);
  if (compareC && JSON.stringify(assembleWasm(source)) !== JSON.stringify(w)) differ.push(f);
}
for (const [f, errs] of failures) {
  console.log(`FAIL ${f}`);
  for (const e of errs.slice(0, verbose ? 99 : 2)) console.log(`   line ${e.line ?? '-'}: ${e.text}`);
}
console.log(`${ok}/${files.length} assembled`);
if (compareC) {
  for (const f of differ) console.log(`C DIFFERS ${f}`);
  console.log(`C assembler: ${files.length - differ.length}/${files.length} results the same as js/assembler.js`);
  if (differ.length) process.exitCode = 1;
}
