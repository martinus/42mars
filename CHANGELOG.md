# Changelog

From 1.0.0 on, every change of the interface is listed here: the C library (`lib/42mars.h`), and the command line program `42mars`. Within 1.x they change only in a compatible way; `lib/42mars.h` names the two exceptions (the layout of `m42_cell`, the text of `m42_warrior_statement()`).

## Unreleased

- `42evolve` (`make` builds it, POSIX threads): an evolver on the library, with a list kept by diversity push-off, a dashboard (`ui/evolver.html`, `tools/serve.mjs --run`) and resumable runs ([`docs/evolver.md`](docs/evolver.md), #142). New, and not under the 1.x promise yet: its options and its files may change.
- `42evolve` without the options that lost or changed nothing (#193): `--map-elites`, `--specialists`, `--niche`, `--sharing`, `--simple`, `--noise`, `--difference`, `--select`, `--rotate`, `--race`, `--race-keep`, `--tune-novel`, `--fractions`, `--prior`, `--refactor`, `--leaf-restart`, `--nemesis-every`, `--migrate-to next` and `tree`, `--pushoff pareto-age` and the change `loop`. They are refused with a message, as is a run folder that used one; the events of a run without them are the same as before, but for the fields of those options in its first event. `tools/diversity.js` lost the noise and difference arguments of `sdDistance()` and `pushoffValues()`, `standardError()` and `weightedMedian()`.
- `42evolve --changes random-loop=<weight>`: a loop of 2 to 5 new instructions in one step, weight 0 by default (#201). `42spectrum --changes name,...` plays only those kinds of change.
- `42evolve --changes shared-target=<weight>`: a far value set to point at the cell another far value points at, weight 0 by default; `42evolve --parsimony`: of a newcomer and a member with the same results the longer one leaves, off by default; the event `leave` names the twin that stays (#172).
- `42evolve --no-spl`: no warrior of the run has `SPL`; a change that would make one is drawn again, a start warrior with one is left out, and as an `--island-variant` such an island takes migrants only from islands with it. Off by default; the start event has `noSpl` (#185).
- `42evolve --survivors-by pushoff`: the survivors of the screen by their estimated place in the pareto push-off instead of their screen score; the start event has `survivorsBy`, the event `enter` with it `pick`. Off by default.
- `42evolve --replace-parent`: a newcomer whose nearest warrior is its first parent duels it, the one with the lower average against the panel leaves; the start event has `replaceParent`, the event `leave` of a duel `duel`, the winner. Off by default.
- `42evolve --member-games none` goes with `--pushoff pareto-sd`, on the average against the panel and the SD-score, and a new run with it takes pareto-sd by default (value before); `--pushoff pareto` with it is refused.
- `42evolve --islands N --start <dir>`: island NN starts from `<dir>/island-NN` when that folder exists, the others from `<dir>`, so that a run of islands can start from the lists of another one; the start event of each island names its folder.
- `42evolve --islands N --groups K [--group-every E] [--group-slots S] [--group-hall H]`: islands in K groups that evolve against each other; the last panel slots of every island hold the best members of the other groups and foes from a hall of fame, migrants stay in their group; event `rotate` for every foe that comes in (#183).
- `tools/pushoff.mjs` ranks a tournament by diversity push-off.
- The evolver's dashboard has a tab Designs: the designs of a run of islands at its last score, against each kind of hill warrior, two side by side with their best-of bound; `tools/serve.mjs` serves `/run/<n>/scores` for it, `tools/designs.js` computes it (#222).
- `tools/hill-kinds.mjs`: the kind of style of every warrior of a hill folder, cached by content hash, and a bench of `tools/tournament.mjs --json` by those kinds (#221).
- `42evolve --score-designs D` (3 by default): the score of `--islands` also plays the best member of every design (family and kind of style) with D members or more, and the event `score` has each warrior's name, code, and points and wins per opponent (#220).
- `tools/run-report.mjs`: the status of `42evolve` runs in one command, from their folders: the islands' scores, the designs on top, new designs, the line of best.red, several runs side by side; `--bench` scores the best of each island against a folder (#195).
- The visualizer plays a match given in `#battle=` (warriors, rules, seed, rounds), the evolver's battle view.
- The JavaScript demo, the tests and the tools state the Node version they need: 20.16 or newer, 22.3 or newer on Node 22 (`package.json`, #198). Without a compiled module, `assemble()` and `createMarsSync()` read `42mars.wasm` with `process.getBuiltinModule()`, which older versions lack; there, `await compileMars()` first makes them work (checked on 20.11).

## 1.1.0, 14th November 2026

- The simulator is faster, with the same results: natively 46 to 70% on '94 hills and 9 to 14% on '88-style warriors with gcc, 32 to 58% and 6 to 14% with clang. 512 instruction words have code of their own instead of 32 ([`docs/performance.md`](docs/performance.md)). The price: gcc compiles the library in 7.8 s instead of 2.6 s, and `42mars.wasm` has 295 KB instead of 103 KB. With MSVC, which keeps 16 words, a '94 hill is 4 to 5% faster and an '88 hill 6 to 8% slower than with 1.0.0.
- `m42_cell` has layout 2 (`M42_CELL_LAYOUT`): its fourth field, `pad` and always 0 until now, is `hot`, the number of the code the engine runs for the cell's instruction word. `m42_cells()` and everything else give the same as before.
- `m42_warrior_uses_pspace()`: 1 when a warrior has `LDP` or `STP`, so a caller knows when a match can be split into blocks of rounds on several threads (#136). `examples/parallel.c` shows that.

## 1.0.0, 13th November 2026

The first release with that promise.

- **The C library**: a Redcode assembler and MARS simulator with the results of pMARS 0.9.5, instruction counts and final cores of every round included. One header, one file to compile, C11, no global state, no hidden allocation. Matches, benches, stepping with a watch for visualizers, p-space, `-P` permutations, read and write limits, ICWS'88.
- **`42mars`**: a command line program with pMARS 0.9.5's options, stdout and exit codes, built on the library.
- **A JavaScript demo** (`wasm/`): the library as a WebAssembly module with a JavaScript interface (`assemble`, `evaluate`, `createMars`, `createMarsSync`, `compileMars`), no dependencies, for Node 20 and newer and browsers. Not on npm, and not covered by the promise: it may change in any release (such changes are listed here too).

Changes since 0.9.0:

- The assembler gives pMARS's result for more sources, so some assemble differently: labels after an EQU opcode at the statement start (#116), `FOR` and `ROF` from an EQU (#118), a multi-line EQU in an operand (#119), and an opcode in an assert is an error, as in pMARS.
- With as many warriors as core cells or more, the last result of a round (p-space cell 0) is the number of survivors modulo the core size (#131). It was the number itself, and an `LDP` of it made the engine address outside the core.

## 0.9.0, 12th November 2026

A rehearsal of the release: the archives of the four native builds, the GitHub release and the npm publish ran for the first time. The interface is the one planned for 1.0.0, without the promise.
