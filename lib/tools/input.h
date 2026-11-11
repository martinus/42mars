// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Reads one match of the input format of tools/native-input.mjs for the
// native drivers (bench-native.c, tie-ceiling.c): the header line
// "coreSize maxProcesses maxCycles minDistance pSpaceSize warriors
// instructions seed rounds", per warrior "length start p-space-group 0",
// then 5 integers per instruction (op byte, A mode, A value, B mode, B
// value). Fills the rules and options and makes the warriors with
// m42_warrior_make() (the p-space group becomes the PIN). Returns 1, 0 at
// the end of the input, -1 on bad input.

typedef struct {
  m42_rules rules;
  m42_match_options options;
  uint32_t n;
  m42_warrior *w[255];
} Match;

static int read_match(FILE *f, Match *x) {
  unsigned cfg[9];
  if (fscanf(f, "%u %u %u %u %u %u %u %u %u", &cfg[0], &cfg[1], &cfg[2], &cfg[3], &cfg[4], &cfg[5], &cfg[6], &cfg[7], &cfg[8]) != 9) return 0;
  if (cfg[5] < 1 || cfg[5] > 255) return -1;
  x->rules = m42_rules_94();
  x->rules.core_size = cfg[0];
  x->rules.max_processes = cfg[1];
  x->rules.max_cycles = cfg[2];
  x->rules.min_distance = cfg[3];
  x->rules.pspace_size = cfg[4];
  x->rules.warriors = cfg[5];
  x->options = m42_match_options_default();
  x->options.seed = cfg[7];
  x->options.rounds = cfg[8];
  x->n = cfg[5];
  int head[255][4];
  uint32_t longest = 1;
  for (uint32_t i = 0; i < x->n; i++) {
    if (fscanf(f, "%d %d %d %d", &head[i][0], &head[i][1], &head[i][2], &head[i][3]) != 4 || head[i][0] < 0) return -1;
    if ((uint32_t)head[i][0] > longest) longest = (uint32_t)head[i][0];
  }
  x->rules.max_length = longest;
  m42_instruction *code = malloc(longest * sizeof *code);
  for (uint32_t i = 0; i < x->n; i++) {
    const uint32_t len = (uint32_t)head[i][0];
    for (uint32_t k = 0; k < len; k++) {
      int v[5];
      if (fscanf(f, "%d %d %d %d %d", &v[0], &v[1], &v[2], &v[3], &v[4]) != 5) { free(code); return -1; }
      code[k] = (m42_instruction){(uint8_t)(v[0] >> 3), (uint8_t)(v[0] & 7), (uint8_t)v[1], (uint8_t)v[3], (uint32_t)v[2], (uint32_t)v[4], 0};
    }
    const int64_t pin = head[i][2];
    const size_t size = m42_warrior_make_size(len);
    x->w[i] = m42_warrior_make(code, len, (uint32_t)head[i][1], &pin, malloc(size), size);
  }
  free(code);
  return 1;
}

static void free_match(Match *x) {
  for (uint32_t i = 0; i < x->n; i++) free(x->w[i]);
}
