// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --genome gen, a run whose genomes are generators (docs/evolver-gen.md).
// With the changes of a list it is the run on lists, event for event; the
// events and best.gen carry the generators; the changes that make structure
// are in evolver-structure.test.js. What the evolver's test files
// share is in test/evolver-common.js; built with cc, or prebuilt in M42_BIN
// (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assemble } from '../wasm/42mars.js';
import { builtProgram, lines, prebuilt, program } from './native.js';
import { setup, cleanup, root, tmp, evolve, skip, RULES, TINY, run, events, stable, checkValues, PARAM, stateParams } from './evolver-common.js';

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
  assert.ok(!existsSync(join(tmp, 'bad')));
  // --genome list is the default
  run(join(tmp, 'named-list'), [...ARGS, '--genome', 'list', '--threads', '2', '--batches', '1']);
  const named = events(join(tmp, 'named-list'));
  assert.equal(named[0].params.genome, 'list');
  assert.ok(named.some((e) => e.type === 'enter') && named.every((e) => !('gen' in e)));
  // a folder keeps its kind of genome
  r = spawnSync(evolve, [join(tmp, 'start-gen'), '--genome', 'list', '--batches', '1'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.equal(events(join(tmp, 'start-gen')).filter((e) => e.type === 'resume').length, 0);
  // a state without the field (written before --genome) is a run on lists
  const file = join(tmp, 'start-list', 'state.txt');
  const state = readFileSync(file, 'latin1');
  // and without everything after it: --refactor, --min-length, --tie-points, --parsimony, --no-spl, --survivors-by, --replace-parent, --events, ...
  const old = state.replace(/^params .*$/m, (line) => line.split(' ').slice(0, PARAM.gen).join(' '));
  assert.notEqual(old, state);
  writeFileSync(file, old, 'latin1');
  run(join(tmp, 'start-list'), ['--threads', '2', '--batches', '1']);
  // the defaults of what it lacked: lists, --tie-points 1, and from before --events: full
  assert.deepEqual(stateParams(readFileSync(file, 'latin1')).slice(PARAM.gen - 1, PARAM.events), ['0', '0', '0', '1', '0', '0', '0', '0', '0']);
  assert.ok(events(join(tmp, 'start-list')).every((e) => !('gen' in e)));
});

test('--genome gen --start: the generators of a folder start a run as they are', { skip }, () => {
  const dir = join(tmp, 'start-gens');
  mkdirSync(dir);
  copyFileSync(join(root, 'warriors', 'dwarf.red'), join(dir, 'dwarf.red'));
  writeFileSync(join(dir, 'a.gen'), '; a row and a function\nf: def\n  SPL.B $0, <x\nend\nrepeat 3\n  MOV.I $0, $1+i*7\nend\nf(5)\nf(9)\n');
  writeFileSync(join(dir, 'bad.gen'), 'MOV.I $0, $nowhere\n'); // no generator
  writeFileSync(join(dir, 'long.gen'), 'repeat 30\n  DAT.F #i, #0\nend\n'); // more than the 20 instructions of the hill
  const r = run(join(tmp, 'from-gens'), [...ARGS, '--genome', 'gen', '--start', dir, '--threads', '2', '--batches', '2']);
  assert.match(r.stderr, /bad\.gen is no generator of a warrior of these rules \(line 1: an unknown label\), not a start warrior/);
  assert.match(r.stderr, /long\.gen is no generator of a warrior of these rules \(it writes nothing, too much, or has too many instruction lines\)/);
  const evs = events(join(tmp, 'from-gens'));
  assert.deepEqual(evs[0].startWarriors.map((w) => [w.name, w.file]), [['a', 'a.gen'], ['Dwarf', 'dwarf.red']]);
  const starts = evs.filter((e) => e.type === 'enter' && e.ops === 'start');
  assert.equal(starts.length, 2);
  const a = starts.find((e) => /repeat/.test(e.gen));
  // as 42gen prints it, and its warrior: three MOV with a step of 7 and the two SPL of the calls
  const text = spawnSync(gen, ['--size', '800', '--length', '20', '--text', join(dir, 'a.gen')], { encoding: 'utf8' });
  assert.equal(a.gen, lines(text.stdout));
  assert.equal(a.length, 5);
  assert.deepEqual(code(a.code), written(a.gen, 'a.gen'));
  assert.deepEqual(code(a.code).code.map((c) => c[5]), [1, 8, 15, 5, 9]);
  // a run on lists takes the .red files only
  run(join(tmp, 'from-gens-list'), [...ARGS, '--start', dir, '--threads', '2', '--batches', '1']);
  assert.deepEqual(events(join(tmp, 'from-gens-list'))[0].startWarriors.map((w) => w.file), ['dwarf.red']);
});

test('--min-length: no child with fewer instructions that are not DAT.F $0, $0 is played, the same run on any thread count and after a resume', { skip }, () => {
  const empty = code('DAT.F $0, $0').code[0];
  const filled = (e) => code(e.code).code.filter((c) => JSON.stringify(c) !== JSON.stringify(empty)).length;
  // without it short warriors enter: a test that could not fail otherwise
  const base = events(join(tmp, 'one'));
  assert.equal(base[0].params.minLength, 0);
  assert.ok(base.some((e) => e.type === 'enter' && filled(e) < 12));
  for (const genome of ['list', 'gen']) {
    const args = [...TINY, '--genome', genome, '--min-length', '12'];
    run(join(tmp, `min-${genome}`), [...args, '--threads', '1', '--batches', '12']);
    const one = events(join(tmp, `min-${genome}`));
    assert.equal(one[0].params.minLength, 12);
    const entered = one.filter((e) => e.type === 'enter');
    assert.ok(entered.length >= 30, `${entered.length} entered`);
    for (const e of entered) assert.ok(filled(e) >= 12, `${genome}: ${e.code}`);
    // random warriors of the start are 12 long (--init-length is 10): all of them could enter
    assert.ok(entered.some((e) => e.ops === 'random'));
    run(join(tmp, `min-${genome}2`), [...args, '--threads', '3', '--batches', '5']);
    run(join(tmp, `min-${genome}2`), ['--threads', '2', '--batches', '7']);
    assert.deepEqual(stable(events(join(tmp, `min-${genome}2`))), stable(one));
  }
  // a dwarf with 7 more instructions and 6 empty cells starts the run: 11 that count, so its children play when a
  // change fills an empty cell, and not when they keep all 6 (the dwarf itself plays, as every start warrior)
  const dir = join(tmp, 'padded');
  mkdirSync(dir);
  writeFileSync(join(dir, 'padded.red'), readFileSync(join(root, 'warriors', 'dwarf.red'), 'latin1').replace(/^\s*end\b.*$/m, (end) => 'DAT.F #1, #1\n'.repeat(7) + 'DAT.F $0, $0\n'.repeat(6) + end));
  run(join(tmp, 'min-padded'), [...TINY, '--min-length', '12', '--start', dir, '--threads', '2', '--batches', '6']);
  const padded = events(join(tmp, 'min-padded')).filter((e) => e.type === 'enter');
  assert.ok(padded.some((e) => e.ops === 'start' && filled(e) === 11));
  assert.ok(padded.length >= 10, `${padded.length} entered`);
  for (const e of padded) if (e.ops !== 'start') assert.ok(filled(e) >= 12, e.code);
  const r = spawnSync(evolve, [join(tmp, 'bad4'), ...TINY, '--min-length', '21'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--min-length at most --length/);
  assert.ok(!existsSync(join(tmp, 'bad4')));
});

test('--tie-points: what a tie counts where the run selects, not where it scores, the same run on any thread count and after a resume', { skip }, () => {
  const args = [...TINY, '--tie-points', '0'];
  run(join(tmp, 'ties'), [...args, '--threads', '1', '--batches', '10']);
  const evs = events(join(tmp, 'ties'));
  assert.equal(evs[0].params.tiePoints, 0);
  assert.equal(events(join(tmp, 'one'))[0].params.tiePoints, 1);
  // the screen: points of 10 rounds without ties are 30 a win
  const shown = evs.filter((e) => e.type === 'enter').flatMap((e) => e.screenPoints);
  assert.ok(shown.length > 100 && shown.every((x) => Math.abs(x / 30 - Math.round(x / 30)) < 1e-9));
  assert.ok(events(join(tmp, 'one')).filter((e) => e.type === 'enter').flatMap((e) => e.screenPoints).some((x) => Math.abs(x / 30 - Math.round(x / 30)) > 1e-6));
  // the values of the last batch: averages over the results of the state, a tie 0
  const panel = new Set(evs[0].panel.map((w) => w.id)), score = new Map();
  for (const line of readFileSync(join(tmp, 'ties', 'state.txt'), 'latin1').split('\n')) {
    const m = line.match(/^score (\d+) (\d+) (\d+) (\d+) (\d+)$/);
    if (m) score.set(`${m[1]} ${m[2]}`, [+m[3], +m[4], +m[5]]).set(`${m[2]} ${m[1]}`, [+m[4], +m[3], +m[5]]);
  }
  const points = (a, b, tie) => {
    const [w, l, t] = score.get(`${a} ${b}`);
    return (3 * w + tie * t) * 100 / (w + l + t);
  };
  const values = evs.filter((e) => e.type === 'values').at(-1).values, ids = values.map((v) => v[0]);
  let ties = 0;
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  for (const [id, avg, , , , panelAvg] of values) {
    if (panel.has(id)) continue;
    const others = ids.filter((o) => o !== id);
    ties += others.reduce((s, o) => s + score.get(`${id} ${o}`)[2], 0);
    assert.ok(Math.abs(mean(others.map((o) => points(id, o, 0))) - avg) < 1e-4, `${id}`);
    assert.ok(Math.abs(mean(others.filter((o) => panel.has(o)).map((o) => points(id, o, 0))) - panelAvg) < 1e-4, `${id}`);
  }
  assert.ok(ties > 100, `${ties} ties`);
  // and every value, screen and estimate of the run, as tools/diversity.js computes them with a tie 0
  assert.equal(checkValues(evs), 10);
  // the holdout counts a tie 1, as the hill does
  const bench = evs.filter((e) => e.type === 'bench');
  assert.ok(bench.length >= 2 && bench.some((e) => e.scores.some((s) => s[3] > 0)));
  for (const e of bench) assert.ok(Math.abs(mean(e.scores.map(([, w, l, t]) => (3 * w + t) * 100 / (w + l + t))) - e.avg) < 1e-4);
  // 3 threads, and in two parts
  run(join(tmp, 'ties2'), [...args, '--threads', '3', '--batches', '4']);
  run(join(tmp, 'ties2'), ['--threads', '2', '--batches', '6']);
  assert.deepEqual(stable(events(join(tmp, 'ties2'))), stable(evs));
  for (const [t, message] of [['4', /--tie-points 0 to 3/], ['-1', /--tie-points 0 to 3/]]) {
    const r = spawnSync(evolve, [join(tmp, 'bad5'), ...TINY, '--tie-points', t], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2);
    assert.match(r.stderr, message);
  }
  assert.ok(!existsSync(join(tmp, 'bad5')));
});
