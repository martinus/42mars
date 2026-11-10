#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// A/B timing of two versions of a tool that prints "engine (<name>): N s"
// on stderr (tools/tournament.mjs), for changes to the tool itself: A and B
// run alternately with the same arguments, each in a fresh process.
// Prints median and range of the engine time and of the whole process.
//
//   git show HEAD:tools/tournament.mjs > tools/zz-base-tournament.mjs
//   node tools/ab-tool.mjs tools/zz-base-tournament.mjs tools/tournament.mjs 5 \
//        $O/sets/t80 --rounds 100 --seed 1 --engine wasm --jobs 32
//
// The old version has to sit in tools/ (its imports are relative); delete
// it afterwards. Check that the machine is idle first.
import { spawnSync } from 'node:child_process';

const [A, B, runs, ...args] = process.argv.slice(2);
if (!B || !(Number(runs) > 0)) {
  console.error('usage: node tools/ab-tool.mjs <A.mjs> <B.mjs> <runs> <arguments of the tool...>');
  process.exit(2);
}
const times = { A: [], B: [] };
for (let r = 0; r < Number(runs); r++) {
  for (const [k, tool] of [['A', A], ['B', B]]) {
    const t0 = performance.now();
    const p = spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
    const wall = (performance.now() - t0) / 1000;
    const m = /engine \(\w+\): ([\d.]+) s/.exec(p.stderr);
    if (p.status !== 0 || !m) throw new Error(`${tool} failed: ${p.stderr.slice(-500)}`);
    times[k].push([Number(m[1]), wall]);
  }
}
const median = (v) => [...v].sort((x, y) => x - y)[v.length >> 1];
for (const [i, name] of [[0, 'engine'], [1, 'process']]) {
  const col = (k) => times[k].map((x) => x[i]);
  const show = (k) => `${median(col(k)).toFixed(3)} (${Math.min(...col(k)).toFixed(3)}–${Math.max(...col(k)).toFixed(3)})`;
  console.log(`${name.padEnd(8)}A ${show('A')}  B ${show('B')} s, ${(100 * (median(col('B')) / median(col('A')) - 1)).toFixed(1)}%, n=${runs}`);
}
