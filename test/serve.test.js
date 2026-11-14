// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// tools/serve.mjs --run: /run/events streams the events.jsonl of a 42evolve
// run to the dashboard (ui/evolver.html): complete lines only, new lines as
// they are written, and `reset` when the file got shorter (a continued run).

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

async function serve(args) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const p = spawn(process.execPath, [join(root, 'tools/serve.mjs'), String(port), ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
  servers.push(p);
  await new Promise((resolve) => p.stdout.on('data', resolve));
  return `http://127.0.0.1:${port}`;
}

// Reads server-sent events until `until` returns true for the list so far.
async function read(reader, got, until) {
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
      got.push({ ev, data: /^data: (.*)$/m.exec(part)?.[1] });
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
});

test('several runs: /runs lists them, /run/<n>/events streams each', { timeout: 15000 }, async () => {
  const dirs = ['first', 'second'].map((name) => {
    const d = join(dir, `multi-${name}`);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'events.jsonl'), `{"type":"start","run":"${name}"}\n`);
    return d;
  });
  const url = await serve(['--run', ...dirs]); // one --run, two folders
  assert.deepEqual(await (await fetch(`${url}/runs`)).json(), [{ index: 0, name: 'multi-first' }, { index: 1, name: 'multi-second' }]);
  for (const [path, name] of [['/run/1/events', 'second'], ['/run/0/events', 'first'], ['/run/events', 'first']]) {
    const res = await fetch(`${url}${path}`);
    const reader = res.body.getReader();
    const got = await read(reader, [], (g) => g.length >= 2);
    assert.equal(JSON.parse(got[1].data).run, name, path);
    await reader.cancel();
  }
  assert.equal((await fetch(`${url}/run/2/events`)).status, 404);
  assert.equal((await fetch(`${url}/ui/runs.html`)).status, 200);
});

test('a wrong option or port is refused with the usage', () => {
  const r = (args) => spawnSync(process.execPath, [join(root, 'tools/serve.mjs'), ...args], { encoding: 'utf8', timeout: 10000 });
  for (const [args, why] of [
    [['--runs', dir], /unknown option --runs \(--run\?\)/],
    [['--run'], /--run needs the folder/],
    [['--run', '--x'], /--run needs the folder/],
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
