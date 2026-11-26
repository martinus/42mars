// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --events brief (#187), the default of a new run: a newcomer that leaves in
// the batch it entered is a short enter line, without its matches, screen
// points, code and generator, and without its complete line. Everything else
// is the events of --events full. What the evolver's test files share is in
// test/evolver-common.js; built with cc, or prebuilt in M42_BIN
// (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RunDigest } from '../tools/progress.js';
import { setup, cleanup, tmp, skip, TINY, run, events, without, stable } from './evolver-common.js';

before(() => setup({ base: false })); // no test here reads the base run
after(cleanup);

// a full list (8 of a batch of 24) with --stage, so that most newcomers leave in their batch and have a complete line
const ARGS = [...without(TINY, '--events', '--list', '--stage'), '--list', '8', '--stage', '20', '--reintroduce', '0.2'];
const B = 14;

// The events of a run with --events full as --events brief writes them: [expected events, ids of the brief ones].
function asBrief(full) {
  const born = new Map(), gone = new Set();
  for (const e of full) {
    if (e.type === 'enter') born.set(e.id, e.batch);
    if (e.type === 'leave' && born.get(e.id) === e.batch) gone.add(e.id);
  }
  const panel = new Set(full[0].panel.map((p) => p.id));
  const tie = full[0].params.tiePoints;
  const out = [];
  for (const e of full) {
    if (e.type === 'start') out.push({ ...e, params: { ...e.params, events: 'brief' } });
    else if (e.type === 'complete' && gone.has(e.id)) continue;
    else if (e.type === 'enter' && gone.has(e.id)) {
      const vs = e.scores.filter(([o]) => panel.has(o)).map(([, w, l, t]) => ((3 * w + tie * t) * 100) / (w + l + t));
      out.push({
        type: 'enter', batch: e.batch, id: e.id, name: e.name, parents: e.parents, ops: e.ops, length: e.length, screen: e.screen,
        estimate: e.estimate, style: { kind: e.style.kind }, newFamily: e.newFamily, origin: e.origin,
        panelAvg: Number((vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(4)), brief: true,
      });
    } else out.push(e);
  }
  return [out, gone];
}

test('--events brief: a newcomer that leaves in its batch is a short enter line without its complete line; the rest is --events full; the same on any thread count and after a resume', { skip }, () => {
  const full = join(tmp, 'full'), brief = join(tmp, 'brief');
  run(full, [...ARGS, '--events', 'full', '--threads', '4', '--batches', String(B)]);
  run(brief, [...ARGS, '--threads', '4', '--batches', String(B)]);
  const f = events(full), b = events(brief);
  assert.equal(f[0].params.events, 'full');
  assert.equal(b[0].params.events, 'brief'); // the default of a new run
  const [expected, gone] = asBrief(f);
  assert.ok(gone.size >= 20, `${gone.size} newcomers left in their batch`);
  assert.ok(f.some((e) => e.type === 'complete' && gone.has(e.id)), 'no complete line of a newcomer that left in its batch');
  assert.deepEqual(stable(b), stable(expected));
  const size = (d) => readFileSync(join(d, 'events.jsonl')).length;
  assert.ok(size(brief) < 0.8 * size(full), `${size(brief)} bytes brief, ${size(full)} full`);
  // the same after a resume on other threads
  const resumed = join(tmp, 'brief-resumed');
  run(resumed, [...ARGS, '--threads', '1', '--batches', String(B >> 1)]);
  run(resumed, ['--threads', '3', '--batches', String(B - (B >> 1))]);
  assert.deepEqual(stable(events(resumed)), stable(b));
  // run-report and the dashboard's digest: the same progress, designs and lineage; a brief warrior that has children
  // (it came back from the archive) has no opcodes and no hash
  const digest = (d) => {
    const x = new RunDigest({ hold: 2 });
    for (const line of readFileSync(join(d, 'events.jsonl'), 'latin1').trim().split('\n')) x.add(line);
    return { ...x.result(), start: null };
  };
  const df = digest(full), db = digest(brief);
  // a brief warrior with a child (back from the archive) has no opcodes and no hash: rare here, the next test has one
  df.warriors = df.warriors.map((w) => (gone.has(w[0]) ? [...w.slice(0, 7), '', w[8], '', ...w.slice(10)] : w));
  assert.deepEqual(db, df);
  assert.ok(df.top.length >= B);
});

test('RunDigest: a brief warrior that has a child (it came back from the archive) is in its lineage, without opcodes and hash', () => {
  const lines = [
    '{"type":"start","version":"x","rules":{},"params":{"events":"brief"},"panel":[{"id":0}],"holdout":[]}',
    '{"type":"enter","batch":0,"id":5,"name":"Lucky Ant","parents":[],"ops":"random","length":2,"screen":1,"estimate":1,"style":{"kind":"stone"},"newFamily":false,"origin":0,"panelAvg":12.5,"brief":true}',
    '{"type":"leave","batch":0,"id":5,"avg":1,"distance":1,"nearest":0,"value":1}',
    '{"type":"batch","batch":0,"members":0}',
    '{"type":"enter","batch":1,"id":7,"name":"Lucky Ant II","parents":[5],"ops":"reintroduce","length":2,"screen":1,"estimate":1,"style":{"kind":"stone"},"newFamily":false,"origin":0,"code":"        ORG     0\\n        MOV.I   $0, $1\\n","scores":[]}',
    '{"type":"values","batch":1,"values":[[7,1,1,-1,1,40]]}',
    '{"type":"batch","batch":1,"members":1}',
  ];
  const x = new RunDigest({ hold: 1 });
  for (const l of lines) x.add(l);
  const w = new Map(x.result().warriors.map((v) => [v[0], v]));
  assert.deepEqual([w.get(5)[7], w.get(5)[9], w.get(5)[5]], ['', '', 'Lucky Ant']);
  assert.equal(w.get(7)[1], 5);
  assert.equal(w.get(7)[7], 'MOV');
});
