// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The differential tests against pMARS compare scores, instruction counts and
// the core, not the visualizer bookkeeping. These fingerprints pin down all
// observable state of the simulator (core, owner, execBy, origin, timestamps,
// trace buffer, execHeat, territory, queues, events, scores) after every
// run() of random battles. They were recorded with the engine before the
// speed work, so that optimizing the hot loop cannot change any of it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mars } from '../src/engine/mars.js';

// BEGIN fingerprints
function fingerprints(MarsClass, options = {}) {
  let seed = 7;
  const rand = (k) => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    return seed % k;
  };
  const fnv = (h, v) => Math.imul(h ^ (v & 0xffff) ^ ((v >>> 16) * 31), 16777619) >>> 0;
  const hashArray = (h, a) => { for (let i = 0; i < a.length; i++) h = fnv(h, a[i]); return h; };
  const rules = [
    { coreSize: 80, maxCycles: 800, maxProcesses: 8, maxLength: 10, minDistance: 10 },
    { coreSize: 800, maxCycles: 3000, maxProcesses: 800, maxLength: 30, minDistance: 30 },
  ];
  const out = [];
  for (let battle = 0; battle < 60; battle++) {
    const o = rules[battle % 2];
    const warriors = 2 + (battle % 3);
    const codes = Array.from({ length: warriors }, (_, i) => {
      const length = battle % 5 === 4 && i === 1 ? 0 : 1 + rand(o.maxLength);
      const pick = () => (rand(3) ? rand(9) + o.coreSize - 4 : rand(o.coreSize)) % o.coreSize;
      return {
        ok: true, name: `w${i}`, author: '', pin: rand(4) ? null : 1, start: length ? rand(length) : 0,
        instructions: Array.from({ length }, () => {
          const op = rand(4) === 0 ? [11, 0, 8, 13][rand(4)] : rand(19);
          return { op, mod: rand(7), aMode: rand(8), aVal: pick(), bMode: rand(8), bVal: pick() };
        }),
      };
    });
    const m = new MarsClass({ ...o, ...options });
    m.load(codes, { seed: 1 + battle });
    for (let round = 0; round < 2; round++) {
      m.startRound();
      while (!m.roundOver) {
        m.run([1, 3, 50, 300, 2000][rand(5)]);
        let h = 2166136261;
        for (const a of [m.op, m.am, m.bm, m.av, m.bv, m.owner, m.execBy, m.origin, m.tWrite, m.tRead, m.tExec,
          m.tracePc, m.traceA, m.traceB, m.traceMeta]) h = hashArray(h, a);
        for (const w of m.warriors) {
          h = hashArray(h, w.queue);
          h = hashArray(h, w.execHeat.map((x) => x * 64));
          h = hashArray(h, [w.head, w.tail, w.tasks, w.territory, w.alive ? 1 : 0, w.diedAt ?? -1, w.lastResult, ...w.score]);
        }
        for (const e of m.events) h = hashArray(h, [e.type === 'kill' ? 1 : 2, e.addr, e.warrior, e.time]);
        m.events = [];
        h = hashArray(h, [m.time, m.cyclesLeft, m.warriorsLeft, m.current]);
        out.push(h);
      }
    }
  }
  return out;
}
// END fingerprints

const GOLDEN = [
  '2736272238 2484365140 3124394441 1071324777 2595235366 2384888089 2266018838 1370390389 1945516560',
  '276148155 3635744752 3595407873 774626344 1144408131 2380886049 3148607406 3738747123 79187478',
  '427310682 623301960 2385807755 2294394245 4101450745 2988183049 597595873 876941940 3898523875',
  '2118316486 568017624 232866752 1471498620 1503092779 2966034665 3461748151 588774397 390801793',
  '4038991563 967906534 2359114464 1246890086 3775728632 3608918134 1078213391 1809506482 2658434647',
  '3788086833 3195977095 224132632 847534856 1912859988 4055231493 1085613133 3361867613 2423697567',
  '260308847 2764101696 1280321399 3781923232 3731569183 2036384641 1938225237 1689176808 3220318926',
  '1941708796 3820688037 2777654369 110278018 3290965993 1261384416 2079394330 1658725180 3302089686',
  '2463429109 1081160353 4187149868 569329899 763129383 3092354028 3887300798 3038459169 295953393',
  '1069340571 157774593 984207575 1869263779 3436842706 853888016 3201176703 723456189 1517626593',
  '1359877886 48488286 3881099908 2091053725 2403537074 1389016955 1351496105 832321788 1990107191',
  '2832404653 855050188 3340420419 917350210 166102643 4083753638 1444611272 1435452492 4031539364',
  '3751701166 4123401193 554378703 998214435 1373452811 4020407345 2762493893 2401281001 1150370017',
  '3069050372 796254208 2581878810 3468519208 2230435362 37193884 4197471725 1713593774 4003616459',
  '3610166370 223034444 3672069666 559488289 726782430 2515541982 2345399301 4044034207 706862131',
  '1640833835 751508902 348912950 2191589743 162958846 2468161063 966573152 757306636 2519574345',
  '388021482 838923674 1202851240 60505878 4141468349 1521492490 2792000668 2932785089 601138347',
  '683695418 572448292 31110311 4059049760 855996528 3840838465 3938767036 2465321224 3664850693',
  '3211985508 492471602 2400987347 2934065456 2336033187 3883871297 2934879146 2156957664 2022311147',
  '3211084719 2364371025 2245511159 575209840 4054885947 3877469087 555779857 1262626585 751120736',
  '2969377000 1274095596 1229299856 1426798435 138829488 2277506626',
].join(' ');

test('bookkeeping fingerprints match the reference engine', () => {
  const got = fingerprints(Mars);
  const want = GOLDEN.split(' ').map(Number);
  assert.equal(got.length, want.length);
  const first = got.findIndex((h, i) => h !== want[i]);
  assert.equal(first, -1, `first difference after run() number ${first}`);
});

test('headless mode gives the same battle without the bookkeeping', () => {
  const visual = new Mars();
  const headless = new Mars({ headless: true });
  // An imp, a dwarf and a paper-like replicator, each with a pre-decrement.
  const codes = [
    [[0, 6, 1, 0, 1, 1]], // mov.i $0, $1
    [[1, 2, 0, 4, 1, 7999], [0, 6, 1, 7999, 3, 7998], [13, 1, 1, 7998, 1, 0]], // add.ab #4, $-1 / mov.i $-1, <-2 / jmp $-2
    [[11, 1, 1, 2, 3, 7990], [13, 1, 1, 7999, 1, 0], [0, 6, 1, 7998, 3, 50]], // spl $2, <-10 / jmp $-1 / mov.i $-2, <50
  ].map((ins, i) => ({
    ok: true, name: `w${i}`, author: '', pin: null, start: 0,
    instructions: ins.map(([op, mod, aMode, aVal, bMode, bVal]) => ({ op, mod, aMode, aVal, bMode, bVal })),
  }));
  for (const m of [visual, headless]) {
    m.load(codes, { seed: 99 });
    m.startRound();
  }
  const untouched = ['execBy', 'tWrite', 'tRead', 'tExec', 'tracePc', 'traceMeta'].map((k) => headless[k].slice());
  for (let i = 0; i < 40 && !visual.roundOver; i++) {
    const n = [1, 7, 1000, 9000][i % 4];
    assert.equal(headless.run(n), visual.run(n));
    for (const k of ['op', 'am', 'bm', 'av', 'bv']) assert.deepEqual(headless[k], visual[k], k);
    for (const k of ['time', 'cyclesLeft', 'warriorsLeft', 'current', 'roundOver']) assert.equal(headless[k], visual[k], k);
    assert.deepEqual(headless.events, visual.events);
    visual.warriors.forEach((w, j) => {
      const h = headless.warriors[j];
      for (const k of ['head', 'tail', 'tasks', 'alive', 'diedAt', 'score']) assert.deepEqual(h[k], w[k], k);
      assert.deepEqual(h.queue, w.queue);
    });
  }
  assert.ok(visual.time > 10000, 'the battle ran');
  ['execBy', 'tWrite', 'tRead', 'tExec', 'tracePc', 'traceMeta'].forEach((k, i) => assert.deepEqual(headless[k], untouched[i], k));
  assert.ok(headless.warriors.every((w) => w.execHeat.every((x) => x === 0)));
});
