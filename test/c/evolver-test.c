// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The evolver's genome (evolver/genome.c) and push-off (evolver/pushoff.c):
// references survive every edit, every child is a valid warrior, the text of
// a genome assembles back to its code, the state form reads back, and the
// SD-score has the values computed by hand in test/diversity.test.js.
// Prints "ok" and exits 0, or names the first failure and exits 1.
//
//   cc -O2 -Ilib -Ievolver -o evolver-test test/c/evolver-test.c evolver/genome.c evolver/pushoff.c lib/42mars.c -lm

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "42mars.h"
#include "genome.h"
#include "pushoff.h"

static int failures = 0;
#define CHECK(c, ...)                                     \
  do {                                                    \
    if (!(c)) {                                           \
      if (failures++ < 10) {                              \
        fprintf(stderr, "%s:%d: ", __FILE__, __LINE__);   \
        fprintf(stderr, __VA_ARGS__);                     \
        fputc('\n', stderr);                              \
      }                                                   \
    }                                                     \
  } while (0)

#define CORE 8000u

static int valid(const genome *g, uint32_t max_length) {
  if (g->len < 1 || g->len > max_length || g->start >= g->len) return 0;
  for (uint32_t i = 0; i < g->len; i++) {
    const gene *x = &g->g[i];
    if (x->op >= GENOME_OPCODES || x->mod > 6 || x->am > 7 || x->bm > 7) return 0;
    if (x->a >= (x->aref ? g->len : CORE) || x->b >= (x->bref ? g->len : CORE)) return 0;
  }
  return 1;
}

// A genome where instruction i carries the tag i in its B value and
// references instruction (i * 7 + 3) % len with its A operand.
static void tagged(genome *g, uint32_t len) {
  memset(g, 0, sizeof *g);
  g->len = len;
  g->start = len / 2;
  for (uint32_t i = 0; i < len; i++) {
    g->g[i].aref = 1;
    g->g[i].a = (i * 7 + 3) % len;
    g->g[i].b = 1000 + i;
  }
}

static uint32_t tag(const genome *g, uint32_t i) { return g->g[i].b - 1000; }

static void test_rebuild(void) {
  rng r = rng_seed(1, 2, 3);
  genome a, c;
  slot s[GENOME_MAX];
  for (int round = 0; round < 2000; round++) {
    const uint32_t len = 2 + rng_below(&r, 40);
    tagged(&a, len);
    // a random order of A's instructions, some left out, some new ones between
    uint32_t n = 0;
    uint8_t kept[GENOME_MAX] = {0};
    uint32_t order[GENOME_MAX];
    for (uint32_t i = 0; i < len; i++) order[i] = i;
    for (uint32_t i = len; i > 1; i--) {
      const uint32_t j = rng_below(&r, i), t = order[i - 1];
      order[i - 1] = order[j];
      order[j] = t;
    }
    for (uint32_t i = 0; i < len; i++) {
      if (rng_below(&r, 4) == 0 && n) continue; // left out
      if (rng_below(&r, 5) == 0) s[n++] = (slot){SLOT_NEW, 0};
      s[n++] = (slot){SLOT_A, order[i]};
      kept[order[i]] = 1;
    }
    genome_rebuild(&c, &a, &a, s, n, CORE, &r);
    CHECK(valid(&c, GENOME_MAX), "rebuild gave an invalid genome");
    for (uint32_t i = 0; i < n; i++) {
      if (s[i].src != SLOT_A) continue;
      const uint32_t old = s[i].idx, target = a.g[old].a;
      CHECK(c.g[i].aref, "a reference became a value");
      const uint32_t now = tag(&c, c.g[i].a);
      if (kept[target]) {
        CHECK(now == target, "a reference to a kept instruction moved: %u, not %u", now, target);
      } else {
        // the next instruction of A that is left, else the one before
        uint32_t expect = UINT32_MAX;
        for (uint32_t t = target + 1; t < len && expect == UINT32_MAX; t++)
          if (kept[t]) expect = t;
        for (uint32_t t = target; t-- > 0 && expect == UINT32_MAX;)
          if (kept[t]) expect = t;
        CHECK(now == expect, "a reference to gone %u points at %u, not %u", target, now, expect);
      }
    }
    if (kept[a.start]) CHECK(tag(&c, c.start) == a.start, "the start moved");
  }
}

static void test_duplicate_and_crossover(void) {
  rng r = rng_seed(4, 5, 6);
  genome a, b, c;
  slot s[GENOME_MAX];
  for (int round = 0; round < 2000; round++) {
    const uint32_t len = 3 + rng_below(&r, 30);
    tagged(&a, len);
    // a block [from, from + k) of b copied in front of a's instruction q
    const uint32_t k = 1 + rng_below(&r, len - 1), from = rng_below(&r, len - k + 1), q = rng_below(&r, len + 1);
    uint32_t n = 0;
    for (uint32_t i = 0; i < q; i++) s[n++] = (slot){SLOT_A, i};
    for (uint32_t i = 0; i < k; i++) s[n++] = (slot){SLOT_B, from + i};
    for (uint32_t i = q; i < len; i++) s[n++] = (slot){SLOT_A, i};
    // duplicate (b == a): copies reference copies inside the block, else the originals
    genome_rebuild(&c, &a, &a, s, n, CORE, &r);
    CHECK(valid(&c, GENOME_MAX), "duplicate gave an invalid genome");
    for (uint32_t i = 0; i < k; i++) {
      const uint32_t at = q + i, target = a.g[from + i].a;
      CHECK(c.g[at].aref && tag(&c, c.g[at].a) == target, "a duplicated reference points elsewhere");
      const int inside = target >= from && target < from + k;
      CHECK(inside == (c.g[at].a >= q && c.g[at].a < q + k), "a duplicated reference to %s the block",
            inside ? "inside" : "outside");
    }
    // crossover (b another genome): references out of the block become offsets
    tagged(&b, len);
    for (uint32_t i = 0; i < len; i++) b.g[i].b = 5000 + i;
    genome_rebuild(&c, &a, &b, s, n, CORE, &r);
    CHECK(valid(&c, GENOME_MAX), "crossover gave an invalid genome");
    m42_instruction code[GENOME_MAX], bcode[GENOME_MAX];
    genome_code(&c, CORE, code);
    genome_code(&b, CORE, bcode);
    for (uint32_t i = 0; i < k; i++) {
      const uint32_t at = q + i, target = b.g[from + i].a;
      if (target >= from && target < from + k) {
        CHECK(c.g[at].aref && c.g[at].a == q + (target - from), "an inner crossover reference is wrong");
      } else {
        CHECK(!c.g[at].aref && code[at].a == bcode[from + i].a, "an outer crossover reference lost its offset");
      }
    }
  }
}

static void test_breed(void) {
  rng r = rng_seed(7, 8, 9);
  genome p1, p2, c;
  char ops[96];
  m42_instruction code[GENOME_MAX];
  static unsigned char mem[1 << 16];
  const uint32_t limits[] = {1, 5, 20, 100, GENOME_MAX};
  for (int k = 0; k < 5; k++) {
    const uint32_t max = limits[k];
    genome_random(&p1, &r, CORE, 1 + rng_below(&r, max));
    genome_random(&p2, &r, CORE, 1 + rng_below(&r, max));
    for (int round = 0; round < 4000; round++) {
      genome_breed(&c, &p1, rng_below(&r, 2) ? &p2 : 0, &r, CORE, max, ops, sizeof ops);
      CHECK(valid(&c, max), "a child of length %u is invalid (max %u, %s)", c.len, max, ops);
      CHECK(ops[0], "a child without the name of a change");
      genome_code(&c, CORE, code);
      const m42_warrior *w = m42_warrior_make(code, c.len, c.start, 0, mem, sizeof mem);
      CHECK(w && m42_warrior_ok(w), "m42_warrior_make refused a child");
      if (rng_below(&r, 2)) p1 = c;
      else p2 = c;
    }
  }
}

static void test_text(void) {
  rng r = rng_seed(10, 11, 12);
  m42_rules rules = m42_rules_94();
  rules.max_length = GENOME_MAX;
  genome g, p2;
  char text[GENOME_MAX * 48 + 64], ops[96];
  static char src[GENOME_MAX * 48 + 128];
  m42_instruction code[GENOME_MAX];
  genome_random(&g, &r, CORE, 8);
  genome_random(&p2, &r, CORE, 8);
  for (int round = 0; round < 1500; round++) {
    genome_breed(&g, &g, &p2, &r, CORE, GENOME_MAX, ops, sizeof ops);
    const size_t len = genome_text(&g, CORE, text, sizeof text);
    CHECK(len < sizeof text, "text cut");
    const int n = snprintf(src, sizeof src, ";redcode-94nop\n;name t\n%s", text);
    int status;
    m42_warrior *w = m42_assemble_new(src, (size_t)n, &rules, 0, 0, &status);
    CHECK(w && m42_warrior_ok(w), "the text of a genome does not assemble:\n%s", src);
    if (!w || !m42_warrior_ok(w)) {
      m42_warrior_free(w);
      continue;
    }
    genome_code(&g, CORE, code);
    CHECK(m42_warrior_length(w) == g.len && m42_warrior_start(w) == g.start, "length or start differs");
    const m42_instruction *c = m42_warrior_code(w);
    for (uint32_t i = 0; i < g.len && i < m42_warrior_length(w); i++) {
      CHECK(c[i].opcode == code[i].opcode && c[i].modifier == code[i].modifier && c[i].a_mode == code[i].a_mode &&
                c[i].b_mode == code[i].b_mode && c[i].a == code[i].a && c[i].b == code[i].b,
            "instruction %u differs after assembling:\n%s", i, src);
    }
    m42_warrior_free(w);
    // the state form
    genome back;
    char saved[GENOME_MAX * 40 + 64];
    genome_save(&g, saved, sizeof saved);
    CHECK(genome_load(&back, saved, CORE, 0) == 0 && genome_hash(&back, CORE) == genome_hash(&g, CORE) &&
              memcmp(back.g, g.g, g.len * sizeof *g.g) == 0,
          "the state form does not read back");
    if (g.len > 40) genome_random(&g, &r, CORE, 8);
  }
  genome bad;
  CHECK(genome_load(&bad, "2 2 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0", CORE, 0) != 0, "a start past the end loads");
  CHECK(genome_load(&bad, "1 0 0 0 0 0 1 1 0 0", CORE, 0) != 0, "a reference past the end loads");
}

static void test_hash(void) {
  // the same warrior from a reference and from a value hashes the same
  genome a, b;
  tagged(&a, 4);
  b = a;
  for (uint32_t i = 0; i < 4; i++) {
    b.g[i].aref = 0;
    b.g[i].a = (a.g[i].a + CORE - i) % CORE;
  }
  CHECK(genome_hash(&a, CORE) == genome_hash(&b, CORE), "equal warriors hash differently");
  b.g[2].a = (b.g[2].a + 1) % CORE;
  CHECK(genome_hash(&a, CORE) != genome_hash(&b, CORE), "different A fields hash the same");
  b = a;
  b.g[1].b = (b.g[1].b + 1) % CORE;
  CHECK(genome_hash(&a, CORE) != genome_hash(&b, CORE), "different B fields hash the same");
  b = a;
  b.start = (b.start + 1) % b.len;
  CHECK(genome_hash(&a, CORE) != genome_hash(&b, CORE), "different starts hash the same");
}

static void test_pushoff(void) {
  // the matrix of test/diversity.test.js; the diagonal is never read
  const double S[16] = {0, 10, 20, 30, 5, 0, 25, 35, 0, 15, 0, 40, 1, 2, 3, 0};
  const uint32_t all[4] = {0, 1, 2, 3};
  double sigma[4];
  pushoff_sigma(S, 4, all, 4, sigma);
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 0, 1, sigma, SD_OPPONENT) - 1.7557391154451805) < 1e-12, "SD-score 0 1");
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 2, 3, sigma, SD_OPPONENT) - 2.890943994708568) < 1e-12, "SD-score 2 3");
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 0, 1, sigma, SD_SUM) - 0.7408076421173693) < 1e-12, "Eq. 6, 0 1");
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 2, 3, sigma, SD_SUM) - 1.8630962205724457) < 1e-12, "Eq. 6, 2 3");
  // a clone of the strongest goes first; kept indices never go
  const double C[25] = {0, 100, 250, 260, 240, 100, 0, 250, 260, 240, 10, 10, 0, 150, 90,
                        5, 5, 140, 0, 160, 20, 20, 80, 170, 0};
  const uint32_t five[5] = {0, 1, 2, 3, 4};
  double sg[5];
  pushoff_value v[5];
  pushoff_values(C, 5, five, 5, SD_OPPONENT, 1, sg, v);
  CHECK(v[0].distance == 0 && v[1].distance == 0, "clones have distance 0");
  CHECK(pushoff_weakest(v, 5, 0) == 1, "the higher index of two equal clones goes");
  const uint8_t keep[5] = {0, 1, 0, 0, 0};
  CHECK(pushoff_weakest(v, 5, keep) == 0, "a kept warrior went");
  // alpha 0: the average alone (test/diversity.test.js: 3 goes first)
  pushoff_values(S, 4, all, 4, SD_OPPONENT, 0, sigma, v);
  CHECK(pushoff_weakest(v, 4, 0) == 3, "alpha 0 is not the average");
}

int main(void) {
  test_rebuild();
  test_duplicate_and_crossover();
  test_breed();
  test_text();
  test_hash();
  test_pushoff();
  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ok");
  return 0;
}
