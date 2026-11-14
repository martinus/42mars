// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The genome of an evolved warrior: a list of instructions whose operands
// are typed. An operand is either a reference to an instruction of the
// genome (its index) or a value mod the core size. References are resolved
// to relative offsets only when the genome becomes a warrior, so inserting,
// deleting or moving instructions keeps what every reference points at;
// raw relative offsets would change meaning with every insertion.

#ifndef EVOLVER_GENOME_H
#define EVOLVER_GENOME_H

#include <stddef.h>
#include <stdint.h>

#include "42mars.h"
#include "rng.h"

#define GENOME_MAX 256 // most instructions; the rules may allow fewer
#define GENOME_OPCODES 17 // MOV .. NOP; no LDP and STP ('94 without p-space)

typedef struct {
  uint8_t op, mod, am, bm; // opcode 0..16, modifier 0..6, modes 0..7 (as m42_instruction)
  uint8_t aref, bref;      // 1: a (b) is the index of an instruction of the genome
  uint16_t pad;
  uint32_t a, b; // an index below len when a reference, else a value below the core size
} gene;

typedef struct {
  uint32_t len, start; // 1 .. GENOME_MAX instructions; start is an index (ORG)
  gene g[GENOME_MAX];
} genome;

// `fraction`, here and below: the probability that a far value is a
// fraction of the core give or take 20 instead of any value (--fractions).

// A random genome of len instructions.
void genome_random(genome *x, rng *r, uint32_t core_size, uint32_t len, double fraction);

// The instructions of the warrior: references become offsets mod core_size.
void genome_code(const genome *x, uint32_t core_size, m42_instruction *out);

// A hash of the warrior the genome gives (its code and start): equal
// warriors have equal hashes, whatever their references.
uint64_t genome_hash(const genome *x, uint32_t core_size);

// The warrior as Redcode lines (ORG, then one instruction per line, values
// between -core_size/2 and core_size/2), with a terminating 0; returns the
// full length like snprintf.
size_t genome_text(const genome *x, uint32_t core_size, char *buf, size_t n);

// A slot of genome_rebuild(): instruction idx of genome a (A), of genome b
// (B), or a new random instruction (NEW).
enum { SLOT_A, SLOT_B, SLOT_NEW };
typedef struct {
  uint8_t src;
  uint32_t idx;
} slot;

// The child made of n slots (1 .. GENOME_MAX). References of A's
// instructions follow them to their new place; a reference to an
// instruction of A that is gone points at the next one that is left. A B
// instruction that references another copied B instruction points at the
// copy; any other reference of B becomes a reference into A (b == a, a
// duplicated block) or else the value of its offset. New instructions
// reference anything in the child. The start follows A's start.
void genome_rebuild(genome *child, const genome *a, const genome *b, const slot *s, uint32_t n, uint32_t core_size,
                    rng *r, double fraction);

// A child of p1 (p2: a second parent for crossover, may be 0) with 1 or more
// random changes, at most max_length instructions. Writes the names of the
// changes into ops (space separated, cut at ops_n).
void genome_breed(genome *child, const genome *p1, const genome *p2, rng *r, uint32_t core_size, uint32_t max_length,
                  double fraction, char *ops, size_t ops_n);

// Text form for the state file: "len start" then 8 numbers per instruction.
size_t genome_save(const genome *x, char *buf, size_t n);
// Reads that form; 0 on success, -1 on a malformed or out-of-range genome.
int genome_load(genome *x, const char *text, uint32_t core_size, const char **end);

#endif
