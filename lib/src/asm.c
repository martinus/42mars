// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Redcode assembler and expression evaluator: the C port of js/assembler.js
// and js/expr.js, with the same results, pMARS quirks included
// (docs/redcode-semantics.md, sections 1 and 2). The functions follow the
// JS code one to one and keep its names, so that both can be read side by
// side.
//
// No libc and no global state. All memory comes from the caller: one block,
// used as a bump arena. When it is too small, m42_assemble() returns 0 and
// the caller tries again with a larger one (wasm/42mars.js starts with 1 MB
// and grows by 4).
//
// Source text is bytes. With `utf8` set, a byte sequence of one UTF-8
// character is one token and the message texts trim the Unicode spaces that
// JS's String.prototype.trim() trims; without it, every byte is a character
// (Latin-1, as the tools read warrior files), and the trim includes 0xA0.

typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
typedef int i32;
typedef long long i64;
typedef unsigned long long u64;
typedef unsigned long usize;

#ifdef __wasm__
#define EXPORT(name) __attribute__((export_name(#name)))
#else
#define EXPORT(name)
#endif

#define I64_MAX 0x7fffffffffffffffll

// ---------------------------------------------------------------- memory

typedef struct {
  u8 *top, *end;
  int oom; // an allocation failed: the result is thrown away
} Arena;

static void *aalloc(Arena *A, usize n) {
  u8 *p = (u8 *)(((usize)A->top + 7) & ~(usize)7);
  if (A->oom || p > A->end || n > (usize)(A->end - p)) {
    A->oom = 1;
    return 0;
  }
  A->top = p + n;
  return p;
}

static void *azalloc(Arena *A, usize n) {
  u8 *p = aalloc(A, n);
  if (p) __builtin_memset(p, 0, n);
  return p;
}

// Grows an array of `elem`-byte entries that holds `n` so that one more
// fits. Returns the (maybe moved) array or 0.
static void *grow(Arena *A, void *a, u32 n, u32 *cap, usize elem) {
  if (n < *cap) return a;
  u32 c = *cap ? *cap * 2 : 8;
  void *b = aalloc(A, (usize)c * elem);
  if (!b) return 0;
  if (n) __builtin_memcpy(b, a, (usize)n * elem);
  *cap = c;
  return b;
}

// ---------------------------------------------------------------- text

typedef struct {
  const u8 *p;
  u32 n;
} Str;

// no_builtin: clang would turn the loop into a call to strlen, which the
// wasm build (no libc) does not have.
__attribute__((no_builtin("strlen"))) static u32 cstrlen(const char *s) {
  u32 n = 0;
  while (s[n]) n++;
  return n;
}

static Str S(const char *s) { return (Str){(const u8 *)s, cstrlen(s)}; }
static Str slice(Str s, u32 a, u32 b) { return (Str){s.p + a, b - a}; }

static int str_eq(Str a, Str b) {
  if (a.n != b.n) return 0;
  for (u32 i = 0; i < a.n; i++) if (a.p[i] != b.p[i]) return 0;
  return 1;
}
static int str_eqc(Str a, const char *b) { return str_eq(a, S(b)); }

static int is_space(int c) { return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\v' || c == '\f'; }
static int is_digit(int c) { return c >= '0' && c <= '9'; }
static int is_letter(int c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'); }
static int is_ident_start(int c) { return is_letter(c) || c == '_'; }
static int is_ident_char(int c) { return is_ident_start(c) || is_digit(c); }
static int upper(int c) { return c >= 'a' && c <= 'z' ? c - 32 : c; }
static int lower(int c) { return c >= 'A' && c <= 'Z' ? c + 32 : c; }

// A growing byte string in the arena.
typedef struct {
  u8 *p;
  u32 n, cap;
} Buf;

static void put(Arena *A, Buf *b, Str s) {
  if (b->n + s.n > b->cap) {
    u32 c = b->cap ? b->cap : 32;
    while (c < b->n + s.n) c *= 2;
    u8 *q = aalloc(A, c);
    if (!q) return;
    if (b->n) __builtin_memcpy(q, b->p, b->n);
    b->p = q;
    b->cap = c;
  }
  if (s.n) __builtin_memcpy(b->p + b->n, s.p, s.n);
  b->n += s.n;
}
static void putc_(Arena *A, Buf *b, const char *s) { put(A, b, S(s)); }

// Decimal text of v.
static void put_i64(Arena *A, Buf *b, i64 v) {
  u8 d[24];
  u32 k = sizeof d;
  u64 u = v < 0 ? 0 - (u64)v : (u64)v;
  do { d[--k] = (u8)('0' + u % 10); u /= 10; } while (u);
  if (v < 0) d[--k] = '-';
  put(A, b, (Str){d + k, (u32)sizeof d - k});
}

static Str buf_str(const Buf *b) { return (Str){b->p, b->n}; }

// FOR counters print with at least two digits: 01, 02, ..., 10, 120.
static void put_counter(Arena *A, Buf *b, i64 v) {
  if (v >= 0 && v < 10) putc_(A, b, "0");
  put_i64(A, b, v);
}

// ---------------------------------------------------------------- evaluator

enum { EVAL_OK = 0, EVAL_OVERFLOW = 1, EVAL_BAD = -1, EVAL_DIV_ZERO = -2 };

// Operators, see js/expr.js.
enum { NONE = -1, IDENTITY, MUL, DIV, MOD, ADD, SUB, EQ, NE, LT, GT, LE, GE, AND, OR, BAD_OP };
static const int PREC[] = {0, 5, 5, 5, 4, 4, 3, 3, 3, 3, 3, 3, 2, 1, 0};

// More nested calls of ev_expression() and ev_operand() than this make a
// bad expression (semantics doc, section 4): V8 runs out of stack for the
// wasm build at about 7700 of them, and natively the limit bounds the stack.
#define MAX_EVAL_DEPTH 6000

typedef struct {
  i64 registers[26];
  const u8 *text;
  u32 len, pos;
  int status;
  int saved;
  u32 depth;
  int tooDeep;
} Evaluator;

static int ev_peek(const Evaluator *e, u32 offset) {
  u32 i = e->pos + offset;
  return e->pos < e->len && i < e->len ? e->text[i] : -1;
}

static void ev_skip_space(Evaluator *e) {
  while (e->pos < e->len && is_space(e->text[e->pos])) e->pos++;
}

static i64 ev_fail(Evaluator *e, int status) {
  e->status = status;
  return 0;
}

// High 64 bits of a 64 x 64-bit unsigned product, from 32-bit halves. The
// empty asm hides b1 from clang, which would recognize the idiom and call
// __multi3 from compiler-rt, which the wasm build does not link.
static u64 umulh(u64 a, u64 b) {
  u64 b1 = b >> 32;
  __asm__("" : "+r"(b1));
  const u64 a0 = (u32)a, a1 = a >> 32, b0 = (u32)b;
  const u64 p00 = a0 * b0, p01 = a0 * b1, p10 = a1 * b0, p11 = a1 * b1;
  const u64 mid = (p00 >> 32) + (u32)p01 + (u32)p10;
  return p11 + (p01 >> 32) + (p10 >> 32) + (mid >> 32);
}

// a * b with wraparound; returns 1 on overflow. Not __builtin_mul_overflow
// or a division check: in wasm32 both become a call to __multi3.
static int mul_overflow(i64 a, i64 b, i64 *r) {
  const u64 ua = a < 0 ? 0 - (u64)a : (u64)a, ub = b < 0 ? 0 - (u64)b : (u64)b;
  const u64 lo = ua * ub;
  *r = (i64)((u64)a * (u64)b);
  if (umulh(ua, ub)) return 1;
  // The magnitude fits below 2^63, or is 2^63 for a negative product.
  return (a < 0) != (b < 0) && a && b ? lo > (u64)I64_MAX + 1 : lo > (u64)I64_MAX;
}

static i64 ev_apply(Evaluator *e, int op, i64 a, i64 b) {
  i64 r;
  switch (op) {
    case IDENTITY: return b;
    case MUL: if (mul_overflow(a, b, &r) && e->status == EVAL_OK) e->status = EVAL_OVERFLOW; return r;
    case ADD: if (__builtin_add_overflow(a, b, &r) && e->status == EVAL_OK) e->status = EVAL_OVERFLOW; return r;
    case SUB: if (__builtin_sub_overflow(a, b, &r) && e->status == EVAL_OK) e->status = EVAL_OVERFLOW; return r;
    case DIV:
    case MOD:
      if (b == 0) return ev_fail(e, EVAL_DIV_ZERO);
      // -2^63 / -1 wraps to -2^63, its remainder is 0 (C would trap).
      if (b == -1) return op == DIV ? (i64)(0 - (u64)a) : 0;
      return op == DIV ? a / b : a % b;
    case EQ: return a == b;
    case NE: return a != b;
    case LT: return a < b;
    case GT: return a > b;
    case LE: return a <= b;
    case GE: return a >= b;
    case AND: return a != 0 && b != 0;
    case OR: return a != 0 || b != 0;
    default: return ev_fail(e, EVAL_BAD);
  }
}

static i64 ev_operand(Evaluator *e);

// Continues an expression whose left value is `acc` and whose pending
// operator is `op1`, with the pMARS quirks of js/expr.js: `saved` is one
// variable for all levels, and a handed-back `==` is dropped.
static i64 ev_expression(Evaluator *e, int minPrec, i64 acc, int op1) {
  if (e->tooDeep || e->depth >= MAX_EVAL_DEPTH) { e->tooDeep = 1; return 0; }
  e->depth++;
  e->saved = NONE;
  i64 result;
  const i64 v = ev_operand(e);
  ev_skip_space(e);
  if (e->pos >= e->len || ev_peek(e, 0) == ')') {
    result = ev_apply(e, op1, acc, v);
  } else {
    // Reads a binary operator. A character that is no operator gives BAD_OP
    // and is consumed.
    const int c = ev_peek(e, 0), c2 = ev_peek(e, 1);
    int op2 = BAD_OP, w = 1;
    switch (c) {
      case '*': op2 = MUL; break;
      case '/': op2 = DIV; break;
      case '%': op2 = MOD; break;
      case '+': op2 = ADD; break;
      case '-': op2 = SUB; break;
      case '<': if (c2 == '=') { op2 = LE; w = 2; } else op2 = LT; break;
      case '>': if (c2 == '=') { op2 = GE; w = 2; } else op2 = GT; break;
      case '=': if (c2 == '=') { op2 = EQ; w = 2; } break;
      case '!': if (c2 == '=') { op2 = NE; w = 2; } break;
      case '&': if (c2 == '&') { op2 = AND; w = 2; } break;
      case '|': if (c2 == '|') { op2 = OR; w = 2; } break;
      default: break;
    }
    e->pos += w;
    if (PREC[op1] >= PREC[op2]) {
      // op2 does not bind tighter: finish op1 first.
      if (PREC[op2] > minPrec) {
        result = ev_expression(e, minPrec, ev_apply(e, op1, acc, v), op2);
      } else {
        e->saved = op2;
        result = ev_apply(e, op1, acc, v);
      }
    } else {
      // op2 binds tighter: its part becomes the right operand of op1.
      const i64 right = ev_expression(e, PREC[op1], v, op2);
      result = ev_apply(e, op1, acc, right);
      const int saved = e->saved;
      if (saved != NONE && saved != EQ && PREC[saved] >= minPrec) result = ev_expression(e, minPrec, result, saved);
    }
  }
  e->depth--;
  return result;
}

// Operand: unary operators, a number, a register (or assignment) or a
// parenthesized expression.
static i64 ev_operand_(Evaluator *e);
static i64 ev_operand(Evaluator *e) {
  if (e->tooDeep || e->depth >= MAX_EVAL_DEPTH) { e->tooDeep = 1; return 0; }
  e->depth++;
  const i64 v = ev_operand_(e);
  e->depth--;
  return v;
}

static i64 ev_operand_(Evaluator *e) {
  ev_skip_space(e);
  const int c = ev_peek(e, 0);
  i64 v;
  if (c == '(') {
    e->pos++;
    v = ev_expression(e, -1, 0, IDENTITY);
    if (ev_peek(e, 0) != ')') ev_fail(e, EVAL_BAD);
    e->pos++;
    return v;
  }
  if (c == '-' || c == '!' || c == '+') {
    e->pos++;
    v = ev_operand(e);
    // Unary minus wraps without setting the overflow status.
    return c == '-' ? (i64)(0 - (u64)v) : c == '!' ? v == 0 : v;
  }
  if (c >= 0 && is_letter(c)) {
    const int reg = lower(c) - 'a';
    e->pos++;
    ev_skip_space(e);
    // `x=` (not `x==`) assigns a whole new expression to the register.
    if (ev_peek(e, 0) == '=' && ev_peek(e, 1) != '=') {
      e->pos++;
      v = ev_expression(e, -1, 0, IDENTITY);
      e->registers[reg] = v;
      return v;
    }
    return e->registers[reg];
  }
  if (c >= 0 && is_digit(c)) {
    // Up to 20 digits; larger values saturate at 2^63 - 1.
    const u32 start = e->pos;
    u64 n = 0;
    int big = 0;
    while (e->pos - start < 20 && e->pos < e->len && is_digit(e->text[e->pos])) {
      const u32 d = e->text[e->pos++] - '0';
      if (n > (~0ull - d) / 10) big = 1;
      n = n * 10 + d;
    }
    return big || n > (u64)I64_MAX ? I64_MAX : (i64)n;
  }
  return ev_fail(e, EVAL_BAD);
}

static int evaluate(Evaluator *e, Str text, i64 *value) {
  e->text = text.p;
  e->len = text.n;
  e->pos = 0;
  e->status = EVAL_OK;
  e->depth = 0;
  e->tooDeep = 0;
  i64 v = ev_expression(e, -1, 0, IDENTITY);
  if (e->pos < e->len) e->status = EVAL_BAD;
  if (e->tooDeep) { e->status = EVAL_BAD; v = 0; }
  *value = v;
  return e->status;
}

// ---------------------------------------------------------------- tables

static const char *const OPCODES[] = {
  "MOV", "ADD", "SUB", "MUL", "DIV", "MOD", "JMZ", "JMN", "DJN", "CMP", "SLT",
  "SPL", "DAT", "JMP", "SEQ", "SNE", "NOP", "LDP", "STP", "ORG", "END", "PIN",
};
enum { OP_MOV, OP_ADD, OP_SUB, OP_MUL, OP_DIV, OP_MOD, OP_JMZ, OP_JMN, OP_DJN, OP_CMP, OP_SLT,
       OP_SPL, OP_DAT, OP_JMP, OP_SEQ, OP_SNE, OP_NOP, OP_LDP, OP_STP, OP_ORG, OP_END, OP_PIN, OP_COUNT };
static const char *const MODIFIERS[] = {"A", "B", "AB", "BA", "F", "X", "I"};
enum { MOD_A, MOD_B, MOD_AB, MOD_BA, MOD_F, MOD_X, MOD_I };
static const char MODE_SYMBOLS[] = "#$@<>*{}";
#define MAX_LABELS 7
// FOR blocks nested deeper are an error (semantics doc, section 4). Each
// level takes about 540 bytes of the 64 KB stack of the wasm build, which
// holds 121 levels.
#define MAX_FOR_DEPTH 100
#define PMARS_VERSION 95

// s equals the uppercase `up` when uppercased (ASCII).
static int ieq(Str s, const char *up) {
  u32 i = 0;
  for (; i < s.n; i++) if (!up[i] || upper(s.p[i]) != (u8)up[i]) return 0;
  return !up[i];
}

// Index of an opcode or pseudo-op in OPCODES, any case, or -1.
static int opcode_of(Str name) {
  if (name.n != 3) return -1;
  for (int i = 0; i < OP_COUNT; i++) if (ieq(name, OPCODES[i])) return i;
  return -1;
}

// The ICWS'94 default modifier table.
static int default_modifier(int op, int aMode, int bMode) {
  const int aImm = aMode == 0, bImm = bMode == 0;
  switch (op) {
    case OP_DAT: case OP_NOP: return MOD_F;
    case OP_MOV: case OP_CMP: case OP_SEQ: case OP_SNE: return aImm ? MOD_AB : bImm ? MOD_B : MOD_I;
    case OP_ADD: case OP_SUB: case OP_MUL: case OP_DIV: case OP_MOD: return aImm ? MOD_AB : bImm ? MOD_B : MOD_F;
    case OP_SLT: case OP_LDP: case OP_STP: return aImm ? MOD_AB : MOD_B;
    default: return MOD_B;
  }
}

// ---------------------------------------------------------------- public layout

// The result, in the caller's memory. The layout is fixed for wasm32, where
// wasm/42mars.js reads it (offsets in the comments).
typedef struct {
  const u8 *p;
  u32 n;
} AsmText; // 8 bytes on wasm32

typedef struct {
  i32 line; // 0: not tied to a line
  AsmText text;
} AsmMsg; // 12 bytes

typedef struct {
  u8 op, mod, aMode, bMode;
  u32 aVal, bVal;
  i32 line;
} AsmIns; // 16 bytes

typedef struct {
  i32 ok;               // 0
  u32 start;            // 4
  i32 hasPin;           // 8
  u32 pad;              // 12
  i64 pin;              // 16
  u32 nIns;             // 24
  u32 nErrors;          // 28
  u32 nWarnings;        // 32
  u32 nExpanded;        // 36
  AsmIns *ins;          // 40
  AsmMsg *errors;       // 44
  AsmMsg *warnings;     // 48
  AsmText *expanded;    // 52
  AsmText name;         // 56
  AsmText author;       // 64
  AsmText date;         // 72
  AsmText version;      // 80
  AsmText strategy;     // 88
} AsmResult;            // 96

#ifdef __wasm__
_Static_assert(sizeof(AsmResult) == 96 && __builtin_offsetof(AsmResult, ins) == 40 &&
               __builtin_offsetof(AsmResult, name) == 56 && sizeof(AsmMsg) == 12 && sizeof(AsmIns) == 16,
               "wasm/42mars.js reads this layout");
#endif

typedef struct {
  i64 coreSize, maxProcesses, maxCycles, maxLength, minDistance, warriors, rounds;
  i64 pSpaceSize; // 0: coreSize / 16
  i64 readLimit;  // 0: coreSize
  i64 writeLimit; // 0: coreSize
  u32 utf8;
} AsmOptions;

// ---------------------------------------------------------------- state

// A set of EQU names, as a list: an expansion adds one name to the set of
// the text it came from. 0 is "no set" (source text), which JS writes as null.
typedef struct Active {
  Str name;
  const struct Active *next;
} Active;

static int active_has(const Active *a, Str name) {
  for (; a; a = a->next) if (str_eq(a->name, name)) return 1;
  return 0;
}

// A part of a line: text with the EQU names it was expanded from, or a SPACE
// marker that adds one space to the statement text.
typedef struct {
  Str text;
  const Active *active;
  u8 space;
} Part;

typedef struct {
  Part *parts;
  u32 n;
  i32 lineNo;
  u8 assert; // a ;assert line, the parts hold the expression
} Line;

typedef struct {
  Str text;
  i32 lineNo;
} BodyLine;

enum { DEF_EQU, DEF_LABEL, DEF_FOR };

typedef struct Def {
  struct Def *prev; // the definition this one hides
  u8 kind;
  i64 value;        // label and FOR counter
  BodyLine *body;   // EQU
  u32 nBody;
} Def;

typedef struct {
  Str name;
  Def *top; // the newest definition, 0 after the last was removed
} Sym;

typedef struct {
  Str text;
  i32 line;
  u8 pseudo;
} Statement;

typedef struct {
  Arena A;
  AsmOptions o;
  Evaluator ev;
  // messages
  AsmMsg *errors, *warnings;
  u32 nErrors, capErrors, nWarnings, capWarnings;
  // the scratch buffer of pMARS (see js/assembler.js, class Scratch)
  u8 *scratch;
  u32 scratchCap;
  // symbols: open addressing, a power of two
  Sym *syms;
  u32 symCap, symN;
  // pass 1
  Str pending[MAX_LABELS];
  u32 nPending;
  i64 ic;
  Statement *statements;
  u32 nStatements, capStatements;
  int stopped;
  int hasAssert;
  u32 forDepth;
  // pass 2
  i64 ic2;
  i64 start;
  int hasPin;
  i64 pin;
  AsmIns *ins;
  u32 nIns, capIns;
  // metadata
  Str name, author, date, version;
  Buf strategy;
  u32 nStrategy;
} Asm;

static int failed(const Asm *a) { return a->nErrors > 0; }

static void message(Asm *a, int isError, i32 line, Str text) {
  AsmMsg **list = isError ? &a->errors : &a->warnings;
  u32 *n = isError ? &a->nErrors : &a->nWarnings;
  u32 *cap = isError ? &a->capErrors : &a->capWarnings;
  AsmMsg *l = grow(&a->A, *list, *n, cap, sizeof(AsmMsg));
  if (!l) return;
  *list = l;
  l[(*n)++] = (AsmMsg){line, {text.p, text.n}};
}
static void error(Asm *a, i32 line, Str text) { message(a, 1, line, text); }
static void warning(Asm *a, i32 line, Str text) { message(a, 0, line, text); }

// Message text from up to three pieces around a quoted or plain value.
static Str msg3(Asm *a, const char *before, Str value, const char *after) {
  Buf b = {0};
  putc_(&a->A, &b, before);
  put(&a->A, &b, value);
  putc_(&a->A, &b, after);
  return buf_str(&b);
}

// Length of the UTF-8 sequence that starts at s[i] (1 for a byte that is not
// a lead byte, or without utf8).
static u32 char_len(const Asm *a, Str s, u32 i) {
  if (!a->o.utf8) return 1;
  const u8 c = s.p[i];
  u32 n = c >= 0xf0 ? 4 : c >= 0xe0 ? 3 : c >= 0xc0 ? 2 : 1;
  u32 k = 1;
  while (k < n && i + k < s.n && (s.p[i + k] & 0xc0) == 0x80) k++;
  return k;
}

// Length of the space that JS's trim() removes at s.p[i] (forward) or ending
// at s.p[i - 1] (backward), 0 for none.
static u32 js_space_at(const Asm *a, Str s, u32 i, int backward) {
  if (backward) { if (i == 0) return 0; } else if (i >= s.n) return 0;
  const u32 at = backward ? i - 1 : i;
  const u8 c = s.p[at];
  if (is_space(c) || c == ' ') return 1;
  if (!a->o.utf8) return c == 0xa0;
  // UTF-8: U+00A0, U+1680, U+2000..U+200A, U+2028, U+2029, U+202F, U+205F,
  // U+3000, U+FEFF.
  for (u32 len = 2; len <= 3; len++) {
    if (backward ? i < len : i + len > s.n) continue;
    const u8 *q = s.p + (backward ? i - len : i);
    u32 cp = len == 2 ? ((q[0] & 0x1fu) << 6 | (q[1] & 0x3fu)) : ((q[0] & 0x0fu) << 12 | (q[1] & 0x3fu) << 6 | (q[2] & 0x3fu));
    if ((len == 2 && (q[0] & 0xe0) != 0xc0) || (len == 3 && (q[0] & 0xf0) != 0xe0)) continue;
    int cont = 1;
    for (u32 k = 1; k < len; k++) cont &= (q[k] & 0xc0) == 0x80;
    if (!cont) continue;
    if (cp == 0xa0 || cp == 0x1680 || (cp >= 0x2000 && cp <= 0x200a) || cp == 0x2028 || cp == 0x2029 ||
        cp == 0x202f || cp == 0x205f || cp == 0x3000 || cp == 0xfeff) return len;
  }
  return 0;
}

// String.prototype.trim().
static Str js_trim(const Asm *a, Str s) {
  u32 b = 0, e = s.n, k;
  while (b < e && (k = js_space_at(a, s, b, 0))) b += k;
  while (e > b && (k = js_space_at(a, s, e, 1))) e -= k;
  return slice(s, b, e);
}

// ---- scratch buffer: bytes past the written end read as 0

static void scratch_write(Asm *a, Str text, u32 at, int terminate) {
  const u32 need = at + text.n + 1;
  if (need > a->scratchCap) {
    u32 c = a->scratchCap ? a->scratchCap : 256;
    while (c < need) c *= 2;
    u8 *q = azalloc(&a->A, c);
    if (!q) return;
    if (a->scratchCap) __builtin_memcpy(q, a->scratch, a->scratchCap);
    a->scratch = q;
    a->scratchCap = c;
  }
  if (text.n) __builtin_memcpy(a->scratch + at, text.p, text.n);
  if (terminate) a->scratch[at + text.n] = 0;
}

static Str scratch_string(const Asm *a) {
  u32 n = 0;
  while (n < a->scratchCap && a->scratch[n]) n++;
  return (Str){a->scratch, n};
}

// Writes s uppercased at the start of the scratch buffer, with a 0 byte.
static void scratch_write_upper(Asm *a, Str s) {
  scratch_write(a, s, 0, 1);
  if (s.n && a->scratchCap > s.n) for (u32 i = 0; i < s.n; i++) a->scratch[i] = (u8)upper(a->scratch[i]);
}

// ---- symbols

static u32 hash(Str s) {
  u32 h = 2166136261u;
  for (u32 i = 0; i < s.n; i++) h = (h ^ s.p[i]) * 16777619u;
  return h;
}

static Sym *sym_slot(Asm *a, Str name, int insert) {
  if (insert && (a->symN + 1) * 2 > a->symCap) {
    const u32 cap = a->symCap ? a->symCap * 2 : 64;
    Sym *t = azalloc(&a->A, (usize)cap * sizeof(Sym));
    if (!t) return 0;
    for (u32 i = 0; i < a->symCap; i++) {
      if (!a->syms[i].name.p) continue;
      u32 k = hash(a->syms[i].name) & (cap - 1);
      while (t[k].name.p) k = (k + 1) & (cap - 1);
      t[k] = a->syms[i];
    }
    a->syms = t;
    a->symCap = cap;
  }
  if (!a->symCap) return 0;
  u32 k = hash(name) & (a->symCap - 1);
  while (a->syms[k].name.p) {
    if (str_eq(a->syms[k].name, name)) return &a->syms[k];
    k = (k + 1) & (a->symCap - 1);
  }
  if (!insert) return 0;
  a->syms[k].name = name.p ? name : (Str){(const u8 *)"", 0};
  a->syms[k].top = 0;
  a->symN++;
  return &a->syms[k];
}

static Def *lookup(Asm *a, Str name) {
  Sym *s = sym_slot(a, name, 0);
  return s ? s->top : 0;
}

static void define(Asm *a, Str name, Def *d) {
  Sym *s = sym_slot(a, name, 1);
  if (!s || !d) return;
  d->prev = s->top;
  s->top = d;
}

static Def *new_def(Asm *a, int kind, i64 value) {
  Def *d = azalloc(&a->A, sizeof(Def));
  if (d) { d->kind = (u8)kind; d->value = value; }
  return d;
}

static void undefine(Asm *a, Str name) {
  Sym *s = sym_slot(a, name, 0);
  if (s && s->top) s->top = s->top->prev;
}

// ---------------------------------------------------------------- stage 1: reading lines

typedef struct {
  Line *lines;
  u32 n, cap;
} Lines;

static void push_line(Asm *a, Lines *ls, Str text, i32 lineNo, int assert) {
  Part *p = aalloc(&a->A, sizeof(Part));
  Line *l = grow(&a->A, ls->lines, ls->n, &ls->cap, sizeof(Line));
  if (!p || !l) return;
  *p = (Part){text, 0, 0};
  ls->lines = l;
  l[ls->n++] = (Line){p, 1, lineNo, (u8)assert};
}

static Str trim_start(Str s) {
  u32 b = 0;
  while (b < s.n && is_space(s.p[b])) b++;
  return slice(s, b, s.n);
}
static Str trim_end(Str s) {
  u32 e = s.n;
  while (e > 0 && is_space(s.p[e - 1])) e--;
  return slice(s, 0, e);
}

static int find_byte(Str s, u8 c) {
  for (u32 i = 0; i < s.n; i++) if (s.p[i] == c) return (int)i;
  return -1;
}

static void read_source(Asm *a, Str src, Lines *out) {
  // A physical line ends with LF. A final LF does not start another line.
  u32 count = 1;
  for (u32 i = 0; i < src.n; i++) count += src.p[i] == '\n';
  const u32 last = count - 1;
  u32 *starts = aalloc(&a->A, (usize)(count + 1) * sizeof(u32));
  if (!starts) return;
  u32 k = 0;
  starts[k++] = 0;
  for (u32 i = 0; i < src.n; i++) if (src.p[i] == '\n') starts[k++] = i + 1;
  starts[count] = src.n + 1; // a virtual LF after the end
  u32 physical = count;
  if (last > 0 && starts[last] == src.n) physical--; // the empty line after a final LF

  // Physical line i, with its LF unless it is the last one.
  #define RAW(i) slice(src, starts[i], (i) < last ? starts[(i) + 1] : src.n)

  Buf text = {0};
  int redcode = 0;
  u32 i = 0;
  while (i < physical && !a->A.oom) {
    const i32 lineNo = (i32)i + 1;
    // Reads physical line i into the scratch buffer at `at`, the way pMARS
    // does: the content is the text up to the first CR or LF, which becomes 0.
    text.n = 0;
    {
      const Str raw = RAW(i);
      u32 end = 0;
      while (end < raw.n && raw.p[end] != '\r' && raw.p[end] != '\n') end++;
      scratch_write(a, raw, 0, 1);
      scratch_write(a, (Str){0, 0}, end, 1);
      put(&a->A, &text, slice(raw, 0, end));
      i++;
    }
    // A trailing backslash joins the next physical line, unless the logical
    // line already contains a comment. The next line is read over the `\`.
    while (text.n && text.p[text.n - 1] == '\\' && find_byte(buf_str(&text), ';') < 0 && i < physical) {
      text.n--;
      const Str raw = RAW(i);
      u32 end = 0;
      while (end < raw.n && raw.p[end] != '\r' && raw.p[end] != '\n') end++;
      scratch_write(a, raw, text.n, 1);
      scratch_write(a, (Str){0, 0}, text.n + end, 1);
      put(&a->A, &text, slice(raw, 0, end));
      i++;
    }
    if (a->A.oom) return;
    // The line text must outlive `text`, which is reused.
    u8 *copy = aalloc(&a->A, text.n ? text.n : 1);
    if (!copy) return;
    if (text.n) __builtin_memcpy(copy, text.p, text.n);
    const Str body = trim_start((Str){copy, text.n});
    if (!body.n) continue;
    if (body.p[0] != ';') {
      const int semi = find_byte(body, ';');
      push_line(a, out, semi < 0 ? body : slice(body, 0, (u32)semi), lineNo, 0);
      continue;
    }

    // Comment line: ;[ \t\v\f]*word
    u32 p = 1;
    while (p < body.n && (body.p[p] == ' ' || body.p[p] == '\t' || body.p[p] == '\v' || body.p[p] == '\f')) p++;
    const int gap = p > 1;
    const u32 ws = p;
    if (p < body.n && is_ident_start(body.p[p])) {
      p++;
      while (p < body.n && is_ident_char(body.p[p])) p++;
    }
    const Str word = slice(body, ws, p);
    const Str rest = slice(body, p, body.n);
    #define WORD_IS(w) (word.n == sizeof(w) - 1 && ({ int eq_ = 1; for (u32 q_ = 0; q_ < word.n; q_++) eq_ &= lower(word.p[q_]) == (w)[q_]; eq_; }))
    if (WORD_IS("redcode") && !gap) {
      // The first ;redcode starts the warrior, the second one ends it and
      // stops reading the source.
      if (++redcode == 2) return;
      out->n = 0;
      continue;
    }
    // pMARS keeps trailing whitespace in the metadata values.
    const Str value = trim_start(rest);
    if (WORD_IS("name")) a->name = value.n ? value : S("Unknown");
    else if (WORD_IS("author")) a->author = value.n ? value : S("Anonymous");
    else if (WORD_IS("date")) a->date = value;
    else if (WORD_IS("version")) a->version = value;
    else if (WORD_IS("strategy")) {
      if (a->nStrategy++) putc_(&a->A, &a->strategy, "\n");
      put(&a->A, &a->strategy, trim_end(value));
    } else if (WORD_IS("assert")) {
      const int semi = find_byte(rest, ';');
      push_line(a, out, semi < 0 ? rest : slice(rest, 0, (u32)semi), lineNo, 1);
    }
    #undef WORD_IS
  }
  #undef RAW
  // At the end of the file, the failed read clears the first byte.
  scratch_write(a, (Str){0, 0}, 0, 1);
}

// ---------------------------------------------------------------- stage 2: pass 1

enum { T_END, T_SPACE, T_IDENT, T_NUM, T_CHAR };

typedef struct {
  int t;
  Str text; // the name of an identifier, with FOR counters joined
  const Active *active;
  int spaceAfter;
} Token;

typedef struct {
  Part *parts;
  u32 n, pi, pos;
  i32 lineNo;
  int quiet; // a look-ahead cursor leaves the scratch buffer and messages alone
} Cursor;

static Cursor cursor(const Line *l) { return (Cursor){l->parts, l->n, 0, 0, l->lineNo, 0}; }

static const Part *cur_part(const Cursor *c) { return c->pi < c->n ? &c->parts[c->pi] : 0; }

// Next character of the current part, -1 at its end.
static int peek_char(const Cursor *c) {
  const Part *p = cur_part(c);
  return p && !p->space && c->pos < p->text.n ? p->text.p[c->pos] : -1;
}

static Token identifier(Asm *a, Cursor *c, const Part *p) {
  const Str s = p->text;
  u32 start = c->pos;
  while (c->pos < s.n && is_ident_char(s.p[c->pos])) c->pos++;
  Str name = slice(s, start, c->pos);
  if (!c->quiet) scratch_write_upper(a, name);
  Buf joined = {0};
  int isJoined = 0, fail = 0;
  while (c->pos + 1 < s.n && s.p[c->pos] == '&' && is_letter(s.p[c->pos + 1])) {
    start = ++c->pos;
    while (c->pos < s.n && is_ident_char(s.p[c->pos])) c->pos++;
    if (fail) continue;
    const Str counter = slice(s, start, c->pos);
    if (!c->quiet) scratch_write(a, counter, 0, 1);
    const Def *d = lookup(a, counter);
    if (!d || d->kind != DEF_FOR) {
      if (!c->quiet) error(a, c->lineNo, msg3(a, "'", counter, "' after '&' is not a FOR counter"));
      fail = 1;
      continue;
    }
    Buf num = {0};
    put_counter(&a->A, &num, d->value);
    if (!c->quiet) scratch_write(a, buf_str(&num), 0, 1);
    if (!isJoined) { put(&a->A, &joined, name); isJoined = 1; }
    put(&a->A, &joined, buf_str(&num));
  }
  if (isJoined) name = buf_str(&joined);
  return (Token){T_IDENT, name, p->active, c->pos < s.n && is_space(s.p[c->pos])};
}

static Token next_token(Asm *a, Cursor *c) {
  for (;;) {
    const Part *p = cur_part(c);
    if (!p) return (Token){T_END, {0, 0}, 0, 0};
    if (p->space) { c->pi++; c->pos = 0; return (Token){T_SPACE, {0, 0}, 0, 0}; }
    const Str s = p->text;
    if (c->pos >= s.n) { c->pi++; c->pos = 0; continue; }
    const int ch = s.p[c->pos];
    if (is_space(ch)) { c->pos++; continue; }
    if (is_ident_start(ch)) return identifier(a, c, p);
    const u32 start = c->pos;
    if (is_digit(ch)) {
      c->pos++;
      while (c->pos < s.n && is_digit(s.p[c->pos])) c->pos++;
      return (Token){T_NUM, slice(s, start, c->pos), 0, 0};
    }
    c->pos += char_len(a, s, c->pos);
    if ((ch == '&' || ch == '|') && c->pos < s.n && s.p[c->pos] == ch) c->pos++;
    return (Token){T_CHAR, slice(s, start, c->pos), 0, 0};
  }
}

// Non-whitespace characters glued to the current position.
static Str read_glued(Cursor *c) {
  const Part *p = cur_part(c);
  if (!p || p->space) return (Str){0, 0};
  const u32 start = c->pos;
  while (c->pos < p->text.n && !is_space(p->text.p[c->pos])) c->pos++;
  return slice(p->text, start, c->pos);
}

// The raw rest of the line, consumed.
static Str rest_raw(Asm *a, Cursor *c) {
  Buf b = {0};
  for (; c->pi < c->n; c->pi++, c->pos = 0) {
    const Part *p = &c->parts[c->pi];
    if (p->space) putc_(&a->A, &b, " ");
    else if (c->pos < p->text.n) put(&a->A, &b, slice(p->text, c->pos, p->text.n));
  }
  return buf_str(&b);
}

typedef struct {
  Part *parts;
  u32 n;
} Parts;

// The parts after the current position, consumed.
static Parts take_rest(Asm *a, Cursor *c) {
  const Part *p = cur_part(c);
  const u32 more = c->pi < c->n ? c->n - c->pi - 1 : 0;
  Parts r = {0, 0};
  r.parts = aalloc(&a->A, (usize)(1 + more) * sizeof(Part));
  if (r.parts) {
    if (p) r.parts[r.n++] = p->space ? *p : (Part){slice(p->text, c->pos < p->text.n ? c->pos : p->text.n, p->text.n), p->active, 0};
    for (u32 i = 0; i < more; i++) r.parts[r.n++] = c->parts[c->pi + 1 + i];
  }
  c->parts = 0;
  c->n = c->pi = c->pos = 0;
  return r;
}

static Parts concat(Asm *a, const Part *x, u32 nx, const Part *y, u32 ny) {
  Parts r = {aalloc(&a->A, (usize)(nx + ny + 1) * sizeof(Part)), nx + ny};
  if (!r.parts) return (Parts){0, 0};
  for (u32 i = 0; i < nx; i++) r.parts[i] = x[i];
  for (u32 i = 0; i < ny; i++) r.parts[nx + i] = y[i];
  return r;
}

// Continues reading with `parts` before the rest of the line.
static void cur_insert(Asm *a, Cursor *c, const Part *parts, u32 n) {
  const Parts rest = take_rest(a, c);
  const Parts all = concat(a, parts, n, rest.parts, rest.n);
  c->parts = all.parts;
  c->n = all.n;
}

// ---- the stream of lines for pass 1

typedef struct Front {
  const Line *line;
  struct Front *next;
} Front;

typedef struct {
  const Line *lines;
  u32 n, i;
  Front *front;
} Stream;

static const Line *stream_next(Stream *s) {
  if (s->front) { const Line *l = s->front->line; s->front = s->front->next; return l; }
  return s->i < s->n ? &s->lines[s->i++] : 0;
}

static const Line *stream_peek(const Stream *s) {
  if (s->front) return s->front->line;
  return s->i < s->n ? &s->lines[s->i] : 0;
}

static void stream_unshift(Asm *a, Stream *s, const Line *lines, u32 n) {
  Front *head = s->front;
  for (u32 k = n; k-- > 0;) {
    Front *f = aalloc(&a->A, sizeof(Front));
    if (!f) return;
    *f = (Front){&lines[k], head};
    head = f;
  }
  s->front = head;
}

// Skip scan for the ROF that matches a FOR: +1 for a line that opens a FOR
// block, -1 for a ROF line, 0 otherwise. Labels at the start are passed
// over; the first keyword or other token decides. With `store` (a block that
// is skipped), the identifiers read go into the scratch buffer.
static int block_delta(Asm *a, const Line *line, int store) {
  if (line->assert) return 0;
  Buf b = {0};
  for (u32 i = 0; i < line->n; i++) {
    if (line->parts[i].space) putc_(&a->A, &b, " ");
    else put(&a->A, &b, line->parts[i].text);
  }
  const Str t = buf_str(&b);
  u32 pos = 0;
  for (;;) {
    while (pos < t.n && is_space(t.p[pos])) pos++;
    if (pos >= t.n || !is_ident_start(t.p[pos])) return 0;
    const u32 start = pos;
    while (pos < t.n && is_ident_char(t.p[pos])) pos++;
    const Str first = slice(t, start, pos);
    if (store) scratch_write_upper(a, first);
    while (pos + 1 < t.n && t.p[pos] == '&' && is_letter(t.p[pos + 1])) {
      const u32 cs = ++pos;
      while (pos < t.n && is_ident_char(t.p[pos])) pos++;
      if (!store) continue;
      const Str counter = slice(t, cs, pos);
      scratch_write(a, counter, 0, 1);
      const Def *d = lookup(a, counter);
      if (d && d->kind == DEF_FOR) {
        Buf num = {0};
        put_counter(&a->A, &num, d->value);
        scratch_write(a, buf_str(&num), 0, 1);
      }
    }
    const Str whole = slice(t, start, pos);
    if (ieq(whole, "FOR")) return 1;
    if (ieq(whole, "ROF")) return -1;
    if (opcode_of(whole) >= 0 || ieq(whole, "EQU") || str_eqc(whole, "CURLINE")) return 0;
  }
}

static void process_lines(Asm *a, Stream *s);

// Substitutes an EQU body at the cursor. A multi-line body ends the current
// line after its first line; the other lines follow as lines of their own,
// the last one continued by the rest of the use-site line.
static int expand(Asm *a, Cursor *c, const Token *tok, const Def *d, Stream *s) {
  if (active_has(tok->active, tok->text)) {
    error(a, c->lineNo, msg3(a, "recursive EQU '", tok->text, "'"));
    return 0;
  }
  Active *act = aalloc(&a->A, sizeof(Active));
  if (!act) return 0;
  *act = (Active){tok->text, tok->active};
  const Part space = {{0, 0}, 0, 1};
  const u32 ns = tok->spaceAfter ? 1 : 0;
  if (d->nBody == 1) {
    const Part parts[2] = {{d->body[0].text, act, 0}, space};
    cur_insert(a, c, parts, 1 + ns);
    return 1;
  }
  const i32 useSite = c->lineNo;
  const Parts rest = take_rest(a, c);
  Part *first = aalloc(&a->A, sizeof(Part));
  Line *more = aalloc(&a->A, (usize)(d->nBody - 1) * sizeof(Line));
  if (!first || !more) return 0;
  *first = (Part){d->body[0].text, act, 0};
  c->parts = first;
  c->n = 1;
  c->pi = c->pos = 0;
  c->lineNo = d->body[0].lineNo;
  for (u32 i = 1; i + 1 < d->nBody; i++) {
    Part *p = aalloc(&a->A, sizeof(Part));
    if (!p) return 0;
    *p = (Part){d->body[i].text, act, 0};
    more[i - 1] = (Line){p, 1, d->body[i].lineNo, 0};
  }
  const Part head[2] = {{d->body[d->nBody - 1].text, act, 0}, space};
  const Parts lastParts = concat(a, head, 1 + ns, rest.parts, rest.n);
  if (!lastParts.parts) return 0;
  more[d->nBody - 2] = (Line){lastParts.parts, lastParts.n, useSite, 0};
  stream_unshift(a, s, more, d->nBody - 1);
  return 1;
}

// Builds the operand text after an opcode, FOR or in an assert. Labels
// become numbers relative to the instruction counter (absolute for ORG, END
// and PIN), FOR counters their iteration number, EQU names their body.
// Returns 0 after an error.
static int operand_text(Asm *a, Cursor *c, Stream *s, int absolute, Str *out) {
  Buf b = {0};
  for (;;) {
    if (a->A.oom) return 0;
    const Token tok = next_token(a, c);
    if (tok.t == T_END) { *out = buf_str(&b); return 1; }
    if (tok.t == T_SPACE) { putc_(&a->A, &b, " "); continue; }
    if (tok.t != T_IDENT) { put(&a->A, &b, tok.text); continue; }
    const char *kw = ieq(tok.text, "FOR") ? "FOR" : ieq(tok.text, "ROF") ? "ROF" : ieq(tok.text, "EQU") ? "EQU" : 0;
    if (kw) {
      error(a, c->lineNo, msg3(a, kw, (Str){0, 0}, " not allowed here"));
      return 0;
    }
    const Def *d = lookup(a, tok.text);
    Buf num = {0};
    int isNumber = 1;
    if (str_eqc(tok.text, "CURLINE")) put_i64(&a->A, &num, a->ic);
    else if (d && d->kind == DEF_EQU) {
      if (!expand(a, c, &tok, d, s)) return 0;
      continue;
    } else if (d && d->kind == DEF_LABEL) put_i64(&a->A, &num, absolute ? d->value : d->value - a->ic);
    else if (d && d->kind == DEF_FOR) put_counter(&a->A, &num, d->value);
    else isNumber = 0;
    if (tok.spaceAfter) putc_(&a->A, &num, " ");
    if (!isNumber) {
      // a forward reference or register, resolved in pass 2
      put(&a->A, &b, tok.text);
      if (tok.spaceAfter) putc_(&a->A, &b, " ");
    } else {
      // The replacement text goes through the scratch buffer too.
      scratch_write(a, buf_str(&num), 0, 1);
      put(&a->A, &b, buf_str(&num));
    }
  }
}

static void define_pending_labels(Asm *a) {
  for (u32 i = 0; i < a->nPending; i++) define(a, a->pending[i], new_def(a, DEF_LABEL, a->ic));
  a->nPending = 0;
}

static void opcode_line(Asm *a, Cursor *c, Str name, int op, Stream *s) {
  const int pseudo = op >= OP_ORG;
  // Characters glued to the opcode are stored right behind it in the scratch
  // buffer, followed by a space and a 0 byte if whitespace follows, else by
  // nothing; the opcode text is read back up to the first 0 byte.
  const Str glued = read_glued(c);
  scratch_write(a, glued, name.n, 0);
  const int ch = peek_char(c);
  if (ch >= 0 && is_space(ch)) scratch_write(a, S(" "), name.n + glued.n, 1);
  Buf text = {0};
  put(&a->A, &text, scratch_string(a));
  Str operands;
  if (!operand_text(a, c, s, pseudo, &operands)) return;
  define_pending_labels(a);
  put(&a->A, &text, operands);
  Statement *st = grow(&a->A, a->statements, a->nStatements, &a->capStatements, sizeof(Statement));
  if (!st) return;
  a->statements = st;
  st[a->nStatements++] = (Statement){buf_str(&text), c->lineNo, (u8)pseudo};
  if (!pseudo) a->ic++;
  if (op == OP_END) a->stopped = 1;
}

static void equ_line(Asm *a, Cursor *c, Stream *s) {
  if (!a->nPending) {
    warning(a, c->lineNo, S("EQU without label, line ignored"));
    return;
  }
  BodyLine *body = 0;
  u32 n = 0, cap = 0;
  body = grow(&a->A, body, n, &cap, sizeof(BodyLine));
  if (!body) return;
  body[n++] = (BodyLine){rest_raw(a, c), c->lineNo};
  // Directly following `EQU text` lines add more body lines.
  for (const Line *next = stream_peek(s); next && !next->assert; next = stream_peek(s)) {
    Cursor q = cursor(next);
    q.quiet = 1;
    const Token tok = next_token(a, &q);
    if (tok.t != T_IDENT || !ieq(tok.text, "EQU")) break;
    stream_next(s);
    body = grow(&a->A, body, n, &cap, sizeof(BodyLine));
    if (!body) return;
    body[n++] = (BodyLine){rest_raw(a, &q), next->lineNo};
  }
  for (u32 i = 0; i < a->nPending; i++) {
    Def *d = new_def(a, DEF_EQU, 0);
    if (!d) return;
    d->body = body;
    d->nBody = n;
    define(a, a->pending[i], d);
  }
  a->nPending = 0;
}

static void for_line(Asm *a, Cursor *c, Stream *s) {
  // The label written directly before FOR names the counter.
  Str counter = {0, 0};
  const int hasCounter = a->nPending > 0;
  if (hasCounter) counter = a->pending[--a->nPending];
  define_pending_labels(a);

  Str text;
  if (!operand_text(a, c, s, 0, &text)) return;
  i64 value;
  const int status = evaluate(&a->ev, text, &value);
  if (status < 0) {
    error(a, c->lineNo, msg3(a, "bad FOR count '", js_trim(a, text), "'"));
    return;
  }

  // Collect the block up to the matching ROF.
  i64 times = value > 0 ? value % 65536 : 0;
  Line *body = 0;
  u32 n = 0, cap = 0;
  int found = 0;
  i32 depth = 1;
  for (const Line *line = stream_next(s); line; line = stream_next(s)) {
    depth += block_delta(a, line, times == 0);
    if (depth == 0) { found = 1; break; }
    body = grow(&a->A, body, n, &cap, sizeof(Line));
    if (!body) return;
    body[n++] = *line;
  }
  if (!found) {
    warning(a, c->lineNo, S("FOR without matching ROF"));
    if (times > 1) times = 1;
  }
  if (times > 0 && ++a->forDepth > MAX_FOR_DEPTH) {
    error(a, c->lineNo, S("FOR blocks nested too deep"));
    a->stopped = 1;
    return;
  }
  for (i64 k = 1; k <= times && !a->stopped && !a->A.oom; k++) {
    if (hasCounter) define(a, counter, new_def(a, DEF_FOR, k));
    Stream inner = {body, n, 0, 0};
    process_lines(a, &inner);
    if (hasCounter) undefine(a, counter);
  }
  if (times > 0) a->forDepth--;
  if (!found) a->stopped = 1;
}

// Label position: labels, then an opcode, EQU, FOR, ROF or an EQU name.
static void statement_line(Asm *a, const Line *line, Stream *s) {
  Cursor c = cursor(line);
  for (;;) {
    if (a->A.oom) return;
    const Token tok = next_token(a, &c);
    if (tok.t == T_END) return; // only labels: they stay pending
    if (tok.t == T_SPACE) continue;
    if (tok.t != T_IDENT) {
      error(a, c.lineNo, msg3(a, "unexpected '", tok.text, "'"));
      // An error inside an EQU body abandons only the body; the rest of the
      // use-site line is still read.
      const Part *p = cur_part(&c);
      if (!p || p->space || !p->active) return;
      c.pos = p->text.n;
      continue;
    }

    const int op = opcode_of(tok.text);
    if (op >= 0) { opcode_line(a, &c, tok.text, op, s); return; }
    if (ieq(tok.text, "EQU")) { equ_line(a, &c, s); return; }
    if (ieq(tok.text, "FOR")) { for_line(a, &c, s); return; }
    if (ieq(tok.text, "ROF")) { error(a, c.lineNo, S("ROF without FOR")); return; }
    if (str_eqc(tok.text, "CURLINE")) { error(a, c.lineNo, S("CURLINE cannot be a label")); return; }

    const Def *d = lookup(a, tok.text);
    if (d && d->kind == DEF_EQU) {
      if (!expand(a, &c, &tok, d, s)) return;
      continue;
    }
    if (d) {
      // pMARS drops the whole line of a redefined label.
      warning(a, c.lineNo, msg3(a, "label '", tok.text, "' redefined, line ignored"));
      return;
    }
    if (a->nPending >= MAX_LABELS) error(a, c.lineNo, msg3(a, "too many labels at '", tok.text, "'"));
    else a->pending[a->nPending++] = tok.text;
    if (peek_char(&c) == ':') c.pos++;
  }
}

static void assert_line(Asm *a, const Line *line, Stream *s) {
  Cursor c = cursor(line);
  Str text;
  if (!operand_text(a, &c, s, 0, &text)) return;
  i64 value;
  const int status = evaluate(&a->ev, text, &value);
  if (status < 0) {
    warning(a, line->lineNo, msg3(a, "invalid assert '", js_trim(a, text), "'"));
    return;
  }
  a->hasAssert = 1;
  if (value == 0) error(a, line->lineNo, msg3(a, "assertion failed: ", js_trim(a, text), ""));
  else if (status == EVAL_OVERFLOW) warning(a, line->lineNo, S("overflow in assert"));
}

static void process_lines(Asm *a, Stream *s) {
  while (!a->stopped && !a->A.oom) {
    const Line *line = stream_next(s);
    if (!line) return;
    if (line->assert) assert_line(a, line, s);
    else statement_line(a, line, s);
  }
}

// ---------------------------------------------------------------- stage 3: pass 2

enum { S_END, S_IDENT, S_NUM, S_CHAR, S_ERROR };

typedef struct {
  int t;
  Str text;
  int space; // whitespace came before the token
  const Def *def;
} STok;

typedef struct {
  Str text;
  u32 pos;
  const Active *active;
} Frame;

// Tokens of a statement text. Identifiers that are EQU names (defined after
// their use, so pass 1 left them) are replaced by the first body line.
typedef struct {
  Frame *stack;
  u32 n, cap;
  STok peeked;
  int hasPeeked;
  int raw; // reading the opcode and modifier: no EQU expansion
} STokens;

static STok st_read(Asm *a, STokens *ts) {
  int space = 0;
  for (;;) {
    if (!ts->n) return (STok){S_END, {(const u8 *)"", 0}, space, 0};
    Frame *top = &ts->stack[ts->n - 1];
    const Str s = top->text;
    if (top->pos >= s.n) { ts->n--; continue; }
    const int c = s.p[top->pos];
    if (is_space(c)) { top->pos++; space = 1; continue; }
    const u32 start = top->pos;
    if (is_ident_start(c)) {
      top->pos++;
      while (top->pos < s.n && is_ident_char(s.p[top->pos])) top->pos++;
      const Str name = slice(s, start, top->pos);
      const Def *d = lookup(a, name);
      if (d && d->kind == DEF_EQU && !ts->raw) {
        if (active_has(top->active, name)) return (STok){S_ERROR, msg3(a, "recursive EQU '", name, "'"), space, 0};
        Active *act = aalloc(&a->A, sizeof(Active));
        Frame *st = grow(&a->A, ts->stack, ts->n, &ts->cap, sizeof(Frame));
        if (!act || !st) return (STok){S_END, {(const u8 *)"", 0}, space, 0};
        *act = (Active){name, top->active};
        ts->stack = st;
        st[ts->n++] = (Frame){d->body[0].text, 0, act};
        // Like a label value, the body stays apart from the text before it.
        space = 1;
        continue;
      }
      return (STok){S_IDENT, name, space, d};
    }
    if (is_digit(c)) {
      top->pos++;
      while (top->pos < s.n && is_digit(s.p[top->pos])) top->pos++;
      return (STok){S_NUM, slice(s, start, top->pos), space, 0};
    }
    top->pos += char_len(a, s, top->pos);
    if ((c == '&' || c == '|') && top->pos < s.n && s.p[top->pos] == c) top->pos++;
    return (STok){S_CHAR, slice(s, start, top->pos), space, 0};
  }
}

static STok st_peek(Asm *a, STokens *ts) {
  if (!ts->hasPeeked) { ts->peeked = st_read(a, ts); ts->hasPeeked = 1; }
  return ts->peeked;
}

static STok st_next(Asm *a, STokens *ts) {
  const STok t = st_peek(a, ts);
  ts->hasPeeked = 0;
  return t;
}

static int is_char(STok t, char c) { return t.text.n == 1 && t.text.p[0] == (u8)c; }

// Expression text up to ',' (A operand) or the end. Labels become numbers.
// Returns 0 after an error.
static int st_expression(Asm *a, STokens *ts, int absolute, i32 line, int stopAtComma, Str *out) {
  Buf b = {0};
  for (;;) {
    const STok t = st_peek(a, ts);
    if (t.t == S_END) { *out = buf_str(&b); return 1; }
    if (is_char(t, ',')) {
      if (stopAtComma) { *out = buf_str(&b); return 1; }
      error(a, line, S("too many operands"));
      return 0;
    }
    st_next(a, ts);
    if (t.t == S_ERROR) { error(a, line, t.text); return 0; }
    if (b.n && t.space) putc_(&a->A, &b, " ");
    if (t.t == S_CHAR && t.text.n == 1 && find_byte(S("#$@{}."), t.text.p[0]) >= 0) {
      error(a, line, msg3(a, "unexpected '", t.text, "' in expression"));
      return 0;
    }
    if (t.t != S_IDENT) { put(&a->A, &b, t.text); continue; }
    if (t.def && t.def->kind == DEF_LABEL) {
      // pMARS keeps a label value apart from the text before it: `2x` with
      // x = 1 is the bad expression `2 1`, not 21.
      if (b.n && !t.space) putc_(&a->A, &b, " ");
      put_i64(&a->A, &b, absolute ? t.def->value : t.def->value - a->ic2);
    } else if (!t.def && t.text.n == 1) {
      put(&a->A, &b, t.text); // register
    } else {
      error(a, line, msg3(a, "undefined symbol '", t.text, "'"));
      return 0;
    }
  }
}

// Evaluates an expression; returns 0 after an error.
static int st_evaluate(Asm *a, Str text, i32 line, i64 *value) {
  const int status = evaluate(&a->ev, text, value);
  if (status < 0) {
    error(a, line, status == EVAL_DIV_ZERO ? msg3(a, "division by zero in '", text, "'") : msg3(a, "bad expression '", text, "'"));
    return 0;
  }
  if (status == EVAL_OVERFLOW) warning(a, line, msg3(a, "overflow in '", text, "'"));
  return 1;
}

static u32 normalize(const Asm *a, i64 v) {
  const i64 r = v % a->o.coreSize;
  return (u32)(r < 0 ? r + a->o.coreSize : r);
}

typedef struct {
  int mode;
  int hasExpr;
  Str expr;
} Operand;

// Parses one operand: [mode] expression. Returns 0 after an error.
static int st_operand(Asm *a, STokens *ts, int isA, i32 line, Operand *out) {
  STok t = st_peek(a, ts);
  if (t.t == S_END || is_char(t, ',')) {
    error(a, line, t.t == S_END ? S("missing operand") : S("unexpected ','"));
    return 0;
  }
  int mode = 1; // $
  if (t.t == S_CHAR && t.text.n == 1 && t.text.p[0] && find_byte(S(MODE_SYMBOLS), t.text.p[0]) >= 0) {
    st_next(a, ts);
    mode = find_byte(S(MODE_SYMBOLS), t.text.p[0]);
    t = st_peek(a, ts);
    if (t.t == S_END) { error(a, line, S("missing expression after mode")); return 0; }
    if (is_char(t, ',')) {
      if (isA) { *out = (Operand){mode, 0, {0, 0}}; return 1; }
      error(a, line, S("unexpected ','"));
      return 0;
    }
  }
  Str e;
  if (!st_expression(a, ts, 0, line, isA, &e)) return 0;
  *out = (Operand){mode, 1, e};
  return 1;
}

static void st_finish(Asm *a, int op, int mod, Operand A, Operand B, i32 line) {
  if (failed(a)) return;
  i64 aVal = 0, bVal = 0;
  if (A.hasExpr && !st_evaluate(a, A.expr, line, &aVal)) return;
  if (B.hasExpr && !st_evaluate(a, B.expr, line, &bVal)) return;
  AsmIns *l = grow(&a->A, a->ins, a->nIns, &a->capIns, sizeof(AsmIns));
  if (!l) return;
  a->ins = l;
  l[a->nIns++] = (AsmIns){(u8)op, (u8)(mod >= 0 ? mod : default_modifier(op, A.mode, B.mode)), (u8)A.mode,
                          (u8)B.mode, normalize(a, aVal), normalize(a, bVal), line};
}

static void st_instruction(Asm *a, STokens *ts, int op, int mod, i32 line) {
  Operand A, B;
  if (!st_operand(a, ts, 1, line, &A)) return;
  if (is_char(st_peek(a, ts), ',')) {
    st_next(a, ts);
    if (!st_operand(a, ts, 0, line, &B)) return;
  } else if (op == OP_DAT) {
    // A single DAT operand is the B operand, A becomes #0.
    B = A;
    A = (Operand){0, 0, {0, 0}};
  } else if (op == OP_JMP || op == OP_SPL || op == OP_NOP) {
    B = (Operand){1, 0, {0, 0}};
  } else {
    error(a, line, S("missing operand"));
    return;
  }
  st_finish(a, op, mod, A, B, line);
}

static void parse_statement(Asm *a, const Statement *stmt) {
  const i32 line = stmt->line;
  Frame first = {stmt->text, 0, 0};
  STokens ts = {0};
  ts.stack = grow(&a->A, 0, 0, &ts.cap, sizeof(Frame));
  if (!ts.stack) return;
  ts.stack[ts.n++] = first;
  ts.raw = 1;
  const int op = opcode_of(st_next(a, &ts).text);
  ts.raw = 0;
  int mod = -2; // none given
  if (is_char(st_peek(a, &ts), '.')) {
    st_next(a, &ts);
    ts.raw = 1;
    const STok m = st_next(a, &ts);
    ts.raw = 0;
    mod = -1;
    if (m.t == S_IDENT) for (int i = 0; i < 7; i++) if (ieq(m.text, MODIFIERS[i])) mod = i;
    if (mod < 0) { error(a, line, msg3(a, "bad modifier '", m.text, "'")); return; }
  }

  if (op >= OP_ORG) {
    if (mod != -2) { error(a, line, msg3(a, OPCODES[op], (Str){0, 0}, " takes no modifier")); return; }
    if (op != OP_END && st_peek(a, &ts).t == S_END) { error(a, line, msg3(a, OPCODES[op], (Str){0, 0}, " needs an operand")); return; }
    Str e;
    if (!st_expression(a, &ts, 1, line, 0, &e) || failed(a) || !e.n) return;
    i64 v;
    if (!st_evaluate(a, e, line, &v)) return;
    if (op == OP_ORG) a->start = normalize(a, v);
    else if (op == OP_PIN) { a->hasPin = 1; a->pin = v; }
    else if (v != 0) {
      if (a->start != 0) warning(a, line, S("END start ignored, ORG already set it"));
      else a->start = normalize(a, v);
    }
    return;
  }

  st_instruction(a, &ts, op, mod == -2 ? -1 : mod, line);
  a->ic2++;
}

// ---------------------------------------------------------------- driver

static AsmText text_of(Str s) { return (AsmText){s.p, s.n}; }

// Assembles `len` bytes of `src` with the options `o` (0 fields get the
// defaults of js/assembler.js). `mem` is the working memory, `size` bytes;
// the result lives in it. Returns 0 when it is too small or the options are
// invalid (core size below 1).
static AsmResult *assemble(void *mem, usize size, const u8 *src, usize len, const AsmOptions *opts) {
  Arena A = {(u8 *)mem, (u8 *)mem + size, 0};
  Asm *a = azalloc(&A, sizeof(Asm));
  AsmResult *r = azalloc(&A, sizeof(AsmResult));
  if (!a || !r || opts->coreSize < 1 || len > 0xffffffffu) return 0;
  a->A = A;
  a->o = *opts;
  if (!a->o.pSpaceSize) a->o.pSpaceSize = a->o.coreSize / 16;
  if (!a->o.readLimit) a->o.readLimit = a->o.coreSize;
  if (!a->o.writeLimit) a->o.writeLimit = a->o.coreSize;
  a->name = S("Unknown");
  a->author = S("Anonymous");
  a->date = a->version = (Str){(const u8 *)"", 0};

  Lines lines = {0};
  read_source(a, (Str){src, (u32)len}, &lines);

  // pass 1
  const struct { const char *name; i64 value; } predefined[] = {
    {"CORESIZE", a->o.coreSize}, {"MAXPROCESSES", a->o.maxProcesses}, {"MAXCYCLES", a->o.maxCycles},
    {"MAXLENGTH", a->o.maxLength}, {"MINDISTANCE", a->o.minDistance}, {"VERSION", PMARS_VERSION},
    {"WARRIORS", a->o.warriors}, {"ROUNDS", a->o.rounds}, {"READLIMIT", a->o.readLimit},
    {"WRITELIMIT", a->o.writeLimit}, {"PSPACESIZE", a->o.pSpaceSize},
  };
  for (u32 i = 0; i < sizeof predefined / sizeof predefined[0]; i++) {
    Buf v = {0};
    put_i64(&a->A, &v, predefined[i].value);
    BodyLine *b = aalloc(&a->A, sizeof(BodyLine));
    Def *d = new_def(a, DEF_EQU, 0);
    if (!b || !d) return 0;
    *b = (BodyLine){buf_str(&v), 0};
    d->body = b;
    d->nBody = 1;
    define(a, S(predefined[i].name), d);
  }
  Stream s = {lines.lines, lines.n, 0, 0};
  process_lines(a, &s);
  if (a->nPending) {
    Buf b = {0};
    putc_(&a->A, &b, "labels discarded: ");
    for (u32 i = 0; i < a->nPending; i++) {
      if (i) putc_(&a->A, &b, ", ");
      put(&a->A, &b, a->pending[i]);
    }
    warning(a, 0, buf_str(&b));
  }
  if (!a->hasAssert) warning(a, 0, S("missing ;assert"));

  // pass 2. pMARS accepts a warrior without instructions with a warning. It
  // skips pass 2 then, so ORG, END and PIN statements are not even checked.
  if (a->ic == 0) warning(a, 0, S("no instructions"));
  else for (u32 i = 0; i < a->nStatements && !a->A.oom; i++) parse_statement(a, &a->statements[i]);

  if (a->ic > a->o.maxLength) {
    Buf b = {0};
    putc_(&a->A, &b, "too many instructions (");
    put_i64(&a->A, &b, a->ic);
    putc_(&a->A, &b, ", limit ");
    put_i64(&a->A, &b, a->o.maxLength);
    putc_(&a->A, &b, ")");
    error(a, 0, buf_str(&b));
  }
  const int ok = !failed(a);
  if (ok && a->ic > 0 && (a->start < 0 || a->start >= (i64)a->nIns)) {
    Buf b = {0};
    putc_(&a->A, &b, "start ");
    put_i64(&a->A, &b, a->start);
    putc_(&a->A, &b, " is outside the warrior");
    warning(a, 0, buf_str(&b));
  }
  AsmText *expanded = aalloc(&a->A, (usize)(a->nStatements + 1) * sizeof(AsmText));
  if (a->A.oom || !expanded) return 0;
  for (u32 i = 0; i < a->nStatements; i++) expanded[i] = text_of(a->statements[i].text);

  r->ok = ok;
  r->start = (u32)a->start;
  r->hasPin = a->hasPin;
  r->pin = a->pin;
  r->nIns = ok ? a->nIns : 0;
  r->ins = a->ins;
  r->nErrors = a->nErrors;
  r->errors = a->errors;
  r->nWarnings = a->nWarnings;
  r->warnings = a->warnings;
  r->nExpanded = a->nStatements;
  r->expanded = expanded;
  r->name = text_of(a->name);
  r->author = text_of(a->author);
  r->date = text_of(a->date);
  r->version = text_of(a->version);
  r->strategy = text_of(buf_str(&a->strategy));
  return r;
}

// ---------------------------------------------------------------- exports

// For wasm/42mars.js: the source is at `src` and the working memory follows
// it; the options come as numbers. Returns the result or 0 (memory too small
// or a core size below 1).
EXPORT(m42_assemble)
AsmResult *m42_assemble(const u8 *src, u32 len, u8 *mem, u32 size, double coreSize, double maxProcesses,
                        double maxCycles, double maxLength, double minDistance, double warriors, double rounds,
                        double pSpaceSize, double readLimit, double writeLimit, u32 utf8) {
  const AsmOptions o = {(i64)coreSize, (i64)maxProcesses, (i64)maxCycles, (i64)maxLength, (i64)minDistance,
                        (i64)warriors, (i64)rounds, (i64)pSpaceSize, (i64)readLimit, (i64)writeLimit, utf8};
  return assemble(mem, size, src, len, &o);
}

// Evaluates one expression with fresh registers (js/expr.js, for the
// fixtures and tools/expr-fuzz.mjs). Writes the value to *value and returns
// the status.
EXPORT(m42_evaluate)
i32 m42_evaluate(const u8 *text, u32 len, i64 *value) {
  Evaluator e = {0};
  return evaluate(&e, (Str){text, len}, value);
}
