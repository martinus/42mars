#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Compares the visualizer of two servers (base, e.g. origin/main, and head,
// the working tree) on the same views: Math.random is seeded, so both pick
// the same positions; after `steps=N&paused` the textures the renderer gets
// (window.__theater.dataA/dataB), time, round, processes, territories and
// the story must be identical. Headless Chrome through the DevTools protocol
// (no Playwright needed). Exit code 1 on a difference or a console error.
//
//   node .claude/skills/ui-check/compare.mjs --base 8124 --head 8125 [--out dir] [--time] 'cast=lantern,origami&steps=3000&paused&noguide' ...
//
// --time: instead of comparing, run each view unpaused for 5 s and print the
// engine's instructions/s inside run() and the ms per frame outside it
// (software rendering: compare base with head, never with a real browser).

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const flag = (name) => { const i = argv.indexOf(`--${name}`); if (i >= 0) argv.splice(i, 1); return i >= 0; };
const base = opt('base'), head = opt('head'), out = opt('out', null), time = flag('time');
const port = 9300 + Math.floor(Math.random() * 600);
if (!base || !head || argv.length === 0) {
  console.error("usage: compare.mjs --base <port> --head <port> [--out dir] [--time] 'query' ...");
  process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), 'ui-compare-'));
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', `--user-data-dir=${profile}`, '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
// Chrome writes into its profile until it has exited: remove it after that.
const finish = async (code) => {
  const exited = new Promise((r) => chrome.once('exit', r));
  chrome.kill();
  await exited;
  rmSync(profile, { recursive: true, force: true });
  process.exit(code);
};
for (let k = 0; ; k++) {
  try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { if (k > 100) { console.error('chrome did not start'); await finish(2); } await sleep(100); }
}

async function open(url) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const send = (method, params = {}) => new Promise((r) => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  // the same random seed for base and head, so both load the warriors at the same positions
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'let __s = 12345; Math.random = () => { __s = (__s * 16807) % 2147483647; return __s / 2147483647; };' });
  await send('Page.navigate', { url });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const t0 = Date.now();
  while (!(await evaluate('Boolean(window.__theater?.mars?.time > 0 && window.__theater.dataA)'))) {
    if (Date.now() - t0 > 30000) { errors.push('timeout: no running match after 30 s'); break; }
    await sleep(100);
  }
  return {
    errors, evaluate,
    screenshot: async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'),
    close: async () => { await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); ws.close(); },
  };
}

const STATE = `(() => {
  const s = window.__theater, m = s.mars;
  const h = (arr) => { let x = 2166136261; for (const v of arr) x = Math.imul(x ^ v, 16777619) >>> 0; return x; };
  return { time: m.time, round: m.round, dataA: h(s.dataA), dataB: h(s.dataB), tasks: m.warriors.map((w) => w.tasks),
    territory: m.warriors.map((w) => w.territory), story: [...document.querySelectorAll('#story li')].map((li) => li.innerText) };
})()`;

// Engine time inside run() and the rest of each frame, over 5 s.
const TIMING = `new Promise((resolve) => {
  const s = window.__theater; let ins = 0, inRun = 0, frames = 0;
  const wrap = (m) => { if (m.__timed) return; const run = m.run.bind(m); m.run = (n) => { const t = performance.now(); const r = run(n); inRun += performance.now() - t; ins += r; return r; }; m.__timed = true; };
  const t0 = performance.now();
  const tick = (now) => { wrap(s.mars); frames++; if (now - t0 < 5000) requestAnimationFrame(tick); else resolve({ ins, inRun, frames, ms: now - t0 }); };
  requestAnimationFrame(tick); })`;

let bad = 0;
for (const [i, q] of argv.entries()) {
  const res = {};
  for (const [name, p] of [['base', base], ['head', head]]) {
    const page = await open(`http://127.0.0.1:${p}/ui/?${q}`);
    await sleep(1500);
    if (time) {
      const r = await page.evaluate(TIMING);
      res[name] = `${(r.ins / r.inRun / 1000).toFixed(1)} M/s in run(), ${((r.ms - r.inRun) / r.frames).toFixed(1)} ms/frame outside it`;
    } else {
      res[name] = await page.evaluate(STATE);
      if (out) writeFileSync(join(out, `${name}-${i}.png`), await page.screenshot());
    }
    if (page.errors.length) { bad++; console.log(`ERRORS ${name} ${q}: ${page.errors.join(' | ')}`); }
    await page.close();
  }
  if (time) { console.log(`${q}\n  base: ${res.base}\n  head: ${res.head}`); continue; }
  const same = JSON.stringify(res.base) === JSON.stringify(res.head);
  if (!same) bad++;
  console.log(`${same ? 'SAME' : 'DIFF'} ${q}${same ? ` (time ${res.head.time})` : `\n  base: ${JSON.stringify(res.base)}\n  head: ${JSON.stringify(res.head)}`}`);
}
await finish(bad ? 1 : 0);
