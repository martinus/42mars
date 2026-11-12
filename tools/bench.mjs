#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// Simulator speed: 3 warrior pairs from a warrior folder, 200 rounds each (or argv[3]).
// Usage: node tools/bench.mjs <dir with agony.red, bubbles.red, bomber.red, chalk.red, army.red, bananasplit.red> [rounds]
//        [--watch | --wasm-match [--early-tie]]
//   (default)     the wasm engine through the step API, run(1e6) from JS
//                 (--wasm, accepted for logged commands, says the same)
//   --watch       the same with a watch attached: the loop that records the
//                 visualizer bookkeeping
//   --wasm-match  the wasm engine, whole match in one runMatch() call
//   --early-tie   with --wasm-match: stop rounds that must end in a tie
//                 early. Then the rate is the effective one: the instructions
//                 a full simulation executes (the sum of the round times)
//                 per second; the line also gives the executed count.
// The time includes loading the warriors, not assembling them or compiling
// the wasm module.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileWasmMars, createWasmMarsSync, assembleWasm as assemble } from '../wasm/42mars.js';

if (process.argv.includes('--headless')) {
  console.error('--headless: the JavaScript simulator is gone (#76)');
  process.exit(2);
}
const flags = ['--watch', '--wasm-match', '--wasm'];
const earlyTie = process.argv.includes('--early-tie');
const args = process.argv.slice(2).filter((a) => !flags.includes(a) && a !== '--early-tie');
const mode = flags.find((f) => process.argv.includes(f)) ?? '--wasm';
const dir = args[0];
const ROUNDS = Number(args[1] || 200);
if (!dir || !(Number.isInteger(ROUNDS) && ROUNDS > 0)) {
  console.error('usage: node tools/bench.mjs <dir> [rounds] [--watch | --wasm-match [--early-tie]]');
  process.exit(2);
}
const pairs = [['agony.red', 'bubbles.red'], ['bomber.red', 'chalk.red'], ['army.red', 'bananasplit.red']];
const module = await compileWasmMars(); // also the assembler
const codes = pairs.map((pair) => pair.map((f) => assemble(readFileSync(join(dir, f), 'latin1'))));
let steps = 0;
let executed = 0;
const t0 = performance.now();
for (const pair of codes) {
  if (mode === '--wasm-match') {
    const r = createWasmMarsSync({}, module).runMatch(pair, { rounds: ROUNDS, seed: 1234, earlyTie });
    steps += r.results.reduce((s, x) => s + x.cycles, 0);
    executed += r.instructions;
    continue;
  }
  const m = createWasmMarsSync({ watch: mode === '--watch' }, module);
  m.load(pair, { seed: 1234 });
  for (let r = 0; r < ROUNDS; r++) {
    m.startRound();
    while (!m.roundOver) steps += m.run(1e6);
  }
}
const ms = performance.now() - t0;
let label = `, ${mode.slice(2)}`;
if (earlyTie && mode === '--wasm-match') label += `, early tie (executed ${executed})`;
console.log(`${(steps / ms / 1000).toFixed(1)}M instructions/s (${steps} instructions in ${ms.toFixed(0)} ms)${label}`);
