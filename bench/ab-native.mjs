#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// A/B timing of two versions of the library in its native build: builds
// both once per compiler with bench/bench-native.mjs, then runs them
// alternately on every input and prints median and range. A version is a
// copy of lib/ (a folder, e.g. `git archive origin/main lib | tar -x -C
// <dir>` gives <dir>/lib), or a mars.c: then the other .c and .h files
// next to it replace those of the repository's lib/src (dispatch.h,
// platform.h). The repository's files are not touched.
//
//   node bench/ab-native.mjs <A> <B> [--input file]...
//        [--runs 5] [--early-tie] [--cc gcc,clang] [--flags "-O3 -fPIC"]
//        [--cpu n]
//
// Without --input the bench pairs of bench/bench.mjs from $O/corpus run
// (O = $COREWAR_ORACLE or ~/.local/share/corewar-theater). For a
// tournament mix: tools/tournament.mjs <set> --native-input file, then
// --input file --early-tie; for corpus pairs bench/bench-pairs.mjs
// --native-input. --cc takes several compilers, each its own A/B; the
// flags are the Makefile's (-O3 -fPIC) unless given. --cpu pins the runs to one CPU
// (taskset), best one locked to a fixed frequency: the ranges of 3 runs were
// within 0.3% then. Both versions must execute the same number of
// instructions: a line that says they differ means different results. Check
// that the machine is idle first.
//
// Every run executes a fresh copy of its binary. One file of a build ran
// 5% slower than six copies of it, every time, on a machine that was in
// use (14th November 2026; why was not found, the path and the size of the
// environment made no difference). With a copy per run such a file shows
// as a wide range instead of as a result.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? (argv.splice(i, 1), true) : false; };
const RUNS = Number(opt('runs', 5));
const INPUTS = [];
for (let f; (f = opt('input', null)) !== null;) INPUTS.push(f);
const COMPILERS = opt('cc', 'gcc,clang').split(',');
const FLAGS = opt('flags', null);
const CPU = opt('cpu', null);
const earlyTie = flag('early-tie');
const [A, B] = argv;
if (!A || !B || argv.length !== 2 || !Number.isInteger(RUNS) || RUNS < 1) {
  console.error('usage: node bench/ab-native.mjs <A: lib folder or mars.c> <B> [--input file]... [--runs 5] [--early-tie] [--cc gcc,clang] [--flags "-O3 -fPIC"] [--cpu n]');
  process.exit(2);
}
const O = process.env.COREWAR_ORACLE ?? join(homedir(), '.local/share/corewar-theater');
const benchNative = fileURLToPath(new URL('bench-native.mjs', import.meta.url));
const inputs = INPUTS.length ? INPUTS : [null]; // null: the bench pairs

const tmp = mkdtempSync(join(tmpdir(), 'ab-native-'));
try {
  for (const cc of COMPILERS) {
    const dirs = { A: join(tmp, `${cc}-A`), B: join(tmp, `${cc}-B`) };
    for (const [v, src] of [['A', A], ['B', B]]) {
      // bench-native needs one input to build; the runs below pass theirs to the binary.
      const where = inputs[0] ? ['--input', inputs[0]] : [join(O, 'corpus')];
      execFileSync(process.execPath, [benchNative, ...where, '--runs', '0', statSync(src).isDirectory() ? '--lib' : '--src', src, '--keep', dirs[v], '--cc', cc, ...(FLAGS === null ? [] : ['--flags', FLAGS]), ...(earlyTie ? ['--early-tie'] : [])], { stdio: ['ignore', 'ignore', 'inherit'] });
    }
    for (const input of inputs) {
      const rates = { A: [], B: [] };
      const executed = {};
      for (let r = 0; r < RUNS; r++) {
        for (const v of ['A', 'B']) {
          const copy = join(dirs[v], 'bench-run');
          rmSync(copy, { force: true });
          copyFileSync(join(dirs[v], 'bench'), copy);
          const args = [copy, input ?? join(dirs[v], 'input.txt'), ...(earlyTie ? ['early-tie'] : [])];
          const cmd = CPU === null ? args : ['taskset', '-c', CPU, ...args];
          const run = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
          if (run.status !== 0) throw new Error(`${v} failed: ${run.stderr}`);
          rates[v].push(Number(run.stdout.split('M')[0]));
          executed[v] = /\((\d+) instructions/.exec(run.stdout)[1];
        }
      }
      const median = (x) => [...x].sort((a, b) => a - b)[x.length >> 1];
      const show = (v) => `${median(rates[v]).toFixed(1)} (${Math.min(...rates[v]).toFixed(1)}–${Math.max(...rates[v]).toFixed(1)})`;
      const change = (100 * (median(rates.B) - median(rates.A))) / median(rates.A);
      const differ = executed.A === executed.B ? '' : `  INSTRUCTIONS DIFFER: A ${executed.A}, B ${executed.B}`;
      console.log(`${cc.padEnd(6)} ${(input ? basename(input) : 'bench').padEnd(12)} A ${show('A')}  B ${show('B')} M/s, ${change >= 0 ? '+' : ''}${change.toFixed(1)}%, n=${RUNS}${differ}`);
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
