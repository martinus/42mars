#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Opens a page in headless Chrome through the DevTools protocol (no
// Playwright needed) and does what its arguments say, in their order: for
// the pages a virtual time budget cannot be used on, like the evolver's
// dashboard on a live stream (ui/evolver.html), and for clicks and keys.
//
//   node .claude/skills/ui-check/page.mjs <url> [--size 1680x1000] [--wait 8]
//     [--click <css selector>] [--key <key>] [--pause <seconds>]
//     [--eval <expression>] [--shot <file.png>] [--clip x,y,w,h]
//
// --wait: seconds after the page was opened (8), before the first action.
// --click: a click() on the first element of the selector; it must exist.
// --key: a key press, e.g. ']' or 'Escape'. --pause: wait.
// --eval: prints the JSON of the expression's value on a line.
// --shot: a screenshot; --clip before it cuts it to that rectangle.
// At the end every console error and exception; exit code 1 with any, or
// when a click found no element, 2 on a wrong argument.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const usage = (why) => {
  console.error(`${why}\nusage: page.mjs <url> [--size WxH] [--wait s] [--click sel] [--key key] [--pause s] [--eval expr] [--shot file.png] [--clip x,y,w,h]`);
  process.exit(2);
};
const argv = process.argv.slice(2);
if (!argv.length || argv[0].startsWith('--')) usage('the url comes first');
const url = argv.shift();
let size = [1680, 1000], wait = 8;
const steps = [];
const number = (name, v) => {
  if (v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0) usage(`${name} needs a number, not '${v}'`);
  return Number(v);
};
while (argv.length) {
  const a = argv.shift(), v = argv.shift();
  if (v === undefined) usage(`${a} needs a value`);
  if (a === '--size') {
    size = v.split('x').map((x) => number('--size', x));
    if (size.length !== 2) usage(`--size is WxH, not '${v}'`);
  } else if (a === '--wait') wait = number('--wait', v);
  else if (a === '--pause') steps.push(['pause', number('--pause', v)]);
  else if (a === '--clip') {
    const c = v.split(',').map((x) => number('--clip', x));
    if (c.length !== 4) usage(`--clip is x,y,w,h, not '${v}'`);
    steps.push(['clip', c]);
  } else if (['--click', '--key', '--eval', '--shot'].includes(a)) steps.push([a.slice(2), v]);
  else usage(`unknown option ${a}`);
}

const port = 9300 + Math.floor(Math.random() * 600);
const profile = mkdtempSync(join(tmpdir(), 'ui-page-'));
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
// google-chrome is a wrapper script and the browser outlives a kill of it
// (compare.mjs): close the browser over the protocol, wait for its port to go
const finish = async (code) => {
  try {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const ws = new WebSocket(webSocketDebuggerUrl);
    await new Promise((r, e) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', e, { once: true }); });
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
  } catch { /* not started, or already gone */ }
  chrome.kill();
  for (let k = 0; k < 100; k++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); } catch { break; }
    await sleep(100);
  }
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  process.exit(code);
};
process.on('uncaughtException', (e) => { console.error(e); finish(1); });
for (let k = 0; ; k++) {
  try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { if (k > 100) { console.error('chrome did not start'); await finish(2); } await sleep(100); }
}

const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map(), errors = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const evaluate = async (expression) => {
  const r = (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result;
  if (r?.exceptionDetails) errors.push(`--eval ${expression}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r?.result?.value;
};
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(1000 * wait);

let clip = null;
for (const [what, v] of steps) {
  if (what === 'pause') await sleep(1000 * v);
  else if (what === 'clip') clip = { x: v[0], y: v[1], width: v[2], height: v[3], scale: 1 };
  else if (what === 'click') {
    if (!(await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(v)}); e?.click(); return Boolean(e); })()`))) errors.push(`--click ${v}: no such element`);
  } else if (what === 'key') {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: v, text: v.length === 1 ? v : undefined });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: v });
  } else if (what === 'eval') console.log(JSON.stringify(await evaluate(v)));
  else if (what === 'shot') {
    writeFileSync(v, Buffer.from((await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) })).result.data, 'base64'));
    clip = null;
  }
}
for (const e of errors) console.error(`error: ${e}`);
ws.close();
await finish(errors.length ? 1 : 0);
