#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// Assembles Redcode files and prints a pMARS-style listing, errors and warnings.
// Usage: node tools/asm.mjs [--coresize N] [--maxlength N] [--icws88] file.red...
// Each file as `pmars -r 0 file` assembles it: as the only warrior, with the
// registers w and s at 1, which pMARS's score formula check leaves.
import { readFileSync } from 'node:fs';
import { assembleWasm as assemble, compileWasmMars } from '../wasm/42mars.js';
import { formatListing } from './opcodes.js';

await compileWasmMars(); // assembleWasm() then works on every Node 20

const args = process.argv.slice(2);
const options = { registers: { w: 1, s: 1 } };
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--coresize') options.coreSize = Number(args[++i]);
  else if (args[i] === '--maxlength') options.maxLength = Number(args[++i]);
  else if (args[i] === '--icws88') options.icws88 = true;
  else files.push(args[i]);
}
let failed = 0;
for (const file of files) {
  const w = assemble(readFileSync(file, 'latin1'), options);
  for (const m of [...w.errors, ...w.warnings]) {
    console.error(`${file}:${m.line ?? '-'}: ${m.severity}: ${m.text}`);
  }
  if (!w.ok) { failed++; continue; }
  process.stdout.write(formatListing(w, w.options.coreSize));
}
process.exit(failed ? 1 : 0);
