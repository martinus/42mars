// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The changes of a generator (generator.h, docs/evolver-gen.md).
//
// The kinds of genome.h work on generators too: on a generator without
// structure (a list genome line for line) each gives the same child as
// genome_change() gives on the list, from the same random numbers, so a run
// on such generators is the run on lists. On a generator with structure
// they work on its units: a unit is an instruction, a call, or a whole block
// (a repeat or a def with everything up to its end), and the changes that
// insert, delete, duplicate, move and cross over take runs of units of one
// block.
//
// The kinds that make structure (CH_REPEAT .. CH_CONSTANT, docs/evolver-gen.md)
// are a rewrite that leaves the warrior as it is, and one variation of what
// the rewrite made variable: 42evolve skips a child whose warrior it has
// seen, so a rewrite alone would never enter the list.
//
// No change gives a generator that is not well formed, has more instruction
// lines than max_length, writes nothing, or is truncated: such a change does
// not apply (0), like an insert at the longest length.

#ifndef EVOLVER_GEN_CHANGE_H
#define EVOLVER_GEN_CHANGE_H

#include "generator.h"
#include "genome.h"

// The generator of a list genome: one instruction line per instruction, a
// reference a label, a value a number. gen_compile() gives genome_code().
void gen_from_genome(gen *x, const genome *g);

// The child made of n lines (1 .. GEN_LINES), as genome_rebuild() makes a
// list: line idx of a (SLOT_A), of b (SLOT_B) or a new random instruction
// (SLOT_NEW). Every reference to a line of a (labels, lengths, the function
// of a call, the start) follows it to its new place; one to a line that is
// gone points at the next one left. A line of b that refers to another
// copied line of b points at the copy; any other reference of b goes into a
// when b is a, else it becomes the number it stood for in b's warrior
// (info_b: gen_compile_info() of b; may be 0 when b is a), and b's
// constants become their numbers. The constants are a's. The slots must
// keep blocks whole; the child is then well formed.
// More kinds of slot: a `repeat 1` line, an `end` line, a `def` line, and a
// call of no function yet.
enum { SLOT_REPEAT = SLOT_NEW + 1, SLOT_END, SLOT_DEF, SLOT_CALL };
void gen_rebuild(gen *child, const gen *a, const gen *b, const slot *s, uint32_t n, uint32_t core_size, rng *r,
                 const gen_info *info_b);

// The rewrites of the kinds that make structure, alone: each leaves the
// warrior as it is. 0, and x as it was, when the rewrite is not possible;
// each compiles the generator before and after, and does not apply when the
// warrior would differ.
// gen_wrap(): the lines first .. end-1, whole units of one sequence and no
// def, go into a `repeat 1`, which is line `first` then. Not with a call
// among them while a line refers to a line of a function from outside it:
// such a label means the nearest call's instance, and the block would
// change which one that is (the same for gen_unroll()).
// gen_fold(): the instructions at line and line + 1 become a `repeat 2` at
// `line` around one instruction: the same opcode, modifier and modes, each
// pair of operands two numbers (then a + i*d), the same expression, each its
// own label, or two other expressions (then the first + i*d, d from what the
// two instructions hold); nothing else may refer to the second.
// gen_unroll(): the repeat at `line`, whose count is a number from 1 to 16,
// becomes its repetitions, `i` their numbers; not when something uses the
// block's length, or its end while no instruction, repeat or call follows. *copies and *lines (may be 0): how many, and the lines of each.
// gen_bind(): the far number that is token t of operand k of `line` becomes
// constant c, which must be unused; the other far numbers that are equal to
// it, its negative, its double or within 16 of it follow as c, 0-c, c*2,
// c+d, where their expressions have the room.
// gen_fold_period(): the same for two groups of `period` instructions behind
// each other, from `first`; a label of a line of its own group stays one.
int gen_wrap(gen *x, uint32_t first, uint32_t end, uint32_t core_size);
int gen_fold(gen *x, uint32_t line, uint32_t core_size);
int gen_fold_period(gen *x, uint32_t first, uint32_t period, uint32_t core_size);
int gen_unroll(gen *x, uint32_t line, uint32_t core_size, uint32_t *copies, uint32_t *lines);
int gen_bind(gen *x, uint32_t line, int k, uint32_t t, uint32_t c, uint32_t core_size);

// The rewrites of the kinds that make and use functions.
// gen_extract(): the lines first .. end-1, whole units of one sequence and
// no def, become a function behind the last line (*def its line, may be 0)
// and a call at `first`. What the lines use of a loop around them or of the
// arguments of the function they are in becomes the new function's
// arguments: at most 2 such values.
// gen_parameter(): the number that is token t of operand k of `line`, a line
// of a function, becomes its argument j (0, 1), and every call of the
// function passes the number: so not when a line of the function uses that
// argument for something else.
// gen_inline(): the call at `line` becomes the lines of its function, the
// arguments filled in; *at and *lines (may be 0): where they are and how
// many. The function goes when this was its only call and nothing else
// refers to its lines.
int gen_extract(gen *x, uint32_t first, uint32_t end, uint32_t core_size, uint32_t *def);
int gen_parameter(gen *x, uint32_t line, int k, uint32_t t, uint32_t j, uint32_t core_size);
int gen_inline(gen *x, uint32_t line, uint32_t core_size, uint32_t *at, uint32_t *lines);

// How often gen_breed() picks each kind without a mix of its own: the
// weights of genome_mix_default(), and repeat 30, count 40, fold 30, unroll
// 15, index 40, expression 40, constant 40, extract 20, parameter 20, call
// 25, inline 10, transplant 15 (a quarter of the changes).
genome_mix gen_mix_default(void);

// Does x keep the limits of a child: no more instruction lines than
// max_length, and a warrior that is not truncated and not empty? (For a
// generator that comes from a file.)
int gen_keeps(const gen *x, uint32_t core_size, uint32_t max_length);

// One change of the given kind (CH_* of genome.h). Returns 0 and leaves x as
// it was when the kind does not apply.
int gen_change(gen *x, const gen *p2, rng *r, uint32_t core_size, uint32_t max_length, int kind);

// A child of p1 with 1 or more changes, as genome_breed(); mix 0 is
// genome_mix_default(), the changes of a list.
void gen_breed(gen *child, const gen *p1, const gen *p2, rng *r, uint32_t core_size, uint32_t max_length,
               const genome_mix *mix, char *ops, size_t ops_n);
// gen_breed() with donors for CH_LOOP, as genome_breed_donors().
void gen_breed_donors(gen *child, const gen *p1, const gen *p2, const gen *const *donors, uint32_t n, rng *r,
                      uint32_t core_size, uint32_t max_length, const genome_mix *mix, char *ops,
                      size_t ops_n);

// Text form for the state file: numbers on one line. gen_load() reads it; 0
// on success, -1 on a text that is malformed or no well-formed generator.
size_t gen_save(const gen *x, char *buf, size_t n);
int gen_load(gen *x, const char *text, uint32_t core_size, const char **end);

#endif
