// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

#include "pushoff.h"

#include <math.h>

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
                        const double *sigma, const double *se, double z, const uint8_t *cols, int variant) {
  double num = 0, den = 0, sum = 0;
  for (uint32_t i = 0; i < n; i++) {
    const uint32_t k = active[i];
    if (k == a || k == b || (cols && !cols[k])) continue;
    double d = fabs(score[a * stride + k] - score[b * stride + k]);
    if (se) {
      const double sa = se[a * stride + k], sb = se[b * stride + k];
      d -= z * sqrt(sa * sa + sb * sb);
      if (d < 0) d = 0;
    }
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
                    const double *se, double z, const uint8_t *cols, double *sigma, pushoff_value *out) {
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
      const double d = pushoff_distance(score, stride, active, n, a, b, sigma, se, z, cols, variant);
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
