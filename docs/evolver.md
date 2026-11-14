# 42evolve, the evolver

`42evolve` evolves Redcode warriors on top of the 42mars library, with a dashboard that shows the run live and opens any match in the visualizer. The plan and its reasons are in [#142](https://github.com/martinus/42mars/issues/142). This page says how to run it, how it works and what came out so far.

## Run it

```sh
make                                                   # builds build/42evolve, POSIX threads (Linux, macOS)
build/42evolve runs/a --opponents warriors/koenigstuhl/94nop --seconds 3600
node tools/serve.mjs --run runs/a                      # then http://127.0.0.1:8000/ui/evolver.html
```

Ctrl-C ends the run after the current batch. `build/42evolve runs/a` continues it, also with another `--threads`, `--batches` or `--seconds`; other options are refused for a folder that has a run. The same seed gives the same run for any number of threads, and a continued run is the same as one that never stopped (`test/evolver.test.js` checks both).

| Option | Default | |
|---|---|---|
| `--opponents <dir>` | | hill warriors; those that fit the rules are shuffled with the seed into the panel and the holdout |
| `--panel N`, `--holdout N` | 40, 100 | warriors the evolved ones play all the time; warriors only the benchmark plays |
| `--list N` | 20 | evolved warriors kept |
| `--batch N`, `--survivors N` | 4 per thread, batch / 8 | candidates per batch; most of them that get past the screen |
| `--rounds N`, `--screen-rounds N` | 100, 20 | rounds per match; the first of them are the screen |
| `--screen-factor x` | 0.8 | a candidate needs this share of the weakest member's panel average after the screen |
| `--alpha x`, `--sd opponent\|sum` | 1, opponent | push-off value = average * distance^alpha; the reading of the SD-score |
| `--reintroduce p` | 0.02 | chance that a candidate is a warrior that was pushed off earlier |
| `--bench-every N`, `--bench-rounds N` | 10, 100 | the best member against the panel plays the holdout every N batches |
| `--init-length N` | 10 | the longest random warrior of the start |
| `--size --cycles --processes --length --distance` | pMARS's | the rules, e.g. `--size 800 --cycles 8000 --processes 800 --length 20 --distance 20` for the tiny hill |
| `--seed N`, `--threads N`, `--batches N`, `--seconds S` | 1, all | |

The run folder gets `events.jsonl` (everything that happened, one JSON object per line), `state.txt` (to continue) and `best.red` (the best warrior against the holdout so far).

## How it works

**The list.** Like YACE: a list of 20 evolved warriors, and each newcomer plays the whole list. The list is kept by the diversity push-off of [Tournament Weekend 2026](https://corewar.co.uk/tournamentweekend2026a.htm): each warrior's value is its average score times the lowest SD-score between its row of scores and the row of any other warrior; when the list has 21, the lowest value leaves. A close clone of a strong warrior has a distance near 0 and goes first, so the rule keeps the list diverse. The math is [`tools/diversity.js`](../tools/diversity.js) and [`evolver/pushoff.c`](../evolver/pushoff.c), the same operations in the same order; [`tools/pushoff.mjs`](../tools/pushoff.mjs) ranks a whole tournament that way. The SD-score is from [Ismael 2025](https://doi.org/10.1186/s40537-025-01091-z), whose Eq. 6 (`--sd sum`: sum of differences over sum of standard deviations, the order of plain Manhattan distance) and pseudocode (`--sd opponent`: each column divided by its own standard deviation) differ.

**The matrix.** Rows and columns are the panel (40 hill warriors that never leave) and the members. So a warrior's row is its score against the panel and the other members, and the distance to the nearest panel warrior counts too: copying a hill warrior does not pay either.

**A batch.** 4 candidates per thread are bred from the list (tournament of two on the push-off value). The screen plays each against the panel for 20 rounds. Those with at least 0.8 of the weakest member's panel average, at most batch / 8 of them, play the remaining 80 rounds against the panel and 100 rounds against every member and every survivor before them. Then they enter one by one, each followed by the push-off. Candidates whose warrior is one of the last 16,384 that were tried are skipped. Every match uses the seed of its opponent, so all candidates meet an opponent at the same positions and differ by their code, not by their luck.

**The genome.** [`evolver/genome.c`](../evolver/genome.c): a list of instructions whose operands are typed, a reference to an instruction of the genome or a value. A reference becomes a relative offset only when the genome becomes a warrior, so inserting, deleting or moving instructions keeps what it points at; with raw offsets every insertion breaks the references that cross it. Changes: a field of one instruction (opcode, modifier, mode, operand, start, the whole instruction), insert new instructions, delete, duplicate or move a block, and crossover, a block of another member inserted or put over a block. A copied block keeps its references inside the block; references out of it go to the original (duplicate) or become plain offsets (crossover). No strategy is built in: no qscan, paper or stone templates.

**Names.** Each warrior that enters gets a name of its own adjective and its family's noun, which it takes from its first parent: a child of "Crimson Mantis" may be "Sneaky Mantis", a warrior bred from nothing starts a new family. A name given before gets a Roman numeral ("Sneaky Mantis II"), so names are unique in a run. 128 adjectives and 128 nouns ([`evolver/names.c`](../evolver/names.c)); the dashboard colors a family alike too. The number of a warrior (`id`) stays the key in the events.

**All cores.** One thread per hardware thread, each with its own `m42_ctx`, takes matches from one shared queue; the main thread plays too. A match is one pair and one block of rounds, at most 100 rounds, so the queue has no long tail at the end of a phase. On the run below, 16 threads were 97.7% busy over 600 s, measured as time inside `m42_match()` over threads times wall time. The plan in #142 had batches bred one batch behind so that no thread waits at the end of a batch; with matches this small that was not needed.

**What it does not have yet.** An LLM as mutation operator, islands, an opponent ladder (the panel is a random sample of the folder, weak and strong warriors), MSVC (it needs POSIX threads and `dirent.h`).

## The dashboard

[`ui/evolver.html`](../ui/evolver.html), on the events of a run: live through `node tools/serve.mjs --run <folder>`, or `?log=<url of an events.jsonl>`, or an `events.jsonl` dropped on the page.

- **Score matrix**: the members by push-off value, against each other and the panel, points per 100 rounds. A newcomer slides in from below and glows, a member that leaves fades out. A click on a cell opens that match in the visualizer.
- **Novelty map**: classical multidimensional scaling of the rows against the panel, with the SD-score as distance. Grey points are the hill warriors, colored ones the members (a family shares a color), faint ones members that left. A newcomer flares up.
- **Lineage**: every warrior that entered, by its batch and its score against the panel, with lines to its parents; the selected warrior's ancestors in yellow.
- **Progress**: the best and mean member against the panel, and the best against the holdout, over the batches.
- **★ best** in the header is the best warrior against the holdout warriors so far, also after the push-off removed it from the list (the same warrior as `best.red`); **strongest now** is the member with the highest average against the panel. A click opens the card. The best one has a ★ in the matrix and on the map.
- A click on a warrior opens its card: code, scores, parents, nearest warrior, its result against each panel warrior, and every match with a **watch** button.

**Watch** opens `ui/index.html#battle=...`, which carries both warriors, the rules, the seed and the rounds. It starts in the grid layout at learn speed, every step explained (`?layout=ring` and `?speed=` before the `#` still win). The visualizer plays the same rounds as the evolver did: the WebAssembly build gives the same results as the native one, and stepping a match round by round with a watch gives the same rounds as `m42_match()`. `test/evolver.test.js` replays logged matches in the WebAssembly engine.

## First run

10 minutes on '94nop, all defaults, `--threads 16` on an AMD Ryzen 9 7950X (16 cores, 32 threads), gcc 16.2.1 `-O3`, 14th November 2026:

| | |
|---|---|
| batches | 212 |
| candidates evaluated | 12,870 (21 per second) |
| warriors that entered the list | 554 |
| rounds played | 19,860,000 |
| instructions per second | 2.90 billion (16 threads) |
| threads busy | 97.7% |
| best member against the panel | 120.0 points per 100 rounds |
| median panel warrior against the panel | 147.2 (best 185.4, worst 26.6) |
| best member against the 100 holdout warriors | 93.1, after batch 179 (49.5 after batch 9) |

The best evolved warrior is still below the median hill warrior after 10 minutes, and it still climbs. A round took 87,600 instructions on average.
