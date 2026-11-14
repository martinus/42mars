#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Mutation proof for new tests (engine-check, step 7): applies each mutant,
// runs the test command under a timeout, reports which tests failed, and
// restores the file. A mutant in lib/ rebuilds 42mars.wasm and must change
// its md5 (else the old build ran and the result says nothing); at the end
// the md5 must be the original again.
//
//   node .claude/skills/engine-check/mutate.mjs <mutants.json> [--timeout 120] [--memory 8] -- <command> [args...]
//
// The test command runs with at most --memory GB (a systemd scope, where
// systemd-run --user works; without it, no limit): a mutant of the
// simulator took all 62 GB of the machine, the kernel killed the session,
// and the mutant stayed in the tree (14th November 2026).
//
// mutants.json: [{ "name": "...", "file": "lib/src/asm.c", "old": "text", "new": "text" }, ...]
// `old` must occur exactly once in `file`. Prints one line per mutant,
// "FAILS: <the not ok lines>", "SURVIVED" or "KILLED" (a signal that is not
// the timeout's, e.g. the memory limit: no result, run that mutant again
// with a smaller test), and exits 1 when one survived or was killed, or a
// file or 42mars.wasm did not come back.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const sep = args.indexOf('--');
const own = sep < 0 ? args : args.slice(0, sep);
const command = sep < 0 ? [] : args.slice(sep + 1);
let timeout = 120;
let memory = 8;
const files = [];
for (let i = 0; i < own.length; i++) {
  if (own[i] === '--timeout' && /^\d+$/.test(own[i + 1] ?? '')) timeout = Number(own[++i]);
  else if (own[i] === '--memory' && /^\d+$/.test(own[i + 1] ?? '')) memory = Number(own[++i]);
  else if (own[i].startsWith('-')) { console.error(`mutate.mjs: unknown option or missing value: ${own[i]}`); process.exit(2); }
  else files.push(own[i]);
}
if (files.length !== 1 || !command.length) {
  console.error('usage: node .claude/skills/engine-check/mutate.mjs <mutants.json> [--timeout 120] [--memory 8] -- <command> [args...]');
  process.exit(2);
}

const mutants = JSON.parse(readFileSync(files[0], 'utf8'));
// The memory limit, and the timeout once more for the whole process group.
const scope = ['systemd-run', '--user', '--scope', '--quiet', '-p', `MemoryMax=${memory}G`, '-p', 'MemorySwapMax=0', '-p', `RuntimeMaxSec=${timeout + 5}`];
const limited = spawnSync(scope[0], [...scope.slice(1), 'true'], { stdio: 'ignore' }).status === 0;
if (!limited) console.log('no systemd-run --user here: the tests run without a memory limit');
const run = limited ? [...scope, ...command] : command;
const WASM = 'wasm/42mars.wasm';
const md5 = () => (existsSync(WASM) ? createHash('md5').update(readFileSync(WASM)).digest('hex') : '');
const build = () => spawnSync('sh', ['wasm/build.sh'], { stdio: 'ignore' }).status === 0;
const base = md5();
let bad = false;
let rebuilt = false;

for (const m of mutants) {
  const original = readFileSync(m.file, 'latin1');
  const count = original.split(m.old).length - 1;
  if (count !== 1) { console.log(`== ${m.name}: "old" occurs ${count} times in ${m.file}, skipped`); bad = true; continue; }
  writeFileSync(m.file, original.replace(m.old, m.new), 'latin1');
  try {
    let note = '';
    if (m.file.startsWith('lib/')) {
      rebuilt = true;
      if (!build()) note = ' (wasm/build.sh failed)';
      else if (md5() === base) note = ' (42mars.wasm did not change)';
    }
    const r = spawnSync(run[0], run.slice(1), { encoding: 'utf8', timeout: timeout * 1000, maxBuffer: 1 << 28 });
    const failed = (r.stdout ?? '').split('\n').filter((l) => l.startsWith('not ok'));
    const timedOut = r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM';
    if (r.signal && !timedOut && !failed.length) {
      console.log(`== ${m.name}${note}: KILLED by ${r.signal} (memory limit ${memory} GB?): no result`);
      bad = true;
    } else if (failed.length || timedOut || r.status !== 0) {
      console.log(`== ${m.name}${note}: FAILS${timedOut ? ` (timeout ${timeout} s)` : ''}${failed.length ? `: ${failed.join(' | ')}` : r.status !== 0 ? `: exit ${r.status}` : ''}`);
    } else {
      console.log(`== ${m.name}${note}: SURVIVED`);
      bad = true;
    }
    if (note) bad = true;
  } finally {
    writeFileSync(m.file, original, 'latin1');
  }
  if (readFileSync(m.file, 'latin1') !== original) { console.log(`== ${m.name}: ${m.file} NOT RESTORED`); bad = true; }
}
if (rebuilt) {
  build();
  if (md5() !== base) { console.log(`${WASM} is not the original build again`); bad = true; }
}
process.exit(bad ? 1 : 0);
