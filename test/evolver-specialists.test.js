// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --specialists with --panel-choice kinds. What the evolver's test files share is in
// test/evolver-common.js; built with cc, or prebuilt in M42_BIN
// (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { paretoFronts, pushoffValues, sdDistance, standardError, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { bestRedInfo } from '../tools/progress.js';
import { setup, cleanup, tmp, skip, TINY, run, events, stable, base, checkValues } from './evolver-common.js';

before(setup);
after(cleanup);

test('--specialists --panel-choice kinds: the member clearly best against a panel warrior stays, a panel of every kind; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.specialists, false);
  const BATCHES = 12;
  const args = [...TINY, '--specialists', '--panel-choice', 'kinds', '--pick-sample', '40', '--list', '16', '--panel-rounds', '100', '--survivors', '8'];
  run(join(tmp, 'spec1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'spec1'));
  assert.deepEqual([one[0].params.specialists, one[0].params.panelChoice], [true, 'kinds']);
  // every push-off with the protection replayed, every specialists event recomputed
  assert.equal(checkValues(one), BATCHES);
  assert.ok(checkValues.specials >= 2, `the protection changed who left in ${checkValues.specials} push-offs`);
  assert.ok(checkValues.specialParents >= 5, `${checkValues.specialParents} children of a protected parent`);
  assert.equal(one.filter((e) => e.type === 'specialists').length, BATCHES);
  // the panel: the kinds take turns, each kind's strongest first
  const picks = one.find((e) => e.type === 'pick').picked;
  const kinds = [...new Set(picks.map((p) => p.kind))];
  assert.ok(kinds.length >= 3, kinds.join(', '));
  assert.deepEqual(picks.slice(0, kinds.length).map((p) => p.kind).sort(), [...kinds].sort(), 'one of each kind first');
  for (const k of kinds) {
    const ranks = picks.filter((p) => p.kind === k).map((p) => p.rank);
    assert.equal(ranks[0], Math.min(...ranks), `${k}: the strongest first`);
  }
  // a kind gets its next pick only when no kind has fewer (while it has warriors left)
  const seen = new Map();
  for (const p of picks) {
    const n = seen.get(p.kind) ?? 0;
    const fewer = kinds.filter((k) => (seen.get(k) ?? 0) < n && picks.slice(picks.indexOf(p)).some((q) => q.kind === k));
    assert.deepEqual(fewer, [], `${p.file} (${p.kind}) before a pick of ${fewer.join(', ')}`);
    seen.set(p.kind, n + 1);
  }
  run(join(tmp, 'spec-resumed'), [...args, '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'spec-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'spec-resumed'))), stable(one));
});
