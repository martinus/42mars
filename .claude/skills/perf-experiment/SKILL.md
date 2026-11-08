---
name: perf-experiment
description: Measure a simulator speed idea against the current engine and record it in docs/performance-log.md, kept or rejected. Use for any change made to make mars.c, mars-wasm.js, mars.js or tools/tournament.mjs faster, and for re-measuring the speed numbers in PLAN.md and README.md.
---
# Speed experiment

Setup: `O=${COREWAR_ORACLE:-$HOME/.local/share/corewar-theater}`.

1. Read `docs/performance-log.md` first. Skip ideas already rejected there unless something they depended on changed; say what changed.
2. Idle machine: `uptime` load below 1 and `pgrep -a 'node|clang|pmars|chrome'` empty apart from yourself. Do not time while builds, tests or other agents run; ask first if another session may be benchmarking.
3. A/B in the same session: keep the baseline build (e.g. `cp src/engine/wasm/mars.wasm $TMP/base.wasm`), build the variant, and alternate baseline and variant runs (ABAB...), swapping `mars.wasm`, so drift hits both. Fresh process per run.
4. Measures (report median and range):
   | Name | Command | Runs |
   |---|---|---|
   | bench | `node tools/bench.mjs $O/corpus --wasm-match` | 7 |
   | native | `node tools/bench-native.mjs $O/corpus --runs 7` | 1 |
   | t20 | `node tools/tournament.mjs $O/sets/t20 --rounds 100 --seed 1 --jobs 1 --engine wasm` (time on stderr: `engine (wasm): N s`) | 7 |
   | t80 | same with `$O/sets/t80`, `--jobs 16` and `--jobs 31` | 5 each |
   | JS | `node tools/bench.mjs $O/corpus --headless` (only for mars.js changes) | 7 |
   References, when re-measuring the summary: `node $O/cwbench/single.mjs exmars` (bench, corewar.dev exMARS), `node $O/cwbench/tournament.mjs 31 $O/sets/t80.json`, `node tools/tournament.mjs $O/sets/t80 --rounds 100 --seed 1 --jobs 31 --pmars $O/bin/pmars` (native pMARS), and `node $O/cwbench/perpair.mjs $O/sets/t20.json` from the repo root to find pairings where we lose to exMARS.
5. Keep only if t20 and bench are faster beyond noise (ranges do not overlap or a clear median shift over 7+7 runs), nothing else gets slower by more than 1%, and the `engine-check` skill passes. Otherwise restore the code and rebuild.
6. Record, also when rejected: one row in the right table of `docs/performance-log.md`: `| idea and why it should help | measure before → after | kept / rejected (reason) |`. For a kept change update the "State" line, and the speed numbers in `PLAN.md` (section Speed) and `README.md`.
7. For a profile, build natively like `tools/bench-native.mjs` does (`clang -O3 -march=native` on `mars.c` + `bench-native.c`) and use `perf stat` / `perf record`; the log has the last profile (instructions per simulated instruction, IPC, branch misses).
