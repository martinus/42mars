// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// 42evolve: evolves Redcode warriors against a panel of hill warriors, with
// a list kept by diversity push-off (#142, docs/evolver.md).
//
//   42evolve <run folder> --opponents <dir> [options]   a new run
//   42evolve <run folder> [--threads N] [--batches N] [--seconds S]
//            [--changes name=weight,...] [--reintroduce p] [--list N (larger)]
//            [--screen-stop z | --screen-check z]
//                                                       continue a run
//
// The run folder gets events.jsonl (what happened, for the dashboard),
// state.txt (to continue) and best.red. The same seed gives the same run on
// any number of threads. Ctrl-C ends the run after the current batch.
//
// POSIX threads; Linux and macOS.

#include "evolve.h"

static params default_params(void) {
  params p;
  memset(&p, 0, sizeof p);
  p.rules = m42_rules_94();
  p.panel = 30;   // by kinds (--panel-choice); the defaults of a new run are those of gen-var16-rnd (docs/evolver-gen.md)
  p.holdout = 100;
  p.list = 80;
  p.batch = 0; // 4 per thread
  p.survivors = 0; // batch / 8
  p.rounds = 100;
  p.screen_rounds = 20;
  p.bench_every = 10;
  p.bench_rounds = 100;
  p.init_length = 10;
  p.tie = 1;
  p.screen_factor = 0.8;
  p.alpha = 1;
  p.reintroduce = 0.02;
  p.sd = SD_OPPONENT;
  p.seed = 1;
  p.changes = genome_mix_default();
  return p;
}

void *xmalloc(size_t n) {
  void *p = calloc(1, n ? n : 1);
  if (!p) {
    fprintf(stderr, "42evolve: out of memory\n");
    exit(1);
  }
  return p;
}

char *read_file(const char *path, size_t *len) {
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

m42_warrior *make_warrior(const genome *g, const m42_rules *rules) {
  m42_instruction code[GENOME_MAX];
  genome_code(g, rules->core_size, code);
  const size_t size = m42_warrior_make_size(g->len);
  void *mem = xmalloc(size);
  m42_warrior *w = m42_warrior_make(code, g->len, g->start, 0, mem, size);
  if (!w) {
    fprintf(stderr, "42evolve: m42_warrior_make failed\n");
    exit(1);
  }
  return w;
}

volatile sig_atomic_t stop_now = 0;
static void on_signal(int sig) {
  stop_now = 1;
  signal(sig, SIG_DFL); // a second Ctrl-C ends it at once
}

void set_result(run *r, uint32_t a, uint32_t b, m42_score sa) {
  const uint32_t c = r->cap;
  m42_score sb = {sa.losses, sa.wins, sa.ties};
  r->wlt[a * c + b] = sa;
  r->wlt[b * c + a] = sb;
  r->pts[a * c + b] = points_of_t(sa, r->p.tie);
  r->pts[b * c + a] = points_of_t(sb, r->p.tie);
}

// The same for the results of the first stage (--stage).
void set_result1(run *r, uint32_t a, uint32_t b, m42_score sa) {
  const uint32_t c = r->cap;
  m42_score sb = {sa.losses, sa.wins, sa.ties};
  r->wlt1[a * c + b] = sa;
  r->wlt1[b * c + a] = sb;
  r->pts1[a * c + b] = points_of_t(sa, r->p.tie);
  r->pts1[b * c + a] = points_of_t(sb, r->p.tie);
}

void rebuild_active(run *r) {
  r->active_n = 0;
  for (uint32_t i = 0; i < r->cap; i++)
    if (r->slot[i]) r->active[r->active_n++] = i;
}

// --average panel: the push-off's average over the panel's columns only. With
// the average over everyone, the design that holds most of the list sets what
// a high average is, and a design it beats loses its place whatever its
// SD-score.
static void panel_average_values(run *r, const double *pts) {
  if (!r->p.average_panel) return;
  for (uint32_t i = 0; i < r->active_n; i++) {
    pushoff_value *v = &r->values[i];
    v->avg = panel_avg_on(r, pts, v->index);
    v->value = v->avg * with_alpha(r, v->distance);
  }
}

#define PARETO_STEP 10.0
#define PARETO_END 5.0
// --clear R: clearing (Petrowski 1996). On the fronts a copy of a strong
// member that scores a bit better on one objective stays: in pareto-sd lists
// of 18th November 2026 54 of 80 members were on the first front, the one
// pushed off was at the 21st percentile of the SD-scores to the nearest
// (with the value push-off always the nearest), and the members were half as
// far apart as with the value push-off. With clearing, the members by
// average, the strongest first, each a winner unless its SD-score to a
// winner before it is below R; the cleared ones get the fronts after those of
// the winners, so they leave first.
static void clear_members(const run *r, const double *pts, uint8_t *cleared) {
  const uint32_t P = r->panel_n, n = r->active_n - P;
  memset(cleared, 0, n);
  if (!(r->p.clear > 0)) return;
  uint32_t *order = xmalloc(n * sizeof *order);
  for (uint32_t i = 0; i < n; i++) {
    uint32_t k = i; // insertion by average, higher first, ties by index
    while (k && r->values[P + order[k - 1]].avg < r->values[P + i].avg) order[k] = order[k - 1], k--;
    order[k] = i;
  }
  for (uint32_t k = 0; k < n; k++) {
    const uint32_t i = order[k];
    if (r->values[P + i].distance >= r->p.clear) continue; // its nearest of all is farther
    for (uint32_t q = 0; q < k && !cleared[i]; q++) {
      const uint32_t w = order[q];
      if (cleared[w]) continue;
      const double d = pushoff_distance(pts, r->cap, r->active, r->active_n, r->values[P + i].index, r->values[P + w].index,
                                        r->sigma, r->p.distance_panel ? r->keep : 0, r->p.sd);
      if (d < r->p.clear) cleared[i] = 1;
    }
  }
  free(order);
}

// --pushoff pareto: instead of average * distance, the members' value is
// their place in NSGA-II's order (Deb et al. 2002) on two objectives: the
// average against the panel and the average against the other members.
// pareto-sd adds the SD-score to the nearest warrior (diversity as an
// objective, Mouret and Doncieux 2012): on long30's list of 18th November
// 32 of 80 were on the first front with it, 78 with the age of the line
// (pareto-age, removed in #193). value = 10 (F - f) +
// min(crowding, 5) with F fronts and f the warrior's, 0 the first: the
// lowest value is the most crowded of the last front, and a tournament by
// value is NSGA-II's crowded comparison. A copy of a warrior has its point
// and crowding 0, and leaves first. Panel warriors keep their values.
static void pareto_values(run *r, const double *pts) {
  if (!r->p.pareto) return;
  const uint32_t P = r->panel_n, n = r->active_n > P ? r->active_n - P : 0;
  if (!n) return;
  const uint32_t m = r->p.pareto == 3 ? 3 : 2; // pareto-sd: the SD-score too
  double *obj = xmalloc(3 * n * sizeof *obj), *crowd = xmalloc(n * sizeof *crowd);
  uint32_t *front = xmalloc(n * sizeof *front), *at = xmalloc(n * sizeof *at), won = 0;
  uint8_t *cleared = xmalloc(n);
  clear_members(r, pts, cleared);
  // the winners first, then the cleared ones, each in the order of the list
  for (uint32_t i = 0; i < n; i++)
    if (!cleared[i]) at[won++] = i;
  for (uint32_t i = 0, k = won; i < n; i++)
    if (cleared[i]) at[k++] = i;
  for (uint32_t j = 0; j < n; j++) {
    const uint32_t a = r->values[P + at[j]].index;
    double e = 0;
    for (uint32_t q = P; q < r->active_n; q++)
      if (r->active[q] != a) e += pts[a * r->cap + r->active[q]];
    obj[m * j] = panel_avg_on(r, pts, a);
    obj[m * j + 1] = n > 1 ? e / (n - 1) : 0;
    if (r->p.pareto == 3) obj[m * j + 2] = r->values[P + at[j]].distance; // farther from the nearest is better
  }
  // the fronts of the winners, then those of the cleared ones behind them
  pareto_fronts(obj, won, m, front, crowd);
  pareto_fronts(obj + m * won, n - won, m, front + won, crowd + won);
  uint32_t first = 0, fronts = 0;
  for (uint32_t j = 0; j < won; j++)
    if (front[j] + 1 > first) first = front[j] + 1;
  for (uint32_t j = 0; j < n; j++) {
    if (j >= won) front[j] += first;
    if (front[j] + 1 > fronts) fronts = front[j] + 1;
  }
  for (uint32_t j = 0; j < n; j++)
    r->values[P + at[j]].value = PARETO_STEP * (fronts - front[j]) + (crowd[j] < PARETO_END ? crowd[j] : PARETO_END);
  free(obj), free(crowd), free(front), free(at), free(cleared);
}

void compute_values(run *r) {
  pushoff_values(r->pts, r->cap, r->active, r->active_n, r->p.sd, r->p.alpha, r->p.distance_panel ? r->keep : 0, r->sigma,
                 r->values);
  panel_average_values(r, r->pts);
  pareto_values(r, r->pts);
}

// The same on the results of the first stage (--stage).
void compute_values1(run *r) {
  pushoff_values(r->pts1, r->cap, r->active, r->active_n, r->p.sd, r->p.alpha, r->p.distance_panel ? r->keep : 0, r->sigma,
                 r->values);
  panel_average_values(r, r->pts1);
  pareto_values(r, r->pts1);
}

// A warrior's average against the panel, points per 100 rounds; a panel
// warrior's own column does not count.

uint32_t free_slot(const run *r) {
  for (uint32_t i = r->panel_n; i < r->cap; i++)
    if (!r->slot[i]) return i;
  fprintf(stderr, "42evolve: no free slot\n");
  exit(1);
}

void free_warrior(warrior *w) {
  if (!w) return;
  free(w->w);
  free(w->g);
  free(w->file);
  free(w->source);
  free(w);
}

uint32_t slot_of_id(const run *r, uint64_t id) {
  for (uint32_t i = 0; i < r->cap; i++)
    if (r->slot[i] && r->slot[i]->id == id) return i;
  return UINT32_MAX;
}

void setup_matrix(run *r) {
  r->cap = r->panel_n + r->p.list + r->p.survivors + 1;
  const size_t c = r->cap;
  r->slot = xmalloc(c * sizeof *r->slot);
  r->wlt = xmalloc(c * c * sizeof *r->wlt);
  r->pts = xmalloc(c * c * sizeof *r->pts);
  r->wlt1 = xmalloc(c * c * sizeof *r->wlt1);
  r->pts1 = xmalloc(c * c * sizeof *r->pts1);
  r->keep = xmalloc(c);
  r->sigma = xmalloc(c * sizeof *r->sigma);
  r->values = xmalloc(c * sizeof *r->values);
  r->active = xmalloc(c * sizeof *r->active);
  for (uint32_t i = 0; i < r->panel_n; i++) {
    r->slot[i] = &r->panel[i];
    r->keep[i] = 1;
  }
}

// ---------------------------------------------------------------- main

static void usage(void) {
  fprintf(stderr,
          "usage: 42evolve <run folder> --opponents <dir> [--panel 30] [--holdout 100] [--list 80]\n"
          "         [--batch 128] [--survivors N] [--rounds 100] [--screen-rounds 20] [--screen-factor 0.8]\n"
          "         [--bench-every 10] [--bench-rounds 100] [--alpha 1] [--sd opponent|sum]\n"
          "         [--reintroduce 0.02] [--init-length 10] [--seed 1] [--draw-seed S]\n"
          "         [--parents value|duel] [--start <dir>] [--changes name=weight,...]\n"
          "         [--panel-choice picked|random|kinds] [--pick-sample 300] [--panel-files a.red,b.red,...]\n"
          "         [--screen-members N] [--screen-stop z | --screen-check z] [--stage N (screen rounds; 0 none)]\n"
          "         [--fill | --no-fill] [--panel-rounds N] [--diversity all|panel] [--average all|panel]\n"
          "         [--member-games all|none] [--pushoff value|pareto|pareto-sd] [--clear R] [--positions mirror|pmars]\n"
          "         [--genome list|gen] [--min-length N] [--tie-points t]\n"
          "         [--islands N [--select-after B [--keep K]] [--score-rounds R] [--migrate M [--migrate-pick best|random]\n"
          "           [--migrate-to all|random]] [--island-variant \"options\" ...] [--island-panels shared|own] [--explorers K]]\n"
          "         [--size 8000] [--cycles 80000] [--processes 8000] [--length 100] [--distance 100]\n"
          "         [--threads N] [--batches N] [--seconds S]\n"
          "       42evolve <run folder> [--threads N] [--batches N] [--seconds S] [--changes ...] [--reintroduce p] [--list N]\n"
          "         [--screen-stop z | --screen-check z]   (continue a run)\n"
          "       42evolve <folder> --optimize <warrior.red> --opponents <dir> [--panel N | --panel-files ...]\n"
          "         [--rounds 100] [--holdout 100] [--bench-rounds 100] [--seed 1] [--threads N]   (its constants)\n");
  exit(2);
}

static uint32_t hardware_threads(void) {
  const long n = sysconf(_SC_NPROCESSORS_ONLN);
  return n > 0 ? (uint32_t)n : 1;
}

// ---------------------------------------------------------------- a run's steps

// The threads of a run: its own pool, unless it already has one (the islands
// of one process share one, --islands).
static void run_pool(run *r, uint32_t threads) {
  if (r->pool) return;
  r->pool = &r->own;
  pool_start(r->pool, threads, &r->p.rules);
  r->pool->mirror = r->p.mirror;
}

// A new run in r->dir with the parameters in r->p (defaults applied, checked):
// the opponents, the panel (picked unless --panel-files or random), the
// holdout, the matrix. optimize: --optimize, no panel to pick.
static int run_new(run *r, uint32_t threads, int optimize) {
  params *p = &r->p;
  p->rules.rounds = p->rounds;
  p->rules.warriors = 2;
  if (mkdir(r->dir, 0777) != 0 && errno != EEXIST) {
    fprintf(stderr, "42evolve: cannot make %s\n", r->dir);
    return 1;
  }
  uint32_t count;
  char **names = opponent_files(r, &count);
  if (!p->panel_files[0] && p->panel_random != PANEL_RANDOM && !optimize) {
    run_pool(r, threads);
    pick_panel(r, names, count);
  }
  const uint32_t pn = count < p->panel ? count : p->panel;
  const uint32_t hn = count - pn < p->holdout ? count - pn : p->holdout;
  if (pn < 2) {
    fprintf(stderr, "42evolve: %s has fewer than 2 warriors that fit the rules\n", p->opponents);
    return 1;
  }
  load_list(r, &r->panel, &r->panel_n, names, pn, PANEL, 0);
  load_list(r, &r->hold, &r->hold_n, names + pn, hn, HOLDOUT, pn);
  for (uint32_t i = 0; i < count; i++) free(names[i]);
  free(names);
  r->next_id = (uint64_t)pn + hn;
  r->best_id = NO_ID;
  r->best_holdout = -1;
  setup_matrix(r);
  load_starts(r);
  return 0;
}

// A run that continues: its state, and its events cut to where the state was
// written.
static int run_resume(run *r) {
  char state[1100], events[1100];
  snprintf(state, sizeof state, "%s/state.txt", r->dir);
  snprintf(events, sizeof events, "%s/events.jsonl", r->dir);
  if (load_state(r, state) != 0) return 1;
  load_starts(r);
  const long size = state_events_size(state);
  if (size < 0 || truncate(events, size) != 0) {
    fprintf(stderr, "42evolve: cannot cut %s to the state\n", events);
    return 1;
  }
  return 0;
}

// The events file (appended to when resume), the threads, the engine with a
// watch for the style of newcomers.
static int run_open(run *r, int resume, uint32_t threads) {
  char events[1100];
  snprintf(events, sizeof events, "%s/events.jsonl", r->dir);
  r->events = fopen(events, resume ? "ab" : "wb");
  if (!r->events) {
    fprintf(stderr, "42evolve: cannot write %s\n", events);
    return 1;
  }
  int status;
  m42_ctx *probe = m42_new(&r->p.rules, &status);
  if (!probe) {
    fprintf(stderr, "42evolve: %s\n", m42_status_text(status));
    return 2;
  }
  m42_free(probe);
  run_pool(r, threads);
  r->sm = m42_new(&r->p.rules, &status);
  const size_t wsize = r->sm ? m42_watch_size(&r->p.rules) : 0;
  r->swatch_mem = wsize ? xmalloc(wsize) : 0;
  r->swatch = r->swatch_mem ? m42_watch_attach(r->sm, r->swatch_mem, wsize, &status) : 0;
  if (!r->swatch) {
    fprintf(stderr, "42evolve: no engine with a watch for the style: %s\n", m42_status_text(status));
    return 1;
  }
  return 0;
}

// The first events of a new run: start, the pick, the panel's matches among
// each other, its values; then the state.
static void run_first(run *r) {
  event_start(r);
  event_pick(r);
  // with --stage each match in two parts, the first stage's rounds and the rest
  const uint32_t whole = panel_rounds(&r->p), s1 = stage_rounds(&r->p), parts = s1 < whole ? 2 : 1;
  unit *u = xmalloc((size_t)r->panel_n * r->panel_n * parts * sizeof *u);
  uint32_t n = 0;
  for (uint32_t a = 0; a < r->panel_n; a++)
    for (uint32_t b = 0; b < a; b++) {
      u[n++] = (unit){r->panel[a].w, r->panel[b].w, seed_for(r, r->panel[b].id), 0, s1, {{0}}, 0, 0};
      if (parts == 2) u[n++] = (unit){r->panel[a].w, r->panel[b].w, seed_for(r, r->panel[b].id), s1, whole - s1, {{0}}, 0, 0};
    }
  pool_run(r->pool, u, n);
  n = 0;
  for (uint32_t a = 0; a < r->panel_n; a++)
    for (uint32_t b = 0; b < a; b++, n += parts) {
      set_result(r, a, b, parts == 2 ? add_scores(u[n].s[0], u[n + 1].s[0]) : u[n].s[0]);
      if (parts == 2) set_result1(r, a, b, u[n].s[0]);
    }
  free(u);
  rebuild_active(r);
  compute_values(r);
  event_panel(r);
  save_state(r);
}

// One batch, its state, and a line on stderr.
static void run_step(run *r) {
  run_batch(r);
  save_state(r);
  const pushoff_value *best = 0;
  for (uint32_t i = r->panel_n; i < r->active_n; i++)
    if (!best || r->values[i].value > best->value) best = &r->values[i];
  if (best)
    fprintf(stderr, "%sbatch %u: %u members, best value %.1f (%s, avg %.1f), best holdout %.1f\n", r->label, r->batch - 1,
            members(r), best->value, r->slot[best->index]->name, best->avg, r->best_holdout);
}

// ---------------------------------------------------------------- islands

// --islands N: N runs in one process, in <dir>/island-01 ... (each an
// ordinary run folder: it can be continued, served and read alone). The
// panel is picked once, and every island gets it as --panel-files and the
// same --draw-seed, so all of them have the same panel and holdout; island i
// evolves with the seed + i - 1. One pool of threads, and the islands play
// in rounds (islands_loop()): every island its next batch, all at the same
// time, so they advance by batches, not by time, and the run is the same on
// any thread count. Every --select-after batches of each, the best.red of each island
// and its three members best against the panel play every warrior of the
// opponent folder (--score-rounds rounds each, 100); the first time, the --keep
// islands with the best of those scores go on and the others stop (their
// folders stay). The root has islands.txt (its state) and islands.jsonl (its
// events: start, pick, score), and best.red: the best warrior scored so far.
static void island_name(const islands *I, uint32_t i, run *r) {
  snprintf(r->dir, sizeof r->dir, "%s/island-%02u", I->dir, i + 1);
  snprintf(r->label, sizeof r->label, "island-%02u ", i + 1);
}

// Every warrior of the opponent folder, for the scores.
static void islands_opponents(islands *I) {
  uint32_t count;
  char **names = opponent_files(&I->root, &count);
  load_list(&I->root, &I->opp, &I->opp_n, names, count, HOLDOUT, 0);
  for (uint32_t i = 0; i < count; i++) free(names[i]);
  free(names);
}

// Island i of I (its run in I->is[i], with its parameters) starts: its seed
// (the islands' + i), folder, the pool, the panel's matches, from batch.
static int island_start(islands *I, uint32_t i, uint32_t batch) {
  run *r = I->is[i];
  r->p.seed = I->seed + i;
  island_name(I, i, r);
  r->pool = I->root.pool;
  if (run_new(r, r->pool->threads, 0) != 0 || run_open(r, 0, r->pool->threads) != 0) return 1;
  r->batch = batch;
  run_first(r);
  I->live[i] = 1;
  return 0;
}

// names[from .. to) into out, comma separated; 1 if they do not fit.
static int join_files(char *out, size_t size, char *const *names, uint32_t from, uint32_t to) {
  size_t len = 0;
  out[0] = 0;
  for (uint32_t i = from; i < to; i++) {
    const size_t l = strlen(names[i]);
    if (len + l + 2 > size) return 1;
    len += (size_t)snprintf(out + len, size - len, "%s%s", i > from ? "," : "", names[i]);
  }
  return 0;
}

// The best.red of each live island and its three members best against the
// panel, against every warrior of the folder: event `score`; the first time
// with --keep, the islands that go on. The root's best.red: the best so far.
static void islands_score(islands *I) {
  if (!I->opp) islands_opponents(I);
  enum { PER = 4 };
  static const char *const tags[PER] = {"best", "p0", "p1", "p2"};
  const uint32_t n = I->n, m = I->opp_n;
  m42_warrior **w = xmalloc((size_t)n * PER * sizeof *w);
  const genome **g = xmalloc((size_t)n * PER * sizeof *g);
  uint64_t *id = xmalloc((size_t)n * PER * sizeof *id);
  uint32_t *as = xmalloc((size_t)n * PER * sizeof *as); // the place whose matches give this one's score: itself, or best.red's
  for (uint32_t i = 0; i < n; i++) {
    run *r = I->is[i];
    if (!I->live[i]) continue;
    const uint32_t b = i * PER;
    if (r->best_g_set) w[b] = make_warrior(&r->best_g, &r->p.rules), g[b] = &r->best_g, id[b] = r->best_id;
    uint32_t top[3] = {UINT32_MAX, UINT32_MAX, UINT32_MAX}; // the members best against the panel, the first on a tie
    for (uint32_t k = r->panel_n; k < r->active_n; k++) {
      const uint32_t s = r->active[k];
      for (int t = 0; t < 3; t++) {
        if (top[t] != UINT32_MAX && panel_avg(r, s) <= panel_avg(r, top[t])) continue;
        for (int u = 2; u > t; u--) top[u] = top[u - 1];
        top[t] = s;
        break;
      }
    }
    for (int t = 0; t < PER; t++) {
      const uint32_t k = b + t;
      if (t && top[t - 1] != UINT32_MAX) {
        const warrior *x = r->slot[top[t - 1]];
        w[k] = x->w, g[k] = x->g, id[k] = x->id;
      }
      as[k] = t && w[k] && w[b] && id[k] == id[b] ? b : k; // a member that is best.red plays once
    }
  }
  unit *u = xmalloc((size_t)n * PER * m * sizeof *u);
  uint32_t nu = 0;
  for (uint32_t k = 0; k < n * PER; k++)
    for (uint32_t o = 0; o < m && w[k] && as[k] == k; o++)
      u[nu++] = (unit){w[k], I->opp[o].w, seed_for(&I->root, 0x73636f7265000000u + o), 0, I->rounds, {{0}}, 0, 0}; // "score"
  pool_run(I->root.pool, u, nu);
  double *sc = xmalloc((size_t)n * PER * sizeof *sc), *isl = xmalloc(n * sizeof *isl);
  nu = 0;
  for (uint32_t k = 0; k < n * PER; k++) {
    sc[k] = -1;
    if (!w[k] || as[k] != k) continue;
    double s = 0;
    for (uint32_t o = 0; o < m; o++, nu++) s += points(u[nu].s[0], I->rounds);
    sc[k] = s / m;
  }
  uint32_t batch = 0, best_k = UINT32_MAX;
  for (uint32_t i = 0; i < n; i++) {
    isl[i] = -1;
    if (!I->live[i]) continue;
    batch = I->is[i]->batch;
    for (uint32_t k = i * PER; k < (i + 1) * PER; k++) {
      if (!w[k]) continue;
      sc[k] = sc[as[k]];
      if (sc[k] > isl[i]) isl[i] = sc[k];
      if (best_k == UINT32_MAX || sc[k] > sc[best_k]) best_k = k;
    }
  }
  // --keep: the best islands by their best score, the first on a tie
  uint8_t *kept = 0;
  if (!I->selected && I->keep) {
    kept = xmalloc(n);
    for (uint32_t c = 0; c < I->keep; c++) {
      uint32_t b = UINT32_MAX;
      for (uint32_t i = 0; i < n; i++)
        if (I->live[i] && !kept[i] && (b == UINT32_MAX || isl[i] > isl[b])) b = i;
      if (b != UINT32_MAX) kept[b] = 1;
    }
  }
  FILE *f = I->root.events;
  fprintf(f, "{\"type\":\"score\",\"batch\":%u,\"rounds\":%u,\"opponents\":%u,\"islands\":[", batch, I->rounds, m);
  for (uint32_t i = 0, first = 1; i < n; i++) {
    if (!I->live[i]) continue;
    fprintf(f, "%s{\"island\":%u,\"score\":%.4f,\"warriors\":[", first ? "" : ",", i + 1, isl[i]);
    for (int t = 0, ft = 1; t < PER; t++) {
      if (!w[i * PER + t]) continue;
      fprintf(f, "%s{\"tag\":\"%s\",\"id\":%" PRIu64 ",\"score\":%.4f}", ft ? "" : ",", tags[t], id[i * PER + t], sc[i * PER + t]);
      ft = 0;
    }
    fputs("]}", f);
    first = 0;
  }
  fputs("],\"files\":[", f); // the opponents in their order, and the seed of each one's matches
  for (uint32_t o = 0; o < m; o++) {
    if (o) fputc(',', f);
    json_str(f, I->opp[o].file, 0);
  }
  fputs("],\"seeds\":[", f);
  for (uint32_t o = 0; o < m; o++) fprintf(f, "%s%" PRId64, o ? "," : "", seed_for(&I->root, 0x73636f7265000000u + o));
  fputs("]", f);
  if (kept) {
    fputs(",\"kept\":[", f);
    for (uint32_t i = 0, first = 1; i < n; i++)
      if (kept[i]) fprintf(f, "%s%u", first ? "" : ",", i + 1), first = 0;
    fputs("]", f);
  }
  fputs("}\n", f);
  fflush(f);
  if (best_k != UINT32_MAX && sc[best_k] > I->best) { // the root's best.red
    I->best = sc[best_k];
    const run *r = I->is[best_k / PER];
    char path[1100], text[GENOME_MAX * 48 + 64];
    snprintf(path, sizeof path, "%s/best.red", I->dir);
    FILE *b = fopen(path, "w");
    if (b) {
      genome_text(g[best_k], r->p.rules.core_size, text, sizeof text);
      fprintf(b, "%s\n;name island-%02u %s %" PRIu64 "\n;author 42evolve\n;strategy evolved, island %u (seed %" PRIu64 "), batch %u\n"
                 ";strategy %.1f against the %u warriors of %s, %u rounds each\n%s",
              r->p.rules.core_size == 8000 ? ";redcode-94nop" : ";redcode", best_k / PER + 1, tags[best_k % PER], id[best_k],
              best_k / PER + 1, r->p.seed, batch, sc[best_k], m, r->p.opponents, I->rounds, text);
      fclose(b);
    }
  }
  if (kept) {
    for (uint32_t i = 0; i < n; i++)
      if (I->live[i] && !kept[i]) {
        I->live[i] = 0;
        fprintf(stderr, "island-%02u stops (best %.1f against the folder)\n", i + 1, isl[i]);
      }
    I->selected = 1;
    free(kept);
  }
  for (uint32_t i = 0; i < n; i++) free(w[i * PER]); // those of best.red were made here, the others are members
  free(w), free(g), free(id), free(as), free(u), free(sc), free(isl);
}

// --migrate: before island k's batch, the member best against the panel of
// every other live island (the first on a tie) becomes a candidate of it,
// which plays first and enters whatever its screen once it is above the
// threshold, as a start warrior; one that is already in is not played again.
// --migrate-pick random: a member drawn from the seed, the batch and the two
// islands instead of the best; --migrate-to random: from one other live
// island drawn from the seed and the batch. The other islands are
// as the round before left them (islands_loop() takes all migrants of a round
// before its batches), so a run is the same on any thread count and after a
// resume. Event `migrate`: [island, id].

static void islands_migrate(islands *I, uint32_t k) {
  run *r = I->is[k];
  if (!r->migr) {
    r->migr = xmalloc(I->n * sizeof *r->migr);
    r->migr_id = xmalloc(I->n * sizeof *r->migr_id);
    r->migr_noun = xmalloc(I->n * sizeof *r->migr_noun);
  }
  r->migr_n = 0;
  fprintf(r->events, "{\"type\":\"migrate\",\"batch\":%u,\"from\":[", r->batch);
  uint32_t before = k; // --migrate-to random: the island it takes from
  if (I->migrate_next == MIGRATE_RANDOM) { // one of the other live islands
    uint32_t others = 0;
    for (uint32_t j = 0; j < I->n; j++) others += j != k && I->live[j];
    rng g = rng_seed(I->seed, 0x6d69677274u + r->batch, k); // "migrt"
    uint32_t pick = others ? rng_below(&g, others) : 0;
    before = k;
    for (uint32_t j = 0; j < I->n && before == k; j++)
      if (j != k && I->live[j] && pick-- == 0) before = j;
  }
  for (uint32_t j = 0; j < I->n; j++) {
    const run *o = I->is[j];
    if (j == k || !I->live[j]) continue;
    if (I->migrate_next != MIGRATE_ALL && j != before) continue;
    uint32_t best = UINT32_MAX;
    if (I->migrate_random && o->active_n > o->panel_n) {
      rng g = rng_seed(I->seed, 0x6d69677261u + r->batch, (uint64_t)k * ISLANDS_MAX + j); // "migra"
      best = o->active[o->panel_n + rng_below(&g, o->active_n - o->panel_n)];
    }
    for (uint32_t a = o->panel_n; a < o->active_n && !I->migrate_random; a++)
      if (best == UINT32_MAX || panel_avg(o, o->active[a]) > panel_avg(o, best)) best = o->active[a];
    if (best == UINT32_MAX || r->migr_n >= r->p.batch) continue;
    const warrior *w = o->slot[best];
    r->migr[r->migr_n] = *w->g;
    r->migr_id[r->migr_n] = w->id;
    r->migr_noun[r->migr_n] = w->noun;
    fprintf(r->events, "%s[%u,%" PRIu64 "]", r->migr_n ? "," : "", j + 1, w->id);
    r->migr_n++;
  }
  fputs("]}\n", r->events);
}

// Batches in rounds until the limits: in a round every live island plays
// its next batch, all at the same time, each on a thread of its own with its
// matches in the one pool (the serial parts of a batch, the push-off,
// entering, the style of newcomers, the events, overlap). Before a round,
// on one thread: every `every` batches the scores; every `migrate` batches
// the migrants, each island's taken from the others as they are after the
// round before. So a run is the same on any thread count and after a resume. A run stopped
// while its islands took turns (before rounds) may have islands a batch
// ahead: the others catch up first.
// --explorers K: the last K islands never take migrants. Each is an
// independent try, like a run of its own, that no strong design from
// elsewhere pushes out; the other islands (the core) take from all, so what
// an explorer finds is taken up and tuned there (with --island-variant, for
// example --average panel on the core).
// Whether island k takes migrants before its batch b: every --migrate
// batches, not an explorer.
static int island_takes_migrants(const islands *I, uint32_t k, uint32_t b) {
  return I->migrate && b && b % I->migrate == 0 && k < I->n - I->explorers;
}

static void *island_thread(void *arg) {
  run_step(arg);
  return 0;
}

// The batch of each island of round[0 .. m), at the same time.
static void islands_round(islands *I, const uint32_t *round, uint32_t m) {
  if (m == 1) {
    run_step(I->is[round[0]]);
    return;
  }
  pthread_t t[ISLANDS_MAX];
  pthread_attr_t a; // the stack of the main thread, where a batch ran before: macOS gives other threads 512 KB
  pthread_attr_init(&a);
  pthread_attr_setstacksize(&a, (size_t)8 << 20);
  for (uint32_t j = 0; j < m; j++)
    if (pthread_create(&t[j], &a, island_thread, I->is[round[j]]) != 0) {
      fprintf(stderr, "42evolve: cannot start a thread\n");
      exit(1);
    }
  pthread_attr_destroy(&a);
  for (uint32_t j = 0; j < m; j++) pthread_join(t[j], 0);
}

static void islands_loop(islands *I, uint32_t batches, double seconds) {
  const double t0 = now();
  uint32_t lo = UINT32_MAX;
  for (uint32_t i = 0; i < I->n; i++)
    if (I->live[i] && I->is[i]->batch < lo) lo = I->is[i]->batch;
  const uint32_t target = batches ? lo + batches : UINT32_MAX;
  while (!stop_now && (!seconds || now() - t0 < seconds)) {
    lo = UINT32_MAX;
    for (uint32_t i = 0; i < I->n; i++)
      if (I->live[i] && I->is[i]->batch < lo) lo = I->is[i]->batch;
    if (lo == UINT32_MAX || lo >= target) break;
    if (I->every && lo >= I->next_score) { // every live island is there
      islands_score(I);
      I->next_score += I->every;
      islands_save(I);
      continue;
    }
    uint32_t round[ISLANDS_MAX], m = 0; // the islands of this round: those at batch lo
    for (uint32_t i = 0; i < I->n; i++)
      if (I->live[i] && I->is[i]->batch == lo) round[m++] = i;
    for (uint32_t j = 0; j < m; j++) // the migrants first: from the islands as the round before left them
      if (island_takes_migrants(I, round[j], lo)) islands_migrate(I, round[j]);
    islands_round(I, round, m);
  }
}

static void islands_close(islands *I) {
  for (uint32_t i = 0; i < I->n; i++)
    if (I->is[i] && I->is[i]->events) fclose(I->is[i]->events);
  pool_stop(I->root.pool);
  fclose(I->root.events);
}

// --island-panels own: one round robin of the sample, then each island its
// own panel from a random half of the candidates (drawn with the draw seed
// and the island), chosen as pick_panel() chooses; its event `pick` says
// which. The holdout is the same for all: the first warriors of the shuffled
// folder in no island's panel, so that the islands' holdout scores compare.
static int island_panels(islands *I, run *root, const params *base) {
  uint32_t count;
  char **names = opponent_files(root, &count);
  pick_table t;
  pick_play(root, names, count, &t);
  uint8_t *in_panel = calloc(count, 1), *allowed = xmalloc(t.n);
  uint32_t *cand = xmalloc(t.nc * sizeof *cand), *picked = xmalloc((t.want ? t.want : 1) * sizeof *picked);
  char **chosen = xmalloc((t.want ? t.want : 1) * sizeof *chosen);
  const uint32_t half = t.nc / 2;
  int rc = 0;
  if (half < t.want) { // else every island would choose from (almost) the same candidates: one panel for all
    fprintf(stderr, "42evolve: --island-panels own: %u candidates of a sample of %u for a panel of %u; it needs twice the panel: "
                    "a larger --pick-sample or a smaller --panel\n", t.nc, t.n, t.want);
    rc = 1;
  }
  for (uint32_t i = 0; i < I->n && !rc; i++) {
    run *r = I->is[i];
    memcpy(cand, t.order, t.nc * sizeof *cand);
    rng g = rng_seed(base->draw_seed, 0x69736c70616e656cu, i); // "islpanel"
    for (uint32_t j = t.nc; j > 1; j--) {
      const uint32_t k = rng_below(&g, j), x = cand[j - 1];
      cand[j - 1] = cand[k], cand[k] = x;
    }
    memset(allowed, 0, t.n);
    for (uint32_t j = 0; j < half; j++) allowed[cand[j]] = 1;
    const uint32_t np = pick_choose(r, &t, names, allowed, picked);
    if (np < t.want) fprintf(stderr, "42evolve: island %u: a panel of %u warriors, not %u (too few candidates of the kinds)\n", i + 1, np, t.want);
    for (uint32_t j = 0; j < np; j++) chosen[j] = names[picked[j]], in_panel[picked[j]] = 1;
    if (join_files(r->p.panel_files, sizeof r->p.panel_files, chosen, 0, np) != 0) {
      fprintf(stderr, "42evolve: the names of the %u panel warriors of island %u are too long\n", np, i + 1);
      rc = 1;
    }
  }
  if (!rc) { // the holdout: in the shuffled order, the first in no panel (fewer than --holdout when no more are left)
    char **hold = xmalloc((base->holdout ? base->holdout : 1) * sizeof *hold);
    uint32_t h = 0;
    for (uint32_t i = 0; i < count && h < base->holdout; i++)
      if (!in_panel[i]) hold[h++] = names[i];
    char *files = I->is[0]->p.holdout_files;
    if (join_files(files, sizeof I->is[0]->p.holdout_files, hold, 0, h) != 0) {
      fprintf(stderr, "42evolve: the names of the %u holdout warriors are too long\n", h);
      rc = 1;
    }
    for (uint32_t i = 1; i < I->n && !rc; i++) snprintf(I->is[i]->p.holdout_files, sizeof I->is[i]->p.holdout_files, "%s", files);
    free(hold);
  }
  for (uint32_t i = 0; i < count; i++) free(names[i]);
  free(names), free(in_panel), free(allowed), free(cand), free(picked), free(chosen);
  pick_free(&t);
  return rc;
}

// A new run of islands: base has the parameters (defaults applied, checked).
static int islands_new(const params *base, const params *variant, const char *const *variant_text, uint32_t variant_n,
                       const char *dir, uint32_t n, uint32_t keep, uint32_t every, uint32_t rounds, uint32_t migrate,
                       uint32_t migrate_random, uint32_t migrate_next, uint32_t explorers,
                       int own_panels, uint32_t threads, uint32_t batches, double seconds) {
  static islands I;
  snprintf(I.dir, sizeof I.dir, "%s", dir);
  I.n = n, I.keep = keep, I.every = every, I.next_score = every, I.seed = base->seed, I.best = -1, I.rounds = rounds;
  I.migrate = migrate, I.migrate_random = migrate_random, I.migrate_next = migrate_next, I.explorers = explorers;
  if (mkdir(dir, 0777) != 0 && errno != EEXIST) {
    fprintf(stderr, "42evolve: cannot make %s\n", dir);
    return 1;
  }
  run *root = &I.root;
  root->p = *base;
  root->p.rules.rounds = root->p.rounds;
  root->p.rules.warriors = 2;
  run_pool(root, threads);
  char path[1100];
  snprintf(path, sizeof path, "%s/islands.jsonl", dir);
  root->events = fopen(path, "wb");
  if (!root->events) {
    fprintf(stderr, "42evolve: cannot write %s\n", path);
    return 1;
  }
  params p = *base;
  if (!own_panels && !p.panel_files[0] && p.panel_random != PANEL_RANDOM) { // the panel, picked once for all
    uint32_t count;
    char **names = opponent_files(root, &count);
    pick_panel(root, names, count);
    const uint32_t pn = count < p.panel ? count : p.panel;
    if (join_files(p.panel_files, sizeof p.panel_files, names, 0, pn) != 0) {
      fprintf(stderr, "42evolve: the names of the %u panel warriors are too long for --panel-files\n", pn);
      return 1;
    }
    for (uint32_t i = 0; i < count; i++) free(names[i]);
    free(names);
  }
  fprintf(root->events, "{\"type\":\"islands\",\"islands\":%u,\"keep\":%u,\"selectAfter\":%u,\"migrate\":%u,\"migratePick\":\"%s\","
                        "\"migrateTo\":\"%s\",\"seed\":%" PRIu64 ",\"drawSeed\":%" PRIu64 ",\"threads\":%u,\"opponents\":",
          n, keep, every, migrate, migrate_random ? "random" : "best",
          migrate_next == MIGRATE_RANDOM ? "random" : "all", base->seed, base->draw_seed,
          threads);
  json_str(root->events, base->opponents, 0);
  fputs(",\"panel\":", root->events);
  json_str(root->events, p.panel_files, 0);
  fprintf(root->events, ",\"islandPanels\":\"%s\",\"explorers\":%u", own_panels ? "own" : "shared", explorers);
  fputs(",\"variants\":[", root->events);
  for (uint32_t k = 0; k < variant_n; k++) {
    if (k) fputc(',', root->events);
    json_str(root->events, variant_text[k], 0);
  }
  fputs("]}\n", root->events);
  event_pick(root);
  fflush(root->events);
  for (uint32_t i = 0; i < n; i++) {
    run *r = I.is[i] = xmalloc(sizeof *r);
    r->p = p;
    if (variant_n) { // --island-variant: island i the variant i mod their number, with the panel picked here
      r->p = variant[i % variant_n];
      snprintf(r->p.panel_files, sizeof r->p.panel_files, "%s", p.panel_files);
    }
  }
  if (own_panels && island_panels(&I, root, base) != 0) return 1;
  for (uint32_t i = 0; i < n; i++)
    if (island_start(&I, i, 0) != 0) return 1;
  islands_save(&I);
  fprintf(stderr, "42evolve: %s, %u islands, %u panel and %u holdout warriors, %u threads\n", dir, n, I.is[0]->panel_n,
          I.is[0]->hold_n, threads);
  islands_loop(&I, batches, seconds);
  islands_close(&I);
  return 0;
}

// A run of islands that continues: each live island from its state.
static int islands_resume(const char *dir, uint32_t threads, uint32_t batches, double seconds) {
  static islands I;
  snprintf(I.dir, sizeof I.dir, "%s", dir);
  if (islands_load(&I) != 0) return 1;
  run *root = &I.root;
  for (uint32_t i = 0; i < I.n; i++) {
    if (!I.live[i]) continue;
    run *r = I.is[i] = xmalloc(sizeof *r);
    r->p = default_params(); // what the state does not have (as main() for a run)
    island_name(&I, i, r);
    if (run_resume(r) != 0) return 1;
    if (!root->pool) { // the root: the parameters of the first live island with the seed of the islands
      root->p = r->p;
      root->p.seed = I.seed;
      run_pool(root, threads);
    }
    r->pool = root->pool;
    if (run_open(r, 1, threads) != 0) return 1;
    fprintf(r->events, "{\"type\":\"resume\",\"batch\":%u}\n", r->batch);
  }
  char path[1100];
  snprintf(path, sizeof path, "%s/islands.jsonl", dir);
  root->events = fopen(path, "ab");
  if (!root->events) {
    fprintf(stderr, "42evolve: cannot write %s\n", path);
    return 1;
  }
  fputs("{\"type\":\"resume\"}\n", root->events);
  islands_loop(&I, batches, seconds);
  islands_close(&I);
  return 0;
}

// What is wrong with the parameters of a new run (defaults applied), 0 nothing.
// Does the mix draw a kind of change that only a generator has?
static int structure_kinds(const genome_mix *m) {
  for (int k = CH_COUNT; k < CH_ALL; k++)
    if (m->w[k]) return 1;
  return 0;
}
#define STRUCTURE_NEEDS_GEN "--changes with a kind of generators (repeat to transplant) needs --genome gen"

static const char *params_error(const params *p) {
  static char text[96];
  if (p->rules.max_length < 1 || p->rules.max_length > GENOME_MAX) {
    snprintf(text, sizeof text, "--length 1 to %d", GENOME_MAX);
    return text;
  }
  if (!p->list || !p->rounds || !p->init_length) return "--list, --rounds and --init-length at least 1";
  if (p->screen_rounds > p->rounds) return "--screen-rounds at most --rounds";
  if (p->rules.core_size < 2 * p->rules.min_distance) return "--size at least twice --distance";
  if (p->stage && p->stage < p->screen_rounds) return "--stage at least --screen-rounds, or 0";
  if (p->panel_rounds && p->panel_rounds < p->rounds) return "--panel-rounds at least --rounds";
  if (p->member_games_none && (!p->average_panel || !p->distance_panel || p->parents == PARENTS_DUEL || p->screen_members))
    return "--member-games none only with --average panel and --diversity panel, not with --parents duel or "
           "--screen-members";
  if (p->pareto && (p->average_panel || p->member_games_none))
    return "--pushoff pareto not with --average panel or --member-games none";
  if (p->clear > 0 && !p->pareto) return "--clear with --pushoff pareto or pareto-sd only";
  if (p->screen_stop > 0 && p->screen_check > 0) return "--screen-stop or --screen-check, not both";
  if (!p->gen && structure_kinds(&p->changes)) return STRUCTURE_NEEDS_GEN;
  if (p->min_length > p->rules.max_length) return "--min-length at most --length";
  if (!(p->tie >= 0 && p->tie <= 3)) return "--tie-points 0 to 3";
  return 0;
}

// What the command line says: the parameters of a new run (before the
// defaults of new_run_defaults()), and what else it asks for.
typedef struct {
  params p;
  const char *dir;
  uint32_t threads, batches;
  double seconds;
  genome_mix new_changes; // --changes, also for a run that continues
  int changes_given;
  double new_stop, new_check; // --screen-stop, --screen-check, also for a run that continues
  double new_reintroduce;     // --reintroduce, also for a run that continues
  uint32_t new_list;          // --list, also for a run that continues (it only grows)
  int new_options, stage_given, screen_members_given, diversity_given, panel_rounds_given, fill_given;
  int panel_choice_given, draw_seed_given, positions_given, pushoff_given, genome_given, migrate_given;
  int variant_default; // the variants of new_island_defaults(), not given
  const char *pushoff_fallback; // the option that made the default push-off value, not pareto-sd (#199)
  uint32_t islands_n, islands_keep, islands_every, islands_rounds; // --islands, --keep, --select-after, --score-rounds
  uint32_t islands_migrate_every;                                   // --migrate
  uint32_t migrate_random, migrate_next, pick_given, to_given;      // --migrate-pick, --migrate-to
  int own_panels;                                                   // --island-panels own
  uint32_t explorers;                                               // --explorers
  int islands_option;
  const char *variant[ISLANDS_MAX]; // --island-variant, in their order
  uint32_t variant_n;
  const char *optimize_file; // --optimize: no run, the constants of this warrior
} cli;

// The options removed after 1.1.0 (#193): refused with a message, also in an
// --island-variant (a state that used one: load_state()).
static const char *const removed_options[] = {"--map-elites", "--specialists", "--niche", "--sharing", "--simple",
                                              "--noise", "--difference", "--select", "--rotate", "--race", "--race-keep",
                                              "--tune-novel", "--fractions", "--prior", "--refactor",
                                              "--leaf-restart", "--nemesis-every", 0};

// Reads the command line into c; 0, or the exit code after a message.
static int parse_cli(int argc, char **argv, cli *c) {
  memset(c, 0, sizeof *c);
  c->p = default_params();
  c->new_stop = c->new_check = c->new_reintroduce = -1;
  c->islands_rounds = 100;
  for (int i = 1; i < argc; i++) {
    const char *a = argv[i];
    if (a[0] != '-') {
      if (c->dir) usage();
      c->dir = a;
      continue;
    }
    for (const char *const *o = removed_options; *o; o++)
      if (!strcmp(a, *o)) {
        fprintf(stderr, "42evolve: %s was removed after 1.1.0 (#193)\n", a);
        return 2;
      }
    if (!strcmp(a, "--fill") || !strcmp(a, "--no-fill")) { // the options without a value
      c->p.fill = !strcmp(a, "--fill");
      c->fill_given = 1;
      c->new_options = 1;
      continue;
    }
    if (i + 1 >= argc) usage();
    const char *v = argv[++i];
    char *end;
    const double d = strtod(v, &end);
    const int number = *end == 0 && end != v;
    const uint32_t u = number && d >= 0 && d <= 4294967295.0 ? (uint32_t)d : 0;
    params *p = &c->p;
    int run_option = 0;
    if (!strcmp(a, "--threads")) c->threads = u, run_option = 1;
    else if (!strcmp(a, "--batches")) c->batches = u, run_option = 1;
    else if (!strcmp(a, "--seconds")) c->seconds = d, run_option = 1;
    else if (!strcmp(a, "--opponents")) snprintf(p->opponents, sizeof p->opponents, "%s", v);
    else if (!strcmp(a, "--start")) snprintf(p->start, sizeof p->start, "%s", v);
    else if (!strcmp(a, "--optimize")) c->optimize_file = v;
    else if (!strcmp(a, "--panel-files")) {
      if (!*v || strlen(v) >= sizeof p->panel_files || strstr(v, ",,") || v[strlen(v) - 1] == ',') usage();
      snprintf(p->panel_files, sizeof p->panel_files, "%s", v);
    }
    else if (!strcmp(a, "--changes")) {
      if (names_loop(v)) {
        fprintf(stderr, "42evolve: --changes loop was removed after 1.1.0 (#193)\n");
        return 2;
      }
      if (genome_mix_parse(&p->changes, v) != 0) {
        fprintf(stderr, "42evolve: --changes takes name=weight,... with these names:");
        for (int k = 0; k < CH_COUNT; k++) fprintf(stderr, " %s", genome_change_name(k));
        fprintf(stderr, "\nand with --genome gen:");
        for (int k = CH_COUNT; k < CH_ALL; k++) fprintf(stderr, " %s", genome_change_name(k));
        fprintf(stderr, "\n");
        return 2;
      }
      c->new_changes = p->changes, c->changes_given = 1;
    }
    else if (!strcmp(a, "--parents")) {
      if (!strcmp(v, "value")) p->parents = PARENTS_VALUE;
      else if (!strcmp(v, "duel")) p->parents = PARENTS_DUEL;
      else usage();
    } else if (!strcmp(a, "--panel-choice")) {
      c->panel_choice_given = 1;
      if (!strcmp(v, "picked")) p->panel_random = PANEL_PICKED;
      else if (!strcmp(v, "random")) p->panel_random = PANEL_RANDOM;
      else if (!strcmp(v, "kinds")) p->panel_random = PANEL_KINDS;
      else usage();
    } else if (!strcmp(a, "--diversity")) {
      c->diversity_given = 1;
      if (!strcmp(v, "all")) p->distance_panel = 0;
      else if (!strcmp(v, "panel")) p->distance_panel = 1;
      else usage();
    } else if (!strcmp(a, "--member-games")) {
      if (!strcmp(v, "all")) p->member_games_none = 0;
      else if (!strcmp(v, "none")) p->member_games_none = 1;
      else usage();
    } else if (!strcmp(a, "--average")) {
      if (!strcmp(v, "all")) p->average_panel = 0;
      else if (!strcmp(v, "panel")) p->average_panel = 1;
      else usage();
    } else if (!strcmp(a, "--pushoff")) {
      c->pushoff_given = 1;
      if (!strcmp(v, "value")) p->pareto = 0;
      else if (!strcmp(v, "pareto")) p->pareto = 1;
      else if (!strcmp(v, "pareto-age")) {
        fprintf(stderr, "42evolve: --pushoff pareto-age was removed after 1.1.0 (#193)\n");
        return 2;
      }
      else if (!strcmp(v, "pareto-sd")) p->pareto = 3;
      else usage();
    } else if (!strcmp(a, "--migrate-pick")) {
      if (!strcmp(v, "best")) c->migrate_random = 0;
      else if (!strcmp(v, "random")) c->migrate_random = 1;
      else usage();
      c->pick_given = c->islands_option = 1;
    } else if (!strcmp(a, "--migrate-to")) {
      if (!strcmp(v, "all")) c->migrate_next = MIGRATE_ALL;
      else if (!strcmp(v, "random")) c->migrate_next = MIGRATE_RANDOM;
      else if (!strcmp(v, "next") || !strcmp(v, "tree")) {
        fprintf(stderr, "42evolve: --migrate-to %s was removed after 1.1.0 (#193)\n", v);
        return 2;
      }
      else usage();
      c->to_given = c->islands_option = 1;
    } else if (!strcmp(a, "--island-panels")) {
      if (!strcmp(v, "shared")) c->own_panels = 0;
      else if (!strcmp(v, "own")) c->own_panels = 1;
      else usage();
      c->islands_option = 1;
    } else if (!strcmp(a, "--island-variant")) {
      if (c->variant_n >= ISLANDS_MAX) usage();
      c->variant[c->variant_n++] = v;
      c->islands_option = 1;
    } else if (!strcmp(a, "--tie-points")) {
      p->tie = d;
    } else if (!strcmp(a, "--genome")) {
      c->genome_given = 1;
      if (!strcmp(v, "gen")) p->gen = 1;
      else if (!strcmp(v, "list")) p->gen = 0;
      else usage();
    } else if (!strcmp(a, "--positions")) {
      c->positions_given = 1;
      if (!strcmp(v, "mirror")) p->mirror = 1;
      else if (!strcmp(v, "pmars")) p->mirror = 0;
      else usage();
    } else if (!strcmp(a, "--sd")) {
      if (!strcmp(v, "opponent")) p->sd = SD_OPPONENT;
      else if (!strcmp(v, "sum")) p->sd = SD_SUM;
      else usage();
    } else if (!number) usage();
    else if (!strcmp(a, "--panel")) p->panel = u;
    else if (!strcmp(a, "--holdout")) p->holdout = u;
    else if (!strcmp(a, "--list")) p->list = c->new_list = u;
    else if (!strcmp(a, "--batch")) p->batch = u;
    else if (!strcmp(a, "--survivors")) p->survivors = u;
    else if (!strcmp(a, "--rounds")) p->rounds = u;
    else if (!strcmp(a, "--screen-rounds")) p->screen_rounds = u;
    else if (!strcmp(a, "--screen-factor")) p->screen_factor = d;
    else if (!strcmp(a, "--bench-every")) p->bench_every = u;
    else if (!strcmp(a, "--bench-rounds")) p->bench_rounds = u;
    else if (!strcmp(a, "--alpha")) p->alpha = d;
    else if (!strcmp(a, "--reintroduce")) {
      if (!number || d < 0 || d > 1) usage();
      p->reintroduce = c->new_reintroduce = d;
    }
    else if (!strcmp(a, "--screen-members")) p->screen_members = u, c->screen_members_given = 1;
    else if (!strcmp(a, "--stage")) p->stage = u, c->stage_given = 1;
    else if (!strcmp(a, "--panel-rounds")) p->panel_rounds = u, c->panel_rounds_given = 1;
    else if (!strcmp(a, "--pick-sample")) p->pick_sample = u;

    else if (!strcmp(a, "--screen-stop") || !strcmp(a, "--screen-check")) {
      const int stop = !strcmp(a, "--screen-stop");
      if (!number || d < 0 || (!stop && !(d > 0))) usage(); // --screen-stop 0: off
      if (stop) p->screen_stop = c->new_stop = d;
      else p->screen_check = c->new_check = d;
    }
    else if (!strcmp(a, "--clear")) {
      if (!number || !(d > 0)) usage();
      p->clear = d;
    }
    else if (!strcmp(a, "--init-length")) p->init_length = u;
    else if (!strcmp(a, "--min-length")) p->min_length = u;
    else if (!strcmp(a, "--seed")) p->seed = (uint64_t)d;
    else if (!strcmp(a, "--draw-seed")) p->draw_seed = (uint64_t)d, c->draw_seed_given = 1;
    else if (!strcmp(a, "--islands")) c->islands_n = u, c->islands_option = 1;
    else if (!strcmp(a, "--keep")) c->islands_keep = u, c->islands_option = 1;
    else if (!strcmp(a, "--select-after")) c->islands_every = u, c->islands_option = 1;
    else if (!strcmp(a, "--score-rounds")) c->islands_rounds = u, c->islands_option = 1;
    else if (!strcmp(a, "--migrate")) c->islands_migrate_every = u, c->islands_option = c->migrate_given = 1;
    else if (!strcmp(a, "--explorers")) c->explorers = u, c->islands_option = 1;
    else if (!strcmp(a, "--size")) p->rules.core_size = u;
    else if (!strcmp(a, "--cycles")) p->rules.max_cycles = u;
    else if (!strcmp(a, "--processes")) p->rules.max_processes = u;
    else if (!strcmp(a, "--length")) p->rules.max_length = u;
    else if (!strcmp(a, "--distance")) p->rules.min_distance = u;
    else usage();
    if (!run_option && strcmp(a, "--changes") && strcmp(a, "--screen-stop") && strcmp(a, "--screen-check") &&
        strcmp(a, "--reintroduce") && strcmp(a, "--list"))
      c->new_options = 1; // these go with a run that continues
  }
  return 0;
}

// What a new run says when the default push-off pareto-sd does not go with
// an option given and it takes value instead (#199).
#define PUSHOFF_FALLBACK "%s: the push-off is value, pareto does not go with it"

// The defaults of a new run that depend on what was given, then what is
// wrong with its parameters (params_error()), 0 nothing.
static const char *new_run_defaults(cli *c) {
  params *p = &c->p;
  if (!p->opponents[0]) usage();
  // new runs: generators (docs/evolver-gen.md), not for --optimize, which keeps lists
  if (!c->genome_given && !c->optimize_file) p->gen = 1;
  if (p->gen && !c->changes_given) p->changes = gen_mix_default(); // the kinds that make structure too
  if (!p->batch) p->batch = 128;
  if (!p->survivors) p->survivors = p->batch / 8 ? p->batch / 8 : 1;
  // --stage by default at the screen rounds (--stage 0: none); a state keeps
  // the value, and states from before --stage have none
  if (!c->stage_given) p->stage = p->screen_rounds;
  // the defaults of the later options, for new runs only (a state before
  // them has none of them): the best run of E5
  if (!c->screen_members_given) p->screen_members = p->member_games_none ? 0 : 10;
  if (!c->diversity_given) p->distance_panel = 1;
  if (!c->panel_rounds_given) p->panel_rounds = p->rounds > 500 ? p->rounds : 500;
  if (!c->panel_choice_given) p->panel_random = PANEL_KINDS; // new runs: a panel of every kind
  if (!c->fill_given) p->fill = 1;
  if (!c->positions_given) p->mirror = 1; // new runs: every position from both sides
  // new runs: pareto-sd, first or tied first on the '94 and the tiny hill (docs/evolver.md); value where
  // pareto does not go (params_error() says where)
  if (!c->pushoff_given) {
    p->pareto = 3;
    if (params_error(p)) {
      p->pareto = 0;
      // the caller says so when pareto was what did not go (#199)
      if (!params_error(p)) c->pushoff_fallback = p->member_games_none ? "--member-games none" : "--average panel";
    }
  }
  // new runs: --screen-stop 3: it stopped 10,639 of 17,025
  // children of kd1 in the screen, 22% of all rounds, and missed none of the 2,400 survivors (docs/evolver.md)
  if (c->new_stop < 0 && !(p->screen_check > 0)) {
    p->screen_stop = 3;
    if (params_error(p)) p->screen_stop = 0;
  }
  if (!c->draw_seed_given) p->draw_seed = p->seed;
  return params_error(p);
}

// --island-variant: what every island must have alike, so that their
// scores and migrants mean the same; 0 when a and b agree, else the option.
static const char *variant_differs(const params *a, const params *b) {
  const m42_rules *x = &a->rules, *y = &b->rules;
  if (x->core_size != y->core_size || x->max_cycles != y->max_cycles || x->max_processes != y->max_processes ||
      x->max_length != y->max_length || x->min_distance != y->min_distance)
    return "--size, --cycles, --processes, --length or --distance";
  if (strcmp(a->opponents, b->opponents) || strcmp(a->start, b->start)) return "--opponents or --start";
  if (a->panel != b->panel || a->holdout != b->holdout || a->panel_random != b->panel_random || a->pick_sample != b->pick_sample ||
      strcmp(a->panel_files, b->panel_files))
    return "--panel, --holdout, --panel-choice, --pick-sample or --panel-files";
  if (a->seed != b->seed || a->draw_seed != b->draw_seed) return "--seed or --draw-seed";
  if (a->gen != b->gen) return "--genome";
  return 0;
}

// The parameters of each --island-variant: the command line with the
// variant's options after it, so that they win; 0, or the exit code after
// a message.
static int island_variants(int argc, char **argv, const cli *c, params *out) {
  enum { TOKENS = 64 };
  char **v = xmalloc(((size_t)argc + TOKENS) * sizeof *v);
  static char text[4096];
  int rc = 0;
  for (uint32_t k = 0; k < c->variant_n && !rc; k++) {
    snprintf(text, sizeof text, "%s", c->variant[k]);
    int n = 0;
    for (int i = 0; i < argc; i++) v[n++] = argv[i];
    for (char *save = 0, *t = strtok_r(text, " \t", &save); t; t = strtok_r(0, " \t", &save)) {
      if (n >= argc + TOKENS) {
        fprintf(stderr, "42evolve: --island-variant '%s' has more than %d words\n", c->variant[k], TOKENS);
        rc = 2;
        break;
      }
      v[n++] = t;
    }
    if (rc) break;
    static cli w;
    if ((rc = parse_cli(n, v, &w)) != 0) break;
    w.threads = c->threads;
    const char *wrong = new_run_defaults(&w);
    const char *differs = wrong ? 0 : variant_differs(&c->p, &w.p);
    if (!wrong && (w.batches != c->batches || w.seconds != c->seconds || w.variant_n != (c->variant_default ? 0 : c->variant_n) ||
                   w.islands_n != c->islands_n ||
                   w.islands_keep != c->islands_keep || w.islands_every != c->islands_every ||
                   w.islands_rounds != c->islands_rounds || w.islands_migrate_every != c->islands_migrate_every ||
                   w.migrate_random != c->migrate_random || w.migrate_next != c->migrate_next || w.own_panels != c->own_panels || w.explorers != c->explorers ||
                   w.optimize_file != c->optimize_file))
      differs = "--batches, --seconds, --optimize or an option of the islands";
    if (wrong || differs) {
      fprintf(stderr, "42evolve: --island-variant '%s': %s%s\n", c->variant[k], wrong ? wrong : differs,
              wrong ? "" : " the same for every island");
      rc = 2;
      break;
    }
    if (w.pushoff_fallback) { // island i has the variant i mod their number
      if (c->variant_default) fprintf(stderr, "42evolve: islands %u", k + 1);
      else fprintf(stderr, "42evolve: --island-variant '%s', islands %u", c->variant[k], k + 1);
      for (uint32_t i = k + c->variant_n; i < c->islands_n; i += c->variant_n) fprintf(stderr, ", %u", i + 1);
      fprintf(stderr, ": " PUSHOFF_FALLBACK "\n", w.pushoff_fallback);
    }
    out[k] = w.p;
  }
  free(v);
  return rc;
}

int main(int argc, char **argv) {
  static run r;
  static cli c;
  {
    const int rc = parse_cli(argc, argv, &c);
    if (rc) return rc;
  }
  r.p = c.p;
  const char *dir = c.dir, *optimize_file = c.optimize_file;
  uint32_t threads = c.threads;
  const uint32_t batches = c.batches;
  const double seconds = c.seconds;
  const genome_mix new_changes = c.new_changes;
  const int changes_given = c.changes_given, new_options = c.new_options;
  const double new_stop = c.new_stop, new_check = c.new_check, new_reintroduce = c.new_reintroduce;
  const uint32_t new_list = c.new_list;
  const uint32_t islands_n = c.islands_n, islands_keep = c.islands_keep, islands_every = c.islands_every;
  const uint32_t islands_rounds = c.islands_rounds;
  uint32_t islands_migrate_every = c.islands_migrate_every;
  const int islands_option = c.islands_option;
  if (!dir) usage();
  if (!threads) threads = hardware_threads();
  snprintf(r.dir, sizeof r.dir, "%s", dir);

  char state[1100];
  snprintf(state, sizeof state, "%s/state.txt", dir);
  {
    char isl[1100];
    snprintf(isl, sizeof isl, "%s/islands.txt", dir);
    if (access(isl, F_OK) == 0) { // a run of islands that continues
      if (new_options || islands_option || changes_given || new_stop >= 0 || new_check > 0 || new_reintroduce >= 0 || new_list) {
        fprintf(stderr, "42evolve: %s has islands; only --threads, --batches and --seconds go with it\n", dir);
        return 2;
      }
      signal(SIGINT, on_signal);
      signal(SIGTERM, on_signal);
      return islands_resume(dir, threads, batches, seconds);
    }
  }
  if (islands_option && !islands_n) usage();
  const int resume = !optimize_file && access(state, F_OK) == 0;
  if (resume) {
    if (new_options) {
      fprintf(stderr,
              "42evolve: %s has a run; only --threads, --batches, --seconds, --changes, --reintroduce, --list (larger), "
              "--screen-stop and --screen-check go with it\n",
              dir);
      return 2;
    }
    r.list_grow = new_list;
    if (run_resume(&r) != 0) return 1;
    if (!r.p.gen && changes_given && structure_kinds(&new_changes)) {
      fprintf(stderr, "42evolve: " STRUCTURE_NEEDS_GEN "\n");
      return 2;
    }
  } else {
    if (!threads) threads = hardware_threads(); // the default --batch
    c.threads = threads;
    const char *wrong = new_run_defaults(&c);
    if (wrong) {
      fprintf(stderr, "42evolve: %s\n", wrong);
      return 2;
    }
    // islands with variants say it per variant (island_variants())
    if (c.pushoff_fallback && !c.variant_n && islands_n < 2) fprintf(stderr, "42evolve: " PUSHOFF_FALLBACK "\n", c.pushoff_fallback);
    r.p = c.p;
    params *p = &r.p;
    if (islands_n) {
      if (islands_n > ISLANDS_MAX || islands_keep >= islands_n || (islands_keep && !islands_every) || !islands_rounds || optimize_file) {
        fprintf(stderr, "42evolve: --islands 1..%d, --keep fewer than the islands and with --select-after, not with --optimize\n", ISLANDS_MAX);
        return 2;
      }
      if (islands_migrate_every && islands_n < 2) {
        fprintf(stderr, "42evolve: --migrate with 2 islands or more\n");
        return 2;
      }
      if (c.own_panels && (islands_n < 2 || p->panel_files[0] || p->panel_random == PANEL_RANDOM)) {
        fprintf(stderr, "42evolve: --island-panels own with 2 islands or more, a panel that is picked (--panel-choice picked or kinds), not --panel-files\n");
        return 2;
      }
      if (c.explorers && (c.explorers >= islands_n || islands_keep)) {
        fprintf(stderr, "42evolve: --explorers fewer than the islands, not with --keep\n");
        return 2;
      }
      if ((c.pick_given || c.to_given) && c.migrate_given && !islands_migrate_every) {
        fprintf(stderr, "42evolve: --migrate-pick and --migrate-to not with --migrate 0\n");
        return 2;
      }
      static params variants[ISLANDS_MAX];
      if (!c.variant_n && islands_n >= 2) { // new runs of islands: half exploit, half explore (gen-var16-rnd)
        c.variant[0] = "";
        c.variant[1] = "--screen-members 80 --screen-rounds 8";
        c.variant_n = 2;
        c.variant_default = 1;
      }
      if (c.variant_n > islands_n) {
        fprintf(stderr, "42evolve: --island-variant at most once per island\n");
        return 2;
      }
      {
        const int rc = island_variants(argc, argv, &c, variants);
        if (rc) return rc;
      }
      // new runs of islands: every 5 batches a member drawn from an island drawn (gen-var16-rnd); --migrate 0: none
      if (!c.migrate_given && islands_n >= 2) islands_migrate_every = 5;
      if (c.explorers && !islands_migrate_every) {
        fprintf(stderr, "42evolve: --explorers needs migration (not with --migrate 0)\n");
        return 2;
      }
      if (!c.pick_given) c.migrate_random = 1;
      if (!c.to_given) c.migrate_next = MIGRATE_RANDOM;
      signal(SIGINT, on_signal);
      signal(SIGTERM, on_signal);
      return islands_new(p, variants, c.variant, c.variant_n, dir, islands_n, islands_keep, islands_every, islands_rounds,
                         islands_migrate_every, c.migrate_random, c.migrate_next, c.explorers,
                         c.own_panels, threads, batches, seconds);
    }
    if (run_new(&r, threads, optimize_file != 0) != 0) return 1;
  }

  if (run_open(&r, resume, threads) != 0) return 1;
  signal(SIGINT, on_signal);
  signal(SIGTERM, on_signal);

  if (optimize_file) {
    const int rc = optimize(&r, optimize_file);
    pool_stop(r.pool);
    fclose(r.events);
    return rc;
  }
  if (!resume) {
    run_first(&r);
  } else {
    fprintf(r.events, "{\"type\":\"resume\",\"batch\":%u}\n", r.batch);
    if (changes_given) { // the weights of the changes from now on; the run is no longer the one without a break
      r.p.changes = new_changes;
      char mix[CH_ALL * 32];
      genome_mix_text(&r.p.changes, mix, sizeof mix);
      fprintf(r.events, "{\"type\":\"changes\",\"batch\":%u,\"changes\":\"%s\"}\n", r.batch, mix);
    }
    if (new_list) // the list grew (load_state()); children fill the new places
      fprintf(r.events, "{\"type\":\"list\",\"batch\":%u,\"list\":%u,\"fill\":false}\n", r.batch, r.p.list);
    if (new_reintroduce >= 0) { // how often a warrior of the archive comes back, from now on
      r.p.reintroduce = new_reintroduce;
      fprintf(r.events, "{\"type\":\"reintroduce\",\"batch\":%u,\"reintroduce\":%.17g}\n", r.batch, r.p.reintroduce);
    }
    if (new_stop >= 0 || new_check > 0) { // the screen from now on; --screen-stop 0 turns it off
      if (new_stop >= 0) r.p.screen_stop = new_stop, r.p.screen_check = 0;
      if (new_check > 0) r.p.screen_check = new_check, r.p.screen_stop = 0;
      const char *wrong = params_error(&r.p);
      if (wrong) {
        fprintf(stderr, "42evolve: %s\n", wrong);
        return 2;
      }
      fprintf(r.events, "{\"type\":\"screen-options\",\"batch\":%u,\"screenStop\":%.17g,\"screenCheck\":%.17g}\n", r.batch,
              r.p.screen_stop, r.p.screen_check);
    }
  }
  fprintf(stderr, "42evolve: %s, %u panel and %u holdout warriors, %u threads, batch %u\n", dir, r.panel_n, r.hold_n,
          threads, r.batch);

  const double t0 = now();
  for (uint32_t done = 0; !stop_now && (!batches || done < batches) && (!seconds || now() - t0 < seconds); done++) {
    run_step(&r);
  }
  pool_stop(r.pool);
  fclose(r.events);
  return 0;
}
