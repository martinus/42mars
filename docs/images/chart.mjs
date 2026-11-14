// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// What the chart scripts of this folder share (speed.mjs for the README,
// performance.mjs for docs/performance.md): the colors of a light and a
// dark page, the frame of a chart and the bar shape. Every chart is written
// once per theme, as <name>-light.svg and <name>-dark.svg.
import { writeFileSync } from 'node:fs';

export const themes = {
  light: { surface: '#fcfcfb', border: '#e6e5e0', ink: '#0b0b0b', ink2: '#52514e', ink3: '#76756f', ours: '#f0652d', other: '#b5b4ae', grid: '#d6d5cf' },
  dark: { surface: '#1a1a19', border: '#2e2e2c', ink: '#f0efec', ink2: '#c3c2b7', ink3: '#97968e', ours: '#f0652d', other: '#5c5b57', grid: '#3a3a37' },
};

export const W = 880, PAD = 32;
export const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// A horizontal bar with a 4px rounded data end and a square end at the baseline.
export function bar(x, y, w, h, r = 4) {
  return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`;
}

// The svg element with title, description, the card and the two heading
// lines; `body` are the lines inside. `head` is the bold word of the first
// line, `title` what follows it in regular weight.
export function frame(t, H, { head, title, sub, desc }, body) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${esc(head)}: ${esc(title)}</title>`,
    `<desc id="desc">${esc(desc)}</desc>`,
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.surface}" stroke="${t.border}"/>`,
    `<text x="${PAD}" y="${PAD + 30}" font-size="34" font-weight="700" fill="${t.ink}">${esc(head)}<tspan font-weight="400" fill="${t.ink2}" font-size="21" dx="14">${esc(title)}</tspan></text>`,
    `<text x="${PAD}" y="${PAD + 58}" font-size="14.5" fill="${t.ink2}">${esc(sub)}</text>`,
    ...body,
    '</svg>',
  ].join('\n') + '\n';
}

// Footnote lines in the small muted type, the first one at y.
export function notes(t, y, lines) {
  return lines.map((l, i) => `<text x="${PAD}" y="${y + 18 * i}" font-size="12" fill="${t.ink3}">${esc(l)}</text>`);
}

// Writes draw(theme) for both themes next to this file.
export function write(name, draw) {
  for (const [theme, t] of Object.entries(themes)) writeFileSync(new URL(`${name}-${theme}.svg`, import.meta.url), draw(t));
}
