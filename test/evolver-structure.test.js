// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --genome gen with the changes that make structure (docs/evolver-gen.md),
// split from evolver-genome.test.js so that CI runs them at the same time
// (#161). What the evolver's test files share is in test/evolver-common.js;
// built with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assemble } from '../wasm/42mars.js';
import { builtProgram, lines, prebuilt, program } from './native.js';
import { setup, cleanup, root, tmp, evolve, skip, RULES, TINY, run, events, stable, checkValues } from './evolver-common.js';

let gen = prebuilt ? program(prebuilt, '42gen') : null;
before(async () => {
  await setup();
  if (!skip && !prebuilt) gen = await builtProgram('42gen', ['evolver/gen.c', 'evolver/generator.c'], ['-Ilib']);
});
after(cleanup);

// every kind of change of a list, the four small steps too
const ALL = 'opcode=81,modifier=81,a-mode=54,b-mode=54,a-operand=108,b-operand=108,org=27,replace=27,insert=100,delete=100,duplicate=70,move=70,'
  + 'crossover-insert=60,crossover-replace=60,related-opcode=40,related-mode=40,shared-constant=40,tune=40,random-loop=40,shared-target=40';
const ARGS = [...TINY, '--changes', ALL];
// a run without what only a run on generators has
const STRUCTURE = ['repeat', 'count', 'fold', 'unroll', 'index', 'expression', 'constant', 'extract', 'parameter', 'call', 'inline', 'transplant'];
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


test('--genome gen: the changes that make structure, the same run on any thread count and after a resume', { skip }, () => {
  // without --changes a run on generators draws them: a quarter of the changes
  run(join(tmp, 'default-gen'), [...TINY, '--genome', 'gen', '--threads', '2', '--batches', '1']);
  const changes = events(join(tmp, 'default-gen'))[0].changes;
  assert.deepEqual(STRUCTURE.map((name) => changes[name]), [30, 40, 30, 15, 40, 40, 40, 20, 20, 25, 10, 15]);
  assert.equal(changes.insert, 100);
  assert.ok(!('repeat' in events(join(tmp, 'one'))[0].changes)); // a run on lists has no such kinds
  // with more of them, to see every kind in a short run
  const more = [...TINY, '--genome', 'gen', '--changes', `${ALL},repeat=150,count=150,fold=150,unroll=80,index=150,expression=150,constant=150,extract=150,parameter=150,call=150,inline=80,transplant=100`];
  run(join(tmp, 'structure'), [...more, '--threads', '1', '--batches', '30']);
  const one = events(join(tmp, 'structure'));
  const enters = one.filter((e) => e.type === 'enter');
  const ops = new Set(enters.flatMap((e) => e.ops.split(' ')));
  const kinds = STRUCTURE.filter((name) => ops.has(name));
  assert.ok(kinds.length >= 8 && ops.has('extract') && (ops.has('call') || ops.has('parameter') || ops.has('inline')),
    `kinds that made a warrior that entered: ${kinds.join(' ')}`);
  const blocks = enters.filter((e) => /^\S*\s+repeat /m.test(e.gen)), constants = enters.filter((e) => /^c\d+ = /m.test(e.gen));
  const functions = enters.filter((e) => /^f\d+:\s+def$/m.test(e.gen) && /^\S*\s+f\d+\(/m.test(e.gen));
  assert.ok(blocks.length >= 5 && constants.length >= 3 && functions.length >= 3,
    `${blocks.length} warriors with a block, ${constants.length} with a constant, ${functions.length} with a function and a call, of ${enters.length}`);
  // the generator of each is the generator of its code, within the rules
  for (const e of [...blocks, ...constants, ...functions]) {
    assert.deepEqual(written(e.gen, 'structure.gen'), code(e.code), e.gen);
    assert.ok(e.length <= RULES.maxLength && e.gen.split('\n').filter((l) => /^\S*\s+[A-Z]{3}\./.test(l)).length <= RULES.maxLength, e.gen);
  }
  // a block that writes more instructions than its lines
  assert.ok(blocks.some((e) => e.length > e.gen.split('\n').filter((l) => /^\S*\s+[A-Z]{3}\./.test(l)).length));
  // 3 threads, and in two parts
  run(join(tmp, 'structure3'), [...more, '--threads', '3', '--batches', '30']);
  assert.deepEqual(stable(events(join(tmp, 'structure3'))), stable(one));
  run(join(tmp, 'structure2'), [...more, '--threads', '2', '--batches', '13']);
  run(join(tmp, 'structure2'), ['--threads', '4', '--batches', '17']);
  assert.deepEqual(stable(events(join(tmp, 'structure2'))), stable(one));
  // a list has no such changes: not for a new run, not for one that continues
  let r = spawnSync(evolve, [join(tmp, 'bad2'), ...TINY, '--changes', 'insert=1,fold=1'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--changes with a kind of generators \(repeat to transplant\) needs --genome gen/);
  assert.ok(!existsSync(join(tmp, 'bad2')));
  r = spawnSync(evolve, [join(tmp, 'one'), '--changes', 'insert=1,constant=1', '--batches', '1'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /needs --genome gen/);
  assert.equal(events(join(tmp, 'one')).filter((e) => e.type === 'resume').length, 0);
  r = spawnSync(evolve, [join(tmp, 'bad2'), ...TINY, '--genome', 'gen', '--changes', 'folds=1'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^and with --genome gen: repeat count fold unroll index expression constant extract parameter call inline transplant$/m);
  // a run on generators takes them later too
  run(join(tmp, 'default-gen'), ['--changes', 'insert=1,constant=1,repeat=1', '--threads', '2', '--batches', '1']);
  assert.equal(events(join(tmp, 'default-gen')).filter((e) => e.type === 'changes')[0].changes, 'insert=1,repeat=1,constant=1');
});
