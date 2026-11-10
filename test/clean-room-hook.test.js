// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// .claude/hooks/clean-room.mjs blocks tool calls that would show GPL engine
// source, and must let normal work through (running pMARS, our own tools).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('../.claude/hooks/clean-room.mjs', import.meta.url));
const O = '/home/u/.local/share/corewar-theater';
const T = '/tmp/session/scratchpad';

function verdict(tool_name, tool_input) {
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_name, tool_input }), encoding: 'utf8' });
  return r.status;
}

const blocked = [
  ['Read', { file_path: '/x/pmars-0.9.4/src/sim.c' }],
  ['Read', { file_path: `${T}/exmars/src/exhaust.c` }],
  ['Read', { file_path: `${T}/reference-engine/mars.js` }],
  ['Read', { file_path: `${O}/third-party/corewar.dev/exmars.mjs` }],
  ['Read', { file_path: `${T}/cwdev/dist/pmars.mjs` }],
  ['Grep', { pattern: 'cycles', path: `${T}/pmars-trace` }],
  ['Bash', { command: `grep -rn cycles ${T}/dl/pmars/src` }],
  ['Bash', { command: `grep -rn x ${T}/pmars-trace` }],
  ['Bash', { command: `cat ${T}/pmars-trace/sim.c | head` }],
  ['Bash', { command: `unzip -l ${T}/cwdev/pmars-source.zip` }],
  ['Bash', { command: 'git show prototype-before-squash:src/engine/mars.js' }],
  ['Bash', { command: 'git log --all -p | grep queue' }],
  ['WebFetch', { url: 'https://corewar.co.uk/ankerl/exmars.htm', prompt: 'x' }],
  ['WebFetch', { url: 'https://corewar.dev/dist/exmars/fighter.mjs', prompt: 'x' }],
  // Transcripts of earlier sessions quote GPL source that was read there.
  ['Read', { file_path: '/home/u/.claude/projects/-home-u-repo/3dc4449d.jsonl' }],
  ['Read', { file_path: '/home/u/.claude/projects/-home-u-repo/3dc4449d/tool-results/toolu_01.txt' }],
  ['Grep', { pattern: 'queue', path: '/home/u/.claude/projects' }],
  ['Bash', { command: 'grep -rl queue ~/.claude/projects/-home-u-repo' }],
  ['Read', { file_path: '/tmp/claude-1000/-home-u-repo/3dc4449d/tasks/a5d8eed9.output' }],
];

const allowed = [
  ['Bash', { command: `${O}/bin/pmars -b -r 10 warriors/dwarf.red warriors/imp.red | tail -1` }],
  ['Bash', { command: `node tools/pmars-diff.mjs --pmars ${T}/dl/pmars/src/pmars --pmars-trace ${T}/pmars-trace/pmars --corpus ${O}/corpus --wasm` }],
  ['Bash', { command: `node tools/tournament.mjs ${O}/sets/t20 --engine wasm --pmars ${O}/bin/pmars --compare 2>&1 | tail -3` }],
  ['Bash', { command: `node ${O}/cwbench/single.mjs exmars` }],
  ['Bash', { command: `ls ${O}/bin | grep pmars` }],
  ['Bash', { command: 'grep -n SCALE tools/pmars-diff.mjs' }],
  ['Bash', { command: 'grep -n exMARS docs/performance-log.md' }],
  ['Bash', { command: 'git log --oneline --all' }],
  ['Read', { file_path: '/repo/tools/pmars-diff.mjs' }],
  ['Read', { file_path: '/repo/docs/performance-log.md' }],
  ['Edit', { file_path: 'js/mars.js', old_string: 'a', new_string: 'b' }],
  ['WebFetch', { url: 'https://corewar.co.uk/standards/icws94.htm', prompt: 'x' }],
  ['Read', { file_path: '/home/u/.claude/projects/-home-u-repo/memory/MEMORY.md' }],
];

test('clean-room hook blocks reads of GPL engine source', () => {
  for (const [tool, input] of blocked) assert.equal(verdict(tool, input), 2, `${tool} ${JSON.stringify(input)}`);
});

test('clean-room hook lets running pMARS and reading our own files through', () => {
  for (const [tool, input] of allowed) assert.equal(verdict(tool, input), 0, `${tool} ${JSON.stringify(input)}`);
});
