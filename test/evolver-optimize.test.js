// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --optimize-moves (#249), the moves of --optimize beyond one constant at a
// time: every single change of a field (opcode, modifier, modes, start), two
// far constants moved together, and two fields at once. The search over one
// constant is in test/evolver-tune.test.js.
// What the evolver's test files share is in test/evolver-common.js; built
// with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { setup, cleanup, root, tmp, evolve, skip, RULES, TINY, run, events } from './evolver-common.js';

before(() => setup({ base: false }));
after(cleanup);

const CORE = RULES.coreSize;
const signed = (v) => { v = ((v % CORE) + CORE) % CORE; return v > CORE / 2 ? v - CORE : v; };
const wrap = (v) => ((v % CORE) + CORE) % CORE;
const MODES = '#$@<>*{}';
const OPTS = (file, rest = []) => ['--optimize', file, ...TINY.slice(0, TINY.indexOf('--panel')), '--panel', '6', '--holdout', '4', '--rounds', '40', '--seed', '3',
  '--positions', 'pmars', ...rest];
// a stone whose step of 100 bombs 8 cells of a core of 800: its two far constants are the step (#100 of add) and the
// bomb's first target (#100 of dat); moving both by the same amount gives every coprime step
const BADSTEP = ';redcode\n;name bad step\nstep equ 100\nloop add.ab #step, bomb\nmov.i bomb, @bomb\njmp loop\nbomb dat #0, #step\n';

// The warrior as --optimize sees it (genome_from_code()): per instruction its fields, its operand values, and which
// operands are references into it (not immediate, pointing at an instruction of the warrior: they stay references)
function genomeOf(text) {
  const w = assemble(text, RULES);
  assert.ok(w.ok, w.errors?.[0]?.text);
  const len = w.instructions.length;
  const g = w.instructions.map((x, i) => {
    const ref = (mode, v) => mode !== 0 && wrap(i + v) < len;
    return { op: x.op, mod: x.mod, am: x.aMode, bm: x.bMode, a: wrap(x.aVal), b: wrap(x.bVal), aref: ref(x.aMode, x.aVal), bref: ref(x.bMode, x.bVal) };
  });
  return { len, start: w.start, g };
}
const constantsOf = (G) => {
  const c = [];
  G.g.forEach((x, i) => {
    if (!x.aref && Math.abs(signed(x.a)) > 16) c.push(2 * i);
    if (!x.bref && Math.abs(signed(x.b)) > 16) c.push(2 * i + 1);
  });
  if (G.len > 1) c.push(2 * G.len);
  return c;
};
const fieldCount = (G) => 4 * G.len + (G.len > 1 ? 1 : 0);
const fieldValues = (G, x) => (x < 4 * G.len ? [17, 7, 8, 8][x % 4] : G.len);
const constant = (G, k) => (k === 2 * G.len ? G.start : k % 2 ? G.g[k >> 1].b : G.g[k >> 1].a);
// the positions of a pass, as opt_positions() lists them
function positions(G, moves) {
  const c = constantsOf(G), far = c.filter((k) => k !== 2 * G.len), F = fieldCount(G), out = [];
  if (moves.includes('constants')) for (const k of c) out.push(['constants', [k]]);
  if (moves.includes('fields')) for (let x = 0; x < F; x++) if (x < 4 * G.len || !moves.includes('constants')) out.push(['fields', [x]]);
  if (moves.includes('pairs')) for (let i = 0; i < far.length; i++) for (let j = i + 1; j < far.length; j++) out.push(['pairs', [far[i], far[j]]]);
  if (moves.includes('field-pairs') && G.len <= 8) for (let x = 0; x < F; x++) for (let y = x + 1; y < F; y++) out.push(['field-pairs', [x, y]]);
  return out;
}
// the number of candidates of a position (opt_moves()); constants: null (test/evolver-tune.test.js has those)
function candidates(G, move, at) {
  if (move === 'fields') return fieldValues(G, at[0]) - 1;
  if (move === 'field-pairs') return (fieldValues(G, at[0]) - 1) * (fieldValues(G, at[1]) - 1);
  if (move === 'pairs') {
    const a = constant(G, at[0]), b = constant(G, at[1]), seen = new Set();
    const ds = [];
    for (let k = 1; k <= 8; k++) ds.push(k, -k);
    for (const [n, d] of [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]]) ds.push(Math.trunc((CORE * n) / d), -Math.trunc((CORE * n) / d));
    for (const d of ds) for (const e of [d, -d]) { const k = `${wrap(a + d)},${wrap(b + e)}`; if (k !== `${a},${b}`) seen.add(k); }
    return seen.size;
  }
  return null;
}
// a step applied to the genome: its changes
function apply(G, step) {
  for (const c of step.changes) {
    const x = c.at >= 0 ? G.g[c.at] : null;
    if (c.field === 'start') G.start = c.to;
    else if (c.field === 'a' || c.field === 'b') x[c.field] = wrap(c.to);
    else x[c.field] = c.to;
  }
}
// The text of the genome, for the WebAssembly engine
function textOf(G) {
  const ops = ['MOV', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'JMZ', 'JMN', 'DJN', 'CMP', 'SLT', 'SPL', 'DAT', 'JMP', 'SEQ', 'SNE', 'NOP'];
  const mods = ['A', 'B', 'AB', 'BA', 'F', 'X', 'I'];
  // operands as offsets: the steps change no reference, so a reference keeps the offset it had
  return `;redcode\n;name x\nORG ${G.start}\n${G.g.map((x) => `${ops[x.op]}.${mods[x.mod]} ${MODES[x.am]}${signed(x.a)}, ${MODES[x.bm]}${signed(x.b)}`).join('\n')}\n`;
}

// Replays a search from its events: every pass tries the positions of its moves in order, the same one again after
// a step, and a pass without a step ends it; each position has the candidates it should have; the steps change
// what their move says. Returns { tries, steps, candidates } per move.
function checkSearch(evs, text, moves) {
  const G = genomeOf(text);
  const start = evs[0];
  assert.equal(start.type, 'optimize');
  assert.equal(start.moves, moves.join(','));
  const per = Object.fromEntries(moves.map((m) => [m, { tries: 0, steps: 0, candidates: 0 }]));
  let at = 0, pass = 1, inPass = 0, expect = positions(G, moves);
  for (let k = 1; k < evs.length; k++) {
    const e = evs[k];
    if (e.type === 'optimize-end') break;
    assert.equal(e.type, 'optimize-try', `event ${k}: ${e.type}`);
    if (at === expect.length) { // the pass is over: the next one, if the pass took a step
      assert.ok(inPass > 0, 'a pass without a step, and the search went on');
      pass++, at = 0, inPass = 0;
      expect = positions(G, moves);
    }
    assert.equal(e.pass, pass);
    assert.deepEqual([e.move, e.at], expect[at], `pass ${pass}, position ${at}`);
    const want = candidates(G, e.move, e.at);
    if (want !== null) assert.equal(e.candidates, want, `${e.move} at ${e.at}: ${e.candidates} candidates, not ${want}`);
    assert.ok(e.ahead <= e.candidates);
    per[e.move].tries++, per[e.move].candidates += e.candidates;
    if (!e.step) {
      at++;
      continue;
    }
    const s = evs[++k];
    assert.equal(s.type, 'optimize-step');
    assert.deepEqual([s.pass, s.move], [pass, e.move]);
    assert.ok(s.gain > 2 * s.se && s.confirm > 2 * s.confirmSe, JSON.stringify(s));
    // what it changed: the fields of its position
    const fieldName = (x) => (x < 4 * G.len ? ['op', 'mod', 'am', 'bm'][x % 4] : 'start');
    const constName = (c) => (c === 2 * G.len ? 'start' : c % 2 ? 'b' : 'a');
    const names = e.move === 'fields' || e.move === 'field-pairs' ? e.at.map(fieldName) : e.at.map(constName);
    assert.deepEqual(s.changes.map((c) => c.field), names);
    for (const c of s.changes) assert.notEqual(c.from, c.to);
    if (e.move === 'pairs') { // by the same amount or by opposite ones
      const [x, y] = s.changes, dx = wrap(x.to - x.from), dy = wrap(y.to - y.from);
      assert.ok(dx === dy || dx === wrap(-dy), JSON.stringify(s.changes));
    }
    apply(G, s);
    per[e.move].steps++, inPass++;
  }
  return { per, G };
}

test('--optimize-moves pairs: two far constants moved together, by the same and by opposite amounts; a stone with a bad step is repaired; the same on any thread count', { skip }, () => {
  const file = join(tmp, 'badstep.red');
  writeFileSync(file, BADSTEP);
  const args = OPTS(file, ['--optimize-moves', 'pairs']);
  run(join(tmp, 'pairs1'), [...args, '--threads', '1']);
  const evs = events(join(tmp, 'pairs1'));
  const { per, G } = checkSearch(evs, BADSTEP, ['pairs']);
  assert.ok(per.pairs.steps >= 1, JSON.stringify(per));
  const end = evs.at(-1);
  assert.ok(end.avg > evs[0].avg + 20, `${evs[0].avg} to ${end.avg}`);
  // the warrior of the replayed steps is the one optimized.red has, and scores the logged average against the panel
  const opt = assemble(readFileSync(join(tmp, 'pairs1', 'optimized.red'), 'latin1'), RULES);
  const mine = assemble(textOf(G), RULES);
  const code = (w) => w.instructions.map(({ line, ...x }) => x);
  assert.deepEqual(code(mine), code(opt));
  const m = createMarsSync(RULES);
  let sum = 0;
  for (const p of evs[0].panel) {
    const r = m.runMatch([opt, assemble(readFileSync(join(root, 'warriors/koenigstuhl/tiny', p.file), 'latin1'), RULES)], { seed: p.seed, rounds: evs[0].rounds });
    sum += ((3 * r.warriors[0].wins + r.warriors[0].ties) * 100) / evs[0].rounds;
  }
  assert.ok(Math.abs(sum / evs[0].panel.length - end.avg) < 1e-6, `replayed ${sum / evs[0].panel.length}, logged ${end.avg}`);
  run(join(tmp, 'pairs3'), [...args, '--threads', '3']);
  assert.deepEqual(events(join(tmp, 'pairs3')), evs);
});

test('--optimize-moves constants,fields,field-pairs: every single change of a field, then every two at once, each with the candidates it should have', { skip }, () => {
  // three instructions: 13 fields (the start among them), 78 pairs of fields
  const text = ';redcode\n;name small\nmov.i $0, $100\njmp.b $-1, #0\ndat.f #0, #0\n';
  const file = join(tmp, 'small.red');
  writeFileSync(file, text);
  const moves = ['constants', 'fields', 'field-pairs'];
  run(join(tmp, 'fields1'), [...OPTS(file, ['--optimize-moves', 'field-pairs,constants,fields', '--rounds', '20']), '--threads', '4']);
  const evs = events(join(tmp, 'fields1'));
  const { per } = checkSearch(evs, text, moves); // the moves in their order, whatever the order given
  assert.ok(per.fields.tries >= 12 && per['field-pairs'].tries >= 78, JSON.stringify(per));
  // the start belongs to the constants here, not to the fields
  assert.ok(!evs.some((e) => e.type === 'optimize-try' && e.move === 'fields' && e.at[0] === 12));
  assert.ok(evs.some((e) => e.type === 'optimize-try' && e.move === 'field-pairs' && e.at[1] === 12));
});

test('--optimize-moves: field-pairs only for warriors of up to 8 instructions; what it refuses', { skip }, () => {
  const text = `;redcode\n;name long\n${'mov.i $0, $1\n'.repeat(9)}`;
  const file = join(tmp, 'long.red');
  writeFileSync(file, text);
  const r = spawnSync(evolve, [join(tmp, 'long1'), ...OPTS(file, ['--optimize-moves', 'field-pairs', '--rounds', '20']), '--threads', '4'], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /--optimize-moves field-pairs: 9 instructions, more than 8: no field pairs/);
  const evs = events(join(tmp, 'long1'));
  assert.ok(!evs.some((e) => e.type === 'optimize-try'), 'a position tried');
  for (const [args, message] of [
    [OPTS(file, ['--optimize-moves', 'fields,triples']), /--optimize-moves takes constants, fields, pairs and field-pairs, comma separated, not 'triples'/],
    [[...TINY, '--optimize-moves', 'pairs', '--batches', '1'], /--optimize-moves with --optimize/],
  ]) {
    const d = join(tmp, `opt-no-${args.length}`);
    const p = spawnSync(evolve, [d, ...args], { encoding: 'utf8', timeout: 60000 });
    assert.equal(p.status, 2, p.stderr);
    assert.match(p.stderr, message);
    assert.ok(!existsSync(join(d, 'events.jsonl')) && !existsSync(join(d, 'state.txt')));
  }
});
