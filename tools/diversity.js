// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Diversity push-off, as Tournament Weekend 2026 scores its tournaments
// (https://corewar.co.uk/tournamentweekend2026a.htm): each warrior's value
// is its average score times the lowest SD-score between its row of scores
// and the row of any other warrior; the lowest value leaves, the values are
// computed again, until one is left. The SD-score is from Ismael, "The
// Standard Deviation Score: a novel similarity metric for data analysis",
// Journal of Big Data 12:58 (2025), which gives it two ways:
//   'opponent'  its pseudocode: sum over the columns k of |a_k - b_k| / sigma_k
//   'sum'       its Eq. 6: sum of |a_k - b_k| over sum of sigma_k
// sigma_k is the standard deviation (1/n) of the column over the warriors
// still in. The columns of a pair are the warriors still in except the two.
// A column with sigma 0 adds nothing to 'opponent' (all its entries are
// equal). 'sum' orders the pairs of one step as plain Manhattan distance.
//
// Plain functions on arrays, for tools/pushoff.mjs, the evolver's tests
// and the evolver dashboard (ui/); evolver/pushoff.c computes the same.

// score[a][b]: a's score against b (any scale, null or undefined on the
// diagonal). active: the indices still in.
export function sdDistance(score, active, a, b, variant = 'opponent') {
  let num = 0, den = 0, sum = 0;
  for (const k of active) {
    if (k === a || k === b) continue;
    let mean = 0, n = 0;
    for (const r of active) if (r !== k) { mean += score[r][k]; n++; }
    mean /= n;
    let v = 0;
    for (const r of active) if (r !== k) v += (score[r][k] - mean) ** 2;
    const sigma = Math.sqrt(v / n);
    const d = Math.abs(score[a][k] - score[b][k]);
    if (variant === 'sum') {
      num += d;
      den += sigma;
    } else if (sigma > 0) {
      sum += d / sigma;
    }
  }
  if (variant === 'sum') return den > 0 ? num / den : 0;
  return sum;
}

// For each index of `active`: { avg, nearest, distance, value }.
// value = avg * distance ** alpha, distance the lowest SD-score to any other.
export function pushoffValues(score, active, { variant = 'opponent', alpha = 1 } = {}) {
  return active.map((a) => {
    let avg = 0;
    for (const b of active) if (b !== a) avg += score[a][b];
    avg /= Math.max(1, active.length - 1);
    let distance = Infinity, nearest = -1;
    for (const b of active) {
      if (b === a) continue;
      const d = sdDistance(score, active, a, b, variant);
      if (d < distance) { distance = d; nearest = b; }
    }
    if (nearest < 0) distance = 0;
    return { index: a, avg, nearest, distance, value: avg * distance ** alpha };
  });
}

// The lowest value among the ones that may leave (not in `keep`); on a tie
// the lower average, then the higher index. With two warriors left there are
// no columns, both distances are 0, and the average decides.
export function weakest(values, keep = new Set()) {
  let w = null;
  for (const v of values) {
    if (keep.has(v.index)) continue;
    if (!w || v.value < w.value || (v.value === w.value && (v.avg < w.avg || (v.avg === w.avg && v.index > w.index)))) w = v;
  }
  return w ? w.index : -1;
}

// The whole push-off over indices 0..n-1: the order in which they leave,
// each with its values at that moment. The last one in the list is the winner.
export function pushoff(score, options = {}) {
  let active = score.map((_, i) => i);
  const out = [];
  while (active.length > 1) {
    const values = pushoffValues(score, active, options);
    const out1 = weakest(values);
    out.push(values.find((v) => v.index === out1));
    active = active.filter((i) => i !== out1);
  }
  if (active.length) out.push({ index: active[0], avg: 0, nearest: -1, distance: 0, value: 0 });
  return out;
}
