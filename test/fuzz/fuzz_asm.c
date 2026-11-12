// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Fuzz target: arbitrary bytes as Redcode source through the whole public
// interface: assemble, every accessor, pack, a match against itself,
// stepping with a watch. The first two bytes select rules, flags, registers
// and match options; the rest is the source. Run by `make fuzz`.
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "42mars.h"

static void touch(const void *p, size_t n) {
  volatile unsigned char s = 0;
  for (size_t i = 0; i < n; i++) s ^= ((const unsigned char *)p)[i];
  (void)s;
}

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
  if (size < 2) return 0;
  const unsigned sel = data[0], sel2 = data[1];
  data += 2;
  size -= 2;
  m42_rules r = m42_rules_94();
  switch (sel & 3) {
    case 1: r.core_size = 800; r.max_processes = 800; r.max_length = 20; r.min_distance = 20; break;
    case 2: r.core_size = 80; r.max_processes = 80; r.max_length = 5; r.min_distance = 5; break;
    case 3: r.core_size = 55440; r.max_processes = 10000; r.max_length = 200; r.min_distance = 200; break;
    default: break;
  }
  r.max_cycles = 3000;
  if (sel & 4) r.read_limit = r.core_size / 4;
  if (sel & 8) r.write_limit = r.core_size / 8;
  if (sel & 16) r.warriors = 3;
  const unsigned flags = (sel & 32 ? M42_UTF8 : 0) | (sel & 64 ? M42_ICWS88 : 0);
  int64_t regs[26];
  for (int i = 0; i < 26; i++) regs[i] = (sel & 128) ? (int64_t)i * 1234567 - 99 : 0;

  int status = 12345;
  m42_warrior *w = m42_assemble_new((const char *)data, size, &r, flags, (sel & 128) ? regs : 0, &status);
  if (!w) return 0;

  char buf[64];
  for (int t = M42_NAME; t <= M42_STRATEGY; t++) {
    size_t n = m42_warrior_text(w, (m42_text)t, buf, sizeof buf);
    char *big = malloc(n + 1);
    m42_warrior_text(w, (m42_text)t, big, n + 1);
    touch(big, n + 1);
    free(big);
  }
  const uint32_t msgs = m42_warrior_errors(w) + m42_warrior_warnings(w);
  for (uint32_t i = 0; i < msgs + 1; i++) {
    int32_t line;
    int is_error;
    size_t n = m42_warrior_message(w, i, &line, &is_error, buf, sizeof buf);
    char *big = malloc(n + 1);
    m42_warrior_message(w, i, 0, 0, big, n + 1);
    touch(big, n + 1);
    free(big);
  }
  for (uint32_t i = 0; i < m42_warrior_statements(w) + 1; i++) {
    size_t n = m42_warrior_statement(w, i, buf, sizeof buf);
    char *big = malloc(n + 1);
    m42_warrior_statement(w, i, big, n + 1);
    touch(big, n + 1);
    free(big);
  }
  const uint32_t len = m42_warrior_length(w);
  if (m42_warrior_code(w)) touch(m42_warrior_code(w), len * sizeof(m42_instruction));
  int64_t pin;
  m42_warrior_pin(w, &pin);
  (void)m42_warrior_start(w);

  if (m42_warrior_ok(w)) {
    m42_ctx *m = m42_new(&r, &status);
    if (m) {
      const m42_warrior *ws[3] = {w, w, w};
      const uint32_t n = r.warriors == 3 && (sel2 & 1) ? 3 : 2;
      m42_match_options o = m42_match_options_default();
      o.rounds = 3;
      o.seed = sel2;
      o.early_tie = (sel2 >> 1) & 1;
      o.permute = n == 2 && ((sel2 >> 2) & 1);
      m42_score s[3];
      uint64_t ins;
      uint8_t log[3 * 16];
      if (m42_log_size(n, 3) <= sizeof log) o.log = log;
      m42_match(m, ws, n, &o, s, &ins);

      // stepping, with a watch for half of the inputs
      void *wm = 0;
      if (sel2 & 8) {
        size_t wsz = m42_watch_size(&r);
        wm = malloc(wsz);
        m42_watch_attach(m, wm, wsz, &status);
      }
      o.permute = 0;
      if (m42_load(m, ws, n, &o) == M42_OK) {
        for (int round = 0; round < 2; round++) {
          m42_start_round(m);
          for (int k = 0; k < 40; k++) {
            if (!m42_run(m, 1 + (k * 37) % 300)) break;
            uint32_t q[16];
            for (uint32_t i = 0; i < n; i++) {
              m42_queue(m, i, q, 16);
              m42_warrior_state st;
              m42_get_warrior(m, i, &st, sizeof st);
            }
          }
          m42_state st;
          m42_get_state(m, &st, sizeof st);
          m42_end_round(m);
        }
        touch(m42_core(m), (size_t)r.core_size * sizeof(m42_cell));
      }
      m42_watch_attach(m, 0, 0, &status);
      free(wm);
      m42_free(m);
    }
  }
  m42_warrior_free(w);
  return 0;
}
