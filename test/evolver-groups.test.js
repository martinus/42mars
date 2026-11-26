// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --groups (#183), islands in groups that evolve against each other: the
// last panel slots of every island hold foes, the best members of the other
// groups and warriors of its hall of fame, and migrants stay in their group.
// What the evolver's test files share is in test/evolver-common.js; built
// with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { setup, cleanup, tmp, evolve, skip, RULES, TINY, run, events, without, stable, checkValues } from './evolver-common.js';

before(() => setup({ base: false })); // no test here reads the base run
after(cleanup);

// 6 islands in 3 groups (islands 1-2, 3-4, 5-6), every 2 batches 3 foe slots of the panel of 10, one of them from the hall
const N = 6, K = 3, S = 3, B = 7; // foes at batches 2, 4, 6: the hall has foes that left only at 6
const ARGS = [...without(TINY, '--batch'), '--batch', '16', '--islands', String(N), '--groups', String(K), '--group-every', '2',
  '--group-slots', String(S), '--group-hall', '1', '--migrate', '2', '--migrate-to', 'all'];
const groupOf = (island) => Math.floor(((island - 1) * K) / N); // island from 1
const island = (dir, i) => events(join(dir, `island-0${i}`));

test('--groups: foe slots hold the best members of the other groups and the hall of fame, replayed by everyone; migrants stay in their group; the same on any thread count and after a resume', { skip }, () => {
  const dir = join(tmp, 'groups1');
  run(dir, [...ARGS, '--threads', '1', '--batches', String(B)]);
  const head = events(dir, 'islands.jsonl')[0];
  assert.deepEqual([head.groups, head.groupEvery, head.groupSlots, head.groupHall], [K, 2, S, 1]);
  const all = Array.from({ length: N }, (_, i) => island(dir, i + 1));
  const m = createMarsSync(RULES);
  let rotates = 0, fromHall = 0, replayed = 0, seedChecks = 0;
  for (let k = 1; k <= N; k++) {
    const evs = all[k - 1];
    // one values event per batch and one after the foes of batches 2, 4, 6: they follow the foes' results
    assert.equal(checkValues(evs), B + 3, `island ${k}`);
    const start = evs[0];
    const ids = start.panel.map((p) => p.id); // the panel now
    const firstFoe = ids.length - S;
    const left = new Set(); // [island, id] of the foes that left the slots
    const byBatch = new Map();
    for (const e of evs) {
      if (e.type === 'migrate') for (const [from] of e.from) assert.equal(groupOf(from), groupOf(k), `island ${k} took a migrant from island ${from}`);
      if (e.type !== 'rotate') continue;
      rotates++;
      assert.equal(e.batch % 2, 0);
      const at = ids.indexOf(e.out);
      assert.ok(at >= firstFoe, `island ${k}: a rotate out of slot ${at}, not a foe slot`);
      const old = e.out >= start.panel.length + start.holdout.length ? evs.find((x) => x.type === 'rotate' && x.panel.id === e.out) : null;
      if (old) left.add(old.from.join(','));
      ids[at] = e.panel.id;
      // a foe of another group: the code and the name of the member it was there
      const [fi, fid] = e.from;
      assert.notEqual(groupOf(fi), groupOf(k), `island ${k} has a foe of its own group, island ${fi}`);
      const member = all[fi - 1].find((x) => x.type === 'enter' && x.id === fid);
      assert.ok(member, `no member ${fid} on island ${fi}`);
      assert.equal(e.panel.name, member.name);
      assert.ok(e.panel.source.endsWith(member.code), `island ${k}: the foe's code is not that of ${member.name}`);
      assert.equal(e.panel.file, `island-0${fi} #${fid}`);
      // it played everyone in: the panel and the members, each as often as against the rest of the panel (no --stage here)
      assert.ok(e.scores.length >= start.panel.length - 1 + 1, `island ${k}: the foe played ${e.scores.length}`);
      if (left.has(e.from.join(','))) fromHall++;
      // every match against the foe has its seed: the members' here, and the newcomers' after it
      const lower = (o) => (start.panel.some((x) => x.id === o) || evs.some((x) => x.type === 'rotate' && x.panel.id === o)) && ids.indexOf(o) < at;
      const seeds = new Set(e.scores.filter(([o]) => !lower(o)).map((x) => x[4]));
      assert.equal(seeds.size, 1, `island ${k} batch ${e.batch}: the matches against the foe ${e.panel.id} have ${seeds.size} seeds`);
      const later = evs.find((x) => x.type === 'enter' && x.batch >= e.batch && x.scores.some((y) => y[0] === e.panel.id));
      if (later) assert.equal(later.scores.find((y) => y[0] === e.panel.id)[4], [...seeds][0]), seedChecks++;
      (byBatch.get(e.batch) ?? byBatch.set(e.batch, []).get(e.batch)).push(e);
      // the matches as the WebAssembly engine plays them: the foe against a panel warrior with that one's seed when it is
      // in a lower slot, a member against the foe with the foe's seed
      for (const [o, w, l, t, seed] of e.scores.slice(0, 2).concat(e.scores.slice(-1))) {
        const code = (id) => {
          const p = start.panel.find((x) => x.id === id);
          if (p) return p.source;
          const r = evs.find((x) => x.type === 'rotate' && x.panel.id === id);
          if (r) return r.panel.source;
          return `;name x\n${evs.find((x) => x.type === 'enter' && x.id === id).code}`;
        };
        const oPanel = start.panel.some((x) => x.id === o) || evs.some((x) => x.type === 'rotate' && x.panel.id === o);
        const foeFirst = oPanel && ids.indexOf(o) < at;
        const pair = foeFirst ? [e.panel.source, code(o)] : [code(o), e.panel.source];
        const r = m.runMatch(pair.map((x) => assemble(x, RULES)), { seed, rounds: 40 });
        const me = foeFirst ? r.warriors[0] : r.warriors[1];
        assert.deepEqual([me.wins, me.losses, me.ties], [w, l, t], `island ${k} batch ${e.batch}: the foe ${e.panel.id} against ${o}`);
        replayed++;
      }
    }
    // a foe chosen again keeps its slot: no batch brings in a foe that is in a slot already
    const inSlot = new Map(); // panel id -> where its foe came from
    for (const [b, list] of [...byBatch.entries()].sort((x, y) => x[0] - y[0])) {
      const before = new Set(inSlot.values());
      for (const e of list) {
        assert.ok(!before.has(e.from.join(',')), `island ${k} batch ${b}: ${e.from} was in a slot and came in again`);
        inSlot.delete(e.out);
        inSlot.set(e.panel.id, e.from.join(','));
      }
    }
  }
  assert.ok(rotates >= N * S, `${rotates} foes`);
  assert.ok(fromHall > 0, 'no foe came back from the hall of fame');
  assert.ok(replayed >= 3 * N * S);
  assert.ok(seedChecks > 0);
  // the same on other thread counts and after a resume (between foes, so that the hall and the foes come from the states)
  const resumed = join(tmp, 'groups-resumed');
  run(resumed, [...ARGS, '--threads', '2', '--batches', '5']);
  run(resumed, ['--threads', '4', '--batches', String(B - 5)]);
  for (let k = 1; k <= N; k++) assert.deepEqual(stable(island(resumed, k)), stable(all[k - 1]), `island ${k}, resumed on other threads`);
  assert.deepEqual(stable(events(resumed, 'islands.jsonl')).slice(1).filter((e) => e.type !== 'resume'), stable(events(dir, 'islands.jsonl')).slice(1));
});

test('--groups with --stage: everybody plays a foe the whole match, and the first stage of it is logged apart', { skip }, () => {
  const dir = join(tmp, 'groups-stage');
  const args = [...without(ARGS, '--islands', '--groups', '--stage'), '--islands', '4', '--groups', '2', '--stage', '20'];
  run(dir, [...args, '--threads', '4', '--batches', '5']);
  const m = createMarsSync(RULES);
  let checked = 0;
  for (let k = 1; k <= 4; k++) {
    const evs = island(dir, k);
    assert.equal(checkValues(evs), 5 + 2, `island ${k}`);
    const start = evs[0];
    for (const e of evs.filter((x) => x.type === 'rotate')) {
      // between batches every member has completed: the whole match against the foe, and its first 20 rounds apart
      assert.equal(e.scores1.length, e.scores.length);
      for (const [o, w, l, t] of e.scores) assert.equal(w + l + t, 40, `island ${k}: ${o} played the foe ${w + l + t} rounds`);
      for (const [o, w, l, t] of e.scores1) assert.equal(w + l + t, 20, `island ${k}: ${o}, first stage`);
      const [o, w, l, t, seed] = e.scores.at(-1); // a member: it plays first, with the foe's seed
      const member = evs.find((x) => x.type === 'enter' && x.id === o);
      assert.ok(member && !start.panel.some((p) => p.id === o));
      const pair = [assemble(`;name x\n${member.code}`, RULES), assemble(e.panel.source, RULES)];
      const whole = m.runMatch(pair, { seed, rounds: 40 }).warriors[1], first = m.runMatch(pair, { seed, rounds: 20 }).warriors[1];
      assert.deepEqual([whole.wins, whole.losses, whole.ties], [w, l, t]);
      assert.deepEqual(e.scores1.at(-1), [o, first.wins, first.losses, first.ties]);
      checked++;
    }
  }
  assert.ok(checked >= 4);
});

test('--groups: what it refuses', { skip }, () => {
  const base = [...without(TINY, '--batch'), '--batch', '16', '--islands', '4', '--batches', '1'];
  const cases = [
    [['--groups', '3'], /--groups K: 2 or more that divide --islands/],
    [['--groups', '1'], /--groups K: 2 or more/],
    [['--groups', '2', '--explorers', '1'], /not with --keep or --explorers/],
    [['--groups', '2', '--keep', '2', '--select-after', '2'], /not with --keep or --explorers/],
    [['--groups', '2', '--group-slots', '9'], /--group-slots 1 to the panel less 2 \(8\)/],
    [['--groups', '2', '--group-slots', '2', '--group-hall', '3'], /--group-hall at most the slots/],
    [['--groups', '2', '--group-every', '0'], /--group-every 1 or more/],
    [['--group-every', '3'], /with --groups/],
  ];
  for (const [extra, message] of cases) {
    const d = join(tmp, `groups-no-${extra.join('')}`);
    const r = spawnSync(evolve, [d, ...base, ...extra], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, `${extra.join(' ')}: ${r.stderr}`);
    assert.match(r.stderr, message);
    assert.ok(!existsSync(join(d, 'islands.txt')), extra.join(' '));
  }
});
