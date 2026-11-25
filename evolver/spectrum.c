// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// 42spectrum: what one change does to a warrior. For each warrior and each
// kind of change (genome_change()), many children with exactly that one
// change play a panel of hill warriors with the same seeds as their parent,
// and are counted as identical (the same results in every round of every
// match: the change was in code that does not matter), fatal (20 points or
// more below the parent), worse (2 to 20), the same (within 2) or better (2
// or more above). Every better child is played again against the parent with
// other seeds and more rounds; it is confirmed when it is still at least 1
// point above. Points are per 100 rounds, 3 a win and 1 a tie.
//
//   42spectrum --opponents <dir> [--panel 40] [--children 250] [--rounds 50]
//              [--confirm-rounds 200] [--seed 1] [--threads N] [--json out.json]
//              [--size 8000 --cycles 80000 --processes 8000 --length 100
//               --distance 100] <warrior.red> ...
//
// Crossover takes its second parent from the next warrior given (the same
// one if only one is given). POSIX threads; docs/evolver.md has results.

#define _POSIX_C_SOURCE 200809L
#define _DARWIN_C_SOURCE

#include <dirent.h>
#include <math.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "42mars.h"
#include "genome.h"
#include "rng.h"

static void *xmalloc(size_t n) {
  void *p = calloc(1, n ? n : 1);
  if (!p) {
    fprintf(stderr, "42spectrum: out of memory\n");
    exit(1);
  }
  return p;
}

static char *read_file(const char *path, size_t *len) {
  FILE *f = fopen(path, "rb");
  if (!f) return 0;
  size_t cap = 1 << 14, n = 0;
  char *buf = xmalloc(cap + 1);
  for (size_t got; (got = fread(buf + n, 1, cap - n, f)) > 0;) {
    n += got;
    if (n == cap) {
      buf = realloc(buf, (cap *= 2) + 1);
      if (!buf) exit(1);
    }
  }
  fclose(f);
  buf[n] = 0;
  *len = n;
  return buf;
}

static m42_warrior *assemble_file(const char *path, const m42_rules *rules, int quiet) {
  size_t len;
  char *src = read_file(path, &len);
  if (!src) {
    if (!quiet) fprintf(stderr, "42spectrum: cannot read %s\n", path);
    return 0;
  }
  int status;
  m42_warrior *w = m42_assemble_new(src, len, rules, 0, 0, &status);
  free(src);
  if (!w || !m42_warrior_ok(w) || m42_warrior_length(w) > rules->max_length || m42_warrior_uses_pspace(w)) {
    if (!quiet) fprintf(stderr, "42spectrum: %s does not fit the rules\n", path);
    m42_warrior_free(w);
    return 0;
  }
  return w;
}

static int by_name(const void *a, const void *b) { return strcmp(*(char *const *)a, *(char *const *)b); }

// ---------------------------------------------------------------- matches on all threads

typedef struct {
  const m42_warrior *w0, *w1;
  int64_t seed;
  uint32_t rounds;
  m42_score s;
} unit;

static struct {
  pthread_mutex_t mutex;
  unit *units;
  uint32_t n, next;
  const m42_rules *rules;
} work = {PTHREAD_MUTEX_INITIALIZER, 0, 0, 0, 0};

static void *worker(void *arg) {
  (void)arg;
  int status;
  m42_ctx *m = m42_new(work.rules, &status);
  if (!m) {
    fprintf(stderr, "42spectrum: %s\n", m42_status_text(status));
    exit(1);
  }
  for (;;) {
    pthread_mutex_lock(&work.mutex);
    const uint32_t i = work.next < work.n ? work.next++ : UINT32_MAX;
    pthread_mutex_unlock(&work.mutex);
    if (i == UINT32_MAX) break;
    unit *u = &work.units[i];
    m42_match_options o = m42_match_options_default();
    o.rounds = u->rounds;
    o.seed = u->seed;
    const m42_warrior *ws[2] = {u->w0, u->w1};
    m42_score s[2];
    if (m42_match(m, ws, 2, &o, s, 0) != M42_OK) {
      fprintf(stderr, "42spectrum: match failed\n");
      exit(1);
    }
    u->s = s[0];
  }
  m42_free(m);
  return 0;
}

static void run_units(unit *units, uint32_t n, uint32_t threads) {
  work.units = units;
  work.n = n;
  work.next = 0;
  pthread_t *t = xmalloc(threads * sizeof *t);
  for (uint32_t i = 0; i < threads; i++)
    if (pthread_create(&t[i], 0, worker, 0) != 0) {
      fprintf(stderr, "42spectrum: cannot start a thread\n");
      exit(1);
    }
  for (uint32_t i = 0; i < threads; i++) pthread_join(t[i], 0);
  free(t);
}

static double points(m42_score s, uint32_t rounds) { return (3.0 * s.wins + s.ties) * 100.0 / rounds; }

// ---------------------------------------------------------------- main

static m42_warrior *make(const genome *g, const m42_rules *rules) {
  m42_instruction code[GENOME_MAX];
  genome_code(g, rules->core_size, code);
  const size_t size = m42_warrior_make_size(g->len);
  m42_warrior *w = m42_warrior_make(code, g->len, g->start, 0, xmalloc(size), size);
  if (!w) exit(1);
  return w;
}

static int64_t seed_of(uint64_t seed, uint64_t salt, uint32_t j, const m42_rules *r) {
  return (int64_t)(rng_mix(seed * 0x9e3779b97f4a7c15u ^ rng_mix(salt * 1000003u + j)) % (r->core_size - 2 * r->min_distance + 1));
}

static void usage(void) {
  fprintf(stderr, "usage: 42spectrum --opponents <dir> [--panel 40] [--children 250] [--rounds 50] [--confirm-rounds 200]\n"
                  "         [--seed 1] [--threads N] [--json out.json] [--size --cycles --processes --length --distance]\n"
                  "         <warrior.red> ...\n");
  exit(2);
}

enum { IDENTICAL, FATAL, WORSE, SAME, BETTER, CLASSES };

typedef struct {
  uint32_t tried, applied, cls[CLASSES], confirmed, same_code; // same_code: identical because the code is
  double sum, best_confirmed;
} tally;

int main(int argc, char **argv) {
  m42_rules rules = m42_rules_94();
  const char *opponents = 0, *json = 0;
  uint32_t panel_n = 40, children = 250, rounds = 50, confirm_rounds = 200, threads = 0;
  uint64_t seed = 1;
  const char *files[64];
  uint32_t nf = 0;
  for (int i = 1; i < argc; i++) {
    const char *a = argv[i];
    if (a[0] != '-') {
      if (nf == 64) usage();
      files[nf++] = a;
      continue;
    }
    if (i + 1 >= argc) usage();
    const char *v = argv[++i];
    const unsigned long u = strtoul(v, 0, 10);
    if (!strcmp(a, "--opponents")) opponents = v;
    else if (!strcmp(a, "--json")) json = v;
    else if (!strcmp(a, "--panel")) panel_n = (uint32_t)u;
    else if (!strcmp(a, "--children")) children = (uint32_t)u;
    else if (!strcmp(a, "--rounds")) rounds = (uint32_t)u;
    else if (!strcmp(a, "--confirm-rounds")) confirm_rounds = (uint32_t)u;
    else if (!strcmp(a, "--seed")) seed = u;
    else if (!strcmp(a, "--threads")) threads = (uint32_t)u;
    else if (!strcmp(a, "--size")) rules.core_size = (uint32_t)u;
    else if (!strcmp(a, "--cycles")) rules.max_cycles = (uint32_t)u;
    else if (!strcmp(a, "--processes")) rules.max_processes = (uint32_t)u;
    else if (!strcmp(a, "--length")) rules.max_length = (uint32_t)u;
    else if (!strcmp(a, "--distance")) rules.min_distance = (uint32_t)u;
    else usage();
  }
  if (!opponents || !nf || !panel_n || !children || !rounds || !confirm_rounds || rules.max_length > GENOME_MAX) usage();
  if (!threads) threads = (uint32_t)sysconf(_SC_NPROCESSORS_ONLN);
  rules.rounds = rounds;
  rules.warriors = 2;
  work.rules = &rules;
  const uint32_t core = rules.core_size;

  // the panel: the opponents that fit the rules, shuffled with the seed
  DIR *d = opendir(opponents);
  if (!d) {
    fprintf(stderr, "42spectrum: cannot open %s\n", opponents);
    return 1;
  }
  uint32_t on = 0, ocap = 256;
  char **names = xmalloc(ocap * sizeof *names);
  for (struct dirent *e; (e = readdir(d));) {
    const size_t len = strlen(e->d_name);
    if (len < 5 || strcmp(e->d_name + len - 4, ".red")) continue;
    if (on == ocap) names = realloc(names, (ocap *= 2) * sizeof *names);
    names[on++] = strdup(e->d_name);
  }
  closedir(d);
  qsort(names, on, sizeof *names, by_name);
  m42_warrior **panel = xmalloc(on * sizeof *panel);
  uint32_t pn = 0;
  for (uint32_t i = 0; i < on; i++) {
    char path[4096];
    snprintf(path, sizeof path, "%s/%s", opponents, names[i]);
    m42_warrior *w = assemble_file(path, &rules, 1);
    if (w) panel[pn++] = w;
  }
  rng g = rng_seed(seed, 0x70616e656cu, 0);
  for (uint32_t i = pn; i > 1; i--) {
    const uint32_t j = rng_below(&g, i);
    m42_warrior *t = panel[i - 1];
    panel[i - 1] = panel[j];
    panel[j] = t;
  }
  const uint32_t pn_all = pn;
  if (pn > panel_n) pn = panel_n;
  if (pn < 2) {
    fprintf(stderr, "42spectrum: fewer than 2 opponents fit the rules\n");
    return 1;
  }

  genome *parent = xmalloc(nf * sizeof *parent);
  char (*pname)[64] = xmalloc(nf * sizeof *pname);
  for (uint32_t i = 0; i < nf; i++) {
    m42_warrior *w = assemble_file(files[i], &rules, 0);
    if (!w) return 1;
    genome_from_code(&parent[i], m42_warrior_code(w), m42_warrior_length(w), m42_warrior_start(w), core);
    m42_warrior_text(w, M42_NAME, pname[i], sizeof pname[i]);
    m42_warrior_free(w);
  }

  FILE *out = json ? fopen(json, "w") : 0;
  if (json && !out) {
    fprintf(stderr, "42spectrum: cannot write %s\n", json);
    return 1;
  }
  if (out) fprintf(out, "{\"panel\":%u,\"children\":%u,\"rounds\":%u,\"confirmRounds\":%u,\"seed\":%llu,\"warriors\":[", pn,
                   children, rounds, confirm_rounds, (unsigned long long)seed);

  for (uint32_t w = 0; w < nf; w++) {
    // the parent and all children of all kinds, in one go
    const uint32_t total = 1 + CH_COUNT * children;
    genome *kid = xmalloc((size_t)total * sizeof *kid);
    int *ok = xmalloc(total * sizeof *ok);
    m42_warrior **mw = xmalloc(total * sizeof *mw);
    kid[0] = parent[w];
    ok[0] = 1;
    const genome *mate = &parent[(w + 1) % nf];
    const uint64_t ph = genome_hash(&parent[w], core);
    for (int k = 0; k < CH_COUNT; k++)
      for (uint32_t c = 0; c < children; c++) {
        const uint32_t at = 1 + (uint32_t)k * children + c;
        rng r = rng_seed(seed, (uint64_t)w * 64 + (uint64_t)k, c);
        kid[at] = parent[w];
        ok[at] = genome_change(&kid[at], mate, &r, core, rules.max_length, k) ? 1 : 0;
        if (ok[at] && genome_hash(&kid[at], core) == ph) ok[at] = 2; // the same warrior
      }
    uint32_t nu = 0;
    for (uint32_t i = 0; i < total; i++)
      if (ok[i] == 1) nu += pn;
    unit *u = xmalloc((size_t)nu * sizeof *u);
    nu = 0;
    for (uint32_t i = 0; i < total; i++) {
      mw[i] = ok[i] == 1 ? make(&kid[i], &rules) : 0;
      for (uint32_t j = 0; j < pn && ok[i] == 1; j++)
        u[nu++] = (unit){mw[i], panel[j], seed_of(seed, 1, j, &rules), rounds, {0, 0, 0}};
    }
    run_units(u, nu, threads);
    // results: Δ of each child, the parent's row first
    double parent_avg = 0;
    for (uint32_t j = 0; j < pn; j++) parent_avg += points(u[j].s, rounds);
    parent_avg /= pn;
    tally t[CH_COUNT];
    memset(t, 0, sizeof t);
    double *delta = xmalloc(total * sizeof *delta);
    int *cls = xmalloc(total * sizeof *cls);
    uint32_t pos = pn, nb = 0;
    for (int k = 0; k < CH_COUNT; k++)
      for (uint32_t c = 0; c < children; c++) {
        const uint32_t at = 1 + (uint32_t)k * children + c;
        t[k].tried++;
        if (!ok[at]) continue;
        t[k].applied++;
        if (ok[at] == 2) {
          t[k].cls[IDENTICAL]++;
          t[k].same_code++;
          cls[at] = IDENTICAL, delta[at] = 0;
          continue;
        }
        double avg = 0;
        int same = 1;
        for (uint32_t j = 0; j < pn; j++, pos++) {
          avg += points(u[pos].s, rounds);
          same &= memcmp(&u[pos].s, &u[j].s, sizeof u[j].s) == 0;
        }
        avg /= pn;
        const double dv = avg - parent_avg;
        cls[at] = same ? IDENTICAL : dv <= -20 ? FATAL : dv <= -2 ? WORSE : dv < 2 ? SAME : BETTER;
        delta[at] = dv;
        t[k].cls[cls[at]]++;
        t[k].sum += dv;
        if (cls[at] == BETTER) nb++;
      }
    // better ones again, against the parent, with other seeds and more rounds
    unit *v = xmalloc((size_t)(nb + 1) * pn * sizeof *v);
    uint32_t nv = 0;
    for (uint32_t j = 0; j < pn; j++) v[nv++] = (unit){mw[0], panel[j], seed_of(seed, 2, j, &rules), confirm_rounds, {0, 0, 0}};
    for (uint32_t i = 1; i < total; i++)
      for (uint32_t j = 0; j < pn && ok[i] == 1 && cls[i] == BETTER; j++)
        v[nv++] = (unit){mw[i], panel[j], seed_of(seed, 2, j, &rules), confirm_rounds, {0, 0, 0}};
    run_units(v, nv, threads);
    double parent2 = 0;
    for (uint32_t j = 0; j < pn; j++) parent2 += points(v[j].s, confirm_rounds);
    parent2 /= pn;
    pos = pn;
    for (int k = 0; k < CH_COUNT; k++)
      for (uint32_t c = 0; c < children; c++) {
        const uint32_t at = 1 + (uint32_t)k * children + c;
        if (ok[at] != 1 || cls[at] != BETTER) continue;
        double avg = 0;
        for (uint32_t j = 0; j < pn; j++, pos++) avg += points(v[pos].s, confirm_rounds);
        const double d2 = avg / pn - parent2;
        if (d2 >= 1) {
          t[k].confirmed++;
          if (d2 > t[k].best_confirmed) t[k].best_confirmed = d2;
        }
      }
    printf("\n%s (%u instructions): %.1f against %u panel warriors, %u rounds\n", pname[w], parent[w].len, parent_avg, pn,
           rounds);
    printf("  %-18s %7s %9s %7s %7s %7s %7s %10s %8s %7s\n", "change", "applied", "identical", "fatal", "worse", "same",
           "better", "confirmed", "mean Δ", "best");
    for (int k = 0; k < CH_COUNT; k++) {
      const tally *x = &t[k];
      const double a = x->applied ? x->applied : 1, nonid = x->applied - x->cls[IDENTICAL];
      printf("  %-18s %7u %8.1f%% %6.1f%% %6.1f%% %6.1f%% %6.1f%% %9.2f%% %+8.2f %+7.1f\n", genome_change_name(k),
             x->applied, 100 * x->cls[IDENTICAL] / a, 100 * x->cls[FATAL] / a, 100 * x->cls[WORSE] / a,
             100 * x->cls[SAME] / a, 100 * x->cls[BETTER] / a, 100 * x->confirmed / a,
             nonid > 0 ? x->sum / nonid : 0, x->best_confirmed);
    }
    if (out) {
      fprintf(out, "%s{\"name\":\"%s\",\"length\":%u,\"panelAvg\":%.4f,\"changes\":{", w ? "," : "", pname[w], parent[w].len,
              parent_avg);
      for (int k = 0; k < CH_COUNT; k++)
        fprintf(out, "%s\"%s\":{\"tried\":%u,\"applied\":%u,\"identical\":%u,\"sameCode\":%u,\"fatal\":%u,\"worse\":%u,"
                     "\"same\":%u,\"better\":%u,\"confirmed\":%u,\"meanDelta\":%.4f,\"bestConfirmed\":%.4f}",
                k ? "," : "", genome_change_name(k), t[k].tried, t[k].applied, t[k].cls[IDENTICAL], t[k].same_code, t[k].cls[FATAL],
                t[k].cls[WORSE], t[k].cls[SAME], t[k].cls[BETTER], t[k].confirmed,
                t[k].applied - t[k].cls[IDENTICAL] ? t[k].sum / (t[k].applied - t[k].cls[IDENTICAL]) : 0,
                t[k].best_confirmed);
      fputs("}}", out);
    }
    fflush(stdout);
    for (uint32_t i = 0; i < total; i++) free(mw[i]);
    free(kid), free(ok), free(mw), free(u), free(v), free(delta), free(cls);
  }
  if (out) fputs("]}\n", out), fclose(out);
  for (uint32_t i = 0; i < on; i++) free(names[i]);
  free(names);
  for (uint32_t i = 0; i < pn_all; i++) m42_warrior_free(panel[i]);
  free(panel);
  free(parent);
  free(pname);
  return 0;
}
