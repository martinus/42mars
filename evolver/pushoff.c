// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

#include "pushoff.h"

#include <math.h>
#include <stdlib.h>

void pushoff_sigma(const double *score, size_t stride, const uint32_t *active, uint32_t n, double *sigma) {
  for (uint32_t i = 0; i < n; i++) {
    const uint32_t k = active[i];
    double mean = 0, v = 0;
    uint32_t m = 0;
    for (uint32_t j = 0; j < n; j++)
      if (active[j] != k) mean += score[active[j] * stride + k], m++;
    mean /= m;
    for (uint32_t j = 0; j < n; j++) {
      if (active[j] == k) continue;
      const double d = score[active[j] * stride + k] - mean;
      v += d * d;
    }
    sigma[k] = sqrt(v / m);
  }
}

double pushoff_se(uint32_t wins, uint32_t ties, uint32_t rounds) {
  if (!rounds) return 0;
  const double n = rounds, mu = (3.0 * wins + ties) / n, v = (9.0 * wins + ties) / n - mu * mu;
  return v > 0 ? 100 * sqrt(v / n) : 0;
}

double pushoff_distance(const double *score, size_t stride, const uint32_t *active, uint32_t n, uint32_t a, uint32_t b,
                        const double *sigma, const double *se, double z, const uint8_t *cols, int variant, int ahead) {
  double num = 0, den = 0, sum = 0;
  for (uint32_t i = 0; i < n; i++) {
    const uint32_t k = active[i];
    if (k == a || k == b || (cols && !cols[k])) continue;
    double d = score[a * stride + k] - score[b * stride + k];
    if (!ahead) d = fabs(d);
    if (se) {
      const double sa = se[a * stride + k], sb = se[b * stride + k];
      d -= z * sqrt(sa * sa + sb * sb);
    }
    if (d < 0) d = 0; // ahead: only where a scores more than b
    if (variant == SD_SUM) {
      num += d;
      den += sigma[k];
    } else if (sigma[k] > 0) {
      sum += d / sigma[k];
    }
  }
  if (variant == SD_SUM) return den > 0 ? num / den : 0;
  return sum;
}

void pushoff_values(const double *score, size_t stride, const uint32_t *active, uint32_t n, int variant, double alpha,
                    const double *se, double z, const uint8_t *cols, int ahead, double *sigma, pushoff_value *out) {
  pushoff_sigma(score, stride, active, n, sigma);
  for (uint32_t i = 0; i < n; i++) {
    const uint32_t a = active[i];
    double avg = 0;
    for (uint32_t j = 0; j < n; j++)
      if (active[j] != a) avg += score[a * stride + active[j]];
    avg /= n > 1 ? n - 1 : 1;
    double distance = INFINITY;
    uint32_t nearest = UINT32_MAX;
    for (uint32_t j = 0; j < n; j++) {
      const uint32_t b = active[j];
      if (b == a) continue;
      const double d = pushoff_distance(score, stride, active, n, a, b, sigma, se, z, cols, variant, ahead);
      if (d < distance) distance = d, nearest = b;
    }
    if (nearest == UINT32_MAX) distance = 0;
    out[i] = (pushoff_value){a, nearest, avg, distance, avg * (alpha == 1 ? distance : pow(distance, alpha))};
  }
}

int pushoff_weakest(const pushoff_value *v, uint32_t n, const uint8_t *keep) {
  int w = -1;
  for (uint32_t i = 0; i < n; i++) {
    if (keep && keep[v[i].index]) continue;
    if (w < 0 || v[i].value < v[w].value ||
        (v[i].value == v[w].value && (v[i].avg < v[w].avg || (v[i].avg == v[w].avg && v[i].index > v[w].index))))
      w = (int)i;
  }
  return w;
}

void pareto_fronts(const double *obj, uint32_t n, uint32_t m, uint32_t *front, double *crowd) {
  uint32_t *order = malloc((n ? n : 1) * sizeof *order);
  uint8_t *now = malloc(n ? n : 1);
  if (!order || !now) abort();
  for (uint32_t i = 0; i < n; i++) front[i] = UINT32_MAX, crowd[i] = 0;
  uint32_t done = 0;
  for (uint32_t f = 0; done < n; f++) {
    for (uint32_t i = 0; i < n; i++) {
      now[i] = 0;
      if (front[i] != UINT32_MAX) continue;
      int dominated = 0;
      for (uint32_t j = 0; j < n && !dominated; j++) {
        if (j == i || front[j] != UINT32_MAX) continue;
        int all = 1, better = 0;
        for (uint32_t k = 0; k < m; k++) {
          if (obj[j * m + k] < obj[i * m + k]) all = 0;
          if (obj[j * m + k] > obj[i * m + k]) better = 1;
        }
        dominated = all && better;
      }
      now[i] = !dominated;
    }
    uint32_t c = 0;
    for (uint32_t i = 0; i < n; i++)
      if (now[i]) front[i] = f, order[c++] = i;
    done += c;
    // the crowding distance of this front: per objective, sorted by it (ties
    // by index), the ends infinite, the others the gap between their two
    // neighbours over the objective's range among all n
    for (uint32_t k = 0; k < m; k++) {
      c = 0;
      for (uint32_t i = 0; i < n; i++)
        if (now[i]) order[c++] = i;
      double lo = INFINITY, hi = -INFINITY;
      for (uint32_t i = 0; i < n; i++) {
        if (obj[i * m + k] < lo) lo = obj[i * m + k];
        if (obj[i * m + k] > hi) hi = obj[i * m + k];
      }
      for (uint32_t a = 1; a < c; a++) { // insertion sort, stable
        const uint32_t x = order[a];
        uint32_t b = a;
        while (b > 0 && obj[order[b - 1] * m + k] > obj[x * m + k]) order[b] = order[b - 1], b--;
        order[b] = x;
      }
      if (c) crowd[order[0]] = crowd[order[c - 1]] = INFINITY;
      for (uint32_t a = 1; a + 1 < c; a++)
        if (hi > lo) crowd[order[a]] += (obj[order[a + 1] * m + k] - obj[order[a - 1] * m + k]) / (hi - lo);
    }
    // a copy (the same objectives as an earlier one of the front) is the most crowded
    for (uint32_t i = 0; i < n; i++) {
      if (!now[i]) continue;
      for (uint32_t j = 0; j < i; j++) {
        if (!now[j]) continue;
        uint32_t k = 0;
        while (k < m && obj[j * m + k] == obj[i * m + k]) k++;
        if (k == m) {
          crowd[i] = 0;
          break;
        }
      }
    }
  }
  free(order);
  free(now);
}
