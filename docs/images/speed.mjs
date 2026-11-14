// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Writes the README's speed charts from the numbers below, each for a light
// and a dark page: speed-*.svg (native code, '94 warriors), speed-88-*.svg
// (native code, '88-style warriors) and speed-wasm-*.svg (WebAssembly).
// Usage: node docs/images/speed.mjs
//
// Measured on 14th November 2026: AMD Ryzen 9 7950X, Fedora, idle machine,
// every process pinned to one core with a fixed frequency, Node 22.22, GCC
// 16.2, clang 22.1. One thread. Wall time of the whole processes (start,
// assembly, Node and module compile included), 7 alternating runs, median.
//
// Two workloads, both from pmars -F 1334 (seed 1234):
// - '94: 20 pairs of warriors/koenigstuhl/94nop, 600 rounds each,
//   940,856,125 instructions. The pairs are every 27th file of the folder
//   sorted by code unit, two by two: 236 acidrain2, archerII basicmulberry,
//   blur2 candy, cloudburst dac2, destructionhive1 discorddecoy, electra
//   executor, flameon g2, halcyon hinttest2, impdwarf94 ironicimps, kf94
//   littleflea, mauvestone modron, myblur2 new-pap, omms papyrus13, pijl
//   puddleglum, quincy repliscan, rudewind sdclear, silklandersfaith
//   smartclear, splosh stylizede, testopponent tinyscan, twinstorms vanilla.
//   fmars is not in it: it is generated for the instruction words of one
//   hill (109 here) and these warriors execute 655.
// - '88: the 3 bench pairs of bench/bench.mjs (agony/bubbles, bomber/chalk,
//   army/bananasplit), 4,000 rounds each, 445,920,804 instructions.
// All engines gave the same wins, losses and ties in every pair; '88:
// 1570/1939/491, 2015/1985/0, 1945/1462/593.
//   42mars C       build/42mars -b -r <rounds> -F 1334 a b (make, -O3, no -march)
//   42mars wasm    runMatch() of wasm/42mars.js in Node (early ties on; off, '88: 1.195 s)
//   fmars 0.0.207  xfmars -b -r 4000 -F 1334 (GCC -O3 -march=native, on pmars -A output)
//   rmars 215fadc  rmars --batch --threads 1 -r <rounds> -F 1334 (cargo --release)
//   exMARS 0.01    exmars -b -r <rounds> -F 1334 (its Makefile: gcc -O3 -fomit-frame-pointer, unpatched)
//   exMARS, pMARS  corewar.dev's WebAssembly builds, driven from Node
//   pMARS 0.9.5    pmars -b -r <rounds> -F 1334 (-O2, SERVER build)
import { W, PAD, bar, esc, frame, notes, write } from './chart.mjs';

const WORKLOADS = {
  94: { instructions: 940_856_125, rounds: '12,000', foot: `20 pairs of the Koenigstuhl '94 hill × 600 rounds, 941M instructions.` },
  88: { instructions: 445_920_804, rounds: '12,000', foot: `3 pairs of '88-style hill warriors × 4,000 rounds, 446M instructions.` },
};
const METHOD = 'Whole process wall time, median of 7, one thread.';
const MACHINE = 'Ryzen 9 7950X, GCC 16.2, Node 22.22, 14th November 2026. Commands: docs/images/speed.mjs.';
const charts = [
  {
    file: 'speed', workload: 94, title: `speed of Core War simulators, native code, '94 warriors`,
    note: 'pMARS -O2, exMARS -O3 -fomit-frame-pointer, rmars --release, 42mars -O3.',
    engines: [
      { name: '42mars', kind: 'C', seconds: 2.324, ours: true },
      { name: 'exMARS 0.01', kind: 'C', seconds: 3.875 },
      { name: 'rmars', kind: 'Rust', seconds: 5.276 },
      { name: 'pMARS 0.9.5', kind: 'C', seconds: 9.195, base: true },
    ],
  },
  {
    file: 'speed-88', workload: 88, title: `speed of Core War simulators, native code, '88-style warriors`,
    note: 'pMARS -O2, exMARS -O3 -fomit-frame-pointer, fmars -O3 -march=native, rmars --release, 42mars -O3.',
    engines: [
      { name: '42mars', kind: 'C', seconds: 0.846, ours: true },
      { name: 'fmars', kind: 'C', seconds: 1.119 },
      { name: 'exMARS 0.01', kind: 'C', seconds: 1.606 },
      { name: 'rmars', kind: 'Rust', seconds: 2.310 },
      { name: 'pMARS 0.9.5', kind: 'C', seconds: 4.231, base: true },
    ],
  },
  {
    file: 'speed-wasm', workload: 88, title: `speed of Core War simulators in WebAssembly, '88-style warriors`,
    note: 'exMARS and pMARS are the builds of corewar.dev. Times include Node start and module compile.',
    engines: [
      { name: '42mars', kind: 'WebAssembly', seconds: 1.175, ours: true },
      { name: 'exMARS', kind: 'WebAssembly', seconds: 2.979 },
      { name: 'pMARS', kind: 'WebAssembly', seconds: 6.998, base: true },
    ],
  },
];

const LABEL = 210, ROW = 40, BAR = 22, TOP = 118, TICK = 100e6;
const plot = W - 2 * PAD - LABEL - 120; // room right of the longest bar for its value
const rate = (c, e) => WORKLOADS[c.workload].instructions / e.seconds;
// One axis for all charts, so that their bars compare; it ends on a tick.
const max = Math.ceil(Math.max(...charts.flatMap((c) => c.engines.map((e) => rate(c, e)))) / TICK) * TICK;

function svg(t, c) {
  const { engines } = c, work = WORKLOADS[c.workload];
  const H = TOP + engines.length * ROW + 130;
  const base = engines.find((e) => e.base).seconds;
  const out = [];
  const x0 = PAD + LABEL, yEnd = TOP + engines.length * ROW - ROW + BAR + 8;
  for (let v = 0; v <= max; v += TICK) {
    const x = x0 + (v / max) * plot;
    out.push(`<line x1="${x}" y1="${TOP - 8}" x2="${x}" y2="${yEnd}" stroke="${t.grid}" stroke-dasharray="${v ? '2 3' : ''}"/>`);
    out.push(`<text x="${x}" y="${yEnd + 18}" text-anchor="middle" font-size="12" fill="${t.ink3}">${v / 1e6}</text>`);
  }
  out.push(`<text x="${x0 + plot / 2}" y="${yEnd + 38}" text-anchor="middle" font-size="13" fill="${t.ink2}">million simulated instructions per second</text>`);
  engines.forEach((e, i) => {
    const y = TOP + i * ROW;
    const w = Math.max(6, (rate(c, e) / max) * plot);
    const weight = e.ours ? 700 : 500;
    out.push(`<text x="${x0 - 14}" y="${y + BAR / 2 + 5}" text-anchor="end" font-size="15" fill="${t.ink}" font-weight="${weight}">${esc(e.name)}<tspan font-weight="400" fill="${t.ink3}" font-size="13" dx="7">${esc(e.kind)}</tspan></text>`);
    out.push(`<path d="${bar(x0, y, w, BAR)}" fill="${e.ours ? t.ours : t.other}"/>`);
    const rel = e.base ? 'reference' : `${(base / e.seconds).toFixed(1)}× pMARS`;
    out.push(`<text x="${x0 + w + 10}" y="${y + BAR / 2 + 5}" font-size="15" fill="${t.ink}" font-weight="${weight}">${(rate(c, e) / 1e6).toFixed(0)}<tspan font-weight="400" fill="${t.ink3}" font-size="13" dx="8">${rel}</tspan></text>`);
  });
  out.push(...notes(t, yEnd + 70, [`${work.foot} ${METHOD}`, c.note, MACHINE]));
  return frame(t, H, {
    head: '42mars', title: c.title,
    sub: `Every engine plays the same ${work.rounds} rounds and gets the same wins, losses and ties.`,
    desc: `Million simulated instructions per second, one thread, the same ${work.rounds} rounds for every engine: ${engines.map((e) => `${e.name} ${e.kind} ${(rate(c, e) / 1e6).toFixed(0)}`).join(', ')}.`,
  }, out);
}

for (const c of charts) write(c.file, (t) => svg(t, c));
// The numbers of the README's table and alt texts: node docs/images/speed.mjs --print
if (process.argv.includes('--print')) {
  for (const c of charts) console.log(c.file, c.engines.map((e) => `${e.name} ${e.seconds.toFixed(3)} s ${(rate(c, e) / 1e6).toFixed(0)}M ${(c.engines.find((x) => x.base).seconds / e.seconds).toFixed(1)}x`).join(' | '));
}
