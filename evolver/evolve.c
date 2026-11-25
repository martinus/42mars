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

static char *xstrdup(const char *s) {
  char *p = xmalloc(strlen(s) + 1);
  strcpy(p, s);
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

static m42_warrior *make_warrior(const genome *g, const m42_rules *rules) {
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

// ---------------------------------------------------------------- JSON

// A JSON string; latin1: bytes 0x80..0xff are Latin-1 characters (warrior files).
static void json_str(FILE *f, const char *s, int latin1) {
  fputc('"', f);
  for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
    const unsigned c = *p;
    if (c == '"' || c == '\\') fprintf(f, "\\%c", c);
    else if (c == '\n') fputs("\\n", f);
    else if (c == '\t') fputs("\\t", f);
    else if (c < 0x20 || c == 0x7f) fprintf(f, "\\u%04x", c);
    else if (c >= 0x80 && latin1) fprintf(f, "\\u%04x", c);
    else if (c >= 0x80) fputc('?', f);
    else fputc((int)c, f);
  }
  fputc('"', f);
}

static volatile sig_atomic_t stop_now = 0;
static void on_signal(int sig) {
  stop_now = 1;
  signal(sig, SIG_DFL); // a second Ctrl-C ends it at once
}

// The seed of every match against warrior id: its first position, later
// rounds from it (semantics doc, 3.2). Never 0: Park-Miller stays at 0, and
// every round would put the second warrior minDistance from the first. One
// id in about 7,800 got 0; in pareto30 (17th November 2026) Bitter Robot II
// learned that position and won 1,125,180 of 1,127,080 rounds against the
// newcomers. The others keep their seeds.
static int64_t seed_for(const run *r, uint64_t id) {
  const m42_rules *ru = &r->p.rules;
  const uint64_t range = ru->core_size - 2 * ru->min_distance + 1;
  const uint64_t s = rng_mix(r->p.seed * 0x9e3779b97f4a7c15u ^ rng_mix(id + 1)) % range;
  return (int64_t)(s ? s : 1);
}

// Points per 100 rounds, a win 3 and a tie `tie`; points() counts a tie 1,
// as the hill does: the scores against the folder, the holdout, the bench.
// What selects (the screen, the values, the push-off) counts it --tie-points.
static double points_t(m42_score s, uint32_t rounds, double tie) { return (3.0 * s.wins + tie * s.ties) * 100.0 / rounds; }
static double points(m42_score s, uint32_t rounds) { return points_t(s, rounds, 1); }

// Points per 100 rounds over the rounds the result has (--stage: fewer than
// p.rounds until a survivor that stays plays the rest).
static double points_of_t(m42_score s, double tie) {
  const uint32_t n = s.wins + s.losses + s.ties;
  return n ? points_t(s, n, tie) : 0;
}
static double points_of(m42_score s) { return points_of_t(s, 1); }

static void set_result(run *r, uint32_t a, uint32_t b, m42_score sa) {
  const uint32_t c = r->cap;
  m42_score sb = {sa.losses, sa.wins, sa.ties};
  r->wlt[a * c + b] = sa;
  r->wlt[b * c + a] = sb;
  r->pts[a * c + b] = points_of_t(sa, r->p.tie);
  r->pts[b * c + a] = points_of_t(sb, r->p.tie);
}

// The same for the results of the first stage (--stage).
static void set_result1(run *r, uint32_t a, uint32_t b, m42_score sa) {
  const uint32_t c = r->cap;
  m42_score sb = {sa.losses, sa.wins, sa.ties};
  r->wlt1[a * c + b] = sa;
  r->wlt1[b * c + a] = sb;
  r->pts1[a * c + b] = points_of_t(sa, r->p.tie);
  r->pts1[b * c + a] = points_of_t(sb, r->p.tie);
}

// The rounds of a whole match against a panel warrior (--panel-rounds), and
// against the warrior in slot o.
static uint32_t panel_rounds(const params *p) { return p->panel_rounds ? p->panel_rounds : p->rounds; }

// The rounds of the first stage of a match, p.rounds without --stage.
static uint32_t stage_rounds(const params *p) { return p->stage && p->stage < p->rounds ? p->stage : p->rounds; }

static m42_score add_scores(m42_score a, m42_score b) {
  return (m42_score){a.wins + b.wins, a.losses + b.losses, a.ties + b.ties};
}

static void rebuild_active(run *r) {
  r->active_n = 0;
  for (uint32_t i = 0; i < r->cap; i++)
    if (r->slot[i]) r->active[r->active_n++] = i;
}

static uint32_t members(const run *r) { return r->active_n - r->panel_n; }

// A distance to the power alpha (--alpha, 1 by default).

static double with_alpha(const run *r, double d) { return r->p.alpha == 1 ? d : pow(d, r->p.alpha); }

// A warrior's average against the panel in a matrix of points per 100 rounds
// (pts, or pts1 of the first stage); a panel warrior's own column does not
// count.
static double panel_avg_on(const run *r, const double *pts, uint32_t slot) {
  double s = 0;
  uint32_t n = 0;
  for (uint32_t j = 0; j < r->panel_n; j++)
    if (j != slot) s += pts[slot * r->cap + j], n++;
  return n ? s / n : 0;
}

static double panel_avg(const run *r, uint32_t slot) { return panel_avg_on(r, r->pts, slot); }

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

static void compute_values(run *r) {
  pushoff_values(r->pts, r->cap, r->active, r->active_n, r->p.sd, r->p.alpha, r->p.distance_panel ? r->keep : 0, r->sigma,
                 r->values);
  panel_average_values(r, r->pts);
  pareto_values(r, r->pts);
}

// The same on the results of the first stage (--stage).
static void compute_values1(run *r) {
  pushoff_values(r->pts1, r->cap, r->active, r->active_n, r->p.sd, r->p.alpha, r->p.distance_panel ? r->keep : 0, r->sigma,
                 r->values);
  panel_average_values(r, r->pts1);
  pareto_values(r, r->pts1);
}

// A warrior's average against the panel, points per 100 rounds; a panel
// warrior's own column does not count.

static uint32_t free_slot(const run *r) {
  for (uint32_t i = r->panel_n; i < r->cap; i++)
    if (!r->slot[i]) return i;
  fprintf(stderr, "42evolve: no free slot\n");
  exit(1);
}

static void free_warrior(warrior *w) {
  if (!w) return;
  free(w->w);
  free(w->g);
  free(w->file);
  free(w->source);
  free(w);
}

// --min-length: the instructions of a warrior that are not DAT.F $0, $0, the
// cell of an empty core, so that a child cannot reach the minimum with them
static int too_short(const genome *g, const params *p) {
  if (p->min_length <= 1) return 0;
  m42_instruction code[GENOME_MAX];
  genome_code(g, p->rules.core_size, code);
  uint32_t n = 0;
  for (uint32_t i = 0; i < g->len; i++)
    n += !(code[i].opcode == 12 && code[i].modifier == 4 && code[i].a_mode == 1 && code[i].b_mode == 1 && !code[i].a &&
           !code[i].b);
  return n < p->min_length;
}

// The length of a random warrior: 1 (--min-length) to --init-length, within
// --length; without --min-length the numbers drawn before it existed.
static uint32_t random_length(const params *p, rng *g) {
  const uint32_t lo = p->min_length > 1 ? p->min_length : 1;
  uint32_t hi = p->init_length < p->rules.max_length ? p->init_length : p->rules.max_length;
  if (hi < lo) hi = lo;
  return lo + rng_below(g, hi - lo + 1);
}

static int seen_has(const run *r, uint64_t h) {
  for (uint32_t i = 0; i < r->seen_n; i++)
    if (r->seen[i] == h) return 1;
  return 0;
}

static void seen_add(run *r, uint64_t h) {
  r->seen[r->seen_next] = h;
  r->seen_next = (r->seen_next + 1) % SEEN_MAX;
  if (r->seen_n < SEEN_MAX) r->seen_n++;
}

// ---------------------------------------------------------------- opponents

static int by_name(const void *a, const void *b) { return strcmp(*(char *const *)a, *(char *const *)b); }

static warrior *load_opponent(const run *r, const char *name, int quiet) {
  char path[2048];
  snprintf(path, sizeof path, "%s/%s", r->p.opponents, name);
  size_t len;
  char *src = read_file(path, &len);
  if (!src) {
    if (!quiet) fprintf(stderr, "42evolve: cannot read %s\n", path);
    return 0;
  }
  int status;
  m42_warrior *w = m42_assemble_new(src, len, &r->p.rules, 0, 0, &status);
  if (!w || !m42_warrior_ok(w) || m42_warrior_length(w) > r->p.rules.max_length || m42_warrior_uses_pspace(w)) {
    if (!quiet) fprintf(stderr, "42evolve: %s does not fit the rules\n", path);
    m42_warrior_free(w);
    free(src);
    return 0;
  }
  warrior *o = xmalloc(sizeof *o);
  o->w = w;
  o->file = xstrdup(name);
  o->source = src;
  m42_warrior_text(w, M42_NAME, o->name, sizeof o->name);
  m42_warrior_text(w, M42_AUTHOR, o->author, sizeof o->author);
  o->parents[0] = o->parents[1] = NO_ID;
  o->holdout = -1;
  return o;
}

// The names of the .red files of a folder, sorted.
// The names of the .red files of a folder, sorted; with `also` (".gen") the
// files of that ending too.
static char **red_files(const char *dir, uint32_t *count, const char *also) {
  DIR *d = opendir(dir);
  if (!d) {
    fprintf(stderr, "42evolve: cannot open %s\n", dir);
    exit(1);
  }
  uint32_t n = 0, cap = 256;
  char **names = xmalloc(cap * sizeof *names);
  for (struct dirent *e; (e = readdir(d));) {
    const size_t len = strlen(e->d_name);
    if (len < 5 || (strcmp(e->d_name + len - 4, ".red") != 0 && (!also || strcmp(e->d_name + len - 4, also) != 0))) continue;
    if (n == cap) {
      names = realloc(names, (cap *= 2) * sizeof *names);
      if (!names) exit(1);
    }
    names[n++] = xstrdup(e->d_name);
  }
  closedir(d);
  qsort(names, n, sizeof *names, by_name);
  *count = n;
  return names;
}

// All .red files of the folder that fit the rules, shuffled with the seed.
static char **opponent_files(run *r, uint32_t *count) {
  uint32_t n;
  char **names = red_files(r->p.opponents, &n, 0);
  uint32_t k = 0;
  for (uint32_t i = 0; i < n; i++) {
    warrior *w = load_opponent(r, names[i], 1);
    if (w) names[k++] = names[i];
    else free(names[i]);
    free_warrior(w);
  }
  rng g = rng_seed(r->p.draw_seed, 0x70616e656cu, 0); // "panel"
  for (uint32_t i = k; i > 1; i--) {
    const uint32_t j = rng_below(&g, i);
    char *t = names[i - 1];
    names[i - 1] = names[j];
    names[j] = t;
  }
  // --panel-files: those first, in their order; the rest stays shuffled. The
  // holdout of --island-panels own after them.
  uint32_t front = 0;
  for (int list = 0; list < 2; list++) {
    const char *files = list ? r->p.holdout_files : r->p.panel_files;
    const uint32_t from = front;
    for (const char *q = files; *q;) {
      const char *e = strchr(q, ',');
      const size_t len = e ? (size_t)(e - q) : strlen(q);
      uint32_t i = front;
      while (i < k && !(strlen(names[i]) == len && !strncmp(names[i], q, len))) i++;
      if (i == k) {
        fprintf(stderr, "42evolve: %s: %.*s is not a warrior of %s that fits the rules (or named twice)\n",
                list ? "the holdout of --island-panels own" : "--panel-files", (int)len, q, r->p.opponents);
        exit(2);
      }
      char *t = names[front];
      names[front++] = names[i];
      names[i] = t;
      q += len + (e ? 1 : 0);
    }
    if (files[0]) *(list ? &r->p.holdout : &r->p.panel) = front - from; // as many as listed: run_new() takes no others
  }
  *count = k;
  return names;
}

// --start: the warriors of the folder that fit the rules, sorted by file
// name, as genomes; each starts a family of its own.
static void load_starts(run *r) {
  if (!r->p.start[0]) return;
  uint32_t n;
  char **names = red_files(r->p.start, &n, r->p.gen ? ".gen" : 0); // a run on generators starts from generators too
  r->starts = xmalloc((n ? n : 1) * sizeof *r->starts);
  r->start_noun = xmalloc((n ? n : 1) * sizeof *r->start_noun);
  r->start_name = xmalloc((n ? n : 1) * sizeof *r->start_name);
  r->start_file = xmalloc((n ? n : 1) * sizeof *r->start_file);
  for (uint32_t i = 0; i < n; i++) {
    char path[2100];
    snprintf(path, sizeof path, "%s/%s", r->p.start, names[i]);
    size_t len;
    char *src = read_file(path, &len);
    if (!strcmp(names[i] + strlen(names[i]) - 4, ".gen")) { // a generator, as 42gen reads one (best.gen of a run)
      gen *p = xmalloc(sizeof *p);
      char why[160] = "cannot read it";
      int ok = src && strlen(src) == len && !gen_parse(p, src, r->p.rules.core_size, why, sizeof why);
      if (ok && !gen_keeps(p, r->p.rules.core_size, r->p.rules.max_length))
        ok = 0, snprintf(why, sizeof why, "it writes nothing, too much, or has too many instruction lines");
      free(src);
      if (!ok) {
        fprintf(stderr, "42evolve: %s is no generator of a warrior of these rules (%s), not a start warrior\n", path, why);
        free(p);
        free(names[i]);
        continue;
      }
      const uint32_t k = r->start_n++;
      genome_from_generator(&r->starts[k], p, r->p.rules.core_size, r->p.rules.max_length);
      free(p);
      snprintf(r->start_name[k], sizeof r->start_name[k], "%.*s", (int)(strlen(names[i]) - 4), names[i]); // the file's name
      rng g = rng_seed(r->p.seed, 0x7374617274u, k); // "start"
      r->start_noun[k] = rng_below(&g, NAME_NOUNS);
      r->start_file[k] = names[i];
      continue;
    }
    int status;
    m42_warrior *w = src ? m42_assemble_new(src, len, &r->p.rules, 0, 0, &status) : 0;
    free(src);
    const uint32_t wl = w && m42_warrior_ok(w) ? m42_warrior_length(w) : 0;
    if (!wl || wl > r->p.rules.max_length || wl > GENOME_MAX || m42_warrior_uses_pspace(w)) {
      fprintf(stderr, "42evolve: %s does not fit the rules, not a start warrior\n", path);
      m42_warrior_free(w);
      free(names[i]);
      continue;
    }
    const uint32_t k = r->start_n++;
    genome_from_code(&r->starts[k], m42_warrior_code(w), wl, m42_warrior_start(w), r->p.rules.core_size);
    if (r->p.gen) genome_as_generator(&r->starts[k]);
    m42_warrior_text(w, M42_NAME, r->start_name[k], sizeof r->start_name[k]);
    rng g = rng_seed(r->p.seed, 0x7374617274u, k); // "start"
    r->start_noun[k] = rng_below(&g, NAME_NOUNS);
    r->start_file[k] = names[i];
    m42_warrior_free(w);
  }
  free(names);
  if (!r->start_n) {
    fprintf(stderr, "42evolve: no warrior in %s fits the rules\n", r->p.start);
    exit(1);
  }
}

// ---------------------------------------------------------------- events

// The text of g's generator, to be freed; 0 when g is a list.
static char *generator_text(const genome *g, uint32_t core) {
  if (!g->generated) return 0;
  const size_t n = gen_text(&g->p, core, 0, 0) + 1;
  char *text = xmalloc(n);
  gen_text(&g->p, core, text, n);
  return text;
}

// The warrior's code, and behind it "gen": its generator (--genome gen).
static void write_code(FILE *f, const genome *g, uint32_t core) {
  char text[GENOME_MAX * 48 + 64];
  genome_text(g, core, text, sizeof text);
  json_str(f, text, 0);
  char *gen = generator_text(g, core);
  if (!gen) return;
  fputs(",\"gen\":", f);
  json_str(f, gen, 0);
  free(gen);
}

static void event_start(run *r) {
  FILE *f = r->events;
  const params *p = &r->p;
  fprintf(f,
          "{\"type\":\"start\",\"version\":\"%s\",\"rules\":{\"size\":%u,\"cycles\":%u,\"processes\":%u,\"length\":%u,"
          "\"distance\":%u},\"params\":{\"panel\":%u,\"holdout\":%u,\"list\":%u,\"batch\":%u,\"survivors\":%u,"
          "\"rounds\":%u,\"screenRounds\":%u,\"benchEvery\":%u,\"benchRounds\":%u,\"initLength\":%u,"
          "\"screenFactor\":%.17g,\"alpha\":%.17g,\"reintroduce\":%.17g,\"sd\":\"%s\",\"seed\":%" PRIu64
          ","
          "\"parents\":\"%s\",\"screenMembers\":%u,\"stage\":%u,\"fill\":%s,\"panelRounds\":%u,\"diversity\":\"%s\",\"panelChoice\":\"%s\",\"screenStop\":%.17g,\"screenCheck\":%.17g,\"average\":\"%s\",\"memberGames\":\"%s\",\"drawSeed\":%" PRIu64 ",\"pushoff\":\"%s\",\"positions\":\"%s\",\"clear\":%.17g,\"genome\":\"%s\",\"minLength\":%u,\"tiePoints\":%.17g},"
          "\"opponents\":",
          m42_version(), p->rules.core_size, p->rules.max_cycles, p->rules.max_processes, p->rules.max_length,
          p->rules.min_distance, r->panel_n, r->hold_n, p->list, p->batch, p->survivors, p->rounds, p->screen_rounds,
          p->bench_every, p->bench_rounds, p->init_length, p->screen_factor, p->alpha, p->reintroduce,
          p->sd == SD_SUM ? "sum" : "opponent", p->seed,
          p->parents == PARENTS_DUEL ? "duel" : "value", p->screen_members, p->stage,
          p->fill ? "true" : "false", panel_rounds(p), p->distance_panel ? "panel" : "all",
          p->panel_files[0]                 ? "files"
          : p->panel_random == PANEL_RANDOM ? "random"
          : p->panel_random == PANEL_KINDS  ? "kinds"
                                            : "picked",
          p->screen_stop, p->screen_check,
          p->average_panel ? "panel" : "all", p->member_games_none ? "none" : "all", p->draw_seed,
          p->pareto == 3 ? "pareto-sd" : p->pareto ? "pareto" : "value", p->mirror ? "mirror" : "pmars", p->clear, p->gen ? "gen" : "list", p->min_length, p->tie);
  json_str(f, p->opponents, 0);
  fputs(",\"panelFiles\":", f);
  json_str(f, p->panel_files, 0);
  fputs(",\"start\":", f);
  json_str(f, p->start, 0);
  fputs(",\"startWarriors\":[", f);
  for (uint32_t i = 0; i < r->start_n; i++) {
    fputs(i ? ",{\"name\":" : "{\"name\":", f);
    json_str(f, r->start_name[i], 1);
    fputs(",\"file\":", f);
    json_str(f, r->start_file[i], 1);
    fprintf(f, ",\"family\":\"%s\"}", name_noun(r->start_noun[i]));
  }
  fputs("],\"changes\":{", f);
  for (int k = 0; k < (p->gen ? CH_ALL : CH_COUNT); k++) // a run on generators: the kinds that make structure too
    fprintf(f, "%s\"%s\":%u", k ? "," : "", genome_change_name(k), p->changes.w[k]);
  fputc('}', f);
  for (int k = 0; k < 2; k++) {
    fputs(k ? ",\"holdout\":[" : ",\"panel\":[", f);
    const uint32_t n = k ? r->hold_n : r->panel_n;
    for (uint32_t i = 0; i < n; i++) {
      const warrior *w = k ? &r->hold[i] : &r->panel[i];
      fprintf(f, "%s{\"id\":%" PRIu64 ",\"name\":", i ? "," : "", w->id);
      json_str(f, w->name, 1);
      fputs(",\"author\":", f);
      json_str(f, w->author, 1);
      fputs(",\"file\":", f);
      json_str(f, w->file, 1);
      fputs(",\"source\":", f);
      json_str(f, w->source, 1);
      fputc('}', f);
    }
    fputc(']', f);
  }
  fputs("}\n", f);
}

// The matches of the panel among each other: [a, b, wins, losses, ties, seed]
// with a the higher id, warrior 0 of the match.
static void event_panel(run *r) {
  FILE *f = r->events;
  fputs("{\"type\":\"panel\",\"scores\":[", f);
  int first = 1;
  for (uint32_t a = 0; a < r->panel_n; a++)
    for (uint32_t b = 0; b < a; b++) {
      const m42_score s = r->wlt[a * r->cap + b];
      fprintf(f, "%s[%" PRIu64 ",%" PRIu64 ",%u,%u,%u,%" PRId64 "]", first ? "" : ",", r->panel[a].id, r->panel[b].id,
              s.wins, s.losses, s.ties, seed_for(r, r->panel[b].id));
      first = 0;
    }
  if (stage_rounds(&r->p) < r->p.rounds) { // --stage: the first stage's results too
    fputs("],\"scores1\":[", f);
    first = 1;
    for (uint32_t a = 0; a < r->panel_n; a++)
      for (uint32_t b = 0; b < a; b++) {
        const m42_score s = r->wlt1[a * r->cap + b];
        fprintf(f, "%s[%" PRIu64 ",%" PRIu64 ",%u,%u,%u]", first ? "" : ",", r->panel[a].id, r->panel[b].id, s.wins,
                s.losses, s.ties);
        first = 0;
      }
  }
  fputs("]}\n", f);
}

// A new member: its results against every warrior in, [other, wins, losses,
// ties, seed], the new member warrior 0 of each match.
static void event_enter(run *r, uint32_t slot, double screen, double estimate, uint64_t rival,
                        const unit *row) {
  FILE *f = r->events;
  const warrior *w = r->slot[slot];
  fprintf(f, "{\"type\":\"enter\",\"batch\":%u,\"id\":%" PRIu64 ",\"name\":", r->batch, w->id);
  json_str(f, w->name, 0);
  fputs(",\"parents\":[", f);
  for (int k = 0, n = 0; k < 2; k++)
    if (w->parents[k] != NO_ID) fprintf(f, "%s%" PRIu64, n++ ? "," : "", w->parents[k]);
  fputs("],\"ops\":", f);
  json_str(f, w->ops, 0);
  fprintf(f, ",\"length\":%u,\"screen\":%.4f,\"estimate\":%.6f,\"screenPoints\":[", w->g->len, screen, estimate);
  for (uint32_t k = 0; k < r->panel_n; k++) fprintf(f, "%s%.4f", k ? "," : "", points_t(row[k].s[0], r->p.screen_rounds, r->p.tie));
  fprintf(f, "],\"style\":{\"kind\":\"%s\",\"copies\":%.6f,\"moved\":%.6f,\"written\":%.6f,\"whole\":%.6f,\"read\":%.6f,"
          "\"tasks\":%.6f,\"alive\":%.6f,\"measured\":%.6f}",
          style_kind_name(w->style_kind), w->st.copies, w->st.moved, w->st.written, w->st.whole, w->st.read, w->st.tasks,
          w->st.alive, w->st.measured);
  // raceKey: 0 since --race went (#193), as it was without it
  fprintf(f, ",\"raceKey\":0.000000,\"rival\":%" PRId64 ",\"parentDifference\":%.6f,\"newFamily\":%s,\"origin\":%u,\"code\":",
          rival == NO_ID ? (int64_t)-1 : (int64_t)rival, w->parent_difference, w->new_family ? "true" : "false",
          w->origin);
  write_code(f, w->g, r->p.rules.core_size);
  fputs(",\"scores\":[", f);
  int first = 1;
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    if (o == slot) continue;
    if (r->p.member_games_none && o >= r->panel_n) continue; // --member-games none: no games against members
    const m42_score s = r->wlt[slot * r->cap + o];
    fprintf(f, "%s[%" PRIu64 ",%u,%u,%u,%" PRId64 "]", first ? "" : ",", r->slot[o]->id, s.wins, s.losses, s.ties,
            seed_for(r, r->slot[o]->id));
    first = 0;
  }
  fputs("]}\n", f);
}

// early: decided on the results of the first stage (--stage), the values too
static void event_leave(run *r, const pushoff_value *v, int early) {
  fprintf(r->events,
          "{\"type\":\"leave\",\"batch\":%u,\"id\":%" PRIu64 ",\"avg\":%.6f,\"distance\":%.6f,\"nearest\":%" PRId64
          ",\"value\":%.6f%s}\n",
          r->batch, r->slot[v->index]->id, v->avg, v->distance,
          v->nearest == UINT32_MAX ? (int64_t)-1 : (int64_t)r->slot[v->nearest]->id, v->value,
          early ? ",\"early\":true" : "");
}

// The values of everyone in after the batch: [id, avg, distance, nearest,
// value, panel average].
static void event_values(run *r) {
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"values\",\"batch\":%u,\"values\":[", r->batch);
  for (uint32_t i = 0; i < r->active_n; i++) {
    const pushoff_value *v = &r->values[i];
    fprintf(f, "%s[%" PRIu64 ",%.6f,%.6f,%" PRId64 ",%.6f,%.6f]", i ? "," : "", r->slot[v->index]->id, v->avg,
            v->distance, v->nearest == UINT32_MAX ? (int64_t)-1 : (int64_t)r->slot[v->nearest]->id, v->value,
            panel_avg(r, v->index));
  }
  fputs("]}\n", f);
}

// ---------------------------------------------------------------- state

// The params line of a state: the fields in their order. An option removed
// after 1.1.0 (#193) keeps its place, written as 0, so that states from
// before and after read alike; a state with another value there used the
// option, and load_state() refuses it.
typedef struct {
  char type;        // 'u' uint32_t, 'd' int, 'g' double, 'q' uint64_t; '-' a removed option's place
  size_t at;        // offsetof(params, ...)
  const char *gone; // '-': the option, 0 for a place whose value says nothing (that of --race-keep)
} param_field;
#define PF(t, f) {t, offsetof(params, f), 0}
#define GONE(o) {'-', 0, o}
static const param_field param_fields[] = {
    PF('u', panel), PF('u', holdout), PF('u', list), PF('u', batch), PF('u', survivors), PF('u', rounds),
    PF('u', screen_rounds), PF('u', bench_every), PF('u', bench_rounds), PF('u', init_length), PF('g', screen_factor),
    PF('g', alpha), PF('g', reintroduce), PF('d', sd), PF('q', seed), GONE("--select"), GONE("--rotate"),
    GONE("--fractions"), GONE("--race"), GONE(0), GONE("--prior"), PF('d', parents), PF('u', screen_members),
    GONE("--noise"), PF('u', stage), PF('d', fill), PF('u', panel_rounds), PF('d', distance_panel), GONE("--niche"),
    GONE("--map-elites"), GONE("--specialists"), GONE("--sharing"), PF('g', screen_stop), PF('g', screen_check),
    GONE("--tune-novel"), PF('d', average_panel), PF('d', member_games_none), GONE("--simple"), PF('q', draw_seed),
    GONE("--difference"), PF('d', pareto), PF('d', mirror), PF('g', clear), PF('d', gen), GONE("--refactor"),
    PF('u', min_length), PF('g', tie)};
#define PARAM_FIELDS (sizeof param_fields / sizeof *param_fields)

static void save_params(FILE *f, const params *p) {
  fputs("params", f);
  for (size_t i = 0; i < PARAM_FIELDS; i++) {
    const param_field *x = &param_fields[i];
    const char *q = (const char *)p + x->at;
    switch (x->type) {
      case 'u': fprintf(f, " %u", *(const uint32_t *)q); break;
      case 'd': fprintf(f, " %d", *(const int *)q); break;
      case 'g': fprintf(f, " %.17g", *(const double *)q); break;
      case 'q': fprintf(f, " %" PRIu64, *(const uint64_t *)q); break;
      default: fputs(" 0", f);
    }
  }
  fputc('\n', f);
}

// The fields of a params line into p, as many as it has: an older state has
// fewer, and the others keep their defaults. Returns how many; *gone: the
// first removed option the state used, else 0.
static int load_params(const char *text, params *p, const char **gone) {
  *gone = 0;
  int got = 0;
  for (size_t i = 0; i < PARAM_FIELDS; i++, got++) {
    const param_field *x = &param_fields[i];
    char *q = (char *)p + x->at, *e;
    if (x->type == 'u') {
      const unsigned long v = strtoul(text, &e, 10);
      if (e != text) *(uint32_t *)q = (uint32_t)v;
    } else if (x->type == 'd') {
      const long v = strtol(text, &e, 10);
      if (e != text) *(int *)q = (int)v;
    } else if (x->type == 'q') {
      const unsigned long long v = strtoull(text, &e, 10);
      if (e != text) *(uint64_t *)q = (uint64_t)v;
    } else {
      const double v = strtod(text, &e);
      if (e != text && x->type == 'g') *(double *)q = v;
      if (e != text && x->type == '-' && v != 0 && x->gone && !*gone) *gone = x->gone;
    }
    if (e == text) break;
    text = e;
  }
  return got;
}

static void save_state(run *r) {
  char path[1100], tmp[1100];
  snprintf(path, sizeof path, "%s/state.txt", r->dir);
  snprintf(tmp, sizeof tmp, "%s/state.tmp", r->dir);
  fflush(r->events);
  const long events_size = ftell(r->events);
  FILE *f = fopen(tmp, "w");
  if (!f) {
    fprintf(stderr, "42evolve: cannot write %s\n", tmp);
    exit(1);
  }
  const params *p = &r->p;
  fprintf(f, "42evolve-state 1\n");
  fprintf(f, "rules %u %u %u %u %u\n", p->rules.core_size, p->rules.max_cycles, p->rules.max_processes,
          p->rules.max_length, p->rules.min_distance);
  save_params(f, p);
  fprintf(f, "opponents %s\n", p->opponents);
  if (p->start[0]) fprintf(f, "start-dir %s\n", p->start);
  char mix[CH_ALL * 32];
  genome_mix_text(&p->changes, mix, sizeof mix);
  fprintf(f, "changes %s\n", mix);
  for (uint32_t i = 0; i < r->panel_n; i++) fprintf(f, "panel-id %" PRIu64 " %s\n", r->panel[i].id, r->panel[i].file);
  for (uint32_t i = 0; i < r->hold_n; i++) fprintf(f, "holdout %s\n", r->hold[i].file);
  fprintf(f, "batch %u\nnext %" PRIu64 "\nbest %" PRIu64 " %.17g\nevents %ld\n", r->batch, r->next_id, r->best_id,
          r->best_holdout, events_size);
  char text[GENOME_SAVE_MAX];
  // the members' slots: a later newcomer takes the lowest free one, so a
  // resumed run needs the holes where they were
  for (uint32_t i = 0; i < r->active_n; i++)
    if (r->slot[r->active[i]]->kind == MEMBER) fprintf(f, "slot %" PRIu64 " %u\n", r->slot[r->active[i]]->id, r->active[i]);
  for (uint32_t i = 0; i < r->active_n; i++) {
    const warrior *w = r->slot[r->active[i]];
    if (w->kind != MEMBER) continue;
    genome_save(w->g, text, sizeof text);
    fprintf(f, "member %" PRIu64 " %u %" PRIu64 " %" PRIu64 " %.17g %u %u %u %s\nops %s\nkind %d\norigin %u\n", w->id, w->born,
            w->parents[0], w->parents[1], w->holdout, w->adjective, w->noun, w->earlier, text, w->ops, w->style_kind, w->origin);
  }
  for (uint32_t i = 0; i < r->archive_n; i++) {
    genome_save(&r->archive[i], text, sizeof text);
    fprintf(f, "archive %" PRIu64 " %u %s\n", r->archive_id[i], r->archive_noun[i], text);
  }
  fprintf(f, "archive-next %u\n", r->archive_next);
  if (r->best_g_set) { // the warrior of best.red
    genome_save(&r->best_g, text, sizeof text);
    fprintf(f, "best-genome %s\n", text);
  }
  for (uint32_t i = 0; i < NAME_ADJECTIVES * NAME_NOUNS; i++)
    if (r->names[i]) fprintf(f, "names %u %u\n", i, r->names[i]);
  for (uint32_t i = 0; i < r->active_n; i++)
    for (uint32_t j = 0; j < i; j++) {
      const uint32_t a = r->active[i], b = r->active[j];
      const m42_score s = r->wlt[a * r->cap + b];
      fprintf(f, "score %" PRIu64 " %" PRIu64 " %u %u %u\n", r->slot[a]->id, r->slot[b]->id, s.wins, s.losses, s.ties);
      if (stage_rounds(p) < p->rounds) {
        const m42_score s1 = r->wlt1[a * r->cap + b];
        fprintf(f, "score1 %" PRIu64 " %" PRIu64 " %u %u %u\n", r->slot[a]->id, r->slot[b]->id, s1.wins, s1.losses,
                s1.ties);
      }
    }
  fprintf(f, "seen-next %u\n", r->seen_next);
  for (uint32_t i = 0; i < r->seen_n; i++) fprintf(f, "seen %016" PRIx64 "\n", r->seen[i]);
  fprintf(f, "end\n");
  if (fclose(f) != 0 || rename(tmp, path) != 0) {
    fprintf(stderr, "42evolve: cannot write %s\n", path);
    exit(1);
  }
}

static uint32_t slot_of_id(const run *r, uint64_t id) {
  for (uint32_t i = 0; i < r->cap; i++)
    if (r->slot[i] && r->slot[i]->id == id) return i;
  return UINT32_MAX;
}

static void setup_matrix(run *r) {
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

static void load_list(run *r, warrior **list, uint32_t *n, char **names, uint32_t count, int kind, uint64_t first_id) {
  *list = xmalloc((count ? count : 1) * sizeof **list);
  *n = 0;
  for (uint32_t i = 0; i < count; i++) {
    warrior *w = load_opponent(r, names[i], 0);
    if (!w) exit(1);
    w->kind = kind;
    w->id = first_id + i;
    (*list)[(*n)++] = *w;
    free(w);
  }
}

// Does a --changes text name the change loop (#182), removed after 1.1.0
// (#193)? A state names only the kinds it draws.
static int names_loop(const char *mix) {
  for (const char *q = mix; (q = strstr(q, "loop=")) != 0; q++)
    if (q == mix || q[-1] == ',') return 1;
  return 0;
}

static int load_state(run *r, const char *path) {
  size_t len;
  char *text = read_file(path, &len);
  if (!text) return -1;
  char **panel = xmalloc(len * sizeof *panel / 8 + 8), **hold = xmalloc(len * sizeof *hold / 8 + 8);
  uint64_t *panel_id = xmalloc(len * sizeof *panel_id / 8 + 8);
  uint32_t pn = 0, hn = 0;
  params *p = &r->p;
  char *save = 0, **rest = xmalloc(len * sizeof(char *) / 4 + 8);
  uint32_t rn = 0;
  int ok = 0, refused = 0;
  uint64_t *slot_id = 0; // the slot lines, freed also on the way out through bad
  uint32_t *slot_at = 0, slots = 0;
  // the lines that need the matrix come after the opponents are loaded
  char *line = strtok_r(text, "\n", &save);
  if (!line || strcmp(line, "42evolve-state 1") != 0) goto bad;
  for (line = strtok_r(0, "\n", &save); line; line = strtok_r(0, "\n", &save)) {
    if (!strncmp(line, "rules ", 6)) {
      if (sscanf(line + 6, "%u %u %u %u %u", &p->rules.core_size, &p->rules.max_cycles, &p->rules.max_processes,
                 &p->rules.max_length, &p->rules.min_distance) != 5)
        goto bad;
    } else if (!strncmp(line, "params ", 7)) {
      const char *gone;
      const int got = load_params(line + 7, p, &gone);
      if (got < 15) goto bad; // the first version had 15; what a state lacks keeps its default
      if (!gone && p->pareto == 2) gone = "--pushoff pareto-age"; // 3 is pareto-sd
      if (gone) {
        fprintf(stderr, "42evolve: %s: %s was removed after 1.1.0 (#193)\n", r->dir, gone);
        refused = 1;
        goto bad;
      }
      if (got < 39) p->draw_seed = p->seed; // a state from before --draw-seed: the folder in the order of the seed
    } else if (!strncmp(line, "opponents ", 10)) {
      snprintf(p->opponents, sizeof p->opponents, "%s", line + 10);
    } else if (!strncmp(line, "start-dir ", 10)) {
      snprintf(p->start, sizeof p->start, "%s", line + 10);
    } else if (!strncmp(line, "changes ", 8)) { // a state without it has the rates of genome_mix_default()
      if (names_loop(line + 8)) {
        fprintf(stderr, "42evolve: %s: --changes loop was removed after 1.1.0 (#193)\n", r->dir);
        refused = 1;
        goto bad;
      }
      if (genome_mix_parse(&p->changes, line + 8) != 0) goto bad;
    } else if (!strncmp(line, "panel ", 6)) { // a state from before panel-id: the ids are 0, 1, ...
      panel_id[pn] = pn;
      panel[pn++] = line + 6;
    } else if (!strncmp(line, "panel-id ", 9)) {
      int used = 0;
      if (sscanf(line + 9, "%" SCNu64 " %n", &panel_id[pn], &used) != 1 || !used) goto bad;
      panel[pn++] = line + 9 + used;
    } else if (!strncmp(line, "reserve ", 8)) { // the rest of the folder, for --rotate and --prior hill (#193)
    } else if (!strncmp(line, "holdout ", 8)) {
      hold[hn++] = line + 8;
    } else {
      rest[rn++] = line;
    }
  }
  p->rules.rounds = p->rounds;
  p->rules.warriors = 2;
  load_list(r, &r->panel, &r->panel_n, panel, pn, PANEL, 0);
  for (uint32_t i = 0; i < pn; i++) r->panel[i].id = panel_id[i];
  load_list(r, &r->hold, &r->hold_n, hold, hn, HOLDOUT, pn);
  if (r->list_grow) { // --list on a run that continues: more places, filled by children (not random warriors)
    if (r->list_grow < p->list) {
      fprintf(stderr, "42evolve: --list on a run that continues only grows the list (it has %u)\n", p->list);
      exit(2);
    }
    p->list = r->list_grow;
    p->fill = 0;
  }
  setup_matrix(r);
  warrior *last = 0;
  slot_id = xmalloc(r->cap * sizeof *slot_id);
  slot_at = xmalloc(r->cap * sizeof *slot_at);
  for (uint32_t i = 0; i < rn; i++) {
    line = rest[i];
    if (!strncmp(line, "slot ", 5)) { // before the member lines; states before them have none
      if (slots >= r->cap || sscanf(line + 5, "%" SCNu64 " %u", &slot_id[slots], &slot_at[slots]) != 2 ||
          slot_at[slots] < r->panel_n || slot_at[slots] >= r->cap)
        goto bad;
      slots++;
      continue;
    }
    if (sscanf(line, "batch %u", &r->batch) == 1 || sscanf(line, "next %" SCNu64, &r->next_id) == 1 ||
        sscanf(line, "best %" SCNu64 " %lg", &r->best_id, &r->best_holdout) == 2 ||
        sscanf(line, "archive-next %u", &r->archive_next) == 1 || sscanf(line, "seen-next %u", &r->seen_next) == 1 ||
        !strncmp(line, "reserve-next ", 13) || !strncmp(line, "rotate-next ", 12) || // of --rotate, removed in #193
        !strncmp(line, "events ", 7) || !strcmp(line, "end"))
      continue;
    if (!strncmp(line, "member ", 7)) {
      warrior *w = xmalloc(sizeof *w);
      int used = 0;
      w->kind = MEMBER;
      w->style_kind = -1;
      w->g = xmalloc(sizeof *w->g);
      if (sscanf(line + 7, "%" SCNu64 " %u %" SCNu64 " %" SCNu64 " %lg %u %u %u %n", &w->id, &w->born,
                 &w->parents[0], &w->parents[1], &w->holdout, &w->adjective, &w->noun, &w->earlier, &used) != 8 ||
          w->adjective >= NAME_ADJECTIVES || w->noun >= NAME_NOUNS ||
          genome_load(w->g, line + 7 + used, p->rules.core_size, 0) != 0)
        goto bad;
      w->w = make_warrior(w->g, &p->rules);
      w->origin = w->born; // a state from before the origin has no origin line
      name_text(w->name, sizeof w->name, w->adjective, w->noun, w->earlier);
      uint32_t at = UINT32_MAX;
      for (uint32_t k = 0; k < slots; k++)
        if (slot_id[k] == w->id) at = slot_at[k];
      if (at != UINT32_MAX && r->slot[at]) goto bad;
      r->slot[at != UINT32_MAX ? at : free_slot(r)] = w;
      last = w;
    } else if (!strncmp(line, "origin ", 7)) { // after its member line; states before have none
      if (!last || sscanf(line + 7, "%u", &last->origin) != 1) goto bad;
    } else if (!strncmp(line, "kind ", 5)) { // after its member line; states before have none
      if (!last || sscanf(line + 5, "%d", &last->style_kind) != 1) goto bad;
    } else if (!strncmp(line, "ops ", 4) || !strcmp(line, "ops")) {
      if (last) snprintf(last->ops, sizeof last->ops, "%s", line[3] ? line + 4 : "");
    } else if (!strncmp(line, "best-genome ", 12)) { // the warrior of best.red
      if (genome_load(&r->best_g, line + 12, p->rules.core_size, 0) != 0) goto bad;
      r->best_g_set = 1;
    } else if (!strncmp(line, "tuned ", 6)) { // the warrior --tune-novel tuned for the next batch: it waits there
      fprintf(stderr, "42evolve: %s: --tune-novel was removed after 1.1.0 (#193)\n", r->dir);
      refused = 1;
      goto bad;
    } else if (!strncmp(line, "archive ", 8)) {
      int used = 0;
      if (r->archive_n >= ARCHIVE_MAX ||
          sscanf(line + 8, "%" SCNu64 " %u %n", &r->archive_id[r->archive_n], &r->archive_noun[r->archive_n], &used) != 2 ||
          r->archive_noun[r->archive_n] >= NAME_NOUNS ||
          genome_load(&r->archive[r->archive_n], line + 8 + used, p->rules.core_size, 0) != 0)
        goto bad;
      r->archive_n++;
    } else if (!strncmp(line, "names ", 6)) {
      uint32_t i, n;
      if (sscanf(line + 6, "%u %u", &i, &n) != 2 || i >= NAME_ADJECTIVES * NAME_NOUNS) goto bad;
      r->names[i] = n;
    } else if (!strncmp(line, "score ", 6)) {
      uint64_t a, b;
      m42_score s;
      if (sscanf(line + 6, "%" SCNu64 " %" SCNu64 " %u %u %u", &a, &b, &s.wins, &s.losses, &s.ties) != 5) goto bad;
      const uint32_t sa = slot_of_id(r, a), sb = slot_of_id(r, b);
      if (sa == UINT32_MAX || sb == UINT32_MAX) goto bad;
      set_result(r, sa, sb, s);
      set_result1(r, sa, sb, s); // a state without score1 lines: the whole results stand for the first stage
    } else if (!strncmp(line, "score1 ", 7)) { // after the score line of the pair
      uint64_t a, b;
      m42_score s;
      if (sscanf(line + 7, "%" SCNu64 " %" SCNu64 " %u %u %u", &a, &b, &s.wins, &s.losses, &s.ties) != 5) goto bad;
      const uint32_t sa = slot_of_id(r, a), sb = slot_of_id(r, b);
      if (sa == UINT32_MAX || sb == UINT32_MAX) goto bad;
      set_result1(r, sa, sb, s);
    } else if (!strncmp(line, "seen ", 5)) {
      if (r->seen_n >= SEEN_MAX || sscanf(line + 5, "%" SCNx64, &r->seen[r->seen_n]) != 1) goto bad;
      r->seen_n++;
    } else {
      goto bad;
    }
  }
  rebuild_active(r);
  compute_values(r);
  ok = 1;
bad:
  free(slot_id);
  free(slot_at);
  free(text);
  free(panel);
  free(panel_id);
  free(hold);
  free(rest);
  if (!ok && !refused) fprintf(stderr, "42evolve: %s is not a state file of this version\n", path);
  return ok ? 0 : -1;
}

static long state_events_size(const char *path) {
  size_t len;
  char *text = read_file(path, &len);
  long size = -1;
  const char *e = text ? strstr(text, "\nevents ") : 0;
  if (e) size = strtol(e + 8, 0, 10);
  free(text);
  return size;
}

// ---------------------------------------------------------------- one batch

typedef struct {
  genome g;
  m42_warrior *w;
  uint64_t parents[2];
  uint32_t noun; // the family's noun, from the first parent
  uint32_t origin; // the start of its line: the older of its parents', else this batch
  uint64_t rival; // the member the first parent won its tournament against, NO_ID none
  char ops[128];
  int skip;
  double screen;   // average against the panel in the screen rounds
  double estimate; // screen * (SD-score to the nearest warrior in, on the panel columns)^alpha
  double key;      // what the survivors are picked by: screen or estimate
  double dist;     // the SD-score to the nearest warrior in, from the screen (estimated_distance())
  int out;         // --screen-stop: stopped
  int would_stop;  // --screen-check: --screen-stop would have stopped it
  uint32_t played; // rounds of its screen against each opponent
  uint32_t stop_at; // --screen-stop, --screen-check: the rounds after which it stopped (would have), 0 not
  int reached;     // 0 bred, 1 evaluated (not a repeat), 2 past the screen, 3 still in the list after its batch
  int keep;        // --start: a start warrior in the first batch, which enters whatever its screen
  uint64_t id;
} candidate;

// Tournament of two: the member with the higher push-off value.
// Tournament of two members. --parents value: the higher push-off value
// wins. --parents duel: the one with more points in their match against
// each other wins (as in YACE, where winners of fights reproduce), a draw
// goes by value. *rival: the other one.
static const warrior *select_parent(run *r, rng *g, uint64_t *rival) {
  const uint32_t m = members(r);
  const uint32_t i = r->panel_n + rng_below(g, m), j = r->panel_n + rng_below(g, m);
  const pushoff_value *a = &r->values[i], *b = &r->values[j];
  const pushoff_value *win = b->value > a->value ? b : a;
  if (r->p.parents == PARENTS_DUEL && a->index != b->index) {
    const double ab = r->pts[a->index * r->cap + b->index], ba = r->pts[b->index * r->cap + a->index];
    if (ab != ba) win = ab > ba ? a : b;
  }
  if (rival) *rival = r->slot[(win == a ? b : a)->index]->id;
  return r->slot[win->index];
}

static int by_key(const void *a, const void *b) {
  const candidate *x = *(candidate *const *)a, *y = *(candidate *const *)b;
  if (x->key != y->key) return x->key < y->key ? 1 : -1;
  return x < y ? -1 : 1;
}

// The start warriors of the first batch (--start) first, then by_key.
static int by_keep_key(const void *a, const void *b) {
  const candidate *x = *(candidate *const *)a, *y = *(candidate *const *)b;
  if (x->keep != y->keep) return x->keep ? -1 : 1;
  return by_key(a, b);
}

static void bench(run *r, uint32_t slot) {
  warrior *w = r->slot[slot];
  unit *u = xmalloc(r->hold_n * sizeof *u);
  for (uint32_t i = 0; i < r->hold_n; i++)
    u[i] = (unit){w->w, r->hold[i].w, seed_for(r, r->hold[i].id), 0, r->p.bench_rounds, {{0}}, 0, 0};
  pool_run(r->pool, u, r->hold_n);
  double sum = 0;
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"bench\",\"batch\":%u,\"id\":%" PRIu64 ",\"rounds\":%u,\"scores\":[", r->batch, w->id,
          r->p.bench_rounds);
  for (uint32_t i = 0; i < r->hold_n; i++) {
    sum += points(u[i].s[0], r->p.bench_rounds);
    fprintf(f, "%s[%" PRIu64 ",%u,%u,%u,%" PRId64 "]", i ? "," : "", r->hold[i].id, u[i].s[0].wins, u[i].s[0].losses,
            u[i].s[0].ties, u[i].seed);
  }
  w->holdout = r->hold_n ? sum / r->hold_n : 0;
  fprintf(f, "],\"avg\":%.6f,\"panel\":%.6f}\n", w->holdout, panel_avg(r, slot));
  free(u);
  if (w->holdout > r->best_holdout) {
    r->best_holdout = w->holdout;
    r->best_id = w->id;
    r->best_g = *w->g, r->best_g_set = 1;
    char path[1100];
    snprintf(path, sizeof path, "%s/best.red", r->dir);
    FILE *b = fopen(path, "w");
    if (b) {
      char text[GENOME_MAX * 48 + 64];
      genome_text(w->g, r->p.rules.core_size, text, sizeof text);
      fprintf(b,
              "%s\n;name %s\n;author 42evolve\n;strategy evolved, warrior %" PRIu64 " of run seed %" PRIu64
              ", batch %u\n;strategy %.1f against %u holdout warriors, %.1f against the panel\n%s",
              r->p.rules.core_size == 8000 ? ";redcode-94nop" : ";redcode", w->name, w->id, r->p.seed, r->batch,
              w->holdout, r->hold_n, panel_avg(r, slot), text);
      fclose(b);
    }
    char *gen = generator_text(w->g, r->p.rules.core_size); // --genome gen: best.gen, the generator of best.red
    if (gen) {
      snprintf(path, sizeof path, "%s/best.gen", r->dir);
      if ((b = fopen(path, "w")) != 0) {
        fprintf(b, "; %s, warrior %" PRIu64 " of run seed %" PRIu64 ", batch %u: 42gen%s gives best.red's code\n%s", w->name, w->id,
                r->p.seed, r->batch, r->p.rules.core_size == 8000 && r->p.rules.max_length == 100 ? "" : " --size and --length of the run", gen);
        fclose(b);
      }
      free(gen);
    }
  }
}

// The candidate's SD-score to the nearest warrior in, from its screen results
// against the panel (row[j] for panel warrior j) and the panel columns of the
// others, raised to alpha: its push-off value is about screen * this. The
// standard deviations are those of the last compute_values().
static double estimated_distance(const run *r, const unit *row, uint32_t rounds) {
  double best = INFINITY;
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    double num = 0, den = 0, sum = 0;
    for (uint32_t k = 0; k < r->panel_n; k++) {
      if (k == o) continue;
      const double d = fabs(points_t(row[k].s[0], rounds, r->p.tie) - r->pts[o * r->cap + k]);
      if (r->p.sd == SD_SUM) num += d, den += r->sigma[k];
      else if (r->sigma[k] > 0) sum += d / r->sigma[k];
    }
    const double dist = r->p.sd == SD_SUM ? (den > 0 ? num / den : 0) : sum;
    if (dist < best) best = dist;
  }
  if (best == INFINITY) best = 0;
  return with_alpha(r, best);
}

// A candidate's screen score, estimate and key from its row of screen
// results against the q screen opponents (row[j] for panel warrior j, then
// the members of the screen) over `rounds`.
static void score_screen(const run *r, candidate *x, const unit *row, uint32_t q, uint32_t rounds) {
  double s = 0;
  for (uint32_t j = 0; j < q; j++) s += points_t(row[j].s[0], rounds, r->p.tie);
  x->screen = q ? s / q : 0;
  x->dist = estimated_distance(r, row, rounds);
  x->estimate = x->screen * x->dist;
  x->key = x->screen;
}

// --screen-stop z: the screen in steps of SCREEN_STEP rounds against each
// opponent; after each step a child stops when it cannot get past. After n
// of F rounds against each of the q opponents, x is its mean over the
// opponents of its points per 100 rounds; a round against opponent k gives
// 300, 100 or 0 points, with the rates of its wins, ties and losses there
// counted with one more of each (5 losses are not a certain loss), so a
// variance v_k; one round's mean over the opponents has variance
// s2 = sum v_k / q^2. Its score after all F rounds lies around x with the
// standard deviation sqrt(s2 (F - n) / (F n)): the rounds still to come and
// the error of x itself. hi and lo are x plus and minus z of those. A child
// stops when hi is below the threshold of the survivors (known before the
// screen), or, when the survivors are the best by screen score, below the
// p.survivors-th largest lo of the children still in: that many others end
// above it but with a chance of a z-error each. z 3: a bound fails in 0.13%
// of cases. The children of a batch are about half fatal or identical to
// their parent (the mutation spectrum), and a fatal one is far below.
#define SCREEN_STEP 5

// The variance of one round's points (300, 100 * tie or 0) from the results
// of n rounds, each of wins, ties and losses counted once more.
static double round_variance(m42_score sc, uint32_t n, double tie) {
  const double t = n + 3.0, pw = (sc.wins + 1) / t, pt = (sc.ties + 1) / t, mu = 300 * pw + 100 * tie * pt;
  return 90000 * pw + 10000 * tie * tie * pt - mu * mu;
}

static void screen_bounds(const unit *row, uint32_t q, uint32_t n, uint32_t F, double z, double tie, double *lo,
                          double *hi) {
  double x = 0, s2 = 0;
  for (uint32_t k = 0; k < q; k++) {
    const m42_score sc = row[k].s[0];
    x += points_t(sc, n, tie);
    s2 += round_variance(sc, n, tie);
  }
  x /= q;
  s2 /= (double)q * q;
  const double sd = sqrt(s2 * (F - n) / ((double)F * n));
  *lo = x - z * sd, *hi = x + z * sd;
}

static int by_double_down(const void *a, const void *b) {
  const double x = *(const double *)a, y = *(const double *)b;
  return x > y ? -1 : x < y;
}

// Marks the children that stop after `done` rounds: out (--screen-stop) or
// would_stop (check: they play on, the rule as if they did not). Returns
// how many.
static uint32_t screen_decide(const run *r, candidate *c, uint32_t B, const unit *u, const uint32_t *at, uint32_t q,
                              uint32_t done, double z, double threshold, int check, FILE *log) {
  const params *p = &r->p;
  double *lo = xmalloc(B * sizeof *lo), *hi = xmalloc(B * sizeof *hi), *sorted = xmalloc(B * sizeof *sorted);
  uint32_t on = 0, n = 0;
  for (uint32_t i = 0; i < B; i++) {
    if (c[i].skip || c[i].out || c[i].would_stop) continue;
    screen_bounds(u + at[i], q, done, p->screen_rounds, z, p->tie, &lo[i], &hi[i]);
    sorted[on++] = lo[i];
  }
  double cut = -INFINITY; // the p.survivors-th largest lo
  if (on > p->survivors && p->survivors > 0) {
    qsort(sorted, on, sizeof *sorted, by_double_down);
    cut = sorted[p->survivors - 1];
  }
  if (log) {
    fprintf(log, "%s{\"rounds\":%u,\"threshold\":%.17g,\"cut\":%.17g,\"lo\":[", done == SCREEN_STEP ? "" : ",", done, threshold,
            cut == -INFINITY ? -1e300 : cut);
    for (uint32_t i = 0, k = 0; i < B; i++)
      if (!(c[i].skip || c[i].out || c[i].would_stop)) fprintf(log, "%s%.17g", k++ ? "," : "", lo[i]);
    fputs("],\"stopped\":[", log);
  }
  for (uint32_t i = 0; i < B; i++) {
    if (c[i].skip || c[i].out || c[i].would_stop) continue;
    if (!c[i].keep && (hi[i] < threshold || hi[i] < cut)) {
      if (log) { // its results so far against each opponent, [w,l,t,...]
        fprintf(log, "%s[", n ? "," : "");
        for (uint32_t k = 0; k < q; k++) {
          const m42_score sc = u[at[i] + k].s[0];
          fprintf(log, "%s%u,%u,%u", k ? "," : "", sc.wins, sc.losses, sc.ties);
        }
        fputc(']', log);
      }
      if (check) c[i].would_stop = 1;
      else c[i].out = 1;
      c[i].stop_at = done;
      n++;
    }
  }
  if (log) fputs("]}", log);
  free(lo), free(hi), free(sorted);
  return n;
}

// `rounds` more rounds, from round `first`, of every candidate still in
// against the screen's opponents (the slots so[0 .. Q-1]), added to its row
// in u.
static void screen_more(run *r, const candidate *c, uint32_t B, const uint32_t *so, uint32_t Q, unit *u, const uint32_t *at,
                        uint32_t first, uint32_t rounds) {
  unit *g = xmalloc((size_t)B * Q * sizeof *g);
  uint32_t n = 0;
  for (uint32_t i = 0; i < B; i++)
    for (uint32_t j = 0; j < Q && !c[i].skip && !c[i].out; j++) {
      const warrior *o = r->slot[so[j]];
      g[n++] = (unit){c[i].w, o->w, seed_for(r, o->id), first, rounds, {{0}}, 0, 0};
    }
  pool_run(r->pool, g, n);
  n = 0;
  for (uint32_t i = 0; i < B; i++)
    for (uint32_t j = 0; j < Q && !c[i].skip && !c[i].out; j++, n++) u[at[i] + j].s[0] = add_scores(u[at[i] + j].s[0], g[n].s[0]);
  free(g);
}

// Event `parents`: how far the children of each first parent got in this
// batch, [id, bred, evaluated, past the screen, stayed]; not those that came
// back from the archive.
static void event_parents(run *r, const candidate *c, uint32_t B) {
  uint64_t *pid = xmalloc(B * sizeof *pid);
  uint32_t (*pn)[4] = xmalloc(B * sizeof *pn), np = 0;
  for (uint32_t i = 0; i < B; i++) {
    if (c[i].parents[0] == NO_ID || !strcmp(c[i].ops, "reintroduce")) continue;
    uint32_t k = 0;
    while (k < np && pid[k] != c[i].parents[0]) k++;
    if (k == np) pid[np++] = c[i].parents[0];
    for (int st = 0; st <= c[i].reached; st++) pn[k][st]++;
  }
  if (np) {
    fprintf(r->events, "{\"type\":\"parents\",\"batch\":%u,\"parents\":[", r->batch);
    for (uint32_t k = 0; k < np; k++)
      fprintf(r->events, "%s[%" PRIu64 ",%u,%u,%u,%u]", k ? "," : "", pid[k], pn[k][0], pn[k][1], pn[k][2], pn[k][3]);
    fputs("]}\n", r->events);
  }
  free(pid), free(pn);
}

// How far the children of each change got in a batch: [bred, evaluated,
// past the screen, still in the list after the batch]; a child with several
// changes counts for each of them (once per name).
typedef struct {
  char name[24];
  uint32_t n[4];
} op_count;

static void count_ops(op_count *t, uint32_t *tn, const char *ops, int reached) {
  const char *seen[16];
  uint32_t ns = 0;
  for (const char *p = ops; *p;) {
    while (*p == ' ') p++;
    const char *e = p;
    while (*e && *e != ' ') e++;
    const size_t len = (size_t)(e - p);
    if (!len || len >= sizeof t->name) {
      p = e;
      continue;
    }
    int dup = 0;
    for (uint32_t k = 0; k < ns; k++) dup |= strncmp(seen[k], p, len) == 0 && seen[k][len] == 0;
    uint32_t k = 0;
    while (k < *tn && !(strncmp(t[k].name, p, len) == 0 && t[k].name[len] == 0)) k++;
    if (!dup) {
      if (k == *tn && *tn < 32) memcpy(t[k].name, p, len), t[k].name[len] = 0, (*tn)++;
      if (k < *tn) {
        for (int st = 0; st <= reached; st++) t[k].n[st]++;
        if (ns < 16) seen[ns++] = t[k].name;
      }
    }
    p = e;
  }
}

// The style of a newcomer (style.h, the same as tools/style.js): 2 rounds
// against each of the first 3 panel warriors, seeds 7 and 8, a look every 500
// of 4,000 instructions.
static void measure_style(run *r, warrior *w) {
  const m42_warrior *opp[3];
  const uint32_t n = r->panel_n < 3 ? r->panel_n : 3;
  for (uint32_t i = 0; i < n; i++) opp[i] = r->panel[i].w;
  if (style_measure(r->sm, r->swatch, w->w, opp, n, 2, 4000, 7, 500, &w->st) != M42_OK) {
    fprintf(stderr, "42evolve: the style of %" PRIu64 " could not be measured\n", w->id);
    exit(1);
  }
  w->style_kind = style_kind(&w->st);
}

// --stage: a newcomer leaves without the rest of its rounds when it is among
// the STAGE_CUT weakest members on the first stage's results (r->values from
// compute_values1()), unless its nearest warrior is weaker still: then the
// two are a pair, mostly a child and its first parent, and the push-off on the
// whole results decides which of them goes. In a run of 15th November 2026
// (list 90, stage 20 of 100 rounds) that sent 37% of the newcomers away early
// and 5% of those that stayed with all their rounds; only the weakest: 24%
// and 0%, the 8 weakest without the exception: 59% and 31%.
#define STAGE_CUT 8

// The position of slot s in r->values.
static uint32_t value_of(const run *r, uint32_t s) {
  for (uint32_t i = 0; i < r->active_n; i++)
    if (r->values[i].index == s) return i;
  return 0;
}

// A panel warrior does not leave early either.
static int leaves_early(const run *r, uint32_t s) {
  const uint8_t *mask = r->keep;
  if (mask[s]) return 0;
  const pushoff_value *me = &r->values[value_of(r, s)];
  uint32_t below = 0;
  for (uint32_t i = 0; i < r->active_n; i++)
    if (!mask[r->values[i].index] && r->values[i].value < me->value) below++;
  if (below >= STAGE_CUT) return 0;
  if (below == 0) return 1;
  return me->nearest == UINT32_MAX || r->values[value_of(r, me->nearest)].value >= me->value;
}

// --stage: the newcomer in slot s plays the rest of the rounds against
// everyone in it played only the first stage with (all of them were in before
// it, so it is the first warrior of each pair), the same seeds, from the round
// where it stopped. Event `complete` with the whole results of those pairs.
static void complete_one(run *r, uint32_t s) {
  const params *p = &r->p;
  unit *u = xmalloc((r->active_n + 1) * sizeof *u);
  uint32_t *opp = xmalloc((r->active_n + 1) * sizeof *opp), n = 0;
  for (uint32_t k = 0; k < r->active_n; k++) {
    const uint32_t o = r->active[k];
    if (o == s) continue;
    if (p->member_games_none && o >= r->panel_n) continue; // --member-games none
    const m42_score sc = r->wlt[s * r->cap + o];
    const uint32_t played = sc.wins + sc.losses + sc.ties;
    const uint32_t want = o < r->panel_n ? panel_rounds(p) : p->rounds;
    if (played >= want) continue;
    u[n] = (unit){r->slot[s]->w, r->slot[o]->w, seed_for(r, r->slot[o]->id), played, want - played, {{0}}, 0, 0};
    opp[n++] = o;
  }
  pool_run(r->pool, u, n);
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"complete\",\"batch\":%u,\"id\":%" PRIu64 ",\"scores\":[", r->batch, r->slot[s]->id);
  for (uint32_t k = 0; k < n; k++) {
    const m42_score whole = add_scores(r->wlt[s * r->cap + opp[k]], u[k].s[0]);
    set_result(r, s, opp[k], whole);
    fprintf(f, "%s[%" PRIu64 ",%u,%u,%u,%" PRId64 "]", k ? "," : "", r->slot[opp[k]]->id, whole.wins, whole.losses,
            whole.ties, u[k].seed);
  }
  fputs("]}\n", f);
  free(u);
  free(opp);
}

// A newcomer starts a family of its own when its scores differ from its first
// parent's by more than this, points per 100 rounds, on average over everyone
// else in. In the runs of 15th November 2026 the median was 1 to 9, and 0.1 to
// 2.3% of the children were above 30.
#define NEW_FAMILY 30.0

// The mean absolute difference of the rows of a and b over everyone else in
// (with --member-games none over the panel: members play no members).
static double row_difference(const run *r, uint32_t a, uint32_t b) {
  double s = 0;
  uint32_t n = 0;
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    if (o == a || o == b) continue;
    if (r->p.member_games_none && o >= r->panel_n) continue;
    s += fabs(r->pts[a * r->cap + o] - r->pts[b * r->cap + o]);
    n++;
  }
  return n ? s / n : 0;
}

static void run_batch(run *r) {
  const params *p = &r->p;
  const uint32_t B = p->batch, P = r->panel_n;
  const double t0 = now();
  const speed s0 = pool_speed(r->pool);
  candidate *c = xmalloc(B * sizeof *c);
  const uint32_t core = p->rules.core_size;
  uint32_t evaluated = 0;

  // breed
  // --reintroduce: a warrior of the archive whose code is in the list, or
  // came back already in this batch, does not come back: in a list that had
  // settled (kd1, 16th November 2026) 204 of 1,141 that came back were
  // copies of a member, and had to leave again at once
  uint64_t *in_list = xmalloc((r->active_n + B + 1) * sizeof *in_list);
  uint32_t in_n = 0;
  for (uint32_t k = r->panel_n; k < r->active_n; k++) in_list[in_n++] = genome_hash(r->slot[r->active[k]]->g, core);
  for (uint32_t i = 0; i < B; i++) {
    rng g = rng_seed(p->seed, 0x6272656564u + r->batch, i); // "breed"
    candidate *x = &c[i];
    x->parents[0] = x->parents[1] = x->rival = NO_ID;
    x->origin = r->batch; // a new line, unless it has parents in the list (below)
    int reintro = 0, copy = 0;
    if (i < r->migr_n) { // --migrate: another island's best member; it enters like a start warrior when it passes
      x->g = r->migr[i];
      x->noun = r->migr_noun[i];
      strcpy(x->ops, "migrant");
      reintro = 1;
      x->keep = 1;
      const uint64_t h = genome_hash(&x->g, core);
      for (uint32_t j = 0; j < in_n && !copy; j++) copy = in_list[j] == h;
      if (!copy) in_list[in_n++] = h;
    } else if (members(r) == 0 && r->start_n) {
      // the start warriors as they are, then mutants of them
      const uint32_t k = i % r->start_n;
      if (i < r->start_n) {
        x->g = r->starts[k];
        strcpy(x->ops, "start");
        reintro = 1; // always evaluated
        x->keep = 1;
      } else {
        genome_breed(&x->g, &r->starts[k], &r->starts[(k + 1) % r->start_n], &g, core, p->rules.max_length,
                     &p->changes, x->ops, sizeof x->ops);
      }
      x->noun = r->start_noun[k];
    } else if (members(r) == 0 || (p->fill && members(r) < p->list && !r->start_n)) {
      genome_random(&x->g, &g, core, random_length(p, &g));
      if (p->gen) genome_as_generator(&x->g);
      strcpy(x->ops, "random");
      x->noun = rng_below(&g, NAME_NOUNS); // a new family
    } else if (r->archive_n && rng_chance(&g, p->reintroduce)) {
      const uint32_t k = rng_below(&g, r->archive_n);
      x->g = r->archive[k];
      x->parents[0] = r->archive_id[k];
      x->noun = r->archive_noun[k];
      strcpy(x->ops, "reintroduce");
      reintro = 1;
      const uint64_t h = genome_hash(&x->g, core);
      for (uint32_t j = 0; j < in_n && !copy; j++) copy = in_list[j] == h;
      if (!copy) in_list[in_n++] = h;
    } else {
      const warrior *a = select_parent(r, &g, &x->rival), *b = select_parent(r, &g, 0);
      genome_breed(&x->g, a->g, b->g, &g, core, p->rules.max_length, &p->changes, x->ops, sizeof x->ops);
      x->parents[0] = a->id;
      x->noun = a->noun;
      x->origin = a->origin;
      if (strstr(x->ops, "crossover") && b->id != a->id) {
        x->parents[1] = b->id;
        if (b->origin < x->origin) x->origin = b->origin; // the older line
      }
    }
    const uint64_t h = genome_hash(&x->g, core);
    x->skip = copy || (!reintro && (seen_has(r, h) || too_short(&x->g, p)));
    if (!x->skip) {
      seen_add(r, h);
      x->w = make_warrior(&x->g, &p->rules);
      x->reached = 1;
      evaluated++;
    }
  }
  r->migr_n = 0;

  // the screen's opponents: the panel, and with --screen-members that many
  // members (all if fewer), drawn with the batch's seed; so[k] is the slot
  // of opponent k
  const uint32_t M0 = members(r), ns = p->screen_members < M0 ? p->screen_members : M0, Q = P + ns;
  uint32_t *so = xmalloc((P + M0) * sizeof *so);
  for (uint32_t k = 0; k < P + M0; k++) so[k] = r->active[k];
  rng sg = rng_seed(p->seed, 0x7363726565u + r->batch, 0); // "scree"
  for (uint32_t k = P; k < Q; k++) {
    const uint32_t j = k + rng_below(&sg, P + M0 - k), t = so[k];
    so[k] = so[j], so[j] = t;
  }
  uint64_t *screen_id = xmalloc((ns ? ns : 1) * sizeof *screen_id); // for the event: slots change in the batch
  for (uint32_t k = 0; k < ns; k++) screen_id[k] = r->slot[so[P + k]]->id;

  // screen: every candidate against those opponents, the first rounds
  uint32_t *screen_at = xmalloc(B * sizeof *screen_at);
  for (uint32_t i = 0, k = 0; i < B; i++) {
    screen_at[i] = k;
    if (!c[i].skip) k += Q;
  }
  // survivors: at least screen_factor of the weakest member's average
  // against the screen's opponents (itself left out); known before the
  // screen, --screen-stop stops a child that cannot reach it
  double threshold = -1;
  if (members(r) >= p->list) {
    threshold = INFINITY;
    for (uint32_t i = P; i < r->active_n; i++) {
      const uint32_t m = r->active[i];
      double s = 0;
      uint32_t k = 0;
      for (uint32_t j = 0; j < Q; j++)
        if (so[j] != m) s += r->pts[m * r->cap + so[j]], k++;
      const double a = k ? s / k : 0;
      if (a < threshold) threshold = a;
    }
    threshold *= p->screen_factor;
  }

  // --screen-stop, --screen-check: the screen in steps of SCREEN_STEP rounds
  const int stepping = p->screen_stop > 0 || p->screen_check > 0;
  const uint32_t F = p->screen_rounds;
  const uint32_t stage = stepping && SCREEN_STEP < F ? SCREEN_STEP : F;
  unit *u = xmalloc((size_t)B * Q * sizeof *u);
  uint32_t n = 0;
  for (uint32_t i = 0; i < B; i++)
    for (uint32_t j = 0; j < Q && !c[i].skip; j++) {
      const warrior *o = r->slot[so[j]];
      u[n++] = (unit){c[i].w, o->w, seed_for(r, o->id), 0, stage, {{0}}, 0, 0};
    }
  pool_run(r->pool, u, n);
  for (uint32_t i = 0; i < B; i++)
    if (!c[i].skip) score_screen(r, &c[i], u + screen_at[i], Q, stage);
  for (uint32_t i = 0; i < B; i++) c[i].played = stage, c[i].stop_at = 0, c[i].would_stop = 0;
  uint32_t stopped = 0;
  FILE *steps_log = 0; // --screen-check: each step's decisions, for the event
  char *steps_text = 0;
  size_t steps_len = 0;
  if (stepping) {
    const int check = !(p->screen_stop > 0);
    const double z = check ? p->screen_check : p->screen_stop;
    steps_log = check ? open_memstream(&steps_text, &steps_len) : 0;
    for (uint32_t done = stage; done < F;) {
      stopped += screen_decide(r, c, B, u, screen_at, Q, done, z, threshold, check, steps_log);
      const uint32_t step = F - done < SCREEN_STEP ? F - done : SCREEN_STEP;
      screen_more(r, c, B, so, Q, u, screen_at, done, step);
      for (uint32_t i = 0; i < B; i++) {
        if (c[i].skip || c[i].out) continue;
        c[i].played = done + step;
        score_screen(r, &c[i], u + screen_at[i], Q, done + step);
      }
      done += step;
    }
  }
  candidate **sv = xmalloc(B * sizeof *sv);
  uint32_t sn = 0;
  // --start: every start warrior enters in the first batch (the screen does not stop it), the
  // push-off then cuts the list to --list; the others take the places of the survivors left (a merge of 80 islands
  // kept 13 of them with the cut of 16 survivors, 18th November 2026)
  uint32_t kept = 0;
  for (uint32_t i = 0; i < B; i++)
    if (!c[i].skip && !c[i].out && c[i].screen >= threshold) sv[sn++] = &c[i], kept += c[i].keep;
  qsort(sv, sn, sizeof *sv, by_keep_key);
  const uint32_t most = kept > p->survivors ? kept : p->survivors;
  if (sn > most) sn = most;
  if (stepping) { // event `screen`: what the steps saved, and with --screen-check what stopping would have changed
    uint64_t played = 0, full = 0;
    uint32_t missed = 0;
    for (uint32_t i = 0; i < B; i++) {
      if (c[i].skip) continue;
      full += (uint64_t)F * Q;
      played += (uint64_t)(c[i].stop_at ? c[i].stop_at : F) * Q;
    }
    if (!(p->screen_stop > 0)) { // the survivors without the children it would have stopped
      candidate **alt = xmalloc(B * sizeof *alt);
      uint32_t an = 0;
      for (uint32_t i = 0; i < B; i++)
        if (!c[i].skip && !c[i].out && !c[i].would_stop && c[i].screen >= threshold) alt[an++] = &c[i];
      qsort(alt, an, sizeof *alt, by_key);
      if (an > p->survivors) an = p->survivors;
      for (uint32_t k = 0; k < sn; k++) {
        uint32_t m = 0;
        while (m < an && alt[m] != sv[k]) m++;
        missed += m == an;
      }
      free(alt);
    }
    fprintf(r->events, "{\"type\":\"screen\",\"batch\":%u,\"z\":%.17g,\"check\":%s,\"stopped\":%u,\"rounds\":%" PRIu64
            ",\"full\":%" PRIu64 ",\"missed\":%u",
            r->batch, p->screen_stop > 0 ? p->screen_stop : p->screen_check, p->screen_stop > 0 ? "false" : "true", stopped,
            played, full, missed);
    if (steps_log) {
      fclose(steps_log);
      fprintf(r->events, ",\"steps\":[%s],\"finals\":[", steps_text ? steps_text : "");
      free(steps_text);
      for (uint32_t i = 0, k = 0; i < B; i++) { // the whole screen of each child it would have stopped
        if (!c[i].would_stop) continue;
        fprintf(r->events, "%s[%.17g", k++ ? "," : "", c[i].screen);
        for (uint32_t j = 0; j < Q; j++) {
          const m42_score sc = u[screen_at[i] + j].s[0];
          fprintf(r->events, ",%u,%u,%u", sc.wins, sc.losses, sc.ties);
        }
        fputc(']', r->events);
      }
      fputc(']', r->events);
    }
    fputs("}\n", r->events);
  }
  for (uint32_t i = 0; i < sn; i++) sv[i]->id = r->next_id++, sv[i]->reached = 2;

  // the rest of the rounds against the panel, all rounds against the members
  // (also those of the screen: their screen rounds are the first rounds of
  // these) and against the survivors before them; with --stage N only up to
  // N rounds (the panel at least its screen rounds), the rest after the batch
  // for those still in
  const uint32_t M = members(r);
  const uint32_t upto = stage_rounds(p);
  const int staged = upto < p->rounds;
  unit *f = xmalloc((size_t)sn * (P + M + sn) * sizeof *f);
  uint32_t fn = 0;
  const uint32_t first = p->screen_rounds, more = (staged ? (upto > first ? upto : first) : panel_rounds(p)) - first;
  for (uint32_t i = 0; i < sn; i++) {
    for (uint32_t j = 0; j < P; j++)
      f[fn++] = (unit){sv[i]->w, r->panel[j].w, seed_for(r, r->panel[j].id), first, more, {{0}}, 0, 0};
    if (p->member_games_none) continue; // --member-games none: the panel only
    for (uint32_t j = P; j < r->active_n; j++) {
      const warrior *m = r->slot[r->active[j]];
      f[fn++] = (unit){sv[i]->w, m->w, seed_for(r, m->id), 0, upto, {{0}}, 0, 0};
    }
    for (uint32_t j = 0; j < i; j++)
      f[fn++] = (unit){sv[i]->w, sv[j]->w, seed_for(r, sv[j]->id), 0, upto, {{0}}, 0, 0};
  }
  pool_run(r->pool, f, fn);


  // enter in order, each followed by the push-off
  uint32_t *slot_of = xmalloc((sn ? sn : 1) * sizeof *slot_of);
  uint32_t *member_slots = xmalloc((M ? M : 1) * sizeof *member_slots);
  for (uint32_t j = P; j < r->active_n; j++) member_slots[j - P] = r->active[j];
  uint32_t entered = 0;
  fn = 0;
  for (uint32_t i = 0; i < sn; i++) {
    candidate *x = sv[i];
    const uint32_t s = free_slot(r);
    warrior *w = xmalloc(sizeof *w);
    w->id = x->id;
    w->kind = MEMBER;
    w->g = xmalloc(sizeof *w->g);
    *w->g = x->g;
    w->w = x->w;
    x->w = 0;
    w->parents[0] = x->parents[0];
    w->parents[1] = x->parents[1];
    w->born = r->batch;
    w->origin = x->origin;
    w->holdout = -1;
    memcpy(w->ops, x->ops, sizeof w->ops);
    r->slot[s] = w;
    slot_of[i] = s;
    const uint32_t at = screen_at[(uint32_t)(x - c)];
    // with --stage these are the first stage's results, in both matrices
    for (uint32_t j = 0; j < P; j++) {
      const m42_score sc = add_scores(u[at + j].s[0], f[fn++].s[0]);
      set_result(r, s, j, sc);
      if (staged) set_result1(r, s, j, sc);
    }
    if (p->member_games_none) { // no games against members: no results, also none left from a slot used before
      for (uint32_t k = 0; k < r->active_n; k++)
        if (r->active[k] >= P) {
          set_result(r, s, r->active[k], (m42_score){0, 0, 0});
          if (staged) set_result1(r, s, r->active[k], (m42_score){0, 0, 0});
        }
    } else {
    for (uint32_t j = 0; j < M; j++, fn++)
      if (member_slots[j] != UINT32_MAX) {
        set_result(r, s, member_slots[j], f[fn].s[0]);
        if (staged) set_result1(r, s, member_slots[j], f[fn].s[0]);
      }
    for (uint32_t j = 0; j < i; j++, fn++)
      if (slot_of[j] != UINT32_MAX) {
        set_result(r, s, slot_of[j], f[fn].s[0]);
        if (staged) set_result1(r, s, slot_of[j], f[fn].s[0]);
      }
    }
    rebuild_active(r);
    measure_style(r, w);
    // the name: its own adjective, the noun of its family, which is its first
    // parent's unless it plays very differently from it (NEW_FAMILY); names
    // change nothing else
    w->parent_difference = -1;
    w->new_family = 0;
    const uint32_t ps = x->parents[0] != NO_ID ? slot_of_id(r, x->parents[0]) : UINT32_MAX;
    if (ps != UINT32_MAX && r->slot[ps]->kind == MEMBER) {
      w->parent_difference = row_difference(r, s, ps);
      w->new_family = w->parent_difference > NEW_FAMILY;
    }
    if (w->new_family) w->origin = r->batch; // a new design: a new line
    rng name = rng_seed(p->seed, 0x6e616d65u, w->id); // "name"
    w->adjective = rng_below(&name, NAME_ADJECTIVES);
    w->noun = x->noun;
    if (w->new_family) {
      w->noun = rng_below(&name, NAME_NOUNS - 1);
      if (w->noun >= x->noun) w->noun++; // another noun than the parent's
    }
    w->earlier = r->names[w->adjective * NAME_NOUNS + w->noun]++;
    name_text(w->name, sizeof w->name, w->adjective, w->noun, w->earlier);
    event_enter(r, s, x->screen, x->estimate, x->rival, u + at);
    entered++;
    // --stage: first the push-off on everyone's first-stage results, the same
    // noise for all; if the newcomer is the weakest there, it leaves without
    // the rest of its rounds. Else it plays them, and the push-off decides on
    // the whole results, so that no newcomer pushes out a member on the noise
    // of its few rounds.
    int early = 0;
    if (staged) {
      if (members(r) > p->list) {
        compute_values1(r);
        early = leaves_early(r, s);
      }
      if (!early) complete_one(r, s);
    }
    if (members(r) > p->list) {
      if (!early) compute_values(r);
      // an early leave is the newcomer, also when another one is weaker on
      // the first stage (it may be a member that is unlucky in those rounds)
      const int k = early ? (int)value_of(r, s) : pushoff_weakest(r->values, r->active_n, r->keep);
      const uint32_t out = r->values[k].index;
      warrior *gone = r->slot[out];
      event_leave(r, &r->values[k], early);
      if (gone->id == w->id) entered--;
      else {
        r->archive[r->archive_next] = *gone->g;
        r->archive_id[r->archive_next] = gone->id;
        r->archive_noun[r->archive_next] = gone->noun;
        r->archive_next = (r->archive_next + 1) % ARCHIVE_MAX;
        if (r->archive_n < ARCHIVE_MAX) r->archive_n++;
      }
      for (uint32_t j = 0; j < M; j++)
        if (member_slots[j] == out) member_slots[j] = UINT32_MAX;
      for (uint32_t j = 0; j <= i; j++)
        if (slot_of[j] == out) slot_of[j] = UINT32_MAX;
      r->slot[out] = 0;
      free_warrior(gone);
      rebuild_active(r);
    }
  }
  for (uint32_t i = 0; i < sn; i++)
    if (slot_of[i] != UINT32_MAX) sv[i]->reached = 3;
  compute_values(r);
  event_values(r);

  if (p->bench_every && r->hold_n && (r->batch + 1) % p->bench_every == 0 && members(r)) {
    uint32_t best = r->active[P];
    for (uint32_t i = P; i < r->active_n; i++)
      if (panel_avg(r, r->active[i]) > panel_avg(r, best)) best = r->active[i];
    if (r->slot[best]->holdout < 0) bench(r, best);
  }

  event_parents(r, c, B);

  const speed s1 = pool_speed(r->pool);
  const double wall = now() - t0;
  const double busy = (s1.busy - s0.busy) / (wall * r->pool->threads);
  fprintf(r->events,
          "{\"type\":\"batch\",\"batch\":%u,\"candidates\":%u,\"evaluated\":%u,\"raced\":%u,\"raceDropped\":%.6f,"
          "\"survivors\":%u,\"entered\":%u,\"members\":%u,\"threshold\":%.6f,\"screenMembers\":[",
          r->batch, B, evaluated, evaluated, -1.0, sn, entered, members(r), // raced, raceDropped: as without --race (#193)
          threshold);
  for (uint32_t k = 0; k < ns; k++) fprintf(r->events, "%s%" PRIu64, k ? "," : "", screen_id[k]);
  fputs("],\"ops\":{", r->events);
  op_count ops[32];
  uint32_t on = 0;
  memset(ops, 0, sizeof ops);
  for (uint32_t i = 0; i < B; i++) count_ops(ops, &on, c[i].ops, c[i].reached);
  for (uint32_t k = 0; k < on; k++)
    fprintf(r->events, "%s\"%s\":[%u,%u,%u,%u]", k ? "," : "", ops[k].name, ops[k].n[0], ops[k].n[1], ops[k].n[2],
            ops[k].n[3]);
  fputs("}}\n", r->events);
  fprintf(r->events,
          "{\"type\":\"speed\",\"batch\":%u,\"seconds\":%.4f,\"threads\":%u,\"busy\":%.4f,\"rounds\":%" PRIu64
          ",\"instructions\":%" PRIu64 ",\"candidatesPerSecond\":%.2f,\"roundsPerSecond\":%.1f}\n",
          r->batch, wall, r->pool->threads, busy, s1.rounds - s0.rounds, s1.instructions - s0.instructions,
          evaluated / wall, (s1.rounds - s0.rounds) / wall);

  for (uint32_t i = 0; i < B; i++) free(c[i].w);
  free(c);
  free(u);
  free(f);
  free(sv);
  free(screen_at);
  free(so);
  free(screen_id);
  free(slot_of);
  free(member_slots);
  free(in_list);
  r->batch++;
}

// ---------------------------------------------------------------- the panel, picked

// --panel-choice picked (the default): the panel is strong and diverse
// warriors of the folder, picked as for the best run of E5. PICK_SAMPLE
// warriors of the folder (the first of the order drawn with the seed) play a
// round robin of PICK_ROUNDS rounds; of the strongest quarter by average
// (at least the panel's size), the strongest is picked first, then each time
// the one with the largest SD-score to the nearest picked one (each column
// by its standard deviation over the whole sample). names is reordered:
// the picked first, in the order picked, the rest as it was.
#define PICK_SAMPLE 300
#define PICK_ROUNDS 100
//
// --panel-choice kinds: a panel of every kind of design. The style of each
// warrior of the sample (style.h, against the first 3 of the sample) gives
// its kind; of the strongest half (at least the panel's size), the kinds take
// turns, the kind with the fewest picks first (on a tie the one with the
// strongest warrior left): its strongest warrior first, then the one with the
// largest SD-score to the nearest picked one. Warriors that die at once are
// not picked. A panel of only the strongest quarter had 6 of 20 warriors that
// every evolved member of an hour lost to (pd81, 15th November 2026).

// The kind of style of a warrior of the sample.
static int pick_style(run *r, m42_ctx *m, const m42_watch *wa, warrior **w, uint32_t n, uint32_t i) {
  const m42_warrior *opp[3];
  const uint32_t k = n < 3 ? n : 3;
  for (uint32_t j = 0; j < k; j++) opp[j] = w[j]->w;
  style st;
  if (style_measure(m, wa, w[i]->w, opp, k, 2, 4000, 7, 500, &st) != M42_OK) {
    fprintf(stderr, "42evolve: the style of %s could not be measured\n", w[i]->name);
    exit(1);
  }
  (void)r;
  return style_kind(&st);
}

// The round robin of a panel pick: the sample's points against each other,
// each one's average, the strongest first, the candidates and (kinds) their
// kind of style. Played once; pick_choose() chooses panels from it.
typedef struct {
  uint32_t n, want, nc;
  int kinds;
  double *pts, *sigma, *avg;
  uint32_t *order;
  int *kind;
} pick_table;

static void pick_play(run *r, char **names, uint32_t count, pick_table *out) {
  const uint32_t sample = r->p.pick_sample ? r->p.pick_sample : PICK_SAMPLE;
  const uint32_t n = count < sample ? count : sample, want = r->p.panel < n ? r->p.panel : n;
  warrior **w = xmalloc(n * sizeof *w);
  for (uint32_t i = 0; i < n; i++) {
    w[i] = load_opponent(r, names[i], 0);
    if (!w[i]) exit(1);
  }
  unit *u = xmalloc((size_t)n * n / 2 * sizeof *u + sizeof *u);
  uint32_t m = 0;
  for (uint32_t a = 0; a < n; a++)
    for (uint32_t b = 0; b < a; b++)
      u[m++] = (unit){w[a]->w, w[b]->w, seed_for(r, 0x7069636b00000000u + b), 0, PICK_ROUNDS, {{0}}, 0, 0}; // "pick"
  pool_run(r->pool, u, m);
  double *pts = xmalloc((size_t)n * n * sizeof *pts), *sigma = xmalloc(n * sizeof *sigma), *avg = xmalloc(n * sizeof *avg);
  m = 0;
  for (uint32_t a = 0; a < n; a++) {
    pts[a * n + a] = 0;
    for (uint32_t b = 0; b < a; b++, m++) pts[a * n + b] = points(u[m].s[0], PICK_ROUNDS), pts[b * n + a] = points(u[m].s[1], PICK_ROUNDS);
  }
  for (uint32_t a = 0; a < n; a++) {
    double s = 0;
    for (uint32_t b = 0; b < n; b++)
      if (b != a) s += pts[a * n + b];
    avg[a] = n > 1 ? s / (n - 1) : 0;
  }
  for (uint32_t k = 0; k < n; k++) {
    double mean = 0, v = 0;
    for (uint32_t a = 0; a < n; a++)
      if (a != k) mean += pts[a * n + k];
    mean /= n > 1 ? n - 1 : 1;
    for (uint32_t a = 0; a < n; a++)
      if (a != k) v += (pts[a * n + k] - mean) * (pts[a * n + k] - mean);
    sigma[k] = sqrt(v / (n > 1 ? n - 1 : 1));
  }
  // the strongest quarter, by average (the lower index on a tie)
  uint32_t *order = xmalloc(n * sizeof *order);
  for (uint32_t i = 0; i < n; i++) order[i] = i;
  for (uint32_t i = 1; i < n; i++)
    for (uint32_t j = i; j > 0 && (avg[order[j]] > avg[order[j - 1]] || (avg[order[j]] == avg[order[j - 1]] && order[j] < order[j - 1])); j--) {
      const uint32_t t = order[j];
      order[j] = order[j - 1], order[j - 1] = t;
    }
  const int kinds = r->p.panel_random == PANEL_KINDS;
  uint32_t nc = kinds ? (n + 1) / 2 : (n + 3) / 4;
  if (nc < want) nc = want;
  int *kind = xmalloc(n * sizeof *kind);
  for (uint32_t i = 0; i < n; i++) kind[i] = -1;
  if (kinds) {
    int st;
    m42_ctx *m = m42_new(&r->p.rules, &st);
    const size_t wsize = m ? m42_watch_size(&r->p.rules) : 0;
    void *mem = wsize ? xmalloc(wsize) : 0;
    const m42_watch *wa = mem ? m42_watch_attach(m, mem, wsize, &st) : 0;
    if (!wa) {
      fprintf(stderr, "42evolve: no engine with a watch for the style: %s\n", m42_status_text(st));
      exit(1);
    }
    for (uint32_t i = 0; i < nc; i++) kind[order[i]] = pick_style(r, m, wa, w, n, order[i]);
    m42_free(m);
    free(mem);
  }
  for (uint32_t i = 0; i < n; i++) free_warrior(w[i]);
  free(w), free(u);
  *out = (pick_table){n, want, nc, kinds, pts, sigma, avg, order, kind};
}

static void pick_free(pick_table *t) { free(t->pts), free(t->sigma), free(t->avg), free(t->order), free(t->kind); }

// A panel from the round robin into picked (indexes of names), and what the
// event `pick` of r says about it: by kinds the strongest of each kind in
// turn, else (and within a kind) the farthest by SD-score from those picked.
// allowed: the candidates it may take (--island-panels own), 0 all. Returns
// how many it picked.
static uint32_t pick_choose(run *r, const pick_table *t, char **names, const uint8_t *allowed, uint32_t *picked) {
  const uint32_t n = t->n, want = t->want, nc = t->nc;
  const int kinds = t->kinds;
  const double *pts = t->pts, *sigma = t->sigma, *avg = t->avg;
  const uint32_t *order = t->order;
  const int *kind = t->kind;
  uint32_t kcount[KIND_COUNT] = {0};
  uint8_t *taken = calloc(n, 1);
  double *near = xmalloc(n * sizeof *near);
  for (uint32_t i = 0; i < n; i++) near[i] = INFINITY;
  uint32_t np = 0;
  while (np < want) {
    int target = -1; // kinds: the kind whose turn it is
    if (kinds) {
      for (uint32_t i = 0; i < nc; i++) {
        const uint32_t c = order[i];
        if (taken[c] || (allowed && !allowed[c]) || kind[c] == KIND_DIES) continue;
        if (target < 0 || kcount[kind[c]] < kcount[target]) target = kind[c];
      }
      if (target < 0) break;
    }
    int best = -1;
    double bd = -1;
    for (uint32_t i = 0; i < nc; i++) {
      const uint32_t c = order[i];
      if (taken[c] || (allowed && !allowed[c]) || (kinds && kind[c] != target)) continue;
      if (kinds && !kcount[target]) { // the strongest of a kind not picked yet
        best = (int)c, bd = near[c];
        break;
      }
      if (near[c] > bd) bd = near[c], best = (int)c; // the first: all are infinitely far, the strongest
    }
    if (best < 0) break; // allowed has fewer candidates than the panel wants
    if (kinds) kcount[target]++;
    r->pick_kind[np] = kind[best];
    picked[np] = (uint32_t)best;
    r->pick_avg[np] = avg[best];
    r->pick_file[np] = xstrdup(names[best]);
    for (uint32_t i = 0; i < n; i++)
      if (order[i] == (uint32_t)best) r->pick_rank[np] = i;
    r->pick_dist[np] = np ? bd : 0; // the first one's distance is infinite
    np++;
    taken[best] = 1;
    for (uint32_t i = 0; i < nc; i++) { // the distance of each candidate to its nearest picked one
      const uint32_t c = order[i];
      double d = 0;
      for (uint32_t k = 0; k < n; k++)
        if (k != c && k != (uint32_t)best && sigma[k] > 0) d += fabs(pts[c * n + k] - pts[best * n + k]) / sigma[k];
      if (d < near[c]) near[c] = d;
    }
  }
  r->pick_sample = n;
  r->pick_n = np;
  r->pick_cut = avg[order[nc - 1]];
  free(taken), free(near);
  return np;
}

static void pick_panel(run *r, char **names, uint32_t count) {
  pick_table t;
  pick_play(r, names, count, &t);
  uint32_t *picked = xmalloc((t.want ? t.want : 1) * sizeof *picked);
  const uint32_t np = pick_choose(r, &t, names, 0, picked);
  // the picked first, then the rest in its order
  uint8_t *taken = calloc(t.n, 1);
  for (uint32_t i = 0; i < np; i++) taken[picked[i]] = 1;
  char **re = xmalloc(count * sizeof *re);
  uint32_t k = 0;
  for (uint32_t i = 0; i < np; i++) re[k++] = names[picked[i]];
  for (uint32_t i = 0; i < count; i++)
    if (i >= t.n || !taken[i]) re[k++] = names[i];
  memcpy(names, re, count * sizeof *names);
  free(re), free(taken), free(picked);
  pick_free(&t);
}

static void event_pick(run *r) {
  if (!r->pick_n) return;
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"pick\",\"sample\":%u,\"rounds\":%u,\"cut\":%.6f,\"picked\":[", r->pick_sample, PICK_ROUNDS, r->pick_cut);
  for (uint32_t i = 0; i < r->pick_n; i++) {
    fprintf(f, "%s{\"file\":", i ? "," : "");
    json_str(f, r->pick_file[i], 1);
    fprintf(f, ",\"rank\":%u,\"avg\":%.6f,\"distance\":%.6f", r->pick_rank[i], r->pick_avg[i], r->pick_dist[i]);
    if (r->pick_kind[i] >= 0) fprintf(f, ",\"kind\":\"%s\"", style_kind_name(r->pick_kind[i]));
    fputc('}', f);
  }
  fputs("]}\n", f);
}

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

static int optimize(run *r, const char *file) {
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
#define ISLANDS_MAX 256

// --migrate-to, as islands.txt keeps it: from every other island, from one
// other drawn (1 was next, a ring, and 3 tree, removed in #193)
enum { MIGRATE_ALL = 0, MIGRATE_RANDOM = 2 };

typedef struct {
  char dir[1000]; // shorter than a run's, for /island-NN
  uint32_t n, keep, every, selected, next_score;
  uint32_t rounds;     // --score-rounds: of each match of a score
  uint32_t migrate;    // --migrate M: every M batches each island plays the best member of every other one, 0 never
  uint32_t migrate_random, migrate_next; // --migrate-pick random: a member drawn, not the best; --migrate-to (MIGRATE_*)
  uint32_t explorers;  // --explorers K: the last K islands take no migrants (the others may take from them)
  uint64_t seed;
  uint8_t live[ISLANDS_MAX];
  run *is[ISLANDS_MAX];
  run root;            // the root's parameters, the pool, its events; scores with its seed
  warrior *opp;        // every warrior of the folder, for the scores
  uint32_t opp_n;
  double best;         // the best score so far, of the warrior in the root's best.red
} islands;

static void islands_save(const islands *I) {
  char path[1100], tmp[1110];
  snprintf(path, sizeof path, "%s/islands.txt", I->dir);
  snprintf(tmp, sizeof tmp, "%s.tmp", path);
  FILE *f = fopen(tmp, "w");
  if (!f) {
    fprintf(stderr, "42evolve: cannot write %s\n", tmp);
    exit(1);
  }
  fprintf(f, "42evolve-islands 1\nislands %u %u %u %u %u %" PRIu64 " %.17g %u\nlive", I->n, I->keep, I->every, I->selected,
          I->next_score, I->seed, I->best, I->rounds);
  for (uint32_t i = 0; i < I->n; i++) fprintf(f, " %u", I->live[i]);
  fprintf(f, "\nmigrate %u %u %u\nexplorers %u\n", I->migrate, I->migrate_random, I->migrate_next, I->explorers);
  fclose(f);
  if (rename(tmp, path) != 0) {
    fprintf(stderr, "42evolve: cannot write %s\n", path);
    exit(1);
  }
}

static int islands_load(islands *I) {
  char path[1100];
  snprintf(path, sizeof path, "%s/islands.txt", I->dir);
  FILE *f = fopen(path, "r");
  if (!f) return -1;
  int ok = fscanf(f, "42evolve-islands 1 islands %u %u %u %u %u %" SCNu64 " %lg %u live", &I->n, &I->keep, &I->every, &I->selected,
                  &I->next_score, &I->seed, &I->best, &I->rounds) == 8 && I->n >= 1 && I->n <= ISLANDS_MAX && I->rounds;
  for (uint32_t i = 0; ok && i < I->n; i++) {
    unsigned v;
    ok = fscanf(f, "%u", &v) == 1 && v <= 1;
    I->live[i] = (uint8_t)v;
  }
  if (ok && fscanf(f, " migrate %u", &I->migrate) != 1) I->migrate = 0; // a state from before --migrate
  if (ok && fscanf(f, "%u %u", &I->migrate_random, &I->migrate_next) != 2) I->migrate_random = I->migrate_next = 0; // or its picks
  // a state from before #193: --leaf-restart, --nemesis-every and the batch
  // each island started at (a nemesis island's), all 0 unless it used them
  unsigned leaf = 0, nemesis = 0, later = 0;
  if (ok && fscanf(f, "%u", &leaf) != 1) leaf = 0;
  if (ok && fscanf(f, " nemesis %u", &nemesis) != 1) nemesis = 0;
  int since = -1;
  if (ok && fscanf(f, " since%n", &since) >= 0 && since > 0)
    for (uint32_t i = 0; i < I->n; i++) {
      unsigned b = 0;
      if (fscanf(f, "%u", &b) == 1) later |= b;
    }
  if (ok && fscanf(f, " explorers %u", &I->explorers) != 1) I->explorers = 0; // a state from before --explorers
  fclose(f);
  if (!ok) {
    fprintf(stderr, "42evolve: %s is not a state of islands\n", path);
    return -1;
  }
  const char *gone = I->migrate_next == 1 ? "--migrate-to next" : I->migrate_next == 3 ? "--migrate-to tree"
                     : leaf                ? "--leaf-restart"
                     : nemesis || later    ? "--nemesis-every"
                                           : 0;
  if (gone || (I->migrate_next != MIGRATE_ALL && I->migrate_next != MIGRATE_RANDOM)) {
    if (gone) fprintf(stderr, "42evolve: %s: %s was removed after 1.1.0 (#193)\n", I->dir, gone);
    else fprintf(stderr, "42evolve: %s is not a state of islands\n", path);
    return -1;
  }
  return 0;
}

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
