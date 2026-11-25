// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// How much slower a busy machine runs the tests: 1 up to a 1-minute load of
// a quarter of the cores, the load per quarter of the cores above that.
// Time bounds of tests are multiplied by it. At load 70 on 32 cores (two
// evolver runs in the idle class next to the tests) the 3 s bounds of
// test/asm-c.test.js took 6 to 14 s, on main as on the branch, and the
// 120 s limit of an evolver run failed: false reds that each needed a
// timing of main to rule out (25th November 2026). The bounds catch work
// that grew by orders of magnitude (hours, #87), which a factor of 10 keeps.

import { availableParallelism, loadavg } from 'node:os';

export function slowdown(load = loadavg()[0], cores = availableParallelism()) {
  return Math.max(1, load / Math.max(1, cores / 4));
}
