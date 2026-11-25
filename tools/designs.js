// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The designs of a run of islands, from the events `score` of its
// islands.jsonl (42evolve --score-designs, #220) and the kinds of the hill's
// warriors (tools/hill-kinds.mjs, #221): what the dashboard's tab Designs
// (#222) shows, and what tools/run-report.mjs can print. Plain functions on
// plain data, for the browser and Node alike.
//
// A design is a family (the noun of the name) and a kind of style. A score
// event has per island the best member of each design with enough members
// (tag `design`, with noun, kind and members) and every warrior's points per
// opponent (`points`, in the order of `files`) at its first place on the
// island.

// The points per opponent of the warrior w of island x: its own, or those of
// the first warrior of the island with its id (a warrior plays once).
function pointsOf(x, w) {
  return w.points ?? x.warriors.find((y) => y.id === w.id && y.points)?.points ?? null;
}

const keyOf = (w) => `${w.noun} · ${w.kind}`;

// The designs of one score event: [{ key, noun, kind, islands: [island],
// members (on all islands), best: { island, id, name, code, score, points } }],
// the best score first. Islands that have no design entries (a run before
// #220) give none.
export function designsAt(score) {
  const byKey = new Map();
  for (const x of score.islands) {
    for (const w of x.warriors) {
      if (w.tag !== 'design') continue;
      const key = keyOf(w);
      const d = byKey.get(key) ?? { key, noun: w.noun, kind: w.kind, islands: [], members: 0, best: null };
      d.islands.push(x.island);
      d.members += w.members;
      if (!d.best || w.score > d.best.score) {
        const own = x.warriors.find((y) => y.id === w.id && y.points) ?? w;
        d.best = { island: x.island, id: w.id, name: own.name ?? null, code: own.code ?? null, score: w.score, points: pointsOf(x, w) };
      }
      byKey.set(key, d);
    }
  }
  return [...byKey.values()].sort((a, b) => b.best.score - a.best.score || a.key.localeCompare(b.key));
}

// Points per 100 rounds against each kind of opponent: { kind: { mean, n } }
// from points per opponent (null: none), the files of the score, its rounds
// and kindOf (file -> kind, a file without one counts as '').
export function byKind(points, files, rounds, kindOf) {
  const out = {};
  if (!points) return out;
  files.forEach((f, o) => {
    const k = kindOf?.[f] ?? '';
    const g = (out[k] ??= { sum: 0, n: 0 });
    g.sum += (points[o] * 100) / rounds;
    g.n++;
  });
  for (const g of Object.values(out)) g.mean = g.sum / g.n, delete g.sum;
  return out;
}

// The table of the latest score: designsAt() of it, each with byKind of its
// best, `isNew` when the design was not in the score before, and its history:
// [{ batch, members, score }] at every score it was in.
export function designTable(scores, kindOf = null) {
  if (!scores.length) return [];
  const last = scores.at(-1), before = scores.length > 1 ? new Set(designsAt(scores.at(-2)).map((d) => d.key)) : null;
  const history = new Map();
  for (const s of scores) for (const d of designsAt(s)) {
    const h = history.get(d.key) ?? [];
    h.push({ batch: s.batch, members: d.members, score: d.best.score });
    history.set(d.key, h);
  }
  return designsAt(last).map((d) => ({ ...d, kinds: byKind(d.best.points, last.files, last.rounds, kindOf), isNew: before !== null && !before.has(d.key), history: history.get(d.key) }));
}

// Two designs side by side, from the best of each: where each is better by
// more than `margin` points per 100 rounds ({ file, kind, a, b }, the largest
// difference first), and the best-of bound: the mean over the opponents of
// the better of the two (what a warrior that played each opponent with the
// right one of them would score; an upper bound for a warrior made of both).
export function compareDesigns(a, b, files, rounds, kindOf = null, margin = 10) {
  const pa = a.best.points, pb = b.best.points;
  if (!pa || !pb) return null;
  const per100 = (p) => (p * 100) / rounds;
  const aBetter = [], bBetter = [];
  let bound = 0;
  files.forEach((file, o) => {
    const x = per100(pa[o]), y = per100(pb[o]);
    bound += Math.max(x, y);
    const row = { file, kind: kindOf?.[file] ?? '', a: x, b: y };
    if (x - y > margin) aBetter.push(row);
    else if (y - x > margin) bBetter.push(row);
  });
  aBetter.sort((p, q) => q.a - q.b - (p.a - p.b));
  bBetter.sort((p, q) => q.b - q.a - (p.b - p.a));
  const count = (rows) => rows.reduce((m, r) => ((m[r.kind] = (m[r.kind] ?? 0) + 1), m), {});
  return { aBetter, bBetter, aKinds: count(aBetter), bKinds: count(bBetter), bound: bound / files.length };
}
