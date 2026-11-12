// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// .claude/skills/wrap-up/agent-files.mjs lists the agent files with their
// sizes and finds what they name that does not exist. The last test runs it
// on this repository: an agent file that names a removed file, function,
// option or npm script fails here.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../.claude/skills/wrap-up/agent-files.mjs', import.meta.url));
const repo = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'agent-files-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

function fixture(name, files) {
  const root = join(tmp, name);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

function run(root, ...args) {
  const r = spawnSync(process.execPath, [script, '--root', root, '--no-outside', ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json: args.includes('--json') && r.status !== 2 ? JSON.parse(r.stdout) : null };
}

const LONG = 'Never time by hand, the A/B scripts alternate both sides on an idle machine.';
const clean = {
  'package.json': JSON.stringify({ scripts: { serve: 'node tools/a.mjs' } }),
  'tools/a.mjs': "// usage: --yes\nif (process.argv.includes('--yes')) kept();\n",
  'lib/x.c': 'static void kept(void) {}\n',
  'docs/x.md': 'x\n',
  'CLAUDE.md': [
    '# Project', '',
    '- `tools/a.mjs` runs with `node tools/a.mjs --yes`, or `npm run serve`.',
    '- Everything under `lib/**` and `lib/src-<name>.c` is C; `kept()` and `x.c` exist, see [the doc](docs/x.md).',
    '- A copy for timing: `git show HEAD:tools/a.mjs > tools/zz-copy.mjs`, delete `tools/zz-copy.mjs` afterwards.',
    '',
  ].join('\n'),
  '.claude/rules/scoped.md': '---\npaths:\n  - "lib/**"\n---\n# Scoped\n\n- A rule for lib.\n',
  '.claude/rules/always.md': '# Always\n\n- A rule for every session.\n',
  '.claude/skills/auto/SKILL.md': '---\nname: auto\ndescription: Does a thing. Use when the thing is needed.\n---\n# Auto\n\nRun `tools/a.mjs`.\n',
  '.claude/skills/auto/more.md': 'More.\n',
  '.claude/skills/manual/SKILL.md': '---\nname: manual\ndescription: Only when asked.\ndisable-model-invocation: true\n---\n# Manual\n',
};

test('agent-files: when each file is loaded, and its size', () => {
  const { status, json } = run(fixture('sizes', clean), '--json');
  assert.equal(status, 0);
  const loaded = Object.fromEntries(json.files.map((f) => [f.file + (f.note ? ` (${f.note})` : ''), f.loaded]));
  assert.deepEqual(loaded, {
    'CLAUDE.md': 'every session',
    '.claude/rules/always.md': 'every session',
    '.claude/rules/scoped.md': 'on a matching file',
    '.claude/skills/auto/SKILL.md': 'when the skill runs',
    // The description of a skill the model may start is in every session;
    // the one of `manual` (disable-model-invocation) is not.
    '.claude/skills/auto/SKILL.md (description)': 'every session',
    '.claude/skills/auto/more.md': 'when the skill runs',
    '.claude/skills/manual/SKILL.md': 'when the skill runs',
  });
  const bytes = (file) => json.files.find((f) => f.file === file && !f.note).bytes;
  assert.equal(bytes('CLAUDE.md'), Buffer.byteLength(clean['CLAUDE.md']));
  const description = 'Does a thing. Use when the thing is needed.';
  assert.equal(json.totals['every session'].bytes,
    Buffer.byteLength(clean['CLAUDE.md']) + Buffer.byteLength(clean['.claude/rules/always.md']) + description.length);
  assert.equal(json.totals['on a matching file'].bytes, Buffer.byteLength(clean['.claude/rules/scoped.md']));
});

test('agent-files: what exists is not reported, also patterns and files a command writes', () => {
  const { status, json } = run(fixture('clean', clean), '--json', '--check');
  assert.deepEqual(json.stale, []);
  assert.equal(status, 0);
});

test('agent-files: stale paths, names, links, functions, options and npm scripts', () => {
  const root = fixture('stale', {
    ...clean,
    'CLAUDE.md': [
      '# Project', '',
      '- `tools/gone.mjs` and `ghost.c` were removed, `tools/a.mjs` stays.',
      '- See [the plan](docs/plan.md). Call `gone()`, not `kept()`.',
      '- `node tools/a.mjs --yes --no-such` and `npm run nope`.',
      '',
    ].join('\n'),
  });
  const { status, json } = run(root, '--json', '--check');
  assert.equal(status, 1, '--check fails on a stale reference');
  assert.deepEqual(json.stale.map((s) => `${s.file}:${s.line} ${s.what}`), [
    'CLAUDE.md:3 tools/gone.mjs: no such file or folder',
    'CLAUDE.md:4 link docs/plan.md: no such file',
    'CLAUDE.md:3 ghost.c: no file of that name',
    'CLAUDE.md:4 `gone()`: no source file has gone'.replaceAll('`', ''),
    'CLAUDE.md:5 tools/a.mjs has no option --no-such',
    'CLAUDE.md:5 npm run nope: no such script in package.json',
  ]);
  assert.equal(run(root, '--json').status, 0, 'without --check the exit code stays 0');
});

test('agent-files: a line that stands in two files is listed', () => {
  const root = fixture('duplicates', {
    ...clean,
    'CLAUDE.md': `${clean['CLAUDE.md']}- ${LONG}\n- Short line.\n`,
    '.claude/rules/always.md': `${clean['.claude/rules/always.md']}- Short line.\n* ${LONG}\n`,
  });
  const { json } = run(root, '--json');
  assert.deepEqual(json.duplicates, [{ line: LONG, at: ['CLAUDE.md:6', '.claude/rules/always.md:5'] }]);
});

test('agent-files: sizes against a base commit, with added and removed files', () => {
  const root = fixture('base', clean);
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { stdio: 'ignore' });
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  writeFileSync(join(root, 'CLAUDE.md'), `${clean['CLAUDE.md']}- Ten bytes\n`);
  writeFileSync(join(root, '.claude/rules/new.md'), '# New\n');
  rmSync(join(root, '.claude/rules/scoped.md'));
  const { json } = run(root, '--json', '--base', 'HEAD');
  assert.equal(json.base, 'HEAD');
  const change = Object.fromEntries(json.files.filter((f) => !f.note || f.note === 'removed').map((f) => [f.file, f.bytes - f.baseBytes]));
  assert.equal(change['CLAUDE.md'], '- Ten bytes\n'.length);
  assert.equal(change['.claude/rules/new.md'], '# New\n'.length);
  assert.equal(change['.claude/rules/scoped.md'], -Buffer.byteLength(clean['.claude/rules/scoped.md']));
  assert.equal(change['.claude/rules/always.md'], 0);
  assert.equal(json.totals['every session'].change, '- Ten bytes\n'.length + '# New\n'.length);
  assert.equal(json.totals['on a matching file'].change, -Buffer.byteLength(clean['.claude/rules/scoped.md']));
  // No such commit: no comparison, and no failure.
  const none = run(root, '--json', '--base', 'no-such-ref');
  assert.equal(none.status, 0);
  assert.equal(none.json.base, null);
  assert.equal(none.json.totals['every session'].change, null);
});

test('agent-files: an unknown option and a missing value are refused', () => {
  const root = fixture('options', clean);
  assert.equal(run(root, '--chek').status, 2);
  assert.match(run(root, '--chek').stderr, /unknown option --chek/);
  assert.equal(run(root, '--base').status, 2);
  assert.match(run(root, '--base', '--json').stderr, /--base needs a value/);
});

test('agent-files: the agent files of this repository name nothing that is gone', () => {
  const r = spawnSync(process.execPath, [script, '--root', repo, '--no-outside', '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout.slice(r.stdout.indexOf('stale references')));
});
