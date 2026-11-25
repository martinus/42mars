// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --no-spl (#185), runs and islands where no warrior has SPL, so that the
// SPL/MOV backbone cannot grow. What the evolver's test files share is in
// test/evolver-common.js; built with cc, or prebuilt in M42_BIN
// (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setup, cleanup, root, tmp, skip, evolve, TINY, run, events, without, stable } from './evolver-common.js';

before(() => setup({ base: false }));
after(cleanup);

const LIST_KINDS = ['opcode', 'modifier', 'a-mode', 'b-mode', 'a-operand', 'b-operand', 'org', 'replace', 'insert', 'delete', 'duplicate',
  'move', 'crossover-insert', 'crossover-replace', 'related-opcode', 'related-mode', 'shared-constant', 'tune', 'random-loop', 'shared-target'];
const GEN_KINDS = ['repeat', 'count', 'fold', 'unroll', 'index', 'expression', 'constant', 'extract', 'parameter', 'call', 'inline', 'transplant'];
const changes = (kinds) => kinds.map((k) => `${k}=1`).join(',');

const SPL = /\bSPL\./;
// the newcomers of a run: every warrior that entered, with its code
const enters = (evs) => evs.filter((e) => e.type === 'enter');
const withSpl = (evs) => enters(evs).filter((e) => SPL.test(e.code));
// the kinds of change of the newcomers' ops
const kindsOf = (evs) => new Set(enters(evs).flatMap((e) => e.ops.split(' ')));

// Short runs that cover the sources of a warrior: random ones (--fill), children by every kind of change, warriors
// back from the archive (--reintroduce); a run without --no-spl gets SPL from them at once.
const ARGS = [...without(TINY, '--batch', '--list'), '--batch', '48', '--list', '16', '--fill', '--reintroduce', '0.15'];
// every child that is played enters (a screen that passes all, the matches as short as the screen), so that the
// events have the code of each
const ALL = [...without(ARGS, '--rounds', '--panel-rounds'), '--rounds', '10', '--panel-rounds', '10', '--survivors', '48', '--screen-factor', '0'];
const allEntered = (evs) => evs.filter((e) => e.type === 'batch').every((e) => e.survivors === e.evaluated &&
  evs.filter((x) => x.type === 'enter' && x.batch === e.batch).length === e.evaluated);

test('--no-spl: no newcomer of a run on lists or on generators has SPL, every kind of change drawn; the same run on any thread count and after a resume', { skip }, () => {
  const B = 14;
  const list = [...ALL, '--changes', changes(LIST_KINDS)];
  run(join(tmp, 'spl-list'), [...list, '--threads', '4', '--batches', '4']);
  const control = events(join(tmp, 'spl-list'));
  assert.equal(control[0].params.noSpl, false);
  assert.ok(withSpl(control).filter((e) => e.ops !== 'random').length >= 10, 'children with SPL without --no-spl');

  run(join(tmp, 'nospl-list'), [...list, '--no-spl', '--threads', '1', '--batches', String(B)]);
  const one = events(join(tmp, 'nospl-list'));
  assert.equal(one[0].params.noSpl, true);
  assert.match(readFileSync(join(tmp, 'nospl-list', 'state.txt'), 'latin1'), /^params .* 1$/m);
  assert.ok(enters(one).length >= 400, `${enters(one).length} newcomers`);
  assert.ok(allEntered(one));
  assert.deepEqual(withSpl(one).map((e) => e.id), []);
  const seen = kindsOf(one);
  for (const k of [...LIST_KINDS, 'random', 'reintroduce']) assert.ok(seen.has(k), `no newcomer by ${k}`);
  assert.doesNotMatch(readFileSync(join(tmp, 'nospl-list', 'best.red'), 'latin1'), SPL);
  run(join(tmp, 'nospl-resumed'), [...list, '--no-spl', '--threads', '2', '--batches', String(B >> 1)]);
  run(join(tmp, 'nospl-resumed'), ['--threads', '3', '--batches', String(B - (B >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'nospl-resumed'))), stable(one));

  // generators: every kind of a list and of the structure
  const gen = [...without(ALL, '--genome'), '--genome', 'gen', '--changes', changes([...LIST_KINDS, ...GEN_KINDS]), '--no-spl'];
  run(join(tmp, 'nospl-gen'), [...gen, '--threads', '4', '--batches', String(B)]);
  const g = events(join(tmp, 'nospl-gen'));
  assert.ok(enters(g).length >= 400, `${enters(g).length} newcomers`);
  assert.ok(allEntered(g));
  assert.deepEqual(withSpl(g).map((e) => e.id), []);
  const gs = kindsOf(g);
  for (const k of [...LIST_KINDS, ...GEN_KINDS, 'random', 'reintroduce']) assert.ok(gs.has(k), `no newcomer by ${k}`);
});

test('--no-spl: a start warrior with SPL is left out with a message; a folder of only such warriors is refused', { skip }, () => {
  const dir = join(tmp, 'starts');
  mkdirSync(dir);
  for (const f of ['dwarf.red', 'imp.red']) writeFileSync(join(dir, f), readFileSync(join(root, 'warriors', f), 'latin1'), 'latin1');
  writeFileSync(join(dir, 'spl.red'), ';name Splitter\n        spl.b $0, $0\n        mov.i $-1, $2\n        jmp.b $-2, $0\n', 'latin1');
  const r = run(join(tmp, 'nospl-start'), [...ARGS, '--no-spl', '--start', dir, '--threads', '2', '--batches', '4']);
  assert.match(r.stderr, /spl\.red has SPL, not a start warrior of a run with --no-spl/);
  const evs = events(join(tmp, 'nospl-start'));
  const starts = enters(evs).filter((e) => e.ops === 'start').map((e) => e.code);
  assert.equal(starts.length, 2);
  assert.ok(starts.some((c) => /ADD/.test(c)) && starts.some((c) => /^\s*MOV\.I\s+\$0, \$1$/m.test(c)), 'the Dwarf and the Imp');
  assert.ok(enters(evs).length > 4);
  assert.deepEqual(withSpl(evs).map((e) => e.id), []);
  // without --no-spl it is one of them
  run(join(tmp, 'spl-start'), [...ARGS, '--start', dir, '--threads', '2', '--batches', '1']);
  assert.equal(enters(events(join(tmp, 'spl-start'))).filter((e) => e.ops === 'start').length, 3);
  const only = join(tmp, 'only-spl');
  mkdirSync(only);
  writeFileSync(join(only, 'spl.red'), readFileSync(join(dir, 'spl.red')));
  const refused = spawnSync(evolve, [join(tmp, 'nospl-refused'), ...ARGS, '--no-spl', '--start', only, '--batches', '1'], { encoding: 'utf8', timeout: 120000 });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /no warrior in .* fits the rules and has no SPL \(--no-spl\)/);
});

const ISLANDS = [...ARGS, '--changes', changes(LIST_KINDS), '--islands', '4', '--migrate', '1', '--threads', '4', '--batches', '8'];
const island = (dir, i) => events(join(dir, `island-0${i}`));

test('--no-spl as an --island-variant: on the explorers they take no migrants, the others take from them; else from islands with --no-spl only', { skip }, () => {
  // one variant per island: the last two are the explorers and have --no-spl
  const ex = join(tmp, 'nospl-explorers');
  run(ex, [...ISLANDS, '--explorers', '2', '--island-variant', '', '--island-variant', '', '--island-variant', '--no-spl', '--island-variant', '--no-spl']);
  const isl = [1, 2, 3, 4].map((i) => island(ex, i));
  assert.deepEqual(isl.map((e) => e[0].params.noSpl), [false, false, true, true]);
  const from = (evs) => evs.filter((e) => e.type === 'migrate').flatMap((e) => e.from.map(([i]) => i));
  assert.deepEqual([from(isl[2]), from(isl[3])], [[], []]);
  for (const k of [2, 3]) assert.deepEqual(withSpl(isl[k]).map((e) => e.id), [], `island ${k + 1}`);
  assert.ok(withSpl(isl[0]).length + withSpl(isl[1]).length > 0, 'SPL on the islands without --no-spl');
  assert.ok([...from(isl[0]), ...from(isl[1])].some((i) => i >= 3), 'the core takes from the explorers');

  // half the islands with --no-spl and no explorers: they take migrants, from each other only, from one island
  // drawn or from all
  for (const to of ['random', 'all']) {
    const half = join(tmp, `nospl-half-${to}`);
    run(half, [...ISLANDS, '--migrate-to', to, '--island-variant', '', '--island-variant', '--no-spl']);
    const h = [1, 2, 3, 4].map((i) => island(half, i));
    assert.deepEqual(h.map((e) => e[0].params.noSpl), [false, true, false, true]);
    assert.deepEqual(from(h[1]).filter((i) => i !== 4), [], to);
    assert.deepEqual(from(h[3]).filter((i) => i !== 2), [], to);
    assert.ok(from(h[1]).length > 0 && from(h[3]).length > 0, 'the islands with --no-spl take from each other');
    for (const k of [1, 3]) {
      assert.deepEqual(withSpl(h[k]).map((e) => e.id), [], `island ${k + 1}, ${to}`);
      assert.ok(enters(h[k]).some((e) => e.ops === 'migrant'), `island ${k + 1} took migrants in`);
    }
    assert.ok(withSpl(h[0]).length + withSpl(h[2]).length > 0, 'SPL on the islands without --no-spl');
    const core = [...from(h[0]), ...from(h[2])];
    assert.ok(core.some((i) => i % 2 === 1) && core.some((i) => i % 2 === 0), 'the others take from both kinds');
  }
});
