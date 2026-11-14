#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// Simulator speed on random corpus pairs: a broader instruction mix than
// bench/bench.mjs. Picks `--pairs` pairs of warriors from a folder with a
// fixed generator (`--seed`), plays `--rounds` rounds of each with
// runMatch() on the wasm engine in one thread, and prints the rate.
// Usage: node bench/bench-pairs.mjs <warrior dir> [--pairs 40] [--rounds 30]
//        [--seed 1] [--early-tie] [--native-input file]
//        [--size 8000] [--processes 8000] [--cycles 80000] [--length 100]
//        [--distance 100]
//   --size ...   the rules, for a hill with other settings than pMARS's
//                defaults (warriors/koenigstuhl/README.md has them), named
//                as in tools/tournament.mjs
//   --early-tie  stop rounds that must end in a tie early (as the
//                tournament does). The rate is then the effective one: the
//                sum of the round times per second.
//   --native-input  write the pairs in the input format of
//                bench-native.c and exit, for bench/bench-native.mjs --input
// The time includes loading the warriors, not assembling them or compiling
// the wasm module.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileMars, createMarsSync, assemble } from '../wasm/42mars.js';
import { nativeMatch } from './native-input.mjs';

await compileMars(); // assemble() then works on every Node 20

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? (argv.splice(i, 1), true) : false; };
const PAIRS = Number(opt('pairs', 40));
const ROUNDS = Number(opt('rounds', 30));
let seed = Number(opt('seed', 1)) >>> 0 || 1;
const earlyTie = flag('early-tie');
const nativeInput = opt('native-input', null);
const rules = {
  coreSize: Number(opt('size', 8000)), maxProcesses: Number(opt('processes', 8000)), maxCycles: Number(opt('cycles', 80000)),
  maxLength: Number(opt('length', 100)), minDistance: Number(opt('distance', 100)),
};
const positions = rules.coreSize + 1 - 2 * rules.minDistance; // seeds 0 .. positions - 1: one per start position
const dir = argv[0];
const rand = (k) => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed % k;
};
const codes = readdirSync(dir).filter((f) => /\.red$/i.test(f)).sort()
  .map((f) => assemble(readFileSync(join(dir, f), 'latin1'), { ...rules, warriors: 2 }))
  .filter((c) => c.ok && c.instructions.length > 0);
const pairs = Array.from({ length: PAIRS }, () => [codes[rand(codes.length)], codes[rand(codes.length)]]);
if (nativeInput) {
  const native = { ...rules, pSpaceSize: Math.floor(rules.coreSize / 16) };
  writeFileSync(nativeInput, pairs.map(([a, b]) => nativeMatch([a, b], native, rand(positions), ROUNDS)).join(''));
  process.exit(0);
}
const module = await compileMars();
let steps = 0;
let executed = 0;
const t0 = performance.now();
for (const [a, b] of pairs) {
  const r = createMarsSync(rules, module).runMatch([a, b], { rounds: ROUNDS, seed: rand(positions), earlyTie });
  steps += r.results.reduce((s, x) => s + x.cycles, 0);
  executed += r.instructions;
}
const ms = performance.now() - t0;
console.log(`${(steps / ms / 1000).toFixed(1)}M instructions/s (${steps} instructions in ${ms.toFixed(0)} ms)${earlyTie ? `, early tie (executed ${executed})` : ''}`);
