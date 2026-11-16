#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// Minimal static file server for the visualizer (ES modules need http://).
// Usage: node tools/serve.mjs [port] [--run <folder of a 42evolve run> ...]
//
// With --run, /run/<n>/events streams the events.jsonl of run n (0, 1, ...
// in the order given) as Server-Sent Events for the evolver dashboards:
// every line as it is written, and an event `reset` when the file got
// shorter (the run was continued from its state), after which the lines
// come again from the start. /run/events is run 0, /runs lists the runs.
// /runs/events streams all runs in one connection, each data line starting
// with the run's number and a space: a browser opens at most 6 connections
// to a host, and a stream per run kept them all busy, so that pages from the
// same server waited for a free one (Firefox, 15th November 2026).
// ui/evolver.html?run=<n> shows one run, ui/runs.html all of them.
// --run takes every folder up to the next option, so `--run ~/42evolve.*`
// works.
//
// A run's history longer than COMPACT_FROM bytes goes out compacted (not
// with --full): without the warriors that left (their enter, complete,
// leave and elite events), with only the last of the values, speed,
// specialists and sharing events and the last 20 screen events; then the
// new lines as they come. A continued run of 7,453 batches had 463 MB of
// events, and the dashboard showed nothing while it read them all (16th
// November 2026). The first line after the history is an event `compacted`.
import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createServer } from 'node:http';
import { open, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, normalize, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const usage = (why) => {
  console.error(`${why}\nusage: node tools/serve.mjs [port] [--full] [--run <folder of a 42evolve run> ...]`);
  process.exit(2);
};
const runDirs = [];
let portArg = null, full = false;
const COMPACT_FROM = Number(process.env.SERVE_COMPACT_FROM ?? 16 << 20); // the tests set it lower
const histories = new Map(); // file -> { end, lines }: the last compacted history, for the next page
for (const args = process.argv.slice(2); args.length;) {
  const a = args.shift();
  if (a === '--run') {
    if (!args.length || args[0].startsWith('-')) usage('--run needs the folder of a run');
    while (args.length && !args[0].startsWith('-')) runDirs.push(resolve(args.shift()));
  } else if (a === '--full') {
    full = true;
  } else if (a.startsWith('-')) {
    usage(`unknown option ${a}${a.startsWith('--run') ? ' (--run?)' : ''}`);
  } else if (portArg === null) {
    portArg = a;
  } else {
    usage(`one port only, not '${portArg}' and '${a}'`);
  }
}
const port = Number(portArg ?? process.env.PORT ?? 8000);
if (!Number.isInteger(port) || port < 0 || port > 65535) usage(`not a port: '${portArg ?? process.env.PORT}'`);
for (const dir of runDirs) if (!existsSync(join(dir, 'events.jsonl'))) console.error(`${dir} has no events.jsonl yet; the dashboard shows the run once 42evolve writes it`);
const runDir = runDirs[0] ?? null;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.red': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
};

// The lines of file up to byte end, one by one.
async function* linesOf(file, end) {
  if (end <= 0) return;
  const rl = createInterface({ input: createReadStream(file, { start: 0, end: end - 1 }), crlfDelay: Infinity });
  for await (const line of rl) if (line) yield line;
}

const typeOf = (line) => /^\{"type":"([^"]+)"/.exec(line)?.[1];
const idOf = (line) => /"id":(\d+)/.exec(line)?.[1];
const KEEP_LAST = new Set(['values', 'speed', 'specialists', 'sharing']);

// The history of a large run up to byte end, compacted (see the top); the
// lines are kept for the next request (it took 21 s for 463 MB on a busy
// machine), which gets them and the lines from there on as they are.
async function compacted(file, end, send) {
  const known = histories.get(file);
  if (known && known.end <= end) {
    for (const line of known.lines) send('message', line);
    return known.end;
  }
  const lines = [];
  const gone = new Set(), last = new Map(), screens = []; // ids that left; the last line of a type; the screen lines
  let n = 0, sent = 0;
  for await (const line of linesOf(file, end)) {
    const t = typeOf(line);
    if (t === 'leave') gone.add(idOf(line));
    if (t === 'elite') {
      const r = /"replaced":\{"id":(\d+)/.exec(line);
      if (r) gone.add(r[1]);
    }
    if (t === 'screen') screens.push(n);
    last.set(t, n++);
  }
  const keptScreens = new Set(screens.slice(-20));
  let at = 0;
  for await (const line of linesOf(file, end)) {
    const t = typeOf(line), i = at++;
    if ((t === 'enter' || t === 'complete' || t === 'leave' || t === 'elite') && gone.has(idOf(line))) continue;
    if (KEEP_LAST.has(t) && last.get(t) !== i) continue;
    if (t === 'screen' && !keptScreens.has(i)) continue;
    lines.push(line);
    sent++;
  }
  lines.push(JSON.stringify({ type: 'compacted', lines: n, dropped: n - sent, gone: gone.size }));
  histories.set(file, { end, lines });
  for (const line of lines) send('message', line);
  return end;
}

// Calls send(event, data) with the new complete lines of the run's
// events.jsonl every 300 ms (event 'message'), first 'run' with its name, and
// 'reset' when the file got shorter. Stops when the request closes.
function follow(req, runDir, send) {
  const file = join(runDir, 'events.jsonl');
  send('run', JSON.stringify({ name: basename(runDir) }));
  let offset = 0, partial = '', busy = false;
  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const { size } = await stat(file);
      if (size < offset) {
        offset = 0;
        partial = '';
        send('reset', '{}');
      }
      if (size > offset && offset === 0 && size > COMPACT_FROM && !full) {
        // up to the last complete line; the rest comes with the next poll
        const fh = await open(file, 'r');
        const tail = Buffer.alloc(Math.min(size, 1 << 20));
        await fh.read(tail, 0, tail.length, size - tail.length);
        await fh.close();
        const end = size - (tail.length - 1 - tail.lastIndexOf(10));
        offset = await compacted(file, end, send);
      } else if (size > offset) {
        const fh = await open(file, 'r');
        const buf = Buffer.alloc(size - offset);
        await fh.read(buf, 0, buf.length, offset);
        await fh.close();
        offset = size;
        const lines = (partial + buf.toString('utf8')).split('\n');
        partial = lines.pop();
        for (const line of lines) if (line) send('message', line);
      }
    } catch {
      // no events.jsonl yet
    }
    busy = false;
  };
  poll();
  const timer = setInterval(poll, 300);
  req.on('close', () => clearInterval(timer));
}

const eventStream = (res) => res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
const sse = (event, data) => `${event === 'message' ? '' : `event: ${event}\n`}data: ${data}\n\n`;

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const run = /^\/run(?:\/(\d+))?\/events$/.exec(path);
  if (run) {
    const dir = runDirs[Number(run[1] ?? 0)];
    if (!dir) {
      res.writeHead(404).end('no such run: node tools/serve.mjs --run <folder> ...');
      return;
    }
    eventStream(res);
    follow(req, dir, (event, data) => res.write(sse(event, data)));
    return;
  }
  if (path === '/runs/events') {
    eventStream(res);
    runDirs.forEach((dir, i) => follow(req, dir, (event, data) => res.write(sse(event, `${i} ${data}`))));
    return;
  }
  if (path === '/runs') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    res.end(JSON.stringify(runDirs.map((dir, index) => ({ index, name: basename(dir) }))));
    return;
  }
  if (path === '/') { // the visualizer lives in ui/
    res.writeHead(302, { location: `/ui/${url.search}` }).end();
    return;
  }
  const file = normalize(join(root, path.endsWith('/') ? `${path}index.html` : path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.error(`port ${port} is in use, by another server${runDir ? '' : ' (another serve.mjs?)'}: start this one on another port, e.g.\n  node ${process.argv[1]} ${port + 1}${runDirs.length ? ` --run ${runDirs.join(' ')}` : ''}`);
  process.exit(1);
}).listen(port, '127.0.0.1', () => {
  console.log(`Core War Theater: http://127.0.0.1:${port}/`);
  runDirs.forEach((dir, i) => console.log(`evolver dashboard of ${dir}: http://127.0.0.1:${port}/ui/evolver.html${i ? `?run=${i}` : ''}`));
  if (runDirs.length > 1) console.log(`all ${runDirs.length} runs side by side: http://127.0.0.1:${port}/ui/runs.html`);
});
