// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

#include "generator.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#define NONE UINT32_MAX
#define OPEN UINT32_MAX // the length of a block that is still being written

static const char *const OPCODES[GEN_OPCODES] = {"MOV", "ADD", "SUB", "MUL", "DIV", "MOD", "JMZ", "JMN", "DJN",
                                                 "CMP", "SLT", "SPL", "DAT", "JMP", "SEQ", "SNE", "NOP"};
static const char *const MODIFIERS[7] = {"A", "B", "AB", "BA", "F", "X", "I"};
static const char MODES[] = "#$@<>*{}";

static uint32_t wrap(int64_t v, uint32_t core) {
  int64_t m = v % (int64_t)core;
  return (uint32_t)(m < 0 ? m + core : m);
}

// The value a number mod the core size stands for: between -core/2 and core/2.
static int64_t signed_value(uint32_t v, uint32_t core) { return v > core / 2 ? (int64_t)v - core : (int64_t)v; }

static int fail(char *err, size_t err_n, const char *format, ...) {
  if (err && err_n) {
    va_list ap;
    va_start(ap, format);
    vsnprintf(err, err_n, format, ap);
    va_end(ap);
  }
  return -1;
}

// ---------------------------------------------------------------- well formed

// The line that closes each block (match[opener] = its GL_END, match[end] =
// its opener), NONE for the other lines. An opener that is never closed
// reaches to the end (n); an end without one is NONE.
static void match_blocks(const gen *x, uint32_t n, uint32_t *match) {
  if (n > GEN_LINES) n = GEN_LINES;
  uint32_t stack[GEN_LINES], depth = 0;
  for (uint32_t i = 0; i < n; i++) {
    match[i] = NONE;
    const uint8_t kind = x->l[i].kind;
    if (kind == GL_REPEAT || kind == GL_DEF) {
      stack[depth++] = i;
    } else if (kind == GL_END && depth) {
      match[i] = stack[--depth];
      match[match[i]] = i;
    }
  }
  while (depth) match[stack[--depth]] = n;
}

// 0 when the expression is complete: every operation has its two values and
// one value is left; nothing behind its n tokens.
static int expr_check(const gen *x, const gen_expr *e, uint32_t core, int may_be_empty) {
  if (e->n > GEN_TOKENS) return -1;
  for (uint32_t t = e->n; t < GEN_TOKENS; t++)
    if (e->kind[t] || e->v[t]) return -1;
  if (!e->n) return may_be_empty ? 0 : -1;
  uint32_t depth = 0;
  for (uint32_t t = 0; t < e->n; t++) {
    const uint32_t v = e->v[t];
    switch (e->kind[t]) {
      case GT_NUM: if (v >= core) return -1; break;
      case GT_CONST: if (v >= GEN_CONSTS) return -1; break;
      case GT_INDEX: if (v >= 3) return -1; break;
      case GT_ARG: if (v >= 2) return -1; break;
      case GT_POS:
      case GT_LEN: if (v >= x->n) return -1; break;
      case GT_CORE: if (v) return -1; break;
      case GT_ADD:
      case GT_SUB:
      case GT_MUL:
      case GT_DIV:
      case GT_MOD:
        if (v || depth < 2) return -1;
        depth -= 2;
        break;
      default: return -1;
    }
    depth++;
  }
  return depth == 1 ? 0 : -1;
}

int gen_check(const gen *x, uint32_t core, char *err, size_t err_n) {
  if (core < 1) return fail(err, err_n, "no core");
  if (x->n < 1 || x->n > GEN_LINES) return fail(err, err_n, "%u lines, 1 to %d are possible", x->n, GEN_LINES);
  if (x->start >= x->n) return fail(err, err_n, "the start is line %u of %u", x->start, x->n);
  for (uint32_t k = 0; k < GEN_CONSTS; k++)
    if (x->c[k] >= core) return fail(err, err_n, "c%u is not below the core size", k);
  uint32_t depth = 0;
  for (uint32_t i = 0; i < x->n; i++) {
    const gen_line *l = &x->l[i];
    const int emit = l->kind == GL_EMIT, call = l->kind == GL_CALL;
    if (l->kind > GL_CALL) return fail(err, err_n, "line %u: an unknown kind of line", i);
    if (emit ? l->op >= GEN_OPCODES || l->mod > 6 || l->am > 7 || l->bm > 7 : l->op || l->mod || l->am || l->bm)
      return fail(err, err_n, "line %u: its instruction is out of range", i);
    if (call ? l->callee >= x->n : l->callee != 0) return fail(err, err_n, "line %u: its function is out of range", i);
    const int first_empty = call || l->kind == GL_END || l->kind == GL_DEF, second_empty = !emit;
    if (expr_check(x, &l->x[0], core, first_empty) || (!call && first_empty && l->x[0].n) ||
        expr_check(x, &l->x[1], core, second_empty) || (!call && second_empty && l->x[1].n) ||
        (call && l->x[1].n && !l->x[0].n)) // a second argument needs a first
      return fail(err, err_n, "line %u: an expression is not complete or out of range", i);
    if (l->kind == GL_DEF && depth) return fail(err, err_n, "line %u: a def inside a block", i);
    if (l->kind == GL_REPEAT || l->kind == GL_DEF) depth++;
    if (l->kind == GL_END && !depth--) return fail(err, err_n, "line %u: an end without a block", i);
  }
  if (depth) return fail(err, err_n, "a block is not closed");
  return 0;
}

// ---------------------------------------------------------------- compiling

// A repetition of a repeat (index: which, from 0) or a call (index: the line
// of the def); frame 0 is the top level.
enum { FR_TOP, FR_REPEAT, FR_CALL };
typedef struct {
  uint32_t parent, line, index;
  uint8_t kind, depth;
} frame;

// One time that a line was written: where, and how many instructions.
typedef struct {
  uint32_t line, frame, pos, len, next; // next: the next instance of the same line
} instance;

typedef struct {
  const gen *x;
  uint32_t lines, core, max;
  uint32_t n;     // instructions written
  uint32_t steps; // left
  int stop, truncated;
  uint32_t nf, ni;
  uint32_t match[GEN_LINES], first[GEN_LINES], last[GEN_LINES];
  uint32_t at_line[GEN_LINES], at_frame[GEN_LINES]; // of each instruction written
  frame fr[GEN_STEPS + 1];
  instance in[GEN_STEPS];
} compiler;

static int step(compiler *c) {
  if (!c->steps) {
    c->stop = c->truncated = 1;
    return 0;
  }
  c->steps--;
  return 1;
}

static uint32_t add_instance(compiler *c, uint32_t line, uint32_t f, uint32_t len) {
  if (!step(c)) return NONE;
  const uint32_t k = c->ni++;
  c->in[k] = (instance){line, f, c->n, len, NONE};
  if (c->last[line] == NONE) c->first[line] = k;
  else c->in[c->last[line]].next = k;
  c->last[line] = k;
  return k;
}

static uint32_t add_frame(compiler *c, uint32_t parent, uint8_t kind, uint32_t line, uint32_t index) {
  if (!step(c)) return NONE;
  const uint32_t f = c->nf++;
  c->fr[f] = (frame){parent, line, index, kind, (uint8_t)(c->fr[parent].depth + 1)};
  return f;
}

// The depth of the deepest frame that is above (or is) both a and b.
static uint32_t shared_depth(const compiler *c, uint32_t a, uint32_t b) {
  while (c->fr[a].depth > c->fr[b].depth) a = c->fr[a].parent;
  while (c->fr[b].depth > c->fr[a].depth) b = c->fr[b].parent;
  while (a != b) a = c->fr[a].parent, b = c->fr[b].parent;
  return c->fr[a].depth;
}

// The instance of `line` nearest to frame f in the tree of frames, the first
// written of several; NONE when the line was never written.
static uint32_t nearest(const compiler *c, uint32_t line, uint32_t f) {
  uint32_t best = NONE, best_depth = 0;
  for (uint32_t k = c->first[line]; k != NONE; k = c->in[k].next) {
    const uint32_t d = shared_depth(c, c->in[k].frame, f);
    if (best == NONE || d > best_depth) best = k, best_depth = d;
    if (d == c->fr[f].depth) break; // none is nearer
  }
  return best;
}

// A value beyond +-2^31 becomes its remainder mod the core size, so that no
// operation overflows 64 bits.
static int64_t fit(int64_t v, uint32_t core) { return v > INT32_MAX || v < -(int64_t)INT32_MAX ? v % (int64_t)core : v; }

// The value of e for the instruction at position q, written in frame f.
static int64_t eval(const compiler *c, const gen_expr *e, uint32_t f, uint32_t q) {
  int64_t s[GEN_TOKENS + 1];
  uint32_t n = 0;
  const uint32_t tokens = e->n < GEN_TOKENS ? e->n : GEN_TOKENS;
  for (uint32_t t = 0; t < tokens; t++) {
    const uint32_t v = e->v[t];
    int64_t r = 0;
    if (e->kind[t] >= GT_ADD) {
      const int64_t b = n ? s[--n] : 0, a = n ? s[--n] : 0;
      switch (e->kind[t]) {
        case GT_ADD: r = a + b; break;
        case GT_SUB: r = a - b; break;
        case GT_MUL: r = a * b; break;
        case GT_DIV: r = b ? a / b : 0; break;
        case GT_MOD: r = b ? a % b : 0; break;
        default: break;
      }
      s[n++] = fit(r, c->core);
      continue;
    }
    switch (e->kind[t]) {
      case GT_NUM: r = signed_value(v % c->core, c->core); break;
      case GT_CONST: r = v < GEN_CONSTS ? signed_value(c->x->c[v] % c->core, c->core) : 0; break;
      case GT_INDEX: {
        uint32_t left = v;
        for (uint32_t g = f; g; g = c->fr[g].parent) {
          if (c->fr[g].kind != FR_REPEAT) continue;
          if (!left--) {
            r = c->fr[g].index;
            break;
          }
        }
        break;
      }
      case GT_ARG: {
        uint32_t g = f;
        while (g && c->fr[g].kind != FR_CALL) g = c->fr[g].parent;
        // the argument is an expression of the caller: its value there, for this instruction
        if (g && v < 2) r = eval(c, &c->x->l[c->fr[g].line].x[v], c->fr[g].parent, q);
        break;
      }
      case GT_POS:
      case GT_LEN: {
        const uint32_t k = v < c->lines ? nearest(c, v, f) : NONE;
        if (k == NONE) break;
        if (e->kind[t] == GT_POS) r = (int64_t)c->in[k].pos - q;
        else r = c->in[k].len == OPEN ? c->n - c->in[k].pos : c->in[k].len;
        break;
      }
      case GT_CORE: r = c->core; break;
      default: break;
    }
    s[n++] = r;
  }
  return n ? s[n - 1] : 0;
}

// Is the function at line def running in frame f or above it?
static int running(const compiler *c, uint32_t f, uint32_t def) {
  for (uint32_t g = f; g; g = c->fr[g].parent)
    if (c->fr[g].kind == FR_CALL && c->fr[g].index == def) return 1;
  return 0;
}

// Writes the lines from .. to-1 in frame f.
static void write_lines(compiler *c, uint32_t from, uint32_t to, uint32_t f) {
  const gen *x = c->x;
  for (uint32_t i = from; i < to && !c->stop; i++) {
    const gen_line *l = &x->l[i];
    switch (l->kind) {
      case GL_DEF: i = c->match[i]; break; // written where it is called
      case GL_EMIT:
        if (c->n >= c->max) {
          c->stop = c->truncated = 1;
          break;
        }
        if (add_instance(c, i, f, 1) == NONE) break;
        c->at_line[c->n] = i;
        c->at_frame[c->n] = f;
        c->n++;
        break;
      case GL_REPEAT: {
        const uint32_t end = c->match[i], k = add_instance(c, i, f, OPEN);
        if (k == NONE) break;
        if (c->fr[f].depth < GEN_DEPTH) {
          const int64_t count = eval(c, &l->x[0], f, c->n);
          for (int64_t t = 0; t < count && !c->stop; t++) { // the steps end it
            const uint32_t g = add_frame(c, f, FR_REPEAT, i, (uint32_t)t);
            if (g != NONE) write_lines(c, i + 1, end, g);
          }
        }
        c->in[k].len = c->n - c->in[k].pos;
        if (!c->stop && end < c->lines) add_instance(c, end, f, 0);
        i = end;
        break;
      }
      case GL_CALL: {
        const uint32_t d = l->callee, k = add_instance(c, i, f, OPEN);
        if (k == NONE) break;
        if (d < c->lines && x->l[d].kind == GL_DEF && c->fr[f].depth < GEN_DEPTH && !running(c, f, d)) {
          const uint32_t g = add_frame(c, f, FR_CALL, i, d), kd = g == NONE ? NONE : add_instance(c, d, g, OPEN);
          if (kd != NONE) {
            const uint32_t end = c->match[d];
            write_lines(c, d + 1, end, g);
            c->in[kd].len = c->n - c->in[kd].pos;
            if (!c->stop && end < c->lines) add_instance(c, end, g, 0);
          }
        }
        c->in[k].len = c->n - c->in[k].pos;
        break;
      }
      default: break; // a GL_END without a block
    }
  }
}

void gen_blocks(const gen *x, uint32_t *match) { match_blocks(x, x->n, match); }

uint32_t gen_compile(const gen *x, uint32_t core, uint32_t max_length, m42_instruction *out, uint32_t *start,
                     int *truncated) {
  gen_info info;
  const uint32_t n = gen_compile_info(x, core, max_length, out, &info);
  if (start) *start = info.start;
  if (truncated) *truncated = info.truncated;
  return n;
}

uint32_t gen_compile_info(const gen *x, uint32_t core, uint32_t max_length, m42_instruction *out, gen_info *info) {
  compiler c;
  c.x = x;
  c.lines = x->n < GEN_LINES ? x->n : GEN_LINES;
  c.core = core ? core : 1;
  c.max = max_length < GEN_LINES ? max_length : GEN_LINES;
  if (c.max < 1) c.max = 1;
  c.n = 0;
  c.steps = GEN_STEPS;
  c.stop = c.truncated = 0;
  c.nf = 1;
  c.ni = 0;
  c.fr[0] = (frame){0, 0, 0, FR_TOP, 0};
  for (uint32_t i = 0; i < GEN_LINES; i++) c.first[i] = c.last[i] = NONE;
  match_blocks(x, c.lines, c.match);
  write_lines(&c, 0, c.lines, 0);
  for (uint32_t q = 0; q < c.n; q++) {
    const gen_line *l = &x->l[c.at_line[q]];
    m42_instruction *o = &out[q];
    o->opcode = l->op < GEN_OPCODES ? l->op : 12;
    o->modifier = l->mod < 7 ? l->mod : 4;
    o->a_mode = l->am & 7;
    o->b_mode = l->bm & 7;
    o->a = wrap(eval(&c, &l->x[0], c.at_frame[q], q), c.core);
    o->b = wrap(eval(&c, &l->x[1], c.at_frame[q], q), c.core);
    o->line = (int32_t)q + 1;
  }
  info->truncated = c.truncated;
  info->written = c.n;
  for (uint32_t i = 0; i < GEN_LINES; i++) {
    const uint32_t k = c.first[i];
    info->pos[i] = k == NONE ? GEN_NONE : c.in[k].pos;
    info->len[i] = k == NONE ? GEN_NONE : c.in[k].len;
  }
  const uint32_t k = x->start < c.lines ? c.first[x->start] : NONE;
  info->start = k != NONE && c.in[k].pos < c.n ? c.in[k].pos : 0;
  if (!c.n) out[0] = (m42_instruction){12, 4, 1, 1, 0, 0, 1}; // nothing written: what an empty cell holds
  return info->n = c.n ? c.n : 1;
}

void gen_from_code(gen *x, const m42_instruction *code, uint32_t len, uint32_t start, uint32_t core) {
  memset(x, 0, sizeof *x);
  x->n = len;
  x->start = start;
  for (uint32_t i = 0; i < len; i++) {
    const m42_instruction *c = &code[i];
    gen_line *l = &x->l[i];
    l->kind = GL_EMIT;
    l->op = c->opcode;
    l->mod = c->modifier;
    l->am = c->a_mode;
    l->bm = c->b_mode;
    const uint32_t value[2] = {c->a, c->b}, mode[2] = {c->a_mode, c->b_mode};
    for (int k = 0; k < 2; k++) {
      const uint32_t target = (uint32_t)(((uint64_t)i + value[k]) % core);
      const int ref = mode[k] != 0 && target < len;
      l->x[k].n = 1;
      l->x[k].kind[0] = ref ? GT_POS : GT_NUM;
      l->x[k].v[0] = ref ? target : value[k];
    }
  }
}

// ---------------------------------------------------------------- text

// Where a text without `org` starts: the first line outside the functions,
// which is where the first instruction is written; line 0 when there is none.
static uint32_t first_line(const gen *x, uint32_t lines) {
  uint32_t depth = 0;
  for (uint32_t i = 0; i < lines; i++) {
    const uint8_t kind = x->l[i].kind;
    if (!depth && kind != GL_DEF) return i;
    if (kind == GL_DEF || kind == GL_REPEAT) depth++;
    else if (kind == GL_END && depth) depth--;
  }
  return 0;
}

#define NAME_MAX 32 // a label with its terminating 0
#define EXPR_TEXT 160

static void label_name(const gen *x, uint32_t line, char *buf, size_t n) {
  snprintf(buf, n, "%c%u", line < x->n && line < GEN_LINES && x->l[line].kind == GL_DEF ? 'f' : 'L', line);
}

// e in infix, with the parentheses that reading it back needs.
static void expr_text(const gen *x, const gen_expr *e, uint32_t core, char *out, size_t out_n) {
  static const char OPS[] = "+-*/%";
  struct {
    char s[EXPR_TEXT];
    int prec; // 1: a sum, 2: a product, 3: one value
  } st[GEN_TOKENS + 1];
  uint32_t n = 0;
  for (uint32_t t = 0; t < e->n && t < GEN_TOKENS; t++) {
    const uint32_t v = e->v[t];
    char name[NAME_MAX];
    if (e->kind[t] >= GT_ADD && e->kind[t] <= GT_MOD) {
      const int prec = e->kind[t] <= GT_SUB ? 1 : 2;
      char a[EXPR_TEXT] = "0", b[EXPR_TEXT] = "0";
      int pa = 3, pb = 3;
      if (n) n--, memcpy(b, st[n].s, sizeof b), pb = st[n].prec;
      if (n) n--, memcpy(a, st[n].s, sizeof a), pa = st[n].prec;
      snprintf(st[n].s, sizeof st[n].s, "%s%.70s%s%c%s%.70s%s", pa < prec ? "(" : "", a, pa < prec ? ")" : "",
               OPS[e->kind[t] - GT_ADD], pb <= prec ? "(" : "", b, pb <= prec ? ")" : "");
      st[n++].prec = prec;
      continue;
    }
    char *s = st[n].s;
    const size_t sn = sizeof st[n].s;
    switch (e->kind[t]) {
      case GT_NUM: snprintf(s, sn, "%lld", (long long)signed_value(v % core, core)); break;
      case GT_CONST: snprintf(s, sn, "c%u", v); break;
      case GT_INDEX: snprintf(s, sn, "%c", v < 3 ? "ijk"[v] : '?'); break;
      case GT_ARG: snprintf(s, sn, "%c", v < 2 ? "xy"[v] : '?'); break;
      case GT_POS:
      case GT_LEN:
        label_name(x, v, name, sizeof name);
        snprintf(s, sn, "%s%s", name, e->kind[t] == GT_LEN ? ".len" : "");
        break;
      case GT_CORE: snprintf(s, sn, "CORESIZE"); break;
      default: snprintf(s, sn, "?"); break;
    }
    st[n++].prec = 3;
  }
  const char *text = n ? st[n - 1].s : "0";
  const size_t len = strlen(text) < out_n - 1 ? strlen(text) : out_n - 1;
  memcpy(out, text, len);
  out[len] = 0;
}

size_t gen_text(const gen *x, uint32_t core, char *buf, size_t n) {
  const uint32_t lines = x->n < GEN_LINES ? x->n : GEN_LINES;
  uint8_t used[GEN_LINES] = {0}; // lines that need a label
  const int org = x->start < lines && x->start != first_line(x, lines);
  if (org) used[x->start] = 1;
  for (uint32_t i = 0; i < lines; i++) {
    const gen_line *l = &x->l[i];
    if (l->kind == GL_CALL && l->callee < lines) used[l->callee] = 1;
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < l->x[k].n && t < GEN_TOKENS; t++)
        if ((l->x[k].kind[t] == GT_POS || l->x[k].kind[t] == GT_LEN) && l->x[k].v[t] < lines) used[l->x[k].v[t]] = 1;
  }
  size_t len = 0;
  char line[2 * EXPR_TEXT + 96], a[EXPR_TEXT], b[EXPR_TEXT], name[NAME_MAX];
#define PUT()                                                                                                         \
  do {                                                                                                                \
    const size_t k = strlen(line);                                                                                    \
    if (len < n) memcpy(buf + len, line, k < n - len ? k : n - len);                                                  \
    len += k;                                                                                                         \
  } while (0)
  for (uint32_t k = 0; k < GEN_CONSTS; k++) {
    if (!x->c[k]) continue;
    snprintf(line, sizeof line, "c%u = %lld\n", k, (long long)signed_value(x->c[k] % core, core));
    PUT();
  }
  uint32_t depth = 0;
  for (uint32_t i = 0; i < lines; i++) {
    const gen_line *l = &x->l[i];
    if (l->kind == GL_END && depth) depth--;
    char head[NAME_MAX + 2] = "";
    if (used[i]) {
      label_name(x, i, name, sizeof name);
      snprintf(head, sizeof head, "%s:", name);
    }
    const int indent = (int)(2 * (depth < 16 ? depth : 16));
    expr_text(x, &l->x[0], core, a, sizeof a);
    expr_text(x, &l->x[1], core, b, sizeof b);
    switch (l->kind) {
      case GL_EMIT: {
        char op[8];
        snprintf(op, sizeof op, "%s.%s", OPCODES[l->op < GEN_OPCODES ? l->op : 12], MODIFIERS[l->mod < 7 ? l->mod : 4]);
        snprintf(line, sizeof line, "%-7s %*s%-7s %c%s, %c%s\n", head, indent, "", op, MODES[l->am & 7], a, MODES[l->bm & 7],
                 b);
        break;
      }
      case GL_REPEAT: snprintf(line, sizeof line, "%-7s %*srepeat  %s\n", head, indent, "", a); break;
      case GL_DEF: snprintf(line, sizeof line, "%-7s %*sdef\n", head, indent, ""); break;
      case GL_CALL:
        label_name(x, l->callee, name, sizeof name);
        snprintf(line, sizeof line, "%-7s %*s%s(%s%s%s)\n", head, indent, "", name, l->x[0].n || l->x[1].n ? a : "",
                 l->x[1].n ? ", " : "", l->x[1].n ? b : "");
        break;
      default: snprintf(line, sizeof line, "%-7s %*send\n", head, indent, ""); break;
    }
    PUT();
    if (l->kind == GL_REPEAT || l->kind == GL_DEF) depth++;
  }
  if (org) {
    label_name(x, x->start, name, sizeof name);
    snprintf(line, sizeof line, "%-7s org     %s\n", "", name);
    PUT();
  }
#undef PUT
  if (n) buf[len < n ? len : n - 1] = 0;
  return len;
}

// ---------------------------------------------------------------- reading text

enum { S_NONE, S_CONST, S_ORG, S_REPEAT, S_END, S_DEF, S_EMIT, S_CALL, S_BAD };

typedef struct {
  char name[GEN_LINES][NAME_MAX];
  uint32_t line[GEN_LINES], n;
} labels;

typedef struct {
  const char *p;
  const labels *lab;
  uint32_t core, depth;
  const char *what; // the first error
} reader;

static void skip_space(const char **p) {
  while (**p == ' ' || **p == '\t' || **p == '\r') (*p)++;
}

static int is_letter(char ch) { return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch == '_'; }
static int is_digit(char ch) { return ch >= '0' && ch <= '9'; }

// The name at *p (letters, digits, _; not starting with a digit) into out;
// its length, 0 when there is none or it is too long.
static size_t read_name(const char **p, char *out) {
  const char *s = *p;
  size_t k = 0;
  if (!is_letter(*s)) return 0;
  while (is_letter(s[k]) || is_digit(s[k])) k++;
  if (k >= NAME_MAX) return 0;
  memcpy(out, s, k);
  out[k] = 0;
  *p = s + k;
  return k;
}

static int same_word(const char *a, const char *b) { // without case
  for (;; a++, b++) {
    const char x = *a >= 'a' && *a <= 'z' ? (char)(*a - 32) : *a, y = *b >= 'a' && *b <= 'z' ? (char)(*b - 32) : *b;
    if (x != y) return 0;
    if (!x) return 1;
  }
}

static int opcode_of(const char *name) {
  for (int k = 0; k < GEN_OPCODES; k++)
    if (same_word(name, OPCODES[k])) return k;
  return -1;
}

// c<N>: the number N (GEN_CONSTS for any that is too large), -1 when name is
// no constant.
static int const_of(const char *name) {
  if (name[0] != 'c' || !is_digit(name[1])) return -1;
  int v = 0;
  for (const char *s = name + 1; *s; s++) {
    if (!is_digit(*s)) return -1;
    v = v * 10 + (*s - '0');
    if (v > GEN_CONSTS) v = GEN_CONSTS;
  }
  return v;
}

static int reserved(const char *name) {
  static const char *const words[] = {"i", "j", "k", "x", "y", "CORESIZE", "repeat", "end", "def", "org"};
  for (size_t k = 0; k < sizeof words / sizeof *words; k++)
    if (!strcmp(name, words[k])) return 1;
  return opcode_of(name) >= 0 || const_of(name) >= 0;
}

// What a line of text is: its label (empty without one), the word its
// statement starts with, and where the rest begins. The text ends at a `;`.
static int scan_line(const char *text, char *label, char *word, const char **rest) {
  const char *p = text;
  label[0] = word[0] = 0;
  skip_space(&p);
  if (!*p) return S_NONE;
  if (!read_name(&p, word)) return S_BAD;
  skip_space(&p);
  if (*p == ':') {
    memcpy(label, word, NAME_MAX);
    p++;
    skip_space(&p);
    if (!read_name(&p, word)) return S_BAD;
    skip_space(&p);
  }
  *rest = p;
  if (!strcmp(word, "repeat")) return S_REPEAT;
  if (!strcmp(word, "end")) return S_END;
  if (!strcmp(word, "def")) return S_DEF;
  if (!strcmp(word, "org")) return label[0] ? S_BAD : S_ORG;
  if (const_of(word) >= 0 && *p == '=') return label[0] ? S_BAD : S_CONST;
  if (opcode_of(word) >= 0) return S_EMIT;
  if (*p == '(' && !reserved(word)) return S_CALL;
  return S_BAD;
}

static uint32_t label_line(const labels *lab, const char *name) {
  for (uint32_t k = 0; k < lab->n; k++)
    if (!strcmp(lab->name[k], name)) return lab->line[k];
  return NONE;
}

static int push(reader *r, gen_expr *e, uint8_t kind, uint32_t v) {
  if (e->n >= GEN_TOKENS) {
    if (!r->what) r->what = "an expression of more than 7 tokens";
    return -1;
  }
  e->kind[e->n] = kind;
  e->v[e->n++] = v;
  return 0;
}

static int read_number(reader *r, int negative, uint32_t *v) {
  int64_t x = 0;
  int digits = 0;
  while (is_digit(*r->p)) {
    if (++digits > 12) {
      if (!r->what) r->what = "a number of more than 12 digits";
      return -1;
    }
    x = x * 10 + (*r->p++ - '0');
  }
  *v = wrap(negative ? -x : x, r->core);
  return 0;
}

static int read_sum(reader *r, gen_expr *e);

static int read_value(reader *r, gen_expr *e) {
  skip_space(&r->p);
  uint32_t v;
  if (*r->p == '(') {
    r->p++;
    if (++r->depth > 16) {
      if (!r->what) r->what = "parentheses more than 16 deep";
      return -1;
    }
    if (read_sum(r, e)) return -1;
    r->depth--;
    skip_space(&r->p);
    if (*r->p != ')') {
      if (!r->what) r->what = "a missing )";
      return -1;
    }
    r->p++;
    return 0;
  }
  if (is_digit(*r->p)) return read_number(r, 0, &v) ? -1 : push(r, e, GT_NUM, v);
  if (*r->p == '-') {
    r->p++;
    if (is_digit(*r->p)) return read_number(r, 1, &v) ? -1 : push(r, e, GT_NUM, v);
    return push(r, e, GT_NUM, 0) || read_value(r, e) ? -1 : push(r, e, GT_SUB, 0); // -v: 0 - v
  }
  char name[NAME_MAX];
  if (!read_name(&r->p, name)) {
    if (!r->what) r->what = "a value is missing";
    return -1;
  }
  if (!name[1] && (name[0] == 'i' || name[0] == 'j' || name[0] == 'k')) return push(r, e, GT_INDEX, (uint32_t)(name[0] - 'i'));
  if (!name[1] && (name[0] == 'x' || name[0] == 'y')) return push(r, e, GT_ARG, (uint32_t)(name[0] - 'x'));
  if (!strcmp(name, "CORESIZE")) return push(r, e, GT_CORE, 0);
  const int k = const_of(name);
  if (k >= 0) {
    if (k >= GEN_CONSTS) {
      if (!r->what) r->what = "a constant above c15";
      return -1;
    }
    return push(r, e, GT_CONST, (uint32_t)k);
  }
  const uint32_t line = label_line(r->lab, name);
  if (line == NONE) {
    if (!r->what) r->what = "an unknown label";
    return -1;
  }
  if (!strncmp(r->p, ".len", 4) && !is_letter(r->p[4]) && !is_digit(r->p[4])) {
    r->p += 4;
    return push(r, e, GT_LEN, line);
  }
  return push(r, e, GT_POS, line);
}

static int read_product(reader *r, gen_expr *e) {
  if (read_value(r, e)) return -1;
  for (;;) {
    skip_space(&r->p);
    const char op = *r->p;
    if (op != '*' && op != '/' && op != '%') return 0;
    r->p++;
    if (read_value(r, e) || push(r, e, op == '*' ? GT_MUL : op == '/' ? GT_DIV : GT_MOD, 0)) return -1;
  }
}

static int read_sum(reader *r, gen_expr *e) {
  if (read_product(r, e)) return -1;
  for (;;) {
    skip_space(&r->p);
    const char op = *r->p;
    if (op != '+' && op != '-') return 0;
    r->p++;
    if (read_product(r, e) || push(r, e, op == '+' ? GT_ADD : GT_SUB, 0)) return -1;
  }
}

// An operand: a mode and an expression.
static int read_operand(reader *r, uint8_t *mode, gen_expr *e) {
  skip_space(&r->p);
  const char *m = *r->p ? strchr(MODES, *r->p) : 0;
  if (!m) {
    if (!r->what) r->what = "an operand needs its mode (# $ @ < > * { })";
    return -1;
  }
  *mode = (uint8_t)(m - MODES);
  r->p++;
  return read_sum(r, e);
}

// The statement of one line into l; rest is behind its first word.
static const char *read_line(int kind, const char *word, const char *rest, const labels *lab, uint32_t core, gen_line *l) {
  reader r = {rest, lab, core, 0, 0};
  switch (kind) {
    case S_REPEAT:
      l->kind = GL_REPEAT;
      if (read_sum(&r, &l->x[0])) return r.what;
      break;
    case S_END: l->kind = GL_END; break;
    case S_DEF: l->kind = GL_DEF; break;
    case S_CALL: {
      l->kind = GL_CALL;
      l->callee = label_line(lab, word);
      if (l->callee == NONE) return "a call of an unknown label";
      r.p++; // (
      skip_space(&r.p);
      if (*r.p != ')') {
        if (read_sum(&r, &l->x[0])) return r.what;
        skip_space(&r.p);
        if (*r.p == ',') {
          r.p++;
          if (read_sum(&r, &l->x[1])) return r.what;
          skip_space(&r.p);
        }
      }
      if (*r.p != ')') return "a call takes up to 2 arguments and ends with )";
      r.p++;
      break;
    }
    default: { // S_EMIT
      l->kind = GL_EMIT;
      l->op = (uint8_t)opcode_of(word);
      if (*r.p != '.') return "an instruction needs its modifier, as MOV.I";
      r.p++;
      char mod[NAME_MAX];
      int m = -1;
      if (read_name(&r.p, mod))
        for (int k = 0; k < 7; k++)
          if (same_word(mod, MODIFIERS[k])) m = k;
      if (m < 0) return "an unknown modifier";
      l->mod = (uint8_t)m;
      if (read_operand(&r, &l->am, &l->x[0])) return r.what;
      skip_space(&r.p);
      if (*r.p != ',') return "an instruction needs two operands";
      r.p++;
      if (read_operand(&r, &l->bm, &l->x[1])) return r.what;
      break;
    }
  }
  skip_space(&r.p);
  return *r.p ? "something behind the end of the line" : 0;
}

// The next line of text at *p without its comment, into out; 0 at the end,
// -1 when it is too long.
static int next_line(const char **p, char *out, size_t out_n) {
  const char *s = *p;
  if (!*s) return 0;
  size_t k = 0;
  int comment = 0;
  for (; *s && *s != '\n'; s++) {
    if (*s == ';') comment = 1;
    if (comment) continue;
    if (k + 1 >= out_n) return -1;
    out[k++] = *s;
  }
  out[k] = 0;
  *p = *s ? s + 1 : s;
  return 1;
}

int gen_parse(gen *x, const char *text, uint32_t core, char *err, size_t err_n) {
  if (core < 1) return fail(err, err_n, "no core");
  labels lab;
  lab.n = 0;
  char line[512], label[NAME_MAX], word[NAME_MAX];
  const char *rest = 0;
  // first the labels: the line each one names
  uint32_t lines = 0, number = 0;
  const char *p = text;
  for (int got; (got = next_line(&p, line, sizeof line)) != 0;) {
    number++;
    if (got < 0) return fail(err, err_n, "line %u: longer than %zu characters", number, sizeof line - 1);
    const int kind = scan_line(line, label, word, &rest);
    if (kind == S_BAD) return fail(err, err_n, "line %u: not a line of a generator", number);
    if (kind == S_NONE || kind == S_CONST || kind == S_ORG) continue;
    if (lines == GEN_LINES) return fail(err, err_n, "line %u: more than %d lines", number, GEN_LINES);
    if (label[0]) {
      if (reserved(label)) return fail(err, err_n, "line %u: '%s' cannot be a label", number, label);
      if (label_line(&lab, label) != NONE) return fail(err, err_n, "line %u: the label '%s' again", number, label);
      memcpy(lab.name[lab.n], label, NAME_MAX);
      lab.line[lab.n++] = lines;
    }
    lines++;
  }
  if (!lines) return fail(err, err_n, "no lines");
  memset(x, 0, sizeof *x);
  x->n = lines;
  lines = number = 0;
  p = text;
  int org = 0;
  uint32_t depth = 0;
  while (next_line(&p, line, sizeof line) > 0) {
    number++;
    const int kind = scan_line(line, label, word, &rest);
    if (kind == S_NONE) continue;
    if (kind == S_ORG) {
      const char *q = rest;
      char name[NAME_MAX];
      const uint32_t at = read_name(&q, name) ? label_line(&lab, name) : NONE;
      skip_space(&q);
      if (at == NONE || *q) return fail(err, err_n, "line %u: org needs one label that exists", number);
      if (org++) return fail(err, err_n, "line %u: a second org", number);
      x->start = at;
      continue;
    }
    if (kind == S_CONST) {
      const int k = const_of(word);
      reader r = {rest + 1, &lab, core, 0, 0};
      skip_space(&r.p);
      const int negative = *r.p == '-';
      if (negative) r.p++;
      uint32_t v = 0;
      const int bad = !is_digit(*r.p) || read_number(&r, negative, &v);
      skip_space(&r.p);
      if (k >= GEN_CONSTS || bad || *r.p) return fail(err, err_n, "line %u: a constant is c0 to c15 = a number", number);
      x->c[k] = v;
      continue;
    }
    if (kind == S_END && !depth) return fail(err, err_n, "line %u: an end without a block", number);
    if (kind == S_DEF && depth) return fail(err, err_n, "line %u: a def inside a block", number);
    depth += (kind == S_REPEAT || kind == S_DEF) - (kind == S_END);
    const char *what = read_line(kind, word, rest, &lab, core, &x->l[lines++]);
    if (what) return fail(err, err_n, "line %u: %s", number, what);
  }
  if (depth) return fail(err, err_n, "a block is not closed");
  if (!org) x->start = first_line(x, x->n);
  char why[128];
  if (gen_check(x, core, why, sizeof why)) return fail(err, err_n, "%s", why);
  return 0;
}
