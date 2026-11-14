// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// 42evolve: evolves Redcode warriors against a panel of hill warriors, with
// a list kept by diversity push-off (#142, docs/evolver.md).
//
//   42evolve <run folder> --opponents <dir> [options]   a new run
//   42evolve <run folder> [--threads N] [--batches N] [--seconds S]
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
} params;

enum { SELECT_SCREEN, SELECT_VALUE };

static params default_params(void) {
  params p;
  memset(&p, 0, sizeof p);
  p.rules = m42_rules_94();
  p.panel = 40;
  p.holdout = 100;
  p.list = 20;
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
  double holdout; // members: average against the holdout warriors, -1 not measured
  char ops[96];
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
static void pool_run(pool *p, unit *units, uint32_t n) {
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

  // The matrix: slots 0 .. panel_n-1 are the panel, the others hold members
  // and entering candidates. wlt[a * cap + b]: a's results against b.
  uint32_t cap;
  warrior **slot;     // 0: free
  m42_score *wlt;
  double *pts;        // points per 100 rounds, from wlt
  uint8_t *keep;      // panel slots never leave
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

static void set_result(run *r, uint32_t a, uint32_t b, m42_score sa) {
  const uint32_t c = r->cap;
  m42_score sb = {sa.losses, sa.wins, sa.ties};
  r->wlt[a * c + b] = sa;
  r->wlt[b * c + a] = sb;
  r->pts[a * c + b] = points(sa, r->p.rounds);
  r->pts[b * c + a] = points(sb, r->p.rounds);
}

static void rebuild_active(run *r) {
  r->active_n = 0;
  for (uint32_t i = 0; i < r->cap; i++)
    if (r->slot[i]) r->active[r->active_n++] = i;
}

static uint32_t members(const run *r) { return r->active_n - r->panel_n; }

static void compute_values(run *r) {
  pushoff_values(r->pts, r->cap, r->active, r->active_n, r->p.sd, r->p.alpha, r->sigma, r->values);
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

// All .red files of the folder that fit the rules, shuffled with the seed.
static char **opponent_files(run *r, uint32_t *count) {
  DIR *d = opendir(r->p.opponents);
  if (!d) {
    fprintf(stderr, "42evolve: cannot open %s\n", r->p.opponents);
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
  *count = k;
  return names;
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
          ",\"select\":\"%s\",\"rotate\":%u,\"fractions\":%.17g},\"opponents\":",
          m42_version(), p->rules.core_size, p->rules.max_cycles, p->rules.max_processes, p->rules.max_length,
          p->rules.min_distance, r->panel_n, r->hold_n, p->list, p->batch, p->survivors, p->rounds, p->screen_rounds,
          p->bench_every, p->bench_rounds, p->init_length, p->screen_factor, p->alpha, p->reintroduce,
          p->sd == SD_SUM ? "sum" : "opponent", p->seed, p->select == SELECT_VALUE ? "value" : "screen", p->rotate,
          p->fractions);
  json_str(f, p->opponents, 0);
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
  fputs("]}\n", f);
}

// A new member: its results against every warrior in, [other, wins, losses,
// ties, seed], the new member warrior 0 of each match.
static void event_enter(run *r, uint32_t slot, double screen, double estimate, const unit *row) {
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
  fputs("],\"code\":", f);
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

static void event_leave(run *r, const pushoff_value *v) {
  fprintf(r->events,
          "{\"type\":\"leave\",\"batch\":%u,\"id\":%" PRIu64 ",\"avg\":%.6f,\"distance\":%.6f,\"nearest\":%" PRId64
          ",\"value\":%.6f}\n",
          r->batch, r->slot[v->index]->id, v->avg, v->distance,
          v->nearest == UINT32_MAX ? (int64_t)-1 : (int64_t)r->slot[v->nearest]->id, v->value);
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
  fprintf(f, "params %u %u %u %u %u %u %u %u %u %u %.17g %.17g %.17g %d %" PRIu64 " %d %u %.17g\n", p->panel,
          p->holdout, p->list, p->batch, p->survivors, p->rounds, p->screen_rounds, p->bench_every, p->bench_rounds,
          p->init_length, p->screen_factor, p->alpha, p->reintroduce, p->sd, p->seed, p->select, p->rotate,
          p->fractions);
  fprintf(f, "opponents %s\n", p->opponents);
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
    fprintf(f, "member %" PRIu64 " %u %" PRIu64 " %" PRIu64 " %.17g %u %u %u %s\nops %s\n", w->id, w->born,
            w->parents[0], w->parents[1], w->holdout, w->adjective, w->noun, w->earlier, text, w->ops);
  }
  for (uint32_t i = 0; i < r->archive_n; i++) {
    genome_save(&r->archive[i], text, sizeof text);
    fprintf(f, "archive %" PRIu64 " %u %s\n", r->archive_id[i], r->archive_noun[i], text);
  }
  fprintf(f, "archive-next %u\n", r->archive_next);
  for (uint32_t i = 0; i < NAME_ADJECTIVES * NAME_NOUNS; i++)
    if (r->names[i]) fprintf(f, "names %u %u\n", i, r->names[i]);
  for (uint32_t i = 0; i < r->active_n; i++)
    for (uint32_t j = 0; j < i; j++) {
      const uint32_t a = r->active[i], b = r->active[j];
      const m42_score s = r->wlt[a * r->cap + b];
      fprintf(f, "score %" PRIu64 " %" PRIu64 " %u %u %u\n", r->slot[a]->id, r->slot[b]->id, s.wins, s.losses, s.ties);
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
      // the last three came with --select, --rotate and --fractions; a state
      // without them has none of them
      const int got = sscanf(line + 7, "%u %u %u %u %u %u %u %u %u %u %lg %lg %lg %d %" SCNu64 " %d %u %lg",
                             &p->panel, &p->holdout, &p->list, &p->batch, &p->survivors, &p->rounds,
                             &p->screen_rounds, &p->bench_every, &p->bench_rounds, &p->init_length, &p->screen_factor,
                             &p->alpha, &p->reintroduce, &p->sd, &p->seed, &p->select, &p->rotate, &p->fractions);
      if (got != 15 && got != 17 && got != 18) goto bad;
    } else if (!strncmp(line, "opponents ", 10)) {
      snprintf(p->opponents, sizeof p->opponents, "%s", line + 10);
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
  char ops[96];
  int skip;
  double screen;   // average against the panel in the screen rounds
  double estimate; // screen * (SD-score to the nearest warrior in, on the panel columns)^alpha
  double key;      // what the survivors are picked by: screen or estimate
  uint64_t id;
} candidate;

// Tournament of two: the member with the higher push-off value.
static const warrior *select_parent(run *r, rng *g) {
  const uint32_t m = members(r);
  const uint32_t i = r->panel_n + rng_below(g, m), j = r->panel_n + rng_below(g, m);
  const pushoff_value *a = &r->values[i], *b = &r->values[j];
  return r->slot[(b->value > a->value ? b : a)->index];
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
  unit *u = xmalloc(r->active_n * sizeof *u);
  uint32_t n = 0;
  for (uint32_t k = 0; k < r->active_n; k++) {
    const uint32_t o = r->active[k];
    if (o != i) u[n++] = (unit){old->w, r->slot[o]->w, seed_for(r, r->slot[o]->id), 0, r->p.rounds, {{0}}, 0, 0};
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
    set_result(r, i, o, u[n].s[0]);
    fprintf(f, "%s[%" PRIu64 ",%u,%u,%u,%" PRId64 "]", n ? "," : "", r->slot[o]->id, u[n].s[0].wins, u[n].s[0].losses,
            u[n].s[0].ties, u[n].seed);
    n++;
  }
  fputs("]}\n", f);
  free(u);
  compute_values(r);
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

  // breed
  for (uint32_t i = 0; i < B; i++) {
    rng g = rng_seed(p->seed, 0x6272656564u + r->batch, i); // "breed"
    candidate *x = &c[i];
    x->parents[0] = x->parents[1] = NO_ID;
    int reintro = 0;
    if (members(r) == 0) {
      genome_random(&x->g, &g, core,
                    1 + rng_below(&g, p->init_length < p->rules.max_length ? p->init_length : p->rules.max_length),
                    p->fractions);
      strcpy(x->ops, "random");
      x->noun = rng_below(&g, NAME_NOUNS); // a new family
    } else if (r->archive_n && rng_chance(&g, p->reintroduce)) {
      const uint32_t k = rng_below(&g, r->archive_n);
      x->g = r->archive[k];
      x->parents[0] = r->archive_id[k];
      x->noun = r->archive_noun[k];
      strcpy(x->ops, "reintroduce");
      reintro = 1;
    } else {
      const warrior *a = select_parent(r, &g), *b = select_parent(r, &g);
      genome_breed(&x->g, a->g, b->g, &g, core, p->rules.max_length, p->fractions, x->ops, sizeof x->ops);
      x->parents[0] = a->id;
      x->noun = a->noun;
      if (strstr(x->ops, "crossover") && b->id != a->id) x->parents[1] = b->id;
    }
    const uint64_t h = genome_hash(&x->g, core);
    x->skip = !reintro && seen_has(r, h);
    if (!x->skip) {
      seen_add(r, h);
      x->w = make_warrior(&x->g, &p->rules);
      evaluated++;
    }
  }

  // screen: every candidate against the panel, the first rounds
  unit *u = xmalloc((size_t)B * P * sizeof *u);
  uint32_t n = 0;
  for (uint32_t i = 0; i < B; i++)
    for (uint32_t j = 0; j < P && !c[i].skip; j++)
      u[n++] = (unit){c[i].w, r->panel[j].w, seed_for(r, r->panel[j].id), 0, p->screen_rounds, {{0}}, 0, 0};
  pool_run(&r->pool, u, n);
  n = 0;
  for (uint32_t i = 0; i < B; i++) {
    if (c[i].skip) continue;
    double s = 0;
    for (uint32_t j = 0; j < P; j++, n++) s += points(u[n].s[0], p->screen_rounds);
    c[i].screen = P ? s / P : 0;
    c[i].estimate = c[i].screen * estimated_distance(r, u + n - P, p->screen_rounds);
    c[i].key = p->select == SELECT_VALUE ? c[i].estimate : c[i].screen;
  }

  // survivors: at least screen_factor of the weakest member's panel average
  double threshold = -1;
  if (members(r) >= p->list) {
    threshold = INFINITY;
    for (uint32_t i = P; i < r->active_n; i++) {
      const double a = panel_avg(r, r->active[i]);
      if (a < threshold) threshold = a;
    }
    threshold *= p->screen_factor;
  }
  candidate **sv = xmalloc(B * sizeof *sv);
  uint32_t sn = 0;
  for (uint32_t i = 0; i < B; i++)
    if (!c[i].skip && c[i].screen >= threshold) sv[sn++] = &c[i];
  qsort(sv, sn, sizeof *sv, by_key);
  if (sn > p->survivors) sn = p->survivors;
  for (uint32_t i = 0; i < sn; i++) sv[i]->id = r->next_id++;

  // the rest of the rounds against the panel, all rounds against the members
  // and against the survivors before them
  const uint32_t M = members(r);
  unit *f = xmalloc((size_t)sn * (P + M + sn) * sizeof *f);
  uint32_t fn = 0;
  const uint32_t first = p->screen_rounds, more = p->rounds - p->screen_rounds;
  for (uint32_t i = 0; i < sn; i++) {
    for (uint32_t j = 0; j < P; j++)
      f[fn++] = (unit){sv[i]->w, r->panel[j].w, seed_for(r, r->panel[j].id), first, more, {{0}}, 0, 0};
    for (uint32_t j = P; j < r->active_n; j++) {
      const warrior *m = r->slot[r->active[j]];
      f[fn++] = (unit){sv[i]->w, m->w, seed_for(r, m->id), 0, p->rounds, {{0}}, 0, 0};
    }
    for (uint32_t j = 0; j < i; j++)
      f[fn++] = (unit){sv[i]->w, sv[j]->w, seed_for(r, sv[j]->id), 0, p->rounds, {{0}}, 0, 0};
  }
  pool_run(&r->pool, f, fn);

  // screen results per survivor: find its units again
  uint32_t *screen_at = xmalloc(B * sizeof *screen_at);
  for (uint32_t i = 0, k = 0; i < B; i++) {
    screen_at[i] = k;
    if (!c[i].skip) k += P;
  }

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
    w->holdout = -1;
    rng name = rng_seed(p->seed, 0x6e616d65u, w->id); // "name"
    w->adjective = rng_below(&name, NAME_ADJECTIVES);
    w->noun = x->noun;
    w->earlier = r->names[w->adjective * NAME_NOUNS + w->noun]++;
    name_text(w->name, sizeof w->name, w->adjective, w->noun, w->earlier);
    memcpy(w->ops, x->ops, sizeof w->ops);
    r->slot[s] = w;
    slot_of[i] = s;
    const uint32_t at = screen_at[(uint32_t)(x - c)];
    for (uint32_t j = 0; j < P; j++, fn++) {
      m42_score a = u[at + j].s[0], b = f[fn].s[0];
      set_result(r, s, j, (m42_score){a.wins + b.wins, a.losses + b.losses, a.ties + b.ties});
    }
    for (uint32_t j = 0; j < M; j++, fn++)
      if (member_slots[j] != UINT32_MAX) set_result(r, s, member_slots[j], f[fn].s[0]);
    for (uint32_t j = 0; j < i; j++, fn++)
      if (slot_of[j] != UINT32_MAX) set_result(r, s, slot_of[j], f[fn].s[0]);
    rebuild_active(r);
    event_enter(r, s, x->screen, x->estimate, u + at);
    entered++;
    if (members(r) > p->list) {
      compute_values(r);
      const int k = pushoff_weakest(r->values, r->active_n, r->keep);
      const uint32_t out = r->values[k].index;
      warrior *gone = r->slot[out];
      event_leave(r, &r->values[k]);
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
  compute_values(r);
  event_values(r);

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
          "{\"type\":\"batch\",\"batch\":%u,\"candidates\":%u,\"evaluated\":%u,\"survivors\":%u,\"entered\":%u,"
          "\"members\":%u}\n",
          r->batch, B, evaluated, sn, entered, members(r));
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
  free(slot_of);
  free(member_slots);
  r->batch++;
}

// ---------------------------------------------------------------- main

static void usage(void) {
  fprintf(stderr,
          "usage: 42evolve <run folder> --opponents <dir> [--panel 40] [--holdout 100] [--list 20]\n"
          "         [--batch N] [--survivors N] [--rounds 100] [--screen-rounds 20] [--screen-factor 0.8]\n"
          "         [--bench-every 10] [--bench-rounds 100] [--alpha 1] [--sd opponent|sum]\n"
          "         [--reintroduce 0.02] [--init-length 10] [--seed 1] [--select screen|value] [--rotate N]\n"
          "         [--fractions p]\n"
          "         [--size 8000] [--cycles 80000] [--processes 8000] [--length 100] [--distance 100]\n"
          "         [--threads N] [--batches N] [--seconds S]\n"
          "       42evolve <run folder> [--threads N] [--batches N] [--seconds S]   (continue a run)\n");
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
  int new_options = 0;
  for (int i = 1; i < argc; i++) {
    const char *a = argv[i];
    if (a[0] != '-') {
      if (dir) usage();
      dir = a;
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
    else if (!strcmp(a, "--select")) {
      if (!strcmp(v, "screen")) p->select = SELECT_SCREEN;
      else if (!strcmp(v, "value")) p->select = SELECT_VALUE;
      else usage();
    } else if (!strcmp(a, "--rotate")) {
      if (!number) usage();
      p->rotate = u;
    } else if (!strcmp(a, "--sd")) {
      if (!strcmp(v, "opponent")) p->sd = SD_OPPONENT;
      else if (!strcmp(v, "sum")) p->sd = SD_SUM;
      else usage();
    } else if (!number) usage();
    else if (!strcmp(a, "--panel")) p->panel = u;
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
    else if (!strcmp(a, "--reintroduce")) p->reintroduce = d;
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
    if (!run_option) new_options = 1;
  }
  if (!dir) usage();
  if (!threads) threads = hardware_threads();
  snprintf(r.dir, sizeof r.dir, "%s", dir);

  char state[1100], events[1100];
  snprintf(state, sizeof state, "%s/state.txt", dir);
  snprintf(events, sizeof events, "%s/events.jsonl", dir);
  const int resume = access(state, F_OK) == 0;
  if (resume) {
    if (new_options) {
      fprintf(stderr, "42evolve: %s has a run; only --threads, --batches and --seconds go with it\n", dir);
      return 2;
    }
    if (load_state(&r, state) != 0) return 1;
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
    if (p->rules.max_length < 1 || p->rules.max_length > GENOME_MAX || !p->list || !p->rounds || !p->init_length ||
        p->screen_rounds > p->rounds || p->rules.core_size < 2 * p->rules.min_distance) {
      fprintf(stderr, "42evolve: a parameter is out of range (length 1..%d, list, rounds >= screen rounds, ...)\n",
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
  pool_start(&r.pool, threads, &r.p.rules);
  signal(SIGINT, on_signal);
  signal(SIGTERM, on_signal);

  if (!resume) {
    event_start(&r);
    unit *u = xmalloc((size_t)r.panel_n * r.panel_n * sizeof *u);
    uint32_t n = 0;
    for (uint32_t a = 0; a < r.panel_n; a++)
      for (uint32_t b = 0; b < a; b++)
        u[n++] = (unit){r.panel[a].w, r.panel[b].w, seed_for(&r, r.panel[b].id), 0, r.p.rounds, {{0}}, 0, 0};
    pool_run(&r.pool, u, n);
    n = 0;
    for (uint32_t a = 0; a < r.panel_n; a++)
      for (uint32_t b = 0; b < a; b++) set_result(&r, a, b, u[n++].s[0]);
    free(u);
    rebuild_active(&r);
    compute_values(&r);
    event_panel(&r);
    save_state(&r);
  } else {
    fprintf(r.events, "{\"type\":\"resume\",\"batch\":%u}\n", r.batch);
  }
  fprintf(stderr, "42evolve: %s, %u panel and %u holdout warriors, %u threads, batch %u\n", dir, r.panel_n, r.hold_n,
          threads, r.batch);

  const double t0 = now();
  for (uint32_t done = 0; !stop_now && (!batches || done < batches) && (!seconds || now() - t0 < seconds); done++) {
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
