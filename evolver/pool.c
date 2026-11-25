// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The thread pool of 42evolve: its threads play the matches (units) of the
// jobs of several callers, each caller waits for its own (pool_run()).

#include "evolve.h"

static _Thread_local speed pool_mine;

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

void pool_start(pool *p, uint32_t threads, const m42_rules *rules) {
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

void pool_stop(pool *p) {
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

void pool_run(pool *p, unit *units, uint32_t n) {
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

speed pool_speed(pool *p) {
  speed s = pool_mine;
  pthread_mutex_lock(&p->mutex);
  s.busy = p->busy;
  pthread_mutex_unlock(&p->mutex);
  return s;
}
