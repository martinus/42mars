// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// .claude/skills/ui-check/page.mjs: a page in headless Chrome, with clicks,
// keys, expressions and screenshots in the order of the arguments.

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../.claude/skills/ui-check/page.mjs', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'ui-page-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const noChrome = spawnSync('google-chrome', ['--version'], { encoding: 'utf8' }).status !== 0 && 'no google-chrome';

// the script on a page, not blocking this process: it serves the page
const page = (args) => new Promise((resolve) => {
  execFile(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 60000 }, (error, stdout, stderr) => resolve({ status: error ? error.code : 0, stdout, stderr }));
});

test('page.mjs refuses a missing url, an unknown option and a wrong value', () => {
  for (const args of [[], ['--wait', '1'], ['http://127.0.0.1:1/', '--frobnicate', '1'], ['http://127.0.0.1:1/', '--wait', 'soon'],
    ['http://127.0.0.1:1/', '--click'], ['http://127.0.0.1:1/', '--clip', '1,2,3'], ['http://127.0.0.1:1/', '--size', '1680']]) {
    const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /usage: page\.mjs/);
  }
});

test('page.mjs: clicks, keys and expressions in their order, a screenshot, and the errors of the page', { skip: noChrome, timeout: 120000 }, async () => {
  const html = (body) => `<!doctype html><title>start</title><button id="b">go</button><script>
    document.getElementById('b').addEventListener('click', () => { document.title = 'clicked'; });
    window.addEventListener('keydown', (e) => { window.pressed = e.key; });
    ${body}</script>`;
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(html(req.url === '/broken' ? "console.error('it broke');" : ''));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const shot = join(tmp, 'shot.png');
    const ok = await page([`${url}/`, '--wait', '1', '--size', '400x300', '--eval', 'document.title', '--click', '#b', '--eval', 'document.title',
      '--key', ']', '--eval', 'window.pressed', '--eval', '[innerWidth, innerHeight]', '--clip', '0,0,40,20', '--shot', shot]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(ok.stdout.trim().split('\n').map((l) => JSON.parse(l)), ['start', 'clicked', ']', [400, 300]]);
    const png = readFileSync(shot);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [40, 20]); // the clip
    // a console error of the page, and a click on nothing: exit code 1, each named
    const broken = await page([`${url}/broken`, '--wait', '1', '--click', '#nothing', '--eval', 'document.title']);
    assert.equal(broken.status, 1);
    assert.equal(broken.stdout.trim(), '"start"');
    assert.match(broken.stderr, /error: it broke/);
    assert.match(broken.stderr, /error: --click #nothing: no such element/);
  } finally {
    server.close();
  }
});
