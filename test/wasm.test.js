// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The simulator of the library (wasm/42mars.js): the specialized loops
// against the generic operand code of the watched loop, after every round
// and at random points inside rounds, runMatch against stepping, and the
// states against digests recorded where they were those of js/mars.js
// (test/recorded.js, test/fixtures/wasm.json); plus targeted cases.

import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { compileMars, createMars, createMarsSync, packWarrior, rng, assemble } from '../wasm/42mars.js';
import { Digest, recorded } from './recorded.js';
import { CORE, compareCore } from './engines.js';

const module = await compileMars();
const check = recorded('wasm.json');

let state = 0x9e3779b9;
const rand = (k) => {
  state ^= state << 13; state >>>= 0;
  state ^= state >>> 17;
  state ^= state << 5; state >>>= 0;
  return state % k;
};
// Each test starts the generator from a seed made of its name: its random
// cases, and so its recorded digests, do not depend on the tests before it
// (a test can run alone, and a change to one test leaves the others).
function test(name, ...args) {
  const fn = args.pop();
  nodeTest(name, ...args, (...a) => {
    state = 2166136261;
    for (const ch of name) state = Math.imul(state ^ ch.charCodeAt(0), 16777619) >>> 0;
    state ||= 1;
    return fn(...a);
  });
}
const pick = (a) => a[rand(a.length)];

const OPS = ['mov', 'add', 'sub', 'mul', 'div', 'mod', 'jmz', 'jmn', 'djn', 'cmp', 'slt', 'spl', 'dat', 'jmp', 'seq', 'sne', 'nop', 'ldp', 'stp'];
const MODS = ['', '.a', '.b', '.ab', '.ba', '.f', '.x', '.i'];
const MODES = ['#', '$', '@', '<', '>', '*', '{', '}'];

// A random warrior; pspace: more LDP and STP; pin: a PIN line; loop: no
// DAT, and a jump back to the start at the end, so that it lives longer.
function randomWarrior(len, coreSize, { pspace = false, pin = null, loop = false } = {}) {
  const small = () => String(rand(9) - 4);
  const wide = () => String(rand(coreSize) - (coreSize >> 1));
  const operand = () => `${pick(MODES)}${rand(3) ? small() : wide()}`;
  const lines = [';redcode-94', `;name r${rand(1e6)}`];
  if (pin !== null) lines.push(`pin ${pin}`);
  for (let i = 0; i < len; i++) {
    const r = rand(8);
    let op = pspace && r < 2 ? pick(['ldp', 'stp']) : r === 2 ? pick(['spl', 'mov', 'djn', 'jmp']) : pick(OPS);
    if (loop && (op === 'dat' || op === 'div' || op === 'mod')) op = 'mov';
    lines.push(`${op}${pick(MODS)} ${operand()}, ${operand()}`);
  }
  if (loop) lines.push(`jmp ${-len}`);
  lines.push(`org ${loop ? 0 : rand(len)}`);
  return lines.join('\n') + '\n';
}

const RULES = [
  { coreSize: 80, maxCycles: 800, maxProcesses: 80, maxLength: 5, minDistance: 5 },
  { coreSize: 800, maxCycles: 8000, maxProcesses: 800, maxLength: 20, minDistance: 20 },
  { coreSize: 800, maxCycles: 4000, maxProcesses: 8, maxLength: 20, minDistance: 20 },
  { coreSize: 200, maxCycles: 2000, maxProcesses: 1, maxLength: 10, minDistance: 10 },
  { coreSize: 8000, maxCycles: 80000, maxProcesses: 8000, maxLength: 100, minDistance: 100 },
  { coreSize: 11, maxCycles: 300, maxProcesses: 4, maxLength: 2, minDistance: 2 }, // pSpaceSize 0
  { coreSize: 130, maxCycles: 1000, maxProcesses: 16, maxLength: 5, minDistance: 20, pSpaceSize: 3 }, // dense placement
  { coreSize: 65536, maxCycles: 20000, maxProcesses: 64, maxLength: 30, minDistance: 1000 },
  { coreSize: 55440, maxCycles: 10000, maxProcesses: 1000, maxLength: 30, minDistance: 300, pSpaceSize: 1 },
];

// The state of an engine between runs, for the digest and to compare two
// engines: everything but the core.
function snapshot(e) {
  return {
    round: e.round, roundOver: e.roundOver, time: e.time, cyclesLeft: e.cyclesLeft, warriorsLeft: e.warriorsLeft,
    current: e.roundOver ? null : e.current, roundResult: e.roundResult,
    warriors: e.warriors.map((W) => ({
      position: W.position, queue: W.processes(), alive: W.alive, diedAt: W.diedAt, score: W.score,
      wins: W.wins, losses: W.losses, ties: W.ties, lastResult: W.lastResult, pspace: Array.from(W.pspace),
    })),
  };
}

// Compares the states of engines a and b and adds a's to the digest d.
function compareState(a, b, where, d) {
  const sa = JSON.stringify(snapshot(a)), sb = JSON.stringify(snapshot(b));
  if (sa !== sb) assert.deepEqual(JSON.parse(sb), JSON.parse(sa), where);
  compareCore(a, b, where);
  if (d) {
    const c = a.core();
    d.addText(sa).add(...CORE.map((k) => c[k]));
  }
}

// Plays one match on two engines: one without a watch, which runs the
// specialized loops (execute, execute2_8000, execute2_any), and one with a
// watch, which runs every instruction through the generic operand code
// (execute_watched). They must agree after every round and, with `steps`,
// after every chunk of random length. runMatch must give the same rounds.
// Returns [what, digest] of the states for the recording (test/recorded.js).
function compareMatch(o, codes, { seed, positions, rounds, steps }) {
  const w = createMarsSync(o, module);
  const x = createMarsSync({ ...o, watch: true }, module);
  w.load(codes, { seed, positions });
  x.load(codes, { seed, positions });
  const where = `${JSON.stringify(o)} seed ${seed} positions ${positions} warriors ${codes.map((c) => c.name).join(', ')}`;
  const d = new Digest();
  for (let r = 0; r < rounds; r++) {
    w.startRound();
    x.startRound();
    compareState(w, x, `${where} round ${r + 1} start`, d);
    while (!w.roundOver) {
      const n = steps ? 1 + rand(rand(2) ? 5 : 3000) : 1e9;
      assert.equal(x.run(n), w.run(n), `${where} round ${r + 1}: executed count`);
      if (steps) compareState(w, x, `${where} round ${r + 1} time ${w.time}`, d);
    }
    assert.equal(w.run(10), 0);
    compareState(w, x, `${where} round ${r + 1} end`, d);
  }
  assert.deepEqual(x.results, w.results, `${where}: results`);

  // runMatch on a fresh engine gives the same match, with and without early
  // tie detection; without it also the same final core.
  for (const earlyTie of [false, true]) {
    const y = createMarsSync(o, module);
    const result = y.runMatch(codes, { rounds, seed, positions, earlyTie });
    const at = `${where} runMatch earlyTie ${earlyTie}`;
    assert.deepEqual(result.results, w.results, `${at}: results`);
    assert.deepEqual(result.warriors.map((v) => [v.wins, v.losses, v.ties, v.score]),
      w.warriors.map((v) => [v.wins, v.losses, v.ties, v.score]), `${at}: scores`);
    assert.deepEqual(y.warriors.map((v) => [v.lastResult, v.pspace]), w.warriors.map((v) => [v.lastResult, v.pspace]), `${at}: p-space`);
    const cycles = w.results.reduce((sum, r) => sum + r.cycles, 0);
    if (earlyTie) assert.ok(result.instructions <= cycles, `${at}: instructions`);
    else {
      assert.equal(result.instructions, cycles, `${at}: instructions`);
      compareCore(w, y, `${at}: core`);
    }
  }
  return [where, d.digest()];
}

test('random battles: the specialized loops and the generic code agree after every round', () => {
  const got = [];
  for (let i = 0; i < 360; i++) {
    const o = RULES[i % RULES.length];
    const maxWarriors = Math.min(6, Math.floor(o.coreSize / o.minDistance));
    const nw = 2 + rand(maxWarriors - 1);
    const pinned = rand(3) === 0;
    const sources = Array.from({ length: nw }, (_, k) => randomWarrior(rand(Math.min(o.maxLength - 1, 12)) + 1, o.coreSize, {
      pspace: rand(2) === 0,
      loop: rand(2) === 0,
      pin: pinned && k < 3 ? 5 + (k & 1) * rand(2) : null,
    }));
    const codes = sources.map((s) => assemble(s, { ...o, warriors: nw }));
    if (!codes.every((c) => c.ok)) continue;
    const positions = rand(5) === 0 ? codes.map((_, k) => (k * o.minDistance + rand(3)) % o.coreSize) : undefined;
    got.push(compareMatch(o, codes, { seed: rand(2147483646) + 1, positions, rounds: 1 + rand(5), steps: i % 4 === 0 }));
  }
  assert.ok(got.length > 300, `only ${got.length} battles assembled`);
  check('random battles', got);
});

test('random battles with up to 6 warriors in dense cores use both placement methods', () => {
  const o = { coreSize: 130, maxCycles: 600, maxProcesses: 8, maxLength: 4, minDistance: 20 };
  const got = [];
  for (let i = 0; i < 60; i++) {
    const nw = 3 + (i % 4);
    const codes = Array.from({ length: nw }, () => assemble(randomWarrior(1 + rand(3), o.coreSize, { pspace: true, loop: rand(2) === 0 }), { ...o, warriors: nw }));
    if (!codes.every((c) => c.ok)) continue;
    got.push(compareMatch(o, codes, { seed: i * 7919 + 1, rounds: 4, steps: false }));
  }
  check('dense cores', got);
});

const warrior = (src, o = {}) => {
  const w = assemble(src, o);
  assert.ok(w.ok, JSON.stringify(w.errors));
  return w;
};

test('targeted: p-space last result, PIN sharing and STP to index 0', () => {
  const src = (pin) => `pin ${pin}\nldp.ab #0, res\nstp.ab #42, #1\nldp.ab #1, res2\nstp.b #7, #0\nldp.b #0, res3\njmp 0\nres dat 0, 0\nres2 dat 0, 0\nres3 dat 0, 0\n`;
  const o = { maxCycles: 100 };
  const got = [];
  got.push(compareMatch(o, [warrior(src(3)), warrior(src(3)), warrior(src(4))], { seed: 77, rounds: 4, steps: true }));
  got.push(compareMatch(o, [warrior(src(3)), warrior('jmp 0\n')], { positions: [0, 4000], rounds: 3, steps: true }));
  check('p-space', got);
});

test('targeted: process limit 1, DIV/MOD by zero, DJN on post-incremented cells', () => {
  const o = { coreSize: 100, maxProcesses: 1, maxCycles: 500, minDistance: 10, maxLength: 10 };
  const a = warrior('spl 0\nmov.i }1, >1\ndjn.f -1, }0\ndiv.f #0, 2\njmp -4\n', o);
  const b = warrior('mod.x #3, >0\ndjn.b 0, >0\njmp -2\n', o);
  check('process limit 1', [compareMatch(o, [a, b], { seed: 5, rounds: 6, steps: true })]);
});

// The wasm engine reads the whole A cell once at operand time; MOV.I stores
// that snapshot and CMP.I, SEQ.I and SNE.I compare its instruction word.
// Operands of -1 to 2 with increment and decrement modes make A and B hit
// the same cell, and the A operand hit the cell its own increment changes.
test('targeted: .I copies and compares when A and B hit the same cell through } > { <', () => {
  const o = { coreSize: 64, maxCycles: 2000, maxProcesses: 16, minDistance: 16, maxLength: 16 };
  const field = () => `${pick(['}', '>', '{', '<', '#', '$'])}${rand(4) - 1}`;
  const src = () => {
    const lines = ['spl 0, 0'];
    for (let i = 0; i < 2 + rand(6); i++) lines.push(`${pick(['mov.i', 'mov.i', 'cmp.i', 'seq.i', 'sne.i'])} ${field()}, ${field()}`);
    lines.push(`jmp ${-lines.length}, 1`, 'dat 1, 0', 'dat 0, 1');
    return lines.join('\n') + '\n';
  };
  const got = [];
  for (let k = 0; k < 40; k++) {
    got.push(compareMatch(o, [warrior(src(), { ...o, warriors: 2 }), warrior(src(), { ...o, warriors: 2 })], { seed: rand(2147483646) + 1, rounds: 2, steps: true }));
  }
  check('.I copies and compares', got);
});

// Two warriors with maxCycles up to 80000 get linear queues, long enough for
// the longest round: at most maxCycles + 1 turns each, at most two entries
// pushed per turn. A block of SPL 0 with more processes allowed than cycles
// pushes two in nearly every turn. Above 80000 cycles the queues are rings; with 64 processes the
// ring wraps all the time.
test('targeted: full queues at the linear queue limit and above', () => {
  // Nearly every turn of this warrior pushes two entries.
  const spl = warrior(`${'spl 0\n'.repeat(99)}jmp -99\n`);
  const got = [];
  for (const o of [{ maxCycles: 80000, maxProcesses: 200000 }, { maxCycles: 100000, maxProcesses: 200000 }, { maxCycles: 80001, maxProcesses: 64 }]) {
    got.push(compareMatch(o, [spl, spl], { seed: 11, rounds: 2, steps: false }));
  }
  check('full queues', got);
});

// runMatch({ firstRound }) plays a block of the match's rounds with empty
// p-space. Without LDP the blocks give the same rounds as the whole match:
// tools/tournament.mjs runs such blocks on several workers.
test('runMatch in blocks with firstRound gives the rounds of the whole match when no warrior has LDP', () => {
  const noLdp = (src) => src.replace(/^ldp/gm, 'stp');
  const blocks = [[0, 3], [3, 1], [4, 0], [4, 7]]; // [firstRound, rounds]: 11 rounds
  for (const o of [RULES[1], RULES[4], RULES[6]]) {
    for (const nw of [2, 3]) {
      if (nw * o.minDistance > o.coreSize) continue;
      const codes = Array.from({ length: nw }, () => warrior(noLdp(randomWarrior(1 + rand(o.maxLength - 1), o.coreSize, { loop: rand(2) === 0 })), { ...o, warriors: nw }));
      for (const positions of [undefined, codes.map((_, i) => i * o.minDistance)]) {
        const seed = rand(2147483646) + 1;
        const whole = createMarsSync(o, module).runMatch(codes, { rounds: 11, seed, positions });
        const parts = blocks.map(([firstRound, rounds]) => createMarsSync(o, module).runMatch(codes, { rounds, seed, positions, firstRound }));
        const where = `${JSON.stringify(o)} ${nw} warriors seed ${seed}`;
        assert.deepEqual(parts.flatMap((p) => p.results), whole.results, where);
        assert.equal(parts.reduce((s, p) => s + p.instructions, 0), whole.instructions, where);
        for (let i = 0; i < nw; i++) {
          for (const k of ['wins', 'losses', 'ties']) assert.equal(parts.reduce((s, p) => s + p.warriors[i][k], 0), whole.warriors[i][k], `${where} ${k}`);
        }
      }
    }
  }
  // With LDP the blocks differ: this warrior dies right after a tied round,
  // and a block starts without that last result.
  const ldp = warrior('ldp.ab #0, flag\nsub.ab #2, flag\njmz.b die, flag\njmp 0\ndie dat 0, 0\nflag dat 0, 0\n');
  const codes = [ldp, warrior('jmp 0\n')];
  const whole = createMarsSync({}, module).runMatch(codes, { rounds: 4, seed: 7 });
  assert.deepEqual(whole.results.map((r) => r.survivors.length), [2, 1, 2, 1]);
  const late = createMarsSync({}, module).runMatch(codes, { rounds: 2, seed: 7, firstRound: 2 });
  assert.deepEqual(late.results.map((r) => [r.round, r.survivors.length]), [[3, 2], [4, 1]]);
  const odd = createMarsSync({}, module).runMatch(codes, { rounds: 2, seed: 7, firstRound: 1 });
  assert.deepEqual(odd.results.map((r) => [r.round, r.survivors.length]), [[2, 2], [3, 1]]);
  assert.throws(() => createMarsSync({}, module).runMatch(codes, { rounds: 2, firstRound: -1 }), RangeError);
});

// runMatch({ pspace }) carries p-space and the last results from one block to
// the next: then the blocks give the rounds of the whole match also with LDP
// (issue #48, tools/tournament.mjs could play such pairings round by round).
test('runMatch in blocks with pspace carried over gives the rounds of the whole match, also with LDP', () => {
  const ldp = warrior('ldp.ab #0, flag\nsub.ab #2, flag\njmz.b die, flag\njmp 0\ndie dat 0, 0\nflag dat 0, 0\n');
  const playBlocks = (codes, o, seed, blocks) => {
    let pspace = true;
    const results = [];
    let instructions = 0;
    for (const [firstRound, rounds] of blocks) {
      const r = createMarsSync(o, module).runMatch(codes, { rounds, seed, firstRound, pspace });
      results.push(...r.results);
      instructions += r.instructions;
      pspace = r.warriors.map((w) => w.pspace);
    }
    return { results, instructions, pspace };
  };
  const codes = [ldp, warrior('jmp 0\n')];
  const whole = createMarsSync({}, module).runMatch(codes, { rounds: 4, seed: 7, pspace: true });
  assert.deepEqual(whole.results.map((r) => r.survivors.length), [2, 1, 2, 1]);
  const rounds = playBlocks(codes, {}, 7, [[0, 1], [1, 1], [2, 1], [3, 1]]);
  assert.deepEqual(rounds.results, whole.results);
  assert.deepEqual(rounds.pspace, whole.warriors.map((w) => w.pspace));
  // random warriors with LDP, STP and PINs, two and three warriors
  for (const o of [RULES[1], RULES[5], RULES[6]]) {
    for (const nw of [2, 3]) {
      if (nw * o.minDistance > o.coreSize) continue;
      const cs = Array.from({ length: nw }, (_, i) => warrior(randomWarrior(1 + rand(o.maxLength - 1), o.coreSize, { pspace: true, pin: i < 2 && rand(2) ? 5 : null }), { ...o, warriors: nw }));
      const seed = rand(2147483646) + 1;
      const all = createMarsSync(o, module).runMatch(cs, { rounds: 11, seed, pspace: true });
      const parts = playBlocks(cs, o, seed, [[0, 3], [3, 1], [4, 0], [4, 7]]);
      const where = `${JSON.stringify(o)} ${nw} warriors seed ${seed}`;
      assert.deepEqual(parts.results, all.results, where);
      assert.equal(parts.instructions, all.instructions, where);
      assert.deepEqual(parts.pspace, all.warriors.map((w) => w.pspace), where);
    }
  }
  assert.throws(() => createMarsSync({}, module).runMatch(codes, { pspace: [new Int32Array(3)] }), RangeError);
  // pspace: true starts as a match starts: the last result is coreSize - 1,
  // so this warrior dies in round 1 (and in no other round)
  const first = [warrior('ldp.ab #0, flag\nadd.ab #1, flag\njmz.b die, flag\njmp 0\ndie dat 0, 0\nflag dat 0, 0\n'), warrior('jmp 0\n')];
  const plain = createMarsSync({}, module).runMatch(first, { rounds: 3, seed: 9 });
  assert.deepEqual(plain.results.map((r) => r.survivors), [[1], [0, 1], [0, 1]]);
  assert.deepEqual(createMarsSync({}, module).runMatch(first, { rounds: 3, seed: 9, pspace: true }).results, plain.results);
});

// packWarrior() prepares a warrior once; the engine copies it in one block.
// tools/tournament.mjs keeps the packed warriors of all threads in one
// SharedArrayBuffer.
test('packed warriors play like the warriors they were packed from', () => {
  for (const o of [RULES[1], RULES[4], RULES[6]]) {
    for (const nw of [1, 2, 3]) {
      if (nw * o.minDistance > o.coreSize) continue;
      const codes = Array.from({ length: nw }, () => warrior(randomWarrior(1 + rand(o.maxLength - 1), o.coreSize, { loop: rand(2) === 0 }), { ...o, warriors: nw }));
      codes[0].pin = 7; // a shared p-space when there is a second warrior with it
      if (nw > 1) codes[nw - 1].pin = 7;
      const shared = new Int32Array(new SharedArrayBuffer(4 * 5 * o.maxLength * nw));
      let at = 0;
      const packed = codes.map((c, i) => {
        if (i === 0) return packWarrior(c);
        const p = packWarrior(c, shared.subarray(at, at + 5 * c.instructions.length));
        at += p.packed.length;
        return p;
      });
      const seed = rand(2147483646) + 1;
      const plain = createMarsSync(o, module).runMatch(codes, { rounds: 5, seed, earlyTie: false });
      const m = createMarsSync(o, module);
      assert.deepEqual(m.runMatch(packed, { rounds: 5, seed, earlyTie: false }), plain, `${JSON.stringify(o)} ${nw} warriors seed ${seed}`);
      assert.deepEqual(m.warriors.map((w) => [...w.pspace]), (() => { const q = createMarsSync(o, module); q.runMatch(codes, { rounds: 5, seed, earlyTie: false }); return q.warriors.map((w) => [...w.pspace]); })());
    }
  }
  const long = packWarrior(warrior('jmp 0\n'.repeat(5)));
  assert.throws(() => createMarsSync({ maxLength: 4 }, module).runMatch([long, long], { rounds: 1 }), /longer than 4/);
});

test('targeted: maxCycles 0, a single warrior, empty warriors and fractional run counts', () => {
  const empty = (name) => ({ ok: true, instructions: [], start: 0, pin: null, name, author: 'nobody' });
  const got = [];
  got.push(compareMatch({ maxCycles: 0 }, [warrior('jmp 0\n'), warrior('jmp 0\n')], { seed: 3, rounds: 2, steps: true }));
  got.push(compareMatch({ maxCycles: 50 }, [warrior('jmp 0\n')], { positions: [0], rounds: 2, steps: true }));
  got.push(compareMatch({ maxCycles: 50 }, [warrior('dat 0\n')], { positions: [17], rounds: 2, steps: true }));
  got.push(compareMatch({}, [warrior('jmp 0\n'), empty('ghost')], { positions: [0, 0], rounds: 1, steps: true }));
  got.push(compareMatch({}, [empty('a'), empty('b'), empty('c')], { positions: [0, 100, 200], rounds: 3, steps: true }));
  // a fraction rounds up, 0 and less run nothing
  const w = createMarsSync({ maxCycles: 100 }, module);
  const x = createMarsSync({ maxCycles: 100, watch: true }, module);
  for (const e of [w, x]) { e.load([warrior('jmp 0\n'), warrior('jmp 0\n')], { seed: 9 }); e.startRound(); }
  assert.deepEqual([0.5, 1.5, 0, -3, 2.2].map((n) => [w.run(n), x.run(n)]), [[1, 1], [2, 2], [0, 0], [0, 0], [3, 3]]);
  compareState(w, x, 'fractional');
  check('limits of the rules', got);
});

test('targeted: endRound() in the middle of a round', () => {
  const w = createMarsSync({}, module);
  const x = createMarsSync({ watch: true }, module);
  for (const e of [w, x]) {
    e.load([warrior('spl 0\njmp -1\n'), warrior('mov 0, 1\n'), warrior('jmp 0\n')], { seed: 11 });
    e.startRound();
    e.run(1000);
    e.endRound();
    e.endRound();
  }
  const d = new Digest();
  compareState(w, x, 'endRound', d);
  assert.deepEqual(w.roundResult, { round: 1, cycles: 1000, survivors: [0, 1, 2] });
  check('endRound', [['endRound', d.digest()]]);
});

test('targeted: placement follows pMARS\'s generator for two warriors', () => {
  const w = createMarsSync({}, module);
  w.load([warrior('jmp 0\n'), warrior('jmp 0\n')], { seed: 5 });
  w.startRound();
  assert.equal(w.warriors[1].position, 105);
  w.endRound();
  w.startRound();
  assert.equal(w.warriors[1].position, 100 + (rng(5) % 7801));
});

test('the async constructor works and options are checked', async () => {
  const w = await createMars({ coreSize: 800 });
  const r = w.runMatch([warrior('jmp 0\n', { coreSize: 800 }), warrior('dat 0\n', { coreSize: 800 })], { rounds: 3, seed: 1 });
  assert.deepEqual(r.warriors.map((x) => x.wins), [3, 0]);
  assert.throws(() => createMarsSync({ coreSize: 65537 }, module), RangeError);
  assert.throws(() => w.load([warrior('jmp 0\n')], { seed: -1 }), RangeError);
  assert.throws(() => w.load([warrior('jmp 0\n')], { seed: 1.5 }), RangeError);
});

test('early tie detection skips the end of tie rounds, not with STP', () => {
  const paper = warrior('spl 0\njmp -1\n');
  const m = createMarsSync({}, module); // round by round, without early ties
  m.load([paper, paper], { seed: 5 });
  for (let r = 0; r < 3; r++) { m.startRound(); m.run(1e9); }
  const w = createMarsSync({}, module);
  const r = w.runMatch([paper, paper], { rounds: 3, seed: 5 });
  assert.deepEqual(r.results, m.results);
  // Each warrior reaches 8000 processes; the last 2 * 7999 cycles are skipped.
  assert.ok(r.instructions <= 3 * (160000 - 2 * 7999), `executed ${r.instructions}`);
  assert.equal(w.runMatch([paper, paper], { rounds: 3, seed: 5, earlyTie: false }).instructions, 3 * 160000);
  // At the boundary: a warrior whose processes all die, one per turn, on
  // its last turns of the round is not a tie (maxCycles 0 and 1: dat dies on its
  // only turn; the spl tree has 8 processes that die on turns 8 to 15).
  const tree = warrior('spl 1\nspl 1\nspl 1\ndat 0\n');
  const got = [];
  for (let cycles = 0; cycles <= 40; cycles++) {
    got.push(compareMatch({ maxCycles: cycles }, [warrior('dat 0\n'), warrior('jmp 0\n')], { seed: 1, rounds: 2, steps: false }));
    got.push(compareMatch({ maxCycles: cycles }, [tree, paper], { seed: 1, rounds: 2, steps: false }));
    got.push(compareMatch({ maxCycles: cycles }, [paper, tree, tree], { seed: 1, rounds: 3, steps: false }));
  }
  check('early ties at the boundary', got);
  const stp = warrior('spl 0\njmp -1\nstp #1, #2\n');
  assert.equal(w.runMatch([paper, stp], { rounds: 3, seed: 5 }).instructions, 3 * 160000);
});

// See test/mars.test.js: pMARS's validate.red loops forever on a compliant MARS.
const validate = process.env.PMARS_VALIDATE;
test('pMARS validate.red self-ties on the wasm engine', { skip: !validate || !existsSync(validate) ? 'PMARS_VALIDATE not set' : false }, () => {
  const w = createMarsSync({}, module);
  w.load([warrior(readFileSync(validate, 'latin1'), { warriors: 1 })], { positions: [0] });
  w.startRound();
  w.run(1e6);
  assert.deepEqual(w.roundResult.survivors, [0]);
  assert.equal(w.time, 80000);
});

test('early tie when the core has no DAT, DIV, MOD or STP left', () => {
  const o = { coreSize: 80, maxCycles: 4000, maxProcesses: 80, maxLength: 10, minDistance: 10 };
  const w = (src) => warrior(src, o);
  // Two imps write MOV.I over the whole core: no process can die any more.
  const imp = w('mov.i 0, 1\n');
  const got = [compareMatch(o, [imp, imp], { seed: 1, rounds: 3, steps: false })];
  const r = createMarsSync(o, module).runMatch([imp, imp], { rounds: 3, seed: 1 });
  assert.ok(r.instructions <= 3 * 4096, `executed ${r.instructions}`); // checks every 4096 at most
  // B writes JMP 0 over every other cell (about 16000 instructions), waits
  // 3000 turns, which spans checks (every 4096 instructions at most), then
  // dies on a DIV or MOD by zero, or writes the p-space with STP: none of
  // these is a tie.
  const big = { coreSize: 8000, maxCycles: 20000, maxProcesses: 80, maxLength: 10, minDistance: 10 };
  const clear = (last) => warrior(`clr mov.i bomb, }ptr\ndjn.b clr, #7993\ncnt djn.b cnt, #3000\n${last}\njmp 0\nbomb jmp 0, 0\nptr nop 1, 1\n`, big);
  const loop = warrior('jmp 0\n', big);
  for (const last of ['div.ab #0, #0', 'mod.ab #0, #0', 'stp.ab #5, #1', 'nop 0, 0']) {
    got.push(compareMatch(big, [loop, clear(last)], { positions: [4000, 0], rounds: 2, steps: false }));
  }
  check('no killer left', got);
  // The setup does what it should: the DIV kills B, STP writes the
  // p-space, and the NOP version ties early.
  const x = createMarsSync(big, module);
  assert.deepEqual(x.runMatch([loop, clear('div.ab #0, #0')], { positions: [4000, 0], rounds: 1 }).results[0].survivors, [0]);
  x.runMatch([loop, clear('stp.ab #5, #1')], { positions: [4000, 0], rounds: 1 });
  assert.equal(x.warriors[1].pspace[1], 5);
  const y = x.runMatch([loop, clear('nop 0, 0')], { positions: [4000, 0], rounds: 1 });
  assert.deepEqual(y.results[0].survivors, [0, 1]);
  assert.ok(y.instructions < 40000, `executed ${y.instructions}`);
});

// The instruction words in lib/src/dispatch.h (lib/src/gen-dispatch.mjs)
// run a copy of the instruction compiled for that word. Each of them must
// agree with the generic code of the watched loop: in the loop for the
// standard settings (core size and
// process limit 8000, constants in execute2_8000()), in the general
// two-warrior loop, with queues longer than the fixed queue buffers, and in
// the loop for more than two warriors.
test('every specialized instruction word agrees with the generic code', () => {
  // dispatch.h: the index of every word with a case, the tree of
  // exec_more() and the tree of step(), each once for all words and once
  // for the first 16.
  const text = readFileSync(new URL('../lib/src/dispatch.h', import.meta.url), 'utf8');
  const [, indexAll, index16, moreAll, more16, treeAll, tree16] = text.split(/^#(?:if|elif|else|endif).*$/m);
  const cases = (part) => [...part.matchAll(/^ *case (\d+): return (\d+);/gm)].map((m) => [Number(m[1]), Number(m[2])]);
  // A tree as a function from an index to its leaf: a word, 'more' or 'other'.
  const walker = (part) => {
    const lines = part.split('\n').map((l) => l.trim()).filter(Boolean);
    let at = 0;
    const node = () => {
      const l = lines[at++];
      const split = /^if \(hot < (\d+)\) \{$/.exec(l);
      if (!split) {
        const leaf = /^return (?:EXEC\((\d+)\)|EXEC_(MORE|OTHER)\(\));/.exec(l);
        assert.ok(leaf, `not a leaf: ${l}`);
        return () => (leaf[1] ? Number(leaf[1]) : leaf[2].toLowerCase());
      }
      const low = node();
      assert.equal(lines[at++], '} else {');
      const high = node();
      assert.equal(lines[at++], '}');
      return (hot) => (hot < Number(split[1]) ? low(hot) : high(hot));
    };
    const root = node();
    assert.equal(at, lines.length, 'one tree');
    return root;
  };
  const words = cases(indexAll).map((c) => c[0]);
  assert.ok(words.length >= 64, `only ${words.length} cases`);
  for (const [index, more, tree, count] of [[indexAll, moreAll, treeAll, words.length], [index16, more16, tree16, 16]]) {
    const list = cases(index), other = Number(/default: return (\d+);/.exec(index)[1]);
    assert.deepEqual(list.map((c) => c[0]), words.slice(0, count), 'the most executed words first');
    assert.deepEqual([...list.map((c) => c[1]), other].sort((a, b) => a - b), Array.from({ length: count + 1 }, (_, i) => i), 'every index once');
    // The index of a word leads to the case of that word: in step(), or
    // through its leaf for exec_more() there.
    const near = walker(tree), far = walker(more);
    const leaf = (hot) => (near(hot) === 'more' ? far(hot) : near(hot));
    for (const [w, hot] of list) assert.equal(leaf(hot), w, `index ${hot}`);
    assert.equal(leaf(other), 'other', 'the words without a case run the generic code');
  }
  const MODIFIERS = ['a', 'b', 'ab', 'ba', 'f', 'x', 'i'];
  // Operands mostly point into the warrior (a copy of an empty cell onto
  // an empty cell would hide a wrong copy) or close to it.
  const source = (w, len, coreSize) => {
    const value = () => String(rand(4) ? rand(2 * len + 7) - len - 3 : rand(coreSize) - (coreSize >> 1));
    const ins = (x) => `${OPS[(x & 0xff) >> 3]}.${MODIFIERS[x & 7]} ${MODES[(x >> 8) & 7]}${value()}, ${MODES[x >> 11]}${value()}`;
    const lines = [';redcode-94', `;name w${w}`, ins(w)]; // the word runs first
    for (let i = 1; i < len; i++) lines.push(rand(3) ? ins(w) : `${pick(['spl', 'jmp', 'mov', 'djn'])} ${pick(MODES)}${value()}, ${pick(MODES)}${value()}`);
    lines.push(`jmp ${-len}`, 'org 0');
    return lines.join('\n') + '\n';
  };
  const rules = [
    { maxLength: 100, minDistance: 100 }, // 8000 / 8000: execute2_8000()
    { coreSize: 800, maxCycles: 4000, maxProcesses: 800, maxLength: 20, minDistance: 20 },
    // Ring queues of 2^17 entries (more than 80000 cycles: no linear
    // queues), with enough cycles that the counters pass 2^16.
    { maxCycles: 80001, maxProcesses: 70000, maxLength: 20, minDistance: 100 },
  ];
  // The 64 most executed words in every loop, step by step where the
  // rounds are short (the words of the '94 hills make rounds that run to
  // the last cycle, and the compare after every step is most of the time).
  const short = [{ ...rules[0], maxCycles: 2000 }, rules[1]];
  const got = [];
  for (const w of words.slice(0, 64)) {
    for (const o of [...short, rules[2]]) {
      const codes = [source(w, 2 + rand(8), o.coreSize ?? 8000), source(w, 2 + rand(8), o.coreSize ?? 8000)].map((s) => warrior(s, { ...o, warriors: 2 }));
      got.push(compareMatch(o, codes, { seed: rand(2147483646) + 1, rounds: 3, steps: o !== rules[2] }));
      got.push(compareMatch(o, [codes[0], warrior(randomWarrior(1 + rand(8), o.coreSize ?? 8000, { loop: true }), { ...o, warriors: 2 })],
        { seed: rand(2147483646) + 1, rounds: 2, steps: false }));
    }
    const o = rules[1];
    const three = [0, 1, 2].map(() => warrior(source(w, 1 + rand(6), 800), { ...o, warriors: 3 }));
    got.push(compareMatch(o, three, { seed: rand(2147483646) + 1, rounds: 2, steps: false }));
  }
  // The others, 7 times as many, round by round in short rounds, a word per
  // warrior: two words per match in one of the two-warrior loops, three in
  // the loop for more warriors. A match costs 10 ms before its first
  // instruction (4 engines), so one match per word and loop would take 15 s.
  const rest = words.slice(64);
  for (let k = 0; k < rest.length; k += 2) {
    const o = short[(k >> 1) & 1];
    const codes = [rest[k], rest[k + 1] ?? rest[0]].map((w) => warrior(source(w, 2 + rand(8), o.coreSize ?? 8000), { ...o, warriors: 2 }));
    got.push(compareMatch(o, codes, { seed: rand(2147483646) + 1, rounds: 2, steps: false }));
  }
  for (let k = 0; k < rest.length; k += 3) {
    const o = rules[1];
    const three = [0, 1, 2].map((d) => warrior(source(rest[k + d] ?? rest[d], 1 + rand(6), 800), { ...o, warriors: 3 }));
    got.push(compareMatch(o, three, { seed: rand(2147483646) + 1, rounds: 2, steps: false }));
  }
  check('specialized words', got);
});
