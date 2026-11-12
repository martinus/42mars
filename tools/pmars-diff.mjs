#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Differential test against a pMARS binary (used as an external program only).
//
//   node tools/pmars-diff.mjs --pmars path/to/pmars [--corpus dir] [--tmp dir]
//        [--jobs 16] [--seed 1] [--scale 1] [--only listings,exprs,...]
//        [--pmars-trace path/to/pmars-trace] [--cli path/to/42mars]
//        [--timeout 120] [--watch | --wasm-match] [--permute] [--icws88]
// An unknown option and an option without its value are refused.
//
// Sections:
//   listings   every .red file in --corpus: pMARS listing (pmars -r 0) vs
//              tools/asm.mjs format, or both reject it
//   exprs      random expressions in `dat #expr, #expr`
//   sources    random sources with EQU, FOR/ROF, labels, CURLINE, ORG/END,
//              opcodes glued to operands, CR, CRLF and continuation lines
//   battles    corpus pairs at fixed positions: wins/ties per warrior
//   fuzz       random warriors on core sizes 80, 800 and 8000
//   multi      3 and 4 warrior battles (random warriors)
// The battles, fuzz and multi sections run on the wasm engine
// (wasm/42mars.js), round by round. --wasm says the same; it is accepted
// because logged commands carry it from the time of the JavaScript
// simulator (removed in #76, and --headless with it).
// --watch: with a watch attached (createWasmMars({ watch: true })), so that
// the rounds run in the loop that records the visualizer bookkeeping.
// --wasm-match plays each battle with one runMatch() call with early tie
// detection, which leaves the final core of some rounds different, so it
// compares the scores only and does not go with --pmars-trace.
// --permute runs the battles and fuzz sections with pMARS's -P and our
// engines with `permute` (seed 2 * (-F position - distance)); multi is
// skipped, -P takes two warriors only.
// --icws88 passes pMARS's -8 everywhere and assembles our side with
// `icws88`; the generated sources and warriors are then mostly ICWS'88 code.
// --cli path/to/42mars adds the section `cli`: the command line program
// (make) and pMARS with the same arguments on corpus warriors,
// stdout and exit code compared.
// Exit code 1 when anything differs.
//
// Generated warriors and pMARS output go into a new folder pmars-diff-*
// under the system's temporary directory. It is deleted when nothing
// differed, also after Ctrl-C, and kept (its path printed) when something
// did, to reproduce the difference. A folder given with --tmp is never
// deleted.
//
// With --pmars-trace, battles run on a pMARS build that additionally prints
// one line per round to stderr: "ROUND <round> <instructions executed>
// <hash>", where <hash> is FNV-1a (32 bit, offset 2166136261, prime
// 16777619) over the low 16 bits of, in this order, every cell's opcode byte,
// every A mode, every B mode (modes numbered #$@<>*{} = 0..7), every A value
// and every B value, taken when the round ends. Then the instruction count
// and the final core of every round are compared too, not only the scores.
//
// pMARS does not terminate on some inputs and gives undefined results on
// others (see "Deviations from pMARS" in docs/redcode-semantics.md); the
// generators leave them out. A pMARS call that times out (--timeout seconds,
// default 120) counts as a difference.

import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';
import { assembleWasm, compileWasmMars, createWasmMarsSync } from '../wasm/42mars.js';
import { formatListing } from './opcodes.js';

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
function usage(message) {
  if (message) console.error(`pmars-diff: ${message}`);
  console.error('usage: node tools/pmars-diff.mjs --pmars path/to/pmars [--corpus dir] [--tmp dir] [--jobs n] [--seed n] [--scale n] [--only a,b]\n'
    + '       [--pmars-trace path/to/pmars-trace] [--cli path/to/42mars] [--timeout s] [--watch | --wasm-match] [--permute] [--icws88]');
  process.exit(2);
}
// Before anything runs: `--pmars-trace` without its binary took the next
// option as the binary and every battle counted as a difference, and a
// mistyped option ran as a test of something else.
const VALUE_OPTIONS = ['pmars', 'pmars-trace', 'corpus', 'tmp', 'jobs', 'seed', 'scale', 'only', 'timeout', 'cli'];
const FLAG_OPTIONS = ['wasm-match', 'permute', 'watch', 'icws88', 'wasm', 'headless'];
for (let i = 0; i < args.length; i++) {
  const name = args[i].startsWith('--') ? args[i].slice(2) : null;
  if (name !== null && VALUE_OPTIONS.includes(name)) {
    if (i + 1 >= args.length || args[i + 1].startsWith('--')) usage(`--${name} needs a value`);
    i++;
  } else if (name === null || !FLAG_OPTIONS.includes(name)) {
    usage(`unknown option ${args[i]}`);
  }
}
const PMARS = arg('pmars');
const TRACE = arg('pmars-trace');
if (!PMARS) usage();
const CORPUS = arg('corpus');
const OWN_TMP = !arg('tmp');
const TMP = arg('tmp') || mkdtempSync(join(tmpdir(), 'pmars-diff-'));
const JOBS = Number(arg('jobs', Math.max(1, cpus().length - 2)));
const SCALE = Number(arg('scale', 1));
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null;
if (args.includes('--headless')) {
  console.error('--headless: the JavaScript simulator is gone (#76); the wasm engine is the default');
  process.exit(2);
}
const WASM_MATCH = args.includes('--wasm-match');
const PERMUTE = args.includes('--permute');
const WATCH = args.includes('--watch');
const WASM = await compileWasmMars();
// --icws88: every pMARS call gets -8 (rules()), every assembly icws88.
const ICWS88 = args.includes('--icws88');
const ourAssemble = ICWS88 ? (source, o = {}) => assembleWasm(source, { ...o, icws88: true }) : assembleWasm;
if (WASM_MATCH && TRACE) {
  console.error('--wasm-match compares scores only; leave out --pmars-trace');
  process.exit(2);
}
const TIMEOUT = Number(arg('timeout', 120)) * 1000;
mkdirSync(TMP, { recursive: true });

let seed = Number(arg('seed', 1)) >>> 0 || 1;
const rand = (k) => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed % k;
};
const pick = (a) => a[rand(a.length)];

function pmars(argv, bin = PMARS) {
  return new Promise((resolve) => {
    execFile(bin, argv, { encoding: 'latin1', maxBuffer: 1 << 24, timeout: TIMEOUT }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? -1) : 0, out: stdout, err: stderr, timedOut: Boolean(err?.killed) });
    });
  });
}

async function pool(items, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(JOBS, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

function fnv(h, arr) {
  for (let i = 0; i < arr.length; i++) {
    h ^= arr[i] & 0xffff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
const coreHash = (m) => [m.op, m.am, m.bm, m.av, m.bv].reduce(fnv, 2166136261);

// Every section's list of differences, so that an aborted run knows whether
// it found any.
const diffLists = [];
function diffList() {
  const d = [];
  diffLists.push(d);
  return d;
}
const differences = () => diffLists.reduce((a, d) => a + d.length, 0);

// Deletes our own temporary folder when nothing differed; returns the end of
// the last output line.
function finishTmp(bad) {
  if (OWN_TMP && !bad) {
    rmSync(TMP, { recursive: true, force: true });
    return '';
  }
  return `, tmp files in ${TMP}`;
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    const bad = differences();
    console.log(`aborted: ${bad} differences so far${finishTmp(bad)}`);
    process.exit(130);
  });
}

const results = {};
function report(section, total, diffs) {
  results[section] = { total, diffs: diffs.length };
  console.log(`${section}: ${diffs.length} differences in ${total} cases`);
  for (const d of diffs.slice(0, Number(arg("show", 6)))) console.log(`   ${d.split('\n').join('\n   ')}`);
}

let fileCounter = 0;
function tmpFile(source) {
  const p = join(TMP, `w${fileCounter++}.red`);
  writeFileSync(p, source);
  return p;
}

// ---------------------------------------------------------------- listings

function rules(o) {
  return [...(ICWS88 ? ['-8'] : []), ...(o.readLimit ? ['-R', o.readLimit] : []), ...(o.writeLimit ? ['-W', o.writeLimit] : []), '-s', o.coreSize, '-c', o.maxCycles, '-p', o.maxProcesses, '-l', o.maxLength, '-d', o.minDistance].map(String);
}
const STANDARD = { coreSize: 8000, maxCycles: 80000, maxProcesses: 8000, maxLength: 100, minDistance: 100 };

// The registers pMARS assembles its first warrior with when it runs n
// warriors with the default score formula (semantics doc, section 5).
const firstRegisters = (n) => ({ w: n, s: n });

// Compares one source file: listing or rejection.
async function compareListing(file, source, o = STANDARD) {
  const r = await pmars([...rules(o), '-r', '0', file]);
  if (r.timedOut) return `${file}: pMARS did not finish`;
  const ok = r.out.includes('Program "');
  // pmars -r 0: ROUNDS is 0; its formula check leaves w = s = 1 (one warrior)
  const ours = ourAssemble(source, { ...o, warriors: 1, rounds: 0, registers: firstRegisters(1) });
  if (ok !== ours.ok) {
    const why = ours.ok ? `pMARS rejects:\n${(r.out + r.err).trim().split('\n').slice(0, 4).join('\n')}` : `we reject: ${ours.errors.map((e) => `line ${e.line}: ${e.text}`).join('; ')}`;
    return `${file}: ${why}`;
  }
  if (!ok) return null;
  const want = r.out.slice(r.out.indexOf('Program "')).trimEnd();
  const got = formatListing(ours, o.coreSize).trimEnd();
  if (want === got) return null;
  const wl = want.split('\n');
  const gl = got.split('\n');
  const k = wl.findIndex((l, i) => l !== gl[i]);
  return `${file}: listing differs at line ${k + 1}\n  pMARS: ${JSON.stringify(wl[k])}\n  ours:  ${JSON.stringify(gl[k])}`;
}

async function listings() {
  if (!CORPUS) return console.log('listings: skipped (no --corpus)');
  const files = readdirSync(CORPUS).filter((f) => /\.red$/i.test(f)).sort();
  const diffs = diffList();
  await pool(files, async (f) => {
    const p = join(CORPUS, f);
    const d = await compareListing(p, readFileSync(p, 'latin1'));
    if (d) diffs.push(d);
  });
  report('listings', files.length, diffs);
}

// ---------------------------------------------------------------- usable cases

// False for a source on which pMARS would not terminate (or take very long)
// or has an undefined result: a line longer than 255 characters, a `\` at
// the end of the last line, and the expressions our assembler warns about
// with a text that starts with "pMARS": a value of 2^40 or more (pMARS takes
// about |value| / coreSize steps to reduce it), a lone `!`, `=`, `&` or `|`
// where an operator is expected (pMARS reads an uninitialized variable then)
// and -2^63 divided by -1 (pMARS crashes).
function usable(src) {
  const lines = src.split('\n');
  if (lines.some((l) => l.length > 240)) return false;
  if (/\\\r?$/.test(lines[lines.length - 1] || lines[lines.length - 2] || '')) return false;
  return !assembleWasm(src, { ...STANDARD, warriors: 1, rounds: 0 }).warnings.some((w) => w.text.startsWith('pMARS '));
}

// Calls `make` until it returns a usable source.
function generate(make) {
  for (;;) {
    const src = make();
    if (usable(src)) return src;
  }
}

// ---------------------------------------------------------------- expressions

function randomExpr(depth = 0) {
  const ops = ['+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', '&&', '||'];
  const term = () => {
    const r = rand(12);
    if (depth < 3 && r === 0) return `(${randomExpr(depth + 1)})`;
    if (r === 1) return `-${term()}`;
    if (r === 2) return `!${term()}`;
    // s and w: pMARS's score formula check leaves them at the number of warriors
    if (r === 3) return pick(['CORESIZE', 'MAXLENGTH', 'a', 'b', 's', 'W']);
    if (r === 4 && depth < 2) return `(${pick(['a', 'b'])}=${randomExpr(depth + 1)})`;
    return String(rand(r === 5 ? 100000 : 13));
  };
  let e = term();
  for (let i = rand(5); i > 0; i--) e += pick(['', ' ']) + pick(ops) + pick(['', ' ']) + term();
  return e;
}

async function exprs() {
  const n = 1500 * SCALE;
  const cases = Array.from({ length: n }, () => generate(() => `;assert 1\n dat #${randomExpr()}, #${randomExpr()}\n`));
  const diffs = diffList();
  await pool(cases, async (src) => {
    const d = await compareListing(tmpFile(src), src);
    if (d) diffs.push(`${d}\n  source: ${JSON.stringify(src)}`);
  });
  report('exprs', n, diffs);
}

// ---------------------------------------------------------------- sources

// With --icws88 mostly ICWS'88 code, with a few '94 tokens that it rejects.
const OPS = ICWS88
  ? ['mov', 'add', 'sub', 'jmz', 'jmn', 'djn', 'cmp', 'slt', 'spl', 'dat', 'jmp', 'mov', 'dat', 'jmp', 'spl', 'djn', 'mul', 'seq', 'nop']
  : ['mov', 'add', 'sub', 'mul', 'div', 'mod', 'jmz', 'jmn', 'djn', 'cmp', 'slt', 'spl', 'dat', 'jmp', 'seq', 'sne', 'nop', 'ldp', 'stp'];
const MODS = ICWS88 ? ['', '', '', '', '', '', '', '', '', '', '', '.i'] : ['', '', '', '.a', '.b', '.ab', '.ba', '.f', '.x', '.i'];
const MODES = ICWS88 ? ['', '', '#', '$', '@', '<', '', '#', '<', '@', '>', '*'] : ['', '', '#', '$', '@', '<', '>', '*', '{', '}'];

// Random source text: labels of different lengths, EQU, FOR/ROF (also
// skipped blocks), CURLINE, ORG/END, metadata with trailing whitespace,
// comments, opcodes glued to their operands (also at the end of a line, where
// pMARS reads old scratch buffer content), continuation lines, CRLF line ends
// and a lone CR with text after it.
function randomSource() {
  // Names ending in digits leave digits in the scratch buffer, so that glued
  // text at the end of a line often picks up a number instead of letters.
  const labels = ['x', 'yy', 'lab', 'top', 'p1', 'q_2', 'longer_name', 'abcdefghijk', 'a1234567', 'b98765432', 'c00000000001'];
  const lines = [';redcode-94', `;name fuzz${pick(['', ' ', '  ', '\t', ' x '])}`, ';assert 1'];
  if (rand(4) === 0) lines.push(`;author ${pick(['a', 'Some One', 'b c'])}${pick(['', ' ', '\t '])}`);
  const used = new Set();
  const val = () => pick([String(rand(20) - 10), pick(labels), `${pick(labels)}+${rand(5)}`, 'CURLINE', `${pick(labels)}-${pick(labels)}`, 'k', `(${randomExpr(2)})`]);
  const operand = () => `${pick(MODES)}${val()}`;
  // An operand that can be glued to an opcode: it must not start an identifier.
  const gluedOperand = () => `${pick(['#', '$', '@', '<', '>', '*', '{', '}'])}${val()}`;
  const ins = () => {
    const op = pick(OPS);
    const one = rand(5) === 0 && (op === 'dat' || op === 'jmp' || op === 'spl' || op === 'nop');
    if (rand(5) === 0) {
      // Glued: `dat#9`, `mov.ab#1,2`, `jmp@x` ...
      const first = `${op}${pick(MODS)}${gluedOperand()}`;
      if (one) return first;
      return `${first}${pick([',', ', '])}${operand()}`;
    }
    return one ? `${op}${pick(MODS)} ${operand()}` : `${op}${pick(MODS)} ${operand()}, ${operand()}`;
  };
  const label = () => {
    const l = pick(labels);
    if (used.has(l) || rand(3)) return '';
    used.add(l);
    return l + pick(['', ':']);
  };
  if (rand(2)) lines.push(`k equ ${rand(7)}+${rand(3)}`);
  else lines.push('k equ 3');
  for (let i = rand(8) + 1; i > 0; i--) {
    const r = rand(13);
    if (r === 0) lines.push(`n${i} for ${rand(4)}`, `  ${ins()}`, `${label()} ${ins()}`, 'rof');
    else if (r === 1) lines.push(`m${i} equ ${ins()}`, `${label()} m${i}`);
    else if (r === 2) lines.push(`${label()}`);
    else if (r === 3) lines.push(pick(['', '; a comment', ';strategy some words ', `;${pick(labels)}`]));
    else if (r === 4) lines.push('for 0', `${pick(labels)} ${pick(['', pick(labels), 'equ 1', 'dat 1', ';x'])}`, 'rof');
    else lines.push(`${label()} ${ins()}`);
  }
  // Mostly define the labels not defined yet, so that more sources assemble.
  if (rand(4)) {
    for (const l of labels) if (!used.has(l)) lines.push(`${l} ${pick(['dat 0', 'nop 1', 'dat#1', 'jmp}2', ins()])}`);
  }
  if (rand(3) === 0) lines.push(`org ${pick(labels)}`);
  if (rand(3) === 0) lines.push(`end ${pick([...labels, '0', '1'])}`);

  // Line ends: LF or CRLF, sometimes a lone CR with ignored text after it, a
  // continuation (not on the last line), and a last line without line end.
  const eol = rand(4) === 0 ? '\r\n' : '\n';
  let out = '';
  lines.forEach((line, i) => {
    let text = line;
    if (rand(30) === 0) text += `\r${pick(['dat 7', 'junk', ''])}`;
    const space = text.indexOf(' ', 1);
    if (i < lines.length - 1 && space > 0 && rand(25) === 0) text = `${text.slice(0, space)}\\${eol}${text.slice(space)}`;
    out += text + (i < lines.length - 1 || rand(6) ? eol : '');
  });
  return out;
}

// Sources aimed at pMARS's scratch buffer: opcodes glued to their operands at
// the end of a line pick up what earlier lines and identifiers left in the
// buffer. Mostly valid code, identifiers of different lengths ending in
// digits, FOR blocks (also skipped ones) with `&` concatenation, EQU bodies,
// asserts, comments, continuation lines and different line ends.
function scratchSource() {
  const names = ['d1', 'k7', 'ab3', 'zz98', 'p12345', 'a1234567', 'q0000000009', 'start', 'longer_name7'];
  const defined = [];
  const lines = [];
  const name = () => pick(names);
  const ref = () => (defined.length && rand(3) ? pick(defined) : name());
  const small = () => String(rand(10));
  const value = () => pick([small(), small(), ref(), `${ref()}+${small()}`, 'CURLINE', `-${small()}`]);
  const glued = () => {
    const op = rand(3) ? pick(OPS) : pick(['dat', 'jmp', 'spl', 'nop']);
    const mod = pick(['', '', '', '.f', '.ab', '.i', '.b']);
    const mode = pick(['#', '$', '@', '<', '>', '*', '{', '}']);
    if (rand(2) && (op === 'dat' || op === 'jmp' || op === 'spl' || op === 'nop')) {
      // A mode alone: the value comes from the scratch buffer, if anything.
      return `${op}${mod}${mode}${rand(2) ? small() : ''}`;
    }
    // Glued text is not looked at in pass 1, so CURLINE there is undefined.
    const v = pick([small(), small(), ref(), `${ref()}-${small()}`]);
    return `${op}${mod}${mode}${v},${pick(['', ' '])}${pick(MODES)}${small()}`;
  };
  const plain = () => `${pick(OPS)}${pick(['', '.f', '.ab'])} ${pick(MODES)}${value()}, ${pick(MODES)}${value()}`;
  const label = () => {
    const l = name();
    if (defined.includes(l) || rand(2)) return '';
    defined.push(l);
    return l + pick(['', ':']);
  };
  if (rand(3) === 0) lines.push(`;redcode${pick(['', '-94'])}`);
  lines.push(`;name ${pick(['s', 'scratch test', 'p12345678'])}${pick(['', ' ', '\t'])}`);
  if (rand(2)) lines.push(pick([';assert 1', ';assert CORESIZE == 8000', `;assert ${name()} == ${name()}`, ';assert MAXLENGTH>=10']));
  for (let i = rand(10) + 2; i > 0; i--) {
    const r = rand(14);
    if (r < 4) lines.push(`${label()} ${glued()}`);
    else if (r < 6) lines.push(`${label()} ${plain()}`);
    else if (r === 6) {
      const c = pick(['i', 'cnt']);
      lines.push(`${c} for ${rand(3)}`, `${pick([`v&${c}`, `w${i}&${c}`, name(), ''])} ${glued()}`, `${pick(['', `x&${c}`])} dat ${c}`, 'rof');
    }
    else if (r === 7) lines.push('for 0', `${name()} ${pick([name(), 'equ 1', 'dat 1', ';x', ''])}`, 'rof');
    else if (r === 8) {
      const e = `e${i}`;
      lines.push(`${e} equ ${glued()}`);
      if (rand(2)) lines.push(`    equ ${glued()}`);
      lines.push(`${label()} ${e}`);
    } else if (r === 9) lines.push(pick(['', '; comment', `;${name()} words`, `;strategy ${name()}`, ';author someone ']));
    else if (r === 10) lines.push(`${label()}`);
    else if (r === 11) lines.push(`${label()} ${pick(OPS)} ${small()}, ${name()}`);
    else lines.push(`${label()} dat ${pick(['#', ''])}${value()}`);
  }
  for (const l of names) if (!defined.includes(l) && rand(4)) lines.push(`${l} ${pick(['dat 0', glued(), plain()])}`);
  if (rand(4) === 0) lines.push(`${pick(['end', 'org'])} ${pick(defined.length ? defined : ['0'])}`);
  if (rand(5) === 0) lines.push(';redcode', `${glued()}`);
  if (rand(3) === 0) lines.push(glued());

  const eol = rand(3) === 0 ? '\r\n' : '\n';
  let out = '';
  lines.forEach((line, i) => {
    let text = line;
    if (rand(25) === 0) text += `\r${pick(['dat 7', 'q0000000009', ''])}`;
    const space = text.indexOf(' ', 1);
    if (i < lines.length - 1 && space > 0 && rand(20) === 0) text = `${text.slice(0, space)}\\${eol}${text.slice(space)}`;
    out += text + (i < lines.length - 1 || rand(4) ? eol : '');
  });
  return out;
}

async function sources() {
  const n = 1500 * SCALE;
  const cases = Array.from({ length: n }, (_, i) => generate(i % 2 ? scratchSource : randomSource));
  const diffs = diffList();
  await pool(cases, async (src) => {
    const d = await compareListing(tmpFile(src), src);
    if (d) diffs.push(`${d}\n  source: ${JSON.stringify(src)}`);
  });
  report('sources', n, diffs);
}

// ---------------------------------------------------------------- battles

// Runs one battle in pMARS and in our engine; returns a difference or null.
async function compareBattle(files, sources, o, pos, rounds) {
  const permute = PERMUTE && files.length === 2;
  const r = await pmars(['-b', '-k', ...rules(o), '-r', String(rounds), '-F', String(pos), ...(permute ? ['-P'] : []), ...files], TRACE || PMARS);
  const lines = r.out.trim().split('\n').filter(Boolean);
  if (lines.length !== files.length) return `${files.join(' ')}: unexpected pMARS output ${JSON.stringify(r.out + r.err).slice(0, 200)}`;
  const want = lines.map((l) => l.trim().split(/\s+/).map(Number));
  const ws = sources.map((s, i) => ourAssemble(s, { ...o, warriors: files.length, rounds, registers: i === 0 ? firstRegisters(files.length) : undefined }));
  if (ws.some((w) => !w.ok)) return `${files.join(' ')}: pMARS ran it, we do not assemble it`;
  const m = createWasmMarsSync({ ...o, rounds, watch: WATCH }, WASM);
  const seed = (permute ? 2 : 1) * (pos - o.minDistance);
  if (WASM_MATCH) m.runMatch(ws, { rounds, seed, permute, earlyTie: true });
  else m.load(ws, { seed, permute });
  const roundLines = [];
  for (let i = 0; i < (WASM_MATCH ? 0 : rounds); i++) {
    m.startRound();
    while (!m.roundOver) m.run(1 << 20);
    roundLines.push(`ROUND ${i + 1} ${m.time} ${coreHash(m)}`);
  }
  if (TRACE) {
    const want = r.err.split('\n').filter((l) => l.startsWith('ROUND '));
    for (let i = 0; i < rounds; i++) {
      if (want[i] !== roundLines[i]) {
        return `${files.join(' ')} -F ${pos} -r ${rounds} ${JSON.stringify(o)}\n  pMARS: ${want[i]}\n  ours:  ${roundLines[i]} (round, instructions, core hash)`;
      }
    }
  }
  const n = files.length;
  const got = m.warriors.map((w) => (n === 2 ? [w.score[0], w.score[1]] : w.score.slice(0, n)));
  const wantCmp = want.map((row) => (n === 2 ? row : row.slice(1, 1 + n)));
  if (JSON.stringify(got) === JSON.stringify(wantCmp)) return null;
  return `${files.join(' ')} -F ${pos} -r ${rounds} ${JSON.stringify(o)}\n  pMARS: ${JSON.stringify(wantCmp)}\n  ours:  ${JSON.stringify(got)}`;
}

async function battles() {
  if (!CORPUS) return console.log('battles: skipped (no --corpus)');
  const files = readdirSync(CORPUS).filter((f) => /\.red$/i.test(f)).sort()
    .filter((f) => ourAssemble(readFileSync(join(CORPUS, f), 'latin1')).ok);
  const n = 1200 * SCALE;
  const cases = Array.from({ length: n }, (_, i) => {
    const a = pick(files);
    let b = pick(files);
    while (b === a) b = pick(files);
    return { pair: [a, b], pos: 100 + rand(7801), rounds: i % 4 === 0 ? 8 : 1 };
  });
  const diffs = diffList();
  await pool(cases, async ({ pair, pos, rounds }) => {
    const paths = pair.map((f) => join(CORPUS, f));
    const d = await compareBattle(paths, paths.map((p) => readFileSync(p, 'latin1')), STANDARD, pos, rounds);
    if (d) diffs.push(d);
  });
  report('battles', n, diffs);
}

// ---------------------------------------------------------------- fuzz

// The opcodes of ICWS'88 and the modes of their A and B operands (pmars -8).
const LEGAL88 = {
  dat: ['#<', '#<'], mov: ['#$@<', '$@<'], add: ['#$@<', '$@<'], sub: ['#$@<', '$@<'], cmp: ['#$@<', '$@<'],
  jmp: ['$@<', '#$@<'], jmz: ['$@<', '#$@<'], jmn: ['$@<', '#$@<'], djn: ['$@<', '#$@<'], spl: ['$@<', '#$@<'], slt: ['#$@<', '#$@<'],
};

function randomWarrior(len, coreSize) {
  const small = () => String(rand(9) - 4);
  const wide = () => String(rand(coreSize) - (coreSize >> 1));
  const operand = () => `${pick(['#', '$', '@', '<', '>', '*', '{', '}'])}${rand(3) ? small() : wide()}`;
  if (ICWS88) {
    const lines = [`;name r${rand(1e6)}`, ';assert 1'];
    for (let i = 0; i < len; i++) {
      const op = rand(4) === 0 ? pick(['spl', 'mov', 'djn', 'jmp']) : pick(Object.keys(LEGAL88));
      const [a, b] = LEGAL88[op];
      lines.push(`${op} ${pick([...a])}${rand(3) ? small() : wide()}, ${pick([...b])}${rand(3) ? small() : wide()}`);
    }
    lines.push(`end ${rand(len)}`);
    return lines.join('\n') + '\n';
  }
  const lines = [';redcode-94', `;name r${rand(1e6)}`, ';assert 1'];
  for (let i = 0; i < len; i++) {
    const op = rand(4) === 0 ? pick(['spl', 'mov', 'djn', 'jmp']) : pick(OPS);
    lines.push(`${op}${pick(MODS)} ${operand()}, ${operand()}`);
  }
  lines.push(`org ${rand(len)}`);
  return lines.join('\n') + '\n';
}

const FUZZ_RULES = [
  { coreSize: 80, maxCycles: 800, maxProcesses: 80, maxLength: 5, minDistance: 5 },
  { coreSize: 800, maxCycles: 8000, maxProcesses: 800, maxLength: 20, minDistance: 20 },
  { coreSize: 800, maxCycles: 4000, maxProcesses: 8, maxLength: 20, minDistance: 20 },
  { coreSize: 8000, maxCycles: 80000, maxProcesses: 8000, maxLength: 100, minDistance: 100 },
  // read and write limits (pmars -R -W): each a divisor of the core size
  { coreSize: 8000, maxCycles: 80000, maxProcesses: 8000, maxLength: 100, minDistance: 100, readLimit: 500, writeLimit: 500 },
  { coreSize: 800, maxCycles: 8000, maxProcesses: 800, maxLength: 20, minDistance: 20, readLimit: 25, writeLimit: 160 },
  { coreSize: 80, maxCycles: 800, maxProcesses: 80, maxLength: 5, minDistance: 5, readLimit: 16, writeLimit: 5 },
];

async function fuzz() {
  const n = 3000 * SCALE;
  const cases = Array.from({ length: n }, (_, i) => {
    const o = FUZZ_RULES[i % FUZZ_RULES.length];
    const srcs = [0, 1].map(() => randomWarrior(1 + rand(o.maxLength), o.coreSize));
    return { o, srcs, pos: o.minDistance + rand(o.coreSize + 1 - 2 * o.minDistance), rounds: i % 3 === 0 ? 4 : 1 };
  });
  const diffs = diffList();
  await pool(cases, async ({ o, srcs, pos, rounds }) => {
    const d = await compareBattle(srcs.map(tmpFile), srcs, o, pos, rounds);
    if (d) diffs.push(d);
  });
  report('fuzz', n, diffs);
}

async function multi() {
  if (PERMUTE) return console.log('multi: skipped (-P takes two warriors)');
  const n = 600 * SCALE;
  const cases = Array.from({ length: n }, (_, i) => {
    const o = FUZZ_RULES[[1, 2, 3, 4, 5][i % 5]]; // core 800 and 8000, two with limits
    const k = 3 + (i % 2);
    const srcs = Array.from({ length: k }, () => randomWarrior(1 + rand(Math.min(10, o.maxLength)), o.coreSize));
    return { o, srcs, pos: o.minDistance + rand(o.coreSize + 1 - 2 * o.minDistance), rounds: 1 + (i % 3) };
  });
  const diffs = diffList();
  await pool(cases, async ({ o, srcs, pos, rounds }) => {
    const d = await compareBattle(srcs.map(tmpFile), srcs, o, pos, rounds);
    if (d) diffs.push(d);
  });
  report('multi', n, diffs);
}

// ---------------------------------------------------------------- cli

// --cli path/to/42mars: both programs with the same arguments on corpus
// warriors, stdout and exit code compared. Arguments mix warrior counts,
// listings, -b, -k, -o, -A, -=, -F or -f (never random positions), -P, -8,
// rule changes, -@ files and some invalid options.
const CLI = arg('cli');
const FORMULAS = ['(W*W-1)/S', '1', 'S', 'W*10+S', 'x=x+S', '10/S', '1/0', 'W-S'];

async function cli() {
  if (!CLI || !CORPUS) return console.log('cli: skipped (needs --cli and --corpus)');
  const files = readdirSync(CORPUS).filter((f) => /\.red$/i.test(f)).sort().map((f) => join(CORPUS, f));
  const n = 1500 * SCALE;
  const cases = Array.from({ length: n }, (_, i) => {
    const k = [1, 2, 2, 2, 2, 2, 3, 4][rand(8)];
    const args = [];
    if (rand(10) < 6) args.push('-b');
    if (rand(10) < 4) args.push('-k');
    if (rand(10) < 3) args.push('-o');
    if (rand(12) === 0) args.push('-A');
    if (rand(7) === 0) args.push('-=', pick(FORMULAS));
    const r = pick([0, 1, 1, 3, 5, 10]);
    args.push('-r', String(r));
    const ruleSet = rand(10);
    let d = 100;
    if (ruleSet === 1) { args.push('-l', '50'); d = 50; }
    else if (ruleSet === 2) args.push('-c', '1000', '-p', '64');
    else if (ruleSet === 3) args.push('-S', String(1 + rand(20)));
    else if (ruleSet === 4) { args.push('-d', '200'); d = 200; }
    else if (ruleSet === 5 && rand(3) === 0) args.push(pick(['-d', '-F']), '50'); // both too small: exit 2
    else if (ruleSet === 6 && rand(3) === 0) args.push(pick(['-s', '-p']), '0');
    if (rand(10) < 3) args.push('-f');
    else args.push('-F', String(d + rand(8000 + 1 - 2 * d)));
    if (rand(5) === 0) args.push('-P'); // with other than two warriors: exit 2
    if (rand(6) === 0) args.push('-8');
    const ws = Array.from({ length: k }, () => pick(files));
    if (rand(20) === 0) {
      const at = join(TMP, `options${i}.txt`);
      writeFileSync(at, args.join('\n') + '\n');
      return ['-@', at, ...ws];
    }
    return i % 2 ? [...args, ...ws] : [...ws, ...args];
  });
  const diffs = diffList();
  await pool(cases, async (argv) => {
    const [theirs, ours] = await Promise.all([pmars(argv), pmars(argv, CLI)]);
    if (theirs.timedOut) return diffs.push(`${argv.join(' ')}: pMARS did not finish`);
    if (theirs.code === ours.code && theirs.out === ours.out) return;
    const wl = theirs.out.split('\n');
    const gl = ours.out.split('\n');
    const at = wl.findIndex((l, i) => l !== gl[i]);
    diffs.push(`${argv.join(' ')}\n  exit pMARS ${theirs.code}, ours ${ours.code}` +
      (at >= 0 ? `; stdout line ${at + 1}\n  pMARS: ${JSON.stringify(wl[at])}\n  ours:  ${JSON.stringify(gl[at])}` : '') +
      (ours.err ? `\n  our stderr: ${JSON.stringify(ours.err.slice(0, 200))}` : ''));
  });
  report('cli', n, diffs);
}

const sections = { listings, exprs, sources, battles, fuzz, multi, cli };
const t0 = Date.now();
for (const [name, fn] of Object.entries(sections)) {
  if (!ONLY || ONLY.has(name)) await fn();
}
const bad = Object.values(results).reduce((a, r) => a + r.diffs, 0);
console.log(`${bad ? 'DIFFERENT' : 'SAME'}: ${bad} differences, ${((Date.now() - t0) / 1000).toFixed(0)} s${finishTmp(bad)}`);
process.exit(bad ? 1 : 0);
