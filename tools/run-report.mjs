#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The status of 42evolve runs in one command, from their folders alone:
//
//   node tools/run-report.mjs <run> [<run> ...] [--full] [--json]
//        [--bench --opponents <dir> [--rounds 100] [--jobs N]]
//
// A run is a run folder or a folder of islands (42evolve --islands). For
// each it prints
//   - per island: its batches and members, the best against the whole
//     opponent folder at each score (islands.jsonl: the best of best.red and
//     the 3 best by panel average, up to 8 of the scores, the last one is
//     the score now), the best of all scores and its batch, the best
//     average against the panel now and the best against the holdout;
//   - the families on top: the 3 best members of each island by panel
//     average, with name (the noun is the family), kind of style
//     (tools/style.js) and opcodes, and the designs (opcode sequences) that
//     most of them share: one design that took every island shows at once;
//   - new designs: each family and kind of style the first time it holds a
//     place among the 3 best of an island for 10 batches in a row, with the
//     batch it came in (those of the first 10 batches only as a count, and
//     without --full the last 6);
//   - the line of best.red: its first parents back to where it came from,
//     across islands (a migrant goes on in the island it came from), the
//     changes that made each step; without --full the steps that changed
//     the opcodes or the island, and the last 3;
// and with several runs the same numbers side by side, at the last batch
// all of them have.
//
// It reads events.jsonl as a stream with tools/progress.js (RunDigest), on
// --jobs worker threads (all hardware threads), one island at a time each,
// and decodes only the lines and the parts of lines it needs: 9.7 GB of
// events of 16 islands took 41 s of CPU time and 1.1 GB at most
// (docs/evolver.md).
//
// --bench plays the run's best.red and, of each island, its best.red and the
// 3 best by panel average against every warrior of --opponents (the rule of
// .claude/rules/evolver.md), with tools/tournament.mjs (benchMany: all
// warriors in one task list on --jobs threads), --rounds rounds each, the
// rules of the run. --json prints everything as JSON instead of the tables.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { RunDigest, bestRedInfo, familyOf, lineOf, opcodesOf } from './progress.js';
import { shortKind } from './style.js';

const HOLD = 10; // the batches a new design holds a place among the 3 best (RunDigest)
const USAGE = 'usage: node tools/run-report.mjs <run folder or folder of islands> [...] [--full] [--json] [--bench --opponents <dir> [--rounds 100] [--jobs N]]';

// ------------------------------------------------------------------ reading

// Feeds the lines of an events.jsonl to a RunDigest, decoding only those of
// its types, and of an enter line what comes before its scores. Lines are
// found in the bytes: most of a long run's bytes are scores (complete,
// enter) and need no string.
async function digestFile(file) {
  const digest = new RunDigest({ hold: HOLD });
  const cuts = RunDigest.CUTS.map((c) => Buffer.from(c));
  const fh = await open(file, 'r').catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e))); // an island 42evolve has not written yet
  if (!fh) return digest.result();
  const size = Number(process.env.RUN_REPORT_BUFFER); // the tests set it lower
  let buf = Buffer.allocUnsafe(Number.isInteger(size) && size > 0 ? size : 1 << 20), have = 0, at = 0;
  const line = (s, e) => {
    if (buf[s] !== 123 || e - s < 12) return; // {
    const q = buf.indexOf(34, s + 9); // the " after the type
    if (q < 0 || q >= e) return;
    const type = buf.toString('latin1', s + 9, q);
    if (!RunDigest.TYPES.has(type)) return;
    let end = e;
    if (type === 'enter') {
      const one = buf.subarray(s, e);
      for (const c of cuts) {
        const k = one.indexOf(c);
        if (k >= 0) {
          end = s + k + c.length;
          break;
        }
      }
    }
    digest.add(buf.toString('utf8', s, end));
  };
  try {
    for (;;) {
      if (have === buf.length) { // a line longer than the buffer
        const bigger = Buffer.allocUnsafe(2 * buf.length);
        buf.copy(bigger, 0, 0, have);
        buf = bigger;
      }
      const { bytesRead } = await fh.read(buf, have, buf.length - have, at);
      at += bytesRead;
      const end = have + bytesRead;
      let s = 0;
      for (let nl; (nl = buf.indexOf(10, s)) >= 0 && nl < end; s = nl + 1) line(s, nl);
      if (bytesRead === 0) break; // a last line without its newline is being written: left out
      buf.copy(buf, 0, s, end);
      have = end - s;
    }
  } finally {
    await fh.close();
  }
  return digest.result();
}

// The digests of the files, at most `jobs` at a time, each on a worker thread.
async function digestAll(files, jobs) {
  const out = new Array(files.length);
  let next = 0;
  const one = async () => {
    while (next < files.length) {
      const k = next++;
      out[k] = await new Promise((done, fail) => {
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: { file: files[k] }, resourceLimits: { maxYoungGenerationSizeMb: 8 } });
        w.once('message', (m) => (m.error ? fail(new Error(`${files[k]}: ${m.error}`)) : done(m.ok)));
        w.once('error', fail);
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, files.length) }, one));
  return out;
}

const jsonLines = (file) => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).flatMap((l) => {
  try {
    return [JSON.parse(l)];
  } catch {
    return []; // a line being written
  }
}) : []);

// A run folder or a folder of islands, read: { dir, name, islands: [{ island,
// dir, live, digest }], scores (the events score), settings (the event
// islands), best (best.red) }. island is 0 for a run without islands.
async function readRun(dir, jobs) {
  const name = /^island-\d+$/.test(basename(dir)) ? `${basename(resolve(dir, '..'))}/${basename(dir)}` : basename(dir); // as tools/serve.mjs names it
  const isFolder = existsSync(join(dir, 'islands.txt'));
  const islands = isFolder
    ? readdirSync(dir).filter((n) => /^island-\d+$/.test(n)).map((n) => ({ island: Number(n.slice(7)), dir: join(dir, n) })).sort((a, b) => a.island - b.island)
    : [{ island: 0, dir }];
  const live = /^live((?: \d)*)$/m.exec(isFolder ? readFileSync(join(dir, 'islands.txt'), 'utf8') : '')?.[1].trim().split(' ').map(Number) ?? [];
  for (const x of islands) x.live = live[x.island - 1] !== 0;
  const digests = await digestAll(islands.map((x) => join(x.dir, 'events.jsonl')), jobs);
  islands.forEach((x, k) => { x.digest = digests[k]; });
  const root = jsonLines(join(dir, 'islands.jsonl'));
  const best = existsSync(join(dir, 'best.red')) ? readFileSync(join(dir, 'best.red'), 'latin1') : null;
  return { dir, name, isFolder, islands, scores: root.filter((e) => e.type === 'score'), settings: root.find((e) => e.type === 'islands') ?? null, best: best && { text: best, ...bestRedInfo(best) } };
}

// ------------------------------------------------------------------ the report

// The last of items ({ batch, ... } in the order of their batches) at or before batch, null none.
const atBatch = (items, batch) => {
  let r = null;
  for (const x of items) if (x.batch <= batch) r = x;
  return r;
};

function report(run) {
  const index = new Map(run.islands.map((x) => [x.island, new Map(x.digest.warriors.map((w) => [w[0], w]))]));
  const warrior = (island, id) => index.get(island)?.get(id);
  // a warrior by its island and id: { id, name, kind, opcodes, panelAvg }, undefined unknown
  const lookup = (island, id) => {
    const w = warrior(island, id);
    return w && { id, name: w[5], kind: w[6], opcodes: w[7], panelAvg: w[8] };
  };
  const islands = run.islands.map((x) => {
    const d = x.digest;
    const scores = run.scores.map((s) => {
      const i = s.islands.find((y) => y.island === x.island);
      if (!i) return null;
      const top = i.warriors.filter((w) => w.tag !== 'design').sort((a, b) => b.score - a.score)[0]; // the island's score: a design does not count (#220)
      return { batch: s.batch, score: i.score, tag: top?.tag, ...(lookup(x.island, top?.id) ?? { id: top?.id }) };
    }).filter(Boolean);
    const best = scores.reduce((b, s) => (!b || s.score > b.score ? s : b), null);
    const last = d.top.at(-1);
    return {
      island: x.island, dir: x.dir, live: x.live, batch: d.batch, members: d.members, seed: d.start?.params?.seed,
      scores, best, now: scores.at(-1) ?? null,
      panel: last ? last[1] : null, holdout: d.holdout,
      top: d.now, designs: d.designs,
      history: d.top.map(([batch, bestPanel, mean, holdout, ...ids]) => ({ batch, best: bestPanel, mean, holdout, top: ids.filter((id) => id >= 0) })),
    };
  });
  // the line of best.red: of a folder its island and warrior, of a run its warrior
  let line = null;
  const b = run.best;
  if (b?.id !== null && b?.id !== undefined) line = lineOf(warrior, run.isFolder ? b.island : 0, b.id);
  const start = run.islands[0]?.digest.start;
  const r = {
    dir: run.dir, name: run.name, isFolder: run.isFolder, islands, settings: run.settings, rules: start?.rules ?? null, opponents: run.settings?.opponents ?? start?.opponents ?? null,
    scoreRounds: run.scores.at(-1)?.rounds ?? null, scoreOpponents: run.scores.at(-1)?.opponents ?? null,
    batch: Math.max(-1, ...islands.map((x) => x.batch)),
    best: b && { island: b.island, id: b.id, batch: b.batch, score: b.score, holdout: b.holdout, name: line?.at(-1)?.name ?? /^;name (.*)$/m.exec(b.text)?.[1] ?? null, opcodes: opcodesOf(b.text.replace(/^;.*$/gm, '')) },
    line,
  };
  Object.defineProperty(r, 'lookup', { value: lookup }); // not in --json
  return r;
}

// The 3 best by panel average of each island at batch (the last values
// event at or before it), and the designs they share.
function onTop(r, batch) {
  const all = [];
  for (const x of r.islands) {
    const h = atBatch(x.history, batch);
    if (!h) continue;
    const now = batch >= x.batch ? x.top : null; // with code, for --bench
    h.top.forEach((id, rank) => {
      const w = now?.[rank] ?? r.lookup(x.island, id);
      if (w) all.push({ island: x.island, rank: rank + 1, ...w });
    });
  }
  const designs = new Map();
  for (const w of all) {
    const d = designs.get(w.opcodes) ?? { opcodes: w.opcodes, count: 0, islands: new Set(), kinds: new Map() };
    d.count++;
    d.islands.add(w.island);
    d.kinds.set(shortKind(w.kind), (d.kinds.get(shortKind(w.kind)) ?? 0) + 1);
    designs.set(w.opcodes, d);
  }
  const shared = [...designs.values()].sort((a, b) => b.count - a.count || b.islands.size - a.islands.size)
    .map((d) => ({ opcodes: d.opcodes, count: d.count, islands: [...d.islands].sort((a, b) => a - b), kinds: [...d.kinds].sort((a, b) => b[1] - a[1]).map(([k]) => k) }));
  return { members: all, designs: shared };
}

// ------------------------------------------------------------------ text

const f1 = (x) => (x === null || x === undefined || x < 0 || Number.isNaN(x) ? '–' : x.toFixed(1));
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const short = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);
const islandName = (i) => (i ? `island-${String(i).padStart(2, '0')}` : 'run');
// up to n of the items, evenly, always the last
const sample = (items, n) => (items.length <= n ? items : Array.from({ length: n }, (_, k) => items[Math.round((k * (items.length - 1)) / (n - 1))]));
const ops = (o, n = 40) => {
  const words = o ? o.split(' ') : [];
  return words.length * 4 - 1 <= n ? words.join(' ') : `${words.slice(0, Math.floor((n - 6) / 4)).join(' ')} … (${words.length})`;
};

function text(r, o) {
  const out = [];
  const rules = r.rules ? `core ${r.rules.size}, ${r.rules.cycles} cycles, length ${r.rules.length}` : 'no start event';
  const isl = r.islands.length > 1 || r.islands[0]?.island ? `${r.islands.length} islands, ` : '';
  out.push(`${r.dir}: ${isl}batch ${r.batch}, ${rules}${r.opponents ? `, opponents ${r.opponents}` : ''}`);
  if (r.best) {
    const where = r.best.island ? `${islandName(r.best.island)} ` : '';
    const score = r.best.score !== null ? `${f1(r.best.score)} against the ${r.scoreOpponents ?? ''} warriors of the folder` : `${f1(r.best.holdout)} against the holdout`;
    out.push(`best.red: ${where}#${r.best.id} ${r.best.name ?? ''}, ${r.best.score !== null ? 'scored at' : 'from'} batch ${r.best.batch}, ${score}`);
  }
  // the islands
  out.push('');
  const scored = [...new Set(r.islands.flatMap((x) => x.scores.map((s) => s.batch)))].sort((a, b) => a - b);
  const cols = sample(scored, 8);
  if (scored.length) out.push(`Against the ${r.scoreOpponents} warriors of the folder (${r.scoreRounds} rounds), the best of best.red and the 3 best by panel average, at ${cols.length < scored.length ? `${cols.length} of the ${scored.length} scores` : 'each score'}:`);
  out.push(`${pad('island', 10)}${lpad('batch', 6)}${lpad('list', 5)}${cols.map((c) => lpad(`b${c}`, 7)).join('')}${scored.length ? `  ${pad('best (batch)', 14)}` : ''}${lpad('panel', 7)}${lpad('holdout', 9)}`);
  for (const x of r.islands) {
    const at = new Map(x.scores.map((s) => [s.batch, s.score]));
    out.push(`${pad(islandName(x.island) + (x.live ? '' : '*'), 10)}${lpad(x.batch, 6)}${lpad(x.members, 5)}${cols.map((c) => lpad(f1(at.get(c)), 7)).join('')}${scored.length ? `  ${pad(x.best ? `${f1(x.best.score)} (${x.best.batch})` : '–', 14)}` : ''}${lpad(f1(x.panel), 7)}${lpad(f1(x.holdout?.avg), 9)}`);
  }
  if (r.islands.some((x) => !x.live)) out.push('* stopped by the score');
  // the families on top
  const top = onTop(r, r.batch);
  out.push('', 'The 3 best by panel average of each island now:');
  const nw = Math.min(24, Math.max(4, ...top.members.map((w) => w.name.length)));
  out.push(`${pad('island', 10)}${lpad('#', 2)} ${lpad('id', 7)}  ${pad('name', nw)}${lpad('panel', 7)}  ${pad('kind', 11)}opcodes`);
  let previous = null;
  for (const w of top.members) {
    out.push(`${pad(w.island === previous ? '' : islandName(w.island), 10)}${lpad(w.rank, 2)} ${lpad(w.id, 7)}  ${pad(short(w.name, nw), nw)}${lpad(f1(w.panelAvg), 7)}  ${pad(shortKind(w.kind) || '–', 11)}${ops(w.opcodes)}`);
    previous = w.island;
  }
  if (r.islands.length > 1) {
    out.push('', `Designs on top (opcodes of the ${top.members.length} best of ${r.islands.length} islands):`);
    for (const d of top.designs.slice(0, 5)) out.push(`  ${lpad(d.count, 3)} on ${lpad(d.islands.length, 2)} island${d.islands.length > 1 ? 's' : ' '}  ${pad(d.kinds.join(', '), 16)}${ops(d.opcodes, 56)}`);
    if (top.designs.length > 5) out.push(`  and ${top.designs.length - 5} more`);
  }
  // new designs
  const EARLY = 10, SHOWN = 6;
  out.push('', `New designs: a family or (kind of style) the first time it holds a place among the 3 best of an island for ${HOLD} batches, with the batch it came in:`);
  for (const x of r.islands) {
    const late = x.designs.filter((d) => d.batch >= EARLY), early = x.designs.length - late.length;
    const shown = (o.full ? late : late.slice(-SHOWN)).map((d) => `${d.batch} ${d.new === 'family' ? d.family : `(${shortKind(d.kind) || '–'})`}`);
    const before = late.length - shown.length;
    out.push(`  ${pad(islandName(x.island), 10)}${early} in the first ${EARLY} batches${before ? `, ${before} more up to batch ${late[before - 1].batch}` : ''}${shown.length ? `; ${shown.join(', ')}` : ''}`);
  }
  // the line
  if (r.line) {
    out.push('', lineText(r, o.full));
  }
  return out.join('\n');
}

// The warriors a migrate event sent, for a step whose source is not known.
const candidates = (s) => s.from.map(([i, id]) => `${islandName(i)} #${id}`).join(', ');

function lineText(r, full) {
  const steps = r.line, out = [];
  const first = steps[0], last = steps.at(-1);
  const counts = new Map();
  for (const s of steps.slice(1)) for (const op of (s.ops ?? '').split(' ').filter(Boolean)) counts.set(op, (counts.get(op) ?? 0) + 1);
  const crossings = steps.filter((s, k) => k && s.island !== steps[k - 1].island).length;
  const origin = !first.missing ? `${first.ops} ${first.name} in batch ${first.batch}${first.island ? ` of ${islandName(first.island)}` : ''}`
    : first.id === null ? `a warrior of ${candidates(first)}, ${first.ambiguous ? 'not sure which' : 'none known with its code'}`
    : `warrior #${first.id}${first.island ? ` of ${islandName(first.island)}` : ''}, not in the events`;
  out.push(`The line of best.red (${last.name}): ${steps.length - 1} steps back to ${origin}${crossings ? `, ${crossings} from another island` : ''}.`);
  out.push(`  changes on the line: ${[...counts].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  // without --full: the first step, the last 3, and each that changed the opcodes or the island
  const keep = steps.map((s, k) => full || k === 0 || k >= steps.length - 3 || s.missing || steps[k - 1].missing
    || s.island !== steps[k - 1].island || s.opcodes !== steps[k - 1].opcodes);
  const nw = Math.min(24, Math.max(4, ...steps.map((s) => (s.name ?? '').length)));
  if (!full && keep.includes(false)) out.push('  without --full the steps that changed the opcodes or the island; +n: n steps before it, not shown');
  out.push(`  ${lpad('batch', 6)}${lpad('', 5)}  ${pad('island', 10)}${lpad('id', 7)}  ${pad('name', nw)}${lpad('panel', 7)}  ${pad('kind', 11)}${pad('change', 24)}opcodes`);
  let skipped = 0;
  steps.forEach((s, k) => {
    if (!keep[k]) return void skipped++;
    const plus = skipped ? `+${skipped}` : '';
    skipped = 0;
    if (s.missing && s.id === null) return void out.push(`  ${lpad('?', 6)}${lpad(plus, 5)}  ${s.ambiguous ? 'one of' : 'none known of'} ${candidates(s)}`);
    if (s.missing) return void out.push(`  ${lpad('?', 6)}${lpad(plus, 5)}  ${pad(islandName(s.island), 10)}${lpad(s.id, 7)}  not in the events`);
    out.push(`  ${lpad(s.batch, 6)}${lpad(plus, 5)}  ${pad(islandName(s.island), 10)}${lpad(s.id, 7)}  ${pad(short(s.name, nw), nw)}${lpad(f1(s.panelAvg), 7)}  ${pad(shortKind(s.kind) || '–', 11)}${pad(short(s.ops ?? '', 23), 24)}${ops(s.opcodes)}`);
  });
  return out.join('\n');
}

// Several runs at the last batch all of them have.
function compareText(rs) {
  const batch = Math.min(...rs.map((r) => r.batch));
  const rows = rs.map((r) => {
    const score = (() => {
      const at = r.islands.flatMap((x) => x.scores.filter((s) => s.batch <= batch).map((s) => ({ ...s, island: x.island })));
      const b = Math.max(-1, ...at.map((s) => s.batch));
      const there = at.filter((s) => s.batch === b);
      return there.length ? { batch: b, best: Math.max(...there.map((s) => s.score)), mean: there.reduce((a, s) => a + s.score, 0) / there.length } : null;
    })();
    const hist = r.islands.map((x) => atBatch(x.history, batch)).filter(Boolean);
    const top = onTop(r, batch);
    return {
      name: r.name, islands: r.islands.length, score,
      panel: Math.max(-1, ...hist.map((h) => h.best)), holdout: Math.max(-1, ...hist.map((h) => h.holdout)),
      design: top.designs[0], members: top.members.length,
      families: new Set(top.members.map((w) => `${w.island} ${familyOf(w.name)}`)).size,
      kinds: new Set(top.members.map((w) => shortKind(w.kind))).size,
    };
  });
  const w = Math.max(24, ...rows.map((x) => x.name.length + 2));
  const line = (label, f) => `${pad(label, 26)}${rows.map((x) => lpad(f(x), w)).join('')}`;
  return [`The runs at batch ${batch}:`,
    line('', (x) => x.name),
    line('islands', (x) => x.islands),
    line('score: best island', (x) => (x.score ? `${f1(x.score.best)} (${x.score.batch})` : '–')),
    line('score: mean of islands', (x) => f1(x.score?.mean)),
    line('best against the panel', (x) => f1(x.panel)),
    line('best against the holdout', (x) => f1(x.holdout)),
    line('families on top', (x) => `${x.families} of ${x.members}`),
    line('kinds on top', (x) => x.kinds),
    line('design most on top', (x) => (x.design ? `${x.design.count}x ${short(x.design.opcodes, w - 6)}` : '–')),
  ].join('\n');
}

// ------------------------------------------------------------------ --bench

async function bench(rs, o) {
  const { benchMany, defaultOptions } = await import('./tournament.mjs');
  const opponents = readdirSync(o.opponents).filter((f) => /\.(red|rc)$/i.test(f)).sort().map((f) => join(o.opponents, f));
  const out = [];
  for (const r of rs) {
    const rules = r.rules;
    if (!rules) throw new Error(`${r.dir}: no start event, so no rules to play by`);
    const warriors = [];
    if (r.best && r.isFolder) warriors.push({ what: 'best.red', island: 0, id: r.best.id, name: `${r.best.name} (${islandName(r.best.island)})`, file: join(r.dir, 'best.red') });
    for (const x of r.islands) {
      const file = join(x.dir, 'best.red'), text = existsSync(file) ? readFileSync(file, 'latin1') : null;
      if (text) warriors.push({ what: 'best.red', island: x.island, id: bestRedInfo(text).id, name: /^;name (.*)$/m.exec(text)?.[1], file });
      for (const [k, w] of x.top.entries()) if (w.code) warriors.push({ what: `panel #${k + 1}`, island: x.island, id: w.id, name: w.name, file: `${islandName(x.island)}-${w.id}.red`, source: `;redcode\n;name ${w.name}\n${w.code}` });
    }
    const opts = { ...defaultOptions(), rounds: o.rounds, jobs: o.jobs, size: rules.size, cycles: rules.cycles, processes: rules.processes, length: rules.length, distance: rules.distance };
    const t0 = performance.now();
    const scores = await benchMany(warriors, opponents, opts);
    console.error(`${r.name}: ${warriors.length} warriors against ${scores[0]?.opponents ?? 0} opponents, ${o.rounds} rounds each, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    out.push({ name: r.name, isFolder: r.isFolder, rounds: o.rounds, opponents: o.opponents, warriors: warriors.map((w, k) => ({ what: w.what, island: w.island, id: w.id, name: w.name, ...scores[k] })) });
  }
  return out;
}

function benchText(b) {
  const out = [`${b.name} against the ${b.warriors[0]?.opponents ?? 0} warriors of ${b.opponents}, ${b.rounds} rounds each:`];
  const nw = Math.min(28, Math.max(4, ...b.warriors.map((w) => (w.name ?? '').length)));
  out.push(`${pad('island', 10)}${pad('warrior', 10)}${lpad('id', 7)}  ${pad('name', nw)}${lpad('score', 7)}`);
  for (const w of b.warriors) out.push(`${pad(w.island ? islandName(w.island) : b.isFolder ? 'folder' : 'run', 10)}${pad(w.what, 10)}${lpad(w.id ?? '–', 7)}  ${pad(short(w.name ?? '', nw), nw)}${lpad(f1(w.per100), 7)}`);
  const islands = new Map();
  for (const w of b.warriors) if (w.island) islands.set(w.island, Math.max(islands.get(w.island) ?? -1, w.per100));
  if (islands.size > 1) out.push(`the best of each island: ${[...islands].map(([i, s]) => `${islandName(i)} ${f1(s)}`).join(', ')}`);
  return out.join('\n');
}

// ------------------------------------------------------------------ main

function parseArgs(argv) {
  const usage = (why) => {
    console.error(`${why}\n${USAGE}`);
    process.exit(2);
  };
  const o = { runs: [], full: false, json: false, bench: false, opponents: null, rounds: 100, jobs: availableParallelism() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => (i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[++i] : usage(`${a} needs a value`));
    const count = () => {
      const n = Number(value());
      return Number.isInteger(n) && n >= 1 ? n : usage(`${a} needs a number of 1 or more`);
    };
    if (a === '--full') o.full = true;
    else if (a === '--json') o.json = true;
    else if (a === '--bench') o.bench = true;
    else if (a === '--opponents') o.opponents = value();
    else if (a === '--rounds') o.rounds = count();
    else if (a === '--jobs') o.jobs = count();
    else if (a.startsWith('-')) usage(`unknown option ${a}`);
    else o.runs.push(resolve(a));
  }
  if (!o.runs.length) usage('no run');
  for (const d of o.runs) {
    if (!existsSync(d) || !statSync(d).isDirectory()) usage(`not a folder: ${d}`);
    if (!existsSync(join(d, 'islands.txt')) && !existsSync(join(d, 'events.jsonl'))) usage(`${d} is no run: no events.jsonl, no islands.txt`);
  }
  if (o.bench && !o.opponents) usage('--bench needs --opponents <dir>');
  if (!o.bench && o.opponents) usage('--opponents goes with --bench');
  if (o.opponents && !(existsSync(o.opponents) && statSync(o.opponents).isDirectory())) usage(`--opponents: not a folder: ${o.opponents}`);
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const runs = [];
  for (const d of o.runs) runs.push(await readRun(d, o.jobs));
  const rs = runs.map(report);
  const benches = o.bench ? await bench(rs, o) : null;
  if (o.json) {
    const plain = rs.map((r) => ({ ...r, onTop: onTop(r, r.batch) }));
    console.log(JSON.stringify({ runs: plain, bench: benches ?? undefined }, null, 1));
    return;
  }
  const parts = rs.map((r) => text(r, o));
  if (benches) benches.forEach((b, k) => { parts[k] += `\n\n${benchText(b)}`; });
  if (rs.length > 1) parts.push(compareText(rs));
  console.log(parts.join('\n\n\n'));
}

if (!isMainThread) {
  // a worker: the digest of one events.jsonl
  digestFile(workerData.file).then((r) => parentPort.postMessage({ ok: r }), (e) => parentPort.postMessage({ error: e.stack ?? String(e) }));
} else {
  await main();
}
