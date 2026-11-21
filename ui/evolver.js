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

import { assemble, compileMars, createMarsSync } from '../wasm/42mars.js';
import { describe, measureStyle } from '../tools/style.js';
import { kindCounts, progressPoint } from '../tools/progress.js';

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
    spec: new Map(), // --specialists: protected member id -> [{ panel, score, median }]
    specOf: new Map(), // panel id -> its protected member id
    pickKind: new Map(), // --panel-choice kinds: file -> kind of style
    panel: [], // ids
    batch: -1,
    tried: 0,
    history: [], // per batch: { batch, best, mean, holdout }
    speed: null,
    bestHoldout: -1,
    bestId: null, // the best against the holdout warriors so far
    ticker: [],
    ghosts: [], // members that left, fading out of the matrix
    opTotals: new Map(), // change -> [children, evaluated, past the screen, still in after the batch]
    opBatches: [], // per batch: { batch, ops }
    kinds: [], // per batch: { batch, counts }: the members by kind of style
  };
}
let S = fresh();
let matrixHeading = null; // the matrix heading of the page, before a run changed it
let selected = null;
let ease = 0.1; // the share of the way to a target that this frame moves (time-based, see frame())
let hover = null; // { kind, ... } of the canvas under the mouse

const member = (id) => S.w.get(id);
const alive = () => S.slots.filter((id) => id !== null && S.w.get(id).kind === 'member').map(member);
const nameOf = (id) => S.w.get(id)?.name ?? `#${id}`;

// rounds: those the result has (42evolve --stage: fewer until a survivor that stays plays the rest)
function setRes(a, b, w, l, t, seed, first, rounds = w + l + t) {
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

// Families share a color: a child takes its first parent's hue, shifted a bit;
// a new family (42evolve: it plays unlike its first parent) gets a hue of its own.
function hueFor(id, parents, newFamily) {
  const p = parents.length ? S.w.get(parents[0]) : null;
  if (p && p.kind === 'member' && !newFamily) return (p.hue + ((id * 37) % 25) - 12 + 360) % 360;
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
      // the heading as the page has it, then what this run changes in it: one page shows several runs
      $('matrix-sorts').hidden = !!e.params.mapElites; // an archive has no such order
      matrixHeading ??= document.querySelector('.matrix-panel h2').innerHTML;
      document.querySelector('.matrix-panel h2').innerHTML = matrixHeading;
      if (e.params.average === 'panel') $('matrix-average').textContent = 'average score against the panel (--average panel)';
      // the push-off's average: over the panel only with --average panel, which the button then says
      document.querySelector('#matrix-sorts [data-sort="average"]').dataset.label = e.params.average === 'panel' ? 'panel' : 'score';
      renderMatrixSorts();
      if (e.params.crowding) { // the matrix panel shows the archive, no cells
        document.querySelector('.matrix-panel h2').innerHTML = 'Crowding archive <small>a warrior competes with its nearest by SD-score against the panel; one unlike all takes the place of the weaker of the closest pair · rows the archive, best first, columns the panel warriors · click a cell to watch the match</small>';
      } else if (e.params.specialists) {
        document.querySelector('.matrix-panel h2 small').insertAdjacentHTML('beforeend', ' · <span style="color:#ffc53d">◆</span> a protected member, outlined in the column of the panel warrior it is clearly best against');
      } else if (e.params.mapElites) { // the matrix panel shows the archive
        document.querySelector('.matrix-panel h2').innerHTML = 'MAP-Elites archive <small>a cell for each kind of style: rows the copies a warrior makes of its own code, columns its processes and the cells it reads far from home · in each cell the warrior with the best average against the panel (points per 100 rounds) · click a cell for its warrior</small>';
      }
      for (const p of e.panel) S.w.set(p.id, { ...p, kind: 'panel' });
      for (const p of e.holdout) S.w.set(p.id, { ...p, kind: 'holdout' });
      S.panel = e.panel.map((p) => p.id);
      S.slots = S.panel.slice();
      const r = e.rules, p = e.params;
      $('run-info').textContent = `core ${r.size} · cycles ${r.cycles} · length ${r.length} · panel ${p.panel} · holdout ${p.holdout} · list ${p.list} · batch ${p.batch} · ${p.rounds} rounds · SD ${p.sd} · alpha ${p.alpha} · select ${p.select ?? 'screen'} · rotate ${p.rotate ?? 0} · seed ${p.seed}${p.screenMembers ? ` · screen ${p.screenMembers} members, ${p.screenRounds} rounds` : ''}${p.genome === 'gen' ? ` · generators${p.refactor ? `, refactor ${p.refactor}` : ''}` : ''}${p.tiePoints !== undefined && p.tiePoints !== 1 ? ` · a tie ${p.tiePoints}` : ''}${p.minLength ? ` · min length ${p.minLength}` : ''} · 42mars ${e.version}`;
      break;
    }
    case 'panel':
      for (const [a, b, w, l, t, seed] of e.scores) setRes(a, b, w, l, t, seed, a);
      break;
    case 'enter': {
      const x = { id: e.id, kind: 'member', name: e.name ?? `e${e.id}`, code: e.code, gen: e.gen ?? null, refactors: [], parents: e.parents, ops: e.ops, length: e.length, screen: e.screen, estimate: e.estimate, born: e.batch, died: null, alive: true, enteredAt: now, value: null, newFamily: !!e.newFamily, parentDifference: e.parentDifference };
      x.hue = hueFor(e.id, e.parents, x.newFamily);
      x.styleKind = e.style?.kind;
      S.w.set(e.id, x);
      let s = S.slots.indexOf(null, S.panel.length);
      if (s < 0) s = S.slots.push(null) - 1;
      S.slots[s] = e.id;
      for (const [o, w, l, t, seed] of e.scores) setRes(e.id, o, w, l, t, seed, e.id);
      x.opponents = e.scores.map((s) => s[0]);
      x.panelAvg = panelAvg(e.id);
      x.row = null;
      if (!quiet.has(e.id)) tick(`<span class="in">+</span> ${link(e.id)} <b>${f1(x.panelAvg)}</b> vs panel <span style="color:#6c7290">${esc(e.ops)}</span>${x.newFamily ? ` <span class="new-family">new family: ${f1(e.parentDifference)} points from ${link(e.parents[0])}</span>` : ''}`);
      break;
    }
    case 'elite': { // --map-elites: a warrior takes a cell, the one there leaves
      const x = { id: e.id, kind: 'member', name: e.name, code: e.code, parents: e.parents, ops: e.ops, length: e.length, screen: e.screen, born: e.batch, died: null, alive: true, enteredAt: now, value: null, newFamily: !!e.newFamily, cell: e.index, cellXyz: e.cell, style: e.style };
      x.hue = hueFor(e.id, e.parents, x.newFamily);
      x.styleKind = e.style?.kind;
      S.w.set(e.id, x);
      const old = e.replaced ? S.w.get(e.replaced.id) : null;
      if (old) {
        old.alive = false;
        old.died = e.batch;
        S.slots[S.slots.indexOf(old.id)] = e.id;
      } else S.slots.push(e.id);
      for (const [o, w, l, t, seed] of e.scores) setRes(e.id, o, w, l, t, seed, e.id);
      x.panelAvg = panelAvg(e.id);
      S.cells ??= new Map();
      S.cells.set(e.index, e.id);
      const how = !e.rule ? `takes cell ${e.cell.join('·')}${old ? ` from ${link(old.id)} (${f1(e.replaced.avg)})` : ', a new cell'}`
        : e.rule === 'near' ? `beats its nearest ${link(old.id)} (${f1(e.replaced.avg)})`
        : e.rule === 'far' ? `<span class="new-family">unlike all</span>, replaces ${link(old.id)} (${f1(e.replaced.avg)}) of the closest pair`
        : 'a free place';
      tick(`<span class="in">+</span> ${link(e.id)} <b>${f1(x.panelAvg)}</b> vs panel ${how} <span style="color:#6c7290">${esc(e.ops)}</span>`);
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
      tick(`<span class="best">⟳</span> panel: ${link(p.id)} replaces ${esc(old?.name ?? `#${e.out}`)}`);
      break;
    }
    case 'complete': { // --stage: a survivor that stayed played the rest of its rounds
      for (const [o, w, l, t, seed] of e.scores) setRes(e.id, o, w, l, t, seed, e.id);
      const x = S.w.get(e.id);
      if (x) x.panelAvg = panelAvg(e.id);
      break;
    }
    case 'refactor': { // --refactor: a member's generator rewritten in place, its warrior the same
      const x = S.w.get(e.id);
      if (!x) break;
      x.gen = e.gen;
      (x.refactors ??= []).push(`${e.how} (batch ${e.batch})`);
      if (selected === e.id) renderCard();
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
      if (x.born === e.batch) { // did not last its own batch: its matches are not kept (most newcomers; a long run has millions)
        x.rejected = true;
        for (const o of x.opponents ?? []) S.res.delete(`${x.id}:${o}`), S.res.delete(`${o}:${x.id}`);
      }
      delete x.opponents;
      if (!quiet.has(e.id)) tick(`<span class="out">−</span> ${link(e.id)} pushed off, value ${f1(e.value)}, nearest ${link(e.nearest)}`);
      break;
    }
    case 'pick': // the panel picked; --panel-choice kinds also names each one's kind
      for (const p of e.picked) if (p.kind) S.pickKind.set(p.file, p.kind);
      break;
    case 'specialists': { // --specialists: the member protected for each panel warrior
      const spec = new Map(), specOf = new Map();
      for (const [o, m, score, , median] of e.protected) {
        if (!spec.has(m)) spec.set(m, []);
        spec.get(m).push({ panel: o, score, median });
        specOf.set(o, m);
        if (S.specOf.get(o) !== m) tick(`<span class="best">◆</span> ${link(m)} protected: best against ${esc(nameOf(o))}, <b>${f1(score)}</b> where the members' median is ${f1(median)}`);
      }
      S.spec = spec;
      S.specOf = specOf;
      break;
    }
    case 'values':
      for (const [id, avg, distance, nearest, value, pAvg] of e.values) {
        const x = S.w.get(id);
        if (!x) continue;
        Object.assign(x, { avg, distance, nearest, value, panelAvg: pAvg });
      }
      { // the members by kind of style after the batch (tab Kinds)
        const counts = kindCounts(alive().map((m) => m.styleKind));
        if (S.kinds.at(-1)?.batch === e.batch) S.kinds.at(-1).counts = counts;
        else S.kinds.push({ batch: e.batch, counts });
      }
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
      S.history.push({ batch: e.batch, ...progressPoint(pa, S.bestHoldout) });
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
    case 'difference': // --difference on a run that continues: the push-off's SD-score from now on
      if (S.start) S.start.params.difference = e.difference;
      tick(`from batch ${e.batch} the SD-score counts ${e.difference === 'ahead' ? 'only where a warrior scores more (--difference ahead)' : e.difference === 'shape' ? 'every difference less the shift that makes the sum smallest (--difference shape)' : 'every difference (--difference abs)'}`);
      break;
    case 'compacted': // tools/serve.mjs sent a long history without the warriors that left
      tick(`history compacted: ${fmtInt(e.dropped)} of ${fmtInt(e.lines)} events not sent, ${fmtInt(e.gone)} warriors that left are not shown (tools/serve.mjs --full sends all)`);
      // the progress of every batch, computed by the server from the whole
      // history: the points drawn from the compacted one miss the warriors that left
      if (e.history) S.history = e.history.map(([batch, best, mean, holdout]) => ({ batch, best, mean, holdout }));
      if (e.kinds) S.kinds = e.kinds.map(([batch, counts]) => ({ batch, counts })); // the same for the tab Kinds
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

// --map-elites: the archive as a grid instead of the matrix. Rows: copies of
// its own code; columns: processes, within each the cells read far from home.
// A cell's color is its warrior's average against the panel.
const GRID_ROWS = ['copies <20', '20–199', '200–599', '600+'];
const GRID_TASKS = ['1 process', '2–49', '50–249', '250+'];
const GRID_READ = ['<50', '<300', '300+'];
function drawGrid(now) {
  const canvas = $('matrix');
  const { ctx, w, h } = fit(canvas);
  const crowd = !!S.start.params.crowding; // no cells: only the matrix of the archive
  const left = 92, top = crowd ? -12 : 44, cw = (w - left - 10) / 12, ch = crowd ? 0 : Math.min(56, (h * 0.42 - top) / 4);
  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7f86a0';
  if (!crowd) {
    GRID_TASKS.forEach((t, i) => ctx.fillText(t, left + i * 3 * cw + 4, 12));
    ctx.fillText('reads', 6, 30);
    ctx.fillText('processes', 6, 12);
    for (let c = 0; c < 12; c++) ctx.fillText(GRID_READ[c % 3], left + c * cw + 3, 30);
    GRID_ROWS.forEach((r, i) => ctx.fillText(r, 6, top + i * ch + ch / 2));
  }
  const hv = mouseOf(canvas);
  if (hv) hv.target = null; // set again below, for what is under the mouse now
  let target = null;
  for (let index = 0; index < (crowd ? 0 : 48); index++) {
    const row = Math.floor(index / 12), col = index % 12;
    const x = left + col * cw, y = top + row * ch;
    const id = S.cells?.get(index), m = id !== undefined ? S.w.get(id) : null;
    ctx.fillStyle = m ? scoreColor(m.panelAvg ?? 0) : '#0d1020';
    ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
    if (m) {
      const age = Math.max(0, now - (m.enteredAt ?? 0));
      if (age < 900) { // softly: a list changes every few seconds
        ctx.fillStyle = `rgba(255,255,255,${0.2 * Math.exp(-age / 300)})`;
        ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      }
      ctx.fillStyle = (m.panelAvg ?? 0) > 180 ? '#10131f' : '#e8ebf5';
      ctx.font = `bold ${cw < 46 ? 11 : 12}px ui-monospace, monospace`;
      ctx.fillText(cw < 46 ? String(Math.round(m.panelAvg ?? 0)) : f1(m.panelAvg), x + 4, y + ch / 2 - 7); // narrow cells: no decimal
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(m.name.slice(0, Math.max(4, Math.floor(cw / 6))), x + 5, y + ch / 2 + 8);
      if (selected === m.id || m.id === S.bestId) {
        ctx.strokeStyle = selected === m.id ? '#ffc53d' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
      }
      if (hv && hv.x >= x && hv.x < x + cw && hv.y >= y && hv.y < y + ch) target = m;
    }
    ctx.font = '10px ui-monospace, monospace';
  }
  // below the grid: the cells' warriors (best first) against each panel
  // warrior, a cell per match, as the matrix of the list; a click watches it
  const ms = alive().sort((a, b) => (b.panelAvg ?? 0) - (a.panelAvg ?? 0));
  const panel = S.panel.map(member).sort((a, b) => (b.panelAvg ?? 0) - (a.panelAvg ?? 0));
  const mTop = top + 4 * ch + 34, rowH = Math.max(1, Math.min(14, (h - mTop - 8) / Math.max(1, ms.length)));
  const names = rowH >= 9, mLeft = names ? 150 : 22, colW = Math.max(1, (w - mLeft - 10) / Math.max(1, panel.length));
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillStyle = '#7f86a0';
  ctx.fillText(`the warriors of the ${crowd ? 'archive' : 'cells'}, best first, against the ${panel.length} panel warriors · click a cell to watch the match`, 6, mTop - 14);
  const key = `${S.version}:${panel.length}`;
  matrix.cells = [];
  ms.forEach((m, i) => {
    const y = mTop + i * rowH;
    if (m.cellKey !== key) m.cellKey = key, m.cellColors = panel.map((o) => (resOf(m.id, o.id) ? scoreColor(points(resOf(m.id, o.id))) : null));
    ctx.fillStyle = selected === m.id ? '#ffc53d' : hsl(m.hue);
    if (names) {
      ctx.font = `${selected === m.id ? 'bold ' : ''}10px ui-monospace, monospace`;
      ctx.fillText(`${f1(m.panelAvg)} ${m.name}`.slice(0, 22), 6, y + rowH / 2);
    } else ctx.fillRect(4, y, 12, Math.max(1, rowH - (rowH >= 4 ? 1 : 0)));
    panel.forEach((o, j) => {
      const c = m.cellColors[j];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(mLeft + j * colW, y, Math.max(1, colW - (colW >= 4 ? 1 : 0)), Math.max(1, rowH - (rowH >= 4 ? 1 : 0)));
    });
    if (hv && hv.y >= y && hv.y < y + rowH) {
      if (hv.x < mLeft) target = target ?? m;
      else {
        const j = Math.floor((hv.x - mLeft) / colW);
        if (j >= 0 && j < panel.length && resOf(m.id, panel[j].id)) {
          const r = resOf(m.id, panel[j].id);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(mLeft + j * colW - 0.5, y - 0.5, colW, rowH);
          hv.target = { battle: [m.id, panel[j].id] };
          showTip(hv, `<b>${esc(m.name)}</b> vs <b>${esc(nameOf(panel[j].id))}</b><br>${r.w} wins · ${r.l} losses · ${r.t} ties<br>${f1(points(r))} points per 100 rounds<br><span style="color:#7f86a0">seed ${r.seed} · click to watch</span>`);
          return;
        }
      }
    }
  });
  if (hv && !hv.target?.battle) {
    hv.target = target ? { select: target.id } : null;
    if (target) showTip(hv, warriorTip(target.id));
    else hideTip();
  }
}

// The order of the matrix, by a click on the buttons above it (again: turned
// around). The evolved warriors, rows and their columns alike: by push-off
// value, by its average, by the SD-score to the nearest. The panel columns:
// by the panel warrior's own strength, by the evolved warriors' average
// against it, by the standard deviation of their scores against it.
const MATRIX_SORTS = { rows: ['value', 'average', 'row', 'distance'], cols: ['strength', 'score', 'spread'] };
let matrixSort = { rows: 'value', rowsDir: -1, cols: 'strength', colsDir: -1 };
try {
  const m = JSON.parse(localStorage.getItem('evolver-matrix-sort') ?? 'null');
  if (m && MATRIX_SORTS.rows.includes(m.rows) && MATRIX_SORTS.cols.includes(m.cols)) matrixSort = { rows: m.rows, rowsDir: m.rowsDir > 0 ? 1 : -1, cols: m.cols, colsDir: m.colsDir > 0 ? 1 : -1 };
} catch {}

function renderMatrixSorts() {
  for (const b of document.querySelectorAll('#matrix-sorts button')) {
    const on = matrixSort[b.dataset.axis] === b.dataset.sort;
    b.classList.toggle('on', on);
    b.dataset.label ??= b.textContent;
    b.textContent = `${b.dataset.label}${on ? (matrixSort[`${b.dataset.axis}Dir`] > 0 ? ' ↑' : ' ↓') : ''}`;
  }
}

// Of each panel warrior's column: the mean and the standard deviation of the
// evolved warriors' points against it; once per update.
function panelColumns() {
  if (S.columnsOf !== S.version) {
    S.columnsOf = S.version;
    const ms = alive();
    S.columns = new Map(S.panel.map((p) => {
      const xs = ms.map((m) => points(resOf(m.id, p))).filter((x) => x !== null);
      const mean = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
      return [p, { score: mean, spread: xs.length ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) : 0 }];
    }));
  }
  return S.columns;
}

// Of each evolved warrior: its mean points over every cell of its row, the
// other evolved warriors and the panel, what the colors of the row show
// (with --average panel the push-off's average is over the panel only); once
// per update.
function rowMeans() {
  if (S.rowsOf !== S.version) {
    S.rowsOf = S.version;
    const ms = alive(), others = [...ms.map((m) => m.id), ...S.panel];
    S.rowMeans = new Map(ms.map((m) => {
      let sum = 0, n = 0;
      for (const o of others) {
        const x = o === m.id ? null : points(resOf(m.id, o));
        if (x !== null) sum += x, n++;
      }
      return [m.id, n ? sum / n : -1];
    }));
  }
  return S.rowMeans;
}

function drawMatrix(now) {
  if (S.start?.params?.mapElites) return drawGrid(now);
  const canvas = $('matrix');
  const { ctx, w, h } = fit(canvas);
  if (!S.start) return;
  const rows = matrixSort.rows === 'row' ? rowMeans() : null;
  const rowKey = { value: (m) => m.value ?? -1, average: (m) => m.avg ?? -1, row: (m) => rows.get(m.id) ?? -1, distance: (m) => m.distance ?? -1 }[matrixSort.rows];
  const ms = alive().sort((a, b) => matrixSort.rowsDir * (rowKey(a) - rowKey(b)) || a.id - b.id);
  const columns = matrixSort.cols === 'strength' ? null : panelColumns();
  const colKey = columns ? (p) => columns.get(p.id)[matrixSort.cols] : (p) => p.panelAvg ?? 0;
  const panel = S.panel.map(member).sort((a, b) => matrixSort.colsDir * (colKey(a) - colKey(b)) || a.id - b.id);
  ms.forEach((m, i) => {
    if (m.row === null || m.row === undefined) m.row = now - m.enteredAt < 2000 ? ms.length : i; // a newcomer slides in from below
    m.row += (i - m.row) * ease;
  });
  S.ghosts = S.ghosts.filter((g) => now - g.leftAt < 900);
  ctx.font = 'bold 11px ui-monospace, monospace';
  const top = 26, gap = 10;
  // a list of 100 (--list) still fits: thin cells without gaps, names only while rows are high enough
  const ch = Math.max(1, Math.min(36, (h - top - 10) / Math.max(8, ms.length)));
  const names = ch >= 9; // a list of 80 on a screen 1080 high: rows of about 10, names in a smaller font
  const labelW = names ? Math.min(230, Math.max(74, ...[...ms, ...S.ghosts].map((m) => ctx.measureText(`★ ${m.name}`).width + (S.start.params.specialists ? 42 : 28)))) : 22;
  const cols = ms.length + panel.length;
  const cw = Math.max(1, (w - labelW - gap - 10) / Math.max(1, cols));
  const cg = cw >= 4 ? 1 : 0, rg = ch >= 4 ? 1 : 0;
  const colX = (i) => labelW + (i < ms.length ? i * cw : ms.length * cw + gap + (i - ms.length) * cw);
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillStyle = '#7f86a0';
  ctx.textBaseline = 'middle';
  ctx.fillText('evolved', labelW, 10);
  const px = labelW + ms.length * cw + gap, ptext = `panel (${panel.length} hill warriors)`;
  ctx.fillText(ctx.measureText(ptext).width < w - px ? ptext : 'panel', px, 10);
  // column marks in the warriors' colors
  ms.forEach((m, i) => {
    ctx.fillStyle = hsl(m.hue);
    ctx.fillRect(colX(i) + cg, top - 7, Math.max(1, cw - 2 * cg), 3);
  });
  matrix.cells = [];
  matrix.rows = [];
  const others = [...ms, ...panel];
  const columnsKey = `${S.version}:${others.length}:${others[0]?.id}:${matrixSort.rows}${matrixSort.rowsDir}${matrixSort.cols}${matrixSort.colsDir}`;
  const drawRow = (m, y, alpha) => {
    ctx.globalAlpha = alpha;
    const sel = selected === m.id;
    ctx.fillStyle = sel ? '#ffc53d' : hsl(m.hue);
    if (names || sel) {
      ctx.beginPath();
      ctx.arc(10, y + ch / 2, 4, 0, 7);
      ctx.fill();
      ctx.fillStyle = sel ? '#ffc53d' : '#dfe3f0';
      ctx.font = `${sel ? 'bold ' : ''}${Math.min(11, Math.max(8, Math.floor(ch)))}px ui-monospace, monospace`; // smaller in low rows
      ctx.fillText(m.id === S.bestId ? `★ ${m.name}` : m.name, 20, y + ch / 2);
      if (S.spec.has(m.id)) { // --specialists: a protected member
        ctx.fillStyle = '#ffc53d';
        ctx.fillText('◆', labelW - 14, y + ch / 2);
      }
    } else {
      ctx.fillRect(4, y, 12, Math.max(1, ch - rg)); // the family's color, no room for the name
      if (S.spec.has(m.id)) { // --specialists: a protected member
        ctx.fillStyle = '#ffc53d';
        ctx.fillRect(17, y, 4, Math.max(1, ch - rg));
      }
    }
    matrix.rows.push({ id: m.id, y, h: ch });
    // the cells' colors once per update (columnsKey), not per frame: with a
    // list of 90 a frame has 10,000 cells
    if (m.cellKey !== columnsKey) m.cellKey = columnsKey, m.cellColors = others.map((o) => (o.id === m.id ? '#05060a' : resOf(m.id, o.id) ? scoreColor(points(resOf(m.id, o.id))) : null));
    for (let j = 0; j < others.length; j++) {
      const o = others[j];
      const x = colX(j);
      const color = m.cellColors[j];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cw - cg, ch - rg);
      if (o.id === m.id) continue;
      // a fresh row and column glow
      const age = Math.max(0, Math.min(now - (m.enteredAt ?? 0), now - (o.enteredAt ?? 0)));
      if (age < 900) { // softly: a list changes every few seconds
        ctx.fillStyle = `rgba(255,255,255,${0.2 * Math.exp(-age / 300)})`;
        ctx.fillRect(x, y, cw - cg, ch - rg);
      }
      matrix.cells.push({ x, y, w: cw, h: ch, a: m.id, b: o.id });
    }
    for (const { panel: o } of S.spec.get(m.id) ?? []) { // the cell it is protected for
      const j = others.findIndex((x) => x.id === o);
      if (j < 0) continue;
      ctx.strokeStyle = '#ffc53d';
      ctx.lineWidth = 2;
      ctx.strokeRect(colX(j) + 0.5, y + 0.5, Math.max(2, cw - cg - 1), Math.max(2, ch - rg - 1));
    }
    ctx.globalAlpha = 1;
  };
  for (const g of S.ghosts) drawRow(g, top + g.row * ch, Math.max(0, 1 - (now - g.leftAt) / 900));
  for (const m of ms) drawRow(m, top + m.row * ch, 1);
  // the selected warrior: its row (its matches) and its column (the matches
  // of the others against it) framed
  const si = others.findIndex((o) => o.id === selected);
  if (si >= 0) {
    const right = colX(others.length - 1) + cw - cg, bottom = top + ms.length * ch;
    const m = si < ms.length ? ms[si] : null, ry = m ? top + m.row * ch : 0, cx = colX(si);
    ctx.strokeStyle = '#ffc53d';
    ctx.lineWidth = 1.5;
    if (m) ctx.strokeRect(1.5, ry - 1, right, ch - rg + 2);
    ctx.strokeRect(cx - 1, top - 9, cw - cg + 2, bottom - top + 10);
  }
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
  if (x.kind !== 'member') {
    const kind = S.pickKind.get(x.file), sp = S.specOf.get(id);
    return `<b>${esc(x.name)}</b> by ${esc(x.author)}<br>${f1(x.panelAvg)} against the panel${kind ? `<br>${esc(kind)}` : ''}${sp !== undefined ? `<br><span style="color:#ffc53d">◆</span> best against it: ${esc(nameOf(sp))}` : ''}`;
  }
  if (x.cell !== undefined) return `<b style="color:${hsl(x.hue)}">${esc(x.name)}</b> #${x.id} · batch ${x.born}${x.alive ? '' : ` to ${x.died}`}<br>${f1(x.panelAvg)} vs panel · cell ${x.cellXyz.join('·')}<br>${esc(x.style?.kind ?? '')}${x.holdout >= 0 ? `<br>holdout ${f1(x.holdout)}` : ''}`;
  const sp = (S.spec.get(id) ?? []).map((s) => `<br><span style="color:#ffc53d">◆</span> protected: best against ${esc(nameOf(s.panel))}, ${f1(s.score)} (median ${f1(s.median)})`).join('');
  return `<b style="color:${hsl(x.hue)}">${esc(x.name)}</b> #${x.id} · batch ${x.born}${x.alive ? '' : ` to ${x.died}`}<br>${f1(x.panelAvg)} vs panel · value ${f1(x.value)}<br>nearest ${esc(nameOf(x.nearest))} at ${x.distance?.toFixed(2) ?? '–'}${x.holdout >= 0 ? `<br>holdout ${f1(x.holdout)}` : ''}${sp}`;
}

// ---------------- the lineage

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

// The lines of a selected warrior: edges [from parent, to child, crossover?]
// of its ancestors and of its descendants.
function lineOf(id, all) {
  const up = [], down = [], inLine = new Set([id]);
  const seen = new Set();
  const walkUp = (x) => {
    if (seen.has(x)) return;
    seen.add(x);
    const w = S.w.get(x);
    if (!w || w.kind !== 'member') return;
    w.parents.forEach((p, k) => {
      const pw = S.w.get(p);
      if (!pw || pw.kind !== 'member') return;
      up.push([pw, w, k > 0]);
      inLine.add(p);
      walkUp(p);
    });
  };
  walkUp(id);
  const children = new Map();
  for (const x of all) x.parents.forEach((p, k) => (children.get(p) ?? children.set(p, []).get(p)).push([x, k > 0]));
  const queue = [id], done = new Set([id]);
  while (queue.length) {
    const p = queue.shift();
    for (const [c, cross] of children.get(p) ?? []) {
      down.push([S.w.get(p), c, cross]);
      inLine.add(c.id);
      if (!done.has(c.id)) done.add(c.id), queue.push(c.id);
    }
  }
  return { up, down, inLine };
}

function drawLineage() {
  const canvas = $('lineage');
  const { ctx, w, h } = fit(canvas);
  if (!S.start) return;
  // without the ones pushed off in their own batch: most newcomers, never a parent
  const all = [...S.w.values()].filter((x) => x.kind === 'member' && !x.rejected);
  const left = 36, right = 10, top = 10, bottom = 22;
  const maxB = Math.max(1, S.batch + 1);
  const maxY = Math.max(100, Math.ceil(Math.max(0, ...all.map((x) => x.panelAvg ?? 0)) / 50) * 50);
  const X = (x) => left + ((x.born + ((x.id * 0.618) % 1) * 0.8) / maxB) * (w - left - right);
  const Y = (v) => h - bottom - (v / maxY) * (h - top - bottom);
  axes(ctx, w, h, left, right, top, bottom, maxY, maxB, 'batch');
  const sel = selected !== null && S.w.get(selected)?.kind === 'member' ? selected : null;
  const line = sel !== null ? lineOf(sel, all) : null;
  const edge = (p, c, color, width, dashed) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(X(p), Y(p.panelAvg ?? 0));
    ctx.lineTo(X(c), Y(c.panelAvg ?? 0));
    ctx.stroke();
  };
  ctx.setLineDash([]); // a crossover edge leaves the dash set: the rings below were dashed
  const hv = mouseOf(canvas);
  let near = null, nearD = 10;
  for (const x of all) {
    const px = X(x), py = Y(x.panelAvg ?? 0);
    const dim = line && !line.inLine.has(x.id);
    ctx.fillStyle = dim ? hsl(x.hue, 30, 40, 0.15) : x.alive ? hsl(x.hue, 95, 65) : hsl(x.hue, 60, 50, x.rejected ? 0.15 : 0.45);
    ctx.beginPath();
    ctx.arc(px, py, x.alive ? 3.5 : 2, 0, 7);
    ctx.fill();
    if (x.newFamily && !dim) { // a new family starts here
      ctx.strokeStyle = hsl(x.hue, 95, 70, x.alive ? 0.95 : 0.6);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(px, py, 6.5, 0, 7);
      ctx.stroke();
    }
    if (hv) {
      const d = Math.hypot(hv.x - px, hv.y - py);
      if (d < nearD) nearD = d, near = x;
    }
  }
  if (line) {
    for (const [p, c, cross] of line.down) edge(p, c, cross ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.85)', 1.3, cross);
    for (const [p, c, cross] of line.up) edge(p, c, cross ? '#5fd7ff' : '#ffc53d', cross ? 1.4 : 1.9, cross);
    ctx.setLineDash([]);
    const x = S.w.get(sel), px = X(x), py = Y(x.panelAvg ?? 0);
    ctx.fillStyle = '#ffc53d';
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, 7);
    ctx.stroke();
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    const label = x.name, tw = ctx.measureText(label).width;
    const lx = px + 12 + tw < w - right ? px + 12 : px - 12 - tw;
    ctx.fillStyle = 'rgba(5,6,10,0.75)';
    ctx.fillRect(lx - 3, py - 8, tw + 6, 16);
    ctx.fillStyle = '#ffc53d';
    ctx.fillText(label, lx, py);
  }
  ctx.setLineDash([]);
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

// The kinds of style of the members, batch by batch (tab Kinds), as shares
// stacked from the bottom: what the list is made of, and when it changes.
const KINDS = [
  ['writes fields', 'writes fields (clears, loops)', '#ffb347'],
  ['reads far cells', 'scanners', '#5fd7ff'],
  ['throws copies', 'stones, clears', '#b98cff'],
  ['copies itself', 'papers', '#8be3a8'],
  ['runs copies', 'imps, moving stones', '#ff9ab8'],
  ['damages by increments', 'damage by increments', '#ffd166'],
  ['writes little', 'write little', '#6c7290'],
  ['', 'not measured', '#3a3f58'],
];
function kindOf(k) { // the index in KINDS, the last when the style is not known
  const i = KINDS.findIndex(([p]) => p && (k ?? '').startsWith(p));
  return i < 0 ? KINDS.length - 1 : i;
}

function drawKinds() {
  const canvas = $('kinds');
  const { ctx, w, h } = fit(canvas);
  const ks = S.kinds;
  $('kinds-legend').innerHTML = KINDS.map(([, label, c]) => `<span><i style="background:${c}"></i>${label}</span>`).join('');
  if (ks.length < 2) return;
  const left = 30, right = 8, top = 6, bottom = 16;
  const shares = ks.map(({ counts }) => {
    const v = new Array(KINDS.length).fill(0);
    let n = 0;
    for (const [k, c] of Object.entries(counts)) v[kindOf(k)] += c, n += c;
    return v.map((c) => (n ? c / n : 0));
  });
  const X = (i) => left + (i / (ks.length - 1)) * (w - left - right);
  const Y = (f) => top + (1 - f) * (h - top - bottom);
  const base = new Array(ks.length).fill(0);
  for (let k = 0; k < KINDS.length; k++) {
    ctx.fillStyle = KINDS[k][2];
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ks.forEach((_, i) => (i ? ctx.lineTo(X(i), Y(base[i] + shares[i][k])) : ctx.moveTo(X(i), Y(base[i] + shares[i][k]))));
    for (let i = ks.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(base[i]));
    ctx.fill();
    ks.forEach((_, i) => { base[i] += shares[i][k]; });
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#7f86a0';
  ctx.font = '10px ui-monospace, monospace';
  for (const f of [0, 0.5, 1]) ctx.fillText(`${f * 100}%`, 2, Y(f) + 3);
  ctx.fillText(`batch ${ks[0].batch}`, left, h - 3);
  const last = `batch ${ks.at(-1).batch}`;
  ctx.fillText(last, w - right - ctx.measureText(last).width, h - 3);
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
  // both chips in the same order, panel then holdout
  $('c-best-sub').textContent = best ? `${f1(best.panelAvg)} panel · ${f1(best.holdout)} holdout${best.alive ? '' : ' · left'}` : 'after the first benchmark';
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
  // a run that writes no more events (/runs says so) uses no cores: its last speed is history
  const stopped = runs.some((x) => x.index === current && !x.running);
  $('c-busy').textContent = stopped ? 'stopped' : sp ? `${(100 * sp.busy).toFixed(0)}% of ${sp.threads}` : '–';
  if (sp) busyHistory.push(sp.busy), busyHistory.length > 60 && busyHistory.shift();
  const c = $('cpu'), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 44, 44);
  const busy = sp && !stopped ? sp.busy : 0;
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
    <table class="ops-table"><tr><th>change</th><th title="children with this change">children</th><th title="share that got past the screen and entered the list">screen</th><th title="share still in the list after their own batch">kept</th><th></th><th title="of the children that entered at least 5 batches ago, how many stayed 5 batches or more">5+</th><th title="mean change of the average against the panel, child minus first parent, over the children that entered">Δ</th></tr>
    ${rows.map(([op, n]) => {
      const x = extra.get(op);
      const stay = n[3] / Math.max(1, n[0]);
      const gain = x?.compared ? x.gain / x.compared : null;
      return `<tr title="${esc(OP_DOCS[op] ?? op)}"><td>${esc(op)}</td><td>${n[0].toLocaleString('en-US')}</td><td>${pct(n[2], n[0])}</td>
        <td>${pct(n[3], n[0])}</td><td class="ops-track"><span class="ops-bar" style="width:${Math.round((28 * stay) / maxStay)}px"></span></td>
        <td>${x?.old ? `${x.lasted}/${x.old}` : '–'}</td>
        <td class="${gain === null ? '' : gain < 0 ? 'neg' : 'pos'}">${gain === null ? '–' : `${gain >= 0 ? '+' : ''}${gain.toFixed(2)}`}</td></tr>`;
    }).join('')}</table>
    <p class="ops-note">A child with several changes counts for each of them. <b>Screen</b>: it scored well enough in the first ${S.start?.params.screenRounds ?? ''} rounds against the panel to play the full matches and enter the list. <b>Kept</b>: it was still in the list after its own batch, so the push-off kept it; the green bar compares the kept shares, the longest bar is the change whose children were kept most often. <b>5+</b>: of the children that entered 5 or more batches ago, how many stayed 5 batches. <b>Δ</b>: its average against the panel minus the first parent's, for the children that entered. Hover a row for what the change does.</p>`;
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
  const opp = p.screenMembers ? `panel warrior and ${p.screenMembers} members of the list, drawn anew each batch` : 'panel warrior';
  $('about').innerHTML = `
    <h3>The rules</h3><p>'94 Redcode without p-space, core ${r.size}, ${r.cycles.toLocaleString('en-US')} cycles, at most ${r.processes} processes and ${r.length} instructions, distance ${r.distance}. A match is ${p.rounds} rounds; a win is 3 points, a tie 1. Scores are points per 100 rounds: 300 wins every round, 100 ties every round.</p>
    <h3>Opponents</h3><p>From <code>${esc(st.opponents)}</code>: a <b>panel</b> of ${P} hill warriors${st.panelFiles ? ` (chosen: ${esc(st.panelFiles.split(',').join(', '))})` : ''} that every evolved warrior plays${p.rotate ? `; every ${p.rotate} batches the panel warrior that is in longest makes room for another one of the folder` : ' and that never changes'}, and a <b>holdout</b> of ${st.holdout.length} that only the benchmark plays.</p>
    <h3>The list (the hill)</h3><p>${list} evolved warriors. Each has a row of scores against <b>everyone in</b>: the ${P} panel warriors and the other evolved ones. ${p.pushoff?.startsWith('pareto') ? `With <code>--pushoff ${p.pushoff}</code> who leaves is decided by NSGA-II on ${p.pushoff === 'pareto-age' ? 'three objectives: the average against the panel, the average against the other evolved warriors, and the age of the warrior\'s line (a line starts with a warrior without parents in the list and with a child that plays unlike its first parent, a new family; other children continue the older line of their parents)' : p.pushoff === 'pareto-sd' ? 'three objectives: the average against the panel, the average against the other evolved warriors, and the SD-score to the nearest other warrior (how differently it plays' + (p.difference === 'shape' ? ', once one row is shifted by the constant that brings the two closest, so that strength alone does not make a warrior far' : p.difference === 'ahead' ? ', counted only where it scores more' : '') + ')' : 'two objectives: the average against the panel and the average against the other evolved warriors'}. The warriors nobody beats on all of them are the first front, those only the first front beats the second, and so on; within a front the most crowded (the smallest gaps to its neighbours on the objectives) counts least.${p.clear > 0 ? ` With <code>--clear ${p.clear}</code> (clearing) a warrior whose SD-score to a stronger one (by the average against everyone) is below ${p.clear} goes behind all the fronts of the others, so a near copy of a strong warrior leaves first.` : ''} Its <b>value</b> is 10 × (fronts − front) + crowding: when a newcomer makes it ${list + 1}, the most crowded of the last front leaves. The matrix shows the list by this value.` : `Its <b>push-off value</b> is ${p.average === 'panel' ? 'the average of its scores against the panel' : 'the average of that row'} × (the SD-score to the nearest other warrior, panel or evolved)<sup>${p.alpha}</sup>. The SD-score adds up, column by column${p.diversity === 'panel' ? ' over the panel columns only' : ''}, ${p.difference === 'ahead' ? 'how far the warrior is ahead of the other (a column where it scores less counts nothing, so a warrior that someone nearby matches or beats everywhere has distance 0)' : p.difference === 'shape' ? 'how far two rows differ once one is shifted by the constant that brings them closest (a warrior that is only uniformly weaker than another has distance 0: the distance says against whom it does relatively better, not how strong it is)' : 'how far two rows differ'}, ${p.sd === 'sum' ? 'over the sum of the columns\' standard deviations (Eq. 6 of Ismael 2025)' : 'each column divided by its standard deviation (the pseudocode of Ismael 2025)'}. When a newcomer makes it ${list + 1}, the lowest value leaves. Strong <i>and</i> different stays; a clone of a strong warrior has distance 0 and goes first. The matrix shows the list by this value.`}</p>
    <h3>A batch</h3><p>${p.batch} children are bred from the list. Each plays ${p.race && p.race < p.screenRounds ? `${p.race} rounds against each ${opp}, the best ${p.raceKeep} of them the rest of ` : ''}${p.screenRounds} rounds against each ${opp}: the <b>screen</b>. At most ${p.survivors} go on, picked by ${p.select === 'value' ? 'their estimated push-off value (screen score × distance to the nearest warrior in, on the panel columns)' : 'their screen score'}, and only if they reach ${p.screenFactor} × the weakest member's average against the same ${p.screenMembers ? 'opponents' : 'panel'} once the list is full. ${p.stage && p.stage < p.rounds ? `They play ${p.stage} rounds against everyone in and enter one by one with those results. The push-off on everyone's first ${p.stage} rounds (the same noise for all) sends a newcomer among the 8 weakest away at once; every other one first plays the rest of its ${p.rounds} rounds, and the push-off on the whole results decides.` : `They play the other ${p.rounds - p.screenRounds} rounds against the panel and ${p.rounds} rounds against every member, then enter one by one, each followed by the push-off.`} Children equal to one of the last 16,384 are skipped.</p>
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
    return `<span class="op">${m[2]}</span><span class="mod">${m[3] ?? ''}</span>${body}`; // without the indent: the column is narrow
  }).map((l, i) => (start !== null && i === start + 1 ? `<span class="start">${l}</span>` : l)).join('\n');
}

// A generator (--genome gen, docs/evolver-gen.md) as 42gen prints it: the
// words of the language, labels, constants and the loop and argument names
// set apart from the instructions.
function genListing(text) {
  const expr = (s) => {
    let out = '', at = 0;
    for (const m of s.matchAll(/([A-Za-z_]\w*)(\.len)?|(-?\d+)/g)) {
      const [all, name, len, num] = m;
      out += esc(s.slice(at, m.index));
      at = m.index + all.length;
      if (num !== undefined) out += `<span class="num">${num}</span>`;
      else if (/^(c\d+|[ijkxy])$/.test(name)) out += `<span class="var">${name}</span>`;
      else out += name === 'CORESIZE' ? all : `<span class="lbl">${esc(name)}</span>${len ?? ''}`;
    }
    return out + esc(s.slice(at));
  };
  return text.split('\n').filter((l) => l.trim()).map((l) => {
    const m = /^(\w+:)?(\s*)(.*)$/.exec(l);
    const label = m[1] ? `<span class="lbl">${esc(m[1])}</span>` : '';
    // compact for the narrow column: a label column of 4 instead of 8, the nesting kept, one space after a word
    const column = (m[1]?.length ?? 0) + m[2].length, nest = Math.max(0, column - 8);
    const pad = column ? ' '.repeat(Math.max(1, 4 - (m[1]?.length ?? 0)) + nest) : '';
    const rest = m[3].replace(/^([A-Z]{3}(?:\.[A-Z]+)?|repeat|org)\s+/, '$1 ');
    let body;
    let w;
    if ((w = /^(repeat|def|end|org)\b(.*)$/.exec(rest))) body = `<span class="kw">${w[1]}</span>${expr(w[2])}`;
    else if ((w = /^(c\d+)(\s*=\s*)(.*)$/.exec(rest))) body = `<span class="var">${w[1]}</span>${w[2]}${expr(w[3])}`;
    else if ((w = /^([A-Z]{3})(\.[A-Z]+)?(.*)$/.exec(rest))) body = `<span class="op">${w[1]}</span><span class="mod">${w[2] ?? ''}</span>${expr(w[3])}`;
    else if ((w = /^(\w+)(\(.*)$/.exec(rest))) body = `<span class="call">${esc(w[1])}</span>${expr(w[2])}`;
    else body = expr(rest);
    return `${label}${pad}${body}`;
  }).join('\n');
}

function generatorBlock(x) {
  const lines = x.gen.split('\n').filter((l) => l.trim() && !/^\s*org\b/.test(l) && !/^c\d+\s*=/.test(l)).length;
  const blocks = (x.gen.match(/^\w*:?\s*repeat\b/gm) ?? []).length, fns = (x.gen.match(/^\w*:?\s*def\b/gm) ?? []).length;
  const parts = [`${lines} lines for ${x.length} instructions`];
  if (blocks) parts.push(`${blocks} repeat${blocks > 1 ? 's' : ''}`);
  if (fns) parts.push(`${fns} function${fns > 1 ? 's' : ''}`);
  const done = x.refactors ?? [];
  if (done.length) parts.push(`refactored ${done.length}×: ${done.slice(-3).join(', ')}`);
  return `<h4>Generator <small>(${esc(parts.join(' · '))})</small></h4><pre class="gen">${genListing(x.gen)}</pre>`;
}

// The selected warrior, always shown: its scores, its results against the
// panel and the members, generator and code, its matches (▶ plays one in the
// arena) and its line.
function renderCard() {
  if (selected === null || !S.w.has(selected)) {
    $('card-body').innerHTML = '<div class="empty">No warrior selected: a switch to a run selects its best member against the panel; a click on a row of the matrix, a name or a dot selects that one.</div>';
    return;
  }
  const x = S.w.get(selected);
  const color = x.kind === 'member' ? hsl(x.hue) : '#c8cde0';
  const close = '<button class="close" id="card-close" title="no warrior selected (Esc)">×</button>';
  const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const fpBars = S.panel.map((p) => {
    const v = points(resOf(x.id, p));
    return v === null ? '<i style="height:0"></i>' : `<i title="${esc(nameOf(p))}: ${v.toFixed(0)}" style="height:${Math.max(2, (v / 300) * 100)}%;background:${scoreColor(v)}"></i>`;
  }).join('');
  const others = [...alive().filter((m) => m.id !== x.id), ...S.panel.filter((p) => p !== x.id).map(member)];
  if (x.benched) others.push(...x.benched.map(member));
  const rows = others.map((o) => ({ o, r: resOf(x.id, o.id) })).filter((e) => e.r)
    .sort((a, b) => points(a.r) - points(b.r)) // worst first: what beats it
    .map(({ o, r }) => `<tr class="${arenaPair?.[0] === x.id && arenaPair?.[1] === o.id ? 'playing' : ''}"><td><a data-id="${o.id}" style="color:${o.kind === 'member' ? hsl(o.hue) : o.kind === 'holdout' ? '#ff9ab8' : '#aab0c8'}">${esc(o.name)}</a> <small>${o.kind === 'member' ? `${o.length} instr` : o.kind}</small></td><td class="n">${r.w}/${r.l}/${r.t}</td><td class="n" style="color:${scoreColor(Math.max(120, points(r)))}">${points(r).toFixed(0)}</td><td><button class="play" data-battle="${x.id},${o.id}" title="play it in the arena">▶</button></td></tr>`).join('');
  // against the other members: the share it loses, and a bar for each, red where the member wins more rounds
  const vsMembers = alive().filter((m) => m.id !== x.id).map((m) => resOf(x.id, m.id)).filter(Boolean);
  const beatenBy = vsMembers.filter((r) => r.l > r.w).length;
  const membersAvg = vsMembers.length ? vsMembers.reduce((a, r) => a + points(r), 0) / vsMembers.length : -1;
  const memberBars = [...vsMembers].sort((a, b) => points(a) - points(b))
    .map((r) => `<i style="height:${Math.max(8, (points(r) / 300) * 100)}%;background:${r.l > r.w ? '#ff5a7a' : '#5dff9a'}"></i>`).join('');
  // its line: first parents back to where the family came from
  const line = [];
  for (let y = x, n = 0; y && n < 12; n++) {
    line.push(link(y.id));
    const p = y.parents?.[0];
    if (p === undefined) { line.push(y.ops === 'migrant' ? '<i>from another island</i>' : y.ops === 'random' ? '<i>random</i>' : `<i>${esc(y.ops)}</i>`); break; }
    y = S.w.get(p);
    if (!y) { line.push('…'); break; }
  }
  let head;
  if (x.kind === 'member') {
    const parents = x.parents.map(link).join(' ') || (x.ops === 'migrant' ? 'none here: the best of another island (--migrate)' : 'none (random)');
    head = `<h3 style="color:${color}">${esc(x.name)} <small style="color:#6c7290;font-size:13px">#${x.id}</small></h3>
      ${x.id === S.bestId ? '<div class="sub" style="color:#ffc53d">★ the best against the holdout warriors so far</div>' : ''}
      <div class="sub">born in batch ${x.born}${x.alive ? ', in the list' : `, pushed off in batch ${x.died}`} · ${x.length} instructions · ${esc(x.ops)}</div>
      <div class="stats">${stat('vs panel', f1(x.panelAvg))}${stat('vs holdout', f1(x.holdout))}${stat('vs members', f1(membersAvg))}${stat('beaten by', vsMembers.length ? `${beatenBy}/${vsMembers.length}` : '–')}
      ${stat('push-off value', f1(x.value))}${stat('distance', x.distance?.toFixed(2) ?? '–')}${stat('nearest', x.nearest !== undefined && x.nearest !== null && S.w.has(x.nearest) ? link(x.nearest) : '–')}${stat('screen', `${f1(x.screen)}${x.estimate !== undefined ? ` <small style="color:#7f86a0">est. ${x.estimate.toFixed(0)}</small>` : ''}`)}</div>
      <div class="links">parents: ${parents}</div>
      <div class="sub style" id="card-style">style: measuring…</div>
      <div class="${x.gen ? 'gen-code' : ''}"><div>${x.gen ? generatorBlock(x) : ''}</div>
      <div><h4>Code</h4><pre>${listing(x.code, Number(/ORG\s+(\d+)/.exec(x.code)?.[1] ?? 0))}</pre></div></div>`;
  } else {
    head = `<h3 style="color:${color}">${esc(x.name)}</h3><div class="sub">${esc(x.author)} · ${esc(x.file)} · ${{ panel: 'panel', holdout: 'holdout', retired: 'former panel' }[x.kind]} warrior from the hill</div>
      <div class="stats">${stat('vs panel', f1(x.panelAvg))}${stat('push-off value', f1(x.value))}${stat('nearest', x.nearest !== undefined && S.w.has(x.nearest) ? link(x.nearest) : '–')}</div>
      <div class="sub style" id="card-style">style: measuring…</div>
      <h4>Source</h4><pre>${esc(x.source)}</pre>`;
  }
  const members = x.kind === 'member' && vsMembers.length ? `<h4>Against the other members <small>red: the member wins more rounds</small></h4><div class="members">${memberBars}</div>` : '';
  const lineHtml = x.kind === 'member' ? `<h4>Line <small>first parents back to its family's start</small></h4><div class="line">${line.join(' ← ')}</div>` : '';
  $('card-body').innerHTML = `${close}${head}<h4>Against the panel, warrior by warrior</h4><div class="fp">${fpBars}</div>${members}
    <h4>Matches <small>wins/losses/ties, points per 100 rounds, worst first · ▶ plays it in the arena</small></h4><table>${rows}</table>${lineHtml}`;
  showStyle(x);
}

// The style of a warrior (tools/style.js): a few rounds against the first 3
// panel warriors with the watch, in this page; once per warrior. The engine,
// its opponents and what it measured belong to the run shown: another run
// has other rules and its own warriors under the same ids.
let styleModule = null, styleEngine = null;
const styles = new Map();
async function showStyle(x) {
  const id = x.id;
  try {
    styleModule ??= await compileMars();
    if (styleEngine?.start !== S.start) {
      const r = S.start.rules;
      styleEngine = { start: S.start, rules: { coreSize: r.size, maxCycles: r.cycles, maxProcesses: r.processes, maxLength: r.length, minDistance: r.distance } };
      styleEngine.m = createMarsSync({ ...styleEngine.rules, watch: true }, styleModule);
      styleEngine.opponents = S.panel.slice(0, 3).map((p) => assemble(S.w.get(p).source, styleEngine.rules));
      styles.clear();
    }
    if (!styles.has(id)) {
      const w = assemble(x.kind === 'member' ? `;name x\n${x.code}` : x.source, styleEngine.rules);
      styles.set(id, describe(measureStyle(styleEngine.m, w, styleEngine.opponents)));
    }
    const el = $('card-style');
    if (el && selected === id) el.textContent = `style against 3 panel warriors: ${styles.get(id)}`;
  } catch (e) {
    const el = $('card-style');
    if (el && selected === id) el.textContent = `style: ${e.message}`;
  }
}

// ------------------------------------------------------------------ battles

function battleUrl(a, b) {
  const r = resOf(a, b);
  if (!r) return null;
  // --positions mirror: game g of the match is round g / 2 + 1 of the seed with the warriors swapped when g is
  // odd, so the games with a as the first warrior are pMARS's rounds 1, 2, ... of the seed: this cell shows
  // them, the cell the other way round the other half. Else the match as it was played, its first warrior first.
  const mirror = S.start.params.positions === 'mirror';
  const first = mirror ? a : r.first, second = first === a ? b : a;
  const rounds = mirror ? (first === r.first ? Math.ceil(r.rounds / 2) : Math.floor(r.rounds / 2)) : r.rounds;
  if (!rounds) return null;
  const src = (id) => {
    const x = S.w.get(id);
    return x.kind === 'member' ? `;redcode\n;name ${x.name}\n;author 42evolve\n${x.code}` : x.source;
  };
  const ru = S.start.rules;
  const battle = {
    title: `${nameOf(first)} vs ${nameOf(second)}${mirror ? ', the games with ' + nameOf(first) + ' first' : ''}`,
    rules: { coreSize: ru.size, maxCycles: ru.cycles, maxProcesses: ru.processes, maxLength: ru.length, minDistance: ru.distance },
    seed: r.seed,
    rounds,
    round: 1,
    warriors: [first, second].map((id) => ({ name: nameOf(id), source: src(id) })),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(battle));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `index.html#battle=${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

// The arena: a match in the visualizer's core view, in this page
// (index.html?embed, the battle view without its title, cast and legend).
let arenaPair = null; // [a, b] of the match it shows
function playArena(a, b) {
  const url = battleUrl(a, b);
  if (!url) return;
  arenaPair = [a, b];
  const [page, hash] = url.split('#');
  const frame = $('arena');
  let loaded = false;
  try { loaded = !!frame.contentWindow?.__theater && frame.contentWindow.location.search.includes('embed'); } catch { /* not yet */ }
  // once loaded, a new match only changes the hash: the visualizer loads it in place, without a flash, at the speed set
  if (loaded) frame.contentWindow.location.hash = hash;
  else frame.src = `${page}?embed&noguide&paused&speed=9#${hash}`; // paused until play; watch: 2,500 instructions a second
  frame.hidden = false;
  $('arena-empty').hidden = true;
  const r = resOf(a, b);
  const color = (id) => (S.w.get(id)?.kind === 'member' ? hsl(S.w.get(id).hue) : '#aab0c8');
  $('arena-head').innerHTML = `<span style="color:${color(a)}">● ${esc(nameOf(a))}</span>`
    + `<span class="mid">${r.w}/${r.l}/${r.t} in ${r.rounds} rounds · ${points(r).toFixed(0)} points</span>`
    + `<span style="color:${color(b)}">${esc(nameOf(b))} ●</span>`;
  renderCard();
}

// A run that the page switches to: its best member against the panel, and
// in the arena the member that beats it most clearly (else the panel warrior
// it does worst against). While the history comes in, the pick follows it,
// until the user selects something.
let autoPick = true;
function pickBest() {
  const ms = alive();
  if (!ms.length) return;
  const best = ms.reduce((a, b) => ((b.panelAvg ?? -1) > (a.panelAvg ?? -1) ? b : a));
  if (selected !== best.id) select(best.id, true);
  const foe = worstOpponent(best.id);
  if (foe !== null && (arenaPair?.[0] !== best.id || arenaPair?.[1] !== foe)) playArena(best.id, foe);
}

// The opponent of warrior id for the arena: the member that beats it most
// clearly, else the panel warrior it does worst against, else the member it
// does worst against (a holdout warrior played only the benched members).
function worstOpponent(id) {
  const score = (o) => points(resOf(id, o.id));
  const worst = (xs) => xs.filter((o) => o && o.id !== id && resOf(id, o.id)).sort((x, y) => score(x) - score(y))[0] ?? null;
  const beaters = alive().filter((m) => m.id !== id && resOf(id, m.id)?.l > resOf(id, m.id)?.w);
  return (worst(beaters) ?? worst(S.panel.map(member)) ?? worst(alive()))?.id ?? null;
}

// A warrior the user picks goes into the arena as its first (red) warrior,
// against the opponent there if they have a match, else its worst opponent.
function arenaFor(id) {
  let b = arenaPair?.[1];
  if (b === undefined || b === id || !resOf(id, b)) b = worstOpponent(id);
  if (b !== null && b !== undefined) playArena(id, b);
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

function select(id, auto = false) {
  if (!auto) autoPick = false; // the user chose: the page does not pick for them any more
  selected = id;
  chartsDirty = true;
  renderCard();
  if (!auto && id !== null && S.w.has(id)) arenaFor(id);
}

function wire() {
  for (const id of ['matrix', 'lineage', 'progress']) {
    const c = $(id);
    c.addEventListener('mousemove', (e) => {
      const r = c.getBoundingClientRect();
      hover = { canvas: c, x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY, target: hover?.canvas === c ? hover.target : null };
      chartsDirty = true;
    });
    c.addEventListener('mouseleave', () => { hover = null; hideTip(); chartsDirty = true; });
    c.addEventListener('click', () => {
      const t = hover?.target;
      if (!t) {
        if (id === 'lineage') select(null); // a click beside the warriors: no lines
        return;
      }
      if (t.battle) autoPick = false, playArena(...t.battle);
      else if (t.select !== undefined) select(t.select);
    });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-id]');
    if (a) select(Number(a.dataset.id));
    const b = e.target.closest('button[data-battle]');
    if (b) autoPick = false, playArena(...b.dataset.battle.split(',').map(Number));
  });
  $('arena-big').addEventListener('click', () => document.body.classList.toggle('arena-big'));
  $('card').addEventListener('click', (e) => { if (e.target.closest('#card-close')) select(null); });
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    for (const x of $('tabs').querySelectorAll('button')) x.classList.toggle('on', x === b);
    for (const t of document.querySelectorAll('.ticker-panel .tab')) t.hidden = !t.classList.contains(b.dataset.tab);
    chartsDirty = true; // a chart that was hidden has its size only now
    if (b.dataset.tab === 'tab-ops') renderOps();
    if (b.dataset.tab === 'tab-about') renderAbout();
  });
  $('ops').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-window]');
    if (b) opsWindow = Number(b.dataset.window), renderOps();
  });
  $('c-best').addEventListener('click', () => { if (S.bestId !== null) select(S.bestId); });
  $('c-top').addEventListener('click', () => { const t = strongest(); if (t) select(t.id); });
  window.addEventListener('keydown', (e) => { // Esc: the arena back to its place, else no warrior selected
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('arena-big')) document.body.classList.remove('arena-big');
    else select(null);
  });
  renderMatrixSorts();
  $('matrix-sorts').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const axis = b.dataset.axis;
    if (matrixSort[axis] === b.dataset.sort) matrixSort[`${axis}Dir`] *= -1;
    else matrixSort[axis] = b.dataset.sort, matrixSort[`${axis}Dir`] = -1;
    try { localStorage.setItem('evolver-matrix-sort', JSON.stringify(matrixSort)); } catch {}
    renderMatrixSorts();
    lastChange = performance.now(); // let the rows slide into place
  });
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
    clearTimeout(connecting);
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
  lastChange = performance.now(); // let the rows slide into place
  S.version = (S.version ?? 0) + 1;
  autoPick = true;
  pickBest();
  renderCard();
}

// Events wait and are applied together every `every` seconds (?every=, 2 by
// default, 0 at once): a fast run sends many per second, and a dashboard that
// changes at that rate is noise, and costs CPU the run could use.
const EVERY = 1000 * Math.max(0, Number(new URLSearchParams(location.search).get('every') ?? 2) || 0);
let pending = [], lastApply = -1e9, lastChange = -1e9;
let quiet = new Set(); // newcomers that enter and leave within one update: no ticker lines for them

function applyPending(now, history = false) {
  const evs = pending;
  pending = [];
  const entered = new Set(evs.filter((e) => e.type === 'enter').map((e) => e.id));
  quiet = new Set(evs.filter((e) => e.type === 'leave' && entered.has(e.id)).map((e) => e.id));
  for (const e of evs) handle(e);
  if (quiet.size) tick(`<span style="color:#6c7290">${quiet.size} more tried and pushed off at once</span>`);
  quiet = new Set();
  if (history) { // the run so far, drawn in one go: nothing flares, no row slides
    for (const x of S.w.values()) x.enteredAt = -1e9, x.row = null;
    S.ghosts = [];
    lastApply = now;
  } else lastApply = lastChange = now;
  S.version = (S.version ?? 0) + 1;
  if (autoPick) pickBest();
  if (selected !== null) renderCard();
}

// The runs of the server (tools/serve.mjs --run a b ...): with more than one,
// a list on the left; a click (or [ and ]) points this one page at another
// run, ?run=<n> remembers which. The list comes again every 5 s: its batch,
// the score of its best.red against the holdout, whether it still writes.
let current = Math.max(0, Number(new URLSearchParams(location.search).get('run')) || 0);
let runs = [];
// The order of the list: a click on a column's heading sorts by it, a second
// one turns it around. First: names a to z, the most batches, the youngest
// best warrior, the highest score.
const SORTS = { name: 1, batch: -1, age: 1, score: -1 };
let sortBy = 'name', sortDir = 1;
try {
  const [k, d] = (localStorage.getItem('evolver-side-sort') ?? '').split(':');
  if (k in SORTS) sortBy = k, sortDir = d === '-1' ? -1 : d === '1' ? 1 : SORTS[k];
} catch {}
const ageOf = (x) => (x.bestBatch === null || x.batch < 0 ? null : Math.max(0, x.batch - x.bestBatch));
// The filter above the list: only the runs whose name contains its text (any
// case); [ and ] step through those. Kept in localStorage like the order.
let filterText = '';
try { filterText = localStorage.getItem('evolver-side-filter') ?? ''; } catch {}
const shown = (x) => !filterText || x.name.toLowerCase().includes(filterText.toLowerCase());

// The running runs first, then the stopped ones (whose batch and age stand
// still), each part in the order of the heading.
function orderedRuns() {
  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { numeric: true });
  const key = { batch: (x) => x.batch, age: ageOf, score: (x) => x.holdout }[sortBy];
  const order = sortBy === 'name' ? (a, b) => sortDir * byName(a, b) : (a, b) => {
    const x = key(a), y = key(b);
    if (x === null || y === null) return (x === null) - (y === null) || byName(a, b); // those without a value last
    return sortDir * (x - y) || byName(a, b);
  };
  return runs.filter(shown).sort((a, b) => !a.running - !b.running || order(a, b));
}

// The color of a run's score among the runs: red for the lowest, yellow in
// the middle, green for the highest (by value, not by rank: two runs that
// are close look alike).
function runColor(score, lo, hi) {
  if (score === null) return '';
  const t = hi > lo ? (score - lo) / (hi - lo) : 1;
  return `hsl(${Math.round(135 * t)} 85% ${Math.round(58 + 8 * t)}%)`;
}

function renderRuns() {
  const scores = runs.map((x) => x.holdout).filter((x) => x !== null);
  const lo = Math.min(...scores), hi = Math.max(...scores);
  // a run's name without the 42evolve. of a run folder; an island of the only folder of islands without that folder
  const roots = new Set(runs.map((x) => (x.name.includes('/') ? x.name.split('/')[0] : null)));
  const oneRoot = roots.size === 1 && !roots.has(null);
  const shortName = (name) => (oneRoot ? name.split('/')[1] : name).replace(/^42evolve\./, '');
  const ordered = orderedRuns(), running = ordered.filter((x) => x.running).length;
  $('side-count').textContent = ordered.length === runs.length ? `${runs.length} runs` : `${ordered.length} of ${runs.length} runs`;
  for (const h of document.querySelectorAll('.side-cols [data-sort]')) {
    const on = h.dataset.sort === sortBy;
    h.classList.toggle('on', on);
    h.textContent = `${h.dataset.label}${on ? (sortDir > 0 ? ' ↑' : ' ↓') : ''}`;
  }
  $('side-list').innerHTML = ordered.map((x, i) => {
    const age = ageOf(x), batch = x.batch < 0 ? '' : fmtInt(x.batch), score = x.holdout === null ? '–' : x.holdout.toFixed(1);
    const title = [
      esc(x.name),
      `batch ${batch || '–'}, ${x.members} members`,
      `best.red ${x.holdout === null ? 'not yet' : `${score} against the holdout${age === null ? '' : `, found ${fmtInt(age)} batches ago (batch ${fmtInt(x.bestBatch)})`}`}`,
      ...(x.running ? [] : ['stopped: no events for 3 batch times']),
    ].join(' · ');
    const head = i === running && running > 0 ? `<li class="side-part">stopped · ${ordered.length - running}</li>` : '';
    return `${head}<li class="${x.running ? '' : 'stopped'}"><button data-run="${x.index}" class="${x.index === current ? 'on' : ''}" title="${title}">`
      + `<i class="dot${x.running ? ' on' : ''}"></i><span class="nm">${esc(shortName(x.name))}</span><span class="sb">${batch}</span>`
      + `<span class="ag">${age === null ? '' : fmtInt(age)}</span><span class="sc" style="color:${runColor(x.holdout, lo, hi)}">${score}</span></button></li>`;
  }).join('');
}

async function refreshRuns() {
  if (document.hidden) return; // a tab nobody looks at asks for nothing
  try {
    runs = await (await fetch('/runs')).json();
  } catch {
    return; // the server is away; the stream says so with its dot
  }
  const several = runs.length > 1;
  $('side').hidden = !several;
  document.body.classList.toggle('with-side', several);
  chipsDirty = true; // the busy chip: whether the run still runs
  if (several) renderRuns();
}

// An empty dashboard: before the first events of a run, and when its events
// come again from the start.
function clearRun() {
  S = fresh();
  selected = null;
  pending = [];
  autoPick = true;
  arenaPair = null; // the visualizer stays loaded with its heading: the next match goes into it in place
  if (!catchingUp) renderCard(); // while a switch waits for the history, the card stays as it was
}

let connecting = 0; // the timer of a switch: stepping over runs with [ and ] asks only for the one it stops at
// While a run's history comes in, the page keeps showing what it showed and
// collects the events; on 'live' (tools/serve.mjs: the history is out), or
// after a while from a server without it, it applies them in one go.
let catchingUp = false, catchUpTimer = 0;
function caughtUp() {
  if (!catchingUp) return;
  catchingUp = false;
  clearTimeout(catchUpTimer);
  applyPending(performance.now(), true);
  chartsDirty = chipsDirty = tickerDirty = opsDirty = true;
  renderCard();
}
function switchRun(i) {
  if (i === current && source) return;
  current = i;
  source?.close();
  catchingUp = true; // from here the old picture stays until the new run's history is in
  clearRun();
  busyHistory.length = 0;
  chartsDirty = chipsDirty = tickerDirty = opsDirty = true;
  const q = new URLSearchParams(location.search);
  q.set('run', String(i));
  history.replaceState(null, '', `?${q}`);
  clearTimeout(connecting);
  connecting = setTimeout(connect, 200);
  if (runs.length) renderRuns();
}

function stepRun(d) {
  const r = orderedRuns();
  const k = r.findIndex((x) => x.index === current);
  if (r.length > 1) switchRun(r[(k + d + r.length) % r.length].index);
}

function connect() {
  catchingUp = true;
  clearTimeout(catchUpTimer);
  catchUpTimer = setTimeout(caughtUp, 6000);
  source = new EventSource(`/run/${current}/events`);
  source.addEventListener('live', caughtUp);
  source.addEventListener('run', (e) => { document.title = `42evolve · ${JSON.parse(e.data).name}`; });
  source.addEventListener('reset', clearRun);
  source.onopen = () => $('live').classList.add('on');
  source.onerror = () => $('live').classList.remove('on');
  source.onmessage = (e) => { pending.push(JSON.parse(e.data)); };
}

let lastFrame = 0, lastOps = 0, lastDraw = 0;
function frame(now) {
  // eased by the time since the last drawing, so that 15 frames a second slide as far as 60
  ease = 1 - Math.exp(-Math.min(500, now - (lastDraw || now)) / 110);
  lastFrame = now;
  if (catchingUp) { // the previous picture stays until the history is in
    requestAnimationFrame(frame);
    return;
  }
  if (pending.length && now - lastApply >= EVERY) applyPending(performance.now());
  // the matrix and the map move for a while after an update (rows slide,
  // newcomers flare) and while the mouse is on them, at most 15 frames a
  // second; else they stand still (10,000 cells a frame cost a core)
  const moving = now - lastChange < 1200 || hover?.canvas === $('matrix');
  if ((moving && now - lastDraw >= 66) || chartsDirty) {
    lastDraw = now;
    drawMatrix(now);
  }
  if (chartsDirty) { // the two charts that do not move on their own
    chartsDirty = false;
    if (!$('lineage').closest('.tab').hidden) drawLineage();
    if (!$('kinds').closest('.tab').hidden) drawKinds();
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
  else {
    connect();
    $('side-list').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-run]');
      if (b) switchRun(Number(b.dataset.run));
    });
    document.querySelector('.side-cols').addEventListener('click', (e) => {
      const h = e.target.closest('[data-sort]');
      if (!h) return;
      if (h.dataset.sort === sortBy) sortDir = -sortDir;
      else sortBy = h.dataset.sort, sortDir = SORTS[sortBy];
      try { localStorage.setItem('evolver-side-sort', `${sortBy}:${sortDir}`); } catch {}
      renderRuns();
    });
    $('side-filter').value = filterText;
    $('side-filter').addEventListener('input', (e) => {
      filterText = e.target.value.trim();
      try { localStorage.setItem('evolver-side-filter', filterText); } catch {}
      renderRuns();
    });
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || $('side').hidden || e.target.closest?.('input, textarea')) return;
      if (e.key === '[') stepRun(-1);
      if (e.key === ']') stepRun(1);
    });
    refreshRuns();
    setInterval(refreshRuns, 5000);
  }
  requestAnimationFrame(frame);
}

window.__evolver = { state: () => S, select, battleUrl }; // for debugging and screenshots
main();
