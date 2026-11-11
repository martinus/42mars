// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleWasm as assemble } from '../wasm/42mars.js';
import { formatInstruction, formatListing } from '../js/opcodes.js';

const N = 8000;
// Assembles and returns the instructions as compact strings, e.g. "MOV.I $0, $1".
function asm(src, opts) {
  const w = assemble(src, opts);
  assert.ok(w.ok, `assembly failed: ${JSON.stringify(w.errors)}`);
  return w.instructions.map((i) => formatInstruction(i.op, i.mod, i.aMode, i.aVal, i.bMode, i.bVal, opts?.coreSize ?? N));
}

test('labels resolve relative to the current instruction', () => {
  assert.deepEqual(asm('first spl first\nimp   mov imp, imp + 1\n'), ['SPL.B $0, $0', 'MOV.I $0, $1']);
});

test('forward references and labels on their own line', () => {
  assert.deepEqual(asm('      jmp target\n      dat 0\ntarget\n      dat 1\n'), ['JMP.B $2, $0', 'DAT.F #0, $0', 'DAT.F #0, $1']);
});

test('label followed by a colon', () => {
  assert.deepEqual(asm('loop: jmp loop\n'), ['JMP.B $0, $0']);
});

test('default modifiers follow the ICWS 94 table', () => {
  assert.deepEqual(asm([
    'mov #1, 2', 'mov 1, #2', 'mov 1, 2',
    'add #1, 2', 'add 1, #2', 'add 1, 2',
    'slt #1, 2', 'slt 1, 2',
    'jmz 1, 2', 'cmp 1, 2', 'seq #1, 2', 'sne 1, 2',
    'ldp #1, 2', 'stp 1, 2', 'nop 1, 2',
  ].join('\n')), [
    'MOV.AB #1, $2', 'MOV.B $1, #2', 'MOV.I $1, $2',
    'ADD.AB #1, $2', 'ADD.B $1, #2', 'ADD.F $1, $2',
    'SLT.AB #1, $2', 'SLT.B $1, $2',
    'JMZ.B $1, $2', 'CMP.I $1, $2', 'SEQ.AB #1, $2', 'SNE.I $1, $2',
    'LDP.AB #1, $2', 'STP.B $1, $2', 'NOP.F $1, $2',
  ]);
});

test('one-operand DAT, JMP, SPL and NOP', () => {
  assert.deepEqual(asm('dat 5\ndat #5\ndat <3\njmp 2\nspl @1\nnop 4'),
    ['DAT.F #0, $5', 'DAT.F #0, #5', 'DAT.F #0, <3', 'JMP.B $2, $0', 'SPL.B @1, $0', 'NOP.F $4, $0']);
});

test('a missing operand is an error for other opcodes', () => {
  const w = assemble('mov 1\n');
  assert.equal(w.ok, false);
  assert.match(w.errors[0].text, /missing operand/);
});

test('all addressing modes and explicit modifiers, case-insensitive', () => {
  assert.deepEqual(asm('MoV.Ab #1, $2\nmov.i @1, <2\nmov.f >1, *2\nmov.x {1, }2\n'),
    ['MOV.AB #1, $2', 'MOV.I @1, <2', 'MOV.F >1, *2', 'MOV.X {1, }2']);
});

test('expressions: precedence, unary minus, truncating division', () => {
  assert.deepEqual(asm('dat #2+3*4, #(2+3)*4\ndat #-7/2, #-7%3\ndat #10-2-3, #2*-3\n'),
    ['DAT.F #14, #20', 'DAT.F #-3, #-1', 'DAT.F #5, #-6']);
});

test('comparison and logical operators', () => {
  assert.deepEqual(asm('dat #3>2, #3<=2\ndat #1&&0, #1||0\ndat #!0, #4!=4\n'),
    ['DAT.F #1, #0', 'DAT.F #0, #1', 'DAT.F #1, #0']);
});

test('pMARS quirk: a pending == after a higher-precedence term is a bad expression', () => {
  // pMARS encodes EQUAL as 0 and its "saved operator" check treats 0 as none.
  const w = assemble('dat #1+2*3==7\n');
  assert.equal(w.ok, false);
  assert.match(w.errors[0].text, /bad expression/);
  assert.deepEqual(asm('dat #7==1+2*3\n'), ['DAT.F #0, #1']);
});

test('EQU substitutes text, not values', () => {
  assert.deepEqual(asm('x equ 2+3\ndat #x*2\n'), ['DAT.F #0, #8']);
});

test('EQU that names a labelled statement', () => {
  assert.deepEqual(asm('IMP_instr equ imp mov imp, imp + 1\nIMP_instr\n'), ['MOV.I $0, $1']);
});

test('multi-line EQU expands into several statements', () => {
  assert.deepEqual(asm('core_clear equ spl 0\n           equ mov 2, <-1\n           equ jmp -1\ncore_clear\n'),
    ['SPL.B $0, $0', 'MOV.I $2, <-1', 'JMP.B $-1, $0']);
});

test('recursive EQU is an error', () => {
  const w = assemble('a1 equ b1\nb1 equ a1\ndat a1\n');
  assert.equal(w.ok, false);
  assert.match(w.errors[0].text, /recursive/);
});

test('FOR/ROF with &-concatenation creates distinct labels', () => {
  assert.deepEqual(asm('N FOR 3\nimp&N mov imp&N, imp&N + N\n ROF\n'),
    ['MOV.I $0, $1', 'MOV.I $0, $2', 'MOV.I $0, $3']);
});

test('FOR counter is zero-padded to two digits when concatenated', () => {
  assert.deepEqual(asm('prime01 equ 2\nprime02 equ 3\nprime03 equ 5\nN FOR 3\n dat prime&N\n ROF\n'),
    ['DAT.F #0, $2', 'DAT.F #0, $3', 'DAT.F #0, $5']);
});

test('FOR with base label and counter', () => {
  // The base label is relative like any other label (pMARS output, not the
  // absolute values shown in redcode.ref).
  assert.deepEqual(asm('base\nindex for 3\n      mov base, base + index - 1\n      rof\n'),
    ['MOV.I $0, $0', 'MOV.I $-1, $0', 'MOV.I $-2, $0']);
});

test('FOR 0 skips the block, nested FOR blocks multiply', () => {
  assert.deepEqual(asm('for 0\ndat 1\nrof\ni for 2\nj for 3\ndat i, j\nrof\nrof\n'),
    ['DAT.F $1, $1', 'DAT.F $1, $2', 'DAT.F $1, $3', 'DAT.F $2, $1', 'DAT.F $2, $2', 'DAT.F $2, $3']);
});

test('FOR without ROF is reported', () => {
  const w = assemble('for 2\ndat 1\n');
  assert.ok(w.warnings.some((m) => /without matching ROF/.test(m.text)));
});

test('CURLINE counts instructions', () => {
  assert.deepEqual(asm('dat #CURLINE\nfor 2\ndat #CURLINE\nrof\n'), ['DAT.F #0, #0', 'DAT.F #0, #1', 'DAT.F #0, #2']);
});

test('predefined constants follow the options', () => {
  assert.deepEqual(asm('dat #CORESIZE, #MAXLENGTH\n', { coreSize: 800, maxLength: 20 }), ['DAT.F #0, #20']);
  assert.deepEqual(asm('dat #CORESIZE-1, #PSPACESIZE\n'), ['DAT.F #-1, #500']);
});

test('register variables keep their value within one assembly', () => {
  assert.deepEqual(asm('dat #a=5, #a*2\ndat #a, #b\n'), ['DAT.F #5, #10', 'DAT.F #5, #0']);
});

test('ORG and END set the start offset, labels are absolute there', () => {
  assert.equal(assemble('org two\none dat 0\ntwo dat 0\n').start, 1);
  assert.equal(assemble('one dat 0\ntwo dat 0\nend two\n').start, 1);
  const w = assemble('org one\none dat 0\ntwo dat 0\nend two\n');
  assert.equal(w.start, 1, 'END sets the start when ORG named the first instruction');
});

test('END stops assembly', () => {
  assert.deepEqual(asm('dat 1\nend\ndat 2\n'), ['DAT.F #0, $1']);
});

test(';redcode discards preceding text, a second ;redcode ends the warrior', () => {
  const w = assemble('garbage here\n;redcode-94\n;name A\ndat 1\n;redcode\ndat 2\n');
  assert.ok(w.ok);
  assert.equal(w.name, 'A');
  assert.equal(w.instructions.length, 1);
});

test(';redcode needs to follow the semicolon directly', () => {
  const w = assemble('dat 9\n; redcode\ndat 1\n');
  assert.equal(w.instructions.length, 2);
});

test('metadata comments', () => {
  const w = assemble(';name  Big Warrior  \n;author Someone\n;strategy line one\n;strategy line two\ndat 0\n');
  assert.equal(w.name, 'Big Warrior  ');
  assert.equal(w.author, 'Someone');
  assert.equal(w.strategy, 'line one\nline two');
});

test(';assert', () => {
  assert.ok(assemble(';assert CORESIZE == 8000\ndat 0\n').ok);
  const bad = assemble(';assert CORESIZE == 8001\ndat 0\n');
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0].text, /assertion failed/);
  assert.ok(assemble('dat 0\n').warnings.some((m) => /missing ;assert/.test(m.text)));
});

test('a redefined label drops its line with a warning, like pMARS', () => {
  const w = assemble('x dat 1\nx dat 2\ndat 3\n');
  assert.ok(w.ok);
  assert.equal(w.instructions.length, 2);
  assert.ok(w.warnings.some((m) => /redefined/.test(m.text)));
});

test('undefined symbols are errors, single letters are registers', () => {
  const w = assemble('jmp nowhere\n');
  assert.equal(w.ok, false);
  assert.match(w.errors[0].text, /undefined symbol 'nowhere'/);
  assert.deepEqual(asm('jmp z\n'), ['JMP.B $0, $0']);
});

test('line continuation with a trailing backslash', () => {
  assert.deepEqual(asm('mov 1, \\\n 2\n'), ['MOV.I $1, $2']);
});

test('too many instructions', () => {
  const w = assemble('for 6\ndat 0\nrof\n', { maxLength: 5 });
  assert.equal(w.ok, false);
  assert.match(w.errors[0].text, /too many instructions/);
});

test('PIN', () => {
  assert.equal(assemble('pin 7\ndat 0\n').pin, 7);
  assert.equal(assemble('dat 0\n').pin, null);
});

test('source lines are tracked through EQU and FOR expansion', () => {
  const w = assemble(';name t\nx equ dat 1\nfor 2\nx\nrof\nmov 0, 1\n');
  assert.deepEqual(w.instructions.map((i) => i.line), [4, 4, 6]);
});

test('listing uses the pMARS layout', () => {
  const w = assemble(';name Imp\n;author A. K. Dewdney\nimp mov.i imp, imp+1\nend imp\n');
  assert.equal(formatListing(w, 8000),
    'Program "Imp" (length 1) by "A. K. Dewdney"\n\n       ORG      START\nSTART  MOV.I  $     0, $     1     \n');
});

test('warnings where pMARS has no defined result or takes very long', () => {
  const pmarsWarnings = (src) => assemble(`;assert 1\n${src}`).warnings.filter((m) => m.text.startsWith('pMARS ')).map((m) => [m.line, m.text]);
  // a lone ! = & or | where an operator belongs, in an operand, an assert and a FOR count
  assert.deepEqual(pmarsWarnings(' dat 1!2\n'), [[2, "pMARS has no defined result for '1!2': a lone ! = & or | where an operator belongs"]]);
  assert.deepEqual(pmarsWarnings(';assert 1&2\n dat 0\n'), [[2, "pMARS has no defined result for '1&2': a lone ! = & or | where an operator belongs"]]);
  assert.deepEqual(pmarsWarnings(' for 2=1\n rof\n dat 0\n').map((w) => w[0]), [2]);
  assert.equal(pmarsWarnings(' dat 1|2\n').length, 1);
  // the operators made of two characters are fine
  assert.deepEqual(pmarsWarnings(' dat 1!=2, 1==2\n dat 1&&2, 1||2\n dat a=1, !1\n'), []);
  // -2^63 / -1 and % -1; the product wraps without a crash
  assert.deepEqual(pmarsWarnings(' dat (-9223372036854775807-1)/-1\n'), [
    [2, "pMARS crashes on -2^63 / -1 in '(-9223372036854775807-1)/-1'"],
    [2, "pMARS takes very long for the value of '(-9223372036854775807-1)/-1'"],
  ]);
  assert.deepEqual(pmarsWarnings(' dat (-9223372036854775807-1)%-1\n'), [[2, "pMARS crashes on -2^63 / -1 in '(-9223372036854775807-1)%-1'"]]);
  // values from 2^40 on, also negative ones and in PIN
  assert.deepEqual(pmarsWarnings(' dat 1099511627775, -1099511627775\n'), []);
  assert.equal(pmarsWarnings(' dat 1099511627776, -1099511627776\n').length, 2);
  assert.deepEqual(pmarsWarnings(' dat 0\n pin 1099511627776\n'), [[3, "pMARS takes very long for the value of '1099511627776'"]]);
});
