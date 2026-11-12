// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Writes the README's speed charts from the numbers below, each for a light
// and a dark page: speed-{light,dark}.svg (native code) and
// speed-wasm-{light,dark}.svg (WebAssembly). Usage: node docs/images/speed.mjs
//
// Measured on 12th November 2026: AMD Ryzen 9 7950X, Fedora, idle machine,
// Node 22.22, GCC 16.2, clang 22.1. One thread. Each engine plays the 3 bench
// pairs of bench/bench.mjs (agony/bubbles, bomber/chalk, army/bananasplit),
// 4,000 rounds each from pmars -F 1334 (seed 1234), 445,920,804 instructions
// in all. Wall time of the whole processes (start, assembly, Node and module
// compile included), 7 alternating runs, median. All engines gave the same
// wins, losses and ties: 1570/1939/491, 2015/1985/0, 1945/1462/593.
//   42mars C       build/42mars -b -r 4000 -F 1334 a b (make, -O3, no -march)
//   42mars wasm    runMatch() of wasm/42mars.js in Node (early ties on; off: 1.153 s)
//   fmars 0.0.207  xfmars -b -r 4000 -F 1334 (GCC -O3 -march=native, on pmars -A output)
//   rmars 215fadc  rmars --batch --threads 1 -r 4000 -F 1334 (cargo --release)
//   exMARS 0.01    exmars -b -r 4000 -F 1334 (its Makefile: gcc -O3 -fomit-frame-pointer, unpatched)
//   exMARS, pMARS  corewar.dev's WebAssembly builds, driven from Node
//   pMARS 0.9.5    pmars -b -r 4000 -F 1334 (-O2, SERVER build)
import { writeFileSync } from 'node:fs';

const INSTRUCTIONS = 445_920_804;
const charts = [
  {
    file: 'speed', title: 'speed of Core War simulators, native code, one thread',
    note: 'pMARS -O2, exMARS -O3 -fomit-frame-pointer, fmars -O3 -march=native, rmars --release, 42mars -O3. Commands: docs/images/speed.mjs.',
    engines: [
      { name: '42mars', kind: 'C', seconds: 0.932, ours: true },
      { name: 'fmars', kind: 'C', seconds: 1.109 },
      { name: 'exMARS 0.01', kind: 'C', seconds: 1.600 },
      { name: 'rmars', kind: 'Rust', seconds: 2.321 },
      { name: 'pMARS 0.9.5', kind: 'C', seconds: 4.225, base: true },
    ],
  },
  {
    file: 'speed-wasm', title: 'speed of Core War simulators in WebAssembly, one thread',
    note: 'exMARS and pMARS are the builds of corewar.dev. Times include Node start and module compile. The method: docs/images/speed.mjs.',
    engines: [
      { name: '42mars', kind: 'WebAssembly', seconds: 1.144, ours: true },
      { name: 'exMARS', kind: 'WebAssembly', seconds: 2.957 },
      { name: 'pMARS', kind: 'WebAssembly', seconds: 6.917, base: true },
    ],
  },
];

const themes = {
  light: { surface: '#fcfcfb', border: '#e6e5e0', ink: '#0b0b0b', ink2: '#52514e', ink3: '#76756f', ours: '#f0652d', other: '#b5b4ae', grid: '#d6d5cf' },
  dark: { surface: '#1a1a19', border: '#2e2e2c', ink: '#f0efec', ink2: '#c3c2b7', ink3: '#97968e', ours: '#f0652d', other: '#5c5b57', grid: '#3a3a37' },
};

const W = 880, PAD = 32, LABEL = 210, ROW = 40, BAR = 22, TOP = 118, TICK = 100e6;
const plot = W - 2 * PAD - LABEL - 120; // room right of the longest bar for its value
// One axis for both charts, so that their bars compare; it ends on a tick.
const max = Math.ceil(Math.max(...charts.flatMap((c) => c.engines.map((e) => INSTRUCTIONS / e.seconds))) / TICK) * TICK;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;

// A bar with a 4px rounded data end and a square end at the baseline.
function bar(x, y, w, h, r) {
  return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`;
}

function svg(t, { title, note, engines }) {
  const H = TOP + engines.length * ROW + 112;
  const base = engines.find((e) => e.base).seconds;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" role="img" aria-labelledby="title desc">`);
  out.push(`<title id="title">42mars: ${esc(title)}</title>`);
  out.push(`<desc id="desc">Million simulated instructions per second, one thread, the same 12,000 rounds for every engine: ${engines.map((e) => `${e.name} ${e.kind} ${(INSTRUCTIONS / e.seconds / 1e6).toFixed(0)}`).join(', ')}.</desc>`);
  out.push(`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.surface}" stroke="${t.border}"/>`);
  out.push(`<text x="${PAD}" y="${PAD + 30}" font-size="34" font-weight="700" fill="${t.ink}">42mars<tspan font-weight="400" fill="${t.ink2}" font-size="21" dx="14">${esc(title)}</tspan></text>`);
  out.push(`<text x="${PAD}" y="${PAD + 58}" font-size="14.5" fill="${t.ink2}">Every engine plays the same 12,000 rounds and gets the same wins, losses and ties.</text>`);
  const x0 = PAD + LABEL, yEnd = TOP + engines.length * ROW - ROW + BAR + 8;
  for (let v = 0; v <= max; v += TICK) {
    const x = x0 + (v / max) * plot;
    out.push(`<line x1="${x}" y1="${TOP - 8}" x2="${x}" y2="${yEnd}" stroke="${t.grid}" stroke-dasharray="${v ? '2 3' : ''}"/>`);
    out.push(`<text x="${x}" y="${yEnd + 18}" text-anchor="middle" font-size="12" fill="${t.ink3}">${v / 1e6}</text>`);
  }
  out.push(`<text x="${x0 + plot / 2}" y="${yEnd + 38}" text-anchor="middle" font-size="13" fill="${t.ink2}">million simulated instructions per second</text>`);
  engines.forEach((e, i) => {
    const y = TOP + i * ROW;
    const rate = INSTRUCTIONS / e.seconds;
    const w = Math.max(6, (rate / max) * plot);
    const weight = e.ours ? 700 : 500;
    out.push(`<text x="${x0 - 14}" y="${y + BAR / 2 + 5}" text-anchor="end" font-size="15" fill="${t.ink}" font-weight="${weight}">${esc(e.name)}<tspan font-weight="400" fill="${t.ink3}" font-size="13" dx="7">${esc(e.kind)}</tspan></text>`);
    out.push(`<path d="${bar(x0, y, w, BAR, 4)}" fill="${e.ours ? t.ours : t.other}"/>`);
    const ratio = base / e.seconds;
    const rel = e.base ? 'reference' : `${ratio.toFixed(1)}× pMARS`;
    out.push(`<text x="${x0 + w + 10}" y="${y + BAR / 2 + 5}" font-size="15" fill="${t.ink}" font-weight="${e.ours ? 700 : 500}">${(rate / 1e6).toFixed(0)}<tspan font-weight="400" fill="${t.ink3}" font-size="13" dx="8">${rel}</tspan></text>`);
  });
  const foot = yEnd + 70;
  out.push(`<text x="${PAD}" y="${foot}" font-size="12" fill="${t.ink3}">3 hill pairs × 4,000 rounds, 446M instructions. Whole process wall time, median of 7. Ryzen 9 7950X, GCC 16.2, Node 22.22, 12th November 2026.</text>`);
  out.push(`<text x="${PAD}" y="${foot + 18}" font-size="12" fill="${t.ink3}">${esc(note)}</text>`);
  out.push('</svg>');
  return out.join('\n') + '\n';
}

for (const c of charts) {
  for (const [name, t] of Object.entries(themes)) writeFileSync(new URL(`${c.file}-${name}.svg`, import.meta.url), svg(t, c));
}
