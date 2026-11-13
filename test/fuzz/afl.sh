#!/bin/sh
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Martin Leitner-Ankerl
#
# Runs fuzz targets of test/fuzz/ with AFL++ (#133), each for a time on a
# number of afl-fuzz instances that sync through one output folder,
# build/afl/<target>/run-<date>. The instances use different settings
# (AFL++'s docs/fuzzing_in_depth.md, "Using multiple cores"): one main
# instance, exactly one with ASan and UBSan, CmpLog, LAF-intel, power
# schedules, MOpt, ... The targets are the libFuzzer ones: afl-clang-lto
# (or afl-clang-fast) links LLVMFuzzerTestOneInput against AFL++'s driver.
# Starts from build/fuzz/corpus-<target> (test/fuzz/seeds.sh), minimized,
# and adds the main instance's new inputs to it at the end, so libFuzzer and AFL++ share one corpus. Fails on
# any crash or hang (10 s); each crash runs again on the ASan and UBSan
# build for the report.
#
#   sh test/fuzz/afl.sh <AFL++ folder> <seconds> <instances> <target>...

afl=$1
seconds=$2
jobs=$3
shift 3
cc=$afl/afl-clang-lto
[ -x "$cc" ] || cc=$afl/afl-clang-fast
if [ ! -x "$cc" ] || [ ! -x "$afl/afl-fuzz" ]; then
  echo "no afl-fuzz and afl-clang-fast in '$afl'"
  exit 1
fi
# afl-fuzz refuses a CPU governor other than performance and a core_pattern
# that pipes to a program; neither matters for finding crashes.
export AFL_SKIP_CPUFREQ=1 AFL_I_DONT_CARE_ABOUT_MISSING_CRASHES=1 AFL_NO_UI=1
stamp=$(date +%Y%m%d-%H%M%S)

# The binary, an environment variable (- for none) and the afl-fuzz options
# of instance $1. With a single instance, it is the one with sanitizers.
settings() {
  if [ "$jobs" -eq 1 ]; then echo "asan - -M main"; return; fi
  case $1 in
    1) echo "plain - -M main" ;;
    2) echo "asan - -S asan" ;;
    3) echo "plain - -S cmplog -c $b/cmplog -l 2AT" ;;
    4) echo "laf - -S laf" ;;
    5) echo "plain - -S explore -p explore" ;;
    6) echo "plain - -S coe -p coe" ;;
    7) echo "plain - -S lin -p lin" ;;
    8) echo "plain - -S quad -p quad" ;;
    9) echo "plain - -S exploit -p exploit" ;;
    10) echo "plain - -S rare -p rare" ;;
    11) echo "plain - -S mopt -L 0" ;;
    12) echo "plain - -S oldqueue -Z" ;;
    13) echo "plain - -S cmplog3 -c $b/cmplog -l 3AT" ;;
    14) echo "plain - -S seek -p seek" ;;
    15) echo "plain - -S mmopt -p mmopt" ;;
    16) echo "plain AFL_DISABLE_TRIM=1 -S notrim" ;;
    *) echo "plain - -S explore$1 -p explore" ;;
  esac
}

start() {
  i=$1
  # shellcheck disable=SC2046
  set -- $(settings "$i")
  bin=$1 var=$2
  shift 2
  args="$*"
  # fuzz_asm reads Redcode: every other instance from 5 on mutates it as text
  if [ "$t" = fuzz_asm ] && [ "$i" -ge 5 ] && [ $((i % 2)) -eq 1 ]; then args="$args -a text"; fi
  [ "$var" = - ] && var=AFL_NO_UI=1
  # shellcheck disable=SC2086
  env "$var" "$afl/afl-fuzz" -i "$out-in" -o "$out" -V "$seconds" -t 10000 $args -- "$b/$bin" > "$out-$i.log" 2>&1 &
  pids="$pids $!"
}

failed=0
for t in "$@"; do
  sh test/fuzz/seeds.sh "$t" || exit 1
  corpus=build/fuzz/corpus-$t
  b=build/afl/$t
  mkdir -p "$b" || exit 1
  src="test/fuzz/$t.c lib/42mars.c"
  echo "== $t: building with $cc"
  if ! { $cc -g -O2 -fsanitize=fuzzer -Ilib -o "$b/plain" $src &&
    $cc -g -O1 -fsanitize=fuzzer,address,undefined -fno-sanitize-recover=all -Ilib -o "$b/asan" $src &&
    AFL_LLVM_CMPLOG=1 $cc -g -O2 -fsanitize=fuzzer -Ilib -o "$b/cmplog" $src &&
    AFL_LLVM_LAF_ALL=1 $cc -g -O2 -fsanitize=fuzzer -Ilib -o "$b/laf" $src; } > "$b/build.log" 2>&1; then
    echo "== $t: build failed, see $b/build.log"
    exit 1
  fi
  out=$b/run-$stamp
  # The corpus minimized (afl-cmin, on all instances' cores): each instance
  # runs every input once before fuzzing, and most add nothing (56,494
  # inputs of fuzz_make took the 16 instances most of a 30 s run). @@: the
  # driver reads the input from that file; without it every input looked
  # the same to afl-cmin, and 1 of 60,017 was left.
  echo "== $t: minimizing $(ls "$corpus" | wc -l | tr -d ' ') inputs of $corpus"
  if ! "$afl/afl-cmin" -i "$corpus" -o "$out-in" -T "$jobs" -t 10000 -- "$b/plain" @@ > "$out-cmin.log" 2>&1; then
    echo "== $t: afl-cmin failed, see $out-cmin.log"
    exit 1
  fi
  echo "== $t: $seconds s on $jobs instances from $(ls "$out-in" | wc -l | tr -d ' ') inputs, in $out"
  pids=
  n=1
  while [ "$n" -le "$jobs" ]; do
    start "$n"
    n=$((n + 1))
  done
  n=1
  for p in $pids; do
    if ! wait "$p"; then
      echo "== $t: instance $n FAILED, the log is $out-$n.log:"
      tail -5 "$out-$n.log"
      failed=1
    fi
    n=$((n + 1))
  done
  runs=0
  for s in "$out"/*/fuzzer_stats; do
    e=$(sed -n 's/^execs_done *: //p' "$s")
    runs=$((runs + ${e:-0}))
  done
  echo "== $t: $runs runs"
  for f in "$out"/*/crashes/id:* "$out"/*/hangs/id:*; do
    [ -f "$f" ] || continue
    failed=1
    echo "== $t: $f"
    case $f in
      */crashes/*) "$b/asan" "$f" 2>&1 | grep -E 'ERROR|SUMMARY|runtime error|^ +#[0-9]+ ' | head -20 ;;
    esac
  done
  # The new inputs into the corpus: those of the main instance, which takes
  # over what the others found, without the ones that came from the corpus.
  for f in "$out"/main/queue/id:*; do
    case $f in *orig:*) continue ;; esac
    [ -f "$f" ] && cp "$f" "$corpus/afl-$stamp-${f##*/id:}"
  done
done
exit $failed
