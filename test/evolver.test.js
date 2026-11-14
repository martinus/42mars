// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142): its C unit test (test/c/evolver-test.c), and
// 42evolve on the tiny hill of warriors/koenigstuhl: the same run for any
// number of threads and after a resume, push-off values as tools/diversity.js
// computes them from the logged scores, and logged matches that the
// WebAssembly engine plays the same, which the dashboard's battle view needs.
// Built with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { pushoffValues } from '../tools/diversity.js';
import { prebuilt, program, skip as noCc } from './native.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'evolver-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const evolve = program(prebuilt ?? tmp, '42evolve');
const unit = program(prebuilt ?? tmp, 'evolver-test');
const skip = noCc || (process.platform === 'win32' && 'POSIX only') || (prebuilt && !existsSync(evolve) && `no 42evolve in ${prebuilt}`) || false;

async function build() {
  const cc = promisify(execFile);
  const lib = join(tmp, '42mars.o');
  await cc('cc', ['-O2', '-c', '-o', lib, join(root, 'lib/42mars.c')]);
  const src = (f) => join(root, 'evolver', f);
  await Promise.all([
    cc('cc', ['-O2', '-pthread', '-I', join(root, 'lib'), '-o', evolve, src('evolve.c'), src('genome.c'), src('pushoff.c'), src('names.c'), lib, '-lm']),
    cc('cc', ['-O2', '-I', join(root, 'lib'), '-I', join(root, 'evolver'), '-o', unit, join(root, 'test/c/evolver-test.c'), src('genome.c'), src('pushoff.c'), src('names.c'), lib, '-lm']),
  ]);
}

const RULES = { coreSize: 800, maxCycles: 8000, maxProcesses: 800, maxLength: 20, minDistance: 20 };
const TINY = ['--opponents', join(root, 'warriors/koenigstuhl/tiny'), '--size', '800', '--cycles', '8000', '--processes', '800',
  '--length', '20', '--distance', '20', '--panel', '10', '--holdout', '8', '--batch', '24', '--rounds', '40', '--screen-rounds', '10',
  '--bench-every', '2', '--seed', '7'];

function run(dir, args) {
  const r = spawnSync(evolve, [dir, ...args], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  return r;
}
const events = (dir) => readFileSync(join(dir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
// what has to be the same in two runs: everything but timings and resumes
const stable = (evs) => evs.filter((e) => e.type !== 'speed' && e.type !== 'resume');

let base; // the events of the run on one thread, 6 batches
before(async () => {
  if (skip) return;
  if (!prebuilt) await build();
  run(join(tmp, 'one'), [...TINY, '--threads', '1', '--batches', '6']);
  base = events(join(tmp, 'one'));
});

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
    .replace(/^(reserve|reserve-next|rotate-next|slot) .*\n/gm, '');
  assert.notEqual(old, state);
  assert.doesNotMatch(old, /^(reserve|panel-id)/m);
  writeFileSync(file, old);
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
  assert.match(r.stderr, /only --threads, --batches and --seconds/);
  assert.equal(spawnSync(evolve, [join(tmp, 'none')], { encoding: 'utf8' }).status, 2); // no --opponents
});

// The matrix after every event, with slots given out as 42evolve does
// (the lowest free one), and the push-off values of tools/diversity.js.
// Returns the number of values events checked.
function checkValues(evs) {
  const start = evs[0];
  const rounds = start.params.rounds;
  const P = start.panel.length;
  const pts = new Map(); // "a,b" -> points per 100 rounds of a against b
  const put = (a, b, w, l, t) => {
    pts.set(`${a},${b}`, ((3 * w + t) * 100) / rounds);
    pts.set(`${b},${a}`, ((3 * l + t) * 100) / rounds);
  };
  const slots = start.panel.map((w) => w.id);
  const panel = new Set(slots); // the panel now
  let checked = 0, duels = 0, lastValues = new Map();
  // the estimate of a newcomer: its screen points against the panel, the
  // SD-score on the panel columns to the nearest warrior in when its batch
  // started, with the standard deviations of then
  let snap = null;
  const estimate = (e) => {
    if (!snap || snap.batch !== e.batch) {
      const ids = slots.filter((x) => x !== null);
      const cols = slots.slice(0, P);
      const sigma = cols.map((k) => {
        const v = ids.filter((r) => r !== k).map((r) => pts.get(`${r},${k}`));
        const mean = v.reduce((a, b) => a + b, 0) / v.length;
        return Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
      });
      snap = { batch: e.batch, ids, cols, sigma: new Map(cols.map((k, i) => [k, sigma[i]])) };
    }
    let best = Infinity;
    for (const o of snap.ids) {
      let num = 0, den = 0, sum = 0;
      snap.cols.forEach((k, i) => {
        if (k === o) return;
        const d = Math.abs(e.screenPoints[i] - pts.get(`${o},${k}`)), sg = snap.sigma.get(k);
        if (start.params.sd === 'sum') num += d, den += sg;
        else if (sg > 0) sum += d / sg;
      });
      best = Math.min(best, start.params.sd === 'sum' ? (den > 0 ? num / den : 0) : sum);
    }
    if (best === Infinity) best = 0;
    return e.screen * best ** start.params.alpha;
  };
  for (const e of evs) {
    if (e.type === 'panel') for (const [a, b, w, l, t] of e.scores) put(a, b, w, l, t);
    if (e.type === 'rotate') {
      assert.ok(panel.has(e.out) && !panel.has(e.panel.id) && !pts.has(`${e.panel.id},${e.out}`), `rotate ${e.out} -> ${e.panel.id}`);
      panel.delete(e.out);
      panel.add(e.panel.id);
      slots[slots.indexOf(e.out)] = e.panel.id;
      for (const [o, w, l, t] of e.scores) put(e.panel.id, o, w, l, t);
      assert.equal(e.scores.length, slots.filter((x) => x !== null).length - 1, 'a new panel warrior plays everyone in');
    }
    if (e.type === 'enter' && e.rival >= 0) {
      // the first parent won its tournament of two against the rival: by
      // push-off value at the start of the batch, or with --parents duel by
      // their match against each other (a draw by value)
      const [w] = e.parents, l = e.rival, value = (id) => lastValues.get(id) ?? -Infinity;
      if (start.params.parents === 'duel' && w !== l && pts.get(`${w},${l}`) !== pts.get(`${l},${w}`)) {
        assert.ok(pts.get(`${w},${l}`) > pts.get(`${l},${w}`), `${e.name}: parent ${w} lost to ${l}`);
        duels++;
      } else if (!start.params.rotate) {
        assert.ok(value(w) >= value(l), `${e.name}: parent ${w} has less value than ${l}`);
      }
    }
    if (e.type === 'enter') {
      assert.equal(e.screenPoints.length, P);
      const screen = e.screenPoints.reduce((a, b) => a + b, 0) / P;
      assert.ok(Math.abs(screen - e.screen) < 1e-3, `screen of ${e.id}`);
      const est = estimate(e);
      assert.ok(Math.abs(est - e.estimate) <= 1e-4 * Math.max(1, est), `estimate of ${e.id}: ${e.estimate}, not ${est}`);
      let s = slots.indexOf(null, P);
      if (s < 0) s = slots.push(null) - 1;
      slots[s] = e.id;
      for (const [o, w, l, t] of e.scores) put(e.id, o, w, l, t);
      assert.equal(e.scores.length, slots.filter((x) => x !== null).length - 1, 'an entering warrior plays everyone in');
    }
    if (e.type === 'leave') {
      assert.ok(!panel.has(e.id), `panel warrior ${e.id} left`);
      slots[slots.indexOf(e.id)] = null;
    }
    if (e.type === 'values') {
      lastValues = new Map(e.values.map((v) => [v[0], v[4]]));
      const ids = slots.filter((x) => x !== null);
      assert.ok(ids.length - P <= start.params.list);
      const score = ids.map((a) => ids.map((b) => (a === b ? null : pts.get(`${a},${b}`))));
      const js = pushoffValues(score, ids.map((_, i) => i), { variant: start.params.sd, alpha: start.params.alpha });
      assert.deepEqual(e.values.map((v) => v[0]), ids);
      // the sixth number: the average against the panel, without the own column
      e.values.forEach(([id, , , , , pAvg]) => {
        const others = [...panel].filter((p) => p !== id);
        const expect = others.reduce((sum, p) => sum + pts.get(`${id},${p}`), 0) / others.length;
        assert.ok(Math.abs(pAvg - expect) < 1e-5, `panel average of ${id}: ${pAvg}, not ${expect}`);
      });
      e.values.forEach(([id, avg, distance, nearest, value], i) => {
        const near = (x, y) => Math.abs(x - y) <= 1e-5 * Math.max(1, Math.abs(y));
        assert.ok(near(avg, js[i].avg) && near(distance, js[i].distance) && near(value, js[i].value), `values of ${id}`);
        assert.equal(nearest, ids[js[i].nearest]);
      });
      checked++;
    }
  }
  if (start.params.parents === 'duel') assert.ok(duels > 10, `only ${duels} duels`);
  return checked;
}

test('the logged values are the push-off of the logged scores', { skip }, () => {
  assert.equal(checkValues(base), 6);
});

// The warriors of one batch enter in the order of what they were picked by.
function checkOrder(evs, key) {
  const byBatch = new Map();
  for (const e of evs.filter((x) => x.type === 'enter')) (byBatch.get(e.batch) ?? byBatch.set(e.batch, []).get(e.batch)).push(e[key]);
  for (const [batch, keys] of byBatch) for (let i = 1; i < keys.length; i++) assert.ok(keys[i - 1] >= keys[i] - 1e-4, `batch ${batch}: ${keys}`);
}

test('survivors of the screen enter by their screen score', { skip }, () => {
  assert.equal(base[0].params.select, 'screen');
  assert.equal(base[0].params.fractions, 0);
  checkOrder(base, 'screen');
});

test('--select value --rotate 2: survivors by estimated value, a panel that changes, the same run on any thread count', { skip }, () => {
  const args = [...TINY, '--select', 'value', '--rotate', '2', '--survivors', '8'];
  run(join(tmp, 'rot1'), [...args, '--threads', '1', '--batches', '6']);
  const one = events(join(tmp, 'rot1'));
  assert.equal(one[0].params.select, 'value');
  assert.equal(one[0].params.rotate, 2);
  // rotations before batches 2 and 4, each of the oldest panel warrior
  const rot = one.filter((e) => e.type === 'rotate');
  assert.deepEqual(rot.map((e) => e.batch), [2, 4]);
  assert.deepEqual(rot.map((e) => e.out), one[0].panel.slice(0, 2).map((p) => p.id));
  assert.equal(checkValues(one), 6);
  checkOrder(one, 'estimate');
  // and that is another order than the screen's in some batch
  const enters = one.filter((e) => e.type === 'enter');
  assert.ok(enters.some((e, i) => i && enters[i - 1].batch === e.batch && enters[i - 1].screen < e.screen - 1e-4), 'estimate and screen agree everywhere');
  // the new panel warriors' matches play the same in the WebAssembly engine
  const code = new Map(one[0].panel.map((w) => [w.id, w.source]));
  for (const e of one) {
    if (e.type === 'enter') code.set(e.id, `;name x\n${e.code}`);
    if (e.type === 'rotate') code.set(e.panel.id, e.panel.source);
  }
  const m = createMarsSync(RULES);
  let replayed = 0;
  for (const e of rot) {
    const members = e.scores.filter(([o]) => !one[0].panel.some((p) => p.id === o));
    assert.ok(members.length > 0);
    for (const [o, w, l, t, seed] of [e.scores[0], ...members.slice(0, 3)]) {
      const r = m.runMatch([assemble(e.panel.source, RULES), assemble(code.get(o), RULES)], { seed, rounds: one[0].params.rounds });
      assert.deepEqual([r.warriors[0].wins, r.warriors[0].losses, r.warriors[0].ties], [w, l, t], `${e.panel.name} against ${o}`);
      replayed++;
    }
  }
  assert.ok(replayed >= 6);
  run(join(tmp, 'rot4'), [...args, '--threads', '4', '--batches', '6']);
  assert.deepEqual(stable(events(join(tmp, 'rot4'))), stable(one));
  run(join(tmp, 'rot-resumed'), [...args, '--threads', '3', '--batches', '3']);
  run(join(tmp, 'rot-resumed'), ['--threads', '2', '--batches', '3']);
  assert.deepEqual(stable(events(join(tmp, 'rot-resumed'))), stable(one));
});

test('--race 3: the first screen rounds for all, the rest for the best, the same run on any thread count', { skip }, () => {
  const args = [...TINY, '--race', '3', '--race-keep', '6'];
  run(join(tmp, 'race1'), [...args, '--threads', '1', '--batches', '5']);
  const one = events(join(tmp, 'race1'));
  assert.equal(one[0].params.race, 3);
  assert.equal(one[0].params.raceKeep, 6);
  for (const b of one.filter((e) => e.type === 'batch')) {
    assert.equal(b.raced, Math.min(6, b.evaluated), `batch ${b.batch}`);
    // the ones that went on were the best after the first 3 rounds
    for (const e of one.filter((x) => x.type === 'enter' && x.batch === b.batch)) assert.ok(e.raceKey >= b.raceDropped - 1e-6, `${e.name}: ${e.raceKey} < ${b.raceDropped}`);
  }
  assert.equal(checkValues(one), 5);
  checkOrder(one, 'screen');
  // the logged screen points are all 10 screen rounds, also after the race
  const st = one[0], m = createMarsSync(RULES);
  const sources = new Map(st.panel.map((w) => [w.id, w.source]));
  let replayed = 0;
  for (const e of one.filter((x) => x.type === 'enter' && x.batch > 0).slice(0, 6)) {
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
  run(join(tmp, 'race4'), [...args, '--threads', '4', '--batches', '5']);
  assert.deepEqual(stable(events(join(tmp, 'race4'))), stable(one));
});

test('--prior hill: the weights are how often opcodes, modifiers and modes occur in the opponents', { skip }, () => {
  assert.equal(base[0].params.prior, 'uniform');
  assert.ok(Object.values(base[0].weights).every((w) => w.every((x) => x === 0)));
  run(join(tmp, 'prior'), [...TINY, '--prior', 'hill', '--threads', '4', '--batches', '2']);
  const evs = events(join(tmp, 'prior'));
  // every warrior of the folder that fits the rules, counted here with the WebAssembly assembler
  const op = new Array(17).fill(1), mod = new Array(7).fill(1), mode = new Array(8).fill(1);
  const dir = join(root, 'warriors/koenigstuhl/tiny');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.red'))) {
    const w = assemble(readFileSync(join(dir, f), 'latin1'), { ...RULES, rounds: 40 });
    if (!w.ok || w.instructions.length > 20 || w.instructions.some((i) => i.op >= 17)) continue;
    for (const i of w.instructions) op[i.op]++, mod[i.mod]++, mode[i.aMode]++, mode[i.bMode]++;
  }
  assert.deepEqual(evs[0].weights, { op, mod, mode });
  assert.equal(checkValues(evs), 2);
  // the warriors bred use the modes of the hill: $ is the most common there
  const count = (es) => {
    const m = new Array(8).fill(0);
    for (const e of es.filter((x) => x.type === 'enter')) for (const i of assemble(e.code, RULES).instructions) m[i.aMode]++, m[i.bMode]++;
    return m[1] / m.reduce((a, b) => a + b, 0);
  };
  assert.ok(mode[1] === Math.max(...mode));
  assert.ok(count(evs) > count(base.filter((e) => e.batch === undefined || e.batch < 2)) + 0.1, 'more $ modes with the prior');
});

test('--parents duel: a parent beat its rival in their match, the same run on any thread count', { skip }, () => {
  assert.equal(base[0].params.parents, 'value');
  const args = [...TINY, '--parents', 'duel'];
  run(join(tmp, 'duel1'), [...args, '--threads', '1', '--batches', '6']);
  const one = events(join(tmp, 'duel1'));
  assert.equal(one[0].params.parents, 'duel');
  assert.equal(checkValues(one), 6);
  run(join(tmp, 'duel3'), [...args, '--threads', '3', '--batches', '6']);
  assert.deepEqual(stable(events(join(tmp, 'duel3'))), stable(one));
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

test('every warrior has its own name, and its family name from its first parent', { skip }, () => {
  const entered = base.filter((e) => e.type === 'enter');
  const names = entered.map((e) => e.name);
  assert.equal(new Set(names).size, names.length);
  const noun = new Map();
  let children = 0;
  for (const e of entered) {
    const m = /^([A-Z][a-z]+) ([A-Z][a-z]+)(?: ([IVXLCDM]+))?$/.exec(e.name);
    assert.ok(m, e.name);
    noun.set(e.id, m[2]);
    if (e.parents.length && noun.has(e.parents[0])) {
      assert.equal(m[2], noun.get(e.parents[0]), `${e.name}, child of ${e.parents[0]}`);
      children++;
    }
  }
  assert.ok(children > 10);
  const best = readFileSync(join(tmp, 'one/best.red'), 'latin1');
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
});
