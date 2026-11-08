#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// Simulator speed on random corpus pairs: a broader instruction mix than
// tools/bench.mjs. Picks `--pairs` pairs of warriors from a folder with a
// fixed generator (`--seed`), plays `--rounds` rounds of each with
// runMatch() on the wasm engine in one thread, and prints the rate.
// Usage: node tools/bench-pairs.mjs <warrior dir> [--pairs 40] [--rounds 30]
//        [--seed 1] [--early-tie]
//   --early-tie  stop rounds that must end in a tie early (as the
//                tournament does). The rate is then the effective one: the
//                sum of the round times per second.
// The time includes loading the warriors, not assembling them or compiling
// the wasm module.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assemble } from '../src/engine/assembler.js';
import { compileWasmMars, createWasmMarsSync } from '../src/engine/mars-wasm.js';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? (argv.splice(i, 1), true) : false; };
const PAIRS = Number(opt('pairs', 40));
const ROUNDS = Number(opt('rounds', 30));
let seed = Number(opt('seed', 1)) >>> 0 || 1;
const earlyTie = flag('early-tie');
const dir = argv[0];
const rand = (k) => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed % k;
};
const codes = readdirSync(dir).filter((f) => /\.red$/i.test(f)).sort()
  .map((f) => assemble(readFileSync(join(dir, f), 'latin1'), { warriors: 2 }))
  .filter((c) => c.ok && c.instructions.length > 0);
const pairs = Array.from({ length: PAIRS }, () => [codes[rand(codes.length)], codes[rand(codes.length)]]);
const module = await compileWasmMars();
let steps = 0;
let executed = 0;
const t0 = performance.now();
for (const [a, b] of pairs) {
  const r = createWasmMarsSync({}, module).runMatch([a, b], { rounds: ROUNDS, seed: rand(7801), earlyTie });
  steps += r.results.reduce((s, x) => s + x.cycles, 0);
  executed += r.instructions;
}
const ms = performance.now() - t0;
console.log(`${(steps / ms / 1000).toFixed(1)}M instructions/s (${steps} instructions in ${ms.toFixed(0)} ms)${earlyTie ? `, early tie (executed ${executed})` : ''}`);
