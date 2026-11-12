// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// The functions of 42mars.h, over the simulator (mars.c) and the assembler
// (asm.c). Included by lib/42mars.c after both.

_Static_assert(sizeof(m42_instruction) == sizeof(AsmIns) && offsetof(m42_instruction, b) == offsetof(AsmIns, bVal) &&
               offsetof(m42_instruction, line) == offsetof(AsmIns, line),
               "m42_instruction is the assembler's AsmIns");
_Static_assert(sizeof(m42_cell) == sizeof(Cell) && offsetof(m42_cell, word) == offsetof(Cell, ins),
               "m42_cell is the simulator's Cell");
#ifdef __wasm__
_Static_assert(sizeof(m42_rules) == 44 && sizeof(m42_match_options) == 40 && offsetof(m42_match_options, seed) == 16 &&
               offsetof(m42_match_options, positions) == 24 && offsetof(m42_match_options, log) == 28 &&
               offsetof(m42_match_options, permute) == 32 && offsetof(m42_match_options, pspace) == 36 &&
               sizeof(m42_state) == 32 && offsetof(m42_state, time) == 16 && sizeof(m42_warrior_state) == 40 &&
               offsetof(m42_warrior_state, died_at) == 16 && offsetof(m42_warrior_state, score) == 24 &&
               sizeof(m42_instruction) == 16 && sizeof(m42_watch) == 72 && offsetof(m42_watch, deaths) == 16 &&
               offsetof(m42_watch, owner) == 24 && offsetof(m42_watch, death) == 68,
               "wasm/42mars.js reads and writes these structs at these offsets");
#endif

#define M42_STR_(x) #x
#define M42_STR(x) M42_STR_(x)

EXPORT(m42_version)
const char *m42_version(void) {
  return M42_STR(M42_VERSION_MAJOR) "." M42_STR(M42_VERSION_MINOR) "." M42_STR(M42_VERSION_PATCH);
}

EXPORT(m42_status_text)
const char *m42_status_text(int status) {
  switch (status) {
    case M42_OK: return "ok";
    case M42_ERR_MEMORY: return "memory too small";
    case M42_ERR_RULES: return "rule out of range";
    case M42_ERR_ARGUMENT: return "bad argument";
    case M42_ERR_WARRIOR: return "warrior did not assemble, is too long or does not fit the rules";
    case M42_ERR_STATE: return "no warriors loaded";
    default: return "unknown status";
  }
}

static void set_status(int *status, int value) {
  if (status) *status = value;
}

// ---------------------------------------------------------------- rules

EXPORT(m42_rules_94)
m42_rules m42_rules_94(void) {
  const m42_rules r = {sizeof(m42_rules), 8000, 80000, 8000, 100, 100, 500, 0, 0, 1, 2};
  return r;
}

static u32 pspace_of(const m42_rules *r) { return r->pspace_size ? r->pspace_size : r->core_size / 16; }

// A read or write limit: 0 (the core size) or a divisor of the core size, as pMARS wants.
static int limit_ok(u32 limit, u32 coreSize) { return limit == 0 || (limit <= coreSize && coreSize % limit == 0); }

static int rules_ok(const m42_rules *r) {
  return r && r->size >= sizeof(m42_rules) && r->core_size >= 1 && r->core_size <= 65536 &&
         r->max_processes <= 1u << 24 && pspace_of(r) <= 1u << 24 && r->warriors >= 1 && r->warriors <= 255 &&
         limit_ok(r->read_limit, r->core_size) && limit_ok(r->write_limit, r->core_size);
}

// ---------------------------------------------------------------- warriors

// An m42_warrior is the assembler's AsmResult.
#define RESULT(w) ((const AsmResult *)(const void *)(w))

EXPORT(m42_assemble)
int m42_assemble(const char *src, size_t len, const m42_rules *rules, unsigned flags, const int64_t registers[26], void *mem, size_t size,
                 m42_warrior **out) {
  if (!out) return M42_ERR_ARGUMENT;
  *out = 0;
  // The assembler needs a core size only; the simulator's limits do not apply.
  if (!rules || rules->size < sizeof(m42_rules) || rules->core_size < 1) return M42_ERR_RULES;
  if ((!src && len) || !mem) return M42_ERR_ARGUMENT;
  const AsmOptions o = {rules->core_size, rules->max_processes, rules->max_cycles, rules->max_length,
                        rules->min_distance, rules->warriors, rules->rounds, pspace_of(rules),
                        rules->read_limit, rules->write_limit, (flags & M42_UTF8) != 0, (flags & M42_ICWS88) != 0, registers};
  AsmResult *r = assemble(mem, size, (const u8 *)(src ? src : ""), len, &o);
  if (!r) return M42_ERR_MEMORY;
  *out = (m42_warrior *)(void *)r;
  return M42_OK;
}

EXPORT(m42_warrior_ok)
int m42_warrior_ok(const m42_warrior *w) { return w && RESULT(w)->ok; }
EXPORT(m42_warrior_length)
uint32_t m42_warrior_length(const m42_warrior *w) { return w ? RESULT(w)->nIns : 0; }
EXPORT(m42_warrior_start)
uint32_t m42_warrior_start(const m42_warrior *w) { return w ? RESULT(w)->start : 0; }

EXPORT(m42_warrior_pin)
int m42_warrior_pin(const m42_warrior *w, int64_t *pin) {
  if (!w || !RESULT(w)->hasPin) return 0;
  if (pin) *pin = RESULT(w)->pin;
  return 1;
}

EXPORT(m42_warrior_code)
const m42_instruction *m42_warrior_code(const m42_warrior *w) {
  return w ? (const m42_instruction *)(const void *)RESULT(w)->ins : 0;
}

static size_t copy_text(AsmText t, char *buf, size_t n) {
  if (buf && n) {
    const size_t k = t.n < n - 1 ? t.n : n - 1;
    if (k) m42_memcpy(buf, t.p, k);
    buf[k] = 0;
  }
  return t.n;
}

EXPORT(m42_warrior_text)
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

EXPORT(m42_warrior_errors)
uint32_t m42_warrior_errors(const m42_warrior *w) { return w ? RESULT(w)->nErrors : 0; }
EXPORT(m42_warrior_warnings)
uint32_t m42_warrior_warnings(const m42_warrior *w) { return w ? RESULT(w)->nWarnings : 0; }

EXPORT(m42_warrior_message)
size_t m42_warrior_message(const m42_warrior *w, uint32_t i, int32_t *line, int *is_error, char *buf, size_t n) {
  const AsmText none = {(const u8 *)"", 0};
  const AsmResult *r = w ? RESULT(w) : 0;
  const AsmMsg *msg = !r ? 0 : i < r->nErrors ? &r->errors[i] : i - r->nErrors < r->nWarnings ? &r->warnings[i - r->nErrors] : 0;
  if (line) *line = msg ? msg->line : 0;
  if (is_error) *is_error = msg && i < r->nErrors;
  return copy_text(msg ? msg->text : none, buf, n);
}

EXPORT(m42_warrior_statements)
uint32_t m42_warrior_statements(const m42_warrior *w) { return w ? RESULT(w)->nExpanded : 0; }

EXPORT(m42_warrior_statement)
size_t m42_warrior_statement(const m42_warrior *w, uint32_t i, char *buf, size_t n) {
  const AsmText none = {(const u8 *)"", 0};
  return copy_text(w && i < RESULT(w)->nExpanded ? RESULT(w)->expanded[i] : none, buf, n);
}

EXPORT(m42_evaluate_registers)
int m42_evaluate_registers(const char *text, size_t len, int64_t registers[26], int64_t *value) {
  Evaluator e = {0};
  if (registers) for (int i = 0; i < 26; i++) e.registers[i] = registers[i];
  i64 v = 0;
  const int status = len > 0xffffffffu ? EVAL_BAD : evaluate(&e, (Str){(const u8 *)(text ? text : ""), (u32)len}, &v);
  if (registers) for (int i = 0; i < 26; i++) registers[i] = e.registers[i];
  if (value) *value = v;
  return status;
}

EXPORT(m42_evaluate)
int m42_evaluate(const char *text, size_t len, int64_t *value) { return m42_evaluate_registers(text, len, 0, value); }

EXPORT(m42_warrior_make_size)
size_t m42_warrior_make_size(uint32_t length) {
  return 8 + sizeof(AsmResult) + (usize)length * sizeof(AsmIns);
}

EXPORT(m42_warrior_make)
m42_warrior *m42_warrior_make(const m42_instruction *code, uint32_t length, uint32_t start, const int64_t *pin,
                              void *mem, size_t size) {
  if ((!code && length) || !mem || size < m42_warrior_make_size(length)) return 0;
  AsmResult *r = (AsmResult *)(void *)(((usize)mem + 7) & ~(usize)7);
  m42_memset(r, 0, sizeof(AsmResult));
  r->ok = 1;
  r->start = start;
  r->hasPin = pin != 0;
  r->pin = pin ? *pin : 0;
  r->nIns = length;
  r->ins = (AsmIns *)(void *)(r + 1);
  if (length) m42_memcpy(r->ins, code, (usize)length * sizeof(AsmIns));
  r->name = (AsmText){(const u8 *)"Unknown", 7};
  r->author = (AsmText){(const u8 *)"Anonymous", 9};
  r->date = r->version = r->strategy = (AsmText){(const u8 *)"", 0};
  return (m42_warrior *)(void *)r;
}

// Every text of a result, for packing: calls fn(ctx, dst, src) with the
// field of the copy `q` and of the original `r`. Counting passes r as q.
#define EACH_TEXT(r, q, fn, ctx)                                                                     \
  do {                                                                                               \
    fn(ctx, &(q)->name, &(r)->name);                                                                 \
    fn(ctx, &(q)->author, &(r)->author);                                                             \
    fn(ctx, &(q)->date, &(r)->date);                                                                 \
    fn(ctx, &(q)->version, &(r)->version);                                                           \
    fn(ctx, &(q)->strategy, &(r)->strategy);                                                         \
    for (u32 i_ = 0; i_ < (r)->nErrors; i_++) fn(ctx, &(q)->errors[i_].text, &(r)->errors[i_].text);       \
    for (u32 i_ = 0; i_ < (r)->nWarnings; i_++) fn(ctx, &(q)->warnings[i_].text, &(r)->warnings[i_].text); \
    for (u32 i_ = 0; i_ < (r)->nExpanded; i_++) fn(ctx, &(q)->expanded[i_], &(r)->expanded[i_]);          \
  } while (0)

static void count_text(usize *n, const AsmText *dst, const AsmText *src) {
  (void)dst;
  *n += src->n;
}

static void move_text(u8 **at, AsmText *dst, const AsmText *src) {
  dst->p = *at;
  dst->n = src->n;
  if (src->n) m42_memcpy(*at, src->p, src->n);
  *at += src->n;
}

// A packed warrior: the AsmResult, then its arrays, then all texts.
static usize packed_size(const AsmResult *r) {
  usize texts = 0;
  EACH_TEXT(r, r, count_text, &texts);
  return 8 + sizeof(AsmResult) + (usize)r->nIns * sizeof(AsmIns) +
         (usize)(r->nErrors + r->nWarnings) * sizeof(AsmMsg) + (usize)r->nExpanded * sizeof(AsmText) + texts;
}

EXPORT(m42_warrior_packed_size)
size_t m42_warrior_packed_size(const m42_warrior *w) { return w ? packed_size(RESULT(w)) : 0; }

EXPORT(m42_warrior_pack)
m42_warrior *m42_warrior_pack(const m42_warrior *w, void *dst, size_t size) {
  if (!w || !dst) return 0;
  const AsmResult *r = RESULT(w);
  if (size < packed_size(r)) return 0;
  u8 *p = (u8 *)(((usize)dst + 7) & ~(usize)7);
  AsmResult *q = (AsmResult *)(void *)p;
  *q = *r;
  p += sizeof(AsmResult);
  q->ins = (AsmIns *)(void *)p;
  if (r->nIns) m42_memcpy(p, r->ins, (usize)r->nIns * sizeof(AsmIns));
  p += (usize)r->nIns * sizeof(AsmIns);
  q->errors = (AsmMsg *)(void *)p;
  p += (usize)r->nErrors * sizeof(AsmMsg);
  q->warnings = (AsmMsg *)(void *)p;
  p += (usize)r->nWarnings * sizeof(AsmMsg);
  q->expanded = (AsmText *)(void *)p;
  p += (usize)r->nExpanded * sizeof(AsmText);
  for (u32 i = 0; i < r->nErrors; i++) q->errors[i].line = r->errors[i].line;
  for (u32 i = 0; i < r->nWarnings; i++) q->warnings[i].line = r->warnings[i].line;
  EACH_TEXT(r, q, move_text, &p);
  return (m42_warrior *)(void *)q;
}

#ifndef M42_NO_LIBC
EXPORT(m42_assemble_new)
m42_warrior *m42_assemble_new(const char *src, size_t len, const m42_rules *rules, unsigned flags,
                              const int64_t registers[26], int *status) {
  // Working memory from 1 MB or 64 bytes per source byte, times 4 per try,
  // up to 128 MB more than that: the assembler's limits (MAX_WORK and
  // MAX_MEMORY in asm.c) keep every source measured below it (#87).
  if (len > ((size_t)-1 - ((size_t)128 << 20)) / 64) { set_status(status, M42_ERR_MEMORY); return 0; }
  const size_t first = len > (1u << 14) ? len * 64 : (1u << 20), most = len * 64 + ((size_t)128 << 20);
  for (size_t size = first;; size = size > most / 4 ? most : size * 4) {
    void *mem = malloc(size);
    if (!mem) break;
    m42_warrior *w;
    const int s = m42_assemble(src, len, rules, flags, registers, mem, size, &w);
    if (s == M42_ERR_MEMORY) { free(mem); if (size == most) break; continue; }
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

EXPORT(m42_warrior_free)
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

// The heap mars.c's config() takes for rules->warriors warriors of
// rules->max_length instructions each (fewer warriors take less).
static usize heap_need(const m42_rules *r) {
  const usize nw = r->warriors, ins = nw * r->max_length, psize = pspace_of(r);
  const u32 qlen = queue_len(r->max_processes);
  const int linear = LINEAR_QUEUES(nw, r->max_cycles);
  usize s = 0;
  // alloc() rounds each start up to 64 bytes; the heap starts aligned.
  #define TAKE(bytes) (s += ((usize)(bytes) + 63) & ~(usize)63)
  TAKE(nw * sizeof(Warrior));
  TAKE((4 * nw + 5 * ins) * 4);
  TAKE(ins * sizeof(Cell));
  TAKE(nw * (psize ? psize : 1) * 4);
  TAKE(nw * (2 * nw - 1) * 4);
  for (usize i = 0; i < nw; i++) if (!STATIC_QUEUE(i, linear, qlen)) TAKE((usize)qlen * 2);
  // The draw list of permute (load_warriors()), for two warriors.
  if (nw >= 2 && 2 * (usize)r->min_distance <= r->core_size) TAKE(PERMUTATIONS((usize)r->core_size, (usize)r->min_distance) * 4);
  #undef TAKE
  return s;
}

// The context's bytes in caller memory: none with M42_FIXED_CONTEXT.
#ifdef M42_FIXED_CONTEXT
#define CTX_BYTES 0
#else
#define CTX_BYTES sizeof(Mars)
#endif

EXPORT(m42_ctx_size)
size_t m42_ctx_size(const m42_rules *rules) {
  return rules_ok(rules) ? 63 + CTX_BYTES + heap_need(rules) : 0;
}

EXPORT(m42_ctx_init)
m42_ctx *m42_ctx_init(void *mem, size_t size, const m42_rules *rules, int *status) {
  if (!rules_ok(rules)) { set_status(status, M42_ERR_RULES); return 0; }
  if (!mem) { set_status(status, M42_ERR_ARGUMENT); return 0; }
  if (size < m42_ctx_size(rules)) { set_status(status, M42_ERR_MEMORY); return 0; }
  u8 *const start = (u8 *)(((usize)mem + 63) & ~(usize)63);
#ifdef M42_FIXED_CONTEXT
  Mars *m = CTX;
  u8 *const heap = start;
#else
  Mars *m = (Mars *)(void *)start;
  u8 *const heap = start + sizeof(Mars);
#endif
  // Not the core and queue arrays in front (1.1 MB): start_round() clears
  // the core, and every queue entry is written before it is read.
  m42_memset(&m->N, 0, sizeof(Mars) - offsetof(Mars, N));
  m->heap_start = m->heap_top = heap;
  m->heap_end = (u8 *)mem + size;
  m->rules = *rules;
  m->loaded = 0;
  m->roundOver = 1;
  set_status(status, M42_OK);
  return (m42_ctx *)(void *)m;
}

#ifndef M42_NO_LIBC
EXPORT(m42_new)
m42_ctx *m42_new(const m42_rules *rules, int *status) {
  // 64-byte aligned, so that the block starts with the context (or, with
  // M42_FIXED_CONTEXT, with its heap): m42_free() frees it.
  const size_t size = (m42_ctx_size(rules) + 63) & ~(size_t)63;
  if (size < 64) { set_status(status, M42_ERR_RULES); return 0; }
  void *mem = m42_aligned_alloc(64, size);
  if (!mem) { set_status(status, M42_ERR_MEMORY); return 0; }
  m42_ctx *m = m42_ctx_init(mem, size, rules, status);
  if (!m) m42_aligned_free(mem);
  return m;
}

EXPORT(m42_free)
void m42_free(m42_ctx *m) {
#ifdef M42_FIXED_CONTEXT
  // The context is static; its heap is the block m42_new() allocated.
  if (m) m42_aligned_free(CTX->heap_start);
#else
  m42_aligned_free(m);
#endif
}
#endif

// ---------------------------------------------------------------- matches

EXPORT(m42_match_options_default)
m42_match_options m42_match_options_default(void) {
  const m42_match_options o = {sizeof(m42_match_options), 1, 0, 1, 0, 0, 0, 0, 0};
  return o;
}

EXPORT(m42_log_stride)
uint32_t m42_log_stride(uint32_t warriors) { return (8 + warriors + 7) & ~7u; }
EXPORT(m42_log_size)
size_t m42_log_size(uint32_t warriors, uint32_t rounds) { return (size_t)rounds * m42_log_stride(warriors); }

// The options of a call, the defaults for 0; M42_OK or M42_ERR_ARGUMENT.
static int get_options(const m42_match_options *options, m42_match_options *o) {
  *o = options ? *options : m42_match_options_default();
  return o->size >= sizeof(m42_match_options) && o->seed >= 0 && (u64)o->rounds + o->first_round <= 0xffffffffu
             ? M42_OK
             : M42_ERR_ARGUMENT;
}

// 1 when every field of the warrior is in the range of m42_instruction for
// a core of `size` cells: the engine indexes tables and the watch with them
// and does not check them again (#86).
static int fits(const AsmResult *w, u32 size) {
  if (w->start >= size) return 0;
  for (u32 j = 0; j < w->nIns; j++) {
    const AsmIns *x = &w->ins[j];
    if (x->op > 18 || x->mod > 6 || x->aMode > 7 || x->bMode > 7 || x->aVal >= size || x->bVal >= size) return 0;
  }
  return 1;
}

// Loads warriors, the way wasm/42mars.js load() did: checks, the load
// area of config(), p-space groups by PIN, then load().
static int load_warriors(Mars *m, const m42_warrior *const *ws, u32 n, const m42_match_options *o) {
  const m42_rules *r = &m->rules;
  if (!ws || n < 1 || n > r->warriors) return M42_ERR_ARGUMENT;
  const uint32_t *positions = o->positions;
  if ((u64)n * r->min_distance > r->core_size) return M42_ERR_RULES;
  if (o->permute && (n != 2 || positions)) return M42_ERR_ARGUMENT;
  u32 total = 0;
  for (u32 i = 0; i < n; i++) {
    if (!ws[i] || !RESULT(ws[i])->ok || RESULT(ws[i])->nIns > r->max_length) return M42_ERR_WARRIOR;
    if (!fits(RESULT(ws[i]), r->core_size)) return M42_ERR_WARRIOR;
    total += RESULT(ws[i])->nIns;
    if (positions && positions[i] >= r->core_size) return M42_ERR_ARGUMENT;
  }
  i32 *in = config(m, r->core_size, r->max_processes, r->max_cycles, r->min_distance, pspace_of(r), n, total);
  if (!in) return M42_ERR_MEMORY;
  m->readLimit = r->read_limit ? r->read_limit : r->core_size;
  m->writeLimit = r->write_limit ? r->write_limit : r->core_size;
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
  u32 *perm = 0;
  if (o->permute && !(perm = alloc(m, (usize)PERMUTATIONS(m->N, m->minDist) * 4))) return M42_ERR_MEMORY;
  load(m, o->seed, positions != 0, perm);
  return M42_OK;
}

static u32 *pspace_cell(const Mars *m, u32 w, u32 i);

// Copies the p-space of each warrior (cell 0: the last result) between the
// context and options->pspace: in before the first round, out after the
// last. Warriors with the same PIN share cells 1 and up; the last one's
// copy in wins. Inlined: a static function of its own moved the call indices
// of the loops.
M42_FORCE_INLINE void copy_pspace(Mars *m, u32 *pspace, int in) {
  const u32 cells = m->psize ? m->psize : 1;
  for (u32 w = 0; w < m->nw; w++) {
    for (u32 i = 0; i < cells; i++) {
      u32 *const c = pspace_cell(m, w, i);
      if (in) *c = pspace[w * cells + i];
      else pspace[w * cells + i] = *c;
    }
  }
}

EXPORT(m42_match)
int m42_match(m42_ctx *ctx, const m42_warrior *const *warriors, uint32_t n, const m42_match_options *options,
              m42_score *scores, uint64_t *instructions) {
  m42_match_options o;
  if (!ctx || get_options(options, &o) != M42_OK) return M42_ERR_ARGUMENT;
  Mars *m = CTX_OF(ctx);
  const int s = load_warriors(m, warriors, n, &o);
  if (s != M42_OK) return s;
  // end_round() writes a record per round into the log.
  m->resultLog = o.log;
  m->logStride = m42_log_stride(n);
  m->logRounds = o.log ? o.rounds : 0;
  if (o.pspace) copy_pspace(m, o.pspace, 1);
  const u64 executed = run_match(m, o.rounds, o.early_tie != 0, o.first_round);
  if (o.pspace) copy_pspace(m, o.pspace, 0);
  if (instructions) *instructions = executed;
  if (scores) {
    for (u32 i = 0; i < n; i++) scores[i] = (m42_score){m->war[i].wins, m->war[i].losses, m->war[i].ties};
  }
  return M42_OK;
}

EXPORT(m42_bench)
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

EXPORT(m42_load)
int m42_load(m42_ctx *m, const m42_warrior *const *warriors, uint32_t n, const m42_match_options *options) {
  m42_match_options o;
  if (!m || get_options(options, &o) != M42_OK) return M42_ERR_ARGUMENT;
  return load_warriors(CTX_OF(m), warriors, n, &o);
}

// M42_OK when ctx has warriors loaded, else the status to return.
static int ready(const m42_ctx *ctx) {
  return !ctx ? M42_ERR_ARGUMENT : !CCTX_OF(ctx)->loaded ? M42_ERR_STATE : M42_OK;
}

// P-space cell i of warrior w (cell 0: the last result), 0 when out of range.
static u32 *pspace_cell(const Mars *m, u32 w, u32 i) {
  if (w >= m->nw || (i && i >= m->psize)) return 0;
  return i ? &m->war[w].pspace[i] : &m->war[w].lastResult;
}

EXPORT(m42_start_round)
int m42_start_round(m42_ctx *ctx) {
  const int s = ready(ctx);
  if (s == M42_OK) {
    Mars *m = CTX_OF(ctx);
    if (m->perm) draw_permuted(m);
    start_round(m);
    if (m->watch) watch_start_round(m);
  }
  return s;
}

EXPORT(m42_run)
uint64_t m42_run(m42_ctx *ctx, uint64_t count) {
  if (ready(ctx) != M42_OK || CTX_OF(ctx)->roundOver || !count) return 0;
  return run_some(CTX_OF(ctx), count, CTX_OF(ctx)->watch != 0);
}

EXPORT(m42_end_round)
int m42_end_round(m42_ctx *ctx) {
  const int s = ready(ctx);
  if (s == M42_OK) end_round(CTX_OF(ctx));
  return s;
}

EXPORT(m42_get_state)
int m42_get_state(const m42_ctx *ctx, m42_state *s) {
  const int r = s ? ready(ctx) : M42_ERR_ARGUMENT;
  if (r != M42_OK) return r;
  const Mars *m = CCTX_OF(ctx);
  *s = (m42_state){m->round_, m->roundOver, m->current, m->warriorsLeft, (u64)m->timeNow, m->cyclesLeft};
  return M42_OK;
}

EXPORT(m42_get_warrior)
int m42_get_warrior(const m42_ctx *ctx, uint32_t w, m42_warrior_state *s) {
  const int r = s ? ready(ctx) : M42_ERR_ARGUMENT;
  if (r != M42_OK) return r;
  const Mars *m = CCTX_OF(ctx);
  if (w >= m->nw) return M42_ERR_ARGUMENT;
  const Warrior *x = &m->war[w];
  *s = (m42_warrior_state){x->alive, x->tail - x->head, x->position, x->lastResult, x->diedAt,
                           {x->wins, x->losses, x->ties}};
  return M42_OK;
}

EXPORT(m42_warrior_scores)
uint32_t m42_warrior_scores(const m42_ctx *ctx, uint32_t w, uint32_t *out, uint32_t max) {
  if (ready(ctx) != M42_OK || w >= CCTX_OF(ctx)->nw) return 0;
  const Mars *m = CCTX_OF(ctx);
  const u32 count = 2 * m->nw - 1;
  for (u32 k = 0; out && k < count && k < max; k++) out[k] = m->war[w].score[k];
  return count;
}

EXPORT(m42_core)
const m42_cell *m42_core(const m42_ctx *ctx) {
  const Mars *m = CCTX_OF(ctx);
  return ctx ? (const m42_cell *)(const void *)CORE(m) : 0;
}

EXPORT(m42_queue)
uint32_t m42_queue(const m42_ctx *ctx, uint32_t w, uint32_t *out, uint32_t max) {
  if (ready(ctx) != M42_OK || w >= CCTX_OF(ctx)->nw) return 0;
  const Mars *m = CCTX_OF(ctx);
  const Warrior *x = &m->war[w];
  const u32 tasks = x->tail - x->head;
  for (u32 k = 0; out && k < tasks && k < max; k++) out[k] = x->q[(x->head + k) & m->qmask];
  return tasks;
}

EXPORT(m42_pspace_get)
int m42_pspace_get(const m42_ctx *ctx, uint32_t w, uint32_t i, uint32_t *value) {
  const int r = value ? ready(ctx) : M42_ERR_ARGUMENT;
  if (r != M42_OK) return r;
  const u32 *cell = pspace_cell(CCTX_OF(ctx), w, i);
  if (!cell) return M42_ERR_ARGUMENT;
  *value = *cell;
  return M42_OK;
}

EXPORT(m42_pspace_set)
int m42_pspace_set(m42_ctx *ctx, uint32_t w, uint32_t i, uint32_t value) {
  const int r = ready(ctx);
  if (r != M42_OK) return r;
  u32 *cell = pspace_cell(CTX_OF(ctx), w, i);
  if (!cell) return M42_ERR_ARGUMENT;
  *cell = value;
  return M42_OK;
}

// ---------------------------------------------------------------- watching

// The parts of a watch for these rules, each 64-byte aligned: the header,
// then the arrays in the order of m42_watch. Returns their bytes from an
// aligned start; with x, also writes x: its arrays in the block at `at`.
static usize watch_layout(const m42_rules *r, u8 *at, m42_watch *x) {
  const usize n = r->core_size, nw = r->warriors, stride = r->max_length ? r->max_length : 1;
  const usize bytes[] = {sizeof(m42_watch), n, n, n, n, 4 * n, 4 * n, 4 * n, 4 * n, 4 * nw, 4 * nw * stride,
                         M42_TRACE_SIZE * sizeof(m42_trace_entry), M42_DEATH_SIZE * sizeof(m42_death)};
  void *part[sizeof(bytes) / sizeof(bytes[0])] = {0};
  usize s = 0;
  for (usize k = 0; k < sizeof(bytes) / sizeof(bytes[0]); k++) {
    if (x) part[k] = at + s;
    s += (bytes[k] + 63) & ~(usize)63;
  }
  if (x) {
    *x = (m42_watch){r->core_size, r->warriors, (u32)stride, 0, 0, part[1], part[2], part[3], part[4], part[5], part[6], part[7],
                     part[8], part[9], part[10], part[11], part[12]};
  }
  return s;
}

EXPORT(m42_watch_size)
size_t m42_watch_size(const m42_rules *rules) {
  return rules_ok(rules) && rules->max_length <= 65536 ? 63 + watch_layout(rules, 0, 0) : 0;
}

EXPORT(m42_watch_attach)
const m42_watch *m42_watch_attach(m42_ctx *ctx, void *mem, size_t size, int *status) {
  if (!ctx) { set_status(status, M42_ERR_ARGUMENT); return 0; }
  Mars *m = CTX_OF(ctx);
  m->watch = 0;
  if (!mem) { set_status(status, M42_OK); return 0; }
  const usize need = m42_watch_size(&m->rules);
  if (!need) { set_status(status, M42_ERR_RULES); return 0; }
  if (size < need) { set_status(status, M42_ERR_MEMORY); return 0; }
  u8 *const start = (u8 *)(((usize)mem + 63) & ~(usize)63);
  m42_watch *x = (m42_watch *)(void *)start;
  watch_layout(&m->rules, start, x);
  // Empty until the next m42_start_round(): attached during a round, it records from there.
  watch_clear(x);
  m->watch = x;
  set_status(status, M42_OK);
  return x;
}
