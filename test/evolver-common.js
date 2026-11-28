// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// What the evolver's test files (test/evolver*.test.js) share: the tiny hill
// they run 42evolve on, the programs (built once by test/native.js, or
// prebuilt in M42_BIN), the run of 6 batches several tests compare with
// (base), and the replays of a run's events: the push-off values as
// tools/diversity.js computes them, the early decisions of --stage, the order
// of the survivors, the counts per change, the mirrored positions.
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
import { columnSigmas, paretoFronts, pushoffValues, sdDistance, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { bestRedInfo } from '../tools/progress.js';
import { builtProgram, prebuilt, program, skip as noCc } from './native.js';
import { slowdown } from './load.js';

export const root = fileURLToPath(new URL('..', import.meta.url));
// each test file is its own process, with its own folder
export const tmp = mkdtempSync(join(tmpdir(), 'evolver-test-'));
export const cleanup = () => rmSync(tmp, { recursive: true, force: true });
export let evolve = prebuilt ? program(prebuilt, '42evolve') : null;
export let unit = prebuilt ? program(prebuilt, 'evolver-test') : null;
export let spectrum = prebuilt ? program(prebuilt, '42spectrum') : null;
export const skip = noCc || (process.platform === 'win32' && 'POSIX only') || (prebuilt && !existsSync(evolve) && `no 42evolve in ${prebuilt}`) || false;

const EVOLVER = ['evolver/evolve.c', 'evolver/pool.c', 'evolver/events.c', 'evolver/state.c', 'evolver/panel.c', 'evolver/batch.c', 'evolver/optimize.c', 'evolver/islands.c', 'evolver/run.c', 'evolver/genome.c', 'evolver/generator.c', 'evolver/gen-change.c', 'evolver/pushoff.c', 'evolver/names.c', 'evolver/style.c'];

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
  '--screen-stop', '0', // every child plays its whole screen; the tests of --screen-stop set it
  '--genome', 'list', // lists, as before generators became the default; the tests of --genome gen set it
  '--events', 'full', // every newcomer with its matches, which checkValues replays; test/evolver-brief.test.js has the brief lines
  '--stage', '0']; // the tests of --stage set it

// The numbers of the params line of a state, in the order of param_fields (evolver/state.c), and the places (from
// 1) of those the tests look at: by its place, so that a field added at the end changes no test (#247: six tests
// matched the end of the line).
export const stateParams = (text) => /^params (.*)$/m.exec(text)[1].split(' ');
export const PARAM = { gen: 44, tie: 47, parsimony: 48, noSpl: 49, survivorsBy: 50, replaceParent: 51, events: 52, ladder: 53, ladderEvery: 54, ladderAbove: 55 };
export const stateParam = (text, name) => stateParams(text)[PARAM[name] - 1];

export function run(dir, args) {
  const r = spawnSync(evolve, [dir, ...args], { encoding: 'utf8', timeout: Math.ceil(120000 * slowdown()) });
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
// family, more than one kind of style, enough duels between parents, both of
// two Dwarfs as start warriors).
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
// before() of every file: the programs, then the base run (not with
// { base: false }, for a file that needs only the programs)
export async function setup(options) {
  if (skip) return;
  if (!prebuilt) {
    [evolve, unit, spectrum] = await Promise.all([
      builtProgram('42evolve', EVOLVER, ['-pthread', '-Ilib']),
      builtProgram('evolver-test', ['test/c/evolver-test.c', 'evolver/genome.c', 'evolver/generator.c', 'evolver/gen-change.c', 'evolver/pushoff.c', 'evolver/names.c'], ['-Ilib', '-Ievolver']),
      builtProgram('42spectrum', ['evolver/spectrum.c', 'evolver/genome.c', 'evolver/generator.c', 'evolver/gen-change.c'], ['-pthread', '-Ilib']),
    ]);
  }
  if (options?.base === false) return;
  run(join(tmp, 'one'), [...TINY, '--threads', '1', '--batches', '6']);
  base = events(join(tmp, 'one'));
}

// --pushoff pareto: the members' values of v as 42evolve computes them, their
// place in NSGA-II's order on the panel average (without the own column) and
// the average against the other members, with pareto-sd also the SD-score to the nearest of
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
      cleared[k] = order.slice(0, q).some((w) => !cleared[w] && sdDistance(score, all, ms[k], ms[w], clear.variant, clear.columns, sigmas) < clear.radius);
    });
  }
  const obj = ms.map((i) => {
    const pc = ids.map((b, j) => j).filter((j) => panel.has(ids[j]) && j !== i);
    const mc = ms.filter((j) => j !== i);
    // the average against the other members: not with --member-games none (clear.noGames), where it is 0 for all
    const o = [pc.reduce((t, j) => t + score[i][j], 0) / pc.length, ...(clear?.noGames ? [] : [mc.length ? mc.reduce((t, j) => t + score[i][j], 0) / mc.length : 0])];
    return third === 'pareto-sd' ? [...o, v[i].distance] : o;
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
  const tie = start.params.tiePoints ?? 1; // --tie-points: what a tie counts in the values and the screen
  const put = (a, b, w, l, t) => { // per 100 of the rounds played (--stage: fewer than `rounds` at first)
    pts.set(`${a},${b}`, ((3 * w + tie * t) * 100) / (w + l + t));
    pts.set(`${b},${a}`, ((3 * l + tie * t) * 100) / (w + l + t));
    played.set(`${a},${b}`, w + l + t);
    played.set(`${b},${a}`, w + l + t);
    wlt.set(`${a},${b}`, `${w},${l},${t}`);
    wlt.set(`${b},${a}`, `${l},${w},${t}`);
  };
  const wlt = new Map(); // "a,b" -> "wins,losses,ties" of a against b
  const played = new Map(); // "a,b" -> rounds of that result
  const slots = start.panel.map((w) => w.id);
  const panel = new Set(slots); // the panel now
  let checked = 0, duels = 0, lastValues = new Map(), parentDistances = 0, pushoffs = 0, roundings = 0;
  // --parsimony: of a newcomer and a member with the same results in every game both played with the same seeds
  // (against the panel, and against the members in before the member: ids are given in the order of entering),
  // the longest such twin leaves when the newcomer is shorter, else the newcomer
  const lengths = new Map();
  let fresh = null, twinLeaves = 0, twinChecks = 0;
  const twinRule = () => { // [who leaves, who stays] for the newcomer `fresh`, or null
    let longest = null;
    for (const m of slots) {
      if (m === null || m === fresh || panel.has(m)) continue;
      const same = slots.every((o) => o === null || o === fresh || o === m || (!panel.has(o) && (noGames || o > m)) || wlt.get(`${fresh},${o}`) === wlt.get(`${m},${o}`));
      if (same && (longest === null || lengths.get(m) > lengths.get(longest))) longest = m;
    }
    if (longest === null) return null;
    return lengths.get(fresh) >= lengths.get(longest) ? [fresh, longest] : [longest, fresh];
  };
  // the values of everyone in now, by tools/diversity.js on the logged scores
  const valuesNow = () => {
    const ids = slots.filter((x) => x !== null);
    const score = ids.map((a) => ids.map((b) => (a === b ? null : pts.get(`${a},${b}`) ?? (noGames ? 0 : undefined))));
    const columns = start.params.diversity === 'panel' ? ids.map((id) => panel.has(id)) : null;
    const o = { variant: start.params.sd, alpha: start.params.alpha, columns };
    return { ids, score, columns, v: paretoed(averaged(pushoffValues(score, ids.map((_, i) => i), o), ids, score), ids, score, o) };
  };
  const panelAverage = (id) => {
    const others = [...panel].filter((p) => p !== id);
    return others.reduce((sum, p) => sum + pts.get(`${id},${p}`), 0) / others.length;
  };
  // --replace-parent: when the newcomer's nearest is its first parent, a member, the one of the two with the lower
  // average against the panel leaves (the newcomer when equal): [who leaves, who stays], null for no duel, 'unsure'
  // when another warrior is as near as the parent up to rounding
  const firstParent = new Map();
  let parentDuels = 0, duelChecks = 0, childWon = 0, duelUnsure = 0;
  const duelRule = () => {
    const p = firstParent.get(fresh);
    if (p === undefined || panel.has(p) || !slots.includes(p)) return null;
    const { ids, score, columns, v } = valuesNow();
    const i = ids.indexOf(fresh), near = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(y));
    const toParent = sdDistance(score, ids.map((_, j) => j), i, ids.indexOf(p), start.params.sd, columns);
    if (ids[v[i].nearest] !== p) return near(toParent, v[i].distance) ? 'unsure' : null;
    if (ids.some((x, j) => j !== i && x !== p && near(sdDistance(score, ids.map((_, k) => k), i, j, start.params.sd, columns), toParent))) return 'unsure';
    return panelAverage(fresh) > panelAverage(p) ? [p, fresh] : [fresh, p];
  };
  const noDuel = (why) => {
    if (!start.params.replaceParent || fresh === null) return;
    const rule = duelRule();
    if (rule === 'unsure') duelUnsure++;
    else assert.equal(rule, null, `batch ${why}: ${fresh} is nearest to its parent ${firstParent.get(fresh)} and did not duel it`), duelChecks++;
  };
  const noTwin = () => { // the newcomer stayed without a leave: it has no twin, and no duel with its parent
    if (start.params.parsimony && fresh !== null) assert.equal(twinRule(), null, `${fresh} has a twin and stayed`), twinChecks++;
    noDuel('stayed');
    fresh = null;
  };
  let listNow = start.params.list; // --list on a run that continues: event `list`
  // --pushoff pareto: the members' value is their place in NSGA-II's order on the panel average, the average
  // against the other members, with pareto-sd the SD-score to the nearest; 10 (fronts - front) + min(crowding, 5)
  const origins = new Map(); // id -> the batch its line started, from the enter events
  let paretoLeaves = 0, newLines = 0, olderSecond = 0;
  const paretoed = (v, ids, score, o) => (start.params.pushoff?.startsWith('pareto') ? paretoValues(v, ids, score, panel, origins, start.params.pushoff, { radius: start.params.clear, noGames, ...o }) : v);
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
    if (e.type === 'rotate') { // --groups (#183): a foe takes the place of a panel warrior, everybody in played it
      slots[slots.indexOf(e.out)] = e.panel.id;
      panel.delete(e.out);
      panel.add(e.panel.id);
      for (const [o, w, l, t] of e.scores) put(e.panel.id, o, w, l, t);
      snap = null;
    }
    if (e.type === 'enter' && e.rival >= 0) {
      // the first parent won its tournament of two against the rival: by
      // push-off value at the start of the batch, or with --parents duel by
      // their match against each other (a draw by value)
      const [w] = e.parents, l = e.rival, value = (id) => lastValues.get(id) ?? -Infinity;
      if (start.params.parents === 'duel' && w !== l && pts.get(`${w},${l}`) !== pts.get(`${l},${w}`)) {
        assert.ok(pts.get(`${w},${l}`) > pts.get(`${l},${w}`), `${e.name}: parent ${w} lost to ${l}`);
        duels++;
      } else {
        assert.ok(value(w) >= value(l), `${e.name}: parent ${w} has less value than ${l}`);
      }
    }
    if (e.type === 'enter' || e.type === 'values') noTwin();
    if (e.type === 'enter') {
      lengths.set(e.id, e.length);
      fresh = e.id;
      if (e.parents.length) firstParent.set(e.id, e.parents[0]);
      // the origin of its line: a new family, or no parents in the list when it was bred (random, back from the
      // archive, a start warrior), start a new one; else the older line of its parents
      const bred = e.parents.length && e.ops !== 'reintroduce' && e.parents.every((p) => origins.has(p));
      const expect = e.newFamily || !bred ? e.batch : Math.min(...e.parents.map((p) => origins.get(p)));
      if (e.newFamily || !e.parents.length || bred) assert.equal(e.origin, expect, `origin of ${e.id}`);
      if (e.newFamily && e.parents.length) newLines++;
      if (bred && !e.newFamily && e.parents.length === 2 && origins.get(e.parents[1]) < origins.get(e.parents[0])) olderSecond++;
      origins.set(e.id, e.origin);
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
    if (e.type === 'leave' && e.early) fresh = null;
    if (e.type === 'leave' && !e.early && start.params.replaceParent) {
      // the duel goes first: before the twins and the push-off, also while the list is not full
      if (e.duel !== undefined) {
        const rule = duelRule();
        if (rule === 'unsure') duelUnsure++;
        else assert.deepEqual([e.id, e.duel], rule, `batch ${e.batch}: ${e.id} left in a duel with ${e.duel}, the rule says ${rule}`);
        if (e.duel === fresh) childWon++;
        parentDuels++;
        fresh = null;
      } else noDuel(e.batch);
    } else assert.equal(e.duel, undefined, 'a duel without --replace-parent');
    if (e.type === 'leave' && !e.early && e.duel === undefined && start.params.parsimony) {
      const rule = twinRule();
      if (e.twin !== undefined) {
        assert.deepEqual([e.id, e.twin], rule, `batch ${e.batch}: ${e.id} left as the twin of ${e.twin}, the rule says ${rule}`);
        twinLeaves++;
      } else assert.equal(rule, null, `batch ${e.batch}: ${fresh} has a twin, the push-off decided`);
      twinChecks++;
      fresh = null;
    } else assert.equal(e.twin, undefined, 'a twin without --parsimony');
    if (e.type === 'leave' && !e.early && e.twin === undefined && e.duel === undefined) {
      // the push-off: the weakest of those that may leave (not the panel), by
      // tools/diversity.js on the logged scores
      const ids = slots.filter((x) => x !== null);
      const score = ids.map((a) => ids.map((b) => (a === b ? null : pts.get(`${a},${b}`) ?? (noGames ? 0 : undefined))));
      const columns = start.params.diversity === 'panel' ? ids.map((id) => panel.has(id)) : null;
      const o = { variant: start.params.sd, alpha: start.params.alpha, columns };
      const v = paretoed(averaged(pushoffValues(score, ids.map((_, i) => i), o), ids, score), ids, score, o);
      const keep = new Set(ids.map((id, i) => (panel.has(id) ? i : -1)).filter((i) => i >= 0));
      // the weakest, or one whose value equals it up to rounding: a compiler
      // may fuse `num += w * x` into one rounding (arm64, gcc for
      // x86-64-v3), and a sum then differs in the last bits from this
      // replay; near twins have such values (CI of #154)
      const k = weakest(v, keep), j = ids.indexOf(e.id);
      assert.ok(k === j || (!keep.has(j) && Math.abs(v[j].value - v[k].value) <= 1e-9 * Math.max(1, Math.abs(v[k].value))),
        `batch ${e.batch}: ${e.id} left, the push-off says ${ids[k]}`);
      if (k !== j) roundings++;
      if (start.params.average === 'panel') { // the plain average would have pushed out another one
        const plain = pushoffValues(score, ids.map((_, i) => i), { variant: start.params.sd, alpha: start.params.alpha, columns });
        if (ids[weakest(plain, keep)] !== e.id) panelLeaves++;
      }
      if (start.params.pushoff?.startsWith('pareto')) { // the push-off value would have pushed out another one
        const plain = pushoffValues(score, ids.map((_, i) => i), { variant: start.params.sd, alpha: start.params.alpha, columns });
        if (ids[weakest(plain, keep)] !== e.id) paretoLeaves++;
      }
      pushoffs++;
    }
    if (e.type === 'leave') {
      assert.ok(!panel.has(e.id), `panel warrior ${e.id} left`);
      slots[slots.indexOf(e.id)] = null;
      fresh = null; // its rules were checked at this leave
    }
    if (e.type === 'list') listNow = e.list;
    if (e.type === 'values') {
      lastValues = new Map(e.values.map((v) => [v[0], v[4]]));
      // at the end of a batch every pair has all its rounds (--stage: after the complete events)
      for (const a of slots) for (const b of slots) if (a !== null && b !== null && a !== b) assert.equal(played.get(`${a},${b}`), panel.has(a) || panel.has(b) ? start.params.panelRounds ?? rounds : noGames ? undefined : rounds, `${a} against ${b} after batch ${e.batch}`);
      const ids = slots.filter((x) => x !== null);
      assert.ok(ids.length - P <= listNow, `${ids.length - P} members, list ${listNow}`);
      const score = ids.map((a) => ids.map((b) => (a === b ? null : pts.get(`${a},${b}`) ?? (noGames ? 0 : undefined))));
      const columns = start.params.diversity === 'panel' ? ids.map((id) => panel.has(id)) : null; // --diversity panel
      const o = { variant: start.params.sd, alpha: start.params.alpha, columns };
      const js = paretoed(averaged(pushoffValues(score, ids.map((_, i) => i), o), ids, score), ids, score, o);
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
        assert.ok(nearest === ids[js[i].nearest] || (k >= 0 && near(sdDistance(score, ids.map((_, j) => j), i, k, start.params.sd, columns), js[i].distance)),
          `nearest of ${id}: ${nearest}, the replay says ${ids[js[i].nearest]}`);
      });
      checked++;
    }
  }
  if (start.params.parents === 'duel') assert.ok(duels > 10, `only ${duels} duels`);
  assert.ok(parentDistances > 0, 'no difference to a parent checked');
  checkValues.pushoffs = pushoffs;
  checkValues.roundings = roundings; // push-offs decided between values equal up to rounding
  checkValues.panelLeaves = panelLeaves; // push-offs where --average panel changed who left
  checkValues.paretoLeaves = paretoLeaves; // push-offs where --pushoff pareto changed who left
  checkValues.newLines = newLines; // children that started a line of their own (a new family)
  checkValues.olderSecond = olderSecond; // crossovers that took the older line of the second parent
  checkValues.twinLeaves = twinLeaves; // --parsimony: leaves of the longer of two twins
  checkValues.twinChecks = twinChecks; // --parsimony: newcomers checked for twins
  checkValues.parentDuels = parentDuels; // --replace-parent: duels of a newcomer and its first parent
  checkValues.childWon = childWon; // of those, the newcomer stayed
  checkValues.duelChecks = duelChecks; // newcomers checked to be not nearest to their parent
  checkValues.duelUnsure = duelUnsure; // newcomers as near to their parent as to another one, up to rounding
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
  // the early rule (batch.c, STAGE_CUT 8): fewer than 8 members weaker on the
  // first stage, and none, or its nearest no weaker
  const firstStage = () => {
    const ids = slots.filter((x) => x !== null);
    const noGames = par.memberGames === 'none'; // members never play each other: 0 between them, as in the matrix
    const score = ids.map((a) => ids.map((b) => (a === b ? null : p1.get(`${a},${b}`) ?? (noGames ? 0 : undefined))));
    const columns = par.diversity === 'panel' ? ids.map((id) => P.has(id)) : null;
    const v = pushoffValues(score, ids.map((_, i) => i), { variant: par.sd, alpha: par.alpha, columns });
    if (par.pushoff?.startsWith('pareto')) return { ids, v: paretoValues(v, ids, score, P, origins, par.pushoff, { radius: par.clear, variant: par.sd, columns, noGames }) };
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

// --positions mirror as 42evolve plays a match (play() in pool.c): game g is
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

// --ladder (#247)
// The ladder of a run as its state has it: the candidates, the weakest first.
export const rungs = (dir) => readFileSync(join(dir, 'state.txt'), 'utf8').split('\n').filter((l) => l.startsWith('ladder ')).map((l) => {
  const [, used, kind, avg, file] = /^ladder (\d) (-?\d+) (\S+) (.*)$/.exec(l);
  return { used: used === '1', kind: Number(kind), avg: Number(avg), file };
});

// Replays the ladder of a run from its events: the start, every step and what the state has at the end.
// Returns { steps, replaced, tops (replacements by a candidate of another kind), stuck (beaten and not replaced) }.
export function checkLadder(dir, evs, { every, above }) {
  const start = evs[0];
  assert.deepEqual([start.params.ladder, start.params.ladderEvery, start.params.ladderAbove], [true, every, above]);
  const ladder = rungs(dir), P = start.panel.length;
  const at = new Map(ladder.map((g, i) => [g.file, i]));
  // the weakest first; the panel is of the weakest third (at least the panel's size), and no holdout warrior is a candidate
  for (let i = 1; i < ladder.length; i++) assert.ok(ladder[i - 1].avg <= ladder[i].avg, `rung ${i} is weaker than the one before`);
  const third = Math.max(Math.floor(ladder.length / 3), P);
  for (const p of start.panel) assert.ok(at.get(p.file) < third, `${p.file} is rung ${at.get(p.file)} of ${ladder.length}: not of the weakest ${third}`);
  for (const h of start.holdout) assert.ok(!at.has(h.file), `the holdout warrior ${h.file} is a candidate of the ladder`);
  const pick = evs.find((e) => e.type === 'pick');
  assert.deepEqual(pick.picked.map((p) => p.file), start.panel.map((p) => p.file));
  for (const p of pick.picked) assert.ok(Math.abs(p.avg - ladder[at.get(p.file)].avg) < 1e-5, `${p.file}: its average in the pick`);
  const used = new Set(start.panel.map((p) => p.file));
  const slots = start.panel.map((p) => ({ id: p.id, file: p.file })); // the panel now
  const pts = new Map(); // "member,panel id" -> the member's points per 100 rounds
  const members = new Set();
  let steps = 0, replaced = 0, tops = 0, stuck = 0, pending = [];
  const expectStep = (batch) => { // the step before the batch, from the list as it is: [{ slot, median, file }]
    const med = slots.map((s) => {
      const col = [...members].map((m) => pts.get(`${m},${s.id}`)).sort((a, b) => a - b);
      return col.length ? col[Math.floor(col.length / 2)] : -1;
    });
    const beaten = med.filter((x) => x >= above).length, out = [], tried = new Set();
    while (out.length < 3) {
      let j = -1;
      med.forEach((x, k) => { if (!tried.has(k) && x >= above && (j < 0 || x > med[j])) j = k; });
      if (j < 0) break;
      tried.add(j);
      const mine = at.get(slots[j].file);
      let next = ladder.findIndex((g, k) => k > mine && !used.has(g.file) && g.kind === ladder[mine].kind), top = false;
      if (next < 0) {
        for (let k = ladder.length - 1; k > mine && next < 0; k--) if (!used.has(ladder[k].file)) next = k;
        top = next >= 0;
      }
      if (next < 0) {
        stuck++;
        continue;
      }
      used.add(ladder[next].file);
      out.push({ slot: j, median: med[j], file: ladder[next].file, was: ladder[mine].avg, avg: ladder[next].avg, top });
    }
    return { batch, beaten, out };
  };
  for (const e of evs) {
    if (e.type === 'enter') {
      members.add(e.id);
      for (const [o, w, l, t] of e.scores) pts.set(`${e.id},${o}`, ((3 * w + t) * 100) / (w + l + t));
    }
    if (e.type === 'complete') for (const [o, w, l, t] of e.scores) pts.set(`${e.id},${o}`, ((3 * w + t) * 100) / (w + l + t));
    if (e.type === 'leave') members.delete(e.id);
    if (e.type === 'rotate') { // the new panel warrior's results: a member's are the other way round
      assert.deepEqual(e.from, [0, 0], 'a hill warrior, no foe of --groups');
      pending.push(e);
      for (const [o, w, l, t] of e.scores) pts.set(`${o},${e.panel.id}`, ((3 * l + t) * 100) / (w + l + t));
      assert.equal(e.scores.length, slots.length - 1 + members.size, 'everybody in played the new panel warrior');
    }
    if (e.type !== 'ladder') continue;
    steps++;
    assert.ok(e.batch > 0 && e.batch % every === 0, `a step before batch ${e.batch}`);
    // the rotate events of the step came first; the step was decided on the panel before them (slots has it still)
    const want = expectStep(e.batch);
    assert.equal(e.above, above);
    assert.equal(e.beaten, want.beaten, `batch ${e.batch}: the beaten panel warriors`);
    assert.deepEqual(e.replaced.map((x) => [x.slot, x.file]), want.out.map((x) => [x.slot, x.file]), `batch ${e.batch}: who was replaced by whom`);
    assert.deepEqual(pending.map((r) => [r.out, r.panel.id, r.panel.file]), e.replaced.map((x) => [x.out, x.in, x.file]), `batch ${e.batch}: a rotate event for each`);
    e.replaced.forEach((x, k) => {
      const w = want.out[k];
      assert.ok(Math.abs(x.median - w.median) < 1e-5 && Math.abs(x.avg - w.avg) < 1e-5 && Math.abs(x.was - w.was) < 1e-5, `batch ${e.batch}, slot ${x.slot}`);
      assert.ok(x.median >= above, 'only a beaten panel warrior is replaced');
      assert.ok(at.get(x.file) > at.get(slots[x.slot].file), 'by a stronger one');
      assert.equal(x.out, slots[x.slot].id);
      slots[x.slot] = { id: x.in, file: x.file };
      if (w.top) tops++;
    });
    for (let k = 1; k < e.replaced.length; k++) assert.ok(e.replaced[k - 1].median >= e.replaced[k].median, 'the most beaten first');
    assert.ok(e.replaced.length <= 3);
    replaced += e.replaced.length;
    pending = [];
    const strength = slots.reduce((s, x) => s + ladder[at.get(x.file)].avg, 0) / slots.length;
    assert.ok(Math.abs(e.strength - strength) < 1e-5, `batch ${e.batch}: the strength of the panel`);
    assert.equal(e.left, ladder.length - used.size);
  }
  assert.equal(pending.length, 0, 'a rotate event without its ladder event');
  // never a warrior twice, and the state has who was in
  assert.equal(new Set(evs.filter((e) => e.type === 'rotate').map((e) => e.panel.file)).size, replaced);
  assert.deepEqual(ladder.filter((g) => g.used).map((g) => g.file).sort(), [...used].sort());
  return { steps, replaced, tops, stuck };
}
