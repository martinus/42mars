#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// PreToolUse hook: blocks tool calls that would show GPL Core War source
// code (pMARS, exMARS, exhaust, corewar.dev, the GPL-derived prototype
// branch). Running pMARS as a program stays allowed. A safety net for the
// clean-room rule in CLAUDE.md, not a complete filter.
//
// Test: echo '{"tool_name":"Read","tool_input":{"file_path":"/x/pmars-0.9.4/src/sim.c"}}' | node .claude/hooks/clean-room.mjs; echo $?

import { readFileSync } from 'node:fs';

const DIR = String.raw`(?:pmars|exmars|exhaust)[^\s/'"]*`; // a directory named after a GPL engine
const OURS = String.raw`(?<!\.(?:mjs|js|json|md|txt|log|red|html|css|png))`; // ends a name: not one of our own files like tools/pmars-diff.mjs
const rules = [
  [/prototype-before-squash/i, 'branch prototype-before-squash contains GPL-derived code'],
  [/reference-engine/i, 'reference-engine is a port of GPL code'],
  [/third-party\/corewar\.dev|corewar-theater\/third-party|\/cwdev\//i, 'third-party/ holds corewar.dev code: run it through cwbench/, never read it'],
  [new RegExp(String.raw`${DIR}/(?:[^\s'"]*/)?[^\s/'"]*\.(?:c|h|cc|cpp|js|mjs|zip|tar|tgz|gz|xz|bz2)\b`, 'i'), 'source or archive of a GPL engine'],
  [/(?:pmars|exmars|app|fighter)-source\.zip|fighter-src/i, 'corewar.dev source archive'],
  [/corewar\.co\.uk\/ankerl\/exmars|sourceforge\.net\/projects\/corewar|github\.com\/[^\s'"]*(?:pmars|exmars|exhaust)|corewar\.dev\/[^\s'"]*\.(?:m?js|wasm|zip|map)\b/i, 'web source of a GPL engine'],
  [/\bgit\b[^;|&\n]*\b(?:log|show|diff|grep|whatchanged)\b[^;|&\n]*--all\b[^;|&\n]*(?:\s-p\b|--patch|\s-S|\s-G|--stat)/i, 'patches of all branches include the GPL-derived prototype branch'],
];
// Commands that print file contents, when pointed at a GPL engine directory.
const readers = new RegExp(String.raw`(?:^|[\s;|&(])(?:cat|less|more|head|tail|sed|awk|grep|rg|ag|find|tar|unzip|zcat|xxd|strings|diff|wasm2wat|wasm-dis)\s[^;|&\n]*(?:[\s/'"=]${DIR}/|/${DIR}${OURS}(?:[\s'"]|$))`, 'i');

const input = JSON.parse(readFileSync(0, 'utf8'));
const tool = input.tool_name ?? '';
const fields = input.tool_input ?? {};
const texts = ['file_path', 'path', 'pattern', 'glob', 'command', 'url', 'notebook_path']
  .map((k) => fields[k]).filter((v) => typeof v === 'string');

const fileTool = /^(?:Read|Grep|Glob|NotebookRead)$/.test(tool);
for (const text of texts) {
  let reason = rules.find(([re]) => re.test(text))?.[1];
  if (!reason && tool === 'Bash' && readers.test(text)) reason = 'reading files in a GPL engine directory';
  if (!reason && fileTool && new RegExp(String.raw`(?:^|/)${DIR}(?:/|${OURS}$)`, 'i').test(text)) reason = 'reading files in a GPL engine directory';
  if (reason) {
    process.stderr.write(`clean-room: blocked (${reason}). Engine code here is MIT and must not derive from GPL code. Find pMARS behavior by running the binary (see CLAUDE.md, "Clean room").\n`);
    process.exit(2);
  }
}
process.exit(0);
