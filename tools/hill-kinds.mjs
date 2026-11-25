#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The kind of style (tools/style.js) of every warrior of a hill folder,
// cached, and a bench broken down by those kinds (#221).
//
//   node tools/hill-kinds.mjs <dir> [--hill 94nop|tiny] [--out <file>] [--bench <file.json>]
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
// and the mean points per 100 rounds against them.

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

const USAGE = 'usage: node tools/hill-kinds.mjs <dir> [--hill 94nop|tiny] [--out <file>] [--bench <file.json>]';

function main(argv) {
  const o = { dir: null, hill: null, out: null, bench: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) fail(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--hill') o.hill = value();
    else if (a === '--out') o.out = value();
    else if (a === '--bench') o.bench = value();
    else if (a.startsWith('-')) fail(`unknown option ${a}`);
    else if (o.dir) fail(`one folder only, not ${o.dir} and ${a}`);
    else o.dir = a;
  }
  if (!o.dir) fail('no folder');
  if (!existsSync(o.dir)) fail(`no folder ${o.dir}`);
  if (o.hill && !HILLS[o.hill]) fail(`no hill ${o.hill}: ${Object.keys(HILLS).join(', ')}`);
  const hill = o.hill ?? defaultHill(o.dir);
  const t0 = performance.now();
  const kinds = hillKinds(o.dir, { hill, out: o.out ?? defaultOut(o.dir, hill), log: (s) => console.error(s) });
  const n = Object.keys(kinds.warriors).length;
  console.error(`${n} warriors of ${o.dir} (${hill}), ${kinds.measured} measured, ${((performance.now() - t0) / 1000).toFixed(1)} s; cache ${kinds.out}`);
  let values = null, title = '';
  if (o.bench) {
    const json = JSON.parse(readFileSync(o.bench, 'utf8'));
    values = benchPoints(json);
    title = `${json.names[0]} against them, points per 100 rounds (${json.options.rounds} rounds each)`;
    const unknown = Object.keys(values).filter((f) => !(f in kinds.warriors));
    if (unknown.length) console.error(`${unknown.length} opponents of the bench are not in ${o.dir}, e.g. ${unknown[0]}: left out`);
  }
  if (title) console.log(title);
  console.log(`${'kind'.padEnd(12)}${'warriors'.padStart(9)}${values ? 'mean'.padStart(8) : ''}`);
  for (const g of byKind(kinds, values)) {
    console.log(`${(g.kind === 'not measured' ? 'not measured' : shortKind(g.kind)).padEnd(12)}${String(g.count).padStart(9)}${values ? (g.mean === null ? '–' : g.mean.toFixed(1)).padStart(8) : ''}`);
  }
}

function fail(why) {
  console.error(`${why}\n${USAGE}`);
  process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
