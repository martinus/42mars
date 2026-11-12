// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Headless MARS simulator, the simulator of lib/42mars.h (api.c has the
// public functions; lib/42mars.c compiles all parts as one unit). It
// implements section 3 of docs/redcode-semantics.md: the core, the queues,
// the scores and the round results of pMARS. With a watch attached
// (end of the file) it also records the visualizer bookkeeping of 3.4 and
// 3.6.
//
// No libc: a match's memory comes from a bump allocator on the context's
// heap, which is caller memory.
//
// Data layout:
// - A core cell is 8 bytes: A value, B value (16 bits each, so the core size
//   is at most 65536), the instruction word and padding. The instruction
//   word holds opcode << 3 | modifier in bits 0..7 (the op byte), the
//   A mode in bits 8..10 and the B mode in bits 11..13. The A and B values of
//   a cell are one 32-bit load, the whole cell one 64-bit load.
// - Each warrior has its process queue as a ring buffer of 16-bit addresses
//   whose length is a power of two, indexed by free-running 32-bit head and
//   tail counters: the number of processes is tail - head. Two warriors with
//   maxCycles up to LINEAR_CYCLES get linear queues instead, long enough for
//   a whole round, so that no index needs a mask (see config()).

#include "../42mars.h"
#include "platform.h"

// ---------------------------------------------------------------- state

typedef struct {
  u16 a, b;   // field values, 0 .. N-1
  u16 ins;    // op byte | A mode << 8 | B mode << 11
  u16 pad;
} Cell;

#define EMPTY_INS ((12u << 3) | 4u | (1u << 8) | (1u << 11)) // DAT.F $0, $0

typedef struct Warrior {
  _Alignas(128) u32 head; // the struct's alignment
  u32 tail;       // free-running queue counters; tasks = tail - head
  u16 *q;         // ring buffer, qmask + 1 entries
  u32 next;       // execution order: next living warrior
  struct Warrior *nextW; // the same as a pointer: execute() follows it, an
                         // index would put an address computation on the
                         // loop-carried path
  u32 alive;
  u32 position;
  u32 lastResult;
  u32 *pspace;    // pSpaceSize cells, shared between warriors with the same PIN
  u32 *score;     // 2 * nw - 1 counters
  u32 wins, losses, ties;
  i64 diedAt;     // -1: alive
  u32 len, start; // code length and start offset
  Cell *code;     // the warrior's instructions
} Warrior;
_Static_assert(sizeof(Warrior) == 128, "a power of two: indexing is a shift");

#define LINEAR_CYCLES 80000
#define QSTATIC ((2 + 2 * (LINEAR_CYCLES + 1) + 31) & ~31) // see config()

// All state of one simulator (an m42_ctx of 42mars.h). The core and the
// first two warriors' queues (when they are at most QSTATIC long) are at
// fixed addresses, outside the struct, when there is one context with
// static storage (M42_FIXED_CONTEXT, the wasm build): the loops then address
// them with constant offsets instead of base registers (+4% on the bench),
// and clang keeps them apart from each other and from the struct. A context
// in caller memory has them in the struct; CORE() and QUEUES() reach them.
typedef struct Mars {
#ifndef M42_FIXED_CONTEXT
  // The queues before the core: the other order made clang address
  // warrior 0's queue from warrior 1's with a negative offset, one more
  // add per instruction in execute2_8000().
  _Alignas(64) u16 queueMem[2][QSTATIC];
  _Alignas(64) Cell core[65536];
#endif
  u32 N;              // core size
  u32 maxProc;        // process limit per warrior
  u32 maxCycles;
  u32 minDist;
  u32 psize;          // p-space size
  u32 nw;             // number of warriors
  u32 qmask;          // queue length - 1
  u32 fixedPositions;
  u32 hasStp;         // some warrior's code contains STP
  u32 blockerAt;      // where core_has_blocker() found one last time
  u32 round_, starter, current, warriorsLeft;
  u32 logStride, logRounds, logFirst; // logFirst: round_ of the entry before the first
  u8 roundOver;
  u8 loaded;          // warriors are loaded (42mars.h); in the padding behind
                      // roundOver, so that `watch` fits without making the
                      // struct longer (in wasm, 192 bytes: the core and the
                      // queues behind it stay where they are)
  i64 seed;
  i64 timeNow, cyclesLeft;
  Warrior *war;
  i32 *input;         // load area of config(), filled by load_warriors() (api.c)
  Cell *codeBase;     // all warriors' instructions
  u32 *pspaceBase;    // nw p-spaces, one per p-space group
  u8 *resultLog;      // m42_match: per round 8 bytes time (u64) then nw alive flags
  u8 *heap_top;       // bump allocator, see alloc()
  // Fields the loops do not read come last: a field in front moves the
  // offsets that execute2() uses.
  u8 *heap_start;     // the heap: caller memory, see m42_ctx_init()
  u8 *heap_end;
  m42_rules rules;    // as given to m42_ctx_init()
  u32 *perm;          // 0, or the draw list of permute (draw_permuted())
  u32 permLeft;       // its entries not drawn yet
  u32 readLimit, writeLimit; // divisors of N; below N: execute_limited()
  m42_watch *watch;   // 0, or the attached watch: m42_run() records into it
} Mars;
#if defined(M42_FIXED_CONTEXT) && defined(__wasm__)
_Static_assert(sizeof(Mars) <= 192, "the core and the queues behind theMars move when it grows past 192 bytes (#74)");
#endif

// ---------------------------------------------------------------- memory

// With M42_FIXED_CONTEXT, the context is `theMars`, with static storage;
// otherwise it is in caller memory. Either way its heap is caller memory
// (m42_ctx_init()).
#ifdef M42_FIXED_CONTEXT
// The queues come first, then the core: the data layout the loops were
// tuned on. clang emits a static array where the first function uses it
// (without an initializer, at the end of the file), so the order would
// depend on the code; `used` with an initializer emits them here, in this
// order. Both stay zero-filled (.bss).
M42_USED static _Alignas(64) u16 queueMem[2][QSTATIC] = {{0}};
M42_USED static _Alignas(64) Cell coreMem[65536] = {{0}};
// 64-byte aligned: then the read-only data in front of it (strings, constants)
// moves it, and the field addresses in the loops, only when it crosses a
// multiple of 64; unaligned, a struct constant 32 bytes shorter moved them.
static _Alignas(64) Mars theMars = {.roundOver = 1};
#define CTX (&theMars)
#define CORE(m) ((void)(m), coreMem)
#define QUEUES(m) ((void)(m), queueMem)
#else
#define CORE(m) ((m)->core)
#define QUEUES(m) ((m)->queueMem)
#endif

// Whether the heap reaches `end`.
static int reserve(Mars *const m, usize end) {
  return end <= (usize)m->heap_end;
}

// Bump allocation, 64-byte aligned, zero filled. Returns 0 when out of memory.
static void *alloc(Mars *const m, usize bytes) {
  u8 *p = (u8 *)(((usize)m->heap_top + 63) & ~(usize)63);
  if (bytes > (usize)-1 - (usize)p) return 0;
  usize end = (usize)p + bytes;
  if (!reserve(m, end)) return 0;
  m->heap_top = (u8 *)end;
  for (u8 *q = p; q < (u8 *)end; q++) *q = 0;
  return p;
}

static void reset_heap(Mars *const m) {
  m->heap_top = m->heap_start;
}

// ---------------------------------------------------------------- setup

static i64 rng(i64 s) {
  i64 t = 16807 * (s % 127773) - 2836 * (s / 127773);
  return t < 0 ? t + 2147483647 : t;
}

// The queue length for a process limit: the next power of two, at most 2^30
// (the callers limit maxProcesses to 2^24).
M42_FORCE_INLINE u32 queue_len(u32 maxProcesses) {
  u32 qlen = 1;
  while (qlen < maxProcesses && qlen < 1u << 30) qlen <<= 1;
  return qlen;
}

// Linear queues: with two warriors a round runs at most max(2 * maxCycles,
// 1) instructions and the turns alternate, so each warrior gets at most
// maxCycles + 1 turns and pushes at most two entries per turn. A queue
// starts at index 0 or 1 (start_round()), so its tail stays at most
// 2 + 2 * (maxCycles + 1), and start_round() resets the counters.
// Without wraparound the mask is all ones, which execute2_8000() leaves
// out: +6% on the bench, -5% on t20 (docs/performance-log.md).
#define LINEAR_QUEUES(warriors, cycles) ((warriors) == 2 && (cycles) <= LINEAR_CYCLES)
// The (position, first mover) combinations of two warriors, permute.
#define PERMUTATIONS(n, d) (2 * ((n) + 1 - 2 * (d)))
// Warrior i's queue is one of the two static ones (QUEUES()), else allocated.
#define STATIC_QUEUE(i, linear, qlen) ((i) < 2 && ((linear) || (qlen) <= QSTATIC))

// Prepares a match. Returns the address of the load area, an i32 array:
// per warrior 4 ints (length, start, p-space group, fixed position), then all
// instructions, 5 ints each (op byte, A mode, A value, B mode, B value).
// Warriors with the same p-space group share the p-space cells; the groups
// are numbered 0 .. nw-1. Returns 0 when the memory cannot grow. The
// allocations are added up in heap_need() (api.c) for m42_ctx_size(): change
// both together.
static i32 *config(Mars *const m, u32 coreSize, u32 maxProcesses, u32 cycles, u32 minDistance, u32 pSpaceSize,
                   u32 warriors, u32 instructions) {
  m->loaded = 0;
  reset_heap(m);
  m->N = coreSize;
  m->maxProc = maxProcesses;
  m->maxCycles = cycles;
  m->minDist = minDistance;
  m->psize = pSpaceSize;
  m->nw = warriors;
  const u32 qlen = queue_len(maxProcesses);
  m->qmask = qlen - 1;
  const int linear = LINEAR_QUEUES(m->nw, cycles);
  if (linear) m->qmask = ~0u;
  m->war = alloc(m, (usize)m->nw * sizeof(Warrior));
  m->input = alloc(m, (usize)(4 * m->nw + 5 * instructions) * 4);
  if (!m->war || !m->input) return 0;
  Cell *code = alloc(m, (usize)instructions * sizeof(Cell));
  u32 *ps = alloc(m, (usize)m->nw * (m->psize ? m->psize : 1) * 4);
  u32 *scores = alloc(m, (usize)m->nw * (2 * m->nw - 1) * 4);
  if (!code || !ps || !scores) return 0;
  for (u32 i = 0; i < m->nw; i++) {
    m->war[i].q = STATIC_QUEUE(i, linear, qlen) ? QUEUES(m)[i] : alloc(m, (usize)qlen * 2);
    if (!m->war[i].q) return 0;
    m->war[i].score = scores + (usize)i * (2 * m->nw - 1);
  }
  m->codeBase = code;
  m->pspaceBase = ps;
  m->resultLog = 0;
  m->logRounds = 0;
  m->logFirst = 0;
  m->roundOver = 1;
  return m->input;
}

// Starts the match after the load area was filled. seed: the generator
// state (a non-negative integer); fixed: use the positions of the load area;
// perm: 0, or PERMUTATIONS() entries for permute (two warriors).
static void load(Mars *const m, i64 seedValue, u32 fixed, u32 *perm) {
  i32 *in = m->input;
  Cell *code = m->codeBase;
  for (u32 i = 0; i < m->nw; i++) {
    Warrior *w = &m->war[i];
    w->len = (u32)in[4 * i];
    w->start = (u32)in[4 * i + 1];
    w->pspace = m->pspaceBase + (usize)(u32)in[4 * i + 2] * m->psize;
    w->position = (u32)in[4 * i + 3];
    w->code = code;
    code += w->len;
    w->lastResult = m->N - 1;
    w->wins = w->losses = w->ties = 0;
    w->alive = 0;
    w->diedAt = -1;
    w->head = w->tail = 0;
    for (u32 k = 0; k < 2 * m->nw - 1; k++) w->score[k] = 0;
  }
  for (usize k = 0; k < (usize)m->nw * m->psize; k++) m->pspaceBase[k] = 0;
  const i32 *ins = in + 4 * m->nw;
  for (Cell *c = m->codeBase; c < code; c++, ins += 5) {
    c->ins = (u16)(ins[0] | ins[1] << 8 | ins[3] << 11);
    c->a = (u16)ins[2];
    c->b = (u16)ins[4];
    c->pad = 0;
  }
  m->hasStp = 0;
  for (Cell *c = m->codeBase; c < code; c++) m->hasStp |= (c->ins & 0xf8) == 0220;
  m->fixedPositions = fixed;
  m->perm = perm;
  m->permLeft = 0;
  m->seed = seedValue;
  m->round_ = 0;
  m->roundOver = 1;
  m->starter = 0;
  m->loaded = 1;
}

// Placement method A: random positions, retried while too close to an
// earlier one. Returns 0 when it gives up.
static int place_random(Mars *const m, u32 *pos) {
  u32 range = m->N - 2 * m->minDist + 1;
  int retries = 20, backtracks = 4;
  for (u32 i = 1; i < m->nw;) {
    m->seed = rng(m->seed);
    pos[i] = (u32)(m->seed % range) + m->minDist;
    u32 conflict = 0;
    for (u32 j = 1; j < i; j++) {
      u32 d = pos[i] > pos[j] ? pos[i] - pos[j] : pos[j] - pos[i];
      if (d < m->minDist) { conflict = j; break; }
    }
    if (!conflict) { i++; retries = 20; continue; }
    if (retries-- > 0) continue;
    if (backtracks-- <= 0) return 0;
    i = conflict;
    retries = 20;
  }
  return 1;
}

// Placement method B: sorted random gaps, then shuffled.
static void place_spread(Mars *const m, u32 *pos) {
  u32 room = m->N - m->minDist * m->nw + 1;
  for (u32 i = 1; i < m->nw; i++) {
    m->seed = rng(m->seed);
    u32 t = (u32)(m->seed % room);
    u32 j = i - 1;
    while (j >= 1 && !(t > pos[j])) { pos[j + 1] = pos[j]; j--; }
    pos[j + 1] = t;
  }
  for (u32 i = 1; i < m->nw; i++) pos[i] += m->minDist * i;
  for (u32 i = 1; i < m->nw; i++) {
    m->seed = rng(m->seed);
    u32 j = (u32)(m->seed % (m->nw - i)) + i;
    u32 t = pos[i]; pos[i] = pos[j]; pos[j] = t;
  }
}

static void place_warriors(Mars *const m) {
  if (m->fixedPositions || m->perm) return; // positions stay as loaded or drawn
  u32 pos[255]; // m42_rules.warriors is at most 255
  for (u32 i = 0; i < m->nw; i++) pos[i] = 0;
  if (m->nw > 1) ((volatile u32 *)pos)[255 + m->nw] = 0; // deliberate out-of-bounds write, must make the fuzz job fail
  if (m->nw == 2) {
    pos[1] = m->minDist + (u32)(m->seed % (m->N + 1 - 2 * m->minDist));
    m->seed = rng(m->seed);
  } else if (m->nw > 2 && !place_random(m, pos)) {
    place_spread(m, pos);
  }
  for (u32 i = 0; i < m->nw; i++) m->war[i].position = pos[i];
}

// permute (pmars -P), two warriors: the positions and the first mover of
// the next round, before start_round(). The PERMUTATIONS() combinations
// c = 2 * (position - minDist) + (warrior 1 moves first) are drawn without
// repeats, from a list in which a drawn entry is replaced by the last one;
// a new list once all were drawn (semantics doc, 3.2). Inlined where it is
// called: as a function of its own it moved the call indices of the loops.
M42_FORCE_INLINE void draw_permuted(Mars *const m) {
  if (!m->permLeft) {
    m->permLeft = PERMUTATIONS(m->N, m->minDist);
    for (u32 i = 0; i < m->permLeft; i++) m->perm[i] = i;
  }
  const u32 i = (u32)(m->seed % m->permLeft), c = m->perm[i];
  m->perm[i] = m->perm[--m->permLeft];
  m->seed = rng(m->seed);
  m->war[0].position = 0;
  m->war[1].position = m->minDist + c / 2;
  m->starter = c & 1;
}

static void start_round(Mars *const m) {
  m->round_++;
  place_warriors(m);
  for (u32 a = 0; a < m->N; a++) CORE(m)[a] = (Cell){0, 0, EMPTY_INS, 0};
  m->timeNow = 0;
  m->roundOver = 0;
  m->cyclesLeft = (i64)m->nw * m->maxCycles;
  m->warriorsLeft = m->nw;
  for (u32 i = 0; i < m->nw; i++) {
    Warrior *w = &m->war[i];
    for (u32 k = 0; k < w->len; k++) CORE(m)[(w->position + k) % m->N] = w->code[k];
    w->next = (i + 1) % m->nw;
    w->nextW = &m->war[w->next];
    // Two warriors: both queue heads are equal whenever warrior 0 is to
    // move, see execute2(). So warrior 0's queue starts one entry later when
    // warrior 1 moves first.
    w->head = m->nw == 2 && i == 0 && m->starter == 1;
    w->tail = w->head + 1;
    w->q[w->head & m->qmask] = (u16)((w->position + w->start) % m->N);
    w->alive = 1;
    w->diedAt = -1;
  }
  m->current = m->starter;
  m->blockerAt = 0;
}

static M42_NOINLINE void end_round(Mars *const m) {
  if (m->roundOver) return;
  u32 survivors = 0;
  for (u32 i = 0; i < m->nw; i++) {
    Warrior *w = &m->war[i];
    if (w->alive) {
      w->score[m->warriorsLeft - 1]++;
      w->lastResult = m->warriorsLeft;
      survivors++;
    } else {
      w->lastResult = 0;
    }
  }
  for (u32 i = 0; i < m->nw; i++) {
    Warrior *w = &m->war[i];
    if (!w->alive) w->losses++;
    else if (m->nw > 1 && survivors == 1) w->wins++;
    else w->ties++;
  }
  if (m->round_ - 1 - m->logFirst < m->logRounds) { // only the rounds of run_match() with a log
    u8 *e = m->resultLog + (usize)(m->round_ - 1 - m->logFirst) * m->logStride;
    const u64 t = (u64)m->timeNow;
    m42_memcpy(e, &t, 8);
    for (u32 i = 0; i < m->nw; i++) e[8 + i] = (u8)m->war[i].alive;
  }
  m->starter = (m->starter + 1) % m->nw;
  m->roundOver = 1;
}

// Warrior w lost its last process. cyclesLeft does not count the instruction
// that killed it.
static M42_NOINLINE void warrior_died(Mars *const m, u32 w) {
  Warrior *W = &m->war[w];
  W->alive = 0;
  W->diedAt = m->timeNow;
  W->score[m->warriorsLeft + m->nw - 2]++;
  m->cyclesLeft = m->cyclesLeft - 1 - (m->cyclesLeft - 1) / m->warriorsLeft;
  m->warriorsLeft--;
  if (m->warriorsLeft < 2) { end_round(m); return; }
  u32 prev = w;
  while (m->war[prev].next != w) prev = m->war[prev].next;
  m->war[prev].next = W->next;
  m->war[prev].nextW = W->nextW;
  m->current = W->next;
  if (--m->cyclesLeft <= 0) end_round(m);
}

// ---------------------------------------------------------------- execution

#ifdef COUNT_INS
static u64 insCount[1u << 14]; // executions per instruction word
#endif
#ifdef TRACE_TIES
// See tie-ceiling.c: the B target of the last instruction, and a hook after
// every instruction.
static u32 traceTarget, traceSource; // B and A target
static void trace_step(const Mars *m, const Warrior *W, u32 pc, Cell ir, u32 tasks);
#endif

static inline u32 ab_of(const Cell *c) { u32 v; m42_memcpy(&v, c, 4); return v; }
static inline void set_ab(Cell *c, u32 v) { m42_memcpy(c, &v, 4); }
static inline u64 cell_of(const Cell *c) { u64 v; m42_memcpy(&v, c, 8); return v; }
static inline void set_cell(Cell *c, u64 v) { m42_memcpy(c, &v, 8); }

// Notes on speed, from bench/bench.mjs --wasm-match (M instructions/s in
// Node 22; first version 125):
// - warrior record padded to 128 bytes, indexed by a shift instead of a
//   multiply by 72: 147; following a next-warrior pointer: 154
// - $ and # tested before the mode switch: 181 (+23% on random corpus
//   pairs too); then $ before #, and < for the B operand: 184
// - MOV.I before the opcode dispatch: 187; B values read only by the
//   opcodes that use them: 191
// - slower, not kept: one dispatch on both modes (116), branch-free
//   indirect modes (160), an SPL fast path (188), 32-bit queue entries (same)
// - the instructions per simulated instruction, not branch misses, limit
//   the native build (0.1 misses per instruction at 125M/s)
// - for two warriors, queue counters in locals and the loop unrolled into
//   the two turns (execute2()): 191 on the bench, +3% on random corpus
//   pairs, +7% native; the module grows from 13.5 to 24 KB
// - early tie by a count of DAT, DIV, MOD and STP cells kept up to date by
//   MOV.I cost 5% on the bench and 8% on corpus pairs; tie_check(m) scans
//   instead, at no cost to the loop
// - second round (docs/performance-log.md): a case with a copy of the
//   instruction for each of the 32 most executed instruction words (step(),
//   dispatch.h), the standard settings as constants (execute2_8000()), a
//   loop with a single entry, the core and two queues at fixed addresses,
//   and -Os: 191 -> 282 on the bench, t20 5.83 -> 4.13 s. Slower, not kept:
//   one case for every word (8512 cases, 4.3 MB module), one case per
//   opcode, modifier and B mode, a table of handlers indexed by the word,
//   handlers ending in tail calls, packed queue counters, an unrolled loop,
//   one turn per loop iteration, the generic code in its own function, two
//   battles interleaved in one loop, wasm-opt -O3
// - third round: MOV.I from one 64-bit snapshot of the A cell and linear
//   queues for two warriors (config()): 278 -> 294 on the bench, t20
//   4.16 -> 3.84 s. Slower, not kept: one queue ring for both warriors
//   with one head, specialized cases for classes of equal instruction words
// - fourth round: one head for both linear queues and a loop over pairs of
//   turns (execute2()), ADD, SUB and MUL of both values with one load and
//   one store: 298 -> 310 on the bench, t20 3.80 -> 3.60 s. Slower, not
//   kept: every core store as a store of the whole cell, the instruction
//   fetched with three 16-bit loads, queue counters as byte offsets

// x mod n for x < 2n: one conditional subtraction.
M42_FORCE_INLINE u32 wrap(u32 x, u32 n) { return x >= n ? x - n : x; }

// An offset folded into the window of a read or write limit L (a divisor of
// n) around the instruction: x mod L, as a negative offset above L / 2.
M42_FORCE_INLINE u32 fold(u32 x, u32 L, u32 n) {
  if (L == n) return x >= n ? x - n : x; // no limit (execute_watched()); x < 2n there
  const u32 r = x % L;
  return r > L / 2 ? r + n - L : r;
}

// Address arithmetic of the functions below: both operands are below n.
#define WRAP(x) wrap((x), n)
#define DEC(x) ((x) == 0 ? n - 1 : (u32)(x) - 1)
#define INC(x) ((x) + 1 == n ? 0 : (x) + 1)

// The instruction itself, after its operands (exec_ins(), exec_ins_rw()):
// aPtr and Acell are the A operand's address and cell (Aab its values, Ains
// its instruction word, padding 0), B the cell the B
// operand writes, Bab (with eager) its values read before a post-increment,
// else read from B where used, and bins its instruction word for .I.
// Returns 1 when the process died, else 0.
M42_FORCE_INLINE int exec_core(Mars *const m, const u32 n, const u32 mask, const u32 limit, Warrior *const W,
                               u16 *const q, u32 *const head, u32 *const tail, const u32 pc, const u32 ins,
                               const u32 aPtr, const u64 Acell, const u32 Aab, const u32 Ains, Cell *const B,
                               const u32 Bab, const int eager, const u16 *const bins) {
  // MOV.I, the most frequent instruction, before the dispatch.
  if ((ins & 0xff) == 006) {
    set_cell(B, Acell);
    q[(*tail)++ & mask] = (u16)INC(pc);
    return 0;
  }
  const u32 AA = Aab & 0xffff, AB = Aab >> 16;
  // The B values are read where they are used, so that DAT, SPL, JMP and
  // MOV do not load them. Each use comes before any store to the field it
  // reads. That gives the values the B operand saw, except for a
  // post-increment B mode (> }) whose target is the incremented cell
  // itself; for those modes Bab holds the values read before the increment.
#define BAB (eager ? Bab : ab_of(B))
#define BA (BAB & 0xffff)
#define BB (BAB >> 16)
  u32 next = INC(pc); // the address queued afterwards
  u32 r;

  // Opcode byte in octal: the last digit is the modifier, A B AB BA F X I
  // = 0..6. Cases `break` to queue `next`, `goto died` when the process
  // dies, and `goto queued` when they queued already (SPL). trace_flags()
  // repeats the tests of this switch for the watch: change both together.
  switch (ins & 0xff) {
    // MOV
    case 000: B->a = (u16)AA; break;
    case 001: B->b = (u16)AB; break;
    case 002: B->b = (u16)AA; break;
    case 003: B->a = (u16)AB; break;
    case 004: set_ab(B, Aab); break;
    case 005: set_ab(B, Aab >> 16 | Aab << 16); break;
    case 006: set_cell(B, Acell); break;

    // ADD. With .F, .X and .I both values are one load and one store: after
    // a 16-bit store of one value, the 32-bit load for the other one has to
    // wait until the store is in the cache (no store-to-load forwarding).
    case 010: B->a = (u16)WRAP(BA + AA); break;
    case 011: B->b = (u16)WRAP(BB + AB); break;
    case 012: B->b = (u16)WRAP(BB + AA); break;
    case 013: B->a = (u16)WRAP(BA + AB); break;
    case 014: case 016: r = BAB; set_ab(B, WRAP((r & 0xffff) + AA) | WRAP((r >> 16) + AB) << 16); break;
    case 015: r = BAB; set_ab(B, WRAP((r & 0xffff) + AB) | WRAP((r >> 16) + AA) << 16); break;

    // SUB: target minus source
#define SUBM(t, s) ((t) >= (s) ? (t) - (s) : (t) + n - (s))
    case 020: B->a = (u16)SUBM(BA, AA); break;
    case 021: B->b = (u16)SUBM(BB, AB); break;
    case 022: B->b = (u16)SUBM(BB, AA); break;
    case 023: B->a = (u16)SUBM(BA, AB); break;
    case 024: case 026: r = BAB; set_ab(B, SUBM(r & 0xffff, AA) | SUBM(r >> 16, AB) << 16); break;
    case 025: r = BAB; set_ab(B, SUBM(r & 0xffff, AB) | SUBM(r >> 16, AA) << 16); break;

    // MUL
    case 030: B->a = (u16)(BA * AA % n); break;
    case 031: B->b = (u16)(BB * AB % n); break;
    case 032: B->b = (u16)(BB * AA % n); break;
    case 033: B->a = (u16)(BA * AB % n); break;
    case 034: case 036: r = BAB; set_ab(B, (r & 0xffff) * AA % n | (r >> 16) * AB % n << 16); break;
    case 035: r = BAB; set_ab(B, (r & 0xffff) * AB % n | (r >> 16) * AA % n << 16); break;

    // DIV and MOD store each pair with a non-zero divisor, then the
    // process dies if a divisor was zero.
    case 040: if (!AA) return 1; B->a = (u16)(BA / AA); break;
    case 041: if (!AB) return 1; B->b = (u16)(BB / AB); break;
    case 042: if (!AA) return 1; B->b = (u16)(BB / AA); break;
    case 043: if (!AB) return 1; B->a = (u16)(BA / AB); break;
    case 044: case 046:
      if (AA) B->a = (u16)(BA / AA);
      if (AB) B->b = (u16)(BB / AB);
      if (!AA || !AB) return 1;
      break;
    case 045:
      if (AB) B->a = (u16)(BA / AB);
      if (AA) B->b = (u16)(BB / AA);
      if (!AA || !AB) return 1;
      break;
    case 050: if (!AA) return 1; B->a = (u16)(BA % AA); break;
    case 051: if (!AB) return 1; B->b = (u16)(BB % AB); break;
    case 052: if (!AA) return 1; B->b = (u16)(BB % AA); break;
    case 053: if (!AB) return 1; B->a = (u16)(BA % AB); break;
    case 054: case 056:
      if (AA) B->a = (u16)(BA % AA);
      if (AB) B->b = (u16)(BB % AB);
      if (!AA || !AB) return 1;
      break;
    case 055:
      if (AB) B->a = (u16)(BA % AB);
      if (AA) B->b = (u16)(BB % AA);
      if (!AA || !AB) return 1;
      break;

    // JMZ: .A/.BA test the A field, .B/.AB the B field, .F/.X/.I both
    case 060: case 063: if (BA == 0) next = aPtr; break;
    case 061: case 062: if (BB == 0) next = aPtr; break;
    case 064: case 065: case 066: if (BAB == 0) next = aPtr; break;

    // JMN
    case 070: case 073: if (BA != 0) next = aPtr; break;
    case 071: case 072: if (BB != 0) next = aPtr; break;
    case 074: case 075: case 076: if (BAB != 0) next = aPtr; break;

    // DJN decrements the core cell as it is now; the jump test uses the
    // values read by the B operand.
    case 0100: case 0103: if (BA != 1) next = aPtr; r = B->a; B->a = (u16)DEC(r); break;
    case 0101: case 0102: if (BB != 1) next = aPtr; r = B->b; B->b = (u16)DEC(r); break;
    case 0104: case 0105: case 0106:
      if (BAB != 0x10001) next = aPtr;
      r = B->a; B->a = (u16)DEC(r);
      r = B->b; B->b = (u16)DEC(r);
      break;

    // CMP and SEQ: skip when equal
    case 0110: case 0160: if (BA == AA) next = INC(next); break;
    case 0111: case 0161: if (BB == AB) next = INC(next); break;
    case 0112: case 0162: if (BB == AA) next = INC(next); break;
    case 0113: case 0163: if (BA == AB) next = INC(next); break;
    case 0114: case 0164: if (BAB == Aab) next = INC(next); break;
    case 0115: case 0165: if (BB == AA && BA == AB) next = INC(next); break;
    case 0116: case 0166: if (BAB == Aab && *bins == Ains) next = INC(next); break;

    // SNE: skip when not equal
    case 0170: if (BA != AA) next = INC(next); break;
    case 0171: if (BB != AB) next = INC(next); break;
    case 0172: if (BB != AA) next = INC(next); break;
    case 0173: if (BA != AB) next = INC(next); break;
    case 0174: if (BAB != Aab) next = INC(next); break;
    case 0175: if (BB != AA || BA != AB) next = INC(next); break;
    case 0176: if (BAB != Aab || *bins != Ains) next = INC(next); break;

    // SLT: skip when less
    case 0120: if (AA < BA) next = INC(next); break;
    case 0121: if (AB < BB) next = INC(next); break;
    case 0122: if (AA < BB) next = INC(next); break;
    case 0123: if (AB < BA) next = INC(next); break;
    case 0124: case 0126: if (AA < BA && AB < BB) next = INC(next); break;
    case 0125: if (AA < BB && AB < BA) next = INC(next); break;

    // SPL queues the next instruction, then the new process if the
    // warrior has fewer than maxProcesses.
    case 0130: case 0131: case 0132: case 0133: case 0134: case 0135: case 0136:
      q[(*tail)++ & mask] = (u16)next;
      if (*tail - *head < limit) q[(*tail)++ & mask] = (u16)aPtr;
      return 0;

    // DAT
    case 0140: case 0141: case 0142: case 0143: case 0144: case 0145: case 0146:
      return 1;

    // JMP
    case 0150: case 0151: case 0152: case 0153: case 0154: case 0155: case 0156:
      next = aPtr;
      break;

    // NOP
    case 0200: case 0201: case 0202: case 0203: case 0204: case 0205: case 0206:
      break;

    // LDP and STP: the p-space index is taken modulo pSpaceSize, index 0
    // is the last result. Only .A and .BA work on A fields; .F, .X and .I
    // act like .B.
    case 0210: case 0211: case 0212: case 0213: case 0214: case 0215: case 0216:
    case 0220: case 0221: case 0222: case 0223: case 0224: case 0225: case 0226: {
      const u32 mod = ins & 7;
      const int onA = mod == 0 || mod == 3;
      const u32 src = mod == 0 ? AA : mod == 2 ? AA : AB;
      if ((ins & 0xf8) == 0210) {
        u32 v = 0; // pSpaceSize 0: LDP loads 0
        if (m->psize) { u32 i = src % m->psize; v = i == 0 ? W->lastResult : W->pspace[i]; }
        if (onA) B->a = (u16)v; else B->b = (u16)v;
      } else if (m->psize) {
        u32 i = (onA ? BA : BB) % m->psize;
        if (i == 0) W->lastResult = src; else W->pspace[i] = src;
      }
      break;
    }

    default: // not an instruction the assembler produces: like NOP
      break;
#undef BAB
#undef BA
#undef BB
  }
  q[(*tail)++ & mask] = (u16)next;
  return 0;
#undef SUBM
}

// Executes the instruction ir, fetched from pc, of warrior W, whose queue
// is q with the counters *head and *tail (W's own fields, or local copies of
// them in execute2()); the process is already taken off the queue. ins is
// the instruction word of ir: when the caller passes a constant, clang
// compiles a copy of this function without mode or opcode branches (see
// step()). Returns 1 when the process died, else 0.
M42_FORCE_INLINE int exec_ins(Mars *const m, Cell *const C, const u32 n, const u32 mask, const u32 limit,
                                                          Warrior *const W, u16 *const q, u32 *const head, u32 *const tail,
                                                          const u32 pc, const Cell ir, const u32 ins) {

  // A operand: pointer and a snapshot of the whole A cell, Acell, with the
// A and B values in its low half (Aab, AA in the low half of that). The
// modes are tested in the order of their measured frequency ($ # first,
// then a switch); a dispatch on both modes at once and branch-free indirect
// modes were slower (notes above execute()).
  // The instruction word in Acell stays the one in the core until the
  // instruction writes: the B operand's side effects change value fields
  // only. So MOV.I stores Acell with one store, and CMP.I, SEQ.I and SNE.I
  // compare its word.
  u32 aPtr;
  u64 Acell;
#define READ_A(x) (Acell = cell_of(&C[x]))
  const u32 am = (ins >> 8) & 7;
  if (am == 1) {
    aPtr = WRAP(pc + ir.a);
    READ_A(aPtr);
  } else if (am == 0) {
    aPtr = pc;
    m42_memcpy(&Acell, &ir, 8);
  } else {
    const u32 p = WRAP(pc + ir.a);
    switch (am) {
      case 1: aPtr = p; break;
      case 2: aPtr = WRAP(p + C[p].b); break;
      case 3: { u32 f = DEC(C[p].b); C[p].b = (u16)f; aPtr = WRAP(p + f); break; }
      case 4: { u32 f = C[p].b; aPtr = WRAP(p + f); READ_A(aPtr); C[p].b = (u16)INC(f); goto a_done; }
      case 5: aPtr = WRAP(p + C[p].a); break;
      case 6: { u32 f = DEC(C[p].a); C[p].a = (u16)f; aPtr = WRAP(p + f); break; }
      default: { u32 f = C[p].a; aPtr = WRAP(p + f); READ_A(aPtr); C[p].a = (u16)INC(f); goto a_done; }
    }
    READ_A(aPtr);
  }
a_done:;
#ifdef TRACE_TIES
  traceSource = aPtr;
#endif
#undef READ_A
  const u32 Aab = (u32)Acell;
  const u32 Ains = (u32)(Acell >> 32); // instruction word, padding 0

  // B operand on the core as the A operand left it; $ < # are the
// frequent modes here.
  u32 bPtr, Bab = 0;
  int eager = 0; // post-increment B mode: Bab holds the values read before it
  const u32 bm = ins >> 11;
  if (bm == 1) {
    bPtr = WRAP(pc + ir.b);
  } else if (bm == 3) {
    const u32 p = WRAP(pc + ir.b);
    const u32 f = DEC(C[p].b);
    C[p].b = (u16)f;
    bPtr = WRAP(p + f);
  } else if (bm == 0) {
    bPtr = pc;
  } else {
    const u32 p = WRAP(pc + ir.b);
    switch (bm) {
      case 1: bPtr = p; break;
      case 2: bPtr = WRAP(p + C[p].b); break;
      case 3: { u32 f = DEC(C[p].b); C[p].b = (u16)f; bPtr = WRAP(p + f); break; }
      case 4: { u32 f = C[p].b; bPtr = WRAP(p + f); Bab = ab_of(&C[bPtr]); C[p].b = (u16)INC(f); eager = 1; break; }
      case 5: bPtr = WRAP(p + C[p].a); break;
      case 6: { u32 f = DEC(C[p].a); C[p].a = (u16)f; bPtr = WRAP(p + f); break; }
      default: { u32 f = C[p].a; bPtr = WRAP(p + f); Bab = ab_of(&C[bPtr]); C[p].a = (u16)INC(f); eager = 1; break; }
    }
  }

  Cell *const B = &C[bPtr];
#ifdef TRACE_TIES
  traceTarget = bPtr;
#endif
  return exec_core(m, n, mask, limit, W, q, head, tail, pc, ins, aPtr, Acell, Aab, Ains, B, Bab, eager, &B->ins);
}

// What exec_ins_rw() read and changed, for the bookkeeping of
// execute_watched(): the A pointer and the A cell as read, the B operand's
// read and write address and its values, and the pointer cell each operand
// decremented or incremented (~0u: none).
typedef struct {
  u32 aPtr, bRead, bWrite, Bab;
  u64 Acell;
  u32 changed[2];
} Operands;

// exec_ins() with read and write limits (execute_limited()). Each operand
// has a read address, from which its values come (and the A operand's jump
// target), and a write address, where the B operand's stores go. pMARS's
// rules (semantics doc, 3.3): the offset is folded with each limit; @ and *
// add the pointer cell at the read offset to both, < > { } change the
// pointer cell at the write offset and add it to the write offset for both.
// With both limits at the core size the folding changes nothing, so
// execute_watched() runs it too, with `o` to fill (0 in execute_limited()).
// A function of its own, not a flag of exec_ins(): a branch on a flag that
// was 0 there changed clang -O3's code of the other loops (#40).
M42_FORCE_INLINE int exec_ins_rw(Mars *const m, Cell *const C, const u32 n, const u32 mask, const u32 limit,
                                 Warrior *const W, u16 *const q, u32 *const head, u32 *const tail, const u32 pc,
                                 const Cell ir, const u32 ins, Operands *const o) {
  const u32 R = m->readLimit, Wl = m->writeLimit;
  u32 aPtr = pc, bRead = pc, bWrite = pc, Bab = 0;
  u64 Acell;
  m42_memcpy(&Acell, &ir, 8);
  if (o) o->changed[0] = o->changed[1] = ~0u;
  for (int k = 0; k < 2; k++) {
    const u32 mode = k ? ins >> 11 : (ins >> 8) & 7, v = k ? ir.b : ir.a;
    u32 rp = 0, wp = 0;
    u16 *post = 0; // the field a post-increment mode increments after the read
    if (mode != 0) {
      rp = fold(v, R, n);
      wp = fold(v, Wl, n);
      if (mode == 2 || mode == 5) {
        const u32 c = WRAP(pc + rp), f = mode == 2 ? C[c].b : C[c].a;
        rp = fold(rp + f, R, n);
        wp = fold(wp + f, Wl, n);
      } else if (mode != 1) {
        Cell *const c = &C[WRAP(pc + wp)];
        if (o) o->changed[k] = WRAP(pc + wp);
        u16 *const f = mode == 3 || mode == 4 ? &c->b : &c->a;
        if (mode == 3 || mode == 6) *f = (u16)DEC(*f);
        else post = f;
        rp = fold(wp + *f, R, n);
        wp = fold(wp + *f, Wl, n);
      }
    }
    if (k == 0) {
      aPtr = WRAP(pc + rp);
      if (mode != 0) Acell = cell_of(&C[aPtr]);
    } else {
      bRead = WRAP(pc + rp);
      bWrite = WRAP(pc + wp);
      Bab = ab_of(&C[bRead]);
    }
    if (post) *post = (u16)INC((u32)*post);
  }
  if (o) {
    o->aPtr = aPtr;
    o->bRead = bRead;
    o->bWrite = bWrite;
    o->Bab = Bab;
    o->Acell = Acell;
  }
  return exec_core(m, n, mask, limit, W, q, head, tail, pc, ins, aPtr, Acell, (u32)Acell, (u32)(Acell >> 32), &C[bWrite], Bab, 1,
                   &C[bRead].ins);
}
#undef WRAP
#undef DEC
#undef INC

// Executes the next instruction of warrior W, see exec_ins(). The most
// executed instruction words (lib/src/gen-dispatch.mjs, dispatch.h) have a
// case each that calls exec_ins() with the word as a constant: a copy of the
// instruction without run-time mode and opcode tests. The others run the
// generic code. clang compiles the sparse case labels into a tree of
// compares; that was faster than a table indexed by the word (one indirect
// jump that is harder to predict), and 32 cases were faster than 16, 24,
// 40, 48 or 64. MSVC compiles the first 16 only (M42_DISPATCH_16 in
// platform.h).
M42_FORCE_INLINE int step(Mars *const m, Cell *const C, const u32 n, const u32 mask, const u32 limit,
                                                      Warrior *const W, u16 *const q, u32 *const head, u32 *const tail) {
  const u32 pc = q[(*head)++ & mask];
  const Cell ir = C[pc];
  const u32 ins = ir.ins;
#ifdef COUNT_INS
  insCount[ins]++; // see bench-native.c
#endif
#define EXEC(word) exec_ins(m, C, n, mask, limit, W, q, head, tail, pc, ir, word)
#ifdef TRACE_TIES
  // The generic code only: the specialized cases behave the same.
  const int died = EXEC(ins);
  trace_step(m, W, pc, ir, *tail - *head);
  return died;
#else
  switch (ins) {
#include "dispatch.h"
  }
  return EXEC(ins);
#endif
#undef EXEC
}

// step() with read and write limits: the generic code only.
M42_FORCE_INLINE int step_rw(Mars *const m, Cell *const C, const u32 n, const u32 mask, const u32 limit,
                             Warrior *const W, u16 *const q, u32 *const head, u32 *const tail) {
  const u32 pc = q[(*head)++ & mask];
  return exec_ins_rw(m, C, n, mask, limit, W, q, head, tail, pc, C[pc], C[pc].ins, 0);
}


// Executes up to `count` instructions (at least one) of the running round
// and returns how many it executed. Stops early when the round ends.
static M42_NOINLINE u64 execute(Mars *const m, u64 count) {
  Cell *const C = CORE(m);
  const u32 n = m->N;
  const u32 mask = m->qmask;
  const u32 limit = m->maxProc;
  Warrior *W = &m->war[m->current];
  u64 total = 0;

  // One counter serves the instruction count, the time and the cycle
  // budget: every instruction uses up a cycle except the one that kills a
  // warrior's last process, and that case leaves the inner loop. `left`
  // counts down from `budget`; when it reaches 0 either `count` is done or
  // the cycle budget is used up (or both).
  for (;;) {
    i64 budget = m->cyclesLeft < 1 ? 1 : m->cyclesLeft; // at least one instruction
    if (count - total < (u64)budget) budget = (i64)(count - total);
    i64 left = budget;
    for (;;) {
      if (UNLIKELY(step(m, C, n, mask, limit, W, W->q, &W->head, &W->tail)) && W->tail == W->head) {
        // The warrior lost its last process. This instruction counts as
        // executed but uses up no cycle.
        const i64 cycled = budget - left;
        total += (u64)cycled + 1;
        m->timeNow += cycled + 1;
        m->cyclesLeft -= cycled;
        m->current = (u32)(W - m->war);
        warrior_died(m, m->current);
        if (m->roundOver || total >= count) return total;
        W = &m->war[m->current];
        goto next_budget;
      }
      W = W->nextW;
      if (UNLIKELY(--left == 0)) break;
    }
    // The inner loop used up its budget.
    total += (u64)budget;
    m->timeNow += budget;
    m->cyclesLeft -= budget;
    m->current = (u32)(W - m->war);
    if (m->cyclesLeft <= 0) end_round(m);
    return total;
    next_budget:;
  }
}

// execute() for exactly two warriors: the queue counters of both live in
// local variables, and the loop body is unrolled into warrior 0's turn and
// warrior 1's turn. With two warriors the turns alternate until one loses
// its last process, which ends the round. Every turn pops one entry, and
// start_round() starts warrior 0's queue one entry later when warrior
// 1 moves first: both heads are equal whenever warrior 0 is to move. So the
// loop runs pairs of turns with one head for both queues, which also counts
// the pairs: 3 loop-carried counters (head, two tails) instead of 5 (two
// heads, two tails, countdown). n, mask and limit are the core size, queue
// mask and process limit, q0 and q1 the two queues: constants in
// execute2_8000().
M42_FORCE_INLINE u64 execute2(Mars *const m, u64 count, const u32 n, const u32 mask, const u32 limit,
                                                          u16 *const q0, u16 *const q1) {
  // When it is warrior 1's turn, execute() runs that one instruction, so that
  // the loop has a single entry. A jump into the second half of the loop
  // made it irreducible, and clang added a dispatch variable that V8 tested
  // on every iteration.
  u64 pre = 0;
  if (m->current == 1) {
    pre = execute(m, 1);
    if (m->roundOver || pre == count) return pre;
    count -= pre;
  }
  Cell *const C = CORE(m);
  Warrior *const W0 = &m->war[0], *const W1 = &m->war[1];
  i64 budget = m->cyclesLeft < 1 ? 1 : m->cyclesLeft; // like execute()
  if (count < (u64)budget) budget = (i64)count;
  // Both heads are equal here. h runs up to `end`; an odd budget's last
  // instruction goes through execute() below.
  const u32 start = W0->head, end = start + (u32)(budget >> 1);
  u32 h = start, t0 = W0->tail, t1 = W1->tail;
  u32 dead = 2; // the warrior that lost its last process, 2: none
  if (h != end) {
    for (;;) {
      u32 h0 = h, h1 = h;
      if (UNLIKELY(step(m, C, n, mask, limit, W0, q0, &h0, &t0)) && t0 == h0) { dead = 0; break; }
      if (UNLIKELY(step(m, C, n, mask, limit, W1, q1, &h1, &t1)) && t1 == h1) { dead = 1; break; }
      if (UNLIKELY(++h == end)) break;
    }
  }
  W0->tail = t0;
  W1->tail = t1;
  if (dead < 2) {
    W0->head = h + 1;
    W1->head = h + dead;
    const i64 cycled = 2 * (i64)(h - start) + dead; // the fatal instruction uses no cycle
    m->timeNow += cycled + 1;
    m->cyclesLeft -= cycled;
    m->current = dead;
    warrior_died(m, dead); // ends the round
    return pre + (u64)cycled + 1;
  }
  W0->head = W1->head = h;
  const i64 done = 2 * (i64)(h - start);
  m->timeNow += done;
  m->cyclesLeft -= done;
  m->current = 0;
  if (done < budget) return pre + (u64)done + execute(m, 1); // an odd budget: its last instruction
  if (m->cyclesLeft <= 0) end_round(m);
  return pre + (u64)done;
}

// The standard settings (core size 8000, 8000 processes, linear queues) as
// constants: the wraparound compares and the queue addresses become
// immediates, and the queue mask goes away, which frees registers. Separate functions, so that V8 compiles
// only the one in use with its optimizing compiler (it tiers up per
// function, and a smaller function gets there sooner).
static M42_NOINLINE u64 execute2_8000(Mars *const m, u64 count) {
  return execute2(m, count, 8000, ~0u, 8000, QUEUES(m)[0], QUEUES(m)[1]);
}
static M42_NOINLINE u64 execute2_any(Mars *const m, u64 count) {
  return execute2(m, count, m->N, m->qmask, m->maxProc, m->war[0].q, m->war[1].q);
}

// execute() with read and write limits below the core size (exec_ins_rw()),
// the same loop. Behind the other loops, so that they stay as they were.
static M42_NOINLINE u64 execute_limited(Mars *const m, u64 count) {
  Cell *const C = CORE(m);
  const u32 n = m->N, mask = m->qmask, limit = m->maxProc;
  Warrior *W = &m->war[m->current];
  u64 total = 0;
  for (;;) {
    i64 budget = m->cyclesLeft < 1 ? 1 : m->cyclesLeft;
    if (count - total < (u64)budget) budget = (i64)(count - total);
    i64 left = budget;
    for (;;) {
      if (step_rw(m, C, n, mask, limit, W, W->q, &W->head, &W->tail) && W->tail == W->head) {
        const i64 cycled = budget - left;
        total += (u64)cycled + 1;
        m->timeNow += cycled + 1;
        m->cyclesLeft -= cycled;
        m->current = (u32)(W - m->war);
        warrior_died(m, m->current);
        if (m->roundOver || total >= count) return total;
        W = &m->war[m->current];
        goto next_budget;
      }
      W = W->nextW;
      if (--left == 0) break;
    }
    total += (u64)budget;
    m->timeNow += budget;
    m->cyclesLeft -= budget;
    m->current = (u32)(W - m->war);
    if (m->cyclesLeft <= 0) end_round(m);
    return total;
    next_budget:;
  }
}

// execute_limited() comes last: clang emits a static function where it is
// first referenced, and first it came in front of the loops. Behind them it
// still moves the call index of warrior_died() by one (84 to 85, the same
// size); every other place tried moved more (#40).
// execute_watched() (at the end of the file) comes after it, for the same
// reason: called from m42_run() it came in front of the loops, and took
// warrior_died() along (#74).
static u64 execute_watched(Mars *const m, u64 count);
// watched: record into the attached watch (m42_run(); run_match() passes 0).
static u64 run_some(Mars *const m, u64 count, const int watched) {
  if (m->readLimit == m->N && m->writeLimit == m->N && !watched) {
    if (m->nw != 2) return execute(m, count);
    return m->N == 8000 && m->maxProc == 8000 && m->qmask == ~0u ? execute2_8000(m, count) : execute2_any(m, count);
  }
  if (!watched) return execute_limited(m, count);
  return execute_watched(m, count);
}

// ---------------------------------------------------------------- matches

// 1 for the opcodes that can kill a process (DAT, DIV and MOD with a zero
// divisor) or change the p-space (STP), from an instruction word.
#define BLOCKER(ins) ((0x41030u >> (((ins) & 0xff) >> 3)) & 1)

// Whether the core has a cell with DAT, DIV, MOD or STP. Starts at the cell
// where it found one last time: usually that one still is, or the next one
// is near, so the hot loop needs no bookkeeping for this.
static int core_has_blocker(Mars *const m) {
  for (u32 k = 0, a = m->blockerAt; k < m->N; k++, a = a + 1 == m->N ? 0 : a + 1) {
    if (BLOCKER(CORE(m)[a].ins)) { m->blockerAt = a; return 1; }
  }
  return 0;
}

// Early tie detection for run_match(). A process dies only when its
// warrior executes, so a warrior loses at most one process per own turn.
// While nobody dies, the round runs exactly max(cyclesLeft, 1) more
// instructions (at least one, see execute()), and each living warrior gets
// at most ceil(max(cyclesLeft, 1) / warriorsLeft) of them. When every living
// warrior has more processes than that, the round ends in a tie after those
// instructions, which need not be executed: the scores, the
// last results, `time` and the next round are the same. Not the final core
// and queues. STP in the skipped instructions could change p-space cells
// that later rounds read; no instruction creates an opcode that is not in
// the core already, so a match without STP in any warrior's code is safe.
//
// A second proof: only DAT, and DIV or MOD with a zero divisor, kill a
// process, and only STP changes the p-space. Since opcodes are only copied,
// a core without any such cell stays without, and the round is a tie. The
// empty core is DAT, so this happens after the warriors wrote over the whole
// core (imp spirals, papers), with or without STP in their code.
//
// Returns how many instructions to run before checking again (0: the round
// is a tie now): the margin until the test could pass if no process died,
// but at most 4096, because processes are added all the time.
static i64 tie_check(Mars *const m) {
  if (!core_has_blocker(m)) return 0;
  if (m->hasStp) return 4096;
  u32 minTasks = ~0u;
  for (u32 i = 0; i < m->nw; i++) {
    if (m->war[i].alive && m->war[i].tail - m->war[i].head < minTasks) minTasks = m->war[i].tail - m->war[i].head;
  }
  // c <= warriorsLeft * (minTasks - 1) <=> ceil(c / warriorsLeft) < minTasks
  const i64 c = m->cyclesLeft < 1 ? 1 : m->cyclesLeft;
  i64 margin = c - (i64)m->warriorsLeft * (minTasks - 1);
  if (margin <= 0) return 0;
  return margin < 256 ? 256 : margin > 4096 ? 4096 : margin;
}

// Plays `rounds` rounds. With earlyTie, rounds that must end in a tie stop
// early, see tie_check(m). firstRound > 0 starts with round firstRound + 1 of
// the match: the positions and the first mover are those of that round,
// but p-space and the last results start empty, as at the start of a
// match. Returns the number of instructions executed.
static u64 run_match(Mars *const m, u32 rounds, u32 earlyTie, u32 firstRound) {
  // The positions of the skipped rounds: the generator steps exactly as if
  // they were played (placement does not depend on the core).
  for (u32 r = 0; r < firstRound; r++) {
    if (m->perm) draw_permuted(m);
    else place_warriors(m);
  }
  m->round_ = firstRound;
  m->starter = firstRound % m->nw;
  m->logFirst = firstRound;
  u64 total = 0;
  const int skip = earlyTie;
  for (u32 r = 0; r < rounds; r++) {
    if (m->perm) draw_permuted(m);
    start_round(m);
    while (!m->roundOver) {
      if (!skip) { total += run_some(m, ~0ull, 0); continue; }
      i64 chunk = tie_check(m);
      if (chunk == 0) {
        m->timeNow += m->cyclesLeft < 1 ? 1 : m->cyclesLeft;
        m->cyclesLeft = m->cyclesLeft < 1 ? m->cyclesLeft - 1 : 0; // as if executed
        end_round(m);
        break;
      }
      total += run_some(m, (u64)chunk, 0);
    }
  }
  return total;
}

// ---------------------------------------------------------------- watching

// The rest of this file records what a visualizer shows (42mars.h, "watching";
// semantics doc, 3.4 and 3.6) in an extra loop, execute_watched(). It comes
// last, and run_some() takes it only for m42_run() with a watch attached:
// the other loops stay as they are.

// The trace flags of an instruction that exec_core() ran, from what it
// read: the instruction word, the A cell and the B values as the operands
// read them, the word of the B cell, and whether it queued a second process
// (SPL). STORED for the opcodes whose step 4 stores at the B pointer: MOV,
// ADD, SUB, MUL, DJN and LDP always, DIV and MOD when a divisor they use is
// not 0. It repeats the tests of exec_core(): change both together. The
// test "the trace flags agree with what each instruction did to its queue"
// (test/watch.test.js) checks the jump, skip, split and death flags against
// exec_core()'s queue.
static u32 trace_flags(const u32 ins, const u64 Acell, const u32 Bab, const u32 Bins, const int split) {
  const u32 mod = ins & 7;
  const u32 AA = (u32)Acell & 0xffff, AB = (u32)Acell >> 16, Ains = (u32)(Acell >> 32);
  const u32 BA = Bab & 0xffff, BB = Bab >> 16;
  // The fields of the B target the modifier uses, and the A operand value
  // each pairs with: .A A<-A, .B B<-B, .AB B<-A, .BA A<-B, .F .I both, .X
  // both crossed. JMZ, JMN and DJN test the same fields.
  const int useA = mod != 1 && mod != 2, useB = mod != 0 && mod != 3;
  const u32 srcA = mod == 3 || mod == 5 ? AB : AA, srcB = mod == 2 || mod == 5 ? AA : AB;
  const int equal = (!useA || BA == srcA) && (!useB || BB == srcB) && (mod != 6 || Bins == Ains);
  const int zero = (!useA || BA == 0) && (!useB || BB == 0);
  switch ((ins & 0xff) >> 3) {
    case 0: case 1: case 2: case 3: case 17: return M42_TRACE_STORED; // MOV ADD SUB MUL LDP
    case 4: case 5: return (useA && srcA) || (useB && srcB) ? M42_TRACE_STORED : 0; // DIV MOD
    case 6: return zero ? M42_TRACE_NEW_PROCESS : 0; // JMZ
    case 7: return zero ? 0 : M42_TRACE_NEW_PROCESS; // JMN
    case 8: return M42_TRACE_STORED | ((!useA || BA == 1) && (!useB || BB == 1) ? 0 : M42_TRACE_NEW_PROCESS); // DJN
    case 9: case 14: return equal ? M42_TRACE_SKIPPED : 0; // CMP SEQ
    case 15: return equal ? 0 : M42_TRACE_SKIPPED; // SNE
    case 10: return (!useA || srcA < BA) && (!useB || srcB < BB) ? M42_TRACE_SKIPPED : 0; // SLT
    case 11: return split ? M42_TRACE_NEW_PROCESS : 0; // SPL
    case 13: return M42_TRACE_NEW_PROCESS; // JMP
    default: return 0; // DAT NOP STP
  }
}

// A store into cell a by warrior w1 (index + 1) at time t.
M42_FORCE_INLINE void watch_store(m42_watch *const x, const u32 a, const u32 w1, const u32 t, const int8_t bump) {
  x->t_write[a] = t;
  const u32 o = x->owner[a];
  if (o != w1) {
    if (o) x->territory[o - 1]--;
    x->territory[w1 - 1]++;
    x->owner[a] = (u8)w1;
  }
  x->bump[a] = bump;
}

// Nothing seen: every cell untouched, no territory, no executions, no
// trace, no deaths (also m42_watch_attach()).
M42_FORCE_INLINE void watch_clear(m42_watch *const x) {
  for (u32 a = 0; a < x->core_size; a++) {
    x->owner[a] = x->exec_by[a] = x->read_by[a] = 0;
    x->bump[a] = 0;
    x->origin[a] = -1;
    x->t_write[a] = x->t_read[a] = x->t_exec[a] = 0;
  }
  for (u32 i = 0; i < x->warriors; i++) x->territory[i] = 0;
  for (usize k = 0; k < (usize)x->warriors * x->code_stride; k++) x->exec_count[k] = 0;
  for (u32 k = 0; k < M42_TRACE_SIZE; k++) x->trace[k] = (m42_trace_entry){0, 0, 0, 0};
  x->deaths = 0;
}

// The watch after start_round(): nothing seen yet, each warrior owns its
// code. Warriors placed over each other each count their whole length.
// Inlined: as a function of its own it came in front of the loops.
M42_FORCE_INLINE void watch_start_round(Mars *const m) {
  m42_watch *const x = m->watch;
  watch_clear(x);
  for (u32 i = 0; i < m->nw; i++) {
    const Warrior *w = &m->war[i];
    for (u32 k = 0; k < w->len; k++) {
      const u32 a = (w->position + k) % m->N;
      x->owner[a] = (u8)(i + 1);
      x->origin[a] = (i32)(i << 16 | k);
    }
    x->territory[i] = w->len;
  }
}

// execute() with the watch: one instruction per iteration, the generic code
// of the limits (exec_ins_rw()), and the bookkeeping around it.
static M42_NOINLINE u64 execute_watched(Mars *const m, u64 count) {
  Cell *const C = CORE(m);
  m42_watch *const x = m->watch;
  const u32 n = m->N, mask = m->qmask, limit = m->maxProc;
  u64 done = 0;
  while (done < count && !m->roundOver) {
    const u32 w = m->current, w1 = w + 1;
    Warrior *const W = &m->war[w];
    const u32 t = (u32)(m->timeNow + 1);
    const u32 pc = W->q[W->head++ & mask];
    const Cell ir = C[pc];
    const u32 ins = ir.ins;
    x->t_exec[pc] = t;
    x->exec_by[pc] = (u8)w1;
    const i32 org = x->origin[pc];
    if (org >= 0) x->exec_count[(usize)(org >> 16) * x->code_stride + (u32)(org & 0xffff)]++;

    const u32 tail = W->tail;
    Operands o;
    const int died = exec_ins_rw(m, C, n, mask, limit, W, W->q, &W->head, &W->tail, pc, ir, ins, &o);

    const u32 am = (ins >> 8) & 7, bm = ins >> 11, opcode = (ins & 0xff) >> 3;
    if (am != 0) { x->t_read[o.aPtr] = t; x->read_by[o.aPtr] = (u8)w1; }
    const u32 flags = trace_flags(ins, o.Acell, o.Bab, C[o.bRead].ins, W->tail - tail == 2);
    if (opcode == 9 || opcode == 10 || opcode == 14 || opcode == 15) { x->t_read[o.bRead] = t; x->read_by[o.bRead] = (u8)w1; }
    if ((ins & 0xff) == 006) x->origin[o.bWrite] = x->origin[o.aPtr]; // MOV.I
    // The A operand's change, the B operand's, then step 4: the last one
    // gives bump.
    if (o.changed[0] != ~0u) watch_store(x, o.changed[0], w1, t, am == 3 || am == 6 ? -1 : 1);
    if (o.changed[1] != ~0u) watch_store(x, o.changed[1], w1, t, bm == 3 || bm == 6 ? -1 : 1);
    if (flags & M42_TRACE_STORED) watch_store(x, o.bWrite, w1, t, 0);
    x->trace[t & (M42_TRACE_SIZE - 1)] = (m42_trace_entry){pc, o.aPtr, o.bWrite, w | (ins & 0xff) << 8 | flags | (died ? M42_TRACE_DIED : 0)};

    m->timeNow++;
    done++;
    if (died) {
      const int last = W->tail == W->head;
      x->death[x->deaths++ & (M42_DEATH_SIZE - 1)] = (m42_death){pc, w, t, (u32)last};
      if (last) { warrior_died(m, w); continue; } // the instruction uses no cycle
    }
    m->current = W->next;
    if (--m->cyclesLeft <= 0) end_round(m);
  }
  return done;
}

