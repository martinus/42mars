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
import { benchPoints, benchRow, byKind, defaultHill, gaps, hillKinds, kindTable, meanAgainst, ranking, roundRobin, scoreAt, worst } from '../tools/hill-kinds.mjs';

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

// A round robin of tools/tournament.mjs --json of the files, 10 rounds: wins[i][j] of i against j, no ties.
function tournament(files, wins) {
  const pairs = [], results = [];
  for (let a = 0; a < files.length; a++) {
    for (let b = a + 1; b < files.length; b++) {
      pairs.push({ a, b });
      results.push({ a: [wins[a][b], wins[b][a], 10 - wins[a][b] - wins[b][a]], b: [wins[b][a], wins[a][b], 10 - wins[a][b] - wins[b][a]] });
    }
  }
  return { names: files.map((f) => `N (${f})`), files: files.map((f) => `x/${f}`), options: { rounds: 10 }, pairs, results };
}

const FIELDS = 'writes fields, no copies of its code';
const RR_KINDS = { warriors: { 'p1.red': { kind: PAPER }, 'p2.red': { kind: PAPER }, 's.red': { kind: SCANNER }, 'f.red': { kind: FIELDS }, 'broken.red': { kind: null } } };
// p1 beats everyone in all 10 rounds but ties p2 in all; s beats f 5 times and loses 2 (3 ties); the outsider ours.red beats all
const RR = tournament(['p1.red', 'ours.red', 'p2.red', 's.red', 'f.red', 'broken.red'], [
  [0, 0, 0, 10, 10, 10],
  [10, 0, 10, 10, 10, 10],
  [0, 0, 0, 4, 0, 10],
  [0, 0, 6, 0, 5, 10],
  [0, 0, 10, 2, 0, 10],
  [0, 0, 0, 0, 0, 0],
]);

test('a round robin of the folder: warriors of other folders and without a kind are left out; scores, ranking and the score a share reaches', () => {
  const rr = roundRobin(RR, RR_KINDS);
  assert.deepEqual(rr.files, ['p1.red', 'p2.red', 's.red', 'f.red']);
  assert.equal(rr.left, 2);
  // points per 100 rounds: p1 ties p2 (100), beats s and f (300); s against f: 5 wins, 3 ties of 10 rounds = 180
  assert.deepEqual(rr.points.map((row) => [...row]), [[NaN, 100, 300, 300], [100, NaN, 120, 0], [0, 180, NaN, 180], [0, 300, 90, NaN]]);
  assert.deepEqual(rr.score.map((x) => Math.round(x * 100) / 100), [233.33, 73.33, 120, 130]);
  assert.deepEqual(ranking(rr).map((i) => rr.files[i]), ['p1.red', 'f.red', 's.red', 'p2.red']);
  assert.deepEqual([0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map((p) => Math.round(scoreAt(rr, p) * 100) / 100), [233.33, 233.33, 130, 120, 73.33, 73.33, 73.33]);
});

test('kind against kind, the mean row of the best, a bench by groups, the gap per kind and the worst opponents', () => {
  const rr = roundRobin(RR, RR_KINDS);
  const table = kindTable(rr, RR_KINDS);
  assert.deepEqual(table.count, { paper: 2, mover: 0, scanner: 1, stone: 0, other: 1 });
  // papers against papers: p1 against p2 and p2 against p1 (never itself); a kind without warriors has no mean
  assert.deepEqual(table.mean.paper, { paper: 100, mover: null, scanner: 210, stone: null, other: 150, all: (700 / 3 + 220 / 3) / 2 });
  assert.deepEqual(table.mean.scanner, { paper: 90, mover: null, scanner: null, stone: null, other: 180, all: 120 });
  assert.deepEqual(table.mean.other, { paper: 150, mover: null, scanner: 90, stone: null, other: null, all: 130 });
  assert.deepEqual(table.mean.mover, { paper: null, mover: null, scanner: null, stone: null, other: null, all: null });
  // the best 2 (p1, f): each one's mean against a kind first, then the mean of the two
  const group = ['paper', 'paper', 'scanner', 'other'];
  const top = meanAgainst(rr, group, ranking(rr).slice(0, 2));
  assert.deepEqual(top, { paper: (100 + 150) / 2, mover: null, scanner: (300 + 90) / 2, stone: null, other: 300, all: (700 / 3 + 130) / 2 });
  // a bench: an opponent without a kind or of another folder does not count
  const row = benchRow(RR_KINDS, { 'p1.red': 20, 'p2.red': 60, 's.red': 200, 'f.red': 300, 'broken.red': 300, 'elsewhere.red': 0 });
  assert.deepEqual(row, { paper: 40, mover: null, scanner: 200, stone: null, other: 300, all: 145 });
  // the gap: (top - ours) x the kind's share of the 4 warriors with a kind, largest first; a kind without numbers 0
  assert.deepEqual(gaps(RR_KINDS, row, top), [
    { group: 'paper', share: 0.5, top: 125, ours: 40, gap: 42.5 },
    { group: 'mover', share: 0, top: null, ours: null, gap: 0 },
    { group: 'stone', share: 0, top: null, ours: null, gap: 0 },
    { group: 'other', share: 0.25, top: 300, ours: 300, gap: 0 },
    { group: 'scanner', share: 0.25, top: 195, ours: 200, gap: -1.25 },
  ]);
  assert.deepEqual(worst({ 'b.red': 5, 'a.red': 5, 'c.red': 1, 'd.red': 9 }, 3), [{ file: 'c.red', points: 1 }, { file: 'a.red', points: 5 }, { file: 'b.red', points: 5 }]);
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
  // several benches: one row per bench; a round robin of the folder: the scores, the best with kinds, kind against kind, the gap, the worst
  const bench2 = join(tmp, 'bench2.json');
  writeFileSync(bench2, JSON.stringify({ names: ['V (v.red)'], options: { rounds: 10 }, files: ['v.red', join(dir, 'dwarf.red'), join(dir, 'origami.red')],
    pairs: [{ a: 0, b: 1 }, { a: 0, b: 2 }], results: [{ a: [0, 10, 0] }, { a: [10, 0, 0] }] }));
  const two = cmd([dir, '--out', out, '--bench', bench, '--bench', bench2]);
  assert.equal(two.status, 0, two.stderr);
  assert.match(two.stdout, /^warrior +paper +mover +scanner +stone +other +all$/m);
  assert.match(two.stdout, /^W \(w\.red\) +120\.0 +– +– +150\.0 +– +135\.0$/m);
  assert.match(two.stdout, /^V \(v\.red\) +300\.0 +– +– +0\.0 +– +150\.0$/m);
  const rrFile = join(tmp, 'rr.json');
  writeFileSync(rrFile, JSON.stringify(tournament(['dwarf.red', 'origami.red', 'ours.red'], [[0, 3, 0], [6, 0, 0], [10, 10, 0]])));
  const rr = cmd([dir, '--out', out, '--round-robin', rrFile, '--top', '1', '--bench', bench, '--bench', bench2, '--worst', '1']);
  assert.equal(rr.status, 0, rr.stderr);
  assert.match(rr.stdout, /^2 warriors of .* against each other, points per 100 rounds \(10 rounds each\); 1 other warriors of the tournament left out$/m);
  assert.match(rr.stdout, /^best 190\.0, best tenth from 190\.0, best quarter from 190\.0, median 100\.0, /m);
  assert.match(rr.stdout, /^ +1 +Origami \(origami\.red\) +paper +190\.0$/m);
  assert.match(rr.stdout, /^stone \(1\) +100\.0 +– +– +– +– +100\.0$/m);
  assert.match(rr.stdout, /^mean of the best 1 +– +– +– +190\.0 +– +190\.0$/m);
  // the gap and the worst opponents are of the first bench, W: against stones the best 1 has 190 and W 150, stones are half the folder: 20; papers: no number of the best
  assert.match(rr.stdout, /^stone +50\.0% +190\.0 +150\.0 +20\.0$/m);
  assert.match(rr.stdout, /^paper +50\.0% +– +120\.0 +0\.0$/m);
  assert.match(rr.stdout, /^ +120\.0 +origami\.red +paper +/m);
  const rrOne = join(tmp, 'rr1.json');
  writeFileSync(rrOne, JSON.stringify(tournament(['dwarf.red', 'ours.red'], [[0, 3], [6, 0]])));
  for (const [args, why] of [[[dir, '--x'], /unknown option --x/], [[dir, '--worst', '3'], /--worst needs a --bench/], [[dir, '--top', '0'], /--top needs a count, not 0/],
    [[dir, '--out', out, '--round-robin', rrOne], /has fewer than 2 warriors/], [[dir, '--hill', 'nano'], /no hill nano/], [[], /no folder/], [[dir, '--out'], /--out needs a value/]]) {
    const p = cmd(args);
    assert.equal(p.status, 2, args.join(' '));
    assert.match(p.stderr, why);
    assert.match(p.stderr, /usage: node tools\/hill-kinds.mjs/);
  }
});
