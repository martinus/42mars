// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Headless MARS simulator, compiled to WebAssembly (see tools/build-wasm.sh)
// and driven by src/engine/mars-wasm.js. It implements section 3 of
// docs/redcode-semantics.md without the visualizer bookkeeping of 3.4 and
// 3.6, and gives the same core, queues, scores and round results as
// src/engine/mars.js with `headless: true`.
//
// No libc: memory comes from a bump allocator on top of the linear memory.
// The same file builds natively (for benchmarks) with a static arena.
//
// Data layout:
// - A core cell is 8 bytes: A value, B value (16 bits each, so the core size
//   is at most 65536), the instruction word and padding. The instruction
//   word holds opcode << 3 | modifier in bits 0..7 (the mars.js op byte), the
//   A mode in bits 8..10 and the B mode in bits 11..13. The A and B values of
//   a cell are one 32-bit load, the whole cell one 64-bit load.
// - Each warrior has its process queue as a ring buffer of 16-bit addresses
//   whose length is a power of two, indexed by free-running 32-bit head and
//   tail counters: the number of processes is tail - head. Two warriors with
//   maxCycles up to LINEAR_CYCLES get linear queues instead, long enough for
//   a whole round, so that no index needs a mask (see mars_config).

typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
typedef int i32;
typedef long long i64;
typedef unsigned long long u64;
typedef unsigned long usize;

#ifdef __wasm__
#define EXPORT(name) __attribute__((export_name(#name)))
#else
#define EXPORT(name)
#endif

#define LIKELY(x) __builtin_expect(!!(x), 1)
#define UNLIKELY(x) __builtin_expect(!!(x), 0)

// ---------------------------------------------------------------- memory

#ifdef __wasm__
extern u8 __heap_base;
#define HEAP_START (&__heap_base)
static usize heap_limit; // end of the linear memory in bytes
#else
// Native build: a static arena; the pages are only mapped when touched.
static _Alignas(64) u8 arena[1u << 28];
#define HEAP_START arena
#endif
static u8 *heap_top;

// Bump allocation, 64-byte aligned, zero filled. Returns 0 when out of memory.
static void *alloc(usize bytes) {
  u8 *p = (u8 *)(((usize)heap_top + 63) & ~(usize)63);
  if (bytes > (usize)-1 - (usize)p) return 0;
  usize end = (usize)p + bytes;
#ifdef __wasm__
  if (end > heap_limit) {
    usize pages = (end - heap_limit + 65535) >> 16;
    if (__builtin_wasm_memory_grow(0, pages) == (usize)-1) return 0;
    heap_limit += pages << 16;
  }
#else
  if (end > (usize)arena + sizeof arena) return 0;
#endif
  heap_top = (u8 *)end;
  for (u8 *q = p; q < (u8 *)end; q++) *q = 0;
  return p;
}

static void reset_heap(void) {
#ifdef __wasm__
  if (!heap_limit) heap_limit = __builtin_wasm_memory_size(0) << 16;
#endif
  heap_top = HEAP_START;
}

// ---------------------------------------------------------------- state

typedef struct {
  u16 a, b;   // field values, 0 .. N-1
  u16 ins;    // op byte | A mode << 8 | B mode << 11
  u16 pad;
} Cell;

#define EMPTY_INS ((12u << 3) | 4u | (1u << 8) | (1u << 11)) // DAT.F $0, $0

typedef struct Warrior {
  u32 head, tail; // free-running queue counters; tasks = tail - head
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
} __attribute__((aligned(128))) Warrior; // a power of two: indexing is a shift

static u32 N;           // core size
static u32 maxProc;     // process limit per warrior
static u32 maxCycles;
static u32 minDist;
static u32 psize;       // p-space size
static u32 nw;          // number of warriors
static u32 qmask;       // queue length - 1
static Cell *core;      // coreMem
// The core and the first two warriors' queues (when they are at most
// QSTATIC long) are at fixed addresses: execute2_8000() then addresses them
// with constant offsets instead of base registers (+4% on the bench).
#define LINEAR_CYCLES 80000
#define QSTATIC ((1 + 2 * (LINEAR_CYCLES + 1) + 31) & ~31) // see mars_config
static _Alignas(64) Cell coreMem[65536];
static _Alignas(64) u16 queueMem[2][QSTATIC];
static Warrior *war;
static i32 *input;      // load area written by the JS glue, see mars_config
static Cell *codeBase;  // all warriors' instructions
static u32 *pspaceBase; // nw p-spaces, one per p-space group
static u32 fixedPositions;
static u32 hasStp;      // some warrior's code contains STP
static u32 blockerAt;   // where core_has_blocker() found one last time
static i64 seed;
static u32 round_, roundOver = 1, starter, current, warriorsLeft;
static i64 timeNow, cyclesLeft;
static u8 *resultLog;   // runMatch: per round 8 bytes time then nw alive flags
static u32 logStride, logRounds, logFirst; // logFirst: round_ of the entry before the first

// ---------------------------------------------------------------- setup

static i64 rng(i64 s) {
  i64 t = 16807 * (s % 127773) - 2836 * (s / 127773);
  return t < 0 ? t + 2147483647 : t;
}

// Prepares a match. Returns the address of the load area, an i32 array:
// per warrior 4 ints (length, start, p-space group, fixed position), then all
// instructions, 5 ints each (op byte, A mode, A value, B mode, B value).
// Warriors with the same p-space group share the p-space cells; the groups
// are numbered 0 .. nw-1. Returns 0 when the memory cannot grow.
EXPORT(mars_config)
i32 *mars_config(u32 coreSize, u32 maxProcesses, u32 cycles, u32 minDistance, u32 pSpaceSize, u32 warriors, u32 instructions) {
  reset_heap();
  N = coreSize;
  maxProc = maxProcesses;
  maxCycles = cycles;
  minDist = minDistance;
  psize = pSpaceSize;
  nw = warriors;
  u32 qlen = 1;
  while (qlen < maxProcesses && qlen < 1u << 30) qlen <<= 1; // the glue limits maxProcesses
  qmask = qlen - 1;
  // Linear queues: with two warriors a round runs at most max(2 * maxCycles,
  // 1) instructions and the turns alternate, so each warrior gets at most
  // maxCycles + 1 turns and pushes at most two entries per turn. Its tail
  // stays at most 1 + 2 * (maxCycles + 1), and mars_start_round() resets
  // the counters. Without wraparound the mask is all ones, which
  // execute2_8000() leaves out: +6% on the bench, -5% on t20
  // (docs/performance-log.md).
  const int linear = nw == 2 && cycles <= LINEAR_CYCLES;
  if (linear) qmask = ~0u;
  core = coreMem;
  war = alloc((usize)nw * sizeof(Warrior));
  input = alloc((usize)(4 * nw + 5 * instructions) * 4);
  if (!war || !input) return 0;
  Cell *code = alloc((usize)instructions * sizeof(Cell));
  u32 *ps = alloc((usize)nw * (psize ? psize : 1) * 4);
  u32 *scores = alloc((usize)nw * (2 * nw - 1) * 4);
  if (!code || !ps || !scores) return 0;
  for (u32 i = 0; i < nw; i++) {
    war[i].q = i < 2 && (linear || qlen <= QSTATIC) ? queueMem[i] : alloc((usize)qlen * 2);
    if (!war[i].q) return 0;
    war[i].score = scores + (usize)i * (2 * nw - 1);
  }
  codeBase = code;
  pspaceBase = ps;
  resultLog = 0;
  logRounds = 0;
  logFirst = 0;
  roundOver = 1;
  return input;
}

// Starts the match after the glue filled the load area. seed: the generator
// state (a non-negative integer); fixed: use the positions of the load area.
EXPORT(mars_load)
void mars_load(double seedValue, u32 fixed) {
  i32 *in = input;
  Cell *code = codeBase;
  for (u32 i = 0; i < nw; i++) {
    Warrior *w = &war[i];
    w->len = (u32)in[4 * i];
    w->start = (u32)in[4 * i + 1];
    w->pspace = pspaceBase + (usize)(u32)in[4 * i + 2] * psize;
    w->position = (u32)in[4 * i + 3];
    w->code = code;
    code += w->len;
    w->lastResult = N - 1;
    w->wins = w->losses = w->ties = 0;
    w->alive = 0;
    w->diedAt = -1;
    w->head = w->tail = 0;
    for (u32 k = 0; k < 2 * nw - 1; k++) w->score[k] = 0;
  }
  for (usize k = 0; k < (usize)nw * psize; k++) pspaceBase[k] = 0;
  const i32 *ins = in + 4 * nw;
  for (Cell *c = codeBase; c < code; c++, ins += 5) {
    c->ins = (u16)(ins[0] | ins[1] << 8 | ins[3] << 11);
    c->a = (u16)ins[2];
    c->b = (u16)ins[4];
    c->pad = 0;
  }
  hasStp = 0;
  for (Cell *c = codeBase; c < code; c++) hasStp |= (c->ins & 0xf8) == 0220;
  fixedPositions = fixed;
  seed = (i64)seedValue;
  round_ = 0;
  roundOver = 1;
  starter = 0;
}

// Placement method A: random positions, retried while too close to an
// earlier one. Returns 0 when it gives up.
static int place_random(u32 *pos) {
  u32 range = N - 2 * minDist + 1;
  int retries = 20, backtracks = 4;
  for (u32 i = 1; i < nw;) {
    seed = rng(seed);
    pos[i] = (u32)(seed % range) + minDist;
    u32 conflict = 0;
    for (u32 j = 1; j < i; j++) {
      u32 d = pos[i] > pos[j] ? pos[i] - pos[j] : pos[j] - pos[i];
      if (d < minDist) { conflict = j; break; }
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
static void place_spread(u32 *pos) {
  u32 room = N - minDist * nw + 1;
  for (u32 i = 1; i < nw; i++) {
    seed = rng(seed);
    u32 t = (u32)(seed % room);
    u32 j = i - 1;
    while (j >= 1 && !(t > pos[j])) { pos[j + 1] = pos[j]; j--; }
    pos[j + 1] = t;
  }
  for (u32 i = 1; i < nw; i++) pos[i] += minDist * i;
  for (u32 i = 1; i < nw; i++) {
    seed = rng(seed);
    u32 j = (u32)(seed % (nw - i)) + i;
    u32 t = pos[i]; pos[i] = pos[j]; pos[j] = t;
  }
}

static void place_warriors(void) {
  if (fixedPositions) return; // positions stay as loaded
  u32 pos[nw];
  for (u32 i = 0; i < nw; i++) pos[i] = 0;
  if (nw == 2) {
    pos[1] = minDist + (u32)(seed % (N + 1 - 2 * minDist));
    seed = rng(seed);
  } else if (nw > 2 && !place_random(pos)) {
    place_spread(pos);
  }
  for (u32 i = 0; i < nw; i++) war[i].position = pos[i];
}

EXPORT(mars_start_round)
void mars_start_round(void) {
  round_++;
  place_warriors();
  for (u32 a = 0; a < N; a++) core[a] = (Cell){0, 0, EMPTY_INS, 0};
  timeNow = 0;
  roundOver = 0;
  cyclesLeft = (i64)nw * maxCycles;
  warriorsLeft = nw;
  for (u32 i = 0; i < nw; i++) {
    Warrior *w = &war[i];
    for (u32 k = 0; k < w->len; k++) core[(w->position + k) % N] = w->code[k];
    w->next = (i + 1) % nw;
    w->nextW = &war[w->next];
    w->head = 0;
    w->tail = 1;
    w->q[0] = (u16)((w->position + w->start) % N);
    w->alive = 1;
    w->diedAt = -1;
  }
  current = starter;
  blockerAt = 0;
}

EXPORT(mars_end_round)
__attribute__((noinline)) void mars_end_round(void) {
  if (roundOver) return;
  u32 survivors = 0;
  for (u32 i = 0; i < nw; i++) {
    Warrior *w = &war[i];
    if (w->alive) {
      w->score[warriorsLeft - 1]++;
      w->lastResult = warriorsLeft;
      survivors++;
    } else {
      w->lastResult = 0;
    }
  }
  for (u32 i = 0; i < nw; i++) {
    Warrior *w = &war[i];
    if (!w->alive) w->losses++;
    else if (nw > 1 && survivors == 1) w->wins++;
    else w->ties++;
  }
  if (round_ - 1 - logFirst < logRounds) { // only the rounds of mars_run_match()
    u8 *e = resultLog + (usize)(round_ - 1 - logFirst) * logStride;
    double t = (double)timeNow;
    __builtin_memcpy(e, &t, 8);
    for (u32 i = 0; i < nw; i++) e[8 + i] = (u8)war[i].alive;
  }
  starter = (starter + 1) % nw;
  roundOver = 1;
}

// Warrior w lost its last process. cyclesLeft does not count the instruction
// that killed it.
static __attribute__((noinline)) void warrior_died(u32 w) {
  Warrior *W = &war[w];
  W->alive = 0;
  W->diedAt = timeNow;
  W->score[warriorsLeft + nw - 2]++;
  cyclesLeft = cyclesLeft - 1 - (cyclesLeft - 1) / warriorsLeft;
  warriorsLeft--;
  if (warriorsLeft < 2) { mars_end_round(); return; }
  u32 prev = w;
  while (war[prev].next != w) prev = war[prev].next;
  war[prev].next = W->next;
  war[prev].nextW = W->nextW;
  current = W->next;
  if (--cyclesLeft <= 0) mars_end_round();
}

// ---------------------------------------------------------------- execution

#ifdef COUNT_INS
static u64 insCount[1u << 14]; // executions per instruction word
#endif
#ifdef TRACE_TIES
// See tie-ceiling.c: the B target of the last instruction, and a hook after
// every instruction.
static u32 traceTarget, traceSource; // B and A target
static void trace_step(const Warrior *W, u32 pc, Cell ir, u32 tasks);
#endif

static inline u32 ab_of(const Cell *c) { u32 v; __builtin_memcpy(&v, c, 4); return v; }
static inline void set_ab(Cell *c, u32 v) { __builtin_memcpy(c, &v, 4); }
static inline u64 cell_of(const Cell *c) { u64 v; __builtin_memcpy(&v, c, 8); return v; }
static inline void set_cell(Cell *c, u64 v) { __builtin_memcpy(c, &v, 8); }

// Notes on speed, from tools/bench.mjs --wasm-match (M instructions/s in
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
//   MOV.I cost 5% on the bench and 8% on corpus pairs; tie_check() scans
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
//   queues for two warriors (mars_config()): 278 -> 294 on the bench, t20
//   4.16 -> 3.84 s. Slower, not kept: one shared queue head for two
//   warriors, specialized cases for classes of equal instruction words

// Executes the instruction ir, fetched from pc, of warrior W, whose queue
// is q with the counters *head and *tail (W's own fields, or local copies of
// them in execute2()); the process is already taken off the queue. ins is
// the instruction word of ir: when the caller passes a constant, clang
// compiles a copy of this function without mode or opcode branches (see
// step()). Returns 1 when the process died, else 0.
static inline __attribute__((always_inline)) int exec_ins(Cell *const C, const u32 n, const u32 mask, const u32 limit,
                                                          Warrior *const W, u16 *const q, u32 *const head, u32 *const tail,
                                                          const u32 pc, const Cell ir, const u32 ins) {
// Address arithmetic: both operands are below n, so one conditional
// subtraction reduces the sum.
#define WRAP(x) ({ u32 x_ = (x); x_ >= n ? x_ - n : x_; })
#define DEC(x) ((x) == 0 ? n - 1 : (x) - 1)
#define INC(x) ((x) + 1 == n ? 0 : (x) + 1)

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
    __builtin_memcpy(&Acell, &ir, 8);
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
  // dies, and `goto queued` when they queued already (SPL).
  switch (ins & 0xff) {
    // MOV
    case 000: B->a = (u16)AA; break;
    case 001: B->b = (u16)AB; break;
    case 002: B->b = (u16)AA; break;
    case 003: B->a = (u16)AB; break;
    case 004: set_ab(B, Aab); break;
    case 005: set_ab(B, Aab >> 16 | Aab << 16); break;
    case 006: set_cell(B, Acell); break;

    // ADD
    case 010: B->a = (u16)WRAP(BA + AA); break;
    case 011: B->b = (u16)WRAP(BB + AB); break;
    case 012: B->b = (u16)WRAP(BB + AA); break;
    case 013: B->a = (u16)WRAP(BA + AB); break;
    case 014: case 016: B->a = (u16)WRAP(BA + AA); B->b = (u16)WRAP(BB + AB); break;
    case 015: B->a = (u16)WRAP(BA + AB); B->b = (u16)WRAP(BB + AA); break;

    // SUB: target minus source
#define SUBM(t, s) ((t) >= (s) ? (t) - (s) : (t) + n - (s))
    case 020: B->a = (u16)SUBM(BA, AA); break;
    case 021: B->b = (u16)SUBM(BB, AB); break;
    case 022: B->b = (u16)SUBM(BB, AA); break;
    case 023: B->a = (u16)SUBM(BA, AB); break;
    case 024: case 026: B->a = (u16)SUBM(BA, AA); B->b = (u16)SUBM(BB, AB); break;
    case 025: B->a = (u16)SUBM(BA, AB); B->b = (u16)SUBM(BB, AA); break;

    // MUL
    case 030: B->a = (u16)(BA * AA % n); break;
    case 031: B->b = (u16)(BB * AB % n); break;
    case 032: B->b = (u16)(BB * AA % n); break;
    case 033: B->a = (u16)(BA * AB % n); break;
    case 034: case 036: B->a = (u16)(BA * AA % n); B->b = (u16)(BB * AB % n); break;
    case 035: B->a = (u16)(BA * AB % n); B->b = (u16)(BB * AA % n); break;

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
    case 0116: case 0166: if (BAB == Aab && B->ins == Ains) next = INC(next); break;

    // SNE: skip when not equal
    case 0170: if (BA != AA) next = INC(next); break;
    case 0171: if (BB != AB) next = INC(next); break;
    case 0172: if (BB != AA) next = INC(next); break;
    case 0173: if (BA != AB) next = INC(next); break;
    case 0174: if (BAB != Aab) next = INC(next); break;
    case 0175: if (BB != AA || BA != AB) next = INC(next); break;
    case 0176: if (BAB != Aab || B->ins != Ains) next = INC(next); break;

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
        u32 v = 0; // pSpaceSize 0: mars.js stores undefined, which is 0
        if (psize) { u32 i = src % psize; v = i == 0 ? W->lastResult : W->pspace[i]; }
        if (onA) B->a = (u16)v; else B->b = (u16)v;
      } else if (psize) {
        u32 i = (onA ? BA : BB) % psize;
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
#undef WRAP
#undef DEC
#undef INC
#undef SUBM
}

// Executes the next instruction of warrior W, see exec_ins(). The most
// executed instruction words (tools/gen-dispatch.mjs, dispatch.h) have a
// case each that calls exec_ins() with the word as a constant: a copy of the
// instruction without run-time mode and opcode tests. The others run the
// generic code. clang compiles the sparse case labels into a tree of
// compares; that was faster than a table indexed by the word (one indirect
// jump that is harder to predict), and 32 cases were faster than 16, 24,
// 40, 48 or 64.
static inline __attribute__((always_inline)) int step(Cell *const C, const u32 n, const u32 mask, const u32 limit,
                                                      Warrior *const W, u16 *const q, u32 *const head, u32 *const tail) {
  const u32 pc = q[(*head)++ & mask];
  const Cell ir = C[pc];
  const u32 ins = ir.ins;
#ifdef COUNT_INS
  insCount[ins]++; // see bench-native.c
#endif
#define EXEC(word) exec_ins(C, n, mask, limit, W, q, head, tail, pc, ir, word)
#ifdef TRACE_TIES
  // The generic code only: the specialized cases behave the same.
  const int died = EXEC(ins);
  trace_step(W, pc, ir, *tail - *head);
  return died;
#else
  switch (ins) {
#include "dispatch.h"
  }
  return EXEC(ins);
#endif
#undef EXEC
}


// Executes up to `count` instructions (at least one) of the running round
// and returns how many it executed. Stops early when the round ends.
static __attribute__((noinline)) u64 execute(u64 count) {
  Cell *const C = core;
  const u32 n = N;
  const u32 mask = qmask;
  const u32 limit = maxProc;
  Warrior *W = &war[current];
  u64 total = 0;

  // One counter serves the instruction count, the time and the cycle
  // budget: every instruction uses up a cycle except the one that kills a
  // warrior's last process, and that case leaves the inner loop. `left`
  // counts down from `budget`; when it reaches 0 either `count` is done or
  // the cycle budget is used up (or both).
  for (;;) {
    i64 budget = cyclesLeft < 1 ? 1 : cyclesLeft; // like mars.js: at least one instruction
    if (count - total < (u64)budget) budget = (i64)(count - total);
    i64 left = budget;
    for (;;) {
      if (UNLIKELY(step(C, n, mask, limit, W, W->q, &W->head, &W->tail)) && W->tail == W->head) {
        // The warrior lost its last process. This instruction counts as
        // executed but uses up no cycle.
        const i64 cycled = budget - left;
        total += (u64)cycled + 1;
        timeNow += cycled + 1;
        cyclesLeft -= cycled;
        current = (u32)(W - war);
        warrior_died(current);
        if (roundOver || total >= count) return total;
        W = &war[current];
        goto next_budget;
      }
      W = W->nextW;
      if (UNLIKELY(--left == 0)) break;
    }
    // The inner loop used up its budget.
    total += (u64)budget;
    timeNow += budget;
    cyclesLeft -= budget;
    current = (u32)(W - war);
    if (cyclesLeft <= 0) mars_end_round();
    return total;
    next_budget:;
  }
}

// execute() for exactly two warriors: the queue counters of both live in
// local variables, and the loop body is unrolled into warrior 0's turn and
// warrior 1's turn. With two warriors the turns alternate until one loses
// its last process, which ends the round. n, mask and limit are the core
// size, queue mask and process limit, q0 and q1 the two queues: constants in
// execute2_8000().
static inline __attribute__((always_inline)) u64 execute2(u64 count, const u32 n, const u32 mask, const u32 limit,
                                                          u16 *const q0, u16 *const q1) {
  // When it is warrior 1's turn, execute() runs that one instruction, so that
  // the loop has a single entry. A jump into the second half of the loop
  // made it irreducible, and clang added a dispatch variable that V8 tested
  // on every iteration.
  u64 pre = 0;
  if (current == 1) {
    pre = execute(1);
    if (roundOver || pre == count) return pre;
    count -= pre;
  }
  Cell *const C = coreMem;
  Warrior *const W0 = &war[0], *const W1 = &war[1];
  u32 h0 = W0->head, t0 = W0->tail, h1 = W1->head, t1 = W1->tail;
  i64 budget = cyclesLeft < 1 ? 1 : cyclesLeft; // like execute()
  if (count < (u64)budget) budget = (i64)count;
  i64 left = budget;
  u32 cur = 0;  // whose turn is next when the loop stops
  u32 dead = 2; // the warrior that lost its last process, 2: none
  for (;;) {
    if (UNLIKELY(step(C, n, mask, limit, W0, q0, &h0, &t0)) && t0 == h0) { dead = 0; break; }
    if (UNLIKELY(--left == 0)) { cur = 1; break; }
    if (UNLIKELY(step(C, n, mask, limit, W1, q1, &h1, &t1)) && t1 == h1) { dead = 1; break; }
    if (UNLIKELY(--left == 0)) { cur = 0; break; }
  }
  W0->head = h0; W0->tail = t0;
  W1->head = h1; W1->tail = t1;
  if (dead < 2) {
    const i64 cycled = budget - left; // the fatal instruction uses no cycle
    timeNow += cycled + 1;
    cyclesLeft -= cycled;
    current = dead;
    warrior_died(dead); // ends the round
    return pre + (u64)cycled + 1;
  }
  timeNow += budget;
  cyclesLeft -= budget;
  current = cur;
  if (cyclesLeft <= 0) mars_end_round();
  return pre + (u64)budget;
}

// The standard settings (core size 8000, 8000 processes, linear queues) as
// constants: the wraparound compares and the queue addresses become
// immediates, and the queue mask goes away, which frees registers. Separate functions, so that V8 compiles
// only the one in use with its optimizing compiler (it tiers up per
// function, and a smaller function gets there sooner).
static __attribute__((noinline)) u64 execute2_8000(u64 count) {
  return execute2(count, 8000, ~0u, 8000, queueMem[0], queueMem[1]);
}
static __attribute__((noinline)) u64 execute2_any(u64 count) {
  return execute2(count, N, qmask, maxProc, war[0].q, war[1].q);
}

static u64 run_some(u64 count) {
  if (nw != 2) return execute(count);
  return N == 8000 && maxProc == 8000 && qmask == ~0u ? execute2_8000(count) : execute2_any(count);
}

// ---------------------------------------------------------------- API

// Executes up to `count` instructions, stops early when the round ends.
// Returns the number executed.
EXPORT(mars_run)
double mars_run(double count) {
  if (roundOver || !(count > 0)) return 0;
  u64 c = count >= 1.8e19 ? ~0ull : (u64)count;
  if ((double)c < count) c++; // a fraction rounds up, like mars.js
  return (double)run_some(c);
}

// Reserves the result log for `rounds` rounds of mars_run_match. Returns its
// address (0 when out of memory): per round logStride bytes, the instruction
// count as a double, then one alive flag per warrior.
EXPORT(mars_reserve_log)
u8 *mars_reserve_log(u32 rounds) {
  logStride = (8 + nw + 7) & ~7u;
  resultLog = alloc((usize)rounds * logStride);
  logRounds = resultLog ? rounds : 0;
  return resultLog;
}

EXPORT(mars_log_stride)
u32 mars_log_stride(void) { return logStride; }

// 1 for the opcodes that can kill a process (DAT, DIV and MOD with a zero
// divisor) or change the p-space (STP), from an instruction word.
#define BLOCKER(ins) ((0x41030u >> (((ins) & 0xff) >> 3)) & 1)

// Whether the core has a cell with DAT, DIV, MOD or STP. Starts at the cell
// where it found one last time: usually that one still is, or the next one
// is near, so the hot loop needs no bookkeeping for this.
static int core_has_blocker(void) {
  for (u32 k = 0, a = blockerAt; k < N; k++, a = a + 1 == N ? 0 : a + 1) {
    if (BLOCKER(core[a].ins)) { blockerAt = a; return 1; }
  }
  return 0;
}

// Early tie detection for mars_run_match. A process dies only when its
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
static i64 tie_check(void) {
  if (!core_has_blocker()) return 0;
  if (hasStp) return 4096;
  u32 minTasks = ~0u;
  for (u32 i = 0; i < nw; i++) {
    if (war[i].alive && war[i].tail - war[i].head < minTasks) minTasks = war[i].tail - war[i].head;
  }
  // c <= warriorsLeft * (minTasks - 1) <=> ceil(c / warriorsLeft) < minTasks
  const i64 c = cyclesLeft < 1 ? 1 : cyclesLeft;
  i64 margin = c - (i64)warriorsLeft * (minTasks - 1);
  if (margin <= 0) return 0;
  return margin < 256 ? 256 : margin > 4096 ? 4096 : margin;
}

// Plays `rounds` rounds. With earlyTie, rounds that must end in a tie stop
// early, see tie_check(). firstRound > 0 starts with round firstRound + 1 of
// the match: the positions and the first mover are those of that round,
// but p-space and the last results start empty, as at the start of a
// match. Returns the number of instructions executed.
//
// stopWidth >= 0 (two warriors only) stops the match early, which changes
// results against pMARS: warrior 0 gets 3, 1 or 0 points per round, and
// from round max(stopMin, 2) on, after every round, the match stops when the
// 95% interval of its points per 100 rounds is at most stopWidth wide. The
// played rounds are mars_round() - firstRound. Width 0 stops exactly when
// the first stopMin rounds all ended the same way.
EXPORT(mars_run_match)
double mars_run_match(u32 rounds, u32 earlyTie, u32 firstRound, double stopWidth, u32 stopMin) {
  // The positions of the skipped rounds: the generator steps exactly as if
  // they were played (placement does not depend on the core).
  for (u32 r = 0; r < firstRound; r++) place_warriors();
  round_ = firstRound;
  starter = firstRound % nw;
  logFirst = firstRound;
  u64 total = 0;
  const int skip = earlyTie;
  const int stop = stopWidth >= 0 && nw == 2;
  const u32 from = stopMin < 2 ? 2 : stopMin;
  double sum = 0, squares = 0;
  for (u32 r = 0; r < rounds; r++) {
    mars_start_round();
    while (!roundOver) {
      if (!skip) { total += run_some(~0ull); continue; }
      i64 chunk = tie_check();
      if (chunk == 0) {
        timeNow += cyclesLeft < 1 ? 1 : cyclesLeft;
        cyclesLeft = cyclesLeft < 1 ? cyclesLeft - 1 : 0; // as if executed
        mars_end_round();
        break;
      }
      total += run_some((u64)chunk);
    }
    if (stop) {
      // The same operations in the same order as the JS engine of
      // tools/tournament.mjs, so both stop after the same round.
#pragma clang fp contract(off)
      const double x = war[0].alive ? (war[1].alive ? 1 : 3) : 0;
      sum += x;
      squares += x * x;
      const double k = r + 1;
      if (r + 1 >= from) {
        const double m = sum / k;
        double v = (squares - k * m * m) / (k - 1);
        if (v < 0) v = 0;
        if (2 * 1.96 * __builtin_sqrt(v / k) * 100 <= stopWidth) break;
      }
    }
  }
  return (double)total;
}

// Read access for the glue.
EXPORT(mars_core) Cell *mars_core(void) { return core; }
EXPORT(mars_round) u32 mars_round(void) { return round_; }
EXPORT(mars_round_over) u32 mars_round_over(void) { return roundOver; }
EXPORT(mars_time) double mars_time(void) { return (double)timeNow; }
EXPORT(mars_cycles_left) double mars_cycles_left(void) { return (double)cyclesLeft; }
EXPORT(mars_warriors_left) u32 mars_warriors_left(void) { return warriorsLeft; }
EXPORT(mars_current) u32 mars_current(void) { return current; }
EXPORT(mars_starter) u32 mars_starter(void) { return starter; }
EXPORT(mars_seed) double mars_seed(void) { return (double)seed; }
EXPORT(mars_w_position) u32 mars_w_position(u32 i) { return war[i].position; }
EXPORT(mars_w_tasks) u32 mars_w_tasks(u32 i) { return war[i].tail - war[i].head; }
EXPORT(mars_w_alive) u32 mars_w_alive(u32 i) { return war[i].alive; }
EXPORT(mars_w_died_at) double mars_w_died_at(u32 i) { return (double)war[i].diedAt; }
EXPORT(mars_w_wins) u32 mars_w_wins(u32 i) { return war[i].wins; }
EXPORT(mars_w_losses) u32 mars_w_losses(u32 i) { return war[i].losses; }
EXPORT(mars_w_ties) u32 mars_w_ties(u32 i) { return war[i].ties; }
EXPORT(mars_w_last_result) u32 mars_w_last_result(u32 i) { return war[i].lastResult; }
EXPORT(mars_w_score) u32 *mars_w_score(u32 i) { return war[i].score; }
EXPORT(mars_w_pspace) u32 *mars_w_pspace(u32 i) { return war[i].pspace; }
// Address of the k-th process of warrior i (0: the next to run).
EXPORT(mars_w_process) u32 mars_w_process(u32 i, u32 k) { return war[i].q[(war[i].head + k) & qmask]; }
