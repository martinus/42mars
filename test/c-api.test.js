// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The C library through its public header (lib/42mars.h), built natively
// with `cc`: test/c/api-test.c drives the functions and prints JSON, which
// must agree with js/assembler.js and the wasm engine. Also builds
// lib/example.c. Skipped when there is no `cc`.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble } from '../js/assembler.js';
import { createWasmMarsSync } from '../wasm/42mars.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const hasCc = spawnSync('cc', ['--version']).status === 0;
const tmp = mkdtempSync(join(tmpdir(), 'c-api-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const warriorDir = join(root, 'warriors');
const repo = readdirSync(warriorDir).filter((f) => f.endsWith('.red')).sort().map((f) => join(warriorDir, f));
// Last, a source with errors and warnings: it does not assemble.
const broken = join(tmp, 'broken.red');
writeFileSync(broken, ';name Broken\nloop mov 0\n jmp loop, x\nloop dat 1\n', 'latin1');
const files = [...repo, broken];
const codes = files.map((f) => assemble(readFileSync(f, 'latin1')));

test('the C library through 42mars.h agrees with the JS assembler and the wasm engine', { skip: !hasCc && 'no cc' }, () => {
  const bin = join(tmp, 'api-test');
  execFileSync('cc', ['-std=c11', '-O2', '-Wall', '-Wextra', '-o', bin, join(root, 'test/c/api-test.c'), join(root, 'lib/42mars.c')], { stdio: 'pipe' });
  const out = JSON.parse(execFileSync(bin, files, { encoding: 'latin1' }));
  assert.equal(out.version, '0.1.0');

  // assembling, with working memory too small at first, then packed
  out.warriors.forEach((w, i) => {
    const c = codes[i];
    assert.ok(w.tries > 1, 'the first sizes were too small');
    assert.deepEqual(
      { ok: Boolean(w.ok), name: w.name, author: w.author, start: w.start, pin: w.pin, instructions: w.instructions, messages: w.messages },
      {
        ok: c.ok, name: c.name, author: c.author, start: c.start, pin: c.pin,
        instructions: c.instructions.map((x) => [x.op, x.mod, x.aMode, x.aVal, x.bMode, x.bVal, x.line]),
        messages: [...c.errors.map((e) => [1, e.line ?? 0, e.text]), ...c.warnings.map((e) => [0, e.line ?? 0, e.text])],
      },
    );
  });
  assert.equal(out.ctxTooSmall, 1);

  assert.ok(out.warriors[files.length - 1].messages.length >= 2);
  assert.equal(codes[files.length - 1].ok, false);

  // matches: warrior 0 against each other one, as runMatch plays them
  const m = createWasmMarsSync();
  let total = 0;
  out.matches.forEach((got, k) => {
    const r = m.runMatch([codes[0], codes[k + 1]], { rounds: 20, seed: 1234 });
    total += r.instructions;
    assert.deepEqual(got, {
      status: 0,
      instructions: r.instructions,
      scores: r.warriors.map((w) => [w.wins, w.losses, w.ties]),
    });
    assert.deepEqual([out.bench.scores[2 * k], out.bench.scores[2 * k + 1]], got.scores);
  });
  assert.equal(out.bench.status, 0);
  assert.equal(out.bench.instructions, total);

  // stepping: three rounds in steps of 1000, the core after each
  const s = out.steps[0];
  assert.equal(s.load, 0);
  m.load([codes[0], codes[1]], { seed: 1234 });
  for (let round = 0; round < 3; round++) {
    m.startRound();
    let executed = 0;
    while (!m.roundOver) executed += m.run(1000);
    const u8 = m.bytes();
    const at = m.x.mars_core();
    let h = 2166136261;
    for (let i = 0; i < m.coreSize * 4; i++) h = Math.imul(h ^ (u8[at + 2 * i] | (u8[at + 2 * i + 1] << 8)), 16777619) >>> 0;
    assert.deepEqual(s[`r${round}`], {
      executed, time: m.time, round: m.round, hash: h,
      alive: m.warriors.map((w) => (w.alive ? 1 : 0)), position: m.warriors[1].position,
    });
  }
  m.startRound();
  m.run(50);
  const queue = m.warriors[0].processes();
  assert.deepEqual(s.queue, [queue.length, ...queue.slice(0, 8)]);

  // p-space: set and get cell 7, then cell 500 (out of range) and warrior 5
  assert.deepEqual(s.pspace, [0, 0, 4242, -3, -3]);
  // no warriors, a core of 70000, three warriors with rules for two, no
  // context, assembling with the bad rules, the broken warrior in a match
  assert.deepEqual(out.errors, [-3, 1, -3, -3, -2, -4]);
  // the same PIN shares p-space cell 3, not the last result; another PIN
  // does not share
  assert.deepEqual(out.pin, [99, 4294967295 & 7999, 0]);
  // two warriors of max_length fit into a context of m42_ctx_size()
  assert.deepEqual(out.full, [100, 0]);
});

test('lib/example.c builds with cc example.c 42mars.c and plays a match', { skip: !hasCc && 'no cc' }, () => {
  const bin = join(tmp, 'example');
  execFileSync('cc', ['-o', bin, 'example.c', '42mars.c'], { cwd: join(root, 'lib'), stdio: 'pipe' });
  const lantern = join(warriorDir, 'lantern.red'), origami = join(warriorDir, 'origami.red');
  const out = execFileSync(bin, ['-r', '100', '-F', '4000', lantern, origami], { encoding: 'utf8' });
  // pmars -b -k -r 100 -F 4000 lantern.red origami.red prints "1 9" and "90 9"
  // (wins ties); the same match on the wasm engine:
  const r = createWasmMarsSync().runMatch([codes[files.indexOf(lantern)], codes[files.indexOf(origami)]], { rounds: 100, seed: 3900 });
  assert.equal(out, r.warriors.map((w) => `${w.wins} ${w.losses} ${w.ties}\n`).join(''));
  assert.equal(out, '1 90 9\n90 1 9\n');
});
