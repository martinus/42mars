# Core War Theater: plan

Core War Theater is a browser visualizer for [Core War](https://corewar.co.uk/) battles. It has its own Redcode assembler and MARS simulator, which reproduce pMARS 0.9.x behavior so that warriors assemble and fight like on the hills. Everything is MIT licensed. The prototype in this repository runs today:

- 565 of 567 hill warriors from [n1LS/redcode-warriors](https://github.com/n1LS/redcode-warriors) assemble. The 2 failures are real syntax errors (`fail.red` is broken on purpose, `stone.red` has `dat #0 #0` without a comma, which pMARS rejects too).
- pMARS's own `validate.red` self-ties for all 80,000 cycles, which it only does on a MARS with ICWS'88 semantics and in-register evaluation.
- 207 tests, `npm test`: 60 hand-written ones plus 147 reference tests that pin 4031 expressions and 146 small sources to exact results (`test/fixtures/`).
- Roughly 24M instructions/s in a single thread (`node tools/bench.mjs`, 3 hill pairs, 20 rounds each, Node 22.22, Ryzen 9 7950X). The run is short, about 95 ms, so take the number as a rough figure.

What is still missing is a differential test against a real pMARS binary, see [Validation](#validation).

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
| `src/engine/expr.js` | Expression evaluator. 64-bit integers, registers `a`..`z`, precedence climbing with the pMARS `==` quirk. |
| `src/engine/assembler.js` | `readSource` splits lines and reads `;name`, `;assert` etc., `Expander` does pass 1 (labels, `EQU`, `FOR`/`ROF`, asserts), `StatementParser` does pass 2 (operands, modes, modifiers, values). |
| `src/engine/mars.js` | Simulator. One allocation-free loop in `execute()`, modifiers as a small bit mask, events buffered in an `Int32Array`. |
| `src/engine/opcodes.js` | Opcode tables, formatting, pMARS-style listing. |
| `src/ui/*` | Visualizer. No dependencies, no build step, plain ES modules. |
| `docs/redcode-semantics.md` | The behavior the engine implements, in prose. |
| `tools/asm.mjs` | `node tools/asm.mjs file.red` prints a pMARS-style listing or the errors. |
| `tools/corpus.mjs` | Assembles every `.red` file below a directory and lists the failures. |
| `tools/bench.mjs` | Simulator speed. |
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

The agent was stopped before it wrote its final report, so there is no explicit statement from it that it kept to the isolation rules. The code structure is independent of pMARS (classes `Expander`, `StatementParser`, one `execute()` loop with modifier bit masks, none of the pMARS function names). The trace tests were written afterwards in this session. Commit `8966a45` still contains the GPL port in the history.

## Validation

Done:

1. Hand-written tests: assembler (35), simulator (17), trace buffer (8). Each of 6 semantic mutations of the simulator and expression evaluator (in-memory `MOV.I`, swapped `SPL` queue order, immediate B operand from the instruction register, missing cycle decrement after a death, the `==` quirk, absolute labels) and 5 mutations of the trace bits made at least one test fail.
2. Reference tests: `test/golden.test.js` with the expressions and sources from `test/fixtures/`.
3. Corpus check: `node tools/corpus.mjs <dir>`, 565/567.
4. `validate.red` from the pMARS distribution. It is GPL and not in this repository, the test runs when `PMARS_VALIDATE` points to it.

Missing, and the most important next step: a differential test against a real pMARS build. So far pMARS behavior is only covered by the tests above, the reference outputs of the first engine and `validate.red`. The plan:

1. Build pMARS with `-DSERVER -DEXT94 -DPERMUTATE -DRWLIMIT`, no display. Running it as a test oracle has no license effect on this repository.
2. For every corpus warrior, compare the instruction list and start offset against the pMARS listing (`tools/asm.mjs` prints the same layout as pMARS).
3. For a few hundred warrior pairs, run `pmars -r 20 -F <pos>` and compare wins, losses and ties per round at the same positions. Same seed means same positions, so the scores have to match exactly, not statistically.
4. Add the differences as tests, then fix them.

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

- Differential test against pMARS, see above. Fix every difference.
- Read/write limits, `-P` permutation, `'88` strict mode.
- Move the simulator into a Web Worker so that max speed does not cost frame time.

### M2: see more

- Time scrubbing: snapshot the core every N cycles and re-run deterministically to any cycle. Then the timeline becomes a seek bar, and you can replay the moment a warrior died.
- Process lineage: show which `SPL` created which process, so replicators show their family tree.
- Zoom and pan in the grid layout, so the instruction text is readable on an 8000-cell core too.
- Address ticks around the ring, and a camera that follows one warrior.
- Auto slow motion around deaths.
- Guided tours: a scripted walk through e.g. Dwarf vs Imp on the nano core, step by step, with the explanation boxes as chapters.

### M3: theater

- Tournament mode: round robin over a folder of warriors, result matrix, and click a cell to watch that pairing.
- Shareable links with the warriors encoded in the URL.
- Video export of the canvas with `MediaRecorder`.
- Import of hill and benchmark sets.

### M4: polish

- Color-blind safe palette option, reduced motion option, better phone layout.

## Open decisions

- Whether to build and run pMARS locally for the differential test.
- Whether to squash the history before the first push, so that the GPL port in commit `8966a45` is not part of the published history. It is licensed GPL there, which is legal, but a squash makes the repository uniformly MIT.
- The sample warriors in `warriors/` are written for this repository, except Imp and Dwarf, which are the classic examples from Dewdney's 1984 article. Hill warriors are not included because their licenses are unclear. The UI loads them by drag and drop.
