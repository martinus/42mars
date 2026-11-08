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
- To re-rank the hot words for a new instruction mix: `node tools/bench-native.mjs --input <file> --early-tie --count <counts>` per mix (inputs from `--native-input` of `tools/tournament.mjs` and `tools/bench-pairs.mjs`), then `node tools/gen-dispatch.mjs --rank <count files>` prints a new `HOT` list. Changes to the set of cases move V8's code by a few percent either way, also where the native build does not move (issue #10): measure in wasm, not natively.
- Two warriors with `maxCycles` up to 80000 run on linear queues without a mask (`mars_config()`): each tail stays at most `1 + 2 * (maxCycles + 1)` because a round runs at most `max(2 * maxCycles, 1)` instructions and a turn pushes at most two entries. Anything that lets a round run longer or a turn push more breaks that bound; the test "full queues at the linear queue limit and above" fills the queues.
- `runMatch({ firstRound })` plays a block of a match with empty p-space; blocks equal the whole match only when no warrior's code has `LDP` (`tools/tournament.mjs` checks that before it splits). Anything new that carries state from one round to the next breaks the split.
- `runMatch` early ties (process-count proof, no-killer scan, both at most 4096 instructions apart) must be exact: same scores and round results as without them. Any new early exit needs that proof written in the semantics doc, section 3.7.
- A speed change is kept only with numbers from the `perf-experiment` skill and an entry in `docs/performance-log.md`. Smaller, simpler code wins ties.
- Where the time goes, t20, per simulated instruction: wasm 66 x86 instructions, 17.8 cycles, 0.08 branch misses; native 46 instructions, 12.4 cycles (after the linear queues; the wasm numbers are from before). L1 data misses: about 0.15 per simulated instruction, 80 to 90% in the core, nearly all L2 hits; memory stalls are at most 12% of the slots, and a prefetch, split value/word arrays and a 6-byte cell did not pay natively (issue #6). Open leads: Liftoff time before V8 tiers up on short runs, V8 spills in the loop. Tie rounds are 36% (t20) and 47% (t80) of executed instructions; the exact tie proofs considered so far (state repetition, non-interaction) do not pay, see the log.
