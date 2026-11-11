// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Drives the public functions of lib/42mars.h for test/c-api.test.js and
// prints one JSON object. Arguments: warrior files; the matches use those
// that assemble, the first of them against the others. The JS side compares
// the output with js/assembler.js and the wasm engine.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../../lib/42mars.h"

static char *read_file(const char *path, size_t *len) {
  FILE *f = fopen(path, "rb");
  if (!f) exit(2);
  static char buf[1 << 20];
  *len = fread(buf, 1, sizeof buf, f);
  fclose(f);
  return buf;
}

static void json_string(const char *s) {
  putchar('"');
  for (; *s; s++) {
    const unsigned char c = (unsigned char)*s;
    if (c == '"' || c == '\\') printf("\\%c", c);
    else if (c < 32) printf("\\u%04x", c);
    else putchar(c);
  }
  putchar('"');
}

// Working memory of the warriors, overwritten after packing and kept until
// the end: freed right away, the compiler drops the overwriting.
static void *used[64];
static int nused;

// Assembles with caller memory, starting too small: every size from 16
// bytes upward until it fits, then packs the warrior into a block of its
// own and overwrites the working memory.
static m42_warrior *assemble(const char *path, const m42_rules *r, int *tries) {
  size_t len;
  const char *src = read_file(path, &len);
  for (size_t size = 16;; size = size * 2 + 1) {
    void *mem = malloc(size);
    m42_warrior *w;
    const int s = m42_assemble(src, len, r, 0, mem, size, &w);
    ++*tries;
    if (s == M42_ERR_MEMORY) { free(mem); continue; }
    if (s != M42_OK) exit(3);
    const size_t need = m42_warrior_packed_size(w);
    void *dst = malloc(need);
    if (m42_warrior_pack(w, dst, need - 1)) exit(4); // one byte short must fail
    m42_warrior *p = m42_warrior_pack(w, dst, need);
    memset(mem, 0xab, size); // the packed copy must not point into it
    used[nused++] = mem;
    return p;
  }
}

static unsigned core_hash(const m42_ctx *m, uint32_t n) {
  const m42_cell *c = m42_core(m);
  unsigned h = 2166136261u;
  for (uint32_t i = 0; i < n; i++) {
    const unsigned v[4] = {c[i].a, c[i].b, c[i].word, c[i].pad};
    for (int k = 0; k < 4; k++) h = (h ^ v[k]) * 16777619u;
  }
  return h;
}

int main(int argc, char **argv) {
  const m42_rules r = m42_rules_94();
  const int n = argc - 1;
  m42_warrior *w[64];
  printf("{\"version\":");
  json_string(m42_version());
  printf(",\"warriors\":[");
  for (int i = 0; i < n; i++) {
    int tries = 0;
    w[i] = assemble(argv[i + 1], &r, &tries);
    char name[64], author[64];
    m42_warrior_text(w[i], M42_NAME, name, sizeof name);
    m42_warrior_text(w[i], M42_AUTHOR, author, sizeof author);
    int64_t pin = 0;
    const int hasPin = m42_warrior_pin(w[i], &pin);
    printf("%s{\"ok\":%d,\"name\":", i ? "," : "", m42_warrior_ok(w[i]));
    json_string(name);
    printf(",\"author\":");
    json_string(author);
    printf(",\"start\":%u,\"pin\":", m42_warrior_start(w[i]));
    if (hasPin) printf("%lld", (long long)pin); else printf("null");
    printf(",\"tries\":%d,\"instructions\":[", tries);
    const m42_instruction *code = m42_warrior_code(w[i]);
    for (uint32_t k = 0; k < m42_warrior_length(w[i]); k++) {
      printf("%s[%u,%u,%u,%u,%u,%u,%d]", k ? "," : "", code[k].opcode, code[k].modifier, code[k].a_mode, code[k].a,
             code[k].b_mode, code[k].b, (int)code[k].line);
    }
    printf("],\"messages\":[");
    for (uint32_t k = 0; k < m42_warrior_errors(w[i]) + m42_warrior_warnings(w[i]); k++) {
      char text[256];
      int32_t line;
      int is_error;
      m42_warrior_message(w[i], k, &line, &is_error, text, sizeof text);
      printf("%s[%d,%d,", k ? "," : "", is_error, (int)line);
      json_string(text);
      printf("]");
    }
    printf("]}");
  }

  // A context in caller memory; one byte less is too little.
  const size_t size = m42_ctx_size(&r);
  void *mem = malloc(size);
  int status;
  const int tooSmall = m42_ctx_init(mem, size - 1, &r, &status) == 0 && status == M42_ERR_MEMORY;
  m42_ctx *m = m42_ctx_init(mem, size, &r, &status);
  printf("],\"ctxTooSmall\":%d", tooSmall);

  // The first warrior that assembles against the others: one bench, and
  // each match alone.
  m42_warrior *ok[64];
  int nok = 0;
  for (int i = 0; i < n; i++) if (m42_warrior_ok(w[i])) ok[nok++] = w[i];
  m42_match_options o = m42_match_options_default();
  o.rounds = 20;
  o.seed = 1234;
  m42_score bench[128];
  uint64_t benchInstructions;
  const int bs = m42_bench(m, ok[0], (const m42_warrior *const *)ok + 1, (uint32_t)nok - 1, &o, bench, &benchInstructions);
  printf(",\"bench\":{\"status\":%d,\"instructions\":%llu,\"scores\":[", bs, (unsigned long long)benchInstructions);
  for (int i = 0; i < 2 * (nok - 1); i++) printf("%s[%u,%u,%u]", i ? "," : "", bench[i].wins, bench[i].losses, bench[i].ties);
  printf("]},\"matches\":[");
  for (int i = 1; i < nok; i++) {
    const m42_warrior *pair[2] = {ok[0], ok[i]};
    m42_score s[2];
    uint64_t ins;
    const int st = m42_match(m, pair, 2, &o, s, &ins);
    printf("%s{\"status\":%d,\"instructions\":%llu,\"scores\":[[%u,%u,%u],[%u,%u,%u]]}", i > 1 ? "," : "", st,
           (unsigned long long)ins, s[0].wins, s[0].losses, s[0].ties, s[1].wins, s[1].losses, s[1].ties);
  }

  // Stepping: warriors 0 and 1, one round in steps of 1000, the core hash
  // and the state after each of the first rounds.
  printf("],\"steps\":[");
  const m42_warrior *pair[2] = {ok[0], ok[1]};
  printf("{\"load\":%d", m42_load(m, pair, 2, &o));
  for (int round = 0; round < 3; round++) {
    m42_start_round(m);
    uint64_t executed = 0;
    m42_state st;
    for (m42_get_state(m, &st); !st.round_over; m42_get_state(m, &st)) executed += m42_run(m, 1000);
    m42_warrior_state ws0, ws1;
    m42_get_warrior(m, 0, &ws0);
    m42_get_warrior(m, 1, &ws1);
    printf(",\"r%d\":{\"executed\":%llu,\"time\":%llu,\"round\":%u,\"hash\":%u,\"alive\":[%u,%u],\"position\":%u}", round,
           (unsigned long long)executed, (unsigned long long)st.time, st.round, core_hash(m, r.core_size), ws0.alive,
           ws1.alive, ws1.position);
  }
  uint32_t queue[8];
  m42_start_round(m);
  m42_run(m, 50);
  const uint32_t tasks = m42_queue(m, 0, queue, 8);
  printf(",\"queue\":[%u", tasks);
  for (uint32_t k = 0; k < tasks && k < 8; k++) printf(",%u", queue[k]);
  printf("]");

  // p-space: set, get, out of range.
  uint32_t v = 0;
  const int s1 = m42_pspace_set(m, 0, 7, 4242);
  const int s2 = m42_pspace_get(m, 0, 7, &v);
  const int s3 = m42_pspace_set(m, 0, r.pspace_size, 1);
  const int s4 = m42_pspace_get(m, 5, 0, &v);
  printf(",\"pspace\":[%d,%d,%u,%d,%d]}", s1, s2, v, s3, s4);

  // Errors: no warriors, a bad rule, too many warriors, no context,
  // assembling with the bad rule, a warrior that did not assemble.
  m42_rules bad = r;
  bad.core_size = 70000;
  printf("],\"errors\":[%d,%d,%d,%d,%d,%d]", m42_match(m, pair, 0, &o, 0, 0), m42_ctx_size(&bad) == 0,
         m42_match(m, (const m42_warrior *const *)w, 3, &o, 0, 0), m42_start_round(0),
         m42_assemble("dat 0", 5, &bad, 0, mem, size, &w[63]), m42_match(m, (const m42_warrior *const *)w + n - 2, 2, &o, 0, 0));

  // PIN: warriors with the same PIN share p-space cells 1 and up.
  int st;
  m42_warrior *p7a = m42_assemble_new(" pin 7\n dat 0\n", 14, &r, 0, &st);
  m42_warrior *p7b = m42_assemble_new(" pin 7\n dat 1\n", 14, &r, 0, &st);
  m42_warrior *p8 = m42_assemble_new(" pin 8\n dat 2\n", 14, &r, 0, &st);
  const m42_warrior *same[2] = {p7a, p7b}, *other[2] = {p7a, p8};
  uint32_t shared = 0, apart = 0, last = 0;
  if (!p7a || !p7b || !p8 || !m42_warrior_ok(p7a) || !m42_warrior_ok(p7b) || !m42_warrior_ok(p8)) exit(5);
  if (m42_load(m, same, 2, &o) != M42_OK) exit(6);
  m42_pspace_set(m, 0, 3, 99);
  m42_pspace_set(m, 0, 0, 5); // the last result is not shared
  m42_pspace_get(m, 1, 3, &shared);
  m42_pspace_get(m, 1, 0, &last);
  if (m42_load(m, other, 2, &o) != M42_OK) exit(7);
  m42_pspace_set(m, 0, 3, 99);
  m42_pspace_get(m, 1, 3, &apart);
  printf(",\"pin\":[%u,%u,%u]", shared, last, apart);

  // A context of exactly m42_ctx_size() holds two warriors of max_length.
  char longest[1024] = "";
  for (uint32_t i = 0; i < r.max_length; i++) strcat(longest, " spl 0\n");
  m42_warrior *big = m42_assemble_new(longest, strlen(longest), &r, 0, &st);
  void *exact = malloc(size);
  m42_ctx *m2 = m42_ctx_init(exact, size, &r, &st);
  const m42_warrior *bigs[2] = {big, big};
  m42_score sc[2];
  printf(",\"full\":[%u,%d]", m42_warrior_length(big), m42_match(m2, bigs, 2, &o, sc, 0));
  printf("}\n");
  for (int i = 0; i < n; i++) free(w[i]);
  m42_warrior_free(p7a);
  m42_warrior_free(p7b);
  m42_warrior_free(p8);
  m42_warrior_free(big);
  free(exact);
  free(mem);
  for (int i = 0; i < nused; i++) free(used[i]);
  return 0;
}
