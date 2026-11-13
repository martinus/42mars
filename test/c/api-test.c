// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Drives the public functions of lib/42mars.h for test/c-api.test.js and
// prints one JSON object. Arguments: warrior files; the matches use those
// that assemble, the first of them against the others. The JS side compares
// the output with the wasm build of the library.

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
    const int s = m42_assemble(src, len, r, 0, 0, mem, size, &w);
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

// One FNV-1a step over a 32-bit value (2166136261 to start).
static uint32_t fnv(uint32_t h, uint32_t v) { return (h ^ v) * 16777619u; }

static unsigned core_hash(const m42_ctx *m, uint32_t n) {
  const m42_cell *c = m42_core(m);
  uint32_t h = 2166136261u;
  for (uint32_t i = 0; i < n; i++) {
    const uint32_t v[4] = {c[i].a, c[i].b, c[i].word, c[i].pad};
    for (int k = 0; k < 4; k++) h = fnv(h, v[k]);
  }
  return h;
}

// Kept in step with the list in test/c-api.test.js.
static const char *const EXPRESSIONS[] = {
  "9223372036854775807+1", "9223372036854775806+1", "-9223372036854775807-1", "-9223372036854775807-2",
  "9223372036854775807-(-1)", "(0-9223372036854775807)-(1)", "1-9223372036854775807-3", "5-7",
  "4611686018427387904+4611686018427387904", "-4611686018427387904+-4611686018427387904", "3037000500*3037000500",
};

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
    for (m42_get_state(m, &st, sizeof st); !st.round_over; m42_get_state(m, &st, sizeof st)) executed += m42_run(m, 1000);
    m42_warrior_state ws0, ws1;
    m42_get_warrior(m, 0, &ws0, sizeof ws0);
    m42_get_warrior(m, 1, &ws1, sizeof ws1);
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
  printf(",\"pspace\":[%d,%d,%u,%d,%d]", s1, s2, v, s3, s4);

  // A watch: too small, then attached; a round of warriors 0 and 1 in steps
  // of 300 up to time 3000, then a hash over the cells' bookkeeping, the
  // territories, the execution counts, the last 8 trace entries and the
  // deaths; then detached.
  const size_t wsize = m42_watch_size(&r);
  void *wmem = malloc(wsize);
  int ws1 = 0, ws2 = 0, ws3 = 0;
  const m42_watch *small = m42_watch_attach(m, wmem, wsize - 64, &ws1);
  const m42_watch *x = m42_watch_attach(m, wmem, wsize, &ws2);
  if (!x || m42_load(m, pair, 2, &o) != M42_OK) exit(8);
  m42_start_round(m);
  m42_state wst;
  for (m42_get_state(m, &wst, sizeof wst); !wst.round_over && wst.time < 3000; m42_get_state(m, &wst, sizeof wst)) m42_run(m, 300);
  uint32_t h = 2166136261u;
  for (uint32_t a = 0; a < r.core_size; a++) {
    const uint32_t v[8] = {x->owner[a], x->exec_by[a], x->read_by[a], (uint32_t)x->bump[a], (uint32_t)x->origin[a],
                           x->t_write[a], x->t_read[a], x->t_exec[a]};
    for (int k = 0; k < 8; k++) h = fnv(h, v[k]);
  }
  uint64_t counts = 0;
  for (uint32_t k = 0; k < 2 * x->code_stride; k++) counts += x->exec_count[k];
  printf(",\"watch\":{\"status\":[%d,%d],\"time\":%llu,\"hash\":%u,\"territory\":[%u,%u],\"counts\":%llu,\"trace\":[",
         small ? 1 : ws1, ws2, (unsigned long long)wst.time, h, x->territory[0], x->territory[1], (unsigned long long)counts);
  for (uint64_t t = wst.time - 7; t <= wst.time; t++) {
    const m42_trace_entry *e = &x->trace[t % M42_TRACE_SIZE];
    printf("%s[%u,%u,%u,%u]", t + 7 == wst.time ? "" : ",", e->pc, e->a, e->b, e->meta);
  }
  printf("],\"deaths\":%llu", (unsigned long long)x->deaths);
  const m42_watch *gone = m42_watch_attach(m, 0, 0, &ws3);
  m42_start_round(m);
  printf(",\"detached\":[%d,%d,%llu]}}", gone ? 1 : 0, ws3, (unsigned long long)m42_run(m, 10));
  free(wmem);

  // Errors: no warriors, a bad rule, too many warriors, no context,
  // assembling with the bad rule, a warrior that did not assemble.
  m42_rules bad = r, zero = r;
  bad.core_size = 70000; // too big for the simulator, fine for the assembler
  zero.core_size = 0;
  printf("],\"errors\":[%d,%d,%d,%d,%d,%d]", m42_match(m, pair, 0, &o, 0, 0), m42_ctx_size(&bad) == 0,
         m42_match(m, (const m42_warrior *const *)w, 3, &o, 0, 0), m42_start_round(0),
         m42_assemble("dat 0", 5, &zero, 0, 0, mem, size, &w[63]), m42_match(m, (const m42_warrior *const *)w + n - 2, 2, &o, 0, 0));

  // permute: two warriors, no fixed positions
  m42_match_options po = o;
  po.permute = 1;
  const int permuteOne = m42_match(m, pair, 1, &po, 0, 0), permuteTwo = m42_match(m, pair, 2, &po, 0, 0);
  const uint32_t fixedAt[2] = {0, 4000};
  po.positions = fixedAt;
  printf(",\"permute\":[%d,%d,%d]", permuteOne, permuteTwo, m42_match(m, pair, 2, &po, 0, 0));

  // PIN: warriors with the same PIN share p-space cells 1 and up.
  int st;
  m42_warrior *p7a = m42_assemble_new(" pin 7\n dat 0\n", 14, &r, 0, 0, &st);
  m42_warrior *p7b = m42_assemble_new(" pin 7\n dat 1\n", 14, &r, 0, 0, &st);
  m42_warrior *p8 = m42_assemble_new(" pin 8\n dat 2\n", 14, &r, 0, 0, &st);
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

  // The interface of 1.0 (#89): m42_cells() against m42_core(), around the
  // end of the core; the getters with their size, one byte less, and more
  // (the bytes after the struct stay); m42_get_scores().
  {
    m42_start_round(m);
    const uint64_t ran = m42_run(m, 200);
    const uint32_t N = r.core_size;
    m42_instruction cells[8];
    const uint32_t got = m42_cells(m, N - 3, 8, cells);
    const m42_cell *core = m42_core(m);
    int same = got == 8;
    for (uint32_t k = 0; same && k < 8; k++) {
      const m42_cell c = core[(N - 3 + k) % N];
      const m42_instruction x = cells[k];
      same = x.opcode == (c.word & 255) >> 3 && x.modifier == (c.word & 7) && x.a_mode == (c.word >> 8 & 7) &&
             x.b_mode == (c.word >> 11 & 7) && x.a == c.a && x.b == c.b && x.line == 0;
    }
    m42_instruction all[1];
    printf(",\"cells\":[%u,%d,%u,%u,%u", got, same, m42_cells(m, N, 1, all), m42_cells(m, 0, 0, all), m42_cells(0, 0, 1, all));
    union { m42_state s; unsigned char b[sizeof(m42_state) + 8]; } us;
    union { m42_warrior_state s; unsigned char b[sizeof(m42_warrior_state) + 8]; } uw;
    memset(&us, 0xab, sizeof us);
    memset(&uw, 0xab, sizeof uw);
    const int s1 = m42_get_state(m, &us.s, sizeof us.s), s2 = m42_get_state(m, &us.s, sizeof us.s - 1);
    const int s3 = m42_get_state(m, &us.s, sizeof us);
    const int w1 = m42_get_warrior(m, 1, &uw.s, sizeof uw.s), w2 = m42_get_warrior(m, 1, &uw.s, sizeof uw.s - 1);
    const int w3 = m42_get_warrior(m, 1, &uw.s, sizeof uw);
    int guard = 1;
    for (size_t k = sizeof us.s; k < sizeof us; k++) guard &= us.b[k] == 0xab;
    for (size_t k = sizeof uw.s; k < sizeof uw; k++) guard &= uw.b[k] == 0xab;
    uint32_t counters[8];
    printf("],\"getters\":[%d,%d,%d,%d,%d,%d,%d,%u,%u]", s1, s2, s3, w1, w2, w3, guard, us.s.time == ran ? 1u : 0u,
           m42_get_scores(m, 0, counters, 8));
  }

  // m42_warrior_source_end(): up to the start of the second ;redcode line,
  // else the whole source; 0 for m42_warrior_make() (#93)
  {
    const char *two = ";redcode\n;name A\nmov 0, 1\n;redcode\n;name B\ndat 5\n", *one = ";name A\nmov 0, 1\n";
    m42_warrior *wt = m42_assemble_new(two, strlen(two), &r, 0, 0, &st), *wb = m42_assemble_new(two + 26, strlen(two) - 26, &r, 0, 0, &st);
    m42_warrior *wo = m42_assemble_new(one, strlen(one), &r, 0, 0, &st);
    char nb[64];
    m42_warrior_text(wb, M42_NAME, nb, sizeof nb);
    const m42_instruction ins = {1, 6, 1, 1, 0, 1, 0};
    char made[256];
    printf(",\"sourceEnd\":[%u,%u,%u,%d,%u]", (unsigned)m42_warrior_source_end(wt), (unsigned)m42_warrior_source_end(wo),
           (unsigned)m42_warrior_source_end(wb), strcmp(nb, "B") == 0, (unsigned)m42_warrior_source_end(m42_warrior_make(&ins, 1, 0, 0, made, sizeof made)));
    m42_warrior_free(wt);
    m42_warrior_free(wb);
    m42_warrior_free(wo);
  }

  // m42_warrior_uses_pspace(): LDP or STP anywhere in the code (#136)
  {
    const char *src[] = {" mov 0, 1\n", " mov 0, 1\n ldp.ab #0, 1\n", " stp.b 1, #3\n dat 0\n", " ldp #0, 1\n jmp nowhere\n"};
    printf(",\"usesPspace\":[");
    for (int k = 0; k < 4; k++) {
      m42_warrior *pw = m42_assemble_new(src[k], strlen(src[k]), &r, 0, 0, &st);
      printf("%d,", pw ? m42_warrior_uses_pspace(pw) : -1);
      m42_warrior_free(pw);
    }
    const m42_instruction stp[2] = {{0, 6, 1, 1, 0, 1, 0}, {18, 1, 1, 0, 1, 3, 0}};
    char made[256];
    printf("%d,%d,%d]", m42_warrior_uses_pspace(m42_warrior_make(stp, 2, 0, 0, made, sizeof made)),
           m42_warrior_uses_pspace(m42_warrior_make(stp, 1, 0, 0, made, sizeof made)), m42_warrior_uses_pspace(0));
  }

  // A context of exactly m42_ctx_size() holds two warriors of max_length.
  char longest[1024] = "";
  for (uint32_t i = 0; i < r.max_length; i++) strcat(longest, " spl 0\n");
  m42_warrior *big = m42_assemble_new(longest, strlen(longest), &r, 0, 0, &st);
  void *exact = malloc(size);
  m42_ctx *m2 = m42_ctx_init(exact, size, &r, &st);
  const m42_warrior *bigs[2] = {big, big};
  m42_score sc[2];
  printf(",\"full\":[%u,%d]", m42_warrior_length(big), m42_match(m2, bigs, 2, &o, sc, 0));

  // Warriors that do not fit the rules of the context (#86): assembled for a
  // core of 8000, played in one of 800, refused by match, load and bench;
  // each field of m42_instruction past its range, and the start; a fixed
  // position at the core size. With a watch attached, the first one read
  // and wrote outside the watch's memory.
  {
    m42_rules sr = m42_rules_94();
    sr.core_size = 800;
    sr.max_processes = 800;
    void *smem = malloc(m42_ctx_size(&sr));
    m42_ctx *sm = m42_ctx_init(smem, m42_ctx_size(&sr), &sr, &st);
    const size_t wsize = m42_watch_size(&sr);
    void *wmem = malloc(wsize);
    m42_watch_attach(sm, wmem, wsize, &st);
    const char *far = "mov 7000, 7999\nmov @7000, }7999\njmp -2\n";
    m42_warrior *fw = m42_assemble_new(far, strlen(far), &r, 0, 0, &st);
    const m42_warrior *fws[2] = {fw, fw};
    m42_match_options fo = m42_match_options_default();
    printf(",\"fit\":[%d,%d,%d", m42_match(sm, fws, 2, &fo, 0, 0), m42_load(sm, fws, 2, &fo), m42_bench(sm, fw, fws, 1, &fo, 0, 0));
    const m42_instruction ok_ins = {1, 6, 1, 1, 0, 1, 0}; // MOV.I $0, $1
    for (int f = 0; f < 8; f++) {
      m42_instruction x = ok_ins;
      uint32_t start = 0;
      if (f == 1) x.opcode = 19;
      if (f == 2) x.modifier = 7;
      if (f == 3) x.a_mode = 8;
      if (f == 4) x.b_mode = 8;
      if (f == 5) x.a = 800;
      if (f == 6) x.b = 800;
      if (f == 7) start = 800;
      char wm[256];
      const m42_warrior *mw = m42_warrior_make(&x, 1, start, 0, wm, sizeof wm);
      const m42_warrior *mws[2] = {mw, mw};
      printf(",%d", m42_load(sm, mws, 2, &fo));
    }
    // positions: the last cell and the core size
    char wm2[256];
    const m42_warrior *imp = m42_warrior_make(&ok_ins, 1, 0, 0, wm2, sizeof wm2);
    const m42_warrior *imps[2] = {imp, imp};
    uint32_t fpos[2] = {0, 799};
    fo.positions = fpos;
    printf(",%d", m42_load(sm, imps, 2, &fo));
    fpos[1] = 800;
    printf(",%d", m42_load(sm, imps, 2, &fo));
    // p-space values: below the core size, as LDP copies them into a cell
    // field (#88's fuzzing: a value of the core size or more made the
    // engine address outside the core); sr.pspace_size is 500
    static uint32_t pv[2 * 500];
    for (int k = 0; k < 2 * 500; k++) pv[k] = 799;
    m42_match_options pso = m42_match_options_default();
    pso.pspace = pv;
    const int okMatch = m42_match(sm, imps, 2, &pso, 0, 0);
    pv[57] = 800;
    const int badMatch = m42_match(sm, imps, 2, &pso, 0, 0);
    m42_load(sm, imps, 2, &pso);
    printf(",%d,%d,%d,%d]", okMatch, badMatch, m42_pspace_set(sm, 1, 3, 799), m42_pspace_set(sm, 1, 3, 800));
    m42_warrior_free(fw);
    free(wmem);
    free(smem);
  }

  // the evaluator at the edges of 64 bits (platform.h has its own overflow
  // checks for compilers other than gcc and clang); values as strings
  printf(",\"evaluate\":[");
  for (int i = 0; i < (int)(sizeof EXPRESSIONS / sizeof *EXPRESSIONS); i++) {
    int64_t v = 0;
    const int s = m42_evaluate(EXPRESSIONS[i], strlen(EXPRESSIONS[i]), &v);
    printf("%s[%d,\"%lld\"]", i ? "," : "", s, (long long)v);
  }
  printf("]}\n");
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
