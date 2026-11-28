// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The constant optimizer of 42evolve (--optimize, #146): a search over the
// constants of one warrior against the panel.

#include "evolve.h"

// ---------------------------------------------------------------- the constant optimizer (--optimize, #146)

// A neighborhood search over the constants of one warrior against the panel:
// operand values that are not references into the warrior and more than 16
// away from 0, and the start. Each constant in turn gets candidates near and
// related to its value; all of them play the panel at once with the seeds of
// the warrior's own matches, the first OPT_FIRST rounds first, the rest only
// for those ahead then. The best is better only when the mean of its
// differences per panel warrior is more than OPT_Z standard errors above 0,
// and again so with other seeds (the best of many candidates is lucky too).
// An accepted value is the warrior's from then on, and the same constant is
// tried again; a pass over all constants that accepts nothing ends it.
#define OPT_FIRST 20
#define OPT_Z 2.0
#define OPT_PASSES 8

static int32_t signed_of(uint32_t v, uint32_t core) { return v > core / 2 ? (int32_t)v - (int32_t)core : (int32_t)v; }
static uint32_t wrapped(int64_t v, uint32_t core) { return (uint32_t)(((v % core) + core) % core); }
static uint64_t gcd64(uint64_t a, uint64_t b) {
  while (b) {
    const uint64_t t = a % b;
    a = b, b = t;
  }
  return a;
}

// Where constant k is: operand of gene k / 2 (a when even), or the start (k == 2 * len).
static uint32_t *opt_slot(genome *g, uint32_t k) { return k == 2 * g->len ? &g->start : k % 2 ? &g->g[k / 2].b : &g->g[k / 2].a; }

// The candidate values of constant k of g, distinct, not its value now.
static uint32_t opt_candidates(genome *g, uint32_t k, uint32_t core, const uint32_t *consts, uint32_t nc, uint32_t *out) {
  uint32_t n = 0;
  const uint32_t now = *opt_slot(g, k);
  if (k == 2 * g->len) { // the start: every other instruction
    for (uint32_t i = 0; i < g->len; i++)
      if (i != now) out[n++] = i;
    return n;
  }
  int64_t c[64];
  uint32_t m = 0;
  const int64_t sv = signed_of(now, core);
  for (int d = 1; d <= 8; d++) c[m++] = sv + d, c[m++] = sv - d;
  c[m++] = (sv * 101 + 50) / 100, c[m++] = (sv * 99 + 50) / 100, c[m++] = (sv * 105 + 50) / 100, c[m++] = (sv * 95 + 50) / 100;
  static const int frac[][2] = {{1, 2}, {1, 3}, {2, 3}, {1, 4}, {3, 4}};
  for (int f = 0; f < 5; f++) c[m++] = (int64_t)core * frac[f][0] / frac[f][1];
  for (uint32_t i = 0; i < nc && m < 60; i++)
    if (consts[i] != k) c[m++] = signed_of(*opt_slot(g, consts[i]), core), c[m++] = -(int64_t)signed_of(*opt_slot(g, consts[i]), core);
  // the nearest values coprime to the core size, when this one is not
  if (gcd64((uint64_t)wrapped(sv, core), core) != 1) {
    for (int64_t d = 1; d < core; d++)
      if (gcd64(wrapped(sv + d, core), core) == 1) {
        c[m++] = sv + d;
        break;
      }
    for (int64_t d = 1; d < core; d++)
      if (gcd64(wrapped(sv - d, core), core) == 1) {
        c[m++] = sv - d;
        break;
      }
  }
  for (uint32_t i = 0; i < m; i++) {
    const uint32_t v = wrapped(c[i], core);
    int seen = v == now;
    for (uint32_t j = 0; j < n && !seen; j++) seen = out[j] == v;
    if (!seen) out[n++] = v;
  }
  return n;
}

// Points per 100 rounds of w against each panel warrior, rounds first ..
// first + rounds - 1, the seeds of the run plus `salt`; added into acc (wins,
// losses, ties) when acc is given.
static void opt_play(run *r, const m42_warrior *const *ws, uint32_t nw, uint32_t first, uint32_t rounds, uint64_t salt,
                     m42_score *acc) {
  const uint32_t P = r->panel_n;
  unit *u = xmalloc((size_t)nw * P * sizeof *u);
  for (uint32_t i = 0; i < nw; i++)
    for (uint32_t j = 0; j < P; j++)
      u[i * P + j] = (unit){ws[i], r->panel[j].w, seed_for(r, r->panel[j].id + salt), first, rounds, {{0}}, 0, 0};
  pool_run(r->pool, u, nw * P);
  for (uint32_t i = 0; i < nw * P; i++) acc[i] = add_scores(acc[i], u[i].s[0]);
  free(u);
}

// Mean and standard error of the differences per panel warrior, a minus b.
static void opt_diff(const m42_score *a, const m42_score *b, uint32_t P, double *mean, double *se) {
  double s = 0, ss = 0;
  for (uint32_t j = 0; j < P; j++) {
    const double d = points_of(a[j]) - points_of(b[j]);
    s += d, ss += d * d;
  }
  *mean = s / P;
  const double var = P > 1 ? (ss - s * s / P) / (P - 1) : 0;
  *se = var > 0 ? sqrt(var / P) : 0;
}

static double opt_avg(const m42_score *a, uint32_t P) {
  double s = 0;
  for (uint32_t j = 0; j < P; j++) s += points_of(a[j]);
  return s / P;
}

static double opt_holdout(run *r, const m42_warrior *w) {
  unit *u = xmalloc((r->hold_n ? r->hold_n : 1) * sizeof *u);
  for (uint32_t i = 0; i < r->hold_n; i++)
    u[i] = (unit){w, r->hold[i].w, seed_for(r, r->hold[i].id), 0, r->p.bench_rounds, {{0}}, 0, 0};
  pool_run(r->pool, u, r->hold_n);
  double s = 0;
  for (uint32_t i = 0; i < r->hold_n; i++) s += points(u[i].s[0], r->p.bench_rounds);
  free(u);
  return r->hold_n ? s / r->hold_n : 0;
}

typedef void (*opt_start_fn)(run *r, void *ctx, uint32_t nconst, const m42_warrior *w, double avg);

// ---------------------------------------------------------------- the moves (--optimize-moves, #249)

// One constant at a time found nothing on the warriors evolution had tuned:
// the steps left are those that change two things together, and on warriors
// of 4 to 7 instructions that neighbourhood is small enough to search
// completely. A position is what a move changes; its candidates are every
// change of that kind there, all played as one constant's candidates are.
//   constants    one constant (opt_candidates()), as before #249
//   fields       one field: an opcode, a modifier, an A or B mode (field x
//                = 4 i + 0 .. 3 of instruction i), or the start (x = 4 len)
//   pairs        two far constants together, by the same amount d (their
//                difference stays) and by opposite ones (their sum stays),
//                d = ±1 .. ±8 and ±1/2, ±1/3, ±2/3, ±1/4, ±3/4 of the core
//   field-pairs  two fields at once, every value of each; only for warriors
//                of up to FIELD_PAIRS_MAX instructions
// The positions of a pass: those of each move given, in this order; a step
// is taken where it is found and the same position is tried again.
#define FIELD_PAIRS_MAX 8
static const char *const MOVE_NAMES[] = {"constants", "fields", "pairs", "field-pairs"};
static const char *const FIELD_NAMES[] = {"op", "mod", "am", "bm", "start"};

typedef struct {
  uint8_t move; // 0 .. 3, MOVE_NAMES
  uint32_t x, y; // constants: x the constant; fields: x the field; pairs: the constants x, y; field-pairs: the fields x, y
} opt_pos;

static uint32_t field_kind(const genome *g, uint32_t x) { return x < 4 * g->len ? x % 4 : 4; }
static uint32_t field_values(const genome *g, uint32_t x) {
  static const uint32_t n[] = {GENOME_OPCODES, 7, 8, 8};
  const uint32_t f = field_kind(g, x);
  return f < 4 ? n[f] : g->len;
}
static uint32_t field_get(const genome *g, uint32_t x) {
  const gene *e = &g->g[x / 4];
  switch (field_kind(g, x)) {
    case 0: return e->op;
    case 1: return e->mod;
    case 2: return e->am;
    case 3: return e->bm;
    default: return g->start;
  }
}
static void field_set(genome *g, uint32_t x, uint32_t v) {
  gene *e = &g->g[x / 4];
  switch (field_kind(g, x)) {
    case 0: e->op = (uint8_t)v; break;
    case 1: e->mod = (uint8_t)v; break;
    case 2: e->am = (uint8_t)v; break;
    case 3: e->bm = (uint8_t)v; break;
    default: g->start = v;
  }
}

// The fields of g: every instruction's four, and the start when there is a choice.
static uint32_t field_count(const genome *g) { return 4 * g->len + (g->len > 1); }

// The positions of the moves given (bits of MOVE_*), in their order; how many. consts: the constants (the
// start last, as opt_search() lists them).
static uint32_t opt_positions(const genome *g, uint32_t moves, const uint32_t *consts, uint32_t nc, opt_pos **out) {
  const uint32_t F = field_count(g), far = nc && consts[nc - 1] == 2 * g->len ? nc - 1 : nc;
  const size_t most = nc + F + (size_t)far * far + (size_t)F * F + 1;
  opt_pos *q = xmalloc(most * sizeof *q);
  uint32_t n = 0;
  if (moves & MOVE_CONSTANTS)
    for (uint32_t i = 0; i < nc; i++) q[n++] = (opt_pos){0, consts[i], 0};
  if (moves & MOVE_FIELDS)
    for (uint32_t x = 0; x < F; x++)
      if (x < 4 * g->len || !(moves & MOVE_CONSTANTS)) q[n++] = (opt_pos){1, x, 0}; // the start is a constant too
  if (moves & MOVE_PAIRS)
    for (uint32_t i = 0; i < far; i++)
      for (uint32_t j = i + 1; j < far; j++) q[n++] = (opt_pos){2, consts[i], consts[j]};
  if ((moves & MOVE_FIELD_PAIRS) && g->len <= FIELD_PAIRS_MAX)
    for (uint32_t x = 0; x < F; x++)
      for (uint32_t y = x + 1; y < F; y++) q[n++] = (opt_pos){3, x, y};
  *out = q;
  return n;
}

// The candidates of position q of g into *out (grown as needed, *cap its size); how many.
static uint32_t opt_moves(const genome *g, const opt_pos *q, uint32_t core, const uint32_t *consts, uint32_t nc, genome **out,
                          uint32_t *cap) {
  uint32_t n = 0;
#define ADD_CANDIDATE()                                                 \
  do {                                                                  \
    if (n == *cap) {                                                    \
      *cap = *cap ? 2 * *cap : 64;                                      \
      genome *t = xmalloc(*cap * sizeof *t);                            \
      if (n) memcpy(t, *out, n * sizeof *t);                            \
      free(*out);                                                       \
      *out = t;                                                         \
    }                                                                   \
    (*out)[n] = *g;                                                     \
  } while (0)
  if (q->move == 0) {
    uint32_t v[128];
    const uint32_t m = opt_candidates((genome *)g, q->x, core, consts, nc, v);
    for (uint32_t i = 0; i < m; i++) {
      ADD_CANDIDATE();
      *opt_slot(&(*out)[n++], q->x) = v[i];
    }
  } else if (q->move == 1) {
    const uint32_t now = field_get(g, q->x), m = field_values(g, q->x);
    for (uint32_t v = 0; v < m; v++)
      if (v != now) {
        ADD_CANDIDATE();
        field_set(&(*out)[n++], q->x, v);
      }
  } else if (q->move == 2) {
    const uint32_t a = *opt_slot((genome *)g, q->x), b = *opt_slot((genome *)g, q->y);
    int64_t d[26];
    uint32_t nd = 0;
    for (int k = 1; k <= 8; k++) d[nd++] = k, d[nd++] = -k;
    static const int frac[][2] = {{1, 2}, {1, 3}, {2, 3}, {1, 4}, {3, 4}};
    for (int f = 0; f < 5; f++) d[nd++] = (int64_t)core * frac[f][0] / frac[f][1], d[nd++] = -((int64_t)core * frac[f][0] / frac[f][1]);
    uint32_t seen[2 * 26][2], ns = 0;
    for (uint32_t k = 0; k < nd; k++)
      for (int opposite = 0; opposite < 2; opposite++) {
        const uint32_t va = wrapped((int64_t)a + d[k], core), vb = wrapped((int64_t)b + (opposite ? -d[k] : d[k]), core);
        int dup = va == a && vb == b;
        for (uint32_t i = 0; i < ns && !dup; i++) dup = seen[i][0] == va && seen[i][1] == vb;
        if (dup) continue;
        seen[ns][0] = va, seen[ns++][1] = vb;
        ADD_CANDIDATE();
        *opt_slot(&(*out)[n], q->x) = va;
        *opt_slot(&(*out)[n++], q->y) = vb;
      }
  } else {
    const uint32_t nx = field_get(g, q->x), ny = field_get(g, q->y), mx = field_values(g, q->x), my = field_values(g, q->y);
    for (uint32_t vx = 0; vx < mx; vx++)
      for (uint32_t vy = 0; vy < my; vy++)
        if (vx != nx && vy != ny) {
          ADD_CANDIDATE();
          field_set(&(*out)[n], q->x, vx);
          field_set(&(*out)[n++], q->y, vy);
        }
  }
#undef ADD_CANDIDATE
  return n;
}

// What a step changed, from g to h at position q: {"field", "at" (its instruction, the start: -1), "from",
// "to"} for each thing it changed; operand values signed, the others as they are stored.
static void opt_changes(FILE *f, const genome *g, const genome *h, const opt_pos *q, uint32_t core) {
  fputc('[', f);
  for (int k = 0; k < (q->move >= 2 ? 2 : 1); k++) {
    const uint32_t x = k ? q->y : q->x;
    if (k) fputc(',', f);
    if (q->move == 0 || q->move == 2) { // a constant: operand x / 2, or the start
      const int start = x == 2 * g->len;
      fprintf(f, "{\"field\":\"%s\",\"at\":%d,\"from\":%d,\"to\":%d}", start ? "start" : x % 2 ? "b" : "a", start ? -1 : (int)(x / 2),
              start ? (int)g->start : signed_of(*opt_slot((genome *)g, x), core), start ? (int)h->start : signed_of(*opt_slot((genome *)h, x), core));
    } else {
      const uint32_t fk = field_kind(g, x);
      fprintf(f, "{\"field\":\"%s\",\"at\":%d,\"from\":%u,\"to\":%u}", FIELD_NAMES[fk], fk == 4 ? -1 : (int)(x / 4), field_get(g, x), field_get(h, x));
    }
  }
  fputc(']', f);
}

// The search on genome g, changed in place to the best found: at most
// `passes` passes over the positions of the moves (bits of MOVE_*). on_start
// (if any) gets the number of constants, the warrior and its average against
// the panel before the first step; log (if any) gets an event `optimize-try`
// for each position tried (its candidates, how many were ahead after the
// first rounds, whether it took a step) and `optimize-step` for each step.
// Returns the steps taken; *avg0, *avg1 the average against the panel before
// and after; *out (if given) the warrior of the result, else it is freed.
static uint32_t opt_search(run *r, genome *g_io, uint32_t passes, uint32_t moves, opt_start_fn on_start, void *ctx, FILE *log,
                           double *avg0, double *avg1, m42_warrior **out) {
  const params *p = &r->p;
  const uint32_t core = p->rules.core_size, P = r->panel_n, R = p->rounds, F = OPT_FIRST < R ? OPT_FIRST : R;
  genome g = *g_io;
  uint32_t consts[2 * GENOME_MAX + 1], nc = 0;
  for (uint32_t i = 0; i < g.len; i++) {
    if (!g.g[i].aref && abs(signed_of(g.g[i].a, core)) > 16) consts[nc++] = 2 * i;
    if (!g.g[i].bref && abs(signed_of(g.g[i].b, core)) > 16) consts[nc++] = 2 * i + 1;
  }
  if (g.len > 1) consts[nc++] = 2 * g.len;
  opt_pos *pos;
  const uint32_t npos = opt_positions(&g, moves, consts, nc, &pos);
  if ((moves & MOVE_FIELD_PAIRS) && g.len > FIELD_PAIRS_MAX)
    fprintf(stderr, "42evolve: --optimize-moves field-pairs: %u instructions, more than %d: no field pairs\n", g.len, FIELD_PAIRS_MAX);
  m42_warrior *cur = make_warrior(&g, &p->rules);
  m42_score *cur1 = calloc(P, sizeof *cur1), *curw = calloc(P, sizeof *curw);
  opt_play(r, (const m42_warrior *const *)&cur, 1, 0, F, 0, cur1);
  memcpy(curw, cur1, P * sizeof *curw);
  if (R > F) opt_play(r, (const m42_warrior *const *)&cur, 1, F, R - F, 0, curw);
  *avg0 = opt_avg(curw, P);
  if (on_start) on_start(r, ctx, nc, cur, *avg0);
  genome *cg = 0;
  uint32_t cap = 0, wcap = 0;
  m42_warrior **cw = 0;
  m42_score *s1 = 0, *sw = 0;
  uint32_t *ahead = 0;
  uint32_t accepted = 0;
  for (uint32_t pass = 1; pass <= passes && !stop_now; pass++) {
    uint32_t in_pass = 0;
    for (uint32_t pi = 0; pi < npos && !stop_now; pi++) {
      const opt_pos *q = &pos[pi];
      for (;;) {
        const uint32_t n = opt_moves(&g, q, core, consts, nc, &cg, &cap);
        if (!n) break;
        if (n > wcap) {
          free(cw), free(s1), free(sw), free(ahead);
          wcap = n;
          cw = xmalloc(n * sizeof *cw), ahead = xmalloc(n * sizeof *ahead);
          s1 = xmalloc((size_t)n * P * sizeof *s1), sw = xmalloc((size_t)n * P * sizeof *sw);
        }
        for (uint32_t i = 0; i < n; i++) cw[i] = make_warrior(&cg[i], &p->rules);
        // the first rounds for all, the rest for those ahead then
        memset(s1, 0, (size_t)n * P * sizeof *s1);
        opt_play(r, (const m42_warrior *const *)cw, n, 0, F, 0, s1);
        uint32_t na = 0;
        for (uint32_t i = 0; i < n; i++) {
          double d, se;
          opt_diff(s1 + (size_t)i * P, cur1, P, &d, &se);
          if (d > 0) ahead[na++] = i;
        }
        int best = -1;
        double best_d = 0, best_se = 0;
        if (na && R > F) {
          const m42_warrior **aw = xmalloc(na * sizeof *aw);
          for (uint32_t i = 0; i < na; i++) aw[i] = cw[ahead[i]];
          m42_score *rest = calloc((size_t)na * P, sizeof *rest);
          opt_play(r, aw, na, F, R - F, 0, rest);
          for (uint32_t i = 0; i < na; i++) {
            for (uint32_t j = 0; j < P; j++)
              sw[(size_t)ahead[i] * P + j] = add_scores(s1[(size_t)ahead[i] * P + j], rest[(size_t)i * P + j]);
            double d, se;
            opt_diff(sw + (size_t)ahead[i] * P, curw, P, &d, &se);
            if (d > OPT_Z * se && d > best_d) best = (int)ahead[i], best_d = d, best_se = se;
          }
          free(rest);
          free(aw);
        }
        int ok = 0;
        double cd = 0, cse = 0;
        if (best >= 0) { // confirmed with other seeds
          m42_score *a = calloc(P, sizeof *a), *b = calloc(P, sizeof *b);
          const m42_warrior *pair[2] = {cw[best], cur};
          opt_play(r, pair, 1, 0, R, 0x6f707431u, a);
          opt_play(r, pair + 1, 1, 0, R, 0x6f707431u, b);
          opt_diff(a, b, P, &cd, &cse);
          ok = cd > OPT_Z * cse && cd > 0;
          free(a);
          free(b);
        }
        if (log) {
          fprintf(log, "{\"type\":\"optimize-try\",\"pass\":%u,\"move\":\"%s\",\"at\":[%u", pass, MOVE_NAMES[q->move], q->x);
          if (q->move >= 2) fprintf(log, ",%u", q->y);
          fprintf(log, "],\"candidates\":%u,\"ahead\":%u,\"step\":%s}\n", n, na, ok ? "true" : "false");
        }
        if (ok) {
          if (log) {
            fprintf(log, "{\"type\":\"optimize-step\",\"pass\":%u,\"move\":\"%s\",", pass, MOVE_NAMES[q->move]);
            if (q->move == 0) {
              const uint32_t k = q->x;
              fprintf(log, "\"constant\":%u,\"what\":\"%s\",\"from\":%d,\"to\":%d,", k, k == 2 * g.len ? "start" : k % 2 ? "b" : "a",
                      k == 2 * g.len ? (int)g.start : signed_of(*opt_slot(&g, k), core),
                      k == 2 * g.len ? (int)cg[best].start : signed_of(*opt_slot(&cg[best], k), core));
            }
            fputs("\"changes\":", log);
            opt_changes(log, &g, &cg[best], q, core);
            m42_score *w = sw + (size_t)best * P;
            fprintf(log, ",\"avg\":%.6f,\"gain\":%.6f,\"se\":%.6f,\"confirm\":%.6f,\"confirmSe\":%.6f,\"candidates\":%u}\n", opt_avg(w, P),
                    best_d, best_se, cd, cse, n);
            fflush(log);
            fprintf(stderr, "pass %u: %s at %u", pass, MOVE_NAMES[q->move], q->x);
            if (q->move >= 2) fprintf(stderr, " and %u", q->y);
            fprintf(stderr, ", %.1f against the panel (+%.2f, se %.2f)\n", opt_avg(w, P), best_d, best_se);
          }
          g = cg[best];
          free(cur);
          cur = cw[best];
          cw[best] = 0;
          memcpy(cur1, s1 + (size_t)best * P, P * sizeof *cur1);
          memcpy(curw, sw + (size_t)best * P, P * sizeof *curw);
          accepted++, in_pass++;
        }
        for (uint32_t i = 0; i < n; i++) free(cw[i]);
        if (!ok) break;
      }
    }
    if (!in_pass) break;
  }
  *avg1 = opt_avg(curw, P);
  *g_io = g;
  if (out) *out = cur;
  else free(cur);
  free(cur1), free(curw), free(cw), free(s1), free(sw), free(ahead), free(cg), free(pos);
  return accepted;
}

typedef struct {
  const char *file, *name;
  double hold;
} opt_ctx;

// --optimize: the event `optimize` before the first step.
static void opt_start(run *r, void *ctx, uint32_t nc, const m42_warrior *w, double avg) {
  opt_ctx *o = ctx;
  o->hold = opt_holdout(r, w);
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"optimize\",\"file\":");
  json_str(f, o->file, 1);
  fprintf(f, ",\"name\":");
  json_str(f, o->name, 1);
  fputs(",\"moves\":\"", f);
  const uint32_t moves = r->p.optimize_moves ? r->p.optimize_moves : MOVE_CONSTANTS;
  for (int k = 0, n = 0; k < 4; k++)
    if (moves & (1u << k)) fprintf(f, "%s%s", n++ ? "," : "", MOVE_NAMES[k]);
  fprintf(f, "\",\"constants\":%u,\"rounds\":%u,\"avg\":%.6f,\"holdout\":%.6f,\"panel\":[", nc, r->p.rounds, avg, o->hold);
  for (uint32_t j = 0; j < r->panel_n; j++) {
    fprintf(f, "%s{\"file\":", j ? "," : "");
    json_str(f, r->panel[j].file, 1);
    fprintf(f, ",\"seed\":%" PRId64 "}", seed_for(r, r->panel[j].id));
  }
  fputs("]}\n", f);
}

int optimize(run *r, const char *file) {
  const params *p = &r->p;
  const uint32_t core = p->rules.core_size, P = r->panel_n;
  size_t len;
  char *src = read_file(file, &len);
  int status;
  m42_warrior *orig = src ? m42_assemble_new(src, len, &p->rules, 0, 0, &status) : 0;
  if (!orig || !m42_warrior_ok(orig) || m42_warrior_length(orig) > p->rules.max_length || m42_warrior_uses_pspace(orig)) {
    fprintf(stderr, "42evolve: --optimize: %s does not fit the rules\n", file);
    return 2;
  }
  char name[64];
  m42_warrior_text(orig, M42_NAME, name, sizeof name);
  genome g;
  genome_from_code(&g, m42_warrior_code(orig), m42_warrior_length(orig), m42_warrior_start(orig), core);
  opt_ctx ctx = {file, name, 0};
  double start_avg, end_avg;
  m42_warrior *cur;
  const uint32_t accepted = opt_search(r, &g, OPT_PASSES, p->optimize_moves ? p->optimize_moves : MOVE_CONSTANTS, opt_start, &ctx, r->events,
                                        &start_avg, &end_avg, &cur);
  const double start_hold = ctx.hold, end_hold = opt_holdout(r, cur);
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"optimize-end\",\"accepted\":%u,\"avg\":%.6f,\"holdout\":%.6f}\n", accepted, end_avg, end_hold);
  char path[1100], text[GENOME_MAX * 48 + 64];
  snprintf(path, sizeof path, "%s/optimized.red", r->dir);
  FILE *o = fopen(path, "w");
  if (o) {
    genome_text(&g, core, text, sizeof text);
    fprintf(o,
            "%s\n;name %s\n;strategy %s with its constants optimized by 42evolve: %u steps, %.1f to %.1f against %u "
            "panel warriors, %.1f to %.1f against %u holdout warriors\n%s",
            core == 8000 ? ";redcode-94nop" : ";redcode", name, name, accepted, start_avg, end_avg, P, start_hold, end_hold,
            r->hold_n, text);
    fclose(o);
  }
  fprintf(stderr, "42evolve: %u steps, %.1f to %.1f against the panel, %.1f to %.1f against the holdout; %s\n", accepted,
          start_avg, end_avg, start_hold, end_hold, path);
  free(cur);
  m42_warrior_free(orig);
  free(src);
  return 0;
}
