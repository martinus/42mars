#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Differential fuzzer for the expression evaluator. Feeds random expressions
// through an external evaluator program (used as a black box) and compares
// with js/expr.js.
//
//   node tools/expr-fuzz.mjs --eval path/to/evaluator [--n 500000] [--seed 1]
//        [--jobs 16] [--show 20]
//
// The external program reads one expression per line on stdin and prints
// `status value` per line (status 0 ok, 1 overflow, -1 bad expression, -2
// division by zero), with the registers reset before every line.
//
// Expressions whose result is undefined in the reference are left out and
// counted: a lone `!`, `=`, `&` or `|` where an operator is expected, and
// dividing -2^63 by -1 (which crashes a C implementation).

import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { Evaluator } from '../js/expr.js';

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const EVAL = arg('eval');
if (!EVAL) {
  console.error('usage: node tools/expr-fuzz.mjs --eval path/to/evaluator [--n 500000] [--seed 1] [--jobs n] [--show n]');
  process.exit(2);
}
const N = Number(arg('n', 500000));
const JOBS = Number(arg('jobs', Math.max(1, cpus().length - 2)));
const SHOW = Number(arg('show', 20));
const CHUNK = 5000;

let seed = Number(arg('seed', 1)) >>> 0 || 1;
const rand = (k) => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed % k;
};
const pick = (a) => a[rand(a.length)];

// ---------------------------------------------------------------- generator

const OPS = ['+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', '&&', '||'];
const BIG = ['9223372036854775807', '9223372036854775806', '9223372036854775808', '4611686018427387904',
  '3037000500', '3037000499', '18446744073709551615', '99999999999999999999', '100000000000000000000',
  '123456789012345678901', '0000000000000000000001', '2147483648', '4294967296'];
const LETTERS = 'abcABCxyzZ';
// Mostly no space, sometimes a space or tab, rarely more.
const space = () => pick(['', '', '', '', ' ', ' ', '\t', '  ', ' \t', '\v', '\f']);

function number() {
  const r = rand(10);
  if (r < 6) return String(rand(13));
  if (r < 8) return String(rand(100000));
  return pick(BIG);
}

function term(depth) {
  const r = rand(20);
  if (r < 3 && depth < 4) return `(${space()}${expr(depth + 1)}${space()}${rand(40) ? ')' : ''}`;
  if (r < 5) return `${pick(['-', '+', '!', '-', '!'])}${space()}${term(depth)}`;
  if (r < 7) return pick(LETTERS);
  // Assignment, with and without parentheses around it.
  if (r < 9 && depth < 4) return `${pick(LETTERS)}${space()}=${space()}${expr(depth + 1)}`;
  if (r < 10 && depth < 4) return `(${pick(LETTERS)}=${expr(depth + 1)})`;
  return number();
}

function expr(depth = 0) {
  let e = term(depth);
  const count = depth === 0 ? rand(10) : rand(5);
  for (let i = 0; i < count; i++) e += space() + pick(OPS) + space() + term(depth);
  return e;
}

// Rarely damages an expression with a stray character.
function noise(e) {
  if (rand(25)) return e;
  const at = rand(e.length + 1);
  const c = pick(['(', ')', 'q', '7', '#', ',', '$', '.', ' ', '']);
  return rand(2) ? e.slice(0, at) + c + e.slice(at) : e.slice(0, at) + e.slice(at + 1);
}

// Finds out whether evaluating `text` reaches an undefined case. Uses the
// engine's own control flow, which visits the same positions as the reference.
class UndefinedProbe extends Evaluator {
  operator() {
    const c = this.peek();
    const c2 = this.peek(1);
    if ('!=&|'.includes(c) && !(c2 === (c === '!' ? '=' : c))) this.undefined = true;
    return super.operator();
  }

  // Any operator with these operands is left out, which covers / and %.
  apply(op, a, b) {
    if (a === -(1n << 63n) && b === -1n) this.undefined = true;
    return super.apply(op, a, b);
  }
}

function isUndefined(text) {
  const p = new UndefinedProbe();
  p.undefined = false;
  p.evaluate(text);
  return p.undefined;
}

// ---------------------------------------------------------------- run

function runEval(lines) {
  return new Promise((resolve, reject) => {
    const child = spawn(EVAL, [], { stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 60000);
    child.stdout.setEncoding('latin1');
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`evaluator exited with ${code ?? signal}`));
      resolve(out.split('\n').slice(0, lines.length));
    });
    child.stdin.end(lines.join('\n') + '\n', 'latin1');
  });
}

const cls = (s) => (s >= 0 ? 'ok' : 'error');

const exprs = [];
let skipped = 0;
while (exprs.length < N) {
  const e = noise(expr());
  if (isUndefined(e)) { skipped++; continue; }
  exprs.push(e);
}

const stats = { total: 0, value: 0, accept: 0, overflow: 0, kind: 0 };
const byStatus = { '0': 0, '1': 0, '-1': 0, '-2': 0 };
const shown = [];
const chunks = [];
for (let i = 0; i < exprs.length; i += CHUNK) chunks.push(exprs.slice(i, i + CHUNK));
let next = 0;
await Promise.all(Array.from({ length: Math.min(JOBS, chunks.length) }, async () => {
  while (next < chunks.length) {
    const chunk = chunks[next++];
    const out = await runEval(chunk);
    chunk.forEach((e, k) => {
      const [ws, wv] = (out[k] ?? '').trim().split(/\s+/);
      const want = Number(ws);
      byStatus[ws] = (byStatus[ws] ?? 0) + 1;
      const got = new Evaluator().evaluate(e);
      stats.total++;
      let what = null;
      if (cls(want) !== cls(got.status)) { stats.accept++; what = 'accept'; }
      else if (want >= 0 && got.value.toString() !== wv) { stats.value++; what = 'value'; }
      else if (want !== got.status) {
        if (want >= 0) { stats.overflow++; what = 'overflow'; } else stats.kind++;
      }
      if (what && shown.length < SHOW) shown.push(`${what}: ${JSON.stringify(e)} want ${ws} ${wv}, got ${got.status} ${got.value}`);
    });
  }
}));

for (const s of shown) console.log(s);
console.log(`${stats.total} expressions (${skipped} undefined ones skipped): ` +
  `${stats.accept} accepted/rejected differently, ${stats.value} different values, ` +
  `${stats.overflow} differ in ok/overflow, ${stats.kind} differ only in the error kind`);
console.log(`reference status counts: ${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
process.exit(stats.accept + stats.value + stats.overflow ? 1 : 0);
