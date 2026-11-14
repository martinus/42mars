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
| `--select screen\|value` | screen | what the survivors of the screen are picked by: the screen score, or the estimated push-off value (screen score times the SD-score to the nearest warrior in, on the panel columns, to the power alpha) |
| `--parents value\|duel` | value | the tournament of two that picks a parent: the higher push-off value, or the one with more points in their match against each other (a draw by value) |
| `--prior uniform\|hill` | uniform | how opcodes, modifiers and modes of new instructions and point changes are drawn: uniform, or as often as they occur in all warriors of `--opponents` (plus 1 each, so none is impossible) |
| `--race N`, `--race-keep K` | 0, batch / 4 | the screen in two stages: every candidate plays the first N screen rounds, only the best K by the key the rest |
| `--fractions p` | 0 | chance that a new far value (any value of the core otherwise) is 1/2, 1/3, 2/3, 1/4 or 3/4 of the core give or take 20 |
| `--rotate N` | 0 | every N batches the oldest panel warrior makes room for the next warrior of the folder that is neither in the panel nor in the holdout; it plays everyone in once |
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

**Two answers to the long run below.** `--select value` picks the survivors of the screen by an estimate of their push-off value instead of their strength: the screen gives a candidate's row against the panel, so its SD-score to every warrior in can be computed on the panel columns. Every newcomer logs its `estimate` and its `screenPoints`, also with `--select screen`. `--rotate N` replaces the oldest panel warrior every N batches with the next one of the folder (those that leave go to the end of that queue), so the list cannot tune itself to 40 fixed opponents; the event `rotate` has the new warrior and its matches. Whether they help is E5: measured against the holdout at equal time. `--fractions p` comes from YACE (2000, GPL): half of its numbers are a small value plus 1/2, 1/3 or 1/4 of the core, the distances of bombers and replicators, which a uniform far value almost never hits. Its source was read by a separate agent that wrote down the ideas in prose; nobody who writes 42evolve read it. YACE has no crossover, no references that survive insertions and no start that changes; its other ideas (a hill with a spare slot and a cached score matrix, a cheap screen before a precise test, champions brought back, replacement of a similar member) are here in some form already. Not taken yet: a test against a one-line `spl 0` before the screen, which throws out warriors that die at once. `--race N` makes the screen cheaper: on the tiny hill (batches 2 to 9 of 10, batch 128), `--race 4` played 1,082,400 instead of 1,548,000 rounds and 10.1 instead of 12.3 million instructions per candidate, 18% less. The survivors' full matches cost more than the screen, so it pays most together with fewer survivors.

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
| median panel warrior against the panel | 151.0 (best 190.2, worst 27.3) |
| best member against the 100 holdout warriors | 93.1, after batch 179 (49.5 after batch 9) |

The best evolved warrior is still below the median hill warrior after 10 minutes, and it still climbs. A round took 87,600 instructions on average. (The hill warriors' numbers were 147.2, 185.4 and 26.6 in the log of that run: until #144 a panel warrior's average counted its own empty column as 0.)

## What a longer run shows

All defaults, 32 threads, the same machine, after 144 batches (21.6 minutes, 17,153 candidates evaluated), 14th November 2026:

- **The list stops improving.** Its best against the panel went 108 (batch 14), 113 (42), 121 (70), 125 (98), then stayed at 125 to batch 140. Against the holdout it was 80 at batch 19 and 83 to 86 from batch 39 on.
- **It is tuned to the panel, not to the seeds.** The 5 best members score 121 to 123 against the panel with other seeds than the evolver's (125 to 123 with its own), and 83 to 88 against 40 holdout warriors. Hill warriors of the panel lose 19 points from panel to holdout as well (137 to 118, 14 of them, the holdout sample is harder), the members 38: about 19 points are tuning to the 40 panel warriors.
- **One design took over.** 19 of 20 members are one family (Mosquito), 10 to 16 instructions, 104 of their about 250 instructions are `SPL`, against the panel about 31 wins, 39 losses and 30 ties per 100 rounds. The nearest other warrior is 14 to 29 SD-score away (median 15.8); among the hill warriors the median is 25.9.
- **The screen picks for strength, the push-off for strength times distance.** Each batch the 16 best of 128 by the screen go on (the cap, every batch; all at 1.06 times the weakest member's panel average or more). 22% of them stay past their own batch, 7% for 5 batches. Their matches are about half of all matches of a batch.
- **Most changes make a warrior a bit worse.** Against the first parent, the mean change of the panel average is -0.83 for `insert`, -0.58 for `duplicate`, -0.2 for operand, mode and modifier changes, +0.19 for `crossover-replace`; better than the parent in 23% (modifier) to 49% (`delete`, `crossover-replace`) of the warriors that entered. One panel average has a noise of about 2 points, so most of these differences are luck, and the list selects on it.

- **The lists end up with `SPL` and `DJN`.** In the members of the runs of 14th November 2026, `SPL` is 16 to 33% of the instructions and `DJN` 10 to 23%, `MOV` 6% at most; the most common modes are `#` and `<` (about 25% each), direct `$` 8 to 12%. The hill warriors of the panel: `DAT` 40%, `MOV` 16%, `JMP` 9%, `SPL` 9%, `$` 72%. Many processes survive and give ties, and decrements through `<` and `{` damage the opponent as a side effect: a local optimum that random changes find at once. A bomber or a paper needs a `MOV` loop with the right pointer and step, several right choices at once, and uniform draws give `MOV` 1 time in 17 and `$` 1 time in 8. `--prior hill` draws them as often as the hill does. `--parents duel` is YACE's way out of such an optimum: there a warrior reproduces when it wins a fight against another one, so the target moves with the population instead of staying the fixed panel; here the two candidates for a parent are compared by their match in the matrix, at no extra cost.

## E5, first comparison: four settings, one hour each

14th November 2026, all four at once, 8 threads each on the machine above, `--batch 128`, seed 1, '94nop. Score: points per 100 rounds against all 1,107 warriors of `warriors/koenigstuhl/94nop` (`tools/tournament.mjs --bench`), for the best warrior against the holdout (`best.red`) and the 3 members with the highest panel average at the end. The 1,107 include each run's own panel, which flatters `panel80` a little more than the others.

| Run | Batches | `best.red` | 3 best members | Mean of the 3 |
|---|---|---|---|---|
| `--panel 80` | 58 | 100.4 | 100.8, 97.0, 96.4 | 98.1 |
| defaults | 93 | 95.8 | 97.4, 98.8, 92.1 | 96.1 |
| `--survivors 4` | 190 | 90.4 | 92.1, 90.1, 88.0 | 90.1 |
| `--alpha 2` | 94 | 89.0 | 80.8, 82.8, 89.7 | 84.4 |

On the same yardstick, 9 warriors of the folder (every 120th file) score 60.2, 93.9, 125.5, 137.8, 144.7, 158.4, 162.5, 168.0 and 168.4 (median 144.7); Dewdney's Dwarf 66.9 and Imp 58.1, our Origami 134.9 and Lantern 90.1. Our evolved warriors tie in 44 to 48% of the rounds.

- One seed per setting, and warriors of one run differ by 5 to 9 points: only `--alpha 2` is clearly worse (12 points below the defaults on the 3 members). More weight on distance kept more families but weaker ones.
- `--survivors 4` ran twice the batches and is 6 points worse: the full matches of 16 survivors buy precision that more candidates do not make up for.
- `--panel 80` ran 40% fewer batches and is 2 points better: tuning to the panel costs at least as much as half the candidates.
- The defaults run is the same run as the 22-minute run on 32 threads of the section before (same seed, same batch, same survivors; the thread count does not change a run), which had 210 batches by then and the same `best.red`: from batch 79 to 210 nothing better against the holdout.

## E5, second comparison: the new options, one hour each

14th November 2026, the same way as the first, all four with `--panel 80` (the best of the first comparison) and therefore the same 100 holdout warriors.

| Run | Batches | `best.red` | 3 best members | Mean of the 3 | Opcodes of the list | `$` |
|---|---|---|---|---|---|---|
| `--panel 80` | 163 | 101.0 | 98.9, 103.0, 99.7 | 100.5 | DJN 25%, SPL 23% | 3% |
| `--prior hill --fractions 0.5` | 172 | 101.4 | 102.2, 100.4, 95.3 | 99.3 | SPL 49%, MOV 27%, DJN 10%, DAT 7% | 47% |
| `--select value --rotate 10` | 160 | 100.7 | 98.4, 98.6, 98.3 | 98.4 | SPL 36%, DJN 22%, DAT 9% | 7% |
| `--parents duel` | 123 | 90.1 | 88.4, 90.1, 91.3 | 89.9 | SPL 21%, MUL 10%, DJN 10% | 10% |

- Three settings end at the same place, 98 to 101; `--parents duel` is 10 points lower. Picking parents by their match alone pays nothing here.
- `--prior hill` changes what evolves: `MOV` 27% and `$` 47% instead of at most 6% and 12%, and fewer ties (38 to 41% of the rounds instead of 42 to 48%), at the same score. SPL with MOV and direct addressing is how papers are built.
- The `--panel 80` run is the same run as the one of the first comparison (the same events, also with the later build), now 163 batches instead of 58: 100.5 instead of 98.1. 
- In the first comparison the four runs had a third of the speed of these (0.46 against 1.34 G instructions per second over their first 58 batches): tests ran on the same machine. That was the same for all four of that comparison, so it compares within itself, but the two comparisons have different budgets.

About 100 against the folder, where the median hill warrior scores 145, comes out of every setting so far. More time and these options move it by 2 points.

Ideas from this, to measure in E5 (#142) against the holdout at equal time: survivors by an estimate of their push-off value (the distance to the members on the panel columns, which the screen has), a panel that rotates (a new hill warrior every few batches costs one match per member), islands with migration against the takeover by one family, and fewer `insert` and `duplicate`.
