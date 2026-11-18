// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The native programs of the C tests (test/c-api.test.js, test/cli.test.js,
// test/evolver*.test.js): built by the tests with `cc`, or prebuilt in the
// folder that M42_BIN names (`make test`, and CI on Windows, which builds them
// with MSVC through build-msvc.bat). Without either, those tests are skipped.
//
// built() compiles once and shares: test files run in parallel processes, and
// each used to compile lib/42mars.c itself (14 s with -O2, five times in one
// `npm test`). A result is kept in build/test/<hash>/ (`make clean` removes
// it), the hash of the compiler's arguments and every file the build reads, so
// that unchanged sources are not compiled again; a lock folder makes the files
// that need the same result at the same time wait for one compile.

import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const prebuilt = process.env.M42_BIN ? resolve(process.env.M42_BIN) : null;
export const hasCc = spawnSync('cc', ['--version']).status === 0;
export const skip = !prebuilt && !hasCc && 'no cc and no M42_BIN';

// The path of program `name` in folder dir.
export const program = (dir, name) => join(dir, process.platform === 'win32' ? `${name}.exe` : name);

// The text a program printed, with Windows line ends as \n (stdout is a text
// stream: the C library writes \r\n there).
export const lines = (text) => text.replace(/\r\n/g, '\n');

const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(root, 'build', 'test');
const files = (dir) => readdirSync(join(root, dir), { recursive: true }).map((f) => join(dir, String(f))).filter((f) => statSync(join(root, f)).isFile()).sort();
// what every build reads: the library (lib/42mars.c includes lib/src/*), and the headers of the evolver
const shared = () => [...files('lib'), ...files('evolver').filter((f) => f.endsWith('.h'))];

// The file `out` (a name in the cache folder of this build) made by `cc args`,
// run in the repository root; `sources` are the files it reads besides those
// of shared(). `$OUT` in args is the output path, `$<name>` the path of an
// earlier built() result of that name and the same `deps`. Returns the path.
export async function built(out, args, sources = [], deps = {}) {
  const h = createHash('sha256');
  h.update(JSON.stringify([out, args, deps]));
  for (const f of [...shared(), ...sources]) h.update(`\0${relative(root, join(root, f))}\0`).update(readFileSync(join(root, f)));
  const dir = join(cache, h.digest('hex').slice(0, 16));
  const path = join(dir, out);
  if (existsSync(path)) return path;
  if (!existsSync(dir)) pruneCache();
  mkdirSync(dir, { recursive: true });
  const lock = `${path}.lock`;
  for (let waited = 0; ; waited += 100) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (existsSync(path)) return path; // another test file built it meanwhile
      // a lock older than 10 minutes is one whose process died
      if (waited > 600000 || Date.now() - statSync(lock, { throwIfNoEntry: false })?.mtimeMs > 600000) rmSync(lock, { recursive: true, force: true });
      await sleep(100);
    }
  }
  try {
    if (existsSync(path)) return path;
    const tmp = `${path}.${process.pid}.tmp`;
    const argv = args.map((a) => (a === '$OUT' ? tmp : a.startsWith('$') ? deps[a.slice(1)] ?? a : a));
    await promisify(execFile)('cc', argv, { cwd: root });
    renameSync(tmp, path); // others see the result whole or not at all
    return path;
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

// lib/42mars.c compiled once with -O2 for every program of the tests.
export const libObject = () => built('42mars.o', ['-O2', '-c', '-o', '$OUT', 'lib/42mars.c']);

// Program `name` linked from `sources` (repository paths) and the library
// object, with the extra compiler arguments `flags`.
export async function builtProgram(name, sources, flags = []) {
  const lib = await libObject();
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  return built(exe, ['-O2', ...flags, '-o', '$OUT', ...sources, '$lib', '-lm'], sources, { lib });
}

// build/test/ keeps only the results of the sources as they are: the folders
// of other hashes go once they are a day old.
export function pruneCache() {
  if (!existsSync(cache)) return;
  for (const d of readdirSync(cache)) {
    const p = join(cache, d);
    if (Date.now() - statSync(p).mtimeMs > 86400000) rmSync(p, { recursive: true, force: true });
  }
}
