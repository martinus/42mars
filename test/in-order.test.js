// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// .claude/skills/engine-check/in-order.mjs runs the long checks in the
// background: each command with the end of its output and its exit code,
// then the sentinel line that the waiting side greps for.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../.claude/skills/engine-check/in-order.mjs', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'in-order-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const commands = join(tmp, 'commands.txt');
writeFileSync(commands, [
  'echo one; echo two',
  '',
  '# a comment',
  "  printf 'a\\nb\\nc\\n'; exit 3",
  'echo to-stderr >&2',
  'true',
  '',
].join('\n'));
// Each call gets its own TMPDIR, returned as `own`.
const run = (...args) => {
  const own = mkdtempSync(join(tmp, 'tmpdir-'));
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, TMPDIR: own } });
  return { own, status: r.status, stderr: r.stderr, out: r.stdout.replace(/, \d+ s$/gm, ', N s') };
};

test('in-order: each command with the end of its output and its exit code, then the sentinel', () => {
  const r = run(commands, '--tail', '2');
  assert.equal(r.out, [
    '$ echo one; echo two', 'one', 'two', 'exit 0, N s', '',
    "$ printf 'a\\nb\\nc\\n'; exit 3", 'b', 'c', 'exit 3, N s', '',
    '$ echo to-stderr >&2', 'to-stderr', 'exit 0, N s', '',
    '$ true', 'exit 0, N s', '',
    'ALL DONE: 4 commands, 1 failed', '',
  ].join('\n'));
  assert.equal(r.status, 1, 'a failed command is the exit code');
  assert.deepEqual(readdirSync(r.own), [], 'its own temporary folder is gone');
});

test('in-order: --logs keeps the whole output, and all commands passing is exit 0', () => {
  const passing = join(tmp, 'passing.txt');
  writeFileSync(passing, "printf 'a\\nb\\nc\\n'\n");
  const logs = join(tmp, 'logs');
  const r = run(passing, '--tail', '1', '--logs', logs);
  assert.equal(r.out, "$ printf 'a\\nb\\nc\\n'\nc\nexit 0, N s\n\nALL DONE: 1 commands, 0 failed\n");
  assert.equal(r.status, 0);
  assert.equal(readFileSync(join(logs, '1.txt'), 'utf8'), 'a\nb\nc\n');
});

test('in-order: wrong arguments are refused', () => {
  assert.match(run().stderr, /no file with commands/);
  assert.equal(run().status, 2);
  assert.match(run(commands, '--tial', '3').stderr, /unknown argument --tial/);
  assert.match(run(commands, '--tail').stderr, /--tail needs a value/);
  assert.match(run(commands, '--tail', 'x').stderr, /--tail takes a whole number/);
  assert.match(run(join(tmp, 'none.txt')).stderr, /cannot read .*none\.txt: ENOENT/);
  assert.equal(run(join(tmp, 'none.txt')).status, 2);
});
