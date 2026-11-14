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

// 1 with probability p.
static inline int rng_chance(rng *r, double p) { return (double)(rng_next(r) >> 11) * (1.0 / 9007199254740992.0) < p; }

#endif
