// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --changes-learn (#251), change weights that follow what stays, per island.
// Every --learn-every batches the weight of each kind of change becomes that
// of --changes times its rate of successes over the last --learn-window
// batches relative to all kinds (genome_mix_learn(), whose bounds the C unit
// test checks). What the evolver's test files share is in
// test/evolver-common.js; built with cc, or prebuilt in M42_BIN
// (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setup, cleanup, tmp, evolve, skip, TINY, run, events, without, stable, checkValues, stateParam } from './evolver-common.js';

before(() => setup({ base: false }));
after(cleanup);

const PULL = 200;
const mixOf = (text) => Object.fromEntries(text.split(',').map((x) => x.split('=')).map(([k, v]) => [k, Number(v)]));

// Replays the learning of a run from its events: per batch the evaluated children of each kind (the second number
// of the kind in the batch event) and the successes among them (newcomers still in after their batch whose results
// against the panel differ from their first parent's, on the first stage with --stage, or whose parent is no member
// then), and at every step the weights. Returns the steps and the weights of the last one.
function checkLearn(evs, { every, window }) {
  const start = evs[0];
  assert.deepEqual([start.params.changesLearn, start.params.learnEvery, start.params.learnWindow], [true, every, window]);
  const base = Object.fromEntries(Object.entries(start.changes).filter(([, w]) => w > 0));
  const kinds = new Set(Object.keys(start.changes));
  const panel = new Set(start.panel.map((p) => p.id));
  const first = new Map(), alive = new Set(), perBatch = [];
  let born = [], left = new Set(), steps = 0, last = null, expectStep = false;
  for (const e of evs) {
    if (e.type === 'enter') {
      first.set(e.id, e.scores.filter((x) => panel.has(x[0])).map((x) => x.slice(0, 4).join(',')).join(' '));
      alive.add(e.id);
      born.push(e);
    }
    if (e.type === 'leave') alive.delete(e.id), left.add(e.id);
    if (e.type === 'batch') {
      const n = {}, s = {};
      for (const [k, c] of Object.entries(e.ops)) if (kinds.has(k)) n[k] = c[1];
      for (const x of born) {
        if (left.has(x.id)) continue;
        const p = x.parents[0];
        const twin = p !== undefined && alive.has(p) && x.ops !== 'reintroduce' && first.get(x.id) === first.get(p);
        if (twin) continue;
        for (const k of new Set(x.ops.split(' '))) if (kinds.has(k)) s[k] = (s[k] ?? 0) + 1;
      }
      perBatch[e.batch] = { n, s };
      born = [], left = new Set();
      expectStep = (e.batch + 1) % every === 0;
      if (expectStep) { // the step: the window's counts, genome_mix_learn()
        const N = {}, S = {};
        for (let b = Math.max(0, e.batch - window + 1); b <= e.batch; b++) {
          for (const [k, v] of Object.entries(perBatch[b].n)) N[k] = (N[k] ?? 0) + v;
          for (const [k, v] of Object.entries(perBatch[b].s)) S[k] = (S[k] ?? 0) + v;
        }
        const tn = Object.values(N).reduce((a, b) => a + b, 0), ts = Object.values(S).reduce((a, b) => a + b, 0);
        if (!(ts > 0)) expectStep = false;
        else {
          const rate = ts / tn, want = {};
          for (const [k, b] of Object.entries(base)) {
            let w = b * (((S[k] ?? 0) + PULL * rate) / ((N[k] ?? 0) + PULL)) / rate;
            w = Math.min(Math.max(w, b / 4), 4 * b);
            want[k] = Math.max(1, Math.floor(w + 0.5));
          }
          expectStep = { batch: e.batch, rate, want };
        }
      }
      continue;
    }
    if (e.type === 'changes') {
      assert.ok(expectStep && expectStep.batch === e.batch, `a step after batch ${e.batch}`);
      assert.equal(e.learned, true);
      assert.ok(Math.abs(e.rate - expectStep.rate) <= 1e-12 * expectStep.rate, `batch ${e.batch}: rate ${e.rate}, not ${expectStep.rate}`);
      const got = mixOf(e.changes);
      assert.deepEqual(Object.keys(got).sort(), Object.keys(base).sort(), 'the kinds drawn');
      for (const [k, w] of Object.entries(expectStep.want)) {
        // a sum may round once less on a compiler that fuses a multiply and an add (arm64): one off at .5
        assert.ok(Math.abs(got[k] - w) <= 1, `batch ${e.batch}: ${k}=${got[k]}, not ${w}`);
        assert.ok(got[k] >= Math.max(1, Math.floor(base[k] / 4)) && got[k] <= 4 * base[k]);
      }
      steps++, last = got, expectStep = false;
      continue;
    }
    if (expectStep && (e.type === 'enter' || e.type === 'values')) assert.fail(`no step after batch ${expectStep.batch}`);
  }
  assert.ok(!expectStep, `no step after batch ${expectStep.batch}`);
  return { steps, last };
}

test('--changes-learn: the weights follow the successes of each kind over the window, every few batches, from the weights of --changes; the same on any thread count and after a resume', { skip }, () => {
  const B = 16, args = [...without(TINY, '--batch', '--stage'), '--batch', '48', '--stage', '10', '--changes-learn', '--learn-every', '3', '--learn-window', '6'];
  const dir = join(tmp, 'learn1');
  run(dir, [...args, '--threads', '1', '--batches', String(B)]);
  const evs = events(dir);
  const { steps, last } = checkLearn(evs, { every: 3, window: 6 });
  assert.ok(steps >= 4, `${steps} steps`);
  // the batches after a step draw by its weights: the weights of the state are those of the last step
  const state = readFileSync(join(dir, 'state.txt'), 'utf8');
  assert.deepEqual(mixOf(/^changes (.*)$/m.exec(state)[1]), last);
  assert.deepEqual(mixOf(/^changes-base (.*)$/m.exec(state)[1]), Object.fromEntries(Object.entries(evs[0].changes).filter(([, w]) => w > 0)));
  assert.equal(state.split('\n').filter((l) => l.startsWith('learn ')).length, 6);
  assert.equal(stateParam(state, 'changesLearn'), '1');
  assert.ok(Object.entries(last).some(([k, w]) => w !== evs[0].changes[k]), 'no weight moved');
  assert.equal(checkValues(evs), B);
  // between two steps, the window and the base from the state
  const resumed = join(tmp, 'learn-resumed');
  run(resumed, [...args, '--threads', '2', '--batches', '7']);
  run(resumed, ['--threads', '4', '--batches', String(B - 7)]);
  assert.deepEqual(stable(events(resumed)), stable(evs));
});

test('--changes-learn with islands: each island learns its own weights, and a run that continues with --changes learns from those', { skip }, () => {
  const args = [...without(TINY, '--batch'), '--batch', '24', '--islands', '2', '--migrate', '2', '--changes-learn', '--learn-every', '2', '--learn-window', '4'];
  const dir = join(tmp, 'learn-islands');
  run(dir, [...args, '--threads', '4', '--batches', '8']);
  const a = events(join(dir, 'island-01')), b = events(join(dir, 'island-02'));
  const ra = checkLearn(a, { every: 2, window: 4 }), rb = checkLearn(b, { every: 2, window: 4 });
  assert.ok(ra.steps >= 2 && rb.steps >= 2);
  assert.notDeepEqual(ra.last, rb.last);
  // a single run that continues with --changes: the new weights are the base from then on
  const one = join(tmp, 'learn-continued');
  const single = [...without(TINY, '--batch'), '--batch', '32', '--changes-learn', '--learn-every', '2', '--learn-window', '4'];
  run(one, [...single, '--threads', '4', '--batches', '4']);
  run(one, ['--changes', 'opcode=10,insert=10,delete=10,a-operand=10', '--threads', '4', '--batches', '4']);
  const evs = events(one), at = evs.findIndex((e) => e.type === 'changes' && !e.learned);
  assert.ok(at > 0, 'no event of the new --changes');
  for (const e of evs.slice(at + 1).filter((x) => x.type === 'changes')) {
    assert.deepEqual(Object.keys(mixOf(e.changes)).sort(), ['a-operand', 'delete', 'insert', 'opcode']);
    for (const w of Object.values(mixOf(e.changes))) assert.ok(w >= 2 && w <= 40, e.changes);
  }
  assert.match(readFileSync(join(one, 'state.txt'), 'utf8'), /^changes-base opcode=10,a-operand=10,insert=10,delete=10$/m);
});

test('--changes-learn: what it refuses', { skip }, () => {
  for (const [extra, message] of [
    [['--learn-every', '5'], /--learn-every and --learn-window with --changes-learn/],
    [['--changes-learn', '--learn-every', '0'], /--learn-every 1 or more, --learn-window 1 to 1000/],
    [['--changes-learn', '--learn-window', '1001'], /--learn-every 1 or more, --learn-window 1 to 1000/],
  ]) {
    const d = join(tmp, `learn-no-${extra.join('')}`);
    const r = spawnSync(evolve, [d, ...TINY, ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, `${extra.join(' ')}: ${r.stderr}`);
    assert.match(r.stderr, message);
    assert.ok(!existsSync(join(d, 'state.txt')));
  }
});
