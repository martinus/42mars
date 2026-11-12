#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// A/B timing of two builds of wasm/42mars.wasm, as the
// perf-experiment skill asks for: the measures run alternately on A and B,
// each in a fresh process, and the result is the median and range per
// measure and build.
//
//   node bench/ab-wasm.mjs <A.wasm> <B.wasm> [--runs 7] [--t80-runs 5]
//        [--only bench,pairs,t20,t80j16,t80j31]
//
// Measures (O = $COREWAR_ORACLE or ~/.local/share/corewar-theater):
//   bench   bench/bench.mjs $O/corpus --wasm-match           M instructions/s
//   pairs   bench/bench-pairs.mjs $O/corpus                  M instructions/s
//   t20     tools/tournament.mjs $O/sets/t20 --jobs 1        seconds
//   t80j16, t80j31  the same on $O/sets/t80 with 16 and 31 jobs, --t80-runs times
//
// Each build is copied over wasm/42mars.wasm before its run; the
// original file is put back at the end, also after Ctrl-C. Check that the
// machine is idle first (uptime, no other node or clang).
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const O = process.env.COREWAR_ORACLE ?? join(homedir(), '.local/share/corewar-theater');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const RUNS = Number(opt('runs', 7));
const T80_RUNS = Number(opt('t80-runs', 5));
const ONLY = opt('only', 'bench,pairs,t20,t80j16,t80j31').split(',');
const [A, B] = argv;
if (!A || !B) {
  console.error('usage: node bench/ab-wasm.mjs <A.wasm> <B.wasm> [--runs 7] [--t80-runs 5] [--only bench,pairs,t20,t80j16,t80j31]');
  process.exit(2);
}

const WASM = join(root, 'wasm/42mars.wasm');
const original = readFileSync(WASM);
// Read both builds first: either may be the live 42mars.wasm itself.
const builds = [['A', readFileSync(A)], ['B', readFileSync(B)]];
const restore = () => writeFileSync(WASM, original);
process.on('SIGINT', () => { restore(); process.exit(130); });

const tool = (name) => join(root, name);
const MEASURES = {
  bench: { runs: RUNS, args: [tool('bench/bench.mjs'), join(O, 'corpus'), '--wasm-match'], unit: 'M/s', re: /^([\d.]+)M instructions\/s/m },
  pairs: { runs: RUNS, args: [tool('bench/bench-pairs.mjs'), join(O, 'corpus')], unit: 'M/s', re: /^([\d.]+)M instructions\/s/m },
  t20: { runs: RUNS, args: [tool('tools/tournament.mjs'), join(O, 'sets/t20'), '--rounds', '100', '--seed', '1', '--jobs', '1', '--engine', 'wasm'], unit: 's', re: /^engine \(wasm\): ([\d.]+) s/m },
  t80j16: { runs: T80_RUNS, args: [tool('tools/tournament.mjs'), join(O, 'sets/t80'), '--rounds', '100', '--seed', '1', '--jobs', '16', '--engine', 'wasm'], unit: 's', re: /^engine \(wasm\): ([\d.]+) s/m },
  t80j31: { runs: T80_RUNS, args: [tool('tools/tournament.mjs'), join(O, 'sets/t80'), '--rounds', '100', '--seed', '1', '--jobs', '31', '--engine', 'wasm'], unit: 's', re: /^engine \(wasm\): ([\d.]+) s/m },
};
for (const m of ONLY) if (!MEASURES[m]) throw new Error(`unknown measure ${m}`);

function measure(m) {
  // The tournament prints its time on stderr, the benches on stdout.
  const r = spawnSync(process.execPath, MEASURES[m].args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = r.stdout + r.stderr;
  const hit = MEASURES[m].re.exec(out);
  if (!hit) throw new Error(`${m}: no result in output:\n${out}`);
  return Number(hit[1]);
}

const values = {};
try {
  const most = Math.max(...ONLY.map((m) => MEASURES[m].runs));
  for (let i = 0; i < most; i++) {
    for (const [label, bytes] of builds) {
      writeFileSync(WASM, bytes);
      for (const m of ONLY) {
        if (i >= MEASURES[m].runs) continue;
        (values[`${m} ${label}`] ??= []).push(measure(m));
      }
    }
  }
} finally {
  restore();
}

const stat = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return { median: s[s.length >> 1], lo: s[0], hi: s[s.length - 1] };
};
for (const m of ONLY) {
  const a = stat(values[`${m} A`]);
  const b = stat(values[`${m} B`]);
  const change = ((100 * (b.median - a.median)) / a.median).toFixed(1);
  console.log(`${m.padEnd(7)} A ${a.median} (${a.lo}–${a.hi})  B ${b.median} (${b.lo}–${b.hi}) ${MEASURES[m].unit}, ${change > 0 ? '+' : ''}${change}%, n=${values[`${m} A`].length}`);
}
