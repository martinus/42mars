// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// pMARS behavior found by black-box tests against a pMARS 0.9.5 binary. The
// expected results are what that binary printed for the same input.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleWasm as assemble, evaluateWasm as evaluate } from '../wasm/42mars.js';
import { formatInstruction } from '../tools/opcodes.js';

// evaluateWasm() status
const EVAL_OK = 0;
const EVAL_BAD = -1;

function asm(src) {
  const w = assemble(src);
  assert.ok(w.ok, `assembly failed: ${JSON.stringify(w.errors)}`);
  return w.instructions.map((i) => formatInstruction(i.op, i.mod, i.aMode, i.aVal, i.bMode, i.bVal, 8000));
}

// ---- 1. expression evaluation order

test('evaluator: an operator handed back from a nested part continues at the wrong level', () => {
  // Ordinary precedence would give (5 < 7 - 0) < 8 = 1.
  assert.deepEqual(evaluate('5<7-6/8<8'), { status: EVAL_OK, value: 0n });
  assert.deepEqual(evaluate('1>=9+a%6>=8'), { status: EVAL_OK, value: 1n });
});

test('evaluator: a dropped == inside an assignment makes the expression bad', () => {
  assert.equal(evaluate('b=0==2%9==8').status, EVAL_BAD);
});

test('evaluator: unary minus wraps without the overflow status', () => {
  assert.deepEqual(evaluate('-(-9223372036854775807-1)'), { status: EVAL_OK, value: -(1n << 63n) });
});

test('evaluator: the evaluation order reaches the assembler', () => {
  assert.deepEqual(asm('dat #5<7-6/8<8, #1>=9+a%6>=8\n'), ['DAT.F #0, #1']);
  assert.equal(assemble('dat #b=0==2%9==8\n').ok, false);
});

// ---- 2. metadata keeps trailing whitespace

test('metadata values keep trailing whitespace', () => {
  const w = assemble(';name  Big Warrior  \n;author\tA ; b \t\n;date 1.1. \n;version 2 \ndat 0\n');
  assert.equal(w.name, 'Big Warrior  ');
  assert.equal(w.author, 'A ; b \t');
  assert.equal(w.date, '1.1. ');
  assert.equal(w.version, '2 ');
  const empty = assemble(';name   \n;author \t\ndat 0\n');
  assert.equal(empty.name, 'Unknown');
  assert.equal(empty.author, 'Anonymous');
});

// ---- 3. a lone CR ends the line content

test('text after a lone CR is ignored up to the next LF', () => {
  assert.deepEqual(asm('mov 1, 2\rdat 3\n'), ['MOV.I $1, $2']);
  assert.deepEqual(asm('mov 1, 2\rdat 3\r'), ['MOV.I $1, $2']);
  assert.deepEqual(asm(';name x\rjunk\ndat 0\n').length, 1);
  assert.equal(assemble(';name x\rjunk\ndat 0\n').name, 'x');
});

test('continuation and the comment check look at the content before a CR', () => {
  assert.deepEqual(asm('mov 1,\\\r\n2\n'), ['MOV.I $1, $2']);
  assert.deepEqual(asm('dat 1\r;x \\\ndat 2\n'), ['DAT.F #0, $1', 'DAT.F #0, $2']);
});

test('a NUL byte ends the line content, like a lone CR', () => {
  assert.deepEqual(asm('dat 1\0 garbage here\nmov 0,1\n'), ['DAT.F #0, $1', 'MOV.I $0, $1']);
  assert.deepEqual(asm('mov 0,1\n\0\nmov 0,2\n'), ['MOV.I $0, $1', 'MOV.I $0, $2']);
  assert.deepEqual(asm('x\0y equ 3\ndat x\n'), ['DAT.F #0, $0']);
  assert.equal(assemble(';name A\0B\nmov 0,1\n').name, 'A');
  assert.deepEqual(asm('; c \0 \nmov 0,1\n'), ['MOV.I $0, $1']);
  // continuation looks at the content before the NUL, on both lines
  assert.deepEqual(asm('mov 0,\\\0x\n1\n'), ['MOV.I $0, $1']);
  assert.deepEqual(asm('mov 0,\\\n1\0x\n'), ['MOV.I $0, $1']);
  assert.deepEqual(asm('x equ 1\0+5\ndat x\n'), ['DAT.F #0, $1']);
  assert.deepEqual(asm('for 2\0 zz\ndat 1\nrof\n'), ['DAT.F #0, $1', 'DAT.F #0, $1']);
  assert.deepEqual(asm('for 2\ndat 1\0zz\nrof\n'), ['DAT.F #0, $1', 'DAT.F #0, $1']);
  assert.deepEqual(asm('mov 0,1\nend\0 zz\n'), ['MOV.I $0, $1']);
  assert.deepEqual(asm(';assert 1\0 zz\nmov 0,1\n'), ['MOV.I $0, $1']);
  assert.deepEqual(assemble(';assert 1\0 zz\nmov 0,1\n').warnings, []);
  const empty = assemble('\0mov 0,1\n');
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.instructions, []);
  // The text after the NUL stays in the scratch buffer (section 5 below).
  assert.deepEqual(asm('\tdat#9\x0055\n'), ['DAT.F #0, #99']);
  assert.equal(assemble('mov 0\0,1\n').ok, false);
});

test('a NUL byte right after an opcode leaves it without operands', () => {
  // pMARS: "Syntax error", exit code 3, also with -8. It was an ok warrior
  // with opcode 255 (#85).
  for (const icws88 of [false, true]) {
    for (const src of ['mov\0 i b,k\ndat 5\n', 'dat\0 i b,k\n', 'for 1\njmp\0 i b,k\nrof\n']) {
      assert.equal(assemble(src, { icws88 }).ok, false, JSON.stringify(src));
    }
  }
});

test('no warrior that assembles holds a field out of range', () => {
  const bad = [];
  for (const head of ['mov', 'dat', 'jmp', 'mov.i', 'x equ mov\nx']) {
    for (const tail of [' i b,k', ' 0,1', '#1', '']) {
      for (let b = 0; b < 256; b++) {
        const src = `${head}${String.fromCharCode(b)}${tail}\n`;
        for (const icws88 of [false, true]) {
          const w = assemble(src, { icws88 });
          if (w.ok && w.instructions.some((i) => i.op > 18 || i.mod > 6 || i.aMode > 7 || i.bMode > 7)) bad.push(JSON.stringify(src));
        }
      }
    }
  }
  assert.deepEqual(bad, []);
});

// ---- 4. warriors without instructions

test('a warrior without instructions is accepted with a warning', () => {
  const w = assemble(';name nothing\n');
  assert.equal(w.ok, true);
  assert.equal(w.name, 'nothing');
  assert.deepEqual(w.instructions, []);
  assert.deepEqual(w.warnings.map((m) => m.text), ['missing ;assert', 'no instructions']);
});

test('without instructions, ORG, END and PIN are not checked', () => {
  for (const src of [';assert 1\nend 1/0\n', ';assert 1\norg ,,\n', ';assert 1\nend.a 3\n', ';assert 1\npin\n']) {
    const w = assemble(src);
    assert.equal(w.ok, true, src);
    assert.deepEqual(w.warnings.map((m) => m.text), ['no instructions'], src);
  }
});

test('errors of pass 1 still reject a warrior without instructions', () => {
  const w = assemble(';assert 0\n');
  assert.equal(w.ok, false);
  assert.ok(w.warnings.some((m) => m.text === 'no instructions'));
});

// ---- 5. the scratch buffer behind an opcode glued to its operands

test('glued text at the end of a line takes old scratch buffer bytes along', () => {
  // Reading the line leaves "\tdat#9" in the buffer, DAT then overwrites the
  // start, so "#9" is followed by the 9 of the line itself.
  assert.deepEqual(asm('\tdat#9\n'), ['DAT.F #0, #99']);
  // Reading stores a 0 byte over the CR that ends the content.
  assert.deepEqual(asm('\tdat#9\r55\n'), ['DAT.F #0, #99']);
  // The label START0 (from corpus warrior asianflu.red) leaves its 0.
  assert.deepEqual(asm('start0 mov 0,0\n\tdat#9\n'), ['MOV.I $0, $0', 'DAT.F #0, #90']);
  assert.deepEqual(asm('abcdefghij99 dat 0\nmov.ab#1,2\n'), ['DAT.F #0, $0', 'MOV.AB #1, $299']);
});

test('glued text followed by whitespace takes nothing along', () => {
  assert.deepEqual(asm('ab12345 dat 0\ndat#1 \n'), ['DAT.F #0, $0', 'DAT.F #0, #1']);
  assert.deepEqual(asm('mov.ab#1,2\n'), ['MOV.AB #1, $2']);
});

test('scratch buffer: identifiers are stored uppercased', () => {
  // ABCDEFQR leaves QR, the label QR (not qr) is defined.
  assert.deepEqual(asm('abcdefqr dat 0\ndat#1+\nQR dat 0\n'), ['DAT.F #0, $0', 'DAT.F #0, #2', 'DAT.F #0, $0']);
});

test('scratch buffer: an opcode followed by whitespace stores a space and a 0 byte', () => {
  // Without the JMP line, ABCD5 leaves its 5 behind DAT#.
  assert.deepEqual(asm('abcd5\ndat#\n'), ['DAT.F #0, #5']);
  assert.equal(assemble('abcd5 jmp 0\ndat#\n').ok, false);
  assert.equal(assemble('abcd5 jmp\t0\ndat#\n').ok, false);
});

test('scratch buffer: a label replaced by a number is stored with the space after it', () => {
  const head = `abcd5 dat 0\n${'dat 0\n'.repeat(11)}`;
  assert.equal(assemble(`${head}jmp abcd5 ,0\ndat#\n`).ok, false);
  assert.deepEqual(asm(`${head}jmp abcd5,0\ndat#\n`).slice(-2), ['JMP.B $-12, $0', 'DAT.F #0, #5']);
});

test('scratch buffer: & concatenation stores the counter name', () => {
  assert.deepEqual(asm('n12345 for 1\nabcdefghijk&n12345 dat#9\nrof\n'), ['DAT.F #0, #95']);
});

test('scratch buffer: EQU and FOR bodies, skipped blocks, asserts, CRLF', () => {
  assert.deepEqual(asm('x equ dat#1\nab12345 dat 0\nx\n'), ['DAT.F #0, $0', 'DAT.F #0, #145']);
  assert.deepEqual(asm('i for 2\nab12345 dat#\nrof\n'), ['DAT.F #0, #345']);
  assert.deepEqual(asm('for 0\nab12345\nrof\ndat#1\n'), ['DAT.F #0, #145']);
  assert.deepEqual(asm(';assert ab12345==ab12345\ndat#1\n'), ['DAT.F #0, #145']);
  assert.deepEqual(asm(';assert 1\ndat#1\n'), ['DAT.F #0, #1']);
  assert.deepEqual(asm('ab12345 dat 0\r\ndat#1\r\n'), ['DAT.F #0, $0', 'DAT.F #0, #145']);
  // An EQU body is not looked at when it is defined, comment lines never.
  assert.deepEqual(asm('x equ abcd567\n;name ab12345\ndat#1\n'), ['DAT.F #0, #1']);
});

test('scratch buffer: lines after the second ;redcode are not read', () => {
  assert.equal(assemble(';redcode\ndat#1\n;redcode\nxxxxx99\n').ok, false);
});

// ---- 6. inputs on which pMARS does not terminate still give a result

test('inputs on which pMARS loops forever are assembled', () => {
  const w = assemble('dat #9223372036854775807+1\n');
  assert.equal(w.ok, true);
  assert.ok(w.warnings.some((m) => /overflow/.test(m.text)));
  // A backslash at the end of the last line stays in the text.
  assert.match(assemble('dat 1\\').errors[0].text, /bad expression/);
  assert.deepEqual(asm(`dat 1${' '.repeat(300)}\n`), ['DAT.F #0, $1']);
});

// ---- further pMARS behavior found on the way

test('a label or EQU value of pass 2 stays apart from a number before it', () => {
  assert.equal(assemble('dat #2x\nx dat 0\n').ok, false);
  assert.equal(assemble('org 2x\nx dat 0\n').ok, false);
  assert.equal(assemble('jmp#(MAXLENGTH ==3)\ndat#1\n').ok, false);
  // Pass 1 replaces without a space: `2x` with x defined before is 2-1.
  assert.deepEqual(asm('x dat 0\ndat #2x\n'), ['DAT.F #0, $0', 'DAT.F #0, #1']);
});

test('a bad & concatenation is an error but the line is still counted', () => {
  const w = assemble('x&q dat 1\n');
  assert.equal(w.ok, false);
  assert.deepEqual(w.warnings.map((m) => m.text), ['missing ;assert']);
});

test('substituted text has a limit: "Substitution is too complex"', () => {
  // w gives 99 characters, v 5299 (53 times w); each `+1` adds 2. pMARS 0.9.5
  // (`pmars -r 0`) assembles every source marked true and reports "Buffer
  // overflow. Substitution is too complex" for every one marked false. The
  // count leaves out whitespace and the mode (#87).
  const defs = `w equ ${Array(50).fill('1').join('+')}\nv equ ${Array(53).fill('w').join('+')}\n`;
  const e = (n) => `v${'+1'.repeat((n - 5299) / 2)}`; // n characters, n odd
  const cases = [
    [`dat ${e(5331)}`, true], [`dat ${e(5333)}`, false],
    [`dat 11+${e(5329)}`, true], [`dat 11+${e(5331)}`, false], // 5332 and 5334
    [`dat 1 + ${e(5329)}`, true], [`dat 1 + ${e(5331)}`, false], // spaces do not count
    [`dat #11+${e(5329)}`, true], [`dat 1, #11+${e(5329)}`, true], // nor does the mode
    [`dat 1, ${e(5331)}`, true], [`dat 1, ${e(5333)}`, false], // each operand alone
    // ORG, END and PIN allow one more: 5333 and 5334
    [`dat 0\norg 0*(${e(5329)})`, true], [`dat 0\norg 0*(11+${e(5327)})`, false],
    [`dat 0\nend 0*(11+${e(5325)})`, true], [`dat 0\nend 0*(11+${e(5327)})`, false],
    [`dat 0\npin 0*(11+${e(5325)})`, true], [`dat 0\npin 0*(11+${e(5327)})`, false],
  ];
  for (const [src, ok] of cases) assert.equal(assemble(defs + src + '\n').ok, ok, src.slice(0, 40));
  // EQU names defined after their use are substituted in pass 2.
  assert.equal(assemble(`dat ${e(5331)}\n${defs}`).ok, true);
  assert.equal(assemble(`dat ${e(5333)}\n${defs}`).ok, false);
  // A FOR count and an assert allow more: x11 gives 4095 characters, x12 8191.
  const x = ['x0 equ 1', ...Array.from({ length: 12 }, (_, i) => `x${i + 1} equ x${i}+x${i}`)].join('\n');
  for (const k of [11, 12]) {
    assert.equal(assemble(`${x}\nfor 0*(x${k})+1\ndat 0\nrof\n`).ok, k === 11);
    assert.equal(assemble(`${x}\n;assert x${k}\ndat 0\n`).ok, k === 11);
  }
  // FOR count: 7998 assemble, 8000 do not; an assert 7999 and 8001.
  const big = `w equ ${Array(50).fill('1').join('+')}\nv equ ${Array(79).fill('w').join('+')}\n`; // v: 7899
  const f = (n) => `v${'+1'.repeat((n - 7899) / 2)}`;
  assert.equal(assemble(`${big}for 0*(${f(7993)})+1\ndat 0\nrof\n`).ok, true);
  assert.equal(assemble(`${big}for 0*(${f(7995)})+1\ndat 0\nrof\n`).ok, false);
  assert.equal(assemble(`${big};assert ${f(7999)}\ndat 0\n`).ok, true);
  assert.equal(assemble(`${big};assert ${f(8001)}\ndat 0\n`).ok, false);
});

test('a running FOR block ends at the first ROF it reads, a dropped FOR line opens none', () => {
  // Expected values from pMARS 0.9.5 (`pmars -r 0`, each source after
  // `;assert 1`): the instructions and the number of warnings. The ROF scan
  // ahead of a block counted the dropped `i for 1` as a nested block; found
  // by tools/pmars-diff.mjs with seed 1794473882.
  const cases = [
    ['i for 2\ndat i\ni for 1\ndat 7\nrof\ndat 9\n', ['DAT.F #0, $1', 'DAT.F #0, $7', 'DAT.F #0, $2', 'DAT.F #0, $7', 'DAT.F #0, $9'], 2],
    ['i for 2\na i for 1\ndat 7\nrof\ndat 9\n', ['DAT.F #0, $7', 'DAT.F #0, $7', 'DAT.F #0, $9'], 2],
    ['i for 2\ndat i\ni for 0\ndat 7\nrof\ndat 9\n', ['DAT.F #0, $1', 'DAT.F #0, $7', 'DAT.F #0, $2', 'DAT.F #0, $7', 'DAT.F #0, $9'], 2],
    ['for 1\ny dat 0\ny for 1\ndat 5\nrof\ndat 9\n', ['DAT.F #0, $0', 'DAT.F #0, $5', 'DAT.F #0, $9'], 1],
    // a skipped block counts every FOR
    ['x dat 0\nfor 0\nx for 1\nrof\nrof\ndat 9\n', ['DAT.F #0, $0', 'DAT.F #0, $9'], 0],
    ['i for 0\ni for 1\nrof\nrof\ndat 9\n', ['DAT.F #0, $9'], 0],
    // labels before ROF stay pending; a dropped `x rof` makes an iteration read on
    ['for 2\ndat 1\nx\nrof\ndat x\n', ['DAT.F #0, $1', 'DAT.F #0, $1', 'DAT.F #0, $-1'], 1],
    ['for 3\ndat 1\nx rof\ndat 5\nrof\ndat x\n', ['DAT.F #0, $1', 'DAT.F #0, $1', 'DAT.F #0, $5', 'DAT.F #0, $1', 'DAT.F #0, $5', 'DAT.F #0, $-4'], 2],
    ['for 3\ndat 1\nx rof\ndat x\n', ['DAT.F #0, $1', 'DAT.F #0, $1', 'DAT.F #0, $-1'], 2],
    ['y dat 0\nfor 2\ndat 1\ny rof\ndat 7\n', ['DAT.F #0, $0', 'DAT.F #0, $1', 'DAT.F #0, $7'], 2],
    ['for 2\nx rof\ndat x\n', ['DAT.F #0, $0'], 0],
    // a multi-line EQU is expanded again in every iteration
    ['m equ dat 1\n equ dat 2\nfor 2\nm\nrof\ndat 9\n', ['DAT.F #0, $1', 'DAT.F #0, $2', 'DAT.F #0, $1', 'DAT.F #0, $2', 'DAT.F #0, $9'], 0],
  ];
  for (const [src, want, warnings] of cases) {
    const w = assemble(`;assert 1\n${src}`);
    assert.deepEqual(w.instructions.map((i) => formatInstruction(i.op, i.mod, i.aMode, i.aVal, i.bMode, i.bVal, 8000)), want, src);
    assert.equal(w.warnings.length, warnings, src);
  }
  // pMARS: errors ("Unopened FOR")
  for (const src of ['i for 1\nj for 1\nj for 1\ndat 1\nrof\nrof\nrof\ndat 9\n', 'x dat 0\nfor 1\nx for 2\ndat 1\nrof\nrof\ndat 9\n',
    'for 2\ny dat 0\ny for 1\ndat 5\nrof\nrof\ndat 9\n', 'for 3\nx rof\ndat 5\nrof\n']) {
    assert.equal(assemble(`;assert 1\n${src}`).ok, false, src);
  }
});

test('ORG, END and PIN without an operand count it as 0', () => {
  // pMARS 0.9.5 (`pmars -r 0`): each assembles without a warning, START where
  // the listing puts it. A bare `pin` shares p-space with `pin 0` and not
  // with `pin 7` (`pmars -b -r 4`, a warrior that stores 42 in p-space cell
  // 1 against one that dies when it loads 42). It was "ORG needs an operand";
  // found by tools/pmars-diff.mjs with seed 1794475258.
  const cases = [
    ['x dat 0\nmov 0,1\norg\n', 0, null], ['x dat 0\nmov 0,1\norg 1\norg\n', 0, null],
    ['x dat 0\nmov 0,1\norg\norg 1\n', 1, null], ['x dat 0\nmov 0,1\norg\nend 1\n', 1, null],
    ['x dat 0\nmov 0,1\norg 1\nend\n', 1, null], ['x dat 0\nmov 0,1\norg ;c\n', 0, null],
    ['dat 0\npin\n', 0, 0], ['dat 0\npin 5\npin\n', 0, 0], ['dat 0\npin\npin 7\n', 0, 7],
  ];
  for (const [src, start, pin] of cases) {
    const w = assemble(`;assert 1\n${src}`);
    assert.deepEqual([w.ok, w.start, w.pin, w.warnings.length], [true, start, pin, 0], src);
  }
});
