#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Upper bound for exact early ties of the form "this loop cannot die"
// (issue #27): builds src/engine/wasm/tie-ceiling.c natively, runs it on a
// bench-native input split into --jobs shards, and adds up its lines.
//
//   node tools/tie-ceiling.mjs <input> [--jobs 31] [--cc clang] [--raw file]
//
// Inputs come from tools/tournament.mjs or tools/bench-pairs.mjs with
// --native-input. Per tie round of two warriors, warrior w is safe from
//   s_w = min(the instruction after which the process count makes it
//         immortal, t0: the start of a closed loop that executes at most
//         |S| cells, none of them DAT, DIV or MOD, which nobody changes
//         until the round ends; known only afterwards)
// and a proof could stop the round at max(s_0, s_1). The ceiling is what
// that saves against the round as it runs today (with the early ties of
// runMatch), as a share of all instructions executed today.

import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const JOBS = Number(opt('jobs', Math.max(1, cpus().length - 1)));
const CC = opt('cc', 'clang');
const RAW = opt('raw', null);
const [input] = argv;
if (!input) {
  console.error('usage: node tools/tie-ceiling.mjs <input> [--jobs 31] [--cc clang] [--raw file]');
  process.exit(2);
}

// Splits the input into matches: a header line, then one line per warrior
// and one per instruction.
const lines = readFileSync(input, 'utf8').split('\n');
const matches = [];
for (let i = 0; i < lines.length && lines[i].trim();) {
  const h = lines[i].trim().split(/\s+/).map(Number);
  const n = 1 + h[5] + h[6];
  matches.push(lines.slice(i, i + n).join('\n') + '\n');
  i += n;
}

const tmp = mkdtempSync(join(tmpdir(), 'tie-ceiling-'));
try {
  const bin = join(tmp, 'tie-ceiling');
  const src = new URL('../src/engine/wasm/tie-ceiling.c', import.meta.url).pathname;
  execFileSync(CC, ['-O2', '-march=native', '-fno-strict-aliasing', '-ffp-contract=off', '-o', bin, src, '-lm'], { stdio: 'inherit' });
  const shards = Math.min(JOBS, matches.length);
  const outputs = await Promise.all(Array.from({ length: shards }, (_, s) => {
    const file = join(tmp, `in${s}.txt`);
    writeFileSync(file, matches.filter((_, k) => k % shards === s).join(''));
    return new Promise((resolve, reject) => {
      const p = spawn(bin, [file], { stdio: ['ignore', 'pipe', 'inherit'] });
      let out = '';
      p.stdout.setEncoding('utf8').on('data', (d) => { out += d; });
      // Match numbers in the whole input: shard s has matches s, s + shards, ...
      const global = () => out.replace(/^TIE (\d+) /gm, (_, m) => `TIE ${s + shards * Number(m)} `);
      p.on('close', (code) => (code === 0 ? resolve(global()) : reject(new Error(`shard ${s} failed with ${code}`))));
    });
  }));
  if (RAW) writeFileSync(RAW, outputs.join(''));
  report(outputs.join('').split('\n').filter(Boolean));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

function report(out) {
  const TH = ['1', '2', '4', '8', '16', '32', '64', 'any'];
  let total = 0;
  let rounds = 0;
  let tieNow = 0;
  let tieFull = 0;
  let ties = 0;
  let countOnly = 0; // both immortal by count, checked after every instruction
  const save = TH.map(() => 0);
  const helped = TH.map(() => 0);
  const byWrites = new Map(); // at |S| <= 32
  for (const l of out) {
    const f = l.split(' ');
    if (f[0] === 'TOTAL') { total += Number(f[1]); rounds += Number(f[2]); continue; }
    if (f[0] !== 'TIE') continue;
    const [L, now, imm0, imm1] = f.slice(3, 7).map(Number);
    const w = [f.slice(7, 17).map(Number), f.slice(17, 27).map(Number)];
    const imm = [imm0 < 0 ? L : imm0, imm1 < 0 ? L : imm1];
    ties++;
    tieNow += now;
    tieFull += L;
    countOnly += Math.max(0, now - Math.max(imm[0], imm[1]));
    TH.forEach((_, k) => {
      const s = [0, 1].map((i) => Math.min(imm[i], w[i][k]));
      const gain = Math.max(0, now - Math.max(s[0], s[1]));
      save[k] += gain;
      if (gain > 0) helped[k]++;
      if (k === 5 && gain > 0) {
        // The opponents of the warriors that need the loop proof.
        let kinds = 0;
        for (const i of [0, 1]) if (w[i][k] < imm[i]) kinds |= w[i][8];
        const cls = kinds === 0 ? 'opponent does not write' : (kinds & ~1) === 0 ? 'only MOV.I to direct operands' : (kinds & ~3) === 0 ? 'only direct writes' : 'writes through indirect operands or increments';
        byWrites.set(cls, (byWrites.get(cls) ?? 0) + gain);
      }
    });
  }
  const pct = (x, of) => `${((100 * x) / of).toFixed(2)}%`;
  console.log(`${rounds} rounds, ${(total / 1e6).toFixed(0)}M instructions executed today (with early ties)`);
  console.log(`${ties} tie rounds: ${(tieNow / 1e6).toFixed(0)}M executed today (${pct(tieNow, total)}), ${(tieFull / 1e6).toFixed(0)}M without early ties`);
  console.log(`count proof per instruction instead of every 4096: ${pct(countOnly, total)} of all`);
  console.log('ceiling of "this loop cannot die", by the size of S (share of all instructions executed today, rounds that gain):');
  TH.forEach((t, k) => console.log(`  |S| <= ${t.padEnd(3)} ${pct(save[k], total).padStart(7)}  ${helped[k]} rounds`));
  console.log('at |S| <= 32, by how the opponent of the looping warrior writes:');
  for (const [cls, v] of [...byWrites].sort((a, b) => b[1] - a[1])) console.log(`  ${cls.padEnd(48)} ${pct(v, total)}`);
}
