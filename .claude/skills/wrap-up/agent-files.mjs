#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The agent files of a repository (CLAUDE.md, .claude/rules/, .claude/skills/):
// when each one is loaded, how big it is, how that changed against a base
// commit, and what they name that does not exist anymore.
//
//   node .claude/skills/wrap-up/agent-files.mjs [--root dir] [--base ref]
//        [--no-outside] [--check] [--json]
//
// --root        the repository (default: the current directory)
// --base        the commit to compare sizes with (default origin/main);
//               without git or without that commit the column stays empty
// --no-outside  only files inside --root: not the CLAUDE.md files of the
//               folders above it and of ~/.claude
// --check       exit code 1 when a reference is stale
// --json        the result as JSON
//
// Stale references, in files inside --root only:
//   - a path that starts with a top-level folder of the repository
//   - a file name alone in backticks (`mars.c`) that no file has
//   - a relative Markdown link
//   - `name()` in backticks that no source file has as a word
//   - `--option` after a tool's path that the tool's text does not have
//   - `npm run name` without that script in package.json
// A line of 50 characters or more that stands in two places is listed too
// (one fact in one place); that never fails --check.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
function value(name, fallback) {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) fail(`${name} needs a value`);
  return argv[i + 1];
}
function fail(message) {
  process.stderr.write(`agent-files: ${message}\n`);
  process.exit(2);
}
const KNOWN = new Set(['--root', '--base', '--no-outside', '--check', '--json']);
for (const a of argv) if (a.startsWith('--') && !KNOWN.has(a)) fail(`unknown option ${a}`);

const root = resolve(value('--root', '.'));
const base = value('--base', 'origin/main');
if (!existsSync(root)) fail(`no such folder: ${root}`);

// Names that agent files may hold although the repository has no such
// file, with the reason.
const ABSENT_OK = new Map([
  ['validate.red', 'in the oracle folder $O, GPL'],
  ['settings.json', '~/.claude/settings.json'],
  ['MEMORY.md', 'the index of the machine-local memory folder'],
  ['CLAUDE.local.md', 'git-ignored personal notes'],
]);

// Folders that hold nothing an agent file should point into.
const SKIP_DIRS = new Set(['.git', 'node_modules', 'build']);
// Larger files are data, not source to search for symbols.
const MAX_SOURCE_BYTES = 2 << 20;
const SOURCE = /\.(?:c|h|js|mjs|ts|sh|bat|html|css|def|yml|json)$/;
const MIN_DUPLICATE = 50;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const files = walk(root);
const basenames = new Set(files.map((f) => basename(f)));
const topDirs = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name)).map((e) => e.name);
let sourceText = null;
function sources() {
  if (sourceText === null) {
    sourceText = files.filter((f) => SOURCE.test(f) && statSync(f).size <= MAX_SOURCE_BYTES)
      .map((f) => readFileSync(f, 'latin1')).join('\n');
  }
  return sourceText;
}

// ---------------------------------------------------------------- the files

function frontmatter(text) {
  if (!text.startsWith('---\n')) return { fields: {}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end < 0) return { fields: {}, body: text };
  const fields = {};
  for (const line of text.slice(4, end).split('\n')) {
    const m = /^([\w-]+):\s*(.*)$/.exec(line);
    if (m) fields[m[1]] = m[2];
  }
  return { fields, body: text.slice(end + 4) };
}

const ALWAYS = 'every session', PATHS = 'on a matching file', SKILL = 'when the skill runs';
const rows = [];
function add(path, loaded, inside, text, note = '') {
  rows.push({
    file: inside ? relative(root, path) : path.replace(homedir(), '~'),
    path, loaded, inside, note, text,
    bytes: Buffer.byteLength(text), lines: text.split('\n').length - (text.endsWith('\n') ? 1 : 0),
  });
}
const read = (p) => readFileSync(p, 'utf8');

for (const name of ['CLAUDE.md', 'CLAUDE.local.md']) {
  if (existsSync(join(root, name))) add(join(root, name), ALWAYS, true, read(join(root, name)));
}
if (!flag('--no-outside')) {
  for (let dir = dirname(root); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'CLAUDE.md'))) add(join(dir, 'CLAUDE.md'), ALWAYS, false, read(join(dir, 'CLAUDE.md')));
    if (dirname(dir) === dir) break;
  }
  const user = join(homedir(), '.claude', 'CLAUDE.md');
  if (existsSync(user)) add(user, ALWAYS, false, read(user));
}
const rulesDir = join(root, '.claude', 'rules');
if (existsSync(rulesDir)) {
  for (const f of walk(rulesDir).filter((f) => f.endsWith('.md')).sort()) {
    const text = read(f);
    add(f, 'paths' in frontmatter(text).fields ? PATHS : ALWAYS, true, text);
  }
}
const skillsDir = join(root, '.claude', 'skills');
if (existsSync(skillsDir)) {
  for (const f of walk(skillsDir).filter((f) => f.endsWith('.md')).sort()) {
    const text = read(f);
    add(f, SKILL, true, text);
    if (basename(f) !== 'SKILL.md') continue;
    // A skill the model may start has its description in every session.
    const { fields } = frontmatter(text);
    if (fields.description && fields['disable-model-invocation'] !== 'true') {
      rows.push({ file: relative(root, f), path: f, loaded: ALWAYS, inside: true, note: 'description', text: '',
                  bytes: Buffer.byteLength(fields.description), lines: 1, part: true });
    }
  }
}

// ---------------------------------------------------------------- sizes at the base

function git(...args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}
const haveBase = git('rev-parse', '--verify', '--quiet', `${base}^{commit}`) !== null;
const removed = [];
if (haveBase) {
  for (const r of rows) {
    if (!r.inside) continue;
    const old = git('show', `${base}:${r.file}`);
    if (r.part) {
      const d = old === null ? null : frontmatter(old).fields;
      r.baseBytes = d && d.description && d['disable-model-invocation'] !== 'true' ? Buffer.byteLength(d.description) : 0;
    } else {
      r.baseBytes = old === null ? 0 : Buffer.byteLength(old);
    }
  }
  const now = new Set(rows.filter((r) => r.inside && !r.part).map((r) => r.file));
  const before = (git('ls-tree', '-r', '--name-only', base, '--', 'CLAUDE.md', '.claude/rules', '.claude/skills') ?? '')
    .split('\n').filter((f) => f.endsWith('.md') && !now.has(f));
  for (const f of before) {
    const old = git('show', `${base}:${f}`) ?? '';
    const loaded = f === 'CLAUDE.md' ? ALWAYS
      : f.startsWith('.claude/skills/') ? SKILL : 'paths' in frontmatter(old).fields ? PATHS : ALWAYS;
    removed.push({ file: f, loaded, bytes: 0, lines: 0, baseBytes: Buffer.byteLength(old), note: 'removed' });
  }
}

// ---------------------------------------------------------------- stale references

const stale = [];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pathRe = topDirs.length
  ? new RegExp(String.raw`(?<![\w./$~-])(?<!\]\()(?:${topDirs.map(escape).join('|')})/[\w./-]*`, 'g') : null;
const toolRe = /((?:[\w.-]+\/)+[\w.-]+\.(?:mjs|js|sh))((?:[ \t]+[^\s|;&`]+)*)/g;

function lineOf(text, index) {
  let n = 1;
  for (let i = text.indexOf('\n'); i >= 0 && i < index; i = text.indexOf('\n', i + 1)) n++;
  return n;
}

for (const r of rows) {
  if (!r.inside || r.part) continue;
  const { text } = r;
  const report = (index, what) => stale.push({ file: r.file, line: lineOf(text, index), what });

  if (pathRe) {
    // A file that a command of the text writes (`... > tools/copy.mjs`) is not expected to exist.
    const written = new Set([...text.matchAll(/>\s*([\w./-]+)/g)].map((m) => m[1]));
    for (const m of text.matchAll(pathRe)) {
      let token = m[0];
      if (written.has(token)) continue;
      const next = text[m.index + token.length] ?? '';
      // A pattern or a placeholder follows: only the folder in front of it must exist.
      if ('*<{[$'.includes(next) && next !== '') token = token.endsWith('/') ? token : dirname(token);
      token = token.replace(/[.-]+$/, '');
      if (!existsSync(join(root, token))) report(m.index, `${m[0]}: no such file or folder`);
    }
  }
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (!existsSync(resolve(dirname(r.path), target))) report(m.index, `link ${m[1]}: no such file`);
  }
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const span = m[1];
    if (/^[\w.-]+\.(?:c|h|js|mjs|ts|md|json|sh|bat|def|svg|yml|red|wasm|html|css)$/.test(span)) {
      if (!basenames.has(span) && !ABSENT_OK.has(span)) report(m.index, `${span}: no file of that name`);
    }
    const call = /^(?:[A-Za-z_]\w*\.)*([A-Za-z_]\w*)\(.*\)$/.exec(span);
    const name = call ? call[1] : /^[mM]42_\w+$/.test(span) ? span : null;
    if (name && !new RegExp(String.raw`\b${escape(name)}\b`).test(sources())) report(m.index, `${span}: no source file has ${name}`);
  }
  for (const m of text.matchAll(toolRe)) {
    const tool = join(root, m[1]);
    if (!existsSync(tool) || !m[2]) continue;
    const toolText = readFileSync(tool, 'latin1');
    for (const o of m[2].matchAll(/(?<=[ \t])--[a-z][\w-]*/g)) {
      if (!new RegExp(String.raw`${escape(o[0])}(?![\w-])`).test(toolText)) report(m.index, `${m[1]} has no option ${o[0]}`);
    }
  }
  const pkg = existsSync(join(root, 'package.json')) ? JSON.parse(read(join(root, 'package.json'))) : {};
  for (const m of text.matchAll(/\bnpm run ([\w:-]+)/g)) {
    if (!pkg.scripts || !(m[1] in pkg.scripts)) report(m.index, `npm run ${m[1]}: no such script in package.json`);
  }
}

// ---------------------------------------------------------------- duplicate lines

const seen = new Map();
for (const r of rows) {
  if (r.part) continue;
  const { body } = frontmatter(r.text);
  const offset = r.text.split('\n').length - body.split('\n').length;
  body.split('\n').forEach((raw, i) => {
    const line = raw.trim().replace(/^(?:[-*>|]|\d+\.|#+)\s+/, '').replace(/\s+/g, ' ');
    if (line.length < MIN_DUPLICATE) return;
    if (!seen.has(line)) seen.set(line, []);
    seen.get(line).push(`${r.file}:${i + 1 + offset}`);
  });
}
const duplicates = [...seen].filter(([, at]) => at.length > 1).map(([line, at]) => ({ line, at }));

// ---------------------------------------------------------------- output

const all = [...rows, ...removed];
const totals = {};
for (const loaded of [ALWAYS, PATHS, SKILL]) {
  const of = all.filter((r) => r.loaded === loaded);
  totals[loaded] = {
    bytes: of.reduce((s, r) => s + r.bytes, 0),
    change: haveBase ? of.reduce((s, r) => s + (r.baseBytes === undefined ? 0 : r.bytes - r.baseBytes), 0) : null,
  };
}

if (flag('--json')) {
  const strip = ({ text, path, part, ...r }) => r;
  process.stdout.write(JSON.stringify({ base: haveBase ? base : null, files: all.map(strip), totals, stale, duplicates }, null, 1) + '\n');
} else {
  const signed = (n) => (n > 0 ? `+${n}` : String(n));
  const change = (r) => (!haveBase || r.baseBytes === undefined ? '' : signed(r.bytes - r.baseBytes));
  const out = [`${'loaded'.padEnd(20)}${'bytes'.padStart(7)}${'lines'.padStart(7)}${(haveBase ? `vs ${base}` : '').padStart(16)}  file`];
  for (const loaded of [ALWAYS, PATHS, SKILL]) {
    for (const r of all.filter((r) => r.loaded === loaded)) {
      out.push(`${loaded.padEnd(20)}${String(r.bytes).padStart(7)}${String(r.lines).padStart(7)}${change(r).padStart(16)}  ${r.file}${r.note ? ` (${r.note})` : ''}`);
    }
    const t = totals[loaded];
    out.push(`${`  total`.padEnd(20)}${String(t.bytes).padStart(7)}${''.padStart(7)}${(t.change === null ? '' : signed(t.change)).padStart(16)}`);
  }
  out.push('', `stale references: ${stale.length}`);
  for (const s of stale) out.push(`  ${s.file}:${s.line}  ${s.what}`);
  out.push(`duplicate lines: ${duplicates.length}`);
  for (const d of duplicates) out.push(`  ${d.at.join(', ')}  ${d.line.length > 90 ? `${d.line.slice(0, 90)}...` : d.line}`);
  process.stdout.write(out.join('\n') + '\n');
}
process.exit(flag('--check') && stale.length ? 1 : 0);
