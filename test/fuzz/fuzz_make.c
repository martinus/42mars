// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Fuzz target: warriors from instructions (m42_warrior_make), as an evolver
// makes them, with fuzzed rules, a match, and stepping with p-space and a
// watch. One input bit per warrior keeps its fields in the range of
// m42_instruction, else they are raw bytes. A warrior that does not fit the
// rules must be refused (#86): if m42_match() or m42_load() accepts one,
// the target traps. Run by `make fuzz`.
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "42mars.h"

static uint32_t rd(const uint8_t **p, size_t *n, int bytes) {
  uint32_t v = 0;
  for (int i = 0; i < bytes; i++) {
    v <<= 8;
    if (*n) { v |= **p; ++*p; --*n; }
  }
  return v;
}

static int fits(const m42_instruction *code, uint32_t len, uint32_t start, uint32_t core_size) {
  if (start >= core_size) return 0;
  for (uint32_t k = 0; k < len; k++) {
    const m42_instruction *x = &code[k];
    if (x->opcode > 18 || x->modifier > 6 || x->a_mode > 7 || x->b_mode > 7 || x->a >= core_size || x->b >= core_size) return 0;
  }
  return 1;
}

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
  const uint8_t *p = data;
  size_t n = size;
  static const uint32_t cores[] = {1, 2, 3, 7, 16, 80, 800, 8000, 8192, 55440, 65536, 4096};
  m42_rules r = m42_rules_94();
  const uint32_t sel = rd(&p, &n, 1);
  r.core_size = cores[sel % 12];
  r.max_processes = rd(&p, &n, 2) % 9000;
  r.max_cycles = rd(&p, &n, 2) % 4000;
  r.max_length = 1 + rd(&p, &n, 1) % 40;
  r.min_distance = rd(&p, &n, 2) % (r.core_size + 2);
  r.pspace_size = rd(&p, &n, 1) % 3 == 0 ? 0 : rd(&p, &n, 2) % 600;
  const uint32_t lim = rd(&p, &n, 1);
  static const uint32_t divs[] = {0, 1, 2, 4, 5, 8, 10, 16};
  r.read_limit = divs[lim & 7];
  r.write_limit = divs[(lim >> 3) & 7];
  r.warriors = 1 + rd(&p, &n, 1) % 5;
  const uint32_t nw = 1 + rd(&p, &n, 1) % r.warriors;
  const uint32_t mo = rd(&p, &n, 1);

  int status;
  m42_ctx *m = m42_new(&r, &status);
  if (!m) return 0;

  m42_warrior *ws[5] = {0};
  void *mem[5] = {0};
  int allFit = 1;
  for (uint32_t i = 0; i < nw; i++) {
    const uint32_t len = rd(&p, &n, 1) % (r.max_length + 2);
    const int raw = rd(&p, &n, 1) & 1;
    m42_instruction code[64];
    for (uint32_t k = 0; k < len && k < 64; k++) {
      m42_instruction x;
      x.opcode = (uint8_t)rd(&p, &n, 1);
      x.modifier = (uint8_t)rd(&p, &n, 1);
      x.a_mode = (uint8_t)rd(&p, &n, 1);
      x.b_mode = (uint8_t)rd(&p, &n, 1);
      x.a = rd(&p, &n, 4);
      x.b = rd(&p, &n, 4);
      x.line = (int32_t)k;
      if (!raw) {
        x.opcode %= 19;
        x.modifier %= 7;
        x.a_mode %= 8;
        x.b_mode %= 8;
        x.a %= r.core_size;
        x.b %= r.core_size;
      }
      code[k] = x;
    }
    const uint32_t L = len < 64 ? len : 64;
    uint32_t start = rd(&p, &n, 1);
    if (!raw) start = L ? start % L : 0;
    allFit &= fits(code, L, start, r.core_size);
    const int64_t pin = (int64_t)rd(&p, &n, 1) % 3;
    const size_t need = m42_warrior_make_size(L);
    mem[i] = malloc(need);
    ws[i] = m42_warrior_make(code, L, start, (mo & 64) ? &pin : 0, mem[i], need);
  }

  m42_match_options o = m42_match_options_default();
  o.rounds = 1 + (mo & 3);
  o.seed = rd(&p, &n, 4) & 0x7fffffff;
  o.early_tie = (mo >> 2) & 1;
  o.permute = (mo >> 3) & 1;
  o.first_round = (mo >> 4) & 1 ? rd(&p, &n, 1) : 0;
  uint32_t pos[5];
  if (mo & 32) {
    const int rawPos = rd(&p, &n, 1) & 1;
    for (uint32_t i = 0; i < nw; i++) {
      pos[i] = rd(&p, &n, 4);
      if (!rawPos) pos[i] %= r.core_size;
    }
    o.positions = pos;
  }
  m42_score s[5];
  uint64_t ins;
  uint32_t *ps = 0;
  if (mo & 128) {
    const uint32_t cells = r.pspace_size ? r.pspace_size : r.core_size / 16;
    const size_t c = cells ? cells : 1;
    ps = calloc(nw * c, 4);
    o.pspace = ps;
  }
  const int st = m42_match(m, (const m42_warrior *const *)ws, nw, &o, s, &ins);
  if (st == M42_OK && !allFit) __builtin_trap(); // a warrior that does not fit was played

  void *wm = 0;
  if (sel & 0x40) {
    const size_t wsize = m42_watch_size(&r);
    if (wsize) {
      wm = malloc(wsize);
      m42_watch_attach(m, wm, wsize, &status);
    }
  }
  o.permute = 0;
  o.pspace = 0;
  const int loaded = m42_load(m, (const m42_warrior *const *)ws, nw, &o);
  if (loaded == M42_OK && !allFit) __builtin_trap();
  if (loaded == M42_OK) {
    for (int round = 0; round < 2; round++) {
      m42_start_round(m);
      for (int k = 0; k < 30; k++) {
        if (!m42_run(m, 1 + (k * 53) % 200)) break;
        uint32_t q[8];
        for (uint32_t i = 0; i < nw; i++) {
          m42_queue(m, i, q, 8);
          uint32_t v;
          m42_pspace_get(m, i, k, &v);
          m42_pspace_set(m, i, k, v + 1);
          uint32_t sc[16];
          m42_get_scores(m, i, sc, 16);
        }
      }
      m42_end_round(m);
    }
  }
  m42_watch_attach(m, 0, 0, &status);
  free(wm);
  free(ps);
  for (uint32_t i = 0; i < nw; i++) free(mem[i]);
  m42_free(m);
  return 0;
}
