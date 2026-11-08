// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Round timeline: process count (log scale, upper band) and share of the core
// each warrior last wrote (lower band) over the cycles of the current round.

export class Timeline {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reset(1, 1, 1);
  }

  reset(warriors, totalCycles, maxProcesses) {
    this.warriors = warriors;
    this.total = Math.max(1, totalCycles);
    this.maxProcesses = maxProcesses;
    this.samples = []; // { t, tasks: [], territory: [] }
    this.marks = []; // { t, warrior }
  }

  push(t, tasks, territory) {
    const last = this.samples[this.samples.length - 1];
    if (last && last.t === t) return;
    this.samples.push({ t, tasks: tasks.slice(), territory: territory.slice() });
    if (this.samples.length > 4000) {
      // keep every other sample, but never drop the newest
      this.samples = this.samples.filter((_, i) => i % 2 === 0 || i === this.samples.length - 1);
    }
  }

  mark(t, warrior) {
    this.marks.push({ t, warrior });
  }

  draw(colors, now, coreSize) {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const g = this.ctx;
    g.clearRect(0, 0, w, h);
    const padL = 6 * dpr;
    const padR = 6 * dpr;
    const top = 4 * dpr;
    const split = Math.round(h * 0.58);
    // The x axis grows with the round, so short rounds still use the width.
    const span = Math.min(this.total, Math.max(2000, now * 1.25));
    const x = (t) => padL + (t / span) * (w - padL - padR);
    const logMax = Math.log2(this.maxProcesses + 1);
    const yTasks = (n) => split - 3 * dpr - (Math.log2(n + 1) / logMax) * (split - top - 6 * dpr);
    const yTerr = (n) => h - 2 * dpr - (n / coreSize) * (h - split - 8 * dpr);

    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.lineWidth = dpr;
    g.beginPath();
    g.moveTo(padL, split);
    g.lineTo(w - padR, split);
    g.stroke();

    g.font = `${10 * dpr}px ui-monospace, monospace`;
    g.fillStyle = 'rgba(220,225,240,0.35)';
    g.fillText('processes', padL + 2 * dpr, top + 10 * dpr);
    g.fillText('core written', padL + 2 * dpr, split + 12 * dpr);

    for (const m of this.marks) {
      g.strokeStyle = colors[m.warrior].replace('rgb', 'rgba').replace(')', ',0.6)');
      g.setLineDash([3 * dpr, 3 * dpr]);
      g.beginPath();
      g.moveTo(x(m.t), top);
      g.lineTo(x(m.t), h);
      g.stroke();
      g.setLineDash([]);
    }

    for (let wi = 0; wi < this.warriors; wi++) {
      g.strokeStyle = colors[wi];
      g.shadowColor = colors[wi];
      g.shadowBlur = 6 * dpr;
      g.lineWidth = 1.5 * dpr;
      for (const [key, y] of [['tasks', yTasks], ['territory', yTerr]]) {
        g.beginPath();
        let first = true;
        for (const s of this.samples) {
          const px = x(s.t);
          const py = y(s[key][wi]);
          if (first) g.moveTo(px, py); else g.lineTo(px, py);
          first = false;
        }
        g.stroke();
      }
    }
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(x(now) - dpr / 2, top, dpr, h - top);
  }
}
