#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// The battles of bench/bench.mjs on a native build of the library, as make
// builds it (-O3 -fPIC, the context in caller memory): the speed that counts.
// Usage: node bench/bench-native.mjs <warrior dir> [rounds] [--cc clang] [--flags "-O3 -fPIC"] [--cpu n] [--runs 1]
//        node bench/bench-native.mjs --input <file> [--early-tie] [--count <file>] [--keep <dir>] [--src <mars.c> | --lib <dir>]
//   --cc         the compiler (clang; gcc is what make takes on Linux)
//   --flags      its flags. Until 14th November 2026 they were "-O3
//                -march=native -fno-strict-aliasing -ffp-contract=off
//                -DM42_FIXED_CONTEXT", the one static context of the wasm
//                build: the numbers of docs/performance-log.md up to the
//                fifth round
//   --cpu        run on this CPU (taskset), e.g. one locked to a frequency
//   --input      run the matches of a file written with --native-input by
//                tools/tournament.mjs or bench/bench-pairs.mjs instead of the
//                bench pairs
//   --early-tie  stop tie rounds early, as runMatch() and the tournament do
//   --count      build with -DCOUNT_INS and write executions per instruction
//                word to this file, the input of lib/src/gen-dispatch.mjs --rank
//   --src        build this mars.c instead of the repository's, and every
//                other .c or .h file next to it instead of the one in
//                lib/src (dispatch.h, platform.h), for bench/ab-native.mjs
//   --lib        build this copy of lib/ instead of the repository's, e.g.
//                another commit's: git archive origin/main lib | tar -x -C <dir>
//   --keep       build and write the input into this directory instead of a
//                fresh one in /tmp (for perf stat / perf record on the binary)
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, cpSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble, compileMars } from '../wasm/42mars.js';
import { nativeMatch } from './native-input.mjs';

await compileMars(); // assemble() then works on every Node 20

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? (argv.splice(i, 1), true) : false; };
const CC = opt('cc', 'clang');
const FLAGS = opt('flags', '-O3 -fPIC').split(/\s+/).filter(Boolean);
const CPU = opt('cpu', null);
const RUNS = Number(opt('runs', 1));
const INPUT = opt('input', null);
const COUNT = opt('count', null);
const KEEP = opt('keep', null);
const SRC = opt('src', null);
const LIB = opt('lib', null);
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
let lib = LIB ?? fileURLToPath(new URL('../lib/', import.meta.url));
if (SRC) {
  // Another mars.c: a copy of lib/ with it in place of src/mars.c, and the
  // other sources next to it in place of theirs, so the repository stays
  // as it is.
  const copy = join(tmp, 'lib');
  cpSync(lib, copy, { recursive: true });
  copyFileSync(SRC, join(copy, 'src', 'mars.c'));
  for (const f of readdirSync(dirname(SRC))) {
    if (/\.[ch]$/.test(f) && join(dirname(SRC), f) !== SRC) copyFileSync(join(dirname(SRC), f), join(copy, 'src', f));
  }
  lib = copy;
}
const src = fileURLToPath(new URL('bench-native.c', import.meta.url)); // includes input.h next to it, 42mars.c through -I
execFileSync(CC, [...FLAGS, ...(COUNT ? ['-DCOUNT_INS'] : []), '-I', lib, '-o', join(tmp, 'bench'), src, '-lm'], { stdio: 'inherit' });
// Every run executes a fresh copy of the binary, see bench/ab-native.mjs.
const args = [join(tmp, 'bench-run'), join(tmp, 'input.txt'), ...(earlyTie ? ['early-tie'] : [])];
const command = CPU === null ? args : ['taskset', '-c', CPU, ...args];
let counts = '';
for (let r = 0; r < RUNS; r++) {
  rmSync(args[0], { force: true });
  copyFileSync(join(tmp, 'bench'), args[0]);
  const run = spawnSync(command[0], command.slice(1), { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (run.status !== 0) throw new Error(`bench-native failed: ${run.stderr}`);
  process.stdout.write(run.stdout);
  counts = run.stderr;
}
if (COUNT) writeFileSync(COUNT, counts);
