// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// One-off measurement on GitHub's windows-latest runner, branch msvc-speed
// only: the 42mars program built with cl /O2 from v1.0.0 (worktree old/),
// from this commit, and from this commit with other numbers of specialized
// words for MSVC (cases in the loops + cases in exec_more()). Compile time
// of lib/42mars.c, then whole processes on 20 pairs of the Koenigstuhl '94
// hill and 20 of its '88 hill, the variants alternating.
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.');
const FLAGS = ['/nologo', '/std:c11', '/O2', '/W3', '/D_CRT_SECURE_NO_WARNINGS'];
const RUNS = 5, ROUNDS = 300, COMPILE_LIMIT = 15 * 60;
const variants = [
  { name: 'v1.0.0 (16 cases of the old list)', tree: join(root, 'old') },
  { name: 'main (16 cases)', tree: root },
  { name: '16 + 48', near: 16, count: 64 },
  { name: '16 + 112', near: 16, count: 128 },
  { name: '16 + 240', near: 16, count: 256 },
  { name: '32 + 96', near: 32, count: 128 },
  { name: '64 + 192', near: 64, count: 256 },
];

const out = [];
const say = (line) => { console.log(line); out.push(line); };

function build(v, k) {
  const dir = join(root, 'variants', String(k));
  mkdirSync(dir, { recursive: true });
  let tree = v.tree;
  if (!tree) {
    tree = join(dir, 'tree');
    cpSync(join(root, 'lib'), join(tree, 'lib'), { recursive: true });
    cpSync(join(root, 'cli'), join(tree, 'cli'), { recursive: true });
    const gen = join(tree, 'lib/src/gen-dispatch.mjs');
    const src = readFileSync(gen, 'utf8');
    if (!src.includes('const few = parts(16, 16);')) throw new Error('gen-dispatch.mjs changed');
    writeFileSync(gen, src.replace('const few = parts(16, 16);', `const few = parts(${v.count}, ${v.near});`));
    const g = spawnSync('node', [gen, '-o', join(tree, 'lib/src/dispatch.h')], { encoding: 'utf8' });
    if (g.status !== 0) throw new Error(`gen-dispatch: ${g.stderr}`);
  }
  const obj = join(dir, '42mars.obj'), exe = join(dir, '42mars.exe');
  const t0 = performance.now();
  const c = spawnSync('cl', [...FLAGS, '/c', 'lib\\42mars.c', `/Fo${obj}`], { cwd: tree, encoding: 'utf8', timeout: COMPILE_LIMIT * 1000 });
  const seconds = (performance.now() - t0) / 1000;
  if (c.status !== 0) return { seconds, failed: c.error?.code === 'ETIMEDOUT' ? `no result after ${COMPILE_LIMIT} s` : `cl failed: ${(c.stdout + c.stderr).slice(-300)}` };
  const l = spawnSync('cl', [...FLAGS, 'cli\\42mars.c', obj, `/Fo${join(dir, 'cli.obj')}`, `/Fe${exe}`], { cwd: tree, encoding: 'utf8' });
  if (l.status !== 0) return { seconds, failed: `link failed: ${(l.stdout + l.stderr).slice(-300)}` };
  return { seconds, exe };
}

// Every step-th file of a hill, sorted by code unit, two by two.
function pairs(hill, step, options) {
  const dir = join(root, 'warriors/koenigstuhl', hill);
  const files = readdirSync(dir).filter((f) => f.endsWith('.red')).sort().filter((_, i) => i % step === 0).slice(0, 40);
  return Array.from({ length: 20 }, (_, k) => [...options, join(dir, files[2 * k]), join(dir, files[2 * k + 1])]);
}
const workloads = [
  { name: `'94 hill`, pairs: pairs('94nop', 27, []) },
  { name: `'88 hill`, pairs: pairs('88', 17, ['-8']) },
];

const banner = spawnSync('cl', [], { encoding: 'utf8' });
say(`${(banner.stderr || '').split('\n')[0].trim()}; ${process.env.PROCESSOR_IDENTIFIER ?? ''}, ${process.env.NUMBER_OF_PROCESSORS ?? '?'} processors`);
say('');
say('| Variant | compile lib/42mars.c |');
say('|---|---|');
const built = [];
variants.forEach((v, k) => {
  if (v.tree && !existsSync(v.tree)) throw new Error(`no ${v.tree}`);
  const b = build(v, k);
  say(`| ${v.name} | ${b.seconds.toFixed(1)} s${b.failed ? `, ${b.failed}` : ''} |`);
  if (b.exe) built.push({ ...v, exe: b.exe });
});

const median = (x) => [...x].sort((a, b) => a - b)[x.length >> 1];
for (const w of workloads) {
  const times = built.map(() => []);
  const results = built.map(() => '');
  for (let r = 0; r < RUNS; r++) {
    built.forEach((v, k) => {
      let all = '';
      const t0 = performance.now();
      for (const p of w.pairs) {
        const run = spawnSync(v.exe, ['-b', '-r', String(ROUNDS), '-F', '1334', ...p], { encoding: 'latin1' });
        all += `${run.status}:${run.stdout.trim().split('\n').at(-1)}|`;
      }
      times[k].push((performance.now() - t0) / 1000);
      results[k] = all;
    });
  }
  say('');
  say(`${w.name}: 20 pairs x ${ROUNDS} rounds, ${RUNS} alternating runs, seconds, median (range)`);
  say('');
  say('| Variant | seconds | against v1.0.0 | results |');
  say('|---|---|---|---|');
  const base = median(times[0]);
  built.forEach((v, k) => {
    const m = median(times[k]);
    say(`| ${v.name} | ${m.toFixed(3)} (${Math.min(...times[k]).toFixed(3)} to ${Math.max(...times[k]).toFixed(3)}) | ${k ? `${((base / m - 1) * 100).toFixed(1)}% faster` : ''} | ${results[k] === results[0] ? 'same' : 'DIFFER'} |`);
  });
  say('');
  say(`first results: ${results[0].slice(0, 200)}`);
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n');
