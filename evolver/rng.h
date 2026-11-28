// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// A small random generator for the evolver: splitmix64. Every stream is
// seeded from the run's seed and what it is for (batch, candidate, ...), so
// a run does not depend on the order in which threads finish.

#ifndef EVOLVER_RNG_H
#define EVOLVER_RNG_H

#include <stdint.h>

typedef struct {
  uint64_t s;
} rng;

static inline uint64_t rng_mix(uint64_t z) {
  z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9u;
  z = (z ^ (z >> 27)) * 0x94d049bb133111ebu;
  return z ^ (z >> 31);
}

static inline uint64_t rng_next(rng *r) { return rng_mix(r->s += 0x9e3779b97f4a7c15u); }

// A stream from up to three numbers.
static inline rng rng_seed(uint64_t a, uint64_t b, uint64_t c) {
  rng r = {rng_mix(a ^ rng_mix(b ^ rng_mix(c + 0x2545f4914f6cdd1du)))};
  return r;
}

// 0 .. n-1, for n up to 2^32 (multiply-shift, the bias is below 2^-32).
static inline uint32_t rng_below(rng *r, uint64_t n) { return (uint32_t)(((rng_next(r) >> 32) * n) >> 32); }

// lo .. hi, both included.
static inline int32_t rng_range(rng *r, int32_t lo, int32_t hi) { return lo + (int32_t)rng_below(r, (uint64_t)(hi - lo) + 1); }

// 0 <= x < 1.
static inline double rng_unit(rng *r) { return (double)(rng_next(r) >> 11) * (1.0 / 9007199254740992.0); }

// A draw from the beta distribution Beta(a, b) for whole a and b of 1 or more
// with a + b - 1 at most RNG_BETA_MAX: the a-th smallest of a + b - 1 uniform
// numbers. No libm, so the same draw on every platform.
#define RNG_BETA_MAX 1024
static inline double rng_beta(rng *r, uint32_t a, uint32_t b) {
  double u[RNG_BETA_MAX];
  const uint32_t n = a + b - 1;
  for (uint32_t i = 0; i < n; i++) u[i] = rng_unit(r);
  int lo = 0, hi = (int)n - 1; // the a-th smallest, u[a - 1] of the sorted numbers, by selection around a pivot
  const int k = (int)a - 1;
  while (lo < hi) {
    const double pivot = u[lo + (hi - lo) / 2];
    int i = lo, j = hi;
    while (i <= j) {
      while (u[i] < pivot) i++;
      while (u[j] > pivot) j--;
      if (i <= j) {
        const double t = u[i];
        u[i] = u[j], u[j] = t;
        i++, j--;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else break; // between the two parts: it is the pivot
  }
  return u[k];
}

// 1 with probability p.
static inline int rng_chance(rng *r, double p) { return (double)(rng_next(r) >> 11) * (1.0 / 9007199254740992.0) < p; }

#endif
