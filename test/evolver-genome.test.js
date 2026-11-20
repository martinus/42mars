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
const STRUCTURE = ['repeat', 'count', 'fold', 'unroll', 'index', 'expression', 'constant'];
const plain = (evs) => stable(evs).map((e) => {
  const { gen: text, ...rest } = e;
  if (rest.type !== 'start') return rest;
  // the kinds that only a generator has: a run on lists does not list them
  const changes = Object.fromEntries(Object.entries(rest.changes).filter(([name]) => !STRUCTURE.includes(name)));
  return { ...rest, changes, params: { ...rest.params, genome: undefined } };
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
  assert.ok(STRUCTURE.every((name) => g[0].changes[name] === 0 && !(name in list[0].changes)));
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

test('--genome gen: the changes that make structure, the same run on any thread count and after a resume', { skip }, () => {
  // without --changes a run on generators draws them: a fifth of the changes
  run(join(tmp, 'default-gen'), [...TINY, '--genome', 'gen', '--threads', '2', '--batches', '1']);
  const changes = events(join(tmp, 'default-gen'))[0].changes;
  assert.deepEqual([changes.repeat, changes.count, changes.fold, changes.unroll, changes.index, changes.expression, changes.constant], [30, 40, 30, 15, 40, 40, 40]);
  assert.equal(changes.insert, 100);
  assert.ok(!('repeat' in events(join(tmp, 'one'))[0].changes)); // a run on lists has no such kinds
  // with more of them, to see every kind in a short run
  const more = [...TINY, '--genome', 'gen', '--changes', `${ALL},repeat=150,count=150,fold=150,unroll=80,index=150,expression=150,constant=150`];
  run(join(tmp, 'structure'), [...more, '--threads', '1', '--batches', '16']);
  const one = events(join(tmp, 'structure'));
  const enters = one.filter((e) => e.type === 'enter');
  const ops = new Set(enters.flatMap((e) => e.ops.split(' ')));
  const kinds = STRUCTURE.filter((name) => ops.has(name));
  assert.ok(kinds.length >= 5, `kinds that made a warrior that entered: ${kinds.join(' ')}`);
  const blocks = enters.filter((e) => /^\S*\s+repeat /m.test(e.gen)), constants = enters.filter((e) => /^c\d+ = /m.test(e.gen));
  assert.ok(blocks.length >= 5 && constants.length >= 3, `${blocks.length} warriors with a block, ${constants.length} with a constant, of ${enters.length}`);
  // the generator of each is the generator of its code, within the rules
  for (const e of [...blocks, ...constants]) {
    assert.deepEqual(written(e.gen, 'structure.gen'), code(e.code), e.gen);
    assert.ok(e.length <= RULES.maxLength && e.gen.split('\n').filter((l) => /^\S*\s+[A-Z]{3}\./.test(l)).length <= RULES.maxLength, e.gen);
  }
  // a block that writes more instructions than its lines
  assert.ok(blocks.some((e) => e.length > e.gen.split('\n').filter((l) => /^\S*\s+[A-Z]{3}\./.test(l)).length));
  // 3 threads, and in two parts
  run(join(tmp, 'structure3'), [...more, '--threads', '3', '--batches', '16']);
  assert.deepEqual(stable(events(join(tmp, 'structure3'))), stable(one));
  run(join(tmp, 'structure2'), [...more, '--threads', '2', '--batches', '7']);
  run(join(tmp, 'structure2'), ['--threads', '4', '--batches', '9']);
  assert.deepEqual(stable(events(join(tmp, 'structure2'))), stable(one));
  // a list has no such changes: not for a new run, not for one that continues
  let r = spawnSync(evolve, [join(tmp, 'bad2'), ...TINY, '--changes', 'insert=1,fold=1'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--changes repeat, count, fold, unroll, index, expression and constant with --genome gen only/);
  assert.ok(!existsSync(join(tmp, 'bad2')));
  r = spawnSync(evolve, [join(tmp, 'one'), '--changes', 'insert=1,constant=1', '--batches', '1'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /with --genome gen only/);
  assert.equal(events(join(tmp, 'one')).filter((e) => e.type === 'resume').length, 0);
  r = spawnSync(evolve, [join(tmp, 'bad2'), ...TINY, '--genome', 'gen', '--changes', 'folds=1'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^and with --genome gen: repeat count fold unroll index expression constant$/m);
  // a run on generators takes them later too
  run(join(tmp, 'default-gen'), ['--changes', 'insert=1,constant=1,repeat=1', '--threads', '2', '--batches', '1']);
  assert.equal(events(join(tmp, 'default-gen')).filter((e) => e.type === 'changes')[0].changes, 'insert=1,repeat=1,constant=1');
});
