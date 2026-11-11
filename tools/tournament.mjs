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
//        [--pmars path/to/pmars [--compare]] [--native-input file]
//        [--bench warrior.red] [--permute]
//
// --bench plays one warrior against every warrior of the set instead of a
// round robin, on the wasm engine unless --engine says otherwise, and lists
// the opponents from the worst result to the best.
//
// Every pairing plays --rounds rounds. The start position of the second
// warrior in the first round is derived from --seed and the pairing, later
// rounds follow from it like in pMARS (`pmars -F pos` uses the same
// sequence), so results are reproducible and comparable with pMARS.
// Score per pairing is 3 per win and 1 per tie; the table shows the sum over
// all opponents and the average per 100 rounds. --permute is pMARS's -P:
// each position and first mover once before any repeats (the seed of a
// pairing is then 2 * (pos - distance), as for `pmars -P -F pos`).
//
// --pmars runs the same tournament with pMARS processes instead of the
// engine (for timing), --compare runs both and checks that every pairing has
// the same wins, losses and ties. Each job is a /bin/sh that starts the pMARS
// processes.
//
// --jobs is the number of threads, the main thread included (default: all
// hardware threads). They take tasks from one shared list until it is empty.
// With --engine wasm a task is a block of about 8 rounds of a pairing
// (runMatch's firstRound), so the threads stay busy to the end with few
// pairings and with many: rounds depend on each other only through p-space,
// which only LDP reads, so the results are the same. A pairing with LDP in
// one of its warriors is one task.
//
// --native-input writes every pairing as a match in the input format of
// lib/tools/bench-native.c and exits, for tools/bench-native.mjs --input.

import { Worker, isMainThread, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble } from '../js/assembler.js';
import { Mars } from '../js/mars.js';
import { OP } from '../js/opcodes.js';
import { compileWasmMars, createWasmMarsSync, packWarrior } from '../wasm/42mars.js';
import { nativeMatch } from './native-input.mjs';

// ------------------------------------------------------------------ tasks
//
// Main thread and workers share the task list and the results in one
// SharedArrayBuffer and take tasks with an atomic counter, so no thread
// waits for another: the main thread works too, and a run is over when the
// last task is, also when some workers have not started yet. The warriors
// are in the buffer as well: a worker gets no copy of them.

const CTL = 4;            // i32: next task, tasks done
const TASK = 6;           // i32 per task: a, b, seed, firstRound, rounds, pairing
const RESULT = 7;         // f64 per task: wins, losses, ties of a, of b, instructions

function shareTasks(codes, tasks) {
  const instructions = codes.reduce((n, c) => n + c.instructions.length, 0);
  const ints = CTL + TASK * tasks.length + 5 * instructions;
  const sab = new SharedArrayBuffer(Math.ceil(ints / 2) * 8 + 8 * RESULT * tasks.length);
  const i32 = new Int32Array(sab, 0, ints);
  let k = CTL;
  for (const t of tasks) { i32.set([t.a, t.b, t.seed, t.firstRound, t.rounds, t.pairing], k); k += TASK; }
  // The warriors as packWarrior() makes them, the instructions in the buffer.
  const warriors = codes.map((c) => {
    const w = packWarrior({ ...c, name: '' }, i32.subarray(k, k + 5 * c.instructions.length));
    k += w.packed.length;
    return w;
  });
  return { sab, tasks: tasks.length, warriors };
}

// Takes tasks until none is left. One engine per thread, reused for every task.
function drain(shared, opts, module) {
  const { sab, tasks, warriors } = shared;
  const i32 = new Int32Array(sab, 0, CTL + TASK * tasks);
  const res = new Float64Array(sab, sab.byteLength - 8 * RESULT * tasks, RESULT * tasks);
  // The JS engine reads instruction objects: unpacked on first use.
  const unpacked = new Array(warriors.length);
  const code = (w) => {
    if (module) return warriors[w];
    if (unpacked[w]) return unpacked[w];
    const p = warriors[w].packed;
    const instructions = [];
    for (let k = 0; k < p.length; k += 5) instructions.push({ op: p[k] >> 3, mod: p[k] & 7, aMode: p[k + 1], aVal: p[k + 2], bMode: p[k + 3], bVal: p[k + 4] });
    return (unpacked[w] = { ...warriors[w], instructions });
  };
  const wasm = module ? createWasmMarsSync(opts, module) : null;
  for (;;) {
    const id = Atomics.add(i32, 0, 1);
    if (id >= tasks) return;
    const [a, b, seed, firstRound, rounds] = i32.subarray(CTL + TASK * id, CTL + TASK * (id + 1));
    let wa, wb, instructions;
    if (wasm) {
      // The match, or a block of its rounds, runs inside WebAssembly, with
      // early tie detection.
      const r = wasm.runMatch([code(a), code(b)], { rounds, seed, firstRound, permute: opts.permute });
      [wa, wb] = r.warriors;
      instructions = r.instructions;
    } else {
      if (firstRound) throw new Error('--engine js plays whole matches only');
      const m = new Mars({ ...opts, headless: true });
      m.load([code(a), code(b)], { seed, permute: opts.permute });
      instructions = 0;
      for (let r = 0; r < rounds; r++) {
        m.startRound();
        while (!m.roundOver) m.run(1 << 22);
        instructions += m.time;
      }
      [wa, wb] = m.warriors;
    }
    res.set([wa.wins, wa.losses, wa.ties, wb.wins, wb.losses, wb.ties, instructions], RESULT * id);
    Atomics.add(i32, 1, 1);
    Atomics.notify(i32, 1);
  }
}

function workerMain() {
  // A WebAssembly.Module sent to a worker shares its compiled code.
  const { shared, opts, module } = workerData;
  drain(shared, opts, module);
}

// ------------------------------------------------------------------ main

function parseArgs(argv) {
  const o = { files: [], rounds: 100, jobs: availableParallelism(), seed: 1, engine: 'js',
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
    else if (a === '--native-input') o.nativeInput = argv[++i];
    else if (a === '--bench') o.bench = argv[++i];
    else if (a === '--permute') o.permute = true;
    else o.files.push(a);
  }
  if (o.bench && !argv.includes('--engine')) o.engine = 'wasm';
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

// The tasks: with the wasm engine a pairing whose warriors have no LDP is
// split into blocks of about BLOCK rounds (see the header), so that all
// threads stay busy to the end whatever the number of pairings. A call of
// runMatch costs about 1 microsecond on top of its rounds. Whole pairings
// come first: they are the longest tasks.
const BLOCK = 8;
function makeTasks(o, codes, pairs) {
  const hasLdp = codes.map((c) => c.instructions.some((x) => x.op === OP.LDP));
  const blocks = o.engine === 'wasm' ? Math.ceil(o.rounds / BLOCK) : 1;
  const whole = [];
  const split = [];
  pairs.forEach((p, k) => {
    const n = hasLdp[p.a] || hasLdp[p.b] ? 1 : Math.max(1, blocks);
    for (let i = 0; i < n; i++) {
      const firstRound = Math.floor((i * o.rounds) / n);
      (n === 1 ? whole : split).push({ pairing: k, a: p.a, b: p.b, seed: (o.permute ? 2 : 1) * (p.pos - o.distance), firstRound, rounds: Math.floor(((i + 1) * o.rounds) / n) - firstRound });
    }
  });
  return [...whole, ...split];
}

async function runEngine(o, codes, pairs) {
  const module = o.engine === 'wasm' ? await compileWasmMars() : null;
  const tasks = makeTasks(o, codes, pairs);
  const opts = { coreSize: o.size, maxCycles: o.cycles, maxProcesses: o.processes, maxLength: o.length, minDistance: o.distance, rounds: o.rounds, permute: Boolean(o.permute) };
  const shared = shareTasks(codes, tasks);
  const ctl = new Int32Array(shared.sab, 0, CTL);
  // The main thread is one of the jobs.
  const workers = Array.from({ length: Math.max(0, Math.min(o.jobs, tasks.length) - 1) }, () => new Worker(fileURLToPath(import.meta.url), { workerData: { shared, opts, module } }));
  const failure = new Promise((_, reject) => { for (const w of workers) w.on('error', reject); });
  failure.catch(() => {});
  try {
    drain(shared, opts, module);
    for (let done; (done = Atomics.load(ctl, 1)) < tasks.length;) await Promise.race([Atomics.waitAsync(ctl, 1, done).value, failure]);
  } finally {
    for (const w of workers) w.terminate(); // the ones that started too late for a task, too
  }
  // Wins, losses and ties of the blocks of a pairing add up.
  const res = new Float64Array(shared.sab, shared.sab.byteLength - 8 * RESULT * tasks.length, RESULT * tasks.length);
  const results = pairs.map((_, id) => ({ id, a: [0, 0, 0], b: [0, 0, 0], instructions: 0 }));
  let instructions = 0;
  tasks.forEach((t, id) => {
    const sum = results[t.pairing];
    const r = res.subarray(RESULT * id, RESULT * (id + 1));
    for (let i = 0; i < 3; i++) { sum.a[i] += r[i]; sum.b[i] += r[3 + i]; }
    sum.instructions += r[6];
    instructions += r[6];
  });
  return { results, instructions };
}

// Reads lines "<id>\t<pos>\t<file a>\t<file b>" and answers each with one
// line "<id> <wins a> <ties a> <wins b> <ties b>". $0 is pMARS, "$@" the
// rules.
const PMARS_LOOP = `while IFS='\t' read -r id pos a b; do echo "$id" $("$0" -b -k "$@" -F "$pos" "$a" "$b"); done`;

// Each job is one shell that starts the pMARS processes of its pairings one
// after another. Starting them from Node costs about 1.4 ms per process on
// the main thread (also from worker threads, which make it slower), a small
// shell starts them about 10 times faster (docs/performance-log.md).
function runPmars(o, files, pairs) {
  return new Promise((resolve, reject) => {
    const results = new Array(pairs.length);
    let next = 0;
    let done = 0;
    const rules = ['-s', o.size, '-c', o.cycles, '-p', o.processes, '-l', o.length, '-d', o.distance, '-r', o.rounds, ...(o.permute ? ['-P'] : [])].map(String);
    if (pairs.length === 0) return resolve({ results });
    for (let k = 0; k < Math.min(o.jobs, pairs.length); k++) {
      const sh = spawn('/bin/sh', ['-c', PMARS_LOOP, o.pmars, ...rules], { stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const feed = () => {
        if (next >= pairs.length) return sh.stdin.end();
        const id = next++;
        const p = pairs[id];
        sh.stdin.write(`${id}\t${p.pos}\t${files[p.a]}\t${files[p.b]}\n`);
      };
      sh.on('error', reject);
      sh.stderr.setEncoding('latin1').on('data', (d) => { err = (err + d).slice(-2000); });
      sh.stdout.setEncoding('latin1').on('data', (d) => {
        out += d;
        let nl;
        while ((nl = out.indexOf('\n')) >= 0) {
          const line = out.slice(0, nl);
          out = out.slice(nl + 1);
          const v = line.trim().split(/\s+/).map(Number);
          if (v.length !== 5 || v.some((x) => !Number.isInteger(x))) {
            sh.kill();
            return reject(new Error(`pMARS gave ${JSON.stringify(line)}${err ? `, stderr: ${err.trim()}` : ''}`));
          }
          const [id, wa, ta, wb, tb] = v;
          results[id] = { id, a: [wa, wb, ta], b: [wb, wa, tb] };
          if (++done === pairs.length) resolve({ results });
          feed();
        }
      });
      feed();
    }
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

// --bench: the score of warrior 0 against each opponent, worst first.
function benchTable(o, names, pairs, results) {
  const rows = pairs.map((p, k) => {
    const [w, l, t] = results[k].a;
    return { name: names[p.b], w, l, t, score: 3 * w + t };
  }).sort((x, y) => x.score - y.score || x.name.localeCompare(y.name));
  const sum = rows.reduce((s, r) => ({ w: s.w + r.w, l: s.l + r.l, t: s.t + r.t, score: s.score + r.score }), { w: 0, l: 0, t: 0, score: 0 });
  const width = Math.min(40, Math.max(...rows.map((r) => r.name.length), 8));
  const per100 = (score, n) => ((100 * score) / (o.rounds * n)).toFixed(1).padStart(8);
  const line = (name, r, n) => `${name.slice(0, width).padEnd(width)} ${per100(r.score, n)} ${String(r.w).padStart(6)} ${String(r.t).padStart(6)} ${String(r.l).padStart(6)}`;
  const lines = [`${names[0]} against ${rows.length} warriors, ${o.rounds} rounds each`, '',
    `${'opponent'.padEnd(width)} ${'per 100'.padStart(8)} ${'wins'.padStart(6)} ${'ties'.padStart(6)} ${'losses'.padStart(6)}`];
  for (const r of rows) lines.push(line(r.name, r, 1));
  lines.push('', line('total', sum, rows.length));
  return { text: lines.join('\n'), rows, total: { ...sum, per100: (100 * sum.score) / (o.rounds * rows.length) } };
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const all = collectFiles(o.files);
  if (o.bench) all.unshift(o.bench);
  if (all.length < 2) {
    console.error('usage: node tools/tournament.mjs <dir or .red files...> [--rounds N] [--jobs N] [--engine js|wasm] [--pmars path [--compare]] [--matrix] [--json file] [--bench warrior.red] [--permute]');
    process.exit(2);
  }
  const files = [];
  const codes = []; // what the engines read of each assembled warrior
  const names = [];
  for (const f of all) {
    const src = readFileSync(f, 'latin1');
    const w = assemble(src, { coreSize: o.size, maxLength: o.length, minDistance: o.distance, maxProcesses: o.processes, maxCycles: o.cycles, rounds: o.rounds, warriors: 2 });
    if (!w.ok || w.instructions.length === 0) {
      const why = w.ok ? 'no instructions' : w.errors[0].text;
      if (o.bench && files.length === 0) { console.error(`${f}: ${why}`); process.exit(2); }
      console.error(`skipped ${f}: ${why}`);
      continue;
    }
    files.push(f);
    codes.push({ ok: w.ok, name: w.name, author: w.author, start: w.start, pin: w.pin, instructions: w.instructions });
    names.push(`${w.name} (${basename(f)})`);
  }
  const pairs = [];
  for (let a = 0; a < (o.bench ? 1 : files.length); a++) {
    for (let b = a + 1; b < files.length; b++) pairs.push({ a, b, pos: pairPosition(o.seed, a, b, o) });
  }
  if (o.nativeInput) {
    if (o.permute) throw new Error('--native-input: lib/tools/bench-native.c has no permute');
    const rules = { coreSize: o.size, maxProcesses: o.processes, maxCycles: o.cycles, minDistance: o.distance, pSpaceSize: Math.floor(o.size / 16) };
    writeFileSync(o.nativeInput, pairs.map((p) => nativeMatch([codes[p.a], codes[p.b]], rules, p.pos - o.distance, o.rounds)).join(''));
    return;
  }
  console.error(`${files.length} warriors, ${pairs.length} pairings, ${o.rounds} rounds each, ${o.jobs} jobs`);

  let report = {};
  if (!o.pmars || o.compare) {
    const t0 = performance.now();
    const { results, instructions } = await runEngine(o, codes, pairs);
    const s = (performance.now() - t0) / 1000;
    const t = o.bench ? benchTable(o, names, pairs, results) : table(o, names, pairs, results);
    console.log(t.text);
    console.error(`engine (${o.engine}): ${s.toFixed(2)} s, ${(instructions / 1e6).toFixed(0)}M instructions executed, ${(instructions / s / 1e6).toFixed(0)}M instructions/s`);
    report = o.bench
      ? { engine: o.engine, seconds: s, instructions, opponents: t.rows, total: t.total, results }
      : { engine: o.engine, seconds: s, instructions, ranking: t.rows, matrix: t.matrix, results };
  }
  if (o.pmars) {
    const t0 = performance.now();
    const { results } = await runPmars(o, files, pairs);
    const s = (performance.now() - t0) / 1000;
    if (!o.compare) console.log((o.bench ? benchTable : table)(o, names, pairs, results).text);
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
else workerMain();
