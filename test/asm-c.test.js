// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The C assembler and evaluator (lib/src/asm.c, through wasm/42mars.js)
// against js/assembler.js and js/expr.js: the whole result object must be
// the same, messages and expanded statements included. Random sources mix
// the constructs where pMARS has quirks: EQU (also multi-line and
// recursive), FOR/ROF with counters and `&`, CURLINE, opcodes with glued
// text, CR, continuation lines, ;redcode and ;assert lines, and broken
// input.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble } from '../js/assembler.js';
import { Evaluator } from '../js/expr.js';
import { assembleWasm, evaluateWasm } from '../wasm/42mars.js';

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

const same = (src, opts) => assert.deepEqual(assembleWasm(src, opts), assemble(src, opts), JSON.stringify(src));

test('random sources give the same result in C and JS', () => {
  const g = generator(20261110);
  for (let k = 0; k < 4000; k++) same(source(g), k % 7 === 0 ? { coreSize: 80, maxLength: 5 } : {});
});

test('random expressions give the same result in C and JS', () => {
  const g = generator(77);
  for (let k = 0; k < 20000; k++) {
    const e = expr(g);
    const a = new Evaluator().evaluate(e);
    assert.deepEqual(evaluateWasm(e), a, e);
  }
});

test('the C assembler on chosen cases', () => {
  // EQU recursion, in pass 1 and in pass 2 (defined after its use)
  same('a equ b\nb equ a\n mov a, 1\n');
  same(' mov c, 1\nc equ c\n');
  // a FOR block without ROF, counters in labels, CURLINE
  same('i for 3\nx&i dat x&i, CURLINE\nrof\n jmp x02\n');
  same('n for 2\n dat n\n');
  // the scratch buffer: text glued to an opcode picks up older bytes, so
  // pMARS reads `dat#9` after the label xyzzy9 as `DAT#99`
  same('xyzzy9\ndat#9');
  same('abcdef9 dat 0\ndat#9\n');
  // Latin-1 and UTF-8 text, in the metadata and as stray characters
  same(';name Fünf\n;author Ä\n dat 0\n ä\n');
  same(';name 日本\n dat 0\n mov 0, 日\n;strategy x　\n');
  same(';assert 1 == 1 \n;assert 0　\n dat 0\n');
  // options: maxLength, PIN beyond 2^53 (rounded to a Number, as in JS)
  same(' dat 0\n dat 1\n dat 2\n', { maxLength: 2 });
  same(' pin 9007199254740993\n dat 0\n');
  // a large expansion: grows the working memory several times
  same('i for 200\nj for 100\n dat i, j\nrof\nrof\n', { maxLength: 30000 });
});

test('the C evaluator: limits', () => {
  // -2^63 / -1 and % -1 wrap (C would trap)
  assert.deepEqual(evaluateWasm('(-9223372036854775807-1)/-1'), new Evaluator().evaluate('(-9223372036854775807-1)/-1'));
  assert.deepEqual(evaluateWasm('(-9223372036854775807-1)%-1'), new Evaluator().evaluate('(-9223372036854775807-1)%-1'));
  assert.deepEqual(evaluateWasm('3037000500*3037000500'), new Evaluator().evaluate('3037000500*3037000500'));
  assert.deepEqual(evaluateWasm('-3037000499*3037000499'), new Evaluator().evaluate('-3037000499*3037000499'));
  assert.deepEqual(evaluateWasm('4611686018427387904*-2'), new Evaluator().evaluate('4611686018427387904*-2'));
  // Deep nesting: the same as JS up to where the C limit (6000 nested calls)
  // or the JS stack ends (semantics doc, section 4).
  const shapes = {
    nested: [(k) => `${'('.repeat(k)}1${')'.repeat(k)}`, 2500],
    unary: [(k) => `${'-'.repeat(k)}1`, 5000],
    flat: [(k) => `${'1+'.repeat(k)}1`, 4000],
    assign: [(k) => `${'a='.repeat(k)}1`, 2500],
  };
  for (const [f, k] of Object.values(shapes)) assert.deepEqual(evaluateWasm(f(k)), new Evaluator().evaluate(f(k)));
  for (const [f, k] of Object.values(shapes)) assert.equal(evaluateWasm(f(3 * k)).status, -1);
});

const forNest = (k) => `${' for 1\n'.repeat(k)} dat 0\n${' rof\n'.repeat(k)}`;

test('FOR blocks nest 100 deep in C', () => {
  same(forNest(100));
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
  same(src);
});

test('a core size below 1 is a RangeError', () => {
  assert.throws(() => assembleWasm(' dat 0\n', { coreSize: -5 }), RangeError);
});
