#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Builds lib/example.c with lib/42mars.c (the C library through its public
// header) and compares it with pMARS on every pairing of a folder of
// warriors: `example -r R -F pos a b` against `pmars -b -k -r R -F pos a b`,
// wins and ties of both warriors. Prints SAME or each difference; exit
// code 1 on a difference.
//
//   node tools/example-check.mjs <warrior dir> --pmars path/to/pmars
//        [--rounds 100] [--cc cc] [--cflags "-O2"] [--jobs N] [--seed 1]

import { execFileSync, execFile } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const PMARS = opt('pmars', null);
const ROUNDS = Number(opt('rounds', 100));
const CC = opt('cc', 'cc');
const CFLAGS = opt('cflags', '-O2').split(/\s+/).filter(Boolean);
const JOBS = Number(opt('jobs', availableParallelism()));
let seed = Number(opt('seed', 1)) >>> 0 || 1;
const [dir] = argv;
if (!dir || !PMARS) {
  console.error('usage: node tools/example-check.mjs <warrior dir> --pmars path/to/pmars [--rounds 100] [--cc cc] [--cflags "-O2"] [--jobs N] [--seed 1]');
  process.exit(2);
}

const lib = fileURLToPath(new URL('../lib/', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'example-check-'));
try {
  const bin = join(tmp, 'example');
  execFileSync(CC, [...CFLAGS, '-o', bin, join(lib, 'example.c'), join(lib, '42mars.c')], { stdio: 'inherit' });
  const files = readdirSync(dir).filter((f) => /\.red$/i.test(f)).sort().map((f) => join(dir, f));
  const rand = (k) => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    return seed % k;
  };
  const pairs = [];
  for (let a = 0; a < files.length; a++) {
    for (let b = a + 1; b < files.length; b++) pairs.push([files[a], files[b], 100 + rand(8000 + 1 - 200)]);
  }
  const wt = (out) => out.trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
  let next = 0;
  let differences = 0;
  let skipped = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, pairs.length) }, async () => {
    while (next < pairs.length) {
      const [a, b, pos] = pairs[next++];
      const args = ['-r', String(ROUNDS), '-F', String(pos), a, b];
      let ours;
      try {
        ours = wt((await run(bin, args)).stdout).map(([w, , t]) => [w, t]);
      } catch {
        skipped++; // a warrior that does not assemble
        continue;
      }
      const theirs = wt((await run(PMARS, ['-b', '-k', ...args], { timeout: 120000 })).stdout);
      if (JSON.stringify(ours) !== JSON.stringify(theirs)) {
        differences++;
        console.log(`DIFF ${a} ${b} -F ${pos}: example ${JSON.stringify(ours)}, pmars ${JSON.stringify(theirs)}`);
      }
    }
  }));
  console.log(differences ? `${differences} of ${pairs.length - skipped} pairings differ` : `SAME: ${pairs.length - skipped} pairings (${skipped} skipped: a warrior did not assemble)`);
  process.exitCode = differences ? 1 : 0;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
