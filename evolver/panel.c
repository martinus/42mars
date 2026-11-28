// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The opponent folder of 42evolve: its warriors that fit the rules, the
// panel and the holdout drawn from them (or picked: --panel-choice picked
// and kinds, with the event pick), and the start warriors (--start).

#include "evolve.h"

static char *xstrdup(const char *s) {
  char *p = xmalloc(strlen(s) + 1);
  strcpy(p, s);
  return p;
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
char **opponent_files(run *r, uint32_t *count) {
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

// --no-spl (#185): a start warrior with SPL (r->starts[k]) is left out, with
// a message, as one that does not fit the rules; 1 when it is.
static int spl_start(const run *r, uint32_t k, const char *path) {
  if (!genome_has_opcode(&r->starts[k], forbidden_opcodes(&r->p))) return 0;
  fprintf(stderr, "42evolve: %s has SPL, not a start warrior of a run with --no-spl\n", path);
  return 1;
}

// --start: the warriors of the folder that fit the rules (with --no-spl
// those without SPL), sorted by file name, as genomes; each starts a family
// of its own.
void load_starts(run *r) {
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
      const uint32_t k = r->start_n;
      genome_from_generator(&r->starts[k], p, r->p.rules.core_size, r->p.rules.max_length);
      free(p);
      if (spl_start(r, k, path)) {
        free(names[i]);
        continue;
      }
      r->start_n++;
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
    const uint32_t k = r->start_n;
    genome_from_code(&r->starts[k], m42_warrior_code(w), wl, m42_warrior_start(w), r->p.rules.core_size);
    if (spl_start(r, k, path)) {
      m42_warrior_free(w);
      free(names[i]);
      continue;
    }
    r->start_n++;
    if (r->p.gen) genome_as_generator(&r->starts[k]);
    m42_warrior_text(w, M42_NAME, r->start_name[k], sizeof r->start_name[k]);
    rng g = rng_seed(r->p.seed, 0x7374617274u, k); // "start"
    r->start_noun[k] = rng_below(&g, NAME_NOUNS);
    r->start_file[k] = names[i];
    m42_warrior_free(w);
  }
  free(names);
  if (!r->start_n) {
    fprintf(stderr, "42evolve: no warrior in %s fits the rules%s\n", r->p.start, r->p.no_spl ? " and has no SPL (--no-spl)" : "");
    exit(1);
  }
}

void load_list(run *r, warrior **list, uint32_t *n, char **names, uint32_t count, int kind, uint64_t first_id) {
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

void pick_play(run *r, char **names, uint32_t count, pick_table *out) {
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
  uint32_t nc = r->p.ladder ? n : kinds ? (n + 1) / 2 : (n + 3) / 4; // --ladder: every warrior of the sample is a candidate
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

void pick_free(pick_table *t) { free(t->pts), free(t->sigma), free(t->avg), free(t->order), free(t->kind); }

// A panel from the round robin into picked (indexes of names), and what the
// event `pick` of r says about it: by kinds the strongest of each kind in
// turn, else (and within a kind) the farthest by SD-score from those picked.
// allowed: the candidates it may take (--island-panels own), 0 all. Returns
// how many it picked.
uint32_t pick_choose(run *r, const pick_table *t, char **names, const uint8_t *allowed, uint32_t *picked) {
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

void pick_panel(run *r, char **names, uint32_t count) {
  const int ladder = r->p.ladder;
  if (ladder && ladder_holdout(r, count) != 0) exit(2);
  pick_table t;
  pick_play(r, names, count, &t);
  uint32_t *picked = xmalloc((t.want ? t.want : 1) * sizeof *picked);
  uint8_t *start = 0; // --ladder: the panel from the weakest third of the candidates
  if (ladder) {
    start = xmalloc(t.n ? t.n : 1);
    ladder_allowed(&t, 0, start);
  }
  const uint32_t np = pick_choose(r, &t, names, start, picked);
  if (ladder) ladder_set(r, &t, names, 0, picked, np);
  // the picked first, then the rest in its order; with --ladder the warriors
  // outside the sample before the rest of the sample (the holdout)
  uint8_t *taken = calloc(t.n, 1);
  for (uint32_t i = 0; i < np; i++) taken[picked[i]] = 1;
  char **re = xmalloc(count * sizeof *re);
  uint32_t k = 0;
  for (uint32_t i = 0; i < np; i++) re[k++] = names[picked[i]];
  if (ladder)
    for (uint32_t i = t.n; i < count; i++) re[k++] = names[i];
  for (uint32_t i = 0; i < (ladder ? t.n : count); i++)
    if (i >= t.n || !taken[i]) re[k++] = names[i];
  memcpy(names, re, count * sizeof *names);
  free(re), free(taken), free(picked), free(start);
  pick_free(&t);
}

// ---------------------------------------------------------------- the ladder (--ladder, #247)

// --ladder: a panel that climbs the hill with the list. A fixed panel of
// strong hill warriors gives a young warrior nothing to win: the best it gets
// is a tie, and the cheapest tie is to be small with many processes. So the
// panel starts weak and gets stronger as the list beats it.
// The candidates are all warriors of the pick's sample that do not die at
// once (--island-panels own: of the island's half, `mine`), in the order of
// their average in its round robin, and the panel is picked by kinds from the
// weakest third of them (at least as many as the panel has): allowed[c] = 1
// for those. Returns how many candidates there are.
uint32_t ladder_allowed(const pick_table *t, const uint8_t *mine, uint8_t *allowed) {
  uint32_t count = 0;
  for (uint32_t c = 0; c < t->n; c++) count += (!mine || mine[c]) && t->kind[c] != KIND_DIES;
  const uint32_t third = count / 3 > t->want ? count / 3 : t->want;
  memset(allowed, 0, t->n);
  for (uint32_t i = t->n, k = 0; i-- > 0 && k < third;) { // t->order: the strongest first
    const uint32_t c = t->order[i];
    if ((mine && !mine[c]) || t->kind[c] == KIND_DIES) continue;
    allowed[c] = 1, k++;
  }
  return count;
}

// --ladder: the holdout is drawn from the warriors outside the pick's sample,
// since every warrior of the sample is a candidate that may come into the
// panel. 0, or 1 after a message when the folder has too few (before the
// round robin of the pick is played).
int ladder_holdout(const run *r, uint32_t count) {
  const uint32_t sample = r->p.pick_sample ? r->p.pick_sample : PICK_SAMPLE, n = count < sample ? count : sample;
  if (count - n >= r->p.holdout) return 0;
  fprintf(stderr, "42evolve: --ladder: %s has %u warriors outside the sample of %u, the holdout needs %u: a smaller --pick-sample or "
                  "--holdout\n", r->p.opponents, count - n, n, r->p.holdout);
  return 1;
}

void ladder_add(run *r, const char *file, int kind, double avg, int used) {
  if (r->ladder_n == r->ladder_cap) {
    r->ladder_cap = r->ladder_cap ? 2 * r->ladder_cap : 256;
    struct rung *g = xmalloc(r->ladder_cap * sizeof *g);
    if (r->ladder_n) memcpy(g, r->ladder, r->ladder_n * sizeof *g);
    free(r->ladder);
    r->ladder = g;
  }
  r->ladder[r->ladder_n++] = (struct rung){xstrdup(file), kind, avg, (uint8_t)(used != 0)};
}

// The ladder of r: those candidates, the weakest first (among equals the
// later one of the sample); used: the picked, its panel.
void ladder_set(run *r, const pick_table *t, char **names, const uint8_t *mine, const uint32_t *picked, uint32_t np) {
  for (uint32_t i = t->n; i-- > 0;) {
    const uint32_t c = t->order[i];
    if ((mine && !mine[c]) || t->kind[c] == KIND_DIES) continue;
    int used = 0;
    for (uint32_t k = 0; k < np; k++) used |= picked[k] == c;
    ladder_add(r, names[c], t->kind[c], t->avg[c], used);
  }
}

static int by_double(const void *a, const void *b) {
  const double x = *(const double *)a, y = *(const double *)b;
  return x < y ? -1 : x > y;
}

// The rung of the panel warrior in slot j, UINT32_MAX none.
static uint32_t rung_of(const run *r, uint32_t j) {
  for (uint32_t k = 0; r->panel[j].file && k < r->ladder_n; k++)
    if (r->ladder[k].used && !strcmp(r->ladder[k].file, r->panel[j].file)) return k;
  return UINT32_MAX;
}

// A step of the ladder, before every --ladder-every-th batch (run_step()). A
// panel warrior is beaten when the median of the members' points per 100
// rounds against it is --ladder-above or more (the upper one of an even
// count). The most beaten first (the lower slot of equals), at most
// LADDER_STEP of them, so that the values of the list do not jump: each is
// replaced by the next stronger candidate of its kind that was never in the
// panel; when its kind has none, by the strongest candidate of any kind that
// was never in, if that one is stronger. One that has no such candidate
// stays, and when none is left nothing changes any more. Everybody in plays
// the new warrior (replace_panel(), event `rotate`). Then the event `ladder`:
// what was replaced, how strong the panel is now (the mean of its warriors'
// averages in the pick), and how many candidates are left. The step reads
// only the run's own list, so a run is the same on any thread count, and
// after a resume: the state before a batch is the one before its step.
#define LADDER_STEP 3
void ladder_climb(run *r) {
  const params *p = &r->p;
  const uint32_t P = r->panel_n, M = members(r);
  double *med = xmalloc((P ? P : 1) * sizeof *med), *col = xmalloc((M ? M : 1) * sizeof *col);
  uint8_t *tried = xmalloc(P ? P : 1);
  uint32_t beaten = 0, changed = 0;
  for (uint32_t j = 0; j < P; j++) {
    for (uint32_t k = 0; k < M; k++) col[k] = r->pts[r->active[P + k] * r->cap + j];
    qsort(col, M, sizeof *col, by_double);
    med[j] = M ? col[M / 2] : -1;
    beaten += med[j] >= p->ladder_above;
  }
  char *text = 0;
  size_t len = 0;
  FILE *log = open_memstream(&text, &len);
  if (!log) {
    fprintf(stderr, "42evolve: out of memory\n");
    exit(1);
  }
  while (changed < LADDER_STEP) {
    uint32_t j = UINT32_MAX;
    for (uint32_t k = 0; k < P; k++)
      if (!tried[k] && med[k] >= p->ladder_above && (j == UINT32_MAX || med[k] > med[j])) j = k;
    if (j == UINT32_MAX) break;
    tried[j] = 1;
    const uint32_t at = rung_of(r, j);
    if (at == UINT32_MAX) continue;
    uint32_t next = UINT32_MAX;
    for (uint32_t k = at + 1; k < r->ladder_n && next == UINT32_MAX; k++)
      if (!r->ladder[k].used && r->ladder[k].kind == r->ladder[at].kind) next = k;
    for (uint32_t k = r->ladder_n; next == UINT32_MAX && k-- > at + 1;) // the top of its kind: the strongest left of any kind
      if (!r->ladder[k].used) next = k;
    if (next == UINT32_MAX) continue;
    warrior *o = load_opponent(r, r->ladder[next].file, 0);
    if (!o) exit(1);
    o->kind = PANEL;
    o->id = r->next_id++;
    fprintf(log, "%s{\"slot\":%u,\"out\":%" PRIu64 ",\"in\":%" PRIu64 ",\"file\":", changed ? "," : "", j, r->panel[j].id, o->id);
    json_str(log, o->file, 1);
    fprintf(log, ",\"kind\":\"%s\",\"avg\":%.6f,\"was\":%.6f,\"median\":%.6f}", style_kind_name(r->ladder[next].kind), r->ladder[next].avg,
            r->ladder[at].avg, med[j]);
    replace_panel(r, j, o); // the run's from here: only the struct is freed
    free(o);
    r->ladder[next].used = 1;
    changed++;
  }
  fclose(log);
  double strength = 0;
  uint32_t on = 0, left = 0;
  for (uint32_t j = 0; j < P; j++) {
    const uint32_t at = rung_of(r, j);
    if (at != UINT32_MAX) strength += r->ladder[at].avg, on++;
  }
  for (uint32_t k = 0; k < r->ladder_n; k++) left += !r->ladder[k].used;
  fprintf(r->events, "{\"type\":\"ladder\",\"batch\":%u,\"above\":%.17g,\"beaten\":%u,\"replaced\":[%s],\"strength\":%.6f,\"left\":%u}\n", r->batch,
          p->ladder_above, beaten, text ? text : "", on ? strength / on : 0, left);
  if (changed) event_values(r); // the values the batch starts from
  free(text), free(med), free(col), free(tried);
}

void event_pick(run *r) {
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
