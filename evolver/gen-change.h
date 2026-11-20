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
void gen_rebuild(gen *child, const gen *a, const gen *b, const slot *s, uint32_t n, uint32_t core_size, rng *r,
                 const genome_style *style, const gen_info *info_b);

// One change of the given kind (CH_* of genome.h). Returns 0 and leaves x as
// it was when the kind does not apply.
int gen_change(gen *x, const gen *p2, rng *r, uint32_t core_size, uint32_t max_length, const genome_style *style,
               int kind);

// A child of p1 with 1 or more changes, as genome_breed().
void gen_breed(gen *child, const gen *p1, const gen *p2, rng *r, uint32_t core_size, uint32_t max_length,
               const genome_style *style, const genome_mix *mix, char *ops, size_t ops_n);

// Text form for the state file: numbers on one line. gen_load() reads it; 0
// on success, -1 on a text that is malformed or no well-formed generator.
size_t gen_save(const gen *x, char *buf, size_t n);
int gen_load(gen *x, const char *text, uint32_t core_size, const char **end);

#endif
