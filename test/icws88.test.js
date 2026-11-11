// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// ICWS'88 (`icws88`, pmars -8): what the assembler accepts and how the
// listing looks. The expected values are pMARS 0.9.5's: `pmars -8 -r 0` on
// ` <op> <mode>1, <mode>2` and ` <op> <mode>1` for all 19 opcodes and the
// modes '' # $ @ < > * { } (1710 sources) accepted exactly the forms in
// LEGAL below; the other cases and listings are single pmars -8 runs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble } from '../js/assembler.js';
import { formatListing, OPCODES } from '../js/opcodes.js';
import { assembleWasm } from '../wasm/42mars.js';

const assemblers = [['js', assemble], ['C', assembleWasm]];
const ok88 = (asm, src) => asm(src, { icws88: true }).ok;

// The ICWS'88 opcodes and the modes of their A and B operand (no mode is $).
const LEGAL = {
  DAT: ['#<', '#<'], MOV: ['#$@<', '$@<'], ADD: ['#$@<', '$@<'], SUB: ['#$@<', '$@<'], CMP: ['#$@<', '$@<'],
  JMP: ['$@<', '#$@<'], JMZ: ['$@<', '#$@<'], JMN: ['$@<', '#$@<'], DJN: ['$@<', '#$@<'], SPL: ['$@<', '#$@<'],
  SLT: ['#$@<', '#$@<'],
};
const MODES = ['', '#', '$', '@', '<', '>', '*', '{', '}'];

test("icws88: the opcodes and modes pmars -8 accepts, with two operands and with one", () => {
  const m = (x) => x || '$';
  for (const [name, asm] of assemblers) {
    for (const op of OPCODES) {
      const legal = LEGAL[op];
      for (const a of MODES) {
        for (const b of MODES) {
          const want = Boolean(legal) && legal[0].includes(m(a)) && legal[1].includes(m(b));
          assert.equal(ok88(asm, ` ${op} ${a}1, ${b}2\n`), want, `${name}: ${op} ${a}1, ${b}2`);
        }
        // one operand: DAT takes it as B, JMP and SPL add B $0, the rest need two
        const one = !legal ? false : op === 'DAT' ? legal[1].includes(m(a)) : op === 'JMP' || op === 'SPL' ? legal[0].includes(m(a)) : false;
        assert.equal(ok88(asm, ` ${op} ${a}1\n`), one, `${name}: ${op} ${a}1`);
      }
    }
  }
});

test("icws88: no modifiers, ORG or PIN, also from an EQU; the rest of pass 1 stays", () => {
  for (const [name, asm] of assemblers) {
    // pmars without -8 takes them all
    for (const src of [' mov.i 0, 1', ' mov.ab#1,1', ' org 0\n mov 0, 1', ' pin 3\n mov 0, 1', 'mm equ mul\n mm 1, 2', 'mm equ org\n mm 0\n mov 0, 1']) {
      assert.equal(ok88(asm, `${src}\n`), false, `${name}: ${src}`);
      assert.equal(asm(`${src}\n`).ok, true, `${name} '94: ${src}`);
    }
    for (const src of [' mov 0, 1\n end 0', 'a: mov 0, 1', ' mov 1%2, 0', ' mov 1>2, 0', ' mov a=1, 0', 'x equ 2\n mov x, 0', ' for 2\n mov 0, 1\n rof',
      ' mov CORESIZE, 0', ';assert 1\n mov 0, 1', ' MOV 0,1']) {
      assert.equal(ok88(asm, `${src}\n`), true, `${name}: ${src}`);
    }
    // the same instructions as without icws88 (pmars -8 runs the code the same)
    const src = 'start mov <1, @2\n add #4, 3\n jmz start, #0\n slt #1, #2\n dat #0, <-3\n spl 0\n jmp start, <2\n end start\n';
    const a = asm(src, { icws88: true }), b = asm(src);
    assert.deepEqual([a.instructions, a.start], [b.instructions, b.start], name);
  }
});

test("icws88: the listing has no modifiers and END START behind the code", () => {
  // pmars -8 -r 0 on these sources
  const src = ';name u\n mov 0, 1\nx jmp x\n dat #1, <2\n end x\n';
  const want = 'Program "u" (length 3) by "Anonymous"\n\n' +
    '       MOV    $     0, $     1     \n' +
    'START  JMP    $     0, $     0     \n' +
    '       DAT    #     1, <     2     \n' +
    '       END      START\n';
  for (const [name, asm] of assemblers) {
    assert.equal(formatListing(asm(src, { icws88: true }), 8000), want, name);
    // a start outside the code: no END line
    assert.equal(formatListing(asm(' mov 0, 1\n end 5\n', { icws88: true }), 8000), 'Program "Unknown" (length 1) by "Anonymous"\n\n       MOV    $     0, $     1     \n', name);
  }
});
