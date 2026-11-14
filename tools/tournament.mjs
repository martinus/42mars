#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Round-robin tournament over a set of warriors, battles run in parallel on
// worker threads with the wasm engine (wasm/42mars.js).
//
//   node tools/tournament.mjs <dir or .red files...> [--rounds 100] [--jobs N]
//        [--seed 1] [--size 8000 --cycles 80000 --processes 8000 --length 100
//        --distance 100 --read-limit N --write-limit N]
//        [--matrix] [--json out.json]
//        [--pmars path/to/pmars [--compare]] [--native-input file]
//        [--bench warrior.red] [--permute] [--icws88] [--progress]
//
// --engine wasm is accepted and changes nothing: the only engine since the
// JavaScript simulator went (#76); logged commands still carry it.
//
// --bench plays one warrior against every warrior of the set instead of a
// round robin and lists the opponents from the worst result to the best.
//
// Every pairing plays --rounds rounds. The start position of the second
// warrior in the first round is derived from --seed and the pairing, later
// rounds follow from it like in pMARS (`pmars -F pos` uses the same
// sequence), so results are reproducible and comparable with pMARS.
// Score per pairing is 3 per win and 1 per tie; the table shows the sum over
// all opponents and the average per 100 rounds. --permute is pMARS's -P:
// each position and first mover once before any repeats (the seed of a
// pairing is then 2 * (pos - distance), as for `pmars -P -F pos`).
// --icws88 assembles ICWS'88 only, pMARS's -8.
//
// --pmars runs the same tournament with pMARS processes instead of the
// engine (for timing), --compare runs both and checks that every pairing has
// the same wins, losses and ties. Each job is a /bin/sh that starts the pMARS
// processes. Any program with pMARS's options and output will do: with
// --pmars build/42mars (after make) the tournament runs on the native
// library, a process per pairing, 80 warriors on 31 jobs in 2.35 s against
// 2.90 s on the wasm engine (14th November 2026).
//
// --jobs is the number of threads, the main thread included (default: all
// hardware threads). They take tasks from one shared list until it is empty.
// A task is a block of 8 rounds of a pairing (runMatch's
// firstRound; 1 round with --progress, see makeTasks()), and the tasks go
// round by round: the first block of every pairing, then the second ...
// Rounds depend on each other only through p-space, which only LDP reads, so
// the results are those of whole matches. A pairing with LDP in one of its
// warriors is one task, and these come first.
//
// --progress prints the standings after every round, as soon as every
// pairing has played it: they equal a tournament of that many rounds. --json
// has them too, as `progress`: the score of every warrior after every round
// (without --progress they come in blocks of 8 rounds, but are the same).
//
// --native-input writes every pairing as a match in the input format of
// bench/bench-native.c and exits, for bench/bench-native.mjs --input.

import { Worker, isMainThread, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OP } from './opcodes.js';
import { compileMars, createMarsSync, packWarrior, assemble } from '../wasm/42mars.js';
import { nativeMatch } from '../bench/native-input.mjs';

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
// Per pairing and round, after the task that played it: OUTCOME_A (a won),
// OUTCOME_B or OUTCOME_TIE; and per round the number of pairings that played it.
const OUTCOME_A = 1, OUTCOME_B = 2, OUTCOME_TIE = 3;

// The buffer: i32 control, tasks, rounds done, then the warriors' instructions;
// f64 results; u8 outcomes.
function layout(tasks, rounds, pairs, instructions) {
  const ints = CTL + TASK * tasks + rounds + 5 * instructions;
  const results = Math.ceil(ints / 2) * 8;
  const outcomes = results + 8 * RESULT * tasks;
  return { ints, results, outcomes, bytes: outcomes + pairs * rounds, rounds, pairs, tasks };
}

function shareTasks(codes, tasks, rounds, pairs) {
  const instructions = codes.reduce((n, c) => n + c.instructions.length, 0);
  const at = layout(tasks.length, rounds, pairs, instructions);
  const sab = new SharedArrayBuffer(at.bytes);
  const i32 = new Int32Array(sab, 0, at.ints);
  let k = CTL;
  for (const t of tasks) { i32.set([t.a, t.b, t.seed, t.firstRound, t.rounds, t.pairing], k); k += TASK; }
  k += rounds;
  // The warriors as packWarrior() makes them, the instructions in the buffer.
  const warriors = codes.map((c) => {
    const w = packWarrior({ ...c, name: '' }, i32.subarray(k, k + 5 * c.instructions.length));
    k += w.packed.length;
    return w;
  });
  return { sab, at, warriors };
}

function views(shared) {
  const { sab, at } = shared;
  return {
    i32: new Int32Array(sab, 0, at.ints),
    roundsDone: new Int32Array(sab, 4 * (CTL + TASK * at.tasks), at.rounds),
    res: new Float64Array(sab, at.results, RESULT * at.tasks),
    outcomes: new Uint8Array(sab, at.outcomes, at.pairs * at.rounds),
  };
}

// Takes tasks until none is left. One engine per thread, reused for every
// task. done() runs after each task (the main thread's progress).
function drain(shared, opts, module, done = () => {}) {
  const { warriors, at } = shared;
  const { i32, roundsDone, res, outcomes } = views(shared);
  const wasm = createMarsSync(opts, module);
  for (;;) {
    const id = Atomics.add(i32, 0, 1);
    if (id >= at.tasks) return;
    const [a, b, seed, firstRound, rounds, pairing] = i32.subarray(CTL + TASK * id, CTL + TASK * (id + 1));
    // The match, or a block of its rounds, runs inside WebAssembly, with
    // early tie detection.
    const { warriors: [wa, wb], instructions, results: played } = wasm.runMatch([warriors[a], warriors[b]], { rounds, seed, firstRound, permute: opts.permute });
    res.set([wa.wins, wa.losses, wa.ties, wb.wins, wb.losses, wb.ties, instructions], RESULT * id);
    for (const { round, survivors } of played) {
      outcomes[pairing * at.rounds + round - 1] = survivors.length === 2 ? OUTCOME_TIE : survivors[0] === 0 ? OUTCOME_A : OUTCOME_B;
      Atomics.add(roundsDone, round - 1, 1);
    }
    Atomics.add(i32, 1, 1);
    Atomics.notify(i32, 1);
    done();
  }
}

function workerMain() {
  // A WebAssembly.Module sent to a worker shares its compiled code.
  const { shared, opts, module } = workerData;
  drain(shared, opts, module);
}

// ------------------------------------------------------------------ main

function parseArgs(argv) {
  const o = { files: [], rounds: 100, jobs: availableParallelism(), seed: 1,
    size: 8000, cycles: 80000, processes: 8000, length: 100, distance: 100, readLimit: 0, writeLimit: 0, matrix: false };
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
    else if (a === '--read-limit') o.readLimit = num(); // pmars -R, 0: the core size
    else if (a === '--write-limit') o.writeLimit = num(); // pmars -W
    else if (a === '--engine') {
      if (argv[++i] !== 'wasm') throw new Error('--engine: only wasm, the JavaScript engine is gone (#76)');
    }
    else if (a === '--matrix') o.matrix = true;
    else if (a === '--json') o.json = argv[++i];
    else if (a === '--pmars') o.pmars = argv[++i];
    else if (a === '--compare') o.compare = true;
    else if (a === '--native-input') o.nativeInput = argv[++i];
    else if (a === '--bench') o.bench = argv[++i];
    else if (a === '--permute') o.permute = true;
    else if (a === '--icws88') o.icws88 = true;
    else if (a === '--progress') o.progress = true;
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

// The tasks: a pairing whose warriors have no LDP is
// split into blocks of BLOCK rounds, ordered by round, so that the standings
// after each round are there early and all threads stay busy to the end
// whatever the number of pairings. Whole pairings come first: they are the
// longest tasks. Blocks of 1 round (--progress, not with --permute) show
// every round as it is done, but the many runMatch calls cost: t80 with 31
// jobs took 3.02 s against 2.80 s with blocks of 8 (2 rounds: 2.93, 4:
// 2.85; median of 3 each).
const BLOCK = 8;
function makeTasks(o, codes, pairs) {
  const hasLdp = codes.map((c) => c.instructions.some((x) => x.op === OP.LDP));
  const block = o.progress && !o.permute ? 1 : BLOCK;
  const whole = [];
  const split = [];
  pairs.forEach((p, k) => {
    const task = (firstRound, rounds) => ({ pairing: k, a: p.ca, b: p.cb, seed: (o.permute ? 2 : 1) * (p.pos - o.distance), firstRound, rounds });
    if (hasLdp[p.ca] || hasLdp[p.cb] || block >= o.rounds) whole.push(task(0, o.rounds));
    else for (let r = 0; r < o.rounds; r += block) split.push(task(r, Math.min(block, o.rounds - r)));
  });
  split.sort((x, y) => x.firstRound - y.firstRound || x.pairing - y.pairing);
  return [...whole, ...split];
}

// Runs the tournament on the engine. onRound(k, results) is called for k =
// 1, 2 .. rounds as soon as every pairing has played round k, with the
// results of rounds 1 .. k per pairing ({ a: [w, l, t], b: [w, l, t] }).
async function runEngine(o, codes, pairs, onRound = null) {
  const module = await compileMars();
  const tasks = makeTasks(o, codes, pairs);
  const opts = { coreSize: o.size, maxCycles: o.cycles, maxProcesses: o.processes, maxLength: o.length, minDistance: o.distance, rounds: o.rounds, readLimit: o.readLimit, writeLimit: o.writeLimit, permute: Boolean(o.permute) };
  const shared = shareTasks(codes, tasks, o.rounds, pairs.length);
  const { i32: ctl, roundsDone, res, outcomes } = views(shared);
  // The rounds every pairing has played, and their results so far.
  let shown = 0;
  const sofar = pairs.map(() => ({ a: [0, 0, 0], b: [0, 0, 0] }));
  const progress = () => {
    while (onRound && shown < o.rounds && Atomics.load(roundsDone, shown) === pairs.length) {
      pairs.forEach((_, k) => {
        const r = sofar[k];
        switch (outcomes[k * o.rounds + shown]) {
          case OUTCOME_A: r.a[0]++; r.b[1]++; break;
          case OUTCOME_B: r.a[1]++; r.b[0]++; break;
          default: r.a[2]++; r.b[2]++;
        }
      });
      onRound(++shown, sofar);
    }
  };
  // The main thread is one of the jobs.
  const workers = Array.from({ length: Math.max(0, Math.min(o.jobs, tasks.length) - 1) }, () => new Worker(fileURLToPath(import.meta.url), { workerData: { shared, opts, module } }));
  const failure = new Promise((_, reject) => { for (const w of workers) w.on('error', reject); });
  failure.catch(() => {});
  try {
    drain(shared, opts, module, progress);
    for (let done; (done = Atomics.load(ctl, 1)) < tasks.length;) {
      progress();
      await Promise.race([Atomics.waitAsync(ctl, 1, done).value, failure]);
    }
    progress();
  } finally {
    for (const w of workers) w.terminate(); // the ones that started too late for a task, too
  }
  // Wins, losses and ties of the blocks of a pairing add up.
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
    const rules = ['-s', o.size, '-c', o.cycles, '-p', o.processes, '-l', o.length, '-d', o.distance, '-r', o.rounds,
      ...(o.readLimit ? ['-R', o.readLimit] : []), ...(o.writeLimit ? ['-W', o.writeLimit] : []), ...(o.permute ? ['-P'] : []), ...(o.icws88 ? ['-8'] : [])].map(String);
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
  await compileMars(); // the assembler is in 42mars.wasm
  const all = collectFiles(o.files);
  if (o.bench) all.unshift(o.bench);
  if (all.length < 2) {
    console.error('usage: node tools/tournament.mjs <dir or .red files...> [--rounds N] [--jobs N] [--pmars path [--compare]] [--matrix] [--json file] [--bench warrior.red] [--permute] [--icws88] [--progress]');
    process.exit(2);
  }
  const files = [];
  const codes = []; // what the engines read of each assembled warrior
  const names = [];
  // pMARS plays a pairing as `pmars a b` and assembles a with the registers
  // its score formula check leaves, w = s = 2, b with all 0 (semantics doc,
  // section 5): the code of each warrior as a and as b, one entry in codes
  // when both are the same.
  const asA = [];
  const asB = [];
  const code = (w) => ({ ok: w.ok, name: w.name, author: w.author, start: w.start, pin: w.pin, instructions: w.instructions });
  for (const f of all) {
    const src = readFileSync(f, 'latin1');
    const rules = { coreSize: o.size, maxLength: o.length, minDistance: o.distance, maxProcesses: o.processes, maxCycles: o.cycles, rounds: o.rounds, warriors: 2, readLimit: o.readLimit, writeLimit: o.writeLimit, icws88: Boolean(o.icws88) };
    const w = assemble(src, rules);
    const first = assemble(src, { ...rules, registers: { w: 2, s: 2 } });
    const bad = [w, first].find((x) => !x.ok || x.instructions.length === 0);
    if (bad) {
      const why = bad.ok ? 'no instructions' : bad.errors[0].text;
      if (o.bench && files.length === 0) { console.error(`${f}: ${why}`); process.exit(2); }
      console.error(`skipped ${f}: ${why}`);
      continue;
    }
    files.push(f);
    names.push(`${w.name} (${basename(f)})`);
    asB.push(codes.push(code(w)) - 1);
    const same = JSON.stringify([first.instructions, first.start, first.pin]) === JSON.stringify([w.instructions, w.start, w.pin]);
    asA.push(same ? asB[asB.length - 1] : codes.push(code(first)) - 1);
  }
  // a and b index names and files, ca and cb codes
  const pairs = [];
  for (let a = 0; a < (o.bench ? 1 : files.length); a++) {
    for (let b = a + 1; b < files.length; b++) pairs.push({ a, b, pos: pairPosition(o.seed, a, b, o), ca: asA[a], cb: asB[b] });
  }
  if (o.nativeInput) {
    if (o.permute || o.readLimit || o.writeLimit) throw new Error('--native-input: bench/bench-native.c has no permute and no limits');
    const rules = { coreSize: o.size, maxProcesses: o.processes, maxCycles: o.cycles, minDistance: o.distance, pSpaceSize: Math.floor(o.size / 16) };
    writeFileSync(o.nativeInput, pairs.map((p) => nativeMatch([codes[p.ca], codes[p.cb]], rules, p.pos - o.distance, o.rounds)).join(''));
    return;
  }
  console.error(`${files.length} warriors, ${pairs.length} pairings, ${o.rounds} rounds each, ${o.jobs} jobs`);

  let report = {};
  if (!o.pmars || o.compare) {
    // the standings after each round: printed with --progress, the scores in --json
    const progress = [];
    const onRound = o.progress || o.json ? (k, sofar) => {
      if (o.progress) {
        const ok = { ...o, rounds: k, matrix: false };
        console.log(`after round ${k}:\n${(o.bench ? benchTable : table)(ok, names, pairs, sofar).text}\n`);
      }
      const scores = names.map(() => 0);
      pairs.forEach((p, i) => {
        scores[p.a] += 3 * sofar[i].a[0] + sofar[i].a[2];
        scores[p.b] += 3 * sofar[i].b[0] + sofar[i].b[2];
      });
      progress.push(scores);
    } : null;
    const t0 = performance.now();
    const { results, instructions } = await runEngine(o, codes, pairs, onRound);
    const s = (performance.now() - t0) / 1000;
    const t = o.bench ? benchTable(o, names, pairs, results) : table(o, names, pairs, results);
    console.log(t.text);
    console.error(`engine (wasm): ${s.toFixed(2)} s, ${(instructions / 1e6).toFixed(0)}M instructions executed, ${(instructions / s / 1e6).toFixed(0)}M instructions/s`);
    report = o.bench
      ? { engine: 'wasm', seconds: s, instructions, opponents: t.rows, total: t.total, results }
      : { engine: 'wasm', seconds: s, instructions, ranking: t.rows, matrix: t.matrix, results };
    if (onRound) report.progress = progress;
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
