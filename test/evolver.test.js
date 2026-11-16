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
import { pushoffValues, standardError, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { prebuilt, program, skip as noCc } from './native.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'evolver-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const evolve = program(prebuilt ?? tmp, '42evolve');
const unit = program(prebuilt ?? tmp, 'evolver-test');
const spectrum = program(prebuilt ?? tmp, '42spectrum');
const skip = noCc || (process.platform === 'win32' && 'POSIX only') || (prebuilt && !existsSync(evolve) && `no 42evolve in ${prebuilt}`) || false;

async function build() {
  const cc = promisify(execFile);
  const lib = join(tmp, '42mars.o');
  await cc('cc', ['-O2', '-c', '-o', lib, join(root, 'lib/42mars.c')]);
  const src = (f) => join(root, 'evolver', f);
  await Promise.all([
    cc('cc', ['-O2', '-pthread', '-I', join(root, 'lib'), '-o', evolve, src('evolve.c'), src('genome.c'), src('pushoff.c'), src('names.c'), src('style.c'), lib, '-lm']),
    cc('cc', ['-O2', '-I', join(root, 'lib'), '-I', join(root, 'evolver'), '-o', unit, join(root, 'test/c/evolver-test.c'), src('genome.c'), src('pushoff.c'), src('names.c'), lib, '-lm']),
    cc('cc', ['-O2', '-pthread', '-I', join(root, 'lib'), '-o', spectrum, src('spectrum.c'), src('genome.c'), lib, '-lm']),
  ]);
}

const RULES = { coreSize: 800, maxCycles: 8000, maxProcesses: 800, maxLength: 20, minDistance: 20 };
const TINY = ['--opponents', join(root, 'warriors/koenigstuhl/tiny'), '--size', '800', '--cycles', '8000', '--processes', '800',
  '--length', '20', '--distance', '20', '--panel', '10', '--holdout', '8', '--batch', '24', '--rounds', '40', '--screen-rounds', '10',
  '--bench-every', '2', '--seed', '7',
  // the defaults before the best run of E5 became them; test 'the defaults' has those
  '--list', '20', '--screen-members', '0', '--diversity', 'all', '--panel-rounds', '40', '--no-fill', '--panel-choice', 'random',
  '--stage', '0']; // the tests of --stage set it

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
    .replace(/^(reserve|reserve-next|rotate-next|slot|changes) .*\n/gm, '');
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
  assert.match(r.stderr, /only --threads, --batches, --seconds, --changes, --reintroduce, --screen-stop and --screen-check/);
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
  const se = new Map(); // "a,b" -> its standard error (--noise)
  const put = (a, b, w, l, t) => { // per 100 of the rounds played (--stage: fewer than `rounds` at first)
    pts.set(`${a},${b}`, ((3 * w + t) * 100) / (w + l + t));
    pts.set(`${b},${a}`, ((3 * l + t) * 100) / (w + l + t));
    se.set(`${a},${b}`, standardError(w, t, w + l + t));
    se.set(`${b},${a}`, standardError(l, t, w + l + t));
    played.set(`${a},${b}`, w + l + t);
    played.set(`${b},${a}`, w + l + t);
  };
  const played = new Map(); // "a,b" -> rounds of that result
  const slots = start.panel.map((w) => w.id);
  const panel = new Set(slots); // the panel now
  let checked = 0, duels = 0, lastValues = new Map(), parentDistances = 0, pushoffs = 0, niches = 0, specials = 0, specialParents = 0;
  // --specialists: per panel warrior the member best against it (the first
  // in the list on a tie), when ahead of the members' median there by more
  // than 2 standard errors of its score: [panel id, member id, score, se, median]
  const specialistsNow = (ids) => {
    const out = [];
    for (const o of ids) {
      if (!panel.has(o)) continue;
      const ms = ids.filter((m) => !panel.has(m));
      if (!ms.length) continue;
      const xs = ms.map((m) => pts.get(`${m},${o}`)).sort((a, b) => a - b);
      const med = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
      let best = ms[0];
      for (const m of ms) if (pts.get(`${m},${o}`) > pts.get(`${best},${o}`)) best = m;
      const x = pts.get(`${best},${o}`), e = se.get(`${best},${o}`);
      if (x - med > 2 * e) out.push([o, best, x, e, med]);
    }
    return out;
  };
  let protectedNow = new Set(); // at the start of the batch, for the parents
  // --sharing c: the average of the push-off value weighted, panel warrior j
  // by 1 / (members' mean against it + c), a member's column by the mean of
  // those; the weights of the last 'sharing' event (uniform before the first)
  let shareW = null, sharings = 0, sharedLeaves = 0, roundings = 0;
  const share = (v, ids, score) => {
    if (!shareW) return v;
    return v.map((x, i) => {
      let num = 0, den = 0;
      ids.forEach((b, j) => {
        if (j === i) return;
        const w = panel.has(b) ? shareW.w.get(b) : shareW.member;
        num += w * score[i][j], den += w;
      });
      const avg = den > 0 ? num / den : 0;
      return { ...x, avg, value: avg * (start.params.alpha === 1 ? x.distance : x.distance ** start.params.alpha) };
    });
  };
  const styleOf = new Map(); // id -> kind of style (--niche)
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
    if (e.type === 'enter' && start.params.specialists && e.rival < 0 && e.parents.length && e.ops !== 'reintroduce') { // a protected parent
      assert.ok(protectedNow.has(e.parents[0]), `${e.name}: parent ${e.parents[0]} is not protected`);
      specialParents++;
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
      styleOf.set(e.id, e.style?.kind);
      assert.equal(e.screenPoints.length, P);
      // with --screen-members the screen has members too (replayed in their test)
      const screen = e.screenPoints.reduce((a, b) => a + b, 0) / P;
      if (!start.params.screenMembers) assert.ok(Math.abs(screen - e.screen) < 1e-3, `screen of ${e.id}`);
      const est = estimate(e);
      assert.ok(Math.abs(est - e.estimate) <= 1e-4 * Math.max(1, est), `estimate of ${e.id}: ${e.estimate}, not ${est}`);
      let s = slots.indexOf(null, P);
      if (s < 0) s = slots.push(null) - 1;
      slots[s] = e.id;
      for (const [o, w, l, t] of e.scores) put(e.id, o, w, l, t);
      assert.equal(e.scores.length, slots.filter((x) => x !== null).length - 1, 'an entering warrior plays everyone in');
      // how far its scores are from its first parent's, points per 100
      // rounds on average over everyone else in now; a new family above 30
      const ids = slots.filter((x) => x !== null), p = e.parents[0];
      if (e.parents.length > 0 && ids.includes(p) && !panel.has(p)) {
        const o = ids.filter((x) => x !== e.id && x !== p);
        const d = o.reduce((s, x) => s + Math.abs(pts.get(`${e.id},${x}`) - pts.get(`${p},${x}`)), 0) / o.length;
        assert.ok(Math.abs(d - e.parentDifference) < 1e-5, `parent difference of ${e.id}: ${e.parentDifference}, not ${d}`);
        assert.equal(e.newFamily, e.parentDifference > 30, `new family of ${e.id}: ${e.parentDifference}`);
        parentDistances++;
      } else {
        assert.equal(e.parentDifference, -1);
        assert.equal(e.newFamily, false);
      }
    }
    if (e.type === 'complete') { // --stage: the rest of the rounds of a survivor that stayed
      for (const [o, w, l, t] of e.scores) {
        assert.equal(w + l + t, panel.has(o) ? start.params.panelRounds ?? rounds : rounds, `${e.id} against ${o}`);
        put(e.id, o, w, l, t);
      }
    }
    if (e.type === 'leave' && !e.early) {
      // the push-off: the weakest of those that may leave, by tools/diversity.js
      // on the logged scores; with --niche N not the last N of a kind of style
      // (not the two kinds of junk), unless that leaves nobody
      const ids = slots.filter((x) => x !== null);
      const score = ids.map((a) => ids.map((b) => (a === b ? null : pts.get(`${a},${b}`))));
      const columns = start.params.diversity === 'panel' ? ids.map((id) => panel.has(id)) : null;
      const noise = start.params.noise ? { se: ids.map((a) => ids.map((b) => (a === b ? 0 : se.get(`${a},${b}`)))), z: start.params.noise } : {};
      const v = share(pushoffValues(score, ids.map((_, i) => i), { variant: start.params.sd, alpha: start.params.alpha, columns, ...noise }), ids, score);
      let keep = new Set(ids.map((id, i) => (panel.has(id) ? i : -1)).filter((i) => i >= 0));
      if (start.params.niche || start.params.specialists) {
        const safe = new Set(keep);
        if (start.params.niche) {
          const count = new Map();
          for (const id of ids) if (!panel.has(id)) count.set(styleOf.get(id), (count.get(styleOf.get(id)) ?? 0) + 1);
          const junk = new Set(['dies at once', 'writes little (scanner, or waits)']);
          ids.forEach((id, i) => { if (!panel.has(id) && !junk.has(styleOf.get(id)) && count.get(styleOf.get(id)) <= start.params.niche) safe.add(i); });
        }
        if (start.params.specialists) for (const [, m] of specialistsNow(ids)) safe.add(ids.indexOf(m));
        const plain = weakest(v, keep);
        if (safe.size < ids.length) keep = safe;
        if (weakest(v, keep) !== plain) niches++, specials++; // the protection changed who left
      }
      // the weakest, or one whose value equals it up to rounding: a compiler
      // may fuse `num += w * x` into one rounding (arm64, gcc for
      // x86-64-v3), and the weighted average of --sharing then differs in the
      // last bits from this replay; near twins have such values (CI of #154)
      const k = weakest(v, keep), j = ids.indexOf(e.id);
      assert.ok(k === j || (!keep.has(j) && Math.abs(v[j].value - v[k].value) <= 1e-9 * Math.max(1, Math.abs(v[k].value))),
        `batch ${e.batch}: ${e.id} left, the push-off says ${ids[k]}`);
      if (k !== j) roundings++;
      if (shareW) { // the plain average would have pushed out another one
        const plain = pushoffValues(score, ids.map((_, i) => i), { variant: start.params.sd, alpha: start.params.alpha, columns, ...noise });
        if (ids[weakest(plain, keep)] !== e.id) sharedLeaves++;
      }
      pushoffs++;
    }
    if (e.type === 'leave') {
      assert.ok(!panel.has(e.id), `panel warrior ${e.id} left`);
      slots[slots.indexOf(e.id)] = null;
    }
    if (e.type === 'sharing') { // the weights from the members' means at the end of the batch
      const ids = slots.filter((x) => x !== null), ms = ids.filter((m) => !panel.has(m));
      const c = start.params.sharing, w = new Map();
      for (const o of ids.filter((x) => panel.has(x))) {
        const mean = ms.length ? ms.reduce((a, m) => a + pts.get(`${m},${o}`), 0) / ms.length : 0;
        w.set(o, 1 / (mean + c));
      }
      assert.deepEqual(e.weights.map((x) => x[0]), [...w.keys()], `sharing after batch ${e.batch}`);
      e.weights.forEach(([o, x, mean]) => assert.ok(Math.abs(x - w.get(o)) <= 1e-12 && Math.abs(mean - (1 / w.get(o) - c)) < 1e-5, `weight of ${o}: ${x}, not ${w.get(o)}`));
      const member = [...w.values()].reduce((a, b) => a + b, 0) / w.size;
      assert.ok(Math.abs(e.member - member) <= 1e-12, `member weight ${e.member}, not ${member}`);
      shareW = { w: new Map(e.weights.map(([o, x]) => [o, x])), member: e.member };
      sharings++;
    }
    if (e.type === 'specialists') {
      const ids = slots.filter((x) => x !== null), js = specialistsNow(ids);
      assert.deepEqual(e.protected.map((x) => x.slice(0, 2)), js.map((x) => x.slice(0, 2)), `specialists after batch ${e.batch}`);
      e.protected.forEach((x, i) => x.slice(2).forEach((y, k) => assert.ok(Math.abs(y - js[i][2 + k]) < 1e-5, `specialist ${x[1]}`)));
      protectedNow = new Set(js.map((x) => x[1]));
    }
    if (e.type === 'values') {
      lastValues = new Map(e.values.map((v) => [v[0], v[4]]));
      // at the end of a batch every pair has all its rounds (--stage: after the complete events)
      for (const a of slots) for (const b of slots) if (a !== null && b !== null && a !== b) assert.equal(played.get(`${a},${b}`), panel.has(a) || panel.has(b) ? start.params.panelRounds ?? rounds : rounds, `${a} against ${b} after batch ${e.batch}`);
      const ids = slots.filter((x) => x !== null);
      assert.ok(ids.length - P <= start.params.list);
      const score = ids.map((a) => ids.map((b) => (a === b ? null : pts.get(`${a},${b}`))));
      const noise = start.params.noise ? { se: ids.map((a) => ids.map((b) => (a === b ? 0 : se.get(`${a},${b}`)))), z: start.params.noise } : {};
      const columns = start.params.diversity === 'panel' ? ids.map((id) => panel.has(id)) : null; // --diversity panel
      const js = share(pushoffValues(score, ids.map((_, i) => i), { variant: start.params.sd, alpha: start.params.alpha, columns, ...noise }), ids, score);
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
  assert.ok(parentDistances > 0, 'no difference to a parent checked');
  checkValues.pushoffs = pushoffs;
  checkValues.niches = niches; // push-offs where --niche or --specialists changed who left
  checkValues.specials = specials;
  checkValues.specialParents = specialParents; // children of a protected parent
  checkValues.sharings = sharings;
  checkValues.sharedLeaves = sharedLeaves; // push-offs where the weights changed who left
  checkValues.roundings = roundings; // push-offs decided between values equal up to rounding
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

// The batch event counts, per change, its children [bred, evaluated, past
// the screen, still in the list after the batch]; they agree with the
// newcomers and leavers of the batch.
function checkOps(evs) {
  let batches = 0;
  for (const b of evs.filter((e) => e.type === 'batch')) {
    const enters = evs.filter((e) => e.type === 'enter' && e.batch === b.batch);
    const left = new Set(evs.filter((e) => e.type === 'leave' && e.batch === b.batch).map((e) => e.id));
    const has = (e, op) => e.ops.split(' ').includes(op);
    let bred = 0;
    for (const [op, [n0, n1, n2, n3]] of Object.entries(b.ops)) {
      assert.ok(n0 >= n1 && n1 >= n2 && n2 >= n3, `${op} in batch ${b.batch}`);
      assert.equal(n2, enters.filter((e) => has(e, op)).length, `${op} past the screen in batch ${b.batch}`);
      assert.equal(n3, enters.filter((e) => has(e, op) && !left.has(e.id)).length, `${op} still in after batch ${b.batch}`);
      bred += n0;
    }
    assert.ok(bred >= b.candidates, `batch ${b.batch}: ${bred} children counted for ${b.candidates} candidates`);
    for (const e of enters) for (const op of e.ops.split(' ')) assert.ok(b.ops[op], `${op} of ${e.name} not counted`);
    batches++;
  }
  return batches;
}

test('survivors of the screen enter by their screen score', { skip }, () => {
  assert.equal(checkOps(base), 6);
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
  assert.equal(checkOps(one), 6);
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
  run(join(tmp, 'mix3'), [...args, '--threads', '3', '--batches', '5']);
  assert.deepEqual(stable(events(join(tmp, 'mix3'))), stable(one));
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
  run(join(tmp, 'sm3'), [...args, '--threads', '3', '--batches', '6']);
  assert.deepEqual(stable(events(join(tmp, 'sm3'))), stable(one));
  run(join(tmp, 'sm-resumed'), [...args, '--threads', '2', '--batches', '3']);
  run(join(tmp, 'sm-resumed'), ['--threads', '4', '--batches', '3']);
  assert.deepEqual(stable(events(join(tmp, 'sm-resumed'))), stable(one));
  const bad = spawnSync(evolve, [join(tmp, 'sm-bad'), ...TINY, '--panel-files', 'afterstorm.red,nothere.red'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /nothere\.red is not a warrior/);
});

test('--noise 1: the distance counts differences beyond the noise, the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.noise, 0);
  const args = [...TINY, '--noise', '1'];
  run(join(tmp, 'noise1'), [...args, '--threads', '1', '--batches', '5']);
  const one = events(join(tmp, 'noise1'));
  assert.equal(one[0].params.noise, 1);
  assert.equal(checkValues(one), 5); // against tools/diversity.js with the standard errors of the logged matches
  // the distances are smaller than without: the noise of 40 rounds is a good part of them
  const dist = (evs) => evs.filter((e) => e.type === 'values').at(-1).values.reduce((s, v) => s + v[2], 0);
  assert.ok(dist(one) < dist(base.filter((e) => e.type !== 'values' || e.batch < 5)) * 0.8, `${dist(one)} against ${dist(base)}`);
  run(join(tmp, 'noise3'), [...args, '--threads', '3', '--batches', '5']);
  assert.deepEqual(stable(events(join(tmp, 'noise3'))), stable(one));
  run(join(tmp, 'noise-resumed'), [...args, '--threads', '2', '--batches', '2']);
  run(join(tmp, 'noise-resumed'), ['--threads', '4', '--batches', '3']);
  assert.deepEqual(stable(events(join(tmp, 'noise-resumed'))), stable(one));
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
  // the early decisions: the push-off on everyone's first-stage results (the
  // panel's from its event, everyone else's from the enter events) gives the
  // newcomer the lowest value, with the logged values
  const p1 = new Map(), put1 = (a, b, w, l, t) => { p1.set(`${a},${b}`, ((3 * w + t) * 100) / (w + l + t)); p1.set(`${b},${a}`, ((3 * l + t) * 100) / (w + l + t)); };
  const slots = one[0].panel.map((w) => w.id);
  let decisions = 0, kept = 0;
  // the early rule (evolve.c, STAGE_CUT 8): fewer than 8 members weaker on the
  // first stage, and none, or its nearest no weaker
  const firstStage = () => {
    const ids = slots.filter((x) => x !== null);
    const score = ids.map((a) => ids.map((b) => (a === b ? null : p1.get(`${a},${b}`))));
    return { ids, v: pushoffValues(score, ids.map((_, i) => i), { variant: one[0].params.sd, alpha: one[0].params.alpha }) };
  };
  const rule = ({ ids, v }, id) => {
    const mine = v[ids.indexOf(id)];
    const below = v.filter((x, i) => !P.has(ids[i]) && x.value < mine.value).length;
    return below < 8 && (below === 0 || v[mine.nearest].value >= mine.value);
  };
  one.forEach((e, at) => {
    if (e.type === 'panel') for (const [a, b, w, l, t] of e.scores1) put1(a, b, w, l, t);
    if (e.type === 'enter') {
      let s = slots.indexOf(null, P.size);
      if (s < 0) s = slots.push(null) - 1;
      slots[s] = e.id;
      for (const [o, w, l, t] of e.scores) put1(e.id, o, w, l, t);
      // one that played all its rounds with the list full did not meet the rule
      if (one[at + 1].type === 'complete' && slots.filter((x) => x !== null).length - P.size > one[0].params.list) {
        assert.ok(!rule(firstStage(), e.id), `${e.id} met the early rule and played all its rounds`);
        kept++;
      }
    }
    if (e.type === 'leave') {
      if (e.early) {
        const { ids, v } = firstStage();
        assert.ok(rule({ ids, v }, e.id), `${e.id} left early against the rule`);
        const mine = v[ids.indexOf(e.id)];
        assert.ok(Math.abs(mine.value - e.value) < 1e-4 * Math.max(1, e.value) && Math.abs(mine.avg - e.avg) < 1e-4, `early values of ${e.id}: ${JSON.stringify(mine)} against ${e.value}`);
        decisions++;
      }
      slots[slots.indexOf(e.id)] = null;
    }
  });
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
  run(join(tmp, 'stage3'), [...args, '--threads', '3', '--batches', '6']);
  assert.deepEqual(stable(events(join(tmp, 'stage3'))), stable(one));
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

test('--diversity panel --panel-rounds 250: the distance over the panel, longer matches against it in blocks; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.diversity, 'all');
  assert.equal(base[0].params.panelRounds, 40);
  for (const stage of ['0', '10']) {
    const args = [...TINY, '--diversity', 'panel', '--panel-rounds', '250', '--stage', stage, '--list', '8'];
    run(join(tmp, `dp1-${stage}`), [...args, '--threads', '1', '--batches', '5']);
    const one = events(join(tmp, `dp1-${stage}`));
    assert.equal(one[0].params.diversity, 'panel');
    assert.equal(one[0].params.panelRounds, 250);
    assert.equal(checkValues(one), 5); // the values against tools/diversity.js with the panel's columns, every pair complete
    // a match against a panel warrior has 250 rounds, played in blocks of 100: the same in the WebAssembly engine
    const st = one[0], P = new Set(st.panel.map((w) => w.id));
    const code = new Map(st.panel.map((w) => [w.id, w.source]));
    const m = createMarsSync(RULES);
    let replayed = 0;
    for (const e of one.filter((x) => x.type === (stage === '0' ? 'enter' : 'complete')).slice(2, 5)) {
      const me = stage === '0' ? `;name x\n${e.code}` : `;name x\n${one.find((x) => x.type === 'enter' && x.id === e.id).code}`;
      const [o, w, l, t, seed] = e.scores.find(([x, a, b, c]) => P.has(x) && [a, b, c].filter((v) => v > 0).length > 1) ?? e.scores.find(([x]) => P.has(x));
      const r = m.runMatch([assemble(me, RULES), assemble(code.get(o), RULES)], { seed, rounds: 250 });
      assert.deepEqual([r.warriors[0].wins, r.warriors[0].losses, r.warriors[0].ties], [w, l, t], `${e.id} against panel ${o}`);
      replayed++;
    }
    assert.equal(replayed, 3);
    run(join(tmp, `dp3-${stage}`), [...args, '--threads', '3', '--batches', '5']);
    assert.deepEqual(stable(events(join(tmp, `dp3-${stage}`))), stable(one));
    run(join(tmp, `dp-resumed-${stage}`), [...args, '--threads', '2', '--batches', '2']);
    run(join(tmp, `dp-resumed-${stage}`), ['--threads', '4', '--batches', '3']);
    assert.deepEqual(stable(events(join(tmp, `dp-resumed-${stage}`))), stable(one));
  }
  const bad = spawnSync(evolve, [join(tmp, 'dp-bad'), ...TINY, '--panel-rounds', '20'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});

test('the style of a newcomer is that of tools/style.js in the WebAssembly engine', { skip }, () => {
  const st = base[0];
  const m = createMarsSync({ ...RULES, watch: true });
  const opp = st.panel.slice(0, 3).map((w) => assemble(w.source, RULES));
  const enters = base.filter((e) => e.type === 'enter');
  let kinds = new Set();
  for (const e of enters.filter((_, i) => i % 3 === 0)) {
    const js = measureStyle(m, assemble(`;name x\n${e.code}`, RULES), opp);
    const { kind, ...numbers } = e.style;
    for (const [k, v] of Object.entries(js)) assert.ok(Math.abs(numbers[k] - v) < 1e-5, `${e.name}: ${k} ${numbers[k]}, in JS ${v}`);
    assert.equal(kind, styleKind(js), e.name);
    kinds.add(kind);
  }
  assert.ok(kinds.size >= 2, `only ${[...kinds]}`);
});

test('--niche 4: the last 4 members of a kind of style do not leave; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.niche, 0);
  const N = 4, LIST = 10, BATCHES = 10;
  const args = [...TINY, '--niche', String(N), '--list', String(LIST)];
  run(join(tmp, 'niche1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'niche1'));
  assert.equal(one[0].params.niche, N);
  assert.equal(checkValues(one), BATCHES);
  assert.ok(checkValues.niches >= 2, `--niche changed who left in ${checkValues.niches} push-offs`);
  // replay: the kinds of the members; at each push-off a kind with 2 members
  // or fewer (not the two kinds of junk) is protected, unless everybody is
  const junk = new Set(['dies at once', 'writes little (scanner, or waits)']);
  const kind = new Map(), alive = new Set();
  let leaves = 0, protectedLeaves = 0;
  for (const e of one) {
    if (e.type === 'enter') kind.set(e.id, e.style.kind), alive.add(e.id);
    if (e.type === 'leave') {
      const count = new Map();
      for (const id of alive) count.set(kind.get(id), (count.get(kind.get(id)) ?? 0) + 1);
      const safe = (id) => !junk.has(kind.get(id)) && count.get(kind.get(id)) <= N;
      const anyFree = [...alive].some((id) => !safe(id));
      if (anyFree) assert.ok(!safe(e.id), `${e.id} left, the last ${count.get(kind.get(e.id))} of ${kind.get(e.id)}`);
      if ([...alive].some(safe)) protectedLeaves++;
      alive.delete(e.id);
      leaves++;
    }
  }
  assert.ok(leaves >= 8 && protectedLeaves >= 3, `${leaves} push-offs, ${protectedLeaves} with a protected kind in the list`);
  run(join(tmp, 'niche3'), [...args, '--threads', '3', '--batches', String(BATCHES)]);
  assert.deepEqual(stable(events(join(tmp, 'niche3'))), stable(one));
  run(join(tmp, 'niche-resumed'), [...args, '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'niche-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'niche-resumed'))), stable(one));
});

test('--specialists --panel-choice kinds: the member clearly best against a panel warrior stays, a panel of every kind; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.specialists, false);
  const BATCHES = 20;
  const args = [...TINY, '--specialists', '--panel-choice', 'kinds', '--pick-sample', '40', '--list', '16', '--panel-rounds', '200', '--survivors', '8'];
  run(join(tmp, 'spec1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'spec1'));
  assert.deepEqual([one[0].params.specialists, one[0].params.panelChoice], [true, 'kinds']);
  // every push-off with the protection replayed, every specialists event recomputed
  assert.equal(checkValues(one), BATCHES);
  assert.ok(checkValues.specials >= 2, `the protection changed who left in ${checkValues.specials} push-offs`);
  assert.ok(checkValues.specialParents >= 5, `${checkValues.specialParents} children of a protected parent`);
  assert.equal(one.filter((e) => e.type === 'specialists').length, BATCHES);
  // the panel: the kinds take turns, each kind's strongest first
  const picks = one.find((e) => e.type === 'pick').picked;
  const kinds = [...new Set(picks.map((p) => p.kind))];
  assert.ok(kinds.length >= 3, kinds.join(', '));
  assert.deepEqual(picks.slice(0, kinds.length).map((p) => p.kind).sort(), [...kinds].sort(), 'one of each kind first');
  for (const k of kinds) {
    const ranks = picks.filter((p) => p.kind === k).map((p) => p.rank);
    assert.equal(ranks[0], Math.min(...ranks), `${k}: the strongest first`);
  }
  // a kind gets its next pick only when no kind has fewer (while it has warriors left)
  const seen = new Map();
  for (const p of picks) {
    const n = seen.get(p.kind) ?? 0;
    const fewer = kinds.filter((k) => (seen.get(k) ?? 0) < n && picks.slice(picks.indexOf(p)).some((q) => q.kind === k));
    assert.deepEqual(fewer, [], `${p.file} (${p.kind}) before a pick of ${fewer.join(', ')}`);
    seen.set(p.kind, n + 1);
  }
  run(join(tmp, 'spec3'), [...args, '--threads', '3', '--batches', String(BATCHES)]);
  assert.deepEqual(stable(events(join(tmp, 'spec3'))), stable(one));
  run(join(tmp, 'spec-resumed'), [...args, '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'spec-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'spec-resumed'))), stable(one));
});

test('--sharing 20: the average weighted by how hard each panel warrior is for the members; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.sharing, 0);
  const BATCHES = 16;
  const args = [...TINY, '--sharing', '20', '--list', '16', '--panel-rounds', '200', '--survivors', '8'];
  run(join(tmp, 'share1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'share1'));
  assert.equal(one[0].params.sharing, 20);
  // every weight from the members' means, every push-off and value with them
  assert.equal(checkValues(one), BATCHES);
  assert.equal(checkValues.sharings, BATCHES);
  assert.ok(checkValues.sharedLeaves >= 2, `the weights changed who left in ${checkValues.sharedLeaves} push-offs`);
  // an early leave (--stage) is decided on the first-stage results, weighted
  // the same: the leaver's average is its entering row with the weights
  run(join(tmp, 'share-stage'), [...args, '--stage', '20', '--threads', '2', '--batches', '12']);
  const st = events(join(tmp, 'share-stage'));
  assert.equal(checkValues(st), 12);
  let weights = null, early = 0;
  const P = new Set(st[0].panel.map((x) => x.id));
  const enters = new Map(st.filter((e) => e.type === 'enter').map((e) => [e.id, e]));
  for (const e of st) {
    if (e.type === 'sharing') weights = { w: new Map(e.weights.map(([o, x]) => [o, x])), member: e.member };
    if (e.type === 'leave' && e.early) {
      let num = 0, den = 0;
      for (const [o, wi, l, t] of enters.get(e.id).scores) {
        const x = weights ? (P.has(o) ? weights.w.get(o) : weights.member) : 1;
        num += x * ((3 * wi + t) * 100) / (wi + l + t), den += x;
      }
      assert.ok(Math.abs(num / den - e.avg) < 1e-4, `early leave of ${e.id}: ${e.avg}, weighted ${num / den}`);
      if (weights) early++;
    }
  }
  assert.ok(early >= 3, `${early} early leaves with weights`);
  const w = one.filter((e) => e.type === 'sharing').at(-1).weights.map((x) => x[1]);
  assert.ok(Math.max(...w) / Math.min(...w) > 1.5 && Math.max(...w) / Math.min(...w) <= 300 / 20 + 1, `weights ${Math.min(...w)} to ${Math.max(...w)}`);
  run(join(tmp, 'share3'), [...args, '--threads', '3', '--batches', String(BATCHES)]);
  assert.deepEqual(stable(events(join(tmp, 'share3'))), stable(one));
  run(join(tmp, 'share-resumed'), [...args, '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'share-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'share-resumed'))), stable(one));
  // refused together with --rotate
  const r = spawnSync(evolve, [join(tmp, 'share-rot'), ...args, '--rotate', '2', '--batches', '1'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
});

test('--screen-check 3 is the run without it and logs every bound; --screen-stop 3 stops those children; the same run on any thread count and after a resume', { skip }, () => {
  const BATCHES = 8;
  const args = [...TINY, '--screen-rounds', '20', '--rounds', '40', '--panel-rounds', '40', '--batch', '48', '--list', '20'];
  run(join(tmp, 'sc0'), [...args, '--threads', '2', '--batches', String(BATCHES)]);
  run(join(tmp, 'sc1'), [...args, '--screen-check', '3', '--threads', '2', '--batches', String(BATCHES)]);
  const plain = events(join(tmp, 'sc0')), check = events(join(tmp, 'sc1'));
  const same = (evs) => stable(evs).filter((e) => e.type !== 'screen' && e.type !== 'start');
  assert.deepEqual(same(check), same(plain)); // the check plays everything
  assert.equal(check[0].params.screenCheck, 3);
  const P = check[0].panel.length, F = 20;
  // every child it would stop: its bound from its results so far, below the threshold or the cut
  let stops = 0, cuts = 0;
  for (const s of check.filter((e) => e.type === 'screen')) {
    assert.equal(s.check, true);
    assert.equal(s.stopped, s.steps.reduce((a, st) => a + st.stopped.length, 0));
    for (const st of s.steps) {
      // the cut: the 16th largest lower bound of the children still in
      const sorted = [...st.lo].sort((a, b) => b - a);
      assert.equal(st.cut, sorted.length > check[0].params.survivors ? sorted[check[0].params.survivors - 1] : -1e300);
      for (const row of st.stopped) {
        const q = row.length / 3, n = st.rounds;
        assert.equal(q, P); // TINY: no members in the screen
        let x = 0, s2 = 0;
        for (let k = 0; k < q; k++) {
          const [w, , t] = row.slice(3 * k, 3 * k + 3);
          assert.equal(row[3 * k] + row[3 * k + 1] + row[3 * k + 2], n);
          x += ((3 * w + t) * 100) / n;
          const pw = (w + 1) / (n + 3), pt = (t + 1) / (n + 3), mu = 300 * pw + 100 * pt;
          s2 += 90000 * pw + 10000 * pt - mu * mu;
        }
        x /= q;
        s2 /= q * q;
        const hi = x + 3 * Math.sqrt((s2 * (F - n)) / (F * n));
        assert.ok(hi < Math.max(st.threshold, st.cut) + 1e-9, `batch ${s.batch}, after ${n}: ${hi} against ${st.threshold}, ${st.cut}`);
        if (hi >= st.threshold) cuts++;
        stops++;
      }
    }
    assert.ok(s.rounds <= s.full);
    // the check played on: the whole screen of each child it would have stopped
    assert.equal(s.finals.length, s.stopped);
    for (const [screen, ...row] of s.finals) {
      let x = 0;
      for (let k = 0; k < P; k++) {
        const [w, l, t] = row.slice(3 * k, 3 * k + 3);
        assert.equal(w + l + t, F);
        x += ((3 * w + t) * 100) / F;
      }
      assert.ok(Math.abs(x / P - screen) < 1e-9);
    }
  }
  assert.ok(stops >= 20 && cuts >= 5, `${stops} would stop, ${cuts} by the cut`);
  // --screen-stop: the same decisions, so with no survivor missed the same run
  run(join(tmp, 'sc2'), [...args, '--screen-stop', '3', '--threads', '1', '--batches', String(BATCHES)]);
  const stop = events(join(tmp, 'sc2'));
  const sc = (evs) => evs.filter((e) => e.type === 'screen').map(({ stopped, rounds, full }) => [stopped, rounds, full]);
  assert.ok(check.filter((e) => e.type === 'screen').every((s) => s.missed === 0)); // in this fixture
  assert.deepEqual(same(stop), same(plain));
  assert.deepEqual(sc(stop), sc(check));
  assert.equal(checkValues(stop), BATCHES);
  run(join(tmp, 'sc3'), [...args, '--screen-stop', '3', '--threads', '3', '--batches', String(BATCHES)]);
  assert.deepEqual(stable(events(join(tmp, 'sc3'))), stable(stop));
  run(join(tmp, 'sc-resumed'), [...args, '--screen-stop', '3', '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'sc-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'sc-resumed'))), stable(stop));
  // not with --race
  assert.notEqual(spawnSync(evolve, [join(tmp, 'sc-race'), ...args, '--screen-stop', '3', '--race', '5', '--batches', '1'], { encoding: 'utf8' }).status, 0);
});

test('--optimize: the constants of a warrior, steps confirmed with other seeds, the same on any thread count', { skip }, () => {
  // a stone whose step of 100 bombs 8 cells of a core of 800
  const file = join(tmp, 'badstep.red');
  writeFileSync(file, ';redcode\n;name bad step\nstep equ 100\nloop add.ab #step, bomb\nmov.i bomb, @bomb\njmp loop\nbomb dat #0, #step\n');
  const args = ['--optimize', file, ...TINY.slice(0, TINY.indexOf('--panel')), '--panel', '12', '--holdout', '8', '--rounds', '60', '--seed', '3'];
  run(join(tmp, 'opt1'), [...args, '--threads', '1']);
  const one = events(join(tmp, 'opt1'));
  const start = one[0], end = one.at(-1), steps = one.filter((e) => e.type === 'optimize-step');
  assert.equal(start.type, 'optimize');
  assert.equal(end.type, 'optimize-end');
  assert.ok(steps.length >= 1 && end.avg > start.avg + 20, `${steps.length} steps, ${start.avg} to ${end.avg}`);
  for (const s of steps) assert.ok(s.gain > 2 * s.se && s.confirm > 2 * s.confirmSe, JSON.stringify(s));
  // the optimized warrior against the panel, replayed in the WebAssembly engine with the logged seeds
  const opt = assemble(readFileSync(join(tmp, 'opt1', 'optimized.red'), 'latin1'), RULES);
  assert.ok(opt.ok);
  const m = createMarsSync(RULES);
  let sum = 0;
  for (const p of start.panel) {
    const r = m.runMatch([opt, assemble(readFileSync(join(root, 'warriors/koenigstuhl/tiny', p.file), 'latin1'), RULES)], { seed: p.seed, rounds: start.rounds });
    sum += ((3 * r.warriors[0].wins + r.warriors[0].ties) * 100) / start.rounds;
  }
  assert.ok(Math.abs(sum / start.panel.length - end.avg) < 1e-6, `replayed ${sum / start.panel.length}, logged ${end.avg}`);
  assert.match(readFileSync(join(tmp, 'opt1', 'optimized.red'), 'latin1'), /;strategy bad step with its constants optimized by 42evolve: \d+ steps/);
  run(join(tmp, 'opt3'), [...args, '--threads', '3']);
  assert.deepEqual(events(join(tmp, 'opt3')), one);
  // a hill warrior whose constants are good already: what it might accept is
  // near the noise, and every step taken must be clear of it twice
  const hill = ['--optimize', join(root, 'warriors/koenigstuhl/tiny/afterstorm.red'), ...args.slice(2)];
  run(join(tmp, 'opt-hill'), [...hill, '--threads', '4']);
  const h = events(join(tmp, 'opt-hill'));
  for (const s of h.filter((e) => e.type === 'optimize-step')) assert.ok(s.gain > 2 * s.se && s.confirm > 2 * s.confirmSe, JSON.stringify(s));
  assert.ok(h.at(-1).avg >= h[0].avg, `${h[0].avg} to ${h.at(-1).avg}`);
});

test('the defaults: the best run of E5, with a panel picked from a round robin; the same on any thread count', { skip }, () => {
  const rules = TINY.slice(0, TINY.indexOf('--panel'));
  const args = [...rules, '--seed', '5', '--pick-sample', '40', '--batch', '16', '--batches', '1'];
  run(join(tmp, 'def4'), [...args, '--threads', '4']);
  const one = events(join(tmp, 'def4'));
  const p = one[0].params;
  assert.deepEqual([p.list, p.panel, p.screenMembers, p.diversity, p.panelRounds, p.fill, p.stage, p.panelChoice], [80, 20, 10, 'panel', 500, true, p.screenRounds, 'picked']);
  const pick = one[1];
  assert.equal(pick.type, 'pick');
  assert.equal(pick.sample, 40);
  assert.equal(pick.picked.length, 20);
  assert.deepEqual(one[0].panel.map((w) => w.file), pick.picked.map((x) => x.file), 'the panel is the picked, in the order picked');
  assert.equal(new Set(pick.picked.map((x) => x.file)).size, 20);
  // the strongest first; all from the strongest quarter, at least as many as the panel (20 of the 40); each the farthest from the ones before it
  assert.equal(pick.picked[0].rank, 0);
  assert.ok(pick.picked.every((x) => x.rank < Math.max(Math.ceil(40 / 4), 20) && x.avg <= pick.picked[0].avg + 1e-9), JSON.stringify(pick.picked.map((x) => x.rank)));
  assert.equal(pick.picked[0].distance, 0);
  for (let i = 2; i < 20; i++) assert.ok(pick.picked[i].distance <= pick.picked[i - 1].distance + 1e-9, `pick ${i} is farther than the one before`);
  assert.ok(!one[0].holdout.some((h) => pick.picked.some((x) => x.file === h.file)), 'a picked warrior in the holdout');
  run(join(tmp, 'def1'), [...args, '--threads', '1']);
  assert.deepEqual(stable(events(join(tmp, 'def1'))), stable(one));
});

test('--map-elites: cells by style, each with its best warrior; the same run on any thread count and after a resume', { skip }, () => {
  const rules = TINY.slice(0, TINY.indexOf('--panel'));
  const args = ['--map-elites', ...rules, '--seed', '9', '--pick-sample', '40', '--holdout', '8', '--rounds', '40', '--screen-rounds', '10',
    '--panel-rounds', '100', '--batch', '48', '--bench-every', '3'];
  run(join(tmp, 'me1'), [...args, '--threads', '1', '--batches', '8']);
  const one = events(join(tmp, 'me1'));
  assert.equal(one[0].params.mapElites, true);
  assert.deepEqual([one[0].params.panel, one[0].params.panelChoice], [80, 'random']); // the defaults of --map-elites
  const st = one[0], P = st.panel.length;
  const scoresOf = new Map();
  const opp = st.panel.slice(0, 3).map((w) => assemble(w.source, RULES));
  const m = createMarsSync({ ...RULES, watch: true });
  const bin = (x, edges) => edges.filter((e) => x >= e).length;
  const cells = new Map(); // index -> [id, avg]
  let elites = 0, replaced = 0;
  for (const e of one.filter((x) => x.type === 'elite')) {
    // the cell follows from the style, and the style is that of tools/style.js
    const s = e.style;
    assert.equal(e.index, bin(s.copies, [20, 200, 600]) * 12 + bin(s.tasks, [2, 50, 250]) * 3 + bin(s.read, [50, 300]), e.name);
    assert.deepEqual(e.cell, [Math.floor(e.index / 12), Math.floor(e.index / 3) % 4, e.index % 3]);
    if (elites % 4 === 0) {
      const js = measureStyle(m, assemble(`;name x\n${e.code}`, RULES), opp);
      for (const [k, v] of Object.entries(js)) assert.ok(Math.abs(s[k] - v) < 1e-5, `${e.name}: ${k}`);
    }
    // its average: the logged matches against the panel, all panel rounds each
    assert.equal(e.scores.length, P);
    for (const [, w, l, t] of e.scores) assert.equal(w + l + t, 100);
    const avg = e.scores.reduce((sum, [, w, , t]) => sum + 3 * w + t, 0) / P;
    assert.ok(Math.abs(avg - e.avg) < 1e-6, `${e.name}: ${avg} against ${e.avg}`);
    // better than the one it replaced, which was the cell's warrior: by more
    // than 2 standard errors of the differences per panel warrior
    const before = cells.get(e.index);
    scoresOf.set(e.id, e.scores);
    if (before) {
      assert.deepEqual([e.replaced.id, e.replaced.avg.toFixed(4)], [before[0], before[1].toFixed(4)]);
      const old = scoresOf.get(e.replaced.id);
      const d = e.scores.map(([o, w, , t], j) => { assert.equal(old[j][0], o); return 3 * w + t - (3 * old[j][1] + old[j][3]); });
      const mean = d.reduce((a, b) => a + b, 0) / P, se = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (P - 1) / P);
      assert.ok(Math.abs(mean - e.replaced.gain) < 1e-6 && Math.abs(se - e.replaced.se) < 1e-6, `${e.name}: ${mean} ${se} against ${JSON.stringify(e.replaced)}`);
      assert.ok(mean > 2 * se, `${e.name} took a cell by ${mean}, standard error ${se}`);
      replaced++;
    } else assert.equal(e.replaced, undefined);
    cells.set(e.index, [e.id, e.avg]);
    elites++;
  }
  assert.ok(elites > 10 && replaced > 3 && cells.size > 3, `${elites} warriors took cells, ${replaced} replaced one, ${cells.size} cells`);
  const last = one.filter((x) => x.type === 'batch').at(-1);
  assert.equal(last.cells, cells.size);
  assert.ok(Math.abs(last.best - Math.max(...[...cells.values()].map((c) => c[1]))) < 1e-6);
  assert.ok(one.some((x) => x.type === 'bench'));
  run(join(tmp, 'me4'), [...args, '--threads', '4', '--batches', '8']);
  assert.deepEqual(stable(events(join(tmp, 'me4'))), stable(one));
  run(join(tmp, 'me-resumed'), [...args, '--threads', '2', '--batches', '3']);
  run(join(tmp, 'me-resumed'), ['--threads', '3', '--batches', '5']);
  assert.deepEqual(stable(events(join(tmp, 'me-resumed'))), stable(one));
});

test('--map-elites crowding: a child competes with its nearest by SD-score; one unlike all replaces the weaker of the closest pair; the same run on any thread count and after a resume', { skip }, () => {
  const rules = TINY.slice(0, TINY.indexOf('--panel'));
  const args = ['--map-elites', 'crowding', ...rules, '--seed', '9', '--panel', '40', '--holdout', '8', '--rounds', '40', '--screen-rounds', '10',
    '--panel-rounds', '100', '--batch', '48', '--list', '12', '--bench-every', '3'];
  run(join(tmp, 'cr1'), [...args, '--threads', '1', '--batches', '12']);
  const one = events(join(tmp, 'cr1'));
  assert.deepEqual([one[0].params.mapElites, one[0].params.crowding], [true, true]);
  const P = one[0].panel.length;
  const pts = (scores) => scores.map(([, w, l, t]) => (3 * w + t) * 100 / (w + l + t));
  const places = new Map(); // place -> { id, avg, row }
  const sigmaOf = () => [...Array(P).keys()].map((j) => {
    const xs = [...places.keys()].sort((a, b) => a - b).map((c) => places.get(c).row[j]);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
  });
  const dist = (a, b, sigma) => a.reduce((s, x, j) => (sigma[j] > 0 ? s + Math.abs(x - b[j]) / sigma[j] : s), 0);
  const close = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
  const count = { empty: 0, near: 0, far: 0 };
  let sigma = null, batch = -1;
  for (const e of one.filter((x) => x.type === 'elite')) {
    if (e.batch !== batch) batch = e.batch, sigma = null;
    const row = pts(e.scores);
    assert.equal(row.length, P);
    assert.ok(close(row.reduce((a, b) => a + b, 0) / P, e.avg), e.name);
    count[e.rule]++;
    if (e.rule === 'empty') {
      assert.ok(places.size < 12 && !places.has(e.index), e.name);
      assert.ok([...Array(e.index).keys()].every((c) => places.has(c)), `${e.name}: the first free place`);
      assert.equal(e.replaced, undefined);
    } else {
      assert.equal(places.size, 12);
      sigma ??= sigmaOf(); // once a batch, from the full archive
      const order = [...places.keys()].sort((a, b) => a - b);
      let near = -1, dn = Infinity, pa = -1, pb = -1, dp = Infinity;
      for (const c of order) { const d = dist(row, places.get(c).row, sigma); if (d < dn) dn = d, near = c; }
      for (const a of order) for (const b of order) {
        if (b <= a) continue;
        const d = dist(places.get(a).row, places.get(b).row, sigma);
        if (d < dp) dp = d, pa = a, pb = b;
      }
      assert.ok(close(e.distance, dn) && close(e.pair, dp), `${e.name}: ${e.distance} ${e.pair} against ${dn} ${dp}`);
      const old = places.get(e.index);
      assert.equal(e.replaced.id, old.id);
      if (e.rule === 'near') { // its nearest, beaten by more than 2 standard errors of the paired differences
        assert.ok(dn <= dp && e.index === near, `${e.name}: nearest ${near}, took ${e.index}`);
        const d = row.map((x, j) => x - old.row[j]);
        const mean = d.reduce((a, b) => a + b, 0) / P, se = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (P - 1) / P);
        assert.ok(close(mean, e.replaced.gain) && mean > 2 * se, `${e.name}: ${mean} ${se}`);
        assert.equal(e.newFamily, false);
      } else { // farther than the closest pair: the weaker of that pair, by a higher average, and above half of the archive
        assert.ok(dn > dp, e.name);
        const weak = places.get(pa).avg < places.get(pb).avg ? pa : pb;
        assert.equal(e.index, weak, `${e.name}: the pair ${pa} ${pb}`);
        assert.ok(e.avg > old.avg, e.name);
        assert.ok(2 * [...places.values()].filter((x) => x.avg < e.avg).length >= 12, `${e.name}: ${e.avg} below the median`);
        assert.equal(e.newFamily, e.parents.length > 0);
      }
    }
    places.set(e.index, { id: e.id, avg: e.avg, row });
  }
  assert.ok(count.empty === 12 && count.near > 2 && count.far > 2, JSON.stringify(count));
  run(join(tmp, 'cr4'), [...args, '--threads', '4', '--batches', '12']);
  assert.deepEqual(stable(events(join(tmp, 'cr4'))), stable(one));
  run(join(tmp, 'cr-resumed'), [...args, '--threads', '2', '--batches', '5']);
  run(join(tmp, 'cr-resumed'), ['--threads', '3', '--batches', '7']);
  assert.deepEqual(stable(events(join(tmp, 'cr-resumed'))), stable(one));
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
  const entered = base.filter((e) => e.type === 'enter');
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
