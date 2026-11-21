// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// 42gen: the warrior a generator writes (docs/evolver-gen.md).
//
//   42gen [--size 8000] [--length 100] <file>          the warrior, as Redcode
//   42gen [--size 8000] [--length 100] --text <file>   the generator, as 42gen prints one
//   42gen [--size 8000] [--length 100] --from <file>   the generator of a warrior (one line per instruction)
//
// A generator that wants to write more than --length instructions, or runs
// out of steps, gives what it wrote until then, and a message on stderr.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "42mars.h"
#include "generator.h"

static void usage(void) {
  fprintf(stderr, "usage: 42gen [--size 8000] [--length 100] [--text | --from] <file>\n"
                  "  <file>         a generator: prints the warrior it writes\n"
                  "  --text <file>  a generator: prints it as 42gen writes one\n"
                  "  --from <file>  a warrior: prints its generator, one line per instruction\n");
  exit(2);
}

static char *read_file(const char *path, size_t *len) {
  FILE *f = fopen(path, "rb");
  if (!f) return 0;
  size_t cap = 1 << 14, n = 0;
  char *buf = malloc(cap + 1);
  for (size_t got; buf && (got = fread(buf + n, 1, cap - n, f)) > 0;) {
    n += got;
    if (n == cap) buf = realloc(buf, (cap *= 2) + 1);
  }
  fclose(f);
  if (!buf) return 0;
  buf[n] = 0;
  *len = n;
  return buf;
}

static void print_gen(const gen *x, uint32_t core) {
  const size_t n = gen_text(x, core, 0, 0) + 1;
  char *text = malloc(n);
  if (!text) exit(1);
  gen_text(x, core, text, n);
  fputs(text, stdout);
  free(text);
}

int main(int argc, char **argv) {
  static const char *const OPCODES[] = {"MOV", "ADD", "SUB", "MUL", "DIV", "MOD", "JMZ", "JMN", "DJN",
                                        "CMP", "SLT", "SPL", "DAT", "JMP", "SEQ", "SNE", "NOP"};
  static const char *const MODIFIERS[] = {"A", "B", "AB", "BA", "F", "X", "I"};
  static const char MODES[] = "#$@<>*{}";
  m42_rules rules = m42_rules_94();
  const char *file = 0;
  int text = 0, from = 0;
  for (int i = 1; i < argc; i++) {
    const char *a = argv[i];
    if (!strcmp(a, "--text")) text = 1;
    else if (!strcmp(a, "--from")) from = 1;
    else if ((!strcmp(a, "--size") || !strcmp(a, "--length")) && i + 1 < argc) {
      char *end;
      const unsigned long v = strtoul(argv[++i], &end, 10);
      if (*end || !*argv[i] || v < 1 || v > 100000000) usage();
      if (a[2] == 's') rules.core_size = (uint32_t)v;
      else rules.max_length = (uint32_t)v;
    } else if (a[0] == '-' || file) usage();
    else file = a;
  }
  if (!file || (text && from)) usage();
  const uint32_t core = rules.core_size;
  size_t len;
  char *src = read_file(file, &len);
  if (!src) {
    fprintf(stderr, "42gen: cannot read %s\n", file);
    return 1;
  }
  static gen x;
  if (from) {
    int status;
    m42_warrior *w = m42_assemble_new(src, len, &rules, 0, 0, &status);
    free(src);
    if (!w || !m42_warrior_ok(w) || m42_warrior_length(w) < 1 || m42_warrior_length(w) > GEN_LINES ||
        m42_warrior_uses_pspace(w)) {
      fprintf(stderr, "42gen: %s is no warrior of 1 to %d instructions without p-space\n", file, GEN_LINES);
      m42_warrior_free(w);
      return 1;
    }
    gen_from_code(&x, m42_warrior_code(w), m42_warrior_length(w), m42_warrior_start(w), core);
    m42_warrior_free(w);
    print_gen(&x, core);
    return 0;
  }
  char err[160];
  const int bad = strlen(src) != len ? (snprintf(err, sizeof err, "a 0 byte"), 1) : gen_parse(&x, src, core, err, sizeof err) != 0;
  free(src);
  if (bad) {
    fprintf(stderr, "42gen: %s: %s\n", file, err);
    return 1;
  }
  if (text) {
    print_gen(&x, core);
    return 0;
  }
  static m42_instruction code[GEN_LINES];
  uint32_t start;
  int truncated;
  const uint32_t n = gen_compile(&x, core, rules.max_length, code, &start, &truncated);
  if (truncated) fprintf(stderr, "42gen: %s: truncated after %u instructions\n", file, n);
  printf("        ORG     %u\n", start);
  for (uint32_t i = 0; i < n; i++) {
    const m42_instruction *c = &code[i];
    const long long a = c->a > core / 2 ? (long long)c->a - core : c->a, b = c->b > core / 2 ? (long long)c->b - core : c->b;
    char op[8];
    snprintf(op, sizeof op, "%s.%s", OPCODES[c->opcode], MODIFIERS[c->modifier]);
    printf("        %-7s %c%lld, %c%lld\n", op, MODES[c->a_mode], a, MODES[c->b_mode], b);
  }
  return 0;
}
