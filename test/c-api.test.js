// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The C library through its public header (lib/42mars.h), built natively
// (test/native.js): test/c/api-test.c drives the functions and prints JSON,
// which must agree with the wasm build of the library. Also runs
// examples/example.c.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWasmMarsSync, evaluateWasm, assembleWasm as assemble } from '../wasm/42mars.js';
import { hasCc, lines, prebuilt, program, skip } from './native.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const tmp = mkdtempSync(join(tmpdir(), 'c-api-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

// The builds take seconds each, so they run at the same time: the test
// program, the example with the plain command of 42mars.h, and a syntax
// check of the M42_FIXED_CONTEXT build with libc, which nothing else builds.
const run = promisify(execFile);
const apiTest = program(prebuilt ?? tmp, 'api-test');
const example = program(prebuilt ?? tmp, 'example');
before(() => {
  if (!hasCc) return undefined;
  return Promise.all([
    prebuilt ? null : run('cc', ['-std=c11', '-O2', '-Wall', '-Wextra', '-o', apiTest, join(root, 'test/c/api-test.c'), join(root, 'lib/42mars.c')]),
    prebuilt ? null : run('cc', ['-Ilib', '-o', example, 'examples/example.c', 'lib/42mars.c'], { cwd: root }),
    run('cc', ['-std=c11', '-fsyntax-only', '-Wall', '-Wextra', '-Werror=implicit-function-declaration', '-DM42_FIXED_CONTEXT', join(root, 'lib/42mars.c')]),
  ]);
});

const warriorDir = join(root, 'warriors');
const repo = readdirSync(warriorDir).filter((f) => f.endsWith('.red')).sort().map((f) => join(warriorDir, f));
// Last, a source with errors and warnings: it does not assemble.
const broken = join(tmp, 'broken.red');
writeFileSync(broken, ';name Broken\nloop mov 0\n jmp loop, x\nloop dat 1\n', 'latin1');
const files = [...repo, broken];
const codes = files.map((f) => assemble(readFileSync(f, 'latin1')));

// One FNV-1a step, as fnv() of test/c/api-test.c.
const fnv = (h, v) => Math.imul(h ^ v, 16777619) >>> 0;

test('the C library through 42mars.h agrees with the JS assembler and the wasm engine', { skip }, () => {
  const out = JSON.parse(execFileSync(apiTest, files, { encoding: 'latin1' }));
  assert.equal(out.version, version);

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
    // the hash of api-test.c over a, b, word, pad of every cell
    const c = m.core();
    let h = 2166136261;
    for (let i = 0; i < m.coreSize; i++) {
      for (const v of [c.av[i], c.bv[i], c.op[i] | (c.am[i] << 8) | (c.bm[i] << 11), 0]) h = fnv(h, v);
    }
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
  // the watch: too small, attached, a round up to time 3000 in steps of
  // 300, against the wasm build's watch; detached, it records nothing
  const wm = createWasmMarsSync({ watch: true });
  wm.load([codes[0], codes[1]], { seed: 1234 });
  wm.startRound();
  while (!wm.roundOver && wm.time < 3000) wm.run(300);
  const v = wm.watch();
  let h = 2166136261;
  for (let a = 0; a < wm.coreSize; a++) {
    for (const x of [v.owner[a], v.execBy[a], v.readBy[a], v.bump[a], v.origin[a], v.tWrite[a], v.tRead[a], v.tExec[a]]) h = fnv(h, x);
  }
  const trace = [];
  for (let t = wm.time - 7; t <= wm.time; t++) trace.push(Array.from(v.trace.subarray(4 * (t & 4095), 4 * (t & 4095) + 4)));
  assert.deepEqual(s.watch, {
    status: [-1, 0], time: wm.time, hash: h, territory: [v.territory[0], v.territory[1]],
    counts: v.execCount.reduce((a, b) => a + b, 0), trace, deaths: v.deaths, detached: [0, 0, 10],
  });
  // no warriors, a core of 70000, three warriors with rules for two, no
  // context, assembling with core size 0, the broken warrior in a match
  assert.deepEqual(out.errors, [-3, 1, -3, -3, -2, -4]);
  // permute: one warrior, two, two at fixed positions
  assert.deepEqual(out.permute, [-3, 0, -3]);
  // the same PIN shares p-space cell 3, not the last result; another PIN
  // does not share
  assert.deepEqual(out.pin, [99, 4294967295 & 7999, 0]);
  // two warriors of max_length fit into a context of m42_ctx_size()
  assert.deepEqual(out.full, [100, 0]);
  // the evaluator at the edges of 64 bits, against the wasm build
  const expressions = [
    '9223372036854775807+1', '9223372036854775806+1', '-9223372036854775807-1', '-9223372036854775807-2',
    '9223372036854775807-(-1)', '(0-9223372036854775807)-(1)', '1-9223372036854775807-3', '5-7',
    '4611686018427387904+4611686018427387904', '-4611686018427387904+-4611686018427387904', '3037000500*3037000500',
  ];
  assert.deepEqual(out.evaluate, expressions.map((e) => {
    const r = evaluateWasm(e);
    return [r.status, String(r.value)];
  }));
  assert.deepEqual(out.evaluate.map((e) => e[0]), [1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1]);
});

test('examples/example.c builds with cc -Ilib examples/example.c lib/42mars.c and plays a match', { skip }, () => {
  const lantern = join(warriorDir, 'lantern.red'), origami = join(warriorDir, 'origami.red');
  const out = lines(execFileSync(example, ['-r', '100', '-F', '4000', lantern, origami], { encoding: 'utf8' }));
  // pmars -b -k -r 100 -F 4000 lantern.red origami.red prints "1 9" and "90 9"
  // (wins ties); the same match on the wasm engine:
  const r = createWasmMarsSync().runMatch([codes[files.indexOf(lantern)], codes[files.indexOf(origami)]], { rounds: 100, seed: 3900 });
  assert.equal(out, r.warriors.map((w) => `${w.wins} ${w.losses} ${w.ties}\n`).join(''));
  assert.equal(out, '1 90 9\n90 1 9\n');
});

// build-msvc.bat links 42mars.dll with the exports listed in lib/42mars.def:
// a function of the header that is missing there is missing from the DLL.
test('lib/42mars.def exports exactly the M42_API functions of lib/42mars.h', () => {
  const header = readFileSync(join(root, 'lib/42mars.h'), 'latin1');
  const api = [...header.matchAll(/^M42_API\b[^(]*?\b(m42_\w+)\s*\(/gm)].map((m) => m[1]);
  const def = readFileSync(join(root, 'lib/42mars.def'), 'latin1');
  const exports = def.slice(def.indexOf('\nEXPORTS') + 1).split('\n').slice(1).map((l) => l.trim()).filter((l) => l && !l.startsWith(';'));
  assert.ok(api.length >= 45, `only ${api.length} M42_API functions found in the header`);
  assert.deepEqual([...exports].sort(), [...api].sort());
});
