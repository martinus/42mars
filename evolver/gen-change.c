// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

#include "gen-change.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define NONE UINT32_MAX

static int keeps(const gen *x, uint32_t core, uint32_t max_length);
static void simplify(gen_expr *e, uint32_t core);

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
  // what mark_live() adds: the lines that the warrior has, and how many of
  // them are instructions. A change in a line that is never written (a
  // function nobody calls, a block that repeats 0 times) gives the same
  // warrior, which 42evolve has seen: the changes of a line take live ones.
  uint8_t live[GEN_LINES];
  uint32_t live_emits;
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

static void mark_live(const gen *x, shape *sh, uint32_t core, uint32_t max_length) {
  gen_info info;
  m42_instruction code[GEN_LINES];
  gen_compile_info(x, core, max_length, code, &info);
  sh->live_emits = 0;
  for (uint32_t i = 0; i < x->n; i++) {
    sh->live[i] = info.pos[i] != GEN_NONE;
    sh->live_emits += sh->live[i] && x->l[i].kind == GL_EMIT;
  }
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
                 const gen_info *info_b) {
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
      const gene g = genome_random_gene(r, core, n);
      line_from_gene(l, &g);
      continue;
    }
    if (s[i].src >= SLOT_REPEAT) {
      memset(l, 0, sizeof *l);
      l->kind = s[i].src == SLOT_REPEAT ? GL_REPEAT : s[i].src == SLOT_END ? GL_END : s[i].src == SLOT_DEF ? GL_DEF : GL_CALL;
      l->x[0].n = s[i].src == SLOT_REPEAT; // repeat 1
      l->x[0].v[0] = l->x[0].n;
      if (l->kind == GL_CALL) l->callee = i; // of no function yet
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

int gen_keeps(const gen *x, uint32_t core, uint32_t max_length) { return keeps(x, core, max_length); }

// Does x keep the limits of a child: no more instruction lines than
// max_length, a warrior that is whole and not empty?
static int keeps(const gen *x, uint32_t core, uint32_t max_length) {
  uint32_t emits = 0;
  for (uint32_t i = 0; i < x->n; i++) emits += x->l[i].kind == GL_EMIT;
  if (emits > max_length) return 0;
  gen_info info;
  m42_instruction code[GEN_LINES];
  gen_compile_info(x, core, max_length, code, &info);
  if (info.truncated || !info.written) return 0;
  return 1;
}

// x becomes the child made of the slots, when that child keeps the limits.
static int rebuilt(gen *x, const gen *b, const slots *o, uint32_t core, uint32_t max_length, rng *r,
                   const gen_info *info_b) {
  if (o->over || !o->n) return 0;
  gen child;
  gen_rebuild(&child, x, b, o->s, o->n, core, r, info_b);
  if (!keeps(&child, core, max_length)) return 0;
  x->n = child.n;
  x->start = child.start;
  memcpy(x->l, child.l, child.n * sizeof child.l[0]);
  return 1;
}

// Live instruction line number e of x.
static gen_line *emit_line(gen *x, const shape *sh, uint32_t e, uint32_t *at) {
  for (uint32_t i = 0; i < x->n; i++)
    if (x->l[i].kind == GL_EMIT && sh->live[i] && !e--) {
      if (at) *at = i;
      return &x->l[i];
    }
  return 0;
}

// The far numbers of x: the number tokens more than 16 away from 0 in the
// operands of its live instructions and the arguments of its live calls.
static uint32_t far_numbers(gen *x, const shape *sh, uint32_t core, uint32_t **at) {
  uint32_t n = 0;
  for (uint32_t i = 0; i < x->n; i++) {
    gen_line *l = &x->l[i];
    if ((l->kind != GL_EMIT && l->kind != GL_CALL) || !sh->live[i]) continue;
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < l->x[k].n; t++)
        if (l->x[k].kind[t] == GT_NUM && abs(signed_value(l->x[k].v[t], core)) > 16) at[n++] = &l->x[k].v[t];
  }
  return n;
}

// The far fields of x, for shared-target: the operands of its live
// instructions that are one number more than 16 away from 0, and the line of
// each. On a generator without structure those of the list, in its order.
static uint32_t far_fields(gen *x, const shape *sh, uint32_t core, uint32_t **at, uint32_t *line) {
  uint32_t n = 0;
  for (uint32_t i = 0; i < x->n; i++) {
    gen_line *l = &x->l[i];
    if (l->kind != GL_EMIT || !sh->live[i]) continue;
    for (int k = 0; k < 2; k++)
      if (l->x[k].n == 1 && l->x[k].kind[0] == GT_NUM && abs(signed_value(l->x[k].v[0], core)) > 16)
        line[n] = i, at[n++] = &l->x[k].v[0];
  }
  return n;
}

// An operand changed as genome_mutate_operand() changes one of a list: one
// of its numbers or labels. The other parts of an expression stay.
static int change_operand(gen *x, uint32_t line, int k, rng *r, uint32_t core, uint32_t max_length) {
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
  genome_mutate_operand(r, core, x->n, offset, &ref, &v);
  e->kind[t] = ref ? GT_POS : GT_NUM;
  e->v[t] = v;
  return 1;
}

// A change of the instruction at `line`: CH_OPCODE .. CH_REPLACE.
static int point_change(gen *x, uint32_t line, int kind, rng *r, uint32_t core, uint32_t max_length) {
  gen_line *l = &x->l[line];
  switch (kind) {
    case CH_OPCODE: l->op = (uint8_t)rng_below(r, GENOME_OPCODES); break;
    case CH_MODIFIER: l->mod = (uint8_t)rng_below(r, 7); break;
    case CH_AMODE: l->am = (uint8_t)rng_below(r, 8); break;
    case CH_BMODE: l->bm = (uint8_t)rng_below(r, 8); break;
    case CH_AOPERAND: return change_operand(x, line, 0, r, core, max_length);
    case CH_BOPERAND: return change_operand(x, line, 1, r, core, max_length);
    case CH_ORG: x->start = rng_below(r, x->n); break;
    default: {
      const gene g = genome_random_gene(r, core, x->n);
      line_from_gene(l, &g);
    }
  }
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

// ---------------------------------------------------------------- the rewrites

static void set(gen *x, const gen *child) {
  x->n = child->n;
  x->start = child->start;
  memcpy(x->c, child->c, sizeof x->c);
  memcpy(x->l, child->l, child->n * sizeof child->l[0]);
}

// Do a and b write the same warrior? Every rewrite ends with this: the
// cases where a rewrite must not apply are many (a label of the nearest
// call, a line that only a later repetition writes, 8 frames deep already),
// and a rule for each is easy to miss.
static int same_warrior(const gen *a, const gen *b, uint32_t core) {
  m42_instruction ca[GEN_LINES], cb[GEN_LINES];
  gen_info ia, ib;
  const uint32_t na = gen_compile_info(a, core, GEN_LINES, ca, &ia), nb = gen_compile_info(b, core, GEN_LINES, cb, &ib);
  return na == nb && ia.start == ib.start && ia.truncated == ib.truncated && ia.written == ib.written && !memcmp(ca, cb, na * sizeof *ca);
}

// The `i` of the lines from .. to-1 that means a loop around them, not one
// of their own, moves out by one loop: i becomes j, j becomes k. 0 when a k
// would have to move.
static int index_out(gen *x, uint32_t from, uint32_t to) {
  uint32_t own = 0; // their own repeats that are open
  for (uint32_t i = from; i < to; i++) {
    gen_line *l = &x->l[i];
    if (l->kind == GL_END && own) own--;
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < l->x[k].n; t++)
        if (l->x[k].kind[t] == GT_INDEX && l->x[k].v[t] >= own) {
          if (l->x[k].v[t] >= 2) return 0;
          l->x[k].v[t]++;
        }
    if (l->kind == GL_REPEAT) own++;
  }
  return 1;
}

// Does a line refer to a line of a function from outside that function?
// Such a label means the instance of the nearest call, and which call that
// is changes when calls come into a block or out of one.
static int function_labels(const gen *x) {
  uint32_t match[GEN_LINES];
  gen_blocks(x, match);
  uint32_t def[GEN_LINES], open = NONE; // the def each line is in (a def and its end too)
  for (uint32_t i = 0; i < x->n; i++) {
    if (x->l[i].kind == GL_DEF) open = i;
    def[i] = open;
    if (open != NONE && i == match[open]) open = NONE;
  }
  for (uint32_t i = 0; i < x->n; i++)
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < x->l[i].x[k].n; t++) {
        const uint8_t kind = x->l[i].x[k].kind[t];
        const uint32_t v = x->l[i].x[k].v[t];
        if ((kind == GT_POS || kind == GT_LEN) && v < x->n && def[v] != NONE && def[v] != def[i]) return 1;
      }
  return 0;
}

int gen_wrap(gen *x, uint32_t first, uint32_t end, uint32_t core) {
  if (first >= end || end > x->n || x->n + 2 > GEN_LINES) return 0;
  uint32_t depth = 0;
  int calls = 0;
  for (uint32_t i = first; i < end; i++) {
    const uint8_t kind = x->l[i].kind;
    if (kind == GL_DEF || (kind == GL_END && !depth--)) return 0;
    if (kind == GL_REPEAT) depth++;
    calls |= kind == GL_CALL;
  }
  if (depth || (calls && function_labels(x))) return 0;
  slots o;
  o.n = 0, o.over = 0;
  put(&o, SLOT_A, 0, first);
  put(&o, SLOT_REPEAT, 0, 1);
  put(&o, SLOT_A, first, end - first);
  put(&o, SLOT_END, 0, 1);
  put(&o, SLOT_A, end, x->n - end);
  gen child;
  gen_rebuild(&child, x, x, o.s, o.n, core, 0, 0);
  if (!index_out(&child, first + 1, end + 1) || !same_warrior(x, &child, core)) return 0;
  set(x, &child);
  return 1;
}

// How the operands k of two instructions fold: FOLD_NOT, FOLD_SAME (one
// expression for both), FOLD_STEP (two numbers, *step from the first to the
// second).
enum { FOLD_NOT, FOLD_SAME, FOLD_STEP, FOLD_VALUE };
// Operand k of the instructions at first + j and first + period + j, two
// groups of `period` lines behind each other.
static int fold_rule(const gen *x, uint32_t first, uint32_t period, uint32_t j, int k, uint32_t core, uint32_t *step) {
  const gen_expr *a = &x->l[first + j].x[k], *b = &x->l[first + period + j].x[k];
  if (a->n == 1 && b->n == 1 && a->kind[0] == GT_NUM && b->kind[0] == GT_NUM && a->v[0] != b->v[0]) {
    *step = wrap((int64_t)signed_value(b->v[0], core) - signed_value(a->v[0], core), core);
    return FOLD_STEP;
  }
  int same = a->n == b->n;
  for (uint32_t t = 0; t < a->n; t++) {
    const uint32_t va = a->v[t], vb = same ? b->v[t] : 0;
    if (a->kind[t] == GT_INDEX && va >= 2) return FOLD_NOT; // no room for one more loop
    if ((a->kind[t] == GT_POS || a->kind[t] == GT_LEN) && va >= first + period && va < first + 2 * period)
      return FOLD_NOT; // the first group refers into the second
    if (!same) continue;
    if (a->kind[t] != b->kind[t]) same = 0;
    else if (a->kind[t] == GT_POS || a->kind[t] == GT_LEN) same = va >= first && va < first + period ? vb == va + period : vb == va; // its own group's label, or the same
    else same = va == vb;
  }
  if (same) return FOLD_SAME;
  // other expressions: the first one and a step, by what the two instructions hold (the caller compares the warriors)
  return a->n && a->n + 4 <= GEN_TOKENS ? FOLD_VALUE : FOLD_NOT;
}

// Can the `period` instructions from `first` and the `period` behind them
// become the two repetitions of a block?
static int foldable(const gen *x, uint32_t first, uint32_t period, uint32_t core) {
  if (!period || first + 2 * period > x->n) return 0;
  uint32_t step;
  for (uint32_t j = 0; j < period; j++) {
    const gen_line *l = &x->l[first + j], *m = &x->l[first + period + j];
    if (l->kind != GL_EMIT || m->kind != GL_EMIT || l->op != m->op || l->mod != m->mod || l->am != m->am || l->bm != m->bm) return 0;
    if (!fold_rule(x, first, period, j, 0, core, &step) || !fold_rule(x, first, period, j, 1, core, &step)) return 0;
  }
  // nothing but itself refers to the second group: it will be the second repetition of the first
  const uint32_t from = first + period, to = first + 2 * period;
  if (x->start >= from && x->start < to) return 0;
  for (uint32_t i = 0; i < x->n; i++) {
    if (i >= from && i < to) continue;
    if (x->l[i].kind == GL_CALL && x->l[i].callee >= from && x->l[i].callee < to) return 0;
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < x->l[i].x[k].n; t++)
        if ((x->l[i].x[k].kind[t] == GT_POS || x->l[i].x[k].kind[t] == GT_LEN) && x->l[i].x[k].v[t] >= from && x->l[i].x[k].v[t] < to) return 0;
  }
  return 1;
}

int gen_fold_period(gen *x, uint32_t first, uint32_t period, uint32_t core) {
  if (x->n + 2 > GEN_LINES + period || !foldable(x, first, period, core)) return 0;
  slots o;
  o.n = 0, o.over = 0;
  put(&o, SLOT_A, 0, first);
  put(&o, SLOT_REPEAT, 0, 1);
  put(&o, SLOT_A, first, period);
  put(&o, SLOT_END, 0, 1);
  put(&o, SLOT_A, first + 2 * period, x->n - first - 2 * period);
  if (o.over) return 0;
  gen child;
  gen_rebuild(&child, x, x, o.s, o.n, core, 0, 0);
  if (!index_out(&child, first + 1, first + 1 + period)) return 0;
  gen_info info;
  m42_instruction code[GEN_LINES];
  gen_compile_info(x, core, GEN_LINES, code, &info);
  for (uint32_t j = 0; j < period; j++)
    for (int k = 0; k < 2; k++) {
      uint32_t step = 0;
      const int rule = fold_rule(x, first, period, j, k, core, &step);
      if (rule == FOLD_SAME) continue;
      gen_expr *e = &child.l[first + 1 + j].x[k];
      if (rule == FOLD_VALUE) { // the step from what the two instructions hold in the warrior
        const uint32_t pa = info.pos[first + j], pb = info.pos[first + period + j];
        if (pa == GEN_NONE || pb == GEN_NONE) return 0;
        step = wrap((int64_t)(k ? code[pb].b : code[pa == pb ? pa : pb].a) - (k ? code[pa].b : code[pa].a), core);
        step = wrap(signed_value(step, core), core);
      } else {
        e->n = 1; // a + i * step
      }
      e->kind[e->n] = GT_INDEX, e->v[e->n++] = 0;
      e->kind[e->n] = GT_NUM, e->v[e->n++] = step;
      e->kind[e->n] = GT_MUL, e->v[e->n++] = 0;
      e->kind[e->n] = GT_ADD, e->v[e->n++] = 0;
    }
  child.l[first].x[0].v[0] = 2;
  if (!same_warrior(x, &child, core)) return 0;
  set(x, &child);
  return 1;
}

int gen_fold(gen *x, uint32_t line, uint32_t core) { return gen_fold_period(x, line, 1, core); }

// e without the operations that a number in place of `i` leaves behind: two
// numbers and their operation become their result (when that is a number of
// the core, so that a division behind it gives the same), and + 0, - 0,
// * 1 and / 1 go. The value of e stays.
static void simplify(gen_expr *e, uint32_t core) {
  for (uint32_t t = 0; t + 1 < e->n;) {
    uint32_t cut = 0; // tokens to take out behind t
    if (e->kind[t] == GT_NUM && e->kind[t + 1] >= GT_ADD) {
      const int64_t b = signed_value(e->v[t], core);
      const uint8_t op = e->kind[t + 1];
      if (t && (((op == GT_ADD || op == GT_SUB) && b == 0) || ((op == GT_MUL || op == GT_DIV) && b == 1))) {
        memmove(&e->kind[t], &e->kind[t + 2], (e->n - t - 2) * sizeof e->kind[0]);
        memmove(&e->v[t], &e->v[t + 2], (e->n - t - 2) * sizeof e->v[0]);
        e->n -= 2;
        t = 0;
        continue;
      }
    }
    if (t + 2 < e->n && e->kind[t] == GT_NUM && e->kind[t + 1] == GT_NUM && e->kind[t + 2] >= GT_ADD) {
      const int64_t a = signed_value(e->v[t], core), b = signed_value(e->v[t + 1], core);
      const uint8_t op = e->kind[t + 2];
      const int64_t v = op == GT_ADD ? a + b : op == GT_SUB ? a - b : op == GT_MUL ? a * b : !b ? 0 : op == GT_DIV ? a / b : a % b;
      if (v >= -(int64_t)(core - core / 2 - 1) && v <= (int64_t)(core / 2)) { // a value that a number stands for
        e->v[t] = wrap(v, core);
        cut = 2;
      }
    }
    if (!cut) {
      t++;
      continue;
    }
    memmove(&e->kind[t + 1], &e->kind[t + 1 + cut], (e->n - t - 1 - cut) * sizeof e->kind[0]);
    memmove(&e->v[t + 1], &e->v[t + 1 + cut], (e->n - t - 1 - cut) * sizeof e->v[0]);
    e->n = (uint8_t)(e->n - cut);
    t = 0;
  }
  for (uint32_t t = e->n; t < GEN_TOKENS; t++) e->kind[t] = 0, e->v[t] = 0;
}

// Can the repeat at line R become its repetitions (gen_unroll())?
static int unrollable(const gen *x, const uint32_t *match, uint32_t R) {
  if (R >= x->n || x->l[R].kind != GL_REPEAT) return 0;
  const gen_expr *count = &x->l[R].x[0];
  if (count->n != 1 || count->kind[0] != GT_NUM || count->v[0] < 1 || count->v[0] > 16) return 0;
  const uint32_t E = match[R];
  if (E >= x->n || E == R + 1) return 0;
  if (x->n - 2 + (count->v[0] - 1) * (E - R - 1) > GEN_LINES) return 0;
  for (uint32_t i = R + 1; i < E; i++) {
    if (x->l[i].kind == GL_CALL && function_labels(x)) return 0;
    // a count in the block (an argument may be one) that uses a place of
    // the block sees the repetitions before its own, which will be other lines
    if (x->l[i].kind != GL_CALL && x->l[i].kind != GL_REPEAT) continue;
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < x->l[i].x[k].n; t++)
        if ((x->l[i].x[k].kind[t] == GT_POS || x->l[i].x[k].kind[t] == GT_LEN) && x->l[i].x[k].v[t] >= R && x->l[i].x[k].v[t] <= E) return 0;
  }
  // the end of the block is a place: the line behind it has to be one that
  // is written where the block ends, not the end of a block around it
  const uint8_t behind = E + 1 < x->n ? x->l[E + 1].kind : GL_END;
  const int last = behind != GL_EMIT && behind != GL_REPEAT && behind != GL_CALL;
  if (last && x->start == E) return 0;
  for (uint32_t i = 0; i < x->n; i++) {
    if (last && x->l[i].kind == GL_CALL && x->l[i].callee == E) return 0;
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < x->l[i].x[k].n; t++) {
        const uint8_t kind = x->l[i].x[k].kind[t];
        const uint32_t v = x->l[i].x[k].v[t];
        if (kind == GT_LEN && (v == R || v == E)) return 0;
        if (kind == GT_POS && v == E && last) return 0;
      }
  }
  return 1;
}

int gen_unroll(gen *x, uint32_t R, uint32_t core, uint32_t *copies, uint32_t *lines) {
  uint32_t match[GEN_LINES];
  gen_blocks(x, match);
  if (!unrollable(x, match, R)) return 0;
  const uint32_t n = x->l[R].x[0].v[0], E = match[R], B = E - R - 1;
  // where line t is then, seen from repetition c (from outside: the first)
#define AT(t, c) ((t) < R ? (t) : (t) == R ? R : (t) < E ? R + (c)*B + ((t)-R - 1) : (t) == E ? R + n * B : (t)-2 - B + n * B)
  gen child;
  child.n = x->n - 2 - B + n * B;
  memcpy(child.c, x->c, sizeof child.c);
  uint32_t o = 0;
  for (uint32_t i = 0; i < x->n; i++) {
    const int inside = i == R;
    for (uint32_t c = 0; c < (inside ? n : 1); c++) {
      uint32_t own = 0; // the repeats of the block's lines that are open
      for (uint32_t j = inside ? R + 1 : i; j < (inside ? E : i + 1); j++) {
        gen_line l = x->l[j];
        if (l.kind == GL_END && own) own--;
        if (l.kind == GL_CALL) l.callee = AT(l.callee, c);
        for (int k = 0; k < 2; k++)
          for (uint32_t t = 0; t < l.x[k].n; t++) {
            uint8_t *kind = &l.x[k].kind[t];
            uint32_t *v = &l.x[k].v[t];
            if (*kind == GT_POS || *kind == GT_LEN) *v = AT(*v, c);
            else if (*kind == GT_INDEX && inside && *v == own) *kind = GT_NUM, *v = c; // the loop that is gone
            else if (*kind == GT_INDEX && inside && *v > own) --*v;
          }
        if (inside) simplify(&l.x[0], core), simplify(&l.x[1], core);
        if (l.kind == GL_REPEAT) own++;
        child.l[o++] = l;
      }
    }
    if (inside) i = E;
  }
  child.start = AT(x->start, 0);
  if (child.start >= child.n) child.start = 0;
#undef AT
  if (!same_warrior(x, &child, core)) return 0; // a line that the first repetition does not write and a later one does, ...
  set(x, &child);
  if (copies) *copies = n;
  if (lines) *lines = B;
  return 1;
}

int gen_bind(gen *x, uint32_t line, int k, uint32_t t, uint32_t c, uint32_t core) {
  if (line >= x->n || k < 0 || k > 1 || c >= GEN_CONSTS) return 0;
  gen_expr *e = &x->l[line].x[k];
  if (t >= e->n || e->kind[t] != GT_NUM) return 0;
  const uint32_t v = e->v[t];
  const int32_t sv = signed_value(v, core);
  if (abs(sv) <= 16) return 0;
  for (uint32_t i = 0; i < x->n; i++)
    for (int j = 0; j < 2; j++)
      for (uint32_t s = 0; s < x->l[i].x[j].n; s++)
        if (x->l[i].x[j].kind[s] == GT_CONST && x->l[i].x[j].v[s] == c) return 0;
  gen before;
  before.n = 0;
  set(&before, x);
  x->c[c] = v;
  e->kind[t] = GT_CONST;
  e->v[t] = c;
  for (uint32_t i = 0; i < x->n; i++) {
    if (x->l[i].kind != GL_EMIT && x->l[i].kind != GL_CALL) continue;
    for (int j = 0; j < 2; j++) {
      gen_expr *f = &x->l[i].x[j];
      for (uint32_t s = 0; s < f->n; s++) {
        if (f->kind[s] != GT_NUM) continue;
        const uint32_t w = f->v[s];
        const int32_t sw = signed_value(w, core);
        if (abs(sw) <= 16) continue;
        if (w == v) {
          f->kind[s] = GT_CONST, f->v[s] = c;
          continue;
        }
        uint8_t kind[3] = {GT_CONST, GT_NUM, GT_ADD};
        uint32_t value[3] = {c, 0, 0};
        // as integers, not mod the core size: the number may be divided further on
        if (sw == -sv) kind[0] = GT_NUM, value[0] = 0, kind[1] = GT_CONST, value[1] = c, kind[2] = GT_SUB; // 0 - c
        else if (sw == 2 * sv) value[1] = 2, kind[2] = GT_MUL;                                              // c * 2
        else if (abs(sw - sv) <= 16) value[1] = wrap((int64_t)sw - sv, core);                                                    // c + d
        else continue;
        if (f->n + 2 > GEN_TOKENS) continue;
        memmove(&f->kind[s + 3], &f->kind[s + 1], (f->n - s - 1) * sizeof f->kind[0]);
        memmove(&f->v[s + 3], &f->v[s + 1], (f->n - s - 1) * sizeof f->v[0]);
        memcpy(&f->kind[s], kind, sizeof kind);
        memcpy(&f->v[s], value, sizeof value);
        f->n += 2;
        s += 2;
      }
    }
  }
  if (same_warrior(&before, x, core)) return 1;
  set(x, &before);
  return 0;
}

// ---------------------------------------------------------------- the rewrites of functions

int gen_extract(gen *x, uint32_t first, uint32_t end, uint32_t core, uint32_t *def) {
  if (first >= end || end > x->n || x->n + 3 > GEN_LINES) return 0;
  // whole units of one sequence, no def; and what the lines use of what is
  // around them, a loop or an argument of the function they are in: those
  // become the arguments of the new function, so at most 2
  uint8_t outer_kind[2] = {0, 0};
  uint32_t outer_v[2] = {0, 0}, outer = 0, own = 0;
  for (uint32_t i = first; i < end; i++) {
    const gen_line *l = &x->l[i];
    if (l->kind == GL_DEF || (l->kind == GL_END && !own--)) return 0;
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < l->x[k].n; t++) {
        const uint8_t kind = l->x[k].kind[t];
        if (kind != GT_ARG && !(kind == GT_INDEX && l->x[k].v[t] >= own)) continue;
        const uint32_t v = kind == GT_ARG ? l->x[k].v[t] : l->x[k].v[t] - own;
        uint32_t j = 0;
        while (j < outer && (outer_kind[j] != kind || outer_v[j] != v)) j++;
        if (j < outer) continue;
        if (outer == 2) return 0;
        outer_kind[outer] = kind, outer_v[outer++] = v;
      }
    if (l->kind == GL_REPEAT) own++;
  }
  if (own) return 0;
  slots o;
  o.n = 0, o.over = 0;
  put(&o, SLOT_A, 0, first);
  put(&o, SLOT_CALL, 0, 1);
  put(&o, SLOT_A, end, x->n - end);
  put(&o, SLOT_DEF, 0, 1);
  put(&o, SLOT_A, first, end - first);
  put(&o, SLOT_END, 0, 1);
  gen child;
  gen_rebuild(&child, x, x, o.s, o.n, core, 0, 0);
  const uint32_t d = x->n - (end - first) + 1;
  gen_line *call = &child.l[first];
  call->callee = d;
  for (uint32_t j = 0; j < outer; j++) call->x[j].n = 1, call->x[j].kind[0] = outer_kind[j], call->x[j].v[0] = outer_v[j];
  for (uint32_t i = d + 1; i + 1 < child.n; i++) { // in the function they are its arguments
    gen_line *l = &child.l[i];
    if (l->kind == GL_END && own) own--;
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < l->x[k].n; t++) {
        const uint8_t kind = l->x[k].kind[t];
        if (kind != GT_ARG && !(kind == GT_INDEX && l->x[k].v[t] >= own)) continue;
        const uint32_t v = kind == GT_ARG ? l->x[k].v[t] : l->x[k].v[t] - own;
        l->x[k].kind[t] = GT_ARG;
        l->x[k].v[t] = outer_kind[0] == kind && outer_v[0] == v ? 0 : 1;
      }
    if (l->kind == GL_REPEAT) own++;
  }
  if (!same_warrior(x, &child, core)) return 0; // 8 frames deep already, a label of the nearest call, ...
  set(x, &child);
  if (def) *def = d;
  return 1;
}

int gen_parameter(gen *x, uint32_t line, int k, uint32_t t, uint32_t j, uint32_t core) {
  uint32_t match[GEN_LINES];
  gen_blocks(x, match);
  if (line >= x->n || k < 0 || k > 1 || j > 1 || t >= x->l[line].x[k].n || x->l[line].x[k].kind[t] != GT_NUM) return 0;
  uint32_t d = NONE; // the function the line is in
  for (uint32_t i = 0; i < line; i++)
    if (x->l[i].kind == GL_DEF && match[i] > line && match[i] < x->n) d = i;
  if (d == NONE || (x->l[line].kind == GL_CALL && x->l[line].callee == d)) return 0; // not in a function, or its call of itself
  const uint32_t v = x->l[line].x[k].v[t];
  gen before;
  before.n = 0;
  set(&before, x);
  x->l[line].x[k].kind[t] = GT_ARG;
  x->l[line].x[k].v[t] = j;
  for (uint32_t i = 0; i < x->n; i++) {
    gen_line *l = &x->l[i];
    if (l->kind != GL_CALL || l->callee != d) continue;
    if (j == 1 && !l->x[0].n) l->x[0].n = 1, l->x[0].kind[0] = GT_NUM, l->x[0].v[0] = 0; // a second argument needs a first
    memset(&l->x[j], 0, sizeof l->x[j]);
    l->x[j].n = 1, l->x[j].kind[0] = GT_NUM, l->x[j].v[0] = v;
  }
  if (same_warrior(&before, x, core)) return 1;
  set(x, &before);
  return 0;
}

// The tokens of `from` into `to` behind its n tokens, the loops of `from`
// `own` loops further out (it comes into that many repeats). 0 without the
// room, or when a loop would be a fourth.
static int append_expr(gen_expr *to, const gen_expr *from, uint32_t own) {
  if (!from->n) { // no argument: 0
    if (to->n >= GEN_TOKENS) return 0;
    to->kind[to->n] = GT_NUM, to->v[to->n++] = 0;
    return 1;
  }
  for (uint32_t t = 0; t < from->n; t++) {
    if (to->n >= GEN_TOKENS) return 0;
    uint32_t v = from->v[t];
    if (from->kind[t] == GT_INDEX && (v += own) > 2) return 0;
    to->kind[to->n] = from->kind[t], to->v[to->n++] = v;
  }
  return 1;
}

int gen_inline(gen *x, uint32_t C, uint32_t core, uint32_t *at, uint32_t *lines) {
  uint32_t match[GEN_LINES];
  gen_blocks(x, match);
  if (C >= x->n || x->l[C].kind != GL_CALL) return 0;
  const uint32_t D = x->l[C].callee;
  if (D >= x->n || x->l[D].kind != GL_DEF || match[D] >= x->n) return 0;
  const uint32_t E = match[D], B = E - D - 1;
  if (!B || (C > D && C < E)) return 0; // nothing to bring, or a call of the function in itself
  // the function goes when this was its only call and nothing else refers to its lines
  int gone = x->start < D || x->start > E;
  for (uint32_t i = 0; i < x->n && gone; i++) {
    if (i >= D && i <= E) continue;
    if (x->l[i].kind == GL_CALL && i != C && x->l[i].callee >= D && x->l[i].callee <= E) gone = 0;
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < x->l[i].x[k].n; t++)
        if ((x->l[i].x[k].kind[t] == GT_POS || x->l[i].x[k].kind[t] == GT_LEN) && x->l[i].x[k].v[t] >= D && x->l[i].x[k].v[t] <= E) gone = 0;
  }
  const uint32_t n = x->n - 1 + B - (gone ? B + 2 : 0);
  if (n > GEN_LINES) return 0;
  const uint32_t copy = C - (gone && C > E ? B + 2 : 0); // where the lines come
  // where line t is then: for the lines that are brought in, the function's
  // lines are their own copies, its def the first of them, its end the line behind
#define OUT(t) ((t) == C ? copy : (t) - (gone && (t) > E ? B + 2 : 0) + ((t) > C ? B - 1 : 0))
#define IN(t) ((t) > D && (t) < E ? copy + ((t)-D - 1) : (t) == D ? copy : (t) == E ? copy + B : OUT(t))
  gen child;
  child.n = n;
  memcpy(child.c, x->c, sizeof child.c);
  uint32_t o = 0;
  for (uint32_t i = 0; i < x->n; i++) {
    if (gone && i >= D && i <= E) continue;
    const int inside = i == C;
    uint32_t own = 0;
    for (uint32_t j = inside ? D + 1 : i; j < (inside ? E : i + 1); j++) {
      gen_line l = x->l[j];
      if (l.kind == GL_END && own) own--;
      if (l.kind == GL_CALL) l.callee = inside ? IN(l.callee) : OUT(l.callee);
      for (int k = 0; k < 2; k++) {
        gen_expr e = l.x[k], *f = &l.x[k];
        if (inside) memset(f, 0, sizeof *f);
        for (uint32_t t = 0; t < e.n; t++) {
          uint8_t kind = e.kind[t];
          uint32_t v = e.v[t];
          if (kind == GT_POS || kind == GT_LEN) {
            if (kind == GT_LEN && (v == C || (inside && (v == D || v == E)))) return 0; // a length that no line has any more
            v = inside ? IN(v) : OUT(v);
          }
          if (!inside) {
            f->v[t] = v;
            continue;
          }
          if (kind == GT_ARG) { // the caller's expression, in the loops of this line
            if (!append_expr(f, &x->l[C].x[v < 2 ? v : 0], own)) return 0;
            continue;
          }
          if (kind == GT_INDEX && v >= own) kind = GT_NUM, v = 0; // a function does not see its caller's loops
          if (f->n >= GEN_TOKENS) return 0;
          f->kind[f->n] = kind, f->v[f->n++] = v;
        }
        if (inside) simplify(f, core);
      }
      if (l.kind == GL_REPEAT) own++;
      child.l[o++] = l;
    }
  }
#undef OUT
#undef IN
  child.start = x->start == C ? copy : x->start - (gone && x->start > E ? B + 2 : 0) + (x->start > C ? B - 1 : 0);
  if (child.start >= n) child.start = 0;
  char err[8];
  if (gen_check(&child, core, err, sizeof err) || !same_warrior(x, &child, core)) return 0;
  set(x, &child);
  if (at) *at = copy;
  if (lines) *lines = B;
  return 1;
}

// The functions that nothing calls and nothing refers to go.
static void drop_functions(gen *x, uint32_t core) {
  for (;;) {
    uint32_t match[GEN_LINES], d = NONE;
    gen_blocks(x, match);
    for (uint32_t i = 0; i < x->n && d == NONE; i++) {
      if (x->l[i].kind != GL_DEF || match[i] >= x->n) continue;
      const uint32_t e = match[i];
      int used = x->start >= i && x->start <= e;
      for (uint32_t j = 0; j < x->n && !used; j++) {
        if (j >= i && j <= e) continue;
        if (x->l[j].kind == GL_CALL && x->l[j].callee >= i && x->l[j].callee <= e) used = 1;
        for (int k = 0; k < 2; k++)
          for (uint32_t t = 0; t < x->l[j].x[k].n; t++)
            if ((x->l[j].x[k].kind[t] == GT_POS || x->l[j].x[k].kind[t] == GT_LEN) && x->l[j].x[k].v[t] >= i && x->l[j].x[k].v[t] <= e) used = 1;
      }
      if (!used) d = i;
    }
    if (d == NONE || match[d] - d + 1 >= x->n) return;
    slots o;
    o.n = 0, o.over = 0;
    put(&o, SLOT_A, 0, d);
    put(&o, SLOT_A, match[d] + 1, x->n - match[d] - 1);
    gen child;
    gen_rebuild(&child, x, x, o.s, o.n, core, 0, 0);
    set(x, &child);
  }
}

// ---------------------------------------------------------------- changes of the structure

// How many repeats are around `line`, and whether a def is.
static uint32_t loops_around(const gen *x, const uint32_t *match, uint32_t line, int *in_def) {
  uint32_t depth = 0;
  *in_def = 0;
  for (uint32_t j = 0; j < line; j++) {
    if (match[j] == NONE || match[j] <= line) continue; // no opener, or closed before the line
    if (x->l[j].kind == GL_REPEAT) depth++;
    else if (x->l[j].kind == GL_DEF) *in_def = 1;
  }
  return depth;
}

// A step per repetition: small, or a far value.
static uint32_t random_step(rng *r, uint32_t core) {
  if (rng_chance(r, 0.5)) return genome_far_value(r, core);
  const int32_t d = rng_range(r, 1, 8);
  return wrap(rng_below(r, 2) ? d : -d, core);
}

// e becomes e + i * d, i the loop `level` out; 0 without the room.
static int add_step(gen_expr *e, uint32_t level, uint32_t d) {
  if (!e->n || e->n + 4 > GEN_TOKENS) return 0;
  const uint8_t kind[4] = {GT_INDEX, GT_NUM, GT_MUL, GT_ADD};
  const uint32_t v[4] = {level, d, 0, 0};
  memcpy(&e->kind[e->n], kind, sizeof kind);
  memcpy(&e->v[e->n], v, sizeof v);
  e->n += 4;
  return 1;
}

// A value for an expression of a line with `depth` repeats around it.
static void random_leaf(const gen *x, rng *r, uint32_t core, uint32_t depth, int in_def, uint8_t *kind, uint32_t *v) {
  const uint32_t d = rng_below(r, 100);
  *kind = GT_NUM;
  if (d < 35) {
    *v = rng_chance(r, 0.6) ? wrap(rng_range(r, -16, 16), core) : genome_far_value(r, core);
  } else if (d < 55) {
    *kind = GT_POS, *v = rng_below(r, x->n);
  } else if (d < 70 && depth) {
    *kind = GT_INDEX, *v = depth > 1 ? rng_below(r, depth < 3 ? depth : 3) : 0;
  } else if (d >= 70 && d < 80 && in_def) {
    *kind = GT_ARG, *v = rng_below(r, 2);
  } else if (d >= 80 && d < 90) { // a constant that has a value, else any
    uint32_t c[GEN_CONSTS], cn = 0;
    for (uint32_t k = 0; k < GEN_CONSTS; k++)
      if (x->c[k]) c[cn++] = k;
    *kind = GT_CONST, *v = cn ? c[rng_below(r, cn)] : rng_below(r, GEN_CONSTS);
  } else if (d >= 90 && d < 95) { // the length of a block or a call
    uint32_t at[GEN_LINES], an = 0;
    for (uint32_t i = 0; i < x->n; i++)
      if (x->l[i].kind == GL_REPEAT || x->l[i].kind == GL_CALL || x->l[i].kind == GL_DEF) at[an++] = i;
    if (an) *kind = GT_LEN, *v = at[rng_below(r, an)];
    else *v = wrap(rng_range(r, -16, 16), core);
  } else if (d >= 95) {
    *kind = GT_CORE, *v = 0;
  } else { // a kind that means nothing here: a small number
    *v = wrap(rng_range(r, -16, 16), core);
  }
}

// Nothing behind the tokens of e (gen_check()).
static void tidy(gen_expr *e) {
  for (uint32_t t = e->n; t < GEN_TOKENS; t++) e->kind[t] = 0, e->v[t] = 0;
}

static int take(gen *x, const gen *child, uint32_t core, uint32_t max_length) {
  if (!keeps(child, core, max_length)) return 0;
  set(x, child);
  return 1;
}

// One more call: the call at line `call` of cand again at a place drawn,
// with `vary` one number of its arguments changed; x becomes that child when
// it keeps the limits.
static int call_again(gen *x, const gen *cand, uint32_t call, rng *r, uint32_t core, uint32_t max_length, int vary) {
  shape sh;
  shape_of(cand, &sh);
  unit u[GEN_LINES];
  const uint32_t s = pick_sequence(&sh, r), count = seq_units(cand, &sh, s, u);
  const uint32_t at = unit_line(cand, &sh, s, u, count, rng_below(r, count + 1)), d = cand->l[call].callee;
  if (d < cand->n && cand->l[d].kind == GL_DEF && at > d && at <= sh.match[d]) return 0; // in its own function it writes nothing
  slots o;
  o.n = 0, o.over = 0;
  put(&o, SLOT_A, 0, at);
  put(&o, SLOT_B, call, 1);
  put(&o, SLOT_A, at, cand->n - at);
  if (o.over) return 0;
  gen child;
  gen_rebuild(&child, cand, cand, o.s, o.n, core, r, 0);
  if (vary) {
    gen_line *l = &child.l[at];
    uint32_t *leaf[2 * GEN_TOKENS], ln = 0;
    uint8_t *kind[2 * GEN_TOKENS];
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < l->x[k].n; t++)
        if (l->x[k].kind[t] == GT_NUM) kind[ln] = &l->x[k].kind[t], leaf[ln++] = &l->x[k].v[t];
    if (ln) {
      const uint32_t p = rng_below(r, ln);
      uint8_t ref = 0;
      genome_mutate_operand(r, core, child.n, 0, &ref, leaf[p]);
      *kind[p] = ref ? GT_POS : GT_NUM;
    }
  }
  return take(x, &child, core, max_length);
}

// Is line i a call of a function (a def that is closed)?
static int calls_function(const gen *x, const uint32_t *match, uint32_t i) {
  const uint32_t d = x->l[i].callee;
  return x->l[i].kind == GL_CALL && d < x->n && x->l[d].kind == GL_DEF && match[d] < x->n;
}

static int structure_change(gen *x, const gen *p2, const shape *sh, rng *r, uint32_t core, uint32_t max_length,
                            int kind) {
  gen cand;
  cand.n = 0;
  set(&cand, x);
  gen_info info;
  m42_instruction code[GEN_LINES];
  unit u[GEN_LINES];
  uint32_t at[GEN_LINES], an = 0;
  switch (kind) {
    case CH_REPEAT: { // units into a repeat of 2 to 8, and half of the time one operand steps with it
      const uint32_t s = pick_sequence(sh, r), count = seq_units(x, sh, s, u);
      if (!count) return 0;
      const uint32_t k = genome_block(r, count), from = rng_below(r, count - k + 1);
      const uint32_t first = u[from].first, end = unit_line(x, sh, s, u, count, from + k);
      gen_compile_info(x, core, max_length, code, &info);
      uint32_t wrote = 0;
      for (uint32_t j = from; j < from + k; j++)
        if (info.len[u[j].first] != GEN_NONE) wrote += info.len[u[j].first];
      if (!wrote || !gen_wrap(&cand, first, end, core)) return 0; // nothing to repeat
      const uint32_t room = (max_length - info.written) / wrote + 1;
      if (room < 2) return 0;
      uint32_t n = 2;
      while (n < 8 && n < room && rng_chance(r, 0.5)) n++;
      cand.l[first].x[0].v[0] = n;
      if (rng_chance(r, 0.5)) {
        for (uint32_t j = from; j < from + k; j++)
          if (x->l[u[j].first].kind == GL_EMIT) at[an++] = u[j].first + 1; // behind the new line
        if (an) {
          gen_line *l = &cand.l[at[rng_below(r, an)]];
          gen_expr *e = &l->x[rng_below(r, 2)];
          add_step(e, 0, random_step(r, core));
        }
      }
      return take(x, &cand, core, max_length);
    }
    case CH_REPEATS: { // a count: one more or less, doubled, halved, or new
      for (uint32_t i = 0; i < x->n; i++)
        if (x->l[i].kind == GL_REPEAT && sh->live[i]) at[an++] = i;
      if (!an) return 0;
      gen_expr *e = &cand.l[at[rng_below(r, an)]].x[0];
      uint32_t leaf[GEN_TOKENS], ln = 0;
      for (uint32_t t = 0; t < e->n; t++)
        if (e->kind[t] == GT_NUM) leaf[ln++] = t;
      if (ln) {
        uint32_t *v = &e->v[leaf[ln > 1 ? rng_below(r, ln) : 0]];
        const int32_t sv = signed_value(*v, core);
        const uint32_t d = rng_below(r, 100);
        int64_t nv = d < 50 ? (int64_t)sv + (rng_below(r, 2) ? 1 : -1) : d < 65 ? (int64_t)sv * 2 : d < 80 ? sv / 2 : (int64_t)rng_below(r, 9);
        if (nv < 0) nv = 0;
        if (nv == sv) return 0;
        *v = wrap(nv, core);
      } else { // a count without a number: one more or less
        if (!e->n || e->n + 2 > GEN_TOKENS) return 0;
        e->kind[e->n] = GT_NUM, e->v[e->n++] = 1;
        e->kind[e->n] = rng_below(r, 2) ? GT_ADD : GT_SUB, e->v[e->n++] = 0;
      }
      return take(x, &cand, core, max_length);
    }
    case CH_FOLD: { // two instructions into a repeat 2, which then goes on to 3 or more
      for (uint32_t i = 0; i + 1 < x->n; i++)
        if (sh->live[i] && sh->live[i + 1] && foldable(x, i, 1, core)) at[an++] = i;
      if (!an) return 0;
      const uint32_t line = at[rng_below(r, an)];
      gen_compile_info(x, core, max_length, code, &info);
      const uint32_t room = max_length - info.written + 2;
      if (room < 3 || !gen_fold(&cand, line, core)) return 0;
      uint32_t n = 3;
      while (n < 10 && n < room && rng_chance(r, 0.5)) n++;
      cand.l[line].x[0].v[0] = n;
      return take(x, &cand, core, max_length);
    }
    case CH_UNROLL: { // a repeat into its repetitions, and one change of an instruction of one of them
      for (uint32_t i = 0; i < x->n; i++)
        if (sh->live[i] && unrollable(x, sh->match, i)) at[an++] = i;
      if (!an) return 0;
      const uint32_t line = at[rng_below(r, an)];
      uint32_t copies, lines;
      if (!gen_unroll(&cand, line, core, &copies, &lines)) return 0;
      an = 0;
      for (uint32_t i = line; i < line + copies * lines; i++)
        if (cand.l[i].kind == GL_EMIT) at[an++] = i;
      if (!an) return 0;
      static const uint32_t w[6] = {81, 81, 54, 54, 108, 108}; // as genome_mix_default()
      const uint32_t target = at[rng_below(r, an)];
      if (!point_change(&cand, target, CH_OPCODE + genome_pick(r, w, 6), r, core, max_length)) return 0;
      return take(x, &cand, core, max_length);
    }
    case CH_INDEX: { // an operand in a repeat: its step per repetition changes, or it gets one
      int in_def;
      for (uint32_t i = 0; i < x->n; i++)
        if (x->l[i].kind == GL_EMIT && sh->live[i] && loops_around(x, sh->match, i, &in_def)) at[an++] = i;
      if (!an) return 0;
      const uint32_t line = at[rng_below(r, an)], depth = loops_around(x, sh->match, line, &in_def);
      gen_expr *e = &cand.l[line].x[rng_below(r, 2)];
      uint32_t t = 0;
      while (t + 2 < e->n && !(e->kind[t] == GT_INDEX && e->kind[t + 1] == GT_NUM && e->kind[t + 2] == GT_MUL)) t++;
      if (t + 2 < e->n) {
        const int32_t sv = signed_value(e->v[t + 1], core);
        const uint32_t d = rng_below(r, 100);
        int64_t nv;
        if (d < 40) {
          const int32_t by = rng_range(r, 1, 4);
          nv = rng_below(r, 2) ? (int64_t)sv + by : (int64_t)sv - by;
        } else if (d < 55) {
          nv = -(int64_t)sv;
        } else if (d < 75) {
          nv = rng_below(r, 2) ? (int64_t)sv * 2 : sv / 2;
        } else {
          nv = signed_value(random_step(r, core), core);
        }
        if (wrap(nv, core) == e->v[t + 1]) return 0;
        e->v[t + 1] = wrap(nv, core);
      } else {
        const uint32_t most = depth < 3 ? depth : 3;
        const uint32_t level = most > 1 && rng_chance(r, 0.25) ? 1 + rng_below(r, most - 1) : 0;
        if (!add_step(e, level, random_step(r, core))) return 0;
      }
      return take(x, &cand, core, max_length);
    }
    case CH_EXPRESSION: { // an operand or an argument: a value replaced, an operation more, or one less
      struct {
        uint32_t line;
        int k;
      } ex[2 * GEN_LINES];
      uint32_t en = 0;
      for (uint32_t i = 0; i < x->n; i++)
        for (int k = 0; k < 2; k++)
          if ((x->l[i].kind == GL_EMIT || x->l[i].kind == GL_CALL) && sh->live[i] && x->l[i].x[k].n) ex[en].line = i, ex[en++].k = k;
      if (!en) return 0;
      const uint32_t pick = rng_below(r, en), line = ex[pick].line;
      gen_expr *e = &cand.l[line].x[ex[pick].k];
      int in_def;
      const uint32_t depth = loops_around(x, sh->match, line, &in_def), d = rng_below(r, 100);
      uint8_t leaf_kind;
      uint32_t leaf_v;
      if (d < 40) {
        uint32_t leaf[GEN_TOKENS], ln = 0;
        for (uint32_t t = 0; t < e->n; t++)
          if (e->kind[t] < GT_ADD) leaf[ln++] = t;
        const uint32_t t = leaf[rng_below(r, ln)];
        random_leaf(x, r, core, depth, in_def, &leaf_kind, &leaf_v);
        if (e->kind[t] == leaf_kind && e->v[t] == leaf_v) return 0;
        e->kind[t] = leaf_kind, e->v[t] = leaf_v;
      } else if (d < 80) {
        if (e->n + 2 > GEN_TOKENS) return 0;
        random_leaf(x, r, core, depth, in_def, &leaf_kind, &leaf_v);
        const uint32_t op = rng_below(r, 100);
        e->kind[e->n] = leaf_kind, e->v[e->n++] = leaf_v;
        e->kind[e->n] = op < 40 ? GT_ADD : op < 60 ? GT_SUB : op < 80 ? GT_MUL : op < 90 ? GT_DIV : GT_MOD, e->v[e->n++] = 0;
      } else { // the last operation goes: its left or its right side stays
        if (e->n < 3 || e->kind[e->n - 1] < GT_ADD) return 0;
        uint32_t right = e->n - 1, need = 1; // where the right side starts
        while (need && right) {
          right--;
          need += e->kind[right] >= GT_ADD ? 1 : (uint32_t)-1;
        }
        if (need || !right) return 0;
        if (rng_below(r, 2)) {
          e->n = (uint8_t)right;
        } else {
          const uint32_t len = e->n - 1 - right;
          memmove(&e->kind[0], &e->kind[right], len * sizeof e->kind[0]);
          memmove(&e->v[0], &e->v[right], len * sizeof e->v[0]);
          e->n = (uint8_t)len;
        }
        tidy(e);
      }
      return take(x, &cand, core, max_length);
    }
    case CH_CONSTANT: { // a constant moves, with all that uses it; or a far number becomes one, and moves
      uint8_t used[GEN_CONSTS] = {0}; // 1: by some line, 2: by a live one
      struct {
        uint32_t line, t;
        int k;
      } far[2 * GEN_TOKENS * GEN_LINES];
      uint32_t fn = 0, un = 0, unused = NONE;
      for (uint32_t i = 0; i < x->n; i++)
        for (int k = 0; k < 2; k++)
          for (uint32_t t = 0; t < x->l[i].x[k].n; t++) {
            const gen_expr *e = &x->l[i].x[k];
            if (e->kind[t] == GT_CONST && e->v[t] < GEN_CONSTS && used[e->v[t]] < 2) used[e->v[t]] = sh->live[i] ? 2 : 1;
            if (e->kind[t] == GT_NUM && (x->l[i].kind == GL_EMIT || x->l[i].kind == GL_CALL) && sh->live[i] &&
                abs(signed_value(e->v[t], core)) > 16)
              far[fn].line = i, far[fn].k = k, far[fn++].t = t;
          }
      for (uint32_t k = GEN_CONSTS; k-- > 0;) {
        if (used[k] == 2) at[un++] = k;
        else if (!used[k]) unused = k;
      }
      const int bind = fn && unused != NONE;
      if (!un && !bind) return 0;
      if (un && (!bind || rng_chance(r, 0.5))) {
        const uint32_t c = at[rng_below(r, un)];
        cand.c[c] = genome_tune(r, core, cand.c[c]);
      } else {
        const uint32_t f = rng_below(r, fn);
        if (!gen_bind(&cand, far[f].line, far[f].k, far[f].t, unused, core)) return 0;
        cand.c[unused] = genome_tune(r, core, cand.c[unused]);
      }
      return take(x, &cand, core, max_length);
    }
    case CH_EXTRACT: { // units into a function with one call, and a second call at another place
      const uint32_t s = pick_sequence(sh, r), count = seq_units(x, sh, s, u);
      if (!count) return 0;
      const uint32_t k = genome_block(r, count), from = rng_below(r, count - k + 1);
      const uint32_t first = u[from].first, end = unit_line(x, sh, s, u, count, from + k);
      gen_compile_info(x, core, max_length, code, &info);
      uint32_t wrote = 0;
      for (uint32_t j = from; j < from + k; j++)
        if (info.len[u[j].first] != GEN_NONE) wrote += info.len[u[j].first];
      if (!wrote || info.written + wrote > max_length || !gen_extract(&cand, first, end, core, 0)) return 0;
      return call_again(x, &cand, first, r, core, max_length, 0);
    }
    case CH_PARAMETER: { // a number in a function becomes an argument that every call passes, and one call passes another
      struct {
        uint32_t line, t, d;
        int k, j;
      } num[2 * GEN_TOKENS * GEN_LINES];
      uint32_t nn = 0;
      for (uint32_t d = 0; d < x->n; d++) {
        if (x->l[d].kind != GL_DEF || sh->match[d] >= x->n) continue;
        int called = 0, taken[2] = {0, 0};
        for (uint32_t i = 0; i < x->n; i++) called |= sh->live[i] && x->l[i].kind == GL_CALL && x->l[i].callee == d;
        for (uint32_t i = d + 1; i < sh->match[d]; i++)
          for (int k = 0; k < 2; k++)
            for (uint32_t t = 0; t < x->l[i].x[k].n; t++)
              if (x->l[i].x[k].kind[t] == GT_ARG && x->l[i].x[k].v[t] < 2) taken[x->l[i].x[k].v[t]] = 1;
        if (!called || (taken[0] && taken[1])) continue;
        for (uint32_t i = d + 1; i < sh->match[d]; i++)
          for (int k = 0; k < 2; k++)
            for (uint32_t t = 0; t < x->l[i].x[k].n; t++)
              if (x->l[i].x[k].kind[t] == GT_NUM) num[nn].line = i, num[nn].t = t, num[nn].d = d, num[nn].k = k, num[nn++].j = taken[0];
      }
      if (!nn) return 0;
      const uint32_t p = rng_below(r, nn);
      if (!gen_parameter(&cand, num[p].line, num[p].k, num[p].t, (uint32_t)num[p].j, core)) return 0;
      for (uint32_t i = 0; i < x->n; i++)
        if (sh->live[i] && x->l[i].kind == GL_CALL && x->l[i].callee == num[p].d) at[an++] = i;
      gen_expr *e = &cand.l[at[rng_below(r, an)]].x[num[p].j];
      uint8_t ref = 0;
      genome_mutate_operand(r, core, cand.n, 0, &ref, &e->v[0]);
      e->kind[0] = ref ? GT_POS : GT_NUM;
      return take(x, &cand, core, max_length);
    }
    case CH_CALL: { // one more call of a function, one number of its arguments changed
      for (uint32_t i = 0; i < x->n; i++)
        if (sh->live[i] && calls_function(x, sh->match, i)) at[an++] = i;
      if (!an) return 0;
      return call_again(x, &cand, at[rng_below(r, an)], r, core, max_length, 1);
    }
    case CH_INLINE: { // a call becomes the function's lines, and one of their instructions changes
      for (uint32_t i = 0; i < x->n; i++)
        if (sh->live[i] && calls_function(x, sh->match, i)) at[an++] = i;
      if (!an) return 0;
      uint32_t copy, lines;
      if (!gen_inline(&cand, at[rng_below(r, an)], core, &copy, &lines)) return 0;
      an = 0;
      for (uint32_t i = copy; i < copy + lines; i++)
        if (cand.l[i].kind == GL_EMIT) at[an++] = i;
      if (!an) return 0;
      static const uint32_t w[6] = {81, 81, 54, 54, 108, 108}; // as genome_mix_default()
      const uint32_t target = at[rng_below(r, an)];
      if (!point_change(&cand, target, CH_OPCODE + genome_pick(r, w, 6), r, core, max_length)) return 0;
      return take(x, &cand, core, max_length);
    }
    case CH_TRANSPLANT: { // a call of the second parent, with its function and what that calls
      if (!p2) return 0;
      shape sh2;
      shape_of(p2, &sh2);
      mark_live(p2, &sh2, core, GEN_LINES);
      for (uint32_t i = 0; i < p2->n; i++)
        if (sh2.live[i] && calls_function(p2, sh2.match, i)) at[an++] = i;
      if (!an) return 0;
      const uint32_t call = at[rng_below(r, an)];
      const uint32_t s = pick_sequence(sh, r), count = seq_units(x, sh, s, u);
      const uint32_t to = unit_line(x, sh, s, u, count, rng_below(r, count + 1));
      uint8_t in[GEN_LINES] = {0};
      in[call] = 1;
      slots o;
      o.n = 0, o.over = 0;
      put(&o, SLOT_A, 0, to);
      put(&o, SLOT_B, call, 1);
      put(&o, SLOT_A, to, x->n - to);
      put_functions(&o, p2, &sh2, in);
      gen_compile_info(p2, core, GEN_LINES, code, &info);
      return rebuilt(x, p2, &o, core, max_length, r, &info);
    }
    default: return 0;
  }
}

genome_mix gen_mix_default(void) {
  genome_mix m = genome_mix_default();
  m.w[CH_REPEAT] = 30, m.w[CH_REPEATS] = 40, m.w[CH_FOLD] = 30, m.w[CH_UNROLL] = 15;
  m.w[CH_INDEX] = 40, m.w[CH_EXPRESSION] = 40, m.w[CH_CONSTANT] = 40;
  m.w[CH_EXTRACT] = 20, m.w[CH_PARAMETER] = 20, m.w[CH_CALL] = 25, m.w[CH_INLINE] = 10, m.w[CH_TRANSPLANT] = 15;
  return m;
}

int gen_change(gen *x, const gen *p2, rng *r, uint32_t core, uint32_t max_length, int kind) {
  if (max_length > GEN_LINES) max_length = GEN_LINES;
  shape sh, sh2;
  shape_of(x, &sh);
  mark_live(x, &sh, core, max_length);
  slots o;
  o.n = 0, o.over = 0;
  unit u[GEN_LINES], u2[GEN_LINES];
  if (kind <= CH_REPLACE) {
    if (!sh.live_emits) return 0;
    uint32_t line = 0;
    emit_line(x, &sh, rng_below(r, sh.live_emits), &line);
    return point_change(x, line, kind, r, core, max_length);
  }
  if (kind >= CH_COUNT) return structure_change(x, p2, &sh, r, core, max_length, kind);
  switch (kind) {
    case CH_INSERT: {
      if (sh.emits >= max_length) return 0;
      const uint32_t s = pick_sequence(&sh, r), count = seq_units(x, &sh, s, u);
      const uint32_t k = genome_block(r, max_length - sh.emits), q = rng_below(r, count + 1);
      const uint32_t at = unit_line(x, &sh, s, u, count, q);
      put(&o, SLOT_A, 0, at);
      for (uint32_t i = 0; i < k; i++) put(&o, SLOT_NEW, 0, 1);
      put(&o, SLOT_A, at, x->n - at);
      return rebuilt(x, x, &o, core, max_length, r, 0);
    }
    case CH_DELETE: {
      const uint32_t s = pick_sequence(&sh, r), count = seq_units(x, &sh, s, u);
      if (count < 2) return 0;
      const uint32_t k = genome_block(r, count - 1), p = rng_below(r, count - k + 1);
      const uint32_t from = u[p].first, to = unit_line(x, &sh, s, u, count, p + k);
      put(&o, SLOT_A, 0, from);
      put(&o, SLOT_A, to, x->n - to);
      return rebuilt(x, x, &o, core, max_length, r, 0);
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
      return rebuilt(x, x, &o, core, max_length, r, 0);
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
      return rebuilt(x, x, &o, core, max_length, r, 0);
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
      return rebuilt(x, p2, &o, core, max_length, r, &info2);
    }
    case CH_RELATED_OPCODE: {
      uint32_t cand[GEN_LINES], cn = 0;
      for (uint32_t i = 0; i < x->n; i++)
        if (x->l[i].kind == GL_EMIT && sh.live[i] && genome_opcode_family(x->l[i].op) >= 0) cand[cn++] = i;
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
      if (!sh.live_emits) return 0;
      gen_line *l = emit_line(x, &sh, rng_below(r, sh.live_emits), 0);
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
      const uint32_t fn = far_numbers(x, &sh, core, at);
      if (fn < 2) return 0;
      const uint32_t to = rng_below(r, fn);
      uint32_t from = rng_below(r, fn - 1);
      if (from >= to) from++;
      const uint32_t v = *at[from], old = *at[to];
      *at[to] = rng_below(r, 2) ? v : wrap(-(int64_t)v, core);
      if (keeps(x, core, max_length)) return 1;
      *at[to] = old; // an argument that is a count: the warrior would not be whole
      return 0;
    }
    case CH_SHARED_TARGET: { // the cell of another far field: its value plus the distance between the two instructions
      uint32_t *at[2 * GEN_LINES], line[2 * GEN_LINES];
      const uint32_t fn = far_fields(x, &sh, core, at, line);
      if (fn < 2) return 0;
      const uint32_t to = rng_below(r, fn);
      uint32_t from = rng_below(r, fn - 1);
      if (from >= to) from++;
      gen_info info; // where the lines are: their first instance, in a repeat or a function
      m42_instruction code[GEN_LINES];
      gen_compile_info(x, core, max_length, code, &info);
      *at[to] = wrap((int64_t)*at[from] + info.pos[line[from]] - info.pos[line[to]], core);
      return 1;
    }
    case CH_TUNE: {
      uint32_t *at[2 * GEN_TOKENS * GEN_LINES];
      const uint32_t fn = far_numbers(x, &sh, core, at);
      if (!fn) return 0;
      uint32_t *v = at[rng_below(r, fn)];
      const uint32_t old = *v;
      *v = genome_tune(r, core, *v);
      if (keeps(x, core, max_length)) return 1;
      *v = old;
      return 0;
    }
    case CH_LOOP: { // k new instructions in front of unit q of a sequence, in place of `cut` units where the limit leaves no room
      if (max_length < 2) return 0;
      const uint32_t s = pick_sequence(&sh, r), count = seq_units(x, &sh, s, u);
      uint32_t k = 2 + rng_below(r, 4); // as loop_size() of genome.c
      if (k > max_length) k = max_length;
      const uint32_t how = rng_below(r, GENOME_LOOP_WAYS);
      const uint32_t cut = sh.emits + k > max_length ? sh.emits + k - max_length : 0;
      if (cut > count) return 0;
      const uint32_t q = rng_below(r, count - cut + 1);
      const uint32_t at = unit_line(x, &sh, s, u, count, q), on = unit_line(x, &sh, s, u, count, q + cut);
      put(&o, SLOT_A, 0, at);
      put(&o, SLOT_NEW, 0, k);
      put(&o, SLOT_A, on, x->n - on);
      if (o.over) return 0;
      gen child;
      gen_rebuild(&child, x, x, o.s, o.n, core, r, 0);
      uint8_t test;
      gen_line *jump = &child.l[at + k - 1];
      jump->op = genome_loop_close(how, &test);
      jump->am = 1; // $: to the first new instruction
      jump->x[0].n = 1;
      jump->x[0].kind[0] = GT_POS;
      jump->x[0].v[0] = at;
      if (test < GENOME_OPCODES) child.l[at + k - 2].op = test;
      if (!keeps(&child, core, max_length)) return 0;
      set(x, &child);
      return 1;
    }
    default: return 0;
  }
}

// ---------------------------------------------------------------- breeding

void gen_breed(gen *child, const gen *p1, const gen *p2, rng *r, uint32_t core, uint32_t max_length,
               const genome_mix *mix, char *ops, size_t ops_n) {
  if (ops_n) ops[0] = 0;
  if (max_length > GEN_LINES) max_length = GEN_LINES;
  const genome_mix def = genome_mix_default();
  if (!mix) mix = &def;
  uint64_t total = 0;
  for (int k = 0; k < CH_ALL; k++) total += mix->w[k];
  if (child != p1) *child = *p1;
  uint32_t changes = 1;
  while (changes < 6 && rng_chance(r, 0.35)) changes++;
  for (uint32_t c = 0; c < changes && total; c++) {
    for (int tries = 0; tries < 16; tries++) {
      uint64_t d = rng_below(r, total);
      int kind = 0;
      while (d >= mix->w[kind]) d -= mix->w[kind++];
      if (gen_change(child, p2, r, core, max_length, kind)) {
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
  // a function that nothing calls any more goes, and a constant that nothing uses is 0
  drop_functions(child, core);
  uint8_t used[GEN_CONSTS] = {0};
  for (uint32_t i = 0; i < child->n; i++)
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < child->l[i].x[k].n; t++)
        if (child->l[i].x[k].kind[t] == GT_CONST && child->l[i].x[k].v[t] < GEN_CONSTS) used[child->l[i].x[k].v[t]] = 1;
  for (uint32_t k = 0; k < GEN_CONSTS; k++)
    if (!used[k]) child->c[k] = 0;
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
