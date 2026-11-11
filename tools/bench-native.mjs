#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// The battles of tools/bench.mjs on a native build of lib/src/mars.c
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
import { fileURLToPath } from 'node:url';
import { assemble } from '../js/assembler.js';
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
let lib = fileURLToPath(new URL('../lib/', import.meta.url));
if (SRC) {
  // Another mars.c: a copy of lib/ with it in place of src/mars.c (and a
  // dispatch.h next to it, if there is one), so the repository stays as it is.
  const copy = join(tmp, 'lib');
  for (const f of ['42mars.h', '42mars.c', 'src/asm.c', 'src/api.c', 'src/dispatch.h', 'tools/bench-native.c', 'tools/input.h']) {
    mkdirSync(dirname(join(copy, f)), { recursive: true });
    copyFileSync(join(lib, f), join(copy, f));
  }
  copyFileSync(SRC, join(copy, 'src', 'mars.c'));
  if (existsSync(join(dirname(SRC), 'dispatch.h'))) copyFileSync(join(dirname(SRC), 'dispatch.h'), join(copy, 'src', 'dispatch.h'));
  lib = copy;
}
const src = join(lib, 'tools', 'bench-native.c');
// -DM42_FIXED_CONTEXT: the one static context of the wasm build, so that
// the native profile shows the code the wasm build runs (lib/42mars.h).
execFileSync(CC, ['-O3', '-march=native', '-fno-strict-aliasing', '-ffp-contract=off', '-DM42_FIXED_CONTEXT', ...(COUNT ? ['-DCOUNT_INS'] : []), '-I', lib, '-o', join(tmp, 'bench'), src, '-lm'], { stdio: 'inherit' });
const args = [join(tmp, 'input.txt'), ...(earlyTie ? ['early-tie'] : [])];
let counts = '';
for (let r = 0; r < RUNS; r++) {
  const run = spawnSync(join(tmp, 'bench'), args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (run.status !== 0) throw new Error(`bench-native failed: ${run.stderr}`);
  process.stdout.write(run.stdout);
  counts = run.stderr;
}
if (COUNT) writeFileSync(COUNT, counts);
