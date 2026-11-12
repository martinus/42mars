---
name: engine-check
description: Correctness gate for any change to the assembler, the expression evaluator, the simulator or the watch (lib/**, wasm/**). Runs the tests, the differential runs against pMARS, the tournament and C library comparisons, the wasm rebuild and hot-loop checks, and proves new tests by mutation. Use before calling an engine change done or keeping a speed change.
---
# Engine check

Setup: `O=${COREWAR_ORACLE:-$HOME/.local/share/corewar-theater}`, `SEED=$(date +%s)` (fresh every time; report it). Steps 2 to 5 take about 3 minutes: run them as one background script with a sentinel (CLAUDE.md, "Running long checks").

1. Builds (anything under `lib/` or the build script changed):
   - `wasm/build.sh && md5sum wasm/42mars.wasm` twice: the sums match. `git status` shows `42mars.wasm` modified exactly when its sources are.
   - `node tools/bench-native.mjs $O/corpus 10` builds and runs (CI does not build it; it was broken from #8 to #19).
   - `lib/src/mars.c` or `api.c` changed: the hot loops are unchanged unless that was the point (`.claude/rules/wasm.md`, "Keep the hot loops byte-identical"), in wasm and natively.
2. `PMARS_VALIDATE=$O/validate.red npm test`: all pass, none skipped. A recorded digest that changed: `.claude/rules/engine.md`, "Recorded digests"; never record again just to get green.
3. pMARS differential, each ends with no differences (exit code 0):
   ```sh
   D="node tools/pmars-diff.mjs --pmars $O/bin/pmars --corpus $O/corpus --seed $SEED"
   $D --pmars-trace $O/bin/pmars-trace              # all sections, core hash per round
   $D --pmars-trace $O/bin/pmars-trace --watch --only battles,fuzz,multi   # the watched loop
   $D --wasm-match                                  # runMatch with early ties, scores only
   ```
   Options under test: `--permute`, `--icws88`. Assembler-only change: `$D --only listings,exprs,sources`. While iterating on the simulator: `--only battles,fuzz,multi`; the full run at the end; `--scale 4` deeper. A difference is a bug in our engine unless its case is in section 4 of the semantics doc: reproduce it as a small test first. A run with differences keeps its temporary folder (`tmp files in <dir>`) with the warriors to reproduce them.
4. Expression evaluator changed: `node tools/expr-fuzz.mjs --eval $O/bin/evalh --seed $SEED`: no differences except the known ones in the error kind (semantics doc, section 4).
5. Against pMARS on whole matches, each prints `SAME` or 0 differences:
   - `node tools/tournament.mjs $O/sets/t20 --rounds 100 --seed $SEED --pmars $O/bin/pmars --compare` (with `--read-limit`/`--write-limit`, `--permute` or `--icws88` when those changed)
   - the C library natively: `node tools/example-check.mjs $O/sets/t20 --pmars $O/bin/pmars --seed $SEED`
   - the command line program (it, the assembler or the simulator changed): `make && node tools/pmars-diff.mjs --pmars $O/bin/pmars --corpus $O/corpus --seed $SEED --cli build/42mars --only cli`
   - C portability: `make test`, `make clean && make CFLAGS='-O2 -std=c11 -pedantic -Wall -Wextra -Werror -DM42_PORTABLE' test`; after pointer or memory changes also `make clean && make CFLAGS='-O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all' test`.
6. The watch or the glue changed: the `ui-check` skill (`compare.mjs` against main).
7. Mutation proof for each new test: the smallest change that brings the defect back; for C rebuild and check that `md5sum` of `42mars.wasm` changed; see the test fail for the expected reason; restore, rebuild, `md5sum` back to the original. Script it (copy the file, apply, rebuild, run, restore) when there are several. A mutant whose test stays green: does the test reach the code, and does its fixture tell right from wrong (a paused UI snapshot does not show heat decay, a change in `exec_core()` passes the engine-against-engine comparison).
8. Docs: behavior change → semantics doc; speed change → `docs/performance-log.md` (`perf-experiment`); test count → `PLAN.md`, `README.md`.

Report every command with its result line, the seed, each mutation with the observed failure, and every step skipped with the reason.
