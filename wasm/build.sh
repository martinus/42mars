#!/bin/sh
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Martin Leitner-Ankerl
#
# Rebuilds wasm/42mars.wasm from lib/42mars.c (the simulator, the assembler
# and the functions of 42mars.h, one translation unit). Needs Node (for
# tools/gen-dispatch.mjs, which writes dispatch.h) and clang with the wasm32
# target and wasm-ld (tested with clang 22); no emscripten, no libc.
#   -Os: about 2 to 3% faster than -O3 in V8 (bench, corpus pairs, t20; see
#     docs/performance-log.md); natively -O3 is faster
#   -nostdlib, --no-entry: a library module without libc and without main
#   -fno-strict-aliasing: mars.c reads the cell fields through other types
#   --strip-all: no names section, smaller module
#   --export=__heap_base: where wasm/42mars.js may place the memory it gives
#     the library (the context's heap, warriors, assembler memory)
#   -DM42_FIXED_CONTEXT: one context with static storage (42mars.h, #53)
#   -DM42_NO_LIBC: no malloc-based functions
# The exports are the functions of lib/42mars.h (EXPORT() in api.c), the
# memory and __heap_base.
set -eu
cd "$(dirname "$0")/../lib/src"
node ../../tools/gen-dispatch.mjs -o dispatch.h
CC=${CC:-clang}
"$CC" --target=wasm32 -Os -nostdlib -fno-strict-aliasing -Wall -Wextra \
  -DM42_FIXED_CONTEXT -DM42_NO_LIBC \
  -Wl,--no-entry -Wl,--strip-all -Wl,--export=__heap_base -o ../../wasm/42mars.wasm ../42mars.c
ls -l ../../wasm/42mars.wasm
