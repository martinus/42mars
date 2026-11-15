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
| `--panel N`, `--holdout N` | 80, 100 | warriors the evolved ones play all the time; warriors only the benchmark plays |
| `--panel-files a.red,b.red,...` | | the panel is these warriors of `--opponents` instead of N drawn ones; the holdout is drawn from the rest |
| `--screen-members N` | 0 | the screen plays the panel and N members of the list, drawn anew each batch with its seed; the threshold is the weakest member's average against the same opponents. With a small panel and a long list the score is then mostly against the list, as in YACE |
| `--list N` | 20 | evolved warriors kept |
| `--batch N`, `--survivors N` | 4 per thread, batch / 8 | candidates per batch; most of them that get past the screen |
| `--rounds N`, `--screen-rounds N` | 100, 20 | rounds per match; the first of them are the screen |
| `--screen-factor x` | 0.8 | a candidate needs this share of the weakest member's panel average after the screen |
| `--alpha x`, `--sd opponent\|sum` | 1, opponent | push-off value = average * distance^alpha; the reading of the SD-score |
| `--noise z` | 0 | the SD-score counts a column only as far as the difference is larger than z standard errors of the two scores: max(0, \|a_k - b_k\| - z sqrt(se_ak² + se_bk²)), each standard error from the wins, losses and ties of its match (#148); 0 is the plain SD-score of the tournament |
| `--reintroduce p` | 0.02 | chance that a candidate is a warrior that was pushed off earlier |
| `--select screen\|value` | screen | what the survivors of the screen are picked by: the screen score, or the estimated push-off value (screen score times the SD-score to the nearest warrior in, on the panel columns, to the power alpha) |
| `--start <dir>` | | the first batch starts from the warriors of the folder (as they are, then mutants of them) instead of random ones; each starts a family; an operand that points into the warrior's code becomes a reference |
| `--parents value\|duel` | value | the tournament of two that picks a parent: the higher push-off value, or the one with more points in their match against each other (a draw by value) |
| `--prior uniform\|hill` | uniform | how opcodes, modifiers and modes of new instructions and point changes are drawn: uniform, or as often as they occur in all warriors of `--opponents` (plus 1 each, so none is impossible) |
| `--stage N` | the screen rounds | 0 for none; else at least the screen rounds: every match is played as its first N rounds and the rest, and 42evolve keeps both results. A survivor of the screen plays only the first N rounds against everyone in and enters with them; the push-off then runs on everyone's first-N results, the same noise for all. A newcomer among the 8 weakest members there leaves at once (`leave` with `early`), unless its nearest warrior is weaker still (mostly its first parent: then the whole results decide which of the two goes). Every other newcomer plays the rest of its rounds first (event `complete`), and the push-off decides on the whole results, so no newcomer pushes out a member on the noise of its few rounds |
| `--fill` | | new random warriors until the list is full, not only in the first batch: with a list of 90 about 6 batches of them, and the push-off keeps the most different ones |
| `--race N`, `--race-keep K` | 0, batch / 4 | the screen in two stages: every candidate plays the first N screen rounds, only the best K by the key the rest |
| `--changes name=w,...` | see below | how often each kind of change is drawn, weights of any scale; a kind not named is never drawn. The names are those of the dashboard's Operators tab and of `42spectrum`: `opcode`, `modifier`, `a-mode`, `b-mode`, `a-operand`, `b-operand`, `org`, `replace`, `insert`, `delete`, `duplicate`, `move`, `crossover-insert`, `crossover-replace`, `related-opcode`, `related-mode`, `shared-constant`, `tune`. The default is `opcode=81,modifier=81,a-mode=54,b-mode=54,a-operand=108,b-operand=108,org=27,replace=27,insert=100,delete=100,duplicate=70,move=70,crossover-insert=60,crossover-replace=60`, the rates from before the option (since the option, 15th November 2026, a seed gives another run than before, also with these rates: a change that does not fit is drawn again instead of becoming the next kind) |
| `--fractions p` | 0 | chance that a new far value (any value of the core otherwise) is 1/2, 1/3, 2/3, 1/4 or 3/4 of the core give or take 20 |
| `--rotate N` | 0 | every N batches the oldest panel warrior makes room for the next warrior of the folder that is neither in the panel nor in the holdout; it plays everyone in once |
| `--bench-every N`, `--bench-rounds N` | 10, 100 | the best member against the panel plays the holdout every N batches |
| `--init-length N` | 10 | the longest random warrior of the start |
| `--size --cycles --processes --length --distance` | pMARS's | the rules, e.g. `--size 800 --cycles 8000 --processes 800 --length 20 --distance 20` for the tiny hill |
| `--seed N`, `--threads N`, `--batches N`, `--seconds S` | 1, all | |

The run folder gets `events.jsonl` (everything that happened, one JSON object per line), `state.txt` (to continue) and `best.red` (the best warrior against the holdout so far).

## How it works

**The list.** Like YACE: a list of 20 evolved warriors, and each newcomer plays the whole list. The list is kept by the diversity push-off of [Tournament Weekend 2026](https://corewar.co.uk/tournamentweekend2026a.htm): each warrior's value is its average score times the lowest SD-score between its row of scores and the row of any other warrior; when the list has 21, the lowest value leaves. A close clone of a strong warrior has a distance near 0 and goes first, so the rule keeps the list diverse. The math is [`tools/diversity.js`](../tools/diversity.js) and [`evolver/pushoff.c`](../evolver/pushoff.c), the same operations in the same order; [`tools/pushoff.mjs`](../tools/pushoff.mjs) ranks a whole tournament that way. The SD-score is from [Ismael 2025](https://doi.org/10.1186/s40537-025-01091-z), whose Eq. 6 (`--sd sum`: sum of differences over sum of standard deviations, the order of plain Manhattan distance) and pseudocode (`--sd opponent`: each column divided by its own standard deviation) differ.

**The matrix.** Rows and columns are the panel (80 hill warriors that never leave) and the members. So a warrior's row is its score against the panel and the other members, and the distance to the nearest panel warrior counts too: copying a hill warrior does not pay either.

**A batch.** 4 candidates per thread are bred from the list (tournament of two on the push-off value). The screen plays each against the panel for 20 rounds. Those with at least 0.8 of the weakest member's panel average, at most batch / 8 of them, play 20 rounds against every member and every survivor before them, and enter one by one with those results (`--stage`, by default at the screen rounds). The push-off on everyone's first 20 rounds sends a newcomer among the 8 weakest away at once, about 80% of them in a long run; every other one plays the rest of its 100 rounds against everyone, and the push-off on the whole results decides. Without `--stage` (`--stage 0`) every survivor plays all 100 rounds before it enters. Candidates whose warrior is one of the last 16,384 that were tried are skipped. Every match uses the seed of its opponent, so all candidates meet an opponent at the same positions and differ by their code, not by their luck.

**The genome.** [`evolver/genome.c`](../evolver/genome.c): a list of instructions whose operands are typed, a reference to an instruction of the genome or a value. A reference becomes a relative offset only when the genome becomes a warrior, so inserting, deleting or moving instructions keeps what it points at; with raw offsets every insertion breaks the references that cross it. Changes: a field of one instruction (opcode, modifier, mode, operand, start, the whole instruction), insert new instructions, delete, duplicate or move a block, and crossover, a block of another member inserted or put over a block; and four small steps, off by default: an opcode or mode of the same family, a far value set to another one of the warrior, a far value moved a little (see the mutation spectrum below). A child gets 1 change, and one more with probability 0.35 each time, up to 6; each is drawn by the weights of `--changes`, and drawn again when it does not fit (an insert at the longest length, a crossover without a second parent). A copied block keeps its references inside the block; references out of it go to the original (duplicate) or become plain offsets (crossover). No strategy is built in: no qscan, paper or stone templates.

**Names.** Each warrior that enters gets a name of its own adjective and its family's noun. The family is its first parent's: a child of "Crimson Mantis" may be "Sneaky Mantis". It starts a family of its own, with a new noun, when it plays clearly unlike its first parent: its scores against everyone else in differ from the parent's by more than 30 points per 100 rounds on average (`parentDifference` and `newFamily` in its `enter` event; in the runs of 15th November 2026 the median was 1 to 9, and 0.1 to 2.3% of the children were above 30). Without that rule every run ended with one noun, the descendants of one early warrior, whatever they played. A warrior bred from nothing starts a new family too. A name given before gets a Roman numeral ("Sneaky Mantis II"), so names are unique in a run. 128 adjectives and 128 nouns ([`evolver/names.c`](../evolver/names.c)); the dashboard colors a family alike, a new family in a new color. Names change nothing else; the number of a warrior (`id`) stays the key in the events.

**All cores.** One thread per hardware thread, each with its own `m42_ctx`, takes matches from one shared queue; the main thread plays too. A match is one pair and one block of rounds, at most 100 rounds, so the queue has no long tail at the end of a phase. On the run below, 16 threads were 97.7% busy over 600 s, measured as time inside `m42_match()` over threads times wall time. The plan in #142 had batches bred one batch behind so that no thread waits at the end of a batch; with matches this small that was not needed.

**Two answers to the long run below.** `--select value` picks the survivors of the screen by an estimate of their push-off value instead of their strength: the screen gives a candidate's row against the panel, so its SD-score to every warrior in can be computed on the panel columns. Every newcomer logs its `estimate` and its `screenPoints`, also with `--select screen`. `--rotate N` replaces the oldest panel warrior every N batches with the next one of the folder (those that leave go to the end of that queue), so the list cannot tune itself to 40 fixed opponents; the event `rotate` has the new warrior and its matches. Whether they help is E5: measured against the holdout at equal time. `--fractions p` comes from YACE (2000, GPL): half of its numbers are a small value plus 1/2, 1/3 or 1/4 of the core, the distances of bombers and replicators, which a uniform far value almost never hits. Its source was read by a separate agent that wrote down the ideas in prose; nobody who writes 42evolve read it. YACE has no crossover, no references that survive insertions and no start that changes; its other ideas (a hill with a spare slot and a cached score matrix, a cheap screen before a precise test, champions brought back, replacement of a similar member) are here in some form already. Not taken yet: a test against a one-line `spl 0` before the screen, which throws out warriors that die at once. `--race N` makes the screen cheaper: on the tiny hill (batches 2 to 9 of 10, batch 128), `--race 4` played 1,082,400 instead of 1,548,000 rounds and 10.1 instead of 12.3 million instructions per candidate, 18% less. The survivors' full matches cost more than the screen, so it pays most together with fewer survivors.

**What it does not have yet.** An LLM as mutation operator, islands, an opponent ladder (the panel is a random sample of the folder, weak and strong warriors), MSVC (it needs POSIX threads and `dirent.h`).

## The dashboard

[`ui/evolver.html`](../ui/evolver.html), on the events of a run: live through `node tools/serve.mjs --run <folder>`, or `?log=<url of an events.jsonl>`, or an `events.jsonl` dropped on the page. Live events are applied every 2 seconds (`?every=<seconds>`, 0 at once); in between the matrix and the map stand still, and the newcomers that came and went in one update are one line in the ticker. A run with `--stage` on 32 threads writes about 4 batches a second, and drawn as they come the matrix took a core of its own.

- **Score matrix**: the members by push-off value, against each other and the panel, points per 100 rounds. A newcomer slides in from below and glows, a member that leaves fades out. A click on a cell opens that match in the visualizer.
- **Novelty map**: classical multidimensional scaling of the rows against the panel, with the SD-score as distance. Grey points are the hill warriors, colored ones the members (a family shares a color), faint ones members that left. A newcomer flares up.
- **Lineage**: every warrior that entered, by its batch and its score against the panel; the warriors in the list with faint lines to their parents, a ring where a new family starts. A click on a warrior shows its line: its first parents in yellow, crossover parents dashed in cyan, its descendants in white, everything else dimmed.
- **Progress**: the best and mean member against the panel, and the best against the holdout, over the batches.
- **★ best** in the header is the best warrior against the holdout warriors so far, also after the push-off removed it from the list (the same warrior as `best.red`); **strongest now** is the member with the highest average against the panel. A click opens the card. The best one has a ★ in the matrix and on the map.
- A click on a warrior opens its card: code, scores, parents, nearest warrior, its result against each panel warrior, and every match with a **watch** button.

**Several runs**: `node tools/serve.mjs --run ~/42evolve.a ~/42evolve.b ...` (one `--run`, any number of folders, so `--run ~/42evolve.*` works) serves each run's events; `ui/evolver.html?run=<n>` is the dashboard of run n (0 is the first), and [`ui/runs.html`](../ui/runs.html) shows them all on one page: the best against the holdout and the best member against the panel over the minutes of each run (the fair axis when runs share a machine), and a table with the settings in which they differ, where each stands, the speed, the families and the opcodes of the list.

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

## E5, third comparison: started from our warriors

14th November 2026, `--start warriors` (Dwarf, Imp, Lantern, Origami, Seeker), `--panel 80`, 16 threads each for an hour, the same yardstick as before (the 1,107 '94nop Koenigstuhl warriors). Origami alone scores 134.9 there.

| Run | Batches | `best.red` | 3 best members | Origami's family in the list |
|---|---|---|---|---|
| `--start warriors` | 240 | 142.8 | 142.8, 143.0, 139.1 | 19 of 20 |
| `--start warriors --prior hill --fractions 0.5` | 280 | 136.3 | 136.3, 137.1, 134.5 | 19 of 20 |

- Started from Origami, the evolver gains 8 points against the 1,107 in an hour, to 143, near the median hill warrior of the sample (144.7); from random code every setting stopped at about 100. It improves a design it is given, it does not find one.
- What it changed, in the best member at batch 121 (32 generations after Origami): the paper itself (the three `spl`, the silk loop, both bomb lines with 1773 and 1213, the bomb) is still there with small edits (one more copy line `MOV.I }3999, >-3`, `JMP` became `JMN`, modifiers), and 17 new instructions stand in front of the start, from crossover and duplication: most likely a decoy. Half of the gain against the panel came from small edits in the first 31 batches, half from three crossovers in a row at batches 91 to 94.
- With `--prior hill` the gain is 1 to 2 points: Origami has the instruction mix of the hill already.
- Dwarf, Imp, Seeker and Lantern left the list; Origami's family took it over in both runs.

## E5, fourth comparison: the weights of the changes

15th November 2026, all four at once, 8 threads each on the machine above, `--panel 80 --batch 128 --seed 1`, an hour, the same yardstick as before (the 1,107 '94nop Koenigstuhl warriors). The spectrum mix is the result of the mutation spectrum below as weights: `opcode=30,modifier=20,a-mode=30,b-mode=30,a-operand=90,b-operand=100,org=5,replace=15,insert=70,delete=40,duplicate=110,move=40,crossover-insert=140,crossover-replace=40,related-opcode=30,related-mode=30,shared-constant=160,tune=20`; the default mix is the rates from before `--changes`.

| Run | Batches | `best.red` | 3 best members | Opcodes of the list |
|---|---|---|---|---|
| random code, default mix | 158 | 101.6 | 101.6, 96.2, 96.6 | SPL 32%, DJN 22%, ADD 10% |
| random code, spectrum mix | 152 | 93.3 | 93.3, 89.5, 92.0 | SPL 38%, DJN 19%, ADD 12% |
| `--start warriors`, default mix | 114 | 134.9 | 134.7, 134.4, 131.9 | SPL 39%, MOV 25%, JMP 8% |
| `--start warriors`, spectrum mix | 124 | 141.7 | 141.7, 138.7, 140.5 | SPL 31%, MOV 31%, JMP 17% |

- From our warriors the spectrum mix is 6.6 points better (mean of the 3: 140.3 against 133.7); its benchmark against the holdout climbed from batch 69 on, the default's stayed at 130 to 133 all hour. The changes that keep a design and move its constants pay once there is a design.
- From random code it is 7.5 points worse (91.6 against 98.1): fewer opcode, mode and delete changes slow the search for a design. Both lists are the `SPL`/`DJN` swarm with `<` and `#` and no `MOV`, as in every run from random code.
- One seed per setting. The third comparison's `--start warriors` run (16 threads, 240 batches) reached 142.8, the same as the spectrum mix here in half the batches.

So no mix is best for both: a search for a design wants the big changes, a design that is there wants the small ones. Neither gets a run from random code off the swarm.

## E5, fifth comparison: a list that plays itself

15th November 2026, all four at once, 8 threads each (nice 19 for the last 30 minutes, all four alike), an hour, the same yardstick. YACE scored a newcomer against its list of evolved warriors only, and the list moved with itself; 42evolve scored it mostly against the fixed panel (80 of 99 columns), where the `SPL`/`DJN` swarm is a local optimum. Here the panel is 5 warriors (`--panel-files pst_v4.red,recon2.red,stingray.red,monowire.red,digitalis2003.red`, picked by measurement: a round robin of every third of the 1,107, the strongest quarter, then greedily the one farthest by SD-score from those picked; paper/stone, scanner, oneshot and clear, oneshot, qscan and clear and imps), and `--screen-members 15`: the screen plays the 5 and 15 members, so the score is mostly against the list. The references are the first and third runs of the fourth comparison (the default mix, `--panel 80`, list 20). "By row": the 3 members with the highest average over everyone in, a choice that does not depend on 5 panel warriors.

| Run | Batches | `best.red` | 3 best by panel average | 3 best by row average | Opcodes of the list | Ties in the list |
|---|---|---|---|---|---|---|
| reference, random code | 158 | 101.6 | 98.1 | | SPL 32%, DJN 22%, ADD 10% | 44 to 48% |
| `--list 20` | 547 | 99.1 | 98.2 | 98.6 | MOV 33%, SPL 17%, ADD 11%, JMP 10% | 17% |
| `--list 100` | 396 | 86.5 | 83.2 | 80.8 | MOV 27%, MOD 15%, SPL 12%, SEQ 11% | 7% |
| `--list 100 --alpha 2` | 284 | 71.5 | 71.1 | 70.3 | MOV 15%, SPL 12%, JMP 10%, MUL 10% | 16% |
| reference, `--start warriors` | 114 | 134.9 | 133.7 | | SPL 39%, MOV 25%, JMP 8% | |
| `--list 100 --start warriors` | 69 | 131.1 | 132.5 | 137.8 | SPL 29%, MOV 21%, JMP 9% | 49% |

- Against itself the list leaves the swarm: from random code `MOV` is 15 to 33% of the instructions and the members tie in 7 to 17% of their rounds against each other, instead of `SPL` and `DJN` and 44 to 48% ties. The first time a run from random code ended with another design.
- Against the hill that design is not better yet: the list of 20 ends where the reference ends (98 to 99), the lists of 100 below it, `--alpha 2` lowest again. A list of 100 costs a survivor 105 matches instead of 25 and evaluates fewer candidates; started from our warriors it ran 69 batches and ends near its reference.
- The family names (one noun per list) are from the binary before the names follow behavior.

## E5, sixth comparison: 90 evolved, 10 panel warriors, and the noise of the distance

15th November 2026, all four at once, 8 threads each at nice 19, an hour, the same yardstick. `--list 90 --screen-members 10` and 10 panel warriors, picked as the 5 before (the same 5 plus `borg.red`, `macromagic.red`, `toxicspirit2.red`, `twinstorms.red`, `goonie.red`: a qscan with a replicator, three scanners, a stone). `--noise z` (#148) subtracts z standard errors from each column's difference.

| Run | Batches | `best.red` | 3 best by panel average | 3 best by row average | Families in the list | Ties in the list | Seconds per batch |
|---|---|---|---|---|---|---|---|
| `--noise 0` | 415 | 87.3 | 83.7, 72.5, 80.9 | 88.5, 86.1, 87.4 | 30 | 7% | 8 |
| `--noise 1` | 81 | 94.7 | 79.6, 79.8, 79.6 | 75.1, 76.9, 69.0 | 6 | 81% | 47 |
| `--noise 2` | 207 | 89.9 | 88.9, 89.9, 69.9 | 61.7, 52.6, 69.0 | 36 | 24% | 15 |
| `--noise 1 --start warriors` | 77 | 134.8 | 134.3, 134.2, 139.7 | 128.4, 129.1, 131.4 | 2 | 64% | 53 |

- None is better than the list of 20 of the fifth comparison (99.1) or its reference (101.6); started from our warriors, none better than 134.9.
- `--noise 1` brings the tie swarm back. A match whose rounds all end alike has a standard error of 0, one of wins and losses a large one: the correction shrinks the differences of warriors that win and lose most, they look like clones and leave first, and the ties stay. A tied round runs all 80,000 cycles, so its batches took 6 times as long. The standard error of a score is the wrong measure of what two warriors share; the second variant of #148 (the round-by-round differences of a and b on the same positions) does not have this bias.
- With the names that follow behavior a list of 90 holds 30 families instead of 1.
- Where the time goes, the same in all four: the screen is 22% of the rounds, the full matches of the survivors 78%, and 48 to 75% of the survivors are pushed off in their own batch. Hence `--stage`.

The ground truth of #148: the final list of the `--noise 0` run (90 members and the 10 panel warriors) played again with 1,000 rounds per match (`tools/tournament.mjs`, its own positions), the SD-score between the members from that against the one from the run's 100-round matrix:

| Distance from the 100-round matrix | Nearest neighbor as with 1,000 rounds | Rank correlation over the 4,005 pairs | The 30 closest pairs: estimate / truth | Their error after scaling to the truth's mean |
|---|---|---|---|---|
| plain | 50 of 90 (56%) | 0.931 | 1.40 | 10.9 |
| `--noise 1` | 50 of 90 (56%) | 0.932 | 0.57 | 8.4 |
| `--noise 2` | 47 of 90 (52%) | 0.928 | 0.20 | 17.1 |

The plain distance overstates the closest pairs by 40%, as #148 measured; `--noise 1` shrinks them more than that, and neither finds the true nearest neighbor of more than 56% of the members. With the tie swarm it brings back, `--noise` stays at 0. The variant that #148 names second (the round-by-round differences of two warriors on the same positions) is not built.

## E5, seventh comparison: in stages, on all threads

15th November 2026, one run alone on 32 threads at nice 10, an hour, the same settings as the `--noise 0` run of the sixth comparison plus `--stage 20 --fill`. Two runs before it were stopped and changed: in the first, a newcomer entered with its 20-round results against everyone else's 100-round results, and noisier rows look more different, so 48% of the newcomers stayed on that noise for one batch and pushed out a member each (against 3% without stages); in the second, a newcomer left early only when it was the weakest of all on the first 20 rounds, 24% of them. The rule of `--stage` now (the 8 weakest, unless its nearest is weaker) came from the second run's log: 37% early, and 5% of the newcomers that stayed would have been sent away.

| Run | Threads | Batches | Seconds per batch at the end | Rounds per batch | Newcomers away early | `best.red` | 3 best by panel average | 3 best by row average |
|---|---|---|---|---|---|---|---|---|
| sixth comparison, `--noise 0` | 8 | 415 | 7.8 | 216k | | 87.3 | 79.0 | 87.3 |
| `--stage 20 --fill` | 32 | 2,884 | 1.0 | 106k | 80% | 93.4 | 85.3 | 82.1 |

- 7 times the batches in the hour: 3.3 times from the threads, the rest from the stages (half the rounds per batch) and from a list with fewer ties.
- `--fill` started from 700 random warriors, and the list began as a tie swarm (73% ties at batch 88, 6.5 s per batch); by batch 339 it was gone (8% ties), and the list held 58 to 61 families, none with more than 7 members.
- Against the hill 93.4 at best: more than the slower run, less than the lists of 20 (99 to 102). The list is diverse by its scores, not by its design: 83 of its 90 members run hundreds of processes that overwrite the fields of the core (`MOV.BA $5, }1` walking through it) and hardly copy their own instructions (median 3 cells after 2,000 instructions), where 84 of 93 hill warriors do (median 340: bombs, papers). The SD-score sees only the rows of scores, and among warriors of one design those differ by small details. A diversity of behavior, as MAP-Elites (#147) keeps it, is the next step.
- The defaults since then: `--panel 80` (better than 40 in the first comparison) and `--stage` at the screen rounds.

## What one change does: the mutation spectrum

`build/42spectrum` (`evolver/spectrum.c`) gives a warrior 250 children per kind of change, each with exactly that one change, and plays them against 40 panel warriors with the same seeds as the parent, 50 rounds each. A child is *identical* (the same result in every round: the change hit code that does not matter), *fatal* (20 points per 100 rounds or more below the parent), *worse* (2 to 20), *the same* (within 2) or *better*; every better child plays again against the parent with other seeds and 200 rounds and is *confirmed* when it is still 1 point or more above. Besides the 14 changes of the default `--changes` four small steps: `related-opcode` (ADD/SUB, JMZ/JMN/DJN, SEQ/SNE/CMP/SLT, SPL/JMP, MUL/DIV/MOD, DAT/NOP), `related-mode` (`$ @ *`, `< > { }`), `shared-constant` (a far value set to another far value of the warrior or its negative), `tune` (a far value moved by up to 2%). 14th November 2026, 32 threads, 8 minutes:

| Change | Origami: fatal | confirmed | Infinite Locust XLIII: fatal | confirmed | Volatile Tardigrade XVIII: fatal | confirmed |
|---|---|---|---|---|---|---|
| opcode | 74% | 0.8% | 29% | 0 | 11% | 0 |
| modifier | 8% (72% identical) | 0 | 2% (58% identical) | 0 | 5% (53% identical) | 0 |
| A mode, B mode | 46%, 23% | 0, 0 | 23%, 21% | 0, 0 | 16%, 9% | 0, 0 |
| A operand, B operand | 56%, 28% | 0, 1.6% | 24%, 12% | 0, 0 | 0%, 3% | 0, 0.8% |
| org | 90% | 0 | 84% | 0 | 66% | 0 |
| replace | 87% | 0 | 34% | 0 | 12% | 0 |
| insert | 61% | 0.8% | 28% | 1.2% | 4% | 0 |
| delete | 94% | 0 | 41% | 0 | 43% | 0 |
| duplicate | 51% | 3.6% | 25% | 2.8% | 3% | 0 |
| move | 72% | 0 | 52% | 0.4% | 13% | 0 |
| crossover-insert | 57% | 3.2% (best +14.0) | 36% | 0 | 1% | 0 |
| crossover-replace | 94% | 1.2% | 48% | 0 | 43% | 0.4% |
| related-opcode | 66% | 0 | 30% | 0 | 33% | 0 |
| related-mode | 36% | 0 | 14% | 0 | 11% | 0 |
| shared-constant | 28% | **4.0%** | 5% | 0 | 0% | **15.2%** |
| tune | 0% | 0 | 0% | 0 | 0% | 0 |

Origami (9 instructions, 149.2 against this panel), Infinite Locust XLIII (the best of the run started from it, 23 instructions, 161.2), Volatile Tardigrade XVIII (the best from random code in the second comparison, 7 instructions, 120.4). Crossover took its second parent from the next warrior of the three.

- Changes that break: `org` is fatal for 66 to 90% of the children, `delete`, `replace`, `crossover-replace` and `opcode` for up to 94% on Origami. A modifier changes no result in 53 to 72%. About half of what a batch evaluates is such children.
- Improvements are rare, and at a local optimum none: for Infinite Locust no change is confirmed better in more than 2.8% (duplicate) of its children, and by 2.3 points at most.
- Of the new small steps only `shared-constant` pays: the most confirmed improvements for Origami and for the warrior from random code, rarely fatal. `tune` is never fatal and never confirmed better: a constant needs another value, not a near one. `related-opcode` and `related-mode` are less fatal than a random opcode or mode, but bring no improvement.
- `crossover-insert` gives the largest steps (+14.0 for Origami with a block of its improved relative).

So: shift the rates of the changes (less `org`, `delete`, `replace`, `opcode`, `modifier`; more `shared-constant`, `crossover-insert`, `duplicate`), or let the evolver learn them from the counts per change; the constant optimizer (#146) should try the values of the warrior itself and core fractions rather than near values; and a list at a local optimum needs moves of several changes or several designs at once (#147).

Ideas from this, to measure in E5 (#142) against the holdout at equal time: survivors by an estimate of their push-off value (the distance to the members on the panel columns, which the screen has), a panel that rotates (a new hill warrior every few batches costs one match per member), islands with migration against the takeover by one family, and fewer `insert` and `duplicate`.
