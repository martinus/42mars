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

// ---------------------------------------------------------------- the functions of the files

// evolve.c
void *xmalloc(size_t n);

// pool.c: the thread pool
void pool_start(pool *p, uint32_t threads, const m42_rules *rules);
void pool_stop(pool *p);
void pool_run(pool *p, unit *units, uint32_t n);
speed pool_speed(pool *p);

#endif
