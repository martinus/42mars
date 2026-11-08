#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Round-robin tournament over a set of warriors, battles run in parallel on
// worker threads with the headless simulator.
//
//   node tools/tournament.mjs <dir or .red files...> [--rounds 100] [--jobs N]
//        [--seed 1] [--size 8000 --cycles 80000 --processes 8000 --length 100
//        --distance 100] [--engine js|wasm] [--matrix] [--json out.json]
//        [--pmars path/to/pmars [--compare]]
//
// Every pairing plays --rounds rounds. The start position of the second
// warrior in the first round is derived from --seed and the pairing, later
// rounds follow from it like in pMARS (`pmars -F pos` uses the same
// sequence), so results are reproducible and comparable with pMARS.
// Score per pairing is 3 per win and 1 per tie; the table shows the sum over
// all opponents and the average per 100 rounds.
//
// --pmars runs the same tournament with pMARS processes instead of the
// engine (for timing), --compare runs both and checks that every pairing has
// the same wins, losses and ties.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { execFile } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble } from '../src/engine/assembler.js';
import { Mars } from '../src/engine/mars.js';

// ------------------------------------------------------------------ worker

async function workerMain() {
  // The main thread assembled the warriors and compiled the module once; a
  // WebAssembly.Module sent to a worker shares its compiled code.
  const { codes, opts, module } = workerData;
  // One engine per worker, reused for every pairing.
  let wasm = null;
  if (module) {
    const { createWasmMarsSync } = await import('../src/engine/mars-wasm.js');
    wasm = createWasmMarsSync(opts, module);
  }
  parentPort.on('message', (task) => {
    if (task === null) return process.exit(0);
    const { id, a, b, seed } = task;
    let wa, wb, instructions;
    if (wasm) {
      // The whole match runs inside WebAssembly, with early tie detection.
      const r = wasm.runMatch([codes[a], codes[b]], { rounds: opts.rounds, seed });
      [wa, wb] = r.warriors;
      instructions = r.instructions;
    } else {
      const m = new Mars({ ...opts, headless: true });
      m.load([codes[a], codes[b]], { seed });
      instructions = 0;
      for (let r = 0; r < opts.rounds; r++) {
        m.startRound();
        while (!m.roundOver) m.run(1 << 22);
        instructions += m.time;
      }
      [wa, wb] = m.warriors;
    }
    parentPort.postMessage({ id, a: [wa.wins, wa.losses, wa.ties], b: [wb.wins, wb.losses, wb.ties], instructions });
  });
}

// ------------------------------------------------------------------ main

function parseArgs(argv) {
  const o = { files: [], rounds: 100, jobs: Math.max(1, cpus().length - 1), seed: 1, engine: 'js',
    size: 8000, cycles: 80000, processes: 8000, length: 100, distance: 100, matrix: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const num = () => Number(argv[++i]);
    if (a === '--rounds') o.rounds = num();
    else if (a === '--jobs') o.jobs = num();
    else if (a === '--seed') o.seed = num();
    else if (a === '--size') o.size = num();
    else if (a === '--cycles') o.cycles = num();
    else if (a === '--processes') o.processes = num();
    else if (a === '--length') o.length = num();
    else if (a === '--distance') o.distance = num();
    else if (a === '--engine') o.engine = argv[++i];
    else if (a === '--matrix') o.matrix = true;
    else if (a === '--json') o.json = argv[++i];
    else if (a === '--pmars') o.pmars = argv[++i];
    else if (a === '--compare') o.compare = true;
    else o.files.push(a);
  }
  return o;
}

function collectFiles(paths) {
  const out = [];
  for (const p of paths) {
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p).sort()) if (/\.(red|rc)$/i.test(f)) out.push(join(p, f));
    } else out.push(p);
  }
  return out;
}

// Deterministic position for pairing (a, b), like `pmars -F pos`.
function pairPosition(seed, a, b, o) {
  let h = (Math.imul(seed, 0x9e3779b1) ^ Math.imul(a + 1, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return o.distance + (h % (o.size + 1 - 2 * o.distance));
}

async function runEngine(o, codes, pairs) {
  const module = o.engine === 'wasm' ? await (await import('../src/engine/mars-wasm.js')).compileWasmMars() : null;
  return new Promise((resolve, reject) => {
    const opts = { coreSize: o.size, maxCycles: o.cycles, maxProcesses: o.processes, maxLength: o.length, minDistance: o.distance, rounds: o.rounds };
    const results = new Array(pairs.length);
    let next = 0;
    let done = 0;
    let instructions = 0;
    const workers = Array.from({ length: Math.min(o.jobs, pairs.length) }, () => new Worker(fileURLToPath(import.meta.url), { workerData: { codes, opts, module } }));
    const feed = (w) => {
      if (next < pairs.length) {
        const p = pairs[next];
        w.postMessage({ id: next++, a: p.a, b: p.b, seed: p.pos - o.distance });
      } else w.postMessage(null);
    };
    for (const w of workers) {
      w.on('message', (r) => {
        results[r.id] = r;
        instructions += r.instructions;
        if (++done === pairs.length) resolve({ results, instructions });
        feed(w);
      });
      w.on('error', reject);
      feed(w);
    }
    if (pairs.length === 0) resolve({ results, instructions });
  });
}

function runPmars(o, files, pairs) {
  return new Promise((resolve) => {
    const results = new Array(pairs.length);
    let next = 0;
    let done = 0;
    const rules = ['-s', o.size, '-c', o.cycles, '-p', o.processes, '-l', o.length, '-d', o.distance].map(String);
    const start = () => {
      if (next >= pairs.length) return;
      const id = next++;
      const p = pairs[id];
      execFile(o.pmars, ['-b', '-k', ...rules, '-r', String(o.rounds), '-F', String(p.pos), files[p.a], files[p.b]], (err, out) => {
        const [[wa, ta], [wb, tb]] = out.trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
        results[id] = { id, a: [wa, wb, ta], b: [wb, wa, tb] };
        if (++done === pairs.length) resolve({ results });
        else start();
      });
    };
    for (let k = 0; k < Math.min(o.jobs, pairs.length); k++) start();
    if (pairs.length === 0) resolve({ results });
  });
}

function table(o, names, pairs, results) {
  const n = names.length;
  const total = names.map((name, i) => ({ name, i, w: 0, l: 0, t: 0, score: 0 }));
  const matrix = Array.from({ length: n }, () => new Array(n).fill(null));
  pairs.forEach((p, k) => {
    const r = results[k];
    for (const [side, other, wlt] of [[p.a, p.b, r.a], [p.b, p.a, r.b]]) {
      total[side].w += wlt[0];
      total[side].l += wlt[1];
      total[side].t += wlt[2];
      total[side].score += 3 * wlt[0] + wlt[2];
      matrix[side][other] = 3 * wlt[0] + wlt[2];
    }
  });
  const rows = [...total].sort((x, y) => y.score - x.score);
  const opponents = Math.max(1, n - 1);
  const width = Math.min(32, Math.max(...names.map((s) => s.length), 4));
  const lines = [`${'#'.padStart(3)}  ${'warrior'.padEnd(width)} ${'score'.padStart(7)} ${'per 100'.padStart(8)} ${'wins'.padStart(6)} ${'ties'.padStart(6)} ${'losses'.padStart(6)}`];
  rows.forEach((r, k) => {
    lines.push(`${String(k + 1).padStart(3)}  ${r.name.slice(0, width).padEnd(width)} ${String(r.score).padStart(7)} ${((100 * r.score) / (o.rounds * opponents)).toFixed(1).padStart(8)} ${String(r.w).padStart(6)} ${String(r.t).padStart(6)} ${String(r.l).padStart(6)}`);
  });
  if (o.matrix) {
    lines.push('', 'score of row against column:');
    rows.forEach((r) => lines.push(`${r.name.slice(0, width).padEnd(width)} ${rows.map((c) => (matrix[r.i][c.i] === null ? '-' : String(matrix[r.i][c.i])).padStart(5)).join('')}`));
  }
  return { text: lines.join('\n'), rows, matrix };
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const all = collectFiles(o.files);
  if (all.length < 2) {
    console.error('usage: node tools/tournament.mjs <dir or .red files...> [--rounds N] [--jobs N] [--engine js|wasm] [--pmars path [--compare]] [--matrix] [--json file]');
    process.exit(2);
  }
  const files = [];
  const codes = []; // what the engines read of each assembled warrior
  const names = [];
  for (const f of all) {
    const src = readFileSync(f, 'latin1');
    const w = assemble(src, { coreSize: o.size, maxLength: o.length, minDistance: o.distance, maxProcesses: o.processes, maxCycles: o.cycles, rounds: o.rounds, warriors: 2 });
    if (!w.ok || w.instructions.length === 0) {
      console.error(`skipped ${f}: ${w.ok ? 'no instructions' : w.errors[0].text}`);
      continue;
    }
    files.push(f);
    codes.push({ ok: w.ok, name: w.name, author: w.author, start: w.start, pin: w.pin, instructions: w.instructions });
    names.push(`${w.name} (${basename(f)})`);
  }
  const pairs = [];
  for (let a = 0; a < files.length; a++) {
    for (let b = a + 1; b < files.length; b++) pairs.push({ a, b, pos: pairPosition(o.seed, a, b, o) });
  }
  console.error(`${files.length} warriors, ${pairs.length} pairings, ${o.rounds} rounds each, ${o.jobs} jobs`);

  let report = {};
  if (!o.pmars || o.compare) {
    const t0 = performance.now();
    const { results, instructions } = await runEngine(o, codes, pairs);
    const s = (performance.now() - t0) / 1000;
    const t = table(o, names, pairs, results);
    console.log(t.text);
    console.error(`engine (${o.engine}): ${s.toFixed(2)} s, ${(instructions / 1e6).toFixed(0)}M instructions executed, ${(instructions / s / 1e6).toFixed(0)}M instructions/s`);
    report = { engine: o.engine, seconds: s, instructions, ranking: t.rows, matrix: t.matrix, results };
  }
  if (o.pmars) {
    const t0 = performance.now();
    const { results } = await runPmars(o, files, pairs);
    const s = (performance.now() - t0) / 1000;
    if (!o.compare) console.log(table(o, names, pairs, results).text);
    console.error(`pMARS: ${s.toFixed(2)} s`);
    if (o.compare) {
      const bad = pairs.filter((p, k) => JSON.stringify(results[k].a) !== JSON.stringify(report.results[k].a));
      for (const p of bad.slice(0, 10)) {
        const k = pairs.indexOf(p);
        console.error(`differs: ${names[p.a]} vs ${names[p.b]} -F ${p.pos}: pMARS ${JSON.stringify(results[k].a)}, engine ${JSON.stringify(report.results[k].a)}`);
      }
      console.error(bad.length ? `DIFFERENT: ${bad.length} of ${pairs.length} pairings` : `SAME: all ${pairs.length} pairings have identical wins/losses/ties`);
      if (bad.length) process.exitCode = 1;
    }
  }
  if (o.json) writeFileSync(o.json, JSON.stringify({ names, files, options: o, pairs, ...report }, null, 1));
}

if (isMainThread) await main();
else await workerMain();
