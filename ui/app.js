// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

import { assemble } from '../js/assembler.js';
import { Mars } from '../js/mars.js';
import { formatInstruction, formatListing, OP, OPCODES } from '../js/opcodes.js';
import { Renderer, TEX_W } from './renderer.js';
import { computeLayout, addressAt, cellCenter, LAYOUT_GRID, LAYOUT_RING } from './layout.js';
import { Timeline } from './timeline.js';
import { Overlay } from './overlay.js';
import { ActivityTracker, ACTIVITIES, ACTIVITY_LABELS, ACTIVITY_SENTENCES, OPCODE_DOCS, explainStep, traceEntry, pad4 } from './explain.js';

// ------------------------------------------------------------------ config

const SAMPLES = ['lantern', 'origami', 'seeker', 'dwarf', 'imp'];
const DEFAULT_CAST = ['lantern', 'origami'];

const PRESETS = {
  standard: { label: "'94 · 8000", coreSize: 8000, maxCycles: 80000, maxProcesses: 8000, maxLength: 100, minDistance: 100 },
  tiny: { label: 'tiny · 800', coreSize: 800, maxCycles: 8000, maxProcesses: 800, maxLength: 20, minDistance: 20 },
  nano: { label: 'nano · 80', coreSize: 80, maxCycles: 800, maxProcesses: 80, maxLength: 5, minDistance: 5 },
  lp: { label: 'LP · 8 procs', coreSize: 8000, maxCycles: 80000, maxProcesses: 8, maxLength: 200, minDistance: 200 },
  big: { label: 'big · 55440', coreSize: 55440, maxCycles: 500000, maxProcesses: 10000, maxLength: 200, minDistance: 200 },
};

// instructions per second; Infinity runs as much as fits into the frame budget
const SPEEDS = [1, 2, 5, 10, 25, 60, 150, 400, 1000, 2500, 6000, 15000, 40000, 100000, 250000, 600000, Infinity];

const PALETTE_HEX = ['#ff4f6d', '#36d6ff', '#ffc53d', '#7dff6a', '#b18cff', '#ff8a3d', '#3dffc5', '#ff6bd8'];
const PALETTE = PALETTE_HEX.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
const PALETTE_CSV = PALETTE.map(([r, g, b]) => `${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}`);
const PALETTE_RGB = PALETTE_CSV.map((c) => `rgb(${c})`);
const ACTIVITY_COLORS = { bomb: '#e8735a', clear: '#e8b45a', copy: '#5ac8e8', scan: '#9b8cff', split: '#7ddc7a', imp: '#d0d4e4', loop: '#3a4060' };
const SLOW = 25; // instructions per second at or below which every step is explained

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (n) => n.toLocaleString('en-US');

// ------------------------------------------------------------------ state

const state = {
  preset: 'standard',
  rounds: 10,
  library: new Map(), // key -> { name, source }
  slots: [], // { key, source, result }
  mars: null,
  running: false,
  speedIdx: 11,
  acc: 0,
  layoutKind: LAYOUT_RING,
  footprints: true, // F: cells read by another warrior, or only incremented, this round
  layout: null,
  dpr: 1,
  hover: -1,
  mouse: null,
  heatW: null,
  heatE: null,
  heatR: null,
  dataA: null,
  dataB: null,
  lastTime: 0,
  decay: 0.9,
  shocks: [],
  roundHandled: true,
  matchOver: false,
  nextRoundAt: 0,
  lastUi: 0,
  lastSource: 0,
  arcs: [],
  tracker: null,
  lastTrace: 0,
  stances: [],
  firstHits: new Set(),
  causes: [],
  focus: null,
  lastStance: 0,
  explained: -1,
};

const renderer = (() => {
  try {
    return new Renderer($('core'));
  } catch (e) {
    $('stage').innerHTML = `<div class="banner"><div class="t2" style="color:#ff7b7b">No WebGL2</div><div class="t3">${esc(e.message)}</div></div>`;
    throw e;
  }
})();
const timeline = new Timeline($('timeline'));
const overlay = new Overlay($('overlay'));

// ------------------------------------------------------------------ warriors

async function loadSamples() {
  await Promise.all(SAMPLES.map(async (key) => {
    const res = await fetch(`../warriors/${key}.red`);
    const source = await res.text();
    state.library.set(key, { name: assemble(source).name, source });
  }));
}

function options() {
  const p = PRESETS[state.preset];
  return { ...p, rounds: state.rounds, warriors: state.slots.length };
}

function assembleSlots() {
  for (const s of state.slots) {
    s.result = assemble(s.source, options());
    s.result.source = s.source; // the tooltip shows source lines
  }
}

function setSlot(i, key) {
  const entry = state.library.get(key);
  state.slots[i] = { key, source: entry.source, result: null };
}

function addToLibrary(fileName, source) {
  let key = `file:${fileName}`;
  for (let k = 2; state.library.has(key) && state.library.get(key).source !== source; k++) key = `file:${fileName}#${k}`;
  state.library.set(key, { name: assemble(source).name || fileName, source });
  return key;
}

// ------------------------------------------------------------------ match control

function restartMatch() {
  assembleSlots();
  renderCards();
  renderPlaybill();
  const bad = state.slots.filter((s) => !s.result.ok);
  state.matchOver = false;
  if (bad.length || state.slots.length === 0) {
    state.mars = null;
    showBanner('Cannot start', bad.length ? `${bad.map((s) => s.result.name).join(', ')} did not assemble` : 'no warriors', '#ff7b7b');
    return;
  }
  const opts = options();
  try {
    state.mars = new Mars(opts);
    state.mars.load(state.slots.map((s) => s.result));
  } catch (e) {
    state.mars = null;
    showBanner('Cannot start', e.message, '#ff7b7b');
    return;
  }
  const n = opts.coreSize;
  const rows = Math.ceil(n / TEX_W);
  state.heatW = new Float32Array(n);
  state.heatE = new Float32Array(n);
  state.heatR = new Float32Array(n);
  state.dataA = new Uint8Array(rows * TEX_W * 4);
  state.dataB = new Uint8Array(rows * TEX_W * 4);
  relayout();
  nextRound();
}

function nextRound() {
  const m = state.mars;
  if (!m) return;
  if (m.round >= state.rounds) {
    state.matchOver = true;
    showFinal();
    return;
  }
  m.startRound();
  state.heatW.fill(0);
  state.heatE.fill(0);
  state.heatR.fill(0);
  state.lastTime = 0;
  state.acc = 0;
  state.shocks = [];
  state.roundHandled = false;
  timeline.reset(m.warriors.length, m.cyclesLeft, m.opt.maxProcesses);
  sampleTimeline();
  state.tracker = new ActivityTracker(m.warriors.length, m.coreSize);
  state.arcs = [];
  state.lastTrace = 0;
  state.firstHits = new Set();
  state.stances = m.warriors.map(() => ({ reported: null, candidate: null, tasks: 1 }));
  state.causes = m.warriors.map(() => null);
  state.explained = -1;
  story(`<b>Round ${m.round}.</b> ` + m.warriors.map((w) => `${who(w.index)} starts at ${pad4(w.position)}`).join(', ') + '.', -1, m.warriors[0].position);
  showBanner(`Round ${m.round} of ${state.rounds}`, m.warriors.map((w) => w.name).join('  vs  '), '#f4f6ff', 1400, '', true);
  renderCards();
}

function onRoundEnd() {
  const m = state.mars;
  state.roundHandled = true;
  sampleTimeline();
  const r = m.roundResult;
  if (m.warriors.length > 1 && r.survivors.length === 1) {
    const w = m.warriors[r.survivors[0]];
    showBanner(`Round ${r.round}`, `${w.name} wins`, PALETTE_HEX[w.index % 8], 2600, `after ${fmt(r.cycles)} cycles`);
  } else if (m.warriors.length > 1) {
    showBanner(`Round ${r.round}`, 'Tie', '#f4f6ff', 2600, `${r.survivors.length} survivors after ${fmt(r.cycles)} cycles`);
  } else {
    showBanner(`Round ${r.round}`, r.survivors.length ? 'Survived' : 'Died', '#f4f6ff', 2600, `${fmt(r.cycles)} cycles`);
  }
  state.nextRoundAt = performance.now() + 2800;
  updateUi(true);
}

function showFinal() {
  const m = state.mars;
  const ws = [...m.warriors].sort((a, b) => (b.wins * 3 + b.ties) - (a.wins * 3 + a.ties));
  const top = ws[0];
  const sub = m.warriors.map((w) => `${w.name} ${w.wins}W ${w.losses}L ${w.ties}T`).join('   ');
  const tie = ws.length > 1 && ws[1].wins * 3 + ws[1].ties === top.wins * 3 + top.ties;
  showBanner('Final', tie ? 'Draw' : `${top.name} takes the match`, tie ? '#f4f6ff' : PALETTE_HEX[top.index % 8], 0, sub);
  setRunning(false);
}

// ------------------------------------------------------------------ per-frame update

function step(n) {
  const m = state.mars;
  if (!m || m.roundOver) return;
  m.run(n);
}

function advance(dt) {
  const m = state.mars;
  if (!m || !state.running) return;
  if (m.roundOver) {
    if (!state.matchOver && performance.now() >= state.nextRoundAt) nextRound();
    return;
  }
  const speed = SPEEDS[state.speedIdx];
  if (speed === Infinity) {
    const t0 = performance.now();
    while (!m.roundOver && performance.now() - t0 < 11) m.run(20000);
  } else {
    state.acc += speed * dt;
    const n = Math.floor(state.acc);
    state.acc -= n;
    if (n > 0) m.run(n);
  }
}

function consumeEvents(now) {
  const m = state.mars;
  if (!m) return;
  let kills = 0;
  for (const e of m.events) {
    if (e.type === 'death') {
      state.shocks.push({ addr: e.addr, warrior: e.warrior, born: now, dur: 1.8, big: true });
      timeline.mark(e.time, e.warrior);
      const cause = deathCause(m, e);
      state.causes[e.warrior] = cause;
      story(`${who(e.warrior)} is out: its last process ${cause}.`, e.warrior, e.addr);
      toast(`<b style="color:${PALETTE_HEX[e.warrior % 8]}">${esc(m.warriors[e.warrior].name)}</b> <span>is out at cycle ${fmt(e.time)}</span>`, PALETTE_HEX[e.warrior % 8]);
      continue;
    }
    if (kills < 4) {
      kills++;
      state.shocks.push({ addr: e.addr, warrior: e.warrior, born: now, dur: 0.6, big: false });
    }
    const killer = m.op[e.addr] >> 3 === OP.DAT ? m.owner[e.addr] : -1;
    const key = `${killer}>${e.warrior}`;
    if (killer >= 0 && killer !== e.warrior && !state.firstHits.has(key)) {
      state.firstHits.add(key);
      story(`${who(killer)} hits ${who(e.warrior)} for the first time: a process ran into its DAT at ${pad4(e.addr)}.`, killer, e.addr);
    }
  }
  m.events.length = 0;
  state.shocks = state.shocks.filter((s) => (now - s.born) / 1000 < s.dur).slice(-24);
}

function updateTextures() {
  const m = state.mars;
  const n = m.coreSize;
  const { heatW, heatE, heatR, dataA: A, dataB: B } = state;
  const t = m.time;
  const prev = state.lastTime;
  if (t !== prev) {
    const d = state.decay;
    for (let i = 0; i < n; i++) {
      heatW[i] = m.tWrite[i] > prev ? 1 : heatW[i] * d;
      heatE[i] = m.tExec[i] > prev ? 1 : heatE[i] * d;
      heatR[i] = m.tRead[i] > prev ? 1 : heatR[i] * d;
    }
    state.lastTime = t;
  }
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    A[j] = m.owner[i] + 1;
    A[j + 1] = m.op[i];
    A[j + 2] = heatW[i] * 255;
    A[j + 3] = heatE[i] * 255;
    B[j] = heatR[i] * 255;
    B[j + 1] = m.execBy[i] + 1;
    B[j + 2] = 0;
    B[j + 3] = (m.readBy[i] + 1) | ((m.bump[i] + 1) << 4) | (state.footprints ? 64 : 0);
  }
  for (const w of m.warriors) {
    if (!w.tasks) continue;
    const cap = w.queue.length;
    for (let k = 0, q = w.head; k < w.tasks; k++, q = q + 1 === cap ? 0 : q + 1) {
      B[w.queue[q] * 4 + 2] = w.index + 1;
    }
  }
  if (!m.roundOver && m.current >= 0) {
    const c = m.warriors[m.current];
    B[c.queue[c.head] * 4 + 2] = (c.index + 1) | 128;
  }
  renderer.upload(A, B, n);
}

function sampleTimeline() {
  const m = state.mars;
  timeline.push(m.time, m.warriors.map((w) => w.tasks), m.warriors.map((w) => w.territory));
}

function frame(nowMs) {
  const now = nowMs;
  const dt = Math.min(0.1, (now - (state.prevFrame ?? now)) / 1000);
  state.prevFrame = now;
  const m = state.mars;
  if (m) {
    advance(dt);
    consumeTrace(now);
    consumeEvents(now);
    if (m.roundOver && !state.roundHandled) onRoundEnd();
    updateTextures();
    sampleTimeline();
    const L = state.layout;
    const shocks = state.shocks.map((s) => {
      const c = cellCenter(L, s.addr);
      return { x: c.x, y: c.y, age: Math.min(1, (now - s.born) / 1000 / s.dur), warrior: s.warrior % 8, big: s.big };
    });
    renderer.render(L, { time: now / 1000, palette: PALETTE, hover: state.hover, shocks, dpr: state.dpr });
    drawOverlay(now);
    if (!(now - state.lastStance < 600)) { state.lastStance = now; checkStances(); }
    if (!(now - state.lastUi < 100)) { state.lastUi = now; updateUi(); }
    if (!(now - state.lastSource < 140)) { state.lastSource = now; updateSourceHeat(); }
    timeline.draw(PALETTE_RGB, m.time, m.coreSize);
    if (state.mouse) updateTooltip();
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ learning aids

const distance = (a, b, n) => Math.min(Math.abs(a - b), n - Math.abs(a - b));
const who = (i) => `<b style="color:${PALETTE_HEX[i % 8]}">${esc(state.mars.warriors[i].name)}</b>`;

// Reads the simulator's trace since the last frame: feeds the activity
// tracker and creates arcs for the newest instructions.
function consumeTrace(now) {
  const m = state.mars;
  if (!m.traceSize) return;
  if (m.time < state.lastTrace) state.lastTrace = 0;
  const from = Math.max(state.lastTrace + 1, m.time - m.traceSize + 1, 1);
  const speed = SPEEDS[state.speedIdx];
  const slow = speed <= SLOW || !state.running;
  const life = slow ? 1.8 : speed <= 2500 ? 0.9 : 0.45;
  const arcStart = Math.max(from, m.time - (slow ? 59 : 24));
  for (let t = from; t <= m.time; t++) {
    const e = traceEntry(m, t);
    state.tracker.add(m, e);
    if (t < arcStart) continue;
    const far = (x) => distance(x, e.pc, m.coreSize) > (slow ? 0 : 1);
    const arc = (to, kind) => state.arcs.push({ from: e.pc, to, kind, warrior: e.warrior, born: now, life, t });
    if (e.wrote && far(e.b)) arc(e.b, 'write');
    if (e.jumped && far(e.a)) arc(e.a, 'jump');
    if (e.op === OP.CMP || e.op === OP.SEQ || e.op === OP.SNE || e.op === OP.SLT) {
      if (far(e.a)) arc(e.a, 'read');
      if (far(e.b)) arc(e.b, 'read');
    }
  }
  state.lastTrace = m.time;
  state.tracker.decay(0.985);
  state.arcs = state.arcs.filter((a) => held(a, m) || now - a.born < a.life * 1000).slice(-260);
}

// While paused, the lines of the last instruction stay until the next step.
const held = (a, m) => !state.running && a.t === m.time;

function explaining() {
  const m = state.mars;
  return m && m.time > 0 && (SPEEDS[state.speedIdx] <= SLOW || !state.running);
}

function drawOverlay(now) {
  const m = state.mars;
  const tags = [];
  if (explaining()) {
    const e = traceEntry(m, m.time);
    const col = PALETTE_HEX[e.warrior % 8];
    tags.push({ addr: e.pc, text: 'PC', color: col });
    const ins = m.cell(e.pc);
    if (ins.aMode !== 0) tags.push({ addr: e.a, text: 'A', color: col });
    if (ins.bMode !== 0 || e.b !== e.pc) tags.push({ addr: e.b, text: 'B', color: col });
    if (state.explained !== m.time) {
      state.explained = m.time;
      const x = explainStep(m, e);
      const box = $('explainer');
      box.style.setProperty('--c', col);
      box.innerHTML =
        `<div class="head"><span>cycle ${fmt(e.time)}</span><span>${who(e.warrior)} at ${pad4(e.pc)}</span></div>` +
        `<div class="ins">${esc(x.instruction)}</div><div class="what">${esc(x.what)}</div>` +
        (x.how ? `<div class="how">${esc(x.how)}</div>` : '') + `<div class="doc">${esc(x.doc)}</div>`;
      box.hidden = false;
    }
  } else if (!$('explainer').hidden) {
    $('explainer').hidden = true;
    state.explained = -1;
  }
  const arcs = state.arcs.map((a) => ({ ...a, age: held(a, m) ? 0 : Math.min(1, (now - a.born) / (a.life * 1000)) }));
  let focus = null;
  if (state.focus && now - state.focus.born < 2500) focus = { addr: state.focus.addr, phase: (now - state.focus.born) / 1000 };
  overlay.draw({ L: state.layout, m, arcs, tags, colors: PALETTE_CSV, dpr: state.dpr, focus, cellText: true });
}

function deathCause(m, e) {
  const op = m.op[e.addr] >> 3;
  if (op === OP.DIV || op === OP.MOD) return `divided by zero at ${pad4(e.addr)}`;
  const owner = m.owner[e.addr];
  if (owner < 0) return `ran into empty core at ${pad4(e.addr)}`;
  if (owner === e.warrior) return `executed its own DAT at ${pad4(e.addr)}`;
  return `ran into a DAT from ${who(owner)} at ${pad4(e.addr)}`;
}

// Reports when a warrior's dominant activity changes, and process milestones.
function checkStances() {
  const m = state.mars;
  if (!m || !state.tracker || m.roundOver) return;
  m.warriors.forEach((w, i) => {
    const st = state.stances[i];
    if (!w.tasks) return;
    for (const level of [8, 64, 512, 4096]) {
      if (st.tasks < level && w.tasks >= level) story(`${who(i)} now runs ${fmt(level)} processes.`, i, w.queue[w.head]);
    }
    st.tasks = Math.max(st.tasks, w.tasks);
    const s = state.tracker.stance(i);
    if (!s || s === st.reported) { st.candidate = null; return; }
    if (st.candidate === s) {
      story(`${who(i)} is ${st.reported ? 'now ' : ''}${ACTIVITY_LABELS[s]}: it ${ACTIVITY_SENTENCES[s]}.`, i, w.queue[w.head]);
      st.reported = s;
      st.candidate = null;
    } else {
      st.candidate = s;
    }
  });
}

function story(html, warrior, addr) {
  const m = state.mars;
  const li = document.createElement('li');
  if (warrior >= 0) li.style.setProperty('--c', PALETTE_HEX[warrior % 8]);
  if (addr >= 0) li.dataset.addr = addr;
  li.innerHTML = `<span class="t">${m ? fmt(m.time) : ''}</span>${html}`;
  const list = $('story');
  list.prepend(li);
  while (list.children.length > 60) list.lastChild.remove();
}

// ------------------------------------------------------------------ layout & input

function relayout() {
  const canvas = $('core');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  state.dpr = dpr;
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  renderer.resize(w, h);
  overlay.resize(w, h);
  if (!state.mars) return;
  state.layout = computeLayout(state.layoutKind, state.mars.coreSize, w, h);
  const cc = $('center-clock');
  if (state.layoutKind === LAYOUT_RING) {
    cc.classList.remove('corner');
    cc.style.left = `${state.layout.cx / dpr}px`;
    cc.style.top = `${state.layout.cy / dpr}px`;
  } else {
    cc.classList.add('corner');
    cc.style.left = '12px';
    cc.style.top = '8px';
  }
  $('lay-ring').classList.toggle('active', state.layoutKind === LAYOUT_RING);
  $('lay-grid').classList.toggle('active', state.layoutKind === LAYOUT_GRID);
}

function updateTooltip() {
  const m = state.mars;
  const tip = $('tooltip');
  const { x, y } = state.mouse;
  const a = addressAt(state.layout, x * state.dpr, y * state.dpr);
  state.hover = a;
  if (a < 0 || !m) {
    tip.hidden = true;
    return;
  }
  const c = m.cell(a);
  const owner = m.owner[a];
  const org = m.origin[a];
  let from = '';
  if (org >= 0) {
    const w = m.warriors[org >> 16];
    const ins = w.code.instructions[org & 0xffff];
    const srcLine = w.code.source?.split(/\r\n|\n|\r/)[ins.line - 1] ?? '';
    from = `<div><span class="k">from</span> <span style="color:${PALETTE_HEX[w.index % 8]}">${esc(w.name)}</span> line ${ins.line}</div>` +
      `<div class="k">${esc(srcLine.trim().slice(0, 48))}</div>`;
  }
  const ago = (arr) => (arr[a] > 0 ? `${fmt(m.time - arr[a])} cycles ago` : 'never');
  let procs = 0;
  for (const w of m.warriors) {
    const cap = w.queue.length;
    for (let k = 0, q = w.head; k < w.tasks; k++, q = q + 1 === cap ? 0 : q + 1) if (w.queue[q] === a) procs++;
  }
  const procAt = new Set();
  for (const w of m.warriors) {
    const cap = w.queue.length;
    for (let k = 0, q = w.head; k < w.tasks; k++, q = q + 1 === cap ? 0 : q + 1) procAt.add(w.queue[q]);
  }
  const rows = [];
  for (let d = -4; d <= 4; d++) {
    const x = (a + d + m.coreSize) % m.coreSize;
    const cx = m.cell(x);
    const o = m.owner[x];
    rows.push(`<div class="${d === 0 ? 'cur' : ''}"><span class="own" style="background:${o >= 0 ? PALETTE_HEX[o % 8] : 'transparent'}"></span>` +
      `<span class="addr">${pad4(x)}</span><span>${esc(formatInstruction(cx.op, cx.mod, cx.aMode, cx.aVal, cx.bMode, cx.bVal, m.coreSize))}</span>` +
      `${procAt.has(x) ? '<span style="color:#ffc53d">●</span>' : ''}</div>`);
  }
  tip.innerHTML =
    `<div class="k">address ${a}${owner >= 0 ? ` · written by <span style="color:${PALETTE_HEX[owner % 8]}">${esc(m.warriors[owner].name)}</span>` : ''}</div>` +
    `<div class="ins">${esc(formatInstruction(c.op, c.mod, c.aMode, c.aVal, c.bMode, c.bVal, m.coreSize))}</div>` +
    `<div class="doc">${esc(OPCODE_DOCS[OPCODES[c.op]])}</div>` +
    from +
    `<div><span class="k">write</span> ${ago(m.tWrite)} <span class="k">· exec</span> ${ago(m.tExec)}</div>` +
    (procs ? `<div><span class="k">processes here</span> ${procs}</div>` : '') +
    `<div class="listing">${rows.join('')}</div>`;
  const stage = $('stage').getBoundingClientRect();
  tip.hidden = false;
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  tip.style.left = `${Math.min(stage.width - tw - 8, x + 16)}px`;
  tip.style.top = `${Math.min(stage.height - th - 8, y + 16)}px`;
}

// ------------------------------------------------------------------ DOM: cards, HUD

function renderPlaybill() {
  $('playbill').innerHTML = state.slots
    .map((s, i) => `<span style="color:${PALETTE_HEX[i % 8]}">${esc(s.result?.name ?? s.key)}</span>`)
    .join('<span class="vs">vs</span>');
}

function renderCards() {
  const m = state.mars;
  const cards = $('cards');
  cards.innerHTML = '';
  state.slots.forEach((slot, i) => {
    const r = slot.result;
    const c = PALETTE_HEX[i % 8];
    const card = document.createElement('div');
    card.className = 'card';
    card.style.setProperty('--c', c);
    const options = [...state.library.entries()]
      .map(([k, v]) => `<option value="${esc(k)}"${k === slot.key ? ' selected' : ''}>${esc(v.name)}</option>`).join('');
    const custom = state.library.has(slot.key) ? '' : `<option value="${esc(slot.key)}" selected>${esc(r?.name ?? 'edited')}</option>`;
    const codeLines = new Set(r?.ok ? r.instructions.map((x) => x.line) : []);
    const src = slot.source.split(/\r\n|\n|\r/);
    card.innerHTML = `
      <div class="card-head">
        <span class="name" title="${esc(r?.name ?? '')}">${esc(r?.name ?? '?')}</span>
        <select data-slot="${i}" title="Choose warrior">${custom}${options}</select>
        <button data-edit="${i}" title="Edit source">edit</button>
        ${state.slots.length > 1 ? `<button data-remove="${i}" title="Remove">✕</button>` : ''}
      </div>
      <div class="card-head" style="padding-top:0"><span class="by">by ${esc(r?.author ?? '')}${r?.ok ? ` · ${r.instructions.length} instructions` : ''}</span></div>
      ${r && r.strategy ? `<div class="strategy">${esc(r.strategy)}</div>` : ''}
      ${r && !r.ok ? `<div class="errors">${r.errors.slice(0, 6).map((e) => `line ${e.line ?? '-'}: ${esc(e.text)}`).join('\n')}</div>` : ''}
      <div class="stats">
        <div class="stat"><div class="v" data-k="tasks">–</div><div class="l">processes</div></div>
        <div class="stat"><div class="v" data-k="terr">–</div><div class="l">core</div></div>
        <div class="stat"><div class="v" data-k="wlt">–</div><div class="l">W/L/T</div></div>
        <div class="stat"><div class="v" data-k="status">–</div><div class="l">status</div></div>
      </div>
      <div class="bar"><div data-k="bar"></div></div>
      <div class="activity"><div class="sentence" data-k="stance"></div><div class="mixbar" data-k="mix"></div><div class="mixlegend" data-k="mixlegend"></div></div>
      <pre class="source">${src.map((line, k) => `<div data-line="${k + 1}"${codeLines.has(k + 1) ? ' class="code"' : ''}><span class="n">${k + 1}</span>${esc(line)}</div>`).join('')}</pre>`;
    cards.appendChild(card);
  });
  cards.querySelectorAll('select[data-slot]').forEach((sel) => sel.addEventListener('change', () => {
    setSlot(Number(sel.dataset.slot), sel.value);
    restartMatch();
  }));
  cards.querySelectorAll('button[data-edit]').forEach((b) => b.addEventListener('click', () => openEditor(Number(b.dataset.edit))));
  cards.querySelectorAll('button[data-remove]').forEach((b) => b.addEventListener('click', () => {
    state.slots.splice(Number(b.dataset.remove), 1);
    restartMatch();
  }));
  $('add-warrior').disabled = state.slots.length >= 8;
  if (m) updateUi(true);
}

function updateUi(force) {
  const m = state.mars;
  if (!m) return;
  $('round-label').textContent = `round ${m.round}/${state.rounds}`;
  $('cycle-label').textContent = `cycle ${fmt(m.time)}`;
  const total = m.time + m.cyclesLeft;
  $('budget-bar').style.width = `${(100 * m.time) / Math.max(1, total)}%`;
  $('center-cycle').textContent = fmt(m.time);
  $('center-sub').textContent = m.roundOver ? 'round over' : `${fmt(m.cyclesLeft)} cycles left`;
  const cards = $('cards').children;
  m.warriors.forEach((w, i) => {
    const card = cards[i];
    if (!card) return;
    const q = (k) => card.querySelector(`[data-k="${k}"]`);
    q('tasks').textContent = fmt(w.tasks);
    q('terr').textContent = `${((100 * w.territory) / m.coreSize).toFixed(1)}%`;
    q('wlt').textContent = `${w.wins}/${w.losses}/${w.ties}`;
    q('status').textContent = w.tasks ? (m.roundOver ? 'alive' : 'fighting') : `out`;
    q('bar').style.width = `${(100 * w.territory) / m.coreSize}%`;
    card.classList.toggle('dead', !w.tasks);
    if (state.tracker) {
      const shares = state.tracker.shares(i);
      const stance = state.tracker.stance(i);
      let sentence = '';
      if (!w.tasks) sentence = `<b>${esc(w.name)}</b> is out${state.causes[i] ? `: its last process ${state.causes[i]}` : ''}.`;
      else if (stance) sentence = `<b>${esc(w.name)}</b> ${ACTIVITY_SENTENCES[stance]}.`;
      else if (shares.length) sentence = `<b>${esc(w.name)}</b> mixes ${shares.slice(0, 2).map((x) => ACTIVITY_LABELS[x.activity]).join(' and ')}.`;
      q('stance').innerHTML = sentence;
      q('mix').innerHTML = ACTIVITIES.map((act) => {
        const sh = shares.find((x) => x.activity === act)?.share ?? 0;
        return `<span style="width:${(sh * 100).toFixed(1)}%;background:${ACTIVITY_COLORS[act]}" title="${ACTIVITY_LABELS[act]}"></span>`;
      }).join('');
      q('mixlegend').innerHTML = shares.filter((x) => x.share >= 0.05).slice(0, 4)
        .map((x) => `<span><i style="background:${ACTIVITY_COLORS[x.activity]}"></i>${ACTIVITY_LABELS[x.activity]} ${Math.round(x.share * 100)}%</span>`).join('');
    }
  });
  $('score').innerHTML = m.warriors
    .map((w, i) => `<b style="color:${PALETTE_HEX[i % 8]}">${w.wins}</b>`).join(' : ') +
    (m.warriors.length > 1 ? ` <span>(${m.warriors[0].ties} ties)</span>` : '');
  if (force) updateSourceHeat();
}

// Source panel: how often each line ran recently, and where each warrior's
// next process points.
function updateSourceHeat() {
  const m = state.mars;
  if (!m) return;
  const cards = $('cards').children;
  m.warriors.forEach((w, i) => {
    const card = cards[i];
    if (!card) return;
    const ins = w.code.instructions;
    const byLine = new Map();
    let max = 0;
    for (let k = 0; k < ins.length; k++) {
      const v = (byLine.get(ins[k].line) || 0) + w.execHeat[k];
      byLine.set(ins[k].line, v);
      if (v > max) max = v;
      w.execHeat[k] *= 0.5;
    }
    let pcLine = -1;
    if (w.tasks) {
      const org = m.origin[w.queue[w.head]];
      if (org >= 0 && org >> 16 === w.index) pcLine = ins[org & 0xffff].line;
    }
    const rgb = PALETTE_RGB[i % 8];
    for (const div of card.querySelectorAll('.source div')) {
      const ln = Number(div.dataset.line);
      const h = max > 0 ? (byLine.get(ln) || 0) / max : 0;
      div.style.background = h > 0.01 ? `linear-gradient(90deg, ${rgb.replace('rgb', 'rgba').replace(')', `,${(0.12 + 0.5 * h).toFixed(2)})`)} ${Math.round(20 + 80 * h)}%, transparent)` : '';
      div.classList.toggle('pc', ln === pcLine);
    }
  });
}

let bannerTimer = 0;
function showBanner(t1, t2, color, ms = 2000, t3 = '', small = false) {
  const b = $('banner');
  b.hidden = false;
  b.classList.toggle('small', small);
  b.innerHTML = `<div class="t1">${esc(t1)}</div><div class="t2" style="color:${color}">${esc(t2)}</div><div class="t3">${esc(t3)}</div>`;
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  clearTimeout(bannerTimer);
  if (ms > 0) bannerTimer = setTimeout(() => (b.hidden = true), ms);
}

function toast(html, color) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.color = color;
  t.innerHTML = html;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

function setRunning(on) {
  state.running = on;
  $('btn-play').textContent = on ? '❚❚' : '▶';
}

function setSpeed(idx) {
  state.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, idx));
  $('speed').value = state.speedIdx;
  const s = SPEEDS[state.speedIdx];
  $('speed-label').textContent = s === Infinity ? 'max' : `${s >= 1000 ? `${s / 1000}k` : s}/s`;
  document.querySelectorAll('#speed-presets button').forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === state.speedIdx));
}

// ------------------------------------------------------------------ editor

let editorSlot = -1;
function openEditor(i) {
  editorSlot = i;
  const slot = state.slots[i];
  $('editor-title').textContent = i < state.slots.length ? `Edit warrior ${i + 1}` : 'New warrior';
  $('editor-text').value = slot ? slot.source : ';redcode-94\n;name New warrior\n;author you\n;assert CORESIZE == 8000\n\n        mov.i   0, 1\n';
  refreshEditor();
  $('editor').showModal();
}

function refreshEditor() {
  const r = assemble($('editor-text').value, options());
  const st = $('editor-status');
  st.className = `status ${r.ok ? 'ok' : 'bad'}`;
  st.textContent = r.ok ? `✓ ${r.name} · ${r.instructions.length} instructions` : `${r.errors.length} error(s)`;
  const msgs = [...r.errors, ...r.warnings].map((m) => `${m.severity} line ${m.line ?? '-'}: ${m.text}`).join('\n');
  $('editor-out').textContent = (msgs ? `${msgs}\n\n` : '') + (r.ok ? formatListing(r, options().coreSize) : '');
  $('editor-apply').disabled = !r.ok;
}

$('editor-text').addEventListener('input', () => {
  clearTimeout(refreshEditor.t);
  refreshEditor.t = setTimeout(refreshEditor, 150);
});
$('editor-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (f) {
    $('editor-text').value = await f.text();
    refreshEditor();
  }
});
$('editor').addEventListener('close', () => {
  if ($('editor').returnValue !== 'apply') return;
  const source = $('editor-text').value;
  const key = addToLibrary(assemble(source).name.replace(/\s+/g, '_') || 'edited', source);
  setSlot(editorSlot, key);
  restartMatch();
});

// ------------------------------------------------------------------ wiring

function wire() {
  $('btn-play').addEventListener('click', () => {
    if (state.matchOver) restartMatch();
    setRunning(!state.running);
  });
  $('btn-step').addEventListener('click', () => {
    setRunning(false);
    step(1);
  });
  $('btn-next').addEventListener('click', () => {
    if (state.mars && !state.matchOver) nextRound();
  });
  $('btn-restart').addEventListener('click', restartMatch);
  document.querySelectorAll('#speed-presets button').forEach((b) => b.addEventListener('click', () => {
    setSpeed(Number(b.dataset.speed));
    if (!state.running && !state.matchOver) setRunning(true);
  }));
  $('btn-guide').addEventListener('click', () => $('guide').showModal());
  $('story').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-addr]');
    if (li) state.focus = { addr: Number(li.dataset.addr), born: performance.now() };
  });
  $('speed').addEventListener('input', (e) => setSpeed(Number(e.target.value)));
  $('lay-ring').addEventListener('click', () => { state.layoutKind = LAYOUT_RING; relayout(); });
  $('lay-grid').addEventListener('click', () => { state.layoutKind = LAYOUT_GRID; relayout(); });
  const preset = $('preset');
  preset.innerHTML = Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join('');
  preset.addEventListener('change', () => {
    state.preset = preset.value;
    restartMatch();
    if (!state.mars && state.slots.some((sl) => !sl.result.ok)) {
      // most warriors are written for CORESIZE 8000; these two run anywhere
      state.slots = [];
      ['dwarf', 'imp'].forEach((k, i) => setSlot(i, k));
      restartMatch();
      if (state.mars) story('The previous warriors do not fit these rules, switched to Dwarf vs Imp.', -1, -1);
    }
  });
  $('rounds').addEventListener('change', (e) => {
    state.rounds = Math.max(1, Math.min(1000, Number(e.target.value) || 1));
    restartMatch();
  });
  $('trails').addEventListener('input', (e) => { state.decay = 0.5 + 0.49 * (Number(e.target.value) / 100) ** 0.5; });
  state.decay = 0.5 + 0.49 * 0.6 ** 0.5;
  $('bloom').addEventListener('change', (e) => { renderer.bloom = e.target.checked ? 1 : 0; });
  $('add-warrior').addEventListener('click', () => {
    if (state.slots.length >= 8) return;
    const key = SAMPLES[state.slots.length % SAMPLES.length];
    state.slots.push(null);
    setSlot(state.slots.length - 1, key);
    restartMatch();
  });

  const canvas = $('core');
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  canvas.addEventListener('mouseleave', () => {
    state.mouse = null;
    state.hover = -1;
    $('tooltip').hidden = true;
  });
  new ResizeObserver(relayout).observe($('stage'));

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, dialog')) return;
    if (e.key === ' ') { e.preventDefault(); $('btn-play').click(); }
    else if (e.key === 'ArrowRight') { setRunning(false); step(e.shiftKey ? 100 : 1); }
    else if (e.key === 'n' || e.key === 'N') $('btn-next').click();
    else if (e.key === 'r' || e.key === 'R') restartMatch();
    else if (e.key === 'l' || e.key === 'L') { state.layoutKind = 1 - state.layoutKind; relayout(); }
    else if (e.key === ']' || e.key === '+') setSpeed(state.speedIdx + 1);
    else if (e.key === '[' || e.key === '-') setSpeed(state.speedIdx - 1);
    else if (e.key === 'f' || e.key === 'F') state.footprints = !state.footprints;
    else if (e.key === '?') $('guide').showModal();
  });

  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    const keys = [];
    for (const f of files) keys.push(addToLibrary(f.name, await f.text()));
    if (keys.length === 1) setSlot(Math.min(1, state.slots.length - 1), keys[0]);
    else {
      state.slots = [];
      keys.slice(0, 8).forEach((k, i) => setSlot(i, k));
    }
    restartMatch();
  });
}

window.addEventListener('error', (e) => toast(`<span>error: ${esc(e.message)}</span>`, '#ff7b7b'));
window.addEventListener('unhandledrejection', (e) => toast(`<span>error: ${esc(e.reason?.message ?? e.reason)}</span>`, '#ff7b7b'));

async function main() {
  wire();
  setSpeed(state.speedIdx);
  await loadSamples();
  const params = new URLSearchParams(location.search);
  const cast = (params.get('cast') || DEFAULT_CAST.join(',')).split(',').filter((k) => state.library.has(k));
  (cast.length ? cast : DEFAULT_CAST).forEach((k, i) => setSlot(i, k));
  if (params.get('layout') === 'grid') state.layoutKind = LAYOUT_GRID;
  if (params.get('footprints') === '0') state.footprints = false;
  if (params.has('speed')) setSpeed(Number(params.get('speed')));
  if (params.has('rounds')) { state.rounds = Number(params.get('rounds')) || 10; $('rounds').value = state.rounds; }
  if (params.get('preset') in PRESETS) { state.preset = params.get('preset'); $('preset').value = state.preset; }
  restartMatch();
  if (params.has('steps') && state.mars) {
    state.mars.run(Number(params.get('steps')) || 0);
    consumeTrace(performance.now());
  } else if (params.has('run') || !params.has('paused')) setRunning(true);
  let seen = true;
  try { seen = localStorage.getItem('theater-guide-seen') === '1'; localStorage.setItem('theater-guide-seen', '1'); } catch { /* no storage */ }
  if (!seen && !params.has('noguide')) $('guide').showModal();
  requestAnimationFrame(frame);
}

window.__theater = state; // for debugging and automated screenshots
main();
