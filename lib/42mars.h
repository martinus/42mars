// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// 42mars: a Redcode assembler and MARS simulator with the results of pMARS
// 0.9.5, instruction counts and final cores included. C11, no global state,
// no allocation unless asked for. From 1.0.0 on the interface changes only
// in a compatible way within 1.x, with two exceptions stated where they
// apply: the layout of m42_cell (M42_CELL_LAYOUT) and the text of
// m42_warrior_statement().
//
// Build: compile lib/42mars.c together with your program, e.g.
//   cc -O2 -Ilib -o example examples/example.c lib/42mars.c
//   cl /O2 /std:c11 /Ilib examples\example.c lib\42mars.c
// or link the library that `make install` installs (pkg-config 42mars). C11;
// gcc, clang and MSVC (lib/src/platform.h has what differs). Defines:
//   M42_NO_LIBC        no <stdlib.h>: leaves out m42_new, m42_free,
//                      m42_assemble_new and m42_warrior_free
//   M42_FIXED_CONTEXT  one context with static storage, at a fixed address:
//                      m42_ctx_init() always returns it, and the memory
//                      given is its heap. The WebAssembly build uses it; a
//                      context through a pointer is 4 to 6% slower in
//                      WebAssembly, 1 to 3% natively (#53).
//   M42_DLL            Windows: export the functions from a DLL that is built
//                      without lib/42mars.def (build-msvc.bat uses that).
//
// Use:
//   m42_rules r = m42_rules_94();
//   m42_warrior *w[2];
//   w[0] = m42_assemble_new(src0, len0, &r, 0, 0, &status);   // check m42_warrior_ok()
//   w[1] = m42_assemble_new(src1, len1, &r, 0, 0, &status);
//   m42_ctx *m = m42_new(&r, &status);
//   m42_match_options o = m42_match_options_default();
//   o.rounds = 100;
//   m42_score s[2];
//   m42_match(m, (const m42_warrior *const *)w, 2, &o, s, &instructions);
//   m42_free(m); m42_warrior_free(w[0]); m42_warrior_free(w[1]);
//
// Every function that can fail returns an m42_status (0 is success) or a
// pointer that is 0 on failure with the status in *status. Texts are copied
// into caller buffers. The behavior is specified in
// docs/redcode-semantics.md.
//
// Threads: a context is used by one thread at a time; different contexts
// are independent. An m42_warrior is never written after it was made and
// can be shared between threads, also by contexts that run at the same time.

#ifndef M42_H
#define M42_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Every function is M42_API: the exports of the Windows DLL. build-msvc.bat
// lists them in lib/42mars.def instead; M42_DLL exports them for a DLL
// built without it. A program that uses the DLL needs nothing defined.
#if defined(_WIN32) && defined(M42_DLL)
#define M42_API __declspec(dllexport)
#else
#define M42_API
#endif

// The version of the library, of the command line program and of the npm
// package (package.json); a release is tagged v<major>.<minor>.<patch>.
#define M42_VERSION_MAJOR 0
#define M42_VERSION_MINOR 9
#define M42_VERSION_PATCH 0

// "0.1.0": the three numbers above.
M42_API const char *m42_version(void);

typedef enum {
  M42_OK = 0,
  M42_ERR_MEMORY = -1,   // the memory given is too small, or malloc failed
  M42_ERR_RULES = -2,    // a rule is out of range, see m42_rules
  M42_ERR_ARGUMENT = -3, // a null pointer, a count of 0, a bad index
  M42_ERR_WARRIOR = -4,  // a warrior that did not assemble, or is too long
  M42_ERR_STATE = -5,    // the context is not in the state the call needs
} m42_status;

// A short English text for a status, e.g. "memory too small".
M42_API const char *m42_status_text(int status);

// ---------------------------------------------------------------- rules

// The rules of a match, as pMARS's command line has them. `size` is
// sizeof(m42_rules) and lets the struct grow; m42_rules_94() fills it in.
typedef struct {
  uint32_t size;
  uint32_t core_size;     // 1 .. 65536                         (pmars -s)
  uint32_t max_cycles;    // per warrior and round               (pmars -c)
  uint32_t max_processes; // per warrior, 0 .. 2^24              (pmars -p)
  uint32_t max_length;    // instructions per warrior            (pmars -l)
  uint32_t min_distance;  // between the warriors' first cells   (pmars -d)
  uint32_t pspace_size;   // 0: core_size / 16, at most 2^24     (pmars -S)
  uint32_t read_limit;    // 0: core_size, else a divisor of it   (pmars -R)
  uint32_t write_limit;   // 0: core_size, else a divisor of it   (pmars -W)
  uint32_t rounds;        // the assembler's ROUNDS              (pmars -r)
  uint32_t warriors;      // most warriors per match, 1 .. 255; the assembler's WARRIORS
} m42_rules;

// pMARS's defaults: core 8000, 80000 cycles, 8000 processes, length 100,
// distance 100, p-space 500, 1 round, 2 warriors.
M42_API m42_rules m42_rules_94(void);

// ---------------------------------------------------------------- warriors

typedef struct m42_warrior m42_warrior;

// One instruction: opcode 0..18 (MOV ADD SUB MUL DIV MOD JMZ JMN DJN CMP SLT
// SPL DAT JMP SEQ SNE NOP LDP STP), modifier 0..6 (A B AB BA F X I), modes
// 0..7 (# $ @ < > * { }), values 0 .. core_size-1, and the source line it
// came from (1-based physical line).
typedef struct {
  uint8_t opcode, modifier, a_mode, b_mode;
  uint32_t a, b;
  int32_t line;
} m42_instruction;

#define M42_UTF8 1u   // m42_assemble flag: the source is UTF-8, not Latin-1
#define M42_ICWS88 2u // m42_assemble flag: ICWS'88 only (pmars -8): its opcodes and
                      // modes, no modifiers, ORG or PIN; the code runs the same

// Assembles `len` bytes of Redcode with the predefined constants of `rules`
// (CORESIZE, MAXLENGTH, ...; only core_size >= 1 is checked). `mem` is working memory of `size` bytes; the
// warrior lives in it until the memory is reused. Returns M42_OK when the
// assembler ran, also if the source has errors (m42_warrior_ok() says), and
// M42_ERR_MEMORY when `size` was too small: try again with more, about 64
// times the source length is usually enough. The work is bounded: past
// 1,000,000 lines and FOR repetitions, or 64 MB of memory after reading the
// source, the assembly ends with an error (docs/redcode-semantics.md,
// section 4). 128 MB plus 64 bytes per source byte held every source
// measured, and m42_assemble_new() tries no more. m42_warrior_pack() copies a
// warrior into a block of its own size. `registers`: 0 (all 0), or the
// values of the registers a..z (registers[0] is a) to start with: pMARS
// assembles its first warrior with the registers its score formula check
// left, w and s the number of warriors with the default formula, and the
// others with all 0 (docs/redcode-semantics.md, section 5).
M42_API int m42_assemble(const char *src, size_t len, const m42_rules *rules, unsigned flags,
                 const int64_t registers[26], void *mem, size_t size, m42_warrior **out);

// 1 when the warrior assembled without errors.
M42_API int m42_warrior_ok(const m42_warrior *w);
M42_API uint32_t m42_warrior_length(const m42_warrior *w); // 0 when not ok
M42_API uint32_t m42_warrior_start(const m42_warrior *w);  // ORG / END offset
// The bytes of the source the assembler read: up to the start of a second
// ;redcode line, else all of it (0 for m42_warrior_make()). pMARS reads
// several warriors from one stream (`-` for stdin): the next one starts there.
M42_API size_t m42_warrior_source_end(const m42_warrior *w);
// 1 and *pin when the warrior has a PIN, else 0.
M42_API int m42_warrior_pin(const m42_warrior *w, int64_t *pin);
// The instructions, m42_warrior_length() of them.
M42_API const m42_instruction *m42_warrior_code(const m42_warrior *w);

// A warrior from instructions instead of source (e.g. from an evolver):
// ok, no texts or messages. pin may be 0. m42_warrior_make_size() bytes of
// `mem` hold it; 0 when `size` is too small or an argument is invalid.
M42_API size_t m42_warrior_make_size(uint32_t length);
M42_API m42_warrior *m42_warrior_make(const m42_instruction *code, uint32_t length, uint32_t start, const int64_t *pin,
                              void *mem, size_t size);

typedef enum { M42_NAME, M42_AUTHOR, M42_DATE, M42_VERSION_TEXT, M42_STRATEGY } m42_text;
// Copies a text with a terminating 0 into buf (at most n bytes, cut if
// needed) and returns its full length, like snprintf. Defaults: name
// "Unknown", author "Anonymous", others "". Strategy lines are joined by \n.
M42_API size_t m42_warrior_text(const m42_warrior *w, m42_text which, char *buf, size_t n);

// Messages: m42_warrior_errors() errors, then m42_warrior_warnings()
// warnings. m42_warrior_message() copies message i (errors first) like
// m42_warrior_text(), sets *line (0: not tied to a line) and *is_error.
M42_API uint32_t m42_warrior_errors(const m42_warrior *w);
M42_API uint32_t m42_warrior_warnings(const m42_warrior *w);
M42_API size_t m42_warrior_message(const m42_warrior *w, uint32_t i, int32_t *line, int *is_error, char *buf, size_t n);

// The statements after EQU, FOR and label expansion, one per instruction or
// pseudo-op, as text (a debugging aid; the format may change).
M42_API uint32_t m42_warrior_statements(const m42_warrior *w);
M42_API size_t m42_warrior_statement(const m42_warrior *w, uint32_t i, char *buf, size_t n);

// Evaluates one Redcode expression (with fresh registers a..z) into *value.
typedef enum { M42_EVAL_OK = 0, M42_EVAL_OVERFLOW = 1, M42_EVAL_BAD = -1, M42_EVAL_DIV_ZERO = -2 } m42_eval_status;
M42_API int m42_evaluate(const char *text, size_t len, int64_t *value);
// The same with the caller's registers a..z (registers[0] is a), which the
// expression reads and may assign, e.g. a score formula over w and s.
M42_API int m42_evaluate_registers(const char *text, size_t len, int64_t registers[26], int64_t *value);

// The bytes a packed copy of w needs, and the copy: the result lives in
// `dst` alone. Returns 0 when `size` is too small.
M42_API size_t m42_warrior_packed_size(const m42_warrior *w);
M42_API m42_warrior *m42_warrior_pack(const m42_warrior *w, void *dst, size_t size);

#ifndef M42_NO_LIBC
// m42_assemble() with malloc: a packed warrior, 0 when malloc failed (*status).
M42_API m42_warrior *m42_assemble_new(const char *src, size_t len, const m42_rules *rules, unsigned flags,
                                      const int64_t registers[26], int *status);
M42_API void m42_warrior_free(m42_warrior *w);
#endif

// ---------------------------------------------------------------- contexts

typedef struct m42_ctx m42_ctx;

// Bytes for a context that plays matches of up to rules->warriors warriors
// of up to rules->max_length instructions with these rules. With
// M42_FIXED_CONTEXT, the context itself is static and this is its heap.
M42_API size_t m42_ctx_size(const m42_rules *rules);
// A context in caller memory (any alignment). 0 on failure, *status says why.
M42_API m42_ctx *m42_ctx_init(void *mem, size_t size, const m42_rules *rules, int *status);
#ifndef M42_NO_LIBC
M42_API m42_ctx *m42_new(const m42_rules *rules, int *status);
M42_API void m42_free(m42_ctx *m);
#endif

// ---------------------------------------------------------------- matches

typedef struct {
  uint32_t size;              // sizeof(m42_match_options)
  uint32_t rounds;            // rounds to play
  uint32_t first_round;       // play rounds first_round+1 .. first_round+rounds of the match
  uint32_t early_tie;         // 1: stop rounds that must end in a tie early (same scores)
  int64_t seed;               // position generator state, >= 0 (two warriors: seed =
                              // pmars -F position - min_distance; with permute,
                              // 2 * (position - min_distance))
  const uint32_t *positions;  // 0: from the seed; else fixed, one per warrior, each
                              // below core_size (else M42_ERR_ARGUMENT); warriors may
                              // overlap or be closer than min_distance
  uint8_t *log;               // 0, or m42_log_size() bytes for the round results of m42_match
  uint32_t permute;           // 1: pmars -P, every position and first mover once before
                              // any repeats; two warriors, no fixed positions
  uint32_t *pspace;           // 0: p-space and last results start as in a new match;
                              // else per warrior max(1, p-space size) cells, cell 0 the
                              // last result: read before the first round, written after
                              // the last (to play a match in blocks, also with LDP);
                              // each value below core_size, else M42_ERR_ARGUMENT
} m42_match_options;

// 1 round, first_round 0, early ties on, seed 0, no fixed positions, no log,
// no permutation, no p-space given.
M42_API m42_match_options m42_match_options_default(void);

// The round log of m42_match: one record of m42_log_stride(warriors) bytes
// per round, the instructions the round ran (uint64_t, native byte order),
// then one byte per warrior, 1 when it was alive at the end.
M42_API uint32_t m42_log_stride(uint32_t warriors);
M42_API size_t m42_log_size(uint32_t warriors, uint32_t rounds);

typedef struct {
  uint32_t wins, losses, ties;
} m42_score;

// Plays a match. scores: n entries; instructions: executed instructions,
// may be 0. P-space starts empty (also with first_round > 0), unless
// options->pspace gives it. Each warrior
// must be ok, at most max_length long and fit the rules: every field in the
// range of m42_instruction for core_size, the start below core_size (a
// warrior assembled for another core size may not). Else M42_ERR_WARRIOR,
// also from m42_bench() and m42_load().
M42_API int m42_match(m42_ctx *m, const m42_warrior *const *warriors, uint32_t n, const m42_match_options *options,
              m42_score *scores, uint64_t *instructions);

// One warrior against each of n opponents, a two-warrior match each with
// the same options: scores[2 * i] for `w`, scores[2 * i + 1] for opponent i.
M42_API int m42_bench(m42_ctx *m, const m42_warrior *w, const m42_warrior *const *opponents, uint32_t n,
              const m42_match_options *options, m42_score *scores, uint64_t *instructions);

// ---------------------------------------------------------------- stepping

// For visualizers and debuggers: load warriors (only options->seed and
// ->positions are used), then start rounds and run them in steps.
M42_API int m42_load(m42_ctx *m, const m42_warrior *const *warriors, uint32_t n, const m42_match_options *options);
M42_API int m42_start_round(m42_ctx *m);
// Runs up to `count` instructions of the round (at least 1); returns how
// many ran. Stops at the end of the round.
M42_API uint64_t m42_run(m42_ctx *m, uint64_t count);
// Ends the round now and scores it as if it had run out of cycles.
M42_API int m42_end_round(m42_ctx *m);

typedef struct {
  uint32_t round;          // rounds started
  uint32_t round_over;     // 1 between rounds
  uint32_t current;        // the warrior to move next
  uint32_t warriors_left;
  uint64_t time;           // instructions executed in this round
  int64_t cycles_left;
} m42_state;
// The getters take sizeof of the struct: the library writes at most `size`
// bytes, so a newer library fills the shorter struct of an older caller. A
// size below the struct of version 1.0 is M42_ERR_ARGUMENT.
M42_API int m42_get_state(const m42_ctx *m, m42_state *s, size_t size);

typedef struct {
  uint32_t alive;
  uint32_t processes;
  uint32_t position;    // the warrior's first cell this round
  uint32_t last_result; // p-space cell 0
  int64_t died_at;      // -1 while alive
  m42_score score;
} m42_warrior_state;
M42_API int m42_get_warrior(const m42_ctx *m, uint32_t w, m42_warrior_state *s, size_t size);

// pMARS's score counters of warrior w, 2 * warriors - 1 of them: counter k
// < warriors counts the rounds it survived with k + 1 warriors alive at the
// end, counter warriors - 1 + k the rounds it died when k + 1 were left.
// Copies up to `max` and returns the count.
M42_API uint32_t m42_get_scores(const m42_ctx *m, uint32_t w, uint32_t *out, uint32_t max);

// Copies cells first .. first + count - 1 of the core, around its end, as
// instructions (line 0) and returns how many it copied: at most core_size,
// 0 when first is not below core_size. The stable way to read the core.
M42_API uint32_t m42_cells(const m42_ctx *m, uint32_t first, uint32_t count, m42_instruction *out);

// The engine's own cells, without a copy, for visualizers. The layout of
// m42_cell may change in a minor version; M42_CELL_LAYOUT names it, so that
// a program can refuse to build against another one. Layout 1: values, and
// the instruction word: opcode << 3 | modifier in bits 0..7, A mode in bits
// 8..10, B mode in bits 11..13.
#define M42_CELL_LAYOUT 1
typedef struct {
  uint16_t a, b, word, pad;
} m42_cell;
// The core, core_size cells, valid until the next call on m.
M42_API const m42_cell *m42_core(const m42_ctx *m);

// Copies up to `max` queued addresses of warrior w, the next one to run
// first; returns the number of processes.
M42_API uint32_t m42_queue(const m42_ctx *m, uint32_t w, uint32_t *out, uint32_t max);

// P-space cell i of warrior w (cell 0 is the last result), e.g. to carry it
// from one m42_load() to the next. Warriors with the same PIN share cells
// 1 and up. A value to set must be below core_size, as every value a
// warrior can store (else M42_ERR_ARGUMENT).
M42_API int m42_pspace_get(const m42_ctx *m, uint32_t w, uint32_t i, uint32_t *value);
M42_API int m42_pspace_set(m42_ctx *m, uint32_t w, uint32_t i, uint32_t value);

// ---------------------------------------------------------------- watching

// What a visualizer shows besides the core: who wrote, read and executed
// each cell and when, the last instructions, the processes that died. With a
// watch attached, m42_start_round() resets it and m42_run() records into it,
// one instruction at a time and slower than without; m42_match() and
// m42_bench() do not record. docs/redcode-semantics.md, 3.7 ("The watch").
//
// Times are the instruction's number in the round, the first is 1, mod
// 2^32; 0 is never. The per-cell arrays owner, exec_by and read_by hold a
// warrior as index + 1, 0 for none; everywhere else a warrior is its index.

// Both are compiled into the caller and stay the same in all of 1.x.
#define M42_TRACE_SIZE 4096 // instructions in the trace, a power of two
#define M42_DEATH_SIZE 1024 // process deaths kept, a power of two

// The trace flags in m42_trace_entry.meta, above the warrior (bits 0..7)
// and the op byte, opcode << 3 | modifier (bits 8..15).
#define M42_TRACE_STORED 0x10000u      // step 4 stored something at the B pointer
#define M42_TRACE_NEW_PROCESS 0x20000u // a jump to, or SPL of, the A pointer
#define M42_TRACE_DIED 0x40000u        // the process died
#define M42_TRACE_SKIPPED 0x80000u     // the next instruction was skipped

typedef struct {
  uint32_t pc, a, b; // the instruction's address, the A pointer, the B pointer (where B writes)
  uint32_t meta;     // warrior | op byte << 8 | M42_TRACE_* flags
} m42_trace_entry;

typedef struct {
  uint32_t addr, warrior, time;
  uint32_t last; // 1: it was the warrior's last process, the warrior is out
} m42_death;

// The header of a watch, in the memory given to m42_watch_attach(); the
// arrays follow it. Pointers and sizes stay fixed while it is attached, the
// arrays and `deaths` change with every m42_run().
typedef struct {
  uint32_t core_size, warriors; // of the rules the watch was made for
  uint32_t code_stride;         // max_length of those rules
  uint32_t pad;
  uint64_t deaths;              // process deaths this round; death k is death[k % M42_DEATH_SIZE]
                                // (a warrior's end also shows in m42_get_warrior())
  // per cell
  uint8_t *owner;               // the last warrior that stored anything in the cell
  uint8_t *exec_by, *read_by;   // the last warrior that executed it, read it
  int8_t *bump;                 // the last store: +1 an increment of > or }, -1 a
                                // decrement of < or {, 0 a store of the instruction
  int32_t *origin;              // warrior << 16 | instruction of the warrior's code that
                                // this cell is a copy of (MOV.I copies it), -1 none
  uint32_t *t_write, *t_read, *t_exec;
  // per warrior
  uint32_t *territory;          // cells it owns (owner); its code length at round start
  uint32_t *exec_count;         // executions of copies of each instruction of warrior w's
                                // code, by anyone: exec_count[w * code_stride + i]
  m42_trace_entry *trace;       // instruction t of the round at trace[t % M42_TRACE_SIZE]
  m42_death *death;
} m42_watch;

// Bytes for a watch that fits every match of these rules; 0 when a rule is
// out of range, also max_length above 65536 (origin has 16 bits for it).
M42_API size_t m42_watch_size(const m42_rules *rules);
// Attaches a watch in caller memory (any alignment) to m, made for m's
// rules, and returns its header; 0 on failure, *status says why, and m has
// no watch then. Attach it before m42_start_round(). mem 0 detaches the
// watch and returns 0 with M42_OK.
M42_API const m42_watch *m42_watch_attach(m42_ctx *m, void *mem, size_t size, int *status);

#ifdef __cplusplus
}
#endif

#endif
