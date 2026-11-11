---
name: engine-check
description: Correctness gate for any change to the assembler, expression evaluator or simulators (js/**, lib/**, wasm/**). Runs the tests, the differential runs against pMARS, the tournament comparison and the wasm rebuild check, and proves new tests by mutation. Use before calling an engine change done or keeping a speed change.
---
# Engine check

Setup: `O=${COREWAR_ORACLE:-$HOME/.local/share/corewar-theater}`, `SEED=$(date +%s)` (a fresh seed every time; report it).

1. Wasm build (if anything under `lib/` or the build script changed):
   `wasm/build.sh && md5sum wasm/42mars.wasm`, run it again, the sums must match. `git status` shows `42mars.wasm` modified exactly when its sources are.
   The native build too: `node tools/bench-native.mjs $O/corpus 10` must build and run. CI does not build it, and it was broken from #8 to #19.
2. Tests: `PMARS_VALIDATE=$O/validate.red npm test`. All pass, none skipped.
3. pMARS differential, each must end with no differences (exit code 0):
   ```sh
   D="node tools/pmars-diff.mjs --pmars $O/bin/pmars --corpus $O/corpus --seed $SEED"
   $D --pmars-trace $O/bin/pmars-trace              # mars.js with bookkeeping
   $D --pmars-trace $O/bin/pmars-trace --headless   # mars.js headless
   $D --pmars-trace $O/bin/pmars-trace --wasm       # wasm, round by round, core hash per round
   $D --wasm-match                                  # wasm runMatch with early ties, scores only
   ```
   Assembler-only change: `$D --only listings,exprs,sources` is enough. Use `--only battles,fuzz,multi` while iterating on the simulator and the full run at the end. `--scale 4` for a deeper run. Any difference is a bug in our engine unless the case is in section 4 of `docs/redcode-semantics.md`; reproduce it as a small test before fixing. A run without differences deletes its temporary folder; a run with differences keeps it and ends with `tmp files in <dir>`, which holds the generated warriors to reproduce them. `--tmp <dir>` is never deleted.
4. Expression evaluator changed: `node tools/expr-fuzz.mjs --eval $O/bin/evalh --seed $SEED`: no differences except the known ones in the error kind (section 4 of the semantics doc).
5. Tournament against pMARS, prints `SAME`:
   `node tools/tournament.mjs $O/sets/t20 --rounds 100 --seed $SEED --engine wasm --pmars $O/bin/pmars --compare`
   and the C library natively through `lib/42mars.h` (`lib/example.c`), also `SAME`:
   `node tools/example-check.mjs $O/sets/t20 --pmars $O/bin/pmars --seed $SEED`
   and the command line program (after a change to it, the assembler or the simulator):
   `make && node tools/pmars-diff.mjs --pmars $O/bin/pmars --corpus $O/corpus --seed $SEED --cli build/42mars --only cli` (0 differences)
6. Mutation proof for each new regression test: make the smallest change that brings the defect back, check that the mutant built (for C: rebuild, `md5sum` of `42mars.wasm` changed), see the test fail for the expected reason, restore, rebuild, check that `md5sum` is back to the original. No mutant may stay behind.
7. Docs: behavior change → `docs/redcode-semantics.md`; speed change → `docs/performance-log.md` (`perf-experiment` skill).

Report every command with its result line, the seed, each mutation with the observed failure, and every step skipped with the reason.
