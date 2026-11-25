// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// 42evolve: evolves Redcode warriors against a panel of hill warriors, with
// a list kept by diversity push-off (#142, docs/evolver.md).
//
//   42evolve <run folder> --opponents <dir> [options]   a new run
//   42evolve <run folder> [--threads N] [--batches N] [--seconds S]
//            [--changes name=weight,...] [--reintroduce p] [--list N (larger)] [--tune-novel N]
//            [--screen-stop z | --screen-check z]
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
#include <stddef.h>
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
#include "gen-change.h"
#include "genome.h"
#include "names.h"
#include "pushoff.h"
#include "rng.h"
#include "style.h"

#define ARCHIVE_MAX 256
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
  char holdout_files[32768]; // --island-panels own: the holdout all islands share, as panel_files; "" the next after the panel
  int fill;                 // --fill: random warriors until the list is full, not only in the first batch
  uint32_t panel_rounds;    // --panel-rounds: rounds of a match against a panel warrior, 0 as --rounds
  int distance_panel;       // --diversity panel: the push-off's SD-score over the panel's columns only
  int average_panel;        // --average panel: the push-off's average over the panel's columns only
  int member_games_none;    // --member-games none: members never play each other (with --average panel --diversity panel)
  int simple;               // --simple: a candidate plays the panel only and stops when it cannot make it onto the hill
  int difference;           // --difference: DIFF_ABS, DIFF_AHEAD (a column only where the warrior scores more) or DIFF_SHAPE (#167)
  int pareto;               // --pushoff pareto: fronts on panel average and average against members (NSGA-II); 2 with age, 3 with SD-score
  int mirror;               // --positions mirror: each position twice, the second time with the warriors swapped
  double clear;             // --clear R: with a pareto push-off, a member within SD-score R of a stronger one goes behind the fronts, 0 off
  uint64_t draw_seed;       // the order of the opponent folder, so the panel and the holdout: --draw-seed, else the seed
  int panel_random;         // --panel-choice: PANEL_PICKED (pick_panel()), PANEL_RANDOM drawn with the seed, PANEL_KINDS
  double screen_stop;       // --screen-stop z: a child stops its screen when z standard errors cannot get it past (0 off)
  double screen_check;      // --screen-check z: plays the whole screen, logs what --screen-stop z would have done
  uint32_t tune_novel;      // --tune-novel N: every N batches the constants of the most novel survivor that left, 0 never
  uint32_t pick_sample;     // --pick-sample: warriors of the round robin of pick_panel(), 0 PICK_SAMPLE
  int gen;                  // --genome gen: a warrior's genome is a generator (generator.h), not the list of its instructions
  double refactor;          // --refactor p: each batch a member's generator gets another structure for the same warrior with probability p
  uint32_t min_length;      // --min-length N: a child with fewer instructions that are not DAT.F $0, $0 is not played; 0 none
  double tie;               // --tie-points t: what a tie counts in the screen, the values and the push-off (a win 3); scores against the hill stay 3/1/0
} params;

enum { PARENTS_VALUE, PARENTS_DUEL };

enum { PANEL_PICKED, PANEL_RANDOM, PANEL_KINDS }; // --panel-choice

enum { PRIOR_UNIFORM, PRIOR_HILL };

enum { SELECT_SCREEN, SELECT_VALUE };

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
  uint32_t origin; // members: the batch its line started (--pushoff pareto's age): a parent's, or born for a new family
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
} worker;

// The matches of one call of pool_run(): several threads (islands that play a
// batch at the same time) can each have one in the pool. Its counters are
// those of its own matches.
typedef struct job {
  unit *units;
  uint32_t n, next, finished;
  struct job *after; // the next job with matches not handed out yet
  pthread_cond_t done;
  uint64_t instructions, rounds;
} job;

// The threads play the matches of the jobs in the order they came, every
// thread of the pool; the threads that called pool_run() wait for theirs.
struct pool {
  pthread_mutex_t mutex;
  pthread_cond_t work;
  job *head, *tail;
  int quit;
  int mirror; // --positions mirror (play())
  uint32_t threads;
  worker *w;
  double busy; // seconds all threads spent in matches, under the mutex
};

// What a run measures of its batches (the event speed): how busy the pool's
// threads were (all of them, for every caller), and the instructions and
// rounds of the matches this thread asked for (an island's own).
typedef struct {
  double busy, wall;
  uint64_t instructions, rounds;
} speed;
static _Thread_local speed pool_mine;

static double now(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec + ts.tv_nsec * 1e-9;
}

// Rounds first + 1 .. first + rounds of the match of w0 and w1, swapped:
// w1 the first warrior. The scores stay in the order w0, w1.
static int play_rounds(worker *w, unit *u, uint32_t first, uint32_t rounds, int swapped) {
  if (!rounds) return M42_OK;
  m42_match_options o = m42_match_options_default();
  o.rounds = rounds;
  o.first_round = first;
  o.seed = u->seed;
  const m42_warrior *ws[2] = {swapped ? u->w1 : u->w0, swapped ? u->w0 : u->w1};
  m42_score s[2];
  uint64_t ins = 0;
  const int st = m42_match(w->m, ws, 2, &o, s, &ins);
  u->instructions += ins;
  for (int k = 0; k < 2; k++) {
    const m42_score x = s[swapped ? 1 - k : k];
    u->s[k].wins += x.wins, u->s[k].losses += x.losses, u->s[k].ties += x.ties;
  }
  return st;
}

// --positions mirror: game g of a match is round g / 2 + 1 of the seed's
// sequence (position and first mover of pMARS), with w0 as the first warrior
// when g is even and w1 when it is odd. Every position is played from both
// sides, so a warrior and its copy win exactly as many games, and the
// difference of two warriors' scores loses the noise of where they start.
// Without it: rounds first + 1 .. first + rounds as pMARS plays them.
static void play(worker *w, unit *u) {
  u->instructions = 0;
  memset(u->s, 0, sizeof u->s);
  u->status = M42_OK;
  if (!w->p->mirror) {
    u->status = play_rounds(w, u, u->first, u->rounds, 0);
  } else if (u->rounds) {
    uint32_t g = u->first, end = u->first + u->rounds;
    int st = M42_OK;
    if (g % 2) st |= play_rounds(w, u, g / 2, 1, 1), g++; // the second half of a position
    const uint32_t even = end - end % 2;
    if (even > g) {
      st |= play_rounds(w, u, g / 2, (even - g) / 2, 0);
      st |= play_rounds(w, u, g / 2, (even - g) / 2, 1);
    }
    if (end % 2 && end - 1 >= g) st |= play_rounds(w, u, (end - 1) / 2, 1, 0); // the first half of a position
    u->status = st;
  }
}

// A thread of the pool: the next match of the first job that has one.
static void *worker_main(void *arg) {
  worker *w = arg;
  pool *p = w->p;
  pthread_mutex_lock(&p->mutex);
  while (!p->quit) {
    job *j = p->head;
    if (!j) {
      pthread_cond_wait(&p->work, &p->mutex);
      continue;
    }
    unit *u = &j->units[j->next++];
    if (j->next == j->n) { // all handed out: the next job is first
      p->head = j->after;
      if (!p->head) p->tail = 0;
    }
    pthread_mutex_unlock(&p->mutex);
    const double t0 = now();
    play(w, u);
    const double dt = now() - t0;
    pthread_mutex_lock(&p->mutex);
    j->instructions += u->instructions, j->rounds += u->rounds;
    p->busy += dt;
    if (++j->finished == j->n) pthread_cond_broadcast(&j->done);
  }
  pthread_mutex_unlock(&p->mutex);
  return 0;
}

static void pool_start(pool *p, uint32_t threads, const m42_rules *rules) {
  memset(p, 0, sizeof *p);
  pthread_mutex_init(&p->mutex, 0);
  pthread_cond_init(&p->work, 0);
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
    // every one a thread of its own: the callers of pool_run() wait for their matches
    if (pthread_create(&p->w[i].t, 0, worker_main, &p->w[i]) != 0) {
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
  for (uint32_t i = 0; i < p->threads; i++) pthread_join(p->w[i].t, 0);
  for (uint32_t i = 0; i < p->threads; i++) m42_free(p->w[i].m);
  free(p->w);
}

// Plays all units on the pool's threads; the caller waits.
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
  job j = {.units = units, .n = n};
  pthread_cond_init(&j.done, 0);
  pthread_mutex_lock(&p->mutex);
  if (p->tail) p->tail->after = &j;
  else p->head = &j;
  p->tail = &j;
  pthread_cond_broadcast(&p->work);
  while (j.finished < j.n) pthread_cond_wait(&j.done, &p->mutex);
  pthread_mutex_unlock(&p->mutex);
  pthread_cond_destroy(&j.done);
  pool_mine.instructions += j.instructions, pool_mine.rounds += j.rounds;
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
  char label[32]; // before "batch" on stderr: the island's name, else empty
  pool *pool;  // the threads: own, or shared by the islands of one process (--islands)
  pool own;
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
  uint32_t list_grow;         // --list on a run that continues: the list grows to this before the matrix is made, 0 not
  genome tuned;               // --tune-novel: a tuned warrior, the first candidate of the next batch when tuned_ready
  int tuned_ready;
  uint64_t tuned_from;        // the survivor it was tuned from
  genome *migr;               // --migrate: the best members of the other islands, played first in the next batch
  uint64_t *migr_id;
  uint32_t *migr_noun, migr_n;
  genome *donor;              // the change loop (#182): the best member of each other island before this round
  uint32_t donor_n, donor_cap;
  uint32_t tuned_noun;
  double *sigma;
  pushoff_value *values;
  uint32_t *active, active_n;

  uint32_t batch;
  uint64_t next_id;
  double best_holdout;
  uint64_t best_id;
  genome best_g;   // the warrior of best.red (for --islands, which scores it against the whole folder)
  int best_g_set;

  genome archive[ARCHIVE_MAX];
  uint64_t archive_id[ARCHIVE_MAX];
  uint32_t archive_noun[ARCHIVE_MAX];
  uint32_t names[NAME_ADJECTIVES * NAME_NOUNS]; // warriors that got each name so far
  uint32_t archive_n, archive_next;
  uint64_t seen[SEEN_MAX];
  uint32_t seen_n, seen_next;
} run;

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
  r->se[a * c + b] = pushoff_se(sa.wins, sa.ties, sa.wins + sa.losses + sa.ties, r->p.tie);
  r->se[b * c + a] = pushoff_se(sb.wins, sb.ties, sb.wins + sb.losses + sb.ties, r->p.tie);
}

// The same for the results of the first stage (--stage).
static void set_result1(run *r, uint32_t a, uint32_t b, m42_score sa) {
  const uint32_t c = r->cap;
  m42_score sb = {sa.losses, sa.wins, sa.ties};
  r->wlt1[a * c + b] = sa;
  r->wlt1[b * c + a] = sb;
  r->pts1[a * c + b] = points_of_t(sa, r->p.tie);
  r->pts1[b * c + a] = points_of_t(sb, r->p.tie);
  r->se1[a * c + b] = pushoff_se(sa.wins, sa.ties, sa.wins + sa.losses + sa.ties, r->p.tie);
  r->se1[b * c + a] = pushoff_se(sb.wins, sb.ties, sb.wins + sb.losses + sb.ties, r->p.tie);
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
static const char *difference_name(int d) { return d == DIFF_SHAPE ? "shape" : d == DIFF_AHEAD ? "ahead" : "abs"; }

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
static void clear_members(const run *r, const double *pts, const double *se, uint8_t *cleared) {
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
                                        r->sigma, se, r->p.noise, r->p.distance_panel ? r->keep : 0, r->p.sd, r->p.difference);
      if (d < r->p.clear) cleared[i] = 1;
    }
  }
  free(order);
}

// --pushoff pareto: instead of average * distance, the members' value is
// their place in NSGA-II's order (Deb et al. 2002) on two objectives: the
// average against the panel and the average against the other members.
// pareto-age adds the youth of their line (Schmidt and Lipson 2011,
// age-fitness Pareto optimization), r->batch - origin smaller is better; in
// pareto30 (17th November 2026) that left 73 to 80 of 80 members on the
// first front, and the crowding alone decided. pareto-sd adds the SD-score
// to the nearest warrior instead (diversity as an objective, Mouret and
// Doncieux 2012): on long30's list of 18th November 32 of 80 were on the
// first front with it, 78 with the age. value = 10 (F - f) +
// min(crowding, 5) with F fronts and f the warrior's, 0 the first: the
// lowest value is the most crowded of the last front, and a tournament by
// value is NSGA-II's crowded comparison. A copy of a warrior has its point
// and crowding 0, and leaves first. Panel warriors keep their values.
static void pareto_values(run *r, const double *pts, const double *se) {
  if (!r->p.pareto) return;
  const uint32_t P = r->panel_n, n = r->active_n > P ? r->active_n - P : 0;
  if (!n) return;
  const uint32_t m = r->p.pareto >= 2 ? 3 : 2; // pareto-age: the youth of the line too; pareto-sd: the SD-score
  double *obj = xmalloc(3 * n * sizeof *obj), *crowd = xmalloc(n * sizeof *crowd);
  uint32_t *front = xmalloc(n * sizeof *front), *at = xmalloc(n * sizeof *at), won = 0;
  uint8_t *cleared = xmalloc(n);
  clear_members(r, pts, se, cleared);
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
    if (r->p.pareto == 2) obj[m * j + 2] = (double)r->slot[a]->origin;      // a later start is a younger line
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
  pushoff_values(r->pts, r->cap, r->active, r->active_n, r->p.sd, r->p.alpha, r->p.noise > 0 ? r->se : 0, r->p.noise,
                 r->p.distance_panel ? r->keep : 0, r->p.difference, r->sigma, r->values);
  panel_average_values(r, r->pts);
  pareto_values(r, r->pts, r->p.noise > 0 ? r->se : 0);
}

// The same on the results of the first stage (--stage).
static void compute_values1(run *r) {
  pushoff_values(r->pts1, r->cap, r->active, r->active_n, r->p.sd, r->p.alpha, r->p.noise > 0 ? r->se1 : 0, r->p.noise,
                 r->p.distance_panel ? r->keep : 0, r->p.difference, r->sigma, r->values);
  panel_average_values(r, r->pts1);
  pareto_values(r, r->pts1, r->p.noise > 0 ? r->se1 : 0);
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
          ",\"select\":\"%s\",\"rotate\":%u,\"fractions\":%.17g,\"race\":%u,\"raceKeep\":%u,\"prior\":\"%s\","
          "\"parents\":\"%s\",\"screenMembers\":%u,\"noise\":%.17g,\"stage\":%u,\"fill\":%s,\"panelRounds\":%u,\"diversity\":\"%s\",\"panelChoice\":\"%s\",\"screenStop\":%.17g,\"screenCheck\":%.17g,\"tuneNovel\":%u,\"average\":\"%s\",\"memberGames\":\"%s\",\"simple\":%s,\"drawSeed\":%" PRIu64 ",\"difference\":\"%s\",\"pushoff\":\"%s\",\"positions\":\"%s\",\"clear\":%.17g,\"genome\":\"%s\",\"refactor\":%.17g,\"minLength\":%u,\"tiePoints\":%.17g},"
          "\"opponents\":",
          m42_version(), p->rules.core_size, p->rules.max_cycles, p->rules.max_processes, p->rules.max_length,
          p->rules.min_distance, r->panel_n, r->hold_n, p->list, p->batch, p->survivors, p->rounds, p->screen_rounds,
          p->bench_every, p->bench_rounds, p->init_length, p->screen_factor, p->alpha, p->reintroduce,
          p->sd == SD_SUM ? "sum" : "opponent", p->seed, p->select == SELECT_VALUE ? "value" : "screen", p->rotate,
          p->fractions, p->race, p->race_keep, p->prior == PRIOR_HILL ? "hill" : "uniform",
          p->parents == PARENTS_DUEL ? "duel" : "value", p->screen_members, p->noise, p->stage,
          p->fill ? "true" : "false", panel_rounds(p), p->distance_panel ? "panel" : "all",
          p->panel_files[0]                 ? "files"
          : p->panel_random == PANEL_RANDOM ? "random"
          : p->panel_random == PANEL_KINDS  ? "kinds"
                                            : "picked",
          p->screen_stop, p->screen_check, p->tune_novel,
          p->average_panel ? "panel" : "all", p->member_games_none ? "none" : "all", p->simple ? "true" : "false", p->draw_seed,
          difference_name(p->difference), p->pareto == 3 ? "pareto-sd" : p->pareto == 2 ? "pareto-age" : p->pareto ? "pareto" : "value", p->mirror ? "mirror" : "pmars", p->clear, p->gen ? "gen" : "list", p->refactor, p->min_length, p->tie);
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
  for (uint32_t k = 0; k < r->panel_n; k++) fprintf(f, "%s%.4f", k ? "," : "", points_t(row[k].s[0], r->p.simple ? panel_rounds(&r->p) : r->p.screen_rounds, r->p.tie));
  fprintf(f, "],\"style\":{\"kind\":\"%s\",\"copies\":%.6f,\"moved\":%.6f,\"written\":%.6f,\"whole\":%.6f,\"read\":%.6f,"
          "\"tasks\":%.6f,\"alive\":%.6f,\"measured\":%.6f}",
          style_kind_name(w->style_kind), w->st.copies, w->st.moved, w->st.written, w->st.whole, w->st.read, w->st.tasks,
          w->st.alive, w->st.measured);
  fprintf(f, ",\"raceKey\":%.6f,\"rival\":%" PRId64 ",\"parentDifference\":%.6f,\"newFamily\":%s,\"origin\":%u,\"code\":",
          race_key, rival == NO_ID ? (int64_t)-1 : (int64_t)rival, w->parent_difference, w->new_family ? "true" : "false",
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
  const char *gone; // '-': the option, 0 for a place whose value says nothing (--race-keep)
} param_field;
#define PF(t, f) {t, offsetof(params, f), 0}
#define GONE(o) {'-', 0, o}
static const param_field param_fields[] = {
    PF('u', panel), PF('u', holdout), PF('u', list), PF('u', batch), PF('u', survivors), PF('u', rounds),
    PF('u', screen_rounds), PF('u', bench_every), PF('u', bench_rounds), PF('u', init_length), PF('g', screen_factor),
    PF('g', alpha), PF('g', reintroduce), PF('d', sd), PF('q', seed), PF('d', select), PF('u', rotate),
    PF('g', fractions), PF('u', race), PF('u', race_keep), PF('d', prior), PF('d', parents), PF('u', screen_members),
    PF('g', noise), PF('u', stage), PF('d', fill), PF('u', panel_rounds), PF('d', distance_panel), GONE("--niche"),
    GONE("--map-elites"), GONE("--specialists"), GONE("--sharing"), PF('g', screen_stop), PF('g', screen_check),
    PF('u', tune_novel), PF('d', average_panel), PF('d', member_games_none), PF('d', simple), PF('q', draw_seed),
    PF('d', difference), PF('d', pareto), PF('d', mirror), PF('g', clear), PF('d', gen), PF('g', refactor),
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
  for (uint32_t i = 0; i < r->reserve_n; i++) fprintf(f, "reserve %s\n", r->reserve[i]);
  fprintf(f, "reserve-next %u\nrotate-next %u\n", r->reserve_next, r->rotate_next);
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
  if (r->tuned_ready) { // --tune-novel: the warrior the next batch starts with
    genome_save(&r->tuned, text, sizeof text);
    fprintf(f, "tuned %" PRIu64 " %u %s\n", r->tuned_from, r->tuned_noun, text);
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
  int ok = 0, refused = 0;
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
      w->origin = w->born; // a state from before --pushoff pareto has no origin line
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
    } else if (!strncmp(line, "tuned ", 6)) { // --tune-novel: the warrior the next batch starts with
      int used = 0;
      if (sscanf(line + 6, "%" SCNu64 " %u %n", &r->tuned_from, &r->tuned_noun, &used) != 2 || r->tuned_noun >= NAME_NOUNS ||
          genome_load(&r->tuned, line + 6 + used, p->rules.core_size, 0) != 0)
        goto bad;
      r->tuned_ready = 1;
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
  compute_values(r);
  ok = 1;
bad:
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
  int out;         // --race: dropped after the first screen rounds; --screen-stop: stopped
  int would_stop;  // --screen-check: --screen-stop would have stopped it
  int why;         // --simple: what stopped it (SIMPLE_STRENGTH, ...), 0 nothing
  uint32_t played; // rounds of its screen against each opponent
  uint32_t stop_at; // --screen-stop, --screen-check: the rounds after which it stopped (would have), 0 not
  int reached;     // 0 bred, 1 evaluated (not a repeat), 2 past the screen, 3 still in the list after its batch
  double race_key; // --race: the key after the first screen rounds
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

static speed pool_speed(pool *p) {
  speed s = pool_mine;
  pthread_mutex_lock(&p->mutex);
  s.busy = p->busy;
  pthread_mutex_unlock(&p->mutex);
  return s;
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
// standard deviations are those of the last compute_values(). With --difference
// ahead only where the candidate scores more, with shape less the shift, as
// the push-off counts it.
static double estimated_distance(const run *r, const unit *row, uint32_t rounds) {
  double best = INFINITY;
  double *x = xmalloc(r->panel_n * sizeof *x), *w = xmalloc(r->panel_n * sizeof *w);
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    double num = 0, den = 0, sum = 0, c = 0;
    if (r->p.difference == DIFF_SHAPE) {
      uint32_t m = 0;
      for (uint32_t k = 0; k < r->panel_n; k++) {
        if (k == o || (r->p.sd != SD_SUM && !(r->sigma[k] > 0))) continue;
        x[m] = points_t(row[k].s[0], rounds, r->p.tie) - r->pts[o * r->cap + k];
        w[m++] = r->p.sd == SD_SUM ? 1 : 1 / r->sigma[k];
      }
      c = pushoff_shift(x, w, m);
    }
    for (uint32_t k = 0; k < r->panel_n; k++) {
      if (k == o) continue;
      double d = points_t(row[k].s[0], rounds, r->p.tie) - r->pts[o * r->cap + k] - c;
      d = r->p.difference == DIFF_AHEAD ? (d > 0 ? d : 0) : fabs(d);
      if (r->p.sd == SD_SUM) num += d, den += r->sigma[k];
      else if (r->sigma[k] > 0) sum += d / r->sigma[k];
    }
    const double dist = r->p.sd == SD_SUM ? (den > 0 ? num / den : 0) : sum;
    if (dist < best) best = dist;
  }
  free(x), free(w);
  if (best == INFINITY) best = 0;
  return with_alpha(r, best);
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
  pool_run(r->pool, u, n);
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
  for (uint32_t j = 0; j < q; j++) s += points_t(row[j].s[0], rounds, r->p.tie);
  x->screen = q ? s / q : 0;
  x->dist = estimated_distance(r, row, rounds);
  x->estimate = x->screen * x->dist;
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

// --simple: a candidate plays the panel only, in checkpoints of 5, S, 5 S and
// all F rounds (S the screen rounds, F the panel rounds), and after each one
// it stops when it cannot make it onto the hill:
//   strength  its average cannot reach the gate, screen_factor of the weakest
//             member's average (the product average * SD-score has no floor of
//             its own: a warrior that loses everywhere is unlike everybody)
//   twin      after S rounds its results against every panel warrior are those
//             of a member in its first S rounds (the same seeds): it plays
//             like that member
//   value     its push-off value cannot reach the cut, the list-th largest of
//             the members' values and the lower bounds of the candidates still in
// A candidate that plays all F rounds enters, and the push-off decides. The
// bounds, after n of F rounds: a_k its points per 100 rounds against panel
// warrior k, e_k = sqrt(v_k (F - n) / (F n)) the standard deviation of what
// it ends with there (v_k as in screen_bounds()). Its average lies within z
// sqrt(sum e_k^2) / P. Its SD-score to a warrior b is D = sum |a_k - b_k| /
// sigma_k, each difference without the error's share (sqrt(d^2 - e_k^2), 0
// below e_k: after 5 rounds the error alone would make every candidate look
// unlike everybody). An error moves a column by at most itself, so D after
// all rounds is below D + z sqrt(sum (e_k / sigma_k)^2) about as surely as z
// says; the lower bound takes z e_k off every column. The upper bound leaves
// out the members whose panel average is at most the candidate's upper bound:
// the push-off may drop such a member for it, and the candidate then has that
// member's distance to the others. The cut counts the members' values from
// before the candidate entered; a near twin of a member would bring both
// values down, and the one of the two that stays gets the old value back.
// With those members in the bound, 136 of 920 candidates stopped by value
// stayed in a '94nop run, 8 without (#162, docs/evolver.md). The 8: after a
// push-off with many newcomers the list-th value can be below the cut. The
// value's bounds are the products.
// z is --screen-stop: 3 stops a candidate that almost surely cannot make it,
// a z near 0 one whose value so far would not put it on the hill.
enum { SIMPLE_STRENGTH = 1, SIMPLE_TWIN, SIMPLE_VALUE };

typedef struct {
  double avg, hi;           // the average against the panel, its upper bound
  double value, vlo, vhi;   // average * SD-score to the nearest warrior in, its bounds
  double dist;
} simple_bound;

static uint32_t simple_checkpoints(const params *p, uint32_t *cp) {
  const uint32_t S = p->screen_rounds, F = panel_rounds(p);
  uint32_t n = 0;
  if (5 < S) cp[n++] = 5;
  if (S < F) cp[n++] = S;
  if (5 * S < F) cp[n++] = 5 * S;
  cp[n++] = F;
  return n;
}

static void simple_bounds(const run *r, const unit *row, uint32_t n, uint32_t F, double z, simple_bound *b) {
  const uint32_t P = r->panel_n;
  double *a = xmalloc(P * sizeof *a), *e = xmalloc(P * sizeof *e);
  double x = 0, s2 = 0;
  for (uint32_t k = 0; k < P; k++) {
    const m42_score sc = row[k].s[0];
    a[k] = points_t(sc, n, r->p.tie);
    e[k] = sqrt(round_variance(sc, n, r->p.tie) * (F - n) / ((double)F * n));
    x += a[k];
    s2 += e[k] * e[k];
  }
  b->avg = x / P;
  const double sd = sqrt(s2) / P, lo = b->avg - z * sd;
  b->hi = b->avg + z * sd;
  double dist = INFINITY, dlo = INFINITY, dhi = INFINITY;
  for (uint32_t i = 0; i < r->active_n; i++) {
    const uint32_t o = r->active[i];
    // a member it may outscore may leave in its place, near twins one of
    // which the push-off drops: the upper bound is to the others
    const int may_go = i >= P && panel_avg(r, o) <= b->hi;
    double d = 0, low = 0, e2 = 0;
    for (uint32_t k = 0; k < P; k++) {
      if (k == o || !(r->sigma[k] > 0)) continue;
      // the error makes a column look more different than it is: on average
      // (x + err)^2 is x^2 + e^2, so the difference is taken without e^2
      const double raw = fabs(a[k] - r->pts[o * r->cap + k]), q = e[k] / r->sigma[k];
      const double diff = raw > e[k] ? sqrt(raw * raw - e[k] * e[k]) : 0;
      d += diff / r->sigma[k];
      low += (diff > z * e[k] ? diff - z * e[k] : 0) / r->sigma[k];
      e2 += q * q;
    }
    const double high = d + z * sqrt(e2);
    if (d < dist) dist = d;
    if (low < dlo) dlo = low;
    if (high < dhi && !may_go) dhi = high;
  }
  if (dist == INFINITY) dist = dlo = dhi = 0;
  b->dist = with_alpha(r, dist);
  b->value = b->avg * b->dist;
  b->vlo = (lo > 0 ? lo : 0) * with_alpha(r, dlo);
  b->vhi = (b->hi > 0 ? b->hi : 0) * with_alpha(r, dhi);
  free(a), free(e);
}

// Whether a member's first S rounds against every panel warrior are this row.
static int simple_twin(const run *r, const unit *row) {
  for (uint32_t i = r->panel_n; i < r->active_n; i++) {
    const uint32_t m = r->active[i];
    uint32_t k = 0;
    while (k < r->panel_n) {
      const m42_score a = row[k].s[0], b = r->wlt1[m * r->cap + k];
      if (a.wins != b.wins || a.losses != b.losses || a.ties != b.ties) break;
      k++;
    }
    if (k == r->panel_n) return 1;
  }
  return 0;
}

// After `done` rounds: the scores of the candidates still in, and those that
// stop (out, or with check would_stop: they play on, the rule as if they did
// not). The members' values are those of the batch's start (r->values, not
// computed again before the last checkpoint). stops[reason]++.
static void simple_decide(const run *r, candidate *c, uint32_t B, const unit *u, const uint32_t *at, uint32_t done,
                          double z, double gate, int check, uint32_t *stops, FILE *log) {
  const params *p = &r->p;
  const uint32_t P = r->panel_n, F = panel_rounds(p);
  simple_bound *b = xmalloc(B * sizeof *b);
  double *sorted = xmalloc((B + members(r)) * sizeof *sorted);
  uint32_t on = 0;
  for (uint32_t i = P; i < r->active_n; i++) sorted[on++] = r->values[i].value;
  for (uint32_t i = 0; i < B; i++) {
    if (c[i].skip || c[i].out || c[i].would_stop) continue;
    simple_bounds(r, u + at[i], done, F, z, &b[i]);
    c[i].screen = b[i].avg, c[i].dist = b[i].dist, c[i].estimate = c[i].key = b[i].value;
    sorted[on++] = b[i].vlo;
  }
  double cut = -INFINITY; // the list-th largest of the members' values and the candidates' lower bounds
  if (on > p->list && done < F) {
    qsort(sorted, on, sizeof *sorted, by_double_down);
    cut = sorted[p->list - 1];
  }
  if (log) {
    fprintf(log, "%s{\"rounds\":%u,\"cut\":%.17g,\"rows\":[", ftell(log) ? "," : "", done, cut == -INFINITY ? -1e300 : cut);
    for (uint32_t i = 0, n = 0; i < B; i++) {
      if (c[i].skip || c[i].out || c[i].would_stop) continue;
      fprintf(log, "%s[%u", n++ ? "," : "", i);
      for (uint32_t k = 0; k < P; k++) fprintf(log, ",%u,%u,%u", u[at[i] + k].s[0].wins, u[at[i] + k].s[0].losses, u[at[i] + k].s[0].ties);
      fputc(']', log);
    }
    fputs("],\"stopped\":[", log);
  }
  uint32_t n = 0;
  for (uint32_t i = 0; i < B; i++) {
    if (c[i].skip || c[i].out || c[i].would_stop) continue;
    int why = 0;
    if (b[i].hi < gate) why = SIMPLE_STRENGTH;
    else if (done == p->screen_rounds && simple_twin(r, u + at[i])) why = SIMPLE_TWIN;
    else if (b[i].vhi < cut) why = SIMPLE_VALUE;
    if (!why) continue;
    if (log) fprintf(log, "%s[%u,%d]", n++ ? "," : "", i, why);
    if (check) c[i].would_stop = 1;
    else c[i].out = 1;
    c[i].stop_at = done;
    c[i].why = why;
    stops[why]++;
  }
  if (log) fputs("]}", log);
  free(b), free(sorted);
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
// back from the archive or were tuned.
static void event_parents(run *r, const candidate *c, uint32_t B) {
  uint64_t *pid = xmalloc(B * sizeof *pid);
  uint32_t (*pn)[4] = xmalloc(B * sizeof *pn), np = 0;
  for (uint32_t i = 0; i < B; i++) {
    if (c[i].parents[0] == NO_ID || !strcmp(c[i].ops, "reintroduce") || !strcmp(c[i].ops, "tuned")) continue;
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

typedef void (*opt_start_fn)(run *r, void *ctx, uint32_t nconst, const m42_warrior *w, double avg);
static uint32_t opt_search(run *r, genome *g_io, uint32_t passes, opt_start_fn on_start, void *ctx, FILE *log, double *avg0,
                           double *avg1, m42_warrior **out);

// --tune-novel N: the constants of a new design are not tuned yet, and it
// loses on them before its idea counts against members that have been tuned
// for thousands of batches. Every N batches, the survivor of the screen that
// entered and left again with the largest SD-score to the list (by its screen
// against the panel) gets the search of --optimize, 2 passes at most; with a
// step confirmed, it is the first candidate of the next batch (ops `tuned`).
// --optimize gained nothing on warriors that evolution had tuned, and took a
// stone with a bad step from 12.5 to 70.9 against its panel.
#define TUNE_PASSES 2

static void run_batch(run *r) {
  const params *p = &r->p;
  const uint32_t B = p->batch, P = r->panel_n;
  const double t0 = now();
  const speed s0 = pool_speed(r->pool);
  if (p->rotate && r->batch && r->batch % p->rotate == 0) rotate_panel(r);
  candidate *c = xmalloc(B * sizeof *c);
  const uint32_t core = p->rules.core_size;
  uint32_t evaluated = 0;

  // --refactor: some members get another structure for the same warrior
  // (gen_refactor()). Their warriors, and so every score, stay; their
  // children start from the new structure.
  if (p->refactor > 0)
    for (uint32_t k = r->panel_n; k < r->active_n; k++) {
      warrior *w = r->slot[r->active[k]];
      if (w->kind != MEMBER || !w->g->generated) continue;
      rng g = rng_seed(p->seed, 0x7265666163u + r->batch, w->id); // "refac"
      const char *how = 0;
      if (!rng_chance(&g, p->refactor) || !gen_refactor(&w->g->p, &g, core, p->rules.max_length, &how)) continue;
      fprintf(r->events, "{\"type\":\"refactor\",\"batch\":%u,\"id\":%" PRIu64 ",\"how\":\"%s\",\"gen\":", r->batch, w->id, how);
      char *text = generator_text(w->g, core);
      json_str(r->events, text, 0);
      free(text);
      fputs("}\n", r->events);
    }

  // breed
  // the donors of the change loop: the warriors that left (the archive) and,
  // in a run of islands, the best of the others (islands_donors())
  const genome *donors[GENOME_DONORS_MAX];
  uint32_t nd = 0;
  for (uint32_t i = 0; i < r->archive_n && nd < GENOME_DONORS_MAX; i++) donors[nd++] = &r->archive[i];
  for (uint32_t i = 0; i < r->donor_n && nd < GENOME_DONORS_MAX; i++) donors[nd++] = &r->donor[i];
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
    } else if (i == 0 && r->tuned_ready && members(r)) { // --tune-novel: the warrior tuned after the last batch
      x->g = r->tuned;
      x->parents[0] = r->tuned_from;
      x->noun = r->tuned_noun;
      strcpy(x->ops, "tuned"); // not "tune", the change of a constant by a small step
      reintro = 1; // always evaluated
      r->tuned_ready = 0;
    } else if (members(r) == 0 && r->start_n) {
      // the start warriors as they are, then mutants of them
      const uint32_t k = i % r->start_n;
      if (i < r->start_n) {
        x->g = r->starts[k];
        strcpy(x->ops, "start");
        reintro = 1; // always evaluated
        x->keep = 1;
      } else {
        genome_breed(&x->g, &r->starts[k], &r->starts[(k + 1) % r->start_n], &g, core, p->rules.max_length, &r->style,
                     &p->changes, x->ops, sizeof x->ops);
      }
      x->noun = r->start_noun[k];
    } else if (members(r) == 0 || (p->fill && members(r) < p->list && !r->start_n)) {
      genome_random(&x->g, &g, core, random_length(p, &g), &r->style);
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
      genome_breed_donors(&x->g, a->g, b->g, donors, nd, &g, core, p->rules.max_length, &r->style, &p->changes, x->ops,
                          sizeof x->ops);
      x->parents[0] = a->id;
      x->noun = a->noun;
      x->origin = a->origin;
      if (strstr(x->ops, "crossover") && b->id != a->id) {
        x->parents[1] = b->id;
        if (b->origin < x->origin) x->origin = b->origin; // the older line, as age-fitness Pareto optimization
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
  const int simple = p->simple;
  const int racing = !simple && p->race && p->race < p->screen_rounds;
  const int stepping = !simple && !racing && (p->screen_stop > 0 || p->screen_check > 0);
  const uint32_t F = simple ? panel_rounds(p) : p->screen_rounds;
  const uint32_t stage = racing ? p->race : stepping && SCREEN_STEP < F ? SCREEN_STEP : F;
  unit *u = xmalloc((size_t)B * Q * sizeof *u);
  uint32_t n = 0;
  // --simple: the whole match against the panel in checkpoints, a candidate
  // stops when it cannot make it (simple_decide()); pre: its results after
  // the first S rounds, a member's row for the twin test of later candidates
  m42_score *pre = simple ? xmalloc((size_t)B * Q * sizeof *pre) : 0;
  const int simple_check = !(p->screen_stop > 0);
  const double simple_z = simple_check ? p->screen_check : p->screen_stop;
  uint32_t simple_cp[4], simple_ncp = 0, simple_stopped[4][4] = {{0}}; // the checkpoints, and what stopped at each, by reason
  char *simple_text = 0;
  size_t simple_len = 0;
  FILE *simple_log = 0;
  if (simple) {
    simple_ncp = simple_checkpoints(p, simple_cp);
    simple_log = simple_check ? open_memstream(&simple_text, &simple_len) : 0;
    uint32_t done = 0;
    for (uint32_t k = 0; k < simple_ncp; k++) {
      screen_more(r, c, B, so, Q, u, screen_at, done, simple_cp[k] - done); // Q is P: no members in this screen
      done = simple_cp[k];
      for (uint32_t i = 0; i < B; i++) {
        if (c[i].skip || c[i].out) continue;
        c[i].played = done;
        for (uint32_t j = 0; j < Q && done == p->screen_rounds; j++) pre[screen_at[i] + j] = u[screen_at[i] + j].s[0];
      }
      simple_decide(r, c, B, u, screen_at, done, simple_z, threshold, simple_check, simple_stopped[k], simple_log);
    }
    for (uint32_t i = 0; i < B; i++) { // --screen-check: those that would have stopped played on, their scores are the whole match's
      if (c[i].skip || !c[i].would_stop) continue;
      simple_bound b;
      simple_bounds(r, u + screen_at[i], F, F, simple_z, &b);
      c[i].screen = b.avg, c[i].dist = b.dist, c[i].estimate = c[i].key = b.value;
    }
  } else {
    for (uint32_t i = 0; i < B; i++)
      for (uint32_t j = 0; j < Q && !c[i].skip; j++) {
        const warrior *o = r->slot[so[j]];
        u[n++] = (unit){c[i].w, o->w, seed_for(r, o->id), 0, stage, {{0}}, 0, 0};
      }
    pool_run(r->pool, u, n);
    for (uint32_t i = 0; i < B; i++)
      if (!c[i].skip) score_screen(r, &c[i], u + screen_at[i], Q, stage);
    for (uint32_t i = 0; i < B; i++) c[i].played = stage, c[i].stop_at = 0, c[i].would_stop = 0;
  }
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
    screen_more(r, c, B, so, Q, u, screen_at, stage, p->screen_rounds - stage);
    for (uint32_t i = 0; i < B; i++)
      if (!c[i].skip && !c[i].out) score_screen(r, &c[i], u + screen_at[i], Q, p->screen_rounds);
    free(order);
  }

  candidate **sv = xmalloc(B * sizeof *sv);
  uint32_t sn = 0;
  // --start: every start warrior enters in the first batch (the screen does not stop it; --race may drop it), the
  // push-off then cuts the list to --list; the others take the places of the survivors left (a merge of 80 islands
  // kept 13 of them with the cut of 16 survivors, 18th November 2026)
  uint32_t kept = 0;
  for (uint32_t i = 0; i < B; i++)
    if (!c[i].skip && !c[i].out && c[i].screen >= threshold) sv[sn++] = &c[i], kept += c[i].keep;
  qsort(sv, sn, sizeof *sv, by_keep_key);
  const uint32_t most = kept > p->survivors ? kept : p->survivors;
  if (!simple && sn > most) sn = most; // --simple: everyone that played the whole match
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
  const int staged = !simple && upto < p->rounds; // --simple: the whole match is played already
  unit *f = xmalloc((size_t)sn * (P + M + sn) * sizeof *f);
  uint32_t fn = 0;
  const uint32_t first = p->screen_rounds, more = (staged ? (upto > first ? upto : first) : panel_rounds(p)) - first;
  const uint32_t more_n = simple ? 0 : sn; // --simple: nothing more to play
  for (uint32_t i = 0; i < more_n; i++) {
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
      if (simple) { // the whole match, and its first S rounds for the twin test
        set_result(r, s, j, u[at + j].s[0]);
        set_result1(r, s, j, pre[at + j]);
        continue;
      }
      const m42_score sc = add_scores(u[at + j].s[0], f[fn++].s[0]);
      set_result(r, s, j, sc);
      if (staged) set_result1(r, s, j, sc);
    }
    if (p->member_games_none) { // no games against members: no results, also none left from a slot used before
      for (uint32_t k = 0; k < r->active_n; k++)
        if (r->active[k] >= P) {
          set_result(r, s, r->active[k], (m42_score){0, 0, 0});
          if (staged || simple) set_result1(r, s, r->active[k], (m42_score){0, 0, 0});
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
    if (w->new_family) w->origin = r->batch; // a new design: a new line, young for --pushoff pareto
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
  if (p->tune_novel && (r->batch + 1) % p->tune_novel == 0) { // --tune-novel
    int k = -1;
    for (uint32_t i = 0; i < sn; i++)
      if (sv[i]->reached == 2 && (k < 0 || sv[i]->dist > sv[k]->dist)) k = (int)i;
    if (k >= 0) {
      genome g = sv[k]->g;
      double a0, a1;
      const uint32_t steps = opt_search(r, &g, TUNE_PASSES, 0, 0, 0, &a0, &a1, 0);
      fprintf(r->events, "{\"type\":\"tune\",\"batch\":%u,\"from\":%" PRIu64 ",\"distance\":%.6f,\"steps\":%u,\"avg\":%.6f,"
              "\"tuned\":%.6f,\"code\":", r->batch, sv[k]->id, sv[k]->dist, steps, a0, a1);
      write_code(r->events, &g, core);
      fputs("}\n", r->events);
      if (steps) r->tuned = g, r->tuned_ready = 1, r->tuned_from = sv[k]->id, r->tuned_noun = sv[k]->noun;
    }
  }
  compute_values(r);
  event_values(r);

  if (p->bench_every && r->hold_n && (r->batch + 1) % p->bench_every == 0 && members(r)) {
    uint32_t best = r->active[P];
    for (uint32_t i = P; i < r->active_n; i++)
      if (panel_avg(r, r->active[i]) > panel_avg(r, best)) best = r->active[i];
    if (r->slot[best]->holdout < 0) bench(r, best);
  }

  if (simple) { // event `simple`: what stopped where, the rounds played of those of whole matches for all
    uint64_t played = 0, full = 0;
    uint32_t missed[4] = {0, 0, 0, 0}; // --screen-check: stayed past the batch though it would have stopped, by what
    for (uint32_t i = 0; i < B; i++) {
      if (c[i].skip) continue;
      full += (uint64_t)F * P;
      played += (uint64_t)(c[i].out ? c[i].stop_at : F) * P;
      missed[c[i].why] += c[i].would_stop && c[i].reached == 3;
    }
    fprintf(r->events, "{\"type\":\"simple\",\"batch\":%u,\"z\":%.17g,\"check\":%s,\"gate\":%.17g,\"checkpoints\":[", r->batch,
            simple_z, simple_check ? "true" : "false", threshold);
    for (uint32_t k = 0; k < simple_ncp; k++) fprintf(r->events, "%s%u", k ? "," : "", simple_cp[k]);
    fputs("],\"stopped\":[", r->events); // per checkpoint: by strength, as a twin, by value
    for (uint32_t k = 0; k < simple_ncp; k++)
      fprintf(r->events, "%s[%u,%u,%u]", k ? "," : "", simple_stopped[k][SIMPLE_STRENGTH], simple_stopped[k][SIMPLE_TWIN],
              simple_stopped[k][SIMPLE_VALUE]);
    fprintf(r->events, "],\"rounds\":%" PRIu64 ",\"full\":%" PRIu64 ",\"missed\":[%u,%u,%u]", played, full, missed[SIMPLE_STRENGTH],
            missed[SIMPLE_TWIN], missed[SIMPLE_VALUE]);
    if (simple_log) { // every row at every checkpoint, and which candidate became which warrior
      fclose(simple_log);
      fprintf(r->events, ",\"steps\":[%s],\"entered\":[", simple_text ? simple_text : "");
      free(simple_text);
      for (uint32_t i = 0, k = 0; i < B; i++)
        if (c[i].reached >= 2) fprintf(r->events, "%s[%u,%" PRIu64 "]", k++ ? "," : "", i, c[i].id);
      fputc(']', r->events);
    }
    fputs("}\n", r->events);
  }
  event_parents(r, c, B);

  const speed s1 = pool_speed(r->pool);
  const double wall = now() - t0;
  const double busy = (s1.busy - s0.busy) / (wall * r->pool->threads);
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
          r->batch, wall, r->pool->threads, busy, s1.rounds - s0.rounds, s1.instructions - s0.instructions,
          evaluated / wall, (s1.rounds - s0.rounds) / wall);

  for (uint32_t i = 0; i < B; i++) free(c[i].w);
  free(c);
  free(u);
  free(pre);
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
          "         [--reintroduce 0.02] [--init-length 10] [--seed 1] [--select screen|value] [--rotate N]\n"
          "         [--fractions p] [--race N] [--race-keep N] [--prior uniform|hill]\n"
          "         [--parents value|duel] [--start <dir>] [--changes name=weight,...]\n"
          "         [--panel-files a.red,b.red,...] [--screen-members N] [--noise z] [--stage N (screen rounds; 0 none)] [--fill]\n"
          "         [--panel-rounds N] [--diversity all|panel] [--average all|panel] [--member-games all|none] [--simple]\n"
          "         [--difference abs|ahead|shape] [--pushoff value|pareto|pareto-age|pareto-sd] [--clear R] [--positions mirror|pmars]\n"
          "         [--genome list|gen] [--refactor p] [--min-length N] [--tie-points t]\n"
          "         [--islands N [--select-after B [--keep K]] [--score-rounds R] [--migrate M [--migrate-pick best|random] [--migrate-to all|next|random|tree]]\n"
          "         [--island-variant \"options\" ...] [--island-panels shared|own] [--leaf-restart N]\n"
          "         [--nemesis-every N] [--explorers K]]\n"
          "         [--draw-seed S]\n"
                    "         [--panel-choice picked|random|kinds] [--pick-sample 300] [--no-fill]\n"
          "         [--screen-stop z | --screen-check z] [--tune-novel N]\n"
          "         [--size 8000] [--cycles 80000] [--processes 8000] [--length 100] [--distance 100]\n"
          "         [--threads N] [--batches N] [--seconds S]\n"
          "       42evolve <run folder> [--threads N] [--batches N] [--seconds S] [--changes ...] [--reintroduce p] [--list N]\n"
          "         [--tune-novel N] [--screen-stop z | --screen-check z] [--difference abs|ahead|shape]   (continue a run)\n"
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
  for (uint32_t i = 0; i < pn + hn; i++) free(names[i]);
  r->reserve = names; // the rest, for --rotate
  r->reserve_n = count - pn - hn;
  memmove(r->reserve, names + pn + hn, r->reserve_n * sizeof *r->reserve);
  r->next_id = (uint64_t)pn + hn;
  r->best_id = NO_ID;
  r->best_holdout = -1;
  setup_matrix(r);
  build_style(r);
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
  build_style(r);
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

// --migrate-to, as islands.txt keeps it: from every other island, from the
// one before only (a ring), from one other drawn, from the children in the
// tree (island_child())
enum { MIGRATE_ALL, MIGRATE_NEXT, MIGRATE_RANDOM, MIGRATE_TREE };

typedef struct {
  char dir[1000]; // shorter than a run's, for /island-NN
  uint32_t n, keep, every, selected, next_score;
  uint32_t rounds;     // --score-rounds: of each match of a score
  uint32_t migrate;    // --migrate M: every M batches each island plays the best member of every other one, 0 never
  uint32_t migrate_random, migrate_next; // --migrate-pick random: a member drawn, not the best; --migrate-to (MIGRATE_*)
  uint32_t leaf_restart; // --leaf-restart N: every N batches each leaf of the tree starts over from random warriors, 0 never
  uint32_t nemesis_every; // --nemesis-every N: every N batches the weakest island makes way for a nemesis island, 0 never
  uint32_t explorers;  // --explorers K: the last K islands take no migrants (the others may take from them)
  uint32_t since[ISLANDS_MAX]; // the batch an island started at: 0, or a nemesis island's first
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
  fprintf(f, "\nmigrate %u %u %u %u\nnemesis %u\nsince", I->migrate, I->migrate_random, I->migrate_next, I->leaf_restart, I->nemesis_every);
  for (uint32_t i = 0; i < I->n; i++) fprintf(f, " %u", I->since[i]);
  fprintf(f, "\nexplorers %u\n", I->explorers);
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
  if (ok && fscanf(f, "%u", &I->leaf_restart) != 1) I->leaf_restart = 0; // or --leaf-restart
  if (ok && fscanf(f, " nemesis %u", &I->nemesis_every) != 1) I->nemesis_every = 0; // or --nemesis-every
  int since = -1; // a state from before --nemesis-every has no line since: every island from batch 0
  if (ok && fscanf(f, " since%n", &since) >= 0 && since > 0)
    for (uint32_t i = 0; i < I->n; i++)
      if (fscanf(f, "%u", &I->since[i]) != 1) I->since[i] = 0;
  if (ok && fscanf(f, " explorers %u", &I->explorers) != 1) I->explorers = 0; // a state from before --explorers
  fclose(f);
  if (!ok) fprintf(stderr, "42evolve: %s is not a state of islands\n", path);
  return ok ? 0 : -1;
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

// --nemesis-every N: at a score every N batches, the live island with the
// lowest score (not the champion's, not a nemesis island younger than 2 N
// batches; the first on a tie) stops, its folder
// stays, and a new island takes its place: the next number, the settings of
// the one it replaces, the seed + its number - 1, the same holdout, and as
// its panel the warriors of the folder the champion (the best warrior of the
// score) does worst against, the first on a tie, none of the holdout. It
// starts from random warriors at the batch of the others, so the rounds go
// on as before, and takes no migrants for its first N batches: a strong warrior
// from another island would take over its list before anything new grows
// (others take from it as from any island); then N batches with migrants
// before it can be stopped, since a list from random warriors is weaker than
// the others for long. Event `nemesis`. The pressure follows the champion's weak
// spots: what beats it now.
static void islands_nemesis(islands *I, uint32_t batch, uint32_t champ, uint64_t champ_id, double champ_score, const double *cp,
                            const double *isl) {
  uint32_t weak = UINT32_MAX;
  for (uint32_t i = 0; i < I->n; i++)
    if (I->live[i] && i != champ && !(I->since[i] && batch < I->since[i] + 2 * I->nemesis_every) &&
        (weak == UINT32_MAX || isl[i] < isl[weak]))
      weak = i;
  if (weak == UINT32_MAX) return;
  if (I->n >= ISLANDS_MAX) {
    fprintf(stderr, "42evolve: no nemesis island: %d islands is the most\n", ISLANDS_MAX);
    return;
  }
  const run *old = I->is[weak];
  const uint32_t m = I->opp_n, want = old->panel_n;
  uint32_t *order = xmalloc(m * sizeof *order), np = 0;
  for (uint32_t o = 0; o < m; o++) {
    int held = 0;
    for (uint32_t h = 0; h < old->hold_n && !held; h++) held = !strcmp(old->hold[h].file, I->opp[o].file);
    if (held) continue;
    uint32_t j = np++; // by the champion's points, the worst first; the folder's order on a tie
    while (j > 0 && cp[order[j - 1]] > cp[o]) order[j] = order[j - 1], j--;
    order[j] = o;
  }
  if (np > want) np = want;
  run *r = xmalloc(sizeof *r);
  r->p = old->p;
  char **names = xmalloc((np + old->hold_n + 1) * sizeof *names);
  for (uint32_t k = 0; k < np; k++) names[k] = I->opp[order[k]].file;
  for (uint32_t h = 0; h < old->hold_n; h++) names[np + h] = old->hold[h].file;
  if (join_files(r->p.panel_files, sizeof r->p.panel_files, names, 0, np) != 0 ||
      join_files(r->p.holdout_files, sizeof r->p.holdout_files, names, np, np + old->hold_n) != 0) {
    fprintf(stderr, "42evolve: the names of a nemesis island's panel or holdout are too long\n");
    exit(1);
  }
  const uint32_t i = I->n++;
  I->is[i] = r;
  if (island_start(I, i, batch) != 0) exit(1); // at the batch of the others
  I->live[weak] = 0;
  I->since[i] = batch;
  FILE *f = I->root.events;
  fprintf(f, "{\"type\":\"nemesis\",\"batch\":%u,\"champion\":{\"island\":%u,\"id\":%" PRIu64 ",\"score\":%.4f},\"stopped\":%u,"
             "\"stoppedScore\":%.4f,\"island\":%u,\"panel\":[", batch, champ + 1, champ_id, champ_score, weak + 1, isl[weak], i + 1);
  for (uint32_t k = 0; k < np; k++) {
    fprintf(f, "%s{\"file\":", k ? "," : "");
    json_str(f, I->opp[order[k]].file, 0);
    fprintf(f, ",\"points\":%.4f}", cp[order[k]]);
  }
  fputs("]}\n", f);
  fflush(f);
  fprintf(stderr, "island-%02u stops (%.1f against the folder); island-%02u starts with the %u warriors island-%02u's best does worst against\n",
          weak + 1, isl[weak], i + 1, np, champ + 1);
  free(order), free(names);
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
  uint32_t *from = xmalloc((size_t)n * PER * sizeof *from); // where its matches are in u
  nu = 0;
  for (uint32_t k = 0; k < n * PER; k++) {
    sc[k] = -1;
    if (!w[k] || as[k] != k) continue;
    from[k] = nu;
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
  if (I->nemesis_every && batch % I->nemesis_every == 0 && best_k != UINT32_MAX) { // the champion's results, each opponent
    double *cp = xmalloc(m * sizeof *cp);
    for (uint32_t o = 0; o < m; o++) cp[o] = points(u[from[as[best_k]] + o].s[0], I->rounds);
    islands_nemesis(I, batch, best_k / PER, id[best_k], sc[best_k], cp, isl);
    free(cp);
  }
  for (uint32_t i = 0; i < n; i++) free(w[i * PER]); // those of best.red were made here, the others are members
  free(w), free(g), free(id), free(as), free(u), free(sc), free(isl), free(from);
}

// --migrate: before island k's batch, the member best against the panel of
// every other live island (the first on a tie) becomes a candidate of it,
// which plays first and enters whatever its screen once it is above the
// threshold, as a start warrior; one that is already in is not played again.
// --migrate-pick random: a member drawn from the seed, the batch and the two
// islands instead of the best; --migrate-to next: from the live island
// before k only (a ring, the last sends to the first); --migrate-to random:
// from one other live island drawn from the seed and the batch; --migrate-to
// tree: from its children only, so that warriors only climb toward island 1
// (Hierarchical Fair Competition, Hu and Goodman 2002). The other islands are
// as the round before left them (islands_loop() takes all migrants of a round
// before its batches), so a run is the same on any thread count and after a
// resume. Event `migrate`: [island, id].
// --migrate-to tree: the islands as a binary tree, island 1 its root, the
// children of island i (from 1) are 2i and 2i + 1; c is 0 or 1 for the
// first or second child, UINT32_MAX none (indexes from 0).
static uint32_t island_child(const islands *I, uint32_t k, uint32_t c) {
  const uint32_t j = 2 * k + 1 + c;
  return j < I->n ? j : UINT32_MAX;
}
static int island_leaf(const islands *I, uint32_t k) { return island_child(I, k, 0) == UINT32_MAX; }

static void islands_migrate(islands *I, uint32_t k) {
  run *r = I->is[k];
  if (!r->migr) {
    r->migr = xmalloc(I->n * sizeof *r->migr);
    r->migr_id = xmalloc(I->n * sizeof *r->migr_id);
    r->migr_noun = xmalloc(I->n * sizeof *r->migr_noun);
  }
  r->migr_n = 0;
  fprintf(r->events, "{\"type\":\"migrate\",\"batch\":%u,\"from\":[", r->batch);
  uint32_t before = k; // --migrate-to next: the live island before k
  if (I->migrate_next == MIGRATE_NEXT) {
    do before = (before + I->n - 1) % I->n;
    while (before != k && !I->live[before]);
  }
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
    if (I->migrate_next == MIGRATE_TREE ? j != island_child(I, k, 0) && j != island_child(I, k, 1)
                                        : I->migrate_next != MIGRATE_ALL && j != before)
      continue;
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

// --leaf-restart N: a leaf of the tree starts over: every member leaves (the
// events leave, after an event restart), the archive is forgotten, and the
// next batch fills the list with random warriors as the first one did. The
// leaves take turns: leaf j of L restarts at the batches b > 0 with b mod N =
// j N / L, so that there are always young lists of every age (the bottom
// layer of ALPS, Hornby 2006, that starts again from random). Its best.red,
// names and scores stay.
static void island_restart(islands *I, uint32_t k) {
  run *r = I->is[k];
  fprintf(r->events, "{\"type\":\"restart\",\"batch\":%u,\"members\":%u}\n", r->batch, members(r));
  compute_values(r);
  for (uint32_t i = r->panel_n; i < r->active_n; i++) event_leave(r, &r->values[i], 0);
  for (uint32_t i = r->panel_n; i < r->active_n; i++) {
    const uint32_t s = r->active[i];
    free_warrior(r->slot[s]);
    r->slot[s] = 0;
  }
  r->archive_n = r->archive_next = 0;
  r->tuned_ready = 0;
  rebuild_active(r);
  compute_values(r);
}
static int island_restarts(const islands *I, uint32_t k) {
  const uint32_t first = I->n / 2, leaves = I->n - first, b = I->is[k]->batch;
  return I->leaf_restart && island_leaf(I, k) && b && b % I->leaf_restart == (uint64_t)(k - first) * I->leaf_restart / leaves;
}

// Batches in rounds until the limits: in a round every live island plays
// its next batch, all at the same time, each on a thread of its own with its
// matches in the one pool (the serial parts of a batch, the push-off,
// entering, the style of newcomers, the events, overlap). Before a round,
// on one thread: every `every` batches the scores; every `migrate` batches
// the migrants, each island's taken from the others as they are after the
// round before; then every `leaf_restart` batches a leaf starts over. So a
// run is the same on any thread count and after a resume. A run stopped
// while its islands took turns (before rounds) may have islands a batch
// ahead: the others catch up first.
// --explorers K: the last K islands never take migrants. Each is an
// independent try, like a run of its own, that no strong design from
// elsewhere pushes out; the other islands (the core) take from all, so what
// an explorer finds is taken up and tuned there (with --island-variant, for
// example --average panel on the core).
// Whether island k takes migrants before its batch b: every --migrate
// batches, but not a leaf of the tree (it has no children), not a nemesis
// island younger than --nemesis-every, not an explorer.
// Whether island k at batch b takes from the others at all: not a leaf of
// the tree (it has no children), not a nemesis island younger than
// --nemesis-every, not an explorer.
static int island_open(const islands *I, uint32_t k, uint32_t b) {
  if (I->migrate_next == MIGRATE_TREE && island_leaf(I, k)) return 0;
  if (I->since[k] && b < I->since[k] + I->nemesis_every) return 0;
  return k < I->n - I->explorers;
}

// Whether island k takes migrants before its batch b: every --migrate batches, when it is open.
static int island_takes_migrants(const islands *I, uint32_t k, uint32_t b) {
  return I->migrate && b && b % I->migrate == 0 && island_open(I, k, b);
}

// The donors of the change loop (#182) for island k before its batch b: a
// copy of the best member against the panel (the first on a tie) of every
// other live island, as the round before left it, when k is open to the
// others and gives loop a weight; none otherwise.
static void islands_donors(islands *I, uint32_t k, uint32_t b) {
  run *r = I->is[k];
  r->donor_n = 0;
  if (!r->p.changes.w[CH_LOOP] || !island_open(I, k, b)) return;
  if (r->donor_cap < I->n) {
    free(r->donor);
    r->donor = xmalloc(I->n * sizeof *r->donor);
    r->donor_cap = I->n;
  }
  for (uint32_t j = 0; j < I->n; j++) {
    const run *o = I->is[j];
    if (j == k || !I->live[j]) continue;
    uint32_t best = UINT32_MAX;
    for (uint32_t a = o->panel_n; a < o->active_n; a++)
      if (best == UINT32_MAX || panel_avg(o, o->active[a]) > panel_avg(o, best)) best = o->active[a];
    if (best != UINT32_MAX) r->donor[r->donor_n++] = *o->slot[best]->g;
  }
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
    for (uint32_t j = 0; j < m; j++) islands_donors(I, round[j], lo);
    for (uint32_t j = 0; j < m; j++)
      if (island_restarts(I, round[j])) island_restart(I, round[j]);
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
                       uint32_t migrate_random, uint32_t migrate_next, uint32_t leaf_restart, uint32_t nemesis_every, uint32_t explorers,
                       int own_panels, uint32_t threads, uint32_t batches, double seconds) {
  static islands I;
  snprintf(I.dir, sizeof I.dir, "%s", dir);
  I.n = n, I.keep = keep, I.every = every, I.next_score = every, I.seed = base->seed, I.best = -1, I.rounds = rounds;
  I.migrate = migrate, I.migrate_random = migrate_random, I.migrate_next = migrate_next, I.leaf_restart = leaf_restart;
  I.nemesis_every = nemesis_every, I.explorers = explorers;
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
          (const char *[]){"all", "next", "random", "tree"}[migrate_next], base->seed, base->draw_seed,
          threads);
  json_str(root->events, base->opponents, 0);
  fputs(",\"panel\":", root->events);
  json_str(root->events, p.panel_files, 0);
  fprintf(root->events, ",\"islandPanels\":\"%s\",\"leafRestart\":%u,\"nemesisEvery\":%u,\"explorers\":%u", own_panels ? "own" : "shared",
          leaf_restart, nemesis_every, explorers);
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
  const int stops = p->screen_stop > 0 || p->screen_check > 0;
  if (p->rules.max_length < 1 || p->rules.max_length > GENOME_MAX) {
    snprintf(text, sizeof text, "--length 1 to %d", GENOME_MAX);
    return text;
  }
  if (!p->list || !p->rounds || !p->init_length) return "--list, --rounds and --init-length at least 1";
  if (p->screen_rounds > p->rounds) return "--screen-rounds at most --rounds";
  if (p->rules.core_size < 2 * p->rules.min_distance) return "--size at least twice --distance";
  if (p->stage && p->stage < p->screen_rounds) return "--stage at least --screen-rounds, or 0";
  if (p->panel_rounds && p->panel_rounds < p->rounds) return "--panel-rounds at least --rounds";
  if (p->simple && (p->race || p->select == SELECT_VALUE || p->rotate || p->tune_novel || p->sd == SD_SUM))
    return "--simple not with --race, --select value, --rotate, --tune-novel or --sd sum";
  if (p->simple && p->screen_rounds >= p->rounds) return "--simple: --screen-rounds below --panel-rounds";
  if (p->member_games_none && (!p->average_panel || !p->distance_panel || p->parents == PARENTS_DUEL || p->screen_members))
    return "--member-games none (also of --simple) only with --average panel and --diversity panel, not with --parents duel or "
           "--screen-members";
  if (p->difference && p->simple) return p->difference == DIFF_SHAPE ? "--difference shape not with --simple" : "--difference ahead not with --simple";
  if (p->pareto && (p->simple || p->average_panel || p->member_games_none || p->select == SELECT_VALUE))
    return "--pushoff pareto not with --simple, --average panel, --member-games none or --select value";
  // pareto-sd takes the SD-score as --difference computes it: ahead, only where a warrior scores more, makes
  // it far only when it does better than its nearest somewhere; pareto and pareto-age do not use it
  if (p->difference && p->pareto && p->pareto != 3)
    return p->difference == DIFF_SHAPE ? "--difference shape with --pushoff pareto-sd only, not pareto or pareto-age" : "--difference ahead with --pushoff pareto-sd only, not pareto or pareto-age";
  if (p->clear > 0 && !p->pareto) return "--clear with --pushoff pareto, pareto-age or pareto-sd only";
  if (p->screen_stop > 0 && p->screen_check > 0) return "--screen-stop or --screen-check, not both";
  if (p->simple && !stops) return "--simple needs --screen-stop or --screen-check above 0";
  if (stops && p->race) return "--screen-stop and --screen-check not with --race";
  if (p->tune_novel && p->gen) return "--tune-novel not with --genome gen: it changes the operands of a list";
  if (!p->gen && structure_kinds(&p->changes)) return STRUCTURE_NEEDS_GEN;
  if (p->refactor < 0 || p->refactor > 1) return "--refactor 0 to 1";
  if (p->refactor > 0 && !p->gen) return "--refactor with --genome gen only";
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
  int64_t new_tune;           // --tune-novel, also for a run that continues
  int new_ahead;              // --difference, also for a run that continues
  int new_options, stage_given, screen_members_given, diversity_given, panel_rounds_given, fill_given;
  int panel_choice_given, draw_seed_given, positions_given, pushoff_given, genome_given, migrate_given;
  int variant_default; // the variants of new_island_defaults(), not given
  uint32_t islands_n, islands_keep, islands_every, islands_rounds; // --islands, --keep, --select-after, --score-rounds
  uint32_t islands_migrate_every;                                   // --migrate
  uint32_t migrate_random, migrate_next, pick_given, to_given;      // --migrate-pick, --migrate-to
  int own_panels;                                                   // --island-panels own
  uint32_t leaf_restart;                                            // --leaf-restart
  uint32_t nemesis_every;                                           // --nemesis-every
  uint32_t explorers;                                               // --explorers
  int islands_option;
  const char *variant[ISLANDS_MAX]; // --island-variant, in their order
  uint32_t variant_n;
  const char *optimize_file; // --optimize: no run, the constants of this warrior
} cli;

// The options removed after 1.1.0 (#193): refused with a message, also in an
// --island-variant (a state that used one: load_state()).
static const char *const removed_options[] = {"--map-elites", "--specialists", "--niche", "--sharing", 0};

// Reads the command line into c; 0, or the exit code after a message.
static int parse_cli(int argc, char **argv, cli *c) {
  memset(c, 0, sizeof *c);
  c->p = default_params();
  c->new_stop = c->new_check = c->new_reintroduce = -1;
  c->new_tune = -1;
  c->new_ahead = -1;
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
    if (!strcmp(a, "--simple")) { // an option without a value
      c->p.simple = 1;
      c->new_options = 1;
      continue;
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
      else if (!strcmp(v, "pareto-age")) p->pareto = 2;
      else if (!strcmp(v, "pareto-sd")) p->pareto = 3;
      else usage();
    } else if (!strcmp(a, "--migrate-pick")) {
      if (!strcmp(v, "best")) c->migrate_random = 0;
      else if (!strcmp(v, "random")) c->migrate_random = 1;
      else usage();
      c->pick_given = c->islands_option = 1;
    } else if (!strcmp(a, "--migrate-to")) {
      if (!strcmp(v, "all")) c->migrate_next = MIGRATE_ALL;
      else if (!strcmp(v, "next")) c->migrate_next = MIGRATE_NEXT;
      else if (!strcmp(v, "random")) c->migrate_next = MIGRATE_RANDOM;
      else if (!strcmp(v, "tree")) c->migrate_next = MIGRATE_TREE;
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
    } else if (!strcmp(a, "--refactor")) {
      p->refactor = d;
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
    } else if (!strcmp(a, "--difference")) {
      if (!strcmp(v, "abs")) p->difference = c->new_ahead = DIFF_ABS;
      else if (!strcmp(v, "ahead")) p->difference = c->new_ahead = DIFF_AHEAD;
      else if (!strcmp(v, "shape")) p->difference = c->new_ahead = DIFF_SHAPE;
      else usage();
    } else if (!strcmp(a, "--sd")) {
      if (!strcmp(v, "opponent")) p->sd = SD_OPPONENT;
      else if (!strcmp(v, "sum")) p->sd = SD_SUM;
      else usage();
    } else if (!number) usage();
    else if (!strcmp(a, "--panel")) p->panel = u;
    else if (!strcmp(a, "--holdout")) p->holdout = u;
    else if (!strcmp(a, "--list")) p->list = c->new_list = u;
    else if (!strcmp(a, "--tune-novel")) p->tune_novel = u, c->new_tune = u;
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
    else if (!strcmp(a, "--race")) p->race = u;
    else if (!strcmp(a, "--race-keep")) p->race_keep = u;
    else if (!strcmp(a, "--screen-members")) p->screen_members = u, c->screen_members_given = 1;
    else if (!strcmp(a, "--stage")) p->stage = u, c->stage_given = 1;
    else if (!strcmp(a, "--panel-rounds")) p->panel_rounds = u, c->panel_rounds_given = 1;
    else if (!strcmp(a, "--pick-sample")) p->pick_sample = u;

    else if (!strcmp(a, "--noise")) {
      if (d < 0) usage();
      p->noise = d;
    }
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
    else if (!strcmp(a, "--fractions")) {
      if (d > 1) usage();
      p->fractions = d;
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
    else if (!strcmp(a, "--leaf-restart")) c->leaf_restart = u, c->islands_option = 1;
    else if (!strcmp(a, "--nemesis-every")) c->nemesis_every = u, c->islands_option = 1;
    else if (!strcmp(a, "--explorers")) c->explorers = u, c->islands_option = 1;
    else if (!strcmp(a, "--size")) p->rules.core_size = u;
    else if (!strcmp(a, "--cycles")) p->rules.max_cycles = u;
    else if (!strcmp(a, "--processes")) p->rules.max_processes = u;
    else if (!strcmp(a, "--length")) p->rules.max_length = u;
    else if (!strcmp(a, "--distance")) p->rules.min_distance = u;
    else usage();
    if (!run_option && strcmp(a, "--changes") && strcmp(a, "--screen-stop") && strcmp(a, "--screen-check") &&
        strcmp(a, "--reintroduce") && strcmp(a, "--list") && strcmp(a, "--tune-novel") && strcmp(a, "--difference"))
      c->new_options = 1; // these go with a run that continues
  }
  return 0;
}

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
  if (!p->race_keep) p->race_keep = p->batch / 4 ? p->batch / 4 : 1;
  // --stage by default at the screen rounds (--stage 0: none); a state keeps
  // the value, and states from before --stage have none
  if (p->simple) { // the value from the panel alone, no games among members; z 3 unless given
    p->average_panel = p->member_games_none = 1;
    if (!c->diversity_given) p->distance_panel = 1;
    if (c->new_stop < 0 && !(p->screen_check > 0)) p->screen_stop = 3;
  }
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
    if (params_error(p)) p->pareto = 0;
  }
  // new runs: --screen-stop 3, not where it does not go (--race): it stopped 10,639 of 17,025
  // children of kd1 in the screen, 22% of all rounds, and missed none of the 2,400 survivors (docs/evolver.md)
  if (c->new_stop < 0 && !(p->screen_check > 0)) {
    p->screen_stop = 3;
    if (params_error(p)) p->screen_stop = 0;
  }
  if (!c->draw_seed_given) p->draw_seed = p->seed;
  if (p->simple) { // one length of match, the panel rounds; its first screen rounds are kept as the first stage
    p->rounds = p->panel_rounds;
    p->stage = p->screen_rounds;
  }
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
                   w.migrate_random != c->migrate_random || w.migrate_next != c->migrate_next || w.own_panels != c->own_panels || w.leaf_restart != c->leaf_restart || w.nemesis_every != c->nemesis_every || w.explorers != c->explorers ||
                   w.optimize_file != c->optimize_file))
      differs = "--batches, --seconds, --optimize or an option of the islands";
    if (wrong || differs) {
      fprintf(stderr, "42evolve: --island-variant '%s': %s%s\n", c->variant[k], wrong ? wrong : differs,
              wrong ? "" : " the same for every island");
      rc = 2;
      break;
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
  const int changes_given = c.changes_given, new_options = c.new_options, new_ahead = c.new_ahead;
  const double new_stop = c.new_stop, new_check = c.new_check, new_reintroduce = c.new_reintroduce;
  const uint32_t new_list = c.new_list;
  const int64_t new_tune = c.new_tune;
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
      if (new_options || islands_option || changes_given || new_stop >= 0 || new_check > 0 || new_reintroduce >= 0 || new_list || new_tune >= 0 || new_ahead >= 0) {
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
              "--tune-novel, --screen-stop, --screen-check and --difference go with it\n",
              dir);
      return 2;
    }
    r.list_grow = new_list;
    if (run_resume(&r) != 0) return 1;
    if (r.p.gen && new_tune > 0) {
      fprintf(stderr, "42evolve: --tune-novel not with --genome gen: it changes the operands of a list\n");
      return 2;
    }
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
    r.p = c.p;
    params *p = &r.p;
    if (islands_n) {
      if (islands_n > ISLANDS_MAX || islands_keep >= islands_n || (islands_keep && !islands_every) || !islands_rounds || optimize_file) {
        fprintf(stderr, "42evolve: --islands 1..%d, --keep fewer than the islands and with --select-after, not with --optimize\n", ISLANDS_MAX);
        return 2;
      }
      if (islands_migrate_every && (islands_n < 2 || p->tune_novel)) {
        fprintf(stderr, "42evolve: --migrate with 2 islands or more, and not with --tune-novel\n");
        return 2;
      }
      if (c.own_panels && (islands_n < 2 || p->panel_files[0] || p->panel_random == PANEL_RANDOM)) {
        fprintf(stderr, "42evolve: --island-panels own with 2 islands or more, a panel that is picked (--panel-choice picked or kinds), not --panel-files\n");
        return 2;
      }
      if ((c.leaf_restart || c.nemesis_every) && p->start[0]) {
        fprintf(stderr, "42evolve: --leaf-restart and --nemesis-every not with --start: a list that starts over would take the start warriors again\n");
        return 2;
      }
      if (c.leaf_restart && c.migrate_next != MIGRATE_TREE) {
        fprintf(stderr, "42evolve: --leaf-restart with --migrate-to tree\n");
        return 2;
      }
      if (c.explorers && (c.explorers >= islands_n || c.migrate_next == MIGRATE_TREE || c.nemesis_every || islands_keep)) {
        fprintf(stderr, "42evolve: --explorers fewer than the islands, not with --migrate-to tree, --nemesis-every or --keep\n");
        return 2;
      }
      if (c.nemesis_every && (islands_n < 2 || !islands_every || c.nemesis_every % islands_every || islands_keep || c.migrate_next == MIGRATE_TREE)) {
        fprintf(stderr, "42evolve: --nemesis-every with 2 islands or more, a multiple of --select-after, not with --keep or --migrate-to tree\n");
        return 2;
      }
      if (c.migrate_next == MIGRATE_TREE && islands_n < 3) {
        fprintf(stderr, "42evolve: --migrate-to tree with 3 islands or more\n");
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
      for (uint32_t k = 0; k < c.variant_n; k++)
        if (islands_migrate_every && variants[k].tune_novel) {
          fprintf(stderr, "42evolve: --migrate with 2 islands or more, and not with --tune-novel\n");
          return 2;
        }
      // new runs of islands: every 5 batches a member drawn from an island drawn (gen-var16-rnd); --migrate 0: none
      int tune = p->tune_novel != 0;
      for (uint32_t k = 0; k < c.variant_n; k++) tune |= variants[k].tune_novel != 0;
      if (!c.migrate_given && islands_n >= 2 && !tune) islands_migrate_every = 5;
      if ((c.explorers || c.leaf_restart) && !islands_migrate_every) { // also where --tune-novel turned it off
        fprintf(stderr, "42evolve: --explorers and --leaf-restart need migration (not with --migrate 0 or --tune-novel)\n");
        return 2;
      }
      if (!c.pick_given) c.migrate_random = c.migrate_next != MIGRATE_TREE; // a tree: the best climbs
      if (!c.to_given) c.migrate_next = MIGRATE_RANDOM;
      signal(SIGINT, on_signal);
      signal(SIGTERM, on_signal);
      return islands_new(p, variants, c.variant, c.variant_n, dir, islands_n, islands_keep, islands_every, islands_rounds,
                         islands_migrate_every, c.migrate_random, c.migrate_next, c.leaf_restart, c.nemesis_every, c.explorers,
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
    if (new_tune >= 0) { // how often the most novel survivor that left gets tuned, from now on
      r.p.tune_novel = (uint32_t)new_tune;
      fprintf(r.events, "{\"type\":\"tune-novel\",\"batch\":%u,\"tuneNovel\":%u}\n", r.batch, r.p.tune_novel);
    }
    if (new_reintroduce >= 0) { // how often a warrior of the archive comes back, from now on
      r.p.reintroduce = new_reintroduce;
      fprintf(r.events, "{\"type\":\"reintroduce\",\"batch\":%u,\"reintroduce\":%.17g}\n", r.batch, r.p.reintroduce);
    }
    if (new_ahead >= 0) { // the push-off's difference from now on, and the values of the list with it
      r.p.difference = new_ahead;
      const char *wrong = params_error(&r.p);
      if (wrong) {
        fprintf(stderr, "42evolve: %s\n", wrong);
        return 2;
      }
      fprintf(r.events, "{\"type\":\"difference\",\"batch\":%u,\"difference\":\"%s\"}\n", r.batch, difference_name(r.p.difference));
      compute_values(&r);
      event_values(&r);
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
