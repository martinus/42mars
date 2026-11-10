#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Lists the function bodies of a wasm module, or compares those of two
// modules. For a change to mars.c that should leave the hot loops alone:
// V8's code for them moves by a percent or two when their bytes change,
// also when the new code never runs (docs/performance-log.md, fifth round).
//
//   node tools/wasm-functions.mjs <A.wasm>            index, size, hash per function
//   node tools/wasm-functions.mjs <A.wasm> <B.wasm>   per function index: same,
//        or the size of both and the number of differing bytes when the sizes
//        are equal (a few bytes: call indices or data addresses moved)
//
// The functions are in the order of mars.c; the three largest are
// execute2_8000, execute2_any and execute.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function bodies(file) {
  const b = readFileSync(file);
  let p = 8;
  const leb = () => { let r = 0, s = 0, x; do { x = b[p++]; r |= (x & 127) << s; s += 7; } while (x & 128); return r >>> 0; };
  while (p < b.length) {
    const id = b[p++];
    const end = leb() + p;
    if (id === 10) { // code section
      const out = [];
      for (let n = leb(); n > 0; n--) { const size = leb(); out.push(b.subarray(p, p + size)); p += size; }
      return out;
    }
    p = end;
  }
  throw new Error(`${file}: no code section`);
}

const [fileA, fileB] = process.argv.slice(2);
if (!fileA) {
  console.error('usage: node tools/wasm-functions.mjs <A.wasm> [B.wasm]');
  process.exit(2);
}
const a = bodies(fileA);
if (!fileB) {
  a.forEach((f, i) => console.log(`${String(i).padStart(3)} ${String(f.length).padStart(6)} ${createHash('md5').update(f).digest('hex').slice(0, 8)}`));
} else {
  const b = bodies(fileB);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    let what;
    if (!x || !y) what = `only in ${x ? 'A' : 'B'}, ${(x ?? y).length} bytes`;
    else if (x.equals(y)) what = `same, ${x.length} bytes`;
    else if (x.length !== y.length) what = `differs, ${x.length} and ${y.length} bytes`;
    else what = `differs in ${x.reduce((n, v, k) => n + (v !== y[k]), 0)} of ${x.length} bytes`;
    console.log(`${String(i).padStart(3)} ${what}`);
  }
}
