#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// A/B timing of two versions of lib/src/mars.c in the native build,
// the native counterpart of tools/ab-wasm.mjs: builds both once with
// tools/bench-native.mjs --src (a dispatch.h next to a version is used for
// it), then runs them alternately on one input and prints median and range.
// The repository's mars.c is not touched.
//
//   node tools/ab-native.mjs <A/mars.c> <B/mars.c> [--input file] [--runs 5]
//        [--early-tie]
//
// Without --input the bench pairs of tools/bench.mjs from $O/corpus run
// (O = $COREWAR_ORACLE or ~/.local/share/corewar-theater). For the
// tournament mix: tools/tournament.mjs <set> --native-input file, then
// --input file --early-tie. Check that the machine is idle first.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? (argv.splice(i, 1), true) : false; };
const RUNS = Number(opt('runs', 5));
const INPUT = opt('input', null);
const earlyTie = flag('early-tie');
const [A, B] = argv;
if (!A || !B || !Number.isInteger(RUNS) || RUNS < 1) {
  console.error('usage: node tools/ab-native.mjs <A/mars.c> <B/mars.c> [--input file] [--runs 5] [--early-tie]');
  process.exit(2);
}
const O = process.env.COREWAR_ORACLE ?? join(homedir(), '.local/share/corewar-theater');
const benchNative = fileURLToPath(new URL('bench-native.mjs', import.meta.url));

const tmp = mkdtempSync(join(tmpdir(), 'ab-native-'));
try {
  const dirs = { A: join(tmp, 'A'), B: join(tmp, 'B') };
  for (const [v, src] of [['A', A], ['B', B]]) {
    const where = INPUT ? ['--input', INPUT] : [join(O, 'corpus')];
    execFileSync(process.execPath, [benchNative, ...where, '--src', src, '--keep', dirs[v], ...(earlyTie ? ['--early-tie'] : [])], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
  const rates = { A: [], B: [] };
  for (let r = 0; r < RUNS; r++) {
    for (const v of ['A', 'B']) {
      const run = spawnSync(join(dirs[v], 'bench'), [join(dirs[v], 'input.txt'), ...(earlyTie ? ['early-tie'] : [])], { encoding: 'utf8' });
      if (run.status !== 0) throw new Error(`${v} failed: ${run.stderr}`);
      rates[v].push(Number(run.stdout.split('M')[0]));
    }
  }
  const median = (x) => [...x].sort((a, b) => a - b)[x.length >> 1];
  const show = (v) => `${median(rates[v]).toFixed(1)} (${Math.min(...rates[v]).toFixed(1)}–${Math.max(...rates[v]).toFixed(1)})`;
  const change = (100 * (median(rates.B) - median(rates.A))) / median(rates.A);
  console.log(`native  A ${show('A')}  B ${show('B')} M/s, ${change >= 0 ? '+' : ''}${change.toFixed(1)}%, n=${RUNS}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
