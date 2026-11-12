---
name: perf-experiment
description: Measures a simulator speed idea against the current engine and records it in docs/performance-log.md, kept or rejected; holds where the speed work stands and what was already rejected. Use before proposing or trying any change meant to make mars.c, 42mars.js or tools/tournament.mjs faster, and for re-measuring the speed numbers in PLAN.md and README.md.
---
# Speed experiment

Setup: `O=${COREWAR_ORACLE:-$HOME/.local/share/corewar-theater}`.

## Where it stands (five rounds, the last on 10th November 2026)

Read this and `docs/performance-log.md` before trying anything. Skip ideas rejected there unless something they depended on changed; say what changed.
- The instruction loop of `mars.c` is at a local optimum for V8 and clang. In rounds three to five about 4 of 5 changes to it were slower by 1 to 8%, also changes that run fewer instructions. Do not start a loop change without a reason why V8's register allocation gets better, and expect to reject it.
- Exact early ties are done: the two proofs in `tie_check()` stay; the closed-loop proof of #35 saves 0.7% of t80, less than its traced loop costs in V8. A new proof needs a measured ceiling above 5% first (`tools/tie-ceiling.mjs`).
- Rejected in wasm and natively: more specialized instruction words, short or ring queues, a denser core, prefetch, tail calls, table dispatch.
- The second hardware thread of a core adds 11% in wasm (22% natively): the code already runs 4.1 instructions per cycle on one thread.
- Open, by expected gain: a worker pool that stays alive for callers with many short runs (worker start is 100 ms for 31 workers, the whole fixed cost of `tools/tournament.mjs`); a native driver with threads (native shards ran t80 in 2.47 s against 2.85 s in Node; contexts through a pointer cost 1 to 3% natively, 4 to 6% in wasm, so wasm keeps one context at a fixed address, #53).
- Where the time goes, t20, per simulated instruction: wasm 61.3 x86 instructions, 14.9 cycles; native 45.2 instructions, 12.2 cycles. L1 data misses about 0.15 per simulated instruction, 80 to 90% in the core, nearly all L2 hits; memory stalls at most 12% of the slots (prefetch, split value/word arrays and a 6-byte cell did not pay, #6). About 5.8 stack-slot loads and stores and 1 stack check per instruction in `execute2_8000()` (#20): most changes that cut live values in C moved V8's register allocation the wrong way; one head for both queues (fourth round) was the exception. Removing the stack check would give about 1%. Open lead: Liftoff time before V8 tiers up on short runs.
- The native build does not follow the wasm build: the fourth round was 4 to 7% faster in wasm and 2 to 3% slower natively. Measure in wasm.
- Tie rounds are 36% (t20) and 47% (t80) of executed instructions.
- The visualizer runs the watched loop (`tools/bench.mjs --watch`, about 46M/s): one instruction per iteration through the generic operand code. A change there does not touch tournament speed.

## Method

1. Idle machine: `uptime` load below 1 and no other `node`, `clang`, `pmars` or `chrome` process (`ps -eo pid,args`, not `pgrep -f`, see CLAUDE.md). Do not time while builds, tests, pMARS checks or other agents run; ask first if another session may be benchmarking.
2. A/B in the same session, alternating, fresh process per run; never compare with a number from the log or another session:
   - wasm: `git show origin/main:wasm/42mars.wasm > $S/base.wasm` (or copy the build before your change), build the variant, `node tools/ab-wasm.mjs $S/base.wasm wasm/42mars.wasm [--only bench,pairs,t20,t80j31]`. About 15 minutes for all measures: run it in the background with a sentinel (CLAUDE.md, "Running long checks"); it restores `42mars.wasm`, so do not rebuild or test meanwhile.
   - a tool: `git show HEAD:tools/tournament.mjs > tools/zz-base-tournament.mjs` (relative imports), `node tools/ab-tool.mjs tools/zz-base-tournament.mjs tools/tournament.mjs 5 <arguments>`, delete the copy.
   - `mars.c` natively: `node tools/ab-native.mjs <A/mars.c> <B/mars.c> --input t20.in --early-tie`.
   - A change to `mars.c` that adds code outside the hot loops: check first that the loops are unchanged (`.claude/rules/wasm.md`, "Keep the hot loops byte-identical"); if they are, a timing is only needed when data addresses moved.
3. Measures (median and range):
   | Name | Command | Runs |
   |---|---|---|
   | bench | `node tools/bench.mjs $O/corpus --wasm-match` (80 to 170 ms, includes V8 warm-up) | 7 |
   | pairs | `node tools/bench-pairs.mjs $O/corpus` (40 random corpus pairs, without early ties) | 7 |
   | native | `node tools/bench-native.mjs $O/corpus --runs 7` | 1 |
   | t20 | `node tools/tournament.mjs $O/sets/t20 --rounds 100 --seed 1 --jobs 1` (stderr: `engine (wasm): N s`) | 7 |
   | t80 | the same on `$O/sets/t80` with `--jobs 16` and `--jobs 31` | 5 each |
   | fixed cost | t80 with `--rounds 1 --jobs 31` (worker start, assembly, compile) | 5 |
   | watch | `node tools/bench.mjs $O/corpus --watch` (only for the watched loop) | 7 |
   - A change to tie detection: `node tools/bench-pairs.mjs $O/corpus --pairs 400 --early-tie` on both builds (`ab-wasm` runs the pairs without early ties); it prints the executed instructions too.
   - `tools/tournament.mjs --jobs N` is N threads, the main thread one of them; results do not depend on N. Scheduling or start-up changes: t80 with 16 and 32 jobs, t20 with 1 and 32 jobs, `$O/corpus --bench $O/corpus/agony.red --rounds 200` with 16 and 32 jobs, t80 with `--rounds 1`, one pairing with `--rounds 1000`, all `--seed 1`; stdout must be byte-identical for every job count.
   - References when re-measuring the summary: `node $O/cwbench/benchpairs.mjs` (warmed up, ours against corewar.dev exMARS: the fair single-thread comparison; the short bench shows 2.1x where warmed up is 1.6x), `node $O/cwbench/split.mjs`, `node $O/cwbench/single.mjs exmars`, `node $O/cwbench/tournament.mjs 31 $O/sets/t80.json`, `node tools/tournament.mjs $O/sets/t80 --rounds 100 --seed 1 --jobs 31 --pmars $O/bin/pmars`, `node $O/cwbench/perpair.mjs $O/sets/t20.json` (pairings where we lose to exMARS).
4. Not timings: the first run of a native binary, and a build with statistics counters (`-DLOOP_STATS`-style), which looked 1.3% and 2.9% faster than the clean code. Time the clean build, alternating, 3 runs or more.
5. Instruction counts are exact and need no idle machine: sweep parameters with many native builds in parallel (`taskset -c <core>` each) and read the counts; time only the one or two candidates left.
6. Keep only if t20 and bench are faster beyond noise (ranges do not overlap, or a clear median shift over 7+7 runs), nothing else gets slower by more than 1%, and `engine-check` passes. Smaller, simpler code wins ties. Otherwise restore and rebuild.
7. Record, also when rejected: one row in the right table of `docs/performance-log.md`: `| idea and why it should help | measure before → after | kept / rejected (reason) |`. For a kept change update the "State" line, and the numbers in `PLAN.md` (Speed) and `README.md`.

## Profiles and the hot words

- Native profile: `node tools/bench-native.mjs <dir or --input file> --keep <dir>` leaves the binary (`clang -O3 -march=native` on `bench-native.c`, which includes `mars.c`) and `input.txt`; then `perf stat -e instructions,cycles,L1-dcache-loads,L1-dcache-load-misses,branch-misses <dir>/bench <dir>/input.txt early-tie` or `perf record`.
- Inputs: `node tools/tournament.mjs $O/sets/t20 --rounds 100 --seed 1 --native-input t20.in`, then `--input t20.in --early-tie` (same instruction count as the wasm tournament); corpus pairs: `tools/bench-pairs.mjs ... --native-input`. `--count <file>` writes executions per instruction word.
- Load addresses (which L1 misses hit the core): `perf mem` finds no event here; use AMD IBS: `perf record -e ibs_op/cnt_ctl=1/ -c 20011 -d <dir>/bench <dir>/input.txt early-tie`, `perf script -F addr,data_src`, match against `nm -S <dir>/bench` (`coreMem`, `queueMem`, `arena`). Failed store-to-load forwards: `ls_bad_status2.stli_other` also counts forwarded loads; the only site worth a change was `ADD.F`/`SUB.F` (log, fourth round).
- Re-ranking the 32 hot words for a new instruction mix: `node tools/bench-native.mjs --input <file> --early-tie --count <counts>` per mix, then `node tools/gen-dispatch.mjs --rank <count files>` prints a new `HOT` list. The set of cases moves V8's code by a few percent either way where the native build does not move (#10): measure in wasm.
