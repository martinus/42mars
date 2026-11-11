// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Native benchmark driver for the library, to see what the wasm layer costs.
// tools/bench-native.mjs writes the input (see input.h) and builds and runs
// this file with -DM42_FIXED_CONTEXT, the context of the wasm build. A
// second argument turns on early tie detection.
// Built with -DCOUNT_INS it also prints how often each instruction word was
// executed to stderr, "<word> <count>" per line, the input of
// tools/gen-dispatch.mjs --rank.

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include "42mars.c" // lib/, see tools/bench-native.mjs (-I)
#include "input.h"

int main(int argc, char **argv) {
  FILE *f = argc > 1 ? fopen(argv[1], "r") : 0;
  if (!f) { fprintf(stderr, "usage: bench-native <input>\n"); return 2; }
  double total = 0, seconds = 0;
  Match x;
  for (int got; (got = read_match(f, &x)) != 0;) {
    if (got < 0) { fprintf(stderr, "bad input\n"); return 2; }
    int status;
    m42_ctx *m = m42_new(&x.rules, &status);
    if (!m) { fprintf(stderr, "%s\n", m42_status_text(status)); return 2; }
    x.options.early_tie = argc > 2;
    uint64_t instructions = 0;
    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0); // loading counts, reading the input does not
    status = m42_match(m, (const m42_warrior *const *)x.w, x.n, &x.options, 0, &instructions);
    clock_gettime(CLOCK_MONOTONIC, &t1);
    if (status != M42_OK) { fprintf(stderr, "%s\n", m42_status_text(status)); return 2; }
    total += (double)instructions;
    seconds += (double)(t1.tv_sec - t0.tv_sec) + 1e-9 * (double)(t1.tv_nsec - t0.tv_nsec);
    m42_free(m);
    free_match(&x);
  }
  printf("%.1fM instructions/s (%.0f instructions in %.0f ms), native\n", total / seconds / 1e6, total, seconds * 1e3);
#ifdef COUNT_INS
  for (unsigned w = 0; w < 1u << 14; w++) if (insCount[w]) fprintf(stderr, "%u %llu\n", w, insCount[w]);
#endif
  return 0;
}
