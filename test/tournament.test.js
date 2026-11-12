// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble, createMarsSync } from '../wasm/42mars.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'tournament-test-'));
after(() => rmSync(dir, { recursive: true, force: true }));

function run(seed, name, warriors = join(root, 'warriors')) {
  const out = join(dir, `${name}.json`);
  execFileSync(process.execPath, [join(root, 'tools/tournament.mjs'), warriors,
    '--rounds', '20', '--jobs', '3', '--seed', String(seed), '--json', out], { stdio: 'ignore' });
  return JSON.parse(readFileSync(out, 'utf8'));
}

const pairings = (t) => t.results.map((r) => [r.a, r.b]);

// Each pairing as one runMatch() call over all its rounds.
function wholeMatches(t, rounds) {
  const code = (f) => assemble(readFileSync(f, 'latin1'));
  const m = createMarsSync();
  return t.pairs.map((p) => {
    const r = m.runMatch([code(t.files[p.a]), code(t.files[p.b])], { rounds, seed: p.pos - 100 });
    return r.warriors.map((w) => [w.wins, w.losses, w.ties]);
  });
}

test('tournament: every pairing plays all rounds, as one runMatch() of the whole match', () => {
  const t = run(5, 'whole');
  assert.equal(t.pairs.length, 10); // 5 sample warriors
  for (const [a, b] of pairings(t)) {
    assert.equal(a[0] + a[1] + a[2], 20);
    assert.deepEqual([a[0], a[1], a[2]], [b[1], b[0], b[2]]);
  }
  assert.deepEqual(pairings(t), wholeMatches(t, 20));
});

test('tournament: --engine takes only wasm', () => {
  const tool = join(root, 'tools/tournament.mjs');
  assert.throws(() => execFileSync(process.execPath, [tool, join(root, 'warriors'), '--engine', 'js'], { stdio: 'pipe' }), /only wasm/);
});

test('tournament: the same seed gives the same results, another seed other positions', () => {
  const a = run(9, 'a');
  const b = run(9, 'b');
  const c = run(10, 'c');
  assert.deepEqual(pairings(a), pairings(b));
  assert.deepEqual(a.pairs, b.pairs);
  assert.notDeepEqual(a.pairs.map((p) => p.pos), c.pairs.map((p) => p.pos));
});

// The wasm engine plays each pairing without LDP as blocks of rounds that
// any thread takes (so the tests above run in blocks too). A warrior with
// LDP sees the last result of the round before, so its pairings must stay
// whole: this one dies right after a tied round.
test('tournament: pairings with LDP are not split into blocks of rounds', () => {
  const warriors = join(dir, 'ldp');
  mkdirSync(warriors);
  writeFileSync(join(warriors, 'ldp.red'), ';name ldp\nldp.ab #0, flag\nsub.ab #2, flag\njmz.b die, flag\njmp 0\ndie dat 0, 0\nflag dat 0, 0\n');
  writeFileSync(join(warriors, 'wait.red'), ';name wait\njmp 0\n');
  copyFileSync(join(root, 'warriors/dwarf.red'), join(warriors, 'dwarf.red'));
  const t = run(3, 'ldp', warriors);
  assert.equal(t.pairs.length, 3);
  assert.deepEqual(pairings(t), wholeMatches(t, 20));
  // ldp against wait: a tie, then a loss, and so on.
  const k = t.pairs.findIndex((p) => [t.names[p.a], t.names[p.b]].sort().join() === 'ldp (ldp.red),wait (wait.red)');
  assert.deepEqual([...t.results[k].a].sort(), [0, 10, 10]);
});

// The score of every warrior, from a tournament's pairings.
function scores(t) {
  const s = t.names.map(() => 0);
  t.pairs.forEach((p, k) => {
    s[p.a] += 3 * t.results[k].a[0] + t.results[k].a[2];
    s[p.b] += 3 * t.results[k].b[0] + t.results[k].b[2];
  });
  return s;
}

test('tournament: the standings after each round are those of a tournament of that many rounds, also with LDP', () => {
  const warriors = join(dir, 'rounds');
  mkdirSync(warriors);
  writeFileSync(join(warriors, 'ldp.red'), ';name ldp\nldp.ab #0, flag\nsub.ab #2, flag\njmz.b die, flag\njmp 0\ndie dat 0, 0\nflag dat 0, 0\n');
  for (const f of ['dwarf.red', 'imp.red', 'seeker.red']) copyFileSync(join(root, 'warriors', f), join(warriors, f));
  const tournament = (name, rounds, args = []) => {
    const out = join(dir, `${name}.json`);
    const text = execFileSync(process.execPath, [join(root, 'tools/tournament.mjs'), warriors, '--rounds', String(rounds), '--jobs', '3', '--seed', '4',
      '--json', out, ...args], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
    return { ...JSON.parse(readFileSync(out, 'utf8')), text };
  };
  // round by round (--progress) and in blocks of 8 rounds: the same standings
  const byRound = tournament('by-round', 12, ['--progress']);
  const blocks = tournament('blocks', 12);
  assert.equal(byRound.progress.length, 12);
  assert.deepEqual(blocks.progress, byRound.progress);
  assert.equal((byRound.text.match(/^after round \d+:$/gm) ?? []).length, 12);
  for (const k of [1, 2, 9, 12]) assert.deepEqual(byRound.progress[k - 1], scores(tournament(`k${k}`, k)), `after round ${k}`);
});

test('tournament: the first warrior of a pairing starts with the registers w = s = 2, as in pMARS', () => {
  // `jmp s` jumps to the dat with s = 2 and loops with s = 0: sw loses every
  // round as the first warrior of a pairing (pmars sw.red other.red) and
  // ties as the second; checked against pMARS with --pmars --compare
  const warriors = join(dir, 'registers');
  mkdirSync(warriors);
  writeFileSync(join(warriors, 'a-wait.red'), ';name wait\njmp 0\n');
  writeFileSync(join(warriors, 'b-sw.red'), ';name sw\njmp s\njmp 0\ndat 0, 0\n');
  writeFileSync(join(warriors, 'c-wait.red'), ';name wait2\njmp 0\n');
  const t = run(2, 'registers', warriors);
  assert.deepEqual(pairings(t), [[[0, 0, 20], [0, 0, 20]], [[0, 0, 20], [0, 0, 20]], [[0, 20, 0], [20, 0, 0]]]);
});

// --pmars with a stand-in script: it answers from its -F position, so each
// pairing's result shows whether it reached the right pairing, and it logs
// its arguments. One file name has a space in it.
function fakePmars(name, body) {
  const p = join(dir, name);
  writeFileSync(p, `#!/bin/sh\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}

test('tournament: --pmars gives every pairing its own pMARS result', () => {
  const log = join(dir, 'pmars.log');
  const fake = fakePmars('fake-pmars.sh', `echo "$@" >> "${log}"
while [ $# -gt 2 ]; do case $1 in -F) pos=$2;; -r) r=$2;; esac; shift; done
echo "$((pos % 7)) $r"
echo "$((pos % 5)) 1"`);
  const warriors = join(dir, 'pmars-set');
  mkdirSync(warriors);
  for (const f of ['dwarf.red', 'imp.red']) copyFileSync(join(root, 'warriors', f), join(warriors, f));
  copyFileSync(join(root, 'warriors/dwarf.red'), join(warriors, 'my dwarf.red'));
  writeFileSync(join(warriors, 'wait.red'), ';name wait\njmp 0\n');
  const out = join(dir, 'pmars.json');
  execFileSync(process.execPath, [join(root, 'tools/tournament.mjs'), warriors, '--rounds', '7', '--jobs', '2',
    '--seed', '4', '--pmars', fake, '--json', out], { stdio: 'ignore' });
  const t = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(t.pairs.length, 6);
  const calls = readFileSync(log, 'utf8').trim().split('\n').sort();
  const want = t.pairs.map((p) => `-b -k -s 8000 -c 80000 -p 8000 -l 100 -d 100 -r 7 -F ${p.pos} ${t.files[p.a]} ${t.files[p.b]}`).sort();
  assert.deepEqual(calls, want);
  const table = execFileSync(process.execPath, [join(root, 'tools/tournament.mjs'), warriors, '--rounds', '7', '--jobs', '2',
    '--seed', '4', '--pmars', fake, '--matrix'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  // Score of row against column: 3 * wins + ties, as the stand-in answered.
  const width = Math.max(...t.names.map((s) => s.length));
  const lines = table.split('score of row against column:\n')[1].trimEnd().split('\n');
  const order = lines.map((l) => t.names.indexOf(l.slice(0, width).trimEnd()));
  const cell = (row, col) => Number(lines[order.indexOf(row)].slice(width + 1).trim().split(/\s+/)[order.indexOf(col)]);
  assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
  for (const p of t.pairs) {
    assert.equal(cell(p.a, p.b), 3 * (p.pos % 7) + 7, `${t.names[p.a]} against ${t.names[p.b]}`);
    assert.equal(cell(p.b, p.a), 3 * (p.pos % 5) + 1, `${t.names[p.b]} against ${t.names[p.a]}`);
  }
  // Wins, ties and losses per warrior in the ranking above the matrix.
  const sums = t.names.map(() => [0, 0, 0]);
  for (const p of t.pairs) {
    const [wa, wb] = [p.pos % 7, p.pos % 5];
    sums[p.a] = [sums[p.a][0] + wa, sums[p.a][1] + 7, sums[p.a][2] + wb];
    sums[p.b] = [sums[p.b][0] + wb, sums[p.b][1] + 1, sums[p.b][2] + wa];
  }
  const ranking = table.split('\n').slice(1, 5);
  for (const line of ranking) {
    const i = t.names.indexOf(line.slice(5, 5 + width).trimEnd());
    assert.deepEqual(line.slice(5 + width).trim().split(/\s+/).slice(2).map(Number), sums[i], line);
  }
});

test('tournament: --pmars stops on output it cannot read', () => {
  for (const [name, text] of [['error', 'Error: no such file'], ['short', '1 2']]) {
    const fake = fakePmars(`${name}-pmars.sh`, `echo "${text}"`);
    let err = '';
    assert.throws(() => {
      try {
        execFileSync(process.execPath, [join(root, 'tools/tournament.mjs'), join(root, 'warriors'), '--rounds', '2', '--pmars', fake],
          { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
      } catch (e) {
        err = e.stderr;
        throw e;
      }
    }, name);
    assert.match(err, new RegExp(`pMARS gave "\\d+ ${text}"`), name);
  }
});

test('tournament: --bench plays one warrior against each of the set, like its row of the round robin', () => {
  const tool = join(root, 'tools/tournament.mjs');
  const seeker = join(root, 'warriors/seeker.red');
  const opts = ['--rounds', '20', '--jobs', '3', '--seed', '4'];
  const rrFile = join(dir, 'rr.json');
  const benchFile = join(dir, 'bench.json');
  execFileSync(process.execPath, [tool, seeker, join(root, 'warriors'), ...opts, '--json', rrFile], { stdio: 'ignore' });
  const text = execFileSync(process.execPath, [tool, join(root, 'warriors'), '--bench', seeker, ...opts, '--json', benchFile],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const rr = JSON.parse(readFileSync(rrFile, 'utf8'));
  const bench = JSON.parse(readFileSync(benchFile, 'utf8'));
  const row = rr.pairs.map((p, k) => [p, rr.results[k]]).filter(([p]) => p.a === 0);
  assert.equal(bench.pairs.length, 5); // the 5 sample warriors, Seeker included
  assert.deepEqual(bench.pairs, row.map(([p]) => p));
  assert.deepEqual(bench.results, row.map(([, r]) => r));
  const scores = bench.opponents.map((o) => o.score);
  assert.deepEqual(scores, [...scores].sort((x, y) => x - y), 'worst opponent first');
  const sum = bench.results.reduce((s, r) => s + 3 * r.a[0] + r.a[2], 0);
  assert.equal(bench.total.score, sum);
  assert.match(text, new RegExp(`^total +${((100 * sum) / (20 * 5)).toFixed(1)} `, 'm'));
});
