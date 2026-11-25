// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// tools/serve.mjs --run: /run/events streams the events.jsonl of a 42evolve
// run to the dashboard (ui/evolver.html): complete lines only, new lines as
// they are written, and `reset` when the file got shorter (a continued run);
// a long history compacted.

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'serve-test-'));
const servers = [];
after(() => {
  for (const s of servers) s.kill();
  rmSync(dir, { recursive: true, force: true });
});

async function serve(args, env = {}) {
  // below 32768, where Linux takes the local ports of outgoing connections (36342 was taken in CI, 21st November
  // 2026: the server said so on stderr, and the test waited for its first line until the timeout)
  const port = 20000 + Math.floor(Math.random() * 12000);
  const p = spawn(process.execPath, [join(root, 'tools/serve.mjs'), String(port), ...args], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...env } });
  servers.push(p);
  await new Promise((resolve) => p.stdout.on('data', resolve));
  return `http://127.0.0.1:${port}`;
}

// Reads server-sent events until `until` returns true for the list so far;
// without the event 'live' (the history is out) unless asked for it.
async function read(reader, got, until, { live = false } = {}) {
  const dec = new TextDecoder();
  let text = '';
  while (!until(got)) {
    const { value, done } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true });
    const parts = text.split('\n\n');
    text = parts.pop();
    for (const part of parts) {
      const ev = /^event: (.*)$/m.exec(part)?.[1] ?? 'message';
      if (ev !== 'live' || live) got.push({ ev, data: /^data: (.*)$/m.exec(part)?.[1] });
    }
  }
  return got;
}

test('the events of a run, as they are written', { timeout: 15000 }, async () => {
  const run = join(dir, 'run');
  rmSync(run, { recursive: true, force: true });
  mkdirSync(run);
  const file = join(run, 'events.jsonl');
  writeFileSync(file, '{"type":"start","n":1}\n{"type":"batch","n":2}\n{"type":"enter"');
  const url = await serve(['--run', run]);
  const res = await fetch(`${url}/run/events`);
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const reader = res.body.getReader();
  const got = await read(reader, [], (g) => g.length >= 3);
  assert.deepEqual(got, [
    { ev: 'run', data: '{"name":"run"}' },
    { ev: 'message', data: '{"type":"start","n":1}' },
    { ev: 'message', data: '{"type":"batch","n":2}' },
  ]);
  // the rest of the half-written line, and one more
  appendFileSync(file, ',"n":3}\n{"type":"leave","n":4}\n');
  await read(reader, got, (g) => g.length >= 5);
  assert.deepEqual(got.slice(3).map((e) => JSON.parse(e.data).n), [3, 4]);
  // shorter: the run continued from its state
  writeFileSync(file, '{"type":"start","n":1}\n{"type":"resume","n":5}\n');
  await read(reader, got, (g) => g.length >= 8);
  assert.deepEqual(got.slice(5).map((e) => e.ev), ['reset', 'message', 'message']);
  assert.deepEqual(got.slice(6).map((e) => JSON.parse(e.data).n), [1, 5]);
  await reader.cancel();
  // a page that comes now: its name, the history, then 'live': it can draw the history in one go, then the lines as they come
  const again = (await fetch(`${url}/run/events`)).body.getReader();
  const first = await read(again, [], (g) => g.some((e) => e.ev === 'live'), { live: true });
  assert.deepEqual(first.map((e) => e.ev), ['run', 'message', 'message', 'live']);
  appendFileSync(file, '{"type":"batch","n":6}\n');
  const later = await read(again, [], (g) => g.length >= 1, { live: true });
  assert.deepEqual(later.map((e) => [e.ev, JSON.parse(e.data).n]), [['message', 6]]);
  await again.cancel();
});

test('a long history: without the warriors that left, the last values and speed, the last 20 screens; then the new lines; --full sends all', { timeout: 15000 }, async () => {
  const run = join(dir, 'long');
  mkdirSync(run, { recursive: true });
  const file = join(run, 'events.jsonl');
  const ev = [{ type: 'start', panel: [{ id: 100 }] }, { type: 'panel' }];
  for (let id = 1; id <= 6; id++) ev.push({ type: 'enter', batch: 0, id, style: { kind: id >= 5 ? 'scanner' : 'paper' } });
  ev.push({ type: 'complete', batch: 0, id: 1 }, { type: 'complete', batch: 0, id: 5 });
  for (let id = 1; id <= 4; id++) ev.push({ type: 'leave', batch: 1, id });
  // the values after each batch: [id, avg, distance, nearest, value, average against the panel]
  for (let n = 1; n <= 3; n++) {
    ev.push({ type: 'values', n, batch: n, values: [[100, 0, 0, 0, 0, 40], [5, 0, 0, 0, 0, 100 + n], [6, 0, 0, 0, 0, 60]] }, { type: 'speed', n }, { type: 'batch', n, batch: n });
    // 2 was the best against the holdout and left: it stays, so that the
    // dashboard can name the run's best
    if (n === 2) ev.push({ type: 'bench', batch: 2, id: 2, avg: 95.2 });
  }
  for (let n = 1; n <= 25; n++) ev.push({ type: 'screen', n });
  ev.push({ type: 'bench', batch: 3, id: 3, avg: 78.9 }, { type: 'bench', batch: 3, id: 6, avg: 80.1 }); // 3 was benched lower and goes
  ev.push({ type: 'elite', batch: 3, index: 1, id: 8 }, { type: 'elite', batch: 4, index: 1, id: 9, replaced: { id: 8 } });
  writeFileSync(file, ev.map((e) => JSON.stringify(e)).join('\n') + '\n');
  const url = await serve(['--run', run], { SERVE_COMPACT_FROM: '100' });
  const history = async () => {
    const res = await fetch(`${url}/run/events`);
    const reader = res.body.getReader();
    const got = await read(reader, [], (g) => g.some((e) => e.data?.includes('"compacted"')));
    return { reader, got: got.slice(1).map((e) => JSON.parse(e.data)) };
  };
  const { reader, got } = await history();
  const kept = (t) => got.filter((e) => e.type === t);
  assert.deepEqual(kept('enter').map((e) => e.id), [2, 5, 6]);
  assert.deepEqual(kept('complete').map((e) => e.id), [5]);
  assert.deepEqual(kept('leave').map((e) => e.id), [2]);
  assert.deepEqual([kept('values').map((e) => e.n), kept('speed').map((e) => e.n), kept('batch').map((e) => e.n)], [[3], [3], [1, 2, 3]]);
  assert.deepEqual(kept('screen').map((e) => e.n), Array.from({ length: 20 }, (_, i) => i + 6));
  assert.deepEqual(kept('bench').map((e) => e.id), [2, 3, 6]); // a benchmark stays, also of a warrior that left
  assert.deepEqual(kept('elite').map((e) => e.id), [9]); // a cell's warrior that was replaced left
  // the progress chart as the whole history gives it, for every batch: best
  // and mean of the members against the panel, the best against the holdout so far
  const progress = [[1, 101, 80.5, -1], [2, 102, 81, -1], [3, 103, 81.5, 95.2]];
  // and the members by kind of style after each batch: 5 and 6 are left of the six, two scanners
  const kinds = [1, 2, 3].map((b) => [b, { scanner: 2 }]);
  assert.deepEqual(got.at(-1), { type: 'compacted', lines: ev.length, dropped: ev.length - got.length + 1, gone: 4, history: progress, kinds });
  // then the new lines as they come, also of warriors that leave later
  appendFileSync(file, '{"type":"enter","batch":5,"id":7}\n{"type":"leave","batch":5,"id":5}\n');
  const more = await read(reader, [], (g) => g.length >= 2);
  assert.deepEqual(more.map((e) => JSON.parse(e.data).id), [7, 5]);
  await reader.cancel();
  // the next page: the same history (kept), then the lines after it as they are, all before 'live': the
  // page draws what it has at 'live', and with the newer lines after it a click on a run drew the batch of
  // the kept history first, then the current one
  const second = (await fetch(`${url}/run/events`)).body.getReader();
  const page = await read(second, [], (g) => g.some((e) => e.ev === 'live'), { live: true });
  await second.cancel();
  assert.deepEqual(page.map((e) => e.ev), ['run', ...Array(got.length + 2).fill('message'), 'live']);
  const lines = page.slice(1, -1).map((e) => JSON.parse(e.data));
  assert.deepEqual(lines.slice(0, got.length), got);
  assert.deepEqual(lines.slice(got.length).map((e) => e.id), [7, 5]);
  // --full: every line
  const fullUrl = await serve(['--full', '--run', run], { SERVE_COMPACT_FROM: '100' });
  const res = await fetch(`${fullUrl}/run/events`);
  const r3 = res.body.getReader();
  const all = await read(r3, [], (g) => g.length >= ev.length + 3);
  assert.equal(all.length, ev.length + 3);
  assert.ok(!all.some((e) => e.data?.includes('"compacted"')));
  await r3.cancel();
  // a run that grew by more than a history that goes out as it is: compacted again, for a page that
  // switches between runs and asks with every click
  appendFileSync(file, `${JSON.stringify({ type: 'leave', batch: 6, id: 6 })}\n${JSON.stringify({ type: 'batch', n: 4, batch: 4, note: 'x'.repeat(100) })}\n`);
  const third = await history();
  await third.reader.cancel();
  assert.deepEqual(third.got.filter((e) => e.type === 'enter').map((e) => e.id), [2, 7]);
  assert.equal(third.got.at(-1).lines, ev.length + 4);
});

test('a long history: without the parents events, the batch events before the last ones summed into one', { timeout: 15000 }, async () => {
  const run = join(dir, 'batches');
  mkdirSync(run, { recursive: true });
  const ev = [{ type: 'start', panel: [] }];
  for (let b = 0; b < 5; b++) {
    ev.push({ type: 'parents', batch: b, pairs: [[1, 2]] });
    ev.push({ type: 'batch', batch: b, evaluated: 10 + b, ops: { random: [b, 1, 1, 0], ...(b === 1 ? { insert: [5, 4, 3, 2] } : {}) } });
  }
  writeFileSync(join(run, 'events.jsonl'), ev.map((e) => JSON.stringify(e)).join('\n') + '\n');
  const url = await serve(['--run', run], { SERVE_COMPACT_FROM: '100', SERVE_KEEP_BATCHES: '2' });
  const reader = (await fetch(`${url}/run/events`)).body.getReader();
  const got = (await read(reader, [], (g) => g.some((e) => e.data?.includes('"compacted"')))).slice(1).map((e) => JSON.parse(e.data));
  await reader.cancel();
  assert.deepEqual(got.filter((e) => e.type === 'parents'), []);
  // batches 0 to 2 as one: what the dashboard adds up (tried, the counts per change) stays the same
  assert.deepEqual(got.filter((e) => e.type === 'batch'), [
    { type: 'batch', batch: 2, evaluated: 33, ops: { random: [3, 3, 3, 0], insert: [5, 4, 3, 2] }, batches: 3 },
    ev[8], ev[10],
  ]);
  assert.deepEqual(got.at(-1), { type: 'compacted', lines: ev.length, dropped: ev.length - got.length + 1, gone: 0 });
});

test('several runs: /runs lists them with their last batch and best score, /run/<n>/events streams each', { timeout: 15000 }, async () => {
  const dirs = ['first', 'second'].map((name) => {
    const d = join(dir, `multi-${name}`);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'events.jsonl'), `{"type":"start","run":"${name}"}\n`);
    return d;
  });
  // the second has batches and a best warrior: /runs shows the last batch and its score against the holdout
  appendFileSync(join(dirs[1], 'events.jsonl'), '{"type":"batch","batch":6,"members":40}\n{"type":"speed","batch":6,"seconds":30}\n{"type":"batch","batch":7,"members":41}\n{"type":"speed","batch":7,"seconds":50}\n');
  // a run counts as running while it wrote within 3 of its batch times, 2 minutes at least: the first
  // wrote 3 minutes ago, the second 2.5 (its batches take 50 s)
  const ago = (min) => new Date(Date.now() - min * 60000);
  utimesSync(join(dirs[0], 'events.jsonl'), ago(3), ago(3));
  utimesSync(join(dirs[1], 'events.jsonl'), ago(2.4), ago(2.4));
  writeFileSync(join(dirs[1], 'best.red'), ';redcode-94nop\n;name Shy Moth\n;strategy evolved, warrior 9 of run seed 3, batch 5\n;strategy 101.5 against 100 holdout warriors, 88.0 against the panel\nDAT 0, 0\n');
  const url = await serve(['--run', ...dirs]); // one --run, two folders
  assert.deepEqual(await (await fetch(`${url}/runs`)).json(), [
    { index: 0, name: 'multi-first', batch: -1, members: 0, holdout: null, bestBatch: null, running: false },
    { index: 1, name: 'multi-second', batch: 7, members: 41, holdout: 101.5, bestBatch: 5, running: true },
  ]);
  for (const [path, name] of [['/run/1/events', 'second'], ['/run/0/events', 'first'], ['/run/events', 'first']]) {
    const res = await fetch(`${url}${path}`);
    const reader = res.body.getReader();
    const got = await read(reader, [], (g) => g.length >= 2);
    assert.equal(JSON.parse(got[1].data).run, name, path);
    await reader.cancel();
  }
  assert.equal((await fetch(`${url}/run/2/events`)).status, 404);
  // the list again after the run wrote more: read again, not from what was kept
  appendFileSync(join(dirs[1], 'events.jsonl'), '{"type":"batch","batch":8,"members":42}\n');
  assert.deepEqual((await (await fetch(`${url}/runs`)).json()).map((x) => [x.batch, x.members]), [[-1, 0], [8, 42]]);
  assert.equal((await fetch(`${url}/ui/runs.html`)).status, 200);
  // all runs in one connection, each line with its run's number
  const res = await fetch(`${url}/runs/events`);
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const reader = res.body.getReader();
  const label = ({ ev, data }) => {
    const m = /^(\d+) (.*)$/.exec(data ?? '');
    if (!m) return '';
    const [, n, rest] = m;
    return `${n} ${ev} ${ev === 'run' ? JSON.parse(rest).name : JSON.parse(rest).run}`;
  };
  const want = ['0 message first', '0 run multi-first', '1 message second', '1 run multi-second'];
  // until all four came: the two runs' lines may come in either order, and reading a fixed count of events
  // left out the first run's start line when the second run's 7 events came first
  const got = await read(reader, [], (g) => want.every((w) => g.some((x) => label(x) === w)));
  await reader.cancel();
  const seen = got.map(label).filter((x) => x && !x.endsWith(' undefined')).sort(); // the start lines and the names, not the batches
  assert.deepEqual(seen, want);
});

test('a folder of islands stands for its islands', { timeout: 15000 }, async () => {
  const isl = join(dir, 'isles');
  for (const n of ['island-02', 'island-01', 'island-10']) {
    mkdirSync(join(isl, n), { recursive: true });
    writeFileSync(join(isl, n, 'events.jsonl'), `{"type":"start","run":"${n}"}\n`);
  }
  writeFileSync(join(isl, 'islands.txt'), '42evolve-islands 1\n');
  writeFileSync(join(isl, 'islands.jsonl'), '{"type":"islands"}\n');
  const single = join(dir, 'isles-single');
  mkdirSync(single, { recursive: true });
  writeFileSync(join(single, 'events.jsonl'), '{"type":"start","run":"single"}\n');
  const url = await serve(['--run', isl, single]);
  const list = await (await fetch(`${url}/runs`)).json();
  assert.deepEqual(list.map((x) => [x.index, x.name]), [[0, 'isles/island-01'], [1, 'isles/island-02'], [2, 'isles/island-10'], [3, 'isles-single']]);
  const res = await fetch(`${url}/run/2/events`);
  const reader = res.body.getReader();
  const got = await read(reader, [], (g) => g.length >= 2);
  await reader.cancel();
  assert.deepEqual([JSON.parse(got[0].data).name, JSON.parse(got[1].data).run], ['isles/island-10', 'island-10']);
  // the islands take turns: one whose own batches take 10 s and that wrote 5 minutes ago waits for the
  // batches of 60 s of the others, the newest write of all is 150 s old (below 3 batches of 60 s); after a score islands.txt has the live ones,
  // the others have stopped; when no island wrote for more than 3 of the slowest batches, the process is gone
  const ago = (n, s) => utimesSync(join(isl, n, 'events.jsonl'), new Date(), new Date(Date.now() - s * 1000));
  const speed = (n, s) => appendFileSync(join(isl, n, 'events.jsonl'), `{"type":"speed","batch":0,"seconds":${s}}\n`);
  speed('island-01', 60), speed('island-02', 60), speed('island-10', 10);
  ago('island-01', 150), ago('island-02', 300), ago('island-10', 300);
  const running = async () => (await (await fetch(`${url}/runs`)).json()).slice(0, 3).map((x) => x.running);
  assert.deepEqual(await running(), [true, true, true]);
  writeFileSync(join(isl, 'islands.txt'), '42evolve-islands 1\nislands 10 2 100 1 200 101 110.5 100\nlive 1 0 0 0 0 0 0 0 0 1\n');
  assert.deepEqual(await running(), [true, false, true]);
  ago('island-01', 420), ago('island-10', 420);
  assert.deepEqual(await running(), [false, false, false]);
});

test('runs that start after the server are added at the end: --watch and the islands of a folder that got islands.txt later', { timeout: 15000 }, async () => {
  const w = join(dir, 'watch');
  const runAt = (d, name) => {
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'events.jsonl'), `{"type":"start","run":"${name}"}\n`);
  };
  runAt(join(w, 'w-a'), 'a');
  mkdirSync(join(w, 'w-empty'), { recursive: true }); // not a run (yet): no events.jsonl
  runAt(join(w, 'other'), 'other'); // another prefix
  const given = join(w, 'given-isl'); // a run of islands given to --run before its pick: islands.jsonl only
  mkdirSync(given, { recursive: true });
  writeFileSync(join(given, 'islands.jsonl'), '{"type":"islands"}\n');
  const url = await serve(['--run', given, '--watch', join(w, 'w-')]);
  const names = async () => (await (await fetch(`${url}/runs`)).json()).map((x) => [x.index, x.name]);
  assert.deepEqual(await names(), [[0, 'w-a']]);
  // a new run, a run of islands before and after its pick, and the given one after its pick
  runAt(join(w, 'w-b'), 'b');
  const isl = join(w, 'w-isl');
  mkdirSync(isl, { recursive: true });
  writeFileSync(join(isl, 'islands.jsonl'), '{"type":"islands"}\n');
  assert.deepEqual(await names(), [[0, 'w-a'], [1, 'w-b']]);
  for (const d of [isl, given]) {
    runAt(join(d, 'island-02'), 'i2'), runAt(join(d, 'island-01'), 'i1');
    writeFileSync(join(d, 'islands.txt'), '42evolve-islands 1\n');
  }
  runAt(join(w, 'w-empty'), 'empty');
  assert.deepEqual(await names(), [[0, 'w-a'], [1, 'w-b'], [2, 'given-isl/island-01'], [3, 'given-isl/island-02'],
    [4, 'w-empty'], [5, 'w-isl/island-01'], [6, 'w-isl/island-02']]);
  // a run added later streams like the others
  const reader = (await fetch(`${url}/run/6/events`)).body.getReader();
  const got = await read(reader, [], (g) => g.length >= 2);
  await reader.cancel();
  assert.deepEqual([JSON.parse(got[0].data).name, JSON.parse(got[1].data).run], ['w-isl/island-02', 'i2']);
});

test('a wrong option or port is refused with the usage', () => {
  const r = (args) => spawnSync(process.execPath, [join(root, 'tools/serve.mjs'), ...args], { encoding: 'utf8', timeout: 10000 });
  for (const [args, why] of [
    [['--runs', dir], /unknown option --runs \(--run\?\)/],
    [['--run'], /--run needs the folder/],
    [['--run', '--x'], /--run needs the folder/],
    [['--watch'], /--watch needs the start/],
    [['80x'], /not a port: '80x'/],
    [['70000'], /not a port/],
    [['8000', '8001'], /one port only/],
  ]) {
    const p = r(args);
    assert.equal(p.status, 2, args.join(' '));
    assert.match(p.stderr, why);
    assert.match(p.stderr, /usage: node tools\/serve.mjs/);
  }
});

test('a port in use: a message with another port, exit code 1', { timeout: 15000 }, async () => {
  const url = await serve([]);
  const port = Number(new URL(url).port);
  const p = spawnSync(process.execPath, [join(root, 'tools/serve.mjs'), String(port), '--run', dir], { encoding: 'utf8', timeout: 10000 });
  assert.equal(p.status, 1);
  assert.match(p.stderr, new RegExp(`port ${port} is in use`));
  assert.ok(p.stderr.includes(`node ${join(root, 'tools/serve.mjs')} ${port + 1} --run `), p.stderr);
  assert.doesNotMatch(p.stderr, /EADDRINUSE|at Server/);
});

test('without --run there are no events, and files are served as before', { timeout: 15000 }, async () => {
  const url = await serve([]);
  assert.equal((await fetch(`${url}/run/events`)).status, 404);
  const page = await fetch(`${url}/ui/evolver.html`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /42evolve/);
});
