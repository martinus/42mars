// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

#include "genome.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define NONE UINT32_MAX

static uint32_t wrap(int64_t v, uint32_t core) {
  int64_t m = v % (int64_t)core;
  return (uint32_t)(m < 0 ? m + core : m);
}

// A far value: any value, or with probability `fraction` a fraction of the
// core (1/2, 1/3, 2/3, 1/4, 3/4) give or take 20, the distances bombers and
// replicators use (an idea from YACE, which adds core/2, /3 or /4 to a small
// value in half of its numbers). Draws nothing extra with fraction 0.
static uint32_t far_value(rng *r, uint32_t core, const genome_style *st) {
  const double fraction = st ? st->fraction : 0;
  if (fraction > 0 && rng_chance(r, fraction)) {
    const uint32_t n = 2 + rng_below(r, 3), j = 1 + rng_below(r, n - 1);
    return wrap((int64_t)core * j / n + rng_range(r, -20, 20), core);
  }
  return rng_below(r, core);
}

// One of n choices: by the weights w when they are not all 0, else uniform.
static uint8_t pick(rng *r, const uint32_t *w, uint32_t n) {
  uint64_t total = 0;
  for (uint32_t i = 0; w && i < n; i++) total += w[i];
  if (!total) return (uint8_t)rng_below(r, n);
  uint64_t x = rng_below(r, total);
  for (uint32_t i = 0; i < n; i++) {
    if (x < w[i]) return (uint8_t)i;
    x -= w[i];
  }
  return (uint8_t)(n - 1);
}

// A random operand for an instruction of a genome with n instructions:
// a reference, a small value or a far value.
static void random_operand(rng *r, uint32_t core, uint32_t n, const genome_style *st, uint8_t *ref, uint32_t *v) {
  const uint32_t x = rng_below(r, 100);
  if (x < 40) {
    *ref = 1;
    *v = rng_below(r, n);
  } else if (x < 80) {
    *ref = 0;
    *v = wrap(rng_range(r, -16, 16), core);
  } else {
    *ref = 0;
    *v = far_value(r, core, st);
  }
}

static gene random_gene(rng *r, uint32_t core, uint32_t n, const genome_style *st) {
  gene g = {0};
  g.op = pick(r, st ? st->op : 0, GENOME_OPCODES);
  g.mod = pick(r, st ? st->mod : 0, 7);
  g.am = pick(r, st ? st->mode : 0, 8);
  g.bm = pick(r, st ? st->mode : 0, 8);
  random_operand(r, core, n, st, &g.aref, &g.a);
  random_operand(r, core, n, st, &g.bref, &g.b);
  return g;
}

void genome_random(genome *x, rng *r, uint32_t core, uint32_t len, const genome_style *st) {
  if (len < 1) len = 1;
  if (len > GENOME_MAX) len = GENOME_MAX;
  x->len = len;
  x->start = rng_below(r, len);
  for (uint32_t i = 0; i < len; i++) x->g[i] = random_gene(r, core, len, st);
}

void genome_code(const genome *x, uint32_t core, m42_instruction *out) {
  for (uint32_t i = 0; i < x->len; i++) {
    const gene *g = &x->g[i];
    m42_instruction *o = &out[i];
    o->opcode = g->op;
    o->modifier = g->mod;
    o->a_mode = g->am;
    o->b_mode = g->bm;
    o->a = g->aref ? wrap((int64_t)g->a - i, core) : g->a;
    o->b = g->bref ? wrap((int64_t)g->b - i, core) : g->b;
    o->line = (int32_t)i + 1;
  }
}

void genome_from_code(genome *x, const m42_instruction *code, uint32_t len, uint32_t start, uint32_t core) {
  x->len = len;
  x->start = start;
  for (uint32_t i = 0; i < len; i++) {
    const m42_instruction *c = &code[i];
    gene g = {c->opcode, c->modifier, c->a_mode, c->b_mode, 0, 0, 0, c->a, c->b};
    const uint32_t ta = (uint32_t)(((uint64_t)i + c->a) % core), tb = (uint32_t)(((uint64_t)i + c->b) % core);
    if (c->a_mode != 0 && ta < len) g.aref = 1, g.a = ta;
    if (c->b_mode != 0 && tb < len) g.bref = 1, g.b = tb;
    x->g[i] = g;
  }
}

uint64_t genome_hash(const genome *x, uint32_t core) {
  m42_instruction code[GENOME_MAX];
  genome_code(x, core, code);
  uint64_t h = 0xcbf29ce484222325u;
#define MIX(v) (h = (h ^ (uint64_t)(v)) * 0x100000001b3u)
  MIX(x->len);
  MIX(x->start);
  for (uint32_t i = 0; i < x->len; i++) {
    MIX(code[i].opcode | code[i].modifier << 8 | code[i].a_mode << 16 | (uint32_t)code[i].b_mode << 24);
    MIX(code[i].a);
    MIX(code[i].b);
  }
#undef MIX
  return h;
}

static const char *const OPCODES[] = {"MOV", "ADD", "SUB", "MUL", "DIV", "MOD", "JMZ", "JMN", "DJN", "CMP",
                                      "SLT", "SPL", "DAT", "JMP", "SEQ", "SNE", "NOP", "LDP", "STP"};
static const char *const MODIFIERS[] = {"A", "B", "AB", "BA", "F", "X", "I"};
static const char MODES[] = "#$@<>*{}";

size_t genome_text(const genome *x, uint32_t core, char *buf, size_t n) {
  m42_instruction code[GENOME_MAX];
  genome_code(x, core, code);
  size_t len = 0;
  char line[96];
  int k = snprintf(line, sizeof line, "        ORG     %u\n", x->start);
  for (uint32_t i = 0;; i++) {
    if (k > 0) {
      if (len + (size_t)k < n) memcpy(buf + len, line, (size_t)k);
      len += (size_t)k;
    }
    if (i == x->len) break;
    const m42_instruction *c = &code[i];
    const int64_t a = c->a > core / 2 ? (int64_t)c->a - core : c->a;
    const int64_t b = c->b > core / 2 ? (int64_t)c->b - core : c->b;
    char op[8];
    snprintf(op, sizeof op, "%s.%s", OPCODES[c->opcode], MODIFIERS[c->modifier]);
    k = snprintf(line, sizeof line, "        %-7s %c%lld, %c%lld\n", op, MODES[c->a_mode], (long long)a,
                 MODES[c->b_mode], (long long)b);
  }
  if (n) buf[len < n ? len : n - 1] = 0;
  return len;
}

void genome_rebuild(genome *child, const genome *a, const genome *b, const slot *s, uint32_t n, uint32_t core,
                    rng *r, const genome_style *st) {
  uint32_t map_a[GENOME_MAX], map_b[GENOME_MAX];
  for (uint32_t i = 0; i < GENOME_MAX; i++) map_a[i] = map_b[i] = NONE;
  for (uint32_t i = 0; i < n; i++) {
    if (s[i].src == SLOT_A && map_a[s[i].idx] == NONE) map_a[s[i].idx] = i;
    if (s[i].src == SLOT_B && map_b[s[i].idx] == NONE) map_b[s[i].idx] = i;
  }
  // An instruction of A that is gone: its references go to the next one
  // left, or the one before when none is left after it.
  uint32_t next = NONE;
  for (uint32_t t = a->len; t-- > 0;) {
    if (map_a[t] != NONE) next = map_a[t];
    else map_a[t] = next;
  }
  uint32_t prev = 0;
  for (uint32_t t = 0; t < a->len; t++) {
    if (map_a[t] == NONE) map_a[t] = prev;
    else prev = map_a[t];
  }
  genome out;
  out.len = n;
  for (uint32_t i = 0; i < n; i++) {
    const uint32_t idx = s[i].idx;
    if (s[i].src == SLOT_NEW) {
      out.g[i] = random_gene(r, core, n, st);
      continue;
    }
    gene g = s[i].src == SLOT_A ? a->g[idx] : b->g[idx];
    uint8_t *ref[2] = {&g.aref, &g.bref};
    uint32_t *val[2] = {&g.a, &g.b};
    for (int k = 0; k < 2; k++) {
      if (!*ref[k]) continue;
      const uint32_t t = *val[k];
      if (s[i].src == SLOT_A) {
        *val[k] = map_a[t];
      } else if (map_b[t] != NONE) {
        *val[k] = map_b[t];
      } else if (b == a) {
        *val[k] = map_a[t];
      } else {
        *ref[k] = 0;
        *val[k] = wrap((int64_t)t - idx, core);
      }
    }
    out.g[i] = g;
  }
  out.start = map_a[a->start];
  if (out.start >= n) out.start = 0;
  *child = out;
}

// ---------------------------------------------------------------- breeding

static void add_op(char *ops, size_t ops_n, const char *name) {
  const size_t len = strlen(ops);
  if (len + strlen(name) + 2 > ops_n) return;
  if (len) ops[len] = ' ', ops[len + 1] = 0;
  strcat(ops, name);
}

static void mutate_operand(rng *r, uint32_t core, uint32_t n, uint32_t i, const genome_style *st, uint8_t *ref,
                           uint32_t *v) {
  const uint32_t x = rng_below(r, 100);
  if (*ref) {
    if (x < 50) *v = rng_below(r, n);
    else if (x < 75) *v = (*v + (rng_below(r, 2) ? 1 : n - 1)) % n;
    else *ref = 0, *v = wrap((int64_t)*v - i + rng_range(r, -2, 2), core);
    return;
  }
  if (x < 35) *v = wrap((int64_t)*v + (rng_below(r, 2) ? 1 : -1) * rng_range(r, 1, 4), core);
  else if (x < 55) *v = wrap(rng_range(r, -16, 16), core);
  else if (x < 75) *v = far_value(r, core, st);
  else if (x < 85) *v = wrap(-(int64_t)*v, core);
  else if (x < 92) *v = rng_below(r, 2) ? wrap((int64_t)*v * 2, core) : *v / 2;
  else *ref = 1, *v = rng_below(r, n);
}

static void point(genome *x, rng *r, uint32_t core, const genome_style *st, char *ops, size_t ops_n) {
  const uint32_t i = rng_below(r, x->len);
  gene *g = &x->g[i];
  const uint32_t k = rng_below(r, 100);
  if (k < 15) g->op = pick(r, st ? st->op : 0, GENOME_OPCODES), add_op(ops, ops_n, "opcode");
  else if (k < 30) g->mod = pick(r, st ? st->mod : 0, 7), add_op(ops, ops_n, "modifier");
  else if (k < 40) g->am = pick(r, st ? st->mode : 0, 8), add_op(ops, ops_n, "mode");
  else if (k < 50) g->bm = pick(r, st ? st->mode : 0, 8), add_op(ops, ops_n, "mode");
  else if (k < 70) mutate_operand(r, core, x->len, i, st, &g->aref, &g->a), add_op(ops, ops_n, "operand");
  else if (k < 90) mutate_operand(r, core, x->len, i, st, &g->bref, &g->b), add_op(ops, ops_n, "operand");
  else if (k < 95) x->start = rng_below(r, x->len), add_op(ops, ops_n, "org");
  else *g = random_gene(r, core, x->len, st), add_op(ops, ops_n, "replace");
}

// A block length for a genome of len instructions: short ones are likely.
static uint32_t block(rng *r, uint32_t len) {
  uint32_t k = 1;
  while (k < len && rng_chance(r, 0.6)) k++;
  return k;
}

// The probabilities of the changes here and in point(), mutate_operand() and
// random_operand() are described in renderAbout() of ui/evolver.js: change
// both together.
void genome_breed(genome *child, const genome *p1, const genome *p2, rng *r, uint32_t core, uint32_t max_length,
                  const genome_style *st, char *ops, size_t ops_n) {
  if (ops_n) ops[0] = 0;
  if (max_length > GENOME_MAX) max_length = GENOME_MAX;
  genome x = *p1;
  slot s[GENOME_MAX];
  uint32_t changes = 1;
  while (changes < 6 && rng_chance(r, 0.35)) changes++;
  for (uint32_t c = 0; c < changes; c++) {
    const uint32_t kind = rng_below(r, 100), len = x.len;
    uint32_t n = 0;
    if (kind < 50) {
      point(&x, r, core, st, ops, ops_n);
      continue;
    } else if (kind < 60 && len < max_length) { // insert new instructions
      const uint32_t k = block(r, max_length - len), q = rng_below(r, len + 1);
      for (uint32_t i = 0; i < q; i++) s[n++] = (slot){SLOT_A, i};
      for (uint32_t i = 0; i < k; i++) s[n++] = (slot){SLOT_NEW, 0};
      for (uint32_t i = q; i < len; i++) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(&x, &x, &x, s, n, core, r, st);
      add_op(ops, ops_n, "insert");
    } else if (kind < 70 && len > 1) { // delete a block
      const uint32_t k = block(r, len - 1), p = rng_below(r, len - k + 1);
      for (uint32_t i = 0; i < len; i++)
        if (i < p || i >= p + k) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(&x, &x, &x, s, n, core, r, st);
      add_op(ops, ops_n, "delete");
    } else if (kind < 77 && len < max_length) { // duplicate a block
      const uint32_t k = block(r, len < max_length - len ? len : max_length - len);
      const uint32_t from = rng_below(r, len - k + 1), q = rng_below(r, len + 1);
      for (uint32_t i = 0; i < q; i++) s[n++] = (slot){SLOT_A, i};
      for (uint32_t i = 0; i < k; i++) s[n++] = (slot){SLOT_B, from + i};
      for (uint32_t i = q; i < len; i++) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(&x, &x, &x, s, n, core, r, st);
      add_op(ops, ops_n, "duplicate");
    } else if (kind < 84 && len > 1) { // move a block
      const uint32_t k = block(r, len - 1), from = rng_below(r, len - k + 1);
      const uint32_t q = rng_below(r, len - k + 1); // its place among the len - k others
      uint32_t others = 0;
      int placed = 0;
      for (uint32_t i = 0; i < len; i++) {
        if (i >= from && i < from + k) continue;
        if (others == q && !placed) {
          for (uint32_t j = 0; j < k; j++) s[n++] = (slot){SLOT_A, from + j};
          placed = 1;
        }
        s[n++] = (slot){SLOT_A, i};
        others++;
      }
      if (!placed)
        for (uint32_t j = 0; j < k; j++) s[n++] = (slot){SLOT_A, from + j};
      genome_rebuild(&x, &x, &x, s, n, core, r, st);
      add_op(ops, ops_n, "move");
    } else if (kind < 96 && p2) { // crossover: a block of p2 into or over a block of x
      const uint32_t k = block(r, p2->len < max_length ? p2->len : max_length);
      const uint32_t from = rng_below(r, p2->len - k + 1);
      uint32_t cut = rng_chance(r, 0.5) ? block(r, len) : 0; // instructions of x it replaces
      if (cut >= len) cut = len - 1;
      if (len - cut + k > max_length) cut = len + k - max_length;
      const uint32_t q = rng_below(r, len - cut + 1);
      for (uint32_t i = 0; i < q; i++) s[n++] = (slot){SLOT_A, i};
      for (uint32_t i = 0; i < k; i++) s[n++] = (slot){SLOT_B, from + i};
      for (uint32_t i = q + cut; i < len; i++) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(&x, &x, p2, s, n, core, r, st);
      add_op(ops, ops_n, cut ? "crossover-replace" : "crossover-insert");
    } else {
      point(&x, r, core, st, ops, ops_n);
    }
  }
  *child = x;
}

// ---------------------------------------------------------------- one change

const char *genome_change_name(int kind) {
  static const char *const names[CH_COUNT] = {
      "opcode", "modifier", "a-mode", "b-mode", "a-operand", "b-operand", "org", "replace", "insert", "delete",
      "duplicate", "move", "crossover-insert", "crossover-replace", "related-opcode", "related-mode", "shared-constant",
      "tune"};
  return kind >= 0 && kind < CH_COUNT ? names[kind] : "?";
}

// The family of an opcode: a number shared by related ones, -1 alone (MOV).
static int opcode_family(uint8_t op) {
  static const int8_t fam[GENOME_OPCODES] = {-1, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 4, 3, 3, 5};
  return op < GENOME_OPCODES ? fam[op] : -1;
}

static int mode_family(uint8_t m) { return m == 1 || m == 2 || m == 5 ? 0 : m >= 3 ? 1 : -1; }

static int32_t signed_value(uint32_t v, uint32_t core) { return v > core / 2 ? (int32_t)v - (int32_t)core : (int32_t)v; }

// The far value operands (not references, more than 16 away from 0).
static uint32_t far_operands(const genome *x, uint32_t core, uint32_t *at) {
  uint32_t n = 0;
  for (uint32_t i = 0; i < x->len; i++) {
    if (!x->g[i].aref && abs(signed_value(x->g[i].a, core)) > 16) at[n++] = i * 2;
    if (!x->g[i].bref && abs(signed_value(x->g[i].b, core)) > 16) at[n++] = i * 2 + 1;
  }
  return n;
}

static uint32_t *operand_at(genome *x, uint32_t k) { return k % 2 ? &x->g[k / 2].b : &x->g[k / 2].a; }

int genome_change(genome *x, const genome *p2, rng *r, uint32_t core, uint32_t max_length, const genome_style *st,
                  int kind) {
  if (max_length > GENOME_MAX) max_length = GENOME_MAX;
  const uint32_t len = x->len;
  slot s[GENOME_MAX];
  uint32_t n = 0;
  uint32_t at[2 * GENOME_MAX];
  if (kind <= CH_REPLACE) {
    const uint32_t i = rng_below(r, len);
    gene *g = &x->g[i];
    switch (kind) {
      case CH_OPCODE: g->op = pick(r, st ? st->op : 0, GENOME_OPCODES); break;
      case CH_MODIFIER: g->mod = pick(r, st ? st->mod : 0, 7); break;
      case CH_AMODE: g->am = pick(r, st ? st->mode : 0, 8); break;
      case CH_BMODE: g->bm = pick(r, st ? st->mode : 0, 8); break;
      case CH_AOPERAND: mutate_operand(r, core, len, i, st, &g->aref, &g->a); break;
      case CH_BOPERAND: mutate_operand(r, core, len, i, st, &g->bref, &g->b); break;
      case CH_ORG: x->start = rng_below(r, len); break;
      default: *g = random_gene(r, core, len, st);
    }
    return 1;
  }
  switch (kind) {
    case CH_INSERT: {
      if (len >= max_length) return 0;
      const uint32_t k = block(r, max_length - len), q = rng_below(r, len + 1);
      for (uint32_t i = 0; i < q; i++) s[n++] = (slot){SLOT_A, i};
      for (uint32_t i = 0; i < k; i++) s[n++] = (slot){SLOT_NEW, 0};
      for (uint32_t i = q; i < len; i++) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(x, x, x, s, n, core, r, st);
      return 1;
    }
    case CH_DELETE: {
      if (len < 2) return 0;
      const uint32_t k = block(r, len - 1), p = rng_below(r, len - k + 1);
      for (uint32_t i = 0; i < len; i++)
        if (i < p || i >= p + k) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(x, x, x, s, n, core, r, st);
      return 1;
    }
    case CH_DUPLICATE: {
      if (len >= max_length) return 0;
      const uint32_t k = block(r, len < max_length - len ? len : max_length - len);
      const uint32_t from = rng_below(r, len - k + 1), q = rng_below(r, len + 1);
      for (uint32_t i = 0; i < q; i++) s[n++] = (slot){SLOT_A, i};
      for (uint32_t i = 0; i < k; i++) s[n++] = (slot){SLOT_B, from + i};
      for (uint32_t i = q; i < len; i++) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(x, x, x, s, n, core, r, st);
      return 1;
    }
    case CH_MOVE: {
      if (len < 2) return 0;
      const uint32_t k = block(r, len - 1), from = rng_below(r, len - k + 1), q = rng_below(r, len - k + 1);
      uint32_t others = 0;
      int placed = 0;
      for (uint32_t i = 0; i < len; i++) {
        if (i >= from && i < from + k) continue;
        if (others == q && !placed) {
          for (uint32_t j = 0; j < k; j++) s[n++] = (slot){SLOT_A, from + j};
          placed = 1;
        }
        s[n++] = (slot){SLOT_A, i};
        others++;
      }
      if (!placed)
        for (uint32_t j = 0; j < k; j++) s[n++] = (slot){SLOT_A, from + j};
      genome_rebuild(x, x, x, s, n, core, r, st);
      return 1;
    }
    case CH_XINSERT:
    case CH_XREPLACE: {
      if (!p2) return 0;
      const uint32_t k = block(r, p2->len < max_length ? p2->len : max_length);
      const uint32_t from = rng_below(r, p2->len - k + 1);
      uint32_t cut = kind == CH_XREPLACE ? block(r, len) : 0;
      if (cut >= len) cut = len - 1;
      if (len - cut + k > max_length) cut = len + k - max_length;
      if (kind == CH_XINSERT && cut) return 0; // no room to insert
      const uint32_t q = rng_below(r, len - cut + 1);
      for (uint32_t i = 0; i < q; i++) s[n++] = (slot){SLOT_A, i};
      for (uint32_t i = 0; i < k; i++) s[n++] = (slot){SLOT_B, from + i};
      for (uint32_t i = q + cut; i < len; i++) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(x, x, p2, s, n, core, r, st);
      return 1;
    }
    case CH_RELATED_OPCODE: {
      uint32_t cand[GENOME_MAX], cn = 0;
      for (uint32_t i = 0; i < len; i++)
        if (opcode_family(x->g[i].op) >= 0) cand[cn++] = i;
      if (!cn) return 0;
      gene *g = &x->g[cand[rng_below(r, cn)]];
      uint8_t same[GENOME_OPCODES];
      uint32_t sn = 0;
      for (uint8_t o = 0; o < GENOME_OPCODES; o++)
        if (o != g->op && opcode_family(o) == opcode_family(g->op)) same[sn++] = o;
      g->op = same[rng_below(r, sn)];
      return 1;
    }
    case CH_RELATED_MODE: {
      const uint32_t i = rng_below(r, len);
      uint8_t *m = rng_below(r, 2) ? &x->g[i].am : &x->g[i].bm;
      if (*m == 0) {
        *m = 1;
        return 1;
      }
      uint8_t same[8];
      uint32_t sn = 0;
      for (uint8_t o = 1; o < 8; o++)
        if (o != *m && mode_family(o) == mode_family(*m)) same[sn++] = o;
      *m = same[rng_below(r, sn)];
      return 1;
    }
    case CH_SHARED: {
      const uint32_t fn = far_operands(x, core, at);
      if (fn < 2) return 0;
      const uint32_t to = rng_below(r, fn);
      uint32_t from = rng_below(r, fn - 1);
      if (from >= to) from++;
      const uint32_t v = *operand_at(x, at[from]);
      *operand_at(x, at[to]) = rng_below(r, 2) ? v : wrap(-(int64_t)v, core);
      return 1;
    }
    case CH_TUNE: {
      const uint32_t fn = far_operands(x, core, at);
      if (!fn) return 0;
      uint32_t *v = operand_at(x, at[rng_below(r, fn)]);
      const int32_t sv = signed_value(*v, core), most = abs(sv) / 50 > 4 ? abs(sv) / 50 : 4;
      const int32_t d = rng_range(r, 1, most) * (rng_below(r, 2) ? 1 : -1);
      *v = wrap((int64_t)sv + d, core);
      return 1;
    }
    default: return 0;
  }
}

// ---------------------------------------------------------------- state file

size_t genome_save(const genome *x, char *buf, size_t n) {
  size_t len = 0;
  int k = snprintf(buf, n, "%u %u", x->len, x->start);
  for (uint32_t i = 0;; i++) {
    if (k > 0) len += (size_t)k;
    if (i == x->len) break;
    const gene *g = &x->g[i];
    k = snprintf(len < n ? buf + len : 0, len < n ? n - len : 0, " %u %u %u %u %u %u %u %u", g->op, g->mod, g->am, g->bm,
                 g->aref, g->a, g->bref, g->b);
  }
  return len;
}

int genome_load(genome *x, const char *text, uint32_t core, const char **end) {
  char *e;
  const char *p = text;
  unsigned long v[8];
  unsigned long len = strtoul(p, &e, 10), start;
  if (e == p) return -1;
  p = e;
  start = strtoul(p, &e, 10);
  if (e == p || len < 1 || len > GENOME_MAX || start >= len) return -1;
  p = e;
  x->len = (uint32_t)len;
  x->start = (uint32_t)start;
  for (uint32_t i = 0; i < len; i++) {
    for (int k = 0; k < 8; k++) {
      v[k] = strtoul(p, &e, 10);
      if (e == p) return -1;
      p = e;
    }
    if (v[0] >= GENOME_OPCODES || v[1] > 6 || v[2] > 7 || v[3] > 7 || v[4] > 1 || v[6] > 1) return -1;
    if (v[5] >= (v[4] ? len : core) || v[7] >= (v[6] ? len : core)) return -1;
    x->g[i] = (gene){(uint8_t)v[0], (uint8_t)v[1], (uint8_t)v[2], (uint8_t)v[3], (uint8_t)v[4], (uint8_t)v[6], 0,
                     (uint32_t)v[5], (uint32_t)v[7]};
  }
  if (end) *end = p;
  return 0;
}
