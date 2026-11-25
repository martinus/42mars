// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slowdown } from './load.js';

test('time bounds grow with the load above a quarter of the cores, never shrink', () => {
  assert.equal(slowdown(0, 32), 1);
  assert.equal(slowdown(8, 32), 1);
  assert.equal(slowdown(70, 32), 8.75);
  assert.equal(slowdown(3, 1), 3);
  assert.ok(slowdown() >= 1);
});
