#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// The battles of tools/bench.mjs on a native build of src/engine/wasm/mars.c
// (clang -O3 -march=native), to measure what the wasm layer costs.
// Usage: node tools/bench-native.mjs <warrior dir> [rounds] [--cc clang] [--runs 1]
//        node tools/bench-native.mjs --input <file> [--early-tie] [--count <file>] [--keep <dir>] [--src <mars.c>]
//   --input      run the matches of a file written with --native-input by
//                tools/tournament.mjs or tools/bench-pairs.mjs instead of the
//                bench pairs
//   --early-tie  stop tie rounds early, as runMatch() and the tournament do
//   --count      build with -DCOUNT_INS and write executions per instruction
//                word to this file, the input of tools/gen-dispatch.mjs --rank
//   --src        build this mars.c instead of the repository's (with a
//                dispatch.h next to it, if there is one), for tools/ab-native.mjs
//   --keep       build and write the input into this directory instead of a
//                fresh one in /tmp (for perf stat / perf record on the binary)
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { assemble } from '../src/engine/assembler.js';
import { nativeMatch } from './native-input.mjs';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? (argv.splice(i, 1), true) : false; };
const CC = opt('cc', 'clang');
const RUNS = Number(opt('runs', 1));
const INPUT = opt('input', null);
const COUNT = opt('count', null);
const KEEP = opt('keep', null);
const SRC = opt('src', null);
const earlyTie = flag('early-tie');
const tmp = KEEP ?? mkdtempSync(join(tmpdir(), 'mars-native-'));
mkdirSync(tmp, { recursive: true });
if (INPUT) {
  copyFileSync(INPUT, join(tmp, 'input.txt'));
} else {
  const [dir, rounds = '200'] = argv;
  const pairs = [['agony.red', 'bubbles.red'], ['bomber.red', 'chalk.red'], ['army.red', 'bananasplit.red']];
  const o = { coreSize: 8000, maxProcesses: 8000, maxCycles: 80000, minDistance: 100, pSpaceSize: 500 };
  let text = '';
  for (const pair of pairs) text += nativeMatch(pair.map((f) => assemble(readFileSync(join(dir, f), 'latin1'))), o, 1234, rounds);
  writeFileSync(join(tmp, 'input.txt'), text);
}
let src = new URL('../src/engine/wasm/bench-native.c', import.meta.url).pathname;
if (SRC) {
  // Another mars.c: build it next to copies of bench-native.c and dispatch.h
  // (a dispatch.h next to it wins), so the repository's file stays as it is.
  const wasmDir = new URL('../src/engine/wasm/', import.meta.url).pathname;
  const dispatch = existsSync(join(dirname(SRC), 'dispatch.h')) ? join(dirname(SRC), 'dispatch.h') : join(wasmDir, 'dispatch.h');
  mkdirSync(join(tmp, 'src'), { recursive: true });
  copyFileSync(SRC, join(tmp, 'src', 'mars.c'));
  copyFileSync(dispatch, join(tmp, 'src', 'dispatch.h'));
  copyFileSync(src, join(tmp, 'src', 'bench-native.c'));
  src = join(tmp, 'src', 'bench-native.c');
}
execFileSync(CC, ['-O3', '-march=native', '-fno-strict-aliasing', '-ffp-contract=off', ...(COUNT ? ['-DCOUNT_INS'] : []), '-o', join(tmp, 'bench'), src, '-lm'], { stdio: 'inherit' });
const args = [join(tmp, 'input.txt'), ...(earlyTie ? ['early-tie'] : [])];
let counts = '';
for (let r = 0; r < RUNS; r++) {
  const run = spawnSync(join(tmp, 'bench'), args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (run.status !== 0) throw new Error(`bench-native failed: ${run.stderr}`);
  process.stdout.write(run.stdout);
  counts = run.stderr;
}
if (COUNT) writeFileSync(COUNT, counts);
