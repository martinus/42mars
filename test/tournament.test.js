// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'tournament-test-'));

function run(engine, seed, name, warriors = join(root, 'warriors')) {
  const out = join(dir, `${name}.json`);
  execFileSync(process.execPath, [join(root, 'tools/tournament.mjs'), warriors,
    '--rounds', '20', '--jobs', '3', '--seed', String(seed), '--engine', engine, '--json', out], { stdio: 'ignore' });
  return JSON.parse(readFileSync(out, 'utf8'));
}

const pairings = (t) => t.results.map((r) => [r.a, r.b]);

test('tournament: js and wasm engines give the same result for every pairing', () => {
  const js = run('js', 5, 'js');
  const wasm = run('wasm', 5, 'wasm');
  assert.equal(js.pairs.length, 10); // 5 sample warriors
  assert.deepEqual(js.pairs, wasm.pairs);
  assert.deepEqual(pairings(js), pairings(wasm));
  for (const [a, b] of pairings(js)) {
    assert.equal(a[0] + a[1] + a[2], 20);
    assert.deepEqual([a[0], a[1], a[2]], [b[1], b[0], b[2]]);
  }
  assert.deepEqual(js.ranking.map((r) => [r.name, r.score]), wasm.ranking.map((r) => [r.name, r.score]));
});

test('tournament: the same seed gives the same results, another seed other positions', () => {
  const a = run('wasm', 9, 'a');
  const b = run('wasm', 9, 'b');
  const c = run('wasm', 10, 'c');
  assert.deepEqual(pairings(a), pairings(b));
  assert.deepEqual(a.pairs, b.pairs);
  assert.notDeepEqual(a.pairs.map((p) => p.pos), c.pairs.map((p) => p.pos));
});

// With few pairings per job the wasm engine splits each pairing without LDP
// into blocks of rounds on several workers (10 and 3 pairings with 3 jobs
// here, so the tests above split too). A warrior with LDP sees the last
// result of the round before, so its pairings must stay whole: this one
// dies right after a tied round.
test('tournament: pairings with LDP are not split into blocks of rounds', () => {
  const warriors = join(dir, 'ldp');
  mkdirSync(warriors);
  writeFileSync(join(warriors, 'ldp.red'), ';name ldp\nldp.ab #0, flag\nsub.ab #2, flag\njmz.b die, flag\njmp 0\ndie dat 0, 0\nflag dat 0, 0\n');
  writeFileSync(join(warriors, 'wait.red'), ';name wait\njmp 0\n');
  copyFileSync(join(root, 'warriors/dwarf.red'), join(warriors, 'dwarf.red'));
  const js = run('js', 3, 'ldp-js', warriors);
  const wasm = run('wasm', 3, 'ldp-wasm', warriors);
  assert.equal(js.pairs.length, 3);
  assert.deepEqual(pairings(wasm), pairings(js));
  // ldp against wait: a tie, then a loss, and so on.
  const k = js.pairs.findIndex((p) => [js.names[p.a], js.names[p.b]].sort().join() === 'ldp (ldp.red),wait (wait.red)');
  assert.deepEqual([...js.results[k].a].sort(), [0, 10, 10]);
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
