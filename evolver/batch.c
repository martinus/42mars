// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// One batch of a run of 42evolve (run_batch()): breed the candidates, the
// screen against the panel and some members, the survivors' matches, each
// survivor entering with the push-off after it (with --stage the first
// stage, then the rest of its rounds), the bench, the events of the batch.

#include "evolve.h"

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
  double key;      // what the survivors are picked by: the screen score, with --survivors-by pushoff pushoff_keys()
  double pick[4];  // --survivors-by pushoff: front (0 the first), average against the panel, against the members, SD-score
  double dist;     // the SD-score to the nearest warrior in, from the screen (estimated_distance())
  int out;         // --screen-stop: stopped
  int would_stop;  // --screen-check: --screen-stop would have stopped it
  uint32_t played; // rounds of its screen against each opponent
  uint32_t stop_at; // --screen-stop, --screen-check: the rounds after which it stopped (would have), 0 not
  int reached;     // 0 bred, 1 evaluated (not a repeat), 2 past the screen, 3 still in the list after its batch
  int keep;        // --start: a start warrior in the first batch, which enters whatever its screen
  uint64_t id;
} candidate;

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
// screen), or, when the survivors are the best by screen score (not with
// --survivors-by pushoff), below the p.survivors-th largest lo of the
// children still in: that many others end
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
  if (on > p->survivors && p->survivors > 0 && !p->survivors_by) {
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

// One batch while it runs (run_batch()): its candidates, the screen's
// opponents and results, the survivors and their matches.
typedef struct {
  uint32_t B, P; // candidates, panel warriors
  double t0;     // when it started, and the pool's counters then
  speed s0;
  candidate *c;
  uint32_t evaluated;
  uint32_t ns, Q, *so;   // the screen's opponents: the panel and ns members, Q in all; so[k] the slot of opponent k
  uint64_t *screen_id;   // the ids of the ns members
  uint32_t *screen_at;   // where the row of each candidate's screen results starts in u
  double threshold;      // the survivors' least screen score
  unit *u;               // the screen's matches
  int stepping;          // --screen-stop, --screen-check: the screen in steps
  uint32_t stopped;
  FILE *steps_log;       // --screen-check: each step's decisions, for the event
  char *steps_text;
  size_t steps_len;
  candidate **sv;        // the survivors, sn of them
  uint32_t sn;
  uint32_t M;            // the members before the survivors enter
  int staged;            // --stage: the survivors played the first stage only
  unit *f;               // the survivors' matches, fn the next one to enter
  uint32_t fn;
  uint32_t *slot_of, *member_slots, entered;
} batch;

// breed
static void breed(run *r, batch *b) {
  const params *p = &r->p;
  const uint32_t B = b->B, core = p->rules.core_size;
  candidate *c = b->c;
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
        genome_breed_forbid(&x->g, &r->starts[k], &r->starts[(k + 1) % r->start_n], &g, core, p->rules.max_length,
                            &p->changes, forbidden_opcodes(p), x->ops, sizeof x->ops);
      }
      x->noun = r->start_noun[k];
    } else if (members(r) == 0 || (p->fill && members(r) < p->list && !r->start_n)) {
      const uint32_t len = random_length(p, &g);
      do genome_random(&x->g, &g, core, len); // --no-spl: one with SPL is drawn again, as long
      while (genome_has_opcode(&x->g, forbidden_opcodes(p)));
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
      const warrior *a = select_parent(r, &g, &x->rival), *b2 = select_parent(r, &g, 0);
      genome_breed_forbid(&x->g, a->g, b2->g, &g, core, p->rules.max_length, &p->changes, forbidden_opcodes(p), x->ops,
                          sizeof x->ops);
      x->parents[0] = a->id;
      x->noun = a->noun;
      x->origin = a->origin;
      if (strstr(x->ops, "crossover") && b2->id != a->id) {
        x->parents[1] = b2->id;
        if (b2->origin < x->origin) x->origin = b2->origin; // the older line
      }
    }
    const uint64_t h = genome_hash(&x->g, core);
    x->skip = copy || (!reintro && (seen_has(r, h) || too_short(&x->g, p)));
    if (!x->skip) {
      seen_add(r, h);
      x->w = make_warrior(&x->g, &p->rules);
      x->reached = 1;
      b->evaluated++;
    }
  }
  r->migr_n = 0;
  free(in_list);
}

// the screen's opponents: the panel, and with --screen-members that many
// members (all if fewer), drawn with the batch's seed; so[k] is the slot
// of opponent k
static void screen_opponents(run *r, batch *b) {
  const params *p = &r->p;
  const uint32_t P = b->P;
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
  b->ns = ns, b->Q = Q, b->so = so, b->screen_id = screen_id;
}

// survivors: at least screen_factor of the weakest member's average
// against the screen's opponents (itself left out); known before the
// screen, --screen-stop stops a child that cannot reach it
static double screen_threshold(const run *r, const batch *b) {
  const params *p = &r->p;
  double threshold = -1;
  if (members(r) >= p->list) {
    threshold = INFINITY;
    for (uint32_t i = b->P; i < r->active_n; i++) {
      const uint32_t m = r->active[i];
      double s = 0;
      uint32_t k = 0;
      for (uint32_t j = 0; j < b->Q; j++)
        if (b->so[j] != m) s += r->pts[m * r->cap + b->so[j]], k++;
      const double a = k ? s / k : 0;
      if (a < threshold) threshold = a;
    }
    threshold *= p->screen_factor;
  }
  return threshold;
}

// screen: every candidate against those opponents, the first rounds;
// --screen-stop, --screen-check: the screen in steps of SCREEN_STEP rounds
static void play_screen(run *r, batch *b) {
  const params *p = &r->p;
  const uint32_t B = b->B, Q = b->Q;
  candidate *c = b->c;
  uint32_t *screen_at = xmalloc(B * sizeof *screen_at);
  for (uint32_t i = 0, k = 0; i < B; i++) {
    screen_at[i] = k;
    if (!c[i].skip) k += Q;
  }
  const int stepping = p->screen_stop > 0 || p->screen_check > 0;
  const uint32_t F = p->screen_rounds;
  const uint32_t stage = stepping && SCREEN_STEP < F ? SCREEN_STEP : F;
  unit *u = xmalloc((size_t)B * Q * sizeof *u);
  uint32_t n = 0;
  for (uint32_t i = 0; i < B; i++)
    for (uint32_t j = 0; j < Q && !c[i].skip; j++) {
      const warrior *o = r->slot[b->so[j]];
      u[n++] = (unit){c[i].w, o->w, seed_for(r, o->id), 0, stage, {{0}}, 0, 0};
    }
  pool_run(r->pool, u, n);
  for (uint32_t i = 0; i < B; i++)
    if (!c[i].skip) score_screen(r, &c[i], u + screen_at[i], Q, stage);
  for (uint32_t i = 0; i < B; i++) c[i].played = stage, c[i].stop_at = 0, c[i].would_stop = 0;
  b->screen_at = screen_at, b->u = u, b->stepping = stepping;
  if (stepping) {
    const int check = !(p->screen_stop > 0);
    const double z = check ? p->screen_check : p->screen_stop;
    b->steps_log = check ? open_memstream(&b->steps_text, &b->steps_len) : 0;
    for (uint32_t done = stage; done < F;) {
      b->stopped += screen_decide(r, c, B, u, screen_at, Q, done, z, b->threshold, check, b->steps_log);
      const uint32_t step = F - done < SCREEN_STEP ? F - done : SCREEN_STEP;
      screen_more(r, c, B, b->so, Q, u, screen_at, done, step);
      for (uint32_t i = 0; i < B; i++) {
        if (c[i].skip || c[i].out) continue;
        c[i].played = done + step;
        score_screen(r, &c[i], u + screen_at[i], Q, done + step);
      }
      done += step;
    }
  }
}

// --survivors-by pushoff: the SD-score of a screen row to the nearest
// warrior in, on the panel columns, as estimated_distance() but each
// difference d with the noise of the row's points there taken out,
// sqrt(max(0, d^2 - se^2)) with se their standard error (about d when d is
// large, near 0 for noise alone): a row of 20 rounds looks more different
// than it is (when newcomers entered on their first 20 rounds, 48% stayed
// on that noise for a batch, 15th November 2026).
static double screen_distance(const run *r, const unit *row, uint32_t rounds) {
  double best = INFINITY;
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    double num = 0, den = 0, sum = 0;
    for (uint32_t k = 0; k < r->panel_n; k++) {
      if (k == o) continue;
      const m42_score sc = row[k].s[0];
      const double v = round_variance(sc, rounds, r->p.tie) / rounds, x = points_t(sc, rounds, r->p.tie) - r->pts[o * r->cap + k];
      const double d = x * x > v ? sqrt(x * x - v) : 0;
      if (r->p.sd == SD_SUM) num += d, den += r->sigma[k];
      else if (r->sigma[k] > 0) sum += d / r->sigma[k];
    }
    const double dist = r->p.sd == SD_SUM ? (den > 0 ? num / den : 0) : sum;
    if (dist < best) best = dist;
  }
  return best == INFINITY ? 0 : best;
}

// --survivors-by pushoff: the key of every candidate past the threshold is
// its estimated place in the pareto push-off, the same objectives from its
// screen: its average against the panel, against the members of the screen,
// and (pareto-sd) screen_distance(). The front it would be on is the one
// after the worst front of the members that dominate it, the first when none
// does; on one front the farther from its nearest warrior goes first. So a
// child that plays unlike every member gets in before a stronger one that
// plays like one, as the push-off would decide after its full matches.
static void pushoff_keys(run *r, batch *b) {
  const params *p = &r->p;
  const uint32_t P = r->panel_n, Q = b->Q, n = r->active_n - P, m = p->pareto == 3 ? 3 : 2;
  // r->values: the members' values and the panel columns' standard deviations of the end of the last batch
  double *mo = xmalloc(3 * (n ? n : 1) * sizeof *mo);
  long *level = xmalloc((n ? n : 1) * sizeof *level), top = 0; // floor(value / PARETO_STEP): fronts - front
  for (uint32_t j = 0; j < n; j++) {
    const pushoff_value *v = &r->values[P + j];
    const uint32_t a = v->index;
    double e = 0;
    for (uint32_t q = P; q < r->active_n; q++)
      if (r->active[q] != a) e += r->pts[a * r->cap + r->active[q]];
    mo[3 * j] = panel_avg(r, a), mo[3 * j + 1] = n > 1 ? e / (n - 1) : 0, mo[3 * j + 2] = v->distance;
    level[j] = (long)floor(v->value / PARETO_STEP);
    if (level[j] > top) top = level[j];
  }
  for (uint32_t i = 0; i < b->B; i++) {
    candidate *x = &b->c[i];
    if (x->skip || x->out || x->screen < b->threshold) continue;
    const unit *row = b->u + b->screen_at[i];
    double o[3] = {0, 0, 0};
    for (uint32_t k = 0; k < P; k++) o[0] += points_t(row[k].s[0], x->played, p->tie);
    for (uint32_t k = P; k < Q; k++) o[1] += points_t(row[k].s[0], x->played, p->tie);
    o[0] = P ? o[0] / P : 0, o[1] = Q > P ? o[1] / (Q - P) : 0, o[2] = screen_distance(r, row, x->played);
    long lv = top;
    for (uint32_t j = 0; j < n; j++) {
      int all = 1, one = 0;
      for (uint32_t k = 0; k < m; k++) all &= mo[3 * j + k] >= o[k], one |= mo[3 * j + k] > o[k];
      if (all && one && level[j] - 1 < lv) lv = level[j] - 1;
    }
    x->key = (double)lv * 1e6 + (o[2] < 1e6 - 1 ? o[2] : 1e6 - 1);
    x->pick[0] = (double)(top - lv), x->pick[1] = o[0], x->pick[2] = o[1], x->pick[3] = o[2];
  }
  free(mo), free(level);
}

// The survivors: those at the threshold or above, the best of them by key.
static void choose_survivors(run *r, batch *b) {
  const params *p = &r->p;
  candidate *c = b->c;
  if (p->survivors_by) pushoff_keys(r, b);
  candidate **sv = xmalloc(b->B * sizeof *sv);
  uint32_t sn = 0;
  // --start: every start warrior enters in the first batch (the screen does not stop it), the
  // push-off then cuts the list to --list; the others take the places of the survivors left (a merge of 80 islands
  // kept 13 of them with the cut of 16 survivors, 18th November 2026)
  uint32_t kept = 0;
  for (uint32_t i = 0; i < b->B; i++)
    if (!c[i].skip && !c[i].out && c[i].screen >= b->threshold) sv[sn++] = &c[i], kept += c[i].keep;
  qsort(sv, sn, sizeof *sv, by_keep_key);
  const uint32_t most = kept > p->survivors ? kept : p->survivors;
  if (sn > most) sn = most;
  b->sv = sv, b->sn = sn;
}

// event `screen`: what the steps saved, and with --screen-check what stopping would have changed
static void event_screen(run *r, batch *b) {
  const params *p = &r->p;
  const uint32_t B = b->B, F = p->screen_rounds, Q = b->Q;
  candidate *c = b->c;
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
      if (!c[i].skip && !c[i].out && !c[i].would_stop && c[i].screen >= b->threshold) alt[an++] = &c[i];
    qsort(alt, an, sizeof *alt, by_key);
    if (an > p->survivors) an = p->survivors;
    for (uint32_t k = 0; k < b->sn; k++) {
      uint32_t m = 0;
      while (m < an && alt[m] != b->sv[k]) m++;
      missed += m == an;
    }
    free(alt);
  }
  fprintf(r->events, "{\"type\":\"screen\",\"batch\":%u,\"z\":%.17g,\"check\":%s,\"stopped\":%u,\"rounds\":%" PRIu64
          ",\"full\":%" PRIu64 ",\"missed\":%u",
          r->batch, p->screen_stop > 0 ? p->screen_stop : p->screen_check, p->screen_stop > 0 ? "false" : "true", b->stopped,
          played, full, missed);
  if (b->steps_log) {
    fclose(b->steps_log);
    fprintf(r->events, ",\"steps\":[%s],\"finals\":[", b->steps_text ? b->steps_text : "");
    free(b->steps_text);
    for (uint32_t i = 0, k = 0; i < B; i++) { // the whole screen of each child it would have stopped
      if (!c[i].would_stop) continue;
      fprintf(r->events, "%s[%.17g", k++ ? "," : "", c[i].screen);
      for (uint32_t j = 0; j < Q; j++) {
        const m42_score sc = b->u[b->screen_at[i] + j].s[0];
        fprintf(r->events, ",%u,%u,%u", sc.wins, sc.losses, sc.ties);
      }
      fputc(']', r->events);
    }
    fputc(']', r->events);
  }
  fputs("}\n", r->events);
}

// the rest of the rounds against the panel, all rounds against the members
// (also those of the screen: their screen rounds are the first rounds of
// these) and against the survivors before them; with --stage N only up to
// N rounds (the panel at least its screen rounds), the rest after the batch
// for those still in
static void play_survivors(run *r, batch *b) {
  const params *p = &r->p;
  const uint32_t P = b->P, sn = b->sn;
  candidate **sv = b->sv;
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
  b->M = M, b->staged = staged, b->f = f;
}

// Survivor i enters in slot s: its warrior, and its results against the
// panel (from its row `at` of the screen and the rest), the members and the
// survivors before it.
static warrior *enter(run *r, batch *b, uint32_t i, uint32_t s, uint32_t at) {
  const params *p = &r->p;
  const uint32_t P = b->P, M = b->M;
  const int staged = b->staged;
  const unit *u = b->u, *f = b->f;
  candidate *x = b->sv[i];
  uint32_t fn = b->fn;
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
  b->slot_of[i] = s;
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
      if (b->member_slots[j] != UINT32_MAX) {
        set_result(r, s, b->member_slots[j], f[fn].s[0]);
        if (staged) set_result1(r, s, b->member_slots[j], f[fn].s[0]);
      }
    for (uint32_t j = 0; j < i; j++, fn++)
      if (b->slot_of[j] != UINT32_MAX) {
        set_result(r, s, b->slot_of[j], f[fn].s[0]);
        if (staged) set_result1(r, s, b->slot_of[j], f[fn].s[0]);
      }
  }
  b->fn = fn;
  return w;
}

// the name: its own adjective, the noun of its family, which is its first
// parent's unless it plays very differently from it (NEW_FAMILY); names
// change nothing else
static void name_newcomer(run *r, warrior *w, const candidate *x, uint32_t s) {
  const params *p = &r->p;
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
}

// --parsimony (#172, from RedRace): the newcomer in slot s and a member are
// twins when every game both played with the same seeds ended alike: against
// each panel warrior, and against each member that was in when the member
// entered (it played those with their seeds, as the newcomer does; the
// games of the two against each other do not count). Every match uses the
// seed of its opponent, so the results compare exactly: the same wins,
// losses and ties. Of a newcomer and its twins, the longest twin leaves when
// the newcomer is shorter than it, else the newcomer: returns the slot that
// leaves, and *stays the id of the one that stays; UINT32_MAX for no twin.
// Several twins are rare: two members are no twins of each other, unless
// members left that told them apart when the second one entered.
static uint32_t parsimony_leaves(const run *r, uint32_t s, uint64_t *stays) {
  const uint32_t cap = r->cap;
  uint32_t longest = UINT32_MAX;
  for (uint32_t i = r->panel_n; i < r->active_n; i++) {
    const uint32_t m = r->active[i];
    if (m == s) continue;
    const uint64_t id = r->slot[m]->id;
    int twin = 1;
    for (uint32_t k = 0; k < r->active_n && twin; k++) {
      const uint32_t o = r->active[k];
      if (o == s || o == m || (o >= r->panel_n && (r->p.member_games_none || r->slot[o]->id > id))) continue;
      const m42_score a = r->wlt[s * cap + o], b = r->wlt[m * cap + o];
      twin = a.wins == b.wins && a.losses == b.losses && a.ties == b.ties;
    }
    if (twin && (longest == UINT32_MAX || r->slot[m]->g->len > r->slot[longest]->g->len)) longest = m;
  }
  if (longest == UINT32_MAX) return UINT32_MAX;
  const int newcomer_leaves = r->slot[s]->g->len >= r->slot[longest]->g->len;
  *stays = r->slot[newcomer_leaves ? longest : s]->id;
  return newcomer_leaves ? s : longest;
}

// --replace-parent (deterministic crowding, Mahfoud 1992): when the nearest
// warrior of the newcomer in slot s (by the push-off's SD-score, over
// everyone in) is its first parent, a member, the two duel on their whole
// results: the one with the lower average against the panel leaves, the
// newcomer when they are equal. A child that plays like its parent then
// competes with it alone and takes its place when it is better: the
// distance that kept a lone design in the list goes to its child, where in
// the push-off a near copy took it from both of them, and the copy left
// (94-squid-pv, 26th November 2026: 42 of 878 children of non-papers above
// their parent stayed past their batch). Returns the slot that leaves, and
// *stays the id of the winner; UINT32_MAX for no duel.
static uint32_t parent_duel(run *r, uint32_t s, uint64_t *stays) {
  const warrior *w = r->slot[s];
  if (w->parents[0] == NO_ID) return UINT32_MAX;
  const uint32_t ps = slot_of_id(r, w->parents[0]);
  if (ps == UINT32_MAX || r->slot[ps]->kind != MEMBER || r->keep[ps]) return UINT32_MAX;
  compute_values(r);
  if (r->values[value_of(r, s)].nearest != ps) return UINT32_MAX;
  const int child_wins = panel_avg(r, s) > panel_avg(r, ps);
  *stays = r->slot[child_wins ? s : ps]->id;
  return child_wins ? ps : s;
}

// After survivor i entered in slot s as w: with --replace-parent the duel
// with its first parent, else the push-off when the list is over --list,
// or with --parsimony the longer of two twins; who leaves goes into the
// archive, unless it is w.
static void push_off(run *r, batch *b, uint32_t i, uint32_t s, const warrior *w) {
  const params *p = &r->p;
  // --stage: first the push-off on everyone's first-stage results, the same
  // noise for all; if the newcomer is the weakest there, it leaves without
  // the rest of its rounds. Else it plays them, and the push-off decides on
  // the whole results, so that no newcomer pushes out a member on the noise
  // of its few rounds.
  int early = 0;
  if (b->staged) {
    if (members(r) > p->list) {
      compute_values1(r);
      early = leaves_early(r, s);
    }
    if (!early) complete_one(r, s);
  }
  uint64_t stays = NO_ID, winner = NO_ID;
  const uint32_t duel_out = p->replace_parent && !early ? parent_duel(r, s, &winner) : UINT32_MAX;
  const uint32_t twin_out = p->parsimony && !early && duel_out == UINT32_MAX ? parsimony_leaves(r, s, &stays) : UINT32_MAX;
  if (members(r) > p->list || twin_out != UINT32_MAX || duel_out != UINT32_MAX) {
    if (!early) compute_values(r);
    // an early leave is the newcomer, also when another one is weaker on
    // the first stage (it may be a member that is unlucky in those rounds)
    const int k = early                        ? (int)value_of(r, s)
                  : duel_out != UINT32_MAX ? (int)value_of(r, duel_out)
                  : twin_out != UINT32_MAX ? (int)value_of(r, twin_out)
                                           : pushoff_weakest(r->values, r->active_n, r->keep);
    const uint32_t out = r->values[k].index;
    warrior *gone = r->slot[out];
    event_leave(r, &r->values[k], early, stays, winner);
    if (gone->id == w->id) b->entered--;
    else {
      r->archive[r->archive_next] = *gone->g;
      r->archive_id[r->archive_next] = gone->id;
      r->archive_noun[r->archive_next] = gone->noun;
      r->archive_next = (r->archive_next + 1) % ARCHIVE_MAX;
      if (r->archive_n < ARCHIVE_MAX) r->archive_n++;
    }
    for (uint32_t j = 0; j < b->M; j++)
      if (b->member_slots[j] == out) b->member_slots[j] = UINT32_MAX;
    for (uint32_t j = 0; j <= i; j++)
      if (b->slot_of[j] == out) b->slot_of[j] = UINT32_MAX;
    r->slot[out] = 0;
    free_warrior(gone);
    rebuild_active(r);
  }
}

// enter in order, each followed by the push-off
static void enter_survivors(run *r, batch *b) {
  const uint32_t P = b->P, sn = b->sn, M = b->M;
  b->slot_of = xmalloc((sn ? sn : 1) * sizeof *b->slot_of);
  b->member_slots = xmalloc((M ? M : 1) * sizeof *b->member_slots);
  for (uint32_t j = P; j < r->active_n; j++) b->member_slots[j - P] = r->active[j];
  b->entered = 0;
  b->fn = 0;
  for (uint32_t i = 0; i < sn; i++) {
    candidate *x = b->sv[i];
    const uint32_t s = free_slot(r);
    const uint32_t at = b->screen_at[(uint32_t)(x - b->c)];
    warrior *w = enter(r, b, i, s, at);
    rebuild_active(r);
    measure_style(r, w);
    name_newcomer(r, w, x, s);
    event_enter(r, s, x->screen, x->estimate, x->rival, b->u + at, r->p.survivors_by ? x->pick : 0);
    b->entered++;
    push_off(r, b, i, s, w);
  }
  for (uint32_t i = 0; i < sn; i++)
    if (b->slot_of[i] != UINT32_MAX) b->sv[i]->reached = 3;
  compute_values(r);
  event_values(r);
}

// Every --bench-every batches: the member best against the panel plays the
// holdout, unless it did already.
static void bench_best(run *r) {
  const params *p = &r->p;
  const uint32_t P = r->panel_n;
  if (p->bench_every && r->hold_n && (r->batch + 1) % p->bench_every == 0 && members(r)) {
    uint32_t best = r->active[P];
    for (uint32_t i = P; i < r->active_n; i++)
      if (panel_avg(r, r->active[i]) > panel_avg(r, best)) best = r->active[i];
    if (r->slot[best]->holdout < 0) bench(r, best);
  }
}

// The events batch and speed at the end of a batch.
static void event_batch(run *r, const batch *b) {
  const uint32_t B = b->B;
  const candidate *c = b->c;
  const speed s1 = pool_speed(r->pool);
  const double wall = now() - b->t0;
  const double busy = (s1.busy - b->s0.busy) / (wall * r->pool->threads);
  fprintf(r->events,
          "{\"type\":\"batch\",\"batch\":%u,\"candidates\":%u,\"evaluated\":%u,\"raced\":%u,\"raceDropped\":%.6f,"
          "\"survivors\":%u,\"entered\":%u,\"members\":%u,\"threshold\":%.6f,\"screenMembers\":[",
          r->batch, B, b->evaluated, b->evaluated, -1.0, b->sn, b->entered, members(r), // raced, raceDropped: as without --race (#193)
          b->threshold);
  for (uint32_t k = 0; k < b->ns; k++) fprintf(r->events, "%s%" PRIu64, k ? "," : "", b->screen_id[k]);
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
          r->batch, wall, r->pool->threads, busy, s1.rounds - b->s0.rounds, s1.instructions - b->s0.instructions,
          b->evaluated / wall, (s1.rounds - b->s0.rounds) / wall);
}

static void batch_free(batch *b) {
  for (uint32_t i = 0; i < b->B; i++) free(b->c[i].w);
  free(b->c);
  free(b->u);
  free(b->f);
  free(b->sv);
  free(b->screen_at);
  free(b->so);
  free(b->screen_id);
  free(b->slot_of);
  free(b->member_slots);
}

// One batch of the run: breed, screen, the survivors' matches, each
// survivor entering with the push-off after it, the bench, the events.
void run_batch(run *r) {
  batch b;
  memset(&b, 0, sizeof b);
  b.B = r->p.batch, b.P = r->panel_n;
  b.t0 = now();
  b.s0 = pool_speed(r->pool);
  b.c = xmalloc(b.B * sizeof *b.c);
  breed(r, &b);
  screen_opponents(r, &b);
  b.threshold = screen_threshold(r, &b);
  play_screen(r, &b);
  choose_survivors(r, &b);
  if (b.stepping) event_screen(r, &b);
  for (uint32_t i = 0; i < b.sn; i++) b.sv[i]->id = r->next_id++, b.sv[i]->reached = 2;
  play_survivors(r, &b);
  enter_survivors(r, &b);
  bench_best(r);
  event_parents(r, b.c, b.B);
  event_batch(r, &b);
  batch_free(&b);
  r->batch++;
}
