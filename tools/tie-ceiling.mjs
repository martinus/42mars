#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Upper bound for exact early ties of the form "this loop cannot die"
// (issue #27): builds src/engine/wasm/tie-ceiling.c natively, runs it on a
// bench-native input split into --jobs shards, and adds up its lines.
//
//   node tools/tie-ceiling.mjs <input> [--jobs 31] [--cc clang] [--raw file]
//   node tools/tie-ceiling.mjs --from-raw <file>
//
// Inputs come from tools/tournament.mjs or tools/bench-pairs.mjs with
// --native-input. --raw keeps the driver's lines (match numbers of the
// whole input), --from-raw reports from such a file without running.
//
// Per tie round of two warriors, warrior w is safe from
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
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const JOBS = Number(opt('jobs', Math.max(1, cpus().length - 1)));
const CC = opt('cc', 'clang');
const RAW = opt('raw', null);
const FROM_RAW = opt('from-raw', null);
const [input] = argv;
if ((!input && !FROM_RAW) || !Number.isInteger(JOBS) || JOBS < 1) {
  console.error('usage: node tools/tie-ceiling.mjs <input> [--jobs 31] [--cc clang] [--raw file]\n       node tools/tie-ceiling.mjs --from-raw <file>');
  process.exit(2);
}

if (FROM_RAW) report(readFileSync(FROM_RAW, 'utf8'));
else report(await run(input));

// Runs the driver on the matches of `file` in JOBS processes; returns its
// lines with the match numbers of the whole input.
async function run(file) {
  // A match is a header line, then one line per warrior and one per
  // instruction.
  const lines = readFileSync(file, 'utf8').split('\n');
  const matches = [];
  for (let i = 0; i < lines.length && lines[i].trim();) {
    const h = lines[i].trim().split(/\s+/).map(Number);
    const n = 1 + h[5] + h[6];
    matches.push(lines.slice(i, i + n).join('\n') + '\n');
    i += n;
  }
  const tmp = mkdtempSync(join(tmpdir(), 'tie-ceiling-'));
  const children = [];
  try {
    const bin = join(tmp, 'tie-ceiling');
    const src = fileURLToPath(new URL('../src/engine/wasm/tie-ceiling.c', import.meta.url));
    execFileSync(CC, ['-O2', '-march=native', '-fno-strict-aliasing', '-ffp-contract=off', '-o', bin, src, '-lm'], { stdio: 'inherit' });
    const shards = Math.min(JOBS, matches.length);
    const outputs = await Promise.all(Array.from({ length: shards }, (_, s) => {
      const part = join(tmp, `in${s}.txt`);
      writeFileSync(part, matches.filter((_, k) => k % shards === s).join(''));
      return new Promise((resolve, reject) => {
        const p = spawn(bin, [part], { stdio: ['ignore', 'pipe', 'inherit'] });
        children.push(p);
        let out = '';
        p.stdout.setEncoding('utf8').on('data', (d) => { out += d; });
        // Shard s has the matches s, s + shards, ... of the whole input.
        const global = () => out.replace(/^TIE (\d+) /gm, (_, m) => `TIE ${s + shards * Number(m)} `);
        p.on('close', (code) => (code === 0 ? resolve(global()) : reject(new Error(`shard ${s} failed with ${code}`))));
      });
    }));
    const text = outputs.join('');
    if (RAW) writeFileSync(RAW, text);
    return text;
  } finally {
    for (const p of children) if (p.exitCode === null) p.kill();
    rmSync(tmp, { recursive: true, force: true });
  }
}

function report(text) {
  const TH = ['1', '2', '4', '8', '16', '32', '64', 'any'];
  let total = 0;
  let rounds = 0;
  let tieNow = 0;
  let tieFull = 0;
  let ties = 0;
  let countOnly = 0; // both immortal by count, checked after every instruction
  const save = TH.map(() => 0);
  const helped = TH.map(() => 0);
  const byCase = new Map(); // at |S| <= 32
  for (const l of text.split('\n')) {
    const f = l.split(' ');
    if (f[0] === 'TOTAL') { total += Number(f[1]); rounds += Number(f[2]); continue; }
    if (f[0] !== 'TIE') continue;
    const [L, now, imm0, imm1] = f.slice(3, 7).map(Number);
    const w = [f.slice(7, 17).map(Number), f.slice(17, 27).map(Number)]; // 8 t0, writes from t0(32), writes from t0(any)
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
        const loops = [0, 1].filter((i) => w[i][k] < imm[i]);
        let c;
        if (loops.length === 0) c = 'both immortal by count';
        else if (loops.length === 1) c = 'one immortal by count, the other loops';
        else c = `both loop, opponent writes ${loops.some((i) => w[i][8] & 12) ? 'through pointers or increments' : 'only directly or not'}`;
        byCase.set(c, (byCase.get(c) ?? 0) + gain);
      }
    });
  }
  const pct = (x, of) => `${((100 * x) / of).toFixed(2)}%`;
  console.log(`${rounds} rounds, ${(total / 1e6).toFixed(0)}M instructions executed today (with early ties)`);
  console.log(`${ties} tie rounds: ${(tieNow / 1e6).toFixed(0)}M executed today (${pct(tieNow, total)}), ${(tieFull / 1e6).toFixed(0)}M without early ties`);
  console.log(`count proof per instruction instead of every 4096: ${pct(countOnly, total)} of all`);
  console.log('ceiling of "this loop cannot die", by the size of S (share of all instructions executed today, rounds that gain):');
  TH.forEach((t, k) => console.log(`  |S| <= ${t.padEnd(3)} ${pct(save[k], total).padStart(7)}  ${helped[k]} rounds`));
  console.log('at |S| <= 32, by what makes the warriors safe and how the opponent of a looping warrior writes:');
  for (const [c, v] of [...byCase].sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(56)} ${pct(v, total)}`);
}
