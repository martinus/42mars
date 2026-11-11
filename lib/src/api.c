// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The functions of 42mars.h, over the simulator (mars.c) and the assembler
// (asm.c). Included by lib/42mars.c after both.

#ifndef M42_NO_LIBC
#include <stdlib.h>
#endif

_Static_assert(sizeof(m42_instruction) == sizeof(AsmIns) && __builtin_offsetof(m42_instruction, b) == __builtin_offsetof(AsmIns, bVal) &&
               __builtin_offsetof(m42_instruction, line) == __builtin_offsetof(AsmIns, line),
               "m42_instruction is the assembler's AsmIns");
_Static_assert(sizeof(m42_cell) == sizeof(Cell) && __builtin_offsetof(m42_cell, word) == __builtin_offsetof(Cell, ins),
               "m42_cell is the simulator's Cell");

const char *m42_version(void) { return "0.1.0"; }

const char *m42_status_text(int status) {
  switch (status) {
    case M42_OK: return "ok";
    case M42_ERR_MEMORY: return "memory too small";
    case M42_ERR_RULES: return "rule out of range";
    case M42_ERR_ARGUMENT: return "bad argument";
    case M42_ERR_WARRIOR: return "warrior did not assemble or is too long";
    case M42_ERR_STATE: return "no warriors loaded";
    default: return "unknown status";
  }
}

static int set_status(int *status, int value) {
  if (status) *status = value;
  return value;
}

// ---------------------------------------------------------------- rules

m42_rules m42_rules_94(void) {
  const m42_rules r = {sizeof(m42_rules), 8000, 80000, 8000, 100, 100, 500, 0, 0, 1, 2};
  return r;
}

static u32 pspace_of(const m42_rules *r) { return r->pspace_size ? r->pspace_size : r->core_size / 16; }

static int rules_ok(const m42_rules *r) {
  return r && r->size >= sizeof(m42_rules) && r->core_size >= 1 && r->core_size <= 65536 &&
         r->max_processes <= 1u << 24 && pspace_of(r) <= 1u << 24 && r->warriors >= 1 && r->warriors <= 255;
}

// ---------------------------------------------------------------- warriors

// An m42_warrior is the assembler's AsmResult.
#define RESULT(w) ((const AsmResult *)(const void *)(w))

int m42_assemble(const char *src, size_t len, const m42_rules *rules, unsigned flags, void *mem, size_t size,
                 m42_warrior **out) {
  if (!out) return M42_ERR_ARGUMENT;
  *out = 0;
  if (!rules_ok(rules)) return M42_ERR_RULES;
  if ((!src && len) || !mem) return M42_ERR_ARGUMENT;
  const AsmOptions o = {rules->core_size, rules->max_processes, rules->max_cycles, rules->max_length,
                        rules->min_distance, rules->warriors, rules->rounds, pspace_of(rules),
                        rules->read_limit, rules->write_limit, (flags & M42_UTF8) != 0};
  AsmResult *r = assemble(mem, size, (const u8 *)(src ? src : ""), len, &o);
  if (!r) return M42_ERR_MEMORY;
  *out = (m42_warrior *)(void *)r;
  return M42_OK;
}

int m42_warrior_ok(const m42_warrior *w) { return w && RESULT(w)->ok; }
uint32_t m42_warrior_length(const m42_warrior *w) { return w ? RESULT(w)->nIns : 0; }
uint32_t m42_warrior_start(const m42_warrior *w) { return w ? RESULT(w)->start : 0; }

int m42_warrior_pin(const m42_warrior *w, int64_t *pin) {
  if (!w || !RESULT(w)->hasPin) return 0;
  if (pin) *pin = RESULT(w)->pin;
  return 1;
}

const m42_instruction *m42_warrior_code(const m42_warrior *w) {
  return w ? (const m42_instruction *)(const void *)RESULT(w)->ins : 0;
}

static size_t copy_text(AsmText t, char *buf, size_t n) {
  if (buf && n) {
    const size_t k = t.n < n - 1 ? t.n : n - 1;
    if (k) __builtin_memcpy(buf, t.p, k);
    buf[k] = 0;
  }
  return t.n;
}

size_t m42_warrior_text(const m42_warrior *w, m42_text which, char *buf, size_t n) {
  const AsmText none = {(const u8 *)"", 0};
  if (!w) return copy_text(none, buf, n);
  const AsmResult *r = RESULT(w);
  switch (which) {
    case M42_NAME: return copy_text(r->name, buf, n);
    case M42_AUTHOR: return copy_text(r->author, buf, n);
    case M42_DATE: return copy_text(r->date, buf, n);
    case M42_VERSION_TEXT: return copy_text(r->version, buf, n);
    case M42_STRATEGY: return copy_text(r->strategy, buf, n);
    default: return copy_text(none, buf, n);
  }
}

uint32_t m42_warrior_errors(const m42_warrior *w) { return w ? RESULT(w)->nErrors : 0; }
uint32_t m42_warrior_warnings(const m42_warrior *w) { return w ? RESULT(w)->nWarnings : 0; }

size_t m42_warrior_message(const m42_warrior *w, uint32_t i, int32_t *line, int *is_error, char *buf, size_t n) {
  const AsmText none = {(const u8 *)"", 0};
  const AsmResult *r = w ? RESULT(w) : 0;
  const AsmMsg *msg = !r ? 0 : i < r->nErrors ? &r->errors[i] : i - r->nErrors < r->nWarnings ? &r->warnings[i - r->nErrors] : 0;
  if (line) *line = msg ? msg->line : 0;
  if (is_error) *is_error = msg && r && i < r->nErrors;
  return copy_text(msg ? msg->text : none, buf, n);
}

// A packed warrior: the AsmResult, then its arrays, then all texts.
static usize packed_layout(const AsmResult *r, usize *texts) {
  usize s = sizeof(AsmResult);
  s += (usize)r->nIns * sizeof(AsmIns) + (usize)(r->nErrors + r->nWarnings) * sizeof(AsmMsg) +
       (usize)r->nExpanded * sizeof(AsmText);
  usize t = r->name.n + r->author.n + r->date.n + r->version.n + r->strategy.n;
  for (u32 i = 0; i < r->nErrors; i++) t += r->errors[i].text.n;
  for (u32 i = 0; i < r->nWarnings; i++) t += r->warnings[i].text.n;
  for (u32 i = 0; i < r->nExpanded; i++) t += r->expanded[i].n;
  *texts = t;
  return s + t + 8; // 8: alignment of the start
}

size_t m42_warrior_packed_size(const m42_warrior *w) {
  usize t;
  return w ? packed_layout(RESULT(w), &t) : 0;
}

m42_warrior *m42_warrior_pack(const m42_warrior *w, void *dst, size_t size) {
  if (!w || !dst) return 0;
  const AsmResult *r = RESULT(w);
  usize t;
  if (size < packed_layout(r, &t)) return 0;
  u8 *p = (u8 *)(((usize)dst + 7) & ~(usize)7);
  AsmResult *q = (AsmResult *)(void *)p;
  *q = *r;
  p += sizeof(AsmResult);
  q->ins = (AsmIns *)(void *)p;
  if (r->nIns) __builtin_memcpy(p, r->ins, (usize)r->nIns * sizeof(AsmIns));
  p += (usize)r->nIns * sizeof(AsmIns);
  q->errors = (AsmMsg *)(void *)p;
  p += (usize)r->nErrors * sizeof(AsmMsg);
  q->warnings = (AsmMsg *)(void *)p;
  p += (usize)r->nWarnings * sizeof(AsmMsg);
  q->expanded = (AsmText *)(void *)p;
  p += (usize)r->nExpanded * sizeof(AsmText);
  u8 *text = p;
  #define MOVE(dst_, src_) do { (dst_).p = text; (dst_).n = (src_).n; if ((src_).n) __builtin_memcpy(text, (src_).p, (src_).n); text += (src_).n; } while (0)
  MOVE(q->name, r->name);
  MOVE(q->author, r->author);
  MOVE(q->date, r->date);
  MOVE(q->version, r->version);
  MOVE(q->strategy, r->strategy);
  for (u32 i = 0; i < r->nErrors; i++) { q->errors[i].line = r->errors[i].line; MOVE(q->errors[i].text, r->errors[i].text); }
  for (u32 i = 0; i < r->nWarnings; i++) { q->warnings[i].line = r->warnings[i].line; MOVE(q->warnings[i].text, r->warnings[i].text); }
  for (u32 i = 0; i < r->nExpanded; i++) MOVE(q->expanded[i], r->expanded[i]);
  #undef MOVE
  return (m42_warrior *)(void *)q;
}

#ifndef M42_NO_LIBC
m42_warrior *m42_assemble_new(const char *src, size_t len, const m42_rules *rules, unsigned flags, int *status) {
  for (size_t size = len * 64 > (1u << 20) ? len * 64 : (1u << 20); size <= ((size_t)1 << 34) / 4; size *= 4) {
    void *mem = malloc(size);
    if (!mem) break;
    m42_warrior *w;
    const int s = m42_assemble(src, len, rules, flags, mem, size, &w);
    if (s == M42_ERR_MEMORY) { free(mem); continue; }
    if (s != M42_OK) { free(mem); set_status(status, s); return 0; }
    // malloc's alignment is at least 8, so the packed warrior starts the
    // block, which m42_warrior_free() frees.
    const size_t need = m42_warrior_packed_size(w);
    void *dst = malloc(need);
    m42_warrior *packed = dst ? m42_warrior_pack(w, dst, need) : 0;
    free(mem);
    if (!packed) { free(dst); break; }
    set_status(status, M42_OK);
    return packed;
  }
  set_status(status, M42_ERR_MEMORY);
  return 0;
}

void m42_warrior_free(m42_warrior *w) { free(w); }
#endif

// ---------------------------------------------------------------- contexts

// With M42_FIXED_CONTEXT every handle is the one context. Using its address
// instead of the handle lets clang propagate the constant into the loops of
// mars.c, which then address the core with constant offsets (#53).
#ifdef M42_FIXED_CONTEXT
#define CTX_OF(m) ((void)(m), CTX)
#define CCTX_OF(m) ((void)(m), (const Mars *)CTX)
#else
#define CTX_OF(m) ((Mars *)(void *)(m))
#define CCTX_OF(m) ((const Mars *)(const void *)(m))
#endif

#ifndef M42_FIXED_CONTEXT
// The heap mars.c's config() takes for rules->warriors warriors of
// rules->max_length instructions each (fewer warriors take less).
static usize heap_need(const m42_rules *r) {
  const usize nw = r->warriors, ins = nw * r->max_length, psize = pspace_of(r);
  usize qlen = 1;
  while (qlen < r->max_processes && qlen < 1u << 30) qlen <<= 1;
  const int linear = nw == 2 && r->max_cycles <= LINEAR_CYCLES;
  usize s = 64;
  #define TAKE(bytes) (s += ((usize)(bytes) + 63) & ~(usize)63)
  TAKE(nw * sizeof(Warrior));
  TAKE((4 * nw + 5 * ins) * 4);
  TAKE(ins * sizeof(Cell));
  TAKE(nw * (psize ? psize : 1) * 4);
  TAKE(nw * (2 * nw - 1) * 4);
  for (usize i = 0; i < nw; i++) if (!(i < 2 && (linear || qlen <= QSTATIC))) TAKE(qlen * 2);
  #undef TAKE
  return s;
}
#endif

size_t m42_ctx_size(const m42_rules *rules) {
#ifdef M42_FIXED_CONTEXT
  (void)rules;
  return 0;
#else
  return rules_ok(rules) ? 63 + sizeof(Mars) + heap_need(rules) : 0;
#endif
}

m42_ctx *m42_ctx_init(void *mem, size_t size, const m42_rules *rules, int *status) {
  if (!rules_ok(rules)) { set_status(status, M42_ERR_RULES); return 0; }
#ifdef M42_FIXED_CONTEXT
  (void)mem;
  (void)size;
  Mars *m = CTX;
#else
  if (!mem) { set_status(status, M42_ERR_ARGUMENT); return 0; }
  if (size < m42_ctx_size(rules)) { set_status(status, M42_ERR_MEMORY); return 0; }
  Mars *m = (Mars *)(((usize)mem + 63) & ~(usize)63);
  __builtin_memset(m, 0, sizeof(Mars));
  m->heap_end = (u8 *)mem + size;
  m->heap_top = HEAP_FIRST(m);
#endif
  m->rules = *rules;
  m->loaded = 0;
  m->roundOver = 1;
  set_status(status, M42_OK);
  return (m42_ctx *)(void *)m;
}

#ifndef M42_NO_LIBC
m42_ctx *m42_new(const m42_rules *rules, int *status) {
#ifdef M42_FIXED_CONTEXT
  return m42_ctx_init(0, 0, rules, status);
#else
  // 64-byte aligned, so that the context starts the block m42_free() frees.
  const size_t size = (m42_ctx_size(rules) + 63) & ~(size_t)63;
  if (size < 64) { set_status(status, M42_ERR_RULES); return 0; }
  void *mem = aligned_alloc(64, size);
  if (!mem) { set_status(status, M42_ERR_MEMORY); return 0; }
  m42_ctx *m = m42_ctx_init(mem, size, rules, status);
  if (!m) free(mem);
  return m;
#endif
}

void m42_free(m42_ctx *m) {
#ifdef M42_FIXED_CONTEXT
  (void)m;
#else
  free(m);
#endif
}
#endif

// ---------------------------------------------------------------- matches

m42_match_options m42_match_options_default(void) {
  const m42_match_options o = {sizeof(m42_match_options), 1, 0, 1, 0, 0};
  return o;
}

// Loads warriors, the way wasm/42mars.js load() did: checks, the load
// area of config(), p-space groups by PIN, then load().
static int load_warriors(Mars *m, const m42_warrior *const *ws, u32 n, const m42_match_options *o) {
  const m42_rules *r = &m->rules;
  if (!ws || n < 1 || n > r->warriors || (o && o->size < sizeof(m42_match_options))) return M42_ERR_ARGUMENT;
  const i64 seed = o ? o->seed : 0;
  const uint32_t *positions = o ? o->positions : 0;
  if (seed < 0) return M42_ERR_ARGUMENT;
  if ((u64)n * r->min_distance > r->core_size) return M42_ERR_RULES;
  u32 total = 0;
  for (u32 i = 0; i < n; i++) {
    if (!ws[i] || !RESULT(ws[i])->ok || RESULT(ws[i])->nIns > r->max_length) return M42_ERR_WARRIOR;
    total += RESULT(ws[i])->nIns;
    if (positions && positions[i] >= 1u << 31) return M42_ERR_ARGUMENT;
  }
  i32 *in = config(m, r->core_size, r->max_processes, r->max_cycles, r->min_distance, pspace_of(r), n, total);
  if (!in) return M42_ERR_MEMORY;
  i32 *k = in;
  for (u32 i = 0; i < n; i++) {
    const AsmResult *w = RESULT(ws[i]);
    // Warriors with the same PIN share their p-space cells (not the last result).
    u32 group = i;
    if (w->hasPin) {
      for (u32 j = 0; j < i; j++) {
        if (RESULT(ws[j])->hasPin && RESULT(ws[j])->pin == w->pin) { group = j; break; }
      }
    }
    *k++ = (i32)w->nIns;
    *k++ = (i32)w->start;
    *k++ = (i32)group;
    *k++ = positions ? (i32)positions[i] : 0;
  }
  for (u32 i = 0; i < n; i++) {
    const AsmResult *w = RESULT(ws[i]);
    for (u32 j = 0; j < w->nIns; j++) {
      const AsmIns *x = &w->ins[j];
      *k++ = x->op << 3 | x->mod;
      *k++ = x->aMode;
      *k++ = (i32)x->aVal;
      *k++ = x->bMode;
      *k++ = (i32)x->bVal;
    }
  }
  load(m, seed, positions != 0);
  return M42_OK;
}

int m42_match(m42_ctx *ctx, const m42_warrior *const *warriors, uint32_t n, const m42_match_options *options,
              m42_score *scores, uint64_t *instructions) {
  if (!ctx) return M42_ERR_ARGUMENT;
  const m42_match_options o = options ? *options : m42_match_options_default();
  if (o.size < sizeof(m42_match_options) || (u64)o.rounds + o.first_round > 0xffffffffu) return M42_ERR_ARGUMENT;
  Mars *m = CTX_OF(ctx);
  const int s = load_warriors(m, warriors, n, &o);
  if (s != M42_OK) return s;
  const u64 executed = run_match(m, o.rounds, o.early_tie != 0, o.first_round);
  if (instructions) *instructions = executed;
  if (scores) {
    for (u32 i = 0; i < n; i++) scores[i] = (m42_score){m->war[i].wins, m->war[i].losses, m->war[i].ties};
  }
  return M42_OK;
}

int m42_bench(m42_ctx *m, const m42_warrior *w, const m42_warrior *const *opponents, uint32_t n,
              const m42_match_options *options, m42_score *scores, uint64_t *instructions) {
  if (!opponents && n) return M42_ERR_ARGUMENT;
  u64 total = 0;
  for (u32 i = 0; i < n; i++) {
    const m42_warrior *pair[2] = {w, opponents[i]};
    uint64_t executed = 0;
    const int s = m42_match(m, pair, 2, options, scores ? scores + 2 * i : 0, &executed);
    if (s != M42_OK) return s;
    total += executed;
  }
  if (instructions) *instructions = total;
  return M42_OK;
}

// ---------------------------------------------------------------- stepping

int m42_load(m42_ctx *m, const m42_warrior *const *warriors, uint32_t n, const m42_match_options *options) {
  if (!m) return M42_ERR_ARGUMENT;
  return load_warriors(CTX_OF(m), warriors, n, options);
}

int m42_start_round(m42_ctx *ctx) {
  Mars *m = CTX_OF(ctx);
  if (!ctx) return M42_ERR_ARGUMENT;
  if (!m->loaded) return M42_ERR_STATE;
  start_round(m);
  return M42_OK;
}

uint64_t m42_run(m42_ctx *ctx, uint64_t count) {
  Mars *m = CTX_OF(ctx);
  if (!ctx || !m->loaded || m->roundOver || !count) return 0;
  return run_some(m, count);
}

int m42_end_round(m42_ctx *ctx) {
  Mars *m = CTX_OF(ctx);
  if (!ctx) return M42_ERR_ARGUMENT;
  if (!m->loaded) return M42_ERR_STATE;
  end_round(m);
  return M42_OK;
}

int m42_get_state(const m42_ctx *ctx, m42_state *s) {
  const Mars *m = CCTX_OF(ctx);
  if (!ctx || !s) return M42_ERR_ARGUMENT;
  if (!m->loaded) return M42_ERR_STATE;
  *s = (m42_state){m->round_, m->roundOver, m->current, m->warriorsLeft, (u64)m->timeNow, m->cyclesLeft};
  return M42_OK;
}

int m42_get_warrior(const m42_ctx *ctx, uint32_t w, m42_warrior_state *s) {
  const Mars *m = CCTX_OF(ctx);
  if (!ctx || !s) return M42_ERR_ARGUMENT;
  if (!m->loaded) return M42_ERR_STATE;
  if (w >= m->nw) return M42_ERR_ARGUMENT;
  const Warrior *x = &m->war[w];
  *s = (m42_warrior_state){x->alive, x->tail - x->head, x->position, x->lastResult, x->diedAt,
                           {x->wins, x->losses, x->ties}};
  return M42_OK;
}

const m42_cell *m42_core(const m42_ctx *ctx) {
  const Mars *m = CCTX_OF(ctx);
  return ctx ? (const m42_cell *)(const void *)CORE(m) : 0;
}

uint32_t m42_queue(const m42_ctx *ctx, uint32_t w, uint32_t *out, uint32_t max) {
  const Mars *m = CCTX_OF(ctx);
  if (!ctx || !m->loaded || w >= m->nw) return 0;
  const Warrior *x = &m->war[w];
  const u32 tasks = x->tail - x->head;
  for (u32 k = 0; out && k < tasks && k < max; k++) out[k] = x->q[(x->head + k) & m->qmask];
  return tasks;
}

int m42_pspace_get(const m42_ctx *ctx, uint32_t w, uint32_t i, uint32_t *value) {
  const Mars *m = CCTX_OF(ctx);
  if (!ctx || !value) return M42_ERR_ARGUMENT;
  if (!m->loaded) return M42_ERR_STATE;
  if (w >= m->nw || (i && i >= m->psize)) return M42_ERR_ARGUMENT;
  *value = i ? m->war[w].pspace[i] : m->war[w].lastResult;
  return M42_OK;
}

int m42_pspace_set(m42_ctx *ctx, uint32_t w, uint32_t i, uint32_t value) {
  Mars *m = CTX_OF(ctx);
  if (!ctx) return M42_ERR_ARGUMENT;
  if (!m->loaded) return M42_ERR_STATE;
  if (w >= m->nw || (i && i >= m->psize)) return M42_ERR_ARGUMENT;
  if (i) m->war[w].pspace[i] = value;
  else m->war[w].lastResult = value;
  return M42_OK;
}
