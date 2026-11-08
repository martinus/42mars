# Core War Theater: plan

Core War Theater is a browser visualizer for [Core War](https://corewar.co.uk/) battles. It has its own Redcode assembler and MARS simulator, which reproduce pMARS 0.9.x behavior so that warriors assemble and fight like on the hills. Everything is MIT licensed. The prototype in this repository runs today:

- 565 of 567 hill warriors from [n1LS/redcode-warriors](https://github.com/n1LS/redcode-warriors) assemble. The 2 failures are real syntax errors (`fail.red` is broken on purpose, `stone.red` has `dat #0 #0` without a comma, which pMARS rejects too).
- pMARS's own `validate.red` self-ties for all 80,000 cycles, which it only does on a MARS with ICWS'88 semantics and in-register evaluation.
- A differential test against a pMARS 0.9.5 binary finds no difference: all 567 corpus listings, thousands of random expressions and sources, and 9,600 battles per run where the instruction count and a hash of the whole core after every round are equal. See [Validation](#validation).
- 248 tests, `npm test`.
- A WebAssembly simulator for tournaments runs about 280M instructions/s in a single thread, about 3.1 times pMARS and 2.1 times the exMARS build on [corewar.dev](https://corewar.dev/). A round-robin tournament of 80 hill warriors (3,160 pairings, 100 rounds each) takes 3.44 s on 16 cores, against 5.4 s for corewar.dev's exMARS and 10.9 s for parallel pMARS processes (details under [Speed](#speed)).
- The JavaScript simulator used by the visualizer does about 40M instructions/s with its bookkeeping, 61M/s headless.
- Thanks to the differential test, a few pMARS quirks are now reproduced too, e.g. a pMARS buffer bug that turns `dat#9` at the end of a line into `dat #90` in one hill warrior.

## Goals

1. Parse every warrior that pMARS 0.9.x parses, with the same instructions, start offset and errors.
2. Run battles with the same result as pMARS for the same start positions.
3. Show what happens in the core well enough that a newcomer can see the strategy: bombing, scanning, replication, clears, imps. And it should look good while doing it.

## Architecture

```
warriors/*.red ──> src/engine/assembler.js ──> { instructions, start, pin, source line per instruction }
                         │ uses expr.js                 │
                         v                              v
                   src/engine/mars.js: core arrays, per-cell last read/write/exec time, last writer,
                         │             origin of copied code, trace ring buffer of the last 4096 instructions
                         │ read once per animation frame
                         v
src/ui/app.js ──> renderer.js (WebGL2 cells + bloom)   overlay.js (arcs, tags, cell text)   explain.js (what is happening)
                  timeline.js (processes, core share)   warrior cards (activity, source heat)
```

| File | What it does |
|---|---|
| `src/engine/expr.js` | Expression evaluator. 64-bit integers, registers `a`..`z`, precedence climbing in the pMARS evaluation order (shared hand-back operator, dropped `==`). |
| `src/engine/assembler.js` | `readSource` splits lines and reads `;name`, `;assert` etc., `Expander` does pass 1 (labels, `EQU`, `FOR`/`ROF`, asserts), `StatementParser` does pass 2 (operands, modes, modifiers, values). |
| `src/engine/mars.js` | Simulator. One allocation-free loop specialized on the opcode byte, flat process queues, all per-cell arrays as views into three shared buffers, optional `headless` mode without visualizer bookkeeping. |
| `src/engine/opcodes.js` | Opcode tables, formatting, pMARS-style listing. |
| `src/engine/wasm/mars.c`, `mars.wasm` | Headless simulator in C, compiled with clang to a 51 KB WebAssembly module without imports. The `.wasm` is committed, `tools/build-wasm.sh` rebuilds it byte-identically (it first regenerates `dispatch.h` with `tools/gen-dispatch.mjs`). |
| `src/engine/mars-wasm.js` | JavaScript glue: `createWasmMars()` with the step API (`load`, `startRound`, `run`) and `runMatch()` for a whole match inside WebAssembly. |
| `src/ui/*` | Visualizer. No dependencies, no build step, plain ES modules. |
| `docs/redcode-semantics.md` | The behavior the engine implements, in prose. |
| `tools/asm.mjs` | `node tools/asm.mjs file.red` prints a pMARS-style listing or the errors. |
| `tools/corpus.mjs` | Assembles every `.red` file below a directory and lists the failures. |
| `tools/bench.mjs` | Simulator speed: `--headless`, `--wasm`, `--wasm-match`. |
| `tools/bench-pairs.mjs` | WebAssembly speed on 40 random corpus pairs. |
| `tools/gen-dispatch.mjs` | Generates the specialized instruction cases of `mars.c` (`dispatch.h`), and ranks instruction words by execution count. |
| `tools/tournament.mjs` | Round-robin tournament over a folder, battles in parallel on worker threads, `--engine js|wasm`, `--pmars` and `--compare` to run the same tournament through pMARS. |
| `tools/pmars-diff.mjs` | Differential test against a pMARS binary, see [Validation](#validation). |
| `tools/expr-fuzz.mjs` | Random expressions against pMARS's expression evaluator built as a filter. |
| `tools/serve.mjs` | Static file server for development. |

## The engine reproduces pMARS, quirks included

pMARS does not build a syntax tree. It substitutes `EQU` bodies, `FOR`/`ROF` counters and known labels as text, and warriors depend on the details of that model. E.g.:

- `x equ 2+3` followed by `dat #x*2` gives `#8`, not `#10`: the `EQU` body is spliced in without parentheses.
- `1+2*3 == 7` is a bad expression in pMARS, an `==` that ends a nested higher-precedence term gets lost. `7 == 1+2*3` works.
- A label that is defined twice drops the whole second line, with only a warning.
- `dat 1 2` assembles as `dat 12`, because number tokens are glued together.
- `FOR` counters are concatenated with `&` as two digits (`imp&N` becomes `imp01`).

[`docs/redcode-semantics.md`](docs/redcode-semantics.md) lists all of it, plus the exact simulator semantics: in-register evaluation, `SPL` queue order, the cycle budget after a death, placement with the pMARS random generator (`seed = pos - MINDISTANCE` reproduces `pmars -F pos`), p-space and `PIN`.

Deviations, all on purpose:

- A file with only a CR as line ending is split into lines. pMARS reads it as one long line.
- A warrior without instructions is an error. pMARS warns and loads nothing.
- `;debug`, `;trace` and `;break` are ignored, like in the pMARS server build. `;strategy` lines are collected and shown.
- Every instruction records the source line it came from, through `EQU` and `FOR` expansion.

Not implemented yet: pMARS's `-8` strict ICWS'88 mode, read/write limits (`-R`, `-W`), the `-P` permutation of start positions, and several warriors in one input stream.

### How the MIT engine came about

The first version of the engine was a close port of the pMARS C sources and therefore GPL. To make the project MIT licensed, the engine was rewritten:

1. The behavior was written down as prose, without code: [`docs/redcode-semantics.md`](docs/redcode-semantics.md).
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

With `--pmars-trace`, the battles run on a pMARS build that additionally prints, at the end of every round, the number of executed instructions and an FNV-1a hash of the whole core (the format is described at the top of the tool). Then not only the scores but the exact course of every round is compared. All 9,600 battles above match on that level, in the default and in the headless mode (headless with seed 778).

`tools/expr-fuzz.mjs` feeds random expressions through pMARS's own evaluator built as a filter: 0 differences in value or accepted/rejected in 3 runs of 600,000 expressions. About 0.05% differ only in the kind of error (both reject).

The differential test found these differences, now fixed:

- Long operator chains: pMARS hands an operator that ends a nested term back to the inner level, so e.g. `5<7-6/8<8` is 0. Register assignments interact with that.
- A pMARS buffer bug: an opcode glued to its operand at the end of a line (`dat#9`) picks up leftover characters of earlier text. Hill warrior `asianflu.red` assembles to `dat #90` in pMARS, and now here too.
- `;name` and `;author` keep trailing whitespace, a lone CR ends the line content, warriors without instructions are accepted with a warning, label values stay separate from the following text in pass 2.

Where pMARS hangs (lines over 255 characters, a `\` at the end of the file, huge operand values) or reads uninitialized memory (a lone `!`, `=`, `&` or `|` where an operator belongs), the engine does something reasonable instead. [`docs/redcode-semantics.md`](docs/redcode-semantics.md) section 4 lists these deviations.

### Other checks

1. 248 tests, among them: assembler (35), pMARS quirks with expected values taken from pMARS (21), simulator (19), visualizer bookkeeping and headless equivalence (2), trace buffer (8), reference expressions and sources (147). The fixes and the speed work were checked with deliberate mutations: each test fails when the code it covers is broken.
2. Corpus check: `node tools/corpus.mjs <dir>`, 565/567.
3. `validate.red` from the pMARS distribution. It is GPL and not in this repository, the test runs when `PMARS_VALIDATE` points to it.

### Speed

Single thread, `node tools/bench.mjs <corpus>`: 3 hill pairs, 200 rounds each, 22,667,265 instructions, Node 22.22, Ryzen 9 7950X, idle machine, 7 fresh processes each, median (range):

| Engine | M instructions/s |
|---|---|
| ours, WebAssembly, `runMatch` | 279.5 (276.3 to 282.2) |
| ours, WebAssembly, step API (`run()` from JS) | 280.6 (277.2 to 281.6) |
| same C natively (`clang -O3 -march=native`, `tools/bench-native.mjs`) | about 405 to 415 |
| [corewar.dev](https://corewar.dev/) exMARS build (WebAssembly) | 132.3 (131.4 to 132.8) |
| pMARS 0.9.5 native, `-O2` | 90.7 (87.2 to 90.7) |
| ours, JavaScript, `headless: true` | 61.4 (59.6 to 63.4) |
| corewar.dev pMARS build (WebAssembly) | 51.6 (45.7 to 52.8) |
| ours, JavaScript with visualizer bookkeeping | about 40 |

All engines play the same battles with the same results. The corewar.dev numbers come from driving their published modules (`exmars.mjs`, `engine.mjs`) from Node with the warriors already loaded; that harness is not in this repository because their code is GPL. The JS benchmark is short enough that JIT warm-up is part of it: warmed up, the JS engine reaches about 51M/s with bookkeeping and 75 to 80M/s headless.

Single thread on a tournament mix, all 190 pairings of the first 20 corpus warriors, 100 rounds each: ours 4.13 s, corewar.dev exMARS 6.14 s. Ours is faster in every one of the 190 pairings, by at least 20%.

Round robin of 80 corpus warriors, 3,160 pairings × 100 rounds, `node tools/tournament.mjs <dir> --rounds 100 --jobs N`, results compared pairing by pairing:

| Engine | 16 jobs | 31 jobs |
|---|---|---|
| ours, WebAssembly (`--engine wasm`) | 3.83 s | 3.44 s |
| corewar.dev exMARS, one fighter per worker thread as on the site | 6.0 to 6.5 s | 5.4 s |
| pMARS 0.9.5, parallel processes (`--pmars`) | 13.1 s | 11.0 s |
| ours, JavaScript (`--engine js`) | 15.3 s | 13.2 s |

Every engine gives the same wins, losses and ties in all 3,160 pairings. The machine has 16 cores with 2 hardware threads each; the second thread per core adds about 11% for the WebAssembly engine.

What made it fast:

- The JavaScript engine: all per-cell arrays of one element type in one buffer (the loop touches 3 typed arrays instead of 15), one inlined loop, flat process queues, specialization on the opcode byte.
- The WebAssembly engine: an 8-byte packed cell, dispatch on the opcode byte, the common modes `$` and `#` tested first, a fast path for `MOV.I`, B values read only where an instruction needs them, a separate loop for two warriors with both queues in locals, a copy of the instruction code for each of the 32 most executed instruction words (generated, `tools/gen-dispatch.mjs`), the standard core size and process limit as constants, the core and queues at fixed addresses, and `-Os`. `docs/performance-log.md` has every idea that was tried, with numbers, including the ones that did not help: one generated case for every one of the 8,512 instruction words was 8 times slower in WebAssembly and 40% slower natively.
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
| Blue outline | Recently read. |
| Solid arc | An instruction wrote to that cell. |
| Dashed arc | A jump, or a new process from `SPL`. |
| Thin blue line | A compare (`SEQ`, `SNE`, `CMP`, `SLT`) looked at that cell, i.e. a scanner. |
| Small ring | A process died there. Big ring: a warrior died. |

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

### M1: engine parity

- Read/write limits, `-P` permutation, `'88` strict mode, each checked with `tools/pmars-diff.mjs`.
- A CI job that downloads and builds pMARS and runs `tools/pmars-diff.mjs`, so that every change is compared against pMARS.
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

- The sample warriors in `warriors/` are written for this repository, except Imp and Dwarf, which are the classic examples from Dewdney's 1984 article. Hill warriors are not included because their licenses are unclear. The UI loads them by drag and drop.
