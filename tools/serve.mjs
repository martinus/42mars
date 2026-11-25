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
// come again from the start. /run/events is run 0, /runs lists the runs: name, last batch, members, the
// score of best.red against the holdout, and whether it wrote in the last minute.
// /runs/events streams all runs in one connection, each data line starting
// with the run's number and a space: a browser opens at most 6 connections
// to a host, and a stream per run kept them all busy, so that pages from the
// same server waited for a free one (Firefox, 15th November 2026).
// ui/evolver.html?run=<n> shows one run, ui/runs.html all of them.
// /run/<n>/scores: of an island, the events `score` of its folder's
// islands.jsonl and the kinds of the opponents' warriors where
// tools/hill-kinds.mjs has a cache of them (the dashboard's tab Designs).
// A folder of islands (42evolve --islands) given to --run stands for all its
// islands, each named <folder>/island-NN.
// --run takes every folder up to the next option, so `--run ~/42evolve.*`
// works. --watch <path prefix> adds every folder whose path starts with it,
// so `--watch ~/42evolve.` serves all runs, also those started later.
// The folders are looked at again at every /runs: a run started after the
// server, and the islands of a folder that got its islands.txt later, are
// added at the end of the list (the numbers of the others stay).
//
// A run's history longer than COMPACT_FROM bytes goes out compacted (not
// with --full): without the warriors that left (their enter, complete,
// leave and elite events; a warrior that set a new best against the holdout
// stays), with only the last of the values, speed,
// specialists and sharing events and the last 20 screen events, without the
// parents events (the dashboard does not read them), and with the batch
// events before the last 100 as one: their sums of evaluated and of the
// counts per change, and in `batches` how many; then the new lines as they
// come. A continued run of 7,453 batches had 463 MB of events, and the
// dashboard showed nothing while it read them all (16th November 2026); one
// of 35,000 batches still went out as 58 MB, 35,000 batch and as many
// parents lines (19th November 2026). The first line after the history is an
// event `compacted`.
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createServer } from 'node:http';
import { open, readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, normalize, resolve } from 'node:path';
import { bestRedInfo, kindCounts, progressPoint } from './progress.js';
import { shortKind } from './style.js';

const root = resolve(new URL('..', import.meta.url).pathname);
const usage = (why) => {
  console.error(`${why}\nusage: node tools/serve.mjs [port] [--full] [--run <folder of a 42evolve run> ...] [--watch <path prefix> ...]`);
  process.exit(2);
};
const runDirs = []; // the runs, numbered in the order they were found; only added to
const given = [], prefixes = []; // --run, --watch
let portArg = null, full = false;
const COMPACT_FROM = Number(process.env.SERVE_COMPACT_FROM ?? 16 << 20); // the tests set it lower
const KEEP_BATCHES = Number(process.env.SERVE_KEEP_BATCHES ?? 100); // the batch events that go out as they are
const histories = new Map(); // file -> { end, lines }: the last compacted history, for the next page
for (const args = process.argv.slice(2); args.length;) {
  const a = args.shift();
  if (a === '--run') {
    if (!args.length || args[0].startsWith('-')) usage('--run needs the folder of a run');
    while (args.length && !args[0].startsWith('-')) given.push(resolve(args.shift()));
  } else if (a === '--watch') {
    if (!args.length || args[0].startsWith('-')) usage('--watch needs the start of the folders\' paths, e.g. ~/42evolve.');
    while (args.length && !args[0].startsWith('-')) prefixes.push(args[0].endsWith('/') ? `${resolve(args.shift())}/` : resolve(args.shift()));
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
// A folder of islands (42evolve --islands: islands.txt, island-01, ...) stands
// for its islands. It makes islands.txt and its island folders after the
// pick, about a minute after it starts (islands.jsonl comes first): until
// then it is not listed, else it would be a run that never shows anything
// (#189). A folder given to --run that has nothing yet is listed as it is,
// a folder of --watch once it has events.jsonl or islands.txt.
const ISLAND = /^island-(\d+)$/;
function runsOf(dir, watched) {
  if (existsSync(join(dir, 'islands.txt'))) return readdirSync(dir).filter((n) => ISLAND.test(n)).sort().map((n) => join(dir, n));
  if (existsSync(join(dir, 'islands.jsonl'))) return [];
  return !watched || existsSync(join(dir, 'events.jsonl')) ? [dir] : [];
}
// The folders of --run and --watch as they are now; new runs at the end of runDirs.
function findRuns() {
  const dirs = given.flatMap((d) => runsOf(d, false));
  for (const p of prefixes) {
    const parent = p.endsWith('/') ? p : dirname(p), start = p.endsWith('/') ? '' : basename(p);
    let names = [];
    try {
      names = readdirSync(parent, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.startsWith(start)).map((e) => e.name).sort();
    } catch {} // a parent that is not there (yet)
    for (const n of names) dirs.push(...runsOf(join(parent, n), true));
  }
  for (const d of dirs) if (!runDirs.includes(d)) runDirs.push(d);
}
findRuns();
// the name of a run: its folder, an island with the folder of its islands before it
const runName = (dir) => (ISLAND.test(basename(dir)) ? `${basename(resolve(dir, '..'))}/${basename(dir)}` : basename(dir));
for (const dir of given) {
  if (!runsOf(dir, false).length) console.error(`${dir}: a run of islands without islands.txt yet; the dashboard lists its islands once 42evolve writes it`);
  else if (!existsSync(join(dir, 'islands.txt')) && !existsSync(join(dir, 'events.jsonl'))) console.error(`${dir} has no events.jsonl yet; the dashboard shows the run once 42evolve writes it`);
}
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
// machine), which gets them and the lines from there on as they are, until
// those are more than COMPACT_FROM too: a page that switches between runs
// asks for a history with every click. One history is read at a time, and a
// second request for the same run waits for the first: reading a run of
// 2.4 GB took 2.5 GB of memory at its peak, and with several at once (the
// runs page follows every run) the server ran out of its heap (19th November
// 2026).
let reading = Promise.resolve();
const building = new Map(); // file -> the history being read
async function compacted(file, end, send) {
  let known = histories.get(file);
  if (!(known && known.end <= end && end - known.end <= COMPACT_FROM)) {
    let next = building.get(file);
    if (!next) {
      next = reading.then(() => readHistory(file, end));
      reading = next.catch(() => {});
      building.set(file, next);
      next.then(() => building.delete(file), () => building.delete(file));
    }
    known = await next;
  }
  for (const line of known.lines) send('message', line);
  return known.end;
}

async function readHistory(file, end) {
  const lines = [];
  const gone = new Set(), last = new Map(), screens = []; // ids that left; the last line of a type; the screen lines
  // a warrior that was the best against the holdout when it was benched stays,
  // also when it left: the dashboard names the best of the run (best.red)
  // only from the warriors it knows
  const records = new Set();
  // the progress chart of every batch, as the dashboard draws it from the
  // whole history: [batch, best and mean of the members against the panel
  // (the values event before it), best against the holdout so far (-1 none)];
  // the dashboard cannot draw it from a history without the warriors that left
  const panel = new Set(), history = [];
  // the members by kind of style after each batch (the values event), as the
  // dashboard counts them from the whole history: [batch, kind -> count]
  const styleOf = new Map(), kinds = [];
  const batches = []; // the line numbers of the batch events
  let values = null;
  let n = 0, sent = 0, record = -Infinity;
  for await (const line of linesOf(file, end)) {
    const t = typeOf(line);
    if (t === 'bench') {
      const avg = Number(/"avg":(-?[\d.]+(?:e[-+]?\d+)?)/.exec(line)?.[1]);
      if (avg > record) record = avg, records.add(idOf(line));
    }
    if (t === 'start') for (const p of JSON.parse(line).panel ?? []) panel.add(p.id);
    if (t === 'rotate') {
      const e = JSON.parse(line);
      panel.delete(e.out);
      panel.add(e.panel.id);
    }
    if (t === 'values') {
      values = line;
      kinds.push([Number(/"batch":(\d+)/.exec(line)?.[1] ?? -1), kindCounts(styleOf.values())]);
    }
    if (t === 'enter' || t === 'elite') styleOf.set(idOf(line), /"style":\{"kind":"([^"]*)"/.exec(line)?.[1]);
    if (t === 'batch' && values) {
      const members = JSON.parse(values).values?.filter((v) => !panel.has(v[0]));
      if (members) {
        const p = progressPoint(members.map((v) => v[5] ?? 0), record > -Infinity ? record : -1);
        history.push([Number(/"batch":(\d+)/.exec(line)[1]), p.best, p.mean, p.holdout]);
      }
    }
    if (t === 'leave') gone.add(idOf(line)), styleOf.delete(idOf(line));
    if (t === 'elite') {
      const r = /"replaced":\{"id":(\d+)/.exec(line);
      if (r) gone.add(r[1]), styleOf.delete(r[1]);
    }
    if (t === 'screen') screens.push(n);
    if (t === 'batch') batches.push(n);
    last.set(t, n++);
  }
  for (const id of records) gone.delete(id);
  const keptScreens = new Set(screens.slice(-20));
  const firstBatch = batches.length > KEEP_BATCHES ? batches[batches.length - KEEP_BATCHES] : -1; // the first kept as it is
  const early = { type: 'batch', batch: -1, evaluated: 0, ops: undefined, batches: 0 }; // the ones before it, summed
  let at = 0;
  for await (const line of linesOf(file, end)) {
    const t = typeOf(line), i = at++;
    if ((t === 'enter' || t === 'complete' || t === 'leave' || t === 'elite') && gone.has(idOf(line))) continue;
    if (KEEP_LAST.has(t) && last.get(t) !== i) continue;
    if (t === 'screen' && !keptScreens.has(i)) continue;
    if (t === 'parents') continue;
    if (t === 'batch' && i < firstBatch) {
      const e = JSON.parse(line);
      early.batch = e.batch;
      early.evaluated += e.evaluated ?? 0;
      early.batches++;
      for (const [op, c] of Object.entries(e.ops ?? {})) {
        early.ops ??= {};
        const sum = (early.ops[op] ??= c.map(() => 0));
        c.forEach((v, k) => { sum[k] += v; });
      }
      continue;
    }
    if (i === firstBatch) lines.push(JSON.stringify(early)), sent++;
    lines.push(line);
    sent++;
  }
  lines.push(JSON.stringify({ type: 'compacted', lines: n, dropped: n - sent, gone: gone.size, history: history.length ? history : undefined, kinds: kinds.length ? kinds : undefined }));
  const known = { end, lines };
  histories.set(file, known);
  return known;
}

// The last `bytes` of a file of `size` bytes (all of a shorter one).
async function readTail(file, size, bytes) {
  const fh = await open(file, 'r');
  const tail = Buffer.alloc(Math.min(size, bytes));
  await fh.read(tail, 0, tail.length, size - tail.length);
  await fh.close();
  return tail;
}

// Calls send(event, data) with the new complete lines of the run's
// events.jsonl every 300 ms (event 'message'), first 'run' with its name,
// 'live' once the history so far is out (the dashboard draws it in one go),
// and 'reset' when the file got shorter. Stops when the request closes.
function follow(req, runDir, send) {
  const file = join(runDir, 'events.jsonl');
  send('run', JSON.stringify({ name: runName(runDir) }));
  let offset = 0, partial = '', busy = false, live = false;
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
        // up to the last complete line. A kept history can end earlier: the lines after it follow below, in
        // this poll, before 'live' (else the page drew the kept history's batch first, then the current one)
        const tail = await readTail(file, size, 1 << 20);
        const end = size - (tail.length - 1 - tail.lastIndexOf(10));
        offset = await compacted(file, end, send);
      }
      if (size > offset) {
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
    if (!live) live = true, send('live', '{}'); // the history is out; from now on the lines as they come
    busy = false;
  };
  poll();
  const timer = setInterval(poll, 300);
  req.on('close', () => clearInterval(timer));
}

// What the dashboard's list of runs shows of one run, read cheaply: the last
// batch event in the last 256 KB of its events, the holdout score in the
// head of best.red and the batch it is from, the age of the last write: a run counts as running while
// that is below 3 times its last batch (the speed event), at least 2 minutes
// (a batch on one thread took over a minute, 17th November 2026).
const summaries = new Map(); // folder -> { key, out, mtimeMs, seconds }: unchanged files are not read again
async function summary(dir) {
  const file = join(dir, 'events.jsonl'), red = join(dir, 'best.red');
  const [ev, best] = await Promise.all([stat(file).catch(() => null), stat(red).catch(() => null)]);
  const key = `${ev?.size} ${ev?.mtimeMs} ${best?.mtimeMs}`;
  let c = summaries.get(dir);
  if (c?.key !== key) {
    c = { key, mtimeMs: ev?.mtimeMs ?? 0, seconds: 0, out: { name: runName(dir), batch: -1, members: 0, holdout: null, bestBatch: null } };
    if (ev) {
      const lines = (await readTail(file, ev.size, 256 << 10)).toString('utf8').split('\n');
      let batch = null;
      for (let i = lines.length - 1; i >= 0 && !(batch && c.seconds); i--) {
        const t = typeOf(lines[i]);
        if (t === 'speed' && !c.seconds) c.seconds = Number(/"seconds":([\d.]+)/.exec(lines[i])?.[1] ?? 0);
        if (t === 'batch' && !batch) {
          try {
            batch = JSON.parse(lines[i]);
          } catch {} // a line cut at the start of the tail
        }
      }
      if (batch) c.out.batch = batch.batch, c.out.members = batch.members ?? batch.cells ?? 0;
    }
    if (best) {
      const info = bestRedInfo(await readFile(red, 'latin1').catch(() => ''));
      c.out.holdout = info.holdout;
      c.out.bestBatch = info.batch; // the batch it was found in: the list shows its age
    }
    summaries.set(dir, c);
  }
  return c;
}

// The islands of a folder are one process and take turns, one batch at a
// time: an island waits for the batches of the others, so its own last write
// says little (an island with batches of 10 s waited 5 minutes among seven
// with batches of 40 to 60 s, 18th November 2026). So the running rule above
// applies to the folder: its newest write against its slowest last batch.
// An island the score dropped (0 in the live line of islands.txt) has stopped.
async function runList() {
  findRuns();
  const cs = await Promise.all(runDirs.map(summary));
  const folder = (dir) => (ISLAND.test(basename(dir)) ? resolve(dir, '..') : dir);
  const last = new Map(); // folder -> { mtimeMs, seconds }
  for (const [i, c] of cs.entries()) {
    const l = last.get(folder(runDirs[i])) ?? { mtimeMs: 0, seconds: 0 };
    last.set(folder(runDirs[i]), { mtimeMs: Math.max(l.mtimeMs, c.mtimeMs), seconds: Math.max(l.seconds, c.seconds) });
  }
  const live = new Map(); // folder -> the live flags of its islands
  for (const f of last.keys()) {
    const line = /^live((?: \d)*)$/m.exec(await readFile(join(f, 'islands.txt'), 'utf8').catch(() => ''));
    if (line) live.set(f, line[1].trim().split(' ').map(Number));
  }
  return cs.map((c, index) => {
    const dir = runDirs[index], l = last.get(folder(dir));
    const going = live.get(folder(dir))?.[Number(ISLAND.exec(basename(dir))?.[1]) - 1] !== 0;
    return { index, ...c.out, running: going && Date.now() - l.mtimeMs < Math.max(120000, 3000 * l.seconds) };
  });
}

// The scores of the islands of the folder of run dir (an island): { scores,
// opponents, kinds: file -> short kind, or null without a cache }. The cache
// is the one tools/hill-kinds.mjs writes by default (defaultOut(): the hill
// named as the opponents' folder, else 94nop); the server never measures, a
// first measurement takes minutes.
async function scoresOf(dir) {
  if (!ISLAND.test(basename(dir))) return { scores: [], opponents: null, kinds: null };
  const text = await readFile(join(dir, '..', 'islands.jsonl'), 'utf8').catch(() => '');
  const scores = [];
  let opponents = null;
  for (const line of text.split('\n')) {
    const t = typeOf(line);
    if (t !== 'score' && t !== 'islands') continue;
    try {
      const e = JSON.parse(line);
      if (t === 'islands') opponents = e.opponents;
      else scores.push(e);
    } catch {} // a line being written
  }
  let kinds = null;
  if (opponents) {
    const base = basename(opponents), hill = ['94nop', 'tiny'].includes(base) ? base : '94nop';
    try {
      const cache = JSON.parse(await readFile(join(root, 'build', 'hill-kinds', `${hill}-${base}.json`), 'utf8'));
      kinds = Object.fromEntries(Object.entries(cache.warriors).map(([f, w]) => [f, shortKind(w.kind)]));
    } catch {} // no cache: the designs without the kinds of their opponents
  }
  return { scores, opponents, kinds };
}

const eventStream = (res) => res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
const sse = (event, data) => `${event === 'message' ? '' : `event: ${event}\n`}data: ${data}\n\n`;

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = decodeURIComponent(url.pathname);
  const scores = /^\/run\/(\d+)\/scores$/.exec(path);
  if (scores) {
    if (Number(scores[1]) >= runDirs.length) findRuns();
    const dir = runDirs[Number(scores[1])];
    if (!dir) {
      res.writeHead(404).end('no such run');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    res.end(JSON.stringify(await scoresOf(dir)));
    return;
  }
  const run = /^\/run(?:\/(\d+))?\/events$/.exec(path);
  if (run) {
    if (Number(run[1] ?? 0) >= runDirs.length) findRuns(); // a run that started since the last /runs
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
    findRuns();
    eventStream(res);
    runDirs.forEach((dir, i) => follow(req, dir, (event, data) => res.write(sse(event, `${i} ${data}`))));
    return;
  }
  if (path === '/runs') {
    const list = await runList();
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    res.end(JSON.stringify(list));
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
  console.error(`port ${port} is in use, by another server${runDir ? '' : ' (another serve.mjs?)'}: start this one on another port, e.g.\n  node ${process.argv[1]} ${port + 1}${given.length ? ` --run ${given.join(' ')}` : ''}${prefixes.length ? ` --watch ${prefixes.join(' ')}` : ''}`);
  process.exit(1);
}).listen(port, '127.0.0.1', () => {
  console.log(`Core War Theater: http://127.0.0.1:${port}/`);
  if (runDirs.length === 1 && !prefixes.length) console.log(`evolver dashboard of ${runDirs[0]}: http://127.0.0.1:${port}/ui/evolver.html`);
  else if (runDirs.length || prefixes.length) {
    console.log(`evolver dashboard of ${runDirs.length} runs, a list on the left to switch: http://127.0.0.1:${port}/ui/evolver.html`);
    console.log(`all ${runDirs.length} runs side by side: http://127.0.0.1:${port}/ui/runs.html`);
  }
});
