// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Generators (evolver/generator.c, docs/evolver-gen.md): the C test of the
// language (test/c/generator-test.c), and 42gen: a decoy and a boot written by
// a generator against the same warrior written by hand, every evolved warrior
// as a generator of itself, and what 42gen says about a text it cannot read.
// Built with cc, or prebuilt in M42_BIN (test/native.js).

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble } from '../wasm/42mars.js';
import { builtProgram, lines, prebuilt, program, skip as noCc } from './native.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'generator-test-'));
let gen = prebuilt ? program(prebuilt, '42gen') : null;
let unit = prebuilt ? program(prebuilt, 'generator-test') : null;
const skip = noCc || (prebuilt && !existsSync(gen) && `no 42gen in ${prebuilt}`) || false;

before(async () => {
  if (skip || prebuilt) return;
  [gen, unit] = await Promise.all([
    builtProgram('42gen', ['evolver/gen.c', 'evolver/generator.c'], ['-Ilib']),
    builtProgram('generator-test', ['test/c/generator-test.c', 'evolver/generator.c', 'evolver/gen-change.c', 'evolver/genome.c'], ['-Ilib', '-Ievolver']),
  ]);
});
after(() => rmSync(tmp, { recursive: true, force: true }));

const run = (...args) => {
  const r = spawnSync(gen, args, { encoding: 'utf8', timeout: 60000 });
  return { status: r.status, out: lines(r.stdout), err: lines(r.stderr) };
};
const file = (name, text) => {
  const path = join(tmp, name);
  writeFileSync(path, text, 'latin1');
  return path;
};
// What plays: the instructions and the start, without the source lines.
const warrior = (source, options = {}) => {
  const w = assemble(source, options);
  assert.ok(w.ok, JSON.stringify(w.errors));
  return { start: w.start, code: w.instructions.map((c) => [c.op, c.mod, c.aMode, c.aVal, c.bMode, c.bVal]) };
};

test('generators in C', { skip }, () => {
  const r = spawnSync(unit, { encoding: 'utf8', timeout: 300000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'ok');
});

test('42gen: a decoy and a boot from a generator are the warrior written by hand', { skip }, () => {
  // Cranky Mongoose VI with 85 cells of decoy, booted 4000 cells on: the
  // warrior of "Stages around evolved warriors" (docs/evolver.md, 143.7 at
  // 6000), as the script of 20th November 2026 wrote it
  const body = ['SPL.I   #-3830, >-20', 'MOV.I   *1, <1', 'MOV.I   <0, <3989', 'DJN.X   $-2, {1781'];
  const byHand = ['        ORG     boot',
    ...Array.from({ length: 85 }, (_, i) => `        DAT.F   #${i + 1}, #${(37 * (i + 1)) % 800}`),
    ...body.map((l, i) => `${i ? '       ' : 'body   '} ${l}`),
    ...body.map((_, i) => `${i ? '       ' : 'boot   '} MOV.I   body+${i}, body+${4000 + i}`),
    '        JMP     body+4000', ''].join('\n');
  const generator = ['c0 = 4000',
    '        repeat 85',
    '          DAT.F   #i+1, #37*(i+1)%800',
    '        end',
    'body:   repeat 1',
    ...body.map((l) => `          ${l}`),
    '        end',
    'boot:   repeat body.len',
    '          MOV.I   $body+i, $body+c0+i',
    '        end',
    '        JMP.B   $body+c0, $0',
    '        org     boot', ''].join('\n');
  const r = run(file('decoy.gen', generator));
  assert.equal(r.status, 0, r.err);
  assert.equal(r.err, '');
  const got = warrior(r.out), want = warrior(byHand);
  assert.equal(want.code.length, 94);
  assert.equal(want.start, 89);
  assert.deepEqual(got, want);
  // 14 lines for 94 instructions; another offset and a shorter decoy are two numbers
  const other = run(file('decoy2.gen', generator.replace('c0 = 4000', 'c0 = 6000').replace('repeat 85', 'repeat 50')));
  const w = warrior(other.out);
  assert.equal(w.code.length, 59);
  assert.deepEqual(w.code[58], [13, 1, 1, 8000 - 2000 - 8, 1, 0]); // JMP.B $body+6000, $0
  assert.deepEqual(w.code[54], [0, 6, 1, 8000 - 4, 1, 6000 - 4]); // the first MOV.I: body 4 back, its copy 6000 on
});

test('42gen --from: every evolved warrior as a generator writes itself', { skip }, () => {
  const hills = [['94nop', [], {}], ['tiny', ['--size', '800', '--length', '20'], { coreSize: 800, maxLength: 20, maxProcesses: 800, minDistance: 20 }]];
  let count = 0, labels = 0;
  for (const [hill, args, options] of hills) {
    const dir = join(root, 'warriors/evolved', hill);
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.red')).sort()) {
      const source = join(dir, name);
      const text = run(...args, '--from', source);
      assert.equal(text.status, 0, `${name}: ${text.err}`);
      labels += (text.out.match(/^L\d+:/gm) ?? []).length;
      const back = run(...args, file('back.gen', text.out));
      assert.equal(back.status, 0, `${name}: ${back.err}`);
      assert.deepEqual(warrior(back.out, options), warrior(readFileSync(source, 'latin1'), options), name);
      // and its text reads back as it was printed
      assert.equal(run(...args, '--text', file('back.gen', text.out)).out, text.out, name);
      count++;
    }
  }
  assert.ok(count > 150 && labels > 100, `${count} warriors, ${labels} labels`);
});

test('42gen: what it refuses, and a generator that writes too much', { skip }, () => {
  assert.equal(run().status, 2);
  assert.equal(run('--text', '--from', file('a.gen', 'NOP.B $0, $0\n')).status, 2);
  assert.equal(run('--size', '0', file('a.gen', 'NOP.B $0, $0\n')).status, 2);
  assert.equal(run('--frobnicate', file('a.gen', 'NOP.B $0, $0\n')).status, 2);
  let r = run(join(tmp, 'missing.gen'));
  assert.equal(r.status, 1);
  assert.match(r.err, /cannot read/);
  r = run(file('bad.gen', 'NOP.B $0, $0\nrepeat 3\n MOV.I $0, $nowhere\nend\n'));
  assert.equal(r.status, 1);
  assert.equal(r.out, '');
  assert.match(r.err, /bad\.gen: line 3: an unknown label/);
  r = run('--from', file('bad.red', 'MOV.I $0, $nowhere\n'));
  assert.equal(r.status, 1);
  assert.match(r.err, /is no warrior/);
  // more than --length: what was written until then, and a message
  const long = file('long.gen', 'repeat 30\n DAT.F #i, #0\nend\n');
  r = run('--length', '20', long);
  assert.equal(r.status, 0);
  assert.match(r.err, /truncated after 20 instructions/);
  assert.equal(warrior(r.out).code.length, 20);
  r = run('--length', '30', long);
  assert.equal(r.err, '');
  assert.equal(warrior(r.out).code.length, 30);
  // --size: CORESIZE and the numbers follow it
  r = run('--size', '800', file('size.gen', 'DAT.F #CORESIZE/2+1, #799\n'));
  assert.equal(r.out, '        ORG     0\n        DAT.F   #-399, #-1\n');
});
