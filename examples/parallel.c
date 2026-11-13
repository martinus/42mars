// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Example for 42mars.h: one match on several threads. The library has no
// threads of its own; a context is used by one thread at a time, and
// warriors can be shared. So each thread gets a context and a block of the
// match's rounds (m42_match_options.first_round), and the blocks' scores
// and instructions add up to those of the whole match, as long as no
// warrior uses p-space (m42_warrior_uses_pspace()): with LDP or STP a round
// depends on the ones before, and the match runs in one block.
//
// Then it plays the match again on one thread and checks that both agree.
// Prints "wins losses ties" for each warrior, one line per warrior, and the
// instructions executed.
//
//   cc -O2 -pthread -Ilib -o parallel examples/parallel.c lib/42mars.c
//   cl /O2 /std:c11 /Ilib examples\parallel.c lib\42mars.c
//   ./parallel [-t threads] [-r rounds] [-F position] [-s size] [-c cycles] [-p processes]
//              [-l length] [-d distance] a.red b.red [more.red ...]
//
// The flags are those of examples/example.c, and -t the number of threads
// (default 4). POSIX threads, or C11 threads on Windows (MSVC 17.8 or newer).

#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>

#include "42mars.h"

#ifdef _WIN32
#include <threads.h>
typedef thrd_t thread;
static int thread_start(thread *t, int (*run)(void *), void *arg) { return thrd_create(t, run, arg) == thrd_success; }
static void thread_join(thread t) { thrd_join(t, 0); }
#define THREAD_RESULT int
#else
#include <pthread.h>
typedef pthread_t thread;
static int thread_start(thread *t, void *(*run)(void *), void *arg) { return pthread_create(t, 0, run, arg) == 0; }
static void thread_join(thread t) { pthread_join(t, 0); }
#define THREAD_RESULT void *
#endif

#define MAX_WARRIORS 16
#define MAX_THREADS 256

static char *read_file(const char *path, size_t *len) {
  FILE *f = fopen(path, "rb");
  if (!f) return 0;
  size_t cap = 1 << 16, n = 0;
  char *buf = malloc(cap);
  for (size_t got; buf && (got = fread(buf + n, 1, cap - n, f)) > 0;) {
    n += got;
    if (n == cap) buf = realloc(buf, cap *= 2);
  }
  fclose(f);
  *len = n;
  return buf;
}

static m42_warrior *load(const char *path, const m42_rules *rules) {
  size_t len;
  char *src = read_file(path, &len);
  if (!src) {
    fprintf(stderr, "cannot read %s\n", path);
    return 0;
  }
  int status;
  m42_warrior *w = m42_assemble_new(src, len, rules, 0, 0, &status);
  free(src);
  if (!w || !m42_warrior_ok(w)) {
    fprintf(stderr, "%s: %s\n", path, w ? "does not assemble" : m42_status_text(status));
    m42_warrior_free(w);
    return 0;
  }
  return w;
}

// One block of rounds on a context of its own.
typedef struct {
  const m42_rules *rules;
  const m42_warrior *const *warriors;
  uint32_t n;
  m42_match_options options;
  m42_score scores[MAX_WARRIORS];
  uint64_t instructions;
  int status;
} block;

static THREAD_RESULT play(void *arg) {
  block *b = arg;
  m42_ctx *m = m42_new(b->rules, &b->status);
  if (m) b->status = m42_match(m, b->warriors, b->n, &b->options, b->scores, &b->instructions);
  m42_free(m);
  return 0;
}

int main(int argc, char **argv) {
  m42_rules rules = m42_rules_94();
  m42_match_options options = m42_match_options_default();
  const char *files[MAX_WARRIORS];
  uint32_t n = 0;
  long position = -1, threads = 4;
  for (int i = 1; i < argc; i++) {
    const char *a = argv[i];
    if (a[0] == '-' && a[1] && !a[2] && i + 1 < argc) {
      const long v = strtol(argv[++i], 0, 10);
      switch (a[1]) {
        case 't': threads = v; break;
        case 'r': options.rounds = (uint32_t)v; break;
        case 'F': position = v; break;
        case 's': rules.core_size = (uint32_t)v; break;
        case 'c': rules.max_cycles = (uint32_t)v; break;
        case 'p': rules.max_processes = (uint32_t)v; break;
        case 'l': rules.max_length = (uint32_t)v; break;
        case 'd': rules.min_distance = (uint32_t)v; break;
        default: fprintf(stderr, "unknown flag %s\n", a); return 2;
      }
    } else if (n < MAX_WARRIORS) {
      files[n++] = a;
    } else {
      fprintf(stderr, "at most %d warriors\n", MAX_WARRIORS);
      return 2;
    }
  }
  if (n < 2 || threads < 1 || threads > MAX_THREADS) {
    fprintf(stderr, "usage: parallel [-t threads] [-r rounds] [-F position] [-s size] [-c cycles] [-p processes] "
                    "[-l length] [-d distance] a.red b.red [more.red ...]\n");
    return 2;
  }
  // pMARS's p-space size follows the core size, and so does ROUNDS.
  rules.pspace_size = 0;
  rules.rounds = options.rounds;
  rules.warriors = n;
  if (position >= 0) options.seed = position - (long)rules.min_distance;

  m42_warrior *w[MAX_WARRIORS];
  int loaded = 1, pspace = 0;
  for (uint32_t i = 0; i < n; i++) {
    w[i] = load(files[i], &rules);
    loaded &= w[i] != 0;
    pspace |= w[i] && m42_warrior_uses_pspace(w[i]);
  }
  if (!loaded) {
    for (uint32_t i = 0; i < n; i++) m42_warrior_free(w[i]);
    return 1;
  }
  const m42_warrior *const *ws = (const m42_warrior *const *)w;

  // The blocks: as many as threads, of nearly equal size; one when a
  // warrior uses p-space, or when there are fewer rounds than threads.
  uint32_t blocks = pspace ? 1 : (uint32_t)threads;
  if (blocks > options.rounds) blocks = options.rounds ? options.rounds : 1;
  static block b[MAX_THREADS];
  thread t[MAX_THREADS];
  int started[MAX_THREADS];
  for (uint32_t k = 0, first = 0; k < blocks; k++) {
    const uint32_t rounds = options.rounds / blocks + (k < options.rounds % blocks);
    b[k] = (block){&rules, ws, n, options, {{0}}, 0, M42_OK};
    b[k].options.first_round = first;
    b[k].options.rounds = rounds;
    first += rounds;
    started[k] = thread_start(&t[k], play, &b[k]);
    if (!started[k]) play(&b[k]); // no thread: play the block here
  }
  m42_score sum[MAX_WARRIORS] = {{0}};
  uint64_t instructions = 0;
  int status = M42_OK;
  for (uint32_t k = 0; k < blocks; k++) {
    if (started[k]) thread_join(t[k]);
    if (b[k].status != M42_OK) status = b[k].status;
    instructions += b[k].instructions;
    for (uint32_t i = 0; i < n; i++) {
      sum[i].wins += b[k].scores[i].wins;
      sum[i].losses += b[k].scores[i].losses;
      sum[i].ties += b[k].scores[i].ties;
    }
  }

  // The same match on this thread, in one block.
  block whole = {&rules, ws, n, options, {{0}}, 0, M42_OK};
  play(&whole);
  for (uint32_t i = 0; i < n; i++) m42_warrior_free(w[i]);
  if (status != M42_OK || whole.status != M42_OK) {
    fprintf(stderr, "%s\n", m42_status_text(status != M42_OK ? status : whole.status));
    return 1;
  }
  for (uint32_t i = 0; i < n; i++) printf("%u %u %u\n", sum[i].wins, sum[i].losses, sum[i].ties);
  printf("%" PRIu64 " instructions, %u block%s%s\n", instructions, blocks, blocks == 1 ? "" : "s",
         pspace ? " (p-space)" : "");
  int same = instructions == whole.instructions;
  for (uint32_t i = 0; i < n; i++) {
    same &= sum[i].wins == whole.scores[i].wins && sum[i].losses == whole.scores[i].losses &&
            sum[i].ties == whole.scores[i].ties;
  }
  if (!same) {
    fprintf(stderr, "differs from the match on one thread: %" PRIu64 " instructions\n", whole.instructions);
    return 1;
  }
  return 0;
}
