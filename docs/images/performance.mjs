// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Writes the figures of docs/performance.md, each for a light and a dark
// page: cell-*.svg (the layout of a core cell), dispatch-*.svg (the way
// from a cell to its code), words-*.svg (how many executed instructions
// the cases cover) and hills-*.svg (the sixth round against the engine
// before it). Usage: node docs/images/performance.mjs
//
// The numbers are from docs/performance-log.md, sixth round (14th November
// 2026), where the commands are: AMD Ryzen 9 7950X, one thread pinned to a
// core with a fixed frequency, GCC 16.2, the library as `make` builds it.
import { W, PAD, bar, esc, frame, notes, write } from './chart.mjs';

// ---------------------------------------------------------------- the cell

function cell(t) {
  const H = 330, x0 = 80, w = 180, y0 = 142, h = 64;
  const fields = [
    { name: 'A value', what: '0 to core size − 1' },
    { name: 'B value', what: '0 to core size − 1' },
    { name: 'instruction word', what: 'opcode, modifier, both modes' },
    { name: 'dispatch index', what: 'which code runs this word', ours: true },
  ];
  const out = [];
  fields.forEach((f, i) => {
    const x = x0 + i * w;
    out.push(`<rect x="${x + 1}" y="${y0}" width="${w - 2}" height="${h}" rx="4" fill="${f.ours ? t.ours : t.border}"${f.ours ? ' fill-opacity="0.22"' : ''}/>`);
    if (f.ours) out.push(`<rect x="${x + 1}" y="${y0}" width="${w - 2}" height="4" rx="2" fill="${t.ours}"/>`);
    out.push(`<text x="${x + w / 2}" y="${y0 + 29}" text-anchor="middle" font-size="16" font-weight="600" fill="${t.ink}">${esc(f.name)}</text>`);
    out.push(`<text x="${x + w / 2}" y="${y0 + 49}" text-anchor="middle" font-size="12.5" fill="${t.ink2}">${esc(f.what)}</text>`);
  });
  for (let i = 0; i <= 4; i++) {
    out.push(`<text x="${x0 + i * w}" y="${y0 - 10}" text-anchor="middle" font-size="12" fill="${t.ink3}">${i === 4 ? '8 bytes' : `byte ${2 * i}`}</text>`);
  }
  // A bracket under the fields from..to (exclusive) with its text.
  const bracket = (from, to, y, text) => {
    const a = x0 + from * w + 4, b = x0 + to * w - 4;
    out.push(`<path d="M${a},${y}v8h${b - a}v-8" fill="none" stroke="${t.ink3}"/>`);
    out.push(`<text x="${(a + b) / 2}" y="${y + 27}" text-anchor="middle" font-size="13" fill="${t.ink2}">${esc(text)}</text>`);
  };
  bracket(0, 2, y0 + h + 10, 'one 32-bit load: both values');
  bracket(2, 4, y0 + h + 10, 'always written together');
  bracket(0, 4, y0 + h + 56, 'one 64-bit load and store: MOV.I copies a whole cell, index included');
  return frame(t, H, {
    head: '42mars', title: 'a core cell is 8 bytes',
    sub: 'Four fields of 16 bits. The standard core of 8,000 cells is 64 KB.',
    desc: 'A core cell has four 16-bit fields: A value, B value, instruction word (opcode, modifier, both addressing modes) and dispatch index. The two values are one 32-bit load, the whole cell one 64-bit load or store.',
  }, out);
}

// ---------------------------------------------------------------- dispatch

// Where the instructions of the '94 hill run (the input 94nop): the shares
// of the words chart below at 256 and 512 cases.
function dispatch(t) {
  const H = 376, yMid = 208;
  const out = [];
  const box = (x, y, w, h, title, lines, ours) => {
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${ours ? t.ours : t.border}"${ours ? ' fill-opacity="0.22"' : ''}/>`);
    if (ours) out.push(`<rect x="${x}" y="${y}" width="4" height="${h}" rx="2" fill="${t.ours}"/>`);
    out.push(`<text x="${x + 16}" y="${y + 25}" font-size="15" font-weight="600" fill="${t.ink}">${esc(title)}</text>`);
    lines.forEach((l, i) => out.push(`<text x="${x + 16}" y="${y + 44 + 16 * i}" font-size="12.5" fill="${t.ink2}">${esc(l)}</text>`));
  };
  // An arrow from (x1, y1) to (x2, y2): horizontal, a bend, horizontal.
  const arrow = (x1, y1, x2, y2, label) => {
    const xm = x1 + 28;
    out.push(`<path d="M${x1},${y1}H${xm}V${y2}H${x2 - 7}" fill="none" stroke="${t.ink3}" stroke-width="1.5" stroke-linejoin="round"/>`);
    out.push(`<path d="M${x2},${y2}l-8,-4.5v9z" fill="${t.ink3}"/>`);
    if (label) out.push(`<text x="${x2 - 14}" y="${y2 - 7}" text-anchor="end" font-size="13.5" font-weight="700" fill="${t.ink}">${esc(label)}</text>`);
  };
  box(PAD, yMid - 38, 172, 76, 'the cell to execute', ['values, word and index,', 'one load each']);
  box(PAD + 212, yMid - 46, 216, 92, 'compares on the index', ['a Huffman tree: 4 compares for', 'the most executed words, 6 on', 'average. No table, no indirect jump']);
  const x3 = 590, w3 = W - PAD - x3;
  box(x3, 112, w3, 66, '256 cases in the loop', ['code for one word each'], true);
  box(x3, 190, w3, 66, '256 more cases', ['in a function behind the loop'], true);
  box(x3, 268, w3, 66, 'generic code', ['tests opcode and modes when it runs']);
  arrow(PAD + 172, yMid, PAD + 212, yMid);
  arrow(PAD + 428, yMid - 16, x3, 145, '97.3%');
  arrow(PAD + 428, yMid, x3, 223, '2.2%');
  arrow(PAD + 428, yMid + 16, x3, 301, '0.5%');
  out.push(...notes(t, H - 22, [`The shares are the executed instructions of the Koenigstuhl '94 hill without p-space.`]));
  return frame(t, H, {
    head: '42mars', title: 'from a cell to the code for its instruction word',
    sub: 'The cell carries the number of its case, so finding the code is a few compares.',
    desc: `Diagram: the executed cell's dispatch index goes through a tree of compares. 97.3% of the instructions of a '94 hill reach one of 256 cases in the loop, 2.2% one of 256 more cases in a function behind the loop, 0.5% the generic code.`,
  }, out);
}

// ---------------------------------------------------------------- words

// Share of the executed instructions, in percent, whose word is among the
// first n cases of HOT in lib/src/gen-dispatch.mjs, for random pairs of two
// Koenigstuhl hills (the inputs 94nop and 88 of the log's sixth round).
const CASES = [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 160, 192, 224, 256, 320, 384, 448, 512];
const COVERED = [
  { name: `'94 hill`, words: 655, ours: true, before: 21.0, share: [1.29, 1.97, 9.19, 27.53, 45.97, 57.06, 69.27, 77.61, 83.12, 90.26, 93.36, 94.38, 95.56, 96.78, 97.26, 98.16, 98.74, 99.17, 99.5] },
  { name: `'88 hill`, words: 84, before: 96.6, share: [20.28, 28.66, 42.23, 57.87, 71.2, 83.99, 87.24, 94.16, 96.26, 98.57, 99.24, 99.36, 99.52, 99.68, 99.87, 99.96, 99.96, 99.96, 99.96] },
];

function words(t) {
  const x0 = PAD + 56, y0 = 138, pw = W - x0 - PAD - 150, ph = 280, H = y0 + ph + 122;
  const X = (n) => x0 + (n / 512) * pw, Y = (p) => y0 + ph - (p / 100) * ph;
  const out = [];
  for (let p = 0; p <= 100; p += 25) {
    out.push(`<line x1="${x0}" y1="${Y(p)}" x2="${x0 + pw}" y2="${Y(p)}" stroke="${t.grid}" stroke-dasharray="${p ? '2 3' : ''}"/>`);
    out.push(`<text x="${x0 - 10}" y="${Y(p) + 4}" text-anchor="end" font-size="12" fill="${t.ink3}">${p}%</text>`);
  }
  for (const n of [0, 32, 64, 128, 256, 384, 512]) {
    out.push(`<line x1="${X(n)}" y1="${Y(0)}" x2="${X(n)}" y2="${Y(0) + 5}" stroke="${t.grid}"/>`);
    out.push(`<text x="${X(n)}" y="${Y(0) + 20}" text-anchor="middle" font-size="12" fill="${t.ink3}">${n}</text>`);
  }
  out.push(`<text x="${x0 + pw / 2}" y="${Y(0) + 42}" text-anchor="middle" font-size="13" fill="${t.ink2}">number of instruction words with code of their own</text>`);
  out.push(`<text x="${x0}" y="${y0 - 14}" font-size="13" fill="${t.ink2}">share of the executed instructions that run such code</text>`);
  // Where the cases are: 256 in the loops, 256 more behind a call.
  out.push(`<line x1="${X(256)}" y1="${Y(100)}" x2="${X(256)}" y2="${Y(0)}" stroke="${t.ink3}" stroke-dasharray="4 4"/>`);
  out.push(`<text x="${X(256) - 8}" y="${Y(8)}" text-anchor="end" font-size="12.5" fill="${t.ink2}">256 cases in the loops</text>`);
  out.push(`<text x="${X(256) + 8}" y="${Y(8)}" font-size="12.5" fill="${t.ink2}">256 more behind a call</text>`);
  for (const s of COVERED) {
    const color = s.ours ? t.ours : t.ink3;
    const d = ['M', X(0), Y(0), ...CASES.flatMap((n, i) => ['L', X(n).toFixed(1), Y(s.share[i]).toFixed(1)])].join(' ');
    out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`);
    out.push(`<circle cx="${X(512)}" cy="${Y(s.share.at(-1))}" r="4" fill="${color}" stroke="${t.surface}" stroke-width="2"/>`);
  }
  // Direct labels: the lines end 1 pixel apart, so the labels sit beside the end, one above the other.
  COVERED.forEach((s) => {
    const y = Y(100) + (s.ours ? 22 : 2);
    out.push(`<rect x="${X(512) + 14}" y="${y - 9}" width="10" height="10" rx="2" fill="${s.ours ? t.ours : t.ink3}"/>`);
    out.push(`<text x="${X(512) + 30}" y="${y}" font-size="13.5" font-weight="${s.ours ? 700 : 500}" fill="${t.ink}">${esc(s.name)}<tspan font-weight="400" fill="${t.ink2}" dx="6">${s.share.at(-1)}%</tspan></text>`);
  });
  // The engine before the sixth round: 32 cases, ranked on '88-style warriors.
  const b = COVERED[0];
  out.push(`<circle cx="${X(32)}" cy="${Y(b.before)}" r="5" fill="${t.surface}" stroke="${t.ours}" stroke-width="2"/>`);
  out.push(`<text x="${X(32) + 12}" y="${Y(b.before) + 5}" font-size="12.5" fill="${t.ink}">before: 32 cases, chosen on '88-style warriors,</text>`);
  out.push(`<text x="${X(32) + 12}" y="${Y(b.before) + 21}" font-size="12.5" fill="${t.ink}">ran ${b.before}% of the '94 hill and ${COVERED[1].before}% of the '88 hill</text>`);
  out.push(...notes(t, Y(0) + 72, [
    `Random pairs of the Koenigstuhl '94 hill without p-space (${b.words} different words executed) and of its '88 hill (${COVERED[1].words}).`,
    'The cases in the order of lib/src/gen-dispatch.mjs, ranked over 13 mixes. Counts: bench/bench-native.mjs --count.',
  ]));
  return frame(t, H, {
    head: '42mars', title: `a '94 hill needs many more cases than an '88 hill`,
    sub: 'Every instruction word with a case runs code compiled for that word alone.',
    desc: `Line chart: share of executed instructions covered by the first n specialized instruction words. '88 hill: ${COVERED[1].share[6]}% with 32 words, ${COVERED[1].share[14]}% with 256. '94 hill: ${b.share[6]}% with 32, ${b.share[8]}% with 64, ${b.share[14]}% with 256, ${b.share.at(-1)}% with 512. The 32 cases of the engine before covered ${b.before}% of the '94 hill.`,
  }, out);
}

// ---------------------------------------------------------------- hills

// Million instructions per second with gcc, `main` before the sixth round
// and now, median of 5 runs (the table "Everything of this round against
// main" of the log).
const GROUPS = [
  { title: `'94-style hills`, rows: [
    ['94nop', `no p-space`, 220.1, 358.6], ['pspace', 'with p-space', 207.6, 352.8], ['tiny', '800 cells', 186.9, 283.4],
    ['nano', '80 cells', 212.3, 309.4], ['lp', '8 processes', 199.7, 307.2], ['x', '55,440 cells', 224.3, 361.4], ['odd', 'mixed rules', 240.3, 371.4],
  ] },
  { title: `'88-style hills and the corpus of the earlier rounds`, rows: [
    ['88', `'88 hill`, 420.3, 466.6], ['icws', '8,192 cells', 380.9, 434.3], ['t20', '20 warriors', 423.4, 468.7],
    ['corpus pairs', '400 pairs', 404.9, 451.1], ['t80s', '80 warriors', 431.2, 477.0], ['bench', '3 pairs', 473.0, 516.7],
  ] },
];

function hills(t) {
  const LABEL = 190, ROW = 34, BAR = 10, TOP = 150, MAX = 600, GAP = 40;
  const x0 = PAD + LABEL, pw = W - x0 - PAD - 96;
  const rows = GROUPS.reduce((s, g) => s + g.rows.length, 0);
  const yEnd = TOP + rows * ROW + GAP + 2, H = yEnd + 96;
  const X = (v) => x0 + (v / MAX) * pw;
  const out = [];
  // Legend, right of the second heading line.
  [['before', t.other], ['now', t.ours]].forEach(([name, color], i) => {
    out.push(`<rect x="${W - PAD - 150 + i * 82}" y="${PAD + 48}" width="10" height="10" rx="2" fill="${color}"/>`);
    out.push(`<text x="${W - PAD - 134 + i * 82}" y="${PAD + 58}" font-size="13.5" fill="${t.ink}">${name}</text>`);
  });
  for (let v = 0; v <= MAX; v += 100) {
    out.push(`<line x1="${X(v)}" y1="${TOP - 26}" x2="${X(v)}" y2="${yEnd}" stroke="${t.grid}" stroke-dasharray="${v ? '2 3' : ''}"/>`);
    out.push(`<text x="${X(v)}" y="${yEnd + 18}" text-anchor="middle" font-size="12" fill="${t.ink3}">${v}</text>`);
  }
  out.push(`<text x="${x0 + pw / 2}" y="${yEnd + 38}" text-anchor="middle" font-size="13" fill="${t.ink2}">million simulated instructions per second</text>`);
  let y = TOP;
  GROUPS.forEach((g, gi) => {
    out.push(`<rect x="${x0 + 1}" y="${y - 23}" width="${g.title.length * 6.6 + 12}" height="18" fill="${t.surface}"/>`);
    out.push(`<text x="${x0 + 6}" y="${y - 10}" font-size="12.5" font-weight="600" fill="${t.ink2}">${esc(g.title)}</text>`);
    for (const [name, kind, before, now] of g.rows) {
      out.push(`<text x="${x0 - 14}" y="${y + BAR + 5}" text-anchor="end" font-size="14.5" font-weight="600" fill="${t.ink}">${esc(name)}<tspan font-weight="400" fill="${t.ink3}" font-size="12.5" dx="7">${esc(kind)}</tspan></text>`);
      out.push(`<path d="${bar(x0, y, X(before) - x0, BAR, 3)}" fill="${t.other}"/>`);
      out.push(`<path d="${bar(x0, y + BAR + 2, X(now) - x0, BAR, 3)}" fill="${t.ours}"/>`);
      const gain = Math.round(100 * (now / before - 1));
      out.push(`<text x="${X(now) + 8}" y="${y + BAR + 6}" font-size="13.5" font-weight="700" fill="${t.ink}">${now.toFixed(0)}<tspan font-weight="400" fill="${t.ink3}" font-size="12.5" dx="7">+${gain}%</tspan></text>`);
      y += ROW;
    }
    if (gi === 0) y += GAP;
  });
  out.push(...notes(t, yEnd + 66, [
    'A hill is random pairs of that Koenigstuhl hill with its settings. Early ties on. GCC 16.2 -O3, Ryzen 9 7950X, one thread, median of 5, 14th November 2026.',
  ]));
  return frame(t, H, {
    head: '42mars', title: 'the sixth round: 512 cases and an index in every cell',
    sub: 'The same engine before and after, on 13 mixes of warriors.',
    desc: `Bar chart: million simulated instructions per second before and after the sixth round, gcc. ${GROUPS.flatMap((g) => g.rows).map(([name, , before, now]) => `${name} ${before.toFixed(0)} to ${now.toFixed(0)}`).join(', ')}.`,
  }, out);
}

write('cell', cell);
write('dispatch', dispatch);
write('words', words);
write('hills', hills);
