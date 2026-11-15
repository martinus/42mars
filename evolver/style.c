// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

#include "style.h"

#include <string.h>

typedef struct {
  uint32_t copies, moved, written, whole, read, tasks;
} look_t;

// The numbers of one look at warrior 0 now (look() of tools/style.js).
static look_t look(const m42_ctx *m, const m42_watch *wa, uint32_t len) {
  m42_warrior_state ws;
  m42_get_warrior(m, 0, &ws, sizeof ws);
  const uint32_t core = wa->core_size, pos = ws.position;
  look_t l = {0, 0, 0, 0, 0, ws.processes};
  for (uint32_t c = 0; c < core; c++) {
    const int away = (c + core - pos) % core >= len;
    const int32_t org = wa->origin[c];
    if (away && org >= 0 && (org >> 16) == 0) l.copies++;
    if (away && wa->exec_by[c] == 1 && wa->t_exec[c] > 0) l.moved++;
    if (!away) continue; // its own code is its own from the load on
    if (wa->owner[c] == 1) {
      l.written++;
      if (wa->bump[c] == 0) l.whole++;
    } else if (wa->read_by[c] == 1 && wa->t_read[c] > 0) {
      l.read++;
    }
  }
  return l;
}

static int alive0(const m42_ctx *m) {
  m42_warrior_state ws;
  m42_get_warrior(m, 0, &ws, sizeof ws);
  return ws.alive != 0;
}

static int round_over(const m42_ctx *m) {
  m42_state s;
  m42_get_state(m, &s, sizeof s);
  return s.round_over != 0;
}

int style_measure(m42_ctx *m, const m42_watch *wa, const m42_warrior *w, const m42_warrior *const *opponents, uint32_t n,
                  uint32_t rounds, uint32_t instructions, int64_t seed, uint32_t step, style *out) {
  double sum[6] = {0};
  uint32_t looks = 0, tried = 0, full = 0;
  const uint32_t len = m42_warrior_length(w);
  for (uint32_t o = 0; o < n; o++) {
    for (uint32_t r = 0; r < rounds; r++) {
      const m42_warrior *pair[2] = {w, opponents[o]};
      m42_match_options opt = m42_match_options_default();
      opt.seed = seed + r;
      int status = m42_load(m, pair, 2, &opt);
      if (status == M42_OK) status = m42_start_round(m);
      if (status != M42_OK) return status;
      tried++;
      int have = 0;
      look_t last = {0};
      uint64_t ran = 0;
      while (ran < instructions && !round_over(m) && alive0(m)) {
        ran += m42_run(m, instructions - ran < step ? instructions - ran : step);
        if (alive0(m)) last = look(m, wa, len), have = 1;
      }
      if (ran >= instructions && alive0(m)) full++;
      if (!have) continue;
      sum[0] += last.copies, sum[1] += last.moved, sum[2] += last.written;
      sum[3] += last.whole, sum[4] += last.read, sum[5] += last.tasks;
      looks++;
    }
  }
  const double k = looks ? looks : 1;
  *out = (style){sum[0] / k,
                 sum[1] / k,
                 sum[2] / k,
                 sum[2] ? sum[3] / sum[2] : 0,
                 sum[4] / k,
                 sum[5] / k,
                 tried ? (double)full / tried : 0,
                 tried ? (double)looks / tried : 0};
  return M42_OK;
}

int style_kind(const style *s) {
  if (s->measured == 0) return KIND_DIES;
  if (s->copies >= 20 && s->moved >= 20 && s->tasks >= 250) return KIND_PAPER;
  if (s->copies >= 20 && s->moved >= 20) return KIND_MOVES;
  if (s->read >= 50 && s->read >= s->copies / 2) return KIND_SCANNER;
  if (s->copies >= 20) return KIND_THROWS;
  if (s->written >= 100 && s->whole >= 0.5) return KIND_FIELDS;
  if (s->written >= 100) return KIND_INCREMENTS;
  return KIND_LITTLE;
}

const char *style_kind_name(int kind) {
  static const char *const names[KIND_COUNT] = {
      "dies at once",
      "copies itself with many processes (paper)",
      "runs copies of its code, few processes (imp, a stone that moves)",
      "reads far cells before it writes (scanner)",
      "throws copies of its code (stone, clear)",
      "writes fields, no copies of its code",
      "damages by increments (< > { })",
      "writes little (scanner, or waits)"};
  return kind >= 0 && kind < KIND_COUNT ? names[kind] : "?";
}
