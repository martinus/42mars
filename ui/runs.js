// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Several 42evolve runs side by side: `node tools/serve.mjs --run a b c ...`
// streams each run's events (/run/<n>/events, the list at /runs). A chart of
// the best against the holdout and against the panel over the minutes of
// each run (the fair axis when runs share a machine), and a table with what
// differs and where each run stands. ui/evolver.html?run=<n> is one run.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const COLORS = ['#ffc53d', '#36d6ff', '#ff5a8a', '#7dff6a', '#b18cff', '#ff8a3d', '#3dffc5', '#ff6bd8'];
const f1 = (x) => (x === null || x === undefined || x < 0 ? '–' : x.toFixed(1));

const runs = [];
let dirty = true;

function fresh(r) {
  Object.assign(r, {
    start: null, minutes: 0, batches: 0, evaluated: 0, speed: null,
    members: new Map(), alive: new Set(), panelIds: new Set(),
    bestHoldout: null, bestPanel: null, holdout: [], panel: [],
  });
}

function handle(r, e) {
  switch (e.type) {
    case 'start':
      fresh(r);
      r.start = e;
      r.panelIds = new Set(e.panel.map((p) => p.id));
      break;
    case 'rotate':
      r.panelIds.delete(e.out);
      r.panelIds.add(e.panel.id);
      break;
    case 'enter':
      r.members.set(e.id, { id: e.id, name: e.name ?? `e${e.id}`, code: e.code, panelAvg: null });
      r.alive.add(e.id);
      break;
    case 'leave':
      r.alive.delete(e.id);
      break;
    case 'values': {
      let best = null;
      for (const [id, , , , , pAvg] of e.values) {
        const m = r.members.get(id);
        if (!m) continue;
        m.panelAvg = pAvg;
        if (r.alive.has(id) && (!best || pAvg > best.panelAvg)) best = m;
      }
      if (best) {
        r.bestPanel = best;
        r.panel.push([r.minutes, best.panelAvg]);
      }
      break;
    }
    case 'bench':
      if (!r.bestHoldout || e.avg > r.bestHoldout.avg) r.bestHoldout = { avg: e.avg, name: r.members.get(e.id)?.name ?? `#${e.id}`, batch: e.batch };
      r.holdout.push([r.minutes, r.bestHoldout.avg]);
      break;
    case 'batch':
      r.batches++;
      r.evaluated += e.evaluated;
      break;
    case 'speed':
      r.minutes += e.seconds / 60;
      r.speed = e;
      break;
    default:
  }
  dirty = true;
}

// The list now: families, opcodes and how often a mode is direct ($), from
// the code text of the members.
function composition(r) {
  const fams = new Map(), ops = new Map();
  let n = 0, direct = 0, modes = 0;
  for (const id of r.alive) {
    const m = r.members.get(id);
    const fam = m.name.split(' ')[1] ?? m.name;
    fams.set(fam, (fams.get(fam) ?? 0) + 1);
    for (const line of m.code.split('\n')) {
      const x = /^\s*([A-Z]{3})(?:\.[A-Z]+)?\s+(\S)\S*,\s*(\S)/.exec(line);
      if (!x || x[1] === 'ORG') continue;
      ops.set(x[1], (ops.get(x[1]) ?? 0) + 1);
      n++;
      direct += (x[2] === '$') + (x[3] === '$');
      modes += 2;
    }
  }
  const top = (map, total, k) => [...map].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, c]) => `${name} ${Math.round((100 * c) / total)}%`).join(', ');
  return { families: fams.size, topFamily: top(fams, r.alive.size || 1, 2), ops: top(ops, n || 1, 4), direct: modes ? (100 * direct) / modes : null };
}

// The settings in which the runs differ.
function differences() {
  const started = runs.filter((r) => r.start);
  const keys = new Set(started.flatMap((r) => Object.keys(r.start.params)));
  const differ = [...keys].filter((k) => new Set(started.map((r) => JSON.stringify(r.start.params[k]))).size > 1);
  if (new Set(started.map((r) => r.start.start ?? '')).size > 1) differ.push('start');
  return (r) => (r.start ? differ.map((k) => `${k} ${k === 'start' ? r.start.start || '–' : r.start.params[k]}`).join(' · ') || 'the same settings' : '');
}

// ------------------------------------------------------------------ drawing

function fit(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) canvas.width = Math.round(w * dpr), canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function drawChart() {
  const { ctx, w, h } = fit($('chart'));
  const left = 40, right = 16, top = 12, bottom = 26;
  const maxX = Math.max(1, ...runs.map((r) => r.minutes));
  const maxY = Math.max(150, Math.ceil(Math.max(0, ...runs.flatMap((r) => [...r.holdout, ...r.panel].map((p) => p[1]))) / 50) * 50);
  const X = (t) => left + (t / maxX) * (w - left - right), Y = (v) => h - bottom - (v / maxY) * (h - top - bottom);
  ctx.font = '11px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = '#1c2033';
  for (let v = 0; v <= maxY; v += 50) {
    ctx.beginPath();
    ctx.moveTo(left, Y(v));
    ctx.lineTo(w - right, Y(v));
    ctx.stroke();
    ctx.fillStyle = '#6c7290';
    ctx.fillText(String(v), 6, Y(v));
  }
  const step = maxX > 120 ? 30 : maxX > 40 ? 10 : 5;
  for (let t = 0; t <= maxX; t += step) {
    ctx.fillStyle = '#6c7290';
    ctx.fillText(`${t} min`, X(t) - 10, h - 10);
  }
  ctx.setLineDash([]);
  for (const r of runs) {
    ctx.strokeStyle = r.color;
    for (const [series, dash, width] of [[r.panel, [5, 4], 1.4], [r.holdout, [], 2.2]]) {
      if (!series.length) continue;
      ctx.setLineDash(dash);
      ctx.lineWidth = width;
      ctx.beginPath();
      series.forEach(([t, v], i) => {
        if (!i) ctx.moveTo(X(t), Y(v));
        else if (!dash.length) ctx.lineTo(X(t), Y(series[i - 1][1])), ctx.lineTo(X(t), Y(v)); // steps: best so far
        else ctx.lineTo(X(t), Y(v));
      });
      ctx.lineTo(X(r.minutes), Y(series.at(-1)[1]));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}

function drawTable() {
  const diff = differences();
  const rows = runs.map((r) => ({ r, c: composition(r) }));
  const best = (vals) => Math.max(...vals.filter((v) => v !== null && v !== undefined && v >= 0));
  const lead = (v, all) => (v !== null && v !== undefined && v === best(all) && runs.length > 1 ? ' class="lead"' : '');
  const hold = rows.map(({ r }) => r.bestHoldout?.avg ?? -1), pan = rows.map(({ r }) => r.bestPanel?.panelAvg ?? -1);
  const cps = rows.map(({ r }) => (r.minutes ? r.evaluated / (r.minutes * 60) : -1));
  const line = (label, cells) => `<tr><th>${label}</th>${cells.join('')}</tr>`;
  $('table').innerHTML = `<table class="runs"><thead><tr><th></th>${rows.map(({ r }) => `<th><a href="evolver.html?run=${r.index}" target="_blank" style="color:${r.color}">${esc(r.name)}</a></th>`).join('')}</tr></thead><tbody>
    ${line('differs in', rows.map(({ r }) => `<td class="sub">${esc(diff(r))}</td>`))}
    ${line('best vs holdout', rows.map(({ r }, i) => `<td${lead(hold[i], hold)}>${f1(r.bestHoldout?.avg)} <span class="sub">${esc(r.bestHoldout?.name ?? '')}</span></td>`))}
    ${line('best vs panel now', rows.map(({ r }, i) => `<td${lead(pan[i], pan)}>${f1(r.bestPanel?.panelAvg)} <span class="sub">${esc(r.bestPanel?.name ?? '')}</span></td>`))}
    ${line('minutes, batches', rows.map(({ r }) => `<td>${r.minutes.toFixed(1)} min, ${r.batches}</td>`))}
    ${line('candidates', rows.map(({ r }, i) => `<td>${r.evaluated.toLocaleString('en-US')} <span class="sub">${cps[i] >= 0 ? `${cps[i].toFixed(1)}/s` : ''}${r.speed ? `, ${(100 * r.speed.busy).toFixed(0)}% of ${r.speed.threads} threads` : ''}</span></td>`))}
    ${line('families in the list', rows.map(({ c }) => `<td>${c.families} <span class="sub">${esc(c.topFamily)}</span></td>`))}
    ${line('opcodes of the list', rows.map(({ c }) => `<td>${esc(c.ops)}</td>`))}
    ${line('direct $ modes', rows.map(({ c }) => `<td>${c.direct === null ? '–' : `${c.direct.toFixed(0)}%`}</td>`))}
  </tbody></table>`;
  $('legend').innerHTML = runs.map((r) => `<span style="color:${r.color}"><i style="background:${r.color}"></i>${esc(r.name)}</span>`).join('');
  $('info').textContent = `${runs.length} runs`;
}

let lastTable = 0;
function frame(now) {
  if (dirty) {
    dirty = false;
    drawChart();
    if (now - lastTable > 1000) lastTable = now, drawTable();
    else dirty = true;
  }
  requestAnimationFrame(frame);
}

async function main() {
  const list = await (await fetch('/runs')).json();
  for (const { index, name } of list) {
    const r = { index, name, color: COLORS[index % COLORS.length] };
    fresh(r);
    runs.push(r);
    const source = new EventSource(`/run/${index}/events`);
    source.addEventListener('reset', () => { fresh(r); dirty = true; });
    source.onopen = () => $('live').classList.add('on');
    source.onmessage = (e) => handle(r, JSON.parse(e.data));
  }
  new ResizeObserver(() => { dirty = true; }).observe(document.body);
  requestAnimationFrame(frame);
}

window.__runs = () => runs; // for debugging and screenshots
main();
