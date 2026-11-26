// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --survivors-by pushoff, the survivors of the screen by their estimated
// place in the pareto push-off instead of their screen score. What the
// evolver's test files share is in test/evolver-common.js; built with cc, or
// prebuilt in M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setup, cleanup, root, tmp, skip, TINY, run, events, without, stable, base, checkValues, evolve } from './evolver-common.js';

before(setup);
after(cleanup);

// Replays the pick of every batch from the events: the members' objectives
// when the batch started (the average against the panel and against the
// other members from the logged matches, the SD-score to the nearest from
// the values event before), their fronts from their values (10 (fronts -
// front) + crowding), and of each newcomer the front after the worst front
// of the members that dominate its logged objectives. Comparisons closer
// than rounding are not checked. Returns { checked, ambiguous, reordered }:
// reordered, the batches whose survivors did not enter in the order of their
// screen scores; lower, the newcomers whose SD-score is below the plain one;
// mattered, those whose front the SD-score changed.
function checkPicks(evs) {
  const start = evs[0], tie = start.params.tiePoints, three = start.params.pushoff === 'pareto-sd';
  const pts = new Map(), panel = new Set(start.panel.map((w) => w.id));
  const put = (a, b, w, l, t) => {
    pts.set(`${a},${b}`, ((3 * w + tie * t) * 100) / (w + l + t));
    pts.set(`${b},${a}`, ((3 * l + tie * t) * 100) / (w + l + t));
  };
  const members = new Set();
  let values = new Map(), snap = null, checked = 0, ambiguous = 0, reordered = 0, prev = null, lower = 0, mattered = 0;
  const near = (x, y) => Math.abs(x - y) <= 1e-5 * Math.max(1, Math.abs(y));
  for (const e of evs) {
    if (e.type === 'panel') for (const [a, b, w, l, t] of e.scores) put(a, b, w, l, t);
    if (e.type === 'values') values = new Map(e.values.map((v) => [v[0], v]));
    if (e.type === 'enter') {
      if (!snap || snap.batch !== e.batch) {
        if (prev && prev.length > 1 && prev.some((x, i) => i && x.screen > prev[i - 1].screen)) reordered++;
        prev = [];
        const ms = [...members].map((id) => {
          const v = values.get(id), others = [...members].filter((q) => q !== id);
          const o = [v[5], others.length ? others.reduce((s, q) => s + pts.get(`${id},${q}`), 0) / others.length : 0, v[2]];
          return { id, o: three ? o : o.slice(0, 2), level: Math.floor(v[4] / 10) };
        });
        snap = { batch: e.batch, ms, top: Math.max(0, ...ms.map((m) => m.level)) };
      }
      if (e.ops !== 'start' && e.ops !== 'migrant') {
        assert.equal(e.pick.length, 4, `pick of ${e.id}`);
        const [front, p, m, d] = e.pick;
        const P = e.screenPoints.length;
        assert.ok(near(p, e.screenPoints.reduce((s, x) => s + x, 0) / P), `${e.id}: the average against the panel`);
        // the screen is over the panel and the members of the screen: its mean of both parts
        const q = Math.min(start.params.screenMembers, snap.ms.length); // all members while there are fewer
        assert.ok(near(e.screen, (p * P + m * q) / (P + q)), `${e.id}: the average against the members of the screen`);
        // the SD-score with each difference less one standard error: at most the plain one of the estimate
        const plain = e.screen > 0 ? e.estimate / e.screen : Infinity; // the estimate is the screen score times it
        assert.ok(d >= 0 && d <= plain + 1e-9, `${e.id}: SD-score ${d}, the plain one ${plain}`);
        if (d < plain - 1e-6) lower++;
        const o = three ? [p, m, d] : [p, m];
        let level = snap.top, level2 = snap.top, unsure = false;
        for (const x of snap.ms) {
          if (x.o.some((v, k) => v !== o[k] && near(v, o[k]))) unsure = true;
          if (x.o.every((v, k) => v >= o[k]) && x.o.some((v, k) => v > o[k])) level = Math.min(level, x.level - 1);
          if (x.o[0] >= o[0] && x.o[1] >= o[1] && (x.o[0] > o[0] || x.o[1] > o[1])) level2 = Math.min(level2, x.level - 1);
        }
        if (three && level !== level2) mattered++;
        if (unsure) ambiguous++;
        else assert.equal(front, snap.top - level, `batch ${e.batch}: ${e.id} on front ${front}, the replay says ${snap.top - level}`), checked++;
        // they enter by key: the earlier front first, on a front the farther one
        const key = -front * 1e6 + d, last = prev.at(-1);
        if (last) assert.ok(key <= last.key + 1e-9, `batch ${e.batch}: ${e.id} entered after one with a lower key`);
        prev.push({ key, screen: e.screen });
      }
      members.add(e.id);
      for (const [o, w, l, t] of e.scores) put(e.id, o, w, l, t);
    }
    if (e.type === 'complete') for (const [o, w, l, t] of e.scores) put(e.id, o, w, l, t);
    if (e.type === 'leave') members.delete(e.id);
  }
  return { checked, ambiguous, reordered, lower, mattered };
}

test('--survivors-by pushoff: the survivors of the screen by their estimated place in the push-off; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.survivorsBy, 'strength');
  assert.ok(base.every((e) => e.pick === undefined));
  const B = 12;
  const args = [...without(TINY, '--pushoff', '--screen-members', '--diversity'), '--pushoff', 'pareto-sd', '--screen-members', '5', '--diversity', 'panel', '--survivors-by', 'pushoff'];
  run(join(tmp, 'pick1'), [...args, '--threads', '1', '--batches', String(B)]);
  const one = events(join(tmp, 'pick1'));
  assert.equal(one[0].params.survivorsBy, 'pushoff');
  assert.match(readFileSync(join(tmp, 'pick1', 'state.txt'), 'latin1'), /^params .* 0 0 1 0$/m); // --parsimony, --no-spl, this, then --replace-parent
  assert.equal(checkValues(one), B);
  const c = checkPicks(one);
  assert.ok(c.checked >= 2 * B, `${c.checked} fronts replayed, ${c.ambiguous} too close to call`);
  assert.ok(c.lower > c.checked / 2, `${c.lower} of ${c.checked} SD-scores less the standard errors`);
  assert.ok(c.reordered >= 2, `${c.reordered} batches not in the order of the screen`);
  assert.ok(one.some((e) => e.type === 'enter' && e.pick?.[0] > 0), 'a newcomer estimated behind the first front');
  run(join(tmp, 'pick-resumed'), [...args, '--threads', '2', '--batches', String(B >> 1)]);
  run(join(tmp, 'pick-resumed'), ['--threads', '3', '--batches', String(B - (B >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'pick-resumed'))), stable(one));
  // the strength picks others
  run(join(tmp, 'pick-strength'), [...without(args, '--survivors-by'), '--threads', '2', '--batches', String(B)]);
  const enters = (evs) => evs.filter((e) => e.type === 'enter').map((e) => e.code);
  assert.notDeepEqual(enters(events(join(tmp, 'pick-strength'))), enters(one));
  // --screen-stop has no cut by the screen scores of the others then: the same survivors as a whole screen. From 8
  // tiny hill warriors with a list of 8 the weakest member sets a threshold that stops children (from random
  // warriors this pick lets in the weak ones that play unlike the others, and the threshold stays near 0)
  const dir = join(tmp, 'pick-start');
  mkdirSync(dir);
  const hill = join(root, 'warriors/koenigstuhl/tiny');
  readdirSync(hill).filter((f) => f.endsWith('.red')).sort().slice(0, 40).filter((_, i) => i % 5 === 4).forEach((f) => copyFileSync(join(hill, f), join(dir, f)));
  const started = [...without(args, '--screen-stop', '--list', '--batch', '--seed'), '--seed', '3', '--list', '8', '--batch', '48', '--start', dir, '--threads', '2', '--batches', '8'];
  run(join(tmp, 'pick-whole'), [...started, '--screen-stop', '0']);
  run(join(tmp, 'pick-stop'), [...started, '--screen-stop', '3']);
  const stop = events(join(tmp, 'pick-stop'));
  assert.ok(stop.filter((e) => e.type === 'screen').reduce((s, e) => s + e.stopped, 0) >= 5, 'children stopped in the screen');
  assert.deepEqual(enters(stop), enters(events(join(tmp, 'pick-whole'))));
  // from strong members the SD-score puts children on an earlier front than strength alone would
  const cs = checkPicks(stop);
  assert.ok(cs.checked >= 20 && cs.mattered >= 5, `${cs.mattered} of ${cs.checked} fronts changed by the SD-score`);
  // with pareto (no SD-score) the fronts are on two objectives
  run(join(tmp, 'pick-pareto'), [...without(args, '--pushoff'), '--pushoff', 'pareto', '--threads', '2', '--batches', '4']);
  assert.ok(checkPicks(events(join(tmp, 'pick-pareto'))).checked > 0);
  // only with a pareto push-off, and only these words
  for (const [extra, why] of [[['--pushoff', 'value'], /--survivors-by pushoff with --pushoff pareto or pareto-sd only/], [['--survivors-by', 'value'], /usage/]]) {
    const r = spawnSync(evolve, [join(tmp, 'pick-refused'), ...without(args, extra[0]), ...extra, '--batches', '1'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, extra.join(' '));
    assert.match(r.stderr, why);
  }
});
