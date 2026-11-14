#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// Minimal static file server for the visualizer (ES modules need http://).
// Usage: node tools/serve.mjs [port] [--run <folder of a 42evolve run>]
//
// With --run, /run/events streams the run's events.jsonl as Server-Sent
// Events for the evolver dashboard (ui/evolver.html): every line as it is
// written, and an event `reset` when the file got shorter (the run was
// continued from its state), after which the lines come again from the start.
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { open, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, normalize, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const usage = (why) => {
  console.error(`${why}\nusage: node tools/serve.mjs [port] [--run <folder of a 42evolve run>]`);
  process.exit(2);
};
let runDir = null, portArg = null;
for (const args = process.argv.slice(2); args.length;) {
  const a = args.shift();
  if (a === '--run') {
    if (!args.length) usage('--run needs the folder of a run');
    runDir = resolve(args.shift());
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
if (runDir && !existsSync(join(runDir, 'events.jsonl'))) console.error(`${runDir} has no events.jsonl yet; the dashboard shows the run once 42evolve writes it`);
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

// Sends the new complete lines of the run's events.jsonl every 300 ms.
function streamEvents(req, res) {
  const file = join(runDir, 'events.jsonl');
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  res.write(`event: run\ndata: ${JSON.stringify({ name: basename(runDir) })}\n\n`);
  let offset = 0, partial = '', busy = false;
  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const { size } = await stat(file);
      if (size < offset) {
        offset = 0;
        partial = '';
        res.write('event: reset\ndata: {}\n\n');
      }
      if (size > offset) {
        const fh = await open(file, 'r');
        const buf = Buffer.alloc(size - offset);
        await fh.read(buf, 0, buf.length, offset);
        await fh.close();
        offset = size;
        const lines = (partial + buf.toString('utf8')).split('\n');
        partial = lines.pop();
        for (const line of lines) if (line) res.write(`data: ${line}\n\n`);
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

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  if (path === '/run/events') {
    if (runDir) streamEvents(req, res);
    else res.writeHead(404).end('no run: node tools/serve.mjs --run <folder>');
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
}).listen(port, '127.0.0.1', () => {
  console.log(`Core War Theater: http://127.0.0.1:${port}/`);
  if (runDir) console.log(`evolver dashboard of ${runDir}: http://127.0.0.1:${port}/ui/evolver.html`);
});
