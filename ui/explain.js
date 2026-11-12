// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Plain-English descriptions for the visualizer: what an opcode does, what
// one executed instruction just did, and a rough classification of what a
// warrior is doing right now. The classification is a heuristic based on the
// simulator's trace, not an analysis of the warrior's code.

import { OP, OPCODES, MODIFIERS, MODE_SYMBOLS, formatInstruction } from '../js/opcodes.js';

export const OPCODE_DOCS = {
  DAT: 'Data. A process that executes a DAT dies. Used as bomb and to store numbers.',
  MOV: 'Copies data from the A operand to the B operand.',
  ADD: 'Adds the A operand to the B operand.',
  SUB: 'Subtracts the A operand from the B operand.',
  MUL: 'Multiplies the B operand by the A operand.',
  DIV: 'Divides the B operand by the A operand. Division by zero kills the process.',
  MOD: 'Remainder of B divided by A. Division by zero kills the process.',
  JMP: 'Jumps to the A operand.',
  JMZ: 'Jumps to the A operand if the B operand is zero.',
  JMN: 'Jumps to the A operand if the B operand is not zero.',
  DJN: 'Decrements the B operand, jumps to A unless it became zero. The usual loop counter.',
  SPL: 'Starts a new process at the A operand. Both processes take turns.',
  CMP: 'Same as SEQ: skips the next instruction if A and B are equal.',
  SEQ: 'Skips the next instruction if A and B are equal. Scanners use it to find code.',
  SNE: 'Skips the next instruction if A and B are not equal.',
  SLT: 'Skips the next instruction if A is less than B.',
  NOP: 'Does nothing.',
  LDP: 'Loads a value from private storage (p-space) that survives between rounds.',
  STP: 'Stores a value into private storage (p-space) that survives between rounds.',
};

export const MODE_DOCS = {
  '#': 'immediate: the number itself',
  '$': 'direct: the cell at this offset',
  '@': 'indirect: the offset is in the B-field of the pointed-to cell',
  '<': 'like @, but that B-field is decremented first',
  '>': 'like @, but that B-field is incremented afterwards',
  '*': 'indirect: the offset is in the A-field of the pointed-to cell',
  '{': 'like *, but that A-field is decremented first',
  '}': 'like *, but that A-field is incremented afterwards',
};

const FIELDS = {
  A: ['the A-field of', 'the A-field of'],
  B: ['the B-field of', 'the B-field of'],
  AB: ['the A-field of', 'the B-field of'],
  BA: ['the B-field of', 'the A-field of'],
  F: ['both fields of', 'both fields of'],
  X: ['both fields of', 'the swapped fields of'],
  I: ['the whole instruction at', 'the cell'],
};

const META_WROTE = 1 << 16;
const META_JUMPED = 1 << 17;
const META_DIED = 1 << 18;
const META_SKIPPED = 1 << 19;

export const pad4 = (a) => String(a).padStart(4, '0');

function distance(a, b, n) {
  const d = Math.abs(a - b);
  return Math.min(d, n - d);
}

// One entry of the trace of the engine's watch (`watch().trace`) as an
// object: 4 numbers per entry (pc, A pointer, B pointer, meta), instruction
// t at entry t % entries.
export function traceEntry(trace, t) {
  const k = 4 * (t % (trace.length / 4));
  const meta = trace[k + 3];
  const opByte = (meta >> 8) & 0xff;
  return {
    time: t,
    pc: trace[k],
    a: trace[k + 1],
    b: trace[k + 2],
    warrior: meta & 0xff,
    op: opByte >> 3,
    mod: opByte & 7,
    wrote: !!(meta & META_WROTE),
    jumped: !!(meta & META_JUMPED),
    died: !!(meta & META_DIED),
    skipped: !!(meta & META_SKIPPED),
  };
}

// Describes the operand `which` ('a' or 'b') of the instruction at e.pc.
function operandText(m, e, which, mode, value) {
  const n = m.coreSize;
  const target = which === 'a' ? e.a : e.b;
  const v = value > n / 2 ? value - n : value;
  const sym = MODE_SYMBOLS[mode];
  if (sym === '#') return { short: `the number ${v}`, how: '' };
  const cell = `cell ${pad4(target)}${target === e.pc ? ' (itself)' : ''}`;
  if (sym === '$') return { short: cell, how: '' };
  const ptr = (e.pc + value) % n;
  const field = '@<>'.includes(sym) ? 'B' : 'A';
  const change = '<{'.includes(sym) ? ', decremented first' : '>}'.includes(sym) ? ', incremented afterwards' : '';
  return { short: cell, how: `${which.toUpperCase()} is ${sym}${v}: the ${field}-field of cell ${pad4(ptr)} holds the offset${change}.` };
}

// Explains the trace entry `e` in one or two sentences. Uses the current core
// for the instruction text, which may have changed since it ran.
export function explainStep(m, e) {
  const ins = m.cell(e.pc);
  const name = OPCODES[e.op];
  const mod = MODIFIERS[e.mod];
  const A = operandText(m, e, 'a', ins.aMode, ins.aVal);
  const B = operandText(m, e, 'b', ins.bMode, ins.bVal);
  const [fa, fb] = FIELDS[mod];
  let what;
  switch (e.op) {
    case OP.DAT: what = 'Executes data: this process dies.'; break;
    case OP.MOV:
      what = mod === 'I' ? `Copies the whole instruction at ${A.short} to ${B.short}.` : `Copies ${fa} ${A.short} into ${fb} ${B.short}.`;
      break;
    case OP.ADD: case OP.SUB: case OP.MUL: case OP.DIV: case OP.MOD: {
      const verb = { [OP.ADD]: 'Adds', [OP.SUB]: 'Subtracts', [OP.MUL]: 'Multiplies', [OP.DIV]: 'Divides', [OP.MOD]: 'Takes the remainder of' }[e.op];
      what = `${verb} ${fa} ${A.short} ${e.op === OP.ADD ? 'to' : e.op === OP.SUB ? 'from' : 'and'} ${fb} ${B.short}.`;
      break;
    }
    case OP.JMP: what = `Jumps to ${A.short}.`; break;
    case OP.JMZ: case OP.JMN:
      what = `Jumps to ${A.short} if ${fb} ${B.short} ${e.op === OP.JMZ ? 'is zero' : 'is not zero'}: ${e.jumped ? 'it jumped.' : 'no jump.'}`;
      break;
    case OP.DJN: what = `Decrements ${fb} ${B.short} and jumps to ${A.short} unless it became zero: ${e.jumped ? 'it jumped.' : 'loop finished.'}`; break;
    case OP.SPL: what = e.jumped ? `Starts a new process at ${A.short}, this one continues below.` : 'Wanted to start a new process, but the process limit is reached.'; break;
    case OP.CMP: case OP.SEQ: case OP.SNE: case OP.SLT: {
      const rel = e.op === OP.SNE ? 'differ' : e.op === OP.SLT ? 'A is smaller' : 'they are equal';
      what = `Compares ${fa} ${A.short} with ${B.short}, skips the next instruction if ${rel}: ${e.skipped ? 'skipped.' : 'no skip.'}`;
      break;
    }
    case OP.NOP: what = 'Does nothing.'; break;
    case OP.LDP: what = `Loads from p-space into ${B.short}.`; break;
    case OP.STP: what = 'Stores into p-space.'; break;
    default: what = '';
  }
  if (e.died && e.op !== OP.DAT) what += ' Division by zero: this process dies.';
  return {
    instruction: formatInstruction(ins.op, ins.mod, ins.aMode, ins.aVal, ins.bMode, ins.bVal, m.coreSize),
    what,
    how: [A.how, B.how].filter(Boolean).join(' '),
    doc: OPCODE_DOCS[name],
  };
}

// ------------------------------------------------------------ activity mix

export const ACTIVITIES = ['bomb', 'clear', 'copy', 'scan', 'split', 'imp', 'loop'];
export const ACTIVITY_LABELS = {
  bomb: 'bombing',
  clear: 'clearing',
  copy: 'copying itself',
  scan: 'scanning',
  split: 'splitting',
  imp: 'imp crawling',
  loop: 'looping',
};
export const ACTIVITY_SENTENCES = {
  bomb: 'drops bombs on cells far away from its code',
  clear: 'wipes the core cell by cell',
  copy: 'copies its own code to a new place',
  scan: 'compares far-away cells to find enemy code',
  split: 'creates new processes',
  imp: 'moves through the core one cell per step',
  loop: 'runs its own loop: counters, pointers, jumps',
};
const ACT = Object.fromEntries(ACTIVITIES.map((a, i) => [a, i]));

// Keeps a decaying activity histogram per warrior.
export class ActivityTracker {
  constructor(warriors, coreSize) {
    this.n = coreSize;
    // "far away" from the executing cell; scaled down for small cores
    this.far = Math.max(2, Math.min(16, Math.floor(coreSize / 40)));
    this.mix = Array.from({ length: warriors }, () => new Float64Array(ACTIVITIES.length));
    this.lastBomb = new Int32Array(warriors).fill(-100);
    this.lastSource = new Int32Array(warriors).fill(-1);
  }

  // cells: { op, origin }, the engine's core().op and watch().origin.
  classify(cells, e) {
    const n = this.n;
    const FAR = this.far;
    if (e.op === OP.SPL) return ACT.split;
    if (e.wrote) {
      const db = distance(e.b, e.pc, n);
      if (e.op === OP.MOV) {
        if (e.mod === 6 && e.a === e.pc && db === 1) return ACT.imp;
        if (db > FAR) {
          const near = distance(e.b, this.lastBomb[e.warrior], n) <= 2;
          this.lastBomb[e.warrior] = e.b;
          // Copying moves through the source, bombing reuses one source cell.
          const sameSource = e.a === this.lastSource[e.warrior];
          this.lastSource[e.warrior] = e.a;
          const isDat = cells.op[e.b] >> 3 === OP.DAT;
          const org = cells.origin[e.a];
          const ownCode = org >= 0 && (org >> 16) === e.warrior && distance(e.a, e.pc, n) <= 100;
          if (e.mod === 6 && !isDat && ownCode && !sameSource) return ACT.copy;
          return near ? ACT.clear : ACT.bomb;
        }
        return ACT.loop;
      }
      if (db > FAR && e.op !== OP.DJN) {
        const near = distance(e.b, this.lastBomb[e.warrior], n) <= 2;
        this.lastBomb[e.warrior] = e.b;
        return near ? ACT.clear : ACT.bomb;
      }
      return ACT.loop;
    }
    if (e.op === OP.CMP || e.op === OP.SEQ || e.op === OP.SNE || e.op === OP.SLT || e.op === OP.JMZ || e.op === OP.JMN) {
      if (distance(e.a, e.pc, n) > FAR || distance(e.b, e.pc, n) > FAR) return ACT.scan;
    }
    return ACT.loop;
  }

  add(cells, e) {
    if (e.died || e.warrior >= this.mix.length) return;
    this.mix[e.warrior][this.classify(cells, e)] += 1;
  }

  decay(f) {
    for (const row of this.mix) for (let i = 0; i < row.length; i++) row[i] *= f;
  }

  // [{ activity, share }] sorted, shares sum to 1
  shares(w) {
    const row = this.mix[w];
    const total = row.reduce((a, b) => a + b, 0);
    if (total < 1e-6) return [];
    return ACTIVITIES.map((a, i) => ({ activity: a, share: row[i] / total })).sort((x, y) => y.share - x.share);
  }

  // The dominant activity ignoring plain loop overhead, or null.
  stance(w) {
    const s = this.shares(w).filter((x) => x.activity !== 'loop');
    const total = s.reduce((a, b) => a + b.share, 0);
    if (!s.length || total < 0.08) return this.shares(w).length ? 'loop' : null;
    return s[0].share / total > 0.5 ? s[0].activity : null;
  }
}
