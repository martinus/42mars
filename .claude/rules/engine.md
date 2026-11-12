---
paths:
  - "tools/opcodes.js"
  - "lib/**"
  - "test/**"
  - "tools/pmars-diff.mjs"
  - "tools/expr-fuzz.mjs"
  - "tools/tournament.mjs"
  - "docs/redcode-semantics.md"
---
# Engine rules

- pMARS 0.9.5 output is the truth, also where it contradicts the ICWS'94 draft. Find it by running `$O/bin/pmars`, never from its source.
- Where pMARS has undefined behavior or does not terminate, pick a behavior, list it in section 4 of the semantics doc, make the assembler warn (`pMARS ...`) when it is an expression case, and keep it out of the generators of `tools/pmars-diff.mjs` and `tools/expr-fuzz.mjs`.
- The assembler output format (the warrior object of `assembleWasm`) is read by the UI, the tests and the wasm loader: keep it.
- The watch (semantics doc, 3.4 and 3.6) is UI API. With and without a watch the engine gives exactly the same core, queues and scores.
- Regression tests go through the public API (`assembleWasm`, `createWasmMars`, `lib/42mars.h`) with small warriors. When the expected value comes from pMARS, say so in the test and how it was produced.
- Run the `engine-check` skill before calling an engine change done.

## Recorded digests (`test/recorded.js`)

`test/asm-c.test.js`, `test/wasm.test.js` and `test/watch.test.js` compare digests of whole results with `test/fixtures/{asm-c,wasm,watch}.json`. They were recorded while the removed JavaScript assembler and simulator gave the same results; nothing in the repository can produce those references again, so treat a recording as an oracle.
- A digest that changes without an intended behavior change is a bug. Do not record again to make a test green.
- An intended change: first show it right against pMARS (`pmars-diff`, a pMARS-derived test), then `RECORD_FIXTURES=1 node --test test/<file>.test.js [--test-name-pattern=<test>]` (it merges into the fixture; other tests' recordings stay), and say in the commit what changed and why.
- Each test of these files seeds its own random generator from its name (the `test()` wrapper): a recorded test passes alone, and changing one test leaves the others' recordings. Keep it so in new tests; never draw from a generator shared by several tests.
- New random cases that need an oracle beyond pMARS: our JavaScript engine is in git (`git archive fe236bb js wasm | tar -x -C <scratch>`, import `js/mars.js` from there, scratch only). #78 checked its recordings that way: 15211 states and 5222 watches.
- The differential half needs no recording: an engine without a watch (specialized loops) against one with a watch (generic operand code), compared after every chunk (`test/engines.js`). It cannot see a change in `exec_core()`, which both share: only the digests and pMARS can.
