// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// A generator: a small program that writes a warrior (docs/evolver-gen.md).
// It is a list of lines: an instruction whose operands are expressions, a
// `repeat` block with a count, a function (`def`) and its calls. One change
// of a generator is a regular change of many instructions: the count of a
// block, a constant that several operands use, an argument of a call.
//
// A generator without blocks and calls, whose operands are a number or a
// label, is the list genome of genome.h, line for line.
//
// Every generator compiles: gen_compile() is bounded (GEN_STEPS, GEN_DEPTH)
// and gives 1 to max_length instructions, whatever the lines are.

#ifndef EVOLVER_GENERATOR_H
#define EVOLVER_GENERATOR_H

#include <stddef.h>
#include <stdint.h>

#include "42mars.h"

#define GEN_LINES 256  // most lines, and most instructions gen_compile() writes
#define GEN_TOKENS 7   // most tokens of an expression
#define GEN_CONSTS 16  // the constants c0 .. c15
#define GEN_DEPTH 8    // most repetitions and calls inside each other
#define GEN_STEPS 1024 // most lines written, repetitions and calls of one gen_compile()
#define GEN_OPCODES 17 // MOV .. NOP, as GENOME_OPCODES

// The kinds of line.
enum {
  GL_EMIT,   // one instruction: op, mod, am, bm, x[0] and x[1] its operands
  GL_REPEAT, // the lines up to its GL_END, x[0] times
  GL_END,    // closes a GL_REPEAT or GL_DEF
  GL_DEF,    // a function, up to its GL_END: written where it is called; top level only
  GL_CALL    // the lines of the function at line `callee`; x[0], x[1] its arguments (n 0: none)
};

// The tokens of an expression, in postfix.
enum {
  GT_NUM,   // v: a value mod the core size; stands for the one between -core/2 and core/2
  GT_CONST, // constant v
  GT_INDEX, // the repetition, from 0, of the innermost repeat running (v 0), the next one out (1), the third (2)
  GT_ARG,   // argument v (0, 1) of the call running
  GT_POS,   // the distance from this instruction to the first one of line v (of a GL_END: behind its block)
  GT_LEN,   // the number of instructions line v wrote
  GT_CORE,  // the core size
  GT_ADD,   // the two values before it: a + b
  GT_SUB,
  GT_MUL,
  GT_DIV, // towards 0; by 0: 0
  GT_MOD  // by 0: 0
};

typedef struct {
  uint8_t n, kind[GEN_TOKENS]; // n 0: no expression
  uint32_t v[GEN_TOKENS];
} gen_expr;

typedef struct {
  uint8_t kind, op, mod, am, bm; // op, mod, am, bm as the genome's gene (GL_EMIT)
  uint32_t callee;               // GL_CALL: the line of the function
  gen_expr x[2];
} gen_line;

typedef struct {
  uint32_t n, start; // 1 .. GEN_LINES lines; the warrior starts at the first instruction of line `start`
  uint32_t c[GEN_CONSTS];
  gen_line l[GEN_LINES];
} gen;

// 0 when x is well formed for a core of that size: the blocks closed, every
// def at the top level, every number, index and line in range, every
// expression complete, nothing set that its line does not use. Else -1, and
// what is wrong in err (may be 0).
int gen_check(const gen *x, uint32_t core_size, char *err, size_t err_n);

// The warrior of x: writes its instructions to out (room for max_length, at
// most GEN_LINES, of them) and where it starts to *start; returns how many, 1
// or more. *truncated (may be 0) is 1 when the generator ran out of steps or
// wanted to write more than max_length instructions; out has what it wrote
// until then. Safe for any x, also one that gen_check() refuses.
uint32_t gen_compile(const gen *x, uint32_t core_size, uint32_t max_length, m42_instruction *out, uint32_t *start,
                     int *truncated);

// The generator of a warrior's instructions (len 1 .. GEN_LINES, start below
// len), one line per instruction: an operand that is not immediate (#) and
// points at an instruction of the warrior is a GT_POS, the others a GT_NUM,
// as genome_from_code(). gen_compile() gives the instructions back.
void gen_from_code(gen *x, const m42_instruction *code, uint32_t len, uint32_t start, uint32_t core_size);

// x as text (docs/evolver-gen.md), with a terminating 0; returns the full
// length like snprintf. Lines that something refers to get a label, L<line>
// or f<line> for a def. Without an `org` line a text starts at the first
// line outside the functions, where the first instruction is written.
size_t gen_text(const gen *x, uint32_t core_size, char *buf, size_t n);

// The generator of a text. 0, or -1 with the first error and its line in err
// (may be 0); x is not usable then. What it accepts passes gen_check().
int gen_parse(gen *x, const char *text, uint32_t core_size, char *err, size_t err_n);

#endif
