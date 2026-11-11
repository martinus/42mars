---
paths:
  - "js/**"
  - "lib/**"
  - "test/**"
  - "tools/pmars-diff.mjs"
  - "tools/expr-fuzz.mjs"
  - "tools/tournament.mjs"
  - "docs/redcode-semantics.md"
---
# Engine rules

- pMARS 0.9.5 output is the truth, also where it contradicts the ICWS'94 draft. Find it by running `$O/bin/pmars`, never from its source (see "Clean room" in CLAUDE.md).
- Where pMARS has undefined behavior or does not terminate, pick a behavior, list it in section 4 of `docs/redcode-semantics.md`, and keep it out of the generators in `tools/pmars-diff.mjs` and `tools/expr-fuzz.mjs`.
- The assembler and the evaluator are `lib/src/asm.c`, used from JS through `assembleWasm` and `evaluateWasm`. `test/asm-c.test.js` checks digests of their results on random sources and expressions; a behavior change records them again (`ASM_C_RECORD=1`) and says why in the commit. Where pMARS has no defined result or takes very long, the assembler warns with a text that starts with `pMARS`; the tools skip those sources and the golden tests leave those warnings out.
- Pipeline: the evaluator (pMARS evaluation order, 64-bit overflow flags) feeds the assembler (text-level EQU, FOR/ROF, pass 2 statement parser) in `asm.c`; `assembleWasm` gives the warrior object that `mars.js` and `42mars.js` both load. Keep the assembler output format: the UI, the tests and the wasm loader read it.
- `mars.js` serves the visualizer. Its warrior fields, bookkeeping arrays and trace ring buffer are UI API (semantics doc, sections 3 to 3.6). With `headless: true` it must give exactly the same core, queues, events and scores.
- The `mars.js` loop is tuned for V8: one function, typed-array views into one shared buffer, a switch on the opcode byte, no closures or objects per step. `docs/performance-log.md` lists what was tried there; do not reintroduce rejected patterns without new numbers.
- Regression tests go through the public API (`assembleWasm`, `Mars`, `createWasmMars`) with small warriors. When the expected value comes from pMARS, say so in the test and how it was produced (command line).
- Run the `engine-check` skill before calling an engine change done.
