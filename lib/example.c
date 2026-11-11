// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Example for 42mars.h: assembles two warriors, plays a match and prints
// "wins losses ties" for each warrior, one line per warrior.
//
//   cc -O2 -o example example.c 42mars.c
//   ./example [-r rounds] [-F position] [-s size] [-c cycles] [-p processes]
//             [-l length] [-d distance] a.red b.red
//
// The flags mean what they mean for pMARS. With -F (where the second warrior
// starts in the first round), the result is that of
//   pmars -b -k -r rounds -F position ... a.red b.red
// which prints "wins ties" for each warrior. Without -F the positions come
// from seed 0.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "42mars.h"

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
  if (!w) {
    fprintf(stderr, "%s: %s\n", path, m42_status_text(status));
    return 0;
  }
  for (uint32_t i = 0; i < m42_warrior_errors(w) + m42_warrior_warnings(w); i++) {
    char text[256];
    int32_t line;
    int is_error;
    m42_warrior_message(w, i, &line, &is_error, text, sizeof text);
    if (is_error) fprintf(stderr, "%s:%d: error: %s\n", path, (int)line, text);
  }
  if (!m42_warrior_ok(w)) {
    m42_warrior_free(w);
    return 0;
  }
  return w;
}

int main(int argc, char **argv) {
  m42_rules rules = m42_rules_94();
  m42_match_options options = m42_match_options_default();
  const char *files[2];
  int nfiles = 0;
  long position = -1;
  for (int i = 1; i < argc; i++) {
    const char *a = argv[i];
    if (a[0] == '-' && a[1] && !a[2] && i + 1 < argc) {
      const long v = strtol(argv[++i], 0, 10);
      switch (a[1]) {
        case 'r': options.rounds = (uint32_t)v; break;
        case 'F': position = v; break;
        case 's': rules.core_size = (uint32_t)v; break;
        case 'c': rules.max_cycles = (uint32_t)v; break;
        case 'p': rules.max_processes = (uint32_t)v; break;
        case 'l': rules.max_length = (uint32_t)v; break;
        case 'd': rules.min_distance = (uint32_t)v; break;
        default: fprintf(stderr, "unknown flag %s\n", a); return 2;
      }
    } else if (nfiles < 2) {
      files[nfiles++] = a;
    } else {
      fprintf(stderr, "two warriors, please\n");
      return 2;
    }
  }
  if (nfiles != 2) {
    fprintf(stderr, "usage: example [-r rounds] [-F position] [-s size] [-c cycles] [-p processes] [-l length] [-d distance] a.red b.red\n");
    return 2;
  }
  // pMARS's p-space size follows the core size, and so does ROUNDS.
  rules.pspace_size = 0;
  rules.rounds = options.rounds;
  if (position >= 0) options.seed = position - (long)rules.min_distance;

  m42_warrior *w[2] = {load(files[0], &rules), load(files[1], &rules)};
  int status = M42_OK;
  m42_ctx *m = w[0] && w[1] ? m42_new(&rules, &status) : 0;
  m42_score scores[2];
  if (m) status = m42_match(m, (const m42_warrior *const *)w, 2, &options, scores, 0);
  if (m && status == M42_OK) {
    for (int i = 0; i < 2; i++) printf("%u %u %u\n", scores[i].wins, scores[i].losses, scores[i].ties);
  } else if (w[0] && w[1]) {
    fprintf(stderr, "%s\n", m42_status_text(status));
  }
  m42_free(m);
  m42_warrior_free(w[0]);
  m42_warrior_free(w[1]);
  return m && status == M42_OK ? 0 : 1;
}
