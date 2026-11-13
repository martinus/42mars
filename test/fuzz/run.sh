#!/bin/sh
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Martin Leitner-Ankerl
#
# Runs fuzz targets built by `make fuzz` (build/fuzz/<target>), each for a
# time on a number of processes that share the target's corpus, and fails
# on any sanitizer report, timeout (10 s per input) or out-of-memory stop
# (2 GB). The corpus grows in build/fuzz/corpus-<target> (seeds.sh, shared
# with afl.sh). A failing input is written to build/fuzz/<target>-*, the
# log of each process to build/fuzz/<target>-<n>.log; docs/development.md
# says how to reproduce one. libFuzzer's own -fork mode is not used: its
# parent process crashed at the end of 4 of 5 runs (clang 22.1.8).
#
#   sh test/fuzz/run.sh <seconds> <processes> <target>...

seconds=$1
jobs=$2
shift 2
failed=0
for t in "$@"; do
  sh test/fuzz/seeds.sh "$t" || exit 1
  corpus=build/fuzz/corpus-$t
  echo "== $t: $seconds s on $jobs processes"
  pids=
  j=1
  while [ "$j" -le "$jobs" ]; do
    "build/fuzz/$t" -max_total_time="$seconds" -timeout=10 -rss_limit_mb=2048 -print_final_stats=1 \
      -artifact_prefix="build/fuzz/$t-" "$corpus" > "build/fuzz/$t-$j.log" 2>&1 &
    pids="$pids $!"
    j=$((j + 1))
  done
  j=1
  runs=0
  for p in $pids; do
    if ! wait "$p"; then
      echo "== $t: process $j FAILED, the input is in build/fuzz/$t-*, the log in build/fuzz/$t-$j.log:"
      grep -E 'ERROR|SUMMARY|^ +#[0-9]+ ' "build/fuzz/$t-$j.log" | head -30
      failed=1
    fi
    n=$(sed -n 's/^stat::number_of_executed_units: //p' "build/fuzz/$t-$j.log")
    runs=$((runs + ${n:-0}))
    j=$((j + 1))
  done
  echo "== $t: $runs runs"
done
exit $failed
