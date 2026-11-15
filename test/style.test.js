// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// tools/style.js and tools/style.mjs: the style of our warriors, whose
// designs we know: Dwarf a stone, Lantern a stone, Imp an imp, Origami a
// paper, Seeker a scanner.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { describe, kind, measureStyle } from '../tools/style.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const RULES = { coreSize: 8000, maxCycles: 80000, maxProcesses: 8000, maxLength: 100, minDistance: 100 };
const load = (name) => assemble(readFileSync(join(root, 'warriors', `${name}.red`), 'latin1'), RULES);

test('our warriors get the kind of their design', () => {
  const m = createMarsSync({ ...RULES, watch: true });
  const against = ['dwarf', 'origami', 'seeker'].map(load);
  const style = Object.fromEntries(['dwarf', 'lantern', 'imp', 'origami', 'seeker'].map((n) => [n, measureStyle(m, load(n), against)]));
  assert.match(kind(style.dwarf), /throws copies of its code/);
  assert.match(kind(style.lantern), /throws copies of its code/);
  assert.match(kind(style.imp), /runs copies of its code, few processes/);
  assert.match(kind(style.origami), /copies itself with many processes \(paper\)/);
  assert.match(kind(style.seeker), /reads far cells before it writes \(scanner\)/);
  // the numbers behind it
  assert.equal(style.imp.tasks, 1);
  assert.ok(style.imp.moved > 1000 && style.imp.copies > 1000, JSON.stringify(style.imp));
  assert.ok(style.origami.tasks > 250 && style.origami.moved > 20, JSON.stringify(style.origami));
  assert.equal(style.dwarf.moved, 0);
  assert.ok(style.seeker.read > style.seeker.written, JSON.stringify(style.seeker));
  assert.match(describe(style.dwarf), /alive after 4000 instructions in \d+% of the rounds/);
  // the same again: no state left between warriors
  assert.deepEqual(measureStyle(m, load('dwarf'), against), style.dwarf);
});

test("a warrior that writes nothing has no copies, also against one that bombs the core full", () => {
  const m = createMarsSync({ ...RULES, watch: true });
  const loop = assemble(';name loop\nJMP 0\n', RULES);
  const s = measureStyle(m, loop, [load('dwarf')]);
  assert.ok(s.measured > 0);
  assert.deepEqual([s.copies, s.moved, s.written], [0, 0, 0], JSON.stringify(s));
  assert.equal(kind(s), 'writes little (scanner, or waits)');
});

test('a warrior that dies at once has no style', () => {
  const m = createMarsSync({ ...RULES, watch: true });
  const dat = assemble(';name dat\nDAT 0, 0\n', RULES);
  const s = measureStyle(m, dat, [load('imp')]);
  assert.equal(s.measured, 0);
  assert.equal(kind(s), 'dies at once');
});

test('tools/style.mjs grades a folder, refuses an unknown option', () => {
  const r = spawnSync(process.execPath, [join(root, 'tools/style.mjs'), join(root, 'warriors')], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^origami\.red +copies itself with many processes \(paper\)/m);
  assert.match(r.stdout, /^seeker\.red +reads far cells/m);
  const bad = spawnSync(process.execPath, [join(root, 'tools/style.mjs'), '--x'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown option --x/);
});
