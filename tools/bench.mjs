#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// Simulator speed: 3 warrior pairs from a warrior folder, 200 rounds each (or argv[3]).
// Usage: node tools/bench.mjs <dir with agony.red, bubbles.red, bomber.red, chalk.red, army.red, bananasplit.red> [rounds] [--headless]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assemble } from '../src/engine/assembler.js';
import { Mars } from '../src/engine/mars.js';

const args = process.argv.slice(2).filter((a) => a !== '--headless');
const headless = process.argv.includes('--headless');
const dir = args[0];
const ROUNDS = Number(args[1] || 200);
const pairs = [['agony.red', 'bubbles.red'], ['bomber.red', 'chalk.red'], ['army.red', 'bananasplit.red']];
let steps = 0;
const t0 = performance.now();
for (const pair of pairs) {
  const m = new Mars({ headless });
  m.load(pair.map((f) => assemble(readFileSync(join(dir, f), 'latin1'))), { seed: 1234 });
  for (let r = 0; r < ROUNDS; r++) {
    m.startRound();
    while (!m.roundOver) steps += m.run(1e6);
  }
}
const ms = performance.now() - t0;
console.log(`${(steps / ms / 1000).toFixed(1)}M instructions/s (${steps} instructions in ${ms.toFixed(0)} ms)${headless ? ', headless' : ''}`);
