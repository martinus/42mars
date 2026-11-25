// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// What the evolver's dashboard shows of a run without its whole history, in
// one place for the page (ui/evolver.js) and the server (tools/serve.mjs):
// the point of the progress chart of a batch, the members by kind of style,
// and what the head of a run's best.red says; and for tools/run-report.mjs
// what it keeps of a run (RunDigest), a family, the opcodes of a warrior and
// its line of ancestors (lineOf).

// The progress of a batch: the best and the mean of the members' averages
// against the panel (0 without members), and the best against the holdout
// so far.
export function progressPoint(panelAverages, holdout) {
  const n = panelAverages.length;
  return { best: n ? Math.max(...panelAverages) : 0, mean: n ? panelAverages.reduce((a, b) => a + b, 0) / n : 0, holdout };
}

// The members after a batch by kind of style (the dashboard's tab Kinds):
// kind -> count, '' for a member without a style.
export function kindCounts(kinds) {
  const counts = {};
  for (const k of kinds) counts[k ?? ''] = (counts[k ?? ''] ?? 0) + 1;
  return counts;
}

// From a best.red as 42evolve writes it: its score against the holdout and
// the batch it is from, null where the head does not say
// (";strategy evolved, warrior 9 of run seed 3, batch 5",
// ";strategy 101.5 against 100 holdout warriors, 88.0 against the panel").
// The best.red of a folder of islands names its island and warrior instead
// (";name island-07 best 12878", p0 to p2 in place of best for the 3 best by
// panel average; ";strategy evolved, island 7 (seed 307), batch 800",
// ";strategy 129.6 against the 1107 warriors of <dir>, 100 rounds each"):
// island, id and score against the folder; id is the warrior's number in its
// run, null where the head does not say.
export function bestRedInfo(text) {
  const holdout = /^;strategy ([\d.]+) against \d+ holdout/m.exec(text), batch = /^;strategy evolved, .*\bbatch (\d+)/m.exec(text);
  const warrior = /^;strategy evolved, warrior (\d+) /m.exec(text), island = /^;name island-(\d+) \w+ (\d+)/m.exec(text);
  const folder = /^;strategy ([\d.]+) against the \d+ warriors of /m.exec(text);
  return {
    holdout: holdout ? Number(holdout[1]) : null,
    batch: batch ? Number(batch[1]) : null,
    id: island ? Number(island[2]) : warrior ? Number(warrior[1]) : null,
    island: island ? Number(island[1]) : null,
    score: folder ? Number(folder[1]) : null,
  };
}

// The family of a warrior: the noun of its name ("Sneaky Mantis II" is a
// Mantis, evolver/names.c), the name itself where it has no second word.
export const familyOf = (name) => name.split(' ')[1] ?? name;

// The opcodes of a warrior's code as 42evolve writes it, in order, without
// ORG: "SPL MOV MOV DJN". Two warriors with the same sequence are one design
// with other modes and numbers.
export function opcodesOf(code) {
  const ops = [];
  for (const m of code.matchAll(/^\s*([A-Z]{3})\b/gm)) if (m[1] !== 'ORG' && m[1] !== 'END') ops.push(m[1]);
  return ops.join(' ');
}

// A hash of a text to find the same code again without keeping it: two
// hashes of 32 bits (FNV-1a and the multiplier 31) and the length, as text.
function hashOf(s) {
  let h = 0x811c9dc5, g = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = Math.imul(h ^ c, 16777619);
    g = (Math.imul(g, 31) + c) | 0;
  }
  return `${(h >>> 0).toString(36)}.${(g >>> 0).toString(36)}.${s.length}`;
}

const NUMBER = Object.fromEntries(['id', 'batch', 'members', 'avg'].map((k) => [k, new RegExp(`"${k}":(-?[\\d.]+(?:e[-+]?\\d+)?)`)]));

// The opcodes and the hash of a warrior of RunDigest, from its code, which
// it then forgets (the code of a member is in RunDigest.alive).
function finish(w) {
  if (w.opcodes === null) {
    w.opcodes = opcodesOf(w.code);
    w.hash = hashOf(w.code);
    w.code = null;
  }
  return w;
}

// What tools/run-report.mjs needs of a run, from its events.jsonl one line
// at a time, without the whole history: a run of 16 islands on the tiny hill
// had 9.7 GB of events (23rd November 2026). RunDigest.add(line) takes the
// lines in order; result() is a plain object (it goes from a worker thread
// to the main thread):
//
//   start     the rules and settings of the run (event start)
//   batch     the last batch, members its list after it
//   top       per batch: [batch, best and mean of the members' averages
//             against the panel, best against the holdout so far (-1 none),
//             the ids of the 3 best by panel average (-1 none)], as
//             progressPoint() of the dashboard: the members of the values
//             event, the holdout at the batch event (the bench of a batch
//             comes after its values)
//   now       the 3 best by panel average after the last batch, with code
//   designs   each family and each kind of style the first time it holds
//             a place among the 3 best by panel average for `hold` batches
//             in a row (values events), with the batch it came in and its
//             first warrior there: { batch, id, family, kind, opcodes, new:
//             'family' | 'kind' }. Without the hold most families among the
//             3 best are a member tied with the others for a batch or two:
//             an island of 6,500 batches had 150 such families
//   holdout   the best against the holdout: { id, avg, batch }, null none
//   warriors  every warrior that stayed past its batch or has children
//             (the others cannot be anyone's ancestor), one array each:
//             [id, first parent (-1 none), second parent (-1 none), batch,
//             ops (the changes that made it), name, kind of style, opcodes,
//             last average against the panel (-1 none), hash of its code,
//             a migrant: the [island, id] of each warrior its migrate event
//             sent (sourceOf() takes the one it is), else null, the batch it
//             left (-1 not)]
//
// Of the events only start, enter, leave, values, bench, migrate and batch
// are read (TYPES); of an enter event only what comes before the
// first of CUTS (its generator, its scores), so that a reader can leave the
// rest of a long line undecoded: a line cut after one of them is read as the
// whole line.
// A warrior that came and went in one batch without children waits among
// the last 1,024 such, since --reintroduce brings back one of the last 256
// pushed off as its child.
export class RunDigest {
  static TYPES = new Set(['start', 'enter', 'leave', 'values', 'bench', 'migrate', 'batch']);
  static CUTS = [',"gen":', ',"scores":'];

  constructor({ hold = 10 } = {}) {
    this.hold = hold;
    this.start = null;
    this.batch = -1;
    this.members = 0;
    this.known = new Map(); // id -> warrior, see result()
    this.recent = new Map(); // id -> warrior that came and went in one batch
    this.alive = new Map(); // id -> its code
    this.born = []; // the ids that entered in this batch
    this.migrants = []; // the candidates [island, id] of the last migrate event
    this.top = [];
    this.point = null; // the progress point of the values event, until its batch event
    this.designs = [];
    this.held = new Set(); // 'family Mantis', 'kind ...': the designs held already
    this.streaks = new Map(); // design -> { batch, w, n }: those among the 3 best now, since when, with whom, how long
    this.holdout = null;
    this.last = [];
  }

  add(line) {
    const type = /^\{"type":"([^"]+)"/.exec(line)?.[1];
    if (!RunDigest.TYPES.has(type)) return;
    const number = (key) => Number(NUMBER[key].exec(line)?.[1]);
    switch (type) {
      case 'start': {
        const e = JSON.parse(line);
        this.start = { rules: e.rules, params: e.params, opponents: e.opponents, version: e.version };
        break;
      }
      case 'enter': {
        let cut = -1;
        for (const c of RunDigest.CUTS) if ((cut = line.indexOf(c)) >= 0) break;
        const e = JSON.parse(cut < 0 ? line : `${line.slice(0, cut)}}`);
        for (const p of e.parents) {
          const w = this.known.get(p) ?? this.recent.get(p);
          if (!w) continue;
          w.kids = true;
          if (this.recent.delete(p)) this.known.set(p, finish(w));
        }
        const from = e.ops === 'migrant' ? this.migrants : null;
        // the opcodes and the hash once it stays (finish): most newcomers leave in their batch
        this.known.set(e.id, { id: e.id, parents: e.parents, batch: e.batch, ops: e.ops, name: e.name ?? `#${e.id}`, kind: e.style?.kind ?? '', code: e.code, opcodes: null, panelAvg: -1, hash: '', from, kids: false, left: -1 });
        this.alive.set(e.id, e.code);
        this.born.push(e.id);
        break;
      }
      case 'leave': {
        const id = number('id'), w = this.known.get(id);
        this.alive.delete(id);
        if (w) w.left = number('batch');
        break;
      }
      case 'migrate':
        this.migrants = JSON.parse(line).from;
        break;
      case 'values': {
        const e = JSON.parse(line);
        const ms = []; // the members: the panel warriors never enter
        for (const v of e.values) {
          if (!this.alive.has(v[0])) continue;
          const w = this.known.get(v[0]);
          if (w) w.panelAvg = v[5];
          ms.push(v);
        }
        ms.sort((a, b) => b[5] - a[5] || a[0] - b[0]);
        const p = progressPoint(ms.map((v) => v[5] ?? 0), -1);
        const ids = [0, 1, 2].map((k) => ms[k]?.[0] ?? -1);
        this.point = [e.batch, p.best, p.mean, ...ids]; // the holdout at the batch event: 42evolve writes the bench after the values
        this.last = ids.filter((id) => id >= 0);
        const now = new Map(); // design -> the first of the 3 best that has it
        for (const id of this.last) {
          const w = finish(this.known.get(id));
          for (const d of [`family ${familyOf(w.name)}`, `kind ${w.kind}`]) if (!now.has(d)) now.set(d, w);
        }
        for (const d of this.streaks.keys()) if (!now.has(d)) this.streaks.delete(d);
        for (const [d, w] of now) {
          const s = this.streaks.get(d) ?? { batch: e.batch, w, n: 0 };
          this.streaks.set(d, s);
          if (++s.n < this.hold || this.held.has(d)) continue;
          this.held.add(d);
          this.designs.push({ batch: s.batch, id: s.w.id, family: familyOf(s.w.name), kind: s.w.kind, opcodes: s.w.opcodes, new: d.startsWith('family') ? 'family' : 'kind' });
        }
        break;
      }
      case 'bench': {
        const avg = number('avg');
        if (!this.holdout || avg > this.holdout.avg) this.holdout = { id: number('id'), avg, batch: number('batch') };
        break;
      }
      case 'batch':
        this.batch = number('batch');
        // the progress point as the dashboard and tools/serve.mjs take it at the batch event, with the bench of this batch
        if (this.point?.[0] === this.batch) this.top.push([...this.point.slice(0, 3), this.holdout?.avg ?? -1, ...this.point.slice(3)]);
        this.point = null;
        this.members = number('members') || this.alive.size;
        // a warrior that came and went in this batch without children is nobody's ancestor, unless it comes back
        for (const id of this.born) {
          const w = this.known.get(id);
          if (!w) continue;
          if (this.alive.has(id) || w.kids) {
            finish(w);
            continue;
          }
          this.known.delete(id);
          this.recent.set(id, w);
          if (this.recent.size > 1024) this.recent.delete(this.recent.keys().next().value);
        }
        this.born = [];
        break;
      default:
    }
  }

  result() {
    const warriors = [...this.known.values()].map(finish).map((w) => [w.id, w.parents[0] ?? -1, w.parents[1] ?? -1, w.batch, w.ops, w.name, w.kind, w.opcodes, w.panelAvg, w.hash, w.from, w.left]);
    const now = this.last.map((id) => ({ ...this.byId(id), code: this.alive.get(id) }));
    return { start: this.start, batch: this.batch, members: this.members, top: this.top, now, designs: this.designs, holdout: this.holdout, warriors };
  }

  byId(id) {
    const w = this.known.get(id);
    if (w) finish(w);
    return w && { id, name: w.name, family: familyOf(w.name), kind: w.kind, opcodes: w.opcodes, panelAvg: w.panelAvg, batch: w.batch, ops: w.ops };
  }
}

// The line of a warrior: it and its first parents back to where it came
// from, the oldest first. warrior(island, id) gives the row of
// RunDigest.result().warriors (island 0 for a run without islands). Each
// step: { island, id, batch, ops, name, family, kind, opcodes, panelAvg }.
// A migrant continues on the island it came from (sourceOf). The oldest step
// has missing: true when the line goes on but its warrior is not known (a
// run continued with --start from another one, the history lost, a migrant
// whose source is not among the warriors of its migrate event); then island
// and id are null and from has the candidates, and ambiguous: true when
// more than one of them can be it.
export function lineOf(warrior, island, id) {
  const steps = [], seen = new Set();
  for (let at = [island, id]; at;) {
    const key = `${at[0]} ${at[1]}`;
    if (seen.has(key)) break;
    seen.add(key);
    const w = warrior(at[0], at[1]);
    if (!w) {
      steps.push({ island: at[0], id: at[1], missing: true });
      break;
    }
    const [wid, parent, , batch, ops, name, kind, opcodes, panelAvg, , from] = w;
    steps.push({ island: at[0], id: wid, batch, ops, name, family: familyOf(name), kind, opcodes, panelAvg });
    if (parent >= 0) at = [at[0], parent];
    else if (from?.length) {
      const source = sourceOf(warrior, w);
      at = source.at;
      if (!at) steps.push({ island: null, id: null, missing: true, ambiguous: source.ambiguous, from });
    } else at = null;
  }
  return steps.reverse();
}

// Where a migrant (a row of RunDigest.result().warriors) came from: { at:
// [island, id] or null, ambiguous }. 42evolve plays the warriors of a
// migrate event in their order and leaves out one whose code is in the list
// already, also one sent before in the same event: so it is the first of
// them with its code (the hash) that was a member of its island then
// (entered before the batch, not left before it). The only one sent, also
// when it is not known. Ambiguous when a warrior before it in that order is
// not known: that one may have had the same code.
export function sourceOf(warrior, w) {
  const from = w[10], batch = w[3];
  let unknown = false;
  for (const [i, j] of from) {
    const s = warrior(i, j);
    if (!s) {
      unknown = true;
      continue;
    }
    if (s[9] !== w[9] || s[3] >= batch || (s[11] >= 0 && s[11] < batch)) continue;
    return unknown ? { at: null, ambiguous: true } : { at: [i, j], ambiguous: false };
  }
  return { at: from.length === 1 ? from[0] : null, ambiguous: false };
}
