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
| bench | `node tools/bench.mjs <corpus> [--headless\|--wasm\|--wasm-match]` | 3 hill pairs (agony/bubbles, bomber/chalk, army/bananasplit), 200 rounds each, 22,667,265 instructions, single thread. Report median and range of at least 7 fresh processes. |
| native | `node tools/bench-native.mjs <corpus> --runs 7` | the same battles on `src/engine/wasm/mars.c` built natively with `clang -O3 -march=native` |
| corpus pairs | `node tools/bench-pairs.mjs <corpus> [--early-tie]` | 40 random corpus pairs (fixed generator, `--seed 1`), 30 rounds each, `runMatch`, single thread, 78,859,469 instructions; broader instruction mix than the bench. Before November 2026 an ad-hoc script with the same shape, so older corpus-pair numbers are relative only |
| t20 | `node tools/tournament.mjs <first 20 corpus files> --rounds 100 --seed 1 --jobs 1 --engine wasm` | 190 pairings, single thread, includes early ties |
| t80 | same with the first 80 corpus files, `--jobs 16` and `--jobs 31` | 3,160 pairings, the tournament number |

`<corpus>` is [n1LS/redcode-warriors](https://github.com/n1LS/redcode-warriors).
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
(11.0 s) is mostly process start, not pMARS.

State: bench about 294M/s in WebAssembly, about 413M/s natively; corpus
pairs 280M/s; t20 3.84 s single thread; t80 3.63 s with 16 jobs and 3.28 s
with 31 jobs (8th November 2026; the machine ran 2 to 4% slower than on the
day of the second round's numbers). Warmed up against corewar.dev's exMARS
(`cwbench/benchpairs.mjs`): agony/bubbles 327 vs 195M/s (1.68x), bomber/chalk
311 vs 144 (2.16x), army/bananasplit 334 vs 189 (1.77x); t20 split
(`cwbench/split.mjs`): pairings without tie rounds 392 vs 675 ms (1.72x),
with tie rounds 3,347 vs 5,545 ms (1.66x).

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
| One queue array for both warriors, one shared head | pyCorewar | With two warriors the turns alternate until the first death ends the round, so both heads move in lockstep. Warrior 0 uses the even slots and warrior 1 the odd slots of one ring, one head walks it and can double as the instruction countdown; each tail steps by 2. A warrior's queue is empty after its pop when its tail equals head + 2 | Five loop-carried counters become three without the pack/unpack cost of the rejected packed counters; aims at the V8 spills. 0 to 5%. Cost: moderate (process listing, `tie_check`, the warrior-1-first pre-step need stride 2) | open, #9 |
| Linear queue that never wraps | fmars, pyCorewar | Per warrior an array large enough for a whole round, head and tail only move forward: no mask, and with a byte pointer no shift. Bound for two warriors: at most `1 + 2 * (maxCycles + 1)` entries, about 320 KB per warrior at 80,000 cycles | Up to 4 of 66 x86 instructions per simulated instruction, but pushes stream into fresh cache lines. 0 to 4%. Combines with the shared head | open, #9 |
| Merge instruction words that behave the same into one specialized case | qMars, exhaust, exhaust-ma | Many words execute identically: the modifier does nothing for `DAT`/`SPL`/`JMP`/`NOP`; for the A mode of `DAT`/`NOP` and the B mode of `DAT`/`SPL`/`JMP`/`NOP` the modes `$ # @ *` are the same; `JMZ`/`JMN`/`DJN` .A = .BA, .B = .AB, .F = .X = .I; .F = .I for `ADD` to `MOD` and `SLT`; `CMP` = `SEQ`. Rank classes instead of words and put every member word as a case label on one copy. Words in core stay as they are (`MOV.I` copies them, `CMP.I` compares them) | The `HOT` list has 3 duplicates today (`spl.b $ $`/`spl.b $ #`, `jmp.b $ $`/`jmp.b $ #`, `dat.f $ $`/`dat.f # #`). 0 to 2% on t80 and corpus pairs, less generic code. Cost: `gen-dispatch.mjs` and the specialized-word test | open, #10 |
| 6-byte cell, or values and words in separate arrays | exhaust, exhaust-ma (6-byte); arrays: our own | 6 bytes per cell makes the core 48 KB; separate arrays give 32 KB of values plus 16 KB of words, and most accesses only touch values | Alternatives to the 4-byte cell of issue #6; scaling by 6 or two loads per fetch cost something. 0 to 5% natively | open, issue #6 |
| Prefetch the other warrior's next cell | rmars | In the two-warrior loop the other warrior's next PC is at the head of its queue; prefetch that core cell right after the current fetch | Natively a few percent at most on scattered papers. WebAssembly has no prefetch; an early plain load would have to survive V8, unverified. Must not use the loaded value, the current instruction can write that cell | open, native first, #6 |
| One wraparound for jumps and skips | fmars | Select between the unwrapped candidates (pc + 1, pc + 2, the jump target) and wrap once, instead of wrapping each | Under 1%; check the native disassembly first, clang may already do it | open, low |
| Branch-free `SPL` push | fmars | Always write the new process at the tail, advance the tail only below the process limit. Needs a spare slot behind the queue (linear queue, or a ring one larger than the limit) | 0 to 1%; the log's `SPL` fast path gave nothing | open, low |
| Two fields in one register for `ADD.F`/`SUB.F`/`DJN.F` | fmars (MMX) | Add both 16-bit fields in one 32-bit add, then reduce each lane; no carry crosses lanes up to core size 32,768 | These words are rare in the measured mixes, near 0 | not recommended |
| Statistical early stopping (changes results) | rmars | Rounds stay a prefix of the normal sequence. From `max(min_rounds, 2)` rounds on, after every round: points 3/1/0 per round, sample mean and variance (n - 1), interval width `2 * z * sqrt(var / n) * 100`; stop when the width is at most `ci_width`, report `rounds_played`. rmars documents a score bias of +0.5 to +0.8 at width 60; zero variance stops right at `min_rounds`; repeated looks are not corrected | Large for screening (evolvers, hill pre-filter), lopsided pairings stop after a few dozen rounds. Only as an explicit opt-in mode | not for the default |

Seen in the sources and not useful for us, by measurement or reasoning:

| Idea | From | Why not |
|---|---|---|
| Handler address in every cell, each handler ends with its own copy of the dispatch jump | fmars (computed goto), nMars (a delegate per cell) | This is how fmars makes full specialization fast natively: one load and one indirect jump per instruction, and the branch predictor keys on the handler it leaves (our native full switch had one shared jump: 0.14 misses per instruction). WebAssembly cannot express it (`br_table` only targets enclosing blocks, tail calls measured 116.8 vs 277). Native only, and fmars generates handlers just for the words of a hill (about 350) |
| Code for every word a corpus uses | fmars, nMars | 40, 48 and 64 hot cases were slower than 32 in V8 |
| A WebAssembly module generated per match for its words | fmars idea, nMars plan | The generic path is only 0.1 to 3.4% of executions; needs a wasm emitter in JS |
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
