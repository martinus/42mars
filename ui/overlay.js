// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// 2D canvas on top of the WebGL core: arcs from an executing cell to the
// cells it writes, jumps to or reads, pointer tags in slow motion, and
// instruction text inside cells once they are large enough to read.

import { LAYOUT_RING, cellCenter } from './layout.js';
import { OPCODES, MODE_SYMBOLS, denormalize } from '../js/opcodes.js';

export class Overlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  curve(L, p, q) {
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    if (L.kind === LAYOUT_RING) {
      // bend toward the center, so arcs read as passes across the arena
      return { x: mx + (L.cx - mx) * 0.45, y: my + (L.cy - my) * 0.45 };
    }
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    return { x: mx - dy * 0.18, y: my + dx * 0.18 };
  }

  // arcs: [{ from, to, kind: 'write' | 'jump' | 'read', warrior, age (0..1) }]
  // tags: [{ addr, text, color }]
  draw({ L, m, arcs, tags, colors, dpr, focus, cellText }) {
    const g = this.g;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!L || !m) return;

    g.lineCap = 'round';
    for (const a of arcs) {
      const p = cellCenter(L, a.from);
      const q = cellCenter(L, a.to);
      const c = this.curve(L, p, q);
      const fade = (1 - a.age) ** 1.5;
      if (fade <= 0.01) continue;
      const col = colors[a.warrior % colors.length];
      g.strokeStyle = `rgba(${col},${(a.kind === 'read' ? 0.45 : 0.75) * fade})`;
      g.lineWidth = (a.kind === 'write' ? 1.6 : a.kind === 'read' ? 1.8 : 1.1) * dpr;
      g.setLineDash(a.kind === 'jump' ? [4 * dpr, 4 * dpr] : a.kind === 'read' ? [0.1, 3.5 * dpr] : []);
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.quadraticCurveTo(c.x, c.y, q.x, q.y);
      g.stroke();
      if (a.kind !== 'read') {
        g.setLineDash([]);
        g.fillStyle = `rgba(${col},${0.9 * fade})`;
        g.beginPath();
        g.arc(q.x, q.y, (a.kind === 'write' ? 2.6 : 2) * dpr, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.setLineDash([]);

    if (cellText) this.drawCellText(L, m, dpr);

    if (focus) {
      const p = cellCenter(L, focus.addr);
      const r = (10 + 6 * Math.sin(focus.phase * 8)) * dpr;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 2 * dpr;
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.stroke();
    }

    g.font = `600 ${10 * dpr}px ui-monospace, monospace`;
    g.textBaseline = 'middle';
    const placed = new Map();
    for (const t of tags) {
      const p = cellCenter(L, t.addr);
      const k = placed.get(t.addr) || 0;
      placed.set(t.addr, k + 1);
      const w = g.measureText(t.text).width + 8 * dpr;
      const h = 15 * dpr;
      const x = p.x + 8 * dpr;
      const y = p.y - 16 * dpr - k * (h + 2 * dpr);
      g.fillStyle = 'rgba(8,10,16,0.88)';
      g.strokeStyle = t.color;
      g.lineWidth = dpr;
      g.beginPath();
      g.roundRect(x, y - h / 2, w, h, 4 * dpr);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(x, y);
      g.stroke();
      g.fillStyle = t.color;
      g.fillText(t.text, x + 4 * dpr, y + 0.5 * dpr);
    }
  }

  drawCellText(L, m, dpr) {
    const cell = L.cell / dpr;
    if (cell < 26) return;
    const g = this.g;
    const big = cell >= 54;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fs = Math.min(13, cell * 0.28) * dpr;
    for (let a = 0; a < m.coreSize; a++) {
      const p = cellCenter(L, a);
      const x = m.op[a];
      if (m.owner[a] < 0) continue; // untouched core: the dot is enough
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.font = `600 ${fs}px ui-monospace, monospace`;
      g.fillText(OPCODES[x >> 3], p.x, big ? p.y - fs * 0.55 : p.y);
      if (big) {
        g.font = `${fs * 0.8}px ui-monospace, monospace`;
        g.fillText(`${MODE_SYMBOLS[m.am[a]]}${denormalize(m.av[a], m.coreSize)} ${MODE_SYMBOLS[m.bm[a]]}${denormalize(m.bv[a], m.coreSize)}`, p.x, p.y + fs * 0.6);
      }
    }
    g.textAlign = 'start';
  }
}
