// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// Fuzz target: arbitrary bytes as an expression, without and with registers.
// Run by `make fuzz`.
#include <stddef.h>
#include <stdint.h>
#include "42mars.h"

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
  int64_t v, regs[26];
  m42_evaluate((const char *)data, size, &v);
  for (int i = 0; i < 26; i++) regs[i] = i * 7 - 3;
  m42_evaluate_registers((const char *)data, size, regs, &v);
  return 0;
}
