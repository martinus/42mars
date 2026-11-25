// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// node test/part.mjs <k>/<n>: the test files of part k of n of the tests of
// the C programs (those of `make test`: test/c-api.test.js,
// test/cli.test.js, test/evolver*.test.js), for CI jobs that run them at
// the same time (#161): `make test TESTS="$(node test/part.mjs 1/3)"`.
// Every file is in exactly one part, a new one too. The files go by their
// time, the longest first, each to the part with the least time so far;
// the times are the seconds of each file's tests under ASan and UBSan on
// CI, summed from the durations of its tests in one run (45608326769, 25th
// November 2026; evolver-tune and evolver-defaults estimated after #161
// split the one and shortened the other), and a file not listed counts 20.
// On 4 cores the files run 3 at a time and slow each other: these sums,
// not the times of a file alone on 32 threads (which made one native part
// 110 s of tests and the other 61 s). A wrong time makes the parts uneven,
// it does not leave a file out.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SECONDS = {
  'test/evolver-defaults.test.js': 60.0,
  'test/evolver-tune.test.js': 50.0,
  'test/evolver-gen.test.js': 40.2,
  'test/evolver-migrate.test.js': 37.0,
  'test/evolver-genome.test.js': 35.6,
  'test/evolver.test.js': 28.1,
  'test/evolver-pareto.test.js': 20.8,
  'test/evolver-average.test.js': 15.8,
  'test/evolver-screen.test.js': 11.4,
  'test/c-api.test.js': 1.0,
  'test/cli.test.js': 0.8,
};

// The files of `make test`, in the order of the Makefile's list.
export function files(dir = fileURLToPath(new URL('.', import.meta.url))) {
  const evolver = readdirSync(dir).filter((f) => /^evolver.*\.test\.js$/.test(f)).sort().map((f) => `test/${f}`);
  return ['test/c-api.test.js', 'test/cli.test.js', ...evolver];
}

// parts[i]: the files of part i + 1 of n, each in the order of files().
export function parts(n, list = files()) {
  const time = (f) => SECONDS[f] ?? 20;
  const out = Array.from({ length: n }, () => ({ files: [], seconds: 0 }));
  for (const f of [...list].sort((a, b) => time(b) - time(a) || (a < b ? -1 : 1))) {
    const p = out.reduce((best, x) => (x.seconds < best.seconds ? x : best));
    p.files.push(f);
    p.seconds += time(f);
  }
  // then, while it makes the longest part shorter, a file of it moves to
  // another part or swaps with one there (four sanitizer parts: 91.5 s of
  // the times for the longest after the first pass, 83.4 s after this)
  for (;;) {
    const top = out.reduce((best, x) => (x.seconds > best.seconds ? x : best));
    let best = null;
    for (const q of out) {
      if (q === top) continue;
      for (const f of top.files) {
        for (const g of [null, ...q.files]) {
          const d = time(f) - (g ? time(g) : 0);
          const worse = Math.max(top.seconds - d, q.seconds + d);
          if (d > 0 && worse < top.seconds - 1e-9 && (!best || worse < best.worse)) best = { q, f, g, d, worse };
        }
      }
    }
    if (!best) break;
    top.files.splice(top.files.indexOf(best.f), 1);
    best.q.files.push(best.f);
    if (best.g) best.q.files.splice(best.q.files.indexOf(best.g), 1), top.files.push(best.g);
    top.seconds -= best.d;
    best.q.seconds += best.d;
  }
  return out.map((p) => list.filter((f) => p.files.includes(f)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const m = /^(\d+)\/(\d+)$/.exec(process.argv[2] ?? '');
  const k = m ? Number(m[1]) : 0, n = m ? Number(m[2]) : 0;
  if (!m || n < 1 || k < 1 || k > n) {
    console.error('usage: node test/part.mjs <k>/<n>, 1 <= k <= n');
    process.exit(2);
  }
  console.log(parts(n)[k - 1].join(' '));
}
