// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The npm package and the version: package.json, lib/42mars.h and the
// wasm build agree on the version; wasm/42mars.d.ts declares what
// wasm/42mars.js exports; the packed package holds only the wasm interface
// and works by its name, without the rest of the repository.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as glue from '../wasm/42mars.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'package-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

// npm is npm.cmd on Windows, which only a shell runs.
const npm = (args, cwd) => execFileSync('npm', args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
const hasNpm = spawnSync('npm', ['--version'], { shell: process.platform === 'win32' }).status === 0;

test('package.json, 42mars.h and the wasm module have the same version', async () => {
  const header = readFileSync(join(root, 'lib/42mars.h'), 'latin1');
  const part = (name) => header.match(new RegExp(`#define M42_VERSION_${name} (\\d+)`))[1];
  assert.equal(pkg.version, `${part('MAJOR')}.${part('MINOR')}.${part('PATCH')}`);
  const x = new WebAssembly.Instance(await glue.compileMars()).exports;
  const at = x.m42_version();
  const bytes = new Uint8Array(x.memory.buffer, at, 32);
  assert.equal(new TextDecoder().decode(bytes.subarray(0, bytes.indexOf(0))), pkg.version);
});

test('42mars.d.ts declares exactly the exports of 42mars.js', () => {
  const dts = readFileSync(join(root, 'wasm/42mars.d.ts'), 'utf8');
  const declared = [...dts.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
  assert.deepEqual([...new Set(declared)].sort(), Object.keys(glue).sort());
});

test('the npm package works by its name, without the rest of the repository', { skip: !hasNpm && 'no npm' }, () => {
  const out = JSON.parse(npm(['pack', '--json', '--pack-destination', tmp], root));
  assert.deepEqual(out[0].files.map((f) => f.path).sort(), ['LICENSE', 'README.md', 'package.json', 'wasm/42mars.d.ts', 'wasm/42mars.js', 'wasm/42mars.wasm']);
  execFileSync('tar', ['-xzf', out[0].filename], { cwd: tmp });
  mkdirSync(join(tmp, 'app/node_modules'), { recursive: true });
  renameSync(join(tmp, 'package'), join(tmp, 'app/node_modules/42mars'));
  writeFileSync(join(tmp, 'app/use.mjs'), `
import { assemble, createMars } from '42mars';
const imp = assemble(' mov 0, 1\\n');
const dwarf = assemble(' add #4, 3\\n mov 2, @2\\n jmp -2\\n dat #0, #0\\n');
const m = await createMars();
const r = m.runMatch([imp, dwarf], { rounds: 10, seed: 1 });
console.log(JSON.stringify(r.warriors.map((w) => [w.wins, w.losses, w.ties])));
`);
  assert.deepEqual(readdirSync(join(tmp, 'app/node_modules/42mars/wasm')).sort(), ['42mars.d.ts', '42mars.js', '42mars.wasm']);
  const scores = JSON.parse(execFileSync(process.execPath, ['use.mjs'], { cwd: join(tmp, 'app'), encoding: 'utf8' }));
  // the same match on the repository's engine
  const r = glue.createMarsSync().runMatch([glue.assemble(' mov 0, 1\n'), glue.assemble(' add #4, 3\n mov 2, @2\n jmp -2\n dat #0, #0\n')], { rounds: 10, seed: 1 });
  assert.deepEqual(scores, r.warriors.map((w) => [w.wins, w.losses, w.ties]));
});
