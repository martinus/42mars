// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The internal header of 42evolve: what the files of the program share. The
// parameters of a run, its warriors, the matches the thread pool plays, the
// run itself, and the functions of each file that the others call. Include
// it first: it sets the POSIX version of the system headers.

#ifndef EVOLVER_EVOLVE_H
#define EVOLVER_EVOLVE_H

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
  int parents;              // PARENTS_VALUE: tournament of two by push-off value; PARENTS_DUEL: by their match
  char start[1024];         // --start: a folder of warriors the first batch starts from, "" random ones
  genome_mix changes;       // --changes: how often each kind of change is drawn
  uint32_t screen_members;  // --screen-members: the screen plays the panel and this many members
  uint32_t stage;           // --stage N: survivors play N rounds, those still in after the batch the rest; 0 all at once
  char panel_files[2048];   // --panel-files: the panel, file names in the folder, comma separated; "" drawn
  char holdout_files[32768]; // --island-panels own: the holdout all islands share, as panel_files; "" the next after the panel
  int fill;                 // --fill: random warriors until the list is full, not only in the first batch
  uint32_t panel_rounds;    // --panel-rounds: rounds of a match against a panel warrior, 0 as --rounds
  int distance_panel;       // --diversity panel: the push-off's SD-score over the panel's columns only
  int average_panel;        // --average panel: the push-off's average over the panel's columns only
  int member_games_none;    // --member-games none: members never play each other (with --average panel --diversity panel)
  int pareto;               // --pushoff pareto: fronts on panel average and average against members (NSGA-II); 3 with SD-score (2 was with age)
  int mirror;               // --positions mirror: each position twice, the second time with the warriors swapped
  double clear;             // --clear R: with a pareto push-off, a member within SD-score R of a stronger one goes behind the fronts, 0 off
  uint64_t draw_seed;       // the order of the opponent folder, so the panel and the holdout: --draw-seed, else the seed
  int panel_random;         // --panel-choice: PANEL_PICKED (pick_panel()), PANEL_RANDOM drawn with the seed, PANEL_KINDS
  double screen_stop;       // --screen-stop z: a child stops its screen when z standard errors cannot get it past (0 off)
  double screen_check;      // --screen-check z: plays the whole screen, logs what --screen-stop z would have done
  uint32_t pick_sample;     // --pick-sample: warriors of the round robin of pick_panel(), 0 PICK_SAMPLE
  int gen;                  // --genome gen: a warrior's genome is a generator (generator.h), not the list of its instructions
  uint32_t min_length;      // --min-length N: a child with fewer instructions that are not DAT.F $0, $0 is not played; 0 none
  double tie;               // --tie-points t: what a tie counts in the screen, the values and the push-off (a win 3); scores against the hill stay 3/1/0
} params;

enum { PARENTS_VALUE, PARENTS_DUEL };

enum { PANEL_PICKED, PANEL_RANDOM, PANEL_KINDS }; // --panel-choice

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
  uint32_t origin; // members: the batch its line started (the events' origin): a parent's, or born for a new family
  uint32_t adjective, noun, earlier; // the name (evolver/names.h)
  double parent_difference; // members: row_difference() to the first parent when it entered, -1 if that was not in
  int new_family;           // members: it plays so unlike its first parent that it got a noun of its own
  int style_kind;           // members: its style (style.h), -1 not measured (a state from before)
  style st;                 // members: the numbers behind it, when it entered
  double holdout; // members: average against the holdout warriors, -1 not measured
  char ops[128]; // the names of the changes, space separated: 6 of at most 17 characters
} warrior;

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

static inline double now(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec + ts.tv_nsec * 1e-9;
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
  genome *starts;     // --start: the warriors of the folder as genomes
  uint32_t start_n, *start_noun;
  char (*start_name)[64], **start_file;

  // The matrix: slots 0 .. panel_n-1 are the panel, the others hold members
  // and entering candidates. wlt[a * cap + b]: a's results against b.
  uint32_t cap;
  warrior **slot;     // 0: free
  m42_score *wlt;
  double *pts;        // points per 100 rounds, from wlt
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
  double *pts1;
  uint8_t *keep;      // panel slots never leave
  uint32_t list_grow;         // --list on a run that continues: the list grows to this before the matrix is made, 0 not
  genome *migr;               // --migrate: the best members of the other islands, played first in the next batch
  uint64_t *migr_id;
  uint32_t *migr_noun, migr_n;
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

// ---------------------------------------------------------------- islands

// --islands N (islands.c)
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

// ---------------------------------------------------------------- scores

// The seed of every match against warrior id: its first position, later
// rounds from it (semantics doc, 3.2). Never 0: Park-Miller stays at 0, and
// every round would put the second warrior minDistance from the first. One
// id in about 7,800 got 0; in pareto30 (17th November 2026) Bitter Robot II
// learned that position and won 1,125,180 of 1,127,080 rounds against the
// newcomers. The others keep their seeds.
static inline int64_t seed_for(const run *r, uint64_t id) {
  const m42_rules *ru = &r->p.rules;
  const uint64_t range = ru->core_size - 2 * ru->min_distance + 1;
  const uint64_t s = rng_mix(r->p.seed * 0x9e3779b97f4a7c15u ^ rng_mix(id + 1)) % range;
  return (int64_t)(s ? s : 1);
}

// Points per 100 rounds, a win 3 and a tie `tie`; points() counts a tie 1,
// as the hill does: the scores against the folder, the holdout, the bench.
// What selects (the screen, the values, the push-off) counts it --tie-points.
static inline double points_t(m42_score s, uint32_t rounds, double tie) { return (3.0 * s.wins + tie * s.ties) * 100.0 / rounds; }
static inline double points(m42_score s, uint32_t rounds) { return points_t(s, rounds, 1); }

// Points per 100 rounds over the rounds the result has (--stage: fewer than
// p.rounds until a survivor that stays plays the rest).
static inline double points_of_t(m42_score s, double tie) {
  const uint32_t n = s.wins + s.losses + s.ties;
  return n ? points_t(s, n, tie) : 0;
}
static inline double points_of(m42_score s) { return points_of_t(s, 1); }

// The rounds of a whole match against a panel warrior (--panel-rounds), and
// against the warrior in slot o.
static inline uint32_t panel_rounds(const params *p) { return p->panel_rounds ? p->panel_rounds : p->rounds; }

// The rounds of the first stage of a match, p.rounds without --stage.
static inline uint32_t stage_rounds(const params *p) { return p->stage && p->stage < p->rounds ? p->stage : p->rounds; }

static inline m42_score add_scores(m42_score a, m42_score b) {
  return (m42_score){a.wins + b.wins, a.losses + b.losses, a.ties + b.ties};
}

static inline uint32_t members(const run *r) { return r->active_n - r->panel_n; }

// A distance to the power alpha (--alpha, 1 by default).

static inline double with_alpha(const run *r, double d) { return r->p.alpha == 1 ? d : pow(d, r->p.alpha); }

// A warrior's average against the panel in a matrix of points per 100 rounds
// (pts, or pts1 of the first stage); a panel warrior's own column does not
// count.
static inline double panel_avg_on(const run *r, const double *pts, uint32_t slot) {
  double s = 0;
  uint32_t n = 0;
  for (uint32_t j = 0; j < r->panel_n; j++)
    if (j != slot) s += pts[slot * r->cap + j], n++;
  return n ? s / n : 0;
}

static inline double panel_avg(const run *r, uint32_t slot) { return panel_avg_on(r, r->pts, slot); }

// ---------------------------------------------------------------- the functions of the files

// evolve.c: the command line
params default_params(void);
extern volatile sig_atomic_t stop_now; // Ctrl-C: the run ends after the current batch

// run.c: a run, its matrix and values, its steps
void *xmalloc(size_t n);
char *read_file(const char *path, size_t *len);
m42_warrior *make_warrior(const genome *g, const m42_rules *rules);
void set_result(run *r, uint32_t a, uint32_t b, m42_score sa);
void set_result1(run *r, uint32_t a, uint32_t b, m42_score sa);
void rebuild_active(run *r);
void compute_values(run *r);
void compute_values1(run *r);
uint32_t free_slot(const run *r);
void free_warrior(warrior *w);
uint32_t slot_of_id(const run *r, uint64_t id);
void setup_matrix(run *r);
void run_pool(run *r, uint32_t threads);
int run_new(run *r, uint32_t threads, int optimize);
int run_resume(run *r);
int run_open(run *r, int resume, uint32_t threads);
void run_first(run *r);
void run_step(run *r);

// pool.c: the thread pool
void pool_start(pool *p, uint32_t threads, const m42_rules *rules);
void pool_stop(pool *p);
void pool_run(pool *p, unit *units, uint32_t n);
speed pool_speed(pool *p);

// events.c: the events
void json_str(FILE *f, const char *s, int latin1);
char *generator_text(const genome *g, uint32_t core);
void event_start(run *r);
void event_panel(run *r);
void event_enter(run *r, uint32_t slot, double screen, double estimate, uint64_t rival, const unit *row);
void event_leave(run *r, const pushoff_value *v, int early);
void event_values(run *r);

// state.c: state.txt and islands.txt
void save_state(run *r);
int load_state(run *r, const char *path);
long state_events_size(const char *path);
int names_loop(const char *mix);
void islands_save(const islands *I);
int islands_load(islands *I);

// panel.c: the opponent folder, the panel, the holdout, the start warriors
char **opponent_files(run *r, uint32_t *count);
void load_starts(run *r);
void load_list(run *r, warrior **list, uint32_t *n, char **names, uint32_t count, int kind, uint64_t first_id);
void pick_panel(run *r, char **names, uint32_t count);
void event_pick(run *r);

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
void pick_play(run *r, char **names, uint32_t count, pick_table *out);
void pick_free(pick_table *t);
uint32_t pick_choose(run *r, const pick_table *t, char **names, const uint8_t *allowed, uint32_t *picked);

// batch.c: one batch
void run_batch(run *r);

// optimize.c: the constant optimizer
int optimize(run *r, const char *file);

// islands.c: --islands
int islands_new(const params *base, const params *variant, const char *const *variant_text, uint32_t variant_n,
                const char *dir, uint32_t n, uint32_t keep, uint32_t every, uint32_t rounds, uint32_t migrate,
                uint32_t migrate_random, uint32_t migrate_next, uint32_t explorers, int own_panels, uint32_t threads,
                uint32_t batches, double seconds);
int islands_resume(const char *dir, uint32_t threads, uint32_t batches, double seconds);

#endif
