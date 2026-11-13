---
paths:
  - "lib/**"
  - "wasm/**"
  - "bench/**"
  - "docs/performance-log.md"
---
# Library and WebAssembly rules

## Build

- Build only with `wasm/build.sh` (clang 22, `--target=wasm32 -Os -nostdlib`, no emscripten, libc or imports). It regenerates `dispatch.h` from `HOT` in `lib/src/gen-dispatch.mjs` first; both outputs are committed, and two builds must give the same `md5sum`. Commit `42mars.wasm` with the C change it was built from.
- `mars.c` also builds natively (`bench/bench-native.mjs`, `bench/tie-ceiling.c` with `-DTRACE_TIES`, which stays out of the wasm build). Keep both building when you change an internal signature (`run_some()` gained an argument in #78 and `tie-ceiling.c` had to follow).
- No libc, no compiler-rt in wasm: clang turned a string-length loop into `strlen` and a 64-bit overflow multiply into `__multi3`, both undefined at link time (`no_builtin`, an empty `asm` barrier, see `umulh()`). The C stack is 64 KB below the data: recursion needs a limit. Pass 1's FOR recursion takes 592 bytes per level (#119); 107 levels fit, the 100 of `MAX_FOR_DEPTH` must (test "FOR blocks nest 100 deep in C"). It overflowed twice: an out parameter added to `operand_text()` made the frame 640 (#116), and a second call of `statement_line()` in `process_lines()` stopped its inlining, two frames of 208 and 464 (#119). Return a flag instead of taking a local's address, keep one call site per function on that path, and put a helper with struct locals, even a message built with `msg3()`, into an `M42_NOINLINE` function (`rest_ok()`, `skip_split()`, `undefined_warning()`): a message inlined into `opcode_line()` made it 704. Check every function on the cycle: `llvm-objdump -d` gives the frame as the constant subtracted from `global 0`. An exception inside wasm leaves the C stack pointer behind, so the glue drops the assembler's instance after one (#54).

## The loops

- `step()` switches on the 14-bit instruction word: the 32 hottest words call `exec_ins()` with a constant word, the rest run it generically. MSVC compiles only the first 16 (`M42_DISPATCH_16` in `platform.h`; `gen-dispatch.mjs` writes the guard): with 32, `cl /O2` took 2 minutes for the loops of `execute2()`. Operands in `exec_ins()`, the instruction in `exec_core()`.
- Hot loops: `execute` (any number of warriors), `execute2` (two warriors, pairs of turns, one head for both queues, tails in locals) as `execute2_8000` (core and process limit 8000 as constants) and `execute2_any`.
- `execute_limited` (read/write limits) and `execute_watched` (a watch attached, #74) run `exec_ins_rw()`, the generic operand code with folding; `fold()` returns early for a limit equal to the core size. `run_some(m, count, watched)` picks the loop; only `m42_run()` passes `watched`, `run_match()` passes 0.
- `trace_flags()` repeats `exec_core()`'s step-4 decisions for the watch (exec_core reports nothing, so the hot loops stay untouched): change both together; `test/watch.test.js` checks the flags against the queues.
- Keep anything else out of the hot loops: a branch on a flag that was a constant 0 there still changed clang -O3's native code of all three (#40).
- Linear queues for two warriors with `maxCycles` up to 80000 (`config()`): each tail stays at most `2 + 2 * (maxCycles + 1)`. Anything that lets a round run longer or a turn push more breaks that bound (test "full queues at the linear queue limit and above"). `execute2` needs both heads equal whenever warrior 0 moves: `start_round()` starts warrior 0's queue at 1 when warrior 1 moves first, and every path out of `execute2` must leave them so.
- `runMatch({ firstRound })` plays a block with empty p-space; blocks equal the whole match without `LDP` or with `pspace` carried (#48). Anything new that carries state from round to round breaks the split unless `pspace` carries it.
- Early ties (process-count proof, no-killer scan, at most 4096 instructions apart) are exact: same scores and round results. A new early exit needs its proof in the semantics doc, 3.7, and first a measured ceiling (`bench/tie-ceiling.mjs`, #27).

## Keep the hot loops byte-identical

A change outside the loops must leave `execute`, `execute2_8000` and `execute2_any` byte-identical, call indices aside; data addresses moved by 64 or 128 were measured neutral twice but are avoidable. Check:
- wasm: `git show origin/main:wasm/42mars.wasm > base.wasm; node bench/wasm-functions.mjs base.wasm wasm/42mars.wasm`. Its last line names the three loops, matched by size (a new function in front moves their index): "same" or "call operands only" passes. For "differs", `llvm-objdump -d --no-show-raw-insn` both and diff those three; constants that all moved by +64 are data addresses: the data section grew in front of the core.
- native: `node bench/native-loops.mjs [ref]` compiles `lib/42mars.c` of the ref (default origin/main) and of the worktree with clang and gcc `-O3 -march=native`, each with and without `-DM42_FIXED_CONTEXT`, and compares the three functions with addresses masked.

What moves them, and the fixes that worked:
- clang emits a static function in the order it is first referenced while emitting, not where it is defined. New code goes behind the loops in `mars.c` and is referenced after them in `run_some()`: called from `m42_run()` directly, `execute_watched()` came in front of the loops and pulled `warrior_died()` along (#74); a wrapper function one level down did not help. A growing function can stop being inlined and appear as a new one (#41). A small `M42_FORCE_INLINE` helper called from existing functions adds none.
- New exports (`EXPORT()` in `api.c`) come before `warrior_died()`: its call index moves by one per export. Accepted.
- Data: the core and the queues lie behind `theMars` (64-byte aligned) in wasm, so `sizeof(Mars)` stays at most 192 (`_Static_assert` in `mars.c`): 200 moved them by 64. New fields go to the end of `Mars`; to make room, a flag can move into padding before the loop fields (#74 put `loaded` behind `roundOver`). Read-only data (strings, constants) in front of `theMars` moves the loops' field addresses when it crosses a multiple of 64 (#41, #73). In #119 less than 16 bytes were left before the next multiple: one new message of 15 bytes moved them by 64. Build new assembler messages from literals that exist (`msg3()`, e.g. `"pMARS has no defined result for '"`), and check the data section size (`llvm-objdump -h`).
- `api.c` turns every handle into `CTX` with `M42_FIXED_CONTEXT` (a handle, even `m ? CTX : 0`, stops clang from propagating the address into the loops); the core and queue arrays are `used` with an initializer so their order does not depend on which export uses them first (#55).

## State and memory

- All state is in `struct Mars` (an `m42_ctx`); every function takes `Mars *const m`. New state goes into the struct, never into a static. The wasm build and the native profiling tools use `-DM42_FIXED_CONTEXT`: one context `theMars`, core and two queues as separate static arrays (`CORE(m)`, `QUEUES(m)`; inside the struct t20 was 1.4% slower, #53). The native library keeps the context in caller memory, 1 to 3% slower.
- The module exports the functions of `lib/42mars.h` only (`EXPORT()`), plus `memory` and `__heap_base`. `wasm/42mars.js` gives the library all its memory through its `Memory` class:
  - `keep()` for the life of the instance (context heap, watch), `scratch()` per call. Every public method that uses scratch calls `mem.reset()` first, or each call takes new memory (`processes()` and `score` did, until #78).
  - The memory grows only in `Memory.ensure()` (the C code never grows it), so `views()` renews its `u8`/`dv` views only after `ensure()` grew it.
- A struct the glue reads or writes (`m42_rules`, `m42_match_options`, `m42_state`, `m42_warrior_state`, `m42_instruction`, `m42_watch`) has its wasm32 offsets in the glue's comments and a `_Static_assert` in `api.c`: change both together. The getters take the struct's size (`STATE_SIZE`, `WARRIOR_STATE_SIZE` in the glue); a field added at the end needs the new size there too.
