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

// The search on genome g, changed in place to the best found: at most
// `passes` passes over its constants. on_start (if any) gets the number of
// constants, the warrior and its average against the panel before the first
// step; log (if any) gets an event `optimize-step` for each step. Returns the
// steps taken; *avg0, *avg1 the average against the panel before and after;
// *out (if given) the warrior of the result, else it is freed.
static uint32_t opt_search(run *r, genome *g_io, uint32_t passes, opt_start_fn on_start, void *ctx, FILE *log, double *avg0,
                           double *avg1, m42_warrior **out) {
  const params *p = &r->p;
  const uint32_t core = p->rules.core_size, P = r->panel_n, R = p->rounds, F = OPT_FIRST < R ? OPT_FIRST : R;
  genome g = *g_io;
  uint32_t consts[2 * GENOME_MAX + 1], nc = 0;
  for (uint32_t i = 0; i < g.len; i++) {
    if (!g.g[i].aref && abs(signed_of(g.g[i].a, core)) > 16) consts[nc++] = 2 * i;
    if (!g.g[i].bref && abs(signed_of(g.g[i].b, core)) > 16) consts[nc++] = 2 * i + 1;
  }
  if (g.len > 1) consts[nc++] = 2 * g.len;
  m42_warrior *cur = make_warrior(&g, &p->rules);
  m42_score *cur1 = calloc(P, sizeof *cur1), *curw = calloc(P, sizeof *curw);
  opt_play(r, (const m42_warrior *const *)&cur, 1, 0, F, 0, cur1);
  memcpy(curw, cur1, P * sizeof *curw);
  if (R > F) opt_play(r, (const m42_warrior *const *)&cur, 1, F, R - F, 0, curw);
  *avg0 = opt_avg(curw, P);
  if (on_start) on_start(r, ctx, nc, cur, *avg0);
  uint32_t cand[128];
  m42_warrior **cw = xmalloc(128 * sizeof *cw);
  m42_score *s1 = xmalloc((size_t)128 * P * sizeof *s1), *sw = xmalloc((size_t)128 * P * sizeof *sw);
  uint32_t accepted = 0;
  for (uint32_t pass = 1; pass <= passes && !stop_now; pass++) {
    uint32_t in_pass = 0;
    for (uint32_t ci = 0; ci < nc && !stop_now; ci++) {
      const uint32_t k = consts[ci];
      for (;;) {
        const uint32_t n = opt_candidates(&g, k, core, consts, nc, cand);
        if (!n) break;
        genome *cg = xmalloc(n * sizeof *cg);
        for (uint32_t i = 0; i < n; i++) {
          cg[i] = g;
          *opt_slot(&cg[i], k) = cand[i];
          cw[i] = make_warrior(&cg[i], &p->rules);
        }
        // the first rounds for all, the rest for those ahead then
        memset(s1, 0, (size_t)n * P * sizeof *s1);
        opt_play(r, (const m42_warrior *const *)cw, n, 0, F, 0, s1);
        uint32_t ahead[128], na = 0;
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
        if (ok) {
          const uint32_t from = *opt_slot(&g, k);
          g = cg[best];
          free(cur);
          cur = cw[best];
          cw[best] = 0;
          memcpy(cur1, s1 + (size_t)best * P, P * sizeof *cur1);
          memcpy(curw, sw + (size_t)best * P, P * sizeof *curw);
          accepted++, in_pass++;
          if (log) {
            fprintf(log,
                    "{\"type\":\"optimize-step\",\"pass\":%u,\"constant\":%u,\"what\":\"%s\",\"from\":%d,\"to\":%d,"
                    "\"avg\":%.6f,\"gain\":%.6f,\"se\":%.6f,\"confirm\":%.6f,\"confirmSe\":%.6f,\"candidates\":%u}\n",
                    pass, k, k == 2 * g.len ? "start" : k % 2 ? "b" : "a", k == 2 * g.len ? (int)from : signed_of(from, core),
                    k == 2 * g.len ? (int)*opt_slot(&g, k) : signed_of(*opt_slot(&g, k), core), opt_avg(curw, P), best_d,
                    best_se, cd, cse, n);
            fflush(log);
            fprintf(stderr, "pass %u: constant %u from %d to %d, %.1f against the panel (+%.2f, se %.2f)\n", pass, k,
                    signed_of(from, core), signed_of(*opt_slot(&g, k), core), opt_avg(curw, P), best_d, best_se);
          }
        }
        for (uint32_t i = 0; i < n; i++) free(cw[i]);
        free(cg);
        if (!ok) break;
      }
    }
    if (!in_pass) break;
  }
  *avg1 = opt_avg(curw, P);
  *g_io = g;
  if (out) *out = cur;
  else free(cur);
  free(cur1);
  free(curw);
  free(cw);
  free(s1);
  free(sw);
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
  fprintf(f, ",\"constants\":%u,\"rounds\":%u,\"avg\":%.6f,\"holdout\":%.6f,\"panel\":[", nc, r->p.rounds, avg, o->hold);
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
  const uint32_t accepted = opt_search(r, &g, OPT_PASSES, opt_start, &ctx, r->events, &start_avg, &end_avg, &cur);
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
