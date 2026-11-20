// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// node test/part.mjs <k>/<n>: the test files of part k of n of the tests of
// the C programs (those of `make test`: test/c-api.test.js,
// test/cli.test.js, test/evolver*.test.js), for CI jobs that run them at
// the same time (#161): `make test TESTS="$(node test/part.mjs 1/3)"`.
// Every file is in exactly one part, a new one too. The files go by their
// time, the longest first, each to the part with the least time so far;
// the times are seconds of each file alone, natively on 32 threads (20th
// November 2026), and a file not listed counts 5. A wrong time makes the
// parts uneven, it does not leave a file out.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SECONDS = {
  'test/evolver-defaults.test.js': 13.3,
  'test/evolver-tune.test.js': 11.2,
  'test/evolver.test.js': 9.9,
  'test/evolver-difference.test.js': 9.8,
  'test/evolver-sharing.test.js': 9.3,
  'test/evolver-select.test.js': 9.1,
  'test/evolver-pareto.test.js': 7.9,
  'test/evolver-crowding.test.js': 7.5,
  'test/evolver-specialists.test.js': 6.9,
  'test/evolver-map-elites.test.js': 3.7,
  'test/cli.test.js': 0.4,
  'test/c-api.test.js': 0.3,
};

// The files of `make test`, in the order of the Makefile's list.
export function files(dir = fileURLToPath(new URL('.', import.meta.url))) {
  const evolver = readdirSync(dir).filter((f) => /^evolver.*\.test\.js$/.test(f)).sort().map((f) => `test/${f}`);
  return ['test/c-api.test.js', 'test/cli.test.js', ...evolver];
}

// parts[i]: the files of part i + 1 of n, each in the order of files().
export function parts(n, list = files()) {
  const time = (f) => SECONDS[f] ?? 5;
  const out = Array.from({ length: n }, () => ({ files: [], seconds: 0 }));
  for (const f of [...list].sort((a, b) => time(b) - time(a) || (a < b ? -1 : 1))) {
    const p = out.reduce((best, x) => (x.seconds < best.seconds ? x : best));
    p.files.push(f);
    p.seconds += time(f);
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
