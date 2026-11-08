---
paths:
  - "src/engine/wasm/**"
  - "src/engine/mars-wasm.js"
  - "tools/build-wasm.sh"
  - "tools/bench*.mjs"
  - "docs/performance-log.md"
---
# WebAssembly engine rules

- Build only with `tools/build-wasm.sh` (clang 22, `--target=wasm32 -Os -nostdlib`, no emscripten, no libc, no imports). It first regenerates `dispatch.h` from the `HOT` list in `tools/gen-dispatch.mjs`; both outputs are committed and two builds must be byte-identical (`md5sum`).
- Commit `mars.wasm` together with the C change it was built from.
- The same `mars.c` builds natively for `tools/bench-native.mjs` (`bench-native.c`, static arena). Keep it building: the native profile (`perf stat`, `perf record`) is the main tool for finding where time goes.
- Instruction code lives in `exec_ins()`. `step()` switches on the 14-bit instruction word: the 32 hottest words call `exec_ins()` with a constant word (specialized copies), the rest run it generically. Loops: `execute` (any number of warriors) and `execute2` (exactly two, counters in locals), instantiated as `execute2_8000` (core 8000, 8000 processes as constants) and `execute2_any`. A semantics change in `exec_ins()` reaches all of them; the test "every specialized instruction word agrees with mars.js" covers each specialized word in each loop.
- To re-rank the hot words for a new instruction mix: build `bench-native.c` with `-DCOUNT_INS`, then `node tools/gen-dispatch.mjs --rank <count files>` prints a new `HOT` list.
- `runMatch` early ties (process-count proof, no-killer scan, both at most 4096 instructions apart) must be exact: same scores and round results as without them. Any new early exit needs that proof written in the semantics doc, section 3.7.
- A speed change is kept only with numbers from the `perf-experiment` skill and an entry in `docs/performance-log.md`. Smaller, simpler code wins ties.
- Where the time goes, t20, per simulated instruction: wasm 66 x86 instructions, 17.8 cycles, 0.08 branch misses; native 47 instructions, 12.8 cycles. Open leads: Liftoff time before V8 tiers up on short runs, V8 spills in the loop. Tie rounds are 36% (t20) and 47% (t80) of executed instructions; the exact tie proofs considered so far (state repetition, non-interaction) do not pay, see the log.
