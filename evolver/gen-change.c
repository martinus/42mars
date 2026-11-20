// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

#include "gen-change.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define NONE UINT32_MAX

static uint32_t wrap(int64_t v, uint32_t core) {
  int64_t m = v % (int64_t)core;
  return (uint32_t)(m < 0 ? m + core : m);
}

static int32_t signed_value(uint32_t v, uint32_t core) { return v > core / 2 ? (int32_t)v - (int32_t)core : (int32_t)v; }

// An instruction line from a gene: a reference is a label, a value a number.
static void line_from_gene(gen_line *l, const gene *g) {
  memset(l, 0, sizeof *l);
  l->kind = GL_EMIT;
  l->op = g->op, l->mod = g->mod, l->am = g->am, l->bm = g->bm;
  l->x[0].n = l->x[1].n = 1;
  l->x[0].kind[0] = g->aref ? GT_POS : GT_NUM;
  l->x[0].v[0] = g->a;
  l->x[1].kind[0] = g->bref ? GT_POS : GT_NUM;
  l->x[1].v[0] = g->b;
}

void gen_from_genome(gen *x, const genome *g) {
  memset(x, 0, sizeof *x);
  x->n = g->len;
  x->start = g->start;
  for (uint32_t i = 0; i < g->len; i++) line_from_gene(&x->l[i], &g->g[i]);
}

// ---------------------------------------------------------------- units and sequences

// A sequence is the top level or the inside of a block; its units are its
// instructions, its calls and its blocks, each block whole.
typedef struct {
  uint32_t first, lines;
} unit;

typedef struct {
  uint32_t match[GEN_LINES];
  uint32_t nseq;
  uint32_t open[GEN_LINES + 1];  // the line that opens sequence s; NONE: the top level
  uint32_t units[GEN_LINES + 1]; // how many units it has
  uint32_t emits;                // instruction lines
  uint32_t places;               // the units of all sequences, and one more for each
} shape;

// The lines of sequence s: from .. to-1.
static void seq_lines(const gen *x, const shape *sh, uint32_t s, uint32_t *from, uint32_t *to) {
  *from = sh->open[s] == NONE ? 0 : sh->open[s] + 1;
  *to = sh->open[s] == NONE ? x->n : sh->match[sh->open[s]];
  if (*to > x->n) *to = x->n;
}

static uint32_t seq_units(const gen *x, const shape *sh, uint32_t s, unit *u) {
  uint32_t from, to, n = 0;
  seq_lines(x, sh, s, &from, &to);
  for (uint32_t i = from; i < to;) {
    const uint8_t kind = x->l[i].kind;
    const uint32_t lines = kind == GL_REPEAT || kind == GL_DEF ? (sh->match[i] < x->n ? sh->match[i] : x->n - 1) - i + 1 : 1;
    if (u) u[n] = (unit){i, lines};
    n++;
    i += lines;
  }
  return n;
}

static void shape_of(const gen *x, shape *sh) {
  gen_blocks(x, sh->match);
  sh->nseq = 1;
  sh->open[0] = NONE;
  sh->emits = 0;
  for (uint32_t i = 0; i < x->n; i++) {
    if (x->l[i].kind == GL_REPEAT || x->l[i].kind == GL_DEF) sh->open[sh->nseq++] = i;
    sh->emits += x->l[i].kind == GL_EMIT;
  }
  sh->places = 0;
  for (uint32_t s = 0; s < sh->nseq; s++) sh->places += (sh->units[s] = seq_units(x, sh, s, 0)) + 1;
}

// A sequence, a longer one more often. A generator without blocks has one,
// and this draws nothing: the list's changes draw nothing here either.
static uint32_t pick_sequence(const shape *sh, rng *r) {
  if (sh->nseq == 1) return 0;
  uint32_t d = rng_below(r, sh->places);
  for (uint32_t s = 0; s < sh->nseq; s++) {
    if (d <= sh->units[s]) return s;
    d -= sh->units[s] + 1;
  }
  return 0;
}

// The line where unit q of a sequence starts; behind its last unit: the
// line behind the sequence.
static uint32_t unit_line(const gen *x, const shape *sh, uint32_t s, const unit *u, uint32_t count, uint32_t q) {
  uint32_t from, to;
  seq_lines(x, sh, s, &from, &to);
  return q < count ? u[q].first : to;
}

// The lines a child is made of.
typedef struct {
  slot s[GEN_LINES];
  uint32_t n;
  int over; // more than GEN_LINES
} slots;

static void put(slots *o, uint8_t src, uint32_t first, uint32_t count) {
  for (uint32_t j = 0; j < count; j++) {
    if (o->n == GEN_LINES) {
      o->over = 1;
      return;
    }
    o->s[o->n++] = (slot){src, first + j};
  }
}

// ---------------------------------------------------------------- rebuild

void gen_rebuild(gen *child, const gen *a, const gen *b, const slot *s, uint32_t n, uint32_t core, rng *r,
                 const genome_style *st, const gen_info *info_b) {
  uint32_t map_a[GEN_LINES], map_b[GEN_LINES];
  for (uint32_t i = 0; i < GEN_LINES; i++) map_a[i] = map_b[i] = NONE;
  for (uint32_t i = 0; i < n; i++) {
    if (s[i].src == SLOT_A && map_a[s[i].idx] == NONE) map_a[s[i].idx] = i;
    if (s[i].src == SLOT_B && map_b[s[i].idx] == NONE) map_b[s[i].idx] = i;
  }
  // A line of a that is gone: its references go to the next one left, or
  // the one before when none is left after it.
  uint32_t next = NONE;
  for (uint32_t t = a->n; t-- > 0;) {
    if (map_a[t] != NONE) next = map_a[t];
    else map_a[t] = next;
  }
  uint32_t prev = 0;
  for (uint32_t t = 0; t < a->n; t++) {
    if (map_a[t] == NONE) map_a[t] = prev;
    else prev = map_a[t];
  }
  gen out; // a and b may be the child
  out.n = n;
  memcpy(out.c, a->c, sizeof out.c);
  const int same = b == a;
  for (uint32_t i = 0; i < n; i++) {
    const uint32_t idx = s[i].idx;
    gen_line *l = &out.l[i];
    if (s[i].src == SLOT_NEW) {
      const gene g = genome_random_gene(r, core, n, st);
      line_from_gene(l, &g);
      continue;
    }
    const int from_a = s[i].src == SLOT_A;
    *l = from_a ? a->l[idx] : b->l[idx];
    if (l->kind == GL_CALL) {
      const uint32_t t = l->callee;
      l->callee = from_a ? map_a[t] : map_b[t] != NONE ? map_b[t] : same ? map_a[t] : i; // its own line: no function
    }
    for (int k = 0; k < 2; k++) {
      gen_expr *e = &l->x[k];
      for (uint32_t j = 0; j < e->n; j++) {
        const uint32_t t = e->v[j];
        if (e->kind[j] == GT_CONST && !from_a && !same) {
          e->kind[j] = GT_NUM;
          e->v[j] = b->c[t] % core;
          continue;
        }
        if (e->kind[j] != GT_POS && e->kind[j] != GT_LEN) continue;
        if (from_a) {
          e->v[j] = map_a[t];
        } else if (map_b[t] != NONE) {
          e->v[j] = map_b[t];
        } else if (same) {
          e->v[j] = map_a[t];
        } else { // what it stood for in b's warrior
          int64_t v = 0;
          if (info_b && e->kind[j] == GT_POS && info_b->pos[t] != GEN_NONE && info_b->pos[idx] != GEN_NONE)
            v = (int64_t)info_b->pos[t] - info_b->pos[idx];
          if (info_b && e->kind[j] == GT_LEN && info_b->len[t] != GEN_NONE) v = info_b->len[t];
          e->kind[j] = GT_NUM;
          e->v[j] = wrap(v, core);
        }
      }
    }
  }
  out.start = map_a[a->start];
  if (out.start >= n) out.start = 0;
  child->n = out.n;
  child->start = out.start;
  memcpy(child->c, out.c, sizeof out.c);
  memcpy(child->l, out.l, n * sizeof out.l[0]);
}

// ---------------------------------------------------------------- one change

// x becomes the child made of the slots, when that child keeps the limits.
static int rebuilt(gen *x, const gen *b, const slots *o, uint32_t core, uint32_t max_length, rng *r, const genome_style *st,
                   const gen_info *info_b) {
  if (o->over || !o->n) return 0;
  gen child;
  gen_info info;
  gen_rebuild(&child, x, b, o->s, o->n, core, r, st, info_b);
  uint32_t emits = 0;
  for (uint32_t i = 0; i < child.n; i++) emits += child.l[i].kind == GL_EMIT;
  if (emits > max_length) return 0;
  m42_instruction code[GEN_LINES];
  gen_compile_info(&child, core, max_length, code, &info);
  if (info.truncated || !info.written) return 0;
  x->n = child.n;
  x->start = child.start;
  memcpy(x->l, child.l, child.n * sizeof child.l[0]);
  return 1;
}

// Instruction line number e of x.
static gen_line *emit_line(gen *x, uint32_t e, uint32_t *at) {
  for (uint32_t i = 0; i < x->n; i++)
    if (x->l[i].kind == GL_EMIT && !e--) {
      if (at) *at = i;
      return &x->l[i];
    }
  return 0;
}

// The far numbers of x: the number tokens more than 16 away from 0 in the
// operands of its instructions and the arguments of its calls.
static uint32_t far_numbers(gen *x, uint32_t core, uint32_t **at) {
  uint32_t n = 0;
  for (uint32_t i = 0; i < x->n; i++) {
    gen_line *l = &x->l[i];
    if (l->kind != GL_EMIT && l->kind != GL_CALL) continue;
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < l->x[k].n; t++)
        if (l->x[k].kind[t] == GT_NUM && abs(signed_value(l->x[k].v[t], core)) > 16) at[n++] = &l->x[k].v[t];
  }
  return n;
}

// An operand changed as genome_mutate_operand() changes one of a list: one
// of its numbers or labels. The other parts of an expression stay.
static int change_operand(gen *x, uint32_t line, int k, rng *r, uint32_t core, uint32_t max_length, const genome_style *st) {
  gen_expr *e = &x->l[line].x[k];
  uint32_t leaf[GEN_TOKENS], n = 0;
  for (uint32_t t = 0; t < e->n; t++)
    if (e->kind[t] == GT_NUM || e->kind[t] == GT_POS) leaf[n++] = t;
  if (!n) return 0;
  const uint32_t t = leaf[n > 1 ? rng_below(r, n) : 0];
  uint8_t ref = e->kind[t] == GT_POS;
  uint32_t v = e->v[t];
  int64_t offset = 0;
  if (ref) { // the distance the label stands for
    gen_info info;
    m42_instruction code[GEN_LINES];
    gen_compile_info(x, core, max_length, code, &info);
    if (info.pos[v] != GEN_NONE && info.pos[line] != GEN_NONE) offset = (int64_t)info.pos[v] - info.pos[line];
  }
  genome_mutate_operand(r, core, x->n, offset, st, &ref, &v);
  e->kind[t] = ref ? GT_POS : GT_NUM;
  e->v[t] = v;
  return 1;
}

// The functions that the lines marked in `in` call and that are not marked,
// and what those call: their blocks are marked and put behind the slots.
static void put_functions(slots *o, const gen *b, const shape *sb, uint8_t *in) {
  for (int more = 1; more;) {
    more = 0;
    for (uint32_t i = 0; i < b->n; i++) {
      if (!in[i] || b->l[i].kind != GL_CALL) continue;
      const uint32_t d = b->l[i].callee;
      if (d >= b->n || b->l[d].kind != GL_DEF || in[d] || sb->match[d] >= b->n) continue;
      const uint32_t lines = sb->match[d] - d + 1;
      for (uint32_t j = 0; j < lines; j++) in[d + j] = 1;
      put(o, SLOT_B, d, lines);
      more = 1;
    }
  }
}

int gen_change(gen *x, const gen *p2, rng *r, uint32_t core, uint32_t max_length, const genome_style *st, int kind) {
  if (max_length > GEN_LINES) max_length = GEN_LINES;
  shape sh, sh2;
  shape_of(x, &sh);
  slots o;
  o.n = 0, o.over = 0;
  unit u[GEN_LINES], u2[GEN_LINES];
  if (kind <= CH_REPLACE) {
    if (!sh.emits) return 0;
    uint32_t line = 0;
    gen_line *l = emit_line(x, rng_below(r, sh.emits), &line);
    switch (kind) {
      case CH_OPCODE: l->op = genome_pick(r, st ? st->op : 0, GENOME_OPCODES); break;
      case CH_MODIFIER: l->mod = genome_pick(r, st ? st->mod : 0, 7); break;
      case CH_AMODE: l->am = genome_pick(r, st ? st->mode : 0, 8); break;
      case CH_BMODE: l->bm = genome_pick(r, st ? st->mode : 0, 8); break;
      case CH_AOPERAND: return change_operand(x, line, 0, r, core, max_length, st);
      case CH_BOPERAND: return change_operand(x, line, 1, r, core, max_length, st);
      case CH_ORG: x->start = rng_below(r, x->n); break;
      default: {
        const gene g = genome_random_gene(r, core, x->n, st);
        line_from_gene(l, &g);
      }
    }
    return 1;
  }
  switch (kind) {
    case CH_INSERT: {
      if (sh.emits >= max_length) return 0;
      const uint32_t s = pick_sequence(&sh, r), count = seq_units(x, &sh, s, u);
      const uint32_t k = genome_block(r, max_length - sh.emits), q = rng_below(r, count + 1);
      const uint32_t at = unit_line(x, &sh, s, u, count, q);
      put(&o, SLOT_A, 0, at);
      for (uint32_t i = 0; i < k; i++) put(&o, SLOT_NEW, 0, 1);
      put(&o, SLOT_A, at, x->n - at);
      return rebuilt(x, x, &o, core, max_length, r, st, 0);
    }
    case CH_DELETE: {
      const uint32_t s = pick_sequence(&sh, r), count = seq_units(x, &sh, s, u);
      if (count < 2) return 0;
      const uint32_t k = genome_block(r, count - 1), p = rng_below(r, count - k + 1);
      const uint32_t from = u[p].first, to = unit_line(x, &sh, s, u, count, p + k);
      put(&o, SLOT_A, 0, from);
      put(&o, SLOT_A, to, x->n - to);
      return rebuilt(x, x, &o, core, max_length, r, st, 0);
    }
    case CH_DUPLICATE: {
      if (sh.emits >= max_length) return 0;
      const uint32_t s = pick_sequence(&sh, r), count = seq_units(x, &sh, s, u), room = max_length - sh.emits;
      if (!count) return 0;
      const uint32_t k = genome_block(r, count < room ? count : room);
      const uint32_t from = rng_below(r, count - k + 1), q = rng_below(r, count + 1);
      const uint32_t at = unit_line(x, &sh, s, u, count, q), first = u[from].first;
      put(&o, SLOT_A, 0, at);
      put(&o, SLOT_B, first, unit_line(x, &sh, s, u, count, from + k) - first);
      put(&o, SLOT_A, at, x->n - at);
      return rebuilt(x, x, &o, core, max_length, r, st, 0);
    }
    case CH_MOVE: {
      const uint32_t s = pick_sequence(&sh, r), count = seq_units(x, &sh, s, u);
      if (count < 2) return 0;
      const uint32_t k = genome_block(r, count - 1), from = rng_below(r, count - k + 1), q = rng_below(r, count - k + 1);
      // in front of the unit that is number q of the others, or behind the last
      const uint32_t first = u[from].first, end = unit_line(x, &sh, s, u, count, from + k);
      const uint32_t at = unit_line(x, &sh, s, u, count, q < from ? q : q + k);
      put(&o, SLOT_A, 0, at < first ? at : first);
      if (at < first) {
        put(&o, SLOT_A, first, end - first);
        put(&o, SLOT_A, at, first - at);
        put(&o, SLOT_A, end, x->n - end);
      } else {
        put(&o, SLOT_A, end, at - end);
        put(&o, SLOT_A, first, end - first);
        put(&o, SLOT_A, at, x->n - at);
      }
      return rebuilt(x, x, &o, core, max_length, r, st, 0);
    }
    case CH_XINSERT:
    case CH_XREPLACE: {
      if (!p2) return 0;
      shape_of(p2, &sh2);
      const uint32_t s2 = pick_sequence(&sh2, r), count2 = seq_units(p2, &sh2, s2, u2);
      if (!count2) return 0;
      const uint32_t k = genome_block(r, count2 < max_length ? count2 : max_length);
      const uint32_t from = rng_below(r, count2 - k + 1);
      const uint32_t s = pick_sequence(&sh, r), count = seq_units(x, &sh, s, u);
      uint32_t cut = kind == CH_XREPLACE && count ? genome_block(r, count) : 0;
      if (count && cut >= count) cut = count - 1;
      if (count - cut + k > max_length) cut = count + k - max_length;
      if (cut > count) return 0;
      if (kind == CH_XINSERT && cut) return 0; // no room to insert
      const uint32_t q = rng_below(r, count - cut + 1);
      const uint32_t first = u2[from].first, lines = unit_line(p2, &sh2, s2, u2, count2, from + k) - first;
      uint8_t in[GEN_LINES] = {0};
      for (uint32_t j = 0; j < lines; j++) {
        in[first + j] = 1;
        if (s && p2->l[first + j].kind == GL_DEF) return 0; // a function goes to the top level only
      }
      const uint32_t at = unit_line(x, &sh, s, u, count, q), on = unit_line(x, &sh, s, u, count, q + cut);
      put(&o, SLOT_A, 0, at);
      put(&o, SLOT_B, first, lines);
      put(&o, SLOT_A, on, x->n - on);
      put_functions(&o, p2, &sh2, in);
      gen_info info2; // where p2's lines are in its warrior, whatever max_length is here
      m42_instruction code[GEN_LINES];
      gen_compile_info(p2, core, GEN_LINES, code, &info2);
      return rebuilt(x, p2, &o, core, max_length, r, st, &info2);
    }
    case CH_RELATED_OPCODE: {
      uint32_t cand[GEN_LINES], cn = 0;
      for (uint32_t i = 0; i < x->n; i++)
        if (x->l[i].kind == GL_EMIT && genome_opcode_family(x->l[i].op) >= 0) cand[cn++] = i;
      if (!cn) return 0;
      gen_line *l = &x->l[cand[rng_below(r, cn)]];
      uint8_t same[GENOME_OPCODES];
      uint32_t sn = 0;
      for (uint8_t op = 0; op < GENOME_OPCODES; op++)
        if (op != l->op && genome_opcode_family(op) == genome_opcode_family(l->op)) same[sn++] = op;
      l->op = same[rng_below(r, sn)];
      return 1;
    }
    case CH_RELATED_MODE: {
      if (!sh.emits) return 0;
      gen_line *l = emit_line(x, rng_below(r, sh.emits), 0);
      uint8_t *m = rng_below(r, 2) ? &l->am : &l->bm;
      if (*m == 0) {
        *m = 1;
        return 1;
      }
      uint8_t same[8];
      uint32_t sn = 0;
      for (uint8_t mode = 1; mode < 8; mode++)
        if (mode != *m && genome_mode_family(mode) == genome_mode_family(*m)) same[sn++] = mode;
      *m = same[rng_below(r, sn)];
      return 1;
    }
    case CH_SHARED: {
      uint32_t *at[2 * GEN_TOKENS * GEN_LINES];
      const uint32_t fn = far_numbers(x, core, at);
      if (fn < 2) return 0;
      const uint32_t to = rng_below(r, fn);
      uint32_t from = rng_below(r, fn - 1);
      if (from >= to) from++;
      const uint32_t v = *at[from];
      *at[to] = rng_below(r, 2) ? v : wrap(-(int64_t)v, core);
      return 1;
    }
    case CH_TUNE: {
      uint32_t *at[2 * GEN_TOKENS * GEN_LINES];
      const uint32_t fn = far_numbers(x, core, at);
      if (!fn) return 0;
      uint32_t *v = at[rng_below(r, fn)];
      *v = genome_tune(r, core, *v);
      return 1;
    }
    default: return 0;
  }
}

// ---------------------------------------------------------------- breeding

void gen_breed(gen *child, const gen *p1, const gen *p2, rng *r, uint32_t core, uint32_t max_length, const genome_style *st,
               const genome_mix *mix, char *ops, size_t ops_n) {
  if (ops_n) ops[0] = 0;
  if (max_length > GEN_LINES) max_length = GEN_LINES;
  const genome_mix def = genome_mix_default();
  if (!mix) mix = &def;
  uint64_t total = 0;
  for (int k = 0; k < CH_COUNT; k++) total += mix->w[k];
  if (child != p1) *child = *p1;
  uint32_t changes = 1;
  while (changes < 6 && rng_chance(r, 0.35)) changes++;
  for (uint32_t c = 0; c < changes && total; c++) {
    for (int tries = 0; tries < 16; tries++) {
      uint64_t d = rng_below(r, total);
      int kind = 0;
      while (d >= mix->w[kind]) d -= mix->w[kind++];
      if (gen_change(child, p2, r, core, max_length, st, kind)) {
        const char *name = genome_change_name(kind);
        const size_t len = strlen(ops);
        if (len + strlen(name) + 2 <= ops_n) {
          if (len) ops[len] = ' ', ops[len + 1] = 0;
          strcat(ops, name);
        }
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- state file

size_t gen_save(const gen *x, char *buf, size_t n) {
  size_t len = 0;
#define PUT(...)                                                                    \
  do {                                                                              \
    const int k_ = snprintf(len < n ? buf + len : 0, len < n ? n - len : 0, __VA_ARGS__); \
    if (k_ > 0) len += (size_t)k_;                                                  \
  } while (0)
  PUT("%u %u", x->n, x->start);
  for (uint32_t k = 0; k < GEN_CONSTS; k++) PUT(" %u", x->c[k]);
  for (uint32_t i = 0; i < x->n && i < GEN_LINES; i++) {
    const gen_line *l = &x->l[i];
    PUT(" %u %u %u %u %u %u", l->kind, l->op, l->mod, l->am, l->bm, l->callee);
    for (int k = 0; k < 2; k++) {
      PUT(" %u", l->x[k].n);
      for (uint32_t t = 0; t < l->x[k].n && t < GEN_TOKENS; t++) PUT(" %u %u", l->x[k].kind[t], l->x[k].v[t]);
    }
  }
#undef PUT
  return len;
}

int gen_load(gen *x, const char *text, uint32_t core, const char **end) {
  const char *p = text;
  int bad = 0;
#define GET(into, most)                                 \
  do {                                                  \
    char *e_;                                           \
    const unsigned long v_ = strtoul(p, &e_, 10);       \
    if (e_ == p || v_ > (most)) bad = 1;                \
    p = e_;                                             \
    (into) = (uint32_t)v_;                              \
  } while (0)
  memset(x, 0, sizeof *x);
  GET(x->n, GEN_LINES);
  GET(x->start, GEN_LINES);
  for (uint32_t k = 0; k < GEN_CONSTS && !bad; k++) GET(x->c[k], UINT32_MAX);
  for (uint32_t i = 0; i < x->n && !bad; i++) {
    gen_line *l = &x->l[i];
    uint32_t v[6] = {0};
    for (int k = 0; k < 6 && !bad; k++) GET(v[k], k == 5 ? GEN_LINES : 255);
    l->kind = (uint8_t)v[0], l->op = (uint8_t)v[1], l->mod = (uint8_t)v[2], l->am = (uint8_t)v[3], l->bm = (uint8_t)v[4];
    l->callee = v[5];
    for (int k = 0; k < 2 && !bad; k++) {
      uint32_t tokens = 0;
      GET(tokens, GEN_TOKENS);
      if (bad) break;
      l->x[k].n = (uint8_t)tokens;
      for (uint32_t t = 0; t < tokens && !bad; t++) {
        uint32_t kind = 0;
        GET(kind, 255);
        l->x[k].kind[t] = (uint8_t)kind;
        GET(l->x[k].v[t], UINT32_MAX);
      }
    }
  }
#undef GET
  if (bad || gen_check(x, core, 0, 0)) return -1;
  if (end) *end = p;
  return 0;
}
