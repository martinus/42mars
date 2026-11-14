// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Diversity push-off: the same computation as tools/diversity.js (its
// comment has the definition), in the same order of operations, so both
// give the same doubles. score[a * stride + b] is a's score against b; the
// warriors in are the indices in `active`.

#ifndef EVOLVER_PUSHOFF_H
#define EVOLVER_PUSHOFF_H

#include <stddef.h>
#include <stdint.h>

enum { SD_OPPONENT, SD_SUM };

typedef struct {
  uint32_t index;   // the warrior
  uint32_t nearest; // the other warrior with the lowest SD-score, UINT32_MAX if none
  double avg, distance, value;
} pushoff_value;

// The SD-score of a and b; sigma[k] the standard deviation of column k over
// the active rows other than k (pushoff_sigma()).
double pushoff_distance(const double *score, size_t stride, const uint32_t *active, uint32_t n, uint32_t a, uint32_t b,
                        const double *sigma, int variant);

// sigma[k] for every active k; sigma has an entry per index.
void pushoff_sigma(const double *score, size_t stride, const uint32_t *active, uint32_t n, double *sigma);

// out[i] for active[i]; sigma: scratch with an entry per index.
void pushoff_values(const double *score, size_t stride, const uint32_t *active, uint32_t n, int variant, double alpha,
                    double *sigma, pushoff_value *out);

// The position in out[] of the lowest value among the ones with keep[index]
// 0: on a tie the lower average, then the higher index. -1 if none.
int pushoff_weakest(const pushoff_value *v, uint32_t n, const uint8_t *keep);

#endif
