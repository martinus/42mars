// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The command line program (cli/42mars.c) against outputs of pMARS 0.9.5:
// test/fixtures/cli.json holds, per case, the arguments, the stream on stdin
// if any, pMARS's exit code and stdout, recorded with `pmars <args>` (the server build in the oracle
// folder) on the warriors in warriors/ (W/) and the three below (P/). Built
// natively (test/native.js).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { lines, prebuilt, program, skip } from './native.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'cli-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const bin = program(prebuilt ?? tmp, '42mars');

// P/: a PIN, an ORG, negative values and A-field modes; a source with an
// error; a warrior that dies; NUL bytes.
writeFileSync(join(tmp, 'pinny.red'), ';name pinny\n pin 77\n org 2\n dat -1, 7999\n spl.b #-3, }5\nfoo jmp foo\n end\n');
writeFileSync(join(tmp, 'broken.red'), ' mov 0\n');
writeFileSync(join(tmp, 'die.red'), ' dat 0\n'); // alone, it dies in every round
// registers: pMARS assembles the first warrior with what its score formula check leaves
writeFileSync(join(tmp, 'regs.red'), ';name regs\n dat #w, #s\n dat #x, #a\n jmp 0\n');
// A NUL byte ends the line content (#85); after an opcode, pMARS gives a syntax error.
writeFileSync(join(tmp, 'nul.red'), 'mov\0 i b,k\ndat 5\n');
writeFileSync(join(tmp, 'nulline.red'), ';name a\0b\ndat 1\0 garbage here\nmov 0,1\n');
// -V (#92): pMARS's example of the issue
writeFileSync(join(tmp, 'verbose.red'), ';name T\nstep equ 4\nx for 2\n  add #step, 3\nrof\nmov 2, @2\njmp -2\ndat #0, #0\n');
// Several warriors on stdin (#93): a case's `stdin` names one of these.
const streams = {
  'stream2.txt': ';redcode\n;name A\nmov 0, 1\nend\n;redcode\n;name B\nadd #4, 3\nmov 2, @2\njmp -2\ndat #0, #0\nend\n',
  'stream3.txt': ';redcode\n;name A\nmov 0,1\n;redcode\ndat 5\n;redcode\n;name C\ndat 7\n',
  'nomarks.txt': ';name A\nmov 0, 1\nend\n;name B\ndat 1\nend\n',
  'between.txt': ';redcode\n;name A\nmov 0,1\nend\n;name X\n;author Y\ndat 9\n;redcode\n;name B\ndat 5\n',
  'crlf.txt': ';redcode\r\n;name A\r\nmov 0,1\r\n;redcode\r\n;name B\r\ndat 5\r\n',
};

before(() => (prebuilt || skip ? undefined : promisify(execFile)('cc', ['-O2', '-o', bin, join(root, 'cli/42mars.c'), join(root, 'lib/42mars.c')])));

const cases = JSON.parse(readFileSync(new URL('./fixtures/cli.json', import.meta.url), 'utf8'));
for (const c of cases) {
  test(`42mars ${c.args}${c.stdin ? ` < ${c.stdin}` : ''}`, { skip }, () => {
    const argv = c.args.split(' ').map((a) => a.replace(/^W\//, join(root, 'warriors') + '/').replace(/^P\//, tmp + '/'));
    const r = spawnSync(bin, argv, { encoding: 'latin1', input: c.stdin ? streams[c.stdin] : '' });
    assert.equal(r.status, c.code, r.stderr);
    assert.equal(lines(r.stdout), c.stdout);
  });
}

test('42mars stops a source on which pMARS takes very long', { skip }, () => {
  // m42_assemble_new() natively: 38 bytes of nested FOR took 18 s and 14.7 GB
  // before the assembler had a limit (#87). pMARS does not finish either.
  const f = join(tmp, 'nested.red');
  writeFileSync(f, 'for 1000000\nfor 1000000\ndat 0\nrof\nrof\n');
  const t = performance.now();
  const r = spawnSync(bin, ['-r', '0', f], { encoding: 'latin1', timeout: 30000 });
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /pMARS has no limit here/);
  assert.ok(performance.now() - t < 3000);
});

test('42mars -V prints the passes to stderr in pMARS\'s format', { skip }, () => {
  // pMARS -V on this warrior: "(    4)   add #step, 3" in pass 0, "(    4)
  // ADD #4,3" twice in pass 1; stdout as without -V (the recorded cases).
  const r = spawnSync(bin, ['-V', '-r', '0', join(tmp, 'verbose.red')], { encoding: 'latin1' });
  assert.equal(r.status, 0);
  const err = lines(r.stderr);
  assert.match(err, /After pass 0\nInstruction \(physical line, instr\):\n\n\(    2\) step equ 4\n\(    3\) x for 2\n\(    4\)   add #step, 3\n/);
  assert.match(err, /After pass 1\nInstruction \(physical line, instr\):\n\n\(    4\) ADD #4,3\n\(    4\) ADD #4,3\n\(    6\) MOV 2,@2\n\(    7\) JMP -2\n\(    8\) DAT #0,#0\n/);
  assert.equal(r.stdout, spawnSync(bin, ['-r', '0', join(tmp, 'verbose.red')], { encoding: 'latin1' }).stdout);
});

test('42mars rejects what the engine does not support', { skip }, () => {
  const w = [join(root, 'warriors/imp.red'), join(root, 'warriors/dwarf.red')];
  for (const args of [['-s', '70000'], ['-F', '4000+1']]) {
    const r = spawnSync(bin, ['-b', ...args, ...w], { encoding: 'latin1' });
    assert.equal(r.status, 2, args.join(' '));
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /^42mars: /);
  }
});
