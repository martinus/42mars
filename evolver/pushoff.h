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
// the active rows other than k (pushoff_sigma()). cols (0: all): only the
// columns k with cols[k] count (42evolve --diversity panel).
double pushoff_distance(const double *score, size_t stride, const uint32_t *active, uint32_t n, uint32_t a, uint32_t b,
                        const double *sigma, const uint8_t *cols, int variant);

// sigma[k] for every active k; sigma has an entry per index.
void pushoff_sigma(const double *score, size_t stride, const uint32_t *active, uint32_t n, double *sigma);

// out[i] for active[i]; sigma: scratch with an entry per index; cols as for
// pushoff_distance() (the average is over all columns).
void pushoff_values(const double *score, size_t stride, const uint32_t *active, uint32_t n, int variant, double alpha,
                    const uint8_t *cols, double *sigma, pushoff_value *out);

// Non-dominated sorting and crowding distance of NSGA-II (Deb et al. 2002)
// for n warriors on m objectives, larger better: obj[i * m + k]. front[i]:
// 0 for the warriors nobody dominates, 1 for those only warriors of front 0
// dominate, ... crowd[i]: within its front, per objective sorted by it (ties
// by index), the gap between its two neighbours over the objective's range
// among all n, summed over the objectives; INFINITY at either end; 0 for a
// copy, a warrior with the same objectives as one of lower index in its
// front (42evolve --pushoff pareto, tools/diversity.js paretoFronts()).
void pareto_fronts(const double *obj, uint32_t n, uint32_t m, uint32_t *front, double *crowd);

// The position in out[] of the lowest value among the ones with keep[index]
// 0: on a tie the lower average, then the higher index. -1 if none.
int pushoff_weakest(const pushoff_value *v, uint32_t n, const uint8_t *keep);

#endif
