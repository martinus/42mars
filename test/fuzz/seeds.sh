#!/bin/sh
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Martin Leitner-Ankerl
#
# Creates the corpus folder of a fuzz target, build/fuzz/corpus-<target>,
# which libFuzzer (run.sh) and AFL++ (afl.sh) share. fuzz_asm starts from
# warriors/*.red, each with selector bytes for rules, flags and match
# options in front.
#
#   sh test/fuzz/seeds.sh <target>

corpus=build/fuzz/corpus-$1
mkdir -p "$corpus" || exit 1
if [ "$1" = fuzz_asm ]; then
  for f in warriors/*.red; do
    n=$(basename "$f" .red)
    # core 8000; core 800 with UTF-8; core 80, 3 warriors; ICWS'88 with
    # read limit and registers; core 55440 with a watch and early ties
    printf '\000\000' > "$corpus/seed-$n-0" && cat "$f" >> "$corpus/seed-$n-0"
    printf '\041\001' > "$corpus/seed-$n-1" && cat "$f" >> "$corpus/seed-$n-1"
    printf '\022\003' > "$corpus/seed-$n-2" && cat "$f" >> "$corpus/seed-$n-2"
    printf '\304\004' > "$corpus/seed-$n-3" && cat "$f" >> "$corpus/seed-$n-3"
    printf '\003\012' > "$corpus/seed-$n-4" && cat "$f" >> "$corpus/seed-$n-4"
  done
fi
# AFL++ needs at least one input
[ -n "$(ls "$corpus")" ] || printf '\000' > "$corpus/seed-empty"
