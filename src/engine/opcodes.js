// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Opcode, modifier and addressing-mode tables. The numbering follows pMARS so
// that encoded instructions (opcode << 3 | modifier) match its memory layout.

export const OPCODES = [
  'MOV', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'JMZ',
  'JMN', 'DJN', 'CMP', 'SLT', 'SPL', 'DAT', 'JMP',
  'SEQ', 'SNE', 'NOP', 'LDP', 'STP',
];
export const PSEUDO_OPS = ['ORG', 'END', 'PIN'];

export const OP = Object.freeze(Object.fromEntries(OPCODES.map((n, i) => [n, i])));

export const MODIFIERS = ['A', 'B', 'AB', 'BA', 'F', 'X', 'I'];
export const MOD = Object.freeze(Object.fromEntries(MODIFIERS.map((n, i) => [n, i])));

// Mode index is the position of the symbol in this string.
export const MODE_SYMBOLS = '#$@<>*{}';
export const MODE = Object.freeze({
  IMMEDIATE: 0, // #
  DIRECT: 1, // $
  B_INDIRECT: 2, // @
  B_PREDEC: 3, // <
  B_POSTINC: 4, // >
  A_INDIRECT: 5, // *
  A_PREDEC: 6, // {
  A_POSTINC: 7, // }
});

// Opcode families, used by the renderer to pick tile styles.
export const FAMILY = Object.freeze({ DATA: 0, MOVE: 1, ARITH: 2, JUMP: 3, SPLIT: 4, COMPARE: 5, PSPACE: 6, NOP: 7 });
export function opcodeFamily(op) {
  switch (op) {
    case OP.DAT: return FAMILY.DATA;
    case OP.MOV: return FAMILY.MOVE;
    case OP.ADD: case OP.SUB: case OP.MUL: case OP.DIV: case OP.MOD: return FAMILY.ARITH;
    case OP.JMP: case OP.JMZ: case OP.JMN: case OP.DJN: return FAMILY.JUMP;
    case OP.SPL: return FAMILY.SPLIT;
    case OP.CMP: case OP.SEQ: case OP.SNE: case OP.SLT: return FAMILY.COMPARE;
    case OP.LDP: case OP.STP: return FAMILY.PSPACE;
    default: return FAMILY.NOP;
  }
}

export function denormalize(value, coreSize) {
  return value > coreSize / 2 ? value - coreSize : value;
}

// Compact form, e.g. "MOV.I $0, $1".
export function formatInstruction(op, mod, aMode, aVal, bMode, bVal, coreSize) {
  return `${OPCODES[op]}.${MODIFIERS[mod]} ${MODE_SYMBOLS[aMode]}${denormalize(aVal, coreSize)}, ` +
    `${MODE_SYMBOLS[bMode]}${denormalize(bVal, coreSize)}`;
}

const pad = (s, n) => (s.length >= n ? s : ' '.repeat(n - s.length) + s);
const padRight = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));

// Same layout as pMARS cellview(): "%3s%c%-2s %c%6d, %c%6d %4s".
export function formatCell(op, mod, aMode, aVal, bMode, bVal, coreSize) {
  return `${pad(OPCODES[op], 3)}.${padRight(MODIFIERS[mod], 2)} ` +
    `${MODE_SYMBOLS[aMode]}${pad(String(denormalize(aVal, coreSize)), 6)}, ` +
    `${MODE_SYMBOLS[bMode]}${pad(String(denormalize(bVal, coreSize)), 6)}     `;
}

// Same layout as the pMARS assembler listing (disasm() without -A).
export function formatListing(warrior, coreSize) {
  const out = [`Program "${warrior.name}" (length ${warrior.instructions.length}) by "${warrior.author}"`, ''];
  const n = warrior.instructions.length;
  if (warrior.start >= 0 && warrior.start < n) out.push(`${padRight('', 6)} ORG      START`);
  warrior.instructions.forEach((ins, i) => {
    out.push(`${padRight(i === warrior.start ? 'START' : '', 6)} ` +
      formatCell(ins.op, ins.mod, ins.aMode, ins.aVal, ins.bMode, ins.bVal, coreSize));
  });
  return out.join('\n') + '\n';
}
