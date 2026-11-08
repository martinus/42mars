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
//        [--ci-width W [--min-rounds 20] [--exact-top N]]
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
// the same wins, losses and ties. Each job is a /bin/sh that starts the pMARS
// processes.
//
// With --engine wasm and fewer than 4 pairings per job, each pairing whose
// warriors have no LDP is split into blocks of rounds that run on several
// workers (runMatch's firstRound): rounds depend on each other only through
// p-space, which only LDP reads, so the results are the same.
//
// --native-input writes every pairing as a match in the input format of
// src/engine/wasm/bench-native.c and exits, for tools/bench-native.mjs --input.
//
// --ci-width W stops each pairing early, which changes results against
// pMARS (runMatch's `stop`, docs/redcode-semantics.md section 4): from round
// --min-rounds on, once the 95% interval of the first warrior's points per
// 100 rounds is at most W wide. Scores are then estimates for --rounds
// rounds: 3 per win and 1 per tie of the played rounds, scaled by --rounds /
// played. W 0 stops a pairing whose first --min-rounds rounds all ended the
// same way. --exact-top N then plays the stopped pairings among the N best
// warriors of that first pass again with all rounds and replaces their
// results; the scores of these warriors still hold the estimated pairings
// against the others. Refused together with --pmars, --compare and
// --native-input.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble } from '../src/engine/assembler.js';
import { Mars } from '../src/engine/mars.js';
import { OP } from '../src/engine/opcodes.js';
import { nativeMatch } from './native-input.mjs';

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
    const { id, a, b, seed, firstRound, rounds, stop } = task;
    let wa, wb, instructions, played;
    if (wasm) {
      // The match, or a block of its rounds, runs inside WebAssembly, with
      // early tie detection.
      const r = wasm.runMatch([codes[a], codes[b]], { rounds, seed, firstRound, stop });
      [wa, wb] = r.warriors;
      instructions = r.instructions;
      played = r.rounds;
    } else {
      if (firstRound) throw new Error('--engine js plays whole matches only');
      const m = new Mars({ ...opts, headless: true });
      m.load([codes[a], codes[b]], { seed });
      instructions = 0;
      let sum = 0;
      let squares = 0;
      for (played = 0; played < rounds;) {
        m.startRound();
        while (!m.roundOver) m.run(1 << 22);
        instructions += m.time;
        played++;
        // The stop rule of runMatch in mars.c, same operations in the same
        // order.
        if (stop) {
          const x = m.warriors[0].alive ? (m.warriors[1].alive ? 1 : 3) : 0;
          sum += x;
          squares += x * x;
          if (played >= Math.max(stop.minRounds, 2)) {
            const mean = sum / played;
            const v = Math.max((squares - played * mean * mean) / (played - 1), 0);
            if (2 * 1.96 * Math.sqrt(v / played) * 100 <= stop.width) break;
          }
        }
      }
      [wa, wb] = m.warriors;
    }
    parentPort.postMessage({ id, a: [wa.wins, wa.losses, wa.ties], b: [wb.wins, wb.losses, wb.ties], instructions, rounds: played });
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
    else if (a === '--native-input') o.nativeInput = argv[++i];
    else if (a === '--ci-width') o.ciWidth = num();
    else if (a === '--min-rounds') o.minRounds = num();
    else if (a === '--exact-top') o.exactTop = num();
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

// The tasks for the workers: a pairing each, or blocks of its rounds when
// there are few pairings (see the header). A pairing that may stop early
// plays its rounds in order, so it is never split.
function makeTasks(o, codes, pairs, stop) {
  const hasLdp = codes.map((c) => c.instructions.some((x) => x.op === OP.LDP));
  const blocks = o.engine === 'wasm' && !stop && pairs.length < 4 * o.jobs ? Math.min(o.rounds, Math.ceil((4 * o.jobs) / pairs.length)) : 1;
  const tasks = [];
  pairs.forEach((p, k) => {
    const n = hasLdp[p.a] || hasLdp[p.b] ? 1 : Math.max(1, blocks);
    for (let i = 0; i < n; i++) {
      const firstRound = Math.floor((i * o.rounds) / n);
      tasks.push({ pairing: k, a: p.a, b: p.b, seed: p.pos - o.distance, firstRound, rounds: Math.floor(((i + 1) * o.rounds) / n) - firstRound });
    }
  });
  return tasks;
}

// Plays `pairs` on the engine; with `stop` ({ width, minRounds }) each
// pairing may stop early. Results per pairing: wins, losses and ties of
// both sides, instructions and rounds played.
async function runEngine(o, codes, pairs, stop = null) {
  const module = o.engine === 'wasm' ? await (await import('../src/engine/mars-wasm.js')).compileWasmMars() : null;
  const tasks = makeTasks(o, codes, pairs, stop);
  if (tasks.length > pairs.length) console.error(`${tasks.length} tasks: pairings without LDP split into blocks of rounds`);
  return new Promise((resolve, reject) => {
    const opts = { coreSize: o.size, maxCycles: o.cycles, maxProcesses: o.processes, maxLength: o.length, minDistance: o.distance, rounds: o.rounds };
    // Wins, losses and ties of the blocks of a pairing add up.
    const results = pairs.map((_, id) => ({ id, a: [0, 0, 0], b: [0, 0, 0], instructions: 0, rounds: 0 }));
    let next = 0;
    let done = 0;
    let instructions = 0;
    const workers = Array.from({ length: Math.min(o.jobs, tasks.length) }, () => new Worker(fileURLToPath(import.meta.url), { workerData: { codes, opts, module } }));
    const feed = (w) => {
      if (next < tasks.length) {
        const t = tasks[next];
        w.postMessage({ id: next++, a: t.a, b: t.b, seed: t.seed, firstRound: t.firstRound, rounds: t.rounds, stop });
      } else w.postMessage(null);
    };
    for (const w of workers) {
      w.on('message', (r) => {
        const sum = results[tasks[r.id].pairing];
        for (let i = 0; i < 3; i++) { sum.a[i] += r.a[i]; sum.b[i] += r.b[i]; }
        sum.instructions += r.instructions;
        sum.rounds += r.rounds;
        instructions += r.instructions;
        if (++done === tasks.length) resolve({ results, instructions });
        feed(w);
      });
      w.on('error', reject);
      feed(w);
    }
    if (tasks.length === 0) resolve({ results, instructions });
  });
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
    const rules = ['-s', o.size, '-c', o.cycles, '-p', o.processes, '-l', o.length, '-d', o.distance, '-r', o.rounds].map(String);
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
          results[id] = { id, a: [wa, wb, ta], b: [wb, wa, tb], rounds: o.rounds };
          if (++done === pairs.length) resolve({ results });
          feed();
        }
      });
      feed();
    }
  });
}

// Score of a pairing: 3 per win and 1 per tie, for a pairing that stopped
// early scaled to --rounds rounds.
const pairScore = (o, wlt, played) => {
  const s = 3 * wlt[0] + wlt[2];
  return played === o.rounds ? s : (s * o.rounds) / played;
};
const showScore = (s, digits) => (Number.isInteger(s) ? String(s) : s.toFixed(digits));

function table(o, names, pairs, results) {
  const n = names.length;
  const total = names.map((name, i) => ({ name, i, w: 0, l: 0, t: 0, score: 0, rounds: 0 }));
  const matrix = Array.from({ length: n }, () => new Array(n).fill(null));
  pairs.forEach((p, k) => {
    const r = results[k];
    for (const [side, other, wlt] of [[p.a, p.b, r.a], [p.b, p.a, r.b]]) {
      total[side].w += wlt[0];
      total[side].l += wlt[1];
      total[side].t += wlt[2];
      total[side].rounds += r.rounds;
      total[side].score += pairScore(o, wlt, r.rounds);
      matrix[side][other] = pairScore(o, wlt, r.rounds);
    }
  });
  const rows = [...total].sort((x, y) => y.score - x.score);
  const opponents = Math.max(1, n - 1);
  const width = Math.min(32, Math.max(...names.map((s) => s.length), 4));
  const stopped = o.ciWidth !== undefined;
  const lines = [`${'#'.padStart(3)}  ${'warrior'.padEnd(width)} ${'score'.padStart(7)} ${'per 100'.padStart(8)} ${'wins'.padStart(6)} ${'ties'.padStart(6)} ${'losses'.padStart(6)}${stopped ? ' rounds'.padStart(8) : ''}`];
  rows.forEach((r, k) => {
    lines.push(`${String(k + 1).padStart(3)}  ${r.name.slice(0, width).padEnd(width)} ${showScore(r.score, 1).padStart(7)} ${((100 * r.score) / (o.rounds * opponents)).toFixed(1).padStart(8)} ${String(r.w).padStart(6)} ${String(r.t).padStart(6)} ${String(r.l).padStart(6)}${stopped ? String(r.rounds).padStart(8) : ''}`);
  });
  if (o.matrix) {
    lines.push('', 'score of row against column:');
    rows.forEach((r) => lines.push(`${r.name.slice(0, width).padEnd(width)} ${rows.map((c) => (matrix[r.i][c.i] === null ? '-' : showScore(matrix[r.i][c.i], 0)).padStart(5)).join('')}`));
  }
  return { text: lines.join('\n'), rows, matrix };
}

// The pairings among the n best warriors of `rows`.
function topPairings(pairs, rows, n) {
  const top = new Set(rows.slice(0, n).map((r) => r.i));
  return pairs.map((p, k) => k).filter((k) => top.has(pairs[k].a) && top.has(pairs[k].b));
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const all = collectFiles(o.files);
  if (all.length < 2) {
    console.error('usage: node tools/tournament.mjs <dir or .red files...> [--rounds N] [--jobs N] [--engine js|wasm] [--pmars path [--compare]] [--ci-width W [--min-rounds N] [--exact-top N]] [--matrix] [--json file]');
    process.exit(2);
  }
  const refuse = (why) => {
    console.error(why);
    process.exit(2);
  };
  if (o.ciWidth !== undefined) {
    if (!(o.ciWidth >= 0) || !Number.isFinite(o.ciWidth)) refuse(`--ci-width must be a number >= 0: ${o.ciWidth}`);
    if (o.pmars || o.compare) refuse('--ci-width changes results against pMARS: not together with --pmars or --compare');
    if (o.nativeInput) refuse('--native-input writes whole matches: not together with --ci-width');
    o.minRounds ??= 20;
    if (!Number.isSafeInteger(o.minRounds) || o.minRounds < 0) refuse(`--min-rounds must be a count: ${o.minRounds}`);
    if (o.exactTop !== undefined && !(Number.isSafeInteger(o.exactTop) && o.exactTop >= 0)) refuse(`--exact-top must be a count: ${o.exactTop}`);
  } else if (o.minRounds !== undefined || o.exactTop !== undefined) {
    refuse('--min-rounds and --exact-top need --ci-width');
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
  if (o.nativeInput) {
    const rules = { coreSize: o.size, maxProcesses: o.processes, maxCycles: o.cycles, minDistance: o.distance, pSpaceSize: Math.floor(o.size / 16) };
    writeFileSync(o.nativeInput, pairs.map((p) => nativeMatch([codes[p.a], codes[p.b]], rules, p.pos - o.distance, o.rounds)).join(''));
    return;
  }
  console.error(`${files.length} warriors, ${pairs.length} pairings, ${o.rounds} rounds each, ${o.jobs} jobs`);

  let report = {};
  if (!o.pmars || o.compare) {
    const t0 = performance.now();
    const stop = o.ciWidth === undefined ? null : { width: o.ciWidth, minRounds: o.minRounds };
    let { results, instructions } = await runEngine(o, codes, pairs, stop);
    let exact = [];
    if (stop) {
      const played = results.reduce((a, r) => a + r.rounds, 0);
      const early = results.filter((r) => r.rounds < o.rounds).length;
      console.error(`early stop (width ${o.ciWidth}, at least ${o.minRounds} rounds): ${early} of ${pairs.length} pairings stopped, ${((100 * played) / (pairs.length * o.rounds)).toFixed(1)}% of the rounds played`);
      if (o.exactTop) {
        // Second pass: the pairings among the best of the first pass again
        // with all rounds, results as without --ci-width.
        exact = topPairings(pairs, table(o, names, pairs, results).rows, o.exactTop).filter((k) => results[k].rounds < o.rounds);
        const again = await runEngine(o, codes, exact.map((k) => pairs[k]));
        exact.forEach((k, j) => { results[k] = { ...again.results[j], id: k }; });
        instructions += again.instructions;
        console.error(`exact second pass: ${exact.length} stopped pairings among the top ${o.exactTop}, ${(again.instructions / 1e6).toFixed(0)}M instructions`);
      }
    }
    const s = (performance.now() - t0) / 1000;
    const t = table(o, names, pairs, results);
    console.log(t.text);
    console.error(`engine (${o.engine}): ${s.toFixed(2)} s, ${(instructions / 1e6).toFixed(0)}M instructions executed, ${(instructions / s / 1e6).toFixed(0)}M instructions/s`);
    report = { engine: o.engine, seconds: s, instructions, ranking: t.rows, matrix: t.matrix, results, ...(stop ? { exact } : {}) };
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
