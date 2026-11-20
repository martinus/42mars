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

// How a column counts in the SD-score from a to b (42evolve --difference):
// |a_k - b_k|, max(0, a_k - b_k), or shape: |a_k - b_k - c| with the c that
// makes the sum smallest, so two rows that differ by a constant are at
// distance 0 (#167). That c is the weighted median of the differences
// (pushoff_shift()), the weights those of the sum: 1 / sigma_k for the
// columns with sigma_k > 0 (SD_OPPONENT), 1 for all (SD_SUM).
enum { DIFF_ABS, DIFF_AHEAD, DIFF_SHAPE };

typedef struct {
  uint32_t index;   // the warrior
  uint32_t nearest; // the other warrior with the lowest SD-score, UINT32_MAX if none
  double avg, distance, value;
} pushoff_value;

// The standard error of a score in points per 100 rounds (3 a win, `tie` a
// tie, 1 as on a hill) from one match of `rounds` rounds: with
// mu = (3W + tie T)/n and v = (9W + tie^2 T)/n - mu^2, 100 sqrt(v / n).
double pushoff_se(uint32_t wins, uint32_t ties, uint32_t rounds, double tie);

// The SD-score of a and b; sigma[k] the standard deviation of column k over
// the active rows other than k (pushoff_sigma()). With se (the standard
// error of each score, laid out as score) a column counts only the part of
// |a_k - b_k| above z sqrt(se_ak^2 + se_bk^2): what the noise of the two
// matches can explain is no difference (42evolve --noise z, #148). se 0:
// the plain SD-score. cols (0: all): only the columns k with cols[k] count
// (42evolve --diversity panel). ahead (42evolve --difference ahead): a
// column counts only a_k - b_k where it is positive, where a scores more
// than b, so the score is not symmetric: a warrior is far from its nearest
// only when it does better against someone, not when it does worse; with se
// the part of a_k - b_k above z sqrt(se_ak^2 + se_bk^2). difference is
// DIFF_ABS, DIFF_AHEAD or DIFF_SHAPE; with DIFF_SHAPE and se the part of
// |a_k - b_k - c| above z sqrt(se_ak^2 + se_bk^2).
double pushoff_distance(const double *score, size_t stride, const uint32_t *active, uint32_t n, uint32_t a, uint32_t b,
                        const double *sigma, const double *se, double z, const uint8_t *cols, int variant, int difference);

// The c that makes sum w_k |x_k - c| smallest, the weighted median of x:
// with the x sorted (on a tie by position), the first whose weights up to
// and including it reach half of all. 0 for m 0 or no weight.
double pushoff_shift(const double *x, const double *w, uint32_t m);

// sigma[k] for every active k; sigma has an entry per index.
void pushoff_sigma(const double *score, size_t stride, const uint32_t *active, uint32_t n, double *sigma);

// out[i] for active[i]; sigma: scratch with an entry per index; se, z and
// cols and difference as for pushoff_distance() (the average is over all
// columns); with DIFF_AHEAD the nearest of a is the b it is least ahead of.
void pushoff_values(const double *score, size_t stride, const uint32_t *active, uint32_t n, int variant, double alpha,
                    const double *se, double z, const uint8_t *cols, int difference, double *sigma, pushoff_value *out);

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
