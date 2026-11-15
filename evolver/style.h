// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The style of a warrior: what it does to the core, measured with the watch
// (lib/42mars.h). The same measurement and the same kinds as tools/style.js,
// whose comment has the definitions; test/evolver.test.js compares the two.

#ifndef EVOLVER_STYLE_H
#define EVOLVER_STYLE_H

#include <stdint.h>

#include "42mars.h"

typedef struct {
  double copies, moved, written, whole, read, tasks, alive, measured;
} style;

enum { KIND_DIES, KIND_PAPER, KIND_MOVES, KIND_SCANNER, KIND_THROWS, KIND_FIELDS, KIND_INCREMENTS, KIND_LITTLE, KIND_COUNT };

// w plays `rounds` rounds against each of the n opponents, a fresh load with
// seed + round for each, a look every `step` instructions up to
// `instructions`. m must have the watch wa attached. Returns M42_OK or the
// status of the first call that failed.
int style_measure(m42_ctx *m, const m42_watch *wa, const m42_warrior *w, const m42_warrior *const *opponents, uint32_t n,
                  uint32_t rounds, uint32_t instructions, int64_t seed, uint32_t step, style *out);

int style_kind(const style *s);
// The name of a kind, as kind() of tools/style.js gives it.
const char *style_kind_name(int kind);

#endif
