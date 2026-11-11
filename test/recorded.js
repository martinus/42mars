// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Results recorded in test/fixtures/*.json: a test compares digests of what
// the code gives now with what it gave when the fixture was recorded. The
// assembler's fixture (asm-c.json) was recorded where the C code gave the
// results of the JavaScript assembler it was ported from, the simulator's
// (wasm.json, watch.json) where the library gave those of js/mars.js; both
// JavaScript engines were removed in November 2026 (#76). For an intended
// change of the results, record them again with
//   RECORD_FIXTURES=1 node --test test/<file>.test.js
// and say why in the commit.

import { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const RECORD = Boolean(process.env.RECORD_FIXTURES);

// A SHA-256 over a sequence of values: typed arrays as their bytes, other
// values as JSON (bigints as text). digest() gives 16 hex digits.
export class Digest {
  constructor() {
    this.hash = createHash('sha256');
  }

  add(...values) {
    for (const v of values) {
      if (ArrayBuffer.isView(v)) this.hash.update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      else this.hash.update(JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? `${x}n` : x)) ?? 'undefined');
      this.hash.update('|');
    }
    return this;
  }

  // Text as it is, e.g. JSON made already.
  addText(text) {
    this.hash.update(text);
    this.hash.update('|');
    return this;
  }

  digest() {
    return this.hash.digest('hex').slice(0, 16);
  }
}

export const digest = (value) => new Digest().add(value).digest();

// The recorded digests of fixture `file`. check(name, results, per) compares
// a list of [what, digest or value] pairs with the recording, one digest per
// group of `per`; a difference names the first `what` of its group.
export function recorded(file) {
  const url = new URL(`./fixtures/${file}`, import.meta.url);
  const want = RECORD ? {} : JSON.parse(readFileSync(url, 'utf8'));
  const got = {};
  if (RECORD) after(() => writeFileSync(url, `${JSON.stringify(got, null, '\t')}\n`));
  return function check(name, results, per = 1) {
    const groups = [];
    for (let i = 0; i < results.length; i += per) groups.push(digest(results.slice(i, i + per).map(([, r]) => r)));
    if (RECORD) {
      got[name] = groups;
      return;
    }
    assert.ok(want[name], `${file} has no recording of ${JSON.stringify(name)}: RECORD_FIXTURES=1`);
    assert.equal(groups.length, want[name].length, `${name}: number of groups`);
    const k = groups.findIndex((d, i) => d !== want[name][i]);
    if (k >= 0) assert.fail(`${name}: results ${k * per} to ${k * per + per - 1} changed, the first of them: ${results[k * per][0]}`);
  };
}
