# Changelog

From 1.0.0 on, every change of the interface is listed here: the C library (`lib/42mars.h`), and the command line program `42mars`. Within 1.x they change only in a compatible way; `lib/42mars.h` names the two exceptions (the layout of `m42_cell`, the text of `m42_warrior_statement()`).

## Unreleased

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
