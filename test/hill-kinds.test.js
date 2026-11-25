// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// tools/hill-kinds.mjs (#221): the kind of style of every warrior of a
// folder, cached by each file's content hash, and a bench by those kinds.

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchPoints, byKind, defaultHill, hillKinds } from '../tools/hill-kinds.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'hill-kinds-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const PAPER = 'copies itself with many processes (paper)', MOVER = 'runs copies of its code, few processes (imp, a stone that moves)';
const SCANNER = 'reads far cells before it writes (scanner)', STONE = 'throws copies of its code (stone, clear)';

test('the kinds of a folder, cached: a changed or new warrior is measured again, nothing else; one that is gone leaves', () => {
  const dir = join(tmp, 'hill'), out = join(tmp, 'cache', 'kinds.json');
  mkdirSync(dir);
  for (const n of ['dwarf', 'origami', 'seeker']) copyFileSync(join(root, 'warriors', `${n}.red`), join(dir, `${n}.red`));
  writeFileSync(join(dir, 'broken.red'), ';redcode-94\njmp nowhere\n');
  const kinds = (k) => Object.fromEntries(Object.entries(k.warriors).map(([f, w]) => [f, w.kind]));
  const first = hillKinds(dir, { hill: '94nop', out });
  assert.deepEqual(kinds(first), { 'broken.red': null, 'dwarf.red': STONE, 'origami.red': PAPER, 'seeker.red': SCANNER });
  assert.equal(first.measured, 4);
  assert.ok(first.warriors['broken.red'].why);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).warriors, first.warriors);
  // again: from the cache
  assert.equal(hillKinds(dir, { hill: '94nop', out }).measured, 0);
  // a changed file and a new one are measured, a removed one leaves
  appendFileSync(join(dir, 'dwarf.red'), '; a comment changes the hash\n');
  copyFileSync(join(root, 'warriors', 'imp.red'), join(dir, 'imp.red'));
  unlinkSync(join(dir, 'broken.red'));
  const third = hillKinds(dir, { hill: '94nop', out });
  assert.equal(third.measured, 2);
  assert.deepEqual(kinds(third), { 'dwarf.red': STONE, 'imp.red': MOVER, 'origami.red': PAPER, 'seeker.red': SCANNER });
  assert.notEqual(third.warriors['dwarf.red'].hash, first.warriors['dwarf.red'].hash);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).warriors, third.warriors);
  // only a removal: nothing measured, the cache without it
  unlinkSync(join(dir, 'imp.red'));
  assert.equal(hillKinds(dir, { hill: '94nop', out }).measured, 0);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(out, 'utf8')).warriors), ['dwarf.red', 'origami.red', 'seeker.red']);
  // a cache of other opponents or rules is measured again as a whole
  const cache = JSON.parse(readFileSync(out, 'utf8'));
  writeFileSync(out, JSON.stringify({ ...cache, against: ['other.red 0'] }));
  assert.equal(hillKinds(dir, { hill: '94nop', out }).measured, 3);
  // the hill by the folder's name
  assert.deepEqual([defaultHill(join(root, 'warriors/koenigstuhl/tiny')), defaultHill(join(root, 'warriors/koenigstuhl/94nop')), defaultHill(dir)], ['tiny', '94nop', '94nop']);
});

test('a bench by the kinds of its opponents: count and mean points per kind', () => {
  const kinds = { warriors: { 'a.red': { kind: PAPER }, 'b.red': { kind: SCANNER }, 'c.red': { kind: PAPER }, 'd.red': { kind: null }, 'e.red': { kind: PAPER } } };
  // e.red is not in the bench: the mean of a kind is over those with a value
  // tools/tournament.mjs --bench --json: file 0 the warrior, pairs against the others, results [wins, losses, ties]
  const json = { options: { rounds: 10 }, files: ['w.red', 'x/a.red', 'x/b.red', 'x/c.red'], pairs: [{ a: 0, b: 1 }, { a: 0, b: 2 }, { a: 0, b: 3 }],
    results: [{ a: [10, 0, 0] }, { a: [2, 5, 3] }, { a: [0, 10, 0] }] };
  const points = benchPoints(json);
  assert.deepEqual(points, { 'a.red': 300, 'b.red': 90, 'c.red': 0 });
  assert.deepEqual(byKind(kinds, points), [
    { kind: PAPER, count: 3, mean: 150, with: 2 },
    { kind: SCANNER, count: 1, mean: 90, with: 1 },
    { kind: 'not measured', count: 1, mean: null, with: 0 },
  ]);
  assert.deepEqual(byKind(kinds).map((g) => [g.kind, g.count, g.mean]), [[PAPER, 3, null], [SCANNER, 1, null], ['not measured', 1, null]]);
});

test('the command: the kinds per kind, a bench broken down; unknown options and hills refused', () => {
  const dir = join(tmp, 'cli'), out = join(tmp, 'cli.json');
  mkdirSync(dir);
  for (const n of ['dwarf', 'origami']) copyFileSync(join(root, 'warriors', `${n}.red`), join(dir, `${n}.red`));
  const cmd = (args) => spawnSync(process.execPath, [join(root, 'tools/hill-kinds.mjs'), ...args], { encoding: 'utf8', timeout: 60000 });
  const r = cmd([dir, '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^paper +1$/m);
  assert.match(r.stdout, /^stone +1$/m);
  const bench = join(tmp, 'bench.json');
  writeFileSync(bench, JSON.stringify({ names: ['W (w.red)'], options: { rounds: 10 }, files: ['w.red', join(dir, 'dwarf.red'), join(dir, 'origami.red')],
    pairs: [{ a: 0, b: 1 }, { a: 0, b: 2 }], results: [{ a: [5, 5, 0] }, { a: [1, 0, 9] }] }));
  const b = cmd([dir, '--out', out, '--bench', bench]);
  assert.equal(b.status, 0, b.stderr);
  assert.match(b.stdout, /^paper +1 +120\.0$/m);
  assert.match(b.stdout, /^stone +1 +150\.0$/m);
  for (const [args, why] of [[[dir, '--x'], /unknown option --x/], [[dir, '--hill', 'nano'], /no hill nano/], [[], /no folder/], [[dir, '--out'], /--out needs a value/]]) {
    const p = cmd(args);
    assert.equal(p.status, 2, args.join(' '));
    assert.match(p.stderr, why);
    assert.match(p.stderr, /usage: node tools\/hill-kinds.mjs/);
  }
});
