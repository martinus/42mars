// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver dashboard: reads the events of a 42evolve run (evolver/evolve.c)
// and shows the list as it changes. Data comes live from
// `node tools/serve.mjs --run <folder>` (/run/events), from ?log=<url> of an
// events.jsonl, or from an events.jsonl dropped on the page. A click on a
// match opens the visualizer (index.html#battle=...) on the same match: the
// same warriors, rules and seed, so the rounds on screen are the ones behind
// the number.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
const fmtBig = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}G` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(0));
const f1 = (x) => (x === undefined || x === null || x < 0 ? '–' : x.toFixed(1));

// Scores 0..300 points per 100 rounds: navy, purple, magenta, orange, yellow.
const STOPS = [[0x0b, 0x10, 0x26], [0x3b, 0x1f, 0x6e], [0xb0, 0x3a, 0x7a], [0xff, 0x7b, 0x3d], [0xff, 0xe6, 0x6b]];
function scoreRgb(p) {
  const x = Math.max(0, Math.min(1, p / 300)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x)), t = x - i;
  return STOPS[i].map((v, k) => Math.round(v + (STOPS[i + 1][k] - v) * t));
}
const scoreColor = (p) => `rgb(${scoreRgb(p).join(',')})`;
const hsl = (h, s = 85, l = 62, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

// ------------------------------------------------------------------ state

function fresh() {
  return {
    start: null,
    rounds: 100,
    w: new Map(), // id -> warrior
    res: new Map(), // "a:b" -> { w, l, t, seed, first, rounds }: a's results against b
    slots: [], // member ids in 42evolve's slot order, null for a free slot
    panel: [], // ids
    batch: -1,
    tried: 0,
    history: [], // per batch: { batch, best, mean, holdout }
    speed: null,
    bestHoldout: -1,
    bestId: null, // the best against the holdout warriors so far
    ticker: [],
    ghosts: [], // members that left, fading out of the matrix
    mapDirty: true,
    opTotals: new Map(), // change -> [children, evaluated, past the screen, still in after the batch]
    opBatches: [], // per batch: { batch, ops }
    mapIds: [],
    view: null,
  };
}
let S = fresh();
let selected = null;
let ease = 0.1; // the share of the way to a target that this frame moves (time-based, see frame())
let hover = null; // { kind, ... } of the canvas under the mouse

const member = (id) => S.w.get(id);
const alive = () => S.slots.filter((id) => id !== null && S.w.get(id).kind === 'member').map(member);
const nameOf = (id) => S.w.get(id)?.name ?? `#${id}`;

function setRes(a, b, w, l, t, seed, first, rounds = S.rounds) {
  S.res.set(`${a}:${b}`, { w, l, t, seed, first, rounds });
  S.res.set(`${b}:${a}`, { w: l, l: w, t, seed, first, rounds });
}
const resOf = (a, b) => S.res.get(`${a}:${b}`);
const points = (r) => (r ? ((3 * r.w + r.t) * 100) / r.rounds : null);

function panelAvg(id) {
  let s = 0, n = 0;
  for (const p of S.panel) {
    const r = resOf(id, p);
    if (r) s += points(r), n++;
  }
  return n ? s / n : 0;
}

// Families share a color: a child takes its first parent's hue, shifted a bit.
function hueFor(id, parents) {
  const p = parents.length ? S.w.get(parents[0]) : null;
  if (p && p.kind === 'member') return (p.hue + ((id * 37) % 25) - 12 + 360) % 360;
  return (id * 137.508) % 360;
}

function tick(html) {
  S.ticker.unshift(html);
  if (S.ticker.length > 60) S.ticker.length = 60;
  tickerDirty = true;
}
const link = (id) => (!S.w.has(id) ? '–' : `<a data-id="${id}" style="color:${S.w.get(id)?.kind === 'member' ? hsl(S.w.get(id).hue) : '#aab0c8'}">${esc(nameOf(id))}</a>`);

// ------------------------------------------------------------------ events

function handle(e) {
  const now = performance.now();
  chartsDirty = chipsDirty = true;
  switch (e.type) {
    case 'start': {
      S = fresh();
      S.start = e;
      S.rounds = e.params.rounds;
      for (const p of e.panel) S.w.set(p.id, { ...p, kind: 'panel' });
      for (const p of e.holdout) S.w.set(p.id, { ...p, kind: 'holdout' });
      S.panel = e.panel.map((p) => p.id);
      S.slots = S.panel.slice();
      const r = e.rules, p = e.params;
      $('run-info').textContent = `core ${r.size} · cycles ${r.cycles} · length ${r.length} · panel ${p.panel} · holdout ${p.holdout} · list ${p.list} · batch ${p.batch} · ${p.rounds} rounds · SD ${p.sd} · alpha ${p.alpha} · select ${p.select ?? 'screen'} · rotate ${p.rotate ?? 0} · seed ${p.seed} · 42mars ${e.version}`;
      break;
    }
    case 'panel':
      for (const [a, b, w, l, t, seed] of e.scores) setRes(a, b, w, l, t, seed, a);
      break;
    case 'enter': {
      const x = { id: e.id, kind: 'member', name: e.name ?? `e${e.id}`, code: e.code, parents: e.parents, ops: e.ops, length: e.length, screen: e.screen, estimate: e.estimate, born: e.batch, died: null, alive: true, enteredAt: now, value: null };
      x.hue = hueFor(e.id, e.parents);
      S.w.set(e.id, x);
      let s = S.slots.indexOf(null, S.panel.length);
      if (s < 0) s = S.slots.push(null) - 1;
      S.slots[s] = e.id;
      for (const [o, w, l, t, seed] of e.scores) setRes(e.id, o, w, l, t, seed, e.id);
      x.panelAvg = panelAvg(e.id);
      x.row = null;
      S.mapDirty = true;
      tick(`<span class="in">+</span> ${link(e.id)} <b>${f1(x.panelAvg)}</b> vs panel <span style="color:#6c7290">${esc(e.ops)}</span>`);
      break;
    }
    case 'rotate': { // a new hill warrior takes the place of the oldest in the panel
      const p = { ...e.panel, kind: 'panel' };
      S.w.set(p.id, p);
      const old = S.w.get(e.out);
      if (old) old.kind = 'retired';
      S.panel[S.panel.indexOf(e.out)] = p.id;
      S.slots[S.slots.indexOf(e.out)] = p.id;
      for (const [o, w, l, t, seed] of e.scores) setRes(p.id, o, w, l, t, seed, p.id);
      for (const x of alive()) x.panelAvg = panelAvg(x.id);
      S.mapDirty = true;
      tick(`<span class="best">⟳</span> panel: ${link(p.id)} replaces ${esc(old?.name ?? `#${e.out}`)}`);
      break;
    }
    case 'leave': {
      const x = member(e.id);
      if (!x) break;
      x.alive = false;
      x.died = e.batch;
      x.leftAt = now;
      x.value = e.value;
      x.distance = e.distance;
      x.nearest = e.nearest;
      S.slots[S.slots.indexOf(e.id)] = null;
      if (x.row !== null && x.row !== undefined) S.ghosts.push(x);
      S.mapDirty = true;
      if (x.born === e.batch) x.rejected = true; // did not last its own batch
      tick(`<span class="out">−</span> ${link(e.id)} pushed off, value ${f1(e.value)}, nearest ${link(e.nearest)}`);
      break;
    }
    case 'values':
      for (const [id, avg, distance, nearest, value, pAvg] of e.values) {
        const x = S.w.get(id);
        if (!x) continue;
        Object.assign(x, { avg, distance, nearest, value, panelAvg: pAvg });
      }
      S.mapDirty = true;
      break;
    case 'bench': {
      const x = member(e.id);
      if (!x) break;
      x.holdout = e.avg;
      for (const [h, w, l, t, seed] of e.scores) setRes(e.id, h, w, l, t, seed, e.id, e.rounds);
      x.benched = e.scores.map((s) => s[0]);
      const best = e.avg > S.bestHoldout;
      if (best) S.bestHoldout = e.avg, S.bestId = e.id;
      tick(`<span class="best">★</span> ${link(e.id)} scores <b>${f1(e.avg)}</b> against ${e.scores.length} holdout warriors${best ? ' <span class="best">best so far</span>' : ''}`);
      break;
    }
    case 'batch': {
      S.batch = e.batch;
      S.tried += e.evaluated;
      if (e.ops) {
        for (const [op, n] of Object.entries(e.ops)) {
          const t = S.opTotals.get(op) ?? [0, 0, 0, 0];
          n.forEach((v, i) => { t[i] += v; });
          S.opTotals.set(op, t);
        }
        S.opBatches.push({ batch: e.batch, ops: e.ops });
        opsDirty = true;
      }
      const ms = alive();
      const pa = ms.map((m) => m.panelAvg ?? 0);
      S.history.push({ batch: e.batch, best: pa.length ? Math.max(...pa) : 0, mean: pa.length ? pa.reduce((a, b) => a + b, 0) / pa.length : 0, holdout: S.bestHoldout });
      chipsDirty = true;
      break;
    }
    case 'speed':
      S.speed = e;
      chipsDirty = true;
      break;
    case 'resume':
      tick(`run continued at batch ${e.batch}`);
      break;
    default:
  }
}

// ------------------------------------------------------------------ canvases

function fit(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function mouseOf(canvas) {
  return hover && hover.canvas === canvas ? hover : null;
}

// ---------------- the score matrix

const matrix = { cells: [], rows: [] };

function drawMatrix(now) {
  const canvas = $('matrix');
  const { ctx, w, h } = fit(canvas);
  if (!S.start) return;
  const ms = alive().sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.id - b.id);
  const panel = S.panel.map(member).sort((a, b) => (b.panelAvg ?? 0) - (a.panelAvg ?? 0));
  ms.forEach((m, i) => {
    if (m.row === null || m.row === undefined) m.row = now - m.enteredAt < 2000 ? ms.length : i; // a newcomer slides in from below
    m.row += (i - m.row) * ease;
  });
  S.ghosts = S.ghosts.filter((g) => now - g.leftAt < 900);
  ctx.font = 'bold 11px ui-monospace, monospace';
  const labelW = Math.min(230, Math.max(74, ...[...ms, ...S.ghosts].map((m) => ctx.measureText(`★ ${m.name}`).width + 28))), top = 26, gap = 10;
  const cols = ms.length + panel.length;
  const cw = Math.max(3, (w - labelW - gap - 10) / Math.max(1, cols));
  const ch = Math.max(6, Math.min(36, (h - top - 10) / Math.max(8, ms.length)));
  const colX = (i) => labelW + (i < ms.length ? i * cw : ms.length * cw + gap + (i - ms.length) * cw);
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillStyle = '#7f86a0';
  ctx.textBaseline = 'middle';
  ctx.fillText('evolved', labelW, 10);
  ctx.fillText(`panel (${panel.length} hill warriors)`, labelW + ms.length * cw + gap, 10);
  // column marks in the warriors' colors
  ms.forEach((m, i) => {
    ctx.fillStyle = hsl(m.hue);
    ctx.fillRect(colX(i) + 1, top - 7, cw - 2, 3);
  });
  matrix.cells = [];
  matrix.rows = [];
  const drawRow = (m, y, alpha) => {
    ctx.globalAlpha = alpha;
    const sel = selected === m.id;
    ctx.fillStyle = sel ? '#ffc53d' : hsl(m.hue);
    ctx.beginPath();
    ctx.arc(10, y + ch / 2, 4, 0, 7);
    ctx.fill();
    ctx.fillStyle = sel ? '#ffc53d' : '#dfe3f0';
    ctx.font = `${sel ? 'bold ' : ''}11px ui-monospace, monospace`;
    ctx.fillText(m.id === S.bestId ? `★ ${m.name}` : m.name, 20, y + ch / 2);
    matrix.rows.push({ id: m.id, y, h: ch });
    const others = [...ms, ...panel];
    for (let j = 0; j < others.length; j++) {
      const o = others[j];
      const x = colX(j);
      if (o.id === m.id) {
        ctx.fillStyle = '#05060a';
        ctx.fillRect(x, y, cw - 1, ch - 1);
        continue;
      }
      const r = resOf(m.id, o.id);
      if (!r) continue;
      const p = points(r);
      ctx.fillStyle = scoreColor(p);
      ctx.fillRect(x, y, cw - 1, ch - 1);
      // a fresh row and column glow
      const age = Math.min(now - (m.enteredAt ?? 0), now - (o.enteredAt ?? 0));
      if (age < 1500) {
        ctx.fillStyle = `rgba(255,255,255,${0.55 * Math.exp(-age / 350)})`;
        ctx.fillRect(x, y, cw - 1, ch - 1);
      }
      matrix.cells.push({ x, y, w: cw, h: ch, a: m.id, b: o.id });
    }
    ctx.globalAlpha = 1;
  };
  for (const g of S.ghosts) drawRow(g, top + g.row * ch, Math.max(0, 1 - (now - g.leftAt) / 900));
  for (const m of ms) drawRow(m, top + m.row * ch, 1);
  const hv = mouseOf(canvas);
  if (hv) {
    const c = matrix.cells.find((c) => hv.x >= c.x && hv.x < c.x + c.w && hv.y >= c.y && hv.y < c.y + c.h);
    if (c) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x - 0.5, c.y - 0.5, c.w, c.h);
      const r = resOf(c.a, c.b);
      showTip(hv, `<b>${esc(nameOf(c.a))}</b> vs <b>${esc(nameOf(c.b))}</b><br>${r.w} wins · ${r.l} losses · ${r.t} ties<br>${f1(points(r))} points per 100 rounds<br><span style="color:#7f86a0">seed ${r.seed} · click to watch</span>`);
      hv.target = { battle: [c.a, c.b] };
    } else {
      const row = matrix.rows.find((r) => hv.y >= r.y && hv.y < r.y + r.h && hv.x < labelW);
      hv.target = row ? { select: row.id } : null;
      if (row) showTip(hv, warriorTip(row.id));
      else hideTip();
    }
  }
}

function warriorTip(id) {
  const x = S.w.get(id);
  if (!x) return '';
  if (x.kind !== 'member') return `<b>${esc(x.name)}</b> by ${esc(x.author)}<br>${f1(x.panelAvg)} against the panel`;
  return `<b style="color:${hsl(x.hue)}">${esc(x.name)}</b> #${x.id} · batch ${x.born}${x.alive ? '' : ` to ${x.died}`}<br>${f1(x.panelAvg)} vs panel · value ${f1(x.value)}<br>nearest ${esc(nameOf(x.nearest))} at ${x.distance?.toFixed(2) ?? '–'}${x.holdout >= 0 ? `<br>holdout ${f1(x.holdout)}` : ''}`;
}

// ---------------- the novelty map: classical MDS of the rows against the panel

function computeMap() {
  S.mapDirty = false;
  const panel = S.panel;
  const dead = [...S.w.values()].filter((x) => x.kind === 'member' && !x.alive && !x.rejected).slice(-160);
  const ids = [...panel, ...alive().map((x) => x.id), ...dead.map((x) => x.id)];
  const n = ids.length, P = panel.length;
  if (n < 3 || P < 2) return;
  // fingerprints: points against each panel warrior; the own column of a
  // panel warrior is the column mean of the others
  const F = new Float64Array(n * P);
  for (let i = 0; i < n; i++) for (let k = 0; k < P; k++) F[i * P + k] = ids[i] === panel[k] ? NaN : (points(resOf(ids[i], panel[k])) ?? NaN);
  const sigma = new Float64Array(P);
  for (let k = 0; k < P; k++) {
    let s = 0, c = 0;
    for (let i = 0; i < n; i++) if (!Number.isNaN(F[i * P + k])) s += F[i * P + k], c++;
    const mean = c ? s / c : 0;
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(F[i * P + k])) F[i * P + k] = mean;
      v += (F[i * P + k] - mean) ** 2;
    }
    sigma[k] = Math.sqrt(v / n) || 1;
  }
  // the SD-score of the push-off (each column by its standard deviation)
  const D2 = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      let d = 0;
      for (let k = 0; k < P; k++) d += Math.abs(F[i * P + k] - F[j * P + k]) / sigma[k];
      D2[i * n + j] = D2[j * n + i] = d * d;
    }
  }
  const rm = new Float64Array(n);
  let tm = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) rm[i] += D2[i * n + j];
    tm += rm[i];
    rm[i] /= n;
  }
  tm /= n * n;
  const B = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B[i * n + j] = -0.5 * (D2[i * n + j] - rm[i] - rm[j] + tm);
  const vecs = [], vals = [];
  for (let c = 0; c < 2; c++) {
    let v = Float64Array.from({ length: n }, (_, i) => Math.sin(i * 12.9898 + c * 78.233));
    let lambda = 0;
    for (let it = 0; it < 80; it++) {
      const u = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += B[i * n + j] * v[j];
        u[i] = s;
      }
      for (const q of vecs) {
        let d = 0;
        for (let i = 0; i < n; i++) d += q[i] * u[i];
        for (let i = 0; i < n; i++) u[i] -= d * q[i];
      }
      let norm = 0;
      for (let i = 0; i < n; i++) norm += u[i] * u[i];
      norm = Math.sqrt(norm) || 1;
      lambda = norm;
      for (let i = 0; i < n; i++) u[i] /= norm;
      v = u;
    }
    vecs.push(v);
    vals.push(Math.sqrt(Math.max(lambda, 0)));
  }
  const pos = ids.map((_, i) => [vecs[0][i] * vals[0], vecs[1][i] * vals[1]]);
  // turn and mirror onto the last map so that the picture stays put
  let best = null;
  for (const flip of [1, -1]) {
    let a = 0, b = 0;
    ids.forEach((id, i) => {
      const old = S.w.get(id).mapTarget;
      if (!old) return;
      const x = pos[i][0], y = pos[i][1] * flip;
      a += x * old[0] + y * old[1];
      b += x * old[1] - y * old[0];
    });
    const score = Math.hypot(a, b);
    if (!best || score > best.score) best = { flip, theta: Math.atan2(b, a), score };
  }
  const cos = Math.cos(best.theta), sin = Math.sin(best.theta);
  ids.forEach((id, i) => {
    const x = pos[i][0], y = pos[i][1] * best.flip;
    const t = [x * cos - y * sin, x * sin + y * cos];
    const w = S.w.get(id);
    w.mapTarget = t;
    if (!w.mapPos) w.mapPos = w.kind === 'member' && w.parents.length && S.w.get(w.parents[0])?.mapPos ? [...S.w.get(w.parents[0]).mapPos] : [...t];
  });
  S.mapIds = ids;
}

function drawMap(now) {
  const canvas = $('map');
  const { ctx, w, h } = fit(canvas);
  if (!S.mapIds.length) return;
  const pts = S.mapIds.map((id) => S.w.get(id));
  for (const p of pts) {
    p.mapPos[0] += (p.mapTarget[0] - p.mapPos[0]) * ease * 0.6;
    p.mapPos[1] += (p.mapTarget[1] - p.mapPos[1]) * ease * 0.6;
  }
  // a view box that follows the points slowly
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.mapTarget[0]); x1 = Math.max(x1, p.mapTarget[0]);
    y0 = Math.min(y0, p.mapTarget[1]); y1 = Math.max(y1, p.mapTarget[1]);
  }
  const target = [x0, x1, y0, y1];
  if (!S.view) S.view = target;
  S.view = S.view.map((v, i) => v + (target[i] - v) * ease * 0.4);
  const [vx0, vx1, vy0, vy1] = S.view;
  const pad = 28, sx = (w - 2 * pad) / Math.max(1e-9, vx1 - vx0), sy = (h - 2 * pad) / Math.max(1e-9, vy1 - vy0), s = Math.min(sx, sy);
  const cx = (vx0 + vx1) / 2, cy = (vy0 + vy1) / 2;
  const X = (p) => w / 2 + (p.mapPos[0] - cx) * s, Y = (p) => h / 2 + (p.mapPos[1] - cy) * s;
  // faint rings for depth
  ctx.strokeStyle = '#161a2b';
  for (let r = 60; r < Math.max(w, h); r += 60) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, 7);
    ctx.stroke();
  }
  const hv = mouseOf(canvas);
  let near = null, nearD = 14;
  const consider = (p, x, y) => {
    if (!hv) return;
    const d = Math.hypot(hv.x - x, hv.y - y);
    if (d < nearD) nearD = d, near = p;
  };
  // the selected warrior's family
  const fam = selected !== null ? ancestry(selected) : new Set();
  for (const p of pts) {
    const x = X(p), y = Y(p);
    if (p.kind === 'panel') {
      ctx.fillStyle = '#9aa1bb';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (!p.alive) {
      ctx.fillStyle = hsl(p.hue, 60, 50, fam.has(p.id) ? 0.9 : 0.28);
      ctx.beginPath();
      ctx.arc(x, y, fam.has(p.id) ? 3 : 2, 0, 7);
      ctx.fill();
    }
    consider(p, x, y);
  }
  for (const p of pts) {
    if (p.kind !== 'member' || !p.alive) continue;
    const x = X(p), y = Y(p);
    const r = 5 + Math.min(6, (p.value ?? 0) / 150);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    g.addColorStop(0, hsl(p.hue, 95, 70, 0.55));
    g.addColorStop(1, hsl(p.hue, 95, 50, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.2, 0, 7);
    ctx.fill();
    ctx.fillStyle = hsl(p.hue, 90, 66);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    const age = now - p.enteredAt;
    if (age < 1800) { // a newcomer flares up
      ctx.strokeStyle = hsl(p.hue, 100, 75, 1 - age / 1800);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + age / 25, 0, 7);
      ctx.stroke();
    }
    if (p.id === S.bestId) { // the best against the holdout: a gold star
      ctx.fillStyle = '#ffc53d';
      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.fillText('★', x + r + 3, y - r - 2);
    }
    if (p.id === selected) {
      ctx.strokeStyle = '#ffc53d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, 7);
      ctx.stroke();
    }
    consider(p, x, y);
  }
  if (hv) {
    hv.target = near ? { select: near.id } : null;
    if (near) showTip(hv, warriorTip(near.id));
    else hideTip();
  }
}

// ---------------- lineage: birth batch against score, lines to the parents

function ancestry(id) {
  const out = new Set();
  const walk = (x) => {
    if (out.has(x)) return;
    const w = S.w.get(x);
    if (!w || w.kind !== 'member') return;
    out.add(x);
    for (const p of w.parents) walk(p);
  };
  walk(id);
  return out;
}

function drawLineage() {
  const canvas = $('lineage');
  const { ctx, w, h } = fit(canvas);
  if (!S.start) return;
  const all = [...S.w.values()].filter((x) => x.kind === 'member');
  const left = 36, right = 10, top = 10, bottom = 22;
  const maxB = Math.max(1, S.batch + 1);
  const maxY = Math.max(100, Math.ceil(Math.max(0, ...all.map((x) => x.panelAvg ?? 0)) / 50) * 50);
  const X = (x) => left + ((x.born + ((x.id * 0.618) % 1) * 0.8) / maxB) * (w - left - right);
  const Y = (v) => h - bottom - (v / maxY) * (h - top - bottom);
  axes(ctx, w, h, left, right, top, bottom, maxY, maxB, 'batch');
  const fam = selected !== null ? ancestry(selected) : new Set();
  ctx.lineWidth = 1;
  for (const x of all) {
    for (const pid of x.parents) {
      const p = S.w.get(pid);
      if (!p || p.kind !== 'member') continue;
      const inFam = fam.has(x.id) && fam.has(pid);
      ctx.strokeStyle = inFam ? '#ffc53d' : hsl(x.hue, 70, 55, x.alive ? 0.35 : 0.1);
      ctx.lineWidth = inFam ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(X(p), Y(p.panelAvg ?? 0));
      ctx.lineTo(X(x), Y(x.panelAvg ?? 0));
      ctx.stroke();
    }
  }
  const hv = mouseOf(canvas);
  let near = null, nearD = 10;
  for (const x of all) {
    const px = X(x), py = Y(x.panelAvg ?? 0);
    ctx.fillStyle = fam.has(x.id) ? '#ffc53d' : x.alive ? hsl(x.hue, 95, 65) : hsl(x.hue, 60, 50, x.rejected ? 0.15 : 0.4);
    ctx.beginPath();
    ctx.arc(px, py, x.alive ? 3.5 : 2, 0, 7);
    ctx.fill();
    if (hv) {
      const d = Math.hypot(hv.x - px, hv.y - py);
      if (d < nearD) nearD = d, near = x;
    }
  }
  if (hv) {
    hv.target = near ? { select: near.id } : null;
    if (near) showTip(hv, warriorTip(near.id));
    else hideTip();
  }
}

function axes(ctx, w, h, left, right, top, bottom, maxY, maxX, xLabel) {
  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#1c2033';
  ctx.setLineDash([2, 3]);
  for (let v = 0; v <= maxY; v += maxY > 200 ? 100 : 50) {
    const y = h - bottom - (v / maxY) * (h - top - bottom);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();
    ctx.fillStyle = '#6c7290';
    ctx.fillText(String(v), 4, y);
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#6c7290';
  ctx.fillText(`${xLabel} ${maxX - 1}`, w - right - 60, h - 8);
  ctx.fillText(`${xLabel} 0`, left, h - 8);
}

// ---------------- progress over the batches

function drawProgress() {
  const canvas = $('progress');
  const { ctx, w, h } = fit(canvas);
  const hs = S.history;
  if (!hs.length) return;
  const left = 36, right = 10, top = 22, bottom = 22;
  const maxY = Math.max(100, Math.ceil(Math.max(...hs.map((x) => Math.max(x.best, x.holdout))) / 50) * 50);
  const n = hs.length;
  axes(ctx, w, h, left, right, top, bottom, maxY, hs[n - 1].batch + 1, 'batch');
  const X = (i) => left + (n === 1 ? 0 : (i / (n - 1)) * (w - left - right));
  const Y = (v) => h - bottom - (Math.max(0, v) / maxY) * (h - top - bottom);
  const line = (key, color, step) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    hs.forEach((x, i) => {
      if (x[key] < 0) return;
      if (!started) ctx.moveTo(X(i), Y(x[key])), started = true;
      else if (step) ctx.lineTo(X(i), Y(hs[i - 1][key] < 0 ? x[key] : hs[i - 1][key])), ctx.lineTo(X(i), Y(x[key]));
      else ctx.lineTo(X(i), Y(x[key]));
    });
    ctx.stroke();
  };
  line('mean', '#36d6ff', false);
  line('best', '#ffc53d', false);
  line('holdout', '#ff5a8a', true);
  const legend = [['best vs panel', '#ffc53d'], ['mean vs panel', '#36d6ff'], ['best vs holdout', '#ff5a8a']];
  let lx = left;
  ctx.font = '10px ui-monospace, monospace';
  for (const [t, c] of legend) {
    ctx.fillStyle = c;
    ctx.fillRect(lx, 8, 10, 3);
    ctx.fillStyle = '#aab0c8';
    ctx.fillText(t, lx + 14, 10);
    lx += ctx.measureText(t).width + 30;
  }
}

// ---------------- the header

let chipsDirty = true, tickerDirty = true, chartsDirty = true;
const busyHistory = [];

// The strongest member of the list now, by its average against the panel.
function strongest() {
  let top = null;
  for (const m of alive()) if (!top || (m.panelAvg ?? 0) > (top.panelAvg ?? 0)) top = m;
  return top;
}

function drawChips() {
  chipsDirty = false;
  const best = S.bestId !== null ? member(S.bestId) : null;
  $('c-best-name').textContent = best ? best.name : '–';
  $('c-best-name').style.color = best ? hsl(best.hue) : '';
  $('c-best-sub').textContent = best ? `${f1(best.holdout)} holdout · ${f1(best.panelAvg)} panel${best.alive ? '' : ' · left'}` : 'after the first benchmark';
  const top = strongest();
  $('c-top-name').textContent = top ? top.name : '–';
  $('c-top-name').style.color = top ? hsl(top.hue) : '';
  $('c-top-sub').textContent = top ? `${f1(top.panelAvg)} panel${top.holdout >= 0 ? ` · ${f1(top.holdout)} holdout` : ''}` : '';
  $('c-batch').textContent = S.batch >= 0 ? fmtInt(S.batch) : '–';
  $('c-tried').textContent = S.tried ? fmtBig(S.tried) : '–';
  const sp = S.speed;
  $('c-cps').textContent = sp ? sp.candidatesPerSecond.toFixed(1) : '–';
  $('c-rps').textContent = sp ? fmtBig(sp.roundsPerSecond) : '–';
  $('c-ips').textContent = sp ? fmtBig(sp.instructions / sp.seconds) : '–';
  $('c-busy').textContent = sp ? `${(100 * sp.busy).toFixed(0)}% of ${sp.threads}` : '–';
  if (sp) busyHistory.push(sp.busy), busyHistory.length > 60 && busyHistory.shift();
  const c = $('cpu'), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 44, 44);
  const busy = sp ? sp.busy : 0;
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#1c2033';
  ctx.beginPath();
  ctx.arc(22, 22, 17, 0, 7);
  ctx.stroke();
  ctx.strokeStyle = busy > 0.9 ? '#5dff9a' : busy > 0.7 ? '#ffc53d' : '#ff5a8a';
  ctx.beginPath();
  ctx.arc(22, 22, 17, -Math.PI / 2, -Math.PI / 2 + busy * 2 * Math.PI);
  ctx.stroke();
}

function drawTicker() {
  tickerDirty = false;
  $('ticker').innerHTML = S.ticker.map((t) => `<li>${t}</li>`).join('');
}

// ------------------------------------------------------------------ operators and how it works

// What each change does; how often: the start event's changes (42evolve
// --changes), described in renderAbout().
const OP_DOCS = {
  opcode: 'a new opcode for one instruction',
  modifier: 'a new modifier for one instruction',
  'a-mode': 'a new addressing mode for the A operand of one instruction',
  'b-mode': 'a new addressing mode for the B operand of one instruction',
  'a-operand': 'a new A value or reference of one instruction',
  'b-operand': 'a new B value or reference of one instruction',
  mode: 'a new addressing mode for an A or B operand (logs before --changes)',
  operand: 'a new A or B value or reference of one instruction (logs before --changes)',
  org: 'moves the start (ORG) to another instruction',
  replace: 'replaces one instruction with a new random one',
  insert: 'inserts one or more new random instructions',
  delete: 'deletes a block of instructions',
  duplicate: 'copies a block of the warrior to another place in it',
  move: 'moves a block to another place',
  'crossover-insert': 'inserts a block of a second parent',
  'crossover-replace': 'replaces a block with a block of a second parent',
  'related-opcode': 'another opcode of the same family: ADD/SUB, JMZ/JMN/DJN, SEQ/SNE/CMP/SLT, SPL/JMP, MUL/DIV/MOD, DAT/NOP',
  'related-mode': 'another mode of the same family: $ @ *, or < > { }; # becomes $',
  'shared-constant': 'a far value (more than 16 from 0) set to another far value of the warrior, or its negative',
  tune: 'a far value moved by up to 2% of its size (at least 4)',
  reintroduce: 'a warrior pushed off earlier, back as it was',
  random: 'a random warrior (first batch)',
  start: 'a start warrior as it is (--start)',
};

let opsDirty = true, opsWindow = 0; // 0: the whole run, else the last this many batches

function renderOps() {
  opsDirty = false;
  const from = opsWindow ? S.batch - opsWindow + 1 : -Infinity;
  const totals = new Map();
  for (const b of S.opBatches) {
    if (b.batch < from) continue;
    for (const [op, n] of Object.entries(b.ops)) {
      const t = totals.get(op) ?? [0, 0, 0, 0];
      n.forEach((v, i) => { t[i] += v; });
      totals.set(op, t);
    }
  }
  // from the newcomers: lasted 5 batches, change of the panel average against the first parent
  const extra = new Map();
  for (const x of S.w.values()) {
    if (x.kind !== 'member' || x.born < from) continue;
    for (const op of new Set(x.ops.split(' '))) {
      const t = extra.get(op) ?? { old: 0, lasted: 0, gain: 0, compared: 0 };
      if (S.batch - x.born >= 5) {
        t.old++;
        if ((x.died ?? S.batch) - x.born >= 5) t.lasted++;
      }
      const parent = S.w.get(x.parents[0]);
      if (parent?.kind === 'member' && parent.panelAvg !== undefined && x.panelAvg !== undefined) t.gain += x.panelAvg - parent.panelAvg, t.compared++;
      extra.set(op, t);
    }
  }
  const rows = [...totals].sort((a, b) => b[1][0] - a[1][0]);
  if (!S.opBatches.length) {
    $('ops').innerHTML = '<p class="ops-note">This run\'s log has no counts per change: 42evolve writes them since #145 (14th November 2026). The newcomers\' changes are in their cards.</p>';
    return;
  }
  const maxStay = Math.max(1e-9, ...rows.map(([, n]) => n[3] / Math.max(1, n[0])));
  const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '–');
  $('ops').innerHTML = `<div class="ops-toggle">children of each change in
      <button data-window="0" class="${opsWindow ? '' : 'on'}">the whole run</button>
      <button data-window="20" class="${opsWindow === 20 ? 'on' : ''}">the last 20 batches</button></div>
    <table class="ops-table"><tr><th>change</th><th title="children with this change">children</th><th title="share that got past the screen and entered the list">screen</th><th title="share still in the list after their own batch">kept</th><th title="of the children that entered at least 5 batches ago, how many stayed 5 batches or more">5+</th><th title="mean change of the average against the panel, child minus first parent, over the children that entered">Δ</th></tr>
    ${rows.map(([op, n]) => {
      const x = extra.get(op);
      const stay = n[3] / Math.max(1, n[0]);
      const gain = x?.compared ? x.gain / x.compared : null;
      return `<tr title="${esc(OP_DOCS[op] ?? op)}"><td>${esc(op)}</td><td>${n[0].toLocaleString('en-US')}</td><td>${pct(n[2], n[0])}</td>
        <td><span class="bar" style="width:${Math.round((22 * stay) / maxStay)}px"></span>${pct(n[3], n[0])}</td>
        <td>${x?.old ? `${x.lasted}/${x.old}` : '–'}</td>
        <td class="${gain === null ? '' : gain < 0 ? 'neg' : 'pos'}">${gain === null ? '–' : `${gain >= 0 ? '+' : ''}${gain.toFixed(2)}`}</td></tr>`;
    }).join('')}</table>
    <p class="ops-note">A child with several changes counts for each of them. <b>Screen</b>: it scored well enough in the first ${S.start?.params.screenRounds ?? ''} rounds against the panel to play the full matches and enter the list. <b>Kept</b>: it was still in the list after its own batch, so the push-off kept it. <b>5+</b>: of the children that entered 5 or more batches ago, how many stayed 5 batches. <b>Δ</b>: its average against the panel minus the first parent's, for the children that entered. Hover a row for what the change does.</p>`;
}

// The weights of genome_mix_default(), for logs from before --changes.
const DEFAULT_CHANGES = { opcode: 81, modifier: 81, 'a-mode': 54, 'b-mode': 54, 'a-operand': 108, 'b-operand': 108, org: 27, replace: 27,
  insert: 100, delete: 100, duplicate: 70, move: 70, 'crossover-insert': 60, 'crossover-replace': 60 };

function mixText(changes = DEFAULT_CHANGES) {
  const all = Object.entries(changes).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]);
  const total = all.reduce((s, [, w]) => s + w, 0);
  return all.map(([k, w]) => `<b title="${esc(OP_DOCS[k] ?? k)}">${esc(k)}</b> ${((100 * w) / total).toFixed(1)}%`).join(' · ');
}

function renderAbout() {
  const st = S.start;
  if (!st) return;
  const p = st.params, r = st.rules;
  const list = p.list, P = st.panel.length;
  $('about').innerHTML = `
    <h3>The rules</h3><p>'94 Redcode without p-space, core ${r.size}, ${r.cycles.toLocaleString('en-US')} cycles, at most ${r.processes} processes and ${r.length} instructions, distance ${r.distance}. A match is ${p.rounds} rounds; a win is 3 points, a tie 1. Scores are points per 100 rounds: 300 wins every round, 100 ties every round.</p>
    <h3>Opponents</h3><p>From <code>${esc(st.opponents)}</code>: a <b>panel</b> of ${P} hill warriors that every evolved warrior plays${p.rotate ? `; every ${p.rotate} batches the panel warrior that is in longest makes room for another one of the folder` : ' and that never changes'}, and a <b>holdout</b> of ${st.holdout.length} that only the benchmark plays.</p>
    <h3>The list (the hill)</h3><p>${list} evolved warriors. Each has a row of scores against <b>everyone in</b>: the ${P} panel warriors and the other evolved ones. Its <b>push-off value</b> is the average of that row × (the SD-score to the nearest other warrior, panel or evolved)<sup>${p.alpha}</sup>. The SD-score adds up, column by column, how far two rows differ, ${p.sd === 'sum' ? 'over the sum of the columns\' standard deviations (Eq. 6 of Ismael 2025)' : 'each column divided by its standard deviation (the pseudocode of Ismael 2025)'}. When a newcomer makes it ${list + 1}, the lowest value leaves. Strong <i>and</i> different stays; a clone of a strong warrior has distance 0 and goes first. The matrix shows the list by this value.</p>
    <h3>A batch</h3><p>${p.batch} children are bred from the list. Each plays ${p.race && p.race < p.screenRounds ? `${p.race} rounds against each panel warrior, the best ${p.raceKeep} of them the rest of ` : ''}${p.screenRounds} rounds against each panel warrior: the <b>screen</b>. At most ${p.survivors} go on, picked by ${p.select === 'value' ? 'their estimated push-off value (screen score × distance to the nearest warrior in, on the panel columns)' : 'their screen score'}, and only if they reach ${p.screenFactor} × the weakest member's panel average once the list is full. They play the other ${p.rounds - p.screenRounds} rounds against the panel and ${p.rounds} rounds against every member, then enter one by one, each followed by the push-off. Children equal to one of the last 16,384 are skipped.</p>
    <h3>Parents</h3><p>A tournament of two random members: ${p.parents === 'duel' ? 'the one with more points in their match against each other wins (a draw by push-off value)' : 'the higher push-off value wins'}. A crossover takes a second parent the same way. ${p.reintroduce ? `With probability ${p.reintroduce} a child is instead a warrior pushed off earlier, as it was.` : ''}${st.startWarriors?.length ? ` The first batch started from ${st.startWarriors.map((w) => esc(w.name)).join(', ')} (<code>${esc(st.start)}</code>) and mutants of them.` : ' The first batch is random warriors of up to ' + p.initLength + ' instructions.'}</p>
    <h3>Mutation</h3><p>A child gets 1 change, and another one with probability 0.35 each time, up to 6 (1.5 on average). A change is:</p>
    <p>${mixText(st.changes)}. A change that does not fit (an insert at the longest length, ...) is drawn again. A block is 1 instruction, and one more with probability 0.6 each time.</p>
    <p>Operands are <b>references</b> to an instruction of the warrior, kept across inserts and moves, or <b>values</b>. A changed reference points somewhere else (50%), at a neighbour (25%) or becomes a value (25%); a changed value moves by 1 to 4 (35%), becomes a new small value up to ±16 (20%), a far value (20%), its negative (10%), double or half (7%), or a reference (8%). New instructions: operands 40% references, 40% small values, 20% far values${p.fractions ? `; far values are near 1/2, 1/3, 2/3, 1/4 or 3/4 of the core with probability ${p.fractions}` : ''}. Opcodes, modifiers and modes are drawn ${p.prior === 'hill' ? 'as often as in the hill warriors of the folder' : 'uniformly'}.</p>
    <h3>Benchmark</h3><p>Every ${p.benchEvery} batches the member with the best panel average plays the ${st.holdout.length} holdout warriors, ${p.benchRounds} rounds each. The best of those so far is <b>★ best</b> (and <code>best.red</code>).</p>`;
}

// ------------------------------------------------------------------ the card

function listing(code, start) {
  return code.split('\n').filter((l) => l.trim()).map((l) => {
    const m = /^(\s*)([A-Z]{3})(\.[A-Z]+)?(.*)$/.exec(l);
    if (!m) return `<span class="cmt">${esc(l)}</span>`;
    const body = esc(m[4]).replace(/-?\d+/g, (d) => `<span class="num">${d}</span>`);
    return `${m[1]}<span class="op">${m[2]}</span><span class="mod">${m[3] ?? ''}</span>${body}`;
  }).map((l, i) => (start !== null && i === start + 1 ? `<span class="start">${l}</span>` : l)).join('\n');
}

function renderCard() {
  const card = $('card');
  if (selected === null || !S.w.has(selected)) {
    card.hidden = true;
    return;
  }
  const x = S.w.get(selected);
  card.hidden = false;
  const color = x.kind === 'member' ? hsl(x.hue) : '#c8cde0';
  const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const fpBars = S.panel.map((p) => {
    const v = points(resOf(x.id, p));
    return v === null ? '<i style="height:0"></i>' : `<i title="${esc(nameOf(p))}: ${v.toFixed(0)}" style="height:${Math.max(2, (v / 300) * 100)}%;background:${scoreColor(v)}"></i>`;
  }).join('');
  const others = [...alive().filter((m) => m.id !== x.id), ...S.panel.filter((p) => p !== x.id).map(member)];
  if (x.benched) others.push(...x.benched.map(member));
  const rows = others.map((o) => ({ o, r: resOf(x.id, o.id) })).filter((e) => e.r)
    .sort((a, b) => points(b.r) - points(a.r))
    .map(({ o, r }) => `<tr><td><a data-id="${o.id}" style="color:${o.kind === 'member' ? hsl(o.hue) : o.kind === 'holdout' ? '#ff9ab8' : '#aab0c8'}">${esc(o.name)}</a>${o.kind === 'holdout' ? ' <small>holdout</small>' : ''}</td><td class="n">${r.w}/${r.l}/${r.t}</td><td class="n" style="color:${scoreColor(Math.max(120, points(r)))}">${points(r).toFixed(0)}</td><td><button data-battle="${x.id},${o.id}">watch</button></td></tr>`).join('');
  let head;
  if (x.kind === 'member') {
    const parents = x.parents.map(link).join(' ') || 'none (random)';
    head = `<h3 style="color:${color}">${esc(x.name)} <small style="color:#6c7290;font-size:13px">#${x.id}</small></h3>
      ${x.id === S.bestId ? '<div class="sub" style="color:#ffc53d">★ the best against the holdout warriors so far</div>' : ''}
      <div class="sub">born in batch ${x.born}${x.alive ? ', in the list' : `, pushed off in batch ${x.died}`} · ${x.length} instructions · ${esc(x.ops)}</div>
      <div class="stats">${stat('vs panel', f1(x.panelAvg))}${stat('vs holdout', f1(x.holdout))}${stat('push-off value', f1(x.value))}
      ${stat('distance', x.distance?.toFixed(2) ?? '–')}${stat('nearest', x.nearest !== undefined && x.nearest !== null && S.w.has(x.nearest) ? link(x.nearest) : '–')}${stat('screen', `${f1(x.screen)}${x.estimate !== undefined ? ` <small style="color:#7f86a0">est. ${x.estimate.toFixed(0)}</small>` : ''}`)}</div>
      <div class="links">parents: ${parents}</div>
      <h4>Code</h4><pre>${listing(x.code, Number(/ORG\s+(\d+)/.exec(x.code)?.[1] ?? 0))}</pre>`;
  } else {
    head = `<h3 style="color:${color}">${esc(x.name)}</h3><div class="sub">${esc(x.author)} · ${esc(x.file)} · ${{ panel: 'panel', holdout: 'holdout', retired: 'former panel' }[x.kind]} warrior from the hill</div>
      <div class="stats">${stat('vs panel', f1(x.panelAvg))}${stat('push-off value', f1(x.value))}${stat('nearest', x.nearest !== undefined && S.w.has(x.nearest) ? link(x.nearest) : '–')}</div>
      <h4>Source</h4><pre>${esc(x.source)}</pre>`;
  }
  $('card-body').innerHTML = `${head}<h4>Against the panel, warrior by warrior</h4><div class="fp">${fpBars}</div>
    <h4>Matches <small>(wins/losses/ties, points per 100 rounds)</small></h4><table>${rows}</table>`;
}

// ------------------------------------------------------------------ battles

function battleUrl(a, b) {
  const r = resOf(a, b);
  if (!r) return null;
  const first = r.first, second = first === a ? b : a;
  const src = (id) => {
    const x = S.w.get(id);
    return x.kind === 'member' ? `;redcode\n;name ${x.name}\n;author 42evolve\n${x.code}` : x.source;
  };
  const ru = S.start.rules;
  const battle = {
    title: `${nameOf(first)} vs ${nameOf(second)}`,
    rules: { coreSize: ru.size, maxCycles: ru.cycles, maxProcesses: ru.processes, maxLength: ru.length, minDistance: ru.distance },
    seed: r.seed,
    rounds: r.rounds,
    round: 1,
    warriors: [first, second].map((id) => ({ name: nameOf(id), source: src(id) })),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(battle));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `index.html#battle=${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

function openBattle(a, b) {
  const url = battleUrl(a, b);
  if (url) window.open(url, '_blank');
}

// ------------------------------------------------------------------ tooltips and input

function showTip(hv, html) {
  const tip = $('tip');
  tip.innerHTML = html;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(window.innerWidth - r.width - 8, hv.cx + 14)}px`;
  tip.style.top = `${Math.min(window.innerHeight - r.height - 8, hv.cy + 14)}px`;
}
const hideTip = () => { $('tip').hidden = true; };

function select(id) {
  selected = id;
  chartsDirty = true;
  renderCard();
}

function wire() {
  for (const id of ['matrix', 'map', 'lineage', 'progress']) {
    const c = $(id);
    c.addEventListener('mousemove', (e) => {
      const r = c.getBoundingClientRect();
      hover = { canvas: c, x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY, target: hover?.canvas === c ? hover.target : null };
      chartsDirty = true;
    });
    c.addEventListener('mouseleave', () => { hover = null; hideTip(); chartsDirty = true; });
    c.addEventListener('click', () => {
      const t = hover?.target;
      if (!t) return;
      if (t.battle) openBattle(...t.battle);
      else if (t.select !== undefined) select(t.select);
    });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-id]');
    if (a) select(Number(a.dataset.id));
    const b = e.target.closest('button[data-battle]');
    if (b) openBattle(...b.dataset.battle.split(',').map(Number));
  });
  $('card-close').addEventListener('click', () => select(null));
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    for (const x of $('tabs').querySelectorAll('button')) x.classList.toggle('on', x === b);
    for (const t of document.querySelectorAll('.ticker-panel .tab')) t.hidden = !t.classList.contains(b.dataset.tab);
    if (b.dataset.tab === 'tab-ops') renderOps();
    if (b.dataset.tab === 'tab-about') renderAbout();
  });
  $('ops').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-window]');
    if (b) opsWindow = Number(b.dataset.window), renderOps();
  });
  $('c-best').addEventListener('click', () => { if (S.bestId !== null) select(S.bestId); });
  $('c-top').addEventListener('click', () => { const t = strongest(); if (t) select(t.id); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') select(null); });
  let depth = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; $('drop').hidden = false; });
  window.addEventListener('dragleave', () => { if (--depth <= 0) $('drop').hidden = true, depth = 0; });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    depth = 0;
    $('drop').hidden = true;
    const f = e.dataTransfer.files[0];
    if (!f) return;
    source?.close();
    $('live').classList.remove('on');
    load(await f.text());
  });
}

// ------------------------------------------------------------------ data

let source = null;

function load(text) {
  S = fresh();
  selected = null;
  for (const line of text.split('\n')) if (line.trim()) handle(JSON.parse(line));
  // a replayed log does not flare everywhere at once
  for (const x of S.w.values()) x.enteredAt = -1e9;
  renderCard();
}

function connect() {
  const run = new URLSearchParams(location.search).get('run');
  source = new EventSource(run === null ? '/run/events' : `/run/${Number(run)}/events`);
  source.addEventListener('run', (e) => { document.title = `42evolve · ${JSON.parse(e.data).name}`; });
  source.addEventListener('reset', () => { S = fresh(); selected = null; renderCard(); });
  source.onopen = () => $('live').classList.add('on');
  source.onerror = () => $('live').classList.remove('on');
  let lastCard = 0;
  source.onmessage = (e) => {
    handle(JSON.parse(e.data));
    const now = performance.now();
    if (selected !== null && now - lastCard > 1000) lastCard = now, renderCard();
  };
}

let lastMap = 0, lastFrame = 0, lastOps = 0;
function frame(now) {
  ease = 1 - Math.exp(-Math.min(500, now - (lastFrame || now)) / 110);
  lastFrame = now;
  if (S.mapDirty && now - lastMap > 400) lastMap = now, computeMap();
  drawMatrix(now);
  drawMap(now);
  if (chartsDirty) { // the two charts that do not move on their own
    chartsDirty = false;
    drawLineage();
    drawProgress();
  }
  if (chipsDirty) drawChips();
  if (tickerDirty) drawTicker();
  if (opsDirty && !$('ops').hidden && now - lastOps > 1000) lastOps = now, renderOps();
  requestAnimationFrame(frame);
}

async function main() {
  wire();
  new ResizeObserver(() => { chartsDirty = true; }).observe(document.body);
  const log = new URLSearchParams(location.search).get('log');
  if (log) load(await (await fetch(log)).text());
  else connect();
  requestAnimationFrame(frame);
}

window.__evolver = { state: () => S, select, battleUrl }; // for debugging and screenshots
main();
