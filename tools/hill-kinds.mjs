#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The kind of style (tools/style.js) of every warrior of a hill folder,
// cached, and a bench broken down by those kinds (#221).
//
//   node tools/hill-kinds.mjs <dir> [--hill 94nop|tiny] [--out <file>] [--bench <file.json> ...]
//     [--round-robin <file.json> [--top 20]] [--worst N]
//
// --hill: the rules and the opponents of the measurement. 94nop (the '94
// rules, against our Dwarf, Origami and Seeker, as tools/style.mjs measures
// and as the thresholds of kind() were set) and tiny (-s 800 -c 8000 -p 800
// -l 20 -d 20; Origami and Seeker assert a core of 8000, so Dwarf and two
// tiny hill warriors that measure as a paper and a scanner there: ttb and
// poke01). By default the preset named as the folder, else 94nop.
//
// The cache (--out, by default build/hill-kinds/<hill>-<folder>.json; not in
// warriors/koenigstuhl/, whose warriors have no license) keeps the content
// hash of every file: a changed or new warrior is measured again, nothing
// else; one whose file is gone leaves it. A cache of other rules or
// opponents is measured again as a whole.
//
// --bench: the JSON of `tools/tournament.mjs <dir> --bench <warrior> --json
// <file>`, broken down by the kinds of its opponents: per kind how many,
// and the mean points per 100 rounds against them. Several: one row per
// bench, the kinds as columns (paper, mover, scanner, stone, the rest as
// other).
//
// --round-robin: the JSON of `tools/tournament.mjs <dir> [more warriors]
// --json <file>` (#245): the folder's warriors against each other (other
// warriors of the tournament are left out, rows and columns), which is each
// one's score on the bench above. The scores at the maximum, the best tenth,
// the quartiles and the lowest tenth, the best --top with their kinds, and
// kind against kind. With --bench also the row of the mean of the best --top,
// and for the first bench the gap per kind: (the best --top's mean against
// the kind - the bench's) x the kind's share of the folder, largest first:
// what a kind would give if the warrior did as well against it as the top.
//
// --worst N: the N opponents the first bench scores least against, with
// their kinds and first ;strategy line.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { kind, measureStyle, shortKind } from './style.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const VERSION = 1; // of the cache: a new measurement or kind() makes it 2

export const HILLS = {
  '94nop': {
    rules: { coreSize: 8000, maxCycles: 80000, maxProcesses: 8000, maxLength: 100, minDistance: 100 },
    against: ['warriors/dwarf.red', 'warriors/origami.red', 'warriors/seeker.red'],
  },
  tiny: {
    rules: { coreSize: 800, maxCycles: 8000, maxProcesses: 800, maxLength: 20, minDistance: 20 },
    against: ['warriors/dwarf.red', 'warriors/koenigstuhl/tiny/ttb.red', 'warriors/koenigstuhl/tiny/poke01.red'],
  },
};

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

// The kinds of the warriors of dir: { hill, rules, against, warriors: { file:
// { hash, name, kind, style } } }, from the cache where a file's hash is the
// same. A warrior that does not fit the rules (it does not assemble, is too
// long, uses p-space) has kind null and a reason. measured: how many were
// measured now.
export function hillKinds(dir, { hill = defaultHill(dir), out = defaultOut(dir, hill), log = () => {} } = {}) {
  const h = HILLS[hill];
  if (!h) throw new Error(`no hill ${hill}: ${Object.keys(HILLS).join(', ')}`);
  const againstText = h.against.map((f) => readFileSync(join(root, f), 'latin1'));
  const key = { version: VERSION, hill, rules: h.rules, against: h.against.map((f, i) => `${basename(f)} ${hash(againstText[i])}`) };
  let cache = null;
  try {
    cache = JSON.parse(readFileSync(out, 'utf8'));
  } catch {} // none yet, or not readable: measured anew
  const same = cache && JSON.stringify({ version: cache.version, hill: cache.hill, rules: cache.rules, against: cache.against }) === JSON.stringify(key);
  const old = same ? cache.warriors : {};
  const load = (text) => assemble(text, h.rules);
  const opponents = againstText.map(load);
  let m = null;
  const warriors = {};
  let measured = 0;
  const files = readdirSync(dir).filter((f) => f.endsWith('.red')).sort();
  for (const f of files) {
    const bytes = readFileSync(join(dir, f));
    const hs = hash(bytes);
    if (old[f]?.hash === hs) {
      warriors[f] = old[f];
      continue;
    }
    const w = load(bytes.toString('latin1'));
    if (!w.ok || !w.instructions.length || w.instructions.length > h.rules.maxLength || w.instructions.some((i) => i.op >= 17)) {
      warriors[f] = { hash: hs, name: w.name ?? null, kind: null, why: w.ok ? 'does not fit the rules (length or p-space)' : w.errors[0].text };
    } else {
      m ??= createMarsSync({ ...h.rules, watch: true });
      const style = measureStyle(m, w, opponents);
      warriors[f] = { hash: hs, name: w.name, kind: kind(style), style };
    }
    measured++;
    if (measured % 100 === 0) log(`${measured} measured`);
  }
  const result = { ...key, folder: resolve(dir), warriors };
  if (measured || !same || Object.keys(old).length !== files.length) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(result, null, 1));
  }
  return { ...result, measured, out };
}

export function defaultHill(dir) {
  const b = basename(resolve(dir));
  return b in HILLS ? b : '94nop';
}

export const defaultOut = (dir, hill) => join(root, 'build', 'hill-kinds', `${hill}-${basename(resolve(dir))}.json`);

// The kinds of kind() (tools/style.js) in the order of its tests.
const KINDS = ['dies at once', 'copies itself with many processes (paper)', 'runs copies of its code, few processes (imp, a stone that moves)',
  'reads far cells before it writes (scanner)', 'throws copies of its code (stone, clear)', 'writes fields, no copies of its code',
  'damages by increments (< > { })', 'writes little (scanner, or waits)'];

// Per kind of the warriors: { kind, count, mean, with } of values (file -> a
// number, e.g. points per 100 rounds against that warrior; with: how many
// had one, mean null for none), in the order of KINDS, then 'not measured'
// (warriors that do not fit the rules).
export function byKind(kinds, values = null) {
  const groups = new Map();
  for (const [file, w] of Object.entries(kinds.warriors)) {
    const k = w.kind ?? 'not measured';
    const g = groups.get(k) ?? { kind: k, count: 0, sum: 0, with: 0 };
    g.count++;
    if (values && file in values) g.sum += values[file], g.with++;
    groups.set(k, g);
  }
  const rank = (k) => (KINDS.includes(k) ? KINDS.indexOf(k) : KINDS.length);
  return [...groups.values()].sort((a, b) => rank(a.kind) - rank(b.kind)).map((g) => ({ kind: g.kind, count: g.count, mean: g.with ? g.sum / g.with : null, with: g.with }));
}

// A bench of tools/tournament.mjs --json: file of each opponent -> its points per 100 rounds.
export function benchPoints(json) {
  const out = {};
  json.pairs.forEach((p, k) => {
    const [w, , t] = json.results[k].a;
    out[basename(json.files[p.b])] = ((3 * w + t) * 100) / json.options.rounds;
  });
  return out;
}

// The kinds of the tables with several columns: the four large ones, the
// rest (fields, increments, little, dies) as 'other'.
export const GROUPS = ['paper', 'mover', 'scanner', 'stone', 'other'];
export const groupOf = (k) => (GROUPS.includes(shortKind(k)) ? shortKind(k) : 'other');

// A round robin of tools/tournament.mjs --json, only the warriors of the
// folder that have a kind: { files, points, score, left }. points[i][j]:
// points per 100 rounds of files[i] against files[j] (NaN for i = j);
// score[i]: its mean against all others; left: how many warriors of the
// tournament are not of the folder.
export function roundRobin(json, kinds) {
  const index = new Map();
  const files = [];
  let left = 0;
  json.files.forEach((f, i) => {
    const b = basename(f);
    if (kinds.warriors[b]?.kind) index.set(i, files.push(b) - 1);
    else left++;
  });
  const n = files.length;
  const points = Array.from({ length: n }, () => new Float64Array(n).fill(NaN));
  const per = 100 / json.options.rounds;
  json.pairs.forEach((p, k) => {
    const a = index.get(p.a), b = index.get(p.b);
    if (a === undefined || b === undefined || a === b) return;
    const r = json.results[k];
    points[a][b] = (3 * r.a[0] + r.a[2]) * per;
    points[b][a] = (3 * r.b[0] + r.b[2]) * per;
  });
  return { files, points, score: points.map((row, i) => meanOver(row, (j) => j !== i)), left };
}

function meanOver(row, take) {
  let sum = 0, n = 0;
  for (let j = 0; j < row.length; j++) if (take(j) && !Number.isNaN(row[j])) sum += row[j], n++;
  return n ? sum / n : null;
}

// The indices of rr.files, best score first.
export const ranking = (rr) => rr.files.map((_, i) => i).sort((a, b) => rr.score[b] - rr.score[a] || a - b);

// The score that the best share p of the warriors reaches (p = 0: the best,
// 0.5: the median, the lower one of an even count).
export function scoreAt(rr, p) {
  const order = ranking(rr);
  return rr.score[order[Math.min(order.length - 1, Math.floor(p * order.length))]];
}

// Kind against kind: { count: { group: warriors }, mean: { row group: {
// column group: mean points of the row's warriors against the column's, all:
// against everyone } } }, the mean over the pairs (a warrior never plays
// itself).
export function kindTable(rr, kinds) {
  const group = rr.files.map((f) => groupOf(kinds.warriors[f].kind));
  const count = Object.fromEntries(GROUPS.map((g) => [g, group.filter((x) => x === g).length]));
  const mean = {};
  for (const g of GROUPS) {
    mean[g] = meanAgainst(rr, group, rr.files.map((_, i) => i).filter((i) => group[i] === g));
  }
  return { count, mean };
}

// The mean row of the warriors `rows` of the round robin: per group of
// opponents and 'all', each warrior's mean first, then the mean of those.
export function meanAgainst(rr, group, rows) {
  const out = {};
  for (const c of [...GROUPS, 'all']) {
    const each = rows.map((i) => meanOver(rr.points[i], (j) => j !== i && (c === 'all' || group[j] === c))).filter((x) => x !== null);
    out[c] = each.length ? each.reduce((a, b) => a + b, 0) / each.length : null;
  }
  return out;
}

// A bench by the groups: { paper, ..., other, all } mean points per 100
// rounds, over the opponents that have a kind.
export function benchRow(kinds, values) {
  const sums = Object.fromEntries([...GROUPS, 'all'].map((g) => [g, [0, 0]]));
  for (const [file, v] of Object.entries(values)) {
    const k = kinds.warriors[file]?.kind;
    if (!k) continue;
    for (const g of [groupOf(k), 'all']) sums[g][0] += v, sums[g][1]++;
  }
  return Object.fromEntries(Object.entries(sums).map(([g, [s, n]]) => [g, n ? s / n : null]));
}

// What each kind would give a bench that did as well against it as `top`
// (a row of meanAgainst) does: [{ group, share, top, ours, gap }], gap =
// (top - ours) x share, the largest first. share: of the folder's warriors
// with a kind.
export function gaps(kinds, row, top) {
  const all = Object.values(kinds.warriors).filter((w) => w.kind);
  return GROUPS.map((g) => {
    const share = all.filter((w) => groupOf(w.kind) === g).length / all.length;
    return { group: g, share, top: top[g], ours: row[g], gap: top[g] === null || row[g] === null ? 0 : (top[g] - row[g]) * share };
  }).sort((a, b) => b.gap - a.gap);
}

// The n opponents a bench scores least against: [{ file, points }], the
// folder's order among equals.
export const worst = (values, n) => Object.entries(values).map(([file, points]) => ({ file, points })).sort((a, b) => a.points - b.points || (a.file < b.file ? -1 : 1)).slice(0, n);

const USAGE = 'usage: node tools/hill-kinds.mjs <dir> [--hill 94nop|tiny] [--out <file>] [--bench <file.json> ...] [--round-robin <file.json> [--top 20]] [--worst N]';

function main(argv) {
  const o = { dir: null, hill: null, out: null, bench: [], roundRobin: null, top: 20, worst: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) fail(`${a} needs a value`);
      return argv[++i];
    };
    const count = () => {
      const v = value();
      if (!/^[1-9]\d*$/.test(v)) fail(`${a} needs a count, not ${v}`);
      return Number(v);
    };
    if (a === '--hill') o.hill = value();
    else if (a === '--out') o.out = value();
    else if (a === '--bench') o.bench.push(value());
    else if (a === '--round-robin') o.roundRobin = value();
    else if (a === '--top') o.top = count();
    else if (a === '--worst') o.worst = count();
    else if (a.startsWith('-')) fail(`unknown option ${a}`);
    else if (o.dir) fail(`one folder only, not ${o.dir} and ${a}`);
    else o.dir = a;
  }
  if (!o.dir) fail('no folder');
  if (!existsSync(o.dir)) fail(`no folder ${o.dir}`);
  if (o.hill && !HILLS[o.hill]) fail(`no hill ${o.hill}: ${Object.keys(HILLS).join(', ')}`);
  if (o.worst && !o.bench.length) fail('--worst needs a --bench');
  const hill = o.hill ?? defaultHill(o.dir);
  const t0 = performance.now();
  const kinds = hillKinds(o.dir, { hill, out: o.out ?? defaultOut(o.dir, hill), log: (s) => console.error(s) });
  const n = Object.keys(kinds.warriors).length;
  console.error(`${n} warriors of ${o.dir} (${hill}), ${kinds.measured} measured, ${((performance.now() - t0) / 1000).toFixed(1)} s; cache ${kinds.out}`);
  const benches = o.bench.map((file) => {
    const json = JSON.parse(readFileSync(file, 'latin1'));
    const values = benchPoints(json);
    const unknown = Object.keys(values).filter((f) => !(f in kinds.warriors));
    if (unknown.length) console.error(`${unknown.length} opponents of the bench ${file} are not in ${o.dir}, e.g. ${unknown[0]}: left out`);
    return { name: json.names[0], rounds: json.options.rounds, values };
  });
  const short = (k) => (k === 'not measured' ? k : shortKind(k));
  const num = (x) => (x === null ? '–' : x.toFixed(1));
  if (!o.roundRobin && benches.length < 2) {
    const values = benches[0]?.values ?? null;
    if (values) console.log(`${benches[0].name} against them, points per 100 rounds (${benches[0].rounds} rounds each)`);
    console.log(`${'kind'.padEnd(12)}${'warriors'.padStart(9)}${values ? 'mean'.padStart(8) : ''}`);
    for (const g of byKind(kinds, values)) console.log(`${short(g.kind).padEnd(12)}${String(g.count).padStart(9)}${values ? num(g.mean).padStart(8) : ''}`);
  }
  const wide = (label, row, width) => `${label.padEnd(width)}${[...GROUPS, 'all'].map((g) => num(row[g]).padStart(9)).join('')}`;
  const head = (label, width) => `${label.padEnd(width)}${[...GROUPS, 'all'].map((g) => g.padStart(9)).join('')}`;
  let top = null;
  if (o.roundRobin) {
    const json = JSON.parse(readFileSync(o.roundRobin, 'latin1'));
    const rr = roundRobin(json, kinds);
    if (rr.files.length < 2) fail(`${o.roundRobin} has fewer than 2 warriors of ${o.dir}`);
    const order = ranking(rr);
    const group = rr.files.map((f) => groupOf(kinds.warriors[f].kind));
    console.log(`${rr.files.length} warriors of ${o.dir} against each other, points per 100 rounds (${json.options.rounds} rounds each)${rr.left ? `; ${rr.left} other warriors of the tournament left out` : ''}`);
    console.log(`\nbest ${num(scoreAt(rr, 0))}, best tenth from ${num(scoreAt(rr, 0.1))}, best quarter from ${num(scoreAt(rr, 0.25))}, median ${num(scoreAt(rr, 0.5))}, lowest quarter below ${num(scoreAt(rr, 0.75))}, lowest tenth below ${num(scoreAt(rr, 0.9))}`);
    console.log(`\n${'#'.padStart(3)}  ${'warrior'.padEnd(44)}${'kind'.padEnd(10)}${'score'.padStart(7)}`);
    order.slice(0, o.top).forEach((i, r) => console.log(`${String(r + 1).padStart(3)}  ${`${kinds.warriors[rr.files[i]].name} (${rr.files[i]})`.slice(0, 43).padEnd(44)}${shortKind(kinds.warriors[rr.files[i]].kind).padEnd(10)}${num(rr.score[i]).padStart(7)}`));
    const table = kindTable(rr, kinds);
    console.log(`\nkind against kind: the mean of a row's warriors against a column's\n${head('kind', 18)}`);
    for (const g of GROUPS) if (table.count[g]) console.log(wide(`${g} (${table.count[g]})`, table.mean[g], 18));
    top = meanAgainst(rr, group, order.slice(0, o.top));
  }
  if (benches.length > 1 || (o.roundRobin && benches.length)) {
    const width = Math.max(28, ...benches.map((b) => b.name.length + 2));
    console.log(`\nbenches by the kind of the opponent, points per 100 rounds\n${head('warrior', width)}`);
    for (const b of benches) console.log(wide(b.name, benchRow(kinds, b.values), width));
    if (top) console.log(wide(`mean of the best ${o.top}`, top, width));
  }
  if (top && benches.length) {
    console.log(`\n${benches[0].name}: what each kind would give if it did as well against it as the best ${o.top}\n${'kind'.padEnd(10)}${'share'.padStart(7)}${`top ${o.top}`.padStart(9)}${'ours'.padStart(8)}${'gap'.padStart(7)}`);
    for (const g of gaps(kinds, benchRow(kinds, benches[0].values), top)) {
      console.log(`${g.group.padEnd(10)}${`${(100 * g.share).toFixed(1)}%`.padStart(7)}${num(g.top).padStart(9)}${num(g.ours).padStart(8)}${g.gap.toFixed(1).padStart(7)}`);
    }
  }
  if (o.worst) {
    console.log(`\n${benches[0].name}: the ${o.worst} opponents it scores least against\n${'points'.padStart(6)}  ${'file'.padEnd(28)}${'kind'.padEnd(10)}strategy`);
    for (const w of worst(Object.fromEntries(Object.entries(benches[0].values).filter(([f]) => f in kinds.warriors)), o.worst)) {
      const text = readFileSync(join(o.dir, w.file), 'latin1');
      const strategy = /^;strategy[ \t]+(\S.*)$/im.exec(text)?.[1].trim() ?? '';
      console.log(`${num(w.points).padStart(6)}  ${w.file.padEnd(28)}${shortKind(kinds.warriors[w.file].kind).padEnd(10)}${strategy.slice(0, 90)}`);
    }
  }
}

function fail(why) {
  console.error(`${why}\n${USAGE}`);
  process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
