// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --genome gen, a run whose genomes are generators (docs/evolver-gen.md).
// With the changes of a list it is the run on lists, event for event; the
// events and best.gen carry the generators. What the evolver's test files
// share is in test/evolver-common.js; built with cc, or prebuilt in M42_BIN
// (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assemble } from '../wasm/42mars.js';
import { builtProgram, lines, prebuilt, program } from './native.js';
import { setup, cleanup, root, tmp, evolve, skip, RULES, TINY, run, events, stable } from './evolver-common.js';

let gen = prebuilt ? program(prebuilt, '42gen') : null;
before(async () => {
  await setup();
  if (!skip && !prebuilt) gen = await builtProgram('42gen', ['evolver/gen.c', 'evolver/generator.c'], ['-Ilib']);
});
after(cleanup);

// every kind of change of a list, the four small steps too
const ALL = 'opcode=81,modifier=81,a-mode=54,b-mode=54,a-operand=108,b-operand=108,org=27,replace=27,insert=100,delete=100,duplicate=70,move=70,'
  + 'crossover-insert=60,crossover-replace=60,related-opcode=40,related-mode=40,shared-constant=40,tune=40';
const ARGS = [...TINY, '--changes', ALL];
// a run without what only a run on generators has
const plain = (evs) => stable(evs).map((e) => {
  const { gen: text, ...rest } = e;
  return rest.type === 'start' ? { ...rest, params: { ...rest.params, genome: undefined } } : rest;
});
const code = (source) => {
  const w = assemble(source, RULES);
  assert.ok(w.ok, JSON.stringify(w.errors));
  return { start: w.start, code: w.instructions.map((c) => [c.op, c.mod, c.aMode, c.aVal, c.bMode, c.bVal]) };
};
// The warrior that 42gen writes from a generator's text.
const written = (text, name) => {
  const path = join(tmp, name);
  writeFileSync(path, text);
  const r = spawnSync(gen, ['--size', '800', '--length', '20', path], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
  return code(lines(r.stdout));
};

test('--genome gen with the changes of a list is the run on lists, on any thread count and after a resume', { skip }, () => {
  run(join(tmp, 'list'), [...ARGS, '--threads', '1', '--batches', '12']);
  run(join(tmp, 'gen'), [...ARGS, '--genome', 'gen', '--threads', '3', '--batches', '12']);
  const list = events(join(tmp, 'list')), g = events(join(tmp, 'gen'));
  assert.equal(list[0].params.genome, 'list');
  assert.equal(g[0].params.genome, 'gen');
  assert.deepEqual(plain(g), plain(list));
  // most of the 18 kinds of change made a warrior that entered, the ones that move lines too
  const ops = new Set(g.filter((e) => e.type === 'enter').flatMap((e) => e.ops.split(' ')));
  const kinds = ALL.split(',').map((x) => x.split('=')[0]).filter((name) => ops.has(name));
  assert.ok(kinds.length >= 12, kinds.join(' '));
  assert.ok(['insert', 'delete', 'duplicate', 'move'].filter((name) => ops.has(name)).length >= 3 && [...ops].some((name) => name.startsWith('crossover')), kinds.join(' '));
  // in two parts, the second one resumed: the generators come back from the state
  run(join(tmp, 'gen2'), [...ARGS, '--genome', 'gen', '--threads', '2', '--batches', '5']);
  assert.match(readFileSync(join(tmp, 'gen2', 'state.txt'), 'utf8'), /^member \d+ .* gen \d+ \d+ /m);
  run(join(tmp, 'gen2'), ['--threads', '4', '--batches', '7']);
  const resumed = events(join(tmp, 'gen2'));
  assert.equal(resumed.filter((e) => e.type === 'resume').length, 1);
  assert.deepEqual(stable(resumed), stable(g));
  // the events of a run on lists have no generators
  assert.ok(list.every((e) => !('gen' in e)));
});

test('--genome gen: every warrior that enters comes with its generator, and best.gen writes best.red', { skip }, () => {
  if (!existsSync(join(tmp, 'gen'))) run(join(tmp, 'gen'), [...ARGS, '--genome', 'gen', '--threads', '3', '--batches', '12']);
  const enters = events(join(tmp, 'gen')).filter((e) => e.type === 'enter');
  assert.ok(enters.length > 25, `${enters.length} warriors entered`);
  let labels = 0;
  for (const [i, e] of enters.entries()) {
    assert.equal(typeof e.gen, 'string', `warrior ${e.id}`);
    labels += (e.gen.match(/^L\d+:/gm) ?? []).length;
    // generators without structure: one line per instruction
    assert.equal(e.gen.trim().split('\n').filter((l) => !/^\s+org /.test(l)).length, e.length, e.gen);
    if (i % 5 === 0) assert.deepEqual(written(e.gen, 'enter.gen'), code(e.code), e.gen);
  }
  assert.ok(labels > 25, `${labels} labels`);
  const best = readFileSync(join(tmp, 'gen', 'best.gen'), 'utf8');
  assert.match(best, /^; .+, warrior \d+ of run seed 7, batch \d+: 42gen --size and --length of the run gives best\.red's code\n/);
  assert.deepEqual(written(best, 'best.gen'), code(readFileSync(join(tmp, 'gen', 'best.red'), 'latin1')));
  assert.ok(!existsSync(join(tmp, 'one', 'best.gen'))); // a run on lists has none
});

test('--genome gen: start warriors, what it refuses, and a state from before it', { skip }, () => {
  const dir = join(tmp, 'start');
  mkdirSync(dir);
  for (const f of ['dwarf.red', 'imp.red']) copyFileSync(join(root, 'warriors', f), join(dir, f));
  const args = [...ARGS, '--start', dir, '--threads', '2', '--batches', '4'];
  run(join(tmp, 'start-list'), args);
  run(join(tmp, 'start-gen'), [...args, '--genome', 'gen']);
  const g = events(join(tmp, 'start-gen'));
  assert.deepEqual(plain(g), plain(events(join(tmp, 'start-list'))));
  // Dwarf as it is: its three references are labels
  const dwarf = g.find((e) => e.type === 'enter' && e.ops === 'start' && /ADD\.AB/.test(e.code));
  assert.ok(dwarf);
  assert.match(dwarf.gen, /ADD\.AB +#4, \$L\d+\n/);
  assert.match(dwarf.gen, /JMP\.B +\$L\d+, /);

  let r = spawnSync(evolve, [join(tmp, 'bad'), ...ARGS, '--genome', 'tree'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--genome list\|gen/);
  r = spawnSync(evolve, [join(tmp, 'bad'), ...ARGS, '--genome', 'gen', '--tune-novel', '2'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--tune-novel not with --genome gen/);
  assert.ok(!existsSync(join(tmp, 'bad')));
  // --genome list is the default
  run(join(tmp, 'named-list'), [...ARGS, '--genome', 'list', '--threads', '2', '--batches', '1']);
  const named = events(join(tmp, 'named-list'));
  assert.equal(named[0].params.genome, 'list');
  assert.ok(named.some((e) => e.type === 'enter') && named.every((e) => !('gen' in e)));
  // a folder keeps its kind of genome, and --tune-novel does not come later
  r = spawnSync(evolve, [join(tmp, 'start-gen'), '--genome', 'list', '--batches', '1'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  r = spawnSync(evolve, [join(tmp, 'start-gen'), '--tune-novel', '2', '--batches', '1'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--tune-novel not with --genome gen/);
  assert.equal(events(join(tmp, 'start-gen')).filter((e) => e.type === 'resume').length, 0);
  // a state without the field (written before --genome) is a run on lists
  const file = join(tmp, 'start-list', 'state.txt');
  const state = readFileSync(file, 'latin1');
  const old = state.replace(/^(params .*) 0$/m, '$1');
  assert.notEqual(old, state);
  writeFileSync(file, old, 'latin1');
  run(join(tmp, 'start-list'), ['--threads', '2', '--batches', '1']);
  assert.match(readFileSync(file, 'latin1'), /^params .* 0$/m);
  assert.ok(events(join(tmp, 'start-list')).every((e) => !('gen' in e)));
});
