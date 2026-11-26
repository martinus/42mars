// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// A run of 42evolve: allocation and files, the matrix of results, the
// push-off values on it, and the steps of a run: its pool, a new run, a
// run that continues, its files and engines, the first events, one batch
// with its state.

#include "evolve.h"

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

// ---------------------------------------------------------------- a run's steps

// The threads of a run: its own pool, unless it already has one (the islands
// of one process share one, --islands).
void run_pool(run *r, uint32_t threads) {
  if (r->pool) return;
  r->pool = &r->own;
  pool_start(r->pool, threads, &r->p.rules);
  r->pool->mirror = r->p.mirror;
}

// A new run in r->dir with the parameters in r->p (defaults applied, checked):
// the opponents, the panel (picked unless --panel-files or random), the
// holdout, the matrix. optimize: --optimize, no panel to pick.
int run_new(run *r, uint32_t threads, int optimize) {
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
int run_resume(run *r) {
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
int run_open(run *r, int resume, uint32_t threads) {
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
void run_first(run *r) {
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
void run_step(run *r) {
  run_batch(r);
  save_state(r);
  const pushoff_value *best = 0;
  for (uint32_t i = r->panel_n; i < r->active_n; i++)
    if (!best || r->values[i].value > best->value) best = &r->values[i];
  if (best)
    fprintf(stderr, "%sbatch %u: %u members, best value %.1f (%s, avg %.1f), best holdout %.1f\n", r->label, r->batch - 1,
            members(r), best->value, r->slot[best->index]->name, best->avg, r->best_holdout);
}
