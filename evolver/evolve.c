// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// 42evolve: evolves Redcode warriors against a panel of hill warriors, with
// a list kept by diversity push-off (#142, docs/evolver.md).
//
//   42evolve <run folder> --opponents <dir> [options]   a new run
//   42evolve <run folder> [--threads N] [--batches N] [--seconds S]
//            [--changes name=weight,...] [--reintroduce p] [--screen-stop z | --screen-check z]
//                                                       continue a run
//
// The run folder gets events.jsonl (what happened, for the dashboard),
// state.txt (to continue) and best.red. The same seed gives the same run on
// any number of threads. Ctrl-C ends the run after the current batch.
//
// POSIX threads; Linux and macOS.

#define _POSIX_C_SOURCE 200809L
#define _DARWIN_C_SOURCE

#include <dirent.h>
#include <errno.h>
#include <inttypes.h>
#include <math.h>
#include <pthread.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#include "42mars.h"
#include "genome.h"
#include "names.h"
#include "pushoff.h"
#include "rng.h"
#include "style.h"

#define ARCHIVE_MAX 256
#define ME_MAX 256 // places of a --map-elites archive: 48 cells, or --list with crowding
#define SEEN_MAX 16384 // hashes of the latest candidates, to skip repeats
#define NO_ID UINT64_MAX

// ---------------------------------------------------------------- parameters

typedef struct {
  m42_rules rules;
  char opponents[1024];
  uint32_t panel, holdout;       // panel warriors (columns of the matrix), holdout warriors (benchmark)
  uint32_t list;                 // evolved warriors kept
  uint32_t batch, survivors;     // candidates per batch; most of them past the screen
  uint32_t rounds, screen_rounds;
  uint32_t bench_every, bench_rounds;
  uint32_t init_length;          // the longest random warrior of the start
  double screen_factor, alpha, reintroduce;
  int sd;
  uint64_t seed;
  int select;      // SELECT_SCREEN: survivors by screen score; SELECT_VALUE: by estimated push-off value
  uint32_t rotate; // every this many batches a new hill warrior replaces the oldest of the panel, 0 never
  double fractions; // probability that a far value is a fraction of the core give or take 20 (genome.h)
  uint32_t race, race_keep; // --race: the first screen rounds for all, the rest for the best race_keep only
  int prior;                // PRIOR_UNIFORM, or PRIOR_HILL: opcodes, modifiers, modes as often as in the opponents
  int parents;              // PARENTS_VALUE: tournament of two by push-off value; PARENTS_DUEL: by their match
  char start[1024];         // --start: a folder of warriors the first batch starts from, "" random ones
  genome_mix changes;       // --changes: how often each kind of change is drawn
  uint32_t screen_members;  // --screen-members: the screen plays the panel and this many members
  double noise;             // --noise z: the push-off's distance counts differences only beyond z standard errors
  uint32_t stage;           // --stage N: survivors play N rounds, those still in after the batch the rest; 0 all at once
  char panel_files[2048];   // --panel-files: the panel, file names in the folder, comma separated; "" drawn
  int fill;                 // --fill: random warriors until the list is full, not only in the first batch
  uint32_t panel_rounds;    // --panel-rounds: rounds of a match against a panel warrior, 0 as --rounds
  int distance_panel;       // --diversity panel: the push-off's SD-score over the panel's columns only
  uint32_t niche;           // --niche N: each kind of style keeps at least N members (not the two kinds of junk)
  int map_elites;           // --map-elites: an archive instead of the list (#147), ME_CELLS or ME_CROWDING
  int panel_random;         // --panel-choice: PANEL_PICKED (pick_panel()), PANEL_RANDOM drawn with the seed, PANEL_KINDS
  int specialists;          // --specialists: the member clearly best against a panel warrior does not leave
  double sharing;           // --sharing c: the push-off's average weights each panel warrior by 1 / (members' mean + c), 0 off
  double screen_stop;       // --screen-stop z: a child stops its screen when z standard errors cannot get it past (0 off)
  double screen_check;      // --screen-check z: plays the whole screen, logs what --screen-stop z would have done
  uint32_t pick_sample;     // --pick-sample: warriors of the round robin of pick_panel(), 0 PICK_SAMPLE
} params;

enum { PARENTS_VALUE, PARENTS_DUEL };

enum { ME_OFF, ME_BY_STYLE, ME_CROWDING }; // --map-elites [cells|crowding]

enum { PANEL_PICKED, PANEL_RANDOM, PANEL_KINDS }; // --panel-choice

enum { PRIOR_UNIFORM, PRIOR_HILL };

enum { SELECT_SCREEN, SELECT_VALUE };

static params default_params(void) {
  params p;
  memset(&p, 0, sizeof p);
  p.rules = m42_rules_94();
  p.panel = 20;   // picked (--panel-choice); the defaults are the best run of E5 (docs/evolver.md, eighth comparison)
  p.holdout = 100;
  p.list = 80;
  p.batch = 0; // 4 per thread
  p.survivors = 0; // batch / 8
  p.rounds = 100;
  p.screen_rounds = 20;
  p.bench_every = 10;
  p.bench_rounds = 100;
  p.init_length = 10;
  p.screen_factor = 0.8;
  p.alpha = 1;
  p.reintroduce = 0.02;
  p.sd = SD_OPPONENT;
  p.seed = 1;
  p.changes = genome_mix_default();
  return p;
}

// ---------------------------------------------------------------- warriors

enum { PANEL, HOLDOUT, MEMBER };

typedef struct {
  uint64_t id;
  int kind;
  char name[64], author[64];
  char *file, *source; // panel and holdout: file name and source text
  m42_warrior *w;
  genome *g; // members
  uint64_t parents[2];
  uint32_t born;
  uint32_t adjective, noun, earlier; // the name (evolver/names.h)
  double parent_difference; // members: row_difference() to the first parent when it entered, -1 if that was not in
  int new_family;           // members: it plays so unlike its first parent that it got a noun of its own
  int style_kind;           // members: its style (style.h), -1 not measured (a state from before)
  style st;                 // members: the numbers behind it, when it entered
  double holdout; // members: average against the holdout warriors, -1 not measured
  char ops[128]; // the names of the changes, space separated: 6 of at most 17 characters
} warrior;

static void *xmalloc(size_t n) {
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

// ---------------------------------------------------------------- thread pool

// One match: two warriors, a block of rounds, the result.
typedef struct {
  const m42_warrior *w0, *w1;
  int64_t seed;
  uint32_t first, rounds;
  m42_score s[2];
  uint64_t instructions;
  int status;
} unit;

typedef struct pool pool;

typedef struct {
  pool *p;
  m42_ctx *m;
  pthread_t t;
  double busy; // seconds spent in matches
  uint64_t instructions, rounds;
} worker;

struct pool {
  pthread_mutex_t mutex;
  pthread_cond_t work, done;
  unit *units;
  uint32_t n, next, finished;
  int quit;
  uint32_t threads;
  worker *w;
};

static double now(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec + ts.tv_nsec * 1e-9;
}

static void play(worker *w, unit *u) {
  const double t0 = now();
  m42_match_options o = m42_match_options_default();
  o.rounds = u->rounds;
  o.first_round = u->first;
  o.seed = u->seed;
  const m42_warrior *ws[2] = {u->w0, u->w1};
  u->instructions = 0;
  u->status = u->rounds ? m42_match(w->m, ws, 2, &o, u->s, &u->instructions) : M42_OK;
  if (!u->rounds) memset(u->s, 0, sizeof u->s);
  w->busy += now() - t0;
  w->instructions += u->instructions;
  w->rounds += u->rounds;
}

// Takes units until none is left. Called with the mutex held, returns with it held.
static void take_units(pool *p, worker *w) {
  while (p->next < p->n) {
    unit *u = &p->units[p->next++];
    pthread_mutex_unlock(&p->mutex);
    play(w, u);
    pthread_mutex_lock(&p->mutex);
    if (++p->finished == p->n) pthread_cond_broadcast(&p->done);
  }
}

static void *worker_main(void *arg) {
  worker *w = arg;
  pool *p = w->p;
  pthread_mutex_lock(&p->mutex);
  while (!p->quit) {
    if (p->next < p->n) take_units(p, w);
    else pthread_cond_wait(&p->work, &p->mutex);
  }
  pthread_mutex_unlock(&p->mutex);
  return 0;
}

static void pool_start(pool *p, uint32_t threads, const m42_rules *rules) {
  memset(p, 0, sizeof *p);
  pthread_mutex_init(&p->mutex, 0);
  pthread_cond_init(&p->work, 0);
  pthread_cond_init(&p->done, 0);
  p->threads = threads;
  p->w = xmalloc(threads * sizeof *p->w);
  for (uint32_t i = 0; i < threads; i++) {
    int status;
    p->w[i].p = p;
    p->w[i].m = m42_new(rules, &status);
    if (!p->w[i].m) {
      fprintf(stderr, "42evolve: %s\n", m42_status_text(status));
      exit(1);
    }
    // worker 0 is the main thread, it takes units in pool_run()
    if (i && pthread_create(&p->w[i].t, 0, worker_main, &p->w[i]) != 0) {
      fprintf(stderr, "42evolve: cannot start a thread\n");
      exit(1);
    }
  }
}

static void pool_stop(pool *p) {
  pthread_mutex_lock(&p->mutex);
  p->quit = 1;
  pthread_cond_broadcast(&p->work);
  pthread_mutex_unlock(&p->mutex);
  for (uint32_t i = 1; i < p->threads; i++) pthread_join(p->w[i].t, 0);
  for (uint32_t i = 0; i < p->threads; i++) m42_free(p->w[i].m);
  free(p->w);
}

// Plays all units on all threads, the calling one included.
static void pool_run_blocks(pool *p, unit *units, uint32_t n);

// A match of more rounds than BLOCK is played as blocks of at most BLOCK
// rounds (the same results: no warrior here uses p-space), so that the
// threads end a step together (--panel-rounds 500 made units 5 times longer).
#define BLOCK 100

static void pool_run(pool *p, unit *units, uint32_t n) {
  uint32_t m = 0;
  for (uint32_t i = 0; i < n; i++) m += units[i].rounds > BLOCK ? (units[i].rounds + BLOCK - 1) / BLOCK : 1;
  if (m == n) {
    pool_run_blocks(p, units, n);
    return;
  }
  unit *b = malloc(m * sizeof *b);
  if (!b) exit(1);
  uint32_t k = 0;
  for (uint32_t i = 0; i < n; i++) {
    uint32_t done = 0;
    do {
      const uint32_t r = units[i].rounds - done < BLOCK ? units[i].rounds - done : BLOCK;
      b[k] = units[i];
      b[k].first = units[i].first + done;
      b[k++].rounds = r;
      done += r;
    } while (done < units[i].rounds);
  }
  pool_run_blocks(p, b, m);
  k = 0;
  for (uint32_t i = 0; i < n; i++) {
    unit *u = &units[i];
    memset(u->s, 0, sizeof u->s);
    u->instructions = 0;
    uint32_t done = 0;
    do {
      for (int w = 0; w < 2; w++)
        u->s[w] = (m42_score){u->s[w].wins + b[k].s[w].wins, u->s[w].losses + b[k].s[w].losses, u->s[w].ties + b[k].s[w].ties};
      u->instructions += b[k].instructions;
      done += b[k++].rounds;
    } while (done < u->rounds);
    u->status = M42_OK;
  }
  free(b);
}

static void pool_run_blocks(pool *p, unit *units, uint32_t n) {
  if (!n) return;
  pthread_mutex_lock(&p->mutex);
  p->units = units;
  p->n = n;
  p->next = p->finished = 0;
  pthread_cond_broadcast(&p->work);
  take_units(p, &p->w[0]);
  while (p->finished < p->n) pthread_cond_wait(&p->done, &p->mutex);
  p->n = p->next = p->finished = 0;
  pthread_mutex_unlock(&p->mutex);
  for (uint32_t i = 0; i < n; i++) {
    if (units[i].status != M42_OK) {
      fprintf(stderr, "42evolve: match failed: %s\n", m42_status_text(units[i].status));
      exit(1);
    }
  }
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

// ---------------------------------------------------------------- the run

typedef struct {
  params p;
  char dir[1024];
  pool pool;
  FILE *events;

  warrior *panel, *hold; // p.panel and p.holdout of them (fewer if the folder has fewer)
  uint32_t panel_n, hold_n;
  char **reserve; // the other warriors of the folder, for --rotate, in the order they come
  uint32_t reserve_n, reserve_next, rotate_next;
  genome_style style; // how new instructions are drawn (--fractions, --prior)
  genome *starts;     // --start: the warriors of the folder as genomes
  uint32_t start_n, *start_noun;
  char (*start_name)[64], **start_file;

  // The matrix: slots 0 .. panel_n-1 are the panel, the others hold members
  // and entering candidates. wlt[a * cap + b]: a's results against b.
  uint32_t cap;
  warrior **slot;     // 0: free
  m42_score *wlt;
  double *pts;        // points per 100 rounds, from wlt
  double *se;         // their standard errors (pushoff_se()), for --noise
  // --panel-choice picked: what pick_panel() found, for the event `pick`
  uint32_t pick_sample, pick_n;
  double pick_cut, pick_avg[256], pick_dist[256];
  uint32_t pick_rank[256];
  int pick_kind[256]; // --panel-choice kinds: the kind of style of each pick, -1 not measured
  char *pick_file[256];
  int pool_up;

  // the style of newcomers (style.h): its own engine with a watch
  m42_ctx *sm;
  void *swatch_mem;
  const m42_watch *swatch;

  // --stage: the results of the first stage rounds of every pair, the same
  // way, so that a newcomer with only those is compared with the others at
  // the same noise
  m42_score *wlt1;
  double *pts1, *se1;
  uint8_t *keep;      // panel slots never leave
  uint32_t *spec, spec_n; // --specialists: the protected members at the start of the batch, for the parents
  double *share_w, share_mw; // --sharing: the weight of each panel slot, and of a member's column (share_weights())
  double *sigma;
  pushoff_value *values;
  uint32_t *active, active_n;

  uint32_t batch;
  uint64_t next_id;
  double best_holdout;
  uint64_t best_id;

  genome archive[ARCHIVE_MAX];
  uint64_t archive_id[ARCHIVE_MAX];
  uint32_t archive_noun[ARCHIVE_MAX];
  uint32_t names[NAME_ADJECTIVES * NAME_NOUNS]; // warriors that got each name so far
  uint32_t archive_n, archive_next;
  uint64_t seen[SEEN_MAX];
  uint32_t seen_n, seen_next;

  // --map-elites: per cell (--map-elites crowding: per place of the archive)
  // its warrior (0 empty), its average against the panel over all its rounds
  // and over the first screen rounds
  warrior *me[ME_MAX];
  double me_avg[ME_MAX], me_screen[ME_MAX];
  m42_score *me_row[ME_MAX]; // its results against each panel warrior, all panel rounds
} run;

static volatile sig_atomic_t stop_now = 0;
static void on_signal(int sig) {
  stop_now = 1;
  signal(sig, SIG_DFL); // a second Ctrl-C ends it at once
}

static int64_t seed_for(const run *r, uint64_t id) {
  const m42_rules *ru = &r->p.rules;
  const uint64_t range = ru->core_size - 2 * ru->min_distance + 1;
  return (int64_t)(rng_mix(r->p.seed * 0x9e3779b97f4a7c15u ^ rng_mix(id + 1)) % range);
}

static double points(m42_score s, uint32_t rounds) { return (3.0 * s.wins + s.ties) * 100.0 / rounds; }

// Points per 100 rounds over the rounds the result has (--stage: fewer than
// p.rounds until a survivor that stays plays the rest).
static double points_of(m42_score s) {
  const uint32_t n = s.wins + s.losses + s.ties;
  return n ? points(s, n) : 0;
}

static void set_result(run *r, uint32_t a, uint32_t b, m42_score sa) {
  const uint32_t c = r->cap;
  m42_score sb = {sa.losses, sa.wins, sa.ties};
  r->wlt[a * c + b] = sa;
  r->wlt[b * c + a] = sb;
  r->pts[a * c + b] = points_of(sa);
  r->pts[b * c + a] = points_of(sb);
  r->se[a * c + b] = pushoff_se(sa.wins, sa.ties, sa.wins + sa.losses + sa.ties);
  r->se[b * c + a] = pushoff_se(sb.wins, sb.ties, sb.wins + sb.losses + sb.ties);
}

// The same for the results of the first stage (--stage).
static void set_result1(run *r, uint32_t a, uint32_t b, m42_score sa) {
  const uint32_t c = r->cap;
  m42_score sb = {sa.losses, sa.wins, sa.ties};
  r->wlt1[a * c + b] = sa;
  r->wlt1[b * c + a] = sb;
  r->pts1[a * c + b] = points_of(sa);
  r->pts1[b * c + a] = points_of(sb);
  r->se1[a * c + b] = pushoff_se(sa.wins, sa.ties, sa.wins + sa.losses + sa.ties);
  r->se1[b * c + a] = pushoff_se(sb.wins, sb.ties, sb.wins + sb.losses + sb.ties);
}

// The rounds of a whole match against a panel warrior (--panel-rounds), and
// against the warrior in slot o.
static uint32_t panel_rounds(const params *p) { return p->panel_rounds ? p->panel_rounds : p->rounds; }

// The rounds of the first stage of a match, p.rounds without --stage.
// The places of the --map-elites archive: 48 cells, or --list for crowding.
static int me_slots(const run *r) { return r->p.map_elites == ME_CROWDING ? (int)r->p.list : 48; }

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

// --sharing c (competitive fitness sharing): a win against a panel warrior
// that most members lose to counts more than one against a panel warrior
// that most members beat. The average of the push-off value becomes a
// weighted one: panel warrior j weighs 1 / (m_j + c), m_j the members' mean
// score against it (points per 100 rounds); a member's column weighs the
// mean of the panel's weights. c bounds the weights: with c 50 the hardest
// panel warrior weighs at most about 4 times the easiest. The weights come
// from the list at the end of a batch and hold for the next one, so that a
// newcomer does not change everyone's value (share_weights()); the distance
// is unchanged. In an hour of the defaults with a panel of every kind
// (kd1, 15th November 2026) 58 to 73 of 80 members lost to each of the
// panel's papers and imps.
static void share_weights(run *r) {
  const uint32_t c = r->cap;
  double sum = 0;
  uint32_t np = 0;
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    if (!r->keep[o]) continue;
    double m = 0;
    uint32_t n = 0;
    for (uint32_t j = 0; j < r->active_n; j++) {
      const uint32_t a = r->active[j];
      if (!r->keep[a]) m += r->pts[a * c + o], n++;
    }
    r->share_w[o] = 1 / ((n ? m / n : 0) + r->p.sharing);
    sum += r->share_w[o], np++;
  }
  r->share_mw = np ? sum / np : 1;
}

// The values with the weighted average (--sharing), on the scores pts.
static void share_values(run *r, const double *pts) {
  if (!(r->p.sharing > 0)) return;
  for (uint32_t i = 0; i < r->active_n; i++) {
    pushoff_value *v = &r->values[i];
    const uint32_t a = v->index;
    double num = 0, den = 0;
    for (uint32_t j = 0; j < r->active_n; j++) {
      const uint32_t b = r->active[j];
      if (b == a) continue;
      const double w = r->keep[b] ? r->share_w[b] : r->share_mw;
      num += w * pts[a * r->cap + b], den += w;
    }
    v->avg = den > 0 ? num / den : 0;
    v->value = v->avg * (r->p.alpha == 1 ? v->distance : pow(v->distance, r->p.alpha));
  }
}

static void compute_values(run *r) {
  pushoff_values(r->pts, r->cap, r->active, r->active_n, r->p.sd, r->p.alpha, r->p.noise > 0 ? r->se : 0, r->p.noise,
                 r->p.distance_panel ? r->keep : 0, r->sigma, r->values);
  share_values(r, r->pts);
}

// The same on the results of the first stage (--stage).
static void compute_values1(run *r) {
  pushoff_values(r->pts1, r->cap, r->active, r->active_n, r->p.sd, r->p.alpha, r->p.noise > 0 ? r->se1 : 0, r->p.noise,
                 r->p.distance_panel ? r->keep : 0, r->sigma, r->values);
  share_values(r, r->pts1);
}

// A warrior's average against the panel, points per 100 rounds; a panel
// warrior's own column does not count.
static double panel_avg(const run *r, uint32_t slot) {
  double s = 0;
  uint32_t n = 0;
  for (uint32_t j = 0; j < r->panel_n; j++)
    if (j != slot) s += r->pts[slot * r->cap + j], n++;
  return n ? s / n : 0;
}

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
static char **red_files(const char *dir, uint32_t *count) {
  DIR *d = opendir(dir);
  if (!d) {
    fprintf(stderr, "42evolve: cannot open %s\n", dir);
    exit(1);
  }
  uint32_t n = 0, cap = 256;
  char **names = xmalloc(cap * sizeof *names);
  for (struct dirent *e; (e = readdir(d));) {
    const size_t len = strlen(e->d_name);
    if (len < 5 || strcmp(e->d_name + len - 4, ".red") != 0) continue;
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
  char **names = red_files(r->p.opponents, &n);
  uint32_t k = 0;
  for (uint32_t i = 0; i < n; i++) {
    warrior *w = load_opponent(r, names[i], 1);
    if (w) names[k++] = names[i];
    else free(names[i]);
    free_warrior(w);
  }
  rng g = rng_seed(r->p.seed, 0x70616e656cu, 0); // "panel"
  for (uint32_t i = k; i > 1; i--) {
    const uint32_t j = rng_below(&g, i);
    char *t = names[i - 1];
    names[i - 1] = names[j];
    names[j] = t;
  }
  // --panel-files: those first, in their order; the rest stays shuffled
  if (r->p.panel_files[0]) {
    uint32_t front = 0;
    for (const char *q = r->p.panel_files; *q;) {
      const char *e = strchr(q, ',');
      const size_t len = e ? (size_t)(e - q) : strlen(q);
      uint32_t i = front;
      while (i < k && !(strlen(names[i]) == len && !strncmp(names[i], q, len))) i++;
      if (i == k) {
        fprintf(stderr, "42evolve: --panel-files: %.*s is not a warrior of %s that fits the rules (or named twice)\n",
                (int)len, q, r->p.opponents);
        exit(2);
      }
      char *t = names[front];
      names[front++] = names[i];
      names[i] = t;
      q += len + (e ? 1 : 0);
    }
    r->p.panel = front;
  }
  *count = k;
  return names;
}

// --start: the warriors of the folder that fit the rules, sorted by file
// name, as genomes; each starts a family of its own.
static void load_starts(run *r) {
  if (!r->p.start[0]) return;
  uint32_t n;
  char **names = red_files(r->p.start, &n);
  r->starts = xmalloc((n ? n : 1) * sizeof *r->starts);
  r->start_noun = xmalloc((n ? n : 1) * sizeof *r->start_noun);
  r->start_name = xmalloc((n ? n : 1) * sizeof *r->start_name);
  r->start_file = xmalloc((n ? n : 1) * sizeof *r->start_file);
  for (uint32_t i = 0; i < n; i++) {
    char path[2100];
    snprintf(path, sizeof path, "%s/%s", r->p.start, names[i]);
    size_t len;
    char *src = read_file(path, &len);
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

static void write_code(FILE *f, const genome *g, uint32_t core) {
  char text[GENOME_MAX * 48 + 64];
  genome_text(g, core, text, sizeof text);
  json_str(f, text, 0);
}

static void event_start(run *r) {
  FILE *f = r->events;
  const params *p = &r->p;
  fprintf(f,
          "{\"type\":\"start\",\"version\":\"%s\",\"rules\":{\"size\":%u,\"cycles\":%u,\"processes\":%u,\"length\":%u,"
          "\"distance\":%u},\"params\":{\"panel\":%u,\"holdout\":%u,\"list\":%u,\"batch\":%u,\"survivors\":%u,"
          "\"rounds\":%u,\"screenRounds\":%u,\"benchEvery\":%u,\"benchRounds\":%u,\"initLength\":%u,"
          "\"screenFactor\":%.17g,\"alpha\":%.17g,\"reintroduce\":%.17g,\"sd\":\"%s\",\"seed\":%" PRIu64
          ",\"select\":\"%s\",\"rotate\":%u,\"fractions\":%.17g,\"race\":%u,\"raceKeep\":%u,\"prior\":\"%s\","
          "\"parents\":\"%s\",\"screenMembers\":%u,\"noise\":%.17g,\"stage\":%u,\"fill\":%s,\"panelRounds\":%u,\"diversity\":\"%s\",\"niche\":%u,\"panelChoice\":\"%s\",\"mapElites\":%s,\"crowding\":%s,\"specialists\":%s,\"sharing\":%.17g,\"screenStop\":%.17g,\"screenCheck\":%.17g},"
          "\"opponents\":",
          m42_version(), p->rules.core_size, p->rules.max_cycles, p->rules.max_processes, p->rules.max_length,
          p->rules.min_distance, r->panel_n, r->hold_n, p->list, p->batch, p->survivors, p->rounds, p->screen_rounds,
          p->bench_every, p->bench_rounds, p->init_length, p->screen_factor, p->alpha, p->reintroduce,
          p->sd == SD_SUM ? "sum" : "opponent", p->seed, p->select == SELECT_VALUE ? "value" : "screen", p->rotate,
          p->fractions, p->race, p->race_keep, p->prior == PRIOR_HILL ? "hill" : "uniform",
          p->parents == PARENTS_DUEL ? "duel" : "value", p->screen_members, p->noise, p->stage,
          p->fill ? "true" : "false", panel_rounds(p), p->distance_panel ? "panel" : "all", p->niche,
          p->panel_files[0]                 ? "files"
          : p->panel_random == PANEL_RANDOM ? "random"
          : p->panel_random == PANEL_KINDS  ? "kinds"
                                            : "picked",
          p->map_elites ? "true" : "false", p->map_elites == ME_CROWDING ? "true" : "false",
          p->specialists ? "true" : "false", p->sharing, p->screen_stop, p->screen_check);
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
  fputs("],\"weights\":{", f);
  const struct {
    const char *name;
    const uint32_t *w;
    uint32_t n;
  } tables[] = {{"op", r->style.op, GENOME_OPCODES}, {"mod", r->style.mod, 7}, {"mode", r->style.mode, 8}};
  for (int t = 0; t < 3; t++) {
    fprintf(f, "%s\"%s\":[", t ? "," : "", tables[t].name);
    for (uint32_t i = 0; i < tables[t].n; i++) fprintf(f, "%s%u", i ? "," : "", tables[t].w[i]);
    fputc(']', f);
  }
  fputs("},\"changes\":{", f);
  for (int k = 0; k < CH_COUNT; k++) fprintf(f, "%s\"%s\":%u", k ? "," : "", genome_change_name(k), p->changes.w[k]);
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
static void event_enter(run *r, uint32_t slot, double screen, double estimate, double race_key, uint64_t rival,
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
  for (uint32_t k = 0; k < r->panel_n; k++) fprintf(f, "%s%.4f", k ? "," : "", points(row[k].s[0], r->p.screen_rounds));
  fprintf(f, "],\"style\":{\"kind\":\"%s\",\"copies\":%.6f,\"moved\":%.6f,\"written\":%.6f,\"whole\":%.6f,\"read\":%.6f,"
          "\"tasks\":%.6f,\"alive\":%.6f,\"measured\":%.6f}",
          style_kind_name(w->style_kind), w->st.copies, w->st.moved, w->st.written, w->st.whole, w->st.read, w->st.tasks,
          w->st.alive, w->st.measured);
  fprintf(f, ",\"raceKey\":%.6f,\"rival\":%" PRId64 ",\"parentDifference\":%.6f,\"newFamily\":%s,\"code\":",
          race_key, rival == NO_ID ? (int64_t)-1 : (int64_t)rival, w->parent_difference, w->new_family ? "true" : "false");
  write_code(f, w->g, r->p.rules.core_size);
  fputs(",\"scores\":[", f);
  int first = 1;
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    if (o == slot) continue;
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

// --sharing, after a batch: the weights of the next batch, [panel id,
// weight, members' mean], and the weight of a member's column.
static void event_sharing(run *r) {
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"sharing\",\"batch\":%u,\"weights\":[", r->batch);
  for (uint32_t i = 0, n = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    if (!r->keep[o]) continue;
    fprintf(f, "%s[%" PRIu64 ",%.17g,%.6f]", n++ ? "," : "", r->slot[o]->id, r->share_w[o], 1 / r->share_w[o] - r->p.sharing);
  }
  fprintf(f, "],\"member\":%.17g}\n", r->share_mw);
}

// --specialists, after a batch: for each panel warrior with a protected
// member [panel id, member id, its score there, its standard error, the
// members' median].
static uint32_t specialists(const run *r, uint32_t *out, double *med);
static void event_specialists(run *r) {
  uint32_t *sp = xmalloc((r->active_n + 1) * sizeof *sp);
  double *med = xmalloc((r->active_n + 1) * sizeof *med);
  const uint32_t np = specialists(r, sp, med);
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"specialists\",\"batch\":%u,\"protected\":[", r->batch);
  for (uint32_t k = 0, i = 0, n = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    if (r->slot[o]->kind != PANEL) continue;
    const uint32_t m = sp[k];
    if (m != UINT32_MAX)
      fprintf(f, "%s[%" PRIu64 ",%" PRIu64 ",%.6f,%.6f,%.6f]", n++ ? "," : "", r->slot[o]->id, r->slot[m]->id,
              r->pts[m * r->cap + o], r->se[m * r->cap + o], med[k]);
    k++;
  }
  fputs("]}\n", f);
  free(sp), free(med);
  (void)np;
}

// ---------------------------------------------------------------- state

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
  fprintf(f, "params %u %u %u %u %u %u %u %u %u %u %.17g %.17g %.17g %d %" PRIu64 " %d %u %.17g %u %u %d %d %u %.17g %u %d %u %d %u %d %d %.17g %.17g %.17g\n",
          p->panel, p->holdout, p->list, p->batch, p->survivors, p->rounds, p->screen_rounds, p->bench_every,
          p->bench_rounds, p->init_length, p->screen_factor, p->alpha, p->reintroduce, p->sd, p->seed, p->select,
          p->rotate, p->fractions, p->race, p->race_keep, p->prior, p->parents, p->screen_members, p->noise, p->stage, p->fill,
          p->panel_rounds, p->distance_panel, p->niche, p->map_elites, p->specialists, p->sharing, p->screen_stop, p->screen_check);
  fprintf(f, "opponents %s\n", p->opponents);
  if (p->start[0]) fprintf(f, "start-dir %s\n", p->start);
  char mix[CH_COUNT * 32];
  genome_mix_text(&p->changes, mix, sizeof mix);
  fprintf(f, "changes %s\n", mix);
  for (uint32_t i = 0; i < r->panel_n; i++) fprintf(f, "panel-id %" PRIu64 " %s\n", r->panel[i].id, r->panel[i].file);
  for (uint32_t i = 0; i < r->hold_n; i++) fprintf(f, "holdout %s\n", r->hold[i].file);
  for (uint32_t i = 0; i < r->reserve_n; i++) fprintf(f, "reserve %s\n", r->reserve[i]);
  fprintf(f, "reserve-next %u\nrotate-next %u\n", r->reserve_next, r->rotate_next);
  fprintf(f, "batch %u\nnext %" PRIu64 "\nbest %" PRIu64 " %.17g\nevents %ld\n", r->batch, r->next_id, r->best_id,
          r->best_holdout, events_size);
  char text[GENOME_MAX * 40 + 64];
  // the members' slots: a later newcomer takes the lowest free one, so a
  // resumed run needs the holes where they were
  for (uint32_t i = 0; i < r->active_n; i++)
    if (r->slot[r->active[i]]->kind == MEMBER) fprintf(f, "slot %" PRIu64 " %u\n", r->slot[r->active[i]]->id, r->active[i]);
  for (uint32_t i = 0; i < r->active_n; i++) {
    const warrior *w = r->slot[r->active[i]];
    if (w->kind != MEMBER) continue;
    genome_save(w->g, text, sizeof text);
    fprintf(f, "member %" PRIu64 " %u %" PRIu64 " %" PRIu64 " %.17g %u %u %u %s\nops %s\nkind %d\n", w->id, w->born,
            w->parents[0], w->parents[1], w->holdout, w->adjective, w->noun, w->earlier, text, w->ops, w->style_kind);
  }
  for (uint32_t i = 0; i < r->archive_n; i++) {
    genome_save(&r->archive[i], text, sizeof text);
    fprintf(f, "archive %" PRIu64 " %u %s\n", r->archive_id[i], r->archive_noun[i], text);
  }
  fprintf(f, "archive-next %u\n", r->archive_next);
  for (int c = 0; c < me_slots(r); c++) { // --map-elites
    const warrior *w = r->me[c];
    if (!w) continue;
    genome_save(w->g, text, sizeof text);
    fprintf(f, "elite %d %" PRIu64 " %u %" PRIu64 " %" PRIu64 " %.17g %u %u %u %.17g %.17g %d %d %s\nops %s\n", c, w->id,
            w->born, w->parents[0], w->parents[1], w->holdout, w->adjective, w->noun, w->earlier, r->me_avg[c],
            r->me_screen[c], w->style_kind, w->new_family, text, w->ops);
    fprintf(f, "elite-row %d", c);
    for (uint32_t j = 0; j < r->panel_n; j++)
      fprintf(f, " %u %u %u", r->me_row[c][j].wins, r->me_row[c][j].losses, r->me_row[c][j].ties);
    fputc('\n', f);
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
  r->se = xmalloc(c * c * sizeof *r->se);
  r->wlt1 = xmalloc(c * c * sizeof *r->wlt1);
  r->pts1 = xmalloc(c * c * sizeof *r->pts1);
  r->se1 = xmalloc(c * c * sizeof *r->se1);
  r->keep = xmalloc(c);
  r->spec = xmalloc(c * sizeof *r->spec);
  r->spec_n = 0;
  r->share_w = xmalloc(c * sizeof *r->share_w);
  for (size_t i = 0; i < c; i++) r->share_w[i] = 1;
  r->share_mw = 1;
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

static int load_state(run *r, const char *path) {
  size_t len;
  char *text = read_file(path, &len);
  if (!text) return -1;
  char **panel = xmalloc(len * sizeof *panel / 8 + 8), **hold = xmalloc(len * sizeof *hold / 8 + 8);
  uint64_t *panel_id = xmalloc(len * sizeof *panel_id / 8 + 8);
  uint32_t pn = 0, hn = 0;
  r->reserve = xmalloc(len * sizeof *r->reserve / 6 + 8);
  params *p = &r->p;
  char *save = 0, **rest = xmalloc(len * sizeof(char *) / 4 + 8);
  uint32_t rn = 0;
  int ok = 0;
  // the lines that need the matrix come after the opponents are loaded
  char *line = strtok_r(text, "\n", &save);
  if (!line || strcmp(line, "42evolve-state 1") != 0) goto bad;
  for (line = strtok_r(0, "\n", &save); line; line = strtok_r(0, "\n", &save)) {
    if (!strncmp(line, "rules ", 6)) {
      if (sscanf(line + 6, "%u %u %u %u %u", &p->rules.core_size, &p->rules.max_cycles, &p->rules.max_processes,
                 &p->rules.max_length, &p->rules.min_distance) != 5)
        goto bad;
    } else if (!strncmp(line, "params ", 7)) {
      // the last ones came with --select and --rotate, --fractions, --race and
      // --race-keep, --prior, --parents, --screen-members, --noise, --stage,
      // --fill; a state without them has none of them
      const int got = sscanf(line + 7,
                             "%u %u %u %u %u %u %u %u %u %u %lg %lg %lg %d %" SCNu64 " %d %u %lg %u %u %d %d %u %lg %u %d %u %d %u %d %d %lg %lg %lg",
                             &p->panel, &p->holdout, &p->list, &p->batch, &p->survivors, &p->rounds, &p->screen_rounds,
                             &p->bench_every, &p->bench_rounds, &p->init_length, &p->screen_factor, &p->alpha,
                             &p->reintroduce, &p->sd, &p->seed, &p->select, &p->rotate, &p->fractions, &p->race,
                             &p->race_keep, &p->prior, &p->parents, &p->screen_members, &p->noise, &p->stage, &p->fill, &p->panel_rounds,
                             &p->distance_panel, &p->niche, &p->map_elites, &p->specialists, &p->sharing, &p->screen_stop, &p->screen_check);
      if (got != 15 && got != 17 && got != 18 && got != 20 && got != 21 && got != 22 && got != 23 && got != 24 &&
          got != 25 && got != 26 && got != 28 && got != 29 && got != 30 && got != 31 && got != 32 && got != 34)
        goto bad;
    } else if (!strncmp(line, "opponents ", 10)) {
      snprintf(p->opponents, sizeof p->opponents, "%s", line + 10);
    } else if (!strncmp(line, "start-dir ", 10)) {
      snprintf(p->start, sizeof p->start, "%s", line + 10);
    } else if (!strncmp(line, "changes ", 8)) { // a state without it has the rates of genome_mix_default()
      if (genome_mix_parse(&p->changes, line + 8) != 0) goto bad;
    } else if (!strncmp(line, "panel ", 6)) { // before --rotate: the ids are 0, 1, ...
      panel_id[pn] = pn;
      panel[pn++] = line + 6;
    } else if (!strncmp(line, "panel-id ", 9)) {
      int used = 0;
      if (sscanf(line + 9, "%" SCNu64 " %n", &panel_id[pn], &used) != 1 || !used) goto bad;
      panel[pn++] = line + 9 + used;
    } else if (!strncmp(line, "reserve ", 8)) {
      r->reserve[r->reserve_n++] = xstrdup(line + 8);
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
  setup_matrix(r);
  warrior *last = 0;
  uint64_t *slot_id = xmalloc(r->cap * sizeof *slot_id);
  uint32_t *slot_at = xmalloc(r->cap * sizeof *slot_at), slots = 0;
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
        sscanf(line, "reserve-next %u", &r->reserve_next) == 1 || sscanf(line, "rotate-next %u", &r->rotate_next) == 1 ||
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
      name_text(w->name, sizeof w->name, w->adjective, w->noun, w->earlier);
      uint32_t at = UINT32_MAX;
      for (uint32_t k = 0; k < slots; k++)
        if (slot_id[k] == w->id) at = slot_at[k];
      if (at != UINT32_MAX && r->slot[at]) goto bad;
      r->slot[at != UINT32_MAX ? at : free_slot(r)] = w;
      last = w;
    } else if (!strncmp(line, "elite ", 6)) { // --map-elites: a cell and its warrior
      warrior *w = xmalloc(sizeof *w);
      memset(w, 0, sizeof *w);
      int used = 0, c;
      w->kind = MEMBER;
      w->g = xmalloc(sizeof *w->g);
      double avg, screen;
      if (sscanf(line + 6, "%d %" SCNu64 " %u %" SCNu64 " %" SCNu64 " %lg %u %u %u %lg %lg %d %d %n", &c, &w->id, &w->born,
                 &w->parents[0], &w->parents[1], &w->holdout, &w->adjective, &w->noun, &w->earlier, &avg, &screen,
                 &w->style_kind, &w->new_family, &used) != 13 ||
          c < 0 || c >= me_slots(r) || r->me[c] || w->adjective >= NAME_ADJECTIVES || w->noun >= NAME_NOUNS ||
          genome_load(w->g, line + 6 + used, p->rules.core_size, 0) != 0)
        goto bad;
      w->w = make_warrior(w->g, &p->rules);
      name_text(w->name, sizeof w->name, w->adjective, w->noun, w->earlier);
      r->me[c] = w, r->me_avg[c] = avg, r->me_screen[c] = screen;
      last = w;
    } else if (!strncmp(line, "elite-row ", 10)) { // after its elite line
      int c, used = 0;
      if (sscanf(line + 10, "%d%n", &c, &used) != 1 || c < 0 || c >= me_slots(r) || !r->me[c]) goto bad;
      r->me_row[c] = xmalloc((r->panel_n ? r->panel_n : 1) * sizeof *r->me_row[c]);
      const char *q = line + 10 + used;
      for (uint32_t j = 0; j < r->panel_n; j++) {
        int k = 0;
        if (sscanf(q, " %u %u %u%n", &r->me_row[c][j].wins, &r->me_row[c][j].losses, &r->me_row[c][j].ties, &k) != 3) goto bad;
        q += k;
      }
    } else if (!strncmp(line, "kind ", 5)) { // after its member line; states before have none
      if (!last || sscanf(line + 5, "%d", &last->style_kind) != 1) goto bad;
    } else if (!strncmp(line, "ops ", 4) || !strcmp(line, "ops")) {
      if (last) snprintf(last->ops, sizeof last->ops, "%s", line[3] ? line + 4 : "");
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
  free(slot_id);
  free(slot_at);
  rebuild_active(r);
  if (r->p.sharing > 0 && r->batch) share_weights(r); // the weights of the batch that ended, as without a break
  compute_values(r);
  ok = 1;
bad:
  free(text);
  free(panel);
  free(panel_id);
  free(hold);
  free(rest);
  if (!ok) fprintf(stderr, "42evolve: %s is not a state file of this version\n", path);
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
  uint64_t rival; // the member the first parent won its tournament against, NO_ID none
  char ops[128];
  int skip;
  double screen;   // average against the panel in the screen rounds
  double estimate; // screen * (SD-score to the nearest warrior in, on the panel columns)^alpha
  double key;      // what the survivors are picked by: screen or estimate
  int out;         // --race: dropped after the first screen rounds; --screen-stop: stopped
  int would_stop;  // --screen-check: --screen-stop would have stopped it
  uint32_t played; // rounds of its screen against each opponent
  uint32_t stop_at; // --screen-stop, --screen-check: the rounds after which it stopped (would have), 0 not
  int reached;     // 0 bred, 1 evaluated (not a repeat), 2 past the screen, 3 still in the list after its batch
  double race_key; // --race: the key after the first screen rounds
  uint64_t id;
} candidate;

// Tournament of two: the member with the higher push-off value.
// Tournament of two members. --parents value: the higher push-off value
// wins. --parents duel: the one with more points in their match against
// each other wins (as in YACE, where winners of fights reproduce), a draw
// goes by value. *rival: the other one.
static const warrior *select_parent(run *r, rng *g, uint64_t *rival) {
  if (r->p.specialists && r->spec_n && rng_below(g, 4) == 0) { // --specialists: a protected member, no tournament
    if (rival) *rival = NO_ID;
    return r->slot[r->spec[rng_below(g, r->spec_n)]];
  }
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

typedef struct {
  double busy, wall;
  uint64_t instructions, rounds;
} speed;

static speed pool_speed(const pool *p) {
  speed s = {0, 0, 0, 0};
  for (uint32_t i = 0; i < p->threads; i++) {
    s.busy += p->w[i].busy;
    s.instructions += p->w[i].instructions;
    s.rounds += p->w[i].rounds;
  }
  return s;
}

static int by_key(const void *a, const void *b) {
  const candidate *x = *(candidate *const *)a, *y = *(candidate *const *)b;
  if (x->key != y->key) return x->key < y->key ? 1 : -1;
  return x < y ? -1 : 1;
}

static void bench(run *r, uint32_t slot) {
  warrior *w = r->slot[slot];
  unit *u = xmalloc(r->hold_n * sizeof *u);
  for (uint32_t i = 0; i < r->hold_n; i++)
    u[i] = (unit){w->w, r->hold[i].w, seed_for(r, r->hold[i].id), 0, r->p.bench_rounds, {{0}}, 0, 0};
  pool_run(&r->pool, u, r->hold_n);
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
      const double d = fabs(points(row[k].s[0], rounds) - r->pts[o * r->cap + k]);
      if (r->p.sd == SD_SUM) num += d, den += r->sigma[k];
      else if (r->sigma[k] > 0) sum += d / r->sigma[k];
    }
    const double dist = r->p.sd == SD_SUM ? (den > 0 ? num / den : 0) : sum;
    if (dist < best) best = dist;
  }
  if (best == INFINITY) best = 0;
  return r->p.alpha == 1 ? best : pow(best, r->p.alpha);
}

// --rotate: the panel warrior that is in longest makes room for the next
// warrior of the pool, which goes to the end of the pool. The new one plays
// everyone in, as warrior 0 with the seed of the other (it has the highest id).
static void rotate_panel(run *r) {
  if (!r->reserve_n) return;
  const uint32_t i = r->rotate_next;
  r->rotate_next = (i + 1) % r->panel_n;
  warrior *w = load_opponent(r, r->reserve[r->reserve_next], 0);
  if (!w) exit(1);
  warrior *old = &r->panel[i];
  const uint64_t out = old->id;
  free(r->reserve[r->reserve_next]);
  r->reserve[r->reserve_next] = old->file;
  r->reserve_next = (r->reserve_next + 1) % r->reserve_n;
  m42_warrior_free(old->w);
  free(old->source);
  w->kind = PANEL;
  w->id = r->next_id++;
  *old = *w;
  free(w);
  const uint32_t whole = panel_rounds(&r->p), s1 = stage_rounds(&r->p), parts = s1 < whole ? 2 : 1;
  unit *u = xmalloc(r->active_n * parts * sizeof *u);
  uint32_t n = 0;
  for (uint32_t k = 0; k < r->active_n; k++) {
    const uint32_t o = r->active[k];
    if (o == i) continue;
    u[n++] = (unit){old->w, r->slot[o]->w, seed_for(r, r->slot[o]->id), 0, s1, {{0}}, 0, 0};
    if (parts == 2) u[n++] = (unit){old->w, r->slot[o]->w, seed_for(r, r->slot[o]->id), s1, whole - s1, {{0}}, 0, 0};
  }
  pool_run(&r->pool, u, n);
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"rotate\",\"batch\":%u,\"out\":%" PRIu64 ",\"panel\":{\"id\":%" PRIu64 ",\"name\":", r->batch,
          out, old->id);
  json_str(f, old->name, 1);
  fputs(",\"author\":", f);
  json_str(f, old->author, 1);
  fputs(",\"file\":", f);
  json_str(f, old->file, 1);
  fputs(",\"source\":", f);
  json_str(f, old->source, 1);
  fputs("},\"scores\":[", f);
  n = 0;
  for (uint32_t k = 0; k < r->active_n; k++) {
    const uint32_t o = r->active[k];
    if (o == i) continue;
    const m42_score whole = parts == 2 ? add_scores(u[n].s[0], u[n + 1].s[0]) : u[n].s[0];
    set_result(r, i, o, whole);
    if (parts == 2) set_result1(r, i, o, u[n].s[0]);
    fprintf(f, "%s[%" PRIu64 ",%u,%u,%u,%" PRId64 "]", n ? "," : "", r->slot[o]->id, whole.wins, whole.losses,
            whole.ties, u[n].seed);
    n += parts;
  }
  fputs("]}\n", f);
  free(u);
  compute_values(r);
}

// --prior hill: the weights of opcodes, modifiers and modes are how often
// they occur in all opponents (panel, holdout and the rest of the folder),
// plus 1 so that none is impossible. Counts only, no code.
static void count_style(genome_style *st, const m42_warrior *w) {
  const m42_instruction *c = m42_warrior_code(w);
  for (uint32_t i = 0; i < m42_warrior_length(w); i++) {
    if (c[i].opcode < GENOME_OPCODES) st->op[c[i].opcode]++;
    if (c[i].modifier < 7) st->mod[c[i].modifier]++;
    if (c[i].a_mode < 8) st->mode[c[i].a_mode]++;
    if (c[i].b_mode < 8) st->mode[c[i].b_mode]++;
  }
}

static void build_style(run *r) {
  genome_style *st = &r->style;
  memset(st, 0, sizeof *st);
  st->fraction = r->p.fractions;
  if (r->p.prior != PRIOR_HILL) return;
  for (uint32_t i = 0; i < GENOME_OPCODES; i++) st->op[i] = 1;
  for (uint32_t i = 0; i < 7; i++) st->mod[i] = 1;
  for (uint32_t i = 0; i < 8; i++) st->mode[i] = 1;
  for (uint32_t i = 0; i < r->panel_n; i++) count_style(st, r->panel[i].w);
  for (uint32_t i = 0; i < r->hold_n; i++) count_style(st, r->hold[i].w);
  for (uint32_t i = 0; i < r->reserve_n; i++) {
    warrior *w = load_opponent(r, r->reserve[i], 1);
    if (w) count_style(st, w->w), m42_warrior_free(w->w), free(w->file), free(w->source), free(w);
  }
}

// A candidate's screen score, estimate and key from its row of screen
// results against the q screen opponents (row[j] for panel warrior j, then
// the members of the screen) over `rounds`.
static void score_screen(const run *r, candidate *x, const unit *row, uint32_t q, uint32_t rounds) {
  double s = 0;
  for (uint32_t j = 0; j < q; j++) s += points(row[j].s[0], rounds);
  x->screen = q ? s / q : 0;
  x->estimate = x->screen * estimated_distance(r, row, rounds);
  x->key = r->p.select == SELECT_VALUE ? x->estimate : x->screen;
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

static void screen_bounds(const unit *row, uint32_t q, uint32_t n, uint32_t F, double z, double *lo, double *hi) {
  double x = 0, s2 = 0;
  for (uint32_t k = 0; k < q; k++) {
    const m42_score sc = row[k].s[0];
    x += points(sc, n);
    const double t = n + 3.0, pw = (sc.wins + 1) / t, pt = (sc.ties + 1) / t, mu = 300 * pw + 100 * pt;
    s2 += 90000 * pw + 10000 * pt - mu * mu;
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
    screen_bounds(u + at[i], q, done, p->screen_rounds, z, &lo[i], &hi[i]);
    sorted[on++] = lo[i];
  }
  double cut = -INFINITY; // the p.survivors-th largest lo
  if (p->select == SELECT_SCREEN && on > p->survivors && p->survivors > 0) {
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
    if (hi[i] < threshold || hi[i] < cut) {
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

// --niche N: who may leave in this push-off. mask[slot] is 1 for the panel
// and for the members of a kind of style that has N members or fewer, so
// that the push-off takes the weakest of the others: a design that is losing
// the list keeps N places to improve in, the leading one can grow to the
// rest. The two kinds of junk ("dies at once", "writes little") and warriors
// without a kind (from a state before kinds) have no places. When that would
// leave nobody who may leave, nobody is protected.
static void leave_mask(const run *r, uint8_t *mask) {
  memcpy(mask, r->keep, r->cap);
  if (!r->p.niche && !r->p.specialists) return;
  if (r->p.niche) {
    uint32_t count[KIND_COUNT] = {0};
    for (uint32_t i = 0; i < r->active_n; i++) {
      const warrior *w = r->slot[r->active[i]];
      if (w->kind == MEMBER && w->style_kind >= 0 && w->style_kind < KIND_COUNT) count[w->style_kind]++;
    }
    for (uint32_t i = 0; i < r->active_n; i++) {
      const uint32_t s = r->active[i];
      const warrior *w = r->slot[s];
      const int k = w->style_kind;
      if (w->kind == MEMBER && k >= 0 && k < KIND_COUNT && k != KIND_DIES && k != KIND_LITTLE && count[k] <= r->p.niche)
        mask[s] = 1;
    }
  }
  if (r->p.specialists) { // --specialists
    uint32_t *sp = xmalloc((r->active_n + 1) * sizeof *sp);
    const uint32_t np = specialists(r, sp, 0);
    for (uint32_t k = 0; k < np; k++)
      if (sp[k] != UINT32_MAX) mask[sp[k]] = 1;
    free(sp);
  }
  uint32_t free_n = 0;
  for (uint32_t i = 0; i < r->active_n; i++) free_n += !mask[r->active[i]];
  if (!free_n) memcpy(mask, r->keep, r->cap);
}

// --specialists: for each panel warrior, the member that does best against
// it (the first in the list on a tie) does not leave when its score there is
// ahead of the members' median by more than SPEC_Z standard errors of that
// score: a design that alone beats a panel warrior keeps a place while it is
// weak elsewhere. Against a panel warrior that all members lose to, the best
// is luck, and nobody is protected for it. A quarter of the parents are drawn
// from the protected members (select_parent()).
#define SPEC_Z 2.0

static int by_double(const void *a, const void *b) {
  const double x = *(const double *)a, y = *(const double *)b;
  return x < y ? -1 : x > y;
}

// For the k-th panel warrior in the list (active order): out[k] its
// protected member's slot or UINT32_MAX, med[k] the members' median there.
// Returns the number of panel warriors.
static uint32_t specialists(const run *r, uint32_t *out, double *med) {
  const uint32_t c = r->cap;
  double *x = xmalloc((r->active_n + 1) * sizeof *x);
  uint32_t np = 0;
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    if (r->slot[o]->kind != PANEL) continue;
    uint32_t n = 0, best = UINT32_MAX;
    for (uint32_t j = 0; j < r->active_n; j++) {
      const uint32_t m = r->active[j];
      if (r->slot[m]->kind != MEMBER) continue;
      x[n++] = r->pts[m * c + o];
      if (best == UINT32_MAX || r->pts[m * c + o] > r->pts[best * c + o]) best = m;
    }
    double median = 0;
    if (n) {
      qsort(x, n, sizeof *x, by_double);
      median = n % 2 ? x[n / 2] : (x[n / 2 - 1] + x[n / 2]) / 2;
    }
    out[np] = best != UINT32_MAX && r->pts[best * c + o] - median > SPEC_Z * r->se[best * c + o] ? best : UINT32_MAX;
    if (med) med[np] = median;
    np++;
  }
  free(x);
  return np;
}

// mask: those that may not leave (leave_mask()); a newcomer that may not
// leave does not leave early either.
static int leaves_early(const run *r, uint32_t s, const uint8_t *mask) {
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
    const m42_score sc = r->wlt[s * r->cap + o];
    const uint32_t played = sc.wins + sc.losses + sc.ties;
    const uint32_t want = o < r->panel_n ? panel_rounds(p) : p->rounds;
    if (played >= want) continue;
    u[n] = (unit){r->slot[s]->w, r->slot[o]->w, seed_for(r, r->slot[o]->id), played, want - played, {{0}}, 0, 0};
    opp[n++] = o;
  }
  pool_run(&r->pool, u, n);
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

// The mean absolute difference of the rows of a and b over everyone else in.
static double row_difference(const run *r, uint32_t a, uint32_t b) {
  double s = 0;
  uint32_t n = 0;
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    if (o == a || o == b) continue;
    s += fabs(r->pts[a * r->cap + o] - r->pts[b * r->cap + o]);
    n++;
  }
  return n ? s / n : 0;
}

static void run_batch(run *r) {
  const params *p = &r->p;
  const uint32_t B = p->batch, P = r->panel_n;
  const double t0 = now();
  const speed s0 = pool_speed(&r->pool);
  if (p->rotate && r->batch && r->batch % p->rotate == 0) rotate_panel(r);
  candidate *c = xmalloc(B * sizeof *c);
  const uint32_t core = p->rules.core_size;
  uint32_t evaluated = 0;
  if (p->specialists) { // the protected members, each once, in the order of the panel
    uint32_t *sp = xmalloc((r->active_n + 1) * sizeof *sp);
    const uint32_t np = specialists(r, sp, 0);
    r->spec_n = 0;
    for (uint32_t k = 0; k < np; k++) {
      uint32_t j = 0;
      while (j < r->spec_n && r->spec[j] != sp[k]) j++;
      if (sp[k] != UINT32_MAX && j == r->spec_n) r->spec[r->spec_n++] = sp[k];
    }
    free(sp);
  }

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
    int reintro = 0, copy = 0;
    if (members(r) == 0 && r->start_n) {
      // the start warriors as they are, then mutants of them
      const uint32_t k = i % r->start_n;
      if (i < r->start_n) {
        x->g = r->starts[k];
        strcpy(x->ops, "start");
        reintro = 1; // always evaluated
      } else {
        genome_breed(&x->g, &r->starts[k], &r->starts[(k + 1) % r->start_n], &g, core, p->rules.max_length, &r->style,
                     &p->changes, x->ops, sizeof x->ops);
      }
      x->noun = r->start_noun[k];
    } else if (members(r) == 0 || (p->fill && members(r) < p->list && !r->start_n)) {
      genome_random(&x->g, &g, core,
                    1 + rng_below(&g, p->init_length < p->rules.max_length ? p->init_length : p->rules.max_length),
                    &r->style);
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
      genome_breed(&x->g, a->g, b->g, &g, core, p->rules.max_length, &r->style, &p->changes, x->ops,
                   sizeof x->ops);
      x->parents[0] = a->id;
      x->noun = a->noun;
      if (strstr(x->ops, "crossover") && b->id != a->id) x->parents[1] = b->id;
    }
    const uint64_t h = genome_hash(&x->g, core);
    x->skip = copy || (!reintro && seen_has(r, h));
    if (!x->skip) {
      seen_add(r, h);
      x->w = make_warrior(&x->g, &p->rules);
      x->reached = 1;
      evaluated++;
    }
  }

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

  // screen: every candidate against those opponents, the first rounds; with
  // --race every candidate plays only the first race rounds, and the best
  // race_keep of them by their key the rest
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
  const int racing = p->race && p->race < p->screen_rounds;
  const int stepping = !racing && (p->screen_stop > 0 || p->screen_check > 0);
  const uint32_t F = p->screen_rounds;
  const uint32_t stage = racing ? p->race : stepping && SCREEN_STEP < F ? SCREEN_STEP : F;
  unit *u = xmalloc((size_t)B * Q * sizeof *u);
  uint32_t n = 0;
  for (uint32_t i = 0; i < B; i++)
    for (uint32_t j = 0; j < Q && !c[i].skip; j++) {
      const warrior *o = r->slot[so[j]];
      u[n++] = (unit){c[i].w, o->w, seed_for(r, o->id), 0, stage, {{0}}, 0, 0};
    }
  pool_run(&r->pool, u, n);
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
      unit *g = xmalloc((size_t)B * Q * sizeof *g + sizeof *g);
      n = 0;
      for (uint32_t i = 0; i < B; i++)
        for (uint32_t j = 0; j < Q && !c[i].skip && !c[i].out; j++) {
          const warrior *o = r->slot[so[j]];
          g[n++] = (unit){c[i].w, o->w, seed_for(r, o->id), done, step, {{0}}, 0, 0};
        }
      pool_run(&r->pool, g, n);
      n = 0;
      for (uint32_t i = 0; i < B; i++) {
        if (c[i].skip || c[i].out) continue;
        for (uint32_t j = 0; j < Q; j++, n++) {
          m42_score *a = &u[screen_at[i] + j].s[0];
          const m42_score b = g[n].s[0];
          *a = (m42_score){a->wins + b.wins, a->losses + b.losses, a->ties + b.ties};
        }
        c[i].played = done + step;
        score_screen(r, &c[i], u + screen_at[i], Q, done + step);
      }
      free(g);
      done += step;
    }
  }
  uint32_t raced = 0;
  double race_dropped = -1; // the best key that did not go on
  if (racing) {
    candidate **order = xmalloc(B * sizeof *order);
    uint32_t on = 0;
    for (uint32_t i = 0; i < B; i++)
      if (!c[i].skip) order[on++] = &c[i];
    qsort(order, on, sizeof *order, by_key);
    raced = on < p->race_keep ? on : p->race_keep;
    for (uint32_t i = 0; i < on; i++) order[i]->race_key = order[i]->key;
    for (uint32_t i = raced; i < on; i++) order[i]->out = 1;
    if (raced < on) race_dropped = order[raced]->key;
    unit *g = xmalloc((size_t)raced * Q * sizeof *g);
    n = 0;
    for (uint32_t i = 0; i < B; i++)
      for (uint32_t j = 0; j < Q && !c[i].skip && !c[i].out; j++) {
        const warrior *o = r->slot[so[j]];
        g[n++] = (unit){c[i].w, o->w, seed_for(r, o->id), stage, p->screen_rounds - stage, {{0}}, 0, 0};
      }
    pool_run(&r->pool, g, n);
    n = 0;
    for (uint32_t i = 0; i < B; i++) {
      if (c[i].skip || c[i].out) continue;
      for (uint32_t j = 0; j < Q; j++, n++) {
        m42_score *a = &u[screen_at[i] + j].s[0];
        const m42_score b = g[n].s[0];
        *a = (m42_score){a->wins + b.wins, a->losses + b.losses, a->ties + b.ties};
      }
      score_screen(r, &c[i], u + screen_at[i], Q, p->screen_rounds);
    }
    free(g);
    free(order);
  }

  candidate **sv = xmalloc(B * sizeof *sv);
  uint32_t sn = 0;
  for (uint32_t i = 0; i < B; i++)
    if (!c[i].skip && !c[i].out && c[i].screen >= threshold) sv[sn++] = &c[i];
  qsort(sv, sn, sizeof *sv, by_key);
  if (sn > p->survivors) sn = p->survivors;
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
    for (uint32_t j = P; j < r->active_n; j++) {
      const warrior *m = r->slot[r->active[j]];
      f[fn++] = (unit){sv[i]->w, m->w, seed_for(r, m->id), 0, upto, {{0}}, 0, 0};
    }
    for (uint32_t j = 0; j < i; j++)
      f[fn++] = (unit){sv[i]->w, sv[j]->w, seed_for(r, sv[j]->id), 0, upto, {{0}}, 0, 0};
  }
  pool_run(&r->pool, f, fn);


  // enter in order, each followed by the push-off
  uint32_t *slot_of = xmalloc((sn ? sn : 1) * sizeof *slot_of);
  uint8_t *mask = xmalloc(r->cap);
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
    w->holdout = -1;
    memcpy(w->ops, x->ops, sizeof w->ops);
    r->slot[s] = w;
    slot_of[i] = s;
    const uint32_t at = screen_at[(uint32_t)(x - c)];
    // with --stage these are the first stage's results, in both matrices
    for (uint32_t j = 0; j < P; j++, fn++) {
      const m42_score sc = add_scores(u[at + j].s[0], f[fn].s[0]);
      set_result(r, s, j, sc);
      if (staged) set_result1(r, s, j, sc);
    }
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
    rng name = rng_seed(p->seed, 0x6e616d65u, w->id); // "name"
    w->adjective = rng_below(&name, NAME_ADJECTIVES);
    w->noun = x->noun;
    if (w->new_family) {
      w->noun = rng_below(&name, NAME_NOUNS - 1);
      if (w->noun >= x->noun) w->noun++; // another noun than the parent's
    }
    w->earlier = r->names[w->adjective * NAME_NOUNS + w->noun]++;
    name_text(w->name, sizeof w->name, w->adjective, w->noun, w->earlier);
    event_enter(r, s, x->screen, x->estimate, x->race_key, x->rival, u + at);
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
        leave_mask(r, mask);
        early = leaves_early(r, s, mask);
      }
      if (!early) complete_one(r, s);
    }
    if (members(r) > p->list) {
      if (!early) compute_values(r);
      // an early leave is the newcomer, also when another one is weaker on
      // the first stage (it may be a member that is unlucky in those rounds)
      if (!early) leave_mask(r, mask);
      const int k = early ? (int)value_of(r, s) : pushoff_weakest(r->values, r->active_n, mask);
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
  if (p->sharing > 0) { // the weights for the next batch, and the values with them
    share_weights(r);
    event_sharing(r);
  }
  compute_values(r);
  event_values(r);
  if (p->specialists) event_specialists(r);

  if (p->bench_every && r->hold_n && (r->batch + 1) % p->bench_every == 0 && members(r)) {
    uint32_t best = r->active[P];
    for (uint32_t i = P; i < r->active_n; i++)
      if (panel_avg(r, r->active[i]) > panel_avg(r, best)) best = r->active[i];
    if (r->slot[best]->holdout < 0) bench(r, best);
  }

  const speed s1 = pool_speed(&r->pool);
  const double wall = now() - t0;
  const double busy = (s1.busy - s0.busy) / (wall * r->pool.threads);
  fprintf(r->events,
          "{\"type\":\"batch\",\"batch\":%u,\"candidates\":%u,\"evaluated\":%u,\"raced\":%u,\"raceDropped\":%.6f,"
          "\"survivors\":%u,\"entered\":%u,\"members\":%u,\"threshold\":%.6f,\"screenMembers\":[",
          r->batch, B, evaluated, racing ? raced : evaluated, race_dropped, sn, entered, members(r),
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
          r->batch, wall, r->pool.threads, busy, s1.rounds - s0.rounds, s1.instructions - s0.instructions,
          evaluated / wall, (s1.rounds - s0.rounds) / wall);

  for (uint32_t i = 0; i < B; i++) free(c[i].w);
  free(c);
  free(u);
  free(f);
  free(sv);
  free(screen_at);
  free(so);
  free(screen_id);
  free(mask);
  free(slot_of);
  free(member_slots);
  free(in_list);
  r->batch++;
}

// ---------------------------------------------------------------- MAP-Elites (--map-elites, #147)

// Instead of one list, an archive with a cell for each kind of style
// (style.h): 4 bins of copies of its own code, 4 of processes, 3 of cells
// read far from home, 48 cells. Each cell keeps the warrior with the best
// average against the panel (all rounds of its matches against it). A batch
// breeds children of random occupied cells (crossover with another random
// one), measures each child's style, which gives its cell, plays the screen
// rounds against the panel, and only a child that beats its cell's warrior
// there (or whose cell is empty) plays the rest; it takes the cell when its
// average is higher. Designs do not compete with each other, and a new kind
// of behavior keeps its cell while it is weak.
#define ME_CELLS 48
// A child takes a filled cell only when the mean of its differences to the
// cell's warrior, per panel warrior (the same seeds), is more than ME_Z
// standard errors above 0: an average over 20 panel warriors moved by 0.66
// per replacement in a run without it, about its standard error, so the
// cells kept the luckiest of their children.
#define ME_Z 2.0

// --map-elites crowding: the archive has --list places and no cells. "Alike"
// is the SD-score of the results against the panel: of the rows a and b,
// the sum over panel warriors j of |a_j - b_j| / sigma_j (points per 100
// rounds), sigma_j the standard deviation of the archive's results against
// j, taken once a batch. A child that is nearer to its nearest member than
// the archive's closest pair are to each other competes with that member
// and takes its place by the margin of ME_Z. A child farther than that is
// something the archive lacks: it takes the place of the weaker of the
// closest pair when its average is higher. So a warrior competes only with
// warriors that play like it, and the places spread over what the panel
// can tell apart, not over bins of style.
static void me_sigma(const run *r, double *sigma) {
  const uint32_t P = r->panel_n;
  const int N = me_slots(r);
  for (uint32_t j = 0; j < P; j++) {
    double mean = 0, v = 0;
    uint32_t m = 0;
    for (int c = 0; c < N; c++)
      if (r->me[c]) mean += points_of(r->me_row[c][j]), m++;
    mean = m ? mean / m : 0;
    for (int c = 0; c < N; c++)
      if (r->me[c]) {
        const double d = points_of(r->me_row[c][j]) - mean;
        v += d * d;
      }
    sigma[j] = m ? sqrt(v / m) : 0;
  }
}

static double me_distance(const m42_score *a, const m42_score *b, const double *sigma, uint32_t P) {
  double sum = 0;
  for (uint32_t j = 0; j < P; j++)
    if (sigma[j] > 0) sum += fabs(points_of(a[j]) - points_of(b[j])) / sigma[j];
  return sum;
}

// The member nearest to a row (lowest place on a tie), -1 none.
static int me_nearest(const run *r, const m42_score *row, const double *sigma, double *dist) {
  int n = -1;
  *dist = INFINITY;
  for (int c = 0; c < me_slots(r); c++) {
    if (!r->me[c]) continue;
    const double d = me_distance(row, r->me_row[c], sigma, r->panel_n);
    if (d < *dist) *dist = d, n = c;
  }
  return n;
}

// The two members nearest to each other (the lowest places on a tie); their
// distance, INFINITY with fewer than 2 members.
static double me_closest_pair(const run *r, const double *sigma, int *pa, int *pb) {
  double best = INFINITY;
  *pa = *pb = -1;
  for (int a = 0; a < me_slots(r); a++)
    for (int b = a + 1; b < me_slots(r) && r->me[a]; b++) {
      if (!r->me[b]) continue;
      const double d = me_distance(r->me_row[a], r->me_row[b], sigma, r->panel_n);
      if (d < best) best = d, *pa = a, *pb = b;
    }
  return best;
}

// The weaker of the closest pair: the lower average, the later place on a tie.
static int me_weaker(const run *r, int a, int b) { return r->me_avg[a] < r->me_avg[b] ? a : b; }

static int me_empty(const run *r) {
  for (int c = 0; c < me_slots(r); c++)
    if (!r->me[c]) return c;
  return -1;
}

static int me_bin(double x, const double *edges, int n) {
  int b = 0;
  while (b < n && x >= edges[b]) b++;
  return b;
}

// The cell of a style, -1 for one that dies before it can be measured.
static int me_cell(const style *st) {
  if (st->measured == 0) return -1;
  static const double copies[] = {20, 200, 600}, tasks[] = {2, 50, 250}, read[] = {50, 300};
  return me_bin(st->copies, copies, 3) * 12 + me_bin(st->tasks, tasks, 3) * 3 + me_bin(st->read, read, 2);
}

static uint32_t me_filled(const run *r) {
  uint32_t n = 0;
  for (int c = 0; c < me_slots(r); c++) n += r->me[c] != 0;
  return n;
}

static int me_best(const run *r) {
  int b = -1;
  for (int c = 0; c < me_slots(r); c++)
    if (r->me[c] && (b < 0 || r->me_avg[c] > r->me_avg[b])) b = c;
  return b;
}

// A random occupied cell, -1 none.
static int me_random_cell(const run *r, rng *g) {
  const uint32_t n = me_filled(r);
  if (!n) return -1;
  uint32_t k = rng_below(g, n);
  for (int c = 0; c < me_slots(r); c++)
    if (r->me[c] && k-- == 0) return c;
  return -1;
}

// A parent: with the cells a random one; with crowding the better average
// of two random places (the lower place on a tie), since half of an archive
// spread by the SD-score is weak warriors that play like no other (an hour
// of crowding with random parents: median 68, top 100 against the panel).
static int me_parent(const run *r, rng *g) {
  const int a = me_random_cell(r, g);
  if (r->p.map_elites != ME_CROWDING || a < 0) return a;
  const int b = me_random_cell(r, g);
  if (b < 0) return a;
  return r->me_avg[b] > r->me_avg[a] || (r->me_avg[b] == r->me_avg[a] && b < a) ? b : a;
}

// Crowding: a child unlike every member must beat at least half of the
// archive on average, not only the weaker of the closest pair. screen: the
// same over the screen rounds.
static int me_above_half(const run *r, double avg, int screen) {
  uint32_t below = 0, n = 0;
  for (int c = 0; c < me_slots(r); c++)
    if (r->me[c]) below += (screen ? r->me_screen[c] : r->me_avg[c]) < avg, n++;
  return 2 * below >= n;
}

// rule (crowding): "empty", "near" or "far"; 0 for the cells.
static void me_event(run *r, int cell, const warrior *w, const unit *row, double screen, const warrior *gone, double gone_avg,
                     double gain, double se, const char *rule, double dist, double pair) {
  FILE *f = r->events;
  const int sc = me_cell(&w->st); // its cell by style; the same as cell without crowding
  fprintf(f, "{\"type\":\"elite\",\"batch\":%u,\"cell\":[%d,%d,%d],\"index\":%d,\"id\":%" PRIu64 ",\"name\":", r->batch,
          sc / 12, sc / 3 % 4, sc % 3, cell, w->id);
  json_str(f, w->name, 0);
  fputs(",\"parents\":[", f);
  for (int k = 0, n = 0; k < 2; k++)
    if (w->parents[k] != NO_ID) fprintf(f, "%s%" PRIu64, n++ ? "," : "", w->parents[k]);
  fputs("],\"ops\":", f);
  json_str(f, w->ops, 0);
  fprintf(f, ",\"length\":%u,\"avg\":%.6f,\"screen\":%.6f,\"newFamily\":%s", w->g->len, r->me_avg[cell], screen,
          w->new_family ? "true" : "false");
  fprintf(f, ",\"style\":{\"kind\":\"%s\",\"copies\":%.6f,\"moved\":%.6f,\"written\":%.6f,\"whole\":%.6f,\"read\":%.6f,"
          "\"tasks\":%.6f,\"alive\":%.6f,\"measured\":%.6f}",
          style_kind_name(w->style_kind), w->st.copies, w->st.moved, w->st.written, w->st.whole, w->st.read, w->st.tasks,
          w->st.alive, w->st.measured);
  if (rule) {
    fprintf(f, ",\"rule\":\"%s\"", rule);
    if (strcmp(rule, "empty")) fprintf(f, ",\"distance\":%.6f,\"pair\":%.6f", dist, pair);
  }
  if (gone) fprintf(f, ",\"replaced\":{\"id\":%" PRIu64 ",\"avg\":%.6f,\"gain\":%.6f,\"se\":%.6f}", gone->id, gone_avg, gain, se);
  fputs(",\"code\":", f);
  write_code(f, w->g, r->p.rules.core_size);
  fputs(",\"scores\":[", f);
  for (uint32_t j = 0; j < r->panel_n; j++)
    fprintf(f, "%s[%" PRIu64 ",%u,%u,%u,%" PRId64 "]", j ? "," : "", r->panel[j].id, row[j].s[0].wins, row[j].s[0].losses,
            row[j].s[0].ties, seed_for(r, r->panel[j].id));
  fputs("]}\n", f);
}

// The holdout benchmark of the best cell (as bench() for the list).
static void me_bench(run *r) {
  const int c = me_best(r);
  if (c < 0 || r->me[c]->holdout >= 0) return;
  warrior *w = r->me[c];
  unit *u = xmalloc((r->hold_n ? r->hold_n : 1) * sizeof *u);
  for (uint32_t i = 0; i < r->hold_n; i++)
    u[i] = (unit){w->w, r->hold[i].w, seed_for(r, r->hold[i].id), 0, r->p.bench_rounds, {{0}}, 0, 0};
  pool_run(&r->pool, u, r->hold_n);
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
  fprintf(f, "],\"avg\":%.6f,\"panel\":%.6f}\n", w->holdout, r->me_avg[c]);
  free(u);
  if (w->holdout > r->best_holdout) {
    r->best_holdout = w->holdout;
    r->best_id = w->id;
    char path[1100], text[GENOME_MAX * 48 + 64];
    snprintf(path, sizeof path, "%s/best.red", r->dir);
    FILE *b = fopen(path, "w");
    if (b) {
      genome_text(w->g, r->p.rules.core_size, text, sizeof text);
      fprintf(b,
              "%s\n;name %s\n;author 42evolve\n;strategy evolved (MAP-Elites), warrior %" PRIu64 " of run seed %" PRIu64
              ", batch %u\n;strategy %.1f against %u holdout warriors, %.1f against the panel\n%s",
              r->p.rules.core_size == 8000 ? ";redcode-94nop" : ";redcode", w->name, w->id, r->p.seed, r->batch,
              w->holdout, r->hold_n, r->me_avg[c], text);
      fclose(b);
    }
  }
}

static void me_batch(run *r) {
  const params *p = &r->p;
  const uint32_t B = p->batch, P = r->panel_n, core = p->rules.core_size;
  const uint32_t F = p->screen_rounds, W = panel_rounds(p);
  const double t0 = now();
  const speed s0 = pool_speed(&r->pool);
  candidate *c = xmalloc(B * sizeof *c);
  warrior *tmp = xmalloc(B * sizeof *tmp); // the style needs a warrior
  int *cell = xmalloc(B * sizeof *cell), *pcell = xmalloc(B * sizeof *pcell);
  uint32_t evaluated = 0;
  const int crowd = p->map_elites == ME_CROWDING;
  const uint32_t filled0 = me_filled(r);
  for (uint32_t i = 0; i < B; i++) {
    rng g = rng_seed(p->seed, 0x6272656564u + r->batch, i); // "breed"
    candidate *x = &c[i];
    memset(x, 0, sizeof *x);
    x->parents[0] = x->parents[1] = x->rival = NO_ID;
    const int a = me_parent(r, &g);
    pcell[i] = a;
    if (a < 0 || (p->fill && filled0 < (crowd ? (uint32_t)me_slots(r) : 4))) { // random warriors until a few cells (crowding: all places) are filled
      genome_random(&x->g, &g, core,
                    1 + rng_below(&g, p->init_length < p->rules.max_length ? p->init_length : p->rules.max_length),
                    &r->style);
      strcpy(x->ops, "random");
      x->noun = rng_below(&g, NAME_NOUNS);
      pcell[i] = -1;
    } else {
      const int b = me_parent(r, &g);
      genome_breed(&x->g, r->me[a]->g, r->me[b]->g, &g, core, p->rules.max_length, &r->style, &p->changes, x->ops,
                   sizeof x->ops);
      x->parents[0] = r->me[a]->id;
      x->noun = r->me[a]->noun;
      if (strstr(x->ops, "crossover") && b != a) x->parents[1] = r->me[b]->id;
    }
    const uint64_t h = genome_hash(&x->g, core);
    x->skip = seen_has(r, h);
    cell[i] = -1;
    if (!x->skip) {
      seen_add(r, h);
      x->w = make_warrior(&x->g, &p->rules);
      x->reached = 1;
      evaluated++;
      memset(&tmp[i], 0, sizeof tmp[i]);
      tmp[i].w = x->w;
      measure_style(r, &tmp[i]);
      cell[i] = me_cell(&tmp[i].st);
      if (cell[i] < 0) x->skip = 1; // dies at once: no cell
    }
  }
  // the screen: the first rounds against the panel
  unit *u = xmalloc((size_t)B * P * sizeof *u + sizeof *u);
  uint32_t n = 0;
  for (uint32_t i = 0; i < B; i++)
    for (uint32_t j = 0; j < P && !c[i].skip; j++)
      u[n++] = (unit){c[i].w, r->panel[j].w, seed_for(r, r->panel[j].id), 0, F, {{0}}, 0, 0};
  pool_run(&r->pool, u, n);
  uint32_t *at = xmalloc(B * sizeof *at), passed = 0;
  // crowding: sigma for the batch, and the weaker of the closest pair, once the archive is full
  double *sigma = xmalloc((P ? P : 1) * sizeof *sigma);
  int sigma_ready = 0, weak = -1;
  if (crowd && me_empty(r) < 0) {
    me_sigma(r, sigma);
    sigma_ready = 1;
    int pa, pb;
    if (me_closest_pair(r, sigma, &pa, &pb) < INFINITY) weak = me_weaker(r, pa, pb);
  }
  n = 0;
  for (uint32_t i = 0; i < B; i++) {
    at[i] = n;
    if (c[i].skip) continue;
    double s = 0;
    for (uint32_t j = 0; j < P; j++) s += points(u[n + j].s[0], F);
    c[i].screen = s / P;
    n += P;
    int pass;
    if (crowd) { // a place free, or ahead of its nearest member (by the screen), or of the weaker of the closest pair and half of all
      pass = !sigma_ready;
      if (!pass) {
        m42_score *srow = xmalloc(P * sizeof *srow);
        for (uint32_t j = 0; j < P; j++) srow[j] = u[at[i] + j].s[0];
        double d;
        const int near = me_nearest(r, srow, sigma, &d);
        free(srow);
        pass = (near >= 0 && c[i].screen >= r->me_screen[near]) ||
               (weak >= 0 && c[i].screen >= r->me_screen[weak] && me_above_half(r, c[i].screen, 1));
      }
    } else
      pass = !r->me[cell[i]] || c[i].screen >= r->me_screen[cell[i]];
    if (pass) c[i].reached = 2, passed++;
  }
  // the rest of the rounds for those that beat their cell's warrior in the screen
  unit *f = xmalloc((size_t)passed * P * sizeof *f + sizeof *f);
  uint32_t fn = 0;
  for (uint32_t i = 0; i < B; i++)
    for (uint32_t j = 0; j < P && c[i].reached == 2; j++)
      f[fn++] = (unit){c[i].w, r->panel[j].w, seed_for(r, r->panel[j].id), F, W - F, {{0}}, 0, 0};
  pool_run(&r->pool, f, fn);
  uint32_t entered = 0;
  fn = 0;
  for (uint32_t i = 0; i < B; i++) {
    if (c[i].reached != 2) continue;
    unit *row = u + at[i];
    double s = 0;
    for (uint32_t j = 0; j < P; j++, fn++) {
      row[j].s[0] = add_scores(row[j].s[0], f[fn].s[0]);
      s += points_of(row[j].s[0]);
    }
    const double avg = s / P;
    int k = cell[i];
    double gain = 0, se = 0, dist = 0, pair = 0;
    const char *rule = 0;
    if (crowd) {
      m42_score *crow = xmalloc(P * sizeof *crow);
      for (uint32_t j = 0; j < P; j++) crow[j] = row[j].s[0];
      k = me_empty(r);
      rule = "empty";
      if (k < 0) {
        if (!sigma_ready) me_sigma(r, sigma), sigma_ready = 1;
        int pa, pb;
        const int near = me_nearest(r, crow, sigma, &dist);
        pair = me_closest_pair(r, sigma, &pa, &pb);
        if (dist > pair) { // something the archive lacks: the place of the weaker of the closest pair
          k = me_weaker(r, pa, pb);
          rule = "far";
          gain = avg - r->me_avg[k];
          if (!(gain > 0) || !me_above_half(r, avg, 0)) k = -1;
        } else {
          k = near;
          rule = "near";
        }
      }
      free(crow);
      if (k < 0) continue;
    }
    if (r->me[k] && (!rule || !strcmp(rule, "near"))) {
      double sd = 0, ss = 0;
      for (uint32_t j = 0; j < P; j++) {
        const double d = points_of(row[j].s[0]) - points_of(r->me_row[k][j]);
        sd += d, ss += d * d;
      }
      gain = sd / P;
      const double var = P > 1 ? (ss - sd * sd / P) / (P - 1) : 0;
      se = var > 0 ? sqrt(var / P) : 0;
      if (!(gain > ME_Z * se && gain > 0)) continue;
    }
    // it takes the cell
    warrior *w = xmalloc(sizeof *w);
    memset(w, 0, sizeof *w);
    w->id = r->next_id++;
    w->kind = MEMBER;
    w->g = xmalloc(sizeof *w->g);
    *w->g = c[i].g;
    w->w = c[i].w;
    c[i].w = 0;
    w->parents[0] = c[i].parents[0];
    w->parents[1] = c[i].parents[1];
    w->born = r->batch;
    w->holdout = -1;
    w->parent_difference = -1;
    w->st = tmp[i].st;
    w->style_kind = style_kind(&w->st);
    memcpy(w->ops, c[i].ops, sizeof w->ops);
    rng name = rng_seed(p->seed, 0x6e616d65u, w->id); // "name"
    w->adjective = rng_below(&name, NAME_ADJECTIVES);
    w->noun = c[i].noun;
    // a child in another cell than its parent's starts a family; crowding: one that plays unlike every member
    w->new_family = pcell[i] >= 0 && (crowd ? !strcmp(rule, "far") : pcell[i] != k);
    if (w->new_family) {
      w->noun = rng_below(&name, NAME_NOUNS - 1);
      if (w->noun >= c[i].noun) w->noun++;
    }
    w->earlier = r->names[w->adjective * NAME_NOUNS + w->noun]++;
    name_text(w->name, sizeof w->name, w->adjective, w->noun, w->earlier);
    warrior *gone = r->me[k];
    const double gone_avg = gone ? r->me_avg[k] : 0;
    r->me[k] = w;
    r->me_avg[k] = avg;
    r->me_screen[k] = c[i].screen;
    if (!r->me_row[k]) r->me_row[k] = xmalloc(P * sizeof *r->me_row[k]);
    for (uint32_t j = 0; j < P; j++) r->me_row[k][j] = row[j].s[0];
    c[i].reached = 3;
    entered++;
    me_event(r, k, w, row, c[i].screen, gone, gone_avg, gain, se, rule, dist, pair);
    free_warrior(gone);
  }
  if (p->bench_every && r->hold_n && (r->batch + 1) % p->bench_every == 0) me_bench(r);
  const speed s1 = pool_speed(&r->pool);
  const double wall = now() - t0;
  const int best = me_best(r);
  fprintf(r->events,
          "{\"type\":\"batch\",\"batch\":%u,\"candidates\":%u,\"evaluated\":%u,\"survivors\":%u,\"entered\":%u,"
          "\"cells\":%u,\"best\":%.6f,\"ops\":{",
          r->batch, B, evaluated, passed, entered, me_filled(r), best >= 0 ? r->me_avg[best] : 0);
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
          r->batch, wall, r->pool.threads, (s1.busy - s0.busy) / (wall * r->pool.threads), s1.rounds - s0.rounds,
          s1.instructions - s0.instructions, evaluated / wall, (s1.rounds - s0.rounds) / wall);
  for (uint32_t i = 0; i < B; i++) free(c[i].w);
  free(c), free(tmp), free(cell), free(pcell), free(u), free(at), free(f), free(sigma);
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

static void pick_panel(run *r, char **names, uint32_t count) {
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
  pool_run(&r->pool, u, m);
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
  uint32_t kcount[KIND_COUNT] = {0};
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
  uint32_t *picked = xmalloc((want ? want : 1) * sizeof *picked);
  uint8_t *taken = calloc(n, 1);
  double *near = xmalloc(n * sizeof *near);
  for (uint32_t i = 0; i < n; i++) near[i] = INFINITY;
  uint32_t np = 0;
  while (np < want) {
    int target = -1; // kinds: the kind whose turn it is
    if (kinds) {
      for (uint32_t i = 0; i < nc; i++) {
        const uint32_t c = order[i];
        if (taken[c] || kind[c] == KIND_DIES) continue;
        if (target < 0 || kcount[kind[c]] < kcount[target]) target = kind[c];
      }
      if (target < 0) break;
    }
    uint32_t best = order[0];
    double bd = -1;
    for (uint32_t i = 0; i < nc; i++) {
      const uint32_t c = order[i];
      if (taken[c] || (kinds && kind[c] != target)) continue;
      if (kinds && !kcount[target]) { // the strongest of a kind not picked yet
        best = c, bd = near[c];
        break;
      }
      if (near[c] > bd) bd = near[c], best = c; // the first: all are infinitely far, the strongest
    }
    if (kinds) kcount[target]++;
    r->pick_kind[np] = kind[best];
    picked[np] = best;
    r->pick_avg[np] = avg[best];
    r->pick_file[np] = xstrdup(names[best]);
    for (uint32_t i = 0; i < n; i++)
      if (order[i] == best) r->pick_rank[np] = i;
    r->pick_dist[np] = np ? bd : 0; // the first one's distance is infinite
    np++;
    taken[best] = 1;
    for (uint32_t i = 0; i < nc; i++) { // the distance of each candidate to its nearest picked one
      const uint32_t c = order[i];
      double d = 0;
      for (uint32_t k = 0; k < n; k++)
        if (k != c && k != best && sigma[k] > 0) d += fabs(pts[c * n + k] - pts[best * n + k]) / sigma[k];
      if (d < near[c]) near[c] = d;
    }
  }
  r->pick_sample = n;
  r->pick_n = np;
  r->pick_cut = avg[order[nc - 1]];
  // the picked first, then the rest in its order
  char **re = xmalloc(count * sizeof *re);
  uint32_t k = 0;
  for (uint32_t i = 0; i < np; i++) re[k++] = names[picked[i]];
  for (uint32_t i = 0; i < count; i++)
    if (i >= n || !taken[i]) re[k++] = names[i];
  memcpy(names, re, count * sizeof *names);
  free(re);
  for (uint32_t i = 0; i < n; i++) free_warrior(w[i]);
  free(w), free(u), free(pts), free(sigma), free(avg), free(order), free(picked), free(taken), free(near), free(kind);
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
  pool_run(&r->pool, u, nw * P);
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
  pool_run(&r->pool, u, r->hold_n);
  double s = 0;
  for (uint32_t i = 0; i < r->hold_n; i++) s += points(u[i].s[0], r->p.bench_rounds);
  free(u);
  return r->hold_n ? s / r->hold_n : 0;
}

static int optimize(run *r, const char *file) {
  const params *p = &r->p;
  const uint32_t core = p->rules.core_size, P = r->panel_n, R = p->rounds, F = OPT_FIRST < R ? OPT_FIRST : R;
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
  const double start_avg = opt_avg(curw, P), start_hold = opt_holdout(r, cur);
  FILE *f = r->events;
  fprintf(f, "{\"type\":\"optimize\",\"file\":");
  json_str(f, file, 1);
  fprintf(f, ",\"name\":");
  json_str(f, name, 1);
  fprintf(f, ",\"constants\":%u,\"rounds\":%u,\"avg\":%.6f,\"holdout\":%.6f,\"panel\":[", nc, R, start_avg, start_hold);
  for (uint32_t j = 0; j < P; j++) {
    fprintf(f, "%s{\"file\":", j ? "," : "");
    json_str(f, r->panel[j].file, 1);
    fprintf(f, ",\"seed\":%" PRId64 "}", seed_for(r, r->panel[j].id));
  }
  fputs("]}\n", f);
  uint32_t cand[128];
  m42_warrior **cw = xmalloc(128 * sizeof *cw);
  m42_score *s1 = xmalloc((size_t)128 * P * sizeof *s1), *sw = xmalloc((size_t)128 * P * sizeof *sw);
  uint32_t accepted = 0;
  for (uint32_t pass = 1; pass <= OPT_PASSES && !stop_now; pass++) {
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
          fprintf(f,
                  "{\"type\":\"optimize-step\",\"pass\":%u,\"constant\":%u,\"what\":\"%s\",\"from\":%d,\"to\":%d,"
                  "\"avg\":%.6f,\"gain\":%.6f,\"se\":%.6f,\"confirm\":%.6f,\"confirmSe\":%.6f,\"candidates\":%u}\n",
                  pass, k, k == 2 * g.len ? "start" : k % 2 ? "b" : "a", k == 2 * g.len ? (int)from : signed_of(from, core),
                  k == 2 * g.len ? (int)*opt_slot(&g, k) : signed_of(*opt_slot(&g, k), core), opt_avg(curw, P), best_d,
                  best_se, cd, cse, n);
          fflush(f);
          fprintf(stderr, "pass %u: constant %u from %d to %d, %.1f against the panel (+%.2f, se %.2f)\n", pass, k,
                  signed_of(from, core), signed_of(*opt_slot(&g, k), core), opt_avg(curw, P), best_d, best_se);
        }
        for (uint32_t i = 0; i < n; i++) free(cw[i]);
        free(cg);
        if (!ok) break;
      }
    }
    if (!in_pass) break;
  }
  const double end_avg = opt_avg(curw, P), end_hold = opt_holdout(r, cur);
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
  free(cur1);
  free(curw);
  free(cw);
  free(s1);
  free(sw);
  m42_warrior_free(orig);
  free(src);
  return 0;
}

// ---------------------------------------------------------------- main

static void usage(void) {
  fprintf(stderr,
          "usage: 42evolve <run folder> --opponents <dir> [--panel 20] [--holdout 100] [--list 80]\n"
          "         [--batch N] [--survivors N] [--rounds 100] [--screen-rounds 20] [--screen-factor 0.8]\n"
          "         [--bench-every 10] [--bench-rounds 100] [--alpha 1] [--sd opponent|sum]\n"
          "         [--reintroduce 0.02] [--init-length 10] [--seed 1] [--select screen|value] [--rotate N]\n"
          "         [--fractions p] [--race N] [--race-keep N] [--prior uniform|hill]\n"
          "         [--parents value|duel] [--start <dir>] [--changes name=weight,...]\n"
          "         [--panel-files a.red,b.red,...] [--screen-members N] [--noise z] [--stage N (screen rounds; 0 none)] [--fill]\n"
          "         [--panel-rounds N] [--diversity all|panel] [--niche N]\n"
          "         [--panel-choice picked|random|kinds] [--pick-sample 300] [--no-fill] [--map-elites [cells|crowding]]\n"
          "         [--specialists] [--sharing c] [--screen-stop z | --screen-check z]\n"
          "         [--size 8000] [--cycles 80000] [--processes 8000] [--length 100] [--distance 100]\n"
          "         [--threads N] [--batches N] [--seconds S]\n"
          "       42evolve <run folder> [--threads N] [--batches N] [--seconds S] [--changes ...] [--reintroduce p] [--screen-stop z | --screen-check z]\n"
          "                                                                      (continue a run)\n"
          "       42evolve <folder> --optimize <warrior.red> --opponents <dir> [--panel N | --panel-files ...]\n"
          "         [--rounds 100] [--holdout 100] [--bench-rounds 100] [--seed 1] [--threads N]   (its constants)\n");
  exit(2);
}

static uint32_t hardware_threads(void) {
  const long n = sysconf(_SC_NPROCESSORS_ONLN);
  return n > 0 ? (uint32_t)n : 1;
}

int main(int argc, char **argv) {
  static run r;
  r.p = default_params();
  const char *dir = 0;
  uint32_t threads = 0, batches = 0;
  double seconds = 0;
  genome_mix new_changes; // --changes, also for a run that continues
  int changes_given = 0;
  double new_stop = -1, new_check = -1; // --screen-stop, --screen-check, also for a run that continues
  double new_reintroduce = -1;          // --reintroduce, also for a run that continues
  int new_options = 0, stage_given = 0, screen_members_given = 0, diversity_given = 0, panel_rounds_given = 0, fill_given = 0;
  int panel_given = 0, panel_choice_given = 0;
  const char *optimize_file = 0; // --optimize: no run, the constants of this warrior
  for (int i = 1; i < argc; i++) {
    const char *a = argv[i];
    if (a[0] != '-') {
      if (dir) usage();
      dir = a;
      continue;
    }
    if (!strcmp(a, "--map-elites")) { // its value is optional: cells (the default) or crowding
      r.p.map_elites = ME_BY_STYLE;
      if (i + 1 < argc && (!strcmp(argv[i + 1], "cells") || !strcmp(argv[i + 1], "crowding")))
        r.p.map_elites = !strcmp(argv[++i], "crowding") ? ME_CROWDING : ME_BY_STYLE;
      new_options = 1;
      continue;
    }
    if (!strcmp(a, "--specialists")) { // an option without a value
      r.p.specialists = 1;
      new_options = 1;
      continue;
    }
    if (!strcmp(a, "--fill") || !strcmp(a, "--no-fill")) { // the options without a value
      r.p.fill = !strcmp(a, "--fill");
      fill_given = 1;
      new_options = 1;
      continue;
    }
    if (i + 1 >= argc) usage();
    const char *v = argv[++i];
    char *end;
    const double d = strtod(v, &end);
    const int number = *end == 0 && end != v;
    const uint32_t u = number && d >= 0 && d <= 4294967295.0 ? (uint32_t)d : 0;
    params *p = &r.p;
    int run_option = 0;
    if (!strcmp(a, "--threads")) threads = u, run_option = 1;
    else if (!strcmp(a, "--batches")) batches = u, run_option = 1;
    else if (!strcmp(a, "--seconds")) seconds = d, run_option = 1;
    else if (!strcmp(a, "--opponents")) snprintf(p->opponents, sizeof p->opponents, "%s", v);
    else if (!strcmp(a, "--start")) snprintf(p->start, sizeof p->start, "%s", v);
    else if (!strcmp(a, "--optimize")) optimize_file = v;
    else if (!strcmp(a, "--panel-files")) {
      if (!*v || strlen(v) >= sizeof p->panel_files || strstr(v, ",,") || v[strlen(v) - 1] == ',') usage();
      snprintf(p->panel_files, sizeof p->panel_files, "%s", v);
    }
    else if (!strcmp(a, "--changes")) {
      if (genome_mix_parse(&p->changes, v) != 0) {
        fprintf(stderr, "42evolve: --changes takes name=weight,... with these names:");
        for (int k = 0; k < CH_COUNT; k++) fprintf(stderr, " %s", genome_change_name(k));
        fprintf(stderr, "\n");
        return 2;
      }
      new_changes = p->changes, changes_given = 1;
    }
    else if (!strcmp(a, "--select")) {
      if (!strcmp(v, "screen")) p->select = SELECT_SCREEN;
      else if (!strcmp(v, "value")) p->select = SELECT_VALUE;
      else usage();
    } else if (!strcmp(a, "--parents")) {
      if (!strcmp(v, "value")) p->parents = PARENTS_VALUE;
      else if (!strcmp(v, "duel")) p->parents = PARENTS_DUEL;
      else usage();
    } else if (!strcmp(a, "--prior")) {
      if (!strcmp(v, "uniform")) p->prior = PRIOR_UNIFORM;
      else if (!strcmp(v, "hill")) p->prior = PRIOR_HILL;
      else usage();
    } else if (!strcmp(a, "--rotate")) {
      if (!number) usage();
      p->rotate = u;
    } else if (!strcmp(a, "--panel-choice")) {
      panel_choice_given = 1;
      if (!strcmp(v, "picked")) p->panel_random = PANEL_PICKED;
      else if (!strcmp(v, "random")) p->panel_random = PANEL_RANDOM;
      else if (!strcmp(v, "kinds")) p->panel_random = PANEL_KINDS;
      else usage();
    } else if (!strcmp(a, "--diversity")) {
      diversity_given = 1;
      if (!strcmp(v, "all")) p->distance_panel = 0;
      else if (!strcmp(v, "panel")) p->distance_panel = 1;
      else usage();
    } else if (!strcmp(a, "--sd")) {
      if (!strcmp(v, "opponent")) p->sd = SD_OPPONENT;
      else if (!strcmp(v, "sum")) p->sd = SD_SUM;
      else usage();
    } else if (!number) usage();
    else if (!strcmp(a, "--panel")) p->panel = u, panel_given = 1;
    else if (!strcmp(a, "--holdout")) p->holdout = u;
    else if (!strcmp(a, "--list")) p->list = u;
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
      p->reintroduce = new_reintroduce = d;
    }
    else if (!strcmp(a, "--race")) p->race = u;
    else if (!strcmp(a, "--race-keep")) p->race_keep = u;
    else if (!strcmp(a, "--screen-members")) p->screen_members = u, screen_members_given = 1;
    else if (!strcmp(a, "--stage")) p->stage = u, stage_given = 1;
    else if (!strcmp(a, "--panel-rounds")) p->panel_rounds = u, panel_rounds_given = 1;
    else if (!strcmp(a, "--pick-sample")) p->pick_sample = u;

    else if (!strcmp(a, "--niche")) p->niche = u;

    else if (!strcmp(a, "--noise")) {
      if (d < 0) usage();
      p->noise = d;
    }
    else if (!strcmp(a, "--screen-stop") || !strcmp(a, "--screen-check")) {
      if (!number || !(d > 0)) usage();
      if (!strcmp(a, "--screen-stop")) p->screen_stop = new_stop = d;
      else p->screen_check = new_check = d;
    }
    else if (!strcmp(a, "--sharing")) {
      if (!number || !(d > 0)) usage();
      p->sharing = d;
    }
    else if (!strcmp(a, "--fractions")) {
      if (d > 1) usage();
      p->fractions = d;
    }
    else if (!strcmp(a, "--init-length")) p->init_length = u;
    else if (!strcmp(a, "--seed")) p->seed = (uint64_t)d;
    else if (!strcmp(a, "--size")) p->rules.core_size = u;
    else if (!strcmp(a, "--cycles")) p->rules.max_cycles = u;
    else if (!strcmp(a, "--processes")) p->rules.max_processes = u;
    else if (!strcmp(a, "--length")) p->rules.max_length = u;
    else if (!strcmp(a, "--distance")) p->rules.min_distance = u;
    else usage();
    if (!run_option && strcmp(a, "--changes") && strcmp(a, "--screen-stop") && strcmp(a, "--screen-check") &&
        strcmp(a, "--reintroduce"))
      new_options = 1; // these go with a run that continues
  }
  if (!dir) usage();
  if (!threads) threads = hardware_threads();
  snprintf(r.dir, sizeof r.dir, "%s", dir);

  char state[1100], events[1100];
  snprintf(state, sizeof state, "%s/state.txt", dir);
  snprintf(events, sizeof events, "%s/events.jsonl", dir);
  const int resume = !optimize_file && access(state, F_OK) == 0;
  if (resume) {
    if (new_options) {
      fprintf(stderr,
              "42evolve: %s has a run; only --threads, --batches, --seconds, --changes, --reintroduce, --screen-stop and "
              "--screen-check go with it\n",
              dir);
      return 2;
    }
    if (load_state(&r, state) != 0) return 1;
    build_style(&r);
    load_starts(&r);
    const long size = state_events_size(state);
    if (size < 0 || truncate(events, size) != 0) {
      fprintf(stderr, "42evolve: cannot cut %s to the state\n", events);
      return 1;
    }
  } else {
    params *p = &r.p;
    if (!p->opponents[0]) usage();
    if (!p->batch) p->batch = 4 * threads;
    if (!p->survivors) p->survivors = p->batch / 8 ? p->batch / 8 : 1;
    if (!p->race_keep) p->race_keep = p->batch / 4 ? p->batch / 4 : 1;
    // --stage by default at the screen rounds (--stage 0: none); a state keeps
    // the value, and states from before --stage have none
    if (!stage_given) p->stage = p->screen_rounds;
    // the defaults of the later options, for new runs only (a state before
    // them has none of them): the best run of E5
    if (!screen_members_given) p->screen_members = 10;
    if (!diversity_given) p->distance_panel = 1;
    if (!panel_rounds_given) p->panel_rounds = p->rounds > 500 ? p->rounds : 500;
    if (p->map_elites) { // the cells give the diversity: many random opponents rather than a few picked ones
      if (!panel_given) p->panel = 80;
      if (!panel_choice_given) p->panel_random = PANEL_RANDOM;
      if (!panel_rounds_given) p->panel_rounds = p->rounds > 125 ? p->rounds : 125;
    }
    if (!fill_given) p->fill = 1;
    if (p->rules.max_length < 1 || p->rules.max_length > GENOME_MAX || !p->list || !p->rounds || !p->init_length ||
        p->screen_rounds > p->rounds || p->rules.core_size < 2 * p->rules.min_distance ||
        (p->stage && p->stage < p->screen_rounds) || (p->panel_rounds && p->panel_rounds < p->rounds) ||
        (p->map_elites == ME_CROWDING && (p->list < 2 || p->list > ME_MAX)) ||
        (p->sharing > 0 && (p->rotate || p->map_elites)) || (p->screen_stop > 0 && p->screen_check > 0) ||
        ((p->screen_stop > 0 || p->screen_check > 0) && (p->race || p->map_elites))) {
      fprintf(stderr,
              "42evolve: a parameter is out of range (length 1..%d, list, rounds >= screen rounds, stage >= screen "
              "rounds, panel rounds >= rounds, list 2..256 with crowding, --sharing not with --rotate or --map-elites, ...)\n",
              GENOME_MAX);
      return 2;
    }
    p->rules.rounds = p->rounds;
    p->rules.warriors = 2;
    if (mkdir(dir, 0777) != 0 && errno != EEXIST) {
      fprintf(stderr, "42evolve: cannot make %s\n", dir);
      return 1;
    }
    uint32_t count;
    char **names = opponent_files(&r, &count);
    if (!p->panel_files[0] && p->panel_random != PANEL_RANDOM && !optimize_file) {
      pool_start(&r.pool, threads, &r.p.rules);
      r.pool_up = 1;
      pick_panel(&r, names, count);
    }
    const uint32_t pn = count < p->panel ? count : p->panel;
    const uint32_t hn = count - pn < p->holdout ? count - pn : p->holdout;
    if (pn < 2) {
      fprintf(stderr, "42evolve: %s has fewer than 2 warriors that fit the rules\n", p->opponents);
      return 1;
    }
    load_list(&r, &r.panel, &r.panel_n, names, pn, PANEL, 0);
    load_list(&r, &r.hold, &r.hold_n, names + pn, hn, HOLDOUT, pn);
    for (uint32_t i = 0; i < pn + hn; i++) free(names[i]);
    r.reserve = names; // the rest, for --rotate
    r.reserve_n = count - pn - hn;
    memmove(r.reserve, names + pn + hn, r.reserve_n * sizeof *r.reserve);
    r.next_id = (uint64_t)pn + hn;
    r.best_id = NO_ID;
    r.best_holdout = -1;
    setup_matrix(&r);
    build_style(&r);
    load_starts(&r);
  }

  r.events = fopen(events, resume ? "ab" : "wb");
  if (!r.events) {
    fprintf(stderr, "42evolve: cannot write %s\n", events);
    return 1;
  }
  int status;
  m42_ctx *probe = m42_new(&r.p.rules, &status);
  if (!probe) {
    fprintf(stderr, "42evolve: %s\n", m42_status_text(status));
    return 2;
  }
  m42_free(probe);
  if (!r.pool_up) pool_start(&r.pool, threads, &r.p.rules);
  {
    int st;
    r.sm = m42_new(&r.p.rules, &st);
    const size_t wsize = r.sm ? m42_watch_size(&r.p.rules) : 0;
    r.swatch_mem = wsize ? xmalloc(wsize) : 0;
    r.swatch = r.swatch_mem ? m42_watch_attach(r.sm, r.swatch_mem, wsize, &st) : 0;
    if (!r.swatch) {
      fprintf(stderr, "42evolve: no engine with a watch for the style: %s\n", m42_status_text(st));
      return 1;
    }
  }
  signal(SIGINT, on_signal);
  signal(SIGTERM, on_signal);

  if (optimize_file) {
    const int rc = optimize(&r, optimize_file);
    pool_stop(&r.pool);
    fclose(r.events);
    return rc;
  }
  if (!resume) {
    event_start(&r);
    event_pick(&r);
    // with --stage each match in two parts, the first stage's rounds and the rest
    const uint32_t whole = panel_rounds(&r.p), s1 = stage_rounds(&r.p), parts = s1 < whole ? 2 : 1;
    unit *u = xmalloc((size_t)r.panel_n * r.panel_n * parts * sizeof *u);
    uint32_t n = 0;
    for (uint32_t a = 0; a < r.panel_n; a++)
      for (uint32_t b = 0; b < a; b++) {
        u[n++] = (unit){r.panel[a].w, r.panel[b].w, seed_for(&r, r.panel[b].id), 0, s1, {{0}}, 0, 0};
        if (parts == 2) u[n++] = (unit){r.panel[a].w, r.panel[b].w, seed_for(&r, r.panel[b].id), s1, whole - s1, {{0}}, 0, 0};
      }
    pool_run(&r.pool, u, n);
    n = 0;
    for (uint32_t a = 0; a < r.panel_n; a++)
      for (uint32_t b = 0; b < a; b++, n += parts) {
        set_result(&r, a, b, parts == 2 ? add_scores(u[n].s[0], u[n + 1].s[0]) : u[n].s[0]);
        if (parts == 2) set_result1(&r, a, b, u[n].s[0]);
      }
    free(u);
    rebuild_active(&r);
    compute_values(&r);
    event_panel(&r);
    save_state(&r);
  } else {
    fprintf(r.events, "{\"type\":\"resume\",\"batch\":%u}\n", r.batch);
    if (changes_given) { // the weights of the changes from now on; the run is no longer the one without a break
      r.p.changes = new_changes;
      char mix[CH_COUNT * 32];
      genome_mix_text(&r.p.changes, mix, sizeof mix);
      fprintf(r.events, "{\"type\":\"changes\",\"batch\":%u,\"changes\":\"%s\"}\n", r.batch, mix);
    }
    if (new_reintroduce >= 0) { // how often a warrior of the archive comes back, from now on
      r.p.reintroduce = new_reintroduce;
      fprintf(r.events, "{\"type\":\"reintroduce\",\"batch\":%u,\"reintroduce\":%.17g}\n", r.batch, r.p.reintroduce);
    }
    if (new_stop > 0 || new_check > 0) { // the screen from now on
      if (new_stop > 0) r.p.screen_stop = new_stop, r.p.screen_check = 0;
      if (new_check > 0) r.p.screen_check = new_check, r.p.screen_stop = 0;
      fprintf(r.events, "{\"type\":\"screen-options\",\"batch\":%u,\"screenStop\":%.17g,\"screenCheck\":%.17g}\n", r.batch,
              r.p.screen_stop, r.p.screen_check);
    }
  }
  fprintf(stderr, "42evolve: %s, %u panel and %u holdout warriors, %u threads, batch %u\n", dir, r.panel_n, r.hold_n,
          threads, r.batch);

  const double t0 = now();
  for (uint32_t done = 0; !stop_now && (!batches || done < batches) && (!seconds || now() - t0 < seconds); done++) {
    if (r.p.map_elites) {
      me_batch(&r);
      save_state(&r);
      const int b = me_best(&r);
      if (b >= 0)
        fprintf(stderr, "batch %u: %u of %d places, best %.1f against the panel (%s), best holdout %.1f\n", r.batch - 1,
                me_filled(&r), me_slots(&r), r.me_avg[b], r.me[b]->name, r.best_holdout);
      continue;
    }
    run_batch(&r);
    save_state(&r);
    const pushoff_value *best = 0;
    for (uint32_t i = r.panel_n; i < r.active_n; i++)
      if (!best || r.values[i].value > best->value) best = &r.values[i];
    if (best)
      fprintf(stderr, "batch %u: %u members, best value %.1f (%s, avg %.1f), best holdout %.1f\n", r.batch - 1,
              members(&r), best->value, r.slot[best->index]->name, best->avg, r.best_holdout);
  }
  pool_stop(&r.pool);
  fclose(r.events);
  return 0;
}
