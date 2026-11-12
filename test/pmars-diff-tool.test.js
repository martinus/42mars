// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// tools/pmars-diff.mjs cleans up its temporary folder. A stand-in script
// takes pMARS's place, so this runs without pMARS: one that prints our own
// listing (nothing differs), one that prints nothing (everything differs)
// and one that hangs (the run gets aborted).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tool = join(root, 'tools/pmars-diff.mjs');
const dir = mkdtempSync(join(tmpdir(), 'pmars-diff-tool-test-'));
after(() => rmSync(dir, { recursive: true, force: true }));

function script(name, text) {
  const p = join(dir, name);
  writeFileSync(p, text);
  chmodSync(p, 0o755);
  return p;
}
const url = (rel) => pathToFileURL(join(root, rel)).href;
// Answers `pmars <rules> -r 0 file` with our own listing, as pMARS would if
// we were right about everything.
const agrees = script('agrees.mjs', `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { assembleWasm as assemble } from ${JSON.stringify(url('wasm/42mars.js'))};
import { formatListing } from ${JSON.stringify(url('tools/opcodes.js'))};
const w = assemble(readFileSync(process.argv.at(-1), 'latin1'), { warriors: 1, rounds: 0, registers: { w: 1, s: 1 } }); // as pmars -r 0 file
if (w.ok) process.stdout.write(formatListing(w, 8000));
`);
const silent = script('silent.sh', '#!/bin/sh\nexit 0\n');
const hangs = script('hangs.sh', '#!/bin/sh\nexec sleep 3\n');

// Runs the tool with its own temporary directory; returns the output and the
// pmars-diff-* folders left in that directory.
function run(fake, extra = []) {
  const tmp = mkdtempSync(join(dir, 'tmp-'));
  let out;
  let code = 0;
  try {
    out = execFileSync(process.execPath, [tool, '--pmars', fake, '--only', 'exprs', '--scale', '0.01', '--jobs', '2', ...extra],
      { encoding: 'utf8', env: { ...process.env, TMPDIR: tmp } });
  } catch (e) {
    out = e.stdout;
    code = e.status;
  }
  return { out, code, left: readdirSync(tmp).filter((f) => f.startsWith('pmars-diff-')) };
}

test('pmars-diff: a run without differences deletes its temporary folder', () => {
  const r = run(agrees);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^SAME: 0 differences, \d+ s$/m);
  assert.doesNotMatch(r.out, /tmp files/);
  assert.deepEqual(r.left, []);
});

test('pmars-diff: a run with differences keeps its folder and prints the path', () => {
  const r = run(silent);
  assert.equal(r.code, 1);
  assert.equal(r.left.length, 1);
  assert.match(r.out, new RegExp(`^DIFFERENT: \\d+ differences, \\d+ s, tmp files in .*${r.left[0]}$`, 'm'));
  assert.ok(readdirSync(join(r.out.match(/tmp files in (.*)$/m)[1])).length > 0);
});

test('pmars-diff: a folder given with --tmp is never deleted', () => {
  const own = join(dir, 'own');
  mkdirSync(own);
  writeFileSync(join(own, 'keep.txt'), 'mine');
  const r = run(agrees, ['--tmp', own]);
  assert.equal(r.code, 0, r.out);
  assert.ok(existsSync(join(own, 'keep.txt')));
  assert.ok(readdirSync(own).some((f) => f.endsWith('.red')));
});

test('pmars-diff: Ctrl-C without differences so far deletes the folder', async () => {
  const tmp = mkdtempSync(join(dir, 'tmp-'));
  const child = spawn(process.execPath, [tool, '--pmars', hangs, '--only', 'exprs', '--scale', '0.01', '--jobs', '1'],
    { env: { ...process.env, TMPDIR: tmp } });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  const folders = () => readdirSync(tmp).filter((f) => f.startsWith('pmars-diff-'));
  // Wait until the first warrior is written, then interrupt.
  while (!(folders().length && readdirSync(join(tmp, folders()[0])).length)) {
    await new Promise((r) => setTimeout(r, 20));
  }
  child.kill('SIGINT');
  const code = await new Promise((r) => child.on('exit', r));
  assert.equal(code, 130);
  assert.match(out, /^aborted: 0 differences so far$/m);
  assert.deepEqual(folders(), []);
});

// `--pmars-trace` without its binary took the next option as the binary:
// every battle then counted as a difference (4,800 in one run).
test('pmars-diff: an option without its value and an unknown option are refused before anything runs', () => {
  const refused = (extra, message) => {
    const tmp = mkdtempSync(join(dir, 'tmp-'));
    const r = spawnSync(process.execPath, [tool, '--pmars', agrees, '--only', 'exprs', '--scale', '0.01', '--jobs', '2', ...extra],
      { encoding: 'utf8', env: { ...process.env, TMPDIR: tmp } });
    assert.equal(r.status, 2, `${extra.join(' ')}: ${r.stdout}${r.stderr}`);
    assert.ok(r.stderr.includes(message), r.stderr);
    assert.equal(r.stdout, '');
    assert.deepEqual(readdirSync(tmp), [], 'no temporary folder is made');
  };
  refused(['--pmars-trace', '--watch'], 'pmars-diff: --pmars-trace needs a value');
  refused(['--corpus'], 'pmars-diff: --corpus needs a value');
  refused(['--permut'], 'pmars-diff: unknown option --permut');
  refused(['stray'], 'pmars-diff: unknown option stray');
  // What the logged commands carry stays accepted.
  const ok = run(agrees, ['--wasm', '--seed', '7']);
  assert.equal(ok.code, 0, ok.out);
});
