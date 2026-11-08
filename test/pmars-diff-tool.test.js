// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
// tools/pmars-diff.mjs cleans up its temporary folder. A stand-in script
// takes pMARS's place, so this runs without pMARS: one that prints our own
// listing (nothing differs), one that prints nothing (everything differs)
// and one that hangs (the run gets aborted).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tool = join(root, 'tools/pmars-diff.mjs');
const dir = mkdtempSync(join(tmpdir(), 'pmars-diff-tool-test-'));

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
import { assemble } from ${JSON.stringify(url('src/engine/assembler.js'))};
import { formatListing } from ${JSON.stringify(url('src/engine/opcodes.js'))};
const w = assemble(readFileSync(process.argv.at(-1), 'latin1'), { warriors: 1, rounds: 0 });
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
