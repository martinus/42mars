// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Native benchmark driver for mars.c, to see what the wasm layer costs.
// tools/bench-native.mjs writes the input and builds and runs this file.
// Input (text, integers): per match "coreSize maxProcesses maxCycles
// minDistance pSpaceSize warriors instructions seed rounds", then the load
// area of mars_config (4 * warriors + 5 * instructions integers). A second
// argument turns on early tie detection.
// Built with -DCOUNT_INS it also prints how often each instruction word was
// executed to stderr, "<word> <count>" per line, the input of
// tools/gen-dispatch.mjs --rank.

#include <stdio.h>
#include <time.h>
#include "mars.c" // lib/src, see tools/bench-native.mjs (-I)

int main(int argc, char **argv) {
  FILE *f = argc > 1 ? fopen(argv[1], "r") : 0;
  if (!f) { fprintf(stderr, "usage: bench-native <input>\n"); return 2; }
  unsigned cfg[9];
  double total = 0, seconds = 0;
  while (fscanf(f, "%u %u %u %u %u %u %u %u %u", &cfg[0], &cfg[1], &cfg[2], &cfg[3], &cfg[4], &cfg[5], &cfg[6], &cfg[7], &cfg[8]) == 9) {
    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0);
    i32 *in = mars_config(cfg[0], cfg[1], cfg[2], cfg[3], cfg[4], cfg[5], cfg[6]);
    for (unsigned k = 0; k < 4 * cfg[5] + 5 * cfg[6]; k++) {
      if (fscanf(f, "%d", &in[k]) != 1) { fprintf(stderr, "bad input\n"); return 2; }
    }
    clock_gettime(CLOCK_MONOTONIC, &t0); // do not count reading the input
    mars_load(cfg[7], 0);
    total += mars_run_match(cfg[8], argc > 2, 0);
    clock_gettime(CLOCK_MONOTONIC, &t1);
    seconds += (double)(t1.tv_sec - t0.tv_sec) + 1e-9 * (double)(t1.tv_nsec - t0.tv_nsec);
  }
  printf("%.1fM instructions/s (%.0f instructions in %.0f ms), native\n", total / seconds / 1e6, total, seconds * 1e3);
#ifdef COUNT_INS
  for (unsigned w = 0; w < 1u << 14; w++) if (insCount[w]) fprintf(stderr, "%u %llu\n", w, insCount[w]);
#endif
  return 0;
}
