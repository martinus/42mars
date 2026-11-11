#!/bin/sh
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Martin Leitner-Ankerl
#
# Builds build/42mars, the pMARS-compatible command line program, from
# cli/42mars.c and the library (lib/42mars.c). CC and CFLAGS as usual.
set -eu
cd "$(dirname "$0")/.."
mkdir -p build
${CC:-cc} ${CFLAGS:--O2 -Wall -Wextra} -o build/42mars cli/42mars.c lib/42mars.c
