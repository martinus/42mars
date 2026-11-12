# Changelog

From 1.0.0 on, every change of the interface is listed here: the C library (`lib/42mars.h`), the command line program `42mars`, and the npm package `42mars` (`wasm/42mars.js`, `wasm/42mars.d.ts`). Within 1.x the interface changes only in a compatible way; `lib/42mars.h` names the two exceptions (the layout of `m42_cell`, the text of `m42_warrior_statement()`).

## 1.0.0 (not released yet)

The first release with that promise.

- **The C library**: a Redcode assembler and MARS simulator with the results of pMARS 0.9.5, instruction counts and final cores of every round included. One header, one file to compile, C11, no global state, no hidden allocation. Matches, benches, stepping with a watch for visualizers, p-space, `-P` permutations, read and write limits, ICWS'88.
- **`42mars`**: a command line program with pMARS 0.9.5's options, stdout and exit codes, built on the library.
- **The npm package `42mars`**: the library as a WebAssembly module with a JavaScript interface (`assemble`, `evaluate`, `createMars`, `createMarsSync`, `compileMars`), no dependencies, for Node 20 and newer and browsers.

## 0.9.0, 12th November 2026

A rehearsal of the release: the archives of the four native builds, the GitHub release and the npm publish ran for the first time. The interface is the one planned for 1.0.0, without the promise.
