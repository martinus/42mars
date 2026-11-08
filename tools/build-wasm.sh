#!/bin/sh
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Martin Leitner-Ankerl
#
# Rebuilds src/engine/wasm/mars.wasm from mars.c. Needs clang with the wasm32
# target and wasm-ld (tested with clang 22); no emscripten, no libc.
#   -nostdlib, --no-entry: a library module without libc and without main
#   -fno-strict-aliasing: mars.c reads the cell fields through other types
#   --strip-all: no names section, smaller module
# The exports are the functions marked EXPORT() in mars.c, plus the memory.
set -eu
cd "$(dirname "$0")/../src/engine/wasm"
CC=${CC:-clang}
"$CC" --target=wasm32 -O3 -nostdlib -fno-strict-aliasing -Wall -Wextra \
  -Wl,--no-entry -Wl,--strip-all -o mars.wasm mars.c
ls -l mars.wasm
