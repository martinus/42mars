// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// tools/run-report.mjs (#195) on a small run of 2 islands on the tiny hill:
// the table of the islands, the 3 best of each, the line of best.red across
// islands, the new designs of tools/progress.js (RunDigest), all against the
// events read whole. What the evolver's test files share is in
// test/evolver-common.js; built with cc, or prebuilt in M42_BIN
// (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RunDigest, bestRedInfo, lineOf } from '../tools/progress.js';
import { kind as styleKind, shortKind } from '../tools/style.js';
import { setup, cleanup, root, tmp, skip, TINY, run, events } from './evolver-common.js';

before(() => setup({ base: false }));
after(cleanup);

// read in pieces of 4 KB, not 1 MB: lines across two reads, and longer ones (enter events) that grow the buffer
const report = (...args) => spawnSync(process.execPath, [join(root, 'tools/run-report.mjs'), ...args], { encoding: 'utf8', timeout: 120000, env: { ...process.env, RUN_REPORT_BUFFER: '4096' } });

// The run of the tests: 2 islands, a migrant every batch, scored every 3
// batches; with seed 2 the line of its best.red crosses from island 2 to 1.
let dir = null;
function islandRun() {
  if (!dir) {
    dir = join(tmp, 'report');
    run(dir, [...TINY.map((x, i, a) => (a[i - 1] === '--seed' ? '2' : x)), '--list', '16', '--survivors', '8', '--islands', '2', '--select-after', '3', '--score-rounds', '5',
      '--migrate', '1', '--migrate-pick', 'random', '--migrate-to', 'random', '--threads', '2', '--batches', '8']);
  }
  return dir;
}

// What the events of an island say, read whole: its last batch event, the
// members by enter and leave, the last values, the best bench, the enters.
function island(d, k) {
  const ev = events(join(d, `island-0${k}`));
  const enters = new Map(), alive = new Set();
  let values = null, holdout = -1;
  for (const e of ev) {
    if (e.type === 'enter') enters.set(e.id, e), alive.add(e.id);
    if (e.type === 'leave') alive.delete(e.id);
    if (e.type === 'values') values = e;
    if (e.type === 'bench') holdout = Math.max(holdout, e.avg);
  }
  const batch = ev.filter((e) => e.type === 'batch').at(-1);
  const members = values.values.filter((v) => alive.has(v[0])).sort((a, b) => b[5] - a[5] || a[0] - b[0]);
  return { ev, enters, batch, members, holdout, migrates: ev.filter((e) => e.type === 'migrate') };
}

// The opcodes of a code, in order, without ORG.
const opcodes = (code) => code.split('\n').map((l) => /^\s*([A-Z]+)\./.exec(l)?.[1]).filter(Boolean).join(' ');

test('run-report: the islands, their scores against the folder and the 3 best of each, from the events', { skip }, () => {
  const d = islandRun();
  const r = report(d);
  assert.equal(r.status, 0, r.stderr);
  const scores = events(d, 'islands.jsonl').filter((e) => e.type === 'score');
  assert.deepEqual(scores.map((s) => s.batch), [3, 6]);
  const lines = r.stdout.split('\n');
  const json = JSON.parse(report(d, '--json').stdout).runs[0];
  for (const k of [1, 2]) {
    const x = island(d, k);
    // the row: batch, list, the score at each score, the best of them (its batch), the best against the panel, the best against the holdout
    const row = lines.find((l) => l.startsWith(`island-0${k} `)).trim().split(/\s+/);
    const at = scores.map((s) => s.islands.find((i) => i.island === k).score);
    const best = Math.max(...at);
    assert.deepEqual(row, [`island-0${k}`, String(x.batch.batch), String(x.batch.members), ...at.map((s) => s.toFixed(1)),
      best.toFixed(1), `(${scores[at.indexOf(best)].batch})`, x.members[0][5].toFixed(1), x.holdout.toFixed(1)], `island ${k}`);
    // the progress of each batch: the best against the holdout so far, with the bench of that batch
    const benches = x.ev.filter((e) => e.type === 'bench');
    const want = x.ev.filter((e) => e.type === 'batch').map((b) => [b.batch, Math.max(-1, ...benches.filter((e) => e.batch <= b.batch).map((e) => e.avg))]);
    assert.ok(want.some(([b], i) => i && want[i - 1][1] !== want[i][1] && benches.some((e) => e.batch === b)), 'a bench in the run');
    assert.deepEqual(json.islands[k - 1].history.map((h) => [h.batch, h.holdout]), want);
    // the 3 best by panel average now, with their opcodes
    const top = json.onTop.members.filter((w) => w.island === k);
    assert.deepEqual(top.map((w) => [w.rank, w.id, w.opcodes]), x.members.slice(0, 3).map((v, i) => [i + 1, v[0], opcodes(x.enters.get(v[0]).code)]));
    for (const w of top) assert.ok(lines.some((l) => l.includes(` ${w.id}  ${x.enters.get(w.id).name} `)), `${w.name} in the table`);
  }
});

test('run-report: the line of best.red, back to where it came from across islands, with the changes of each step', { skip }, () => {
  const d = islandRun();
  const info = bestRedInfo(readFileSync(join(d, 'best.red'), 'latin1'));
  const isl = [null, island(d, 1), island(d, 2)];
  // the line from the events: first parents, a migrant on the island it came from, the warrior there with its code
  const want = [];
  for (let at = [info.island, info.id]; at;) {
    const e = isl[at[0]].enters.get(at[1]);
    want.push([at[0], e.id, e.batch, e.ops]);
    if (e.parents.length) at = [at[0], e.parents[0]];
    else if (e.ops === 'migrant') {
      const m = isl[at[0]].migrates.filter((x) => x.batch === e.batch).at(-1);
      at = m.from.find(([i, id]) => isl[i].enters.get(id)?.code === e.code);
    } else at = null;
  }
  want.reverse();
  const r = JSON.parse(report(d, '--json').stdout).runs[0];
  assert.deepEqual(r.line.map((s) => [s.island, s.id, s.batch, s.ops]), want);
  assert.ok(want.some((s, k) => k && s[0] !== want[k - 1][0]), 'the line of this run crosses islands');
  assert.ok(!r.line[0].missing && ['random', 'start'].includes(r.line[0].ops), r.line[0].ops);
  // the text: every step with --full, the name of best.red and the changes counted
  const text = report(d, '--full').stdout;
  const steps = text.slice(text.indexOf('The line of best.red'));
  for (const [i, id, batch, ops] of want) assert.match(steps, new RegExp(`\\n\\s+${batch}\\s+island-0${i}\\s+${id}\\s.*${ops.split(' ')[0]}`), `step ${id}`);
  const counts = new Map();
  for (const [, , , ops] of want.slice(1)) for (const op of ops.split(' ')) counts.set(op, (counts.get(op) ?? 0) + 1);
  const said = new Map([.../changes on the line: (.*)/.exec(steps)[1].matchAll(/([a-z-]+) (\d+)/g)].map((m) => [m[1], Number(m[2])]));
  assert.deepEqual(said, counts);
});

test('RunDigest: a family or kind of style is new the first time it holds a place among the 3 best for `hold` batches in a row', { skip }, () => {
  const d = islandRun();
  for (const k of [1, 2]) {
    const lines = readFileSync(join(d, `island-0${k}`, 'events.jsonl'), 'utf8').split('\n').filter(Boolean);
    // the 3 best after each batch, read whole: the designs of each
    const alive = new Map(), tops = [];
    for (const l of lines) {
      const e = JSON.parse(l);
      if (e.type === 'enter') alive.set(e.id, e);
      if (e.type === 'leave') alive.delete(e.id);
      if (e.type === 'values') {
        const top = e.values.filter((v) => alive.has(v[0])).sort((a, b) => b[5] - a[5] || a[0] - b[0]).slice(0, 3).map((v) => alive.get(v[0]));
        tops.push({ batch: e.batch, designs: top.flatMap((w) => [`family ${w.name.split(' ')[1]}`, `kind ${w.style.kind}`]) });
      }
    }
    for (const hold of [1, 2, 3]) {
      // a design is new at the batch it came in, once it was among them for hold batches in a row
      const want = [], seen = new Set();
      tops.forEach((t, i) => {
        for (const des of new Set(t.designs)) {
          if (seen.has(des) || i + 1 < hold || !tops.slice(i + 1 - hold, i + 1).every((u) => u.designs.includes(des))) continue;
          let s = i;
          while (s > 0 && tops[s - 1].designs.includes(des)) s--;
          seen.add(des);
          want.push(`${tops[s].batch} ${des}`);
        }
      });
      const digest = new RunDigest({ hold });
      for (const l of lines) digest.add(l);
      const got = digest.result().designs.map((x) => `${x.batch} ${x.new} ${x.new === 'family' ? x.family : x.kind}`);
      assert.deepEqual(got.sort(), want.sort(), `island ${k}, hold ${hold}`);
      if (hold === 1) assert.ok(want.length >= 3, 'the test sees designs');
    }
  }
});

test('lineOf: first parents, a migrant on the island it came from by the hash of its code, a warrior not known', () => {
  // [id, first parent, second parent, batch, ops, name, kind, opcodes, panel average, hash, migrate candidates]
  const rows = {
    1: [[5, -1, -1, 0, 'random', 'Odd Owl', 'k', 'MOV', 1, 11, null], [9, 5, 7, 2, 'insert', 'Shy Owl', 'k', 'MOV SPL', 2, 12, null]],
    2: [[3, -1, -1, 3, 'migrant', 'Shy Owl', 'k', 'MOV SPL', 3, 12, [[3, 4], [1, 9], [1, 5]]], [6, 3, -1, 4, 'delete', 'Big Owl', 'k', 'SPL', 4, 13, null]],
    3: [[4, -1, -1, 1, 'random', 'Red Ant', 'k', 'DAT', 5, 14, null]],
  };
  const warrior = (i, id) => rows[i]?.find((w) => w[0] === id);
  const line = (i, id) => lineOf(warrior, i, id).map((s) => (s.missing ? `${s.island}:${s.id}?` : `${s.island}:${s.id} ${s.ops} ${s.family}`));
  assert.deepEqual(line(2, 6), ['1:5 random Owl', '1:9 insert Owl', '2:3 migrant Owl', '2:6 delete Owl']);
  rows[1][1][1] = 8; // a first parent not known
  assert.deepEqual(line(2, 6), ['1:8?', '1:9 insert Owl', '2:3 migrant Owl', '2:6 delete Owl']);
  rows[2][0][10] = [[3, 4]]; // the only one sent, also when its code differs (its warrior had left)
  assert.deepEqual(line(2, 3), ['3:4 random Ant', '2:3 migrant Owl']);
  rows[2][0][10] = [[3, 4], [1, 5]]; // none with its code: a step not known, with the candidates
  assert.deepEqual(line(2, 3), ['null:null?', '2:3 migrant Owl']);
  assert.deepEqual(lineOf(warrior, 2, 3)[0], { island: null, id: null, missing: true, ambiguous: false, from: [[3, 4], [1, 5]] });
});

// The islands of a folder from hand-written events, as RunDigest reads them:
// migrants and the warriors their migrate events sent.
function digests(islands) {
  const code = (op) => `        ORG     0\n        ${op}.I   $0, $1\n`;
  const out = {};
  for (const [k, evs] of Object.entries(islands)) {
    const d = new RunDigest();
    for (const e of evs) {
      const line = e.type === 'enter' ? { type: 'enter', batch: e.batch, id: e.id, name: `Odd ${e.family ?? 'Owl'}`, parents: e.parents ?? [], ops: e.ops ?? 'random', length: 1, style: { kind: 'k' }, code: code(e.op), scores: [] } : e;
      d.add(JSON.stringify(line));
    }
    out[k] = new Map(d.result().warriors.map((w) => [w[0], w]));
  }
  return (i, id) => out[i]?.get(id);
}

test('lineOf: a migrant comes from the first warrior of its migrate event with its code that was a member then; else a step not known, ambiguous where a warrior before it is not known', () => {
  const batch = (b) => ({ type: 'batch', batch: b, members: 1 });
  const migrant = (b, id, from, op = 'SPL') => [{ type: 'migrate', batch: b, from }, { type: 'enter', batch: b, id, ops: 'migrant', op }, batch(b)];
  const warrior = digests({
    // islands 1 and 2 have a warrior with the same code; 11 of island 1 leaves in batch 1, 12 enters in batch 2
    1: [{ type: 'enter', batch: 0, id: 10, op: 'SPL' }, { type: 'enter', batch: 0, id: 11, op: 'MOV', family: 'Ant' }, batch(0),
      { type: 'leave', batch: 1, id: 11 }, batch(1), { type: 'enter', batch: 2, id: 12, op: 'MOV', family: 'Ant' }, batch(2)],
    2: [{ type: 'enter', batch: 0, id: 20, op: 'SPL', family: 'Yak' }, { type: 'enter', batch: 0, id: 21, op: 'MOV', family: 'Yak' }, batch(0)],
    3: migrant(1, 30, [[2, 20], [1, 10]]), // both have its code: the first sent
    4: migrant(1, 40, [[1, 10], [2, 20]]),
    5: migrant(2, 50, [[1, 11], [1, 12], [2, 21]], 'MOV'), // 11 left in batch 1, 12 came in batch 2: 21
    6: migrant(1, 60, [[1, 11], [2, 21]], 'MOV'), // 11 still a member in batch 1, until it left
    7: migrant(2, 70, [[1, 10], [2, 20]], 'DAT'), // none with its code
    8: migrant(2, 80, [[2, 99], [1, 10]]), // 99 not known: it may have had the code
  });
  const first = (i, id) => {
    const s = lineOf(warrior, i, id)[0];
    return s.missing ? `${s.ambiguous ? 'ambiguous' : 'missing'} ${JSON.stringify(s.from)}` : `${s.island}:${s.id} ${s.family}`;
  };
  assert.equal(first(3, 30), '2:20 Yak');
  assert.equal(first(4, 40), '1:10 Owl');
  assert.equal(first(5, 50), '2:21 Yak');
  assert.equal(first(6, 60), '1:11 Ant');
  assert.equal(first(7, 70), 'missing [[1,10],[2,20]]');
  assert.equal(first(8, 80), 'ambiguous [[2,99],[1,10]]');
  assert.equal(lineOf(warrior, 8, 80).length, 2);
});

test('run-report --bench: best.red and the 3 best of each island against a folder, as tournament.mjs --bench plays each', { skip }, () => {
  const d = islandRun();
  const opponents = join(tmp, 'bench-opponents');
  mkdirSync(opponents);
  for (const f of readdirSync(join(root, 'warriors/koenigstuhl/tiny')).sort().slice(0, 6)) copyFileSync(join(root, 'warriors/koenigstuhl/tiny', f), join(opponents, f));
  const r = report(d, '--bench', '--opponents', opponents, '--rounds', '6', '--jobs', '2', '--json');
  assert.equal(r.status, 0, r.stderr);
  const b = JSON.parse(r.stdout).bench[0];
  // the folder's best.red, then of each island its best.red and its 3 best by panel average
  assert.deepEqual(b.warriors.map((w) => [w.island, w.what]), [[0, 'best.red'], ...[1, 2].flatMap((k) => [[k, 'best.red'], [k, 'panel #1'], [k, 'panel #2'], [k, 'panel #3']])]);
  const rules = ['--size', '800', '--cycles', '2000', '--processes', '800', '--length', '20', '--distance', '20', '--rounds', '6', '--jobs', '2'];
  const alone = (file) => {
    const t = spawnSync(process.execPath, [join(root, 'tools/tournament.mjs'), opponents, ...rules, '--bench', file, '--json', join(tmp, 'bench.json')], { encoding: 'utf8', timeout: 120000 });
    assert.equal(t.status, 0, t.stderr);
    const { total } = JSON.parse(readFileSync(join(tmp, 'bench.json'), 'utf8'));
    return [total.w, total.l, total.t, total.per100];
  };
  const panel = b.warriors.find((w) => w.island === 2 && w.what === 'panel #2');
  const code = island(d, 2).enters.get(panel.id).code;
  writeFileSync(join(tmp, 'panel.red'), `;redcode\n;name ${panel.name}\n${code}`);
  for (const [w, file] of [[b.warriors[0], join(d, 'best.red')], [b.warriors[1], join(d, 'island-01', 'best.red')], [panel, join(tmp, 'panel.red')]]) {
    assert.deepEqual([w.w, w.l, w.t, w.per100], alone(file), `${w.what} of ${w.island}`);
  }
});

// A run without islands in a few events, written here: what the digest keeps
// of warriors that came and went in their batch, and a last line being written.
function smallRun() {
  const d = join(tmp, 'small');
  mkdirSync(d, { recursive: true });
  const code = (op) => `        ORG     0\n        ${op}.I   $0, $1\n        DAT.F   $0, $0\n`;
  const enter = (batch, id, parents, ops, op, kind) => ({ type: 'enter', batch, id, name: `Odd Owl${id}`, parents, ops, length: 2, screen: 1, style: { kind }, code: code(op), gen: `L0: ${op}.I $0, $1\n`, scores: [[0, 1, 2, 3, 4]] });
  const ev = [
    { type: 'start', version: '1', rules: { size: 800, cycles: 2000, processes: 800, length: 20, distance: 20 }, params: { seed: 1 }, opponents: 'tiny', panel: [{ id: 0 }] },
    enter(0, 10, [], 'random', 'MOV', 'paper'), // stays
    enter(0, 11, [], 'random', 'SPL', 'paper'), // leaves in its batch, comes back later as the parent of 14
    enter(0, 12, [10], 'opcode', 'JMP', 'stone'), // leaves in its batch, no children: nobody's ancestor
    enter(0, 13, [], 'random', 'ADD', 'stone'), // leaves in its batch after its child 15 entered
    enter(0, 15, [13], 'insert', 'SUB', 'stone'),
    { type: 'leave', batch: 0, id: 11 }, { type: 'leave', batch: 0, id: 12 }, { type: 'leave', batch: 0, id: 13 },
    { type: 'values', batch: 0, values: [[0, 1, 1, 1, 1, 99], [10, 1, 1, 1, 1, 50], [15, 1, 1, 1, 1, 40]] },
    { type: 'batch', batch: 0, members: 2 },
    enter(1, 14, [11], 'reintroduce', 'SPL', 'scanner'),
    { type: 'values', batch: 1, values: [[0, 1, 1, 1, 1, 99], [10, 1, 1, 1, 1, 50], [14, 1, 1, 1, 1, 60], [15, 1, 1, 1, 1, 45]] },
    { type: 'bench', batch: 1, id: 14, rounds: 100, avg: 70, scores: [] }, // as 42evolve writes it: after the values
    { type: 'batch', batch: 1, members: 3 },
  ];
  writeFileSync(join(d, 'events.jsonl'), `${ev.map((e) => JSON.stringify(e)).join('\n')}\n{"type":"enter","batch":2,"id":16,"na`);
  writeFileSync(join(d, 'best.red'), `;redcode\n;name Odd Owl14\n;strategy evolved, warrior 14 of run seed 1, batch 1\n;strategy 70.0 against 8 holdout warriors, 60.0 against the panel\n${code('SPL')}`);
  return d;
}

test('RunDigest: keeps the warriors that can be ancestors; run-report reads a run without islands and leaves out a line being written', () => {
  const d = smallRun();
  const digest = new RunDigest();
  for (const l of readFileSync(join(d, 'events.jsonl'), 'utf8').split('\n').slice(0, -1)) digest.add(l);
  const r = digest.result();
  // 12 came and went without children; 11 came back as a parent, 13 had a child before it left
  assert.deepEqual(r.warriors.map((w) => w[0]).sort(), [10, 11, 13, 14, 15]);
  assert.deepEqual(r.top.map((t) => t.slice(4)), [[10, 15, -1], [14, 10, 15]]);
  // the holdout of a batch with its bench, as the dashboard's progressPoint() takes it at the batch event
  assert.deepEqual(r.top.map((t) => t.slice(0, 4)), [[0, 50, 45, -1], [1, 60, (60 + 50 + 45) / 3, 70]]);
  assert.deepEqual(r.now.map((w) => [w.id, w.opcodes, w.code.includes('SPL.I')]), [[14, 'SPL DAT', true], [10, 'MOV DAT', false], [15, 'SUB DAT', false]]);
  assert.deepEqual([r.batch, r.members, r.holdout], [1, 3, { id: 14, avg: 70, batch: 1 }]);
  const out = report(d, '--json');
  assert.equal(out.status, 0, out.stderr);
  const j = JSON.parse(out.stdout).runs[0];
  assert.deepEqual(j.line.map((s) => [s.island, s.id, s.ops]), [[0, 11, 'random'], [0, 14, 'reintroduce']]);
  assert.deepEqual(j.islands.map((x) => [x.island, x.batch, x.panel, x.holdout.avg]), [[0, 1, 60, 70]]);
  const text = report(d).stdout;
  assert.match(text, /^run\s+1\s+3\s+60\.0\s+70\.0$/m);
  assert.match(text, /The line of best\.red \(Odd Owl14\): 1 steps back to random Odd Owl11 in batch 0\./);
  // a buffer size that is no positive number: the default (0 read nothing, and doubled stayed 0)
  for (const size of ['0', '', 'x']) {
    const z = spawnSync(process.execPath, [join(root, 'tools/run-report.mjs'), d, '--json'], { encoding: 'utf8', timeout: 30000, env: { ...process.env, RUN_REPORT_BUFFER: size } });
    assert.equal(z.status, 0, `RUN_REPORT_BUFFER=${size}: ${z.stderr}`);
    assert.equal(z.stdout, out.stdout, `RUN_REPORT_BUFFER=${size}`);
  }
  // a folder of islands in the order of their numbers, not of their names
  const many = join(tmp, 'many');
  for (const k of [2, 10, 100]) {
    mkdirSync(join(many, `island-${String(k).padStart(2, '0')}`), { recursive: true });
    copyFileSync(join(d, 'events.jsonl'), join(many, `island-${String(k).padStart(2, '0')}`, 'events.jsonl'));
  }
  writeFileSync(join(many, 'islands.txt'), '42evolve-islands 1\n');
  assert.deepEqual(JSON.parse(report(many, '--json').stdout).runs[0].islands.map((x) => x.island), [2, 10, 100]);
  // --bench on a run without islands: its best.red is the run's, not a folder's
  const opponents = join(tmp, 'small-opponents');
  mkdirSync(opponents, { recursive: true });
  for (const f of readdirSync(join(root, 'warriors/koenigstuhl/tiny')).sort().slice(0, 2)) copyFileSync(join(root, 'warriors/koenigstuhl/tiny', f), join(opponents, f));
  const bench = report(d, '--bench', '--opponents', opponents, '--rounds', '2', '--jobs', '1');
  assert.equal(bench.status, 0, bench.stderr);
  assert.match(bench.stdout, /^run\s+best\.red\s+14\s/m);
  assert.doesNotMatch(bench.stdout, /^folder/m);
});

test('run-report: a wrong or missing argument prints the usage and exits with 2', () => {
  const d = smallRun();
  for (const args of [[], ['--json'], [join(root, 'warriors')], [join(root, 'no-such-folder')], [d, '--rounds'], [d, '--rounds', '0'], [d, '--frobnicate'], [d, '--bench'], [d, '--opponents', tmp]]) {
    const r = report(...args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /usage: node tools\/run-report\.mjs/, args.join(' '));
  }
});

test('shortKind: a word of its own for every kind of style', () => {
  const s = { measured: 1, copies: 0, moved: 0, written: 0, whole: 0, read: 0, tasks: 1 };
  const styles = [{ ...s, measured: 0 }, { ...s, copies: 20, moved: 20, tasks: 250 }, { ...s, copies: 20, moved: 20 }, { ...s, read: 50 },
    { ...s, copies: 20 }, { ...s, written: 100, whole: 0.5 }, { ...s, written: 100 }, s];
  const kinds = styles.map(styleKind), words = kinds.map(shortKind);
  assert.equal(new Set(kinds).size, styles.length);
  assert.equal(new Set(words).size, styles.length);
  for (const [k, w] of kinds.map((x, i) => [x, words[i]])) assert.match(w, /^[a-z]+$/, k);
  assert.equal(shortKind(undefined), '');
});

test('run-report --at: the scores of those batches in that order, – where an island has none, and the best and the mean of the islands', { skip }, () => {
  const d = islandRun();
  const r = report(d, '--at', '6,99,3');
  assert.equal(r.status, 0, r.stderr);
  const scores = new Map(events(d, 'islands.jsonl').filter((e) => e.type === 'score').map((s) => [s.batch, s.islands.map((i) => i.score)]));
  const lines = r.stdout.split('\n');
  assert.deepEqual(lines.find((l) => l.startsWith('island ')).trim().split(/\s+/).slice(3, 6), ['b6', 'b99', 'b3']);
  for (const k of [1, 2]) {
    const row = lines.find((l) => l.startsWith(`island-0${k} `)).trim().split(/\s+/);
    assert.deepEqual(row.slice(3, 6), [scores.get(6)[k - 1].toFixed(1), '–', scores.get(3)[k - 1].toFixed(1)], `island ${k}`);
  }
  const summary = (name) => lines.find((l) => l.startsWith(`${name} `)).trim().split(/\s+/).slice(1);
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  assert.deepEqual(summary('best'), [Math.max(...scores.get(6)).toFixed(1), '–', Math.max(...scores.get(3)).toFixed(1)]);
  assert.deepEqual(summary('mean'), [mean(scores.get(6)).toFixed(1), '–', mean(scores.get(3)).toFixed(1)]);
  const bad = report(d, '--at', '3,x');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--at needs batches/);
});
