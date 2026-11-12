#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Runs shell commands one after the other, for checks that take minutes and
// run in the background. Prints for each: the command, the last lines of
// its output (stdout and stderr together) and its exit code. The last line
// is the sentinel to wait for.
//
//   nohup node .claude/skills/engine-check/in-order.mjs commands.txt > out.txt 2>&1 &
//   until grep -q '^ALL DONE' out.txt; do sleep 15; done     # in the background
//
// commands.txt: one bash command per line; empty lines and lines that start
// with # are skipped. A failing command does not stop the rest.
// --tail n     lines of output shown per command (default 12)
// --logs dir   keep the whole output of command k in dir/k.txt
// Exit code 1 when a command failed, 2 for wrong arguments.

import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function fail(message) {
  process.stderr.write(`in-order: ${message}\nusage: node in-order.mjs commands.txt [--tail n] [--logs dir]\n`);
  process.exit(2);
}
let file = null, tail = 12, logs = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tail' || argv[i] === '--logs') {
    if (i + 1 >= argv.length) fail(`${argv[i]} needs a value`);
    if (argv[i] === '--tail') tail = Number(argv[++i]);
    else logs = argv[++i];
  } else if (argv[i].startsWith('--') || file !== null) {
    fail(`unknown argument ${argv[i]}`);
  } else {
    file = argv[i];
  }
}
if (file === null) fail('no file with commands');
if (!(Number.isInteger(tail) && tail >= 0)) fail('--tail takes a whole number');
let text;
try {
  text = readFileSync(file, 'utf8');
} catch (e) {
  fail(`cannot read ${file}: ${e.code}`);
}
const commands = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

const dir = logs ?? mkdtempSync(join(tmpdir(), 'in-order-'));
if (logs) mkdirSync(logs, { recursive: true });
let failed = 0;
commands.forEach((command, k) => {
  const log = join(dir, `${k + 1}.txt`);
  const fd = openSync(log, 'w');
  const start = Date.now();
  const r = spawnSync('bash', ['-c', command], { stdio: ['ignore', fd, fd] });
  closeSync(fd);
  const lines = readFileSync(log, 'latin1').replace(/\n$/, '').split('\n');
  const shown = tail === 0 || (lines.length === 1 && lines[0] === '') ? [] : lines.slice(-tail);
  const ok = r.status === 0;
  if (!ok) failed++;
  const how = r.status === null ? `killed by ${r.signal ?? r.error?.code}` : `exit ${r.status}`;
  process.stdout.write([`$ ${command}`, ...shown, `${how}, ${Math.round((Date.now() - start) / 1000)} s`, '', ''].join('\n'));
});
if (!logs) rmSync(dir, { recursive: true, force: true });
process.stdout.write(`ALL DONE: ${commands.length} commands, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
