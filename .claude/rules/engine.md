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
- The assembler and the evaluator exist twice, `js/assembler.js` + `js/expr.js` and the port `lib/src/asm.c` (functions with the same names, in the same order). A behavior change goes into both, and `test/asm-c.test.js` compares the whole result objects; the JS pair goes once the tools and the UI assemble through wasm (`PLAN.md`, L2).
- Pipeline: `expr.js` (pMARS evaluation order, 64-bit overflow flags) feeds `assembler.js` (text-level EQU, FOR/ROF, pass 2 statement parser), which emits code that `mars.js` and `42mars.js` both load. Keep the assembler output format: the UI, the tests and the wasm loader read it.
- `mars.js` serves the visualizer. Its warrior fields, bookkeeping arrays and trace ring buffer are UI API (semantics doc, sections 3 to 3.6). With `headless: true` it must give exactly the same core, queues, events and scores.
- The `mars.js` loop is tuned for V8: one function, typed-array views into one shared buffer, a switch on the opcode byte, no closures or objects per step. `docs/performance-log.md` lists what was tried there; do not reintroduce rejected patterns without new numbers.
- Regression tests go through the public API (`assemble`, `Mars`, `createWasmMars`) with small warriors. When the expected value comes from pMARS, say so in the test and how it was produced (command line).
- Run the `engine-check` skill before calling an engine change done.
