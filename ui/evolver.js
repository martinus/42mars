// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver dashboard: reads the events of a 42evolve run (evolver/)
// and shows the list as it changes. Data comes live from
// `node tools/serve.mjs --run <folder>` (/run/events), from ?log=<url> of an
// events.jsonl, or from an events.jsonl dropped on the page. A click on a
// match opens the visualizer (index.html#battle=...) on the same match: the
// same warriors, rules and seed, so the rounds on screen are the ones behind
// the number.

import { assemble, compileMars, createMarsSync } from '../wasm/42mars.js';
import { describe, measureStyle, shortKind } from '../tools/style.js';
import { kindCounts, progressPoint } from '../tools/progress.js';
import { compareDesigns, designTable } from '../tools/designs.js';

const $ = (id) => document.getElementById(id);
// The font of everything drawn but code: proportional, as the page's (evolver.css --sans).
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
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
    opTotals: new Map(), // change -> [children, evaluated, past the screen, still in after the batch]
    opBatches: [], // per batch: { batch, ops }
    kinds: [], // per batch: { batch, counts }: the members by kind of style
  };
}
let S = fresh();
let matrixHeading = null; // the matrix heading of the page, before a run changed it
let selected = null;
let hover = null; // { kind, ... } of the canvas under the mouse

const member = (id) => S.w.get(id);
const ageOfMember = (m) => Math.max(0, S.batch - (m.born ?? S.batch)); // batches since it entered
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
  chartsDirty = chipsDirty = true;
  switch (e.type) {
    case 'start': {
      S = fresh();
      S.start = e;
      S.rounds = e.params.rounds;
      // the heading as the page has it, then what this run changes in it: one page shows several runs
      matrixHeading ??= document.querySelector('.matrix-panel h2').innerHTML;
      document.querySelector('.matrix-panel h2').innerHTML = matrixHeading;
      if (e.params.crowding) { // the matrix panel shows the archive, no cells
        document.querySelector('.matrix-panel h2').innerHTML = 'Crowding archive <small>a warrior competes with its nearest by SD-score against the panel; one unlike all takes the place of the weaker of the closest pair · rows the archive, best first, columns the panel warriors · click a cell to watch the match</small>';
      } else if (e.params.specialists) {
        document.querySelector('.matrix-panel h2 small').insertAdjacentHTML('beforeend', ' · <span style="color:#ffc53d">◆</span> a protected member, outlined in the column of the panel warrior it is clearly best against');
      } else if (e.params.mapElites) { // the matrix panel shows the archive
        document.querySelector('.matrix-panel h2').innerHTML = 'MAP-Elites archive <small>a cell for each kind of style: rows the copies a warrior makes of its own code, columns its processes and the cells it reads far from home · in each cell the warrior with the best average against the panel (points per 100 rounds) · click a cell for its warrior</small>';
      }
      if (e.params.memberGames === 'none') { // no games among members: no columns of members
        const legend = document.querySelector('.matrix-panel h2 .legend');
        if (legend) legend.innerHTML = legend.innerHTML.replace('<b>columns</b> the members, ', '<b>columns</b> ');
      }
      if (!e.params.crowding && !e.params.mapElites) document.querySelector('.matrix-panel h2 small').insertAdjacentHTML('afterbegin', `<span class="setup">${setupText(e)}</span>`);
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
      // a brief line (42evolve --events brief, #187): a newcomer that leaves in its batch, without code and matches
      const x = { id: e.id, kind: 'member', name: e.name ?? `e${e.id}`, code: e.code ?? '', gen: e.gen ?? null, refactors: [], parents: e.parents, ops: e.ops, length: e.length, screen: e.screen, estimate: e.estimate, born: e.batch, died: null, alive: true, value: null, newFamily: !!e.newFamily, parentDifference: e.parentDifference, brief: !!e.brief };
      x.hue = hueFor(e.id, e.parents, x.newFamily);
      x.styleKind = e.style?.kind;
      S.w.set(e.id, x);
      let s = S.slots.indexOf(null, S.panel.length);
      if (s < 0) s = S.slots.push(null) - 1;
      S.slots[s] = e.id;
      for (const [o, w, l, t, seed] of e.scores ?? []) setRes(e.id, o, w, l, t, seed, e.id);
      x.opponents = (e.scores ?? []).map((s) => s[0]);
      x.panelAvg = e.brief ? e.panelAvg : panelAvg(e.id);
      x.row = null;
      if (!quiet.has(e.id)) tick(`<span class="in">+</span> ${link(e.id)} <b>${f1(x.panelAvg)}</b> vs panel <span style="color:#6c7290">${esc(e.ops)}</span>${x.newFamily ? ` <span class="new-family">new family: ${f1(e.parentDifference)} points from ${link(e.parents[0])}</span>` : ''}`);
      break;
    }
    case 'elite': { // --map-elites: a warrior takes a cell, the one there leaves
      const x = { id: e.id, kind: 'member', name: e.name, code: e.code, parents: e.parents, ops: e.ops, length: e.length, screen: e.screen, born: e.batch, died: null, alive: true, value: null, newFamily: !!e.newFamily, cell: e.index, cellXyz: e.cell, style: e.style };
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
      x.value = e.value;
      x.distance = e.distance;
      x.nearest = e.nearest;
      S.slots[S.slots.indexOf(e.id)] = null;
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

// The setup of the run (an island) in words, from its start event, over the
// matrix: what plays whom, how a newcomer gets in, who leaves. The numbers
// bold, so that two islands' setups compare at a glance.
const PANEL_CHOICE = { files: 'given', picked: 'picked', random: 'drawn', kinds: 'picked by kind' };
function setupText(e) {
  const p = e.params, b = (x) => `<b>${esc(String(x))}</b>`;
  const lines = [
    [`${b(p.list)} members`, `panel of ${b(e.panel.length)} hill warriors (${PANEL_CHOICE[p.panelChoice] ?? esc(p.panelChoice ?? '')})`, `seed ${b(p.seed)}`,
      p.genome === 'gen' ? '<b>generators</b>' : 'lists', ...(p.noSpl ? ['<b>no SPL</b>'] : [])],
    [`batch ${b(p.batch)}`, `screen ${b(p.screenRounds)} rounds vs panel${p.screenMembers ? ` + ${b(p.screenMembers)} members` : ''}${p.screenStop ? ` (stops at ${b(p.screenStop)} SE)` : ''}`,
      `best ${b(p.survivors)} play ${b(p.rounds)} rounds${p.panelRounds && p.panelRounds !== p.rounds ? ` (${b(p.panelRounds)} vs panel)` : ''}`],
    [p.pushoff?.startsWith('pareto')
      ? `push-off: last <b>front</b> of vs panel${p.memberGames === 'none' ? '' : ', vs members'}${p.pushoff === 'pareto-sd' ? `, <b>SD-score</b> (${p.diversity === 'panel' ? 'panel columns' : 'all columns'})` : ''}`
      : `push-off: <b>score × SD-score</b> (score vs ${p.average === 'panel' ? 'panel' : 'all'}, SD over ${p.diversity === 'panel' ? 'panel' : 'all'})`,
      ...(p.positions === 'mirror' ? ['mirrored starts'] : []), ...(p.tiePoints !== undefined && p.tiePoints !== 1 ? [`a tie ${b(p.tiePoints)}`] : []),
      ...(p.parsimony ? ['parsimony'] : []), ...(p.minLength ? [`min length ${b(p.minLength)}`] : []), ...(p.memberGames === 'none' ? ['no member games'] : [])],
  ];
  return lines.map((l) => l.join(' · ')).join('<br>') + '<br>';
}

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
  ctx.font = `10px ${SANS}`;
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
      ctx.fillStyle = (m.panelAvg ?? 0) > 180 ? '#10131f' : '#e8ebf5';
      ctx.font = `bold ${cw < 46 ? 11 : 12}px ${SANS}`;
      ctx.fillText(cw < 46 ? String(Math.round(m.panelAvg ?? 0)) : f1(m.panelAvg), x + 4, y + ch / 2 - 7); // narrow cells: no decimal
      ctx.font = `9px ${SANS}`;
      ctx.fillText(m.name.slice(0, Math.max(4, Math.floor(cw / 6))), x + 5, y + ch / 2 + 8);
      if (selected === m.id || m.id === S.bestId) {
        ctx.strokeStyle = selected === m.id ? '#ffc53d' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
      }
      if (hv && hv.x >= x && hv.x < x + cw && hv.y >= y && hv.y < y + ch) target = m;
    }
    ctx.font = `10px ${SANS}`;
  }
  // below the grid: the cells' warriors (best first) against each panel
  // warrior, a cell per match, as the matrix of the list; a click watches it
  const ms = alive().sort((a, b) => (b.panelAvg ?? 0) - (a.panelAvg ?? 0));
  const panel = S.panel.map(member).sort((a, b) => (b.panelAvg ?? 0) - (a.panelAvg ?? 0));
  const mTop = top + 4 * ch + 34, rowH = Math.max(1, Math.min(14, (h - mTop - 8) / Math.max(1, ms.length)));
  const names = rowH >= 9, mLeft = names ? 150 : 22, colW = Math.max(1, (w - mLeft - 10) / Math.max(1, panel.length));
  ctx.font = `10px ${SANS}`;
  ctx.fillStyle = '#7f86a0';
  ctx.fillText(`the warriors of the ${crowd ? 'archive' : 'cells'}, best first, against the ${panel.length} panel warriors · click a cell to watch the match`, 6, mTop - 14);
  const key = `${S.version}:${panel.length}`;
  matrix.cells = [];
  ms.forEach((m, i) => {
    const y = mTop + i * rowH;
    if (m.cellKey !== key) m.cellKey = key, m.cellColors = panel.map((o) => (resOf(m.id, o.id) ? scoreColor(points(resOf(m.id, o.id))) : null));
    ctx.fillStyle = selected === m.id ? '#ffc53d' : hsl(m.hue);
    if (names) {
      ctx.font = `${selected === m.id ? 'bold ' : ''}10px ${SANS}`;
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
const MATRIX_SORTS = { rows: ['value', 'average', 'distance', 'age', 'length', 'panel'], cols: ['strength', 'score', 'spread'] };
let matrixSort = { rows: 'value', rowsDir: -1, cols: 'strength', colsDir: -1 };
// The numbers after a member's name in the matrix: [sort key, heading, text]; a click on a heading sorts the rows.
const MATRIX_NUMBERS = [ // [sort key, heading, text, value for its color]
  ['length', 'len', (m) => String(m.length ?? ''), (m) => m.length],
  ['age', 'age', (m) => String(ageOfMember(m)), ageOfMember],
  ['average', 'score', (m) => f1(m.avg), (m) => m.avg],
  ['distance', 'sd', (m) => (m.distance === undefined || m.distance === null ? '–' : m.distance.toFixed(2)), (m) => m.distance],
  ['value', 'value', (m) => f1(m.value), (m) => m.value],
];
// The colors of numbers by where they are between the lowest and the highest
// of their column: blue, light grey in the middle, amber; 21 steps made once.
const NUM_RAMP = (() => {
  const low = [111, 134, 201], mid = [201, 206, 221], high = [255, 179, 71];
  return Array.from({ length: 21 }, (_, i) => {
    const t = i / 20, [a, b, u] = t < 0.5 ? [low, mid, t * 2] : [mid, high, t * 2 - 1];
    return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * u)).join(',')})`;
  });
})();
const rampColor = (v, lo, hi) => (v === undefined || v === null || !Number.isFinite(v) ? '#aab1c9' : NUM_RAMP[hi > lo ? Math.round((20 * (v - lo)) / (hi - lo)) : 10]);
// What a heading of the matrix means, for its tooltip: what the number is,
// how to read it, and what a click does. The push-off's settings change some.
function sortTip(axis, key) {
  const p = S.start?.params ?? {};
  const overPanel = p.diversity === 'panel' ? 'the panel columns' : 'all columns, evolved and panel';
  const pareto = { pareto: 'its score against the panel and its score against the other members',
    'pareto-age': 'its score against the panel, its score against the other members and the age of its line',
    'pareto-sd': 'its score against the panel, its score against the other members and its sd' }[p.pushoff];
  const text = {
    length: ['Length', 'How many instructions the warrior has. A short warrior is a small target: the opponent\'s bombs and scans find it less often. A long one has room for more than one trick.'],
    age: ['Age', 'For how many batches it has kept its place in the list. Each batch, newcomers try to push members out: an old warrior has outlasted all of them, a young one has just won its place.'],
    panel: ['Against the panel', 'Its average points per 100 rounds against the panel warriors, the hill warriors every evolved warrior plays: the column between the evolved warriors and the panel. The panel stands for the hill, so this is the best guess of how it does there.'],
    average: ['Score', `Its average points per 100 rounds: 3 for a win, 1 for a tie, 0 for a loss, so 300 means it won every round. The average is over ${p.average === 'panel' ? 'the panel only (<code>--average panel</code>)' : 'its whole row: the other evolved warriors and the panel'}. This is how strong it is.`],
    distance: ['SD-score to its nearest', `How differently it plays from the most similar other warrior in the list. Its row of scores is compared with every other row on ${overPanel}, each difference scaled by that column's standard deviation, so the columns where the warriors differ most do not drown out the others. Near 0: almost a copy of another member. Large: it beats, or loses to, other opponents than the rest do.`],
    value: ['Push-off value', pareto
      ? `Decides who leaves when the list is full: the lowest value goes. The warriors are sorted into fronts on ${pareto}: a warrior is on the first front when no other one is at least as good in all of them and better in one. The value is 10 for each front above the last, plus up to 5 the more room it has on its front, so that among near-equals the one most unlike its neighbours stays.`
      : `Decides who leaves when the list is full: the lowest value goes. The value is the score times the sd${p.alpha !== undefined && p.alpha !== 1 ? `<sup>${p.alpha}</sup>` : ''}, so a warrior stays by being strong, by playing unlike the others, or both: a weak but unusual one can stay, a strong near-copy is pushed out.`],
    strength: ['Strength of the panel warrior', 'The panel is a fixed set of human-written hill warriors that every evolved warrior has to play. This is the panel warrior\'s own average points per 100 rounds against the rest of the panel: the higher, the tougher an opponent.'],
    score: ['The list\'s score against it', 'The average points per 100 rounds the evolved warriors of the list get against this panel warrior. Low: an opponent the list has not learned to beat yet, its weak spot. High: one it has mastered.'],
    spread: ['Spread of the list against it', 'The standard deviation of the evolved warriors\' scores against this panel warrior. Large: some members beat it and others lose to it, so this column tells the members apart. Small: they all do about the same against it. The SD-score of the rows divides each column by this.'],
  }[key];
  const on = matrixSort[axis] === key, dir = matrixSort[`${axis}Dir`];
  const what = axis === 'rows' ? 'the warriors' : 'the panel columns';
  const click = on ? `Sorted by this, ${dir > 0 ? 'lowest' : 'highest'} first. Click to turn it around.` : `Click to sort ${what} by this, highest first; click again for lowest first.`;
  return `<b>${text[0]}</b><div style="margin:3px 0 5px">${text[1]}</div><span style="color:#7f86a0">${click}</span>`;
}
// The panel's numbers over its columns: [sort key, heading, value].
const PANEL_NUMBERS = [
  ['strength', 'strength', (p) => p.panelAvg ?? 0],
  ['score', 'score', (p, columns) => columns.get(p.id).score],
  ['spread', 'sd', (p, columns) => columns.get(p.id).spread],
];
function sortMatrix(axis, key) { // a key again turns the order around
  if (matrixSort[axis] === key) matrixSort[`${axis}Dir`] *= -1;
  else matrixSort[axis] = key, matrixSort[`${axis}Dir`] = -1;
  try { localStorage.setItem('evolver-matrix-sort', JSON.stringify(matrixSort)); } catch {}
  chartsDirty = true;
}
try {
  const m = JSON.parse(localStorage.getItem('evolver-matrix-sort') ?? 'null');
  if (m && MATRIX_SORTS.rows.includes(m.rows) && MATRIX_SORTS.cols.includes(m.cols)) matrixSort = { rows: m.rows, rowsDir: m.rowsDir > 0 ? 1 : -1, cols: m.cols, colsDir: m.colsDir > 0 ? 1 : -1 };
} catch {}

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

const rowFont = (ch) => Math.min(11, Math.max(8, Math.floor(ch))); // the names' size in rows ch high
const numFont = (ch) => Math.max(10, rowFont(ch)); // their numbers: digits are lower than names, 10px fit rows of 9

// The matrix's description in the empty corner above the names, left of the
// panel's band headings, when it fits in a width of 260 px or more; else in
// the heading. The matrix starts below it: matrix.noteH, from the last draw.
function placeNote(canvas, width) {
  const note = document.querySelector('.matrix-panel h2 small');
  if (!note) return;
  const wrap = canvas.parentElement, inside = width >= 260;
  note.classList.toggle('inside', inside);
  if (inside) {
    const left = `${wrap.offsetLeft + 4}px`, top = `${wrap.offsetTop + 2}px`, w = `${Math.floor(width)}px`;
    if (note.style.left !== left) note.style.left = left;
    if (note.style.top !== top) note.style.top = top;
    if (note.style.width !== w) note.style.width = w;
  }
  const h = inside ? note.offsetHeight : 0;
  if (Math.abs(h - (matrix.noteH ?? 0)) > 1) matrix.noteH = h, chartsDirty = true;
}

function drawMatrix(now) {
  if (S.start?.params?.mapElites) return drawGrid(now);
  const canvas = $('matrix');
  const { ctx, w, h } = fit(canvas);
  if (!S.start) return;
  const rowKey = { panel: (m) => m.panelAvg ?? -1, value: (m) => m.value ?? -1, average: (m) => m.avg ?? -1, distance: (m) => m.distance ?? -1, age: (m) => ageOfMember(m), length: (m) => m.length ?? 0 }[matrixSort.rows];
  const ms = alive().sort((a, b) => matrixSort.rowsDir * (rowKey(a) - rowKey(b)) || a.id - b.id);
  const columns = panelColumns();
  const pnums = PANEL_NUMBERS.map(([key, head, value]) => ({ key, head, value: (p) => value(p, columns) }));
  const colKey = pnums.find((c) => c.key === matrixSort.cols).value;
  const panel = S.panel.map(member).sort((a, b) => matrixSort.colsDir * (colKey(a) - colKey(b)) || a.id - b.id);
  // the columns of the members: none with --member-games none, where members never play each other
  const mcols = S.start.params.memberGames === 'none' ? [] : ms;
  matrix.order = ms.map((m) => m.id); // for the arrow keys
  ms.forEach((m, i) => {
    m.row = i; // at its place at once: no sliding
  });
  // From the top: a line of headings, the panel's numbers in a band each over
  // its columns, the headings of the rows' numbers, the rows. The panel's
  // numbers are text turned upright where the columns are wide enough, else
  // strips from dark (lowest) to bright (highest).
  const gap = 10, cols = mcols.length + panel.length, bands = 18;
  let top, bh, ch, names, nums, numsW, labelW, cw, vw;
  for (bh of [21, 12]) {
    top = Math.max(bands + pnums.length * bh + 14, matrix.noteH ? matrix.noteH + 26 : 0); // below the note, placeNote()
    // a list of 100 (--list) still fits: thin cells without gaps, names only while rows are high enough
    ch = Math.max(1, Math.min(36, (h - top - 10) / Math.max(8, ms.length)));
    names = ch >= 9; // a list of 80 on a screen 1080 high: rows of about 10, names in a smaller font
    // the name, then its numbers, right-aligned, each a column whose heading sorts the rows (and ◆ with --specialists)
    // measured in the fonts they are drawn in: the headings 10px, names in the rows' font, numbers in it
    // but at least 10px (bold where selected)
    const wide = (m, text, size = rowFont(ch)) => {
      ctx.font = `${m.id === selected ? 'bold ' : ''}${size}px ${SANS}`;
      return ctx.measureText(text).width;
    };
    nums = [];
    if (names) for (const [key, head, text, value] of MATRIX_NUMBERS) {
      ctx.font = `10px ${SANS}`;
      const vs = ms.map(value).filter((v) => Number.isFinite(v));
      nums.push({ key, head, text, value, lo: Math.min(...vs), hi: Math.max(...vs), w: Math.max(ctx.measureText(`${head} ↓`).width, ...ms.map((m) => wide(m, text(m), numFont(ch)))) + 8 });
    }
    numsW = nums.reduce((a, c) => a + c.w, 0);
    labelW = names ? Math.min(420, Math.max(74, ...ms.map((m) => 20 + wide(m, m.id === S.bestId ? `★ ${m.name}` : m.name) + numsW + (S.start.params.specialists ? 20 : 6)))) : 22;
    // the column of each row's average against the panel, between the evolved warriors and the panel; its heading sorts the rows
    ctx.font = `10px ${SANS}`;
    vw = names ? Math.max(ctx.measureText('vs panel ↓').width, ...ms.map((m) => wide(m, f1(m.panelAvg), numFont(ch)))) + gap : 12 + gap; // rows too low for numbers: a strip of colors
    cw = Math.max(1, (w - labelW - gap - vw - 10) / Math.max(1, cols));
    if (cw >= 9) break;
  }
  const upright = bh === 21;
  for (let k = nums.length - 1, x = labelW - (S.start.params.specialists ? 20 : 6); k >= 0; x -= nums[k].w, k--) nums[k].x = x;
  const cg = cw >= 4 ? 1 : 0, rg = ch >= 4 ? 1 : 0;
  const colX = (i) => labelW + (i < mcols.length ? i * cw : mcols.length * cw + gap + vw + (i - mcols.length) * cw);
  const vx = labelW + mcols.length * cw + gap + vw - gap / 2; // the right edge of the numbers against the panel
  const vs = ms.map((m) => m.panelAvg).filter((v) => Number.isFinite(v)), vlo = Math.min(...vs), vhi = Math.max(...vs);
  ctx.font = `10px ${SANS}`;
  ctx.fillStyle = '#7f86a0';
  ctx.textBaseline = 'middle';
  matrix.heads = [];
  if (names) { // the headings of the numbers after the names: a click sorts by it, again the other way round
    ctx.textAlign = 'right';
    for (const c of nums) {
      const on = matrixSort.rows === c.key;
      ctx.fillStyle = on ? '#ffc53d' : '#7f86a0';
      ctx.fillText(on ? `${c.head} ${matrixSort.rowsDir > 0 ? '↑' : '↓'}` : c.head, c.x, top - 10);
      matrix.heads.push({ axis: 'rows', key: c.key, x0: c.x - c.w + 4, x1: c.x + 2, y0: top - 18, y1: top - 3 });
    }
    ctx.textAlign = 'left';
  }
  { // the heading of the column against the panel: 'vs' over the strip of low rows
    const on = matrixSort.rows === 'panel', head = names ? 'vs panel' : 'vs';
    ctx.textAlign = 'right';
    ctx.fillStyle = on ? '#ffc53d' : '#7f86a0';
    ctx.fillText(on ? `${head} ${matrixSort.rowsDir > 0 ? '↑' : '↓'}` : head, vx + (names ? 0 : 6), top - 10);
    matrix.heads.push({ axis: 'rows', key: 'panel', x0: vx - vw + gap - 4, x1: vx + 6, y0: top - 18, y1: top - 3 });
    ctx.textAlign = 'left';
  }
  const px = labelW + mcols.length * cw + gap + vw, ptext = `panel (${panel.length} hill warriors)`;
  ctx.font = `10px ${SANS}`;
  placeNote(canvas, px - 22 - Math.max(...pnums.map((c) => ctx.measureText(`${c.head} ↓`).width)));
  ctx.fillStyle = '#7f86a0';
  ctx.fillText(ctx.measureText(ptext).width < w - px ? ptext : 'panel', px, 10);
  // the panel's numbers: the heading left of its band sorts the columns by it
  matrix.pcells = [];
  pnums.forEach((c, k) => {
    const y = bands + k * bh, on = matrixSort.cols === c.key;
    ctx.font = `10px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = on ? '#ffc53d' : '#7f86a0';
    const head = on ? `${c.head} ${matrixSort.colsDir > 0 ? '↑' : '↓'}` : c.head;
    ctx.fillText(head, px - 6, y + bh / 2);
    matrix.heads.push({ axis: 'cols', key: c.key, x0: px - 10 - ctx.measureText(head).width, x1: px - 2, y0: y, y1: y + bh });
    const vs = panel.map(c.value), lo = Math.min(...vs), hi = Math.max(...vs);
    ctx.font = `10px ${SANS}`;
    ctx.textAlign = 'left';
    panel.forEach((p, j) => {
      const x = colX(mcols.length + j);
      if (upright) {
        ctx.fillStyle = rampColor(vs[j], lo, hi);
        ctx.save();
        ctx.translate(x + (cw - cg) / 2, y + bh - 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(Math.round(vs[j])), 0, 0);
        ctx.restore();
      } else {
        const t = hi > lo ? (vs[j] - lo) / (hi - lo) : 1;
        ctx.fillStyle = on ? `rgba(255,197,61,${0.12 + 0.88 * t})` : `rgba(160,168,196,${0.08 + 0.72 * t})`;
        ctx.fillRect(x, y + 1, Math.max(1, cw - cg), bh - 2);
      }
      matrix.pcells.push({ x, y, w: cw, h: bh, id: p.id });
    });
  });
  ctx.textAlign = 'left';
  // column marks in the warriors' colors
  mcols.forEach((m, i) => {
    ctx.fillStyle = hsl(m.hue);
    ctx.fillRect(colX(i) + cg, top - 7, Math.max(1, cw - 2 * cg), 3);
  });
  matrix.cells = [];
  matrix.rows = [];
  const others = [...mcols, ...panel];
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
      ctx.font = `${sel ? 'bold ' : ''}${rowFont(ch)}px ${SANS}`; // smaller in low rows
      ctx.fillText(m.id === S.bestId ? `★ ${m.name}` : m.name, 20, y + ch / 2);
      ctx.fillStyle = sel ? '#ffc53d' : '#aab1c9'; // its numbers
      ctx.font = `${sel ? 'bold ' : ''}${numFont(ch)}px ${SANS}`;
      ctx.textAlign = 'right';
      for (const c of nums) {
        if (!sel) ctx.fillStyle = rampColor(c.value(m), c.lo, c.hi);
        ctx.fillText(c.text(m), c.x, y + ch / 2);
      }
      // its average against the panel
      ctx.fillStyle = sel ? '#ffc53d' : rampColor(m.panelAvg, vlo, vhi);
      ctx.fillText(f1(m.panelAvg), vx, y + ch / 2);
      ctx.textAlign = 'left';
      if (S.spec.has(m.id)) { // --specialists: a protected member
        ctx.fillStyle = '#ffc53d';
        ctx.fillText('◆', labelW - 14, y + ch / 2);
      }
    } else {
      ctx.fillStyle = rampColor(m.panelAvg, vlo, vhi); // its average against the panel, a strip
      ctx.fillRect(vx - 12, y, 12, Math.max(1, ch - rg));
      ctx.fillStyle = sel ? '#ffc53d' : hsl(m.hue);
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
  for (const m of ms) drawRow(m, top + m.row * ch, 1);
  // the selected warrior: its row (its matches) and its column (the matches
  // of the others against it) framed
  const si = others.findIndex((o) => o.id === selected), m = ms.find((x) => x.id === selected);
  if (si >= 0 || m) {
    const right = colX(others.length - 1) + cw - cg, bottom = top + ms.length * ch;
    ctx.strokeStyle = '#ffc53d';
    ctx.lineWidth = 1.5;
    if (m) ctx.strokeRect(1.5, top + m.row * ch - 1, right, ch - rg + 2);
    if (si >= 0) ctx.strokeRect(colX(si) - 1, top - 9, cw - cg + 2, bottom - top + 10);
  }
  const hv = mouseOf(canvas);
  canvas.style.cursor = '';
  const head = hv ? matrix.heads.find((h) => hv.x >= h.x0 && hv.x <= h.x1 && hv.y >= h.y0 && hv.y < h.y1) : null;
  const pcell = hv && !head ? matrix.pcells.find((c) => hv.x >= c.x && hv.x < c.x + c.w && hv.y >= c.y && hv.y < c.y + c.h) : null;
  if (head) {
    canvas.style.cursor = 'pointer';
    hv.target = { sort: head.key, axis: head.axis };
    showTip(hv, sortTip(head.axis, head.key));
  } else if (pcell) { // a panel warrior's numbers
    canvas.style.cursor = 'pointer';
    hv.target = { select: pcell.id };
    const p = member(pcell.id);
    showTip(hv, `${warriorTip(pcell.id)}<br>${pnums.map((c) => `${c.head} ${f1(c.value(p))}`).join(' · ')}<br><span style="color:#7f86a0">strength: its average against the rest of the panel · score: the evolved warriors' average against it · sd: the spread of their scores · click to select</span>`);
  } else if (hv) {
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
    ctx.font = `bold 11px ${SANS}`;
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
  ctx.font = `10px ${SANS}`;
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
  ctx.font = `10px ${SANS}`;
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
  ctx.font = `10px ${SANS}`;
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
  'shared-target': 'a far value set to point at the cell another far value of the warrior points at: its value plus the distance between the two instructions',
  tune: 'a far value moved by up to 2% of its size (at least 4)',
  'random-loop': '2 to 5 new random instructions, the last a jump back to the first (DJN, JMN, JMZ, or SEQ/SNE and JMP); in place of old ones at the length limit',
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
  // the warrior on top, always in view; its results against the others below, in a box of their own that
  // scrolls and keeps its place while the warrior is redrawn
  const rest = $('card-rest'), keep = rest && renderCard.shown === x.id ? rest.scrollTop : 0;
  renderCard.shown = x.id;
  $('card-body').innerHTML = `${close}<div class="card-top">${head}<h4>Against the panel, warrior by warrior</h4><div class="fp">${fpBars}</div></div>
    <div class="card-rest" id="card-rest">${members}<h4>Matches <small>wins/losses/ties, points per 100 rounds, worst first · ▶ plays it in the arena</small></h4><table>${rows}</table>${lineHtml}</div>`;
  $('card-rest').scrollTop = keep;
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

// The visualizer's page for a battle: index.html#battle= and its JSON, base64url.
function battleLink(battle) {
  const bytes = new TextEncoder().encode(JSON.stringify(battle));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `index.html#battle=${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}
const battleRules = () => {
  const ru = S.start.rules;
  return { coreSize: ru.size, maxCycles: ru.cycles, maxProcesses: ru.processes, maxLength: ru.length, minDistance: ru.distance };
};
const sourceOf = (id) => {
  const x = S.w.get(id);
  return x.kind === 'member' ? `;redcode\n;name ${x.name}\n;author 42evolve\n${x.code}` : x.source;
};

// Standard opponents for the arena, not of the run: to watch what a warrior
// does on its own (the dummy sits still) and against the classic kinds. The
// dummy is the default; 'match' is a match of the run (worstOpponent()). The
// stone, paper and scanner are warriors/lantern.red, origami.red and
// seeker.red with their constants from the core size: those assert a core of
// 8000 and do not assemble on the tiny hill. Paper and scanner are the same
// code as the samples in a core of 8000; the stone has a step of 2/5 of the
// core plus 1, which does not hit itself in a core of 800 or 8000 (the
// sample's 3359 scaled to 800 did: it lost 88 of 100 rounds to the dummy).
const STANDARD = [
  { key: 'dummy', name: 'Dummy', title: 'sits still: one process that jumps to itself, so the warrior is seen on its own until it hits it', source: ';redcode-94\n;name Dummy\n;strategy sits still: one process jumps to itself\n        JMP     $0\n' },
  { key: 'imp', name: 'Imp', title: 'Imp (Dewdney): copies itself one cell ahead, forever', file: '../warriors/imp.red' },
  { key: 'dwarf', name: 'Dwarf', title: 'Dwarf (Dewdney): a DAT bomb on every fourth cell', file: '../warriors/dwarf.red' },
  { key: 'stone', name: 'Lantern', title: 'a stone: Lantern drops DAT bombs with a step, then wipes the core', source: ";redcode-94\n;name Lantern\n;author 42mars sample\n;strategy Stone: drops DAT bombs with a step, then wipes the rest of the core\n;strategy with a forward DAT clear that stops before itself. As\n;strategy warriors/lantern.red, with a step from the core size (2/5 of it, plus 1)\n;strategy that does not hit itself in a core of 800 or 8000.\nstep    equ     (CORESIZE/5*2 + 1)\nbombs   equ     (CORESIZE/10)\n\n        org     start\nstart   add.ab  #step,  target\n        mov.i   bomb,   @target\n        djn.b   start,  #bombs\n        mov.ab  #1,     target\nclear   mov.i   bomb,   >target\n        djn.b   clear,  #CORESIZE-9\n        jmp     0\nbomb    dat     #0,     #0\ntarget  dat     #0,     #0\n        end\n" },
  { key: 'paper', name: 'Origami', title: 'a paper: Origami copies itself to new places with many processes', source: ";redcode-94\n;name Origami\n;author 42mars sample\n;strategy Paper: eight processes copy the two-line body to a new place, split\n;strategy into the copy and start over there. Each copy bombs while it works.\n;strategy warriors/origami.red with its constants from the core size (the same\n;strategy in a core of 8000).\ndist    equ     (CORESIZE/4 + 341)\n\n        spl     1\n        spl     1\n        spl     1\nsilk    spl     @0,     }dist\n        mov.i   }silk,  >silk\n        mov.i   bomb,   >(CORESIZE/5 + 173)\n        mov.i   bomb,   }(CORESIZE/8 + 213)\n        jmp     silk,   {silk\nbomb    dat     >((CORESIZE+1)/3), >(CORESIZE*2/3 + 1)\n        end\n" },
  { key: 'scanner', name: 'Seeker', title: 'a scanner: Seeker compares two cells half a core apart and bombs where they differ', source: ";redcode-94\n;name Seeker\n;author 42mars sample\n;strategy Scanner: compares two cells half a core apart, stepping by 12. Where the\n;strategy core is not empty it bombs both cells, then keeps looking. After a\n;strategy full lap it clears the core, stopping short of itself.\n;strategy warriors/seeker.red with its constants from the core size (the same\n;strategy in a core of 8000).\nstep    equ     12\nlaps    equ     (CORESIZE/2/step - 4)\n\n        org     scan\ninc     dat     #step,  #step\nscan    add.f   inc,    ptr\nptr     seq.i   bomb+step, bomb+step+CORESIZE/2\n        jmp     found\n        djn.b   scan,   #laps\n        jmp     clear\nfound   mov.i   bomb,   *ptr\n        mov.i   bomb,   @ptr\n        jmp     scan\nclear   mov.i   bomb,   >gate\n        djn.b   clear,  #CORESIZE-16\n        jmp     0\ngate    dat     #0,     #2\nbomb    dat     #0,     #0\n        end\n" },
];
const standard = (key) => STANDARD.find((s) => s.key === key);
let arenaFoe = 'dummy'; // what the arena plays a warrior against: a key of STANDARD or 'match'; kept in localStorage
try {
  const f = localStorage.getItem('evolver-arena-foe');
  if (f === 'match' || standard(f)) arenaFoe = f;
} catch {}
// A standard warrior that does not assemble under the run's rules is not
// offered: a run with a length limit below its code. Before the engine is
// compiled (loadStandard() does it) it counts as fitting.
const fitsCache = new Map();
function fits(s) {
  if (!s?.source) return false;
  if (!S.start) return true;
  const key = `${s.key} ${JSON.stringify(S.start.rules)}`;
  if (!fitsCache.has(key)) {
    try {
      fitsCache.set(key, assemble(s.source, battleRules()).errors.length === 0);
    } catch {
      return true;
    }
  }
  return fitsCache.get(key);
}
// The opponent the arena plays: a standard one that fits, else the dummy.
const foeFor = (key) => (key === 'match' || fits(standard(key)) ? key : 'dummy');
async function loadStandard() {
  try { styleModule ??= await compileMars(); } catch { /* fits() then offers all */ }
  await Promise.all(STANDARD.filter((s) => s.file && !s.source).map(async (s) => {
    try {
      const res = await fetch(s.file);
      if (res.ok) s.source = new TextDecoder('latin1').decode(await res.arrayBuffer());
    } catch { /* that one is not offered */ }
  }));
  renderFoes();
  if (selected !== null && standard(arenaPair?.[1] ?? arenaFoe)) arenaFor(selected); // the first match waited for its sources and the engine
}
function renderFoes() {
  const shown = arenaPair ? (standard(arenaPair[1]) ? arenaPair[1] : 'match') : arenaFoe;
  $('arena-foes').innerHTML = 'vs ' + [...STANDARD.filter(fits), { key: 'match', name: 'its match', title: 'a match of the run: the member that beats it most clearly, else the panel warrior it does worst against' }]
    .map((s) => `<button data-foe="${s.key}" class="${s.key === shown ? 'on' : ''}" title="${esc(s.title)}">${s.key === 'match' ? s.name : s.key}</button>`).join('');
}

function battleUrl(a, b) {
  if (standard(b)) { // a warrior against a standard opponent: not a match of the run, its rounds from seed 1
    const s = standard(b);
    return battleLink({ title: `${nameOf(a)} vs ${s.name}`, rules: battleRules(), seed: 1, rounds: S.start.params.rounds, round: 1,
      warriors: [{ name: nameOf(a), source: sourceOf(a) }, { name: s.name, source: s.source }] });
  }
  const r = resOf(a, b);
  if (!r) return null;
  // --positions mirror: game g of the match is round g / 2 + 1 of the seed with the warriors swapped when g is
  // odd, so the games with a as the first warrior are pMARS's rounds 1, 2, ... of the seed: this cell shows
  // them, the cell the other way round the other half. Else the match as it was played, its first warrior first.
  const mirror = S.start.params.positions === 'mirror';
  const first = mirror ? a : r.first, second = first === a ? b : a;
  const rounds = mirror ? (first === r.first ? Math.ceil(r.rounds / 2) : Math.floor(r.rounds / 2)) : r.rounds;
  if (!rounds) return null;
  return battleLink({
    title: `${nameOf(first)} vs ${nameOf(second)}${mirror ? ', the games with ' + nameOf(first) + ' first' : ''}`,
    rules: battleRules(),
    seed: r.seed,
    rounds,
    round: 1,
    warriors: [first, second].map((id) => ({ name: nameOf(id), source: sourceOf(id) })),
  });
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
  const r = resOf(a, b), s = standard(b);
  const color = (id) => (S.w.get(id)?.kind === 'member' ? hsl(S.w.get(id).hue) : '#aab0c8');
  $('arena-head').innerHTML = `<span style="color:${color(a)}">● ${esc(nameOf(a))}</span>`
    + (s ? '<span class="mid">not a match of the run</span>' : `<span class="mid">${r.w}/${r.l}/${r.t} in ${r.rounds} rounds · ${points(r).toFixed(0)} points</span>`)
    + `<span style="color:${color(b)}">${esc(s ? s.name : nameOf(b))} ●</span>`;
  renderFoes();
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
  const foe = foeFor(arenaFoe) === 'match' ? worstOpponent(best.id) : foeFor(arenaFoe);
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
  let b = arenaPair?.[1] ?? arenaFoe;
  if (standard(b)) return playArena(id, foeFor(b)); // a standard opponent stays
  if (b === 'match' || b === id || !resOf(id, b)) b = worstOpponent(id);
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
      if (t.sort) sortMatrix(t.axis, t.sort);
      else if (t.battle) autoPick = false, playArena(...t.battle);
      else if (t.select !== undefined) select(t.select);
    });
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('#designs-big')) document.body.classList.toggle('designs-big'), renderDesigns();
    const row = e.target.closest('tr[data-design]'); // the tab Designs: two picked, a third replaces the second
    if (row) {
      const k = row.dataset.design;
      designPick = designPick.includes(k) ? designPick.filter((x) => x !== k) : designPick.length < 2 ? [...designPick, k] : [designPick[0], k];
      renderDesigns();
    }
    const a = e.target.closest('a[data-id]');
    if (a) select(Number(a.dataset.id));
    const b = e.target.closest('button[data-battle]');
    if (b) autoPick = false, playArena(...b.dataset.battle.split(',').map(Number));
  });
  $('arena-big').addEventListener('click', () => document.body.classList.toggle('arena-big'));
  $('arena-foes').addEventListener('click', (e) => { // the opponent: a standard one, or the run's match
    const k = e.target.closest('button[data-foe]')?.dataset.foe;
    if (!k) return;
    arenaFoe = k;
    try { localStorage.setItem('evolver-arena-foe', k); } catch {}
    if (selected === null) return renderFoes();
    autoPick = false;
    if (k === 'match') {
      const b = worstOpponent(selected);
      if (b !== null) playArena(selected, b);
    } else playArena(selected, foeFor(k));
  });
  renderFoes();
  loadStandard();
  $('card').addEventListener('click', (e) => { if (e.target.closest('#card-close')) select(null); });
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    for (const x of $('tabs').querySelectorAll('button')) x.classList.toggle('on', x === b);
    for (const t of document.querySelectorAll('.ticker-panel .tab')) t.hidden = !t.classList.contains(b.dataset.tab);
    chartsDirty = true; // a chart that was hidden has its size only now
    if (b.dataset.tab === 'tab-ops') renderOps();
    if (b.dataset.tab === 'tab-designs') loadDesigns();
    if (b.dataset.tab === 'tab-about') renderAbout();
  });
  $('ops').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-window]');
    if (b) opsWindow = Number(b.dataset.window), renderOps();
  });
  $('c-best').addEventListener('click', () => { if (S.bestId !== null) select(S.bestId); });
  $('c-top').addEventListener('click', () => { const t = strongest(); if (t) select(t.id); });
  window.addEventListener('keydown', (e) => { // ↑ ↓: the warrior above or below in the matrix
    if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
    const order = matrix.order ?? [];
    if (!order.length) return;
    e.preventDefault();
    const at = order.indexOf(selected);
    const next = at < 0 ? (e.key === 'ArrowDown' ? 0 : order.length - 1) : Math.max(0, Math.min(order.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
    if (order[next] !== selected) select(order[next]);
  });
  window.addEventListener('keydown', (e) => { // Esc: the arena back to its place, else no warrior selected
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('arena-big')) document.body.classList.remove('arena-big');
    else if (document.body.classList.contains('designs-big')) document.body.classList.remove('designs-big');
    else select(null);
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
  S.version = (S.version ?? 0) + 1;
  autoPick = true;
  pickBest();
  renderCard();
}

// Events wait and are applied together every `every` seconds (?every=, 2 by
// default, 0 at once): a fast run sends many per second, and a dashboard that
// changes at that rate is noise, and costs CPU the run could use.
const EVERY = 1000 * Math.max(0, Number(new URLSearchParams(location.search).get('every') ?? 2) || 0);
let pending = [], lastApply = -1e9;
let quiet = new Set(); // newcomers that enter and leave within one update: no ticker lines for them

function applyPending(now) {
  const evs = pending;
  pending = [];
  const entered = new Set(evs.filter((e) => e.type === 'enter').map((e) => e.id));
  quiet = new Set(evs.filter((e) => e.type === 'leave' && entered.has(e.id)).map((e) => e.id));
  for (const e of evs) handle(e);
  if (quiet.size) tick(`<span style="color:#6c7290">${quiet.size} more tried and pushed off at once</span>`);
  quiet = new Set();
  lastApply = now;
  S.version = (S.version ?? 0) + 1;
  if (autoPick) pickBest();
  if (selected !== null) renderCard();
}

// The tab Designs (#222): the designs of the islands' folder at its last
// score against the whole opponent folder (42evolve --score-designs), from
// /run/<n>/scores: per design its islands, members, best score and that best
// warrior's score against each kind of hill warrior (where
// tools/hill-kinds.mjs has a cache), with a line of its best score over the
// scores. A click picks a design, a second one another: the two side by
// side, where each is better and the best-of bound. Loaded when the tab
// opens, again every minute while it is open.
let designsData = null, designPick = [], designsTimer = null;
const DESIGN_KINDS = ['paper', 'mover', 'scanner', 'stone', 'fields', 'little'];
async function loadDesigns() {
  clearTimeout(designsTimer);
  const el = $('designs');
  if (el.hidden) return;
  if (new URLSearchParams(location.search).has('log') || !runs.length) {
    el.innerHTML = '<p>The designs come from the scores of a run of islands, served by <code>node tools/serve.mjs --run &lt;folder&gt;</code>.</p>';
    return;
  }
  try {
    designsData = await (await fetch(`/run/${current}/scores`)).json();
  } catch {
    designsData = null;
  }
  renderDesigns();
  designsTimer = setTimeout(loadDesigns, 60000);
}

function sparkline(history, lo, hi) {
  if (history.length < 2) return '';
  const w = 70, h = 16, x0 = history[0].batch, x1 = history.at(-1).batch;
  const pts = history.map((p) => `${(((p.batch - x0) / Math.max(1, x1 - x0)) * (w - 2) + 1).toFixed(1)},${(h - 1 - ((p.score - lo) / Math.max(1e-9, hi - lo)) * (h - 2)).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="#ffc53d" stroke-width="1.3"/></svg>`;
}

function renderDesigns() {
  const el = $('designs'), d = designsData;
  if (!d || !d.scores?.length) {
    el.innerHTML = `<h2>Designs <small>the best member of each design, scored against the whole opponent folder</small></h2><p>No score yet: a run of islands scores its islands every <code>--select-after</code> batches${d && !d.scores ? '' : ''}; a run that is no island has none.</p>`;
    return;
  }
  const last = d.scores.at(-1), rows = designTable(d.scores, d.kinds);
  if (!rows.length) {
    el.innerHTML = `<h2>Designs</h2><p>The score of batch ${fmtInt(last.batch)} has no designs: the run is from before <code>--score-designs</code> (#220), or ran with <code>--score-designs 0</code>.</p>`;
    return;
  }
  const kinds = d.kinds ? DESIGN_KINDS.filter((k) => rows.some((r) => r.kinds[k])) : [];
  const counts = {};
  if (d.kinds) for (const f of last.files) counts[d.kinds[f] ?? ''] = (counts[d.kinds[f] ?? ''] ?? 0) + 1;
  const all = rows.flatMap((r) => r.history.map((h) => h.score)), lo = Math.min(...all), hi = Math.max(...all);
  const cell = (v, ref) => (v === undefined ? '<td>–</td>' : `<td style="color:${rampColor(v, ref.lo, ref.hi)}">${f1(v)}</td>`);
  const range = Object.fromEntries(kinds.map((k) => {
    const vs = rows.map((r) => r.kinds[k]?.mean).filter((v) => v !== undefined);
    return [k, { lo: Math.min(...vs), hi: Math.max(...vs) }];
  }));
  const pickClass = (key) => (designPick[0] === key ? 'pick-a' : designPick[1] === key ? 'pick-b' : '');
  const big = document.body.classList.contains('designs-big');
  let html = `<button id="designs-big" class="designs-big-button" title="${big ? 'back to its place (Esc)' : 'the designs over the whole page (Esc: back)'}">${big ? '⤡ smaller' : '⤢ larger'}</button><h2>Designs <small>batch <b>${fmtInt(last.batch)}</b>: the best member of each design (family and kind of style) against the <b>${fmtInt(last.opponents)}</b> warriors of the folder, ${last.rounds} rounds each${d.kinds ? ', and against each kind of them' : ' · <code>node tools/hill-kinds.mjs &lt;folder&gt;</code> adds the kinds'} · <span class="new">new</span>: not in the score before · click two rows to compare them</small></h2>`;
  html += `<table class="designs-table"><thead><tr><th>design</th><th>islands</th><th>members</th><th>best</th><th>over the scores</th>${kinds.map((k) => `<th title="${counts[k] ?? 0} warriors of the folder">vs ${k}</th>`).join('')}</tr></thead><tbody>`;
  for (const r of rows) {
    html += `<tr data-design="${esc(r.key)}" class="${pickClass(r.key)}"><td>${r.isNew ? '<span class="new">new</span> ' : ''}<b>${esc(r.noun)}</b> ${esc(shortKind(r.kind))}</td><td>${r.islands.join(' ')}</td><td>${r.members}</td><td><b>${f1(r.best.score)}</b></td><td>${sparkline(r.history, lo, hi)}</td>${kinds.map((k) => cell(r.kinds[k]?.mean, range[k])).join('')}</tr>`;
  }
  html += '</tbody></table>';
  const [a, b] = designPick.map((k) => rows.find((r) => r.key === k));
  if (a && b) {
    const c = compareDesigns(a, b, last.files, last.rounds, d.kinds);
    if (c) {
      const kindText = (m) => Object.entries(m).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${n} ${k || 'not measured'}`).join(', ') || 'none';
      const list = (rows, first, second) => rows.slice(0, 8).map((r) => `<li>${esc(r.file.replace(/\.red$/, ''))}${r.kind ? ` <span style="color:#7f86a0">${r.kind}</span>` : ''}: ${f1(r[first])} against ${f1(r[second])}</li>`).join('');
      html += `<div class="designs-compare"><b class="a">${esc(a.noun)} ${esc(shortKind(a.kind))}</b> (${esc(a.best.name ?? `#${a.best.id}`)}, ${f1(a.best.score)}) and <b class="b">${esc(b.noun)} ${esc(shortKind(b.kind))}</b> (${esc(b.best.name ?? `#${b.best.id}`)}, ${f1(b.best.score)}): the better of the two against each opponent averages <b>${f1(c.bound)}</b>, the bound for a warrior made of both.
        <div class="cols"><div><b class="a">${a.noun}</b> better by more than 10 against <b>${c.aBetter.length}</b> (${kindText(c.aKinds)})<ol>${list(c.aBetter, 'a', 'b')}</ol></div>
        <div><b class="b">${b.noun}</b> better by more than 10 against <b>${c.bBetter.length}</b> (${kindText(c.bKinds)})<ol>${list(c.bBetter, 'b', 'a')}</ol></div></div></div>`;
    }
  } else html += '<p class="designs-compare" style="color:#7f86a0">Pick two designs to see where each is better.</p>';
  el.innerHTML = html;
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
    // two parts, each with its heading, also when one is empty: the running runs, then the stopped ones
    const head = (i === 0 ? `<li class="side-part side-first">running · ${running || 'none'}</li>` : '')
      + (i === running ? `<li class="side-part">stopped · ${ordered.length - running}</li>` : '');
    return `${head}<li class="${x.running ? '' : 'stopped'}"><button data-run="${x.index}" class="${x.index === current ? 'on' : ''}" title="${title}">`
      + `<i class="dot${x.running ? ' on' : ''}"></i><span class="nm">${esc(shortName(x.name))}</span><span class="sb">${batch}</span>`
      + `<span class="ag">${age === null ? '' : fmtInt(age)}</span><span class="sc" style="color:${runColor(x.holdout, lo, hi)}">${score}</span></button></li>`;
  }).join('');
  sideWidth(runs.map((x) => shortName(x.name)));
}

// The list as wide as its longest name needs, of all runs (a filter does not
// make it jump), from 220 to 330 px; measured once per set of names.
let sideNames = null;
function sideWidth(names) {
  const key = names.join('\n');
  const nm = document.querySelector('#side-list .nm');
  if (key === sideNames || !nm) return;
  sideNames = key;
  const probe = document.createElement('span');
  probe.className = 'nm nm-probe';
  $('side').append(probe);
  let longest = 0;
  for (const n of new Set(names)) probe.textContent = n, longest = Math.max(longest, probe.getBoundingClientRect().width);
  probe.remove();
  const rest = $('side').getBoundingClientRect().width - nm.getBoundingClientRect().width; // dot, numbers, gaps, scroll bar
  document.body.style.setProperty('--side-w', `${Math.round(Math.min(330, Math.max(220, rest + longest + 4)))}px`);
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
  applyPending(performance.now());
  chartsDirty = chipsDirty = tickerDirty = opsDirty = true;
  renderCard();
}
function switchRun(i) {
  if (i === current && source) return;
  current = i;
  designsData = null, designPick = [];
  if (!$('designs').hidden) loadDesigns();
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
  lastFrame = now;
  if (catchingUp) { // the previous picture stays until the history is in
    requestAnimationFrame(frame);
    return;
  }
  if (pending.length && now - lastApply >= EVERY) applyPending(performance.now());
  // the matrix stands still: drawn again after an update, and at most 15 times a
  // second while the mouse is on it (10,000 cells a frame cost a core)
  const moving = hover?.canvas === $('matrix');
  // taken before drawing: a draw that finds the matrix's note of another
  // height (placeNote()) asks for the next frame, which a reset after it lost
  const dirty = chartsDirty;
  chartsDirty = false;
  if ((moving && now - lastDraw >= 66) || dirty) {
    lastDraw = now;
    drawMatrix(now);
  }
  if (dirty) { // the two charts that do not move on their own
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

window.__evolver = { state: () => S, select, battleUrl, matrix: () => matrix, drawMatrix: () => drawMatrix(performance.now()) }; // for debugging and screenshots
main();
