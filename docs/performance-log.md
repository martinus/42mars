# Simulator performance log

Every speed idea that was tried on the simulators, with how it was measured,
the result, and whether it was kept. Add new entries at the end of the
relevant section, also for ideas that did not help: a rejected idea with a
number saves the next person the experiment.

## How to measure

Machine for all entries so far: AMD Ryzen 9 7950X (16 cores, 2 threads per
core), Fedora, Node 22.22, clang 22. Numbers from a busy machine are marked.

| Name | Command | What it is |
|---|---|---|
| bench | `node bench/bench.mjs <corpus> [--headless\|--wasm\|--wasm-match]` | 3 hill pairs (agony/bubbles, bomber/chalk, army/bananasplit), 200 rounds each, 22,667,265 instructions, single thread. Report median and range of at least 7 fresh processes. |
| native | `node bench/bench-native.mjs <corpus> --runs 7`; A/B: `node bench/ab-native.mjs <A> <B> --input <file> --early-tie --cpu <n>` (a version is a copy of `lib/`, or a `mars.c`) | the library built natively as `make` builds it (`-O3 -fPIC`, the context in caller memory), since the sixth round the build that is tuned. Up to the fifth round "native" was `clang -O3 -march=native -DM42_FIXED_CONTEXT`, the wasm build's code natively (`--flags`) |
| corpus pairs | `node bench/bench-pairs.mjs <corpus> [--early-tie]` | 40 random corpus pairs (fixed generator, `--seed 1`), 30 rounds each, `runMatch`, single thread, 78,859,469 instructions; broader instruction mix than the bench. Before November 2026 an ad-hoc script with the same shape, so older corpus-pair numbers are relative only |
| t20 | `node tools/tournament.mjs <first 20 corpus files> --rounds 100 --seed 1 --jobs 1 --engine wasm` | 190 pairings, single thread, includes early ties |
| t80 | same with the first 80 corpus files, `--jobs 16` and `--jobs 31` | 3,160 pairings, the tournament number |

`<corpus>` is [n1LS/redcode-warriors](https://github.com/n1LS/redcode-warriors).

Paths: since 12th November 2026 the speed tools are in `bench/` (`bench.mjs`, `bench-pairs.mjs`, `bench-native.mjs` with `bench-native.c` and `input.h`, `native-input.mjs`, `tie-ceiling.mjs` with `tie-ceiling.c`, `wasm-functions.mjs`, `ab-*.mjs`) and `gen-dispatch.mjs` is in `lib/src/`. Commands in the entries below that date still use the old paths `tools/` and `lib/tools/`; older entries also name files of the JavaScript engines (`src/engine/...`, `js/...`) that are gone.

Correctness for every kept change: `npm test`, and `tools/pmars-diff.mjs` with
`--pmars-trace` (instruction count and core hash after every round against a
pMARS build) plus `--wasm-match` for the early-tie path, on fresh seeds.

Reference points on the bench: pMARS 0.9.5 native about 91M instructions/s;
the exMARS build of corewar.dev (WebAssembly) about 132M/s.

## JavaScript simulator (`src/engine/mars.js`)

Start: 31.9M instructions/s with visualizer bookkeeping (closures per step,
one method call per operand).

| Idea | Result | Verdict |
|---|---|---|
| One inlined loop, flat process queues (`Int32Array`, `warrior.queue` as a view), kills of non-last processes handled inside the loop (15% of bench instructions are deaths) | 31.9 → 33.1 | kept |
| `switch` on the whole opcode byte, no modifier decoding at run time | part of the step above; +10% vs a generic-modifier variant after all paths are compiled | kept |
| All per-cell arrays of one element type as views into one buffer (`u8`, `i8`, `i32`), the loop indexes the buffers at offsets. Reason: V8 pays a map check, length and data-pointer loads per typed array | 33.1 → 39.3 with bookkeeping, 51.4 → 59.7 headless; the largest single step | kept |
| Trace flags as literals, warrior record at fixed offsets in front of each queue, heat index as `warrior * stride + i` | about +1 each, near noise | kept |
| Ownership/territory/tWrite updates for one instruction in one place instead of 9 inlined copies | +10% after all paths are compiled | kept |
| Remove arithmetic in rarely taken branches of the loop prologue/epilogue (one caused 24 deoptimizations at the same spot) | more stable timings | kept |
| `headless: true` option without visualizer bookkeeping | 40.8 → 60.3 | kept, opt-in |
| Lazy reads of operand values | 0 to −2% | rejected |
| `\|0` on index arithmetic | 22 fewer machine instructions per step, same cycles | rejected |
| Integer heat counters flushed into the `Float32Array` | 0 | rejected |
| Local copies of module constants | 0 | rejected |
| `if` fast paths for the `$` mode | 0 | rejected |
| Compact shared addressing-mode code | −2% | rejected |
| Shared helper functions to pool type feedback | slower | rejected |
| Moving warrior record fields onto separate cache lines | 0 | rejected |
| Warm-up of all paths at module load | +17% on the bench, but 6 to 15 ms per import, hidden work, and a deoptimization loop when a path was missed | rejected |

State after this work: about 40M/s with bookkeeping, 61M/s headless (bench,
fresh process); 51M/s and 75 to 80M/s after JIT warm-up. Remaining cost:
about 280 machine operations per simulated instruction headless, mostly V8's
per-access overhead on typed arrays (bounds checks, data-pointer arithmetic,
spills).

## WebAssembly simulator (`src/engine/wasm/mars.c`)

Numbers are bench, `runMatch`, M instructions/s (native in parentheses where
measured).

| Idea | Result | Verdict |
|---|---|---|
| First version: 8-byte packed cell, dispatch on the opcode byte, 16-bit ring queues | 125 (native 163) | baseline |
| One combined dispatch on both modes (64 cases) | 116 (native 137) | rejected |
| Native profile: about 100 x86 instructions per simulated instruction, IPC 3.7, 0.1 branch misses per instruction, so the limit is work per instruction, not misprediction | | finding |
| One countdown instead of separate count, time and cycle counters | no change (native 171) | kept |
| Warrior record padded to 128 bytes: indexing is a shift instead of a multiply by 72, on the loop-carried path `cur -> war[cur].next` | 147 | kept |
| Following a next-warrior pointer instead of an index | 154 | kept |
| Modes `$` and `#` tested before the mode switch | 181; +23% on corpus pairs | kept |
| Mode tests in measured frequency order (A: `$` 80%, `#` 9%, `<` 7%; B: `$` 57%, `<` 29%, `#` 9%) | 184, within noise | kept |
| `MOV.I` fast path checked first | 187; +8% on corpus pairs | kept |
| B values read only inside the cases that need them (saved values only for post-increment B modes) | 191 | kept |
| Two copies of the opcode switch to skip B reads for DAT/SPL/JMP/MOV | −3% | rejected |
| Renumbering opcodes so that DAT and SPL share a bit test | no gain with a switch on the opcode byte | rejected |
| Early tie, process-count proof: stop when no warrior can lose its last process in the remaining budget (`ceil(cyclesLeft / warriorsLeft)` turns; off when any warrior has `STP`; at least one more instruction always runs) | +2.6% on the bench, +1% on tie-heavy corpus pairs | kept, `runMatch` only |
| Branch-free indirect modes | 160 | rejected |
| SPL fast path | 188 | rejected |
| 32-bit queue entries | no change | rejected |
| `-O2` instead of `-O3` | no change | rejected |
| Early tie, no-killer proof, counted in `MOV.I` (count DAT cells on every opcode write) | same skip, but −5.5% per instruction on the bench, −8% on corpus pairs; t20 unchanged at 6.51 s | rejected |
| Early tie, no-killer proof, by scan: at each tie check (every 4096 instructions) look for a `DAT`/`DIV`/`MOD`/`STP` cell, starting at the last one found; none in a full circle proves the tie | t20 6.54 → 5.83 s single thread; `acme.red` vs `alpha.red` 50.7 → 13.1 ms; bench unchanged (its battles keep DAT cells) | kept, `runMatch` only |
| Separate loop for exactly two warriors with both queues' head/tail in locals, unrolled into warrior 0's and warrior 1's turn | bench same, corpus pairs +1 to 3%, t20 −2.7%, native 236 → 253 | kept |

### Second round (November 2026)

Same machine. Load average 0.2 to 3 during single-thread runs (a 1-core
background compile ran during some of them; marked where it mattered), each
number the median of 5 or 7 fresh processes with the range in parentheses.
"bench / pairs / t20" means the bench and corpus pairs in M instructions/s
(`runMatch` without early tie) and t20 in seconds; wasm unless marked
native. Variants were built as separate files from the same source and
copied over `mars.wasm` for the measurement. Instruction frequencies:
`bench-native.c` built with `-DCOUNT_INS`, over t20, t80, 400 random corpus
pairs (`bench-pairs` generator, 30 rounds) and the bench, each weighted
equally (`node tools/gen-dispatch.mjs --rank`).

Before and after, all with the scripts above, 7 runs each (load 0.2 before,
5.8 falling at the start of the final run):

| Benchmark | Before | After | Change |
|---|---|---|---|
| bench, wasm | 190.9 (189.0–191.7) | 281.4 (279.7–282.9) | +47% |
| bench, native (`bench-native.mjs`, `-O3 -march=native`) | 254.7 (253.4–257.3) | 415.0 (402.1–416.9) | +63% |
| corpus pairs | 194.8 (190.6–195.7) | 267.6 (264.0–268.6) | +37% |
| corpus pairs `--early-tie` (effective rate) | 212.4 (211.6–213.0) | 293.5 (290.0–296.2) | +38% |
| t20, 1 job | 5.83 s (5.80–5.94) | 4.12 s (4.09–4.19) | −29% |
| t80, 16 jobs | 5.32 s (5.31–5.35) | 3.85 s (3.82–3.88) | −28% |
| t80, 31 jobs | 4.74 s (4.72–4.76) | 3.45 s (3.44–3.49) | −27% |
| module size | 24,196 bytes | 50,829 bytes | |

Findings before changing anything:

| Measurement | Result |
|---|---|
| Instruction words (opcode, modifier, A mode, B mode) executed | t20: 43 distinct, the top 8 are 74% of all executions, top 32 99.9%; t80: 62, top 32 97.6%; 400 corpus pairs: 94, top 32 96.6%; bench: 26. Top over all four: `spl.b $ <` 15%, `mov.i $ <` 11%, `spl.b $ $` 10%, `mov.i $ $` 10%, `jmp.b $ $` 7.5%, `jmp.b $ <` 4.7%, `dat.f < <` 4.3%, `add.ab # $` 4.1% |
| Round start (core clear, warrior copy) | 0.27% of native t20 time (`perf`), about 0.6% of wasm samples; the clear already compiles to unrolled 64-bit stores |
| Tier-up | V8 runs a function in Liftoff (about 109M/s on the bench) until its optimized code is ready. Bench before: 10.5% of the samples in Liftoff code, TurboFan needs 10 ms for `run_some`. `--no-liftoff` made the bench slower (174.8 vs 190.1), `--liftoff-only` 108.9 |
| V8 code of the instruction loop (`perf` with `--perf-prof`) | a stack check per loop iteration, `head`/`tail`/`left` spilled to the stack, and a dispatch variable tested on every iteration: the jump into the second turn (`goto turn1`) made the loop irreducible |
| Per simulated instruction, t20, final code | wasm 66 x86 instructions, 17.8 cycles, 0.081 branch misses; native 47, 12.8, 0.069. Top-down, wasm: retiring 61%, backend bound 21% (memory 18%), bad speculation 7%, frontend 11%; native 57 / 15 / 7 / 20 |

Kept, in the order they were added (wasm bench / pairs / t20):

| Idea | Result | Verdict |
|---|---|---|
| Hot instruction words specialized: `step()` switches on the instruction word with one case per frequent word, each case calls the generic `exec_ins()` with the word as a constant, so clang compiles a copy without mode and opcode branches; other words run the generic code. Cases generated by `tools/gen-dispatch.mjs` into `dispatch.h` | 16 cases 233.9 / 226.1 / 4.74; 32: 241.2 / 231.9 / 4.73 (native 397 / t20 331); 64: 232.3 / 230.7 / 4.81. Native t20 per simulated instruction: 83 → 52.7 x86 instructions, 18.9 → 13.5 cycles, branch misses 0.074 → 0.071 | kept, 32 cases |
| Core and the first two queues at fixed addresses (static arrays, queues up to 65536 entries), so the loop addresses them with constant offsets | 246.1 / 232.5 / 4.77; on the final code without it 265.0 / 253.4 / 4.30 against 277.6 / 260.0 / 4.23 | kept |
| Core size 8000 and 8000 processes as constants in a second instance of the two-warrior loop (`execute2_8000()`) | 239.0 / 240.6 / 4.48, native bench 409, t20 359; the bench lost because the larger function stayed longer in Liftoff (TurboFan 24 ms) | kept with the next row |
| Each loop instance its own non-inlined function, so V8 optimizes only the one in use | 262.4 / 247.0 / 4.49; TurboFan 8 ms | kept |
| Single-entry loop: when warrior 1 is to move, `execute(1)` runs that instruction first, then the loop starts with warrior 0 | 276.7 / 256.1 / 4.27. On the old code alone: 198.8 / 200.3 / 5.71 (native 258 / t20 240) | kept |
| `-Os` instead of `-O3` for the wasm build (native stays `-O3`, where `-Os` is slower: 380 / t20 339 against 417 / 351) | 282.2 / 266.7 / 4.13 against 277.2 / 259.3 / 4.25 in the same session | kept |
| With `-Os`, 24, 40 and 48 cases instead of 32 | 273.2 / 255.8 / 4.26; 277.1 / 263.0 / 4.24; 272.4 / 261.4 / 4.26 | 32 kept |

Rejected:

| Idea | Result | Verdict |
|---|---|---|
| Fully generated switch: one case per opcode, modifier, A mode and B mode (8,512 cases, `gen-dispatch.mjs --full`) | wasm 4.3 MB; TurboFan needs 2.0 s and 574 MB for the loop function, so the bench runs in Liftoff: 34.2, 1000-round bench 44.7, pairs 37.0, t20 6.99 s. Native (1.5 MB binary, 14 to 26 minutes of clang): bench 240, t20 253, pairs 257 against 397 / 331 / 337 for 32 cases; t20 50.5 instructions per simulated instruction but IPC 2.8 and 0.14 branch misses per instruction (one indirect jump for all words); L1 instruction cache misses negligible (70,000 in the whole run) | rejected |
| Partial switch: one case per opcode, modifier and B mode (1,064 cases, A mode as run-time branches), alone and as fallback behind the 32 hot cases | alone: 2.5 MB, 62.5 / 103.8 / 5.41 (1000-round bench 127; TurboFan 0.5 s); behind the hot cases: 2.5 MB, 72.0 / 111.2 | rejected |
| Hot words through a table: `u8` index per instruction word (16 KB, filled at run time), then a dense switch | 32 cases 183.8 / 204.5 / 5.46, 64 cases 184.0 / 203.7 / 5.43; native bench 283, t20 279 with 32; native t20 47.5 instructions and 15.8 cycles per simulated instruction, branch misses 0.071 → 0.138 | rejected; the compare tree of the sparse switch is predicted better |
| The hot cases as an `if` chain in frequency order | clang turns the chain into the same switch (identical module) | no difference |
| Threaded code with wasm tail calls: a handler per hot word plus a generic one, each ends in `return_call_indirect` through a 16384-entry table (`-mtail-call`, `musttail`), state in 5 parameters (queue counters packed into 64 bits, the instruction budget and the next PC in one) | 41 KB, 116.8 / 112.6 / 9.42; with `--no-liftoff` 119 on a 1000-round bench. V8 checks table bounds and signature, tears down a frame and passes a parameter on the stack per dispatch. Native with `musttail`: 342 / t20 310 / pairs 299, with `preserve_none` 352 / 338 / 315, against 408 / 357 / about 340 for the switch | rejected |
| Native PGO (`-fprofile-instr-generate`, trained on 400 corpus pairs and t20) | native, old code: bench 254 → 279, t20 236 → 261, pairs 225 → 252; final code: 409 → 438, 350 → 375, 352 → 366 | native only, not used |
| The native profile applied to the wasm build (`-fprofile-instr-use`, the function hashes match) | 276.1 / 259.3 / 4.22 against 277.6 / 260.0 / 4.23: V8 does its own block layout | rejected |
| Binaryen `wasm-opt` 125 (npm, build-time only) `-O3` / `-O4` with all features enabled (clang 22 already emits bulk memory) | 50,570 / 50,760 bytes instead of 54,080; 266.5 / 248.9 / 4.40 and 266.9 / 252.6 / 4.38 against 277.9 / 260.2 / 4.21 | rejected |
| `-msimd128` (vector stores for the core clear) | 276.7 / 260.5 / 4.21 against 277.6 / 260.0 / 4.23 | rejected, no change |
| `-O2`; `-Oz` | 275.8 / 258.8 / 4.22; 172.9 / 182.6 / 6.55 | rejected |
| `-flto` | one translation unit, nothing to optimize across | not tried |
| Queue head and tail packed into one 64-bit counter per warrior (two registers fewer) | 266.0 / 250.5 / 4.46; native t20 361 against 348 | rejected for wasm |
| Loop unrolled twice (four turns per iteration, to halve stack checks) | 92 KB, 249.5 / 245.5 / 4.43; native 393 / t20 341 | rejected |
| One turn per iteration, the two warriors' counters swapped (half the code) | 36 KB, 257.3 / 233.0 / 4.63; native 365 / t20 312 | rejected |
| Generic code in its own non-inlined function, returning the new tail and the death flag | 31.8 KB, 280.9 / 253.4 / 4.38 | rejected |
| Two independent battles interleaved in one loop (A0 B0 A1 B1), native experiment with per-battle state swapped in and out at round ends; same 1,229,398,600 instructions as the sequential run on t20 without early tie | 290 against 350M/s sequential: +18% instructions, branch misses 0.064 → 0.104 per instruction (the two instruction streams share the predictor's history), IPC 3.79 against 3.89. In wasm the four queues and two cores would also add register pressure | rejected, not built for wasm |
| Round start with `memory.copy` from a pristine core, or clearing only written cells | not built: the whole round start is 0.3 to 0.6% (findings above), dirty tracking would cost in every write | rejected |
| Early-tie check interval at most 1024 or 16384 instead of 4096 | t20 4.26 and 4.24 against 4.23 | rejected, no change |
| Warm-up call at module compile time to reach TurboFan sooner (the final bench still spends 12.6% of its samples in Liftoff code) | hidden work at import, like the rejected JavaScript warm-up; irrelevant for runs of seconds | not done |

Early termination for `runMatch` (idea: more exact tie proofs). Potential,
measured natively with the old engine:

| Measurement | t20 | t80 |
|---|---|---|
| Rounds won / tied | 15,782 / 3,218 | 252,754 / 63,246 |
| Instructions in won rounds | 714.5M | 8,637.7M |
| Instructions in tie rounds if simulated fully (all ties run to 160,000 cycles) | 514.9M | 10,119.4M |
| Executed in tie rounds with the existing proofs | 396.0M (36% of all executed) | 7,696.9M (47%) |
| Tie rounds the existing proofs never stop | 750 | |

The uncaught tie rounds look like this: a paper with thousands of
processes against a scanner or stone with 1 to 30 processes in a closed
loop (`cmp`/`jmp`, `mov`/`djn`), with 4,000 to 7,500 DAT cells left in the
core; or two warriors with 30 to 3,000 processes each running `mov` loops.
Exact proofs considered:

| Proof | Result | Verdict |
|---|---|---|
| Repeated full state (core, both queues in order, whose turn; then the round is periodic and must tie, and only `cyclesLeft mod period` more instructions would be needed even for an exact final core). Measured offline with an incrementally maintained hash at every instruction | repeats in 295 of 3,218 t20 tie rounds; with ideal, immediate detection it skips 22.2M instructions, 6.5M more than the existing proofs (0.6% of t20). The engine would have to update the hash on every core write and queue operation, and the DAT counter in `MOV.I` alone cost 5 to 8% | rejected |
| Non-interaction: no process of one warrior can reach the other's code | needs a bound on the cells a warrior can write or execute in the rest of the round; indirect modes take addresses from core data and papers copy themselves anywhere, so there is no cheap exact bound | rejected |
| No DAT on any future path of the few-process warrior | its control flow depends on core data the other warrior writes; deciding it is simulating it | rejected |
| Repetition up to a rotation of the core | the other warrior's code does not move, so the states are not equal | rejected |

State: bench about 281M/s in WebAssembly, about 415M/s natively; corpus
pairs 268M/s; t20 4.12 s single thread; t80 3.85 s with 16 jobs and 3.45 s
with 31 jobs. The WebAssembly layer costs about 32% against native (the
specialized code gained more natively). Next candidates: the remaining
Liftoff time of short runs, and V8's spills in the loop.

### Measurements after the second round

Same machine, idle, after the second round was merged. Scripts in
`$COREWAR_ORACLE/cwbench/` (`benchpairs.mjs`, `split.mjs`).

| Measurement | Result |
|---|---|
| Warm-up in the bench: the 3 bench pairs one by one, best of 5 (warmed up), ours `runMatch` without early tie against corewar.dev exMARS | agony/bubbles 307 vs 190M/s (1.62x), bomber/chalk 259 vs 134 (1.93x), army/bananasplit 310 vs 186 (1.67x). `tools/bench.mjs` (281) and `cwbench/single.mjs` (132) time one short run from a fresh process, so their 2.1x includes V8's warm-up, and exMARS warms up slower. Compare engines on tournaments |
| t20 split by tie rounds, ours vs exMARS, single thread | 37 pairings without tie rounds (same 128M instructions in every engine): ours 416 ms (308M/s), exMARS 667 ms, 1.60x. 153 pairings with 3,218 tie rounds: our early ties cut 1,101M to 983M instructions; ours 3,569 ms, exMARS 5,448 ms (1.53x), against ours without early tie 1.38x: exMARS skips tie work too |
| Tournament scaling, t80 31 jobs | 101.6 CPU-s in 3.56 s wall (28.5 threads busy), 161M/s per hardware thread, about 320M/s per core: the same as one thread alone. The tournament is bound by single-core speed |
| Fixed cost of `tools/tournament.mjs`, t80 with `--rounds 1`, 31 jobs | 0.26 s engine time, 5.5 CPU-s: every worker assembles all 80 warriors and compiles the module. About 7% of the full t80 (issue #5) |
| Load balance, t80 | largest pairing 16M instructions, 605M per worker with 31 workers: the tail is below 3% |
| Native, bench pairs, 2000 rounds, `perf stat` | per simulated instruction: 44 x86 instructions, 10.8 cycles, 0.13 L1 data cache misses (1.9% of loads), 0.044 branch misses. The 8000-cell core is 64 KB, L1d is 32 KB (issue #6) |
| Repeated start positions within a pairing | 100 rounds drawn from 7,801 positions repeat about 0.6 times per pairing (0.6% of rounds); p-space and the first mover differ anyway. Not worth caching |

### Third round (November 2026)

Same machine, Node 22.22, one experiment per issue. A/B in the same
session, baseline and variant runs alternating, fresh process per run, median
and range. Load average 1 to 3 at the start of a series (a desktop browser
open, no other node or clang process), up to 9 at the end of the t80 series
from the runs themselves.

| Idea | Result | Verdict |
|---|---|---|
| `tools/tournament.mjs`: assemble every warrior once in the main thread (it already did, to skip broken files, and threw the result away) and send the assembled code to the workers; compile `mars.wasm` once and pass the `WebAssembly.Module` in `workerData` (issue #5) | fixed cost (t80, `--rounds 1`, 31 jobs) 0.26 s (0.25–0.27), 5.72 CPU-s → 0.15 s (0.14–0.15), 3.17 CPU-s; t80 16 jobs 3.98 (3.94–3.98) → 3.90 (3.88–3.92); t80 31 jobs 3.57 (3.56–3.58) → 3.45 (3.44–3.46); t20 1 job 4.14 (4.10–4.27) → 4.14 (4.11–4.20). The saving is the assembly (9 to 27 ms per worker for 80 warriors). V8 already shared the compiled code before: its native module cache finds identical module bytes across the workers of one process, and `--trace-wasm-compilation-times` shows the same 4 TurboFan compilations for the whole run with and without the change, so tier-up happens once per process, not per worker. What is left of the fixed cost is mostly worker start: 31 empty workers take about 100 ms | kept |
| Specialized cases for classes of instruction words that `exec_ins()` runs the same way, one copy per class with every member word as a case label on `EXEC(canonical word)` (issue #10). Classes, each checked against a case of `exec_ins()`: `DAT` and `NOP` ignore the modifier and, for both modes, `# $ @ *` are one mode (they only read, and neither operand is used); `SPL` and `JMP` ignore the modifier and the B operand is unused; `JMZ`/`JMN`/`DJN` .A = .BA, .B = .AB, .F = .X = .I; .F = .I for `ADD` to `MOD` and `SLT`; `CMP` = `SEQ`; `LDP`/`STP` .F = .X = .I = .B. Exact, because `exec_ins()` only branches on its word argument, and the words it copies or compares come from the core. Counts with early ties (`tools/bench-native.mjs --count`): the top 32 classes leave to the generic path 1.03% of t20 (32 words today: 1.32%), 1.82% of t80 (3.00%), 2.85% of 400 corpus pairs (4.07%), 0.01% of the bench | wasm bench / pairs / t20 / t80 31 jobs, against 276.7 / 266.4 / 4.15 / 3.45 for the 32 words: A, every member word of the top 32 classes as a label (308 labels, 55,580 bytes): 254.8 / 240.0 / 4.54 / 3.83; B, only the member words that were executed (41 labels, 52,754 bytes): 269.7 / 256.1 / 4.28 / 3.56; C, the 32 words of today with the 3 duplicates (`spl.b $ $`/`spl.b $ #`, `jmp.b $ $`/`jmp.b $ #`, `dat.f $ $`/`dat.f # #`) merged into 29 copies (50,312 bytes instead of 50,829): 272.5 / 251.0 / 4.22 / 3.54. All ranges apart from the baseline on pairs and t80. Clang emits the same compare tree for C as for the baseline. Natively, t20, 3 runs each: baseline 351 to 356, B 355 to 357, C 341 to 354. So the cost is in V8's code for the larger or merged cases, not in the dispatch; the generic path saves less than that | rejected |
| `MOV.I` from one 64-bit snapshot of the A cell (issue #9): `exec_ins()` reads the whole 8-byte A cell at operand time, at the same moment it read the A and B values before; `MOV.I` stores it with one 64-bit store, `CMP.I`/`SEQ.I`/`SNE.I` compare its word. Exact because only the B operand's side effects run between the read and the write, and they change value fields only; the padding is always zero | bench 276.6 (269.8–280.4) → 279.0 (274.5–283.2), repeated with 15 runs each: 278.0 (273.0–281.2) → 277.2 (272.4–282.6); pairs 263.6 (259.0–266.8) → 278.7 (274.8–281.2); t20 4.14 (4.11–4.21) → 4.01 (3.94–4.14); t80 16 jobs 3.89 → 3.81, 31 jobs 3.46 → 3.38 (ranges apart). Native unchanged: bench 406 → 407, t20 343 → 345. Module 50,829 → 50,082 bytes. So the gain is in V8's code (a word load and two 16-bit stores fewer per `MOV.I`) and in the tournament mix; the bench does not move | kept |
| One queue ring for both warriors with one shared head (issue #9, measured on top of the snapshot): warrior 0 at the even and warrior 1 at the odd positions, set at round start so that the first mover pops first; at warrior 0's turn warrior 1's head is warrior 0's plus 1, so `execute2()` carries one head `h`, which also counts the instructions (`h == end`), and the two tails: 3 loop-carried counters instead of 5. `execute()`, `tie_check()`, the process listing and the SPL limit work in positions with a step of 1 or 2 | bench 276.5 → 270.4, pairs 280.0 → 268.7, t20 4.03 → 4.22, t80 16 jobs 3.79 → 3.94, 31 jobs 3.38 → 3.55. Native t20 350 → 347, per simulated instruction 47.2 → 48.5 x86 instructions, 12.8 → 12.9 cycles: the death tests against `h + 2`, `h + 3` and the bookkeeping at the loop exit cost more than the two counters save | rejected |
| Linear queues for two warriors (issue #9, the variant of the row above, on top of the snapshot): with two warriors a round runs at most `max(2 * maxCycles, 1)` instructions with alternating turns, so a warrior gets at most `maxCycles + 1` turns and pushes at most two entries per turn; its tail stays at most `1 + 2 * (maxCycles + 1)`. For `maxCycles` up to 80,000 both queues are static arrays of 160,032 entries (640 KB together instead of 256 KB of rings), the counters reset every round, and the queue mask is all ones, which `execute2_8000()` drops. More cycles or more warriors keep the rings | hack first: bench 276.9 → 294.5, pairs 278.3 → 282.2, t20 4.01 → 3.81, t80 16 jobs 3.77 → 3.62, 31 jobs 3.38 → 3.24, native t20 354 → 365. Pushes into fresh cache lines did not show: native L1 misses per simulated instruction 0.15 → 0.16 | kept |
| Both kept rows of issue #9 together, final code against `main` | bench 277.7 (267.8–282.7) → 294.0 (288.9–298.4); pairs 265.1 (263.5–266.3) → 280.2 (274.1–286.6); t20 4.16 (4.12–4.20) → 3.84 (3.80–3.87); t80 16 jobs 3.91 (3.88–3.99) → 3.63 (3.59–3.66); 31 jobs 3.50 (3.48–3.52) → 3.28 (3.27–3.34). Native bench 412 → 413, t20 353 → 362; per simulated instruction on t20 47.1 → 46.3 x86 instructions, 12.8 → 12.4 cycles, 0.07 branch misses | |
| Core layouts with fewer L1 misses (issue #6). Measured first, natively (`tools/bench-native.mjs --keep`, `perf stat`), per simulated instruction: bench pairs with 2000 rounds 43.4 x86 instructions, 10.6 cycles, 0.143 L1 data misses (2.2% of loads), 0.046 branch misses; t20 46.3 / 12.4 / 0.157 / 0.070; 40 corpus pairs 46.4 / 13.0 / 0.166 / 0.080; t80 46.0 / 11.8 / 0.152 / 0.058. Where the misses go (IBS op sampling, `perf record -e ibs_op/cnt_ctl=1/ -d`, data address against `coreMem`/`queueMem`): t20 88% core, 2% queues; t80 79% core, 3% queues, 14% other (stack, warrior records); corpus pairs 91% core; nearly all are L2 hits. Top-down, t20 / corpus pairs: retiring 58% / 56%, frontend bound 20% / 21%, backend bound 14% / 15%, of that memory 12.4% / 12.8% (which includes waiting for L1 hits): the ceiling for any layout. Then three cheap probes, native, 5 runs each alternating, t20 / 40 corpus pairs / bench 2000 rounds against 359 to 363 / 345 to 348 / 423 to 429M/s: prefetch of the other warrior's next cell before each instruction in `execute2()` (`__builtin_prefetch`, no WebAssembly equivalent): 362.2 / 344.4 / 423.7, misses 0.159 → 0.160, cycles 12.35 → 12.54; values and instruction words in separate arrays (32 KB + 16 KB): 359.8 / 351.4 / 429.2, misses up to 0.180 (a fetch touches two lines), 48.3 x86 instructions; 6-byte cell (48 KB, the padding dropped, the snapshot read as 4 + 2 bytes): 352.9 / 339.5 / 412.0, misses 0.147 (−8%), 47.6 x86 instructions, 12.76 cycles. Removing misses gains less than the extra instructions of a denser cell cost, so the 4-byte cell (13-bit fields, word table, shifts and masks on every field access, table dispatch measured slower before) was not built | rejected, not built for wasm |
| Rounds of one pairing in parallel when no warrior has `LDP` (issue #8): `runMatch({ firstRound })` plays a block of a match's rounds (generator stepped `firstRound` times, first mover `firstRound mod warriors`, p-space empty), and `tools/tournament.mjs` splits each pairing without `LDP` into blocks when it has fewer than 4 pairings per job. Full tournaments are unchanged (t20 with 31 jobs and t80 have enough pairings) | one pairing, `--rounds 1000`, `--jobs 1 / 4 / 16 / 31`: agony/bubbles 0.23 / 0.10 / 0.08 / 0.14 s, army/bananasplit 0.20 / 0.09 / 0.08 / 0.13 s (5 runs, ranges within 0.01; worker start, about 100 ms for 31 workers, is most of it); `--rounds 10000`: agony/bubbles 1.82 / 0.51 / 0.20 / 0.20 s, army/bananasplit 1.51 / 0.43 / 0.17 / 0.18 s, so 3.6 times on 4 workers and 9 times on 16. Same instruction counts as unsplit, `--pmars --compare` SAME | kept |

### Against rmars (8th November 2026)

On Martin's request this session lifted the clean room for rmars only: it
read rmars's source to find out how to drive it, built it and timed it. It
wrote no engine code afterwards. rmars: github.com/clrsrc/rmars, commit
215fadc, GPL-2.0, Rust 1.99.1, release profile (fat LTO, one codegen unit),
plus a second build with `RUSTFLAGS="-C target-cpu=native"`. Driven through
its Python module (`fight_matrix`, rayon pool, GIL released, timed around
the one call, assembly included); ours with `$COREWAR_ORACLE/cwbench/rmars/ours.mjs`
(worker threads as in `tools/tournament.mjs`, timed incl. worker start and
compile). Same rounds on both sides: rmars seeds each pairing from the
warriors' checksum (pMARS `-f`), and ours gets the generator state recovered
from rmars's first four positions. 100 rounds, 5 alternating runs, median
(range); load average 0.9 at the start, a few minutes after other runs.

| Workload | rmars | rmars native | ours, early ties | ours, no early ties |
|---|---|---|---|---|
| t20 positions of rmars, 1 thread (1,232.8M instructions simulated) | 6.96 (6.84–6.99) | 6.72 (6.68–6.81) | 3.81 (3.77–3.84) | 4.05 (4.04–4.14) |
| t80, 16 threads (18,718M simulated) | 6.78 (6.72–6.83) | 6.47 (6.45–6.48) | 3.44 (3.44–3.46) | 3.93 (3.86–3.95) |
| t80, 31 threads | 5.95 (5.93–6.04) | 5.64 (5.34–5.65) | 3.10 (3.08–3.13) | 3.46 (3.45–3.46) |
| t80, 32 threads | 5.43 (5.42–5.47) | 5.11 (5.10–5.62) | 3.09 (3.09–3.12) | 3.45 (3.44–3.46) |
| t80, 31 threads, rmars statistical stop (width 60, min 20 rounds; approximate) | | 2.75 (2.65–2.79) | | |

Single thread: rmars 177M, native build 184M, ours without early ties 304M
simulated instructions per second (1.66 to 1.72 times); with early ties ours
executes 1,116M of the 1,233M. rmars gains 10% from thread 31 to 32 (rayon),
ours nothing. What rmars does, from its source, as descriptions: 8-byte cell
with u16 values, opcode, both modes and a predecoded mode-pair index (a
64-way dispatch on the mode pair, which our log measured slower for us),
`MOV.I` as one 8-byte copy, a software prefetch, process queues as in pMARS,
no early ties of any kind; its `elapsed` per round is pMARS's `cycles2 -
cycle`, which after a death includes the cycle adjustment, so it is not the
instruction count.

Results: t20 identical wins, losses and ties in all 190 pairings. t80: 46
of 3,160 pairings differ, every one with `asianflu.red`. With an explicit
start position pMARS 0.9.5 and rmars mostly agree (`-F 1234`, `4000`,
`7000`), but e.g. `pmars -b -k -r 2 -F 1854 aa.red asianflu.red` plays round
2 (position 7400, asianflu first) as a tie with `aa` keeping 1 process, as
ours does, while `rmars -r 2 -F 1854` has `aa` die at step 134,308. Not
traced further: either pMARS 0.9.6-dev changed something that asianflu hits,
or rmars has a bug. Under `-f`, pMARS 0.9.5 also seeds differently from
rmars for this warrior (aa vs asianflu: pMARS 24/67/9, rmars 25/59/16).

The shape of the benchmark in the rmars author's blog post
(dm2tim.de/offtopic/core-war.html: "1101 Gegner à 200 Runden ... 3,5
Sekunden", hardware not stated, parallel, early stopping mentioned): one
warrior (`agony.red`) against the 564 other corpus warriors that rmars
assembles, 200 rounds each, 112,800 rounds, 6,794M instructions simulated
(`cwbench/rmars/batch.py`, then `ours.mjs` on the same rounds). Identical
wins, losses and ties in all 564 pairings. 5 alternating runs, median (range):

| | 1 thread | 32 threads |
|---|---|---|
| rmars | 34.68 (34.30–34.98) | 2.02 (2.00–2.03) |
| rmars native | 35.25 (34.94–35.50) | 1.93 (1.92–1.94) |
| ours, early ties (6,590M executed) | 21.17 (21.09–21.58) | 1.50 (1.49–1.50) |
| ours, no early ties | 21.84 (21.63–22.06) | 1.53 (1.53–1.54) |
| rmars native, statistical stop (width 60, min 20; 32,063 rounds played) | | 0.55 (0.54–0.55) |

So about 58,000 rounds per second for rmars without the stop here, which
puts the blog's 220,200 rounds at about 3.8 s on this machine. Ours is 1.6
times as fast on one thread, 1.3 times on 32: rmars scales 17 times from 1
to 32 threads, ours 14 times. Our worker start (about 0.1 s) and the tail
cost the difference: 564 pairings on 32 workers do not trigger the block
split of #8, so the last long pairings run alone.


### Against fmars (8th November 2026)

fmars 0.0.207 (Michal Janeczek, 2005, GPL): C generated by Scheme code
with a case for every instruction word it is generated for, a handler
pointer in every core cell and computed gotos; no p-space. Same session as
the rmars benchmark, clean room lifted by Martin; the clean-room hook still
blocked reading fmars's C source, so only its README and configuration file
were read, and the build output stayed out of the session. Built from the
unmodified tarball: code generation needs Guile 1.6 era macros (Guile 2.2
fails), so it ran with Guile 1.8.8 in a Debian 8 container, for the 109
instruction words of the corpus; the generated C was compiled on the host
with GCC 16, `-O2` (its Makefile) and `-O3 -march=native` (same speed). Its
own assembler rejects many corpus warriors, so it gets `pmars -A` output.
Results: identical wins, losses and ties to ours (`tools/tournament.mjs
--pmars xfmars --compare`) on all t20 and t80 pairings and on the bench pairs.

Per thread, 3 bench pairs with 2000 rounds each in one process (224.0M
instructions), 5 runs, median: pMARS 0.9.5 2.53 s (88M/s); fmars 0.66 s
(340M/s); ours wasm, fresh process with compile and warm-up, 0.69 s
(327M/s); ours native C (`bench-native`) 0.52 s (432M/s). Per simulated
instruction (`perf stat`, same run):

| | x86 instructions | cycles | branches | branch misses | L1 loads | L1 misses |
|---|---|---|---|---|---|---|
| fmars | 40.0 | 13.3 | 3.1 | 0.10 | 13.7 | 0.32 |
| ours native | 45.3 | 10.4 | 7.4 | 0.04 | 8.0 | 0.14 |
| ours wasm (whole process) | 63.6 | 16.0 | 9.5 | 0.07 | 12.1 | 0.18 |

Tournaments, our seed-1 positions, 5 alternating runs, median; fmars as one
process per pairing through `xargs -P` (`cwbench/fmars/fmx.sh`), "start" =
the same with 1 round per pairing:

| | ours wasm | fmars | fmars start |
|---|---|---|---|
| t20, 1 job | 3.81 (3.79–3.88) | 4.06 (4.04–4.07) | 0.19 |
| t80, 16 jobs | 3.54 (3.52–3.55) | 3.94 (3.93–3.99) | 0.98 |
| t80, 31 jobs | 3.19 (3.19–3.21) | 2.88 (2.87–2.90) | 0.95 |

With an in-process driver for fmars (written against `fmars.h`: assemble,
bind, then per round clear, load, simulate; same positions and first movers),
5 alternating runs, median: t20 on 1 thread fmars 3.81 (3.77–3.82) against
ours 3.82 (3.77–3.87); t80 split into 160 shards on `xargs -P` 16 / 31 / 32:
fmars 3.86 / 2.91 / 2.88 against ours 3.54 / 3.19 / 3.18. So the process
starts were not the reason; the numbers below hold.

fmars wins t80 on 31 jobs by 10%, although it simulates every tie round to
the end (ours executes about 13% fewer instructions with early ties): from
16 to 31 jobs fmars gains 37%, ours 11%. Ours natively (`bench-native` on
t80 split into 16 and 32 processes, static shards): 3.00 s and 2.47 s, a 22%
gain and faster than fmars. 31 separate Node processes instead of 31 worker
threads: 3.33 to 3.41 s against 3.10 to 3.11 s, so the threads are not the
cause; the WebAssembly code itself leaves less for the second hardware
thread of a core.

What the source shows (read in this session with Martin's permission, after
the numbers above; exhaust's files stayed blocked by the hook): a core cell
is two 16-bit values and a pointer to the handler of its instruction word,
16 bytes on x86-64 (the 8000-cell core is 128 KB, hence 0.32 L1 misses per
simulated instruction). The process queue holds pointers to core cells. Each
of the generated handlers (one per instruction word of the generator input)
ends with its own copy of the turn: next warrior through a linked list,
pop, `--cycles`, `goto *ip->i`. There is no loop specialized for two
warriors, the ring queue checks its end on every push and pop (`infinite
queue`, our linear queue, exists as an option and is off by default, as is
`mov i combine`, our 64-bit `MOV.I`), `MOV.I` copies the three fields one by
one, and there are no early ties. `SEQ.I`, `SNE.I`, `JMZ.F`, `JMN.F` and
`DJN.F` compute the next address with conditional moves and wrap once
(options `fold-once`, `cmov`), which is item 3 of #22.

Ideas: fmars's handler pointer per cell gives the fewest x86 instructions
per simulated instruction (40), but cannot be expressed in WebAssembly (tail
calls measured 116.8 vs 277 above), and our C natively is faster anyway.
What fmars shows is the cost of our wasm code: 64 against 45 x86
instructions per simulated instruction (issue #20) costs once per thread and
again under SMT. Side finding: `tools/tournament.mjs --pmars` starts its
processes from Node's event loop at about 1.4 ms each, 4.6 s of the 3,160
pairings of t80 with 31 jobs, so the parallel pMARS number in `PLAN.md`
(11.0 s) is mostly process start, not pMARS. Measured afterwards: for pMARS
it is not, see the next section.

### `tournament.mjs --pmars` starts pMARS from shells (8th November 2026, #25)

t80, 3,160 pairings, 31 jobs unless noted, idle machine, wall time of the
pMARS part as `tools/tournament.mjs` prints it:

| | before | after |
|---|---|---|
| `--rounds 1` | 4.53, 4.50, 4.91 s | 0.33, 0.33, 0.34 s |
| `--rounds 100` | 10.94, 10.92 s | 10.78, 10.79 s |
| `--rounds 100`, 16 jobs | 13.07, 13.08 s | 12.77, 12.77 s |

Before, Node started every pMARS process with `execFile` from the main
thread. Starting them from worker threads instead (each worker its own
`execFile` or `execFileSync` loop) took 7.4 to 7.6 s for `--rounds 1`, so
the cost is in forking the large Node process, wherever the fork comes
from. `xargs -P 31` starting the same 3,160 processes takes 0.93 s. Now each
job is one `/bin/sh` that reads pairings from stdin and runs pMARS for them
one after another, so Node starts 31 processes instead of 3,160.

With 100 rounds pMARS's own run time dominates: the 4.5 s of process start
overlapped with it, and the pMARS rows in `PLAN.md` drop by 1 to 2% only,
to 12.8 s and 10.8 s. For fmars, whose 100 rounds take a fraction of
pMARS's, the start cost was most of its tournament time (section above).
`--compare` gives SAME on t20 and t80.

### Opt-in early stop of a pairing (8th November 2026, #19, removed again)

Removed the same day, see the next section: against a 1,000-round reference
it is no better than playing fewer rounds. What follows is the state when
it was added. Kept as an opt-in that changes results against pMARS:
`runMatch({ stop: { width, minRounds } })` and `tools/tournament.mjs
--ci-width W [--min-rounds N] [--exact-top N]`, the rule of "Statistical
early stopping" in the table of rmars ideas below (semantics doc, 3.7 and
4). Without the option nothing changes: the default tournament output is
byte-identical to before.

The engine reproduces the offline replay (`cwbench/stop/perround.mjs` and
`stop.mjs`, seed 1, 100 rounds) pairing by pairing: rounds played, wins,
losses, ties and executed instructions are the same in all 190 (t20) and
3,160 (t80) pairings, for width 30 and 60 with at least 20 rounds. Neither
set has a pairing with LDP, so no instruction count was approximated.

t80, 31 jobs, wasm, 3 runs each; error against the full 100 rounds per
pairing, of 300 points:

| | executed | time | pairing error mean / max | Spearman, max rank shift | top 10 order |
|---|---|---|---|---|---|
| full | 16,335M | 3.11 to 3.13 s | 0 | 1, 0 | same |
| `--ci-width 30` | 12,532M (76.7%) | 2.36 to 2.37 s | 1.9 / 58 | 0.9998, 2 | changed |
| `--ci-width 60` | 7,036M (43.1%) | 1.35 to 1.37 s | 7.5 / 58 | 0.9992, 4 | changed |
| `--ci-width 0` (20 identical rounds) | 14,809M (90.7%) | 2.82 to 2.84 s | 0.8 / 58 | 0.9998, 2 | changed |
| `--ci-width 60 --exact-top 20` | 8,181M (50.1%) | 1.69 to 1.70 s | 7.2 / 58 | 0.9992, 4 | changed |

t20 (190 pairings): width 30 80.0% of the instructions, error 1.6 / 24;
width 60 42.0%, 7.5 / 41; width 0 error 0.9 / 24. On t20 `--exact-top 20`
replays every pairing and is exact.

`--ci-width 0`, the "stop only lopsided pairings" variant from the issue,
stops 405 of 3,160 t80 pairings and saves 9% of the instructions, but its
worst pairing is as wrong as with width 60: one pairing had 20 identical
rounds and turned later. `--exact-top 20` replays the 190 pairings among
the first pass's top 20 (1,145M instructions, 0.33 s more) and still leaves
the top 10 order changed on t80: every top-20 score also holds 60
estimated pairings against the rest. Exact scores for the top 20 would need
all 1,390 pairings that involve one of them.

### Early stopping against a 1,000-round reference: no better than fewer rounds, removed (8th November 2026)

The question: which way of choosing rounds gets the ranking closest to the
true one for the fewest executed instructions?

Method. Every pairing of t80 and of v80 (corpus files 81 to 160 by sorted
name, a holdout; no pairing has `LDP` in either set) played 1,000 rounds,
each as `runMatch({ rounds: 1, firstRound: r })`, so with its exact
instruction count; the start distance was recorded too. Positions as
`tools/tournament.mjs` with seed 1, so rounds 1 to 100 are today's
tournament (checked against the replay data: identical points and
instructions). Truth: the score per 100 rounds over all 1,000 rounds; its
two halves of 500 rounds disagree on 10 (t80) and 6 (v80) of the 3,160
warrior pairs, so the reference is within a few pairs of the true ranking.
Every policy ran on 8 shuffles of the rounds of each pairing (pairs of
rounds kept together, so both warriors move first equally often), offline
on the recorded rounds. Cost: executed instructions relative to today's
100-round tournament. Error: warrior pairs ranked in the opposite order,
mean over the 8 shuffles (spread ±2 to ±8), t80 / v80.

| Policy | cost | wrong pairs |
|---|---|---|
| fixed 20 rounds | 20% | 45.6 / 49.4 |
| fixed 40 rounds | 40% | 30.7 / 30.9 |
| fixed 60 rounds | 60% | 26.4 / 25.7 |
| fixed 100 rounds (today) | 100% | 17.7 / 15.6 |
| fixed 200 rounds | 200% | 12.5 / 10.3 |
| fixed 400 rounds | 400% | 6.9 / 6.3 |
| `--ci-width 100` (#19) | 22% | 41.3 / 45.1 |
| `--ci-width 60` (#19) | 43% | 29.3 / 26.8 |
| `--ci-width 30` (#19) | 77% | 24.8 / 19.6 |
| allocation over the tournament, E = 32 | 26 / 32% | 37.1 / 34.5 |
| allocation over the tournament, E = 24 | 46 / 51% | 25.8 / 25.3 |
| allocation over the tournament, E = 16 | 100 / 116% | 17.1 / 13.9 |
| allocation over the tournament, E = 8 | 249 / 282% | 7.9 / 6.1 |
| allocation over the tournament, E = 4 | 432 / 449% | 3.4 / 3.6 |

The allocation: every pairing plays 6 rounds; then, repeatedly, the 5% of
the pairings with the largest drop in the expected number of misordered
warrior pairs (within 3 ranks, normal approximation, outcome counts with
0.5 pseudo-counts) per expected instruction get 25% more rounds (at least
4), until that expected number is below E. Its parameters (start rounds,
block size, share, reach, prior) moved the result by a few pairs only.

Findings:
* The pairs that today's tournament orders wrongly are nearly equal
  warriors: their true scores differ by 1.1 points per pairing per 100
  rounds (median, at most 2.8 / 4.2), against a range of 26 to 233 and a
  median gap of 1.6 between rank neighbors.
* Up to today's cost no policy is clearly better than fixed rounds at the
  same cost; the errors are spread over all close warriors, and each score
  sums 79 pairings. Only from 2.5 times today's cost does the allocation pay:
  about half the errors of fixed rounds at 4 times.
* Against the 100-round result as reference (the first attempt) the
  allocation looked 20 to 25% cheaper than fixed rounds: it learned to pin
  down that one sample of rounds, not the true ranking. The 100-round
  result moves by 28 / 30 wrong pairs with seed 2 instead of 1.
* No gain either: a per-pairing stop on a posterior with pseudo-counts
  (so that identical rounds no longer stop a pairing at once); estimates
  pulled toward the middle for pairings with few rounds; cutting long
  rounds of a pairing whose earlier long rounds all tied and counting them
  as ties (worse than fewer rounds: of the rounds still running after
  80,000 instructions, 32% on t80 end in a kill).
* Start distances spread evenly over the core instead of pseudo-random,
  one round per distance stratum: 8 to 15% fewer errors at 20 to 60 rounds
  (t80 44.8 → 38.8 at 20 rounds), none from 100 rounds on. It would also
  leave pMARS's position sequence. Not built.

Verdict: `runMatch({ stop })` and `tools/tournament.mjs --ci-width`,
`--min-rounds`, `--exact-top` removed; `mars.wasm` is byte-identical to
the build before #19 again. To trade ranking quality for time, play fewer
rounds (`--rounds N`), which keeps results identical to pMARS for those
rounds. The offline bench and the recorded rounds were scratch work and
are not in the repository; the recording is a loop over
`runMatch({ rounds: 1, firstRound: r })` per pairing, about 35 s for
1,000 rounds of an 80-warrior set on 31 threads.

### Three small changes in the two-warrior loop, all rejected (8th November 2026, #22)

Each change alone against `main` (`mars.wasm` md5 `7e5832d4...`), wasm
with `tools/ab-wasm.mjs` (7 runs, t80 5 runs, median and range), native on
the t20 mix (`tournament.mjs --native-input`, `bench-native --early-tie`,
5 alternating runs of two builds). Machine: idle apart from a browser, load
below 1 before each A/B (the A/B itself raises it).

| Change | bench M/s | pairs M/s | t20 s | t80 16 jobs s | t80 31 jobs s | native t20 M/s |
|---|---|---|---|---|---|---|
| 1. branch-free `SPL` push on linear queues | 296.5 → 292.6 | 285.5 → 284.3 | 3.78 → 3.84 | 3.47 → 3.50 | 3.12 → 3.16 | 373 → 364 |
| 2. queue counters as byte offsets (`execute2_8000` only) | 296.9 → 276.8 | 283.2 → 270.1 | 3.78 → 4.08 | 3.46 → 3.72 | 3.12 → 3.32 | 371 → 379 |
| 3. one wraparound for every queued address | 297.9 → 281.0 | 284.3 → 272.7 | 3.78 → 4.09 | 3.47 → 3.67 | 3.11 → 3.25 | 371 → 326 |
| 3b. one wraparound for skips only (`pc + 2`) | 298.8 → 293.2 | 282.6 → 275.6 | 3.78 → 3.83 | 3.46 → 3.51 | 3.11 → 3.19 | 372 → 366 |

t20 ranges do not overlap in any row. Details:

1. The new process is always written at the tail (the linear queue has
   160,032 entries for a tail of at most 160,003) and the tail advances by
   `tail - head < limit`. Slower in wasm and natively.
2. With `u8` byte offsets the `<< 1` of each queue access goes away;
   `execute2()` converts the counters at entry and exit. The only change in
   this issue that helps natively (+1.6%), and the worst in wasm with item 3:
   V8's code moves as in #10.
3. `next` stays unwrapped (`pc + 1`, `+1` for a skip, the jump target) and
   is wrapped once when queued. That adds a compare on paths that had
   none: a jump target is already wrapped, and `INC(pc)` was the only wrap
   on the common path. 3b keeps that path and only replaces
   `INC(INC(pc))` in the 20 skip cases with one wrap of `pc + 2`; still
   slower everywhere.

All four built and passed `test/wasm.test.js` and `test/tournament.test.js`.
None was kept, so no `engine-check` run.

### The hot words ranked on counts with early ties: the same list, rejected (8th November 2026, #23)

Counts as tournaments run, `bench-native --early-tie --count`, over the
mixes of the current `HOT` list: t20 and t80 (`tournament.mjs --rounds 100
--seed 1 --native-input`), 400 corpus pairs (`bench-pairs --pairs 400
--native-input`, 30 rounds) and the bench. The 32 words of today leave to
the generic path 1.32% of t20, 3.00% of t80, 4.07% of the pairs and 0.01%
of the bench.

`gen-dispatch.mjs --rank` with all four weighted equally, as the current
list was made, gives exactly the current list in the same order: early
ties change the shares, not the ranking. Other words only come up with
other weights:

| List | generic t20 / t80 / pairs / bench | bench M/s | pairs M/s | t20 s | t80 16 jobs s | t80 31 jobs s |
|---|---|---|---|---|---|---|
| without the bench: `mov.i < $` for `cmp.ab # $` | 1.32 / 2.97 / 3.60 / 0.69% | 297.9 → 297.5 | 286.9 → 283.5 | 3.80 → 3.81 | 3.48 → 3.48 | 3.12 → 3.15 |
| t80 and pairs only: also `cmp.ab # <` for `slt.ab # $` | 1.66 / 2.73 / 3.64 / 2.01% | 298.4 → 294.3 | 285.0 → 280.4 | 3.79 → 3.79 | 3.46 → 3.50 | 3.11 → 3.09 |

`tools/ab-wasm.mjs`, current list first, 7 runs (t80 5), medians. Within
noise or slower; 0.3 points less generic code on t80 and pairs are worth
less than what V8's code moves when the case set changes (#10). Keep the
list.

### What V8 does with the two-warrior loop (8th November 2026, #20)

Node 22.22.2 (V8 12.4), `node --no-liftoff --print-wasm-code` for the code
and `perf record -e instructions:u` with `--perf-prof` and `perf inject
--jit` for the profile, t20 single thread (`tournament.mjs --rounds 100
--seed 1 --jobs 1 --engine wasm`, 1,110M simulated instructions).

* `perf stat`: 70.7G x86 instructions and 17.3G cycles for the whole
  process, 63.7 instructions and 15.6 cycles per simulated instruction.
  `execute2_8000()` (wasm function 9, 29.6 KB of x86 code) has 92.5% of
  the retired instructions, 58.9 per simulated instruction.
* Stack slots: 9.8% of the retired instructions in that function load
  (4.5%) or store (5.3%) a `[rbp-x]` slot, about 5.8 per simulated
  instruction. The hottest slots, by samples: `-0x58` 2.6% (`left`, the
  countdown), `-0x48` and `-0x30` 1.7% each, `-0x68` 1.1%, `-0x60` 0.9%,
  `-0x70` 0.7% (the queue heads and values derived from them).
* What the loop carries, from the code before the loop head: both queue
  heads as byte addresses (`2 * h0 + 0x90080`, `2 * h1 + 0xde2c0`, the two
  `queueMem` arrays), so clang already strength-reduced the `u16` index
  (#22 item 2 did that by hand and lost 8%); `-h0`, `-h1` and `h0 + 1` for
  the `tail - head` and `tail == head` tests; both tails; `budget` and
  `left`. The memory base stays in `rcx`, the core is a constant offset
  (`[rcx + 8 * cell + 0x10040]`). The parameters of the inlined
  `exec_ins()` and `step()` are constants or these values, so there are no
  parameters left to drop.
* Stack check: one `cmpq rsp,[r13-0x60]` with `jna` per loop pass, which
  is two turns, so 1 x86 instruction per simulated instruction. With
  `--no-wasm-stack-checks` (testing only), 5 alternating runs: t20 3.78 →
  3.74 s, bench 297.9 → 299.3M/s. About 1% is all a loop without the
  check could give; the four-turn loop that halved the checks was slower
  (row "Loop unrolled twice" above).
* `--turboshaft-wasm` (off by default in this V8, Chrome's newer V8
  compiles wasm with Turboshaft): t20 3.77 → 4.01 s, bench 297.8 →
  282.9M/s.

Two experiments against the live values, `tools/ab-wasm.mjs` (7 runs, t80 5)
and natively on the t20 mix (5 alternating runs):

| Change in `execute2_8000()` | bench M/s | pairs M/s | t20 s | t80 16 jobs s | t80 31 jobs s | native t20 M/s | verdict |
|---|---|---|---|---|---|---|---|
| A. no countdown: the loop ends when a queue head reaches an end value computed from the budget (each turn pops one entry) | 298.1 → 284.0 | 282.6 → 273.5 | 3.77 → 3.97 | 3.46 → 3.63 | 3.12 → 3.35 | 372 → 355 | rejected |
| B. queue counters in the warrior structs instead of locals | 297.0 → 301.8 | 284.2 → 285.7 | 3.77 → 3.75 | 3.47 → 3.42 | 3.12 → 3.15 | 374 → 357 | rejected: t20 within noise, t80 31 jobs +1.0% (ranges apart), native -4% |

A replaces one live counter with two loop-invariant ends and is slower
everywhere. B helps the bench and t80 with 16 jobs a little and costs on
t80 with 31 jobs and natively. So far every change in this loop has moved
V8's register allocation by 1 to 8%, most often the wrong way (#10, #22,
#23 and this one). What is left is in V8's register allocator, not in
the C code that feeds it.

### Frontend-bound slots in the native build: no single cause (8th November 2026, #21)

Native build of `main` (`bench-native --early-tie --keep`, clang -O3
-march=native), AMD Ryzen 9 7950X (Zen 4), perf 7.2. Mixes: t20
(`tournament.mjs --rounds 100 --seed 1 --native-input`, 1,110M simulated
instructions) and 400 corpus pairs (`bench-pairs --pairs 400
--native-input`, 654M).

Top-down (`perf stat -M PipelineL1,frontend_bound_group`), share of
dispatch slots:

| | retiring | frontend bound (bandwidth + latency) | backend bound | bad speculation |
|---|---|---|---|---|
| t20 | 59.9% | 17.6% (10.0 + 7.6) | 14.5% | 7.7% |
| corpus pairs | 56.9% | 19.6% (11.4 + 8.3) | 15.6% | 7.7% |

The 20.4% in #6 was from before the linear queues of #9. Per simulated
instruction on t20 (raw events, multiplexed and scaled by perf, so about
±5%): 46.2 x86 instructions, 11.9 cycles, 7.6 branches of which 4.1
taken, 0.070 mispredicted (0.016 indirect), 0.41 dynamic indirect
predictions. The op cache serves almost every fetch: 9.69G accesses, 0.16%
misses. Instruction cache misses 0.006, ITLB misses about 0.00002, L2 BTB
corrections 0.0007 and decoder redirects 0.0001 per simulated instruction.
Corpus pairs are the same within a few percent. So the instruction cache,
the ITLB, the BTB and the decoder are not the cause.

Where the frontend stalls (`perf record -e
de_no_dispatch_per_slot.no_ops_from_frontend` against `-e cycles`, both
`-c 100003`, `execute2_8000` has 97.8%), by region of the loop:

| Region | frontend stall samples | cycle samples | x86 instructions |
|---|---|---|---|
| turn start: queue pop, cell load, word load | 31.0% | 30.6% | 22 |
| compare tree on the instruction word | 8.4% | 6.6% | 142 |
| instruction handlers and queue push | 60.2% | 62.6% | 3,392 |

The stalls follow the cycles, and no region or event stands out. The
compare tree draws a little more than its share; removing it entirely
would take at most about 1.5 points off the 17.6%, and tables instead of
the tree were slower in WebAssembly (rows above). Part of the latency share
is plausibly the refetch after the 0.070 mispredicts per simulated
instruction, which bad speculation does not count. Verdict: no experiment,
nothing in the frontend is worth a change that V8 would also have to
like.

### Ceiling of exact early ties for warriors in closed loops (8th November 2026, #27)

`tools/tie-ceiling.mjs <native input>` builds `src/engine/wasm/tie-ceiling.c`
(`mars.c` with `-DTRACE_TIES`: the generic code, a hook after every
instruction) and plays every round to its end. It notes when today's early
tie stops the round (`tie_check()` on its own schedule; the total of
executed instructions equals `bench-native --early-tie` for every input),
and per tie round and warrior:
* the instruction after which the warrior has more processes than turns
  left, the process-count proof for that warrior alone
* t0: the earliest instruction from which the warrior only executes a set
  S of cells, none `DAT`, `DIV` or `MOD`, and no cell of S changes until
  the round ends (a shadow core gives the last change of every cell). An
  oracle, known afterwards only

A warrior is safe from the earlier of the two, and a proof could stop the
round once both are. The gain against today, as a share of all
instructions executed today (with early ties), by the size of S:

| | tie rounds today | \|S\| <= 1 | 4 | 8 | 16 | 32 | 64 | any |
|---|---|---|---|---|---|---|---|---|
| t20 | 35.7% | 0.05% | 0.55% | 0.76% | 1.01% | 1.34% | 1.41% | 1.51% |
| t80 | 47.1% | 0.64% | 2.73% | 3.81% | 4.46% | 4.99% | 5.08% | 5.37% |
| 400 corpus pairs | 56.2% | 0.64% | 4.89% | 8.32% | 8.90% | 9.90% | 10.25% | 11.48% |
| t20, `-p 8` | 34.0% | 0.19% | 1.39% | 1.62% | 2.22% | 2.24% | 2.24% | 2.46% |
| t80, `-p 8` | 51.4% | 1.01% | 5.08% | 6.76% | 7.50% | 7.52% | 7.52% | 7.98% |

(t20, t80: `tournament.mjs --rounds 100 --seed 1 --native-input`, `-p 8`
with `--processes 8`; pairs: `bench-pairs --pairs 400`, 30 rounds.) The
count proof checked after every instruction instead of every 4096 would
gain 0.01%.

At |S| <= 32, by what makes the two warriors safe and how the opponent of
a looping warrior writes after t0 (the tool's last lines):

| | both loop, opponent writes through pointers or increments | both loop, opponent writes only directly or not | one immortal by count, the other loops | both immortal by count |
|---|---|---|---|---|
| t20 | 1.10% | 0.09% | 0.15% | 0.00% |
| t80 | 4.33% | 0.37% | 0.29% | 0.01% |
| 400 corpus pairs | 9.03% | 0.49% | 0.37% | 0.01% |
| t20, `-p 8` | 2.14% | 0.10% | 0.00% | 0.00% |
| t80, `-p 8` | 7.11% | 0.41% | 0.00% | 0.00% |

After every round the driver compares the whole core with its shadow
core; no round of these five inputs had a write outside the three cells
it tracks.

Verdict: above 3% on t80, but not where #27 expected it. A paper against
a stone or scanner in a loop is 0.29% of t80, and a cheap proof "the
opponent writes only through direct operands, or not at all, so never into
S" decides about 0.5%. Most of the ceiling is two warriors that both run a
few fixed cells and bomb or decrement the core through pointer cells
without hitting each other's loop: Big-raidar against CANCER (11.5M
instructions in 99 rounds), Asi-R against Big-raidar (10.2M), Bullwhip, a
one-cell loop, against stones and scanners. A proof there has to bound
where the pointer writes land for the rest of the round; #35 has the
ideas and the measurement to do first.

That measurement (#35): the trace also records the cells each instruction
reads (the indirection cells of indirect operands, both targets) and which
warrior changed each cell last. A round counts as a closed system when, from
the point where the round could stop (|S| <= 32), neither warrior reads a
cell that the other changes again. Then the future of the round depends
only on the two queues and the cells the warriors read, and a repeat of
that small state would prove the tie. Share of all instructions executed
today that the closed rounds could save: t20 0.61%, t80 3.02% (of the
4.99%), 400 corpus pairs 5.15%, t80 with `-p 8` 4.35%. On t20 that is about
what the ideal full-state repeat detection measured above would give
(0.6%); the small state can repeat long before the whole core stops
changing. Not built: a new exact early exit needs a design and its proof
first (#35).

State: bench about 294M/s in WebAssembly, about 413M/s natively; corpus
pairs 280M/s; t20 3.84 s single thread; t80 3.63 s with 16 jobs and 3.28 s
with 31 jobs (8th November 2026; the machine ran 2 to 4% slower than on the
day of the second round's numbers). Warmed up against corewar.dev's exMARS
(`cwbench/benchpairs.mjs`): agony/bubbles 327 vs 195M/s (1.68x), bomber/chalk
311 vs 144 (2.16x), army/bananasplit 334 vs 189 (1.77x); t20 split
(`cwbench/split.mjs`): pairings without tie rounds 392 vs 675 ms (1.72x),
with tie rounds 3,347 vs 5,545 ms (1.66x).
That was the state after the third round. The current state is at the end
of the fourth round's section.

### Three LLVM pass options for the wasm build: measured, not used (9th November 2026)

Three hidden LLVM options make the wasm build of the third-round `mars.c`
3 to 5% faster. They are measured here and not used: Martin decided against
compiler options (10th November 2026), and the fourth round below gets the
same gain from a change of the source. `tools/build-wasm.sh` is unchanged.
The options were not measured on top of the fourth round's code.

```
-mllvm -disable-lsr -mllvm -simplifycfg-sink-common=false -mllvm -simplifycfg-hoist-common=false
```

clang 22.1.8, Node 22.22.2 (V8 12.4). The module grows from 50,179 to
53,547 bytes. `tools/ab-wasm.mjs`, 7 runs (t80 5), median (range), load
below 1 before the A/B:

| Build | bench M/s | pairs M/s | t20 s | t80 16 jobs s | t80 31 jobs s |
|---|---|---|---|---|---|
| `-Os` | 296.7 (287.6–299.6) | 289.7 (279.3–290.6) | 3.80 (3.77–3.83) | 3.45 (3.44–3.46) | 3.11 (3.11–3.12) |
| `-Os` and the three options | 309.3 (308.2–311.4) | 295.2 (291.1–298.4) | 3.67 (3.62–3.87) | 3.34 (3.33–3.36) | 2.96 (2.95–2.97) |
| change | +4.2% | +1.9% | -3.4% | -3.2% | -4.8% |

The t20 ranges overlap because of one run at 3.87 s. A few t20 runs took
3.87 to 3.92 s on this day, with the options and with variants of them: 5
of the twelve 7-run series of this section have one as their maximum. The
other series with the options end at 3.72 or below. The 3-run screen below
has 3.82 (3.77–3.83) → 3.67 (3.62–3.67).

Where the time goes, `perf stat` of the t20 tournament process (1,110M
simulated instructions):

| | x86 instructions | cycles | L1 loads | branches | branch misses |
|---|---|---|---|---|---|
| `-Os` | 70.78G | 17.37G | 12.45G | 10.25G | 79.1M |
| the three options | 63.73G | 16.81G | 10.97G | 10.22G | 78.9M |
| per simulated instruction | 63.7 → 57.4 | 15.6 → 15.1 | 11.2 → 9.9 | 9.2 → 9.2 | 0.071 → 0.071 |

V8's code runs 10% fewer instructions and 12% fewer loads for the same
branches. An explanation that fits, not checked in V8's code: the #20
section found that the loop carries rewritten copies of the queue counters
(`2 * h0 + 0x90080`, `-h0`, `h0 + 1`), which is what loop strength
reduction makes. SimplifyCFG moves instructions that several specialized
cases have in common into one block, and their operands then join there as
extra wasm locals. Without both, V8 has fewer live values around the loop
and spills less. The earlier changes to this loop (#10, #20, #22, #23)
moved V8's code by 1 to 8%, most often the wrong way.

Other V8 versions and the other loops, old build → three options:

| What | Result |
|---|---|
| Node 20.11.0 (V8 11.3), 5 runs | bench 286.2 → 295.2 (+3.1%), pairs 274.6 → 292.3 (+6.4%), t20 3.83 (3.80–3.85) → 3.70 (3.67–3.76) s (-3.4%) |
| Chrome 158.0.8127.18 beta, headless, the 190 t20 pairings × 100 rounds in a page, 4 alternating runs, 1,106,106,513 instructions in each | 3.982, 3.973, 3.941, 3.976 → 3.866, 3.820, 3.770, 3.862 s (-3.3%) |
| `execute()`, 8 warriors of t20 in one core, 3,000 rounds, 822,368,735 instructions | 250.1 (250.1–252.0) → 283.6 (282.6–284.1) M/s (+13%) |
| `execute2_any()`, t20 with `--size 8192` | 2.93 (2.91–2.94) → 2.79 (2.78–2.80) s (-4.8%) |
| native, `clang -O3 -march=native` plus the three options, t20 mix, alternating | 372.9 (368.2–373.7) → 383.3 (382.3–390.3) M/s (+2.8%) |
| native, corpus pairs (input from `bench-pairs.mjs --native-input`), 5 runs | 358.9 (357.9–360.0) → 370.9 (369.2–374.0) M/s (+3.3%) |

Natively, one screen (3 runs, t20 mix, base
370.8): `-disable-lsr` 380.7, sink off 377.4, hoist off 355.8, sink and
hoist off 374.8, all three 383.8.

#### The screen

The candidates are hidden LLVM options (`clang -mllvm --help-hidden` lists
2,960 lines of them): the ones that change which values live across the
loop or how code of the cases is merged.
3 alternating runs of t20 and pairs per row (`tools/ab-wasm.mjs --only
t20,pairs --runs 3`), median. With 3 runs, changes below about 1.5% are
noise.

Against the old build (`-Os`):

| Options | bytes | t20 s | pairs M/s | verdict |
|---|---|---|---|---|
| `-disable-lsr` | 49,985 | 3.80 → 3.74 (-1.6%) | 279.7 → 282.6 (+1.0%) | part of the set of three |
| `-simplifycfg-sink-common=false` | 53,301 | 3.82 → 3.76 (-1.6%) | 288.1 → 288.7 (+0.2%) | part of the set of three |
| `-simplifycfg-hoist-common=false` | 50,657 | 3.79 → 3.77 (-0.5%) | 279.8 → 285.1 (+1.9%) | part of the set of three |
| lsr and sink | 53,060 | 3.81 → 3.76 (-1.3%) | 289.3 → 291.4 (+0.7%) | |
| lsr and hoist | 50,472 | 3.81 → 3.77 (-1.0%) | 280.4 → 282.0 (+0.6%) | |
| sink and hoist | 53,779 | 3.79 → 3.73 (-1.6%) | 280.2 → 286.5 (+2.2%) | |
| all three | 53,547 | 3.82 (3.77–3.83) → 3.67 (3.62–3.67) (-3.9%) | 281.2 → 296.6 (+5.5%) | the set measured above |
| `-optsize-jump-table-density=10` | 50,239 | 3.82 → 3.93 (+2.9%) | 284.1 → 278.9 (-1.8%) | rejected |
| `-fno-jump-tables` | 54,566 | 3.80 → 3.80 | 285.6 → 280.2 (-1.9%) | rejected |
| `-enable-gvn-hoist` | 50,281 | 3.80 → 3.84 (+1.1%) | 282.3 → 286.5 (+1.5%) | rejected |
| `-enable-gvn-sink` | 49,520 | 3.82 → 3.90 (+2.1%) | 280.6 → 277.7 (-1.0%) | rejected |
| `-disable-cgp` | 51,485 | 3.79 → 3.92 (+3.4%) | 288.5 → 273.3 (-5.3%) | rejected |
| `-phi-node-folding-threshold=1` and `=4` | identical module | | | no difference |

Each option alone and each pair of them gives at most 1.6% on t20. All
three together give 3.9%.

On top of the three options (A is the build with the three options):

| Extra option | bytes | t20 s | pairs M/s | verdict |
|---|---|---|---|---|
| `-O2` instead of `-Os` | 56,084 | 3.66 → 3.84 (+4.9%) | 295.7 → 285.5 (-3.4%) | rejected |
| `-O3` instead of `-Os` | 56,380 | 3.67 → 3.76 (+2.5%) | 294.5 → 286.5 (-2.7%) | rejected |
| `-enable-pre=false` | 53,559 | 3.62 → 3.69 (+1.9%) | 296.5 → 293.4 (-1.0%) | rejected |
| `-enable-load-pre=false` | 53,272 | 3.70 → 3.68 (-0.5%) | 293.2 → 291.9 (-0.4%) | rejected, noise |
| `-instcombine-code-sinking=false` | 53,509 | 3.71 → 3.69 (-0.5%) | 298.6 → 297.9 (-0.2%) | rejected, noise |
| `-disable-machine-sink` | 53,338 | 3.67 → 3.73 (+1.6%) | 290.7 → 291.5 (+0.3%) | rejected |
| `-jump-threading-threshold=0` | 55,848 | 3.72 → 3.74 (+0.5%) | 294.2 → 285.9 (-2.8%) | rejected |
| `-disable-machine-licm` | 53,618 | 3.71 → 3.70 | 294.0 → 294.1 | rejected, noise |
| `-disable-tail-duplicate` | 53,580 | 3.62 → 3.74 (+3.3%) | 294.2 → 293.3 | rejected |
| `-two-entry-phi-node-folding-threshold=0` | 53,438 | 3.67 → 3.67 | 297.2 → 296.2 | rejected, noise |
| `-simplifycfg-branch-fold-threshold=0` | 53,557 | 3.67 → 3.66 | 295.4 → 295.2 | rejected, noise |
| `-enable-newgvn` | 53,489 | 3.66 → 3.71 (+1.4%) | 293.0 → 294.8 | rejected |
| `-disable-phi-elim-edge-splitting` | 52,816 | 3.73 → 3.73 | 294.0 → 291.5 (-0.9%) | rejected, noise |
| `-enable-tail-merge=false` | 53,653 | 3.70 → 3.65 (-1.4%) | 293.8 → 293.1 (-0.2%) | 7 runs: bench 309.2 → 307.5, t20 3.68 → 3.68, pairs 293.6 → 293.8; rejected |
| `-disable-licm-promotion` | 53,557 | 3.67 → 3.63 (-1.1%) | 293.8 → 294.3 | 7 runs: bench 309.0 → 306.9, t20 3.68 → 3.66, pairs 294.4 → 295.2; rejected, noise |
| `-disable-machine-cse` | 53,728 | 3.68 → 3.67 | 291.9 → 296.5 (+1.6%) | 7 runs: bench 308.7 → 307.6, t20 3.69 → 3.66, pairs 295.0 → 295.8; rejected, noise |
| `-disable-branch-fold` | 54,099 | 3.64 → 3.65 | 293.3 → 297.0 (+1.3%) | 7 runs: bench 309.1 → 309.8, t20 3.63 → 3.68, pairs 295.9 → 297.2; rejected, noise |
| `-simplifycfg-merge-cond-stores=false`, `-simplifycfg-hoist-cond-stores=false`, `-disable-early-taildup`, `-disable-block-placement`, `-disable-peephole`, `-speculate-one-expensive-inst=false` | identical module | | | no difference |

The number of specialized cases, again with the three options (change of
bench / pairs / t20 time against 32 cases, 3 runs): 16 cases (42,835 bytes)
-6.7% / -8.0% / +3.8%; 24 (48,821) -0.3% / +0.5% / -2.4%; 28 (51,301)
-1.1% / +0.4% / -0.8%; 36 (57,290) -3.4% / -2.3% / +3.0%; 40 (60,997)
-4.4% / -3.3% / +3.5%; 48 (67,410) -4.3% / +0.4% / +5.5%. 24 and 28 are
within the noise of 3 runs. 24 cases again with `ab-wasm.mjs` (7 runs, t80
5): bench 307.3 → 306.8, pairs 295.2 → 295.4, t20 3.66 → 3.66, t80 16 jobs
3.34 (3.33–3.35) → 3.40 (3.39–3.41), t80 31 jobs 2.96 (2.95–2.97) → 2.99
(2.98–3.00). The 4.7 KB smaller module loses 1 to 1.8% on t80. 32 stays.

#### Source changes on top of the three options, all rejected

| Idea | Result | Verdict |
|---|---|---|
| Pair countdown in `execute2()`: one decrement of the budget per two turns, an odd last instruction through `execute()` | 53,597 bytes; 3 runs: bench 309.4 → 308.9, pairs 292.9 → 298.6 (+1.9%), t20 3.68 → 3.70. With the old flags: bench 297.8 → 299.6, pairs 290.8 → 283.9, t20 3.86 → 3.77 | rejected: noise in both directions, more code |
| Generic code in its own non-inlined function, returning the new tail and the death flag (rejected in the second round; tried again because the options changed what V8 gets) | 33,305 bytes instead of 53,547; `ab-wasm.mjs` 7 runs: bench 309.4 → 324.0 (+4.7%), pairs 295.9 → 287.8 (-2.7%), t20 3.69 → 3.71, t80 16 jobs 3.34 → 3.41 (+2.1%), t80 31 jobs 2.95 → 3.01 (+2.0%). With 40 cases (40,741 bytes): bench -0.6%, pairs -1.4%, t20 +3.9%, t80 31 jobs +2.4%. With 48 cases (47,154 bytes): bench -1.6%, pairs +0.2%, t20 +0.5%, t80 31 jobs 0.0% | rejected: faster on the bench only, slower on pairs and on both t80 runs |
| Fixed cost of a tournament run (t80, `--rounds 1`) | 31 jobs: engine 0.13 to 0.14 s, wall 0.28 s, 3.0 CPU-seconds; 16 jobs 0.12 s; 1 job 0.62 s. 31 empty Node workers alone take 87 to 90 ms to start | nothing changed: most of what is left is Node's worker start |

### Fourth round: one queue head for both warriors, 4 to 7% faster in WebAssembly (10th November 2026)

Two changes in `mars.c`, both in the code for two warriors. The build
script did not change. clang 22.1.8, Node 22.22.2 (V8 12.4). The module
shrinks from 50,179 to 49,171 bytes. `tools/ab-wasm.mjs`, 7 runs (t80 5),
median (range), load below 1 before the A/B:

| Build | bench M/s | pairs M/s | t20 s | t80 16 jobs s | t80 31 jobs s |
|---|---|---|---|---|---|
| third round (`main`) | 298.5 (297.8–299.7) | 283.5 (275.1–292.0) | 3.80 (3.76–3.82) | 3.46 (3.45–3.47) | 3.11 (3.10–3.14) |
| both changes | 310.1 (309.3–311.7) | 302.6 (299.2–303.4) | 3.60 (3.56–3.62) | 3.31 (3.29–3.31) | 2.96 (2.95–2.97) |
| change | +3.9% | +6.7% | -5.3% | -4.3% | -4.8% |

All ranges are apart. The native build does not gain: with the flags of
`tools/bench-native.mjs` it is 1.7 to 3.1% slower, see "The native build"
below.

#### One head for both linear queues

With two warriors the turns alternate and every turn pops one entry, so
both heads advance by one per pair of turns. The linear queues of the third
round started both at 0, so the heads differed by one whenever warrior 1
had moved first. Now `mars_start_round()` starts warrior 0's queue at
index 1 in that case, and both heads are equal whenever warrior 0 is to
move. `execute2()` loops over pairs of turns with one head `h` and the two
tails. `h` also counts the pairs (`++h == end`). That is 3 counters carried
around the loop instead of 5 (`h0`, `t0`, `h1`, `t1` and the countdown
`left`). The last instruction of an odd budget goes through `execute(1)`.
A tail now stays at most `2 + 2 * (maxCycles + 1)`, 160,004 entries at
80,000 cycles; the arrays hold 160,032.

The third round rejected "one queue ring for both warriors with one shared
head": even and odd positions of one ring, a step of 2, death tests against
`h + 2` and `h + 3`. Here the two arrays and the step of 1 stay, and a
queue is empty when its tail equals its head, as before. The pair loop
without the shared head (two heads, one decrement of the budget per pair)
gave no clear result in 3 runs: bench 297.8 → 299.6, pairs 290.8 → 283.9,
t20 3.86 → 3.77.

This change alone against `main`, 3 runs: bench 298.8 → 309.2 (+3.5%),
pairs 282.6 → 297.8 (+5.4%), t20 3.82 (3.81–4.00) → 3.63 (3.62–3.63)
(-5.0%). Module 50,269 bytes.

#### `ADD`, `SUB` and `MUL` of both values with one load and one store

With .F, .X and .I the old code stored the first result with a 16-bit
store and then read the second value with a 32-bit load of the same cell
(`BB` is `ab_of(B) >> 16`). A load that is wider than the store before it
cannot take its data from the store buffer and waits until the store is in
the cache: 21 cycles instead of 9 on this CPU (microbenchmark below). The
new code reads both values with one 32-bit load and writes both with one
`set_ab()`. `SUB.F` and `ADD.F` are 1.64% and 0.71% of the t20
instructions.

Against the first change, 7 runs: t20 3.62 (3.60–3.64) → 3.59 (3.57–3.59)
(-0.8%, ranges apart), pairs 298.7 → 300.2 (+0.5%), bench 309.2 → 309.7.
The module shrinks by 1,098 bytes. Kept for the t20 time and the smaller
module; on bench and pairs it is inside the noise.

#### Where the time goes

`perf stat` of the t20 tournament process (Node, 1,110M simulated
instructions), per simulated instruction, 2 runs each where two values are
given. "Failed forwards" is the event `ls_bad_status2.stli_other`; it
counts too much, see the forwarding study below.

| Build | bytes | x86 instructions | cycles | loads | failed forwards | branch misses |
|---|---|---|---|---|---|---|
| third round (`main`) | 50,179 | 63.75, 63.79 | 15.70, 15.64 | 10.69, 10.71 | 0.196, 0.190 | 0.0715 |
| one head | 50,269 | 61.41, 61.40 | 15.22, 15.06 | 8.63, 8.60 | 0.161, 0.159 | 0.0711 |
| one head and the arithmetic (kept) | 49,171 | 61.28, 61.26 | 14.86, 14.99 | 8.75 | 0.137, 0.138 | 0.0704, 0.0699 |
| one head, queue counters as byte offsets | 50,055 | 58.33 | 15.64, 15.67 | 8.60 | 0.178 | 0.0711 |
| one head, exit arithmetic in 32 bits | 50,233 | 59.59, 59.64 | 15.82, 15.80 | 8.22 | 0.222, 0.208 | 0.0714 |
| one head, every core store writes the whole cell | 52,352 | 65.63 | 16.72, 16.76 | 10.52 | 0.358, 0.360 | 0.0707 |
| kept build, instruction fetched with three 16-bit loads | 48,696 | 62.87, 62.83 | 15.09, 15.10 | 9.91 | 0.170 | 0.0700 |

The kept build runs 3.9% fewer x86 instructions, about 5% fewer cycles and
18% fewer loads than `main`. Two of the rejected variants run still fewer
instructions and need as many cycles as `main`: the instruction count does
not predict the time here.

Other V8 versions and the other loops, `main` → kept build:

| What | Result |
|---|---|
| Node 22.22.2, a second A/B, 5 runs | bench 297.1 (296.4–297.4) → 310.9 (308.6–311.8) (+4.6%), pairs 285.0 (280.7–288.3) → 301.2 (294.5–301.9) (+5.7%), t20 3.79 (3.76–3.81) → 3.59 (3.57–3.64) s (-5.3%) |
| Node 20.11.0 (V8 11.3), 5 runs | bench 287.1 (284.4–288.3) → 304.0 (302.0–305.6) (+5.9%), pairs 274.9 (272.9–280.3) → 297.5 (295.0–300.8) (+8.2%), t20 3.84 (3.80–3.86) → 3.61 (3.60–3.64) s (-6.0%) |
| Chrome 158 beta, headless, the 190 t20 pairings × 100 rounds in a page, 4 alternating runs, 1,106,106,513 instructions in each | 4.001, 3.967, 3.970, 4.004 → 3.764, 3.753, 3.801, 3.759 s (-5.6%) |
| step API (`node tools/bench.mjs <corpus> --wasm`, `run(1e6)` from JS), 7 alternating runs | 297.9 (294.2–299.0) → 309.7 (308.0–311.8) M/s (+4.0%) |
| `execute2_any()`, t20 with `--size 8192`, 3 alternating runs | 2.93, 2.94, 2.92 → 2.73, 2.73, 2.76 s (-6.8%) |
| `execute()`, 8 warriors of t20 in one core, 822,368,735 instructions, 3 alternating runs | 251.6, 245.2, 251.4 → 251.1, 253.0, 246.5 M/s: unchanged |
| fixed cost, t80 with `--rounds 1 --jobs 31`, 5 alternating runs | engine 0.13 to 0.15 s, wall 300 ms (284–312) → engine 0.13 to 0.14 s, wall 291 ms (288–297): unchanged |

#### The native build

`tools/ab-native.mjs` (`clang -O3 -march=native`), `main` → kept build,
median (range), M/s:

| Input | runs | `main` | kept build | change |
|---|---|---|---|---|
| bench | 7 | 436.1 (432.3–441.9) | 422.5 (416.4–424.3) | -3.1% |
| t20, early ties | 5 | 368.3 (364.3–373.1) | 362.2 (361.7–367.4) | -1.7% |
| corpus pairs, early ties | 5 | 358.8 (357.5–362.1) | 350.3 (348.0–350.9) | -2.4% |

The native code runs fewer instructions too and still needs more cycles.
Per simulated instruction on the t20 input (`perf stat`): `main` 46.26 to
46.29 x86 instructions and 11.84 to 12.23 cycles, one head 44.74 to 44.76
and 12.16 to 12.24, kept build 45.22 to 45.23 and 12.12 to 12.28. Branches
7.58 → 7.09, branch misses 0.0699 → 0.0675, failed forwards 0.168 → 0.133.
No counter explains the cycles: op-cache misses 0.003 to 0.005, ops from
the decoder 0.026 to 0.041, `bp_l2_btb_correct` 0.0002 and `bp_de_redirect`
0 for both.

Other compilers and code layouts, x86 instructions / cycles per simulated
instruction on the t20 input:

| Build | `main` | kept build |
|---|---|---|
| clang 22.1.8 `-O3 -march=native` | 46.26 / 11.91 | 45.22 / 12.18 |
| clang `-O2` | 46.50 / 12.12 | 45.26 / 12.41 |
| clang `-Os` | 50.77 / 12.36 | 48.64 / 12.74 |
| gcc 16.2.1 `-O3` | 51.68 / 12.89 | 48.45 / 12.82 |
| gcc `-O2` | 51.68 / 12.85 | 48.45 / 12.68 |

clang `-O3 -march=native` plus one layout option, `perf stat -r 5`, cycles
per simulated instruction:

| Option | `main` | kept build |
|---|---|---|
| none (from the table above) | 11.91 | 12.18 |
| `-falign-jumps=16` (clang ignores it with a warning, so this is the row above again) | 12.01 | 12.21 |
| `-falign-loops=32` | 11.92 | 11.88 |
| `-falign-loops=64` | 11.98 | 11.86 |
| `-falign-functions=64` | 12.19 | 12.01 |
| `-falign-loops=64 -falign-functions=64` | 11.84 | 11.87 |
| `-falign-loops=16 -falign-functions=32` | 12.00 | 12.16 |
| `-mbranches-within-32B-boundaries` | 12.20 | 12.29 |
| `-mtune=generic` | 11.83 | 11.94 |
| `-fno-jump-tables` | 11.88 | 12.11 |

So natively the change is between 1.5% faster and 3.1% slower, depending on
the compiler and on where the code lands. The cause was not found. That it
is code layout is an assumption: the alignment options move the result as
far as the change does. This breaks the rule that nothing else gets slower
by more than 1%. The change is kept all the same, because the engine that
runs tournaments is the WebAssembly build. For the native library
(`PLAN.md`, L) this loop needs a new measurement with the library's
compiler and flags.

#### Rejected changes of this round

Against the build named in the row, `tools/ab-wasm.mjs`, median:

| Idea | Result | Verdict |
|---|---|---|
| Queue counters as byte offsets, to save the shift in every queue access (on top of one head) | 50,055 bytes; 3 runs: bench 306.6 → 296.2 (-3.4%), pairs 297.5 → 285.3 (-4.1%), t20 3.63 (3.59–3.64) → 3.81 (3.78–3.81) (+5.0%). 58.3 x86 instructions per simulated instruction instead of 61.4, 15.65 cycles instead of 15.1 | rejected |
| The arithmetic at the loop exit in 32 bits: `pairs = h - start` once, instead of `2 * (i64)(h - start)` twice (on top of one head) | 50,233 bytes; 3 runs: bench 309.4 → 300.6 (-2.8%), pairs 300.0 → 285.6 (-4.8%), t20 3.65 (3.60–3.66) → 3.82 (3.79–3.84) (+4.7%) | rejected. A change outside the loop loses the whole gain; why was not looked up in V8's code |
| Every store into the core writes the whole 64-bit cell, so that every later load can forward from it (on top of one head) | 52,352 bytes; 3 runs: pairs 298.3 → 273.9 (-8.2%), t20 3.66 → 4.06 (+10.9%); native 48.4 x86 instructions and 12.5 cycles per simulated instruction | rejected: 4.2 more x86 instructions and 1.9 more loads per simulated instruction in V8's code |
| `BA` and `BB` as 16-bit loads of one field instead of a 32-bit load and a mask (on top of the kept build) | 50,579 bytes; 7 runs: bench 309.5 → 311.2 (+0.5%), pairs 301.0 → 302.2 (+0.4%), t20 3.60 (3.59–3.61) → 3.59 (3.58–3.64) | rejected: noise, 1.4 KB more |
| `DJN.A`/`.B`/`.AB`/`.BA`: test and decrement from one 16-bit load (on top of the kept build) | 49,078 bytes; 7 runs: bench 309.4 (290.6–311.4) → 312.6 (308.3–313.9) (+1.0%), pairs 300.0 → 301.5 (+0.5%), t20 3.59 (3.57–3.64) → 3.58 (3.57–3.62) | rejected: inside the noise |
| The row above and `DJN.F`/`.X`/`.I` with one 32-bit load and one `set_ab()` | 48,931 bytes; 7 runs against the kept build: bench 309.7 (308.9–313.5) → 305.7 (287.1–306.9) (-1.3%), pairs 301.5 → 299.2 (-0.8%), t20 3.61 → 3.63 (+0.6%) | rejected |
| The instruction fetched with three 16-bit loads instead of one 64-bit load, so that the fetch forwards from a 16-bit store into the cell (on top of the kept build) | 48,696 bytes; 3 runs: pairs 303.1 → 294.2 (-2.9%), t20 3.59 → 3.68 (+2.5%). With the `DJN` row as well (48,225 bytes): pairs -1.8%, t20 +1.7% | rejected |

#### Store-to-load forwarding: what it costs and where

A microbenchmark on this CPU (Zen 4), cycles per round of a store and a
load that depends on it:

| Store, then load | cycles |
|---|---|
| same size, same address | 3 to 4 (memory renaming) or 9 |
| load inside a wider store at an offset above 0 (8 bytes at 0 then 2 at 2 or at 4, 8 at 0 then 4 at 4, 4 at 0 then 2 at 2) | 9 |
| load wider than the store (2 at 2 then 4 at 0 or 8 at 0, 4 at 0 then 8 at 0) | 21 |

The second row is forwarded and still counts 1.1 to 1.6
`ls_bad_status2.stli_other` events per round, so that counter is an upper
bound. AMD IBS samples carry no forwarding bit on this CPU.

To find the loads that really fail, the native build got a shadow model:
for every byte of the core the simulated instruction and the size of the
last store, checked at every load in the source. Loads wider than a store
at most 3 / at most 7 simulated instructions before, per simulated
instruction on t20:

| Load | at most 3 | at most 7 |
|---|---|---|
| instruction fetch (64 bits) | 0.033 | 0.061 |
| A cell of a direct A operand (64 bits; the model counts it also where the compiler narrows or drops the load) | 0.026 | 0.041 |
| `DJN.B`: 32-bit load after its own 16-bit store one loop pass earlier | 0.0045 | 0.028 |
| `ADD.F`, `SUB.F`: second value after the first store | 0.0235 | 0.040 |
| `ADD.AB` | 0.004 | |

The sum at 7 instructions is about 0.18; the counter says 0.17 for the
native build of `main`.
The t20 mix, for the weights: `SPL.B` 29.83%, `MOV.I` 29.83%, `DAT.F`
14.20%, `JMP.B` 9.30%, `DJN.B` 7.23%, `CMP.I` 3.61%, `SUB.F` 1.64%, `JMN.B`
1.53%, `MOV.AB` 0.82%, `ADD.F` 0.71%, `ADD.AB` 0.60%, `SLT.AB` 0.34%,
`SUB.AB` 0.34%.

Only the `ADD.F`/`SUB.F` row was worth a change: it fails on every
execution, and the fix makes the code smaller. The fetch and the A cell
fail after a 16-bit store of another instruction, and both ways around
that (whole-cell stores, 16-bit loads) cost more than they save.

Noted, not built: `WRAP` as an unsigned minimum, the chunk of
`tie_check()` rounded to an even number so that the pair loop never ends
on an odd budget, a dense dispatch index in the padding of the cell.

State: bench about 310M/s in WebAssembly (`runMatch` and the step API),
about 422M/s natively (436M/s for the third-round code on the same day);
corpus pairs 302M/s; t20 3.60 s single thread; t80 3.31 s with 16 jobs and
2.96 s with 31 jobs (10th November 2026; `main` measured 298.5M/s,
283.5M/s, 3.80 s, 3.46 s and 3.11 s on the same day). Warmed up against
corewar.dev's exMARS
(`cwbench/benchpairs.mjs`, median of 3 runs): agony/bubbles 345 vs 192M/s
(1.78x to 1.81x), bomber/chalk 323 vs 143 (2.24x to 2.26x),
army/bananasplit 347 vs 188 (1.84x to 1.86x); `main` on the same day ran
327, 311 and 330M/s. t20 split (`cwbench/split.mjs`, 3 runs): pairings
without tie rounds 374 vs 671 ms (1.79x to 1.81x), with tie rounds 3,157
vs 5,484 ms (1.73x to 1.74x).

### Fifth round: the tournament scheduler, and four engine ideas that did not pay (10th November 2026)

Same machine, Node 22.22.2, clang 22.1.8. The machine ran about 15% faster
in this session than in the fourth round's on the same day (bench 359
instead of 310M/s for the same `mars.wasm`, t20 3.03 instead of 3.60 s), for
an unknown reason. So every number here is an A/B inside this session, and
the "State" lines above stay as they are. Load average 1 to 5 from the
runs themselves.

#### `tools/tournament.mjs`: one shared task list, kept

Measured first, with a timer in a copy of the tool:

| Measurement | Result |
|---|---|
| Worker start in the old tool, one warrior against the corpus (`--bench`, 565 warriors, 200 rounds) | 220 ms for 32 workers and 115 ms for 16 before the first task was sent: every `new Worker` cloned all warriors (`workerData`). t80 (80 warriors): 40 ms |
| Node's own worker start, empty workers | the 31 constructors take 10 ms together, all 31 run after 82 to 111 ms; 15 after 53 ms, 4 after 31 ms |
| First result per worker, old tool | 27 to 122 ms after the last constructor |
| Tail, t80 with 32 jobs | the first worker ran out of tasks 77 ms before the end of 2,814 ms; longest task 171 ms |
| Second hardware thread per core, t80 | 16 jobs 48.3 CPU-s in 3.12 s, 32 jobs 85.2 CPU-s in 2.81 s: 76% more CPU time for 11% more throughput |
| One `runMatch` call without rounds | 1.3 us; with `firstRound` 990 (the generator steps 990 times) 6.6 us. 8 rounds take about 1,100 us |

The new scheduler: the tasks, the results and the warriors (packed, see
below) are in one `SharedArrayBuffer`. Every thread takes the next task
with `Atomics.add` and writes its result into the buffer, so no thread
waits for a message. The main thread takes tasks too and is one of the
`--jobs` (default now all hardware threads instead of all but one). The
run ends when the last task is done; workers that have not started by
then are terminated. `--jobs 31` used to mean 31 workers next to a waiting
main thread and now means 31 threads in all. With the wasm engine every pairing without `LDP` is
split into blocks of about 8 rounds, always, not only with few pairings
per job: the blocks cost 1.3 us each and the tail shrinks to one block.
Pairings with `LDP` stay whole and come first.

`packWarrior()` in `mars-wasm.js` turns a warrior into the 5 integers per
instruction that `mars_config()`'s load area takes, and `load()` copies a
packed warrior with one `set()`. The tournament keeps all packed warriors
in the shared buffer.

Old tool against new, alternating, fresh process per run, 5 runs (7 for the
two short ones), engine time as the tool prints it, median (range), seconds:

| Workload | old | new | change |
|---|---|---|---|
| t80, 16 jobs | 3.15 (3.11–3.18) | 3.09 (3.07–3.12) | -1.9% |
| t80, 32 jobs | 2.86 (2.85–2.88) | 2.84 (2.83–2.85) | -0.7% |
| `agony.red` against the corpus, 200 rounds, 32 jobs | 1.36 (1.36–1.37) | 1.21 (1.20–1.21) | -11.0% |
| the same, 16 jobs | 1.32 (1.31–1.33) | 1.23 (1.22–1.24) | -6.8% |
| t20, 1 job (no worker anymore) | 3.08 (3.04–3.09) | 3.00 (2.99–3.02) | -2.6% |
| t20, 32 jobs | 0.30 (0.30–0.31) | 0.26 (0.25–0.26) | -13% |
| t80, `--rounds 1`, 32 jobs | 0.13 (0.12–0.14) | 0.11 (0.11–0.13) | -15% |
| `agony.red` against `bubbles.red`, 1,000 rounds, 32 jobs | 0.12 (0.12–0.13) | 0.07 (0.07–0.09) | -42% |
| t20, `--engine js`, 32 jobs | 1.61 (1.53–1.70) | 1.67 (1.62–1.70) | +3.7%, ranges overlap, 9 runs |
| t20, `--engine js`, 8 jobs | 2.00 (1.99–2.02) | 1.99 (1.97–2.02) | -0.5% |

The wall time of the whole process is 90 to 120 ms more in every row
(Node start, assembly, output) and did not change. The JS engine plays
whole pairings only, so 190 tasks on 32 threads end unevenly, with or
without the change. Results: the tables of every row are byte-identical to
the old tool's, and `--pmars --compare` gives SAME on t20 (seed 4711), t80
and `agony.red` against the corpus (565 pairings, 50 rounds).

What is left of the fixed cost is Node's worker start, about 100 ms for 31
workers. A caller that runs many short tournaments in one process (an
evolver) needs a pool that stays alive; the tool starts its workers anew
on every run.

#### Engine ideas, all rejected

| Idea | Result | Verdict |
|---|---|---|
| Short linear queues: `run_some()` runs chunks of 8,192 pairs of turns and moves the live queue entries back to the start between chunks, so a round touches about 32 KB of queue memory instead of up to 640 KB. The aim was the second hardware thread: two engines on one core share the 1 MB L2 cache | `tools/ab-wasm.mjs`, 5 runs: bench 359.0 → 350.6 (-2.3%), pairs 354.5 → 347.5 (-2.0%), t20 3.04 → 3.12 (+2.6%), t80 16 jobs 3.10 → 3.16 (+1.9%), 31 jobs 2.85 → 2.89 (+1.4%). Module 49,573 bytes | rejected. The queues are not what limits the second thread; the wasm code runs at 4.1 instructions per cycle on one thread already (61.3 / 14.9) |
| Exact early tie for two warriors in closed loops (#35), built and measured. A traced loop (`loop_run()`, the generic `exec_ins()` plus a hook) notes per warrior the cells it reads and writes and what a cell held at its first read. A warrior repeats when its queue and all cells it read are as at the start of the attempt. Both repeat and neither wrote a cell the other read: tie. It gives up before a `DAT`, `DIV`, `MOD` or `STP`, at more than 32 read cells, and when one writes what the other read. Attempts only when both have at most 8 processes, 24,000 instructions each, the wait doubles after a failure | Share of the instructions it saves: t80 0.71% (first attempt after 50,000 instructions) to 0.88% (after 12,000, no growing wait), 400 corpus pairs 1.56% to 2.1%, t20 0.08%, against ceilings of 3.02%, 5.15% and 0.61% (#35). It traces 0.2 to 1.0 instructions per saved one. Reasons to give up on t80 (first attempt at 12,000, 76,925 attempts): 20,658 a `DAT` ahead, 15,568 too many cells read, 19,243 a cell read after its own write, 15,555 a write into a cell the other read (64.7M of the 121M traced instructions), 3,609 a read of a cell the other wrote, 1,023 window over, 1,269 proven. Native (`bench-native --early-tie`, alternating): first attempt at 50,000: pairs 1,592 → 1,582 ms (-0.6%, 5 runs), t80 37.02 → 36.87 s (-0.4%, 3 runs). wasm, first attempt at 12,000 (`ab-wasm.mjs`): t80 16 jobs 3.03 → 3.07 (+1.3%), 31 jobs 2.80 → 2.83 (+1.1%), 7 runs, ranges apart; pairs with `--early-tie` 1,907 → 1,886 ms (-1.1%, 5 runs, ranges overlap); bench, pairs and t20 unchanged. Module 55,341 bytes instead of 49,171 | rejected: a traced instruction costs about 3.5 normal ones in V8, so the 0.7% of t80 it saves are gone, and natively 0.5% do not pay for 130 lines with a proof to maintain. The share is what such a proof gets in practice: most closed rounds of the ceiling do not repeat a small state in time. The patch is not in the repository |
| The same idea with a copy of the whole core per attempt instead of the content at the first read | 72 KB copied and cleared per attempt, 92,400 attempts on t80; in wasm the pairs with `--early-tie` showed no gain at all (1,871 to 1,889 ms without, 1,873 to 1,903 ms with it) | replaced by the row above |
| More specialized instruction words natively: 48, 64 and 96 cases instead of 32, ranked on t20, t80, 400 corpus pairs and the bench with early ties (96 cases cover 99.7% of the executions) | native, 3 alternating runs, M/s: t20 430.0 → 429.6 (48), 422.0 (64), 400.6 (96); pairs 411.3 → 411.6, 404.7, 388.1 | rejected: as in wasm, the larger loop costs more than the generic path |

Two things learned on the way:

* A new function or static in front of the hot loops changes them: the
  first detector build moved function indices and data addresses, and the
  bench, which never runs the detector, lost 1.1% (pairs 1.6%, t20 1.7%).
  With the new code and its statics behind everything else, `execute()`,
  `execute2_8000()` and `execute2_any()` differed from `main` in one byte
  (a call index), and bench, pairs and t20 were back within noise. To
  check, compare the bodies of the code section of both modules function
  by function.
* The first two native runs of the detector looked 1.3% and 2.9% faster.
  That was the build with the statistics counters; the clean build gains
  0.4% and 0.6%.

#### A context object instead of globals, first numbers for #53

Not a decision, the numbers for L1. A script turned every global of
`mars.c` (rules, counters, `war`, the core and both queues) into a field of
one struct and gave every function `Mars *const m = <context>` as its first
line; `execute2()` reads `m` once per call. Native, `clang -O3
-march=native`, 5 alternating runs with early ties, median M/s:

| Input | globals (`main`) | context through a pointer | the struct at a fixed address |
|---|---|---|---|
| t20 | 432.7 | 408.3 (-5.6%) | 429.1 (-0.8%) |
| 400 corpus pairs | 410.8 | 385.2 (-6.2%) | 405.9 (-1.2%) |
| bench, 2000 rounds | 508.8 | 481.3 (-5.4%) | 501.8 (-1.4%) |

Per simulated instruction on t20 (`perf stat`): globals 45.23 x86
instructions, 12.29 cycles, 7.09 branches, 8.14 loads; pointer 46.64,
12.95, 7.47, 8.68; fixed address 46.03, 12.46, 7.23, 8.53. The pointer
build runs 0.4 more branches per simulated instruction, so clang compiles
the loop differently, not only with one more base register. Why was not
looked up in the code. Not measured in wasm. The measurement with the code
that is kept follows in the next section.

### A context object: one per module at a fixed address, no loss (10th November 2026, #53)

`mars.c` now keeps all state in one `struct Mars`, and every function takes
`Mars *const m` as its first parameter. The exports call them with `CTX`.
Two builds of the same file:

* **fixed address** (the default, and the only wasm build): one `static Mars
  theMars`, `CTX` is `&theMars`. The core and the two static queues stay
  separate static arrays outside the struct, reached through `CORE(m)` and
  `QUEUES(m)`. clang propagates the constant context into every static
  function, so the hot loops address everything with constant offsets, as
  with the globals before.
* **pointer** (`-DMARS_CONTEXT_POINTER`, measurement only): the context is at
  the start of the heap and its address comes from a `volatile`, so clang
  cannot know it, as for a library whose caller passes the context in. The
  core and the queues are in the struct. `execute()` and `execute2()` load
  core, queues, core size, mask and limit into locals at entry, as before.

Wasm, `tools/ab-wasm.mjs` against `main` (`b7c421a`), median and range,
bench and pairs in M/s, tournaments in s:

| Measure | `main` | pointer | `main` | fixed address |
|---|---|---|---|---|
| bench (n=7, 11) | 362.6 (353.9–368.9) | 340.9 (329.5–348.7), -6.0% | 364.4 (351.7–373.0) | 367.6 (355.2–375.7), +0.9% |
| pairs (n=7, 11) | 356.3 (352.5–362.8) | 340.9 (337.8–346.2), -4.3% | 359.2 (357.8–364.0) | 356.0 (349.9–360.8), -0.9% |
| t20 (n=7, 11) | 2.99 (2.96–2.99) | 3.16 (3.11–3.20), +5.7% | 2.97 (2.96–3.01) | 2.98 (2.95–3.02), +0.3% |
| t80, 16 jobs (n=5) | 2.94 (2.94–2.96) | 3.10 (3.09–3.12), +5.4% | 2.94 (2.92–2.95) | 2.95 (2.93–2.95), +0.3% |
| t80, 31 jobs (n=5) | 2.72 (2.70–2.76) | 2.84 (2.83–2.86), +4.4% | 2.71 (2.69–2.72) | 2.70 (2.69–2.72), -0.4% |

Native, `tools/ab-native.mjs`, `clang -O3 -march=native`, 5 alternating
runs, M/s; t20 and t80 with early ties from `--native-input`:

| Input | `main` | fixed address | `main` | pointer |
|---|---|---|---|---|
| bench | 501.4 (496.8–504.5) | 514.4 (507.7–518.3), +2.6% | 511.4 (483.3–513.9) | 493.8 (484.1–499.0), -3.4% |
| t20 | 439.4 (436.9–442.1) | 442.8 (441.2–443.5), +0.8% | 439.2 (434.7–441.9) | 432.8 (431.5–435.3), -1.5% |
| t80 | 445.6 (443.9–449.6) | 451.6 (450.9–453.3), +1.3% | 446.6 (446.1–447.3) | 442.9 (436.5–445.3), -0.8% |

The pointer costs 4 to 6% in wasm. Every core and queue access then needs an
`i32.add` of the base, wasm has no base plus scaled index addressing.
Natively it costs 1 to 3%, less than the 5 to 6% of the first try above.
That try had the core in front of the queues in the struct, and two layout
details decided most of the difference:

* **Queues in front of the core.** With the core first, clang addressed
  warrior 0's queue from warrior 1's with a negative offset, which wasm
  cannot fold into the load: one more `i32.add` per pop in
  `execute2_8000()`. With the queues first that add is gone.
* **Core and queues outside the struct in the fixed build.** With all three
  arrays in the static struct, bench and pairs were equal to `main`, but t20
  was +2.0% (n=7) and +1.4% (n=15): clang ordered loads and stores in
  `execute2_8000()` differently, about 140 instructions moved. With
  separate arrays `execute2_8000()` differs from `main` in one load, the
  order of the local declarations and `roundOver` read as a byte. The
  numbers above are for this build.

Also tried, pointer build: `restrict` on the core and queue pointers of
`execute2()`, bench +1.0%, t20 +0.4% against the pointer build, within the
ranges of the runs. Rejected.

Decision: the wasm module keeps one context at a fixed address, which is how
the workers use it anyway, one module per worker. The native build and
`bench-native.c` use the same. A native library with several contexts in
one process needs the pointer form and pays 1 to 3% for it, measured here;
whether L3 (`42mars.h`) takes that or offers both forms is decided there.

### The C assembler in the same module: no change in speed, 5 ms more start-up (10th November 2026, #54)

`lib/src/asm.c` is linked into `wasm/42mars.wasm` after `mars.c`; the
module grows from 49.7 to 77 KB. The code of `execute()`,
`execute2_8000()` and `execute2_any()` stays the same apart from call
indices, but `asm.c`'s read-only data lies in front of the simulator's, so
the core, the queues and the context move up by 1280 bytes (still 64-byte
aligned). `tools/ab-wasm.mjs`, `main` against the new module, median and
range:

| Measure | `main` | with the assembler |
|---|---|---|
| bench (n=9) | 362.5 (351.3–370.0) | 364.2 (359.4–372.9), +0.5% |
| pairs (n=9) | 357.2 (351.2–360.4) | 354.1 (345.4–359.9), -0.9% |
| t20 (n=9) | 2.98 (2.97–2.99) | 3.00 (2.97–3.04), +0.7% |
| t80, 16 jobs (n=5) | 2.96 (2.95–2.98) | 2.96 (2.96–3.00), 0.0% |
| t80, 31 jobs (n=5) | 2.74 (2.72–2.74) | 2.74 (2.72–2.75), 0.0% |

All within the ranges. The fixed cost, t80 with `--rounds 1 --jobs 31`
(whole process, 7 alternating runs): median 231 ms with the assembler
against 226 ms, about 5 ms more for compiling the larger module. Splitting the assembler into a
module of its own would save that for callers that only simulate; not done,
it is 0.2% of a t80 tournament.

### The public header: the wasm loops stay byte-identical (11th November 2026, #55)

`lib/42mars.c` compiles the simulator, the assembler and the functions of
`lib/42mars.h` as one translation unit. Natively a context now lives in
caller memory (the pointer build of #53, 1 to 3% slower); the wasm build
and `tools/bench-native.mjs` use `-DM42_FIXED_CONTEXT`. Three things had to
be right before `execute()`, `execute2_8000()` and `execute2_any()` were
byte-identical to the previous module again, data addresses included, so
that no new timing was needed:

* The API functions get a handle. Passed on as it is, the loops took the
  context as a parameter (8 more wasm instructions each, a base register
  for every access). Even `m ? CTX : 0` keeps the address from being a
  constant; with `M42_FIXED_CONTEXT` every handle now is `CTX`.
* clang emits a static array without an initializer where the first
  function uses it (or at the end of the file). With the exports moved,
  the core came before the queues in memory, a layout that was never
  timed (layouts moved the loops by 1 to 2% before).
  `__attribute__((used))` alone did not change it; `used` with a zero
  initializer emits both arrays where they are defined.
* New fields of `struct Mars` go to its end, so that the offsets the loops
  read stay the same.

Second part (#55): `wasm/42mars.js` calls only the `m42_` functions, and
the old exports are gone. The loops are byte-identical apart from data
addresses: `api.c`'s strings lie in front, so the queues, the core and the
context moved up by 256 bytes. The glue costs 0.3 µs more per
`runMatch()` (14.8 against 14.6 µs for a 1-instruction match of 8 rounds,
3 runs), because it writes the warriors with `m42_warrior_make()` and reads
the scores through the API. Alternating runs of `main` and the branch,
copies of both repositories (`git archive`), median and range:

| Measure | `main` | branch |
|---|---|---|
| bench (n=7) | 370.0 (352.8–372.1) | 367.5 (353.0–371.6), -0.7% |
| pairs (n=7) | 354.5 (344.9–355.8) | 353.1 (352.4–357.3), -0.4% |
| t20 (n=7) | 3.01 (2.99–3.07) | 3.00 (2.98–3.01), -0.3% |
| t80, 16 jobs (n=7) | 2.99 (2.98–3.03) | 2.99 (2.98–3.01), 0.0% |
| t80, 31 jobs (n=5, 7, 9) | 2.75, 2.74, 2.75 | +1.1%, +1.1%, +0.7%, ranges overlapping |
| t80, 1 round, 31 jobs, ms (n=5) | 241.6 (231.5–247.1) | 234.4 (232.1–250.3), -3.0% |

`main` with 256 bytes of padding in front of its data (nothing else
changed) against `main`: t80 with 31 jobs +0.4% (n=9, ranges
overlapping). What is left at 31 jobs, up to 1%, I could not tell from
noise; at 16 jobs and on one thread there is none.

### MSVC gets 16 cases instead of 32: a quarter of the compile time, the same speed (12th November 2026)

The Windows job of CI took about 4.5 minutes, the other jobs under 30 s.
Nearly all of it was `cl /O2` on `lib/42mars.c`, twice (static library
and DLL), about 2 minutes each. `/d2cgsummary` names the loops of
`execute2()`: `execute2_8000` 45 s, `execute2_any` 45 s, `execute2` 40 s,
everything else under 3 s. Each of them inlines `step()` twice, with its
32 specialized cases of `dispatch.h`, which means 66 copies of
`exec_ins()` in one function. MSVC's time grows faster than that size.
`lib/src/platform.h` now defines `M42_DISPATCH_16` for MSVC, and
`tools/gen-dispatch.mjs` puts the cases after the first 16 (the hottest,
`HOT` is ranked) inside `#ifndef M42_DISPATCH_16`. The gcc, clang and wasm
builds are byte-identical to before.

GitHub's `windows-latest` runner (4 vCPUs, AMD EPYC 9V45, MSVC 14.51 of
Visual Studio 18), `cl /std:c11 /O2`, the `42mars` program built from each
object, `42mars -b -r <rounds>` on the warriors of `warriors/`, the
variants alternating, median of 5 runs in seconds. Compile time of
`lib/42mars.c` alone:

| Variant | compile | lantern - origami, 10000 | seeker - dwarf, 100000 | origami - imp, 30000 | lantern - origami - seeker, 3000 |
|---|---|---|---|---|---|
| MSVC, 32 cases | 140.7 s | 4.809 | 5.299 | 3.790 | 1.294 |
| MSVC, 16 cases | 36.7 s | 4.770 (-0.8%) | 5.079 (-4.2%) | 4.083 (+7.7%) | 1.279 (-1.2%) |
| MSVC, 8 cases | 12.7 s | 4.922 (+2.3%) | 5.936 (+12.0%) | 3.733 (-1.5%) | 1.276 (-1.4%) |
| clang-cl 20.1.8, 32 cases | 6.5 s | 4.665 (-3.0%) | 5.046 (-4.8%) | 4.445 (+17.3%) | 1.261 (-2.5%) |

Another run on another runner: no cases at all compiled in 2.6 s and
was 31% slower on seeker - dwarf (6.878 against 5.238 s), 1 to 3% apart
on the others. Without `execute2()` (every match through `execute()`)
the compile took 7.7 s and lantern - origami 6.3 against 4.8 s. A plain
`inline` instead of `__forceinline` (`-DM42_PORTABLE`) compiled in 0.8 s
and was twice as slow. `/O1` was slower to compile than `/O2` (107 s).

16 cases it is. `build-msvc.bat` also compiles the two objects in
parallel (`cl /MP`), and the Windows job went from about 280 s to under a
minute. Four warrior pairs are not a tournament, the corpus and the
tournament sets cannot go to CI: the MSVC numbers above are all there is.

Later the same day `build-msvc.bat` stopped compiling a second object for
the DLL: the two parallel compiles shared the 4 vCPUs, 53 s together. Now
one object (39 s on the runner) makes both the static library and the DLL,
whose exports are listed in `lib/42mars.def`. The build step went from 64
to 47 s, the Windows job from 86 to 72 s (#82).

### All engines as whole processes, the README charts (12th November 2026)

Every engine plays the 3 bench pairs, 4,000 rounds each from `-F 1334`
(445,920,804 instructions), as whole processes: start, assembly and, for
WebAssembly, Node start and module compile included. 7 alternating runs,
median (range), idle machine, GCC 16.2, Node 22.22. All 9 builds gave the
same wins, losses and ties. Commands in `docs/images/speed.mjs`, which draws
the charts of `README.md`.

| Engine | Seconds | M instructions/s |
|---|---|---|
| 42mars, `build/42mars` (`make`, `-O3`) | 0.932 (0.918–0.939) | 478 |
| fmars 0.0.207 (`bin/xfmars`) | 1.109 (1.096–1.139) | 402 |
| 42mars, WebAssembly `runMatch()` | 1.144 (1.133–1.170) | 390 |
| 42mars, WebAssembly, no early ties | 1.153 (1.150–1.182) | 387 |
| exMARS 0.01, native | 1.600 (1.589–1.621) | 279 |
| rmars 215fadc, `--threads 1` | 2.321 (2.298–2.379) | 192 |
| exMARS, corewar.dev's WebAssembly build | 2.957 (2.917–3.026) | 151 |
| pMARS 0.9.5 | 4.225 (4.190–4.261) | 106 |
| pMARS, corewar.dev's WebAssembly build | 6.917 (6.876–7.145) | 64 |

The same measurement an hour earlier, without exMARS 0.01, gave times about
1% lower for every engine (42mars 0.920 s, pMARS 4.182 s): the README uses
the later run only. exMARS 0.01 (Martin Ankerl, 2003) was downloaded and
built for this under a one-time hook exception Martin asked for; the session
read its `Makefile`, `bench.sh`, `doc.txt` and the first 30 lines of the
register-width/MUL patch (not applied), wrote no engine code, and deleted
the source tree afterwards (`$COREWAR_ORACLE/README.md`, `bin/exmars`).

### Sixth round: a dispatch index in every cell and 512 specialized words; '94 hills 32 to 70% faster natively, '88 hills 6 to 14% (14th November 2026)

From this round on the native library is what gets tuned, not the wasm
build (Martin, 14th November 2026). The measure is the library as `make`
builds it: `-O3 -fPIC`, the context in caller memory, with gcc 16.2.1 (what
`cc` is here) and clang 22.1.8. Until now the native numbers of this log
were `clang -O3 -march=native -DM42_FIXED_CONTEXT`, the wasm build's code
natively; `bench/bench-native.mjs --flags` still builds that.

The round has two halves, and the second one overturned part of the first.
All earlier rounds, and the first half of this one, were measured on one
corpus (t20, t80, corpus pairs, the bench), whose warriors are mostly in
the style of ICWS'88: they execute 26 to 94 different instruction words,
and the 32 words with a case were 96 to 99.9% of their instructions. The
Koenigstuhl hills in `warriors/koenigstuhl` were never run. A '94 hill
executes 200 to 1,020 different words; with the 32 words of `main` 79% of
94nop's instructions ran the generic code, and `main` plays 94nop at 220M
instructions/s where it plays the '88 hill at 420M. A code review of the
first half found it: its 64 cases, ranked on the old corpus again, and the
generic code behind a call made the '94 hills 12 to 23% slower than `main`.
The second half ranks the words over 13 mixes, 9 of them hills, and has
512 cases.

Method: `bench/ab-native.mjs` (rewritten for this: several inputs, several
compilers, `--cpu`; a version is a copy of `lib/` or a `mars.c`), every run
pinned to CPU 2, which Martin locked to a fixed frequency. The ranges of 3
runs are within 0.3% then, so 3 runs screen and 5 confirm. Every run
executes a fresh copy of its binary: in the morning, with the machine in
use, one file of a build ran 5% slower than six copies of it, every time
(the path and the size of the environment made no difference, the cause
was not found). In the night runs before that, builds of the same source
agreed within 0.3%. Every variant executed exactly the instructions of
`main` on every input.

The inputs, all with early ties. Hills: random pairs of a Koenigstuhl hill
with its settings, `node bench/bench-pairs.mjs warriors/koenigstuhl/<hill>
--pairs P --rounds R <settings> --native-input <file>`:

| Input | Pairs × rounds | Settings | Different words executed |
|---|---|---|---|
| 94nop | 300 × 20 | | 655 |
| pspace (`pspace-top50`) | 200 × 20 | | 319 |
| tiny | 600 × 200 | `--size 800 --processes 800 --cycles 8000 --length 20 --distance 20` | 1,023 |
| nano | 1500 × 800 | `--size 80 --processes 80 --cycles 800 --length 5 --distance 5` | 280 |
| lp | 300 × 20 | `--processes 8 --length 200 --distance 200` | 384 |
| x | 20 × 10 | `--size 55440 --processes 10000 --cycles 500000 --length 200 --distance 200` | 203 |
| odd | 150 × 10 | `--length 800 --distance 800` | 575 |
| 88 | 200 × 20 | | 84 |
| icws | 150 × 20 | `--size 8192 --cycles 100000` | 75 |
| t20, t80s, corpus pairs, bench | as before; t80s is every 8th pairing of t80, the bench has 2,000 rounds | | 43, 62, 94, 26 |

Everything of this round against `main` (its whole `lib/`, `git archive
origin/main lib`), exactly the flags of the Makefile, 5 runs, M
instructions/s, median (range):

| Input | gcc `main` | gcc now | | clang `main` | clang now | |
|---|---|---|---|---|---|---|
| 94nop | 220.1 (219.8–223.2) | 358.6 (358.6–358.8) | +62.9% | 236.7 (235.6–237.3) | 348.3 (347.2–350.3) | +47.1% |
| pspace | 207.6 (207.2–208.9) | 352.8 (352.2–352.9) | +69.9% | 221.4 (220.5–222.2) | 348.7 (347.9–349.1) | +57.5% |
| tiny | 186.9 (185.8–188.4) | 283.4 (283.0–283.7) | +51.6% | 201.5 (199.2–203.0) | 278.0 (277.7–278.4) | +38.0% |
| nano | 212.3 (212.1–212.7) | 309.4 (308.3–309.9) | +45.7% | 222.2 (220.9–222.6) | 293.3 (291.2–295.7) | +32.0% |
| lp | 199.7 (199.1–201.8) | 307.2 (305.3–307.5) | +53.8% | 218.0 (217.6–219.3) | 295.4 (288.8–301.6) | +35.5% |
| x | 224.3 (224.0–226.1) | 361.4 (350.9–361.6) | +61.1% | 235.5 (234.1–236.3) | 333.2 (328.6–339.1) | +41.5% |
| odd | 240.3 (239.5–240.7) | 371.4 (370.8–372.1) | +54.6% | 248.1 (247.8–251.3) | 361.4 (359.4–363.9) | +45.7% |
| 88 | 420.3 (419.8–420.7) | 466.6 (466.3–467.1) | +11.0% | 402.9 (400.6–404.9) | 460.7 (450.0–462.7) | +14.3% |
| icws | 380.9 (379.4–383.3) | 434.3 (433.6–435.2) | +14.0% | 386.9 (386.4–392.9) | 410.5 (397.1–423.6) | +6.1% |
| t20 | 423.4 (422.5–424.2) | 468.7 (468.3–469.5) | +10.7% | 414.6 (414.0–416.5) | 468.0 (466.3–470.1) | +12.9% |
| corpus pairs | 404.9 (404.3–405.0) | 451.1 (450.9–451.9) | +11.4% | 391.5 (389.4–393.7) | 440.3 (437.3–446.3) | +12.5% |
| t80s | 431.2 (431.0–431.5) | 477.0 (476.6–477.4) | +10.6% | 424.6 (423.8–425.1) | 468.2 (458.4–474.1) | +10.3% |
| bench | 473.0 (473.0–473.2) | 516.7 (515.5–517.3) | +9.2% | 491.7 (490.6–492.8) | 528.5 (523.6–546.9) | +7.5% |

What is in the code at the end of the round:
- the dispatch index of the word in every cell (`Cell.hot`) and Huffman
  trees of compares on it (first half, 1)
- 256 cases in the instruction loops, 256 more in one function behind them
  (`exec_more()`), the generic code for the rest (second half)
- the index and the two values of the instruction loaded with loads of
  their own (first half, 9; for every compiler since the second half)
- for clang the loop counter hidden behind the loop of `execute2()` (first
  half, 4), for the wasm build the index hidden from the optimizer
- the core cleared through locals (first half, 6), and the warrior records
  64-byte aligned ("Found on the way")

Built in the first half and gone again by the end of the second: the
shares in the compares of the tree (3), the alignment of the loop
functions (7), the tie proof (8) and gcc without partial redundancy
elimination (10).

The wasm build, `bench/ab-wasm.mjs` (not pinned), 7 runs, t80 5, and the
hills with `bench/bench-pairs.mjs --early-tie` (3 alternating runs), median
(range):

| Measure | `main` | this round | change |
|---|---|---|---|
| 94nop, 100 pairs × 20 rounds, M/s | 235.9 (233.8–236.8) | 299.0 (298.5–299.3) | +26.7% |
| tiny, 300 pairs × 200 rounds, M/s | 193.2 (193.0–196.5) | 247.8 (246.9–248.1) | +28.3% |
| bench, M/s | 360.7 (357.1–368.3) | 333.7 (330.4–338.8) | -7.5% |
| corpus pairs, no early ties, M/s | 352.7 (344.8–356.9) | 346.3 (333.7–348.5) | -1.8% |
| t20, s | 3.02 (3.00–3.11) | 2.97 (2.92–3.09) | -1.7% |
| t80, 16 jobs, s | 2.96 (2.96–2.99) | 2.93 (2.93–2.99) | -1.0% |
| t80, 31 jobs, s | 2.75 (2.75–2.76) | 2.68 (2.67–2.75) | -2.5% |

The bench is three matches in 60 ms, and V8 now needs 17 ms instead of 8
to compile the loop with its optimizing compiler.

#### Second half: the hills

What the mixes execute, and what the cases of each state cover (share of
the executed instructions that run the generic code):

| Mix | `main`, 32 cases | first half, 64 cases of the old corpus | 256 + 256 cases of 13 mixes |
|---|---|---|---|
| 94nop | 79.0% | 77.7% | 0.50% (2.2% more in `exec_more()`) |
| pspace | 80.5% | 77.4% | 0.13% (0.8%) |
| tiny | 84.7% | 83.0% | 1.18% (3.3%) |
| nano | 83.5% | 83.3% | 0.47% (2.2%) |
| lp | 69.0% | 65.2% | 0.11% (2.0%) |
| 88 | 3.4% | 0.3% | 0.04% (0.1%) |
| t20 | 1.3% | 0.0% | 0.00% |

The ranking is `gen-dispatch.mjs --rank` over the count files of the 13
inputs above (t80 whole), each weighted equally. Compares per instruction
in the final trees: 5.0 to 5.5 on the '88-style mixes, 6.7 to 7.5 on the
'94 hills (`main`: 5.5 for a word with a case).

Each variant against the one named, 3 runs, gcc / clang:

| Variant | '94 hills (94nop, pspace, tiny, nano, lp) | '88-style (t20, corpus pairs, 88) | Verdict |
|---|---|---|---|
| first half (64 cases of the old corpus, generic code behind a call) against `main` | -21% / -20%, -21% / -21%, -20% / -22%, -23% / -21%, -12% / -18% | +21% / +27% | the review's finding |
| 128 cases in the loops, ranked over old and new mixes, against `main` | +60% / +45%, +65% / +38%, +39% / +7%, +36% / +2%, +47% / +7% | +12% / +10%, +13% / +8% | |
| 256 cases | +63% / +51%, +65% / +56%, +49% / +36%, +46% / +29%, +56% / +35% | +10% / +10%, +11% / +11% | kept |
| 384 cases against 256 | gcc +1% to +3%; clang -4% and -5% on 94nop and pspace, +1% to +4% on the others | gcc +1% to +2%, clang -6% | rejected |
| 512 cases against 256 | gcc 0% to +4%; clang -4% and -8%, 0% to +3% | gcc +2%, clang -11% and -7% | rejected: clang's code for the larger loops |
| 94nop three times the weight of the other mixes, against equal weights | gcc +2%, +1%, -2%, 0%, -3%; clang 0%, -2%, +3%, +3%, 0% | gcc 0%, clang -3% to -5% | rejected, no difference |
| the '88-style mixes five times the weight | -5% to -8% | gcc +3%, clang -2% | rejected: for clang the size of the loops costs on the '88 mixes, not the depth of their words |
| one jump table on the index (`switch (hot)`) instead of the tree, 256 cases | -18% to -28% / -11% to -17% | -23% / -24%, -24% / -21% | rejected, again |
| the tree for 5 levels, then jump tables | -1% to -3% / -1% to -11% | -2% / -10%, -3% / -8% | rejected |
| two levels, 256 cases in all: 32, 64, 96 or 128 in the loops, the others in a function behind them, against 256 in the loops | 64: -6% to -9% / -6% to -21%; 128: -2% to -3% / 0% to -4% | 64: -4% / -3%; 128: 0% / -1% | rejected: it does not bring the '88 mixes back either |
| two levels: 256 in the loops and 256 more behind them (512 in all) against 256 | +1% to +3% / +2% to +4% | 0% to +1% / 0% | kept: object file 400 KB instead of 310 KB, gcc compiles it in 7.8 s instead of 6.7 s |
| 512 more behind them (768 in all) | as 256 more | | rejected |
| rare words in the case of an equal word (same code, another modifier or an unused mode) | not built: it covers 0.4 of 94nop's 2.3 points of generic code, 2.0 of tiny's 5.1 | | open |

With 256 cases in the loops the three compiler-specific lines of the first
half were measured again (94nop / tiny / t20 / 88, 3 runs, each line taken
out):

| Line | gcc | clang | Verdict |
|---|---|---|---|
| `#pragma GCC optimize("no-tree-pre", "no-gcse")` | 0.0% / +0.2% / -0.1% / 0.0% | not for clang | removed: nothing left of its 2 to 4% |
| the fields of the instruction with loads of their own, gcc only | without: -0.5% / -1.8% / -2.9% / -2.0% | with them too: +3.4% / +2.7% / +4.6% / +4.4% | now for every compiler, no macro |
| the shares in the compares (`M42_PROBABLY`) | without: -0.2% / +0.2% / -0.1% / -0.3% | without: +1.8% / +4.1% / +0.8% / -0.3% | removed |
| the loop functions on a cache line (`M42_LOOP`) | without: -0.3% / -0.4% / -0.1% / 0.0% | without: 0.0% / -1.0% / 0.0% / -0.1% | removed with the three above: gcc +0.2% / +0.1% / +0.1% / -0.2%, clang +1.8% / +1.5% / +4.2% / +3.5% against the state before |
| `M42_OPAQUE_CLANG(h)` | not for gcc | without: -5.1% / +0.8% / -7.2% / -6.4% | stays |
| `M42_OPAQUE_WASM(hot)` | | wasm without it: bench -10.5%, pairs -3.7%, t20 +6.1% time; 570 64-bit compares in the module instead of 21 | stays |

So a pragma and three macros of the first half are gone again. They were
tuned to the 64 cases and stopped mattering with 256, the same thing the
'88 corpus did to the whole first half one level up.

What it costs: the object file of the library is 399 KB (gcc) instead of
186 KB, gcc compiles it in 7.8 s instead of 2.6 s and clang in 2.5 s
instead of 1.0 s, and the wasm module is 295 KB instead of 103 KB. A build
without optimization, and MSVC, compile 16 cases (`M42_DISPATCH_16`): gcc
`-O0` needs 18 s for 64 cases and 3.6 s for 16. MSVC was not built: with
16 cases more than half of a '94 hill's instructions run the generic code
behind a call there, so the Windows build is likely slower than 1.0.0 on
those hills until someone times `cl` with more cases.

The lesson for the method is in the perf-experiment skill: a dispatch
change is judged on the hills, never on '88-style inputs alone.

#### First half: tuned on the '88-style corpus alone

Everything from here to "Tie rounds" was measured on t20, the corpus pairs,
t80s and the bench only, with a list of 64 words ranked on that corpus. The
steps and their numbers stand as measured; the totals of this half do not
describe the final code. Built with `-fno-strict-aliasing
-ffp-contract=off` on top of the Makefile's flags, which `bench-native.mjs`
added until the second half (gcc's `main` is 2% slower with them, clang's
loops for two warriors are the same).

The dispatch alone (changes 1 to 5 below, the same instructions as `main`),
M instructions/s, median (range):

| Compiler | Input | `main` | changes 1 to 5 | change |
|---|---|---|---|---|
| gcc | t20 | 416.5 (416.0–416.5) | 476.5 (475.9–476.8) | +14.4% |
| gcc | corpus pairs | 395.5 (393.7–396.0) | 452.4 (452.0–452.7) | +14.4% |
| gcc | t80s | 423.0 (422.5–423.2) | 482.9 (475.7–483.4) | +14.2% |
| gcc | bench | 469.2 (468.9–469.8) | 531.5 (530.6–531.9) | +13.3% |
| clang | t20 | 410.7 (407.8–412.8) | 525.6 (525.2–526.3) | +28.0% |
| clang | corpus pairs | 387.1 (385.0–389.2) | 494.4 (493.6–494.9) | +27.7% |
| clang | t80s | 417.7 (412.8–418.1) | 530.3 (529.8–530.7) | +27.0% |
| clang | bench | 484.7 (481.0–486.2) | 574.9 (574.7–575.5) | +18.6% |

The other loops, 3 runs: t20 with core size 8192 (`execute2_any()`) gcc
390.5 → 445.9 (+14.2%), clang 399.9 → 480.4 (+20.1%); 8 warriors of t20 in
one core (`execute()`, 4 matches of 400 rounds) gcc 313.5 → 353.0 (+12.6%),
clang 336.8 → 353.6 (+5.0%). The program, `build/42mars -b -r 4000 -F 1334`
on the 3 bench pairs as in the README's chart (`make`, so gcc; whole
processes, 5 alternating runs): 0.925 s (0.922–0.926) → 0.783 s
(0.783–0.785), 482 → 569M/s, the same wins, losses and ties (before the
loads of the values of 9, which add 1 to 2% for gcc). The README's
chart and table are not changed: they are one measurement of all engines,
and the others were not run again.

The wasm build with changes 1 to 5, `bench/ab-wasm.mjs`: bench +7.5%,
corpus pairs +4.2%, t20 -4.0% time, t80 -3.4% with 16 jobs and -5.4% with
31.

#### What changed in the first half

The dispatch, five changes, each measured on top of the ones before it (3
runs; t20 / corpus pairs / bench, t80s where it was run). Smaller ones
follow below (6 to 10).

| Change | gcc | clang |
|---|---|---|
| 1. The dispatch index of the instruction word in the cell's padding (`Cell.hot`), and a Huffman tree of compares on it instead of the switch on the word. 32 cases as before | +7.2% / +5.8% / +3.1% | +6.4% / +5.6% / +2.0% |
| 2. The generic code as a function of its own (`exec_generic()`) | +1.8% / +1.1% / +4.2% | +7.9% / +5.8% / +7.5% |
| 3. Every compare of the tree with the share of its likelier side (`M42_PROBABLY`) | +2.5% / +3.3% / +5.4% | +4.7% / +4.1% / +4.2% |
| 4. The loop counter hidden from the code behind the loop (`M42_OPAQUE_CLANG(h)`) | +0.8% / 0.0% / +0.7%; with 2 and 3 in: -2.4% / -1.8% / -1.9%, so clang only | +11.1% / +5.9% / +11.3% |
| 1 to 4 together against `main`, 32 cases (4 for clang only) | +12.4% / +9.5% / +11.8% | +26.2% / +22.3% / +20.5% |
| 5. 64 cases instead of 32 | +4.4% / +6.8% / +3.4%, t80s +6.1% | +1.0% / +4.3% / +0.3%, t80s +3.3% |

1. The switch on the 14-bit word was a balanced tree of compares: 3 or 4
   range tests, then up to 3 tests for equality, 5.5 conditional branches
   per instruction on the four mixes, the same for the most and the least
   executed word, although 8 words are 66% of the executions. The padding of
   the 8-byte cell now holds the number of the word's case, a function of
   the word that `load()` and `start_round()` set and that `MOV.I` copies
   with the cell. Nothing else writes a word. The index of a word without a
   case is a number too, so no leaf has to test for equality, and the
   indices are the leaves of a Huffman tree from left to right, so every
   subtree is a range: 4.3 compares on average with 32 cases (4.4 with 64),
   3 for the words above 9%. The public `m42_cell` shows the field: it is
   `hot` instead of `pad` and `M42_CELL_LAYOUT` is 2.
2. Inlined into the loops, the generic code was most of their code
   (`execute2_8000()`: 3,910 lines of x86 with 32 cases, 2,977 with 64
   cases and the generic code outside). clang kept the context pointer on
   the stack and loaded it for every queue and core access. A call costs
   more per generic instruction, which is why more cases pay now (5).
3. The Huffman tree knows how likely each side of each compare is, and the
   compilers lay out the likelier side as the straight path. Removed in
   the second half: with 256 cases it costs clang 1 to 4% on the '94 hills.
4. clang saw that `h` counts the pairs and gave the code behind the loop
   counters of its own inside it: `-2 * pairs` in 64 bits, `-h`, and `h +
   1` in a stack slot. An empty `asm` on `h` behind the loop removes them.
   The arithmetic behind the loop from one 32-bit difference did not
   (+0.4% / +0.1% / +1.0%). gcc has no such counters and loses 2% with
   the `asm`.
5. With the generic code behind a call, 64 cases beat 32 (on this corpus:
   the second half has 256 in the loops and 256 behind them). 16: -8% to -13%
   for gcc, -12% to -18% for clang; 24: 0 to -4% and -4% to -9%; 40: +2%
   and -3% to -4%; 48: +3% to +5% and 0 to -2%; 80: +2% to +5% and -1% to
   +4%; 96 (all words the four mixes execute but 0): +2% to +5% and -1%
   to +5%. 64 words are 99.94% of the executed instructions of the four
   mixes; `HOT` in `gen-dispatch.mjs` now has each word's share.

6. `start_round()` clears the core through locals. With the core and
   `m->N` both reached through the context pointer, clang read `m->N`
   again after every store and cleared one cell per loop pass (4 x86
   instructions per cell; with the static context of the wasm build the
   clear was vectorized, which is why the second round measured 0.3% for
   the round start). clang +0.7% / +0.6% / -0.2%, t80s +0.9%; gcc 0.
7. The loops start on a cache line (`M42_LOOP`, `aligned(64)` on
   `execute()`, `execute2_8000()`, `execute2_any()` and `exec_generic()`).
   Alone: gcc +0.1% on t20 and 0.0% on the bench, clang 0.0% and +1.1%.
   It is there for what it prevents: the code of 8, which never runs on
   the bench, cost gcc 1.0% on t20 and 0.5% on the bench just by being
   in the file, and 0.3% with the loops aligned.
   Removed in the second half, where it made no difference anymore.
8. A third exact tie proof for trapped warriors: built, measured and
   removed again, see "Tie rounds" below.
9. gcc only: `step()` loads the dispatch index and the two values of the
   cell with loads of their own, the index first (`M42_LOAD_FIELDS`),
   instead of one 64-bit load that it takes apart. The index: gcc +1.4% /
   +1.5% / +2.3%, t80s +1.3%; clang -0.4% / -0.6% / -2.2%, t80s -0.5%. The
   values, measured after 10: gcc +1.4% / +1.1% / +2.0%, t80s +2.3%; clang
   -1.1% / -0.7% / -0.3%. So clang keeps the copy of the cell. gcc then
   does 8.1 loads per simulated instruction instead of 6.2 and needs 10.35
   cycles instead of 10.55: a 16-bit load takes its data from a 16-bit
   store into that field that is still on its way, the 64-bit load of the
   cell has to wait for it (fourth round, forwarding). In the second half
   clang gains 3 to 5% from it too, and it is in the code for every
   compiler.
10. gcc only: no partial redundancy elimination (`#pragma GCC
   optimize("no-tree-pre", "no-gcse")` in `platform.h`, for the whole
   translation unit). On top of 9: +3.4% / +4.2% / +2.8% as options on the
   command line; the index of 9 and 10 together as they are in the source:
   +4.8% / +5.7% / +4.8%, t80s +4.6% (10 alone +1.6% / +3.8% / +1.9%, t80s
   +2.0%). With other options the two give: `-O2 -fPIC` +4.8% / +5.6%
   (t20 / pairs), `-O3 -fPIC -march=native` +5.2% / +6.4%, `-O3` +3.7% /
   +4.3%, `-Os -fPIC` +1.9% / +1.8%.
   With it gcc runs 40.9 x86 instructions and 10.54 cycles per simulated
   instruction on t20 instead of 42.2 and 10.93, and `execute2_8000()` has
   98 stack references instead of 138: PRE left copies of values behind
   (`movzwl %r8w,%eax` of a register that a `movzwl` load had just
   filled). This is a compiler option in the source, which Martin decided
   against for the wasm build script on 10th November: it is one line to
   remove. On top of it no other gcc pass is worth more than 1% (22
   tried; `-fno-tree-sink` and `-fno-crossjumping` +0.9% each). Removed in
   the second half: with 256 cases it changes nothing (0.0% on 94nop and
   88, +0.2% on tiny, -0.1% on t20).

Where the time goes, `perf stat` on t20, per simulated instruction:

| Build | x86 instructions | cycles | branches | branch misses | loads |
|---|---|---|---|---|---|
| `main`, gcc | 47.9 | 12.62 | 9.96 | 0.066 | 6.87 |
| `main`, clang | 49.0 | 12.87 | 7.38 | 0.068 | 8.66 |
| change 1, gcc | 45.7 | 11.74 | 6.71 | 0.065 | 7.12 |
| change 1, clang | 51.2 | 12.03 | 6.93 | 0.063 | 10.37 |
| changes 1 to 4, 32 cases, gcc | 45.0 | 11.49 | 6.83 | 0.065 | 5.98 |
| changes 1 to 4, 32 cases, clang | 42.3 | 10.16 | 7.44 | 0.067 | 6.47 |

With change 1 clang ran more instructions than before and was still 6%
faster, and the computed goto below ran 20% fewer for the same cycles: the
instruction count does not predict the time natively either. Top-down
(`perf stat -M PipelineL1,PipelineL2`, gcc, t20): `main` retiring 57.9%,
backend bound 22.4% (memory 19.6%), frontend bound 13.3%, bad speculation
6.5%; change 1: 60.8%, 20.0% (17.3%), 11.5%, 7.4%.

How 2 to 4 were found: a profile-guided clang build of change 1
(`-fprofile-instr-generate`, trained on t80s) was 8% faster (t20 438 →
473, pairs 412 → 446, bench 492 → 520), with 2.3 loads fewer per simulated
instruction. So the profile told clang something the source did not. With
changes 2 to 4 in, the profile is worth 1% (t20 518.6 → 523.8). gcc's
profile-guided build was slower both times (t20 448 → 436 and 460 → 442).

The 16 cases that MSVC builds (`-DM42_DISPATCH_16` with gcc and clang, `main`
with 16 against this round with 16): gcc +4.4% / -1.1% / +2.5%, t80s -0.4%;
clang +9.7% / +3.2% / +8.9%, t80s +4.5%. MSVC itself was not built: `cl`
needed 141 s for 32 cases when the generic code was inside the loops, and
nobody has timed it with the generic code outside. More cases for MSVC
need a run of CI's Windows job.

#### Rejected in the first half

| Idea | Result | Verdict |
|---|---|---|
| A tree on the instruction word with weights: range tests placed by the shares, equality tests in the leaves, no index in the cell (4.9 branches per instruction instead of 5.5) | gcc +1.6% / +0.3% / -3.7%, clang +3.2% / +0.2% / -6.4%; `-march=native -DM42_FIXED_CONTEXT` -0.9% / -2.3% / -10.9% | rejected: natively the switch already had a jump table for the 10 hot words between 2310 and 2409 |
| A jump table on the index (`switch (hot)`, dense) | clang, fixed context, t20: 434.2 → 405.4 (-6.6%) | rejected, as in the second round: one indirect jump for all words |
| Threaded code: a label per case and turn, a table of label addresses indexed by the index, every case ends with the pop of the other warrior's instruction and its own `goto *` (`execute2_8000()` only, on change 1) | gcc: t20 and pairs as change 1, t80s -1.4%, bench -5.0% against it; clang -7% to -24% against `main`. gcc merged the 66 jumps into 12, clang into 8. gcc, t20, per simulated instruction: 36.5 x86 instructions instead of 45.7, 11.80 cycles instead of 11.74, 0.083 branch misses instead of 0.065, frontend bound 23.9% (latency 14.5%), bad speculation 11.5% | rejected. The compares of the tree are predicted better than the jumps, and the instructions they cost are not what limits the loop |
| The index loaded on its own before the cell (`C[pc].hot`), instead of from the cell's copy | gcc +2.3% / +2.3% / +3.0%, t80s +2.0%; clang -2.0% / -1.0% / -1.6%, t80s -1.3% | rejected: one compiler's gain is the other's loss |
| `SPL`: the new process queued after the common push at the end of `exec_core()`, so that no case has a push of its own (clang had merged the pushes into one with a variable step, 5 instructions) | clang -5.5% / -4.7% / -2.6%, t80s -5.8%; gcc 0 | rejected |
| `DJN.A`/`.B`/`.AB`/`.BA` from one 16-bit load: test and decrement the value read once, where the B mode is no post-increment (measured last, on everything else) | gcc +1.2% / +0.7% / +0.9%, t80s +0.3%; clang -0.3% / -0.1% / -1.0%, t80s -0.3% | rejected: one compiler's gain is the other's loss |
| gcc only, after 9: the B values of `ADD.AB`, `JMZ.B`, `DJN.B` and the like as 16-bit loads of one field instead of a 32-bit load and a shift, where the B mode is no post-increment | gcc -3.3% / -4.0% / -0.6%, t80s -4.2% | rejected. What helped at the fetch of the instruction hurts at its B operand |
| Words that run the same share a leaf of the tree: `spl.b $ #` with `spl.b $ $`, `jmp.b $ #` with `jmp.b $ $`, `dat.f # #` with `dat.f $ $`, `spl.b @ #` with `spl.b @ $` (60 leaves; `DAT` 7.3% at depth 4 instead of two leaves at 5). In the index only, so no case has two labels as in the third round | gcc +0.6% / +2.0% / +0.2%, t80s +2.4%; clang -3.8% / -2.3% / -2.4%, t80s -2.5% | rejected. Open for gcc alone; with every equal word in the index (7 modifiers and 4 B modes of `SPL`) it would also widen what runs specialized |
| The index hidden from the optimizer for every compiler (what the wasm build needs, below) | gcc -1.3% / -1.0% / -0.7%, clang -0.8% / -0.8% / -2.3% | wasm only (`M42_OPAQUE_WASM`) |
| gcc options, to find what holds gcc 10% behind clang (changes 1 to 4, 32 cases; t20 / pairs): `-fno-tree-pre` +2.8% / +3.6%, `-fno-tree-vrp` +2.7% / +2.4%, `-fno-tree-sink` +2.0% / +1.3%, 20 others within 1% or slower (`-fno-if-conversion` -6% / -8%) | no single cause | nothing changed |
| clang options on the final code: `-mllvm -tail-dup-size=0` +1.4% / +1.3%; `-disable-lsr`, sink and hoist off together +0.8% / +0.9%; 11 others slower | below 1.5% | nothing changed |

The three LLVM options of 9th November were worth 3% natively then;
changes 2 and 4 took what they gave.

#### The wasm build

The first build of change 1 was slower in wasm: bench -6.6%, pairs -4.1%,
t20 +4.6% (7 runs). clang for wasm32 loads the cell as one 64-bit value and
had turned every compare of the tree into `i64.gt_u` of that value against
a 64-bit constant, which V8 loads into a register first. With the index
hidden from the optimizer (`M42_OPAQUE_WASM(hot)`, an empty `asm`) the tree
compares 32-bit values, and the wasm build gains too (table above).

#### Tie rounds: where a new proof could come from

`bench/tie-ceiling.c` got a second oracle in a scratch copy (not in the
repository): per tie round the last instruction at which a process of each
warrior died. A warrior is safe from the earlier of that and of the count
proof; a proof of the form "no process dies anymore" could stop the round
when both are. Share of all instructions executed today:

| | tie rounds today | after the last death | closed loops of any size (#27) |
|---|---|---|---|
| t20 | 35.7% | 8.3% | 1.5% |
| t80 | 47.1% | 17.7% | 5.4% |
| 400 corpus pairs | 56.2% | 24.0% | 11.5% |

So most of what is left are rounds in which nobody dies and the executed
cells still change, or the loops write through pointers. By the process
counts at the end, t80: both at 8,000 processes 5.0% of all executed
instructions (2.9% after the last death), both with one process 4.4%
(3.7%), one against 8,000 3.2% (1.7%). The rounds at 8,000 against 8,000
are two warriors caught in each other's traps (`banzai2` against `charon2`:
all 16,000 processes on `spl 0` and `jmp -1`), often with a decrement in
the trap (`spl 0, <-1`).

A proof for those, checked in the oracle at every tie check: from all
queued addresses follow the control flow (both ways at every conditional).
It holds when no reached cell is `DAT`, `DIV`, `MOD`, `LDP` or `STP`, every
jump target and every written cell is at a fixed place, and no instruction
writes a field that a reached instruction needs (its word, the value that
addresses its operand, the pointer of an indirect operand). Then by
induction the reached cells keep what is needed, the processes stay on
them, and nobody dies (semantics doc, 3.7).

| | saved, share of all executed instructions | rounds | wrong proofs |
|---|---|---|---|
| t20 | 0.27% | 37 of 19,000 | 0 |
| t80 | 2.21% | 3,483 of 316,000 | 0 |
| 400 corpus pairs | 3.10% | 161 of 12,000 | 0 |

The same without writes at all (a frozen core) saves 0.08%, 0.88% and
0.65%; with constant conditions decided instead of both ways 0.27%, 2.32%
and 3.48%. Where the proof fails after the last death, t80: a `DAT` in
reach 7.9% of all executed instructions, a write through a pointer that
changes 5.2%, a write to a field that is needed 1.5% (the first failure
found counts, so the three overlap).

Built as a function `settled()` in `mars.c`, tried from `tie_check()`, and
removed again the same day. What a try costs decided the schedule (p4 is
this round without the proof; time for the whole input, gcc / clang):

| Schedule | t20 | corpus pairs | t80s | bench |
|---|---|---|---|---|
| tries at 0, 1024 and then 1.5 times as late (11 per round of 160,000), `%` for every address, conflicts tested at the end | +1.8% / +1.0% | +0.5% / -0.1% | +1.5% / +0.6% | +2.1% / +1.9% |
| the same, times doubling (8 tries), no division, a conflict ends the try at once | +1.4% / +0.4% | -0.8% / -1.4% | +0.7% / -0.4% | +1.1% / +0.1% |
| that with the loops aligned (7 above) | +0.4% / +0.4% | -1.5% / -1.5% | -0.6% / -0.8% | +0.3% / +0.7% |
| first try at 4096, then 3 times as late (4 tries), loops aligned: the last one | +0.3% / +0.1% | -1.9% / -1.7% | -0.4% / -0.7% | +0.1% / 0.0% |

With the last schedule it executed 0.16% fewer instructions on t20, 1.44%
on t80s (1.7% on all of t80: 16,055M instead of 16,335M) and 2.70% on the
corpus pairs. The time fell by less than the instructions: the skipped
ones are `SPL` and `JMP` in a trap, the cheapest there are. A failed try
looked at about 30 cells, the body of a warrior, and a try that held
passed over both queues. `bench/tie-ceiling.mjs`, which plays every round
to its end and fails when an early tie stops a round that is none, ran
all 347,000 rounds of t20, t80 and the corpus pairs with it: no wrong tie.

Verdict: removed (Martin: 190 lines for a slowdown on part of the inputs is
not a good deal). It gained 0.4 to 1.9% of the time on the mixes with
old-style warriors and lost 0.1 to 0.3% on t20 and the bench. A proof of
this kind has to cost nothing where it does not apply, or be much smaller.
Its test had a lesson of its own: the first version let 5 of 9 mutants of
the proof through, because its warriors did their damage before the
proof's first try, after 4096 instructions.

Found on the way: the warrior records were declared with 128-byte
alignment, and the context's heap is 64-byte aligned. They were at a
multiple of 128 only through the size of `Mars`; the fields of the tie
proof moved them, and UBSan reported it in 24 of the 54 C tests. They are 64-byte
aligned now (no change in speed, 3 runs), and `test/c/api-test.c` plays a
match in a context at 6 odd offsets.

Also looked at: `execute()` for clang has no stack traffic in its loop (21
stack references in the function); after this round the loop function has
98% of the cycles on t20 and the bench, `start_round()` 0.7 to 1.8%, the
tie checks 0.7%. Top-down on t20 at the end (`perf stat -M
PipelineL1,PipelineL2`): gcc retiring 59%, backend bound 20% (memory 18.5%),
frontend bound 14%, bad speculation 7%; clang 62%, 14% (12%), 16%, 8%. Per
simulated instruction gcc 41.0 x86 instructions and 10.5 cycles (before the
loads of 9), clang 40.5 and 10.0, 0.064 and 0.067 branch misses, spread
over the whole tree: no branch has more than 2% of them.

The whole t80 natively, as a tournament would run it: its 3,160 pairings in
160 input files for `bench-native`, handed out by `xargs -P` (wall time with
process starts and reading the input, 3 runs, before the loads of 9 and
with the tie proof of 8 still in):

| | `main` | this round |
|---|---|---|
| gcc, 16 processes | 2.74 s | 2.28 s |
| gcc, 32 processes | 2.38 s | 1.91 s |
| clang, 16 processes | 2.75 s | 2.17 s |
| clang, 32 processes | 2.36 s | 1.90 s |

`tools/tournament.mjs` on the wasm build takes 2.85 s with 16 jobs and
2.57 s with 31. The tool already plays a tournament on the native build:
`--pmars` takes any program with pMARS's options, so `--pmars build/42mars`
(`make`, gcc) starts one native process per pairing. With a browser running
on the machine, 3 runs each, native against the wasm engine: t80 with 16
jobs 2.39 to 2.40 s against 2.89 to 2.90 s, with 31 jobs 1.98 to 2.00 s
against 2.62 to 2.64 s, t20 with 1 job 2.43 s against 2.90 s; `--compare` gives
SAME for all 3,160 pairings. The 3,160 process starts are about 0.3 s of
that (#25), which a native driver with threads would save: still the open
item it was. These times are of the first half's build. With the build at
the end of the round, later the same day and with the machine in use: t80
with 31 jobs 2.33 to 2.36 s natively against 2.89 to 2.91 s on the wasm
engine (whole process, 3 alternating runs).

State: natively, the library as `make` builds it, with early ties: 94nop
gcc 359M instructions/s and clang 348M (`main` 220M and 237M), t20 gcc
469M and clang 468M (`main` 423M and 415M). In WebAssembly: 94nop 299M/s
(`main` 236M), t20 2.97 s (3.02 s), t80 2.93 s with 16 jobs and 2.68 s with
31 (2.96 s and 2.75 s).

### All engines as whole processes again, now also on a '94 hill (14th November 2026)

The README charts, measured again after the sixth round, as on 12th
November (whole processes, 7 alternating runs, median and range), every
process pinned to CPU 2. A second workload is new, because the bench pairs
are '88-style: 20 pairs of `warriors/koenigstuhl/94nop` (every 27th file of
the sorted folder, two by two; `docs/images/speed.mjs` lists them), 600
rounds each from `-F 1334`, 940,856,125 instructions. All engines gave the
same wins, losses and ties in every pair of both workloads (exMARS 0.01
prints the second warrior's wins and the ties only). fmars is generated for
109 instruction words and cannot run the '94 pairs; corewar.dev's builds
were not run on them.

| Engine | '94 pairs, s | M instructions/s | bench pairs, s | M instructions/s |
|---|---|---|---|---|
| 42mars, `build/42mars` (`make`, `-O3`) | 2.324 (2.321–2.326) | 405 | 0.846 (0.843–0.849) | 527 |
| fmars 0.0.207 (`bin/xfmars`) | | | 1.119 (1.101–1.133) | 398 |
| 42mars, WebAssembly `runMatch()` | 2.966 (2.946–3.255) | 317 | 1.175 (1.162–1.212) | 380 |
| 42mars, WebAssembly, no early ties | | | 1.195 (1.172–1.202) | 373 |
| exMARS 0.01, native | 3.875 (3.857–3.911) | 243 | 1.606 (1.603–1.618) | 278 |
| rmars 215fadc, `--threads 1` | 5.276 (5.242–5.641) | 178 | 2.310 (2.299–2.332) | 193 |
| exMARS, corewar.dev's WebAssembly build | | | 2.979 (2.964–2.993) | 150 |
| pMARS 0.9.5 | 9.195 (9.179–9.941) | 102 | 4.231 (4.220–4.252) | 105 |
| pMARS, corewar.dev's WebAssembly build | | | 6.998 (6.961–7.248) | 64 |

Against 12th November on the bench pairs: 42mars natively 0.932 → 0.846 s,
its wasm build 1.144 → 1.175 s, the other engines within 1%. On the '94
pairs 42mars is 4.0 times pMARS and 1.7 times exMARS 0.01, on the bench
pairs 5.0 and 1.9 times.

### MSVC after the sixth round: 4 to 5% faster on a '94 hill, 6 to 8% slower on an '88 hill, and left so (14th November 2026)

The sixth round was never built with MSVC. Before the release of 1.1.0 a
one-off workflow on a branch (`msvc-speed`, not merged) built the `42mars`
program with `cl /std:c11 /O2` (MSVC 19.51) on GitHub's `windows-latest`
runner (4 vCPUs, AMD EPYC): from v1.0.0, from `main`, and from `main` with
other numbers of cases for MSVC, written as "cases in the loops + cases in
`exec_more()`" (`parts(count, near)` of `gen-dispatch.mjs` for the reduced
variant). Whole processes on 20 pairs of `warriors/koenigstuhl/94nop`
(every 27th file, two by two) and 20 of `88` (every 17th, with `-8`), 300
rounds each from `-F 1334`, 5 alternating runs, median. All variants gave
the results of v1.0.0 in every pair. Two runs on two runners; the changes
are against v1.0.0 of the same run:

| Variant | `cl` on `lib/42mars.c` | '94 hill | '88 hill |
|---|---|---|---|
| v1.0.0: 16 cases of the old list, generic code in the loops | 34.0 s, 28.3 s | 3.891 s, 3.121 s | 1.996 s, 1.555 s |
| `main`: 16 + 0 | 27.1 s, 22.3 s | +4.6%, +4.0% | -5.7%, -7.9% |
| 16 + 48 | 32.2 s | +18.9% | -1.7% |
| 16 + 112 | 53.3 s | +18.3% | -1.2% |
| 16 + 176 | 28.0 s | -41.9% | -36.9% |
| 16 + 240 | 35.7 s | -43.3% | -33.9% |
| 24 + 104 | 70.4 s | +22.9% | -1.6% |
| 32 + 32 | 95.3 s | +29.1% | -1.8% |
| 32 + 96 | 127.9 s, 113.5 s | +34.8%, +32.3% | +6.2%, +2.0% |
| 32 + 160 | 99.8 s | -13.3% | -18.0% |
| 48 + 80 | 257.9 s | +36.9% | +4.0% |
| 64 + 64 | 34.5 s | -59.6% | -73.6% |
| 64 + 192 | 30.4 s | -63.1% | -73.9% |

Findings:
- As it is, the MSVC build of 1.1.0 is 4 to 5% faster than 1.0.0 on the '94
  hill and 6 to 8% slower on the '88 hill. Its 16 cases are 46% of the
  '94 hill's instructions (the old 16: 19%) and 71% of the '88 hill's (the
  old 16: 84%), and the generic code is behind a call now.
- The cases in the loops are what counts for MSVC: 32 + 32 beats 16 + 112.
  They cost compile time as before, 95 to 128 s for 32 and 258 s for 48.
- There is a cliff. With 64 cases in the loops, or 160 and more in
  `exec_more()`, `cl` is done in 30 s and the program is 2 to 4 times
  slower: it gave up on optimizing those functions.

Verdict: left at 16 (Martin: MSVC is not a primary target for speed). If
that changes, 16 + 48 is nearly free (5 s more of `cl`, +19% on the '94
hill, -2% on the '88 hill against 1.0.0), and 32 + 96 is the best the
runner showed below 2 minutes of `cl`.

## Ideas from other simulators

exMARS (Martin Ankerl, 2003, based on exhaust and pMARS) and the exMARS fork
used by corewar.dev were studied for ideas; their code is not used.

| Idea | Status |
|---|---|
| Packed 16-bit cell fields, one fetch per instruction | in the WebAssembly engine from the start |
| Wraparound by one compare and subtract instead of modulo | in place |
| Mode tests ordered by frequency | evaluated, kept (see above) |
| `MOV.I` fast path | evaluated, kept |
| DAT and SPL caught by one bit test | evaluated, no gain with an opcode-byte switch |
| Process-count early tie (exMARS: `nprocs * alive > cycles`; that bound is off by one when the first mover gets one more turn) | kept with the exact bound |
| No-killer early tie (corewar.dev fork: DAT count in core) | kept, by scan instead of count |
| Two-warrior queue caching (corewar.dev fork) | kept |
| One huge generated switch with a case for every instruction variant (Martin remembered seeing it in an old simulator) | evaluated in the second round: all 8,512 words was much slower; 32 generated cases for the hottest words kept |

### Second pass over other simulators (8th November 2026)

Read by separate sessions that do not write engine code, written down here as
descriptions only: qMars 1.1, exhaust-ma, exMARS 0.01, exhaust 1.9.2 and
concurrent-mars (C/C++); fmars 0.0.207 and pyCorewar (C); rmars, dmars,
corewars, rMARS (Rust); gMARS (Go); AzureMARS (Free Pascal); nMars (C#);
pMARS 0.9.5. None was built or run. "Value" is a guess unless a number is
given. All ideas below keep pMARS results exact unless marked.

New ideas for our engine, most promising first:

| Idea | From | Mechanism | Value, cost | Status |
|---|---|---|---|---|
| Rounds of one pairing in parallel | dmars, concurrent-mars | Rounds only depend on each other through p-space, and only `LDP` reads it. Opcodes are only copied, so a warrior without `LDP` in its code never executes one. Then step the position generator sequentially up front (one step per round for two warriors), derive the first mover from the round number, run blocks of rounds on several workers and add up the results in round order | Close to linear in workers for one pairing or a few (visualizer "run N rounds", one warrior against a few opponents, splitting the last big pairings of a tournament). Nothing for t80, whose tail is below 3%. dmars claims 500 rounds in 0.78 s on one thread and 0.10 s on all cores of an M3 Pro. Cost: low, `runMatch` needs the first round number of a block | open, #8 |
| `MOV.I` from one 64-bit snapshot of the A cell | AzureMARS, fmars | Read the whole 8-byte A cell at operand time. `MOV.I` stores it into the B cell with one store, `SEQ.I`/`SNE.I`/`CMP.I` compare its instruction word. Exact because B-operand side effects only change value fields, never a word, and the padding is always zero | `MOV.I` words are about 21 to 25% of executions; saves a load and a store each. 0.5 to 3%. Cost: small, in `exec_ins()` | open, #9 |
| One queue array for both warriors, one shared head | pyCorewar | With two warriors the turns alternate until the first death ends the round, so both heads move in lockstep. Warrior 0 uses the even slots and warrior 1 the odd slots of one ring, one head walks it and can double as the instruction countdown; each tail steps by 2. A warrior's queue is empty after its pop when its tail equals head + 2 | Five loop-carried counters become three without the pack/unpack cost of the rejected packed counters; aims at the V8 spills. 0 to 5%. Cost: moderate (process listing, `tie_check`, the warrior-1-first pre-step need stride 2) | the ring: rejected (third round, #9). One head for two linear queues: kept (fourth round) |
| Linear queue that never wraps | fmars, pyCorewar | Per warrior an array large enough for a whole round, head and tail only move forward: no mask, and with a byte pointer no shift. Bound for two warriors: at most `1 + 2 * (maxCycles + 1)` entries, about 320 KB per warrior at 80,000 cycles | Up to 4 of 66 x86 instructions per simulated instruction, but pushes stream into fresh cache lines. 0 to 4%. Combines with the shared head | kept (third round, #9); with the shared head of the fourth round the bound is `2 + 2 * (maxCycles + 1)`. The byte pointer: rejected (fourth round) |
| Merge instruction words that behave the same into one specialized case | qMars, exhaust, exhaust-ma | Many words execute identically: the modifier does nothing for `DAT`/`SPL`/`JMP`/`NOP`; for the A mode of `DAT`/`NOP` and the B mode of `DAT`/`SPL`/`JMP`/`NOP` the modes `$ # @ *` are the same; `JMZ`/`JMN`/`DJN` .A = .BA, .B = .AB, .F = .X = .I; .F = .I for `ADD` to `MOD` and `SLT`; `CMP` = `SEQ`. Rank classes instead of words and put every member word as a case label on one copy. Words in core stay as they are (`MOV.I` copies them, `CMP.I` compares them) | The `HOT` list has 3 duplicates today (`spl.b $ $`/`spl.b $ #`, `jmp.b $ $`/`jmp.b $ #`, `dat.f $ $`/`dat.f # #`). 0 to 2% on t80 and corpus pairs, less generic code. Cost: `gen-dispatch.mjs` and the specialized-word test | open, #10 |
| 6-byte cell, or values and words in separate arrays | exhaust, exhaust-ma (6-byte); arrays: our own | 6 bytes per cell makes the core 48 KB; separate arrays give 32 KB of values plus 16 KB of words, and most accesses only touch values | Alternatives to the 4-byte cell of issue #6; scaling by 6 or two loads per fetch cost something. 0 to 5% natively | open, issue #6 |
| Prefetch the other warrior's next cell | rmars | In the two-warrior loop the other warrior's next PC is at the head of its queue; prefetch that core cell right after the current fetch | Natively a few percent at most on scattered papers. WebAssembly has no prefetch; an early plain load would have to survive V8, unverified. Must not use the loaded value, the current instruction can write that cell | open, native first, #6 |
| One wraparound for jumps and skips | fmars | Select between the unwrapped candidates (pc + 1, pc + 2, the jump target) and wrap once, instead of wrapping each | Under 1%; check the native disassembly first, clang may already do it | rejected, #22: +8.2% (all addresses) and +1.3% (skips only) on t20 |
| Branch-free `SPL` push | fmars | Always write the new process at the tail, advance the tail only below the process limit. Needs a spare slot behind the queue (linear queue, or a ring one larger than the limit) | 0 to 1%; the log's `SPL` fast path gave nothing | rejected, #22: +1.6% on t20, -2.5% natively |
| Two fields in one register for `ADD.F`/`SUB.F`/`DJN.F` | fmars (MMX) | Add both 16-bit fields in one 32-bit add, then reduce each lane; no carry crosses lanes up to core size 32,768 | These words are rare in the measured mixes, near 0 | not recommended |
| Statistical early stopping (changes results) | rmars | Rounds stay a prefix of the normal sequence. From `max(min_rounds, 2)` rounds on, after every round: points 3/1/0 per round, sample mean and variance (n - 1), interval width `2 * z * sqrt(var / n) * 100`; stop when the width is at most `ci_width`, report `rounds_played`. rmars documents a score bias of +0.5 to +0.8 at width 60; zero variance stops right at `min_rounds`; repeated looks are not corrected | Large for screening (evolvers, hill pre-filter), lopsided pairings stop after a few dozen rounds. Only as an explicit opt-in mode | built as an opt-in (#19) and removed: against a 1,000-round reference no better than fewer rounds, see "Early stopping against a 1,000-round reference" |

Seen in the sources and not useful for us, by measurement or reasoning:

| Idea | From | Why not |
|---|---|---|
| Handler address in every cell, each handler ends with its own copy of the dispatch jump | fmars (computed goto), nMars (a delegate per cell) | This is how fmars makes full specialization fast natively: one load and one indirect jump per instruction, and the branch predictor keys on the handler it leaves (our native full switch had one shared jump: 0.14 misses per instruction). WebAssembly cannot express it (`br_table` only targets enclosing blocks, tail calls measured 116.8 vs 277). Native only, and fmars generates handlers just for the words of a hill (about 350) |
| Code for every word a corpus uses | fmars, nMars | 40, 48 and 64 hot cases were slower than 32 in V8 |
| A WebAssembly module generated per match for its words | fmars idea, nMars plan | The generic path is only 1.3 to 4.1% of executions with early ties (t20, t80, corpus pairs; #23); needs a wasm emitter in JS |
| Dispatch through a table of handlers per opcode and modifier | AzureMARS | the table variants measured 183.8 vs 241.2 |
| 64-way dispatch on the predecoded mode pair | rmars | measured 116 vs 125 |
| One turn per loop iteration with swapped locals | rmars | measured 257.3 vs 277.6 |
| One shared queue buffer for all warriors | pMARS, rmars, exhaust | our power-of-two rings are cheaper; the two-warrior form is the shared-head idea above |
| Modulo through a lookup table | AzureMARS | 192 KB table, a load where we use a compare and a select |
| Linked list of processes | AzureMARS | 24-byte nodes and pointer chasing against a 2-byte ring entry |
| Empty cell as all zero bits, clearing only after warrior 0 | exhaust, exMARS, pMARS, AzureMARS | the whole round start is 0.3 to 0.6% |
| Positions without repeats, or every position with both first movers | qMars, fmars, AzureMARS, pyCorewar | changes which rounds are played |

Speed claims in the sources (not verified, old hardware): fmars 1.75 to 1.9
times exMARS and 3 times pMARS and exhaust (author, 2005); exhaust-ma 70% of
pMARS 0.9.2 time and 1.3 times exhaust; qMars 67% of pMARS time; exMARS 1.5
times pMARS on a Pentium III; pyCorewar 1.5 times pMARS ('94); AzureMARS
about 100 to 112M instructions/s on a Ryzen 9 5950X, and +70% from moving
its state from globals into locals; dmars single thread about pMARS speed.
The "1,101 opponents x 200 rounds in 3.5 s" claim for rmars is not in its
repository. None of these simulators has an exact early tie.

Side notes: in pMARS 0.9.6 (rmars) a warrior longer than the instruction
limit is an assembler error; check against our pMARS 0.9.5 build. qMars
differs from pMARS for `DJN.F` and the target field of `DIV.BA`/`MOD.BA`,
so it is no semantics reference.
