// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

#include "genome.h"

#include "gen-change.h"

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
uint32_t genome_far_value(rng *r, uint32_t core, const genome_style *st) {
  const double fraction = st ? st->fraction : 0;
  if (fraction > 0 && rng_chance(r, fraction)) {
    const uint32_t n = 2 + rng_below(r, 3), j = 1 + rng_below(r, n - 1);
    return wrap((int64_t)core * j / n + rng_range(r, -20, 20), core);
  }
  return rng_below(r, core);
}

// One of n choices: by the weights w when they are not all 0, else uniform.
uint8_t genome_pick(rng *r, const uint32_t *w, uint32_t n) {
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
    *v = genome_far_value(r, core, st);
  }
}

gene genome_random_gene(rng *r, uint32_t core, uint32_t n, const genome_style *st) {
  gene g = {0};
  g.op = genome_pick(r, st ? st->op : 0, GENOME_OPCODES);
  g.mod = genome_pick(r, st ? st->mod : 0, 7);
  g.am = genome_pick(r, st ? st->mode : 0, 8);
  g.bm = genome_pick(r, st ? st->mode : 0, 8);
  random_operand(r, core, n, st, &g.aref, &g.a);
  random_operand(r, core, n, st, &g.bref, &g.b);
  return g;
}

void genome_random(genome *x, rng *r, uint32_t core, uint32_t len, const genome_style *st) {
  if (len < 1) len = 1;
  if (len > GENOME_MAX) len = GENOME_MAX;
  x->len = len;
  x->generated = 0;
  x->start = rng_below(r, len);
  for (uint32_t i = 0; i < len; i++) x->g[i] = genome_random_gene(r, core, len, st);
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
  x->generated = 0;
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
  gene out[GENOME_MAX]; // a and b may be the child
  for (uint32_t i = 0; i < n; i++) {
    const uint32_t idx = s[i].idx;
    if (s[i].src == SLOT_NEW) {
      out[i] = genome_random_gene(r, core, n, st);
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
    out[i] = g;
  }
  const uint32_t start = map_a[a->start];
  child->len = n;
  child->start = start < n ? start : 0;
  child->generated = 0;
  memcpy(child->g, out, n * sizeof *out);
}

// ---------------------------------------------------------------- the parts of a change

static void add_op(char *ops, size_t ops_n, const char *name) {
  const size_t len = strlen(ops);
  if (len + strlen(name) + 2 > ops_n) return;
  if (len) ops[len] = ' ', ops[len + 1] = 0;
  strcat(ops, name);
}

// The probabilities here, in random_operand() and in genome_mix_default() are
// described in renderAbout() of ui/evolver.js: change both together.
void genome_mutate_operand(rng *r, uint32_t core, uint32_t n, int64_t offset, const genome_style *st, uint8_t *ref,
                           uint32_t *v) {
  const uint32_t x = rng_below(r, 100);
  if (*ref) {
    if (x < 50) *v = rng_below(r, n);
    else if (x < 75) *v = (*v + (rng_below(r, 2) ? 1 : n - 1)) % n;
    else *ref = 0, *v = wrap(offset + rng_range(r, -2, 2), core);
    return;
  }
  if (x < 35) *v = wrap((int64_t)*v + (rng_below(r, 2) ? 1 : -1) * rng_range(r, 1, 4), core);
  else if (x < 55) *v = wrap(rng_range(r, -16, 16), core);
  else if (x < 75) *v = genome_far_value(r, core, st);
  else if (x < 85) *v = wrap(-(int64_t)*v, core);
  else if (x < 92) *v = rng_below(r, 2) ? wrap((int64_t)*v * 2, core) : *v / 2;
  else *ref = 1, *v = rng_below(r, n);
}

// A block length for a genome of len instructions: short ones are likely.
uint32_t genome_block(rng *r, uint32_t len) {
  uint32_t k = 1;
  while (k < len && rng_chance(r, 0.6)) k++;
  return k;
}

// ---------------------------------------------------------------- one change

const char *genome_change_name(int kind) {
  static const char *const names[CH_ALL] = {
      "opcode", "modifier", "a-mode", "b-mode", "a-operand", "b-operand", "org", "replace", "insert", "delete",
      "duplicate", "move", "crossover-insert", "crossover-replace", "related-opcode", "related-mode", "shared-constant",
      "tune", "loop", "repeat", "count", "fold", "unroll", "index", "expression", "constant", "extract", "parameter", "call", "inline",
      "transplant"};
  return kind >= 0 && kind < CH_ALL ? names[kind] : "?";
}

// The family of an opcode: a number shared by related ones, -1 alone (MOV).
int genome_opcode_family(uint8_t op) {
  static const int8_t fam[GENOME_OPCODES] = {-1, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 4, 3, 3, 5};
  return op < GENOME_OPCODES ? fam[op] : -1;
}

int genome_mode_family(uint8_t m) { return m == 1 || m == 2 || m == 5 ? 0 : m >= 3 ? 1 : -1; }

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

uint32_t genome_tune(rng *r, uint32_t core, uint32_t v) {
  const int32_t sv = signed_value(v, core), most = abs(sv) / 50 > 4 ? abs(sv) / 50 : 4;
  const int32_t d = rng_range(r, 1, most) * (rng_below(r, 2) ? 1 : -1);
  return wrap((int64_t)sv + d, core);
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
      case CH_OPCODE: g->op = genome_pick(r, st ? st->op : 0, GENOME_OPCODES); break;
      case CH_MODIFIER: g->mod = genome_pick(r, st ? st->mod : 0, 7); break;
      case CH_AMODE: g->am = genome_pick(r, st ? st->mode : 0, 8); break;
      case CH_BMODE: g->bm = genome_pick(r, st ? st->mode : 0, 8); break;
      case CH_AOPERAND: genome_mutate_operand(r, core, len, (int64_t)g->a - i, st, &g->aref, &g->a); break;
      case CH_BOPERAND: genome_mutate_operand(r, core, len, (int64_t)g->b - i, st, &g->bref, &g->b); break;
      case CH_ORG: x->start = rng_below(r, len); break;
      default: *g = genome_random_gene(r, core, len, st);
    }
    return 1;
  }
  switch (kind) {
    case CH_INSERT: {
      if (len >= max_length) return 0;
      const uint32_t k = genome_block(r, max_length - len), q = rng_below(r, len + 1);
      for (uint32_t i = 0; i < q; i++) s[n++] = (slot){SLOT_A, i};
      for (uint32_t i = 0; i < k; i++) s[n++] = (slot){SLOT_NEW, 0};
      for (uint32_t i = q; i < len; i++) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(x, x, x, s, n, core, r, st);
      return 1;
    }
    case CH_DELETE: {
      if (len < 2) return 0;
      const uint32_t k = genome_block(r, len - 1), p = rng_below(r, len - k + 1);
      for (uint32_t i = 0; i < len; i++)
        if (i < p || i >= p + k) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(x, x, x, s, n, core, r, st);
      return 1;
    }
    case CH_DUPLICATE: {
      if (len >= max_length) return 0;
      const uint32_t k = genome_block(r, len < max_length - len ? len : max_length - len);
      const uint32_t from = rng_below(r, len - k + 1), q = rng_below(r, len + 1);
      for (uint32_t i = 0; i < q; i++) s[n++] = (slot){SLOT_A, i};
      for (uint32_t i = 0; i < k; i++) s[n++] = (slot){SLOT_B, from + i};
      for (uint32_t i = q; i < len; i++) s[n++] = (slot){SLOT_A, i};
      genome_rebuild(x, x, x, s, n, core, r, st);
      return 1;
    }
    case CH_MOVE: {
      if (len < 2) return 0;
      const uint32_t k = genome_block(r, len - 1), from = rng_below(r, len - k + 1), q = rng_below(r, len - k + 1);
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
      const uint32_t k = genome_block(r, p2->len < max_length ? p2->len : max_length);
      const uint32_t from = rng_below(r, p2->len - k + 1);
      uint32_t cut = kind == CH_XREPLACE ? genome_block(r, len) : 0;
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
    case CH_LOOP: { // a loop of the donor p2, from its jump back's target to the jump, into x
      if (!p2) return 0;
      m42_instruction code[GENOME_MAX];
      genome_code(p2, core, code);
      uint32_t from, to;
      if (!genome_pick_loop(code, p2->len, core, r, &from, &to)) return 0;
      const uint32_t k = to - from + 1, cut = len + k > max_length ? len + k - max_length : 0; // what it replaces
      if (cut && cut >= len) return 0;
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
        if (genome_opcode_family(x->g[i].op) >= 0) cand[cn++] = i;
      if (!cn) return 0;
      gene *g = &x->g[cand[rng_below(r, cn)]];
      uint8_t same[GENOME_OPCODES];
      uint32_t sn = 0;
      for (uint8_t o = 0; o < GENOME_OPCODES; o++)
        if (o != g->op && genome_opcode_family(o) == genome_opcode_family(g->op)) same[sn++] = o;
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
        if (o != *m && genome_mode_family(o) == genome_mode_family(*m)) same[sn++] = o;
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
      *v = genome_tune(r, core, *v);
      return 1;
    }
    default: return 0;
  }
}

// ---------------------------------------------------------------- breeding

// How far back a jump by the offset a (mod the core) goes: 0 to itself, UINT32_MAX forward.
static uint32_t back_of(uint32_t a, uint32_t core) { return a == 0 ? 0 : a > core / 2 ? core - a : UINT32_MAX; }

int genome_pick_loop(const m42_instruction *code, uint32_t len, uint32_t core, rng *r, uint32_t *from, uint32_t *to) {
  enum { OP_JMZ = 6, OP_JMN = 7, OP_DJN = 8, OP_JMP = 13, MODE_DIRECT = 1 };
  uint32_t cand[GENOME_MAX], n = 0;
  for (uint32_t i = 0; i < len && i < GENOME_MAX; i++) {
    const m42_instruction *c = &code[i];
    if ((c->opcode != OP_JMP && c->opcode != OP_JMZ && c->opcode != OP_JMN && c->opcode != OP_DJN) || c->a_mode != MODE_DIRECT) continue;
    if (back_of(c->a, core) <= i) cand[n++] = i;
  }
  if (!n) return 0;
  uint32_t lo = cand[rng_below(r, n)], hi = lo;
  lo -= back_of(code[hi].a, core);
  // and the cells of the warrior that the block's operands point at (not #): the data a loop works
  // through, its pointers and what it copies; until nothing more is added
  for (int grown = 1; grown;) {
    grown = 0;
    for (uint32_t i = lo; i <= hi; i++)
      for (int o = 0; o < 2; o++) {
        if ((o ? code[i].b_mode : code[i].a_mode) == 0) continue;
        const uint32_t v = o ? code[i].b : code[i].a;
        const int64_t t = (int64_t)i + (v > core / 2 ? (int64_t)v - core : (int64_t)v);
        if (t < 0 || t >= (int64_t)len || t >= GENOME_MAX) continue;
        if ((uint32_t)t < lo) lo = (uint32_t)t, grown = 1;
        if ((uint32_t)t > hi) hi = (uint32_t)t, grown = 1;
      }
  }
  *from = lo, *to = hi;
  return 1;
}

genome_mix genome_mix_default(void) {
  // per mille; the point changes are 540 of them
  static const uint32_t w[CH_COUNT] = {81, 81, 54, 54, 108, 108, 27, 27, 100, 100, 70, 70, 60, 60, 0, 0, 0, 0, 0};
  genome_mix m = {{0}};
  memcpy(m.w, w, sizeof w);
  return m;
}

int genome_mix_parse(genome_mix *m, const char *text) {
  genome_mix out = {{0}};
  uint8_t named[CH_ALL] = {0};
  uint64_t total = 0;
  const char *p = text;
  for (;;) {
    const char *eq = strchr(p, '=');
    if (!eq) return -1;
    int kind = -1;
    for (int k = 0; k < CH_ALL; k++) {
      const char *name = genome_change_name(k);
      if (strlen(name) == (size_t)(eq - p) && !strncmp(p, name, (size_t)(eq - p))) kind = k;
    }
    if (kind < 0 || named[kind]) return -1;
    named[kind] = 1;
    p = eq + 1;
    if (*p < '0' || *p > '9') return -1;
    uint64_t v = 0;
    while (*p >= '0' && *p <= '9' && v <= 1000000) v = v * 10 + (uint64_t)(*p++ - '0');
    if (v > 1000000) return -1;
    out.w[kind] = (uint32_t)v;
    total += v;
    if (!*p) break;
    if (*p++ != ',') return -1;
  }
  if (!total) return -1;
  *m = out;
  return 0;
}

size_t genome_mix_text(const genome_mix *m, char *buf, size_t n) {
  size_t len = 0;
  if (n) buf[0] = 0;
  for (int k = 0; k < CH_ALL; k++) {
    if (!m->w[k]) continue;
    const int c = snprintf(len < n ? buf + len : 0, len < n ? n - len : 0, "%s%s=%u", len ? "," : "",
                           genome_change_name(k), m->w[k]);
    if (c > 0) len += (size_t)c;
  }
  return len;
}

// The list of x from its generator: the warrior it writes.
static void generate(genome *x, uint32_t core, uint32_t max_length) {
  m42_instruction code[GEN_LINES];
  uint32_t start;
  x->len = gen_compile(&x->p, core, max_length, code, &start, 0);
  x->start = start;
  x->generated = 1;
  for (uint32_t i = 0; i < x->len; i++)
    x->g[i] = (gene){code[i].opcode, code[i].modifier, code[i].a_mode, code[i].b_mode, 0, 0, 0, code[i].a, code[i].b};
}

void genome_from_generator(genome *x, const gen *p, uint32_t core, uint32_t max_length) {
  x->p = *p;
  generate(x, core, max_length);
}

void genome_as_generator(genome *x) {
  gen_from_genome(&x->p, x);
  x->generated = 1;
}

void genome_breed(genome *child, const genome *p1, const genome *p2, rng *r, uint32_t core, uint32_t max_length,
                  const genome_style *st, const genome_mix *mix, char *ops, size_t ops_n) {
  genome_breed_donors(child, p1, p2, 0, 0, r, core, max_length, st, mix, ops, ops_n);
}

void genome_breed_donors(genome *child, const genome *p1, const genome *p2, const genome *const *donors, uint32_t nd,
                         rng *r, uint32_t core, uint32_t max_length, const genome_style *st, const genome_mix *mix,
                         char *ops, size_t ops_n) {
  if (p1->generated) {
    const gen *gd[GENOME_DONORS_MAX];
    uint32_t gn = 0;
    for (uint32_t i = 0; i < nd && gn < GENOME_DONORS_MAX; i++)
      if (donors[i]->generated) gd[gn++] = &donors[i]->p;
    gen_breed_donors(&child->p, &p1->p, p2 && p2->generated ? &p2->p : 0, gd, gn, r, core, max_length, st, mix, ops, ops_n);
    generate(child, core, max_length);
    return;
  }
  if (ops_n) ops[0] = 0;
  if (max_length > GENOME_MAX) max_length = GENOME_MAX;
  const genome_mix def = genome_mix_default();
  if (!mix) mix = &def;
  uint64_t total = 0;
  for (int k = 0; k < CH_COUNT; k++) total += mix->w[k];
  genome x = *p1;
  uint32_t changes = 1;
  while (changes < 6 && rng_chance(r, 0.35)) changes++;
  for (uint32_t c = 0; c < changes && total; c++) {
    for (int tries = 0; tries < 16; tries++) {
      uint64_t d = rng_below(r, total);
      int kind = 0;
      while (d >= mix->w[kind]) d -= mix->w[kind++];
      const genome *mate = p2;
      if (kind == CH_LOOP) mate = nd ? donors[rng_below(r, nd)] : 0;
      if (genome_change(&x, mate, r, core, max_length, st, kind)) {
        add_op(ops, ops_n, genome_change_name(kind));
        break;
      }
    }
  }
  *child = x;
}

// ---------------------------------------------------------------- state file

size_t genome_save(const genome *x, char *buf, size_t n) {
  if (x->generated) {
    snprintf(buf, n, "gen ");
    return 4 + gen_save(&x->p, n > 4 ? buf + 4 : 0, n > 4 ? n - 4 : 0);
  }
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
  while (*p == ' ') p++;
  if (!strncmp(p, "gen ", 4)) {
    if (gen_load(&x->p, p + 4, core, end)) return -1;
    generate(x, core, GEN_LINES);
    return 0;
  }
  x->generated = 0;
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
