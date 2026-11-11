// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// 42mars: a command line program with the options and the output of pMARS
// 0.9.5 (the server version, without debugger), so that tools that call
// pMARS can call it instead. It uses only lib/42mars.h.
//
//   cc -O2 -o build/42mars cli/42mars.c lib/42mars.c     (or make)
//   42mars [options] file1 [files ..]
//
// stdout is pMARS's: listings, results, -k lines, -A output. Messages go to
// stderr in our own words. Exit codes are pMARS's: 0 ok, 2 bad options, 3 a
// warrior that does not assemble or cannot be read. Not supported, with a
// clear error: -R and -W (read/write limits, #40), -8 (#42), -V (pMARS's
// internal assembler dump), and values beyond the engine's limits
// (core size 65536, 2^24 processes and p-space cells, 2^32-1 cycles). -e
// (the debugger, off in pMARS's server version) is ignored, as pMARS does.
// What pMARS does for each option is in docs/redcode-semantics.md,
// section 5.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "../lib/42mars.h"

#define MAX_WARRIORS 36 // pMARS's limit

static void usage(void) {
  fputs("42mars: Core War simulator with the results of pMARS 0.9.5\n"
        "Usage: 42mars [options] file1 [files ..]   (- reads a warrior from stdin)\n"
        "  -r # rounds [1]            -b   brief: no listings\n"
        "  -s # core size [8000]      -k   KotH output\n"
        "  -c # cycles [80000]        -o   results sorted by score\n"
        "  -p # processes [8000]      -A   assemble only\n"
        "  -l # warrior length [100]  -f   fixed position series\n"
        "  -d # distance [length]     -F # position of warrior 2\n"
        "  -S # p-space [core/16]     -P   permuted positions\n"
        "  -= $ score formula [(W*W-1)/S]\n"
        "  -@ $ read options from file $\n",
        stderr);
}

static int fail(int code, const char *what, const char *detail) {
  fprintf(stderr, "42mars: %s%s%s\n", what, detail ? " " : "", detail ? detail : "");
  return code;
}

static char *read_all(FILE *f, size_t *len) {
  size_t cap = 1 << 14, n = 0;
  char *buf = malloc(cap);
  for (size_t got; buf && (got = fread(buf + n, 1, cap - n, f)) > 0;) {
    n += got;
    if (n == cap) {
      char *bigger = realloc(buf, cap *= 2);
      if (!bigger) { free(buf); return 0; }
      buf = bigger;
    }
  }
  *len = n;
  return buf;
}

// A number made of digits only, at most `max`.
static int number(const char *s, long long max, long long *out) {
  if (!s || !*s) return 0;
  long long v = 0;
  for (const char *p = s; *p; p++) {
    if (*p < '0' || *p > '9') return 0;
    if (v > (max - (*p - '0')) / 10) return 0;
    v = v * 10 + (*p - '0');
  }
  *out = v;
  return 1;
}

// The argument list with -@ files expanded (pMARS reads whitespace
// separated options and files from them).
typedef struct {
  char **v;
  int n, cap;
} List;

typedef struct {
  List args, buffers; // the arguments, and the -@ files they point into
  const char *files[MAX_WARRIORS + 1];
  int nfiles;
  long long rounds, size, cycles, processes, length, distance, pspace, position;
  int brief, koth, sorted, assemble, fixed, permute, hasDistance, hasPosition;
  const char *formula;
} Args;

static int push(List *l, char *s) {
  if (l->n == l->cap) {
    l->cap = l->cap ? l->cap * 2 : 32;
    char **v = realloc(l->v, (size_t)l->cap * sizeof *v);
    if (!v) return 0;
    l->v = v;
  }
  l->v[l->n++] = s;
  return 1;
}

static int expand(List *l, List *buffers, char *path) {
  FILE *f = fopen(path, "rb");
  if (!f) return 0;
  size_t len;
  char *text = read_all(f, &len);
  fclose(f);
  char *ended = text ? realloc(text, len + 1) : 0;
  if (!ended || !push(buffers, ended)) { free(ended ? ended : text); return 0; }
  text = ended;
  text[len] = 0;
  for (char *t = strtok(text, " \t\r\n\v\f"); t; t = strtok(0, " \t\r\n\v\f")) {
    if (!push(l, t)) return 0;
  }
  return 1;
}

// Parses the options; returns 0 or the exit code.
static int parse(int argc, char **argv, Args *a) {
  *a = (Args){.rounds = 1, .size = 8000, .cycles = 80000, .processes = 8000, .length = 100, .formula = "(W*W-1)/S"};
  List l = {0};
  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "-@")) {
      if (i + 1 >= argc || !expand(&l, &a->buffers, argv[++i])) { a->args = l; return fail(2, "cannot read the option file", i < argc ? argv[i] : 0); }
    } else if (!push(&l, argv[i])) {
      a->args = l;
      return fail(2, "out of memory", 0);
    }
  }
  a->args = l;
  for (int i = 0; i < l.n; i++) {
    const char *arg = l.v[i];
    if (arg[0] != '-' || !arg[1]) {
      if (a->nfiles == MAX_WARRIORS) return fail(2, "too many warriors, at most 36:", arg);
      a->files[a->nfiles++] = arg;
      continue;
    }
    for (const char *c = arg + 1; *c; c++) {
      const char *value = 0;
      if (strchr("rscpldFS=", *c)) {
        if (i + 1 >= l.n) return fail(2, "missing value for", arg);
        value = l.v[++i];
      }
      long long v = 0;
      switch (*c) {
        case 'b': a->brief = 1; break;
        case 'k': a->koth = 1; break;
        case 'o': a->sorted = 1; break;
        case 'A': a->assemble = 1; break;
        case 'f': a->fixed = 1; break;
        case 'e': break; // the debugger: off in pMARS's server version too
        case '=': a->formula = value; break;
        case 'r':
          if (!number(value, 2147483647, &v)) return fail(2, "bad value for -r:", value);
          a->rounds = v;
          break;
        case 'F':
          if (!number(value, 2147483647, &v)) return fail(2, "-F takes a position (pMARS uses random positions for anything else):", value);
          a->position = v;
          a->hasPosition = 1;
          break;
        case 'd':
          if (!number(value, 1073741824, &v)) return fail(2, "bad value for -d:", value);
          a->distance = v;
          a->hasDistance = 1;
          break;
        case 's': case 'c': case 'p': case 'l': case 'S': {
          // pMARS's ranges, then the engine's
          const long long pmars = *c == 'c' ? 9223372036854775807ll : *c == 'p' ? 2147483647 : *c == 'l' ? 1000 : 1073741824;
          const long long ours = *c == 's' ? 65536 : *c == 'c' ? 4294967295ll : *c == 'l' ? 1000 : 1 << 24;
          if (!number(value, pmars, &v) || v < 1) return fail(2, "value out of range for the option", arg);
          if (v > ours) return fail(2, "the engine does not support this value of", arg);
          *(*c == 's' ? &a->size : *c == 'c' ? &a->cycles : *c == 'p' ? &a->processes : *c == 'l' ? &a->length : &a->pspace) = v;
          break;
        }
        case 'R': case 'W': return fail(2, "read and write limits (-R, -W) are not supported yet (#40)", 0);
        case 'P': a->permute = 1; break;
        case '8': return fail(2, "-8 is not supported yet (#42)", 0);
        case 'V': return fail(2, "-V (pMARS's verbose assembly) is not supported", 0);
        default: return fail(2, "unknown option", arg);
      }
    }
  }
  if (!a->hasDistance) a->distance = a->length;
  if (a->distance < a->length) return fail(2, "the distance (-d) cannot be smaller than the warrior length (-l)", 0);
  if (a->fixed && a->hasPosition) return fail(2, "only one of -f and -F can be given", 0);
  if (a->hasPosition && a->position < a->distance) return fail(2, "the position (-F) cannot be smaller than the distance (-d)", 0);
  return 0;
}

// ---------------------------------------------------------------- output

static const char *const OPS[] = {"MOV", "ADD", "SUB", "MUL", "DIV", "MOD", "JMZ", "JMN", "DJN", "CMP",
                                  "SLT", "SPL", "DAT", "JMP", "SEQ", "SNE", "NOP", "LDP", "STP"};
static const char *const MODS[] = {"A", "B", "AB", "BA", "F", "X", "I"};
static const char MODES[] = "#$@<>*{}";

// A value as pMARS prints it: above half the core size, negative.
static long long signed_value(uint32_t v, uint32_t size) { return v > size / 2.0 ? (long long)v - size : v; }

static void print_cell(const m42_instruction *x, uint32_t size) {
  printf("%3s.%-2s %c%6lld, %c%6lld     \n", OPS[x->opcode], MODS[x->modifier], MODES[x->a_mode],
         signed_value(x->a, size), MODES[x->b_mode], signed_value(x->b, size));
}

static void text(const m42_warrior *w, m42_text which, char *buf, size_t n) { m42_warrior_text(w, which, buf, n); }

static void print_listing(const m42_warrior *w, uint32_t size) {
  char name[512], author[512];
  text(w, M42_NAME, name, sizeof name);
  text(w, M42_AUTHOR, author, sizeof author);
  const uint32_t n = m42_warrior_length(w), start = m42_warrior_start(w);
  printf("Program \"%s\" (length %u) by \"%s\"\n\n", name, n, author);
  if (start < n) printf("       ORG      START\n");
  for (uint32_t i = 0; i < n; i++) {
    printf("%-6s ", i == start ? "START" : "");
    print_cell(&m42_warrior_code(w)[i], size);
  }
  printf("\n");
}

static void print_assembly(const m42_warrior *w, uint32_t size) {
  printf("       ORG %10u\n", m42_warrior_start(w));
  for (uint32_t i = 0; i < m42_warrior_length(w); i++) {
    printf("       ");
    print_cell(&m42_warrior_code(w)[i], size);
  }
  int64_t pin;
  if (m42_warrior_pin(w, &pin)) printf("       PIN %10lld\n", (long long)pin);
  printf("       END\n");
}

// ---------------------------------------------------------------- main

// The -f seed, pMARS's checksum of the warriors: the sum of field XOR k
// over every field (op byte, A mode, B mode, A value, B value) of every
// instruction of every warrior, k counting the fields from 0. pMARS codes
// the modes # $ @ < > as 0..4 and * { } as 130..132 (128 + the B-field mode
// @ < >). Found by running pMARS, semantics doc section 5.
static int64_t mode_code(uint8_t mode) { return mode < 5 ? mode : 125 + mode; }

static int64_t series_seed(m42_warrior *const *w, int n) {
  int64_t sum = 0, k = 0;
  for (int i = 0; i < n; i++) {
    for (uint32_t j = 0; j < m42_warrior_length(w[i]); j++) {
      const m42_instruction *x = &m42_warrior_code(w[i])[j];
      const int64_t fields[5] = {x->opcode << 3 | x->modifier, mode_code(x->a_mode), mode_code(x->b_mode), x->a, x->b};
      for (int f = 0; f < 5; f++) sum += fields[f] ^ k++;
    }
  }
  // pMARS steps its generator once before the first position. (Checked
  // for sums below 2^31; a larger one needs warriors far beyond the corpus.)
  const int64_t s = sum;
  const int64_t t = 16807 * (s % 127773) - 2836 * (s / 127773);
  return t < 0 ? t + 2147483647 : t;
}

static int play(Args *a, m42_warrior **w) {
  m42_rules rules = m42_rules_94();
  rules.core_size = (uint32_t)a->size;
  rules.max_cycles = (uint32_t)a->cycles;
  rules.max_processes = (uint32_t)a->processes;
  rules.max_length = (uint32_t)a->length;
  rules.min_distance = (uint32_t)a->distance;
  rules.pspace_size = (uint32_t)a->pspace; // 0: core size / 16
  rules.rounds = (uint32_t)a->rounds;
  rules.warriors = (uint32_t)a->nfiles;

  for (int i = 0; i < a->nfiles; i++) {
    const char *path = a->files[i];
    FILE *f = strcmp(path, "-") ? fopen(path, "rb") : stdin;
    size_t len = 0;
    char *src = f ? read_all(f, &len) : 0;
    if (f && f != stdin) fclose(f);
    if (!src) return fail(3, "cannot read", path);
    int s;
    w[i] = m42_assemble_new(src, len, &rules, 0, &s);
    free(src);
    if (!w[i]) return fail(3, m42_status_text(s), path);
    for (uint32_t k = 0; k < m42_warrior_errors(w[i]) + m42_warrior_warnings(w[i]); k++) {
      char msg[512];
      int32_t line;
      int is_error;
      m42_warrior_message(w[i], k, &line, &is_error, msg, sizeof msg);
      if (line) fprintf(stderr, "%s:%d: %s: %s\n", path, (int)line, is_error ? "error" : "warning", msg);
      else fprintf(stderr, "%s: %s: %s\n", path, is_error ? "error" : "warning", msg);
    }
    // Like pMARS: each warrior's listing as soon as it assembled, and the
    // first one that does not assemble ends the run.
    if (!m42_warrior_ok(w[i])) return 3;
    if (!a->brief) (a->assemble ? print_assembly : print_listing)(w[i], rules.core_size);
  }
  if (a->assemble || a->rounds == 0) return 0;
  const int n = a->nfiles;
  int64_t reg[26];
  const size_t flen = strlen(a->formula);

  int s;
  m42_ctx *m = m42_new(&rules, &s);
  if (!m) return fail(3, m42_status_text(s), 0);
  m42_match_options o = m42_match_options_default();
  o.rounds = (uint32_t)a->rounds;
  // -F under -P: the generator starts at 2 * (position - distance), which
  // draws that position with the first warrior moving first (semantics
  // doc, 3.2).
  o.permute = (uint32_t)a->permute;
  o.seed = a->hasPosition ? (a->permute ? 2 : 1) * (a->position - a->distance)
         : a->fixed       ? series_seed(w, n)
                          : (int64_t)(((uint64_t)time(0) * 2654435761u) % 2147483646u) + 1;
  s = m42_match(m, (const m42_warrior *const *)w, (uint32_t)n, &o, 0, 0);
  if (s != M42_OK) { m42_free(m); return fail(2, m42_status_text(s), 0); }

  // Survivor counters (rounds survived with k + 1 warriors alive) and the
  // score: the formula for every number of survivors, the registers kept
  // from one evaluation to the next, in warrior order (semantics doc 5).
  // The last column of the results: the rounds not survived. That is the
  // losses, except for a single warrior, whose death counter is its
  // survival counter (as in pMARS).
  uint32_t counters[MAX_WARRIORS][2 * MAX_WARRIORS], rest[MAX_WARRIORS];
  int64_t points[MAX_WARRIORS];
  memset(reg, 0, sizeof reg);
  for (int i = 0; i < n; i++) {
    m42_warrior_scores(m, (uint32_t)i, counters[i], 2 * MAX_WARRIORS);
    rest[i] = (uint32_t)a->rounds;
    for (int k = 0; k < n; k++) rest[i] -= counters[i][k];
    points[i] = 0;
    for (int k = 0; k < n; k++) {
      reg['w' - 'a'] = n;
      reg['s' - 'a'] = k + 1;
      int64_t v = 0;
      m42_evaluate_registers(a->formula, flen, reg, &v);
      points[i] += (int64_t)counters[i][k] * v;
    }
  }
  m42_free(m);

  int order[MAX_WARRIORS];
  for (int i = 0; i < n; i++) order[i] = i;
  if (a->koth) {
    for (int i = 0; i < n; i++) {
      if (n == 2) { printf("%u %u\n", counters[i][0], counters[i][1]); continue; }
      printf("%lld", (long long)points[i]);
      for (int k = 0; k < n; k++) printf(" %u", counters[i][k]);
      printf(" %u\n", rest[i]);
    }
  } else {
    if (a->sorted) { // stable, highest score first
      for (int i = 1; i < n; i++) {
        const int x = order[i];
        int j = i;
        for (; j > 0 && points[order[j - 1]] < points[x]; j--) order[j] = order[j - 1];
        order[j] = x;
      }
    }
    for (int r = 0; r < n; r++) {
      const int i = order[r];
      char name[512], author[512];
      text(w[i], M42_NAME, name, sizeof name);
      text(w[i], M42_AUTHOR, author, sizeof author);
      printf("%s by %s scores %lld\n", name, author, (long long)points[i]);
      if (n > 2) {
        printf("  Results:");
        for (int k = 0; k < n; k++) printf(" %u", counters[i][k]);
        printf(" %u\n", rest[i]);
      }
    }
    if (n == 2) printf("Results: %u %u %u\n", counters[order[0]][0], counters[order[1]][0], counters[0][1]);
  }
  return 0;
}

static int run(Args *a) {
  m42_warrior *w[MAX_WARRIORS] = {0};
  const int status = play(a, w);
  for (int i = 0; i < a->nfiles; i++) m42_warrior_free(w[i]);
  return status;
}

// The checks pMARS makes before it assembles anything.
static int check(const Args *a) {
  const int n = a->nfiles;
  if ((long long)n * a->distance > a->size) return fail(2, "the core size is too small for the warriors and the distance", 0);
  if (a->permute && n != 2) return fail(2, "-P needs exactly two warriors", 0);
  // The score formula, for every number of survivors.
  for (int s = 1; s <= n; s++) {
    int64_t reg[26] = {0};
    reg['w' - 'a'] = n;
    reg['s' - 'a'] = s;
    int64_t v;
    if (m42_evaluate_registers(a->formula, strlen(a->formula), reg, &v) < 0) return fail(2, "bad score formula", a->formula);
  }
  return 0;
}

int main(int argc, char **argv) {
  Args a;
  int status = parse(argc, argv, &a);
  if (!status && !a.nfiles) usage();
  else if (!status && !(status = check(&a))) status = run(&a);
  for (int i = 0; i < a.buffers.n; i++) free(a.buffers.v[i]);
  free(a.buffers.v);
  free(a.args.v);
  return status;
}
