#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Ranks the warriors of a tournament by diversity push-off (tools/diversity.js),
// the scoring of Tournament Weekend 2026: the matrix comes from the JSON of
// tools/tournament.mjs.
//
//   node tools/tournament.mjs <dir> --rounds 100 --json t.json
//   node tools/pushoff.mjs t.json [--sd opponent|sum] [--alpha 1] [--json out.json]
//
// --sd picks the reading of the SD-score: 'opponent' (the paper's
// pseudocode, each column divided by its own standard deviation, default)
// or 'sum' (its Eq. 6). --alpha weighs the distance: value = average *
// distance^alpha, 1 in the tournament. Scores are points per 100 rounds (3 a
// win, 1 a tie). Rank 1 is the warrior left at the end; each line shows the
// values with which a warrior left: its average, the nearest other warrior
// and the SD-score to it.

import { readFileSync, writeFileSync } from 'node:fs';
import { pushoff } from './diversity.js';

function parse(argv) {
  const o = { sd: 'opponent', alpha: 1, json: null, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sd') o.sd = argv[++i];
    else if (a === '--alpha') o.alpha = Number(argv[++i]);
    else if (a === '--json') o.json = argv[++i];
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else o.file = a;
  }
  if (!o.file) throw new Error('usage: node tools/pushoff.mjs <tournament.json> [--sd opponent|sum] [--alpha 1] [--json out.json]');
  if (o.sd !== 'opponent' && o.sd !== 'sum') throw new Error(`--sd: 'opponent' or 'sum', not '${o.sd}'`);
  if (!(o.alpha >= 0)) throw new Error('--alpha: a number >= 0');
  return o;
}

function rank(tournament, { sd = 'opponent', alpha = 1 } = {}) {
  const { names, matrix } = tournament;
  const rounds = tournament.options.rounds;
  const score = matrix.map((row) => row.map((v) => (v === null ? null : (100 * v) / rounds)));
  const order = pushoff(score, { variant: sd, alpha }).reverse();
  return order.map((v, i) => ({ rank: i + 1, name: names[v.index], avg: v.avg, nearest: v.nearest < 0 ? null : names[v.nearest], distance: v.distance, value: v.value }));
}

function main() {
  const o = parse(process.argv.slice(2));
  const ranking = rank(JSON.parse(readFileSync(o.file, 'utf8')), o);
  const width = Math.min(40, Math.max(4, ...ranking.map((r) => r.name.length)));
  console.log(`${'rank'.padStart(4)}  ${'warrior'.padEnd(width)} ${'avg'.padStart(7)} ${'distance'.padStart(9)} ${'value'.padStart(9)}  nearest`);
  for (const r of ranking) {
    const num = (x, w, d) => (r.rank === 1 ? '' : x.toFixed(d)).padStart(w);
    console.log(`${String(r.rank).padStart(4)}  ${r.name.slice(0, width).padEnd(width)} ${num(r.avg, 7, 1)} ${num(r.distance, 9, 3)} ${num(r.value, 9, 1)}  ${r.rank === 1 ? '' : r.nearest}`);
  }
  if (o.json) writeFileSync(o.json, JSON.stringify({ sd: o.sd, alpha: o.alpha, ranking }, null, 1) + '\n');
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
