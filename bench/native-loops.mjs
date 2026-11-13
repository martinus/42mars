#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Whether a change left the native hot loops alone (.claude/rules/wasm.md,
// "Keep the hot loops byte-identical"): compiles lib/42mars.c of a git ref
// and of the working tree with clang and gcc at -O3 -march=native, each
// without and with -DM42_FIXED_CONTEXT, and compares the machine code of
// execute, execute2_8000 and execute2_any (with their .cold and other
// parts), addresses masked. bench/wasm-functions.mjs does the same for wasm.
//
//   node bench/native-loops.mjs [ref]             ref default origin/main
//   node bench/native-loops.mjs --files a.c b.c   two translation units
//   --cc clang,gcc                                the compilers (default both)
//
// Prints one line per compiler, define and function: "same (n lines)" or
// "DIFFERS". Exit code 1 when one differs, 2 for wrong arguments or a
// failed build.

import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const LOOPS = ['execute', 'execute2_8000', 'execute2_any'];
const run = promisify(execFile);

function fail(message) {
  process.stderr.write(`native-loops: ${message}\nusage: node bench/native-loops.mjs [ref] | --files a.c b.c [--cc clang,gcc]\n`);
  process.exit(2);
}

let ref = null, files = null, compilers = ['clang', 'gcc'];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--files') {
    if (i + 2 >= argv.length) fail('--files needs two files');
    files = [argv[++i], argv[++i]];
  } else if (argv[i] === '--cc') {
    if (i + 1 >= argv.length) fail('--cc needs a value');
    compilers = argv[++i].split(',').filter(Boolean);
    if (!compilers.length) fail('--cc needs a compiler');
  } else if (argv[i].startsWith('-') || ref !== null) {
    fail(`unknown argument ${argv[i]}`);
  } else {
    ref = argv[i];
  }
}
if (files && ref) fail('a ref or --files, not both');

// The machine code of function `name` in objdump's output: its symbol and
// symbols name.part (.cold, .constprop.0, ...), in the order of the file,
// without addresses: a branch target or a call shows as ADDR, a
// rip-relative operand as RIP.
export function loopCode(disassembly, name) {
  const out = [];
  let inside = false;
  for (const line of disassembly.split('\n')) {
    const symbol = /^[0-9a-f]+ <([^>]+)>:$/.exec(line);
    if (symbol) {
      inside = symbol[1] === name || symbol[1].startsWith(`${name}.`);
      if (inside) out.push(`<${symbol[1]}>:`);
      continue;
    }
    if (!inside || !line.trim()) continue;
    out.push(line.replace(/^\s*[0-9a-f]+:\s*/, '').replace(/\b[0-9a-f]+ <[^>]*>/g, 'ADDR')
      .replace(/-?0x[0-9a-f]+\(%rip\)/g, 'RIP').replace(/\s+/g, ' ').trim());
  }
  return out;
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const tmp = mkdtempSync(join(tmpdir(), 'native-loops-'));
  try {
    let sources = files;
    if (!sources) {
      const base = join(tmp, 'base');
      mkdirSync(base);
      execFileSync('bash', ['-c', 'git -C "$1" archive "$2" lib | tar -x -C "$3"', '_', root, ref ?? 'origin/main', base]);
      sources = [join(base, 'lib/42mars.c'), join(root, 'lib/42mars.c')];
    }
    const builds = [];
    for (const cc of compilers) {
      for (const define of ['', '-DM42_FIXED_CONTEXT']) {
        const objects = sources.map((src, k) => join(tmp, `${cc}${define}-${k}.o`));
        builds.push({ cc, define, objects });
      }
    }
    await Promise.all(builds.flatMap((b) => b.objects.map((o, k) =>
      run(b.cc, ['-O3', '-march=native', ...(b.define ? [b.define] : []), '-c', '-o', o, sources[k]]))))
      .catch((e) => { throw new Error(`build failed: ${e.message.split('\n')[0]}`); });
    let differs = 0;
    for (const b of builds) {
      const code = b.objects.map((o) => execFileSync('objdump', ['-d', '--no-show-raw-insn', o], { encoding: 'utf8', maxBuffer: 1 << 28 }));
      for (const name of LOOPS) {
        const [x, y] = code.map((d) => loopCode(d, name));
        if (!x.length) throw new Error(`${b.cc} ${b.define}: no function ${name}`);
        const same = x.length === y.length && x.every((l, k) => l === y[k]);
        if (!same) differs++;
        console.log(`${b.cc}${b.define ? ` ${b.define}` : ''} ${name}: ${same ? `same (${x.length} lines)` : 'DIFFERS'}`);
      }
    }
    process.exitCode = differs ? 1 : 0;
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    fail(e.message);
  }
  rmSync(tmp, { recursive: true, force: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
