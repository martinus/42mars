// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Measures how many instructions of tie rounds a proof of the form "this
// loop cannot die" could save at most (issue #27). Native only, built by
// tools/tie-ceiling.mjs from the input format of bench-native.c.
//
// Every round runs to its end. The driver notes when the early tie of
// run_match() would have stopped it (tie_check(), same schedule), and
// for every instruction which warrior ran which address, and how it writes.
// It also notes, per core cell, the last instruction that changed it (a
// shadow core: an instruction changes at most its B target and the
// indirection cells of its two operands).
//
// For each tie round of two warriors it prints one line:
//   TIE <match> <round> <length> <stopped at> <immortal 0> <immortal 1>
//       then per warrior: <t0 for |S| <= 1 2 4 8 16 32 64 any> <opponent
//       writes from t0(32)> <opponent writes from t0(any)>
// <immortal w>: the first instruction count after which warrior w has more
// processes than turns left (it can lose only one process per own turn),
// -1 if never. <t0>: the earliest instruction from which warrior w only
// executes a set S of at most that many cells, none of them DAT, DIV or
// MOD, and no cell of S changes until the round ends; the round length if
// there is none. This is known afterwards only: an upper bound for any
// proof, not a proof. Opponent writes: bits 1 MOV.I to a direct B operand
// ($ or #), 2 another write to a direct B operand, 4 a write through an
// indirect B operand, 8 a pre-/post-increment or decrement, OR over the
// opponent's instructions in that suffix. At the end of the line
// <closed 0> <closed 1>: 1 when, from T = max over both warriors of
// min(<immortal>, <t0 for 32>) on, the opponent never changes a cell that
// the warrior reads (its operands' indirection cells and targets) (#35).
// The last line: TOTAL <instructions executed with early ties> <rounds>.

#define TRACE_TIES 1
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "42mars.c" // lib/, see tools/tie-ceiling.mjs (-I)
#include "input.h"

static u8 *execW, *execKind;
static u16 *execPc;
static i32 *lastChange, *lastBy[2]; // last change of a cell, and by warrior
static u16 *execRead;               // 4 cells read per instruction
static u64 *shadow;
static u32 traceT, traceL;
static i64 tImm[2];

static void trace_step(const Mars *m, const Warrior *W, u32 pc, Cell ir, u32 tasks) {
  const u32 w = (u32)(W - m->war), t = traceT++;
  const u32 n = m->N;
  execW[t] = (u8)w;
  execPc[t] = (u16)pc;
  const u32 op = (ir.ins & 0xff) >> 3, mod = ir.ins & 7, am = (ir.ins >> 8) & 7, bm = ir.ins >> 11;
  u8 kind = 0;
  // MOV to MOD, DJN, LDP write their B target; # and $ (modes 0, 1) are direct.
  if (op <= 5 || op == 8 || op == 17) kind |= bm >= 2 ? 4 : (op == 0 && mod == 6 ? 1 : 2);
  const u32 incdec = (1u << 3) | (1u << 4) | (1u << 6) | (1u << 7);         // < > { }
  if ((incdec >> am & 1) || (incdec >> bm & 1)) kind |= 8;
  execKind[t] = kind;
  // Cells it reads: the indirection cells (indirect modes only) and both
  // targets.
  u16 *rd = &execRead[4 * (usize)t];
  rd[0] = (u16)(am >= 2 ? (pc + ir.a) % n : traceSource);
  rd[1] = (u16)traceSource;
  rd[2] = (u16)(bm >= 2 ? (pc + ir.b) % n : traceTarget);
  rd[3] = (u16)traceTarget;
  const u32 cand[3] = {(pc + ir.a) % n, (pc + ir.b) % n, traceTarget};
  for (int k = 0; k < 3; k++) {
    const u32 c = cand[k];
    const u64 v = cell_of(&CORE(m)[c]);
    if (v != shadow[c]) { shadow[c] = v; lastChange[c] = (i32)t; if (w < 2) lastBy[w][c] = (i32)t; }
  }
  // After its own turn the other warrior moves next, so w has
  // floor(remaining / 2) turns left.
  if (m->nw == 2 && tImm[w] < 0 && tasks > (traceL - (t + 1)) / 2) tImm[w] = t + 1;
}

static int killer(const Cell *c) {
  const u32 op = (c->ins & 0xff) >> 3;
  return op == 4 || op == 5 || op == 12; // DIV, MOD, DAT
}

#define NTH 8
static const u32 TH[NTH] = {1, 2, 4, 8, 16, 32, 64, ~0u};

// The closed-loop oracle for warrior w of the round just played.
static void analyze(const Mars *m, u32 w, u8 *inS, i64 *t0of32) {
  const u32 L = traceL;
  i64 t0[NTH];
  for (int k = 0; k < NTH; k++) t0[k] = L;
  memset(inS, 0, m->N);
  u32 size = 0, killers = 0;
  i64 M = -1;
  for (i64 t = (i64)L - 1; t >= 0; t--) {
    if (execW[t] == w) {
      const u32 c = execPc[t];
      if (!inS[c]) {
        inS[c] = 1;
        size++;
        if (lastChange[c] > M) M = lastChange[c];
        if (killer(&CORE(m)[c])) killers++;
      }
    }
    if (!(M < t && killers == 0)) break;
    for (int k = 0; k < NTH; k++) if (size <= TH[k]) t0[k] = t;
  }
  u32 kinds32 = 0, kindsAny = 0;
  for (i64 t = t0[NTH - 1]; t < L; t++) {
    if (execW[t] == w) continue;
    kindsAny |= execKind[t];
    if (t >= t0[5]) kinds32 |= execKind[t];
  }
  for (int k = 0; k < NTH; k++) printf(" %lld", (long long)t0[k]);
  printf(" %u %u", kinds32, kindsAny);
  *t0of32 = t0[5];
}

int main(int argc, char **argv) {
  FILE *f = argc > 1 ? fopen(argv[1], "r") : 0;
  if (!f) { fprintf(stderr, "usage: tie-ceiling <input>\n"); return 2; }
  double total = 0, rounds = 0;
  u32 match = 0, cap = 0;
  u8 *inS = malloc(65536);
  Match x;
  for (int got; (got = read_match(f, &x)) != 0;) {
    if (got < 0) { fprintf(stderr, "bad input\n"); return 2; }
    int status;
    m42_ctx *ctx = m42_new(&x.rules, &status);
    if (!ctx || m42_load(ctx, (const m42_warrior *const *)x.w, x.n, &x.options) != M42_OK) {
      fprintf(stderr, "match %u: %s\n", match, m42_status_text(ctx ? M42_ERR_MEMORY : status));
      return 2;
    }
    Mars *const m = CTX;
    const u32 len = x.n * x.rules.max_cycles + 2;
    if (len > cap) {
      cap = len;
      execW = realloc(execW, cap);
      execKind = realloc(execKind, cap);
      execPc = realloc(execPc, cap * sizeof(u16));
      execRead = realloc(execRead, 4 * (usize)cap * sizeof(u16));
    }
    lastChange = realloc(lastChange, m->N * sizeof(i32));
    lastBy[0] = realloc(lastBy[0], m->N * sizeof(i32));
    lastBy[1] = realloc(lastBy[1], m->N * sizeof(i32));
    shadow = realloc(shadow, m->N * sizeof(u64));
    if (!execW || !execKind || !execPc || !execRead || !lastChange || !lastBy[0] || !lastBy[1] || !shadow || !inS) { fprintf(stderr, "out of memory\n"); return 2; }
    for (u32 r = 0; r < x.options.rounds; r++) { // as run_match() with firstRound 0
      start_round(m);
      traceT = 0;
      traceL = (u32)m->cyclesLeft;
      tImm[0] = tImm[1] = -1;
      for (u32 c = 0; c < m->N; c++) { shadow[c] = cell_of(&CORE(m)[c]); lastChange[c] = lastBy[0][c] = lastBy[1][c] = -1; }
      i64 stopped = -1;
      while (!m->roundOver) {
        if (stopped < 0) {
          const i64 chunk = tie_check(m);
          if (chunk == 0) { stopped = traceT; continue; }
          run_some(m, (u64)chunk, 0);
        } else {
          run_some(m, ~0ull, 0);
        }
      }
      // trace_step() checks only the cells an instruction can change (its
      // B target and both indirection cells); any other write would make
      // lastChange wrong.
      for (u32 c = 0; c < m->N; c++) {
        if (cell_of(&CORE(m)[c]) != shadow[c]) { fprintf(stderr, "untracked write to cell %u in match %u round %u\n", c, match, r); return 1; }
      }
      const int tie = m->nw == 2 && m->war[0].alive && m->war[1].alive;
      if (stopped >= 0 && !tie) { fprintf(stderr, "early tie at %lld but no tie in match %u round %u\n", (long long)stopped, match, r); return 1; }
      total += stopped >= 0 ? (double)stopped : (double)traceT;
      rounds++;
      if (tie) {
        if (traceT != traceL) { fprintf(stderr, "tie round of %u instructions, expected %u\n", traceT, traceL); return 1; }
        printf("TIE %u %u %u %lld %lld %lld", match, r, traceL, (long long)(stopped >= 0 ? stopped : traceT), (long long)tImm[0], (long long)tImm[1]);
        i64 t32[2], s[2];
        analyze(m, 0, inS, &t32[0]);
        analyze(m, 1, inS, &t32[1]);
        // From T on, with |S| <= 32: does warrior w read only cells that the
        // opponent never changes again? Then both run as a closed system.
        for (int i = 0; i < 2; i++) s[i] = tImm[i] >= 0 && tImm[i] < t32[i] ? tImm[i] : t32[i];
        const i64 T = s[0] > s[1] ? s[0] : s[1];
        int closed[2] = {1, 1};
        for (i64 t = T; t < traceL; t++) {
          const u32 w = execW[t];
          for (int k = 0; k < 4 && closed[w]; k++) if (lastBy[1 - w][execRead[4 * (usize)t + k]] >= T) closed[w] = 0;
        }
        printf(" %d %d\n", closed[0], closed[1]);
      }
    }
    m42_free(ctx);
    free_match(&x);
    match++;
  }
  printf("TOTAL %.0f %.0f\n", total, rounds);
  return 0;
}
