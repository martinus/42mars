// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The evolver's genome (evolver/genome.c) and push-off (evolver/pushoff.c):
// references survive every edit, every child is a valid warrior, the text of
// a genome assembles back to its code, the state form reads back, and the
// SD-score has the values computed by hand in test/diversity.test.js, and
// warriors get names.
// Prints "ok" and exits 0, or names the first failure and exits 1.
//
//   cc -O2 -Ilib -Ievolver -o evolver-test test/c/evolver-test.c evolver/genome.c evolver/pushoff.c evolver/names.c lib/42mars.c -lm

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "42mars.h"
#include "genome.h"
#include "names.h"
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
    genome_rebuild(&c, &a, &a, s, n, CORE, &r, 0);
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
    genome_rebuild(&c, &a, &a, s, n, CORE, &r, 0);
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
    genome_rebuild(&c, &a, &b, s, n, CORE, &r, 0);
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
  genome_style half = {0}; // far values near fractions half of the time, opcodes mostly MOV
  half.fraction = 0.5;
  half.op[0] = 10, half.op[12] = 1;
  for (int k = 0; k < 5; k++) {
    const uint32_t max = limits[k];
    genome_random(&p1, &r, CORE, 1 + rng_below(&r, max), 0);
    genome_random(&p2, &r, CORE, 1 + rng_below(&r, max), 0);
    for (int round = 0; round < 4000; round++) {
      genome_breed(&c, &p1, rng_below(&r, 2) ? &p2 : 0, &r, CORE, max, k == 2 ? &half : 0, 0, ops, sizeof ops);
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
  genome_random(&g, &r, CORE, 8, 0);
  genome_random(&p2, &r, CORE, 8, 0);
  for (int round = 0; round < 1500; round++) {
    genome_breed(&g, &g, &p2, &r, CORE, GENOME_MAX, 0, 0, ops, sizeof ops);
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
    if (g.len > 40) genome_random(&g, &r, CORE, 8, 0);
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
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 0, 1, sigma, 0, 0, 0, SD_OPPONENT, 0) - 1.7557391154451805) < 1e-12, "SD-score 0 1");
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 2, 3, sigma, 0, 0, 0, SD_OPPONENT, 0) - 2.890943994708568) < 1e-12, "SD-score 2 3");
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 0, 1, sigma, 0, 0, 0, SD_SUM, 0) - 0.7408076421173693) < 1e-12, "Eq. 6, 0 1");
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 2, 3, sigma, 0, 0, 0, SD_SUM, 0) - 1.8630962205724457) < 1e-12, "Eq. 6, 2 3");
  // --diversity panel: only the marked columns (test/diversity.test.js); the two add up to the whole
  const uint8_t only2[4] = {0, 0, 1, 0}, only3[4] = {0, 0, 0, 1};
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 0, 1, sigma, 0, 0, only2, SD_OPPONENT, 0) - 0.5309942440535915) < 1e-12, "column 2");
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 0, 1, sigma, 0, 0, only3, SD_OPPONENT, 0) - 1.224744871391589) < 1e-12, "column 3");
  // a clone of the strongest goes first; kept indices never go
  const double C[25] = {0, 100, 250, 260, 240, 100, 0, 250, 260, 240, 10, 10, 0, 150, 90,
                        5, 5, 140, 0, 160, 20, 20, 80, 170, 0};
  const uint32_t five[5] = {0, 1, 2, 3, 4};
  double sg[5];
  pushoff_value v[5];
  pushoff_values(C, 5, five, 5, SD_OPPONENT, 1, 0, 0, 0, 0, sg, v);
  CHECK(v[0].distance == 0 && v[1].distance == 0, "clones have distance 0");
  CHECK(pushoff_weakest(v, 5, 0) == 1, "the higher index of two equal clones goes");
  const uint8_t keep[5] = {0, 1, 0, 0, 0};
  CHECK(pushoff_weakest(v, 5, keep) == 0, "a kept warrior went");
  // alpha 0: the average alone (test/diversity.test.js: 3 goes first)
  pushoff_values(S, 4, all, 4, SD_OPPONENT, 0, 0, 0, 0, 0, sigma, v);
  CHECK(pushoff_weakest(v, 4, 0) == 3, "alpha 0 is not the average");
  // --noise (test/diversity.test.js has the arithmetic): 0 and 1 against
  // columns 2 and 3; column 2 differs by 30 with standard errors 6 and 8
  // (together 10), column 3 not at all
  const double N[16] = {0, 10, 100, 40, 20, 0, 130, 40, 50, 50, 0, 60, 70, 70, 80, 0};
  const double E[16] = {0, 0, 6, 3, 0, 0, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0};
  pushoff_sigma(N, 4, all, 4, sigma);
  CHECK(fabs(pushoff_distance(N, 4, all, 4, 0, 1, sigma, 0, 0, 0, SD_OPPONENT, 0) - 1.459992790176863) < 1e-12, "plain");
  CHECK(fabs(pushoff_distance(N, 4, all, 4, 0, 1, sigma, E, 1, 0, SD_OPPONENT, 0) - 0.9733285267845754) < 1e-12, "noise 1");
  CHECK(fabs(pushoff_distance(N, 4, all, 4, 0, 1, sigma, E, 2, 0, SD_OPPONENT, 0) - 0.4866642633922877) < 1e-12, "noise 2");
  CHECK(fabs(pushoff_distance(N, 4, all, 4, 0, 1, sigma, E, 1, 0, SD_SUM, 0) - 0.6671973756445573) < 1e-12, "noise 1, Eq. 6");
  CHECK(pushoff_distance(N, 4, all, 4, 0, 1, sigma, E, 3, 0, SD_OPPONENT, 0) == 0, "noise 3: no difference left");
  // --difference ahead: only where the first scores more. In column 2, 1 is
  // 30 ahead of 0; with noise 1 the 20 beyond the errors count, 0 is nowhere ahead
  CHECK(fabs(pushoff_distance(N, 4, all, 4, 1, 0, sigma, E, 1, 0, SD_OPPONENT, 1) - 0.9733285267845754) < 1e-12, "ahead, noise 1");
  CHECK(pushoff_distance(N, 4, all, 4, 0, 1, sigma, E, 1, 0, SD_OPPONENT, 1) == 0, "behind, noise 1");
  // in S, 1 is 5 ahead of 0 in columns 2 and 3: the whole SD-score one way, 0 the other
  pushoff_sigma(S, 4, all, 4, sigma);
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 1, 0, sigma, 0, 0, 0, SD_OPPONENT, 1) - 1.7557391154451805) < 1e-12, "ahead 1 0");
  CHECK(pushoff_distance(S, 4, all, 4, 0, 1, sigma, 0, 0, 0, SD_OPPONENT, 1) == 0, "ahead 0 1");
  // 2 against 3: 13 ahead in column 1, 1 behind in column 0 (sigma_0 = sqrt(14/3)); the two ways add up to the SD-score
  const double a23 = pushoff_distance(S, 4, all, 4, 2, 3, sigma, 0, 0, 0, SD_OPPONENT, 1);
  const double a32 = pushoff_distance(S, 4, all, 4, 3, 2, sigma, 0, 0, 0, SD_OPPONENT, 1);
  CHECK(fabs(a32 - 1 / sqrt(14.0 / 3)) < 1e-12 && fabs(a23 + a32 - 2.890943994708568) < 1e-12, "ahead 2 3: %.17g %.17g", a23, a32);
  // three equal strong warriors and one that loses to all: the SD-score
  // keeps the weak one (it differs) and pushes off a strong one; ahead it is
  // nowhere ahead of anyone and goes
  const double W[16] = {0, 150, 150, 250, 150, 0, 150, 250, 150, 150, 0, 250, 50, 50, 50, 0};
  double sw[4];
  pushoff_values(W, 4, all, 4, SD_OPPONENT, 1, 0, 0, 0, 0, sw, v);
  CHECK(v[3].distance > 0 && pushoff_weakest(v, 4, 0) == 2, "both ways: the weak one stays");
  pushoff_values(W, 4, all, 4, SD_OPPONENT, 1, 0, 0, 0, 1, sw, v);
  CHECK(v[3].distance == 0 && pushoff_weakest(v, 4, 0) == 3, "ahead: the weak one goes");
  // --difference shape (test/diversity.test.js has the arithmetic): the weighted median, then |a_k - b_k - c|
  CHECK(pushoff_shift((const double[]){3, 1, 2}, (const double[]){1, 1, 1}, 3) == 2, "median of 3");
  CHECK(pushoff_shift((const double[]){4, 1, 3, 2}, (const double[]){1, 1, 1, 1}, 4) == 2, "median of 4");
  CHECK(pushoff_shift((const double[]){1, 2, 3}, (const double[]){1, 1, 5}, 3) == 3, "weighted median");
  pushoff_sigma(S, 4, all, 4, sigma);
  CHECK(pushoff_distance(S, 4, all, 4, 0, 1, sigma, 0, 0, 0, SD_OPPONENT, DIFF_SHAPE) == 0, "shape 0 1");
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 2, 3, sigma, 0, 0, 0, SD_OPPONENT, DIFF_SHAPE) - 14 / sqrt(86.0 / 3)) < 1e-12, "shape 2 3");
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 3, 2, sigma, 0, 0, 0, SD_OPPONENT, DIFF_SHAPE) - 14 / sqrt(86.0 / 3)) < 1e-12, "shape 3 2");
  CHECK(fabs(pushoff_distance(S, 4, all, 4, 2, 3, sigma, 0, 0, 0, SD_SUM, DIFF_SHAPE) - 14 / (sqrt(14.0 / 3) + sqrt(86.0 / 3))) < 1e-12,
        "shape 2 3, Eq. 6");
  // a weaker copy of a profile leaves first, a weak warrior of another profile stays
  const double WS[25] = {0, 150, 200, 100, 150, 100, 0, 150, 50, 100, 150, 200, 0, 120, 140,
                         180, 220, 160, 0, 130, 60, 90, 40, 200, 0};
  pushoff_values(WS, 5, five, 5, SD_OPPONENT, 1, 0, 0, 0, DIFF_ABS, sg, v);
  CHECK(v[1].distance > 0 && pushoff_weakest(v, 5, 0) != 1, "abs: the weaker copy stays");
  pushoff_values(WS, 5, five, 5, SD_OPPONENT, 1, 0, 0, 0, DIFF_SHAPE, sg, v);
  CHECK(v[1].distance == 0 && v[1].nearest == 0 && pushoff_weakest(v, 5, 0) == 1 && v[4].distance > 0, "shape: the weaker copy goes");
  // --pushoff pareto: 0, 1 and 2 are not dominated, 3 is (by 0), 4 is a
  // copy of 0. Crowding of 0: by the first objective 2, 0, 4, 1 gives
  // (1 - 0) / 2, by the second 1, 0, 4, 2 gives (1 - 0) / 2; the copy 0
  const double O[10] = {1, 1, 2, 0, 0, 2, 0.5, 0.5, 1, 1};
  uint32_t fr[5];
  double cr[5];
  pareto_fronts(O, 5, 2, fr, cr);
  CHECK(fr[0] == 0 && fr[1] == 0 && fr[2] == 0 && fr[3] == 1 && fr[4] == 0, "fronts %u %u %u %u %u", fr[0], fr[1], fr[2], fr[3], fr[4]);
  CHECK(cr[0] == 1 && isinf(cr[1]) && isinf(cr[2]) && isinf(cr[3]) && cr[4] == 0, "crowding %g %g %g %g %g", cr[0], cr[1], cr[2], cr[3], cr[4]);
  // three objectives, one front of five on a line: the inner ones by their two gaps over the range 4, three times
  const double L[15] = {0, 4, 0, 1, 3, 1, 2, 2, 2, 3, 1, 3, 4, 0, 4};
  pareto_fronts(L, 5, 3, fr, cr);
  CHECK(fr[0] == 0 && fr[2] == 0 && fr[4] == 0 && fabs(cr[1] - 1.5) < 1e-12 && fabs(cr[2] - 1.5) < 1e-12 && isinf(cr[0]), "a line: %g %g", cr[1], cr[2]);
  CHECK(fabs(pushoff_se(50, 20, 100, 1) - 13.453624047073712) < 1e-12, "standard error");
  CHECK(pushoff_se(100, 0, 100, 1) == 0 && pushoff_se(0, 0, 0, 1) == 0, "standard error of a constant score");
}

static void test_names(void) {
  char a[64], b[64];
  for (uint32_t i = 0; i < NAME_ADJECTIVES; i++)
    for (uint32_t j = 0; j < i; j++) CHECK(strcmp(name_adjective(i), name_adjective(j)) != 0, "adjective %u twice", i);
  for (uint32_t i = 0; i < NAME_NOUNS; i++)
    for (uint32_t j = 0; j < i; j++) CHECK(strcmp(name_noun(i), name_noun(j)) != 0, "noun %u twice", i);
  const struct {
    uint32_t v;
    const char *text;
  } roman[] = {{1, "I"}, {2, "II"}, {4, "IV"}, {9, "IX"}, {14, "XIV"}, {40, "XL"}, {90, "XC"}, {400, "CD"}, {1994, "MCMXCIV"},
               {3999, "MMMCMXCIX"}, {4000, "4000"}};
  for (size_t i = 0; i < sizeof roman / sizeof *roman; i++) {
    name_roman(a, sizeof a, roman[i].v);
    CHECK(strcmp(a, roman[i].text) == 0, "%u is %s, not %s", roman[i].v, a, roman[i].text);
  }
  name_text(a, sizeof a, 0, 0, 0);
  CHECK(strcmp(a, "Crimson Mantis") == 0, "first name %s", a);
  name_text(b, sizeof b, 0, 0, 1);
  CHECK(strcmp(b, "Crimson Mantis II") == 0, "second name %s", b);
  name_text(b, sizeof b, 0, 0, 3);
  CHECK(strcmp(b, "Crimson Mantis IV") == 0, "fourth name %s", b);
}

// --fractions: with 1, every value that is neither a reference nor small
// lies within 20 of 1/2, 1/3, 2/3, 1/4 or 3/4 of the core, and those come
// up; with 0, most far values are elsewhere.
static void test_fractions(void) {
  rng r = rng_seed(13, 14, 15);
  const uint32_t frac[] = {CORE / 2, CORE / 3, CORE * 2 / 3, CORE / 4, CORE * 3 / 4};
  for (int k = 0; k < 2; k++) {
    uint32_t far = 0, near = 0, hits[5] = {0};
    for (int round = 0; round < 3000; round++) {
      genome g;
      genome_style st = {0};
      st.fraction = k ? 1.0 : 0.0;
      genome_random(&g, &r, CORE, 10, &st);
      for (uint32_t i = 0; i < g.len; i++) {
        const uint32_t v[2] = {g.g[i].aref ? 0 : g.g[i].a, g.g[i].bref ? 0 : g.g[i].b};
        for (int o = 0; o < 2; o++) {
          if (v[o] <= 16 || v[o] >= CORE - 16) continue; // a reference or a small value
          far++;
          for (int f = 0; f < 5; f++)
            if (v[o] + 20 >= frac[f] && v[o] <= frac[f] + 20) near++, hits[f]++, f = 5;
        }
      }
    }
    if (k) {
      CHECK(far > 1000 && near == far, "--fractions 1: %u of %u far values near a fraction", near, far);
      for (int f = 0; f < 5; f++) CHECK(hits[f] > far / 20, "fraction %d came up %u times of %u", f, hits[f], far);
    } else {
      CHECK(near < far / 10, "--fractions 0: %u of %u far values near a fraction", near, far);
    }
  }
}

// --prior: weights decide the opcodes, modifiers and modes of new
// instructions and of point changes; a weight 0 never comes up.
static void test_weights(void) {
  rng r = rng_seed(16, 17, 18);
  genome_style st = {0};
  st.op[0] = 3, st.op[12] = 1;   // MOV and DAT, 3:1
  st.mod[6] = 1;                 // .I only
  st.mode[1] = 1, st.mode[2] = 1; // $ and @
  uint32_t ops[GENOME_OPCODES] = {0}, other = 0;
  genome p1, c;
  genome_random(&p1, &r, CORE, 12, &st);
  char names[96];
  for (int round = 0; round < 3000; round++) {
    genome_breed(&c, &p1, &p1, &r, CORE, 40, &st, 0, names, sizeof names);
    p1 = c.len > 30 ? p1 : c;
    // a new lineage now and then: one that runs 3000 changes drifts away from
    // 3:1 by chance (duplicates copy what is there), 2:1 with some seeds
    if (round % 50 == 49) genome_random(&p1, &r, CORE, 12, &st);
    for (uint32_t i = 0; i < c.len; i++) {
      ops[c.g[i].op]++;
      other += c.g[i].mod != 6 || (c.g[i].am != 1 && c.g[i].am != 2) || (c.g[i].bm != 1 && c.g[i].bm != 2);
    }
  }
  CHECK(other == 0, "%u instructions with a modifier or mode of weight 0", other);
  CHECK(ops[0] + ops[12] > 0 && ops[0] > 2 * ops[12] && ops[0] < 4 * ops[12], "MOV %u, DAT %u, not about 3:1", ops[0], ops[12]);
  uint32_t rest = 0;
  for (int k = 0; k < GENOME_OPCODES; k++)
    if (k != 0 && k != 12) rest += ops[k];
  CHECK(rest == 0, "%u instructions with an opcode of weight 0", rest);
}

// genome_from_code() gives back the same code, with references for the
// operands that point into it.
static void test_from_code(void) {
  rng r = rng_seed(19, 20, 21);
  genome g, back;
  m42_instruction code[GENOME_MAX], again[GENOME_MAX];
  uint32_t refs = 0;
  for (int round = 0; round < 2000; round++) {
    genome_random(&g, &r, CORE, 1 + rng_below(&r, 60), 0);
    genome_code(&g, CORE, code);
    genome_from_code(&back, code, g.len, g.start, CORE);
    CHECK(valid(&back, GENOME_MAX), "an invalid genome from code");
    genome_code(&back, CORE, again);
    CHECK(back.len == g.len && back.start == g.start, "length or start lost");
    for (uint32_t i = 0; i < g.len; i++) {
      CHECK(memcmp(&code[i], &again[i], sizeof code[i]) == 0, "instruction %u changed", i);
      refs += back.g[i].aref + back.g[i].bref;
      if (code[i].a_mode == 0) CHECK(!back.g[i].aref, "an immediate operand became a reference");
    }
  }
  CHECK(refs > 1000, "only %u references", refs);
  // inserting an instruction in front keeps a loop: jmp to itself stays jmp 0
  m42_instruction loop[2] = {{13, 1, 1, 1, 0, 0, 1}, {12, 5, 0, 0, 0, 0, 2}}; // jmp.b $0, $0; dat.f #0, #0
  genome_from_code(&g, loop, 2, 0, CORE);
  CHECK(g.g[0].aref && g.g[0].a == 0 && !g.g[1].aref, "jmp 0 is not a reference to itself");
}

// genome_change(): every kind gives a valid genome; the four small steps
// change only what they say.
static void test_changes(void) {
  rng r = rng_seed(22, 23, 24);
  static const int fam_op[GENOME_OPCODES] = {-1, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 4, 3, 3, 5};
  uint32_t applied[CH_COUNT] = {0};
  for (int round = 0; round < 4000; round++) {
    genome p, q, c;
    genome_random(&p, &r, CORE, 2 + rng_below(&r, 30), 0);
    genome_random(&q, &r, CORE, 2 + rng_below(&r, 30), 0);
    const int kind = (int)rng_below(&r, CH_COUNT);
    c = p;
    if (!genome_change(&c, &q, &r, CORE, 40, 0, kind)) continue;
    applied[kind]++;
    CHECK(valid(&c, 40), "%s gave an invalid genome", genome_change_name(kind));
    if (kind < CH_RELATED_OPCODE || kind == CH_LOOP) continue; // the four small steps follow; loop copies a block
    CHECK(c.len == p.len && c.start == p.start, "%s changed the length or the start", genome_change_name(kind));
    uint32_t diff = 0;
    for (uint32_t i = 0; i < p.len; i++) {
      const gene *a = &p.g[i], *b = &c.g[i];
      if (memcmp(a, b, sizeof *a) == 0) continue;
      diff++;
      if (kind == CH_RELATED_OPCODE) {
        CHECK(a->op != b->op && fam_op[a->op] >= 0 && fam_op[a->op] == fam_op[b->op] && a->mod == b->mod && a->a == b->a && a->b == b->b,
              "related-opcode %u -> %u", a->op, b->op);
      } else if (kind == CH_RELATED_MODE) {
        const int am = a->am != b->am, bm = a->bm != b->bm;
        CHECK(am + bm == 1 && a->op == b->op && a->a == b->a && a->b == b->b, "related-mode changed more");
        const uint8_t from = am ? a->am : a->bm, to = am ? b->am : b->bm;
        const int ok = from == 0 ? to == 1 : (from == 1 || from == 2 || from == 5) ? (to == 1 || to == 2 || to == 5) : to >= 3;
        CHECK(ok && to != 0, "related-mode %u -> %u", from, to);
      } else {
        const int changed_a = a->a != b->a, changed_b = a->b != b->b;
        CHECK(changed_a + changed_b == 1 && a->op == b->op && a->am == b->am && a->bm == b->bm && a->aref == b->aref && a->bref == b->bref,
              "%s changed more than one value", genome_change_name(kind));
        const uint32_t was = changed_a ? a->a : a->b, now = changed_a ? b->a : b->b;
        if (kind == CH_TUNE) {
          const int32_t sw = was > CORE / 2 ? (int32_t)was - (int32_t)CORE : (int32_t)was;
          int32_t d = (int32_t)now - (int32_t)was;
          if (d > (int32_t)CORE / 2) d -= CORE;
          if (d < -(int32_t)CORE / 2) d += CORE;
          const int32_t most = abs(sw) / 50 > 4 ? abs(sw) / 50 : 4;
          CHECK(d != 0 && abs(d) <= most && abs(sw) > 16, "tune moved %d from %d", d, sw);
        } else { // shared: now equals another far value of the parent, or its negative
          int found = 0;
          for (uint32_t j = 0; j < p.len; j++)
            for (int o = 0; o < 2; o++) {
              const uint32_t v = o ? p.g[j].b : p.g[j].a;
              if ((o ? p.g[j].bref : p.g[j].aref) || (j == i && o == changed_b)) continue;
              found |= v == now || (CORE - v) % CORE == now;
            }
          CHECK(found, "shared-constant %u is no other value of the warrior", now);
        }
      }
    }
    CHECK(diff == 1, "%s changed %u instructions", genome_change_name(kind), diff);
  }
  // loop needs a donor with a loop, which few random warriors have (test_loop() has one)
  for (int k = 0; k < CH_COUNT; k++) CHECK(applied[k] > (k == CH_LOOP ? 10 : 50), "%s applied only %u times", genome_change_name(k), applied[k]);
}

// loop: a loop of the donor, from its jump back's target to the jump, with
// the cell it works through (the DAT its ADD and MOV point at), goes into the
// child whole, the jump still going back to the copy of its target; a child
// at the longest length gets it in place of as many instructions; a donor
// without a loop gives nothing.
static void test_loop(void) {
  rng r = rng_seed(31, 32, 33);
  // a DAT, then the Dwarf's loop (ADD.AB #4, $3; MOV.I $2, @2; JMP $-2), then the DAT both point at
  const m42_instruction d[5] = {{12, 4, 0, 0, 0, 0, 1},  {1, 2, 0, 1, 4, 3, 2}, {0, 6, 1, 2, 2, 2, 3},
                                {13, 1, 1, 1, CORE - 2, 0, 4}, {12, 4, 0, 0, 0, 0, 5}};
  genome donor, none, p, c;
  genome_from_code(&donor, d, 5, 1, CORE);
  m42_instruction flat[5] = {d[0], d[1], d[2], d[0], d[4]}; // the JMP a DAT: no loop
  genome_from_code(&none, flat, 5, 0, CORE);
  uint32_t full = 0;
  for (int round = 0; round < 300; round++) {
    const uint32_t len = round % 10 ? 2 + rng_below(&r, 30) : 40;
    genome_random(&p, &r, CORE, len, 0);
    c = p;
    CHECK(!genome_change(&c, &none, &r, CORE, 40, 0, CH_LOOP) && memcmp(&c, &p, sizeof c) == 0, "a donor without a loop gave one");
    CHECK(genome_change(&c, &donor, &r, CORE, 40, 0, CH_LOOP), "round %d: no loop from the Dwarf", round);
    CHECK(valid(&c, 40) && c.len == (len + 4 <= 40 ? len + 4 : 40), "round %d: length %u from %u", round, c.len, len);
    full += len == 40;
    m42_instruction code[GENOME_MAX];
    genome_code(&c, CORE, code);
    int found = 0;
    for (uint32_t i = 0; i + 3 < c.len && !found; i++) {
      const m42_instruction *k = &code[i];
      found = k[0].opcode == 1 && k[0].a == 4 && k[0].b == 3 && k[1].opcode == 0 && k[1].a == 2 && k[1].b == 2 &&
              k[2].opcode == 13 && k[2].a_mode == 1 && k[2].a == CORE - 2 && k[3].opcode == 12;
    }
    CHECK(found, "round %d: the loop is not whole in the child", round);
  }
  CHECK(full >= 20, "only %u children at the longest length", full);
}

// --changes: the text form reads back, bad texts are refused, and
// genome_breed() draws the kinds by their weights, never one of weight 0.
static void test_mix(void) {
  genome_mix m, back;
  char text[CH_COUNT * 32];
  const genome_mix def = genome_mix_default();
  uint32_t sum = 0;
  for (int k = 0; k < CH_COUNT; k++) sum += def.w[k];
  CHECK(sum == 1000 && def.w[CH_AOPERAND] == 108 && def.w[CH_XREPLACE] == 60 && def.w[CH_SHARED] == 0,
        "the default mix changed");
  genome_mix_text(&def, text, sizeof text);
  CHECK(genome_mix_parse(&back, text) == 0 && !memcmp(&back, &def, sizeof def), "the default mix does not read back: %s", text);
  CHECK(genome_mix_parse(&m, "tune=2,shared-constant=7") == 0 && m.w[CH_TUNE] == 2 && m.w[CH_SHARED] == 7 &&
            m.w[CH_OPCODE] == 0,
        "a mix of two");
  genome_mix_text(&m, text, sizeof text);
  CHECK(!strcmp(text, "shared-constant=7,tune=2"), "text %s", text);
  const char *bad[] = {"", "opcode", "opcode=", "opcode=x", "opcode=1,", "opcode=1,opcode=2", "opcodes=1",
                       "opcode=0", "opcode=1000001", "opcode=1;org=1", "opcode=-1", "=1"};
  for (size_t i = 0; i < sizeof bad / sizeof *bad; i++) {
    m = def;
    CHECK(genome_mix_parse(&m, bad[i]) == -1 && !memcmp(&m, &def, sizeof def), "\"%s\" was taken", bad[i]);
  }
  // opcode 1 : org 3, both always apply
  rng r = rng_seed(25, 26, 27);
  CHECK(genome_mix_parse(&m, "opcode=1,org=3") == 0, "opcode=1,org=3");
  genome p, c;
  char ops[96];
  uint32_t n_op = 0, n_org = 0, other = 0;
  for (int round = 0; round < 4000; round++) {
    genome_random(&p, &r, CORE, 2 + rng_below(&r, 20), 0);
    genome_breed(&c, &p, &p, &r, CORE, 40, 0, &m, ops, sizeof ops);
    for (char *t = strtok(ops, " "); t; t = strtok(0, " "))
      if (!strcmp(t, "opcode")) n_op++;
      else if (!strcmp(t, "org")) n_org++;
      else other++;
  }
  CHECK(other == 0 && n_op > 0 && n_org > 2.6 * n_op && n_org < 3.4 * n_op, "opcode %u, org %u, other %u", n_op, n_org,
        other);
  // a kind that never applies: crossover without a second parent leaves the child as it was
  CHECK(genome_mix_parse(&m, "crossover-insert=1") == 0, "crossover-insert=1");
  genome_random(&p, &r, CORE, 10, 0);
  genome_breed(&c, &p, 0, &r, CORE, 40, 0, &m, ops, sizeof ops);
  CHECK(!ops[0] && !memcmp(&c, &p, sizeof c), "crossover without a second parent changed something: %s", ops);
}

int main(void) {
  test_rebuild();
  test_duplicate_and_crossover();
  test_breed();
  test_text();
  test_hash();
  test_pushoff();
  test_names();
  test_fractions();
  test_weights();
  test_from_code();
  test_changes();
  test_loop();
  test_mix();
  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ok");
  return 0;
}
