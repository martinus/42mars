---
paths:
  - "evolver/**"
  - "docs/evolver.md"
  - "test/evolver*.test.js"
  - "test/evolver-common.js"
---
# Evolver rules

- A comparison needs several seeds per setting, and says how many: 8 runs with the same settings ended between 96.3 and 139.3 against the 1,107 '94nop Koenigstuhl warriors (16th November 2026). One run per setting says nothing below about 10 points. Start the arms from the same seeds or the same lists (`--start`).
- Score the same warriors at every look: the run's best.red and the 3 members best against the panel, each against the whole folder (`node tools/tournament.mjs warriors/koenigstuhl/94nop --rounds 100 --bench <file>`; `--islands` with `--select-after` does it itself). The holdout picks best.red and flatters it. An interim score of best.red alone said two arms had found nothing; their top three had (17th November 2026).
- Several runs with one panel: `--islands`, or pick once and pass `--panel-files`. A pick (`--panel-choice kinds`) takes a minute on 32 threads and an hour on one, in every process.
- `--batches 0` and `--seconds 0` mean no limit, not none: `--batches 1` for a run that should only set itself up.
- `--threads` changes the speed of a run, never its events. A run folder continues with `--threads`, `--batches`, `--seconds` and the few options its message names; an island folder with the first three only.
- A new option goes into: the `params` struct, `event_start`, `save_state` and `load_state` (at the end of the `params` line, with its default for older states), `params_error()`, the usage text, the table of `docs/evolver.md`, and `checkValues` of the test when it changes a value.
- Mutants of `evolver/*.c`: `node .claude/skills/engine-check/mutate.mjs <mutants.json> --timeout 600 -- <test command>`, the test command `node --test --test-name-pattern='<re>' test/evolver*.test.js` (or the one file of the test). The test builds `42evolve` from the tree (test/native.js, cached in `build/test/`); check that a mutant failed on an assertion, not on the build.
- Long runs: `nice -n 10`, started by a script in the scratchpad that logs into a file and goes on by itself (score, next leg). The run folders are `~/42evolve.<name>`; `node tools/serve.mjs --run ~/42evolve.<name> ...` shows them.
