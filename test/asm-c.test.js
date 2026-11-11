// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The C assembler and evaluator (lib/src/asm.c, through wasm/42mars.js)
// against recorded results: the whole result object must stay the same,
// messages and expanded statements included. Random sources mix the
// constructs where pMARS has quirks: EQU (also multi-line and recursive),
// FOR/ROF with counters and `&`, CURLINE, opcodes with glued text, CR,
// continuation lines, ;redcode and ;assert lines, and broken input.
//
// test/fixtures/asm-c.json holds a digest of the results per group of
// cases (test/recorded.js). They were recorded where the C code gave the
// same results as the JavaScript assembler it was ported from
// (js/assembler.js and js/expr.js, removed on 11th November 2026; the C code
// adds only the warnings that start with "pMARS").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleWasm, evaluateWasm } from '../wasm/42mars.js';
import { recorded } from './recorded.js';

const check = recorded('asm-c.json');

function generator(seed) {
  let s = seed >>> 0 || 1;
  const rand = (k) => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s % k;
  };
  const pick = (a) => a[rand(a.length)];
  return { rand, pick };
}

const OPS = ['mov', 'add', 'sub', 'mul', 'div', 'mod', 'jmz', 'jmn', 'djn', 'cmp', 'slt', 'spl', 'dat', 'jmp', 'seq', 'sne', 'nop', 'ldp', 'stp', 'MOV', 'Dat'];
const PSEUDO = ['org', 'end', 'pin', 'ORG'];
const MODS = ['', '', '', '.a', '.b', '.ab', '.ba', '.f', '.x', '.i', '.I'];
const BAD_MODS = ['.q', '.', '.1'];
const MODES = ['', '', '#', '$', '@', '<', '>', '*', '{', '}'];
const LABELS = ['a', 'b', 'x', 'top', 'loop', 'step', 'Lab_1'];
const BUILTIN = ['CURLINE', 'CORESIZE', 'MAXLENGTH', 'PSPACESIZE', 'VERSION'];

// `valid` sources keep to constructs that assemble most of the time, so
// that the instructions, label values and modifiers are compared too; the
// others mix in broken input.
function expr(g, valid, depth = 0) {
  const { rand, pick } = g;
  if (depth > 2 || rand(3) === 0) {
    if (valid) return pick([String(rand(20)), String(rand(9000)), pick(LABELS), pick(BUILTIN), 'r', 'r=3']);
    return pick([String(rand(20)), pick(LABELS), pick(BUILTIN), 'i&j', 'x&i', '99999999999999999999', '-1', 'a=3', 'undefd']);
  }
  const op = valid ? pick(['+', '-', '*', '/', '%', '==', '<', '>', '<=', '&&', '||'])
    : pick(['+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', '&&', '||', ' ', '=', '!']);
  const e = `${expr(g, valid, depth + 1)}${pick(['', ' '])}${op}${pick(['', ' '])}${expr(g, valid, depth + 1)}`;
  return rand(4) === 0 ? `(${e})` : rand(8) === 0 ? `-${e}` : e;
}

function instruction(g, valid, inFor) {
  const { rand, pick } = g;
  const label = rand(3) === 0 ? `${pick(LABELS)}${inFor && rand(2) ? '&i' : ''}${pick(['', ':', ' '])} ` : '';
  const counter = inFor && rand(3) === 0 ? pick(['i', 'i*2', 'x&i']) : null;
  const a = `${pick(MODES)}${counter ?? expr(g, valid)}`;
  const b = rand(5) ? `${pick([',', ' ,', ', '])}${pick(MODES)}${expr(g, valid)}` : '';
  const mod = !valid && rand(10) === 0 ? pick(BAD_MODS) : pick(MODS);
  return `${label}${pick(OPS)}${mod} ${a}${b}${pick(['', ' ; c', '\r', ';x,y'])}`;
}

function statement(g, valid, inFor) {
  const { rand, pick } = g;
  switch (rand(valid ? 18 : 12)) {
    case 0: return `${pick(LABELS)} equ ${expr(g, valid)}`;
    case 1: return `;assert ${expr(g, valid)}`;
    case 2: return `;${pick(['name ', 'author ', 'strategy ', 'redcode', 'redcode-94', ' redcode', 'date ', 'version '])}${expr(g, valid)}`;
    case 3: return `${pick(PSEUDO)}${rand(4) ? ' ' : '.f '}${expr(g, valid)}`;
    case 4: return `${pick(OPS)}${pick(MODS)}${pick(['#', '$', '', '@'])}${rand(9)}`; // glued
    case 5: return `${instruction(g, valid, inFor)} \\`; // continued
    case 6: if (!valid) return pick(['', '   ', '\t', '; comment', '\r', 'é ', '§', '}', '&', '1 2', 'rof', 'for x']);
    // fall through
    default: return instruction(g, valid, inFor);
  }
}

// A source that assembles in most cases: labels defined once (L0, L1, ...
// and Lk&i inside FOR blocks), EQU names defined once, both operands where
// the opcode needs them.
function validSource(g) {
  const { rand, pick } = g;
  const names = Array.from({ length: 1 + rand(6) }, (_, k) => `L${k}`);
  const equs = Array.from({ length: rand(3) }, (_, k) => `E${k}`);
  const value = () => pick([String(rand(30)), String(rand(9000)), pick(names), pick(names), 'CURLINE', 'CORESIZE/4', ...equs, `${pick(names)}-${pick(names)}`, '(2*3+1)%5', '-7', 'r=5', 'r']);
  const operand = () => `${pick(MODES)}${value()}${rand(3) ? '' : `${pick(['+', '-', '*'])}${value()}`}`;
  const instr = (label, counter) => {
    const op = pick(OPS);
    const one = ['dat', 'Dat', 'jmp', 'spl', 'nop'].includes(op) && rand(2);
    const a = counter && rand(2) ? `${pick(MODES)}i*${rand(4)}` : operand();
    return `${label ? `${label}${pick(['', ':'])} ` : ' '}${op}${pick(MODS)} ${a}${one ? '' : `${pick([',', ' , '])}${operand()}`}${pick(['', ' ; comment'])}`;
  };
  const lines = [pick([';redcode-94', ';redcode', '']), `;name ${pick(['Imp', 'A b ', ''])}`, `;author ${pick(['x', ''])}`];
  for (const e of equs) lines.push(`${e} equ ${value()}`);
  let unused = [...names];
  const n = 1 + rand(10);
  for (let k = 0; k < n; k++) {
    const label = unused.length && rand(2) ? unused.shift() : null;
    if (rand(6) === 0) {
      lines.push(`i for ${1 + rand(3)}`);
      lines.push(instr(rand(2) ? `${label ?? 'F'}&i` : null, true));
      if (rand(2)) lines.push(instr(null, true));
      lines.push(pick(['rof', 'ROF']));
    } else if (rand(10) === 0) {
      lines.push(`${pick(['org', 'end', 'pin'])} ${pick(names)}`);
      if (label) lines.push(instr(label));
    } else {
      lines.push(instr(label));
    }
  }
  for (const l of unused) lines.push(instr(l));
  if (rand(3) === 0) lines.push(`;assert ${pick(['CORESIZE == 8000', 'MAXLENGTH >= 1', `${pick(names)} >= 0`, 'VERSION > 90'])}`);
  if (rand(5) === 0) lines.push(`end ${pick(names)}`);
  return lines.join(pick(['\n', '\n', '\r\n'])) + pick(['\n', '']);
}

// A source with broken input mixed in.
function brokenSource(g) {
  const { rand, pick } = g;
  const lines = [];
  const n = 1 + rand(14);
  for (let k = 0; k < n; k++) {
    if (rand(8) === 0) {
      // a FOR block, maybe with a counter, maybe without ROF
      lines.push(`${rand(3) ? 'i' : ''} for ${pick(['2', '3', '0', '1+1', 'x'])}`);
      for (let m = 1 + rand(3); m > 0; m--) lines.push(statement(g, false, true));
      if (rand(4)) lines.push(pick(['rof', 'ROF']));
    } else {
      lines.push(statement(g, rand(2) === 0, false));
    }
  }
  // multi-line EQU: a label EQU followed by more `equ` lines
  if (rand(4) === 0) lines.splice(rand(lines.length), 0, `${pick(LABELS)} equ mov 0, 1`, ` equ ${pick(['dat 0', 'x', 'jmp -1'])}`);
  return lines.join(pick(['\n', '\n', '\r\n'])) + pick(['\n', '', '\n\n']);
}

function source(g) {
  return g.rand(2) ? validSource(g) : brokenSource(g);
}

test('random sources give the recorded results', () => {
  const g = generator(20261110);
  const results = [];
  for (let k = 0; k < 4000; k++) {
    const src = source(g);
    const opts = k % 7 === 0 ? { coreSize: 80, maxLength: 5 } : k % 3 === 0 ? { icws88: true } : {};
    results.push([JSON.stringify(src), assembleWasm(src, opts)]);
  }
  check('sources', results, 100);
});

test('random expressions give the recorded results', () => {
  const g = generator(77);
  const results = [];
  for (let k = 0; k < 20000; k++) {
    const e = expr(g);
    results.push([JSON.stringify(e), evaluateWasm(e)]);
  }
  check('expressions', results, 100);
});

test('the C assembler on chosen cases', () => {
  const results = [];
  const run = (src, opts) => results.push([JSON.stringify(src), assembleWasm(src, opts)]);
  // registers to start with (the first warrior of a pMARS run)
  run(';assert s == 2 && W == 2\n dat #s, #w\n dat #x=x+1, #a\n', { registers: { s: 2, W: 2, x: -5, a: 7 } });
  run(';assert s == 2\n dat #s, #w\n');
  assert.equal(assembleWasm(';assert s == 2\n dat #s, #w\n', { registers: { s: 2 } }).ok, true);
  assert.throws(() => assembleWasm(' dat 0\n', { registers: { ab: 1 } }), RangeError);
  // EQU recursion, in pass 1 and in pass 2 (defined after its use)
  run('a equ b\nb equ a\n mov a, 1\n');
  run(' mov c, 1\nc equ c\n');
  // a FOR block without ROF, counters in labels, CURLINE
  run('i for 3\nx&i dat x&i, CURLINE\nrof\n jmp x02\n');
  run('n for 2\n dat n\n');
  // the scratch buffer: text glued to an opcode picks up older bytes, so
  // pMARS reads `dat#9` after the label xyzzy9 as `DAT#99`
  run('xyzzy9\ndat#9');
  run('abcdef9 dat 0\ndat#9\n');
  // Latin-1 and UTF-8 text, in the metadata and as stray characters
  run(';name Fünf\n;author Ä\n dat 0\n ä\n');
  run(';name 日本\n dat 0\n mov 0, 日\n;strategy x　\n');
  run(';assert 1 == 1 \n;assert 0　\n dat 0\n');
  // options: maxLength, PIN beyond 2^53 (rounded to a Number, as in JS)
  run(' dat 0\n dat 1\n dat 2\n', { maxLength: 2 });
  run(' pin 9007199254740993\n dat 0\n');
  // a large expansion: grows the working memory several times
  run('i for 200\nj for 100\n dat i, j\nrof\nrof\n', { maxLength: 30000 });
  check('chosen cases', results);
});

test('the C evaluator: limits', () => {
  // -2^63 / -1 and % -1 wrap (C would trap)
  const MIN = -(1n << 63n);
  assert.deepEqual(evaluateWasm('(-9223372036854775807-1)/-1'), { status: 0, value: MIN });
  assert.deepEqual(evaluateWasm('(-9223372036854775807-1)%-1'), { status: 0, value: 0n });
  // 64-bit products: the overflow status where the product does not fit
  assert.deepEqual(evaluateWasm('3037000500*3037000500'), { status: 1, value: BigInt.asIntN(64, 3037000500n * 3037000500n) });
  assert.deepEqual(evaluateWasm('-3037000499*3037000499'), { status: 0, value: -3037000499n * 3037000499n });
  assert.deepEqual(evaluateWasm('4611686018427387904*-2'), { status: 0, value: MIN });
  // Deep nesting: evaluated up to the C limit of 6000 nested calls, beyond
  // it not an expression (semantics doc, section 4).
  const shapes = {
    nested: [(k) => `${'('.repeat(k)}1${')'.repeat(k)}`, 2500, 1n],
    unary: [(k) => `${'-'.repeat(k)}1`, 5000, 1n],
    flat: [(k) => `${'1+'.repeat(k)}1`, 4000, 4001n],
    assign: [(k) => `${'a='.repeat(k)}1`, 2500, 1n],
  };
  for (const [f, k, value] of Object.values(shapes)) assert.deepEqual(evaluateWasm(f(k)), { status: 0, value });
  for (const [f, k] of Object.values(shapes)) assert.equal(evaluateWasm(f(3 * k)).status, -1);
});

const forNest = (k) => `${' for 1\n'.repeat(k)} dat 0\n${' rof\n'.repeat(k)}`;

test('FOR blocks nest 100 deep in C', () => {
  assert.equal(assembleWasm(forNest(100)).ok, true);
  const w = assembleWasm(forNest(101));
  assert.equal(w.ok, false);
  assert.deepEqual(w.errors.map((e) => e.text), ['FOR blocks nested too deep']);
});

test('an exception inside wasm does not break later calls', () => {
  // Call the assembler with less and less JS stack left until V8 runs out
  // of stack inside the wasm code. That leaves the C stack pointer of the
  // instance down by the frames of the FOR levels; the next call has to
  // get a fresh instance, or 100 FOR levels no longer fit.
  const src = forNest(100);
  const at = (n) => (n === 0 ? assembleWasm(src) : at(n - 1));
  let thrown = null;
  for (let n = 0; n < 100000 && !thrown; n += 25) {
    try { at(n); } catch (e) { thrown = e; }
  }
  assert.ok(thrown instanceof RangeError || thrown instanceof WebAssembly.RuntimeError, String(thrown));
  assert.equal(assembleWasm(src).ok, true);
});

test('a core size below 1 is a RangeError', () => {
  assert.throws(() => assembleWasm(' dat 0\n', { coreSize: -5 }), RangeError);
});
