# 42mars: plan

42mars is a [Core War](https://corewar.co.uk/) simulator (MARS) with its own Redcode assembler, and Core War Theater is the browser visualizer built on it. The assembler and the simulator reproduce pMARS 0.9.x behavior so that warriors assemble and fight like on the hills. Everything is MIT licensed. The prototype in this repository runs today:

- 565 of 567 hill warriors from [n1LS/redcode-warriors](https://github.com/n1LS/redcode-warriors) assemble. The 2 failures are real syntax errors (`fail.red` is broken on purpose, `stone.red` has `dat #0 #0` without a comma, which pMARS rejects too).
- pMARS's own `validate.red` self-ties for all 80,000 cycles, which it only does on a MARS with ICWS'88 semantics and in-register evaluation.
- A differential test against a pMARS 0.9.5 binary finds no difference: all 567 corpus listings, thousands of random expressions and sources, and 9,600 battles per run where the instruction count and a hash of the whole core after every round are equal. See [Validation](#validation).
- 346 tests, `npm test`.
- A WebAssembly simulator for tournaments runs about 310M instructions/s in a single thread, about 3.4 times pMARS and, warmed up, 1.8 times the exMARS build on [corewar.dev](https://corewar.dev/). A round-robin tournament of 80 hill warriors (3,160 pairings, 100 rounds each) takes 2.96 s on 16 cores, against 5.4 s for corewar.dev's exMARS and 10.8 s for parallel pMARS processes (details under [Speed](#speed)).
- The visualizer runs on the same library, with a watch that records what it shows: about 46M instructions/s (the JavaScript simulator it ran on before did 40M/s with its bookkeeping).
- Thanks to the differential test, a few pMARS quirks are now reproduced too, e.g. a pMARS buffer bug that turns `dat#9` at the end of a line into `dat #90` in one hill warrior.

## Goals

1. Parse every warrior that pMARS 0.9.x parses, with the same instructions, start offset and errors.
2. Run battles with the same result as pMARS for the same start positions.
3. Show what happens in the core well enough that a newcomer can see the strategy: bombing, scanning, replication, clears, imps. And it should look good while doing it.
4. Make the simulator and the assembler a C library, 42mars, that other projects embed easily: evolvers, optimizers, hill servers, other visualizers.

## Architecture

```
warriors/*.red ──> assembleWasm (lib/src/asm.c) ──> { instructions, start, pin, source line per instruction }
                                                              │
                         ┌────────────────────────────────────┘
                         v
                   createWasmMars({ watch: true }) (lib/src/mars.c): the core, and the watch: per-cell
                         │   last read/write/exec time, last writer, origin of copied code, trace of the
                         │   last 4096 instructions, process deaths; read once per animation frame
                         v
ui/app.js ──> renderer.js (WebGL2 cells + bloom)   overlay.js (arcs, tags, cell text)   explain.js (what is happening)
                  timeline.js (processes, core share)   warrior cards (activity, source heat)
```

| File | What it does |
|---|---|
| `lib/42mars.h`, `lib/42mars.c`, `lib/src/*.c`, `wasm/42mars.wasm` | The C library: simulator (`mars.c`, with the watch for visualizers), assembler and expression evaluator (`asm.c`: 64-bit integers, registers `a`..`z`, the pMARS evaluation order; pass 1 for labels, `EQU`, `FOR`/`ROF` and asserts, pass 2 for operands, modes, modifiers and values) and the functions of the header (`api.c`), compiled with clang to a 98 KB WebAssembly module without imports that exports the header's functions. The `.wasm` is committed, `wasm/build.sh` rebuilds it byte-identically (it first regenerates `dispatch.h` with `lib/src/gen-dispatch.mjs`). |
| `lib/src/platform.h` | What differs between gcc and clang, MSVC and plain C11: inlining, builtins, aligned allocation, DLL exports. |
| `lib/src/gen-dispatch.mjs` | Generates the specialized instruction cases of `mars.c` (`dispatch.h`), and ranks instruction words by execution count. |
| `Makefile`, `build-msvc.bat` | The native builds: static and shared library, `build/42mars`, the test programs, install with pkg-config, release archives. |
| `cli/42mars.c` | The command line program with pMARS's options and output, on `lib/42mars.h` only. |
| `examples/example.c` | A complete program on the library: a match of two warriors from the command line. |
| `wasm/42mars.js` | JavaScript glue over the functions of `lib/42mars.h`, the npm package `42mars` with `42mars.wasm` and the types in `wasm/42mars.d.ts`: `createWasmMars()` with the step API (`load`, `startRound`, `run`), `runMatch()` for a whole match inside WebAssembly, and `packWarrior()` for warriors that are loaded with one copy and shared between threads. |
| `ui/*` | Visualizer. No dependencies, no build step, plain ES modules. |
| `tools/opcodes.js` | Opcode tables, formatting, pMARS-style listing. |
| `tools/asm.mjs` | `node tools/asm.mjs file.red` prints a pMARS-style listing or the errors. |
| `tools/corpus.mjs` | Assembles every `.red` file below a directory and lists the failures. |
| `tools/tournament.mjs` | Round-robin tournament over a folder, battles in parallel on worker threads with the wasm engine, `--pmars` and `--compare` to run the same tournament through pMARS, `--bench` for one warrior against each of the folder. All threads, the main thread included, take tasks from one shared list; a pairing without `LDP` is played as blocks of 8 rounds, so few pairings use all threads too. |
| `tools/pmars-diff.mjs` | Differential test against a pMARS binary, see [Validation](#validation). |
| `tools/expr-fuzz.mjs` | Random expressions against pMARS's expression evaluator built as a filter. |
| `tools/serve.mjs` | Static file server for development. |
| `tools/example-check.mjs` | `examples/example.c` against pMARS on every pairing of a folder. |
| `bench/bench.mjs` | Simulator speed: the step API, `--watch`, `--wasm-match`. |
| `bench/bench-pairs.mjs` | WebAssembly speed on 40 random corpus pairs. |
| `bench/ab-wasm.mjs`, `bench/ab-native.mjs`, `bench/ab-tool.mjs` | Alternating A/B timing of two wasm builds, of two `mars.c` versions natively, and of two versions of a tool. |
| `bench/wasm-functions.mjs` | Lists or compares the function bodies of wasm modules: shows whether a change to `mars.c` touched the hot loops. |
| `docs/redcode-semantics.md` | The behavior the engine implements, in prose. |

## The engine reproduces pMARS, quirks included

pMARS does not build a syntax tree. It substitutes `EQU` bodies, `FOR`/`ROF` counters and known labels as text, and warriors depend on the details of that model. E.g.:

- `x equ 2+3` followed by `dat #x*2` gives `#8`, not `#10`: the `EQU` body is spliced in without parentheses.
- `1+2*3 == 7` is a bad expression in pMARS, an `==` that ends a nested higher-precedence term gets lost. `7 == 1+2*3` works.
- A label that is defined twice drops the whole second line, with only a warning.
- `dat 1 2` assembles as `dat 12`, because number tokens are glued together.
- `FOR` counters are concatenated with `&` as two digits (`imp&N` becomes `imp01`).

[`docs/redcode-semantics.md`](redcode-semantics.md) lists all of it, plus the exact simulator semantics: in-register evaluation, `SPL` queue order, the cycle budget after a death, placement with the pMARS random generator (`seed = pos - MINDISTANCE` reproduces `pmars -F pos`), p-space and `PIN`.

Deviations, all on purpose:

- A file with only a CR as line ending is split into lines. pMARS reads it as one long line.
- A warrior without instructions is an error. pMARS warns and loads nothing.
- `;debug`, `;trace` and `;break` are ignored, like in the pMARS server build. `;strategy` lines are collected and shown.
- Every instruction records the source line it came from, through `EQU` and `FOR` expansion.

Not implemented yet: several warriors in one input stream.

### How the MIT engine came about

The first version of the engine was a close port of the pMARS C sources and therefore GPL. To make the project MIT licensed, the engine was rewritten:

1. The behavior was written down as prose, without code: [`docs/redcode-semantics.md`](redcode-semantics.md).
2. The GPL engine produced reference outputs, used as a black box: 4031 expressions, 146 small sources, the 567 corpus warriors (instructions, start, metadata, warning count) and 319 battles (positions, survivors, cycles, core hash per round, checkpoints every 2000 cycles for 40 of them).
3. A separate agent without access to the pMARS sources or the GPL port wrote the new engine from the description and checked it against the reference outputs. It matches all of them, including the soft checks (warning counts, ownership and origin hashes).

The agent was stopped before it wrote its final report, so there is no explicit statement from it that it kept to the isolation rules. The code structure is independent of pMARS (classes `Expander`, `StatementParser`, one `execute()` loop, none of the pMARS function names). The trace tests were written afterwards. The GPL port never reached the public history: the branch was squashed before the first push.

The fixes after the differential test and the speed work were done the same way: two more agents without access to any pMARS source, working from behavior descriptions, with the pMARS binary and pMARS's expression evaluator only as black-box oracles. Both confirmed the isolation in their reports.

## Validation

### The engine matches pMARS 0.9.5

`tools/pmars-diff.mjs` runs a pMARS binary (built with `-DSERVER -DEXT94 -DPERMUTATE -DRWLIMIT`, used as an external program only) and the engine on the same input:

| Section | What is compared | Last run (seed 777, scale 2) |
|---|---|---|
| `listings` | all 567 corpus warriors: pMARS listing vs ours, or both reject | 0 differences |
| `exprs` | random expressions in `dat #expr, #expr` | 0 in 3,000 |
| `sources` | random sources with `EQU`, `FOR`/`ROF`, labels, `CURLINE`, glued opcodes, CRLF, metadata | 0 in 3,000 |
| `battles` | random corpus pairs at fixed positions | 0 in 2,400 |
| `fuzz` | random warriors on 4 rule sets (core 80, 800, 800 with 8 processes, 8000) | 0 in 6,000 |
| `multi` | 3 and 4 warriors | 0 in 1,200 |

With `--permute` (pMARS's `-P`), battles and fuzz: 0 differences in 1,200 and 3,000 with `--pmars-trace` on mars.js, headless and wasm, and with `--wasm-match` (seed 1794403725). Three of the seven fuzz rule sets and two of the five multi ones have read and write limits (`-R`, `-W`): 0 differences in 6,000 and 1,200 at scale 2 with `--pmars-trace` on mars.js, headless and wasm, and with `--wasm-match`. With `--icws88` (`-8`, every section on ICWS'88 code): 0 differences in all sections with `--pmars-trace` on mars.js, headless and wasm with the C assembler, and with `--wasm-match` (seed 1794404645).

With `--pmars-trace`, the battles run on a pMARS build that additionally prints, at the end of every round, the number of executed instructions and an FNV-1a hash of the whole core (the format is described at the top of the tool). Then not only the scores but the exact course of every round is compared. All 9,600 battles above match on that level, in the default and in the headless mode (headless with seed 778).

`tools/expr-fuzz.mjs` feeds random expressions through pMARS's own evaluator built as a filter: 0 differences in value or accepted/rejected in 3 runs of 600,000 expressions. About 0.05% differ only in the kind of error (both reject).

The differential test found these differences, now fixed:

- Long operator chains: pMARS hands an operator that ends a nested term back to the inner level, so e.g. `5<7-6/8<8` is 0. Register assignments interact with that.
- A pMARS buffer bug: an opcode glued to its operand at the end of a line (`dat#9`) picks up leftover characters of earlier text. Hill warrior `asianflu.red` assembles to `dat #90` in pMARS, and now here too.
- `;name` and `;author` keep trailing whitespace, a lone CR ends the line content, warriors without instructions are accepted with a warning, label values stay separate from the following text in pass 2.

Where pMARS hangs (lines over 255 characters, a `\` at the end of the file, huge operand values) or reads uninitialized memory (a lone `!`, `=`, `&` or `|` where an operator belongs), the engine does something reasonable instead. [`docs/redcode-semantics.md`](redcode-semantics.md) section 4 lists these deviations.

### Other checks

1. 346 tests, among them the command line program against recorded pMARS outputs (36, `test/cli.test.js`), read and write limits from pMARS (4, `test/limits.test.js`), `-P` positions and first movers against recorded pMARS sequences (3, `test/permute.test.js`), the ICWS'88 assembler rules and listing from pMARS (3, `test/icws88.test.js`), the C library through `lib/42mars.h`, built with `cc` or prebuilt by `make test` and on Windows by MSVC, and the exports of the Windows DLL against the header (3, `test/c-api.test.js`), the npm package and the version (3, `test/package.test.js`), the C assembler against digests of the results of the JS assembler it was ported from (7, `test/asm-c.test.js`), assembler (36), pMARS quirks with expected values taken from pMARS (24), simulator (19, `test/mars.test.js`), the specialized loops against the generic operand code and against digests recorded where they gave the results of the JavaScript simulator (17, `test/wasm.test.js`), the watch against digests recorded where it gave that simulator's bookkeeping, and its trace flags against the queues (6, `test/watch.test.js`), footprints (4), trace (8), tournaments (9), the pmars-diff temporary folder and its options (5), the clean-room hook (2), the agent files (7: what `CLAUDE.md`, the rules and the skills name must exist) and the runner for long checks (3), reference expressions and sources (147). The fixes and the speed work were checked with deliberate mutations: each test fails when the code it covers is broken.
2. Corpus check: `node tools/corpus.mjs <dir>`, 565/567.
3. `validate.red` from the pMARS distribution. It is GPL and not in this repository, the test runs when `PMARS_VALIDATE` points to it.

### Speed

The newest comparison of all engines is the chart in [`README.md`](../README.md#speed) (12th November 2026): every engine as a whole process on the same 12,000 rounds of the 3 bench pairs, one thread. 42mars natively 478M instructions/s, fmars 402M, 42mars in WebAssembly 390M, exMARS 0.01 natively 279M, rmars 192M, corewar.dev's exMARS build 151M, pMARS 0.9.5 106M, corewar.dev's pMARS build 64M ([`images/speed.mjs`](images/speed.mjs) has the commands). The tables below are older and measured differently: compare their numbers only with each other.

Single thread, `node bench/bench.mjs <corpus>`: 3 hill pairs, 200 rounds each, 22,667,265 instructions, Node 22.22, Ryzen 9 7950X, idle machine, 7 fresh processes each, median (range):

| Engine | M instructions/s |
|---|---|
| ours, WebAssembly, `runMatch` | 310.1 (309.3 to 311.7) |
| ours, WebAssembly, step API (`run()` from JS) | 309.7 (308.0 to 311.8) |
| same C natively (`clang -O3 -march=native`, `bench/bench-native.mjs`) | about 420 |
| [corewar.dev](https://corewar.dev/) exMARS build (WebAssembly) | 132.3 (131.4 to 132.8); warmed up 186 to 190 |
| pMARS 0.9.5 native, `-O2` | 90.7 (87.2 to 90.7) |
| our JavaScript simulator, `headless: true` (removed in #76) | 61.4 (59.6 to 63.4) |
| corewar.dev pMARS build (WebAssembly) | 51.6 (45.7 to 52.8) |
| ours, WebAssembly with the watch (`bench/bench.mjs --watch`, what the visualizer runs) | about 46 |
| our JavaScript simulator with visualizer bookkeeping (removed in #76) | about 40 |

All engines play the same battles with the same results. The corewar.dev numbers come from driving their published modules (`exmars.mjs`, `engine.mjs`) from Node with the warriors already loaded; that harness is not in this repository because their code is GPL. The JS benchmark was short enough that JIT warm-up was part of it: warmed up, the JS engine reached about 51M/s with bookkeeping and 75 to 80M/s headless. The same holds for the WebAssembly engines: each run takes 80 to 170 ms and includes V8's tier-up. Warmed up (each bench pair timed alone, best of 5) ours runs 323 to 347M/s and exMARS 143 to 192M/s, 1.8 to 2.3 times; on the tournament warriors the warmed-up ratio is 1.7 to 1.8 (`docs/performance-log.md`, the state at the end of the fourth round). The two WebAssembly rows and these warmed-up numbers are from 10th November 2026, after the fourth round; the other rows are older. The fourth round made the native build 2 to 3% slower (436 before it on the same day).

Single thread on a tournament mix, all 190 pairings of the first 20 corpus warriors, 100 rounds each: ours 3.60 s, corewar.dev exMARS 6.14 s (exMARS measured before the third round; ours 4.13 s then, faster in every one of the 190 pairings by at least 20%).

Round robin of 80 corpus warriors, 3,160 pairings × 100 rounds, `node tools/tournament.mjs <dir> --rounds 100 --jobs N`, results compared pairing by pairing:

| Engine | 16 jobs | 31 jobs |
|---|---|---|
| ours, WebAssembly (`--engine wasm`) | 3.31 s | 2.96 s |
| corewar.dev exMARS, one fighter per worker thread as on the site | 6.0 to 6.5 s | 5.4 s |
| pMARS 0.9.5, parallel processes (`--pmars`) | 12.8 s | 10.8 s |
| our JavaScript simulator (`--engine js`, removed in #76) | 15.3 s | 13.2 s |

Ours measured on 10th November 2026, after the fourth round (`docs/performance-log.md`); the same day before it: 3.46 s and 3.11 s. The other engines were measured earlier. Every engine gives the same wins, losses and ties in all 3,160 pairings. The machine has 16 cores with 2 hardware threads each; the second thread per core adds about 11% for the WebAssembly engine.

Against [rmars](https://github.com/clrsrc/rmars) (Rust, pMARS 0.9.6-dev semantics, commit 215fadc, release build with fat LTO; "native" adds `target-cpu=native`), through its Python module with its own thread pool. Both engines play the same rounds: rmars's pairings and start positions (pMARS `-f` checksum seeds), 100 rounds, 5 runs each, median:

| Workload | rmars | rmars native | ours | ours without early ties |
|---|---|---|---|---|
| first 20 corpus warriors, 1 thread | 6.96 s | 6.72 s | 3.81 s | 4.05 s |
| first 80 corpus warriors, 16 threads | 6.78 s | 6.47 s | 3.44 s | 3.93 s |
| first 80 corpus warriors, 31 threads | 5.95 s | 5.64 s | 3.10 s | 3.46 s |
| first 80 corpus warriors, 32 threads | 5.43 s | 5.11 s | 3.09 s | 3.45 s |

Single thread that is 177M (rmars), 184M (native) and 304M (ours without early ties) simulated instructions per second, so ours is 1.7 times as fast before early ties. rmars has no early ties; with its statistical early stop (interval width 60, at least 20 rounds; results differ from pMARS) the 80-warrior set takes 2.75 s on 31 threads. Results: identical wins, losses and ties in all 190 pairings of the 20-warrior set; in the 80-warrior set rmars differs from ours in 46 pairings, all with `asianflu.red`, and there ours agrees with pMARS 0.9.5 (details in `docs/performance-log.md`).

What made it fast:

- The WebAssembly engine: an 8-byte packed cell, dispatch on the opcode byte, the common modes `$` and `#` tested first, a fast path for `MOV.I`, B values read only where an instruction needs them, a separate loop for two warriors with both queues in locals, a copy of the instruction code for each of the 32 most executed instruction words (generated, `lib/src/gen-dispatch.mjs`), the standard core size and process limit as constants, the core and queues at fixed addresses, `-Os`, `MOV.I` as one 64-bit copy of the A cell read at operand time, and for two warriors queues long enough for a whole round, so no index needs a wraparound mask, with one head for both queues: the loop runs a pair of turns per pass and carries 3 counters instead of 5. `docs/performance-log.md` has every idea that was tried, with numbers, including the ones that did not help: one generated case for every one of the 8,512 instruction words was 8 times slower in WebAssembly and 40% slower natively.
- Early ties in `runMatch` (results only, not the final core): a round stops when no warrior can lose its last process in the remaining budget, or when the core holds no `DAT`, `DIV`, `MOD` or `STP` anymore, so nobody can die and p-space cannot change. The second proof matters for imp spirals and papers: e.g. `acme.red` vs `alpha.red` runs in 13 ms instead of 51 ms. Some of these ideas came from Martin's exMARS (2003) and from the exMARS fork used by corewar.dev; they were passed to the implementing agent as descriptions, not as code.

## Visualization

The core is drawn by one fragment shader from two small data textures that are rebuilt every frame, then a bloom pass blurs the bright parts at half and quarter resolution. A 2D canvas on top draws arcs and labels.

| What you see | What it means |
|---|---|
| Cell color | Warrior that wrote the cell last. Initial core is a faint dot. |
| Filled tile | Code (any opcode but `DAT`). `SPL` gets a bright center. |
| Hollow tile | `DAT`, i.e. a bomb or data. |
| Bright flash fading out | Recent write. Trail length is the `trails` slider. |
| White-hot center | Recently executed, tinted by the warrior that executed it. |
| Pulsing dot | A live process sits there. The next process to run gets an outline. |
| Glowing outline | Recently read, in the color of the reading warrior. |
| Solid arc | An instruction wrote to that cell. |
| Dashed arc | A jump, or a new process from `SPL`. |
| Dotted line | A compare (`SEQ`, `SNE`, `CMP`, `SLT`) looked at that cell, i.e. a scanner. |
| Small ring | A process died there. Big ring: a warrior died. |
| Colored dot | Footprint: a warrior read a cell it does not own this round, in its color. A scanner leaves a lattice of them. |
| `+` or `−` instead of a tile | Footprint: the last change was an increment or decrement of a pointer (`>`, `}`, `<`, `{`), not a store. |

The footprints (`F` toggles them) keep for the whole round what the glows show for a moment, from `readBy` and `bump` of the watch. They came from looking at corewar.dev's display, which splits each cell into four quarters for read, write, execute, increment and decrement; ours uses a shape per kind of access instead.

### Learning what is going on

The aim is that somebody who has never seen Core War can work out what a warrior does:

- **learn** speed (2 instructions/s, or paused): a box explains every executed instruction in plain English, e.g. "Copies the whole instruction at cell 0007 to cell 6726. B is @7: the B-field of cell 0008 holds the offset.", and tags mark the executing cell (`PC`) and its `A` and `B` targets in the core.
- **What's happening**: a story feed with the start positions, the first hit of one warrior on another, process milestones (8, 64, 512, 4096), changes in behavior, and the cause of every death ("its last process ran into a DAT from Lantern at 6731"). Clicking an entry marks the place in the core.
- **Activity** per warrior: the trace is classified into bombing, clearing, copying itself, scanning, splitting, imp crawling and looping, shown as a bar and a sentence ("Seeker compares far-away cells to find enemy code."). This is a heuristic over the last few thousand instructions, not an analysis of the code, and it can be wrong, e.g. for unusual bombers.
- Small cores (rules `nano · 80`, `tiny · 800`) show the instruction text inside the cells.
- The tooltip shows the hovered instruction, what its opcode does, which source line it was copied from, and the 9 cells around it.
- A guide (`?`) explains Core War in short, the legend, the common strategies and how to use these aids. It opens on the first visit.
- Two layouts: `ring` shows that the core is circular, `grid` is the classic row by row view.
- Warrior cards with process count, share of the core, W/L/T, and the source code shaded by how often each line ran recently.
- A timeline of process count (log scale) and core share per warrior, with markers where a warrior died.
- Rule presets, rounds, speed from 1 instruction/s to as fast as possible, keyboard controls, drag and drop of `.red` files, an editor with live assembly and listing, URL parameters (`cast`, `preset`, `layout`, `speed`, `steps`, `rounds`).

## Roadmap

The current focus is the library (L). M1 stays, because a library has to score exactly like the hills. M2 to M4 are parked: the visualizer is kept working, and it is meant to come back as the battle view of an evolver UI.

### L: the 42mars library

A C library, a pMARS-compatible command line program and an npm package. C only (C11, no C++), so that every language can call it and the WebAssembly build needs no standard library. The public interface may break until 1.0.0.

- L1 (#53), done: `mars.c` keeps all state in `struct Mars` and every function takes it. The wasm module and the native benchmark use one context at a fixed address, with no loss against the globals (wasm within noise, native 1 to 3% faster). A context through a pointer (`-DMARS_CONTEXT_POINTER`) costs 4 to 6% in wasm and 1 to 3% natively (`docs/performance-log.md`, "A context object"); L3 decides whether the native library takes that.
- Layout, done: `lib/` the C library, `wasm/` its WebAssembly build and JS interface, `ui/` the visualizer, `js/` the JS simulator until the library replaces it (decided 10th November 2026: one implementation, in C; pMARS stays the oracle). Since 12th November 2026 `lib/` holds only the library, `examples/` the example, `tools/` the user tools and the pMARS comparisons, `bench/` the speed tools, and this plan is in `docs/` (`docs/development.md`).
- L2 (#54), done: `lib/src/asm.c` ports `expr.js` and `assembler.js` with every pMARS quirk and is in the wasm build (`assembleWasm`, `evaluateWasm` in `wasm/42mars.js`). It gave the same result objects as the JS code on the fixtures (4031 expressions, 146 snippets), the 567 corpus warriors, 4000 random sources and 20000 random expressions, and the same counts in `tools/expr-fuzz.mjs`; no differences against pMARS. Since November 2026 the tools, the tests and the visualizer assemble through wasm, `js/expr.js` and `js/assembler.js` are removed, and `test/asm-c.test.js` keeps digests of the last common results. The assembler warns where pMARS has no defined result or takes very long (texts that start with `pMARS`); the tools used to find those cases by instrumenting the JS evaluator.
- L3 (#55), done: `lib/42mars.h` and `lib/42mars.c` (one translation unit over `src/mars.c`, `src/asm.c`, `src/api.c`). Natively a context lives in caller memory (or `m42_new`), several per process; the wasm build has one at a fixed address (`M42_FIXED_CONTEXT`), and its loops are byte-identical to before, data addresses included. `examples/example.c` builds with `cc example.c 42mars.c` and gives pMARS's result on all 3160 t80 pairings (`tools/example-check.mjs`, gcc and clang, `-O0` and `-O2`); `test/c-api.test.js` checks the functions against the wasm build in CI. The wasm module exports only the `m42_` functions; `wasm/42mars.js` gives the library all its memory (the context's heap, warriors, assembler memory) from the linear memory above `__heap_base`. The watch (#74): `m42_watch_attach()` (`createWasmMars({ watch: true })`) records the per-cell bookkeeping the visualizer shows, the trace and the process deaths (semantics doc, 3.4 and 3.6) in a loop of its own, `execute_watched()`, one instruction at a time; the three other loops are unchanged natively and in wasm apart from one call index. The visualizer runs on it (#75), and `js/mars.js` is removed (#76): the same cells on screen as with mars.js at the same step and seed, and the tests compare with digests recorded while both gave the same results. The header as planned: rules, `m42_assemble`, `m42_match`, `m42_bench` (one warrior against many, for evolvers), a step interface for visualizers and debuggers, p-space kept by the caller between calls (#48), error codes with line numbers, `m42_version`. Binding-friendly: opaque handles, fixed-width fields, no callbacks in the hot path, no varargs, memory from the caller.
- L4 (#56), done: `cli/42mars.c` (`make` builds `build/42mars`), a command line program with pMARS 0.9.5's options and its stdout and exit codes, from `lib/42mars.h` only: listings, `-b`, `-k`, `-o`, `-A`, `-=`, `-F`, `-f` (pMARS's checksum seed, found by running it), `-@`, stdin. `-P` came with #41, `-8` with #42, `-R -W` with #40. Not yet: `-V`, with a clear error. `tools/pmars-diff.mjs --cli build/42mars` compares both on corpus warriors (0 differences in 3000 cases), `tools/tournament.mjs --pmars build/42mars --compare` says SAME on t80. Behavior in the semantics doc, section 5.
- L5 (#57), done: a `Makefile` for gcc and clang (static and shared library, `build/42mars`, `make test`, `make install` with `42mars.pc`, `make dist`) and `build-msvc.bat` for MSVC; the C code is C11 with the compiler specifics in `lib/src/platform.h`, and the hot loops of the wasm, gcc and clang builds are byte-identical to before. CI (`.github/workflows/test.yml`) builds and tests the library and the program on Linux (x64 and arm64), macOS and Windows (MSVC), under ASan and UBSan, and the C11 code without compiler extensions (`-DM42_PORTABLE`), runs `npm test` on Node 20 to 26 and checks that `wasm/build.sh` gives the committed module; a tag `v<version>` makes a GitHub release with the archives of the four native builds and publishes the npm package `42mars` (`wasm/42mars.js` without imports from `js/`, `42mars.wasm`, `wasm/42mars.d.ts`), a dry run until the repository variable `NPM_PUBLISH` is `true` and the secret `NPM_TOKEN` exists. One version for all, in `lib/42mars.h` and `package.json` (`test/package.test.js`). The MSVC build has the first 16 of the 32 specialized cases (`M42_DISPATCH_16`): a quarter of the compile time and the same speed on four warrior pairs; its speed on tournaments is not measured (docs/performance-log.md, 12th November 2026). CMake when someone asks.
- Later: a Python binding once the interface is close to 1.0.0, other languages on request. Then an evolver on top of `m42_bench`, with a UI that reuses the visualizer.

### M1: engine parity

- Read/write limits (#40), done: `readLimit`/`writeLimit` (`m42_rules.read_limit`, `write_limit`) in both engines, `42mars -R -W`, `tools/tournament.mjs --read-limit --write-limit`, three fuzz rule sets with limits in `tools/pmars-diff.mjs`. pMARS folds each offset into the window of a limit, but reads the pointer cell of `@ *` through the read offset and starts both addresses of `< > { }` from the write offset, unlike the ICWS'94 draft (semantics doc, 3.3). In C a fourth loop, `execute_limited()`, runs only with limits; the other three are unchanged natively (gcc, clang) and in wasm apart from one call index. No differences with `--pmars-trace` on mars.js, headless and wasm, and with `--wasm-match`; SAME on t20 with limits.
- `-8` (#42), done: `icws88` for both assemblers (`assemble`, `assembleWasm`, `M42_ICWS88` of `m42_assemble`), the ICWS'88 listing in `formatListing()` and `42mars`, `42mars -8`, `tools/asm.mjs --icws88`, `tools/pmars-diff.mjs --icws88`, `tools/tournament.mjs --icws88`. pMARS's `-8` only restricts the assembler (opcodes, modes per opcode, no modifiers, `ORG` or `PIN`) and changes the listing; the code runs the same (semantics doc, end of 2.4). No differences with `--icws88` in any section, SAME on t20. No rule preset in the UI: the visualizer is not extended for now.
- `-P` (#41), done: `permute` in `m42_match_options`, `runMatch`, `load()` of both engines, `42mars -P`, `tools/tournament.mjs --permute`, `tools/pmars-diff.mjs --permute`. Each (position, first mover) combination once before any repeats, drawn from a list with the generator; the rule was found from the per-round core hashes of the trace build and is in the semantics doc, 3.2. No differences with `--pmars-trace` on mars.js and wasm, SAME on t20 with `--pmars --compare`.
- A CI job that downloads and builds pMARS and runs `tools/pmars-diff.mjs`, so that every change is compared against pMARS.
- Standings round by round (#48), done: `tools/tournament.mjs` plays round-major (the first 8 rounds of every pairing, then the next 8 ...; 1 round per task with `--progress`), `--progress` prints the standings after every round as soon as every pairing played it, and `--json` has the scores after every round (`progress`); they equal a tournament of that many rounds. `runMatch({ pspace })` (`m42_match_options.pspace`) carries p-space and the last results from one call to the next, so blocks of rounds are exact also with LDP. t80 with 31 jobs: 2.79 s before, 2.81 s after (median of 5, ranges overlap); 1-round tasks cost 8%.
- A tournament page in the UI, on the WebAssembly engine in web workers.
- Move the simulator into a Web Worker so that max speed does not cost frame time.

### M2: see more

- Time scrubbing: snapshot the core every N cycles and re-run deterministically to any cycle. Then the timeline becomes a seek bar, and you can replay the moment a warrior died.
- Process lineage: show which `SPL` created which process, so replicators show their family tree.
- Zoom and pan in the grid layout, so the instruction text is readable on an 8000-cell core too.
- Address ticks around the ring, and a camera that follows one warrior.
- Auto slow motion around deaths.
- Guided tours: a scripted walk through e.g. Dwarf vs Imp on the nano core, step by step, with the explanation boxes as chapters.

### M2b: for warrior authors

Information that pMARS's display does not give, with exact numbers:

- Process queue panel: every process of a warrior in queue order, with its address (absolute and relative to the warrior start) and decoded instruction; the next one marked.
- Core listing around any cell in pMARS format, addresses relative to a chosen warrior; click an operand to follow its pointer chain (`@`, `*`, `<`, `>`, `{`, `}`).
- Exact execution counts per source line and per core cell over the round, next to the decaying heat.
- Bomb map: where each warrior's writes landed this round, with the detected step size of bombers and scanners (e.g. step 3364).
- Death report: the instruction that killed a warrior's last process, who wrote that cell and when, and a jump to replay it (needs time scrubbing).
- P-space viewer and a per-round log of results and p-space changes, for warriors that switch strategy between rounds.
- Breakpoints: pause at cycle N, when a cell is written or executed, or when a warrior's process count crosses N.
- Benchmark run: one warrior against a folder of opponents on the WebAssembly engine, score per opponent, then watch any pairing.

### M3: theater

- Tournament mode: round robin over a folder of warriors, result matrix, and click a cell to watch that pairing.
- Shareable links with the warriors encoded in the URL.
- Video export of the canvas with `MediaRecorder`.
- Import of hill and benchmark sets.

### M4: polish

- Color-blind safe palette option, reduced motion option, better phone layout.

## Open decisions

- The evolver's name, once work on it starts.

- The sample warriors in `warriors/` are written for this repository, except Imp and Dwarf, which are the classic examples from Dewdney's 1984 article. Hill warriors are not included because their licenses are unclear. The UI loads them by drag and drop.
