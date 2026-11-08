#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// The battles of tools/bench.mjs on a native build of src/engine/wasm/mars.c
// (clang -O3 -march=native), to measure what the wasm layer costs.
// Usage: node tools/bench-native.mjs <warrior dir> [rounds] [--cc clang] [--runs 1]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assemble } from '../src/engine/assembler.js';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const CC = opt('cc', 'clang');
const RUNS = Number(opt('runs', 1));
const [dir, rounds = '200'] = argv;
const pairs = [['agony.red', 'bubbles.red'], ['bomber.red', 'chalk.red'], ['army.red', 'bananasplit.red']];
const o = { coreSize: 8000, maxProcesses: 8000, maxCycles: 80000, minDistance: 100, pSpaceSize: 500 };
let text = '';
for (const pair of pairs) {
  const codes = pair.map((f) => assemble(readFileSync(join(dir, f), 'latin1')));
  const total = codes.reduce((s, c) => s + c.instructions.length, 0);
  text += `${o.coreSize} ${o.maxProcesses} ${o.maxCycles} ${o.minDistance} ${o.pSpaceSize} 2 ${total} 1234 ${rounds}\n`;
  codes.forEach((c, i) => { text += `${c.instructions.length} ${c.start} ${c.pin !== null && c.pin === codes[0].pin ? 0 : i} 0\n`; });
  for (const c of codes) for (const x of c.instructions) text += `${(x.op << 3) | x.mod} ${x.aMode} ${x.aVal} ${x.bMode} ${x.bVal}\n`;
}
const tmp = mkdtempSync(join(tmpdir(), 'mars-native-'));
writeFileSync(join(tmp, 'input.txt'), text);
const src = new URL('../src/engine/wasm/bench-native.c', import.meta.url).pathname;
execFileSync(CC, ['-O3', '-march=native', '-fno-strict-aliasing', '-o', join(tmp, 'bench'), src], { stdio: 'inherit' });
for (let r = 0; r < RUNS; r++) process.stdout.write(execFileSync(join(tmp, 'bench'), [join(tmp, 'input.txt')], { encoding: 'utf8' }));
