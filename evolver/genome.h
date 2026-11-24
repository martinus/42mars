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
#include "generator.h"
#include "rng.h"

#define GENOME_MAX 256 // most instructions; the rules may allow fewer
#define GENOME_OPCODES 17 // MOV .. NOP; no LDP and STP ('94 without p-space)

typedef struct {
  uint8_t op, mod, am, bm; // opcode 0..16, modifier 0..6, modes 0..7 (as m42_instruction)
  uint8_t aref, bref;      // 1: a (b) is the index of an instruction of the genome
  uint16_t pad;
  uint32_t a, b; // an index below len when a reference, else a value below the core size
} gene;

// With `generated` 1 the genome is the generator p (generator.h,
// docs/evolver-gen.md), and the list is the warrior it writes, all operands
// values: genome_code(), genome_hash() and genome_text() are those of the
// warrior, genome_breed() changes the generator (gen-change.h), and
// genome_save() and genome_load() keep it. The other functions here are
// those of a list and leave `generated` 0.
typedef struct {
  uint32_t len, start; // 1 .. GENOME_MAX instructions; start is an index (ORG)
  gene g[GENOME_MAX];
  uint32_t generated;
  gen p;
} genome;

// How new instructions and values are drawn. `fraction`: the probability
// that a far value is a fraction of the core give or take 20 instead of any
// value (--fractions). op, mod, mode: weights of the opcodes, modifiers and
// modes (--prior); all 0 means uniform, which draws exactly as before the
// weights existed. A null style is all 0.
typedef struct {
  double fraction;
  uint32_t op[GENOME_OPCODES], mod[7], mode[8];
} genome_style;

// A random genome of len instructions.
void genome_random(genome *x, rng *r, uint32_t core_size, uint32_t len, const genome_style *style);

// The instructions of the warrior: references become offsets mod core_size.
void genome_code(const genome *x, uint32_t core_size, m42_instruction *out);

// A genome from a warrior's instructions (len 1 .. GENOME_MAX, start below
// len): an operand that is not immediate (#) and points at an instruction of
// the warrior becomes a reference to it, the others stay values. genome_code()
// gives the same instructions back.
void genome_from_code(genome *x, const m42_instruction *code, uint32_t len, uint32_t start, uint32_t core_size);

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
                    rng *r, const genome_style *style);

// The kinds of change. genome_breed() draws them by the weights of a
// genome_mix; 42spectrum makes children with exactly one of them.
enum {
  CH_OPCODE, CH_MODIFIER, CH_AMODE, CH_BMODE, CH_AOPERAND, CH_BOPERAND, CH_ORG, CH_REPLACE,
  CH_INSERT, CH_DELETE, CH_DUPLICATE, CH_MOVE, CH_XINSERT, CH_XREPLACE,
  CH_RELATED_OPCODE, // another opcode of the same family (ADD/SUB, JMZ/JMN/DJN, SEQ/SNE/CMP/SLT, ...)
  CH_RELATED_MODE,   // another mode of the same family ($ @ *, < > { }; # becomes $)
  CH_SHARED,         // a far value set to another far value of the warrior, or its negative
  CH_TUNE,           // a far value moved by up to 2% of its size (at least 4)
  CH_LOOP,           // a loop of a donor (genome_pick_loop()) copied in: from the archive or another island (#182)
  CH_COUNT,          // the kinds of a list
  // The kinds that make and change the structure of a generator
  // (gen-change.h); on a list they do not apply.
  CH_REPEAT = CH_COUNT, // units into a repeat block
  CH_REPEATS,           // the count of a repeat
  CH_FOLD,              // two instructions that differ by a step become a repeat, which goes on
  CH_UNROLL,            // a repeat becomes its repetitions, one of them changed
  CH_INDEX,             // an operand in a repeat gets a step per repetition, or another one
  CH_EXPRESSION,        // an expression: a value replaced, an operation more or less
  CH_CONSTANT,          // a far number becomes a constant that every equal or near number follows; or a constant moves
  CH_EXTRACT,           // units become a function with two calls
  CH_PARAMETER,         // a number in a function becomes an argument, and one call passes another
  CH_CALL,              // one more call of a function
  CH_INLINE,            // a call becomes the function's lines, one of them changed
  CH_TRANSPLANT,        // a call of the second parent, with its function
  CH_ALL
};
const char *genome_change_name(int kind);

// One change of the given kind. Returns 0 and leaves x as it was when the
// kind does not apply (insert at the longest length, crossover without p2,
// shared-constant with fewer than two far values, ...). CH_LOOP takes its
// loop from p2, the donor.
int genome_change(genome *x, const genome *p2, rng *r, uint32_t core_size, uint32_t max_length,
                  const genome_style *style, int kind);

// The parts of a change that the changes of a generator share
// (gen-change.c), so that both draw the same numbers: one of n choices by
// the weights w (uniform when they are all 0 or w is 0); a new instruction
// for a genome of n instructions; a changed operand, `offset` the distance a
// reference stands for (its target less its own index); the length of a
// block of up to len; the family of an opcode and of a mode (-1: none).
uint8_t genome_pick(rng *r, const uint32_t *w, uint32_t n);
uint32_t genome_far_value(rng *r, uint32_t core_size, const genome_style *style); // any value, or a fraction of the core (--fractions)
gene genome_random_gene(rng *r, uint32_t core_size, uint32_t n, const genome_style *style);
void genome_mutate_operand(rng *r, uint32_t core_size, uint32_t n, int64_t offset, const genome_style *style,
                           uint8_t *ref, uint32_t *v);
uint32_t genome_block(rng *r, uint32_t len);
uint32_t genome_tune(rng *r, uint32_t core_size, uint32_t v); // a far value moved by one step of CH_TUNE
// A loop of the warrior code[0 .. len) for CH_LOOP: an instruction i that
// jumps back (JMP, JMZ, JMN or DJN with a direct A operand) to an instruction
// t at or before it, one of them drawn, with the cells of the warrior that
// the operands of t .. i point at (not #), and theirs, until nothing more is
// added: the data the loop works through. *from and *to the first and last
// instruction. 0 (and nothing drawn) when the warrior has none.
int genome_pick_loop(const m42_instruction *code, uint32_t len, uint32_t core_size, rng *r, uint32_t *from, uint32_t *to);
int genome_opcode_family(uint8_t op);
int genome_mode_family(uint8_t m);

// The generator of x becomes its genome: p is the list line for line, a
// reference a label (gen_from_genome()), and `generated` is 1.
void genome_as_generator(genome *x);

// x is the generator p: the list is the warrior p writes, `generated` 1.
void genome_from_generator(genome *x, const gen *p, uint32_t core_size, uint32_t max_length);

// How often genome_breed() picks each kind of change: weights, any scale.
typedef struct {
  uint32_t w[CH_ALL];
} genome_mix;

// The rates before there was a mix (14th November 2026): 54% a point change
// (opcode 15%, modifier 15%, A mode 10%, B mode 10%, A operand 20%, B operand
// 20%, org 5%, replace 5% of those), insert 10%, delete 10%, duplicate 7%,
// move 7%, crossover-insert 6%, crossover-replace 6%; the four small steps 0.
genome_mix genome_mix_default(void);

// "name=weight,name=weight,..." with the names of genome_change_name(); a
// kind not named gets 0. Returns 0, or -1 for an unknown name, a weight that
// is no whole number up to 1,000,000, a name given twice or all weights 0.
int genome_mix_parse(genome_mix *m, const char *text);

// "name=weight,..." of the kinds whose weight is not 0, in CH_* order.
size_t genome_mix_text(const genome_mix *m, char *buf, size_t n);

// A child of p1 (p2: a second parent for crossover, may be 0) with 1 or more
// changes drawn by mix (0: genome_mix_default()), at most max_length
// instructions. A drawn change that does not apply is drawn again, up to 16
// times. Writes the names of the changes into ops (space separated, cut at
// ops_n).
void genome_breed(genome *child, const genome *p1, const genome *p2, rng *r, uint32_t core_size, uint32_t max_length,
                  const genome_style *style, const genome_mix *mix, char *ops, size_t ops_n);
#define GENOME_DONORS_MAX 1024 // the most donors of genome_breed_donors()
// genome_breed() with donors for CH_LOOP: warriors from elsewhere than the
// list (its archive, other islands). A CH_LOOP draws one of the n of them;
// without donors it does not apply. Nothing is drawn for them otherwise, so a
// mix without CH_LOOP breeds as genome_breed().
void genome_breed_donors(genome *child, const genome *p1, const genome *p2, const genome *const *donors, uint32_t n,
                         rng *r, uint32_t core_size, uint32_t max_length, const genome_style *style, const genome_mix *mix,
                         char *ops, size_t ops_n);

// Text form for the state file: "len start" then 8 numbers per instruction;
// of a generator "gen" and the numbers of gen_save(). GENOME_SAVE_MAX bytes
// hold any of them.
#define GENOME_SAVE_MAX (GEN_LINES * 224 + 256)
size_t genome_save(const genome *x, char *buf, size_t n);
// Reads that form; 0 on success, -1 on a malformed or out-of-range genome.
int genome_load(genome *x, const char *text, uint32_t core_size, const char **end);

#endif
