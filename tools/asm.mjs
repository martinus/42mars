#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// Assembles Redcode files and prints a pMARS-style listing, errors and warnings.
// Usage: node tools/asm.mjs [--coresize N] [--maxlength N] file.red...
import { readFileSync } from 'node:fs';
import { assemble } from '../js/assembler.js';
import { formatListing } from '../js/opcodes.js';

const args = process.argv.slice(2);
const options = {};
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--coresize') options.coreSize = Number(args[++i]);
  else if (args[i] === '--maxlength') options.maxLength = Number(args[++i]);
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
