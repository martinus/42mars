// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// its C unit test (test/c/evolver-test.c), the same run on any number of threads and after a resume, the logged values, matches, names and styles, and the smaller options. What the evolver's test files share is in
// test/evolver-common.js; built with cc, or prebuilt in M42_BIN
// (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { paretoFronts, pushoffValues, sdDistance, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { bestRedInfo } from '../tools/progress.js';
import { setup, cleanup, root, tmp, evolve, unit, spectrum, skip, RULES, TINY, run, events, without, stable, base, checkValues, checkOrder, checkOps, checkEarly, mirrored, CLASSIC, RULES_CLASSIC, classic } from './evolver-common.js';

before(setup);
after(cleanup);

test('genome and push-off in C', { skip }, () => {
  const r = spawnSync(unit, { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'ok');
});

test('the same seed gives the same run on 1 and 4 threads, and after a resume', { skip }, () => {
  run(join(tmp, 'four'), [...TINY, '--threads', '4', '--batches', '6']);
  assert.deepEqual(stable(events(join(tmp, 'four'))), stable(base));
  run(join(tmp, 'resumed'), [...TINY, '--threads', '3', '--batches', '2']);
  // the state as 42evolve wrote it before --select and --rotate: runs started
  // then continue the same way
  const file = join(tmp, 'resumed', 'state.txt');
  const state = readFileSync(file, 'latin1');
  const old = state.replace(/^(params( \S+){15})( \S+)+$/m, '$1').replace(/^panel-id \d+ /gm, 'panel ')
    .replace(/^(reserve|reserve-next|rotate-next|slot|changes) .*\n/gm, '');
  assert.notEqual(old, state);
  assert.doesNotMatch(old, /^(reserve|panel-id)/m);
  writeFileSync(file, old);
  // and it was cut off while it wrote the next batch: the events go back to where the state was written
  appendFileSync(join(tmp, 'resumed', 'events.jsonl'), '{"type":"enter","batch":2,"id":99999}\n{"type":"enter","ba');
  run(join(tmp, 'resumed'), ['--threads', '2', '--batches', '4']);
  const resumed = events(join(tmp, 'resumed'));
  assert.equal(resumed.filter((e) => e.type === 'resume').length, 1);
  assert.deepEqual(stable(resumed), stable(base));
  // a run with another seed is another run
  run(join(tmp, 'other'), [...TINY, '--seed', '8', '--threads', '4', '--batches', '2']);
  assert.notDeepEqual(stable(events(join(tmp, 'other'))).slice(0, 4), stable(base).slice(0, 4));
});

test('a run folder takes no new evolution options', { skip }, () => {
  const r = spawnSync(evolve, [join(tmp, 'one'), '--rounds', '50'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /only --threads, --batches, --seconds, --changes, --reintroduce, --list \(larger\), --screen-stop and --screen-check go/);
  assert.equal(spawnSync(evolve, [join(tmp, 'none')], { encoding: 'utf8' }).status, 2); // no --opponents
});

// The options removed after 1.1.0 (#193): what the command line gave, and the
// option's place in the params line of a state (none: it is in another line)
const REMOVED = [
  { args: ['--map-elites'], option: '--map-elites', at: 29 },
  { args: ['--niche', '2'], option: '--niche', at: 28 },
  { args: ['--specialists'], option: '--specialists', at: 30 },
  { args: ['--sharing', '20'], option: '--sharing', at: 31 },
  { args: ['--simple'], option: '--simple', at: 37 },
  { args: ['--noise', '1'], option: '--noise', at: 23 },
  { args: ['--difference', 'ahead'], option: '--difference', at: 39 },
  { args: ['--select', 'value'], option: '--select', at: 15 },
  { args: ['--rotate', '2'], option: '--rotate', at: 16 },
  { args: ['--race', '3'], option: '--race', at: 18 },
  { args: ['--race-keep', '6'], option: '--race-keep' },
  { args: ['--tune-novel', '1'], option: '--tune-novel', at: 34 },
  { args: ['--fractions', '0.5'], option: '--fractions', at: 17 },
  { args: ['--prior', 'hill'], option: '--prior', at: 20 },
  { args: ['--refactor', '0.5'], option: '--refactor', at: 44 },
  { args: ['--changes', 'insert=1,loop=1'], option: '--changes loop' },
  { args: ['--migrate-to', 'next'], option: '--migrate-to next' },
  { args: ['--migrate-to', 'tree'], option: '--migrate-to tree' },
  { args: ['--leaf-restart', '4'], option: '--leaf-restart' },
  { args: ['--nemesis-every', '4'], option: '--nemesis-every' },
  { args: ['--pushoff', 'pareto-age'], option: '--pushoff pareto-age', at: 40, value: '2' },
];
// and the lines of a state that only they wrote
const REMOVED_LINES = [
  { line: 'tuned 30 1 1 0 0 0 0 0 0 0 0 0', option: '--tune-novel' }, // the warrior it tuned, waiting for the next batch
  { line: 'changes insert=1,loop=1', option: '--changes loop' },
];

test('a removed option is refused on the command line, in an island variant, and in the state of a run that used it (#193)', { skip }, () => {
  for (const { args, option } of REMOVED) {
    const r = spawnSync(evolve, [join(tmp, 'removed'), ...TINY, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 2, option);
    assert.equal(r.stderr, `42evolve: ${option} was removed after 1.1.0 (#193)\n`);
    const v = spawnSync(evolve, [join(tmp, 'removed'), ...TINY, '--islands', '2', '--island-variant', args.join(' ')], { encoding: 'utf8' });
    assert.equal(v.status, 2, option);
    assert.equal(v.stderr, `42evolve: ${option} was removed after 1.1.0 (#193)\n`);
  }
  assert.ok(!existsSync(join(tmp, 'removed')));
  // the run folder of the base run, with the place of the option in its state not 0
  const state = readFileSync(join(tmp, 'one', 'state.txt'), 'latin1');
  for (const { option, at, value } of REMOVED.filter((x) => x.at !== undefined)) {
    const dir = join(tmp, `removed-${at}`);
    mkdirSync(dir);
    copyFileSync(join(tmp, 'one', 'events.jsonl'), join(dir, 'events.jsonl'));
    const params = state.match(/^params (.*)$/m)[1].split(' ');
    assert.equal(params[at], '0', option);
    params[at] = value ?? '1';
    writeFileSync(join(dir, 'state.txt'), state.replace(/^params .*$/m, `params ${params.join(' ')}`));
    const r = spawnSync(evolve, [dir, '--batches', '1'], { encoding: 'utf8' });
    assert.equal(r.status, 1, option);
    assert.equal(r.stderr, `42evolve: ${dir}: ${option} was removed after 1.1.0 (#193)\n`);
    assert.equal(readFileSync(join(dir, 'events.jsonl'), 'latin1'), readFileSync(join(tmp, 'one', 'events.jsonl'), 'latin1'));
  }
  // the lines of a state that only a removed option wrote
  for (const [k, { line, option }] of REMOVED_LINES.entries()) {
    const dir = join(tmp, `removed-line-${k}`);
    mkdirSync(dir);
    copyFileSync(join(tmp, 'one', 'events.jsonl'), join(dir, 'events.jsonl'));
    writeFileSync(join(dir, 'state.txt'), state.replace(/^end$/m, `${line}\nend`));
    const r = spawnSync(evolve, [dir, '--batches', '1'], { encoding: 'utf8' });
    assert.equal(r.status, 1, option);
    assert.equal(r.stderr, `42evolve: ${dir}: ${option} was removed after 1.1.0 (#193)\n`);
  }
  // the islands.txt of a run of islands that used one, as 42evolve wrote it before: migrate M, pick, to (1 next, 3 tree),
  // --leaf-restart; --nemesis-every; the batch each island started at
  for (const [k, [migrate, nemesis, since, option]] of [['2 1 1 0', 0, '0 0', '--migrate-to next'], ['2 0 3 0', 0, '0 0', '--migrate-to tree'],
    ['2 0 3 4', 0, '0 0', '--migrate-to tree'], ['2 1 2 4', 0, '0 0', '--leaf-restart'], ['1 1 2 0', 4, '0 0', '--nemesis-every'],
    ['1 1 2 0', 0, '0 4', '--nemesis-every']].entries()) {
    const dir = join(tmp, `removed-islands-${k}`);
    mkdirSync(dir);
    writeFileSync(join(dir, 'islands.txt'), `42evolve-islands 1\nislands 2 0 0 0 0 7 -1 100\nlive 1 1\nmigrate ${migrate}\nnemesis ${nemesis}\nsince ${since}\nexplorers 0\n`);
    const r = spawnSync(evolve, [dir, '--batches', '1'], { encoding: 'utf8' });
    assert.equal(r.status, 1, option);
    assert.equal(r.stderr, `42evolve: ${dir}: ${option} was removed after 1.1.0 (#193)\n`);
  }
});

// A member line that does not parse, and a member whose slot is taken: the
// state is refused and the member freed (under the sanitizers of CI a member
// left behind is a leak report and another exit code).
test('a state with a bad member line is refused, and the member freed', { skip }, () => {
  const state = readFileSync(join(tmp, 'one', 'state.txt'), 'latin1');
  const slots = [...state.matchAll(/^slot (\d+) (\d+)$/gm)];
  assert.ok(slots.length >= 2);
  const cases = [
    state.replace(/^(member (?:\S+ ){8})\S.*$/m, '$1x'), // its genome
    state.replace(`slot ${slots[1][1]} ${slots[1][2]}`, `slot ${slots[1][1]} ${slots[0][2]}`), // the slot of the first member
  ];
  for (const [k, text] of cases.entries()) {
    assert.notEqual(text, state);
    const dir = join(tmp, `bad-member-${k}`);
    mkdirSync(dir);
    copyFileSync(join(tmp, 'one', 'events.jsonl'), join(dir, 'events.jsonl'));
    writeFileSync(join(dir, 'state.txt'), text);
    const r = spawnSync(evolve, [dir, '--batches', '1'], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stderr);
    assert.equal(r.stderr, `42evolve: ${dir}/state.txt is not a state file of this version\n`);
  }
});

test('the logged values are the push-off of the logged scores', { skip }, () => {
  assert.equal(checkValues(base), 6);
});

test('survivors of the screen enter by their screen score', { skip }, () => {
  assert.equal(checkOps(base), 6);
  checkOrder(base, 'screen');
});

test('the logged screen points are those of the WebAssembly engine, with the logged seeds', { skip }, () => {
  const st = base[0], m = createMarsSync(RULES);
  const sources = new Map(st.panel.map((w) => [w.id, w.source]));
  let replayed = 0;
  for (const e of base.filter((x) => x.type === 'enter' && x.batch > 0).slice(0, 6)) {
    const a = assemble(`;name x\n${e.code}`, RULES);
    for (const k of [0, 3, 7]) {
      const p = st.panel[k];
      const r = m.runMatch([a, assemble(sources.get(p.id), RULES)], { seed: e.scores.find((x) => x[0] === p.id)[4], rounds: st.params.screenRounds });
      const pts = ((3 * r.warriors[0].wins + r.warriors[0].ties) * 100) / st.params.screenRounds;
      assert.ok(Math.abs(pts - e.screenPoints[k]) < 1e-3, `${e.name} against ${p.name}: ${pts}, logged ${e.screenPoints[k]}`);
      replayed++;
    }
  }
  assert.equal(replayed, 18);
});

test('--parents duel: a parent beat its rival in their match, the same run on any thread count', { skip }, () => {
  assert.equal(base[0].params.parents, 'value');
  const args = [...CLASSIC, '--parents', 'duel'];
  run(join(tmp, 'duel1'), [...args, '--threads', '1', '--batches', '6']);
  const one = events(join(tmp, 'duel1'));
  assert.equal(one[0].params.parents, 'duel');
  assert.equal(checkValues(one), 6);
  run(join(tmp, 'duel3'), [...args, '--threads', '3', '--batches', '6']);
  assert.deepEqual(stable(events(join(tmp, 'duel3'))), stable(one));
});

test('--changes: only the changes named, as often as their weights, the same run on any thread count and after a resume', { skip }, () => {
  const def = { opcode: 81, modifier: 81, 'a-mode': 54, 'b-mode': 54, 'a-operand': 108, 'b-operand': 108, org: 27, replace: 27, insert: 100, delete: 100,
    duplicate: 70, move: 70, 'crossover-insert': 60, 'crossover-replace': 60, 'related-opcode': 0, 'related-mode': 0, 'shared-constant': 0, tune: 0 };
  assert.deepEqual(base[0].changes, def);
  const args = [...TINY, '--changes', 'shared-constant=6,duplicate=1,b-operand=3'];
  run(join(tmp, 'mix1'), [...args, '--threads', '1', '--batches', '5']);
  const one = events(join(tmp, 'mix1'));
  assert.deepEqual(one[0].changes, { ...Object.fromEntries(Object.keys(def).map((k) => [k, 0])), 'shared-constant': 6, duplicate: 1, 'b-operand': 3 });
  const n = {};
  for (const b of one.filter((e) => e.type === 'batch')) for (const [op, [bred]] of Object.entries(b.ops)) n[op] = (n[op] ?? 0) + bred;
  assert.deepEqual(Object.keys(n).filter((k) => !['random', 'reintroduce'].includes(k)).sort(), ['b-operand', 'duplicate', 'shared-constant']);
  assert.ok(n['shared-constant'] > n['b-operand'] && n['b-operand'] > n.duplicate, JSON.stringify(n));
  assert.equal(checkOps(one), 5);
  assert.equal(checkValues(one), 5);
  run(join(tmp, 'mix-resumed'), [...args, '--threads', '2', '--batches', '2']);
  assert.match(readFileSync(join(tmp, 'mix-resumed', 'state.txt'), 'latin1'), /^changes b-operand=3,duplicate=1,shared-constant=6$/m);
  run(join(tmp, 'mix-resumed'), ['--threads', '4', '--batches', '3']);
  assert.deepEqual(stable(events(join(tmp, 'mix-resumed'))), stable(one));
  // a run that continues takes new weights: from then on only those changes,
  // in the state too; the batches before are those of the run without them
  run(join(tmp, 'mix-switch'), [...args, '--threads', '2', '--batches', '2']);
  run(join(tmp, 'mix-switch'), ['--threads', '2', '--batches', '3', '--changes', 'insert=1']);
  run(join(tmp, 'mix-switch'), ['--threads', '3', '--batches', '1']);
  const sw = events(join(tmp, 'mix-switch'));
  const at = sw.findIndex((e) => e.type === 'changes');
  assert.ok(at > 0 && sw[at].changes === 'insert=1' && sw[at].batch === 2, JSON.stringify(sw[at]));
  const after = {};
  for (const b of sw.slice(at).filter((e) => e.type === 'batch')) for (const [op, [bred]] of Object.entries(b.ops)) after[op] = (after[op] ?? 0) + bred;
  assert.deepEqual(Object.keys(after).filter((k) => !['random', 'reintroduce'].includes(k)), ['insert']);
  assert.equal(sw.filter((e) => e.type === 'batch').length, 6);
  assert.match(readFileSync(join(tmp, 'mix-switch', 'state.txt'), 'latin1'), /^changes insert=1$/m);
  const before = stable(sw.slice(0, at));
  assert.deepEqual(before, stable(one).slice(0, before.length));
  const bad = spawnSync(evolve, [join(tmp, 'mix-bad'), ...TINY, '--changes', 'opcode=1,tunes=2'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--changes takes name=weight.* shared-constant tune$/m);
});

test('--panel-files, --screen-members: a chosen panel, a screen against panel and members, the same run on any thread count and after a resume', { skip }, () => {
  const files = ['afterstorm.red', '3pc.red', 'ak47t.red'];
  const args = [...TINY, '--panel-files', files.join(','), '--screen-members', '4', '--list', '12'];
  run(join(tmp, 'sm1'), [...args, '--threads', '1', '--batches', '6']);
  const one = events(join(tmp, 'sm1'));
  const st = one[0];
  assert.deepEqual(st.panel.map((p) => p.file), files);
  assert.equal(st.params.panel, 3);
  assert.equal(st.params.screenMembers, 4);
  assert.equal(st.panelFiles, files.join(','));
  assert.equal(checkValues(one), 6);
  assert.equal(checkOps(one), 6);
  checkOrder(one, 'screen');
  // the screen members: 4 (or all) of the members when the batch started, drawn anew each batch
  // the batch event comes after the batch's enter and leave events: the
  // members at its start are those after the batch before
  const alive = new Set();
  let atStart = new Set();
  const drawn = [];
  const code = new Map(st.panel.map((w) => [w.id, w.source]));
  const pts = new Map(); // "a,b" -> points per 100 rounds of a against b
  let thresholds = 0;
  for (const e of one) {
    if (e.type === 'enter') {
      alive.add(e.id), code.set(e.id, `;name x\n${e.code}`);
      for (const [o, w, l, t] of e.scores) pts.set(`${e.id},${o}`, ((3 * w + t) * 100) / st.params.rounds), pts.set(`${o},${e.id}`, ((3 * l + t) * 100) / st.params.rounds);
    }
    if (e.type === 'leave') alive.delete(e.id);
    if (e.type !== 'batch') continue;
    assert.equal(e.screenMembers.length, Math.min(4, atStart.size), `batch ${e.batch}`);
    for (const id of e.screenMembers) assert.ok(atStart.has(id), `${id} in the screen of batch ${e.batch}`);
    drawn.push(e.screenMembers.join(','));
    // the threshold: screenFactor times the weakest member's average against the screen's opponents
    if (atStart.size >= st.params.list) {
      const opp = [...st.panel.map((w) => w.id), ...e.screenMembers];
      const avg = (m) => { const o = opp.filter((x) => x !== m); return o.reduce((s, x) => s + pts.get(`${m},${x}`), 0) / o.length; };
      const want = st.params.screenFactor * Math.min(...[...atStart].map(avg));
      assert.ok(Math.abs(want - e.threshold) < 1e-4, `threshold of batch ${e.batch}: ${e.threshold}, not ${want}`);
      thresholds++;
    } else assert.equal(e.threshold, -1);
    for (const x of one.filter((y) => y.type === 'enter' && y.batch === e.batch)) assert.ok(e.threshold < 0 || x.screen >= e.threshold - 1e-6, `${x.name}: screen ${x.screen} below ${e.threshold}`);
    atStart = new Set(alive);
  }
  assert.ok(new Set(drawn.filter((d) => d.split(',').length === 4)).size >= 2, `always the same screen members: ${drawn}`);
  assert.ok(thresholds >= 2, `${thresholds} thresholds checked`);
  // a newcomer's screen is its average over the panel and the screen members
  // in the first screen rounds: replayed in the WebAssembly engine
  const m = createMarsSync(RULES);
  let replayed = 0;
  const sr = st.params.screenRounds;
  for (const e of one.filter((x) => x.type === 'enter' && x.batch >= 2).slice(0, 5)) {
    const b = one.find((x) => x.type === 'batch' && x.batch === e.batch);
    const a = assemble(`;name x\n${e.code}`, RULES);
    let sum = e.screenPoints.reduce((s, v) => s + v, 0);
    for (const id of b.screenMembers) {
      const seed = e.scores.find((x) => x[0] === id)[4];
      const r = m.runMatch([a, assemble(code.get(id), RULES)], { seed, rounds: sr });
      sum += ((3 * r.warriors[0].wins + r.warriors[0].ties) * 100) / sr;
    }
    assert.ok(Math.abs(sum / (3 + b.screenMembers.length) - e.screen) < 1e-3, `${e.name}: ${sum / (3 + b.screenMembers.length)}, logged ${e.screen}`);
    replayed++;
  }
  assert.equal(replayed, 5);
  run(join(tmp, 'sm-resumed'), [...args, '--threads', '2', '--batches', '3']);
  run(join(tmp, 'sm-resumed'), ['--threads', '4', '--batches', '3']);
  assert.deepEqual(stable(events(join(tmp, 'sm-resumed'))), stable(one));
  const bad = spawnSync(evolve, [join(tmp, 'sm-bad'), ...TINY, '--panel-files', 'afterstorm.red,nothere.red'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /nothere\.red is not a warrior/);
});

test('--stage 10: survivors play 10 rounds, those that stay the rest; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.stage, 0);
  assert.equal(base.filter((e) => e.type === 'complete').length, 0);
  const args = [...TINY, '--stage', '10', '--screen-rounds', '5', '--survivors', '6', '--list', '8'];
  run(join(tmp, 'stage1'), [...args, '--threads', '1', '--batches', '6']);
  const one = events(join(tmp, 'stage1'));
  assert.equal(one[0].params.stage, 10);
  assert.equal(checkValues(one), 6); // with the partial and the completed results
  const R = one[0].params.rounds, P = new Set(one[0].panel.map((w) => w.id));
  let early = 0, completed = 0;
  one.forEach((e, k) => {
    if (e.type !== 'enter') return;
    // entering: 10 rounds against the members, against the panel its 5 screen rounds and 5 more
    for (const [o, w, l, t] of e.scores) assert.equal(w + l + t, 10, `${e.name} against ${o} when it entered`);
    // then either it leaves at once, decided on the first stage's results
    // (no other warrior can leave on them), or it plays the rest first
    const next = one[k + 1];
    const done = one.filter((x) => x.type === 'complete' && x.id === e.id);
    if (next.type === 'leave' && next.early) {
      assert.equal(next.id, e.id, `an early leave of another warrior than the newcomer ${e.name}`);
      assert.equal(done.length, 0);
      early++;
    } else {
      assert.equal(next.type, 'complete', `${e.name}: no complete event after it entered`);
      assert.equal(done.length, 1);
      completed++;
    }
  });
  assert.ok(one.every((e) => e.type !== 'leave' || !e.early || one.some((x) => x.type === 'enter' && x.id === e.id && x.batch === e.batch)));
  assert.ok(early >= 2 && completed > 5, `${early} left early, ${completed} completed`);
  const { decisions, kept } = checkEarly(one);
  assert.equal(decisions, early);
  assert.ok(kept > 3, `${kept} completed with a full list`);
  // a completed match is the whole match: replayed in the WebAssembly engine
  const code = new Map(one[0].panel.map((w) => [w.id, w.source]));
  for (const e of one.filter((x) => x.type === 'enter')) code.set(e.id, `;name x\n${e.code}`);
  const m = createMarsSync(RULES);
  let replayed = 0;
  // pairs with mixed results: one with the same result in every round would
  // look the same whichever rounds were played
  const mixed = one.filter((x) => x.type === 'complete').flatMap((c) => c.scores.filter(([, w, l, t]) => [w, l, t].filter((v) => v > 0).length > 1).map((s) => [c, s]));
  for (const [c, [o, w, l, t, seed]] of [...mixed.filter(([, [x]]) => P.has(x)).slice(0, 4), ...mixed.filter(([, [x]]) => !P.has(x)).slice(0, 4)]) {
    {
      const r = m.runMatch([assemble(code.get(c.id), RULES), assemble(code.get(o), RULES)], { seed, rounds: R });
      assert.deepEqual([r.warriors[0].wins, r.warriors[0].losses, r.warriors[0].ties], [w, l, t], `${c.id} against ${o}`);
      replayed++;
    }
  }
  assert.ok(replayed >= 6, `${replayed} replayed`);
  // the panel's first-stage results are its first 10 rounds
  const pe = one.find((e) => e.type === 'panel');
  for (const [k, [a, b, w, l, t]] of pe.scores1.slice(0, 3).entries()) {
    const seed = pe.scores[k][5];
    const r = m.runMatch([assemble(code.get(a), RULES), assemble(code.get(b), RULES)], { seed, rounds: 10 });
    assert.deepEqual([r.warriors[0].wins, r.warriors[0].losses, r.warriors[0].ties], [w, l, t], `panel ${a} against ${b}, first 10 rounds`);
  }
  run(join(tmp, 'stage-resumed'), [...args, '--threads', '2', '--batches', '2']);
  run(join(tmp, 'stage-resumed'), ['--threads', '4', '--batches', '4']);
  assert.deepEqual(stable(events(join(tmp, 'stage-resumed'))), stable(one));
  // without --stage a new run has it at the screen rounds
  run(join(tmp, 'stage-default'), [...TINY.slice(0, -2), '--threads', '2', '--batches', '1']);
  assert.equal(events(join(tmp, 'stage-default'))[0].params.stage, 10);
});

test('--reintroduce: no copy of a warrior in the list comes back; a run that continues takes a new rate', { skip }, () => {
  const args = [...TINY, '--list', '8', '--survivors', '6', '--reintroduce', '0.3'];
  run(join(tmp, 're1'), [...args, '--threads', '2', '--batches', '12']);
  run(join(tmp, 're1'), ['--threads', '2', '--batches', '8', '--reintroduce', '0']);
  const evs = events(join(tmp, 're1'));
  // every warrior that came back: its code was in no member's at that moment
  const code = new Map(); // the members' code
  let back = 0;
  for (const e of evs) {
    if (e.type === 'enter') {
      if (e.ops === 'reintroduce') {
        assert.ok(![...code.values()].includes(e.code), `${e.name} is a copy of a member`);
        back++;
      }
      code.set(e.id, e.code);
    }
    if (e.type === 'leave') code.delete(e.id);
  }
  assert.ok(back >= 3, `${back} came back`);
  const at = evs.findIndex((e) => e.type === 'reintroduce');
  assert.ok(at > 0 && evs[at].reintroduce === 0 && evs[at].batch === 12, JSON.stringify(evs[at]));
  const later = evs.slice(at).filter((e) => e.type === 'batch');
  assert.equal(later.length, 8);
  assert.ok(later.every((b) => !b.ops.reintroduce), 'none came back at rate 0');
  assert.match(readFileSync(join(tmp, 're1', 'state.txt'), 'latin1'), /^params( \S+){12} 0 /m); // the 13th number: the rate
  assert.ok(checkValues(evs) > 0);
});

test('--list on a run that continues: the list grows, children fill the new places; it does not shrink', { skip }, () => {
  const args = [...TINY, '--list', '8', '--fill'];
  run(join(tmp, 'grow'), [...args, '--threads', '2', '--batches', '5']);
  run(join(tmp, 'grow'), ['--threads', '2', '--batches', '6', '--list', '14']);
  const evs = events(join(tmp, 'grow'));
  const at = evs.findIndex((e) => e.type === 'list');
  assert.deepEqual(evs[at], { type: 'list', batch: 5, list: 14, fill: false });
  const members = (e) => e.values.length - e.values.filter(([id]) => evs[0].panel.some((p) => p.id === id)).length;
  const before = evs.slice(0, at).filter((e) => e.type === 'values').at(-1), after = evs.slice(at).filter((e) => e.type === 'values');
  assert.equal(members(before), 8);
  assert.equal(members(after.at(-1)), 14);
  // the new places: children of the members, no random warriors (--fill is off from then on)
  assert.ok(evs.slice(at).filter((e) => e.type === 'enter').every((e) => e.ops !== 'random'));
  assert.match(readFileSync(join(tmp, 'grow', 'state.txt'), 'latin1'), /^params \S+ \S+ 14 /m);
  assert.equal(checkValues(evs), 11);
  // a smaller list is refused, and the run is left as it was
  const r = spawnSync(evolve, [join(tmp, 'grow'), '--batches', '1', '--list', '10'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /only grows the list/);
  assert.equal(events(join(tmp, 'grow')).filter((e) => e.type === 'batch').length, 11);
});

test('--fill: random warriors until the list is full, then children; the same run on any thread count', { skip }, () => {
  assert.equal(base[0].params.fill, false);
  const args = [...TINY, '--fill', '--list', '30', '--survivors', '4'];
  run(join(tmp, 'fill1'), [...args, '--threads', '1', '--batches', '10']);
  const one = events(join(tmp, 'fill1'));
  assert.equal(one[0].params.fill, true);
  let members = 0, randomBatches = 0, bredBatches = 0;
  for (const b of one.filter((e) => e.type === 'batch')) {
    const ops = Object.keys(b.ops);
    if (members < 30) assert.deepEqual(ops, ['random'], `batch ${b.batch} with ${members} members`), randomBatches++;
    else assert.ok(!ops.includes('random'), `batch ${b.batch}: random warriors with a full list`), bredBatches++;
    members = b.members;
  }
  assert.ok(randomBatches >= 7 && bredBatches >= 1, `${randomBatches} random batches, ${bredBatches} bred`);
  run(join(tmp, 'fill3'), [...args, '--threads', '3', '--batches', '10']);
  assert.deepEqual(stable(events(join(tmp, 'fill3'))), stable(one));
});

test('the style of a newcomer is that of tools/style.js in the WebAssembly engine', { skip }, () => {
  const evs = classic(), st = evs[0];
  const m = createMarsSync({ ...RULES_CLASSIC, watch: true });
  const opp = st.panel.slice(0, 3).map((w) => assemble(w.source, RULES_CLASSIC));
  const enters = evs.filter((e) => e.type === 'enter');
  let kinds = new Set();
  for (const e of enters.filter((_, i) => i % 3 === 0)) {
    const js = measureStyle(m, assemble(`;name x\n${e.code}`, RULES_CLASSIC), opp);
    const { kind, ...numbers } = e.style;
    for (const [k, v] of Object.entries(js)) assert.ok(Math.abs(numbers[k] - v) < 1e-5, `${e.name}: ${k} ${numbers[k]}, in JS ${v}`);
    assert.equal(kind, styleKind(js), e.name);
    kinds.add(kind);
  }
  assert.ok(kinds.size >= 2, `only ${[...kinds]}`);
});

test('--positions mirror: every position from both sides, a warrior and its copy win as often; the same run on any thread count and after a resume', { skip }, () => {
  const dir = join(tmp, 'twins');
  mkdirSync(dir);
  const dwarf = readFileSync(join(root, 'warriors/dwarf.red'), 'latin1');
  writeFileSync(join(dir, 'a.red'), dwarf);
  writeFileSync(join(dir, 'b.red'), dwarf);
  const args = [...without(CLASSIC, '--positions'), '--positions', 'mirror', '--start', dir];
  run(join(tmp, 'mirror1'), [...args, '--threads', '1', '--batches', '4']);
  const one = events(join(tmp, 'mirror1'));
  assert.equal(one[0].params.positions, 'mirror');
  assert.equal(checkValues(one), 4);
  // the two start warriors are one: against each other each wins exactly as many games
  const starts = one.filter((e) => e.type === 'enter' && e.ops === 'start');
  assert.equal(starts.length, 2);
  const [, w, l] = starts[1].scores.find(([o]) => o === starts[0].id);
  assert.equal(w, l, `the copy won ${w} and lost ${l}`);
  assert.ok(w > 0, 'the two never beat each other');
  // every match as the WebAssembly engine plays it, game by game
  const code = new Map(one[0].panel.map((x) => [x.id, x.source]));
  const m = createMarsSync(RULES_CLASSIC);
  let replayed = 0;
  for (const e of one) {
    if (e.type !== 'enter') continue;
    code.set(e.id, `;name x\n${e.code}`);
    for (const [o, ww, ll, tt, seed] of e.scores.slice(0, 4)) {
      const rounds = ww + ll + tt;
      assert.deepEqual(mirrored(m, assemble(code.get(e.id), RULES_CLASSIC), assemble(code.get(o), RULES_CLASSIC), seed, 0, rounds), [ww, ll, tt], `${e.id} against ${o}`);
      replayed++;
    }
  }
  assert.ok(replayed >= 20, `${replayed} matches replayed`);
  // odd numbers of games: --stage 11 of 41 ends the first block in the middle of a position and starts the
  // rest there; the entering results are games 0 to 10, a complete event has all 41, so games 11 to 40 are the
  // difference
  const odd = [...without(args, '--rounds', '--panel-rounds', '--screen-rounds', '--stage'), '--rounds', '41', '--panel-rounds', '41', '--screen-rounds', '11', '--stage', '11'];
  run(join(tmp, 'mirror-odd'), [...odd, '--threads', '2', '--batches', '3']);
  const od = events(join(tmp, 'mirror-odd'));
  const oc = new Map(od[0].panel.map((x) => [x.id, x.source]));
  let halves = 0;
  const entered = new Map(); // "id,o" -> its first 11 games
  for (const e of od) {
    if (e.type === 'enter') oc.set(e.id, `;name x\n${e.code}`);
    if (e.type !== 'enter' && e.type !== 'complete') continue;
    if (e.type === 'enter') for (const [o, w0, l0, t0] of e.scores) entered.set(`${e.id},${o}`, [w0, l0, t0]);
    for (const [o, w0, l0, t0, seed] of e.scores.slice(0, 3)) {
      const before = e.type === 'enter' ? [0, 0, 0] : entered.get(`${e.id},${o}`);
      const [ww, ll, tt] = [w0 - before[0], l0 - before[1], t0 - before[2]];
      assert.equal(ww + ll + tt, e.type === 'enter' ? 11 : 30);
      assert.deepEqual(mirrored(m, assemble(oc.get(e.id), RULES_CLASSIC), assemble(oc.get(o), RULES_CLASSIC), seed, e.type === 'enter' ? 0 : 11, ww + ll + tt), [ww, ll, tt], `${e.type} ${e.id} against ${o}`);
      if (e.type === 'complete') halves++;
    }
  }
  assert.ok(halves >= 6, `${halves} completed matches replayed`);
  run(join(tmp, 'mirror-resumed'), [...args, '--threads', '2', '--batches', '2']);
  run(join(tmp, 'mirror-resumed'), ['--threads', '4', '--batches', '2']);
  assert.deepEqual(stable(events(join(tmp, 'mirror-resumed'))), stable(one));
});

test('no match has seed 0: pMARS\'s generator stays there, and every round would have the same position', { skip }, () => {
  // with --seed 36 and these rules the seed of every match against member 18 was 0 (the hash of its id modulo
  // 761); Bitter Robot II of pareto30 learned such a fixed position and won 1,125,180 of 1,127,080 rounds
  run(join(tmp, 'seed36'), [...without(TINY, '--seed'), '--seed', '36', '--threads', '2', '--batches', '6']);
  const evs = events(join(tmp, 'seed36'));
  const against18 = [], seeds = [];
  for (const e of evs) {
    if (!['enter', 'complete', 'bench'].includes(e.type)) continue; // the panel event logs no seeds
    for (const [o, , , , seed] of e.scores) {
      seeds.push(seed);
      if (o === 18) against18.push(seed);
    }
  }
  assert.ok(against18.length >= 10, `${against18.length} matches against member 18`);
  assert.deepEqual([...new Set(against18)], [1]);
  assert.equal(seeds.filter((s) => s === 0).length, 0);
});

test('--start: the first batch starts from the warriors of a folder', { skip }, () => {
  const dir = join(tmp, 'start');
  mkdirSync(dir);
  for (const f of ['dwarf.red', 'imp.red']) copyFileSync(join(root, 'warriors', f), join(dir, f));
  writeFileSync(join(dir, 'broken.red'), ' mov 0\n'); // does not assemble: left out with a message
  const args = [...TINY, '--start', dir];
  run(join(tmp, 'start1'), [...args, '--threads', '1', '--batches', '3']);
  const one = events(join(tmp, 'start1'));
  assert.equal(one[0].params.start ?? one[0].start, dir);
  assert.deepEqual(one[0].startWarriors.map((w) => [w.name, w.file]), [['Dwarf', 'dwarf.red'], ['Imp', 'imp.red']]);
  // the start warriors are candidates of batch 0 as they are; the others of batch 0 are mutants of them
  const code = (src) => {
    const w = assemble(src, RULES);
    return [w.start, ...w.instructions.map((i) => [i.op, i.mod, i.aMode, i.aVal, i.bMode, i.bVal])];
  };
  const first = one.filter((e) => e.type === 'enter' && e.batch === 0);
  assert.ok(first.length > 0 && first.every((e) => e.ops === 'start' || !e.ops.includes('random')));
  // 'start' is only a start warrior as it is; a moved ORG is 'org'
  assert.ok(one.filter((e) => e.type === 'enter' && e.ops.split(' ').includes('start')).every((e) => e.ops === 'start' && e.batch === 0));
  const families = new Set(one[0].startWarriors.map((w) => w.family));
  assert.ok(first.every((e) => families.has(e.name.split(' ')[1])), 'a family of a start warrior');
  for (const e of first.filter((x) => x.ops === 'start')) {
    const w = one[0].startWarriors.find((x) => x.family === e.name.split(' ')[1]);
    assert.deepEqual(code(`;name x\n${e.code}`), code(readFileSync(join(dir, w.file), 'latin1')), `${e.name} is ${w.name}`);
  }
  assert.equal(checkValues(one), 3);
  run(join(tmp, 'start4'), [...args, '--threads', '4', '--batches', '3']);
  assert.deepEqual(stable(events(join(tmp, 'start4'))), stable(one));
  // without --start nothing changes: batch 0 is random warriors
  assert.ok(base.filter((e) => e.type === 'enter' && e.batch === 0).every((e) => e.ops === 'random'));
  // more start warriors than survivors, and a screen that stops often (z 0.5): every one enters in batch 0, and the
  // push-off cuts the list to --list (a merge of 80 islands kept 13 with the cut of 16 survivors)
  const many = join(tmp, 'start-many');
  mkdirSync(many);
  const hill = join(root, 'warriors/koenigstuhl/tiny');
  for (const f of readdirSync(hill).filter((x) => x.endsWith('.red')).sort().slice(0, 12)) copyFileSync(join(hill, f), join(many, f));
  run(join(tmp, 'start-many-run'), [...without(TINY, '--list'), '--list', '8', '--survivors', '3', '--screen-stop', '0.5', '--start', many, '--threads', '2', '--batches', '2']);
  const mv = events(join(tmp, 'start-many-run'));
  const n = mv[0].startWarriors.length;
  assert.ok(n > 3, `${n} start warriors`);
  const b0 = mv.filter((e) => e.batch === 0);
  assert.ok(mv.find((e) => e.type === 'screen' && e.batch === 0).stopped > 0, 'the screen stopped none in batch 0');
  assert.deepEqual([b0.filter((e) => e.type === 'enter' && e.ops === 'start').length, b0.filter((e) => e.type === 'enter').length], [n, n]);
  assert.equal(b0.filter((e) => e.type === 'leave').length, n - 8);
  assert.equal(checkValues(mv), 2);
});

test('42spectrum: every child of every change counted once, the same result on any thread count', { skip }, () => {
  const args = ['--opponents', join(root, 'warriors/koenigstuhl/tiny'), '--size', '800', '--cycles', '8000', '--processes', '800',
    '--length', '20', '--distance', '20', '--panel', '6', '--children', '12', '--rounds', '8', '--confirm-rounds', '16'];
  const runIt = (threads, out) => {
    const r = spawnSync(spectrum, [...args, '--threads', threads, '--json', out, join(root, 'warriors/dwarf.red'), join(root, 'warriors/imp.red')], { encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(readFileSync(out, 'utf8'));
  };
  const one = runIt('1', join(tmp, 'spectrum1.json'));
  assert.deepEqual(runIt('3', join(tmp, 'spectrum3.json')), one);
  assert.deepEqual(one.warriors.map((w) => w.name), ['Dwarf', 'Imp']);
  for (const w of one.warriors) {
    assert.equal(Object.keys(w.changes).length, 18);
    for (const [name, c] of Object.entries(w.changes)) {
      assert.equal(c.tried, 12);
      assert.ok(c.applied <= c.tried);
      assert.equal(c.identical + c.fatal + c.worse + c.same + c.better, c.applied, `${w.name} ${name}`);
      assert.ok(c.confirmed <= c.better && c.sameCode <= c.identical);
    }
  }
  // Dwarf has no far values at core 800: shared-constant and tune do not apply
  assert.equal(one.warriors[0].changes['shared-constant'].applied, 0);
  assert.equal(one.warriors[0].changes.tune.applied, 0);
  assert.equal(one.warriors[0].changes.opcode.applied, 12);
  assert.equal(one.warriors[1].changes.delete.applied, 0); // Imp has 1 instruction
  // a new modifier for Dwarf's DAT changes the code but no result
  assert.ok(one.warriors[0].changes.modifier.identical > one.warriors[0].changes.modifier.sameCode);
});

test('panel warriors never leave, also the weakest', { skip }, () => {
  // a panel of 6 tiny hill warriors and one that dies in its first cycle
  const opp = join(tmp, 'opponents');
  mkdirSync(opp);
  const tiny = join(root, 'warriors/koenigstuhl/tiny');
  for (const f of readdirSync(tiny).sort().slice(0, 6)) copyFileSync(join(tiny, f), join(opp, f));
  writeFileSync(join(opp, 'dies.red'), ';name Dies\n dat #0, #0\n');
  const args = TINY.map((a, i) => (TINY[i - 1] === '--opponents' ? opp : a));
  run(join(tmp, 'weak'), [...args, '--panel', '7', '--holdout', '0', '--list', '4', '--threads', '4', '--batches', '3']);
  const evs = events(join(tmp, 'weak'));
  const dies = evs[0].panel.find((w) => w.name === 'Dies');
  assert.ok(dies);
  const values = evs.filter((e) => e.type === 'values');
  assert.equal(values.length, 3);
  for (const v of values) {
    const it = v.values.find((x) => x[0] === dies.id);
    assert.ok(it, 'Dies is still in');
    assert.equal(it[4], Math.min(...v.values.map((x) => x[4])), 'Dies has the lowest value');
  }
  assert.ok(evs.some((e) => e.type === 'leave'), 'the list was full and someone left');
});

test('every warrior has its own name, and its family name from its first parent unless it plays unlike it', { skip }, () => {
  const entered = classic().filter((e) => e.type === 'enter');
  const names = entered.map((e) => e.name);
  assert.equal(new Set(names).size, names.length);
  const noun = new Map();
  let children = 0, fresh = 0;
  for (const e of entered) {
    const m = /^([A-Z][a-z]+) ([A-Z][a-z]+)(?: ([IVXLCDM]+))?$/.exec(e.name);
    assert.ok(m, e.name);
    noun.set(e.id, m[2]);
    if (e.parents.length && noun.has(e.parents[0])) {
      if (e.newFamily) assert.notEqual(m[2], noun.get(e.parents[0]), `${e.name}, new family, child of ${e.parents[0]}`), fresh++;
      else assert.equal(m[2], noun.get(e.parents[0]), `${e.name}, child of ${e.parents[0]}`), children++;
    }
  }
  assert.ok(children > 10 && fresh > 0, `${children} children in their parent's family, ${fresh} in a new one`);
  const best = readFileSync(join(tmp, 'classic/best.red'), 'latin1');
  assert.ok(names.includes(/^;name (.*)$/m.exec(best)[1]));
});

test('a logged match plays the same in the WebAssembly engine', { skip }, () => {
  const start = base[0];
  const code = new Map(start.panel.map((w) => [w.id, w.source]));
  const m = createMarsSync(RULES);
  let played = 0;
  for (const e of base) {
    if (e.type !== 'enter') continue;
    code.set(e.id, `;redcode\n;name e${e.id}\n${e.code}`);
    // one match against the panel and one against another evolved warrior
    for (const [o, w, l, t, seed] of [e.scores[0], e.scores.at(-1)]) {
      const a = assemble(code.get(e.id), RULES), b = assemble(code.get(o), RULES);
      assert.ok(a.ok && b.ok);
      const r = m.runMatch([a, b], { seed, rounds: start.params.rounds });
      assert.deepEqual([r.warriors[0].wins, r.warriors[0].losses, r.warriors[0].ties], [w, l, t], `e${e.id} against ${o}`);
      played++;
    }
    if (played >= 12) break;
  }
  assert.ok(played >= 12);
});

test('the best warrior against the holdout warriors is in best.red', { skip }, () => {
  // after batches 1, 3 and 5, unless the best against the panel was measured already
  const benches = base.filter((e) => e.type === 'bench');
  assert.ok(benches.length >= 1 && benches.length <= 3);
  assert.equal(new Set(benches.map((b) => b.id)).size, benches.length);
  assert.ok(benches.every((b) => [1, 3, 5].includes(b.batch) && b.scores.length === base[0].holdout.length));
  const best = benches.reduce((x, y) => (y.avg > x.avg ? y : x));
  const text = readFileSync(join(tmp, 'one/best.red'), 'latin1');
  const entered = base.find((e) => e.type === 'enter' && e.id === best.id);
  assert.match(text, new RegExp(`^;name ${entered.name}$`, 'm'));
  const w = assemble(text, RULES);
  assert.ok(w.ok);
  assert.equal(w.instructions.length, entered.length);
  // its head as the dashboard's list of runs reads it (tools/serve.mjs): the score and the batch; and the warrior
  // (tools/run-report.mjs); a run without islands has no island and no score against the folder
  assert.deepEqual(bestRedInfo(text), { holdout: Number(best.avg.toFixed(1)), batch: best.batch, id: best.id, island: null, score: null });
});
