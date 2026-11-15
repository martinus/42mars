#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The style of warriors (tools/style.js): what each does to the core against
// a few opponents, measured with the watch.
//
//   node tools/style.mjs <dir or .red files...> [--against a.red,b.red,...] [--rounds 2] [--json out.json]
//
// --against: the opponents, by default our Dwarf, Origami and Seeker (a
// stone, a paper, a scanner). '94 rules without p-space; warriors that do not
// fit them are skipped with a message.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { describe, kind, measureStyle } from './style.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const o = { files: [], against: ['dwarf', 'origami', 'seeker'].map((n) => join(root, 'warriors', `${n}.red`)), rounds: 2, json: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--against') o.against = argv[++i].split(',');
  else if (a === '--rounds') o.rounds = Number(argv[++i]);
  else if (a === '--json') o.json = argv[++i];
  else if (a.startsWith('--')) {
    console.error(`unknown option ${a}\nusage: node tools/style.mjs <dir or .red files...> [--against a.red,...] [--rounds 2] [--json out.json]`);
    process.exit(2);
  } else if (statSync(a).isDirectory()) {
    for (const f of readdirSync(a).filter((x) => x.endsWith('.red')).sort()) o.files.push(join(a, f));
  } else o.files.push(a);
}
if (!o.files.length || !(o.rounds >= 1)) {
  console.error('usage: node tools/style.mjs <dir or .red files...> [--against a.red,...] [--rounds 2] [--json out.json]');
  process.exit(2);
}
const rules = { coreSize: 8000, maxCycles: 80000, maxProcesses: 8000, maxLength: 100, minDistance: 100 };
const load = (f) => assemble(readFileSync(f, 'latin1'), rules);
const opponents = o.against.map(load);
const m = createMarsSync({ ...rules, watch: true });
const out = [];
for (const f of o.files) {
  const w = load(f);
  if (!w.ok || w.instructions.length > rules.maxLength || w.instructions.some((i) => i.op >= 17)) {
    console.error(`${f}: skipped, it does not fit the '94 rules without p-space`);
    continue;
  }
  const s = measureStyle(m, w, opponents, { rounds: o.rounds });
  out.push({ file: basename(f), name: w.name, ...s, kind: kind(s) });
  console.log(`${basename(f).padEnd(24)} ${describe(s)}`);
}
if (o.json) writeFileSync(o.json, JSON.stringify(out, null, 1));
