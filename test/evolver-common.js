// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// What the evolver's test files (test/evolver*.test.js) share: the tiny hill
// they run 42evolve on, the programs (built once by test/native.js, or
// prebuilt in M42_BIN), the run of 6 batches several tests compare with
// (base), and the replays of a run's events: the push-off values as
// tools/diversity.js computes them, the early decisions of --stage, the order
// of the survivors, the counts per change, --simple, the mirrored positions.
// One file per topic, so that node --test runs them in parallel.
//
// "The same run on any thread count and after a resume": a run on 1 thread,
// and the same run in two parts, the second one resumed, on 2 and then 3 or 4
// threads; one comparison covers both (a third run on 3 or 4 threads made
// the tests a third longer and found nothing the resumed run would not).

import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { columnSigmas, paretoFronts, pushoffValues, sdDistance, standardError, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { bestRedInfo } from '../tools/progress.js';
import { builtProgram, prebuilt, program, skip as noCc } from './native.js';

export const root = fileURLToPath(new URL('..', import.meta.url));
// each test file is its own process, with its own folder
export const tmp = mkdtempSync(join(tmpdir(), 'evolver-test-'));
export const cleanup = () => rmSync(tmp, { recursive: true, force: true });
export let evolve = prebuilt ? program(prebuilt, '42evolve') : null;
export let unit = prebuilt ? program(prebuilt, 'evolver-test') : null;
export let spectrum = prebuilt ? program(prebuilt, '42spectrum') : null;
export const skip = noCc || (process.platform === 'win32' && 'POSIX only') || (prebuilt && !existsSync(evolve) && `no 42evolve in ${prebuilt}`) || false;

const EVOLVER = ['evolver/evolve.c', 'evolver/genome.c', 'evolver/pushoff.c', 'evolver/names.c', 'evolver/style.c'];

// 2000 cycles, not the 8000 of the tiny hill: evolved warriors soon survive whole rounds, and the tests took
// 2.4 times as long with them
export const RULES = { coreSize: 800, maxCycles: 2000, maxProcesses: 800, maxLength: 20, minDistance: 20 };
export const TINY = ['--opponents', join(root, 'warriors/koenigstuhl/tiny'), '--size', '800', '--cycles', '2000', '--processes', '800',
  '--length', '20', '--distance', '20', '--panel', '10', '--holdout', '8', '--batch', '24', '--rounds', '40', '--screen-rounds', '10',
  '--bench-every', '2', '--seed', '7',
  // the defaults before the best run of E5 became them; test 'the defaults' has those
  '--list', '20', '--screen-members', '0', '--diversity', 'all', '--panel-rounds', '40', '--no-fill', '--panel-choice', 'random',
  '--positions', 'pmars', // the matches replayed with the seed alone; the mirror has its own test
  '--pushoff', 'value', // the push-off replayed by tools/diversity.js; pareto has its own tests
  '--stage', '0']; // the tests of --stage set it

export function run(dir, args) {
  const r = spawnSync(evolve, [dir, ...args], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  return r;
}
export const events = (dir, file = 'events.jsonl') => readFileSync(join(dir, file), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
// arguments without the named options and their values
export const without = (args, ...names) => args.filter((x, i, a) => !names.includes(x) && !names.includes(a[i - 1]));
// what has to be the same in two runs: everything but timings and resumes
export const stable = (evs) => evs.filter((e) => e.type !== 'speed' && e.type !== 'resume');

// The tiny hill with its own limit of 8000 cycles: in the short runs of the
// tests some things happen only with the longer rounds (children of a new
// family, more than one kind of style, enough duels between parents, a niche
// that keeps a member, both of two Dwarfs as start warriors).
export const CLASSIC = [...without(TINY, '--cycles'), '--cycles', '8000'];
export const RULES_CLASSIC = { ...RULES, maxCycles: 8000 };
let classicEvents = null;
// the base run with CLASSIC, made the first time a test asks for it
export function classic() {
  if (!classicEvents) {
    run(join(tmp, 'classic'), [...CLASSIC, '--threads', '1', '--batches', '6']);
    classicEvents = events(join(tmp, 'classic'));
  }
  return classicEvents;
}

export let base; // the events of the run on one thread, 6 batches
// before() of every file: the programs, then the base run
export async function setup() {
  if (skip) return;
  if (!prebuilt) {
    [evolve, unit, spectrum] = await Promise.all([
      builtProgram('42evolve', EVOLVER, ['-pthread', '-Ilib']),
      builtProgram('evolver-test', ['test/c/evolver-test.c', 'evolver/genome.c', 'evolver/pushoff.c', 'evolver/names.c'], ['-Ilib', '-Ievolver']),
      builtProgram('42spectrum', ['evolver/spectrum.c', 'evolver/genome.c'], ['-pthread', '-Ilib']),
    ]);
  }
  run(join(tmp, 'one'), [...TINY, '--threads', '1', '--batches', '6']);
  base = events(join(tmp, 'one'));
}

// --pushoff pareto: the members' values of v as 42evolve computes them, their
// place in NSGA-II's order on the panel average (without the own column) and
// the average against the other members, with pareto-age also the origin of
// their line (later is younger), with pareto-sd the SD-score to the nearest of
// v: 10 (fronts - front) + min(crowding, 5). Panel warriors keep theirs.
// clear: --clear, { radius, and the options of pushoffValues for the SD-score }:
// the members by average, the strongest first, each a winner unless its
// SD-score to a winner before it is below the radius; the fronts of the
// winners, then those of the cleared ones.
export function paretoValues(v, ids, score, panel, origins, third, clear = null) {
  const ms = ids.map((id, i) => i).filter((i) => !panel.has(ids[i]));
  const cleared = ms.map(() => false);
  if (clear?.radius > 0) {
    const all = ids.map((_, i) => i), sigmas = columnSigmas(score, all);
    const order = ms.map((_, k) => k).sort((a, b) => v[ms[b]].avg - v[ms[a]].avg || a - b);
    order.forEach((k, q) => {
      cleared[k] = order.slice(0, q).some((w) => !cleared[w] && sdDistance(score, all, ms[k], ms[w], clear.variant, clear.se ? { se: clear.se, z: clear.z } : null, clear.columns, clear.ahead, sigmas) < clear.radius);
    });
  }
  const obj = ms.map((i) => {
    const pc = ids.map((b, j) => j).filter((j) => panel.has(ids[j]) && j !== i);
    const mc = ms.filter((j) => j !== i);
    const o = [pc.reduce((t, j) => t + score[i][j], 0) / pc.length, mc.length ? mc.reduce((t, j) => t + score[i][j], 0) / mc.length : 0];
    return third === 'pareto-age' ? [...o, origins.get(ids[i])] : third === 'pareto-sd' ? [...o, v[i].distance] : o;
  });
  const front = [], crowd = [];
  let F = 0;
  for (const c of [false, true]) {
    const at = ms.map((_, k) => k).filter((k) => cleared[k] === c);
    if (!at.length) continue;
    const r = paretoFronts(at.map((k) => obj[k]));
    at.forEach((k, j) => { front[k] = F + r.front[j]; crowd[k] = r.crowd[j]; });
    F += Math.max(...r.front) + 1;
  }
  const out = v.map((x) => ({ ...x }));
  ms.forEach((i, k) => { out[i].value = 10 * (F - front[k]) + Math.min(crowd[k], 5); });
  return out;
}

// The matrix after every event, with slots given out as 42evolve does
// (the lowest free one), and the push-off values of tools/diversity.js.
// Returns the number of values events checked.
export function checkValues(evs) {
  const start = evs[0];
  const rounds = start.params.rounds;
  const P = start.panel.length;
  const noGames = start.params.memberGames === 'none'; // --member-games none: members never play each other
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
  let listNow = start.params.list; // --list on a run that continues: event `list`
  // --difference ahead: the SD-score counts only where a warrior scores more; also from a resume on (event `difference`)
  let ahead = start.params.difference === 'ahead', aheadLeaves = 0;
  // --pushoff pareto: the members' value is their place in NSGA-II's order on the panel average, the average
  // against the other members and the origin of their line (later is younger); 10 (fronts - front) + min(crowding, 5)
  const origins = new Map(); // id -> the batch its line started, from the enter events
  let paretoLeaves = 0, newLines = 0, olderSecond = 0;
  const paretoed = (v, ids, score, o) => (start.params.pushoff?.startsWith('pareto') ? paretoValues(v, ids, score, panel, origins, start.params.pushoff, { radius: start.params.clear, ...o }) : v);
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
  // --average panel: the average of the push-off value over the panel's
  // columns only, without the own one
  let panelLeaves = 0;
  const averaged = (v, ids, score) => {
    if (start.params.average !== 'panel') return v;
    return v.map((x, i) => {
      let s = 0, n = 0;
      ids.forEach((b, j) => { if (j !== i && panel.has(b)) s += score[i][j], n++; });
      const avg = n ? s / n : 0;
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
        const x = e.screenPoints[i] - pts.get(`${o},${k}`), d = ahead ? Math.max(0, x) : Math.abs(x), sg = snap.sigma.get(k);
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
      // the origin of its line: a new family, or no parents in the list when it was bred (random, back from the
      // archive, tuned, a start warrior), start a new one; else the older line of its parents
      const bred = e.parents.length && e.ops !== 'reintroduce' && e.ops !== 'tuned' && e.parents.every((p) => origins.has(p));
      const expect = e.newFamily || !bred ? e.batch : Math.min(...e.parents.map((p) => origins.get(p)));
      if (e.newFamily || !e.parents.length || bred) assert.equal(e.origin, expect, `origin of ${e.id}`);
      if (e.newFamily && e.parents.length) newLines++;
      if (bred && !e.newFamily && e.parents.length === 2 && origins.get(e.parents[1]) < origins.get(e.parents[0])) olderSecond++;
      origins.set(e.id, e.origin);
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
      if (noGames) assert.deepEqual(e.scores.map((x) => x[0]), slots.filter((x) => x !== null && panel.has(x)), '--member-games none: an entering warrior plays the panel only');
      else assert.equal(e.scores.length, slots.filter((x) => x !== null).length - 1, 'an entering warrior plays everyone in');
      // how far its scores are from its first parent's, points per 100
      // rounds on average over everyone else in now; a new family above 30
      const ids = slots.filter((x) => x !== null), p = e.parents[0];
      if (e.parents.length > 0 && ids.includes(p) && !panel.has(p)) {
        const o = ids.filter((x) => x !== e.id && x !== p && (!noGames || panel.has(x)));
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
      const score = ids.map((a) => ids.map((b) => (a === b ? null : pts.get(`${a},${b}`) ?? (noGames ? 0 : undefined))));
      const columns = start.params.diversity === 'panel' ? ids.map((id) => panel.has(id)) : null;
      const noise = start.params.noise ? { se: ids.map((a) => ids.map((b) => (a === b ? 0 : se.get(`${a},${b}`)))), z: start.params.noise } : {};
      const o = { variant: start.params.sd, alpha: start.params.alpha, columns, ahead, ...noise };
      const v = paretoed(averaged(share(pushoffValues(score, ids.map((_, i) => i), o), ids, score), ids, score), ids, score, o);
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
      if (shareW || start.params.average === 'panel') { // the plain average would have pushed out another one
        const plain = pushoffValues(score, ids.map((_, i) => i), { variant: start.params.sd, alpha: start.params.alpha, columns, ahead, ...noise });
        if (ids[weakest(plain, keep)] !== e.id) shareW ? sharedLeaves++ : panelLeaves++;
      }
      if (start.params.pushoff?.startsWith('pareto')) { // the push-off value would have pushed out another one
        const plain = pushoffValues(score, ids.map((_, i) => i), { variant: start.params.sd, alpha: start.params.alpha, columns, ...noise });
        if (ids[weakest(plain, keep)] !== e.id) paretoLeaves++;
      }
      if (ahead) { // the SD-score both ways would have pushed out another one
        const both = averaged(share(pushoffValues(score, ids.map((_, i) => i), { variant: start.params.sd, alpha: start.params.alpha, columns, ...noise }), ids, score), ids, score);
        if (ids[weakest(both, keep)] !== e.id) aheadLeaves++;
      }
      pushoffs++;
    }
    if (e.type === 'leave') {
      assert.ok(!panel.has(e.id), `panel warrior ${e.id} left`);
      slots[slots.indexOf(e.id)] = null;
    }
    if (e.type === 'list') listNow = e.list;
    if (e.type === 'difference') ahead = e.difference === 'ahead';
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
      for (const a of slots) for (const b of slots) if (a !== null && b !== null && a !== b) assert.equal(played.get(`${a},${b}`), panel.has(a) || panel.has(b) ? start.params.panelRounds ?? rounds : noGames ? undefined : rounds, `${a} against ${b} after batch ${e.batch}`);
      const ids = slots.filter((x) => x !== null);
      assert.ok(ids.length - P <= listNow, `${ids.length - P} members, list ${listNow}`);
      const score = ids.map((a) => ids.map((b) => (a === b ? null : pts.get(`${a},${b}`) ?? (noGames ? 0 : undefined))));
      const noise = start.params.noise ? { se: ids.map((a) => ids.map((b) => (a === b ? 0 : se.get(`${a},${b}`)))), z: start.params.noise } : {};
      const columns = start.params.diversity === 'panel' ? ids.map((id) => panel.has(id)) : null; // --diversity panel
      const o = { variant: start.params.sd, alpha: start.params.alpha, columns, ahead, ...noise };
      const js = paretoed(averaged(share(pushoffValues(score, ids.map((_, i) => i), o), ids, score), ids, score), ids, score, o);
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
        // the nearest: the replay's, or one as near up to rounding (copies tie, and the last bits of their sums
        // depend on the compiler: CI's gcc named another one of two in the run of --pushoff pareto with --stage)
        const k = ids.indexOf(nearest);
        assert.ok(nearest === ids[js[i].nearest] || (k >= 0 && near(sdDistance(score, ids.map((_, j) => j), i, k, start.params.sd, noise.se ? noise : null, columns, ahead), js[i].distance)),
          `nearest of ${id}: ${nearest}, the replay says ${ids[js[i].nearest]}`);
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
  checkValues.panelLeaves = panelLeaves; // push-offs where --average panel changed who left
  checkValues.aheadLeaves = aheadLeaves; // push-offs where --difference ahead changed who left
  checkValues.paretoLeaves = paretoLeaves; // push-offs where --pushoff pareto changed who left
  checkValues.newLines = newLines; // children that started a line of their own (a new family)
  checkValues.olderSecond = olderSecond; // crossovers that took the older line of the second parent
  return checked;
}

// The warriors of one batch enter in the order of what they were picked by.
export function checkOrder(evs, key) {
  const byBatch = new Map();
  for (const e of evs.filter((x) => x.type === 'enter')) (byBatch.get(e.batch) ?? byBatch.set(e.batch, []).get(e.batch)).push(e[key]);
  for (const [batch, keys] of byBatch) for (let i = 1; i < keys.length; i++) assert.ok(keys[i - 1] >= keys[i] - 1e-4, `batch ${batch}: ${keys}`);
}

// The batch event counts, per change, its children [bred, evaluated, past
// the screen, still in the list after the batch]; they agree with the
// newcomers and leavers of the batch.
export function checkOps(evs) {
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

// --stage: the early decisions of a run, replayed. The push-off on
// everyone's first-stage results (the panel's from its event, everyone
// else's from the enter events) gives a newcomer that left early the lowest
// value by the early rule, with the logged values, and none that played all
// its rounds with the list full met that rule. Returns how many of each.
export function checkEarly(evs) {
  // the early decisions: the push-off on everyone's first-stage results (the
  // panel's from its event, everyone else's from the enter events) gives the
  // newcomer the lowest value, with the logged values
  const one = evs, par = evs[0].params, P = new Set(evs[0].panel.map((w) => w.id));
  const p1 = new Map(), put1 = (a, b, w, l, t) => { p1.set(`${a},${b}`, ((3 * w + t) * 100) / (w + l + t)); p1.set(`${b},${a}`, ((3 * l + t) * 100) / (w + l + t)); };
  const slots = one[0].panel.map((w) => w.id);
  const origins = new Map(); // --pushoff pareto
  let decisions = 0, kept = 0;
  // the early rule (evolve.c, STAGE_CUT 8): fewer than 8 members weaker on the
  // first stage, and none, or its nearest no weaker
  const firstStage = () => {
    const ids = slots.filter((x) => x !== null);
    const score = ids.map((a) => ids.map((b) => (a === b ? null : p1.get(`${a},${b}`))));
    const columns = par.diversity === 'panel' ? ids.map((id) => P.has(id)) : null;
    const v = pushoffValues(score, ids.map((_, i) => i), { variant: par.sd, alpha: par.alpha, columns });
    if (par.pushoff?.startsWith('pareto')) return { ids, v: paretoValues(v, ids, score, P, origins, par.pushoff, { radius: par.clear, variant: par.sd, columns }) };
    if (par.average !== 'panel') return { ids, v };
    return { ids, v: v.map((x, i) => { // --average panel: the average over the panel's columns
      const row = score[i].filter((_, j) => j !== i && P.has(ids[j])), avg = row.reduce((p, q) => p + q, 0) / row.length;
      return { ...x, avg, value: avg * x.distance ** par.alpha };
    }) };
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
      origins.set(e.id, e.origin);
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
  return { decisions, kept };
}

// --simple with --screen-check: every candidate's row at every checkpoint is
// logged. Replays each decision: the bounds of the average and of the value,
// the gate, the cut (the list-th largest of the members' values and the
// candidates' lower bounds), the twins by the members' first S rounds.
// Returns { steps, stops: [by strength, as a twin, by value] }.
export function checkSimple(evs) {
  const start = evs[0], par = start.params;
  const S = par.screenRounds, F = par.panelRounds, z = par.screenCheck, L = par.list;
  const panelIds = start.panel.map((w) => w.id), P = panelIds.length;
  const pts = new Map(); // "a,b" -> points per 100 rounds
  const put = (a, b, w, l, t) => { pts.set(`${a},${b}`, ((3 * w + t) * 100) / (w + l + t)); pts.set(`${b},${a}`, ((3 * l + t) * 100) / (w + l + t)); };
  const prefix = new Map(); // member id -> its results after the first S rounds, [w, l, t] per panel warrior
  const sigmaOf = (ids) => panelIds.map((k) => {
    const v = ids.filter((x) => x !== k).map((x) => pts.get(`${x},${k}`));
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    return Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  });
  let steps = 0;
  const stops = [0, 0, 0];
  const bound = (row, n, { ids, sigma }) => { // row: [w, l, t] per panel warrior after n rounds; ids: everyone in
    const a = [], e = [];
    let x = 0, s2 = 0;
    for (let k = 0; k < P; k++) {
      const [w, , t] = row[k];
      a[k] = ((3 * w + t) * 100) / n;
      const pw = (w + 1) / (n + 3), pt = (t + 1) / (n + 3), mu = 300 * pw + 100 * pt;
      e[k] = Math.sqrt(((90000 * pw + 10000 * pt - mu * mu) * (F - n)) / (F * n));
      x += a[k];
      s2 += e[k] * e[k];
    }
    const avg = x / P, sd = Math.sqrt(s2) / P, hi = avg + z * sd;
    let dlo = Infinity, dhi = Infinity;
    for (const o of ids) {
      // a member it may outscore is not in the upper bound: the push-off may drop it in the candidate's place
      const mayGo = !panelIds.includes(o) && panelIds.reduce((a, k) => a + pts.get(`${o},${k}`), 0) / P <= hi;
      let d = 0, low = 0, e2 = 0;
      for (let k = 0; k < P; k++) {
        if (panelIds[k] === o || !(sigma[k] > 0)) continue;
        const raw = Math.abs(a[k] - pts.get(`${o},${panelIds[k]}`)), q = e[k] / sigma[k];
        const diff = raw > e[k] ? Math.sqrt(raw * raw - e[k] * e[k]) : 0; // without the error's share
        d += diff / sigma[k];
        low += (diff > z * e[k] ? diff - z * e[k] : 0) / sigma[k];
        e2 += q * q;
      }
      dlo = Math.min(dlo, low);
      if (!mayGo) dhi = Math.min(dhi, d + z * Math.sqrt(e2));
    }
    return { avg, hi, vlo: Math.max(avg - z * sd, 0) * dlo, vhi: Math.max(avg + z * sd, 0) * dhi };
  };
  let cur = null, next = null; // the state a batch starts from: everyone in, the members' values, the standard deviations
  for (const e of evs) {
    if (e.type === 'panel') {
      for (const [a, b, w, l, t] of e.scores) put(a, b, w, l, t);
      cur = { ids: panelIds.slice(), values: new Map(), sigma: sigmaOf(panelIds) };
    }
    if (e.type === 'enter') for (const [o, w, l, t] of e.scores) put(e.id, o, w, l, t);
    if (e.type === 'values') { // after the batch; its `simple` event follows
      const ids = e.values.map((v) => v[0]);
      next = { ids, values: new Map(e.values.filter((v) => !panelIds.includes(v[0])).map((v) => [v[0], v[4]])), sigma: sigmaOf(ids) };
    }
    if (e.type !== 'simple') continue;
    assert.equal(e.check, true);
    assert.equal(e.rounds, e.full, 'with --screen-check everyone plays the whole match');
    const { ids, values } = cur; // the state this batch started from
    const members = ids.filter((x) => !panelIds.includes(x));
    const rowsOf = (step) => new Map(step.rows.map((r) => [r[0], Array.from({ length: P }, (_, k) => r.slice(1 + 3 * k, 4 + 3 * k))]));
    const gone = new Set(); // candidates that would have stopped: the rule goes on as if they had
    for (const step of e.steps) {
      const n = step.rounds, rows = rowsOf(step);
      const inNow = [...rows.keys()];
      assert.deepEqual(inNow.filter((i) => gone.has(i)), [], 'a candidate that would have stopped is not in the rule');
      const b = new Map(inNow.map((i) => [i, bound(rows.get(i), n, cur)]));
      let cut = -Infinity;
      const all = [...members.map((m) => values.get(m)), ...inNow.map((i) => b.get(i).vlo)].sort((x, y) => y - x);
      if (all.length > L && n < F) cut = all[L - 1];
      assert.ok(Math.abs((cut === -Infinity ? -1e300 : cut) - step.cut) <= 1e-5 * Math.max(1, Math.abs(step.cut)), `batch ${e.batch}, ${n} rounds: cut ${step.cut}, not ${cut}`);
      const twin = (row) => members.some((m) => prefix.get(m).every((x, k) => x[0] === row[k][0] && x[1] === row[k][1] && x[2] === row[k][2]));
      const expect = [];
      for (const i of inNow) {
        const x = b.get(i);
        const why = x.hi < e.gate ? 1 : n === S && twin(rows.get(i)) ? 2 : x.vhi < cut ? 3 : 0;
        if (why) expect.push([i, why]), gone.add(i), stops[why - 1]++;
      }
      assert.deepEqual(step.stopped, expect, `batch ${e.batch}, ${n} rounds: who stops`);
      steps++;
    }
    // the rows after the first S rounds of those that entered: twins are told by them
    const atS = rowsOf(e.steps.find((x) => x.rounds === S));
    for (const [i, id] of e.entered) prefix.set(id, atS.get(i));
    cur = next;
  }
  return { steps, stops };
}

// --positions mirror as 42evolve plays a match (play() in evolve.c): game g is
// round g / 2 + 1 of the seed's sequence, with a as the first warrior when g
// is even and b when it is odd; [wins, losses, ties] of a. One game at a time,
// not in the blocks 42evolve plays them in.
export function mirrored(m, a, b, seed, first, rounds) {
  const out = [0, 0, 0];
  for (let g = first; g < first + rounds; g++) {
    const r = m.runMatch(g % 2 ? [b, a] : [a, b], { seed, rounds: 1, firstRound: g >> 1 });
    const x = r.warriors[g % 2];
    out[0] += x.wins, out[1] += x.losses, out[2] += x.ties;
  }
  return out;
}
