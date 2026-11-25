# 42evolve, the evolver

`42evolve` evolves Redcode warriors on top of the 42mars library, with a dashboard that shows the run live and opens any match in the visualizer. The plan and its reasons are in [#142](https://github.com/martinus/42mars/issues/142). This page says how to run it, how it works and what came out so far.

## Run it

```sh
make                                                   # builds build/42evolve, POSIX threads (Linux, macOS)
build/42evolve runs/a --opponents warriors/koenigstuhl/94nop --seconds 3600
node tools/serve.mjs --run runs/a                      # then http://127.0.0.1:8000/ui/evolver.html
node tools/run-report.mjs runs/a                       # the status in the terminal (below)
```

Ctrl-C ends the run after the current batch. `build/42evolve runs/a` continues it, also with another `--threads`, `--batches` or `--seconds`; other options are refused for a folder that has a run. The same seed gives the same run for any number of threads, and a continued run is the same as one that never stopped (`test/evolver.test.js` checks both).

The defaults of a new run are the settings of `gen-var16-rnd` (21st November 2026), which found the best evolved warrior so far (Fancy Falcon, 117.0 against the whole '94 hill): generators, a panel of 30 by kinds, batches of 128, and with `--islands` half the islands screening against every member and every 5 batches a member drawn from an island drawn. A run folder keeps the settings it started with.

| Option | Default | |
|---|---|---|
| `--opponents <dir>` | | hill warriors; those that fit the rules are shuffled with the seed into the panel and the holdout |
| `--panel N`, `--holdout N` | 30, 100 | warriors the evolved ones play all the time, picked (`--panel-choice`); warriors only the benchmark plays, drawn from the rest |
| `--panel-choice picked\|random\|kinds`, `--pick-sample N` | kinds, 300 | picked: N warriors of the folder (drawn with the seed) play a round robin of 100 rounds; of the strongest quarter (at least the panel's size) the strongest first, then each time the one with the largest SD-score to the nearest one picked (event `pick`). About 2 minutes for 300 '94nop warriors on 32 threads. random: the first warriors drawn with the seed, as before 15th November 2026. kinds: the same round robin, then a panel of every kind of design from the strongest half (below)
| `--panel-files a.red,b.red,...` | | the panel is these warriors of `--opponents` instead of N drawn ones; the holdout is drawn from the rest |
| `--screen-members N` | 10 | the screen plays the panel and N members of the list, drawn anew each batch with its seed; the threshold is the weakest member's average against the same opponents. With a small panel and a long list the score is then mostly against the list, as in YACE |
| `--list N` | 80 | evolved warriors kept |
| `--batch N`, `--survivors N` | 128, batch / 8 | candidates per batch; most of them that get past the screen |
| `--rounds N`, `--screen-rounds N` | 100, 20 | rounds per match; the first of them are the screen |
| `--screen-factor x` | 0.8 | a candidate needs this share of the weakest member's panel average after the screen |
| `--alpha x`, `--sd opponent\|sum` | 1, opponent | push-off value = average * distance^alpha; the reading of the SD-score |
| `--diversity all\|panel` | panel | the columns of the push-off's SD-score: everyone in, or the panel only (the average stays over everyone). Among warriors of one design the results against each other differ in small details, so their rows look different by the evolved columns; against the fixed panel two warriors of one design score alike |
| `--average all\|panel` | all | the push-off's average: over everyone in, or over the panel only (the members still play each other, and the screen with `--screen-members`). Over everyone, the design that holds most of the list sets what a high average is, and a design it beats leaves whatever its SD-score: in a merge of 8 islands, isl14's best (103.0 against the 1,107) had an average of 37.8 when it left, the list's median was 147 |
| `--pushoff value\|pareto\|pareto-sd` | pareto-sd; value where pareto does not go (`--average panel`, `--member-games none`), and a new run says so on stderr (#199) | pareto: who leaves is decided by NSGA-II (Deb et al. 2002) on two objectives instead of average × SD-score: the average against the panel and the average against the other members. pareto-sd adds a third, the SD-score to the nearest warrior, as `--diversity` computes it (behavioral diversity as an objective, Mouret and Doncieux 2012); it goes against strength (the weakest quarter of a list had the largest distances); on four lists of 18th November its first front had 28 to 41 of 80 members (pareto-age, removed in #193, had the age of the warrior's line as the third objective, and 31 to 78). The members are sorted into fronts (those nobody beats on all objectives, then those only the first front beats, ...), within a front by crowding distance (the gaps to the neighbours on each objective over its range; the ends of a front infinite, a copy with the same numbers as another 0). The value in the events is 10 (fronts - front) + min(crowding, 5): the lowest is the most crowded of the last front and leaves, and the parents' tournament by value is NSGA-II's crowded comparison; panel warriors keep their values. With 55 objectives (a column per panel warrior) all 80 members of two lists were on the first front, with two the first fronts had 6 and 7 (17th November 2026). Not with `--average panel` or `--member-games none`; a new run with one of those and without `--pushoff` takes value. pareto-sd is the default since the push-off comparison of 18th November 2026 (below), a run started before keeps value |
| `--clear R` | off | with a pareto push-off: clearing (Pétrowski 1996). The members by average, the strongest first; each is a winner unless its SD-score to a winner before it is below R, and the cleared ones get the fronts after those of the winners, so they leave first. Without it a near copy of a strong member that scores a bit better on one objective stays on the first front: in pareto-sd lists of 18th November 2026 54 of 80 members were on the first front, the member pushed off was at the 21st percentile of the SD-scores to the nearest (with the value push-off always the nearest), and the members were half as far apart in points against the panel as with the value push-off (8.8 against 16.4 per panel warrior to the nearest) |
| `--positions mirror\|pmars` | mirror | mirror: every position of a match is played twice, the second time with the two warriors swapped: game g is round g / 2 + 1 of the seed's sequence of positions and first movers, with the newcomer as the first warrior when g is even and its opponent when it is odd. A warrior and its copy then win exactly as many games, and where two warriors start no longer adds noise to the difference of their scores. pmars: the rounds as pMARS plays them, the newcomer always the first warrior; a run from before has it. Odd numbers of rounds are fine: the last position is then played from one side. The library plays pMARS's rules either way |
| `--genome list\|gen` | gen (list with `--optimize`) | gen: a warrior's genome is a generator, a small program that writes the warrior ([`evolver-gen.md`](evolver-gen.md)), not the list of its instructions. The events carry the generator of every warrior that enters (`gen`), and `best.gen` is the one of `best.red` (`42gen` compiles it). Without `--changes` a quarter of its changes are the kinds that make structure (`repeat`, `count`, `fold`, `unroll`, `index`, `expression`, `constant`) and functions (`extract`, `parameter`, `call`, `inline`, `transplant`), which `--changes` takes with `--genome gen` only; with the changes of a list a run on generators is the run on lists, event for event. A run folder keeps its kind |
| `--min-length N` | off | a child whose warrior has fewer than N instructions that are not `DAT.F $0, $0` (an empty cell, so padding does not count) is not played, as one already seen; random warriors of the start are N to `--init-length` long. Start warriors and those back from the archive always play |
| `--tie-points t` | 1 | what a tie counts, 0 to 3, a win 3, where the run selects: the screen, the values and averages of the push-off, the estimate, the standard errors. What scores the run stays 3/1/0 as on a hill: the holdout, the bench, the islands' scores against the folder; the dashboard's matrix shows 3/1/0 too. Made against lists of SPL/JMP loops that tie each other in every round (20th November 2026) |
| `--parsimony` | off | of a newcomer and a member with the same results, twins, the longer one leaves, the newcomer when they are as long (from RedRace, #172). Twins: the same wins, losses and ties against every panel warrior and every member that was in when the member entered: each played those games with that opponent's seed, the newcomer too; their games against each other do not count. The rule goes before the push-off, also while the list is not full, and with `--stage` on the whole results; of several twins the longest. The event `leave` then has `twin`, the id of the one that stays |
| `--no-spl` | off | no warrior of the run has `SPL`, so that the `SPL`/`MOV` backbone that tops every run on the tiny hill cannot grow (#185). A change after which the child's warrior has an `SPL` is undone and drawn again, like one that does not apply (for every kind, of lists and of generators, the rewrites and their variations too; the warrior is what counts, not the lines of a generator that write nothing), and a random warrior (the first batch, `--fill`) with one is drawn again at its length; both from the child's own random numbers, so the same seed gives the same run. A start warrior with `SPL` is left out with a message, as one that does not fit the rules, and the run is refused when none is left. What comes back from the archive was a member, so it has none. As an `--island-variant`, such an island takes migrants only from islands with `--no-spl` (none: no migrants), while the others take from every island. With `--explorers` the restricted islands take none at all and the core takes from them; the variants then have to name every island, the last K with `--no-spl`: `--islands 4 --explorers 2 --island-variant "" --island-variant "" --island-variant --no-spl --island-variant --no-spl`. The start event has `noSpl` |
| `--member-games all\|none` | all | none: members never play each other. The screen plays the panel only (`--screen-members 0`), a survivor plays the rest of its rounds against the panel only, and the family name compares rows on the panel columns. Only with `--average panel --diversity panel`, where those games count for nothing, and not with `--parents duel`. The dashboard shows no cells between members |
| `--islands N`, `--select-after B`, `--keep K`, `--score-rounds R` | | N runs in one process, in `<folder>/island-01` ... (each an ordinary run folder: it can be continued, served and read alone). The panel is picked once and every island has it and the same holdout (`--draw-seed`); island i evolves with seed + i - 1. One pool of threads, and the islands play in rounds: every island its next batch, all at the same time, each on a thread of its own with its matches in the one pool, so that the parts of a batch that run on one thread (the push-off, entering, the style of newcomers, the events) overlap; they advance by batches, not by time, and the run is the same on any thread count. Before a round, on one thread: the scores, then the migrants (taken from the islands as the round before left them). A run stopped while its islands took turns (before 23rd November 2026) continues in rounds once its islands are at one batch. On the tiny hill, 16 islands with full lists on 32 threads: 10 batches in 141.6 s instead of 186.2 s in turns, the threads 90% busy instead of 64%. Every B batches of each, the `best.red` of each island and its three members best against the panel play every warrior of the opponent folder (R rounds each, 100); the first time, the K islands with the best of those scores go on and the others stop. The folder has `islands.jsonl` (events `islands`, `pick`, `score` with every score, the opponents and the seeds), `islands.txt` (its state) and `best.red`, the best warrior scored so far. `tools/serve.mjs --run <folder>` shows all its islands in the dashboard's list. A folder with islands continues with `--threads`, `--batches` (of each island) and `--seconds` only |
| `--migrate M` | 5 with 2 islands or more, 0 off | with `--islands`: every M batches of each, an island first plays the member best against the panel of every other live island, as a start warrior (it enters whatever its screen when it is above the threshold) with no parents here; one whose code is in the list already is not played. The others are as the round before left them, so the run stays the same on any thread count and after a resume. Event `migrate` in the island's events: the batch and `[island, id]` of each. Made because long runs stop rising: the best lines sit on a peak that small changes do not climb, and parts from a line that found something else are a large step ([`evolver-gen.md`](evolver-gen.md), 21st November 2026) |
| `--migrate-pick best\|random`, `--migrate-to all\|random` | random, random | with `--migrate`: random sends a member drawn from the seed, the batch and the two islands instead of the best against the panel; random (to) takes from one other live island drawn each time, one migrant each time (`--migrate 1 --migrate-pick random --migrate-to random`: every batch a member drawn from an island drawn). Sending the best to all made the same loop the best of all 8 islands after two migrations on '94 (`gen-mig-25`, 21st November 2026), while a member that beat the loops and was weak against the panel never moved. |
| `--explorers K` | 0 | with `--islands` and migration (not with `--migrate 0`), K fewer than the islands; not with `--keep`: the last K islands take no migrants. Each is an independent try, like a run of its own, that no strong design from elsewhere pushes out; the other islands (the core) take from all islands, explorers included, so what an explorer finds is taken up and tuned there. With `--island-variant` the core can select differently, for example `--average panel`: on island 10 of `tiny-age16` (23rd November 2026) the score against the island's panel and against the whole tiny hill had a rank correlation of 0.88 over its 80 members, the push-off's average over panel and members 0.01. A new design came up once on one island of that run (batch 347) and the others took it from there. `--no-spl` on the explorers: islands where the `SPL`/`MOV` backbone cannot grow, whose finds the core can take up (#185) |
| `--island-variant "options"` | `""` and `"--screen-members 80 --screen-rounds 8"` with 2 islands or more | with `--islands`, once or more: island i takes variant (i − 1) mod their number, the options of the command line with the variant's after them (an empty variant is the command line as it is). What selects and changes may differ (the screen, `--tie-points`, `--changes`, the push-off, ...); what makes islands comparable and migrants meaningful may not: the rules, `--opponents`, `--start`, the panel and holdout and how they are chosen, `--seed`, `--draw-seed`, `--genome`, nor the options of the islands or `--batches`. Each island keeps its options in its state. The event `islands` lists the variants. For islands that explore and islands that exploit side by side, with `--migrate` between them: `--island-variant "" --island-variant "--screen-members 80 --screen-rounds 8"` |
| `--island-panels shared\|own` | shared | with `--islands` (2 or more) and a picked panel (`--panel-choice picked` or `kinds`): own gives each island a panel of its own. The round robin of the pick is played once; each island then chooses its panel the way the shared pick does, from a random half of the candidates (drawn with `--draw-seed` and the island; with kinds, the strongest half of the sample). The islands then score against different opponents and are pulled toward different designs, and a migrant has to hold up against another panel. The holdout stays one for all, the first warriors of the shuffled folder that are in no island's panel (fewer than `--holdout` when not enough are left), so that holdout scores compare between islands. Refused when the candidates are fewer than twice the panel: every island would choose from almost the same ones. Each island's event `pick` names its panel; the event `islands` has `islandPanels` |
| `--draw-seed S` | the seed | the order of the opponent folder, so which warriors are the panel and the holdout; the islands share it |
| `--panel-rounds N` | 500, at least `--rounds` | rounds of a match against a panel warrior, at least `--rounds`: less noise in the panel's columns. Matches are played in blocks of at most 100 rounds, so the threads end a step together |
| `--screen-stop z`, `--screen-check z` | 3 | the screen in steps of 5 rounds: a child stops when its score plus z standard errors cannot get past (below). `--screen-stop 0` plays every screen to its end. `--screen-check` plays everything and logs what `--screen-stop` would have done. Both also go with a run that continues |
| `--reintroduce p` | 0.02 | chance that a candidate is a warrior that was pushed off earlier (one of the last 256), unless its code is a member's or came back in the same batch. Also goes with a run that continues (event `reintroduce`). In a list that has settled they are most of what stays: in kd1a (483 batches from batch 7,453) 1,139 of 1,296 passed the screen and 201 of the 222 warriors still in after their batch had come back, 940 of 1,141 left in their batch, 12 stayed 10 batches; 204 were copies of a member, before that check. About three quarters of the completions went to them |
| `--list N` on a run that continues | | the list grows to N (a smaller N is refused); `--fill` goes off, so children of the members fill the new places, not random warriors. Event `list` |
| `--start <dir>` | | the first batch starts from the warriors of the folder (as they are, then mutants of them) instead of random ones; each starts a family; an operand that points into the warrior's code becomes a reference. Every start warrior (up to `--batch` of them) enters the list in the first batch, also more than `--survivors` and also one the screen would stop, and the push-off cuts the list to `--list`: before 18th November 2026 they went through the cut of the survivors like any candidate, and a merge of the best warriors of 80 islands kept 13 of them With `--genome gen` the folder's `.gen` files start the run too, generators as `42gen` reads them (the `best.gen` of a run): each enters with its structure, under its file's name; one that does not read or does not fit the rules is left out with a message |
| `--parents value\|duel` | value | the tournament of two that picks a parent: the higher push-off value, or the one with more points in their match against each other (a draw by value) |
| `--stage N` | the screen rounds | 0 for none; else at least the screen rounds: every match is played as its first N rounds and the rest, and 42evolve keeps both results. A survivor of the screen plays only the first N rounds against everyone in and enters with them; the push-off then runs on everyone's first-N results, the same noise for all. A newcomer among the 8 weakest members there leaves at once (`leave` with `early`), unless its nearest warrior is weaker still (mostly its first parent: then the whole results decide which of the two goes). Every other newcomer plays the rest of its rounds first (event `complete`), and the push-off decides on the whole results, so no newcomer pushes out a member on the noise of its few rounds |
| `--fill`, `--no-fill` | fill | new random warriors until the list is full, not only in the first batch: with a list of 80 about 5 batches of them, and the push-off keeps the most different ones |
| `--changes name=w,...` | see below | how often each kind of change is drawn, weights of any scale; a kind not named is never drawn. The names are those of the dashboard's Operators tab and of `42spectrum`: `opcode`, `modifier`, `a-mode`, `b-mode`, `a-operand`, `b-operand`, `org`, `replace`, `insert`, `delete`, `duplicate`, `move`, `crossover-insert`, `crossover-replace`, `related-opcode`, `related-mode`, `shared-constant`, `tune`, `random-loop`, `shared-target`. The default is `opcode=81,modifier=81,a-mode=54,b-mode=54,a-operand=108,b-operand=108,org=27,replace=27,insert=100,delete=100,duplicate=70,move=70,crossover-insert=60,crossover-replace=60`, the rates from before the option (since the option, 15th November 2026, a seed gives another run than before, also with these rates: a change that does not fit is drawn again instead of becoming the next kind). The one evolution option a run that continues takes: from then on its children get the new weights (event `changes`, and the state keeps them), and the run is no longer the one it would have been without a break |
| `--bench-every N`, `--bench-rounds N` | 10, 100 | the best member against the panel plays the holdout every N batches |
| `--init-length N` | 10 | the longest random warrior of the start |
| `--size --cycles --processes --length --distance` | pMARS's | the rules, e.g. `--size 800 --cycles 8000 --processes 800 --length 20 --distance 20` for the tiny hill |
| `--seed N`, `--threads N`, `--batches N`, `--seconds S` | 1, all | |

The defaults are the settings of the best run of the E5 comparisons (the eighth, 119.1 against the 1,107 '94nop Koenigstuhl warriors after an hour): a list of 80, a picked panel of 20 at 500 rounds a match, the push-off's SD-score over the panel only, 10 members in the screen, `--stage` at the screen rounds and `--fill`; since then mirrored positions, the push-off pareto-sd and `--screen-stop 3` (20th November 2026: it stopped 10,639 of 17,025 children of kd1 in the screen, 22% of all rounds, and missed none of the 2,400 survivors). A run started before keeps its own settings; the comparisons below name theirs.

The run folder gets `events.jsonl` (everything that happened, one JSON object per line), `state.txt` (to continue) and `best.red` (the best warrior against the holdout so far). After each batch the event `parents` has, for every member that was a first parent in it, how far its children got: `[id, bred, evaluated, past the screen, still in after the batch]`.

## How it works

**The list.** Like YACE: a list of evolved warriors (80 by default), and each newcomer plays the whole list. The list is kept by the diversity push-off of [Tournament Weekend 2026](https://corewar.co.uk/tournamentweekend2026a.htm): each warrior's value is its average score times the lowest SD-score between its row of scores and the row of any other warrior; when the list has 21, the lowest value leaves. A close clone of a strong warrior has a distance near 0 and goes first, so the rule keeps the list diverse. The math is [`tools/diversity.js`](../tools/diversity.js) and [`evolver/pushoff.c`](../evolver/pushoff.c), the same operations in the same order; [`tools/pushoff.mjs`](../tools/pushoff.mjs) ranks a whole tournament that way. The SD-score is from [Ismael 2025](https://doi.org/10.1186/s40537-025-01091-z), whose Eq. 6 (`--sd sum`: sum of differences over sum of standard deviations, the order of plain Manhattan distance) and pseudocode (`--sd opponent`: each column divided by its own standard deviation) differ.

**The matrix.** Rows and columns are the panel (20 picked hill warriors by default, they never leave) and the members. So a warrior's row is its score against the panel and the other members, and the distance to the nearest panel warrior counts too: copying a hill warrior does not pay either.

**A batch.** 4 candidates per thread are bred from the list (tournament of two on the push-off value). The screen plays each against the panel and 10 members of the list for 20 rounds. Those with at least 0.8 of the weakest member's average against the same opponents, at most batch / 8 of them, play 20 rounds against every member and every survivor before them, and enter one by one with those results (`--stage`, by default at the screen rounds). The push-off on everyone's first 20 rounds sends a newcomer among the 8 weakest away at once, about 80% of them in a long run; every other one plays the rest of its 100 rounds against everyone, and the push-off on the whole results decides. Without `--stage` (`--stage 0`) every survivor plays all 100 rounds before it enters. Candidates whose warrior is one of the last 16,384 that were tried are skipped. Every match uses the seed of its opponent, so all candidates meet an opponent at the same positions and differ by their code, not by their luck.

**The genome.** [`evolver/genome.c`](../evolver/genome.c): a list of instructions whose operands are typed, a reference to an instruction of the genome or a value. A reference becomes a relative offset only when the genome becomes a warrior, so inserting, deleting or moving instructions keeps what it points at; with raw offsets every insertion breaks the references that cross it. Changes: a field of one instruction (opcode, modifier, mode, operand, start, the whole instruction), insert new instructions, delete, duplicate or move a block, and crossover, a block of another member inserted or put over a block; and four small steps, off by default: an opcode or mode of the same family, a far value set to another one of the warrior, a far value moved a little (see the mutation spectrum below); and `random-loop`, off by default too: 2 to 5 new random instructions, the last a jump back to the first (`DJN`, `JMN`, `JMZ`, or `SEQ`/`SNE` and a `JMP`), in place of as many old ones as the length limit needs (#201); and `shared-target`, off by default: a far value set to point at the cell another far value points at, its value plus the distance between the two instructions (#172, from RedRace). A child gets 1 change, and one more with probability 0.35 each time, up to 6; each is drawn by the weights of `--changes`, and drawn again when it does not fit (an insert at the longest length, a crossover without a second parent). A copied block keeps its references inside the block; references out of it go to the original (duplicate) or become plain offsets (crossover). No strategy is built in: no qscan, paper or stone templates.

**Names.** Each warrior that enters gets a name of its own adjective and its family's noun. The family is its first parent's: a child of "Crimson Mantis" may be "Sneaky Mantis". It starts a family of its own, with a new noun, when it plays clearly unlike its first parent: its scores against everyone else in differ from the parent's by more than 30 points per 100 rounds on average (`parentDifference` and `newFamily` in its `enter` event; in the runs of 15th November 2026 the median was 1 to 9, and 0.1 to 2.3% of the children were above 30). Without that rule every run ended with one noun, the descendants of one early warrior, whatever they played. A warrior bred from nothing starts a new family too. A name given before gets a Roman numeral ("Sneaky Mantis II"), so names are unique in a run. 128 adjectives and 128 nouns ([`evolver/names.c`](../evolver/names.c)); the dashboard colors a family alike, a new family in a new color. Names change nothing else; the number of a warrior (`id`) stays the key in the events.

**All cores.** One thread per hardware thread, each with its own `m42_ctx`, takes matches from one shared queue; the main thread plays too. A match is one pair and one block of rounds, at most 100 rounds, so the queue has no long tail at the end of a phase. On the run below, 16 threads were 97.7% busy over 600 s, measured as time inside `m42_match()` over threads times wall time. The plan in #142 had batches bred one batch behind so that no thread waits at the end of a batch; with matches this small that was not needed.

**Two answers to the long run below** (`--select value`, `--rotate N`, `--race N` and `--fractions p` were removed in #193). `--select value` picked the survivors of the screen by an estimate of their push-off value instead of their strength: the screen gives a candidate's row against the panel, so its SD-score to every warrior in can be computed on the panel columns. Every newcomer logs its `estimate` and its `screenPoints`, also with `--select screen`. `--rotate N` replaces the oldest panel warrior every N batches with the next one of the folder (those that leave go to the end of that queue), so the list cannot tune itself to 40 fixed opponents; the event `rotate` has the new warrior and its matches. Whether they help is E5: measured against the holdout at equal time. `--fractions p` comes from YACE (2000, GPL): half of its numbers are a small value plus 1/2, 1/3 or 1/4 of the core, the distances of bombers and replicators, which a uniform far value almost never hits. Its source was read by a separate agent that wrote down the ideas in prose; nobody who writes 42evolve read it. YACE has no crossover, no references that survive insertions and no start that changes; its other ideas (a hill with a spare slot and a cached score matrix, a cheap screen before a precise test, champions brought back, replacement of a similar member) are here in some form already. Not taken yet: a test against a one-line `spl 0` before the screen, which throws out warriors that die at once. `--race N` makes the screen cheaper: on the tiny hill (batches 2 to 9 of 10, batch 128), `--race 4` played 1,082,400 instead of 1,548,000 rounds and 10.1 instead of 12.3 million instructions per candidate, 18% less. The survivors' full matches cost more than the screen, so it pays most together with fewer survivors.

**RedRace.** [RedRace](https://corewar.co.uk/hillis/) by Dave Hillis (2001, C) evolved `h1_36`, the first evolved warrior to win a tournament. It started as Jason Boer's ga_war and keeps some of its code; its author calls the rest not copyrighted, except the calls of the exhaust simulator (GPL). Its source was read in a session that wrote no code; this paragraph and [#172](https://github.com/martinus/42mars/issues/172) are what 42evolve takes from it. A population of 100 plays a hill of 8 evolved warriors, 50 rounds for each pair, so the opponents are evolved warriors only and move all the time: the race of the Red Queen. In each generation, all members are scored again on new start positions, the same for every member against one hill warrior. 100 children replace the weakest member one at a time (tournaments of 2, crossover in 70%). The best member goes into an archive of 50, and it replaces the weakest hill warrior if it scores more over 200 rounds. A child that is an exact copy of a member is bred again. A child with the same score as a member in every hill column dies; if it is shorter, the member dies instead (parsimony). A far value is a random cell in half of the cases; in the other half it points at the same cell as another field of the warrior, its offset adjusted by the distance between the two lines. Most of its other ideas are here in some form already: the archive brought back (`--reintroduce`), a start where each random warrior must beat the one before (the screen and `--fill`), more MOV and SPL (`--prior hill`), offsets repaired after an insertion (references in the genome). From #172: a far value with the same target as another field (the change `shared-target`; `shared-constant` copies the value, not the target) and the shorter of two warriors with equal results (`--parsimony`), both off by default until runs measure them. Not taken yet: several lists that play one shared hill, and a warrior back from the archive with changes (below).

**What it does not have yet.** An LLM as mutation operator, islands, an opponent ladder (the panel is a random sample of the folder, weak and strong warriors), MSVC (it needs POSIX threads and `dirent.h`).

## The dashboard

[`ui/evolver.html`](../ui/evolver.html), on the events of a run: live through `node tools/serve.mjs --run <folder>`, or `?log=<url of an events.jsonl>`, or an `events.jsonl` dropped on the page. A switch to a run keeps the picture of the one before until the new run's history is in (the server's event `live`), then draws it in one go: rows in their places, nothing flaring. Live events are applied every 2 seconds (`?every=<seconds>`, 0 at once); in between the matrix stands still, nothing moves or glows (a newcomer takes its place at once), and the newcomers that came and went in one update are one line in the ticker. A run with `--stage` on 32 threads writes about 4 batches a second, and drawn as they come the matrix took a core of its own. A history longer than 16 MB goes out compacted: without the warriors that left (except each that set a new best against the holdout, so that the ★ best chip names the warrior of `best.red`), with only the last `values` event, and with the progress chart of every batch computed from the whole history (the event `compacted` carries it); a continued run of 7,453 batches had 463 MB of events, of which 5 MB are left that way, and the page showed nothing while it read them all. The server keeps the compacted history for the next page (the first took 21 s for 463 MB on a busy machine) and makes it again once the run has grown by another 16 MB; `serve.mjs --full` sends everything.

The page (21st November 2026): the list of runs on the left; the matrix the whole height, beside it the selected warrior (always in view; its results against the members and its matches below it in a box that scrolls on its own), and on the right the arena, progress and the tabs (Kinds, Lineage, Events, Operators, How it works). A switch to a run selects its best member against the panel, until the user selects something. The selected warrior goes into the arena as its first, red warrior, against the opponent chosen below the arena (remembered): a dummy that sits still (`JMP $0`, the default, to see what the warrior does on its own), the Imp, the Dwarf, a stone, a paper or a scanner (not matches of the run, seed 1; the last three are `warriors/lantern.red`, `origami.red` and `seeker.red` with their constants from the core size, since those assert a core of 8000; a standard warrior that does not assemble under the run's rules is not offered), or its match: the member that beats it most clearly, else the panel warrior it does worst against. A click on a matrix cell or a ▶ plays that match of the run; a warrior selected then plays the same opponent if they have a match, else its worst one. ↑ and ↓ select the warrior above or below in the matrix. Esc, the × of the warrior or a click beside the warriors of the lineage selects none. Only code is in a fixed-width font. The novelty map is gone.

- **Score matrix**: the members by push-off value, against each other and the panel, points per 100 rounds. A click on a cell plays that match in the arena. The selected warrior's row (its matches) and column (the others' matches against it) have a gold frame. After each member's name come its length in instructions, its age (the batches since it entered), its score (the push-off's average; over the panel columns only with `--average panel`), its SD-score to the nearest and its push-off value; a click on one of those headings sorts the evolved warriors (rows and their columns) by it, a second click turns the order around. Each number, also those over the panel, is colored by where it lies between the lowest and the highest of its column: blue, grey, amber. Hovering a heading explains its number. Over the panel columns are three bands: the panel warrior's strength (its own average against the rest of the panel), the evolved warriors' average score against it, and their SD (the standard deviation of their scores against it, what the SD-score divides the column by). Where the columns are 9 pixels wide or more the bands are numbers written upright, else strips from dark (lowest) to bright (highest); hovering one shows all three numbers, a click selects that panel warrior. A click on a band's heading sorts the panel columns by it, again the other way round (by SD first: the columns that tell the list apart).
- **Lineage** (tab): every warrior that stayed past its batch, by its batch and its score against the panel, large while in the list; a ring where a new family starts (its scores were more than 30 points per 100 rounds from its first parent's, on average over everyone in). A click on a warrior shows its line: its first parents in yellow, crossover parents dashed in cyan, its descendants in white, everything else dimmed. Without a click there are no lines: the faint lines from every member to its parents did not say which one was meant.
- **Operators** (tab): per kind of change its children, the share past the screen, the share kept after their own batch with a bar (the longest bar: the change whose children were kept most often), how many stayed 5 batches, and the mean change against the first parent.
- **Progress**: the best and mean member against the panel, and the best against the holdout, over the batches.
- **★ best** in the header is the best warrior against the holdout warriors so far, also after the push-off removed it from the list (the same warrior as `best.red`); **strongest now** is the member with the highest average against the panel. A click selects it. The best one has a ★ in the matrix.
- **The selected warrior** is always shown, next to the matrix: its scores (against the panel, the holdout, the other members, and how many members beat it), parents, nearest warrior, its style (below), generator and code, its result against each panel warrior and against each member (red where the member wins more rounds), every match worst first with a ▶ that plays it in the arena, and its line of first parents back to where its family came from.
- **Arena**: the selected match in the visualizer's core view, in the page: `ui/index.html?embed`, the battle view with only its clock (round, cycle and a bar of the round's cycles) over the core, without the title, cast, legend, timeline and the texts over the core, paused until play, at the watch speed (2,500 instructions a second) with its speed slider. It is loaded once; a new match changes only its `#battle=`, which it loads in place, so nothing flashes and the speed stays; the speed set is also kept for the next page (`localStorage`). "larger" lays it over the whole page, Esc back.
- **Kinds** (tab): the members by kind of style (the style of a newcomer, below), as shares stacked over the batches: what the list is made of and when that changes. A compacted history carries it like the progress chart (`kindCounts()` of `tools/progress.js`).

**Several runs**: `node tools/serve.mjs --run ~/42evolve.a ~/42evolve.b ...` (one `--run`, any number of folders, so `--run ~/42evolve.*` works) serves each run's events; `ui/evolver.html` is then one dashboard for all of them: a list on the left names each run with its batch, the age of its `best.red` (batches since it was found) and its score against the holdout, colored from red for the lowest of the runs to green for the highest (a click on a heading sorts by that column, a second one turns the order around; a grey dot when the run has not written for 3 of its batch times: such a stopped run goes into a second part below the running ones, and its cores busy chip says stopped; the islands of a run, which take turns, count as running while any of them writes, apart from those the score stopped (0 in the `live` line of `islands.txt`); a field above the list shows only the runs whose name contains its text), a click or `[` and `]` switches the page to another run, and `?run=<n>` keeps which (0 is the first); the list comes from `/runs`, every 5 seconds. Besides, [`ui/runs.html`](../ui/runs.html) shows them all on one page: the best against the holdout and the best member against the panel over the minutes of each run (the fair axis when runs share a machine), and a table with the settings in which they differ, where each stands, the speed, the families and the opcodes of the list.

The arena loads `ui/index.html?embed&paused&speed=9#battle=...`, which carries both warriors, the rules, the seed and the rounds; opened by itself, without `embed`, that page starts in the grid layout at learn speed, every step explained (`?layout=ring` and `?speed=` before the `#` still win). The visualizer plays the same rounds as the evolver did: the WebAssembly build gives the same results as the native one, and stepping a match round by round with a watch gives the same rounds as `m42_match()`. `test/evolver.test.js` replays logged matches in the WebAssembly engine.

## The status of a run: `tools/run-report.mjs`

```sh
node tools/run-report.mjs ~/42evolve.a [~/42evolve.b ...] [--full] [--json]
node tools/run-report.mjs ~/42evolve.a --bench --opponents warriors/koenigstuhl/94nop [--rounds 100] [--jobs N]
```

What took many commands per look, from the run folders alone (a run folder or a folder of islands; no games without `--bench`):

- **The islands**: per island its last batch and list, the best against the whole opponent folder at each score of `islands.jsonl` (the best of best.red and the 3 best by panel average; up to 8 of the scores, the last one is the score now), the best of all scores and its batch, the best member against the panel now and the best against the holdout so far. `*` marks an island the score stopped.
- **The 3 best by panel average of each island now**: name (its noun is the family), kind of style (a word for each kind of `tools/style.js`) and opcodes, then the opcode sequences most of them share and on how many islands: one design that took every island shows at once.
- **New designs**: a family or kind of style the first time it holds a place among the 3 best of an island for 10 batches in a row, with the batch it came in (without `--full` the last 6). Without the 10 batches the list is noise: the 3 best are often tied with others, and an island of 6,500 batches had 150 families there for a batch or two.
- **The line of best.red**: its first parents back to a random or start warrior, across islands (a migrant goes on in the island it came from: of the warriors of its `migrate` event, the first with its code that was a member then, as 42evolve plays them; a step `?` where none is known, or where one before it is not known and may have had the same code), the changes that made each step and how often each kind of change is on the line. Without `--full` only the steps that changed the opcodes or the island, and the last 3.
- **Several runs**: each as above, then the same numbers side by side at the last batch all of them have.

`--bench` plays the folder's best.red and, of each island, its best.red and the 3 best by panel average against every warrior of `--opponents`, under the rules of the run, as `tools/tournament.mjs --bench` plays one warrior (the same positions, so the same result), all of them in one task list on all threads: the warriors the rule of a look scores. `--json` gives everything as JSON.

It reads `events.jsonl` with `RunDigest` of `tools/progress.js`, one worker thread per island: only the event types it needs, an enter event only up to the warrior's code, and of the warriors only those that can be ancestors (those that stayed past their batch or had children). On 25th November 2026, with a load of 76 on the 32 threads (runs in the idle class and other agents): `~/42evolve.94-own16` (16 islands, 870 batches, 1.5 GB of events) in 10 s with at most 620 MB, 9.7 s of CPU time; `~/42evolve.tiny-own16` (16 islands, 6,560 batches, 9.7 GB) in 36 s with at most 1.1 GB, 41 s of CPU time, so about 3 s on an idle machine; one island of it alone (614 MB) 2.5 s of CPU time and 140 MB. Most of the memory is the 16 worker threads, each about 65 MB; `--jobs 4` keeps it near 300 MB. `--jobs` also sets the threads of `--bench`. `test/evolver-report.test.js` checks the table, the 3 best, the line and the new designs against the events read whole, on a run of 2 islands.

## E5, eighth comparison: diversity measured against the panel

15th November 2026, one run on 32 threads at nice 10, an hour: a list of 80, a panel of 20 warriors picked as before (the 10 of the sixth comparison plus `omms.red`, `harbinger.red`, `hfb.red`, `unpit.red`, `mandragora.red`, `forty.red`, `gigolo.red`, `perseus.red`, `outcast.red`, `geist.red`: papers, a stone with imps, a vampire, scanners), `--screen-members 10 --diversity panel --panel-rounds 500 --fill`, `--stage` at its default. The push-off's average is over everyone, its SD-score over the 20 panel columns only, each of 500 rounds.

| Run | Batches | `best.red` | 3 best by panel average | 3 best by row average |
|---|---|---|---|---|
| seventh comparison: list 90, 10 panel, distance over all | 2,884 | 93.4 | 87.7, 79.7, 88.6 | 78.7, 88.1, 79.6 |
| list 80, 20 panel, `--diversity panel --panel-rounds 500` | 3,237 | **119.1** | 119.1, 115.2, 118.8 | 113.4, 110.2, 109.4 |

The first run from random code above 102 against the 1,107: 17.5 points above the best before, near the median hill warrior of the sample (144.7) by a third of the way. The list by style (below), graded at four points of the run:

| Batch | Mean vs panel | Writes fields | Throws copies | Reads first (scanner) |
|---|---|---|---|---|
| 729 | 68.1 | 38 | 31 | 9 |
| 1,460 | 75.3 | 52 | 17 | 11 |
| 2,191 | 83.8 | 22 | 18 | 37 |
| 2,922 | 84.6 | 8 | 11 | 59 |

Until batch 1,500 the field writers of the earlier runs led; from about batch 1,700 on warriors that read far cells before they write took the list over, the scanner of the hill, with `MOV` 53% of the list's instructions. `best.red` is one of them (600 cells read, 1,232 written). The first time a run from random code changed its design to one of the hill's. It also shows the limit: the new design took the list as the old one had. Hence `--niche N`, places that a kind of style keeps.

## E5, ninth comparison: archives, specialists and a panel of every kind

15th November 2026, an hour each from random code, scored against the 1,107 '94nop Koenigstuhl warriors (`best.red`, then the 3 best by value or by panel average). Runs side by side share the machine: their numbers compare with each other, not with the 32-thread runs above.

| Run | Threads | Batches | `best.red` | 3 best |
|---|---|---|---|---|
| me1: `--map-elites`, cells by style, panel 20 picked, no margin (19 minutes) | 32 | 974 | 117.8 | |
| me2: `--map-elites`, panel 80 random at 125 rounds, margin of 2 standard errors | 32 | 885 | 106.3 | 104.3, 96.2, 94.6 |
| cr1: `--map-elites crowding`, uniform parents (stopped at 30 minutes) | 32 | 230 | 93.9 | 93.6, 94.2, 93.3 |
| cr2: crowding, parents by a tournament of 2, "far" above half the archive | 16 | 454 | 105.6 | 105.6, 101.9, 100.7 |
| pd81: the defaults (batch 64, from the thread count) | 16 | 2,441 | 88.6 | 87.2, 80.5, 79.9 |
| sp1: the defaults, `--batch 128 --panel-choice kinds --specialists` | 16 | 772 | 87.6 | 87.6, 84.7, 84.8 |
| kd1: the defaults, `--batch 128 --panel-choice kinds` | 16 | 906 | **113.2** | 107.4, 113.4, 100.9 |

- The cells by style stalled: with the margin me2 filled 40 cells by batch 600 and replaced a cell's warrior about every 5 batches at the end. Without it me1 climbed faster, but its replacements were noise (+0.66 each, about one standard error).
- Crowding with uniform parents kept a weak half (median 68 against the panel, top 100); the tournament and the floor lifted it by 12 points, still 8 below kd1 on the same machine.
- The panel of every kind lifted the list by 25 points over pd81 on the same machine. Part of that may be the batch: pd81 had 64 children a batch, kd1 128.
- `--specialists` found match-ups nobody else won (218 against Stingray, where kd1's best had 97) and the first papers (the Moose family, about 50 entries per 50 batches, 2 in the list at a time), but its 18 protected places cost 26 points: the 3 strongest by average scored 58 to 65 against the hill.
- In kd1, 434 of the 623 members that left after their own batch (second half) were pushed out by their nearest warrior in the batch it entered, 325 of them by their own child; the newcomer was stronger against the panel in 249 of 436, median +0.1 points: near twins that swap on noise.
- All lists kept the same holes: 55 to 73 of kd1's 80 members lost to each of the panel's papers (lzma2, VoyagerBullet v2, RetroQ) and imps (King of Metal, Ziggy, Ethanol vE). Hence `--sharing c`.

## E5, tenth comparison: sharing, and seeds of every kind

The night of 15th to 16th November 2026, CPU clock limited to 4 GHz (about 17% fewer instructions a second than before), scored against the 1,107 '94nop Koenigstuhl warriors (`best.red`, then the 3 best by value and the 3 strongest by panel average). All with `--panel-choice kinds --batch 128 --seed 2`, two runs side by side on 16 threads each. Seed 2 picked another panel than kd1's seed 1.

kd1 (seed 1) went on for 2 more hours on 32 threads: 7,453 batches, `best.red` 130.7, the 3 best by value 130.7, 124.4, **133.5**, the strongest by average 105.7, 101.6, 95.1. From random code nothing scored higher before (pd80: 125.0 after 2h10).

| Run | Batches | `best.red` | 3 best by value | 3 strongest by average |
|---|---|---|---|---|
| sh2: `--sharing 50`, an hour | 396 | 99.8 | 92.8, 93.6, 97.3 | 83.8, 71.8, 78.8 |
| kd2: control, an hour | 407 | 103.3 | 104.1, 87.7, 97.8 | 67.1, 73.0, 86.1 |
| ss2: `--start warriors --sharing 50`, an hour | 173 | **138.9** | 137.4, 134.2, 138.5 | 131.5, 135.5, 137.9 |
| sk2: `--start warriors`, an hour | 184 | 136.8 | 133.8, 136.0, 135.6 | 134.6, 135.7, 134.5 |

- Sharing did not help in an hour from random code (99.8 against 103.3). With c 50 the weights of the hardest and the easiest panel warrior differed by a factor of 1.92 only. The holes moved instead of closing: 12 of sh2's 80 members lost to Scanny Boy against 50 of kd2's, 70 to Valkyrie against 43.
- Both lists from random code had papers for the first time (sh2 18, kd2 8).
- The seeds alone score: Origami 134.9, Lantern 90.1, Dwarf 66.9, Imp 58.1, Seeker 55.3. The seeded runs gained 2 to 4 points over Origami in an hour, and collapsed onto it: after 170 batches 79 of 80 members were papers from Origami (the Wombat family), the 80th a stone of Lantern with an average of 24.7 that tops the push-off value by its distance alone (43).
- ss2's holdout benchmark stayed at 134.0 from batch 109 on: it runs when the strongest member against the panel changes, and the top against the panel stayed at 103.7 from 03:00 to 06:00. The papers changed families (Kraken took 38 of 80 places), not strength.

ss2 went on until 06:45 on 16 threads (1,005 batches in all): `best.red` still 138.9, the 3 best by value 137.4, 138.4, 132.6. The same seeds with `--specialists` instead of `--sharing` (sps2, 04:00 to 06:45, 322 batches): `best.red` 136.0, the 3 best by value 131.2, 132.9, 133.3; 78 of its 80 members were papers of one family, and 14 of the 20 protected members papers: Origami's descendants were the best against the imps and scanners of the panel too.

Without Origami (np2: Dwarf, Lantern, Imp, Seeker, `--sharing 50`, 2.5 hours on 16 threads, 2,611 batches) the stones of Dwarf and Lantern took the list (58 stones, 18 scanners at batch 1,400) and got better: `best.red` 112.9, the 3 best by value **113.0**, 103.8, 105.1, the strongest by average 88.2, 80.3, 104.1, 23 points above Lantern. `best.red` is the classic stone loop of `SPL`, `ADD #1891`, `MOV.I $7, >8` and `DJN`, with lots of code that never runs after it.

## E5, twelfth comparison: the push-offs on the '94 and the tiny hill

18th November 2026, pareto-sd became the default. Each arm is one process of islands with one panel of 30 picked by kinds, `--batch 128 --screen-stop 3 --positions mirror`; after 100 batches each island's `best.red` and its 3 members best against the panel play the whole folder (100 rounds), the best of the four is the island's score, and the 2 best islands go on. The same seed gives an island the same start in every arm, so the arms are compared island by island.

'94nop, 8 islands each (seeds 101 to 108), 4 arms at the same time, against the 1,107:

| push-off | mean | standard deviation | worst, best island |
|---|---|---|---|
| value | 97.9 | 9.1 | 80.2, 106.2 |
| pareto-age | 100.7 | 7.8 | 88.0, 110.3 |
| **pareto-sd** | **104.0** | 2.9 | 98.4, 106.2 |
| pareto-sd, `--difference ahead` | 97.2 | 10.1 | 82.7, 105.8 |

The tiny hill (`--size 800 --cycles 8000 --processes 800 --length 20 --distance 20`), 16 islands each (seeds 201 to 216), 5 arms on 6 threads each, against 429 of the tiny warriors:

| push-off | mean | standard deviation | worst, best island | minutes of batches to batch 100 |
|---|---|---|---|---|
| value | 88.7 | 9.8 | 76.5, 109.7 | 116 |
| pareto | 88.7 | 15.5 | 63.5, 123.0 | 171 |
| pareto-age | 91.9 | 13.9 | 74.4, 119.8 | 174 |
| pareto-sd | 91.2 | 13.2 | 81.3, 125.6 | 146 |
| pareto-sd, `--difference ahead` | 85.9 | 9.5 | 73.9, 113.8 | 172 |

- On '94 pareto-sd is 6.1 ahead of value island by island (t 2.0, ahead on 6 of 8) and has the smallest spread: its worst island is close to the best of value. On the tiny hill it is 2.5 ahead (t 0.7, 9 of 16); pareto-age is 3.2 ahead there.
- `--difference ahead` is last on both hills. It was removed in #193, as was pareto-age.
- The start decides more than the push-off in 100 batches: island 16 was the best island of all five tiny arms (116 on average, the other islands 81 to 101).
- After the selection pareto-sd goes on and value stops: the island of seed 216 of value had 110 at batch 200, 130 at 500 and 134 at 1,300 (132 to 135 from batch 600 on); the same island of pareto-sd 137 at batch 200 and 146 at 500. In about the same minutes of batches (175 and 176) value ran 1,300 batches, pareto-sd 500, and the two islands of pareto-sd averaged 142.5 against 134.9. One pair of islands.
- The pareto push-offs take 25 to 50% longer per batch at the same instructions per round.

pareto-sd keeps fewer families than value: at batch 99 the median island had 9 against 12 on the tiny hill, 6.5 against 14 on '94 (pareto and pareto-age 1 to 2.5), and its members were half as far apart in points against the panel. `--clear` (clearing) was to give that back; pareto-sd with `--clear 5` and `--clear 10` on the same 16 seeds, the same panel:

| | value | pareto-sd | `--clear 5` | `--clear 10` |
|---|---|---|---|---|
| families at batch 60, median of 16 islands | 11 | 9 | **16** | 13 |
| nearest member, points per panel warrior | 9.1 | 5.2 | **9.7** | 5.0 |
| batch 100, mean of 16 islands | 88.7 | **91.2** | 87.1 | 89.9 |
| the 2 islands that went on, batch 500 | 129.9 | **142.6** | 125.0 | 128.5 |
| batch 1,000 | 133.6 | **147.5** | 138.3 | 134.6 |
| batch 2,000 | 139.9 | **150.9** | 150.5 | 135.8 |

- `--clear 5` keeps the diversity of value and reaches the score of pareto-sd, later: 17 points behind at batch 500, level at 2,000. The island of seed 216, the best in every arm: pareto-sd 145.6 at batch 500 and 150.1 at 2,000, `--clear 5` 122.2 and 150.2.
- `--clear 10` clears almost every member (the median SD-score to the nearest was 3.3) and then ranks the cleared ones by plain NSGA-II; its island of seed 216 stayed between 122 and 127 for 1,800 batches.
- So the default is pareto-sd without clearing. Two islands per arm after the selection.

## E5, thirteenth comparison: an SD-score without the level, `--difference shape`

`--difference` (shape and ahead) was removed in #193: shape made no difference here, ahead was last on both hills in the twelfth comparison.

19th and 20th November 2026, #167. The SD-score to the nearest goes against strength in every list, and the idea was that `|a_k - b_k|` mixes how strong a warrior is with against whom it does better. `--difference shape` counts `|a_k - b_k - c|` with the c that makes the sum smallest, the weighted median of the differences (weights 1/σ_k): two rows that differ by a constant are at distance 0.

**Offline first.** The lists of 16 islands of pareto-sd on the tiny hill at batch 99 (the seeds 217 to 232 below, without shape), every member's distance to its nearest both ways:

- The distance goes against the panel average the same with shape: median rank correlation -0.72 both ways (-0.90 to -0.56), and the two distances correlate 0.99 to 1.00. So do the other distances that ignore the level, computed on the same lists: the shift by the mean (-0.72), b scaled and shifted onto a by least squares (-0.70), 1 minus the correlation of the two rows (-0.73).
- The level is not why the weak members are far. Of the weakest quarter, 16 to 19 of 20 have their nearest in the weakest quarter too (6 islands). Their distance to the nearest of the strongest half is 15 to 35% smaller with shape, and still 15 to 18, against about 8 to their nearest. The list packs the strong members into one design (on island 07 the 20 strongest are clones of one family, distances 0 to 0.5) and the weak ones lie far from it and from each other: it is density, not level.
- Who the far weak ones are, on island 07: other designs, mostly. Scanners of two families (17 to 46 points against the panel) next to the field writers of the strong family; one member of 3.6 is near broken.

**The runs.** The setting of the twelfth comparison: 16 islands per arm, one panel of 30 picked by kinds, `--batch 128 --screen-stop 3 --positions mirror --pushoff pareto-sd`, the score at batch 100 against the 429 tiny warriors, the 2 best islands go on. Three blocks of seeds, 201 to 216 (the twelfth comparison's; abs gives its numbers again exactly, also those of its islands that went on), 217 to 232 and 233 to 248, so 48 pairs of islands with the same start:

| | mean | standard deviation | worst, best island | families at batch 99, median of each block |
|---|---|---|---|---|
| pareto-sd | 89.9 | 10.3 | 79.7, 128.7 | 9, 10, 10 |
| pareto-sd, `--difference shape` | 90.7 | 10.8 | 76.6, 132.0 | 8.5, 8, 10 |

- shape - abs, island by island: +0.8 (standard deviation 9.6, t 0.55), shape ahead on 22 of 48; per block +3.0, -1.7 and +0.9. No difference.
- The islands that went on (2 per arm and block, the first two blocks), against the folder: abs 143.1 at batch 2000 and 143.5 at 2500 (mean of 4), shape 145.5 and 147.8. Different islands except two; on those two, seed 216: abs 150.1, shape 147.3 at batch 2000; seed 227: abs 143.7, shape 149.8.
- The seeds 201 to 232 with a third objective that does not go with strength by construction: the share of the 9 members nearest in panel average with a smaller SD-score (`--sd-rank 10`, tried on a branch, not in the code). 88.2 against 90.6 of abs on the same seeds, -2.5 island by island (standard deviation 9.8, t -1.4), ahead on 10 of 32; the families at batch 99 fell to a median of 2 and 1.5 from 9 and 10. The distance that goes against strength is what keeps other designs in the list: it is how pareto-sd keeps the weak ones that are different, and taking it out leaves one or two families.
- A batch took 16 to 23% longer with shape: its push-off sorts the differences of every pair for the median, on one thread. An insertion sort in place of `qsort` made that twice as fast since (`pushoff_values` on 110 warriors and 30 columns: 19.9 to 10.4 ms, abs 2 to 3 ms, on a busy machine).

Not kept: abs stays the default; `--difference shape` stays an option. The SD-score goes against strength because of where the list puts its members, not because of the level of a row, and that is what keeps other designs in a pareto-sd list.

## The panel by kinds and the batch of 128, at the same number of children

20th November 2026. The twelfth comparison ran `--panel-choice kinds` and `--batch 128` together. Each alone on the tiny hill: 16 islands per arm from seed 201, the defaults otherwise (a panel of 20, `--screen-stop 3`), 400 batches of 32 or 100 of 128, so 12,800 children per island, scored against the 429 tiny warriors (`--islands 16 --select-after`; a run with `--batches` equal to `--select-after` ends before it scores, one more batch does it).

| panel, batch | mean | sd | worst | median | best |
|---|---|---|---|---|---|
| picked, 32 | 89.5 | 10.4 | 71.7 | 87.5 | 106.1 |
| kinds, 32 | 84.7 | 8.9 | 73.8 | 82.6 | 99.8 |
| picked, 128 | 84.2 | 8.1 | 73.3 | 82.8 | 105.9 |
| kinds, 128 | 87.8 | 12.5 | 75.1 | 83.2 | 123.8 |

- Neither shows an effect: kinds less picked is -0.6 over both batch sizes (t -0.23, 32 islands each), a batch of 128 less one of 32 is -1.1 over both panels (t -0.42). The single differences go both ways, -4.8 and +3.6 for kinds, -5.3 and +3.2 for the batch, each within the noise (t between -1.6 and 1.0).
- The one island far ahead (123.8) has both, the setting of the twelfth comparison. One island is no evidence.
- 16 islands per arm see about 7 points. A smaller effect of either would need the 48 pairs of the thirteenth comparison.

The same pair on '94nop for `--average panel` against pareto-sd was stopped at batch 35 and 43 of 100 and gave nothing.

## Stages around evolved warriors

20th November 2026. Every evolved warrior so far is one phase: an `SPL` loop and one to three `MOV` streams of 2 to 7 instructions. Strong hill warriors are often several: a boot, a quick scan, the main loop, a clear. Would a stage written by hand lift an evolved one? Five warriors of `warriors/evolved/94nop` with stages written for this test (none taken from another warrior), each against the 1,107 '94nop Koenigstuhl warriors, 100 rounds (`tools/tournament.mjs --bench`, the same seed; about 0.4 points of standard error):

| | Cranky Mongoose VI | Twisted Jackal II | Restless Gremlin | Humble Sloth V | Scarlet Dodo II |
|---|---|---|---|---|---|
| as evolved | **142.7** | **139.7** | **139.3** | **135.3** | **125.0** |
| boot: the body copied 2000 / 4000 cells on and run there, the original left as a decoy | 135.3 / 138.0 | 136.6 / 138.5 | 130.4 / 136.2 | 133.5 / 133.6 | 124.9 / 123.9 |
| an imp, `MOV.I #0, 1`, in a process of its own | 134.3 | 125.8 | 133.6 | 128.2 | 115.9 |
| boot and imp | 128.1 | 85.5 | 131.3 | 118.1 | 110.1 |
| a quick scan in front (pairs of cells compared over the core, 20 `DAT` bombs around a find), 50 / 100 / 200 pairs | 126.8 / 127.4 / 127.9 | 127.8 / 130.3 / 133.7 | 126.4 / 126.8 / 128.5 | 128.4 / 129.7 / 130.9 | 78.9 / 104.0 / 113.7 |
| the same 16 instructions of the scan in front, never run | 122.5 | 120.5 | 121.8 | 120.8 | 14.3 |
| the body booted 4000 on, without / with the quick scan of 200 pairs first | 136.8 / 131.7 | 138.9 / 138.7 | 130.0 / 128.3 | 134.3 / 134.4 | 125.1 / 121.5 |

Two different designs in parallel (an `SPL` to the second, booted 4000 on) scored 88.4 to 126.4, below both of their warriors each time.

- No stage lifted a warrior. The imp turns wins into ties: an imp that runs into the opponent's code makes its processes imps too, which do not die (Cranky Mongoose VI: wins 46,301 to 38,737, ties 19,052 to 32,508). Two designs halve each other's turns and bomb each other.
- The quick scan wins a few hundred to 1,500 more games than the same layout without it, and loses more ties: the body starts up to 800 cycles later.
- Evolved warriors depend on what lies next to them: 16 instructions placed in front and never run cost 15 to 20 points, Scarlet Dodo II 111. They read the empty core around them as data (Twisted Jackal II: `MOV.I @-1, <3515` reads the cell before it). A stage that runs before the body, and changes its own counters next to it, changes the body. A composition of evolved parts has to give each part empty core around it, by booting it away.
- These stages are simple. Human quick scans find where the opponent is before they attack, and human decoys are built to stall scanners. The test says that adding a stage does not lift what evolution finds now; it does not say that stages cannot pay.

**A decoy left behind.** A small warrior is hard to find. The body booted on, with D cells of decoy left where it started (`DAT.F #i, #(37 i mod 800)`, all different, so that a scanner comparing two cells sees them):

| | boot | D 0 | D 20 | D 50 | D 85 | as evolved |
|---|---|---|---|---|---|---|
| Twisted Jackal II | 4000 | 138.5 | 138.8 | 139.7 | **140.5** | 139.7 |
| Humble Sloth V | 4000 | 133.6 | 134.2 | 134.8 | **135.8** | 135.3 |
| Scarlet Dodo II | 4000 | 123.9 | 125.1 | 125.6 | **127.3** | 125.0 |
| Cranky Mongoose VI | 2000 / 3000 / 6000 | 135.3 / 136.5 / 140.9 | | | 137.6 / 138.4 / **143.7** | 142.7 |
| Restless Gremlin | 2000 / 3000 / 6000 | 130.4 / 133.4 / 138.7 | | | 132.9 / 135.2 / **139.8** | 139.3 |

- 85 cells of decoy lift every warrior by 1.1 to 3.4 points over the same boot without one, rising with the size where measured. Against the warrior as evolved: +0.5 to +2.3.
- Where the body goes matters as much: Cranky Mongoose VI 135.3 booted 2000 on, 140.9 at 6000. At 4000 its streams (`MOV.I <0, <3989`) write onto the decoy it left behind, and the decoy cost it 3.8 points, Restless Gremlin 15.
- So a warrior that keeps most of its length behind as a decoy and runs a small part elsewhere gains a few points; the gap to the median hill warrior (145) and its top is much larger. Evolution could reach it with a change that wraps the running part in a boot to an evolved offset, the rest of the genome staying behind; not built. What came of it instead is a genome that can say such things in general, a program that writes the warrior: [`evolver-gen.md`](evolver-gen.md).

## E5, eleventh comparison: islands, the average over the panel, and a loop that stops early

16th and 17th November 2026, all scored against the 1,107 '94nop Koenigstuhl warriors, `--panel-choice kinds --batch 128 --screen-stop 3` unless said otherwise.

**Islands.** 8 runs from random code, seeds 11 to 18, 4 threads each, 2 hours:

| Island | Batches | Best holdout | Best of 7 against the 1,107 |
|---|---|---|---|
| isl11 | 709 | 142.5 | **139.3** |
| isl15 | 370 | 111.8 | 111.9 |
| isl13 | 288 | 114.3 | 111.3 |
| isl16 | 186 | 107.1 | 105.8 |
| isl12 | 117 | 107.4 | 103.5 |
| isl14 | 444 | 107.6 | 103.0 |
| isl17 | 204 | 108.5 | 100.2 |
| isl18 | 110 | 96.2 | 96.3 |

- The same settings ended between 96.3 and 139.3: which design a run finds is the largest effect measured so far. kd1 had 130.7 after 3 hours on 16 threads.
- In the same time the islands ran 110 to 709 batches: lists of long warriors with many processes play slow batches.

**A merge collapses with the average over the list.** The best warrior of each island as `--start` for one run (seed 19, `--specialists`):

| | mrg1: average over the list | mrg2: `--average panel` |
|---|---|---|
| Time, batches | 70 min on 32 threads, 1,789 | 27 min on 28 threads, 625 |
| `best.red` | 142.7 | **142.9** |
| 3 best by value | 134.6, 134.9, 130.9 | 140.1, 139.9, 142.2 |
| 3 strongest by average | 120.1, 118.4, 121.1 | 140.1, 139.9, 142.2 |
| The seed of isl14 (103.0) left at | batch 12, average 37.8, list median 147 | batch 28, average 79.8, list median 121 |
| Members by seed | isl11 79, isl12 1 | isl11 69, isl12 11 |

- In mrg1 the seed of isl14 had an SD-score of 5.8 to its nearest warrior against a median of about 4, and a quarter of the list's average: with 70 of 80 members scanners of isl11 that beat it, the average over the list is how well a warrior beats the majority. The SD-score of one warrior unlike 79 others stays small too: the column's standard deviation is taken over everyone in.
- The average over the panel slowed the takeover and did not stop it: 10 of the 11 descendants of isl12's seed in mrg2 were scanners.
- `best.red` of mrg1 (Cranky Mongoose VI, 4 instructions: `SPL.I #-3830, >-20`, `MOV.I *1, <1`, `MOV.I <0, <3989`, `DJN.X $-2, {1781`) copies cells in three streams that count down, 1,940 cells written after 4,000 instructions, 63 processes. `--optimize` took no step on it, against 20 warriors at 100 rounds and against 200 at 200.

**`--average panel` against the list average**, seeds 21 to 24 from random code, 4 threads each:

| Seed | al, 4 h | ap, 4 h | ap, 8 h | ap, 12 h | an, 4 h | an, 8 h | Batches in 4 h: al, ap, an |
|---|---|---|---|---|---|---|---|
| 21 | 99.4 | 99.3 | 119.1 | 119.1 | 99.5 | 105.3 | 609, 200, 1,225 |
| 22 | 106.2 | 106.0 | 105.6 | 105.6 | 104.6 | 104.6 | 262, 232, 1,417 |
| 23 | 114.7 | **126.8** | 126.8 | 126.8 | 109.4 | 109.4 | 1,664, 1,333, 2,675 |
| 24 | 103.4 | **118.0** | **139.7** | 139.7 | 99.9 | 101.3 | 1,161, 514, 2,128 |
| Mean | 105.9 | 112.5 | 122.8 | 122.8 | 103.4 | 105.2 | |

al: the average over the list. ap: `--average panel`. an: `--average panel --member-games none`. Each number is `best.red`.

- ap is ahead by 6.6 points after 4 hours with 33 to 89% of al's batches. Its 3 strongest by average score 102 to 120 on average, al's 70 to 92: the panel average ranks the list more like the hill does.
- ap concentrates families: at equal batches one family held 52 to 74 of the 80 places in three of the four ap runs, 6 to 39 in al. The fourth, ap23, had 53 families and the best score at 4 hours.
- ap stopped gaining between 8 and 12 hours.
- an plays 2 to 6 times the batches and ends 17.6 points below ap after 8 hours. In seed 23 its list is better against the panel than ap's (median 118 against 113) and 17 points worse against the hill.
- Games between members are 48% of the rounds of a batch (ap23: 154,280 rounds a batch, of them 13,789 in the screen, 25,600 in the first stage and 34,813 in the rest of the rounds).
- One parent of ap23 had 1,485 children past the screen; the 10% of parents with the most such children had 54 to 69% of them, and the children that stay fell from 2.4 to 3.0 a batch in the first quarter of a run to 0.9 to 1.7 in the last. Children of a crossover stay as often as those of a mutation (0.88% against 0.95% of 241,000 and 1,514,000).

**`--simple` on developed lists.** The final lists of ap21 to ap24 and an21 to an24 as `--start`, one thread each, 4 h 40 min. r: the run goes on as it was. s3, s1: `--simple` with z 3 and z 1 on the list's own panel. w1: `--simple`, z 1, a panel of about 55 at 200 rounds. The best of `best.red` and the 3 strongest by panel average:

| | Start | r | s3 | s1 | w1 |
|---|---|---|---|---|---|
| Mean of the 8 lists | 115.8 | 116.6 | 116.2 | 117.1 | 116.9 |
| Batches a run in the first 2 h 20 min | | | 40 | 263 | 274 |
| Of about 85 candidates a batch, those that play all rounds | | | 34.2 | 2.9 | 1.0 |
| Rounds a child that stays | | | 43,500 | 43,700 | 82,000 |

- No arm moved a developed list: all end within 1.3 points of the start. The one step of the slot, about 10 points on the list of ap22, was found by r, s1 and w1.
- How sure a stop is does not matter: z 3 and z 1 need the same rounds for a child that stays. With z 3 about 4 of 10 candidates of a developed list cannot be ruled out before their last round: a child of a member is good enough to enter, it just does not stay.
- `--simple` is no loss and no gain here. From random code it is not measured.
- `--simple` was removed in #193.

**The value bound stopped children that replace a member (#162, 19th November 2026).** The cut compares a candidate with the members' values from before it entered. A near twin of a member has a small distance and so a small value; once it enters, the member's value falls too, the push-off drops one of the two, and the other gets its old distance back. With `--screen-check 3` (the 164 warriors of `warriors/evolved/94nop` as `--start`, seed 162, 28 threads, 40 batches) the bounds of the average and of the distance held in every stop, but 136 of the 920 candidates the value bound would have stopped stayed past their batch: 23% of the 603 children that stayed. On the tiny hill with 2000 cycles it was 15 of 50 in 30 batches, each in the place of the member it was nearest to. Now the distance's upper bound leaves out the members whose panel average the candidate may still reach. The same run: 424 value stops, 8 of them stayed, and the batches play 51.7% of the rounds of whole matches instead of 42.0%. The 8 come from the cut itself: after a push-off with many newcomers the `--list`-th value can be far below the one before (520 against a cut of 790 in one batch). s3 and s1 above ran with the old bound.

**The panel as a yardstick.** The 80 members of ap24's list against the 1,107, and their panel averages:

| Panel | Correlation with the score against the 1,107 | Error of a line through it |
|---|---|---|
| 20 by kinds, 500 rounds | 0.77 | 7.1 points |
| 53 (three such panels), 200 rounds | **0.91** | 4.5 points |

The scores of the 80 spread by 11.1 points. 7 of the 20 columns do not go with the score at all (correlation -0.09 to 0.05: warriors the list beats anyway), the 20 columns are 7.2 independent directions, and 5 pairs correlate above 0.8, mostly the papers.

## A ring, a tree with restarts, nemesis islands: `--migrate-to next|tree`, `--leaf-restart N`, `--nemesis-every N`

Removed in #193: the ring (`tiny-ring16`) was 11.7 points behind its control at batch 1,000, the root of the tree stayed at 152 (below), and the nemesis islands (`tiny-nem16`) grew the same `SPL`/`MOV` design and were 3 to 5 points behind. What they were:

`--migrate-to next` sent to the next live island only (a ring, the last to the first). `--migrate-to tree`: the islands as a binary tree, island 1 its root, the children of island i are 2i and 2i + 1; each island takes one member of each of its children, the best by default, and the leaves take from none, so warriors only climb toward island 1 (Hierarchical Fair Competition, Hu and Goodman 2002: a new design meets the strong ones only once it has climbed). With 3 islands or more.

`--leaf-restart N`: with `--migrate-to tree` and migration, not with `--start` (a list that starts over would take the start warriors again): every N batches each leaf of the tree starts over. Every member leaves (event `restart`, then a `leave` for each), the archive is forgotten, and the next batch fills the list with random warriors as the first batch did; its `best.red` and scores stay. The leaves take turns: leaf j of L at the batches b > 0 with b mod N = j N / L, so there are always young lists of every age (the bottom layer of ALPS, Hornby 2006, which starts again from random warriors). On the tiny hill a list of random warriors needs about 100 batches to reach 120 against the hill. One run there (`tiny-tree16`, 22nd November 2026: `--island-panels own --migrate 5 --migrate-to tree --leaf-restart 200`, seed 201) had 15 families on top of 16 islands but its root stayed at 152 from batch 700 to 1350, against 159.5 at batch 1000 for the same run with `--migrate-to random` (`tiny-own16`): what the leaves found did not climb past the islands above them.

`--nemesis-every N`: with `--islands` (2 or more) and `--select-after` S, N a multiple of S; not with `--keep`, `--migrate-to tree` or `--start`. At the score every N batches the island with the lowest score stops (not the champion's, not a nemesis island younger than 2 N batches; its folder stays) and a new island takes its place: the next number, the settings of the one it replaces, the seed + its number − 1, the same holdout, and as its panel the warriors of the folder the champion (the best warrior of that score) does worst against, from the score's matches, none of the holdout. It starts from random warriors at the batch of the others and takes no migrants for its first N batches (a strong migrant would take over its list before anything new grows). The pressure follows the champion's weak spots: on the tiny hill in November 2026 that was imps and moving stones (38 of the 60 warriors Fickle Mosquito XLIV did worst against). Event `nemesis` in `islands.jsonl`; `serve.mjs` lists an island that starts later only after a restart.

## Specialists and a panel of every kind: `--specialists`, `--panel-choice kinds`

`--specialists` was removed in #193: its protected places cost 26 points against the hill (sp1 in the ninth comparison). `--panel-choice kinds` stayed, and is the default.

An hour of the defaults (pd81, 15th November 2026, 16 threads) kept 80 members whose rows against the panel differed, but 75 of them were the same design: SPL, MOV, DJN and ADD, a median of 825 processes and 1 copy of their own code. All 80 lost to King of Metal (6 points on average), 76 to procoptodon, 75 to Mirage 2: 6 of the 20 panel warriors beat everything evolved. A child that did a little better against one of them but worse overall left at once.

`--specialists`: for each panel warrior, the member that does best against it does not leave when its score there is ahead of the members' median by more than 2 standard errors of that score. Against a panel warrior that every member loses to, the best is luck, and nobody is protected for it. A quarter of the parents are drawn from the protected members, without a tournament: their push-off value is often low, and a protected member without children holds a place for nothing. Event `specialists` after each batch: for each panel warrior with a protected member, the panel warrior, the member, its score, its standard error and the members' median. The dashboard marks a protected member with ◆ and outlines its cell in the column of the panel warrior it is protected for.

`--panel-choice kinds`: the round robin of `picked`, then each warrior of the strongest half gets its kind of style (`tools/style.js`, against the first 3 of the sample), and the kinds take turns: the kind with the fewest picks first (on a tie the one with the strongest warrior left), within a kind its strongest first, then the one with the largest SD-score to the nearest picked one. Warriors that die at once are not picked. The event `pick` names each one's kind.

## Stopping hopeless children early: `--screen-stop z`

In kd1 a batch played about 120,000 rounds, 57% of them in the screen: 114 children, 20 rounds against each of 30 opponents, for 16 survivors. The mutation spectrum (below) found about half of all children fatal or identical to their parent. `--screen-stop z` plays the screen in steps of 5 rounds and stops a child after a step when it cannot get past. After n of the F rounds against each of the q opponents, x is its mean over the opponents of its points per 100 rounds. A round against opponent k gives 300, 100 or 0 points; from its wins, ties and losses there, each counted once more (5 losses in 5 rounds are not a certain loss), comes the variance v_k of one round, and one round's mean over the opponents has variance s2 = sum v_k / q^2. Its score after all F rounds lies around x with a standard deviation of sqrt(s2 (F - n) / (F n)): the rounds still to come, and the error of x. hi and lo are x plus and minus z of those. A child stops when hi is below the survivors' threshold (known before the screen), or below the 16th largest lo of the children still in (the survivors are the best 16 by screen score, so that many others end above it). With z 3 a bound fails in 0.13% of the cases of a normal distribution; the decisions are made in the batch, the same on any thread count.

`--screen-check z` plays the whole screen as before, in the same steps, and logs per batch whom `--screen-stop z` would have stopped, every bound, the stopped children's whole screen and how many of the survivors it would have missed (event `screen`); the run is the one without it. On a copy of kd1 at batch 7,453, 150 batches with `--screen-check 3`: 10,639 of 17,025 children would have stopped, the screen would have played 61% of its rounds, 22.0% of all rounds of those batches, and of the 2,400 survivors none would have been missed.

## Tuning new designs: `--tune-novel N`

`--tune-novel N` was removed in #193: on the real hill it did not pay (below).

`--optimize` gained nothing on warriors evolution had tuned: the best of E5, a tuned hill warrior, and Humble Sloth V (135.3 against the 1,107; its constants 107, -2638 and 106, about 30 candidates each, none 2 standard errors ahead against kd1b's panel). It took a stone with a bad step from 12.5 to 70.9 against its panel. A child of a new design is in the second situation: it competes with untuned constants against members that have been tuned for thousands of batches. `--tune-novel N` gives it the search: every N batches, of the survivors of the screen that entered and left again in the batch, the one with the largest SD-score to the nearest warrior in (from its screen against the panel), 2 passes at most over its constants, each step confirmed as with `--optimize`. With a step the tuned warrior waits in the state and is the first candidate of the next batch (ops `tuned`), and has to win its place in the push-off like any child. On the tiny hill, seeded with the bad stone, 3 of 7 survivors were tuned (20.4 to 59.0, 27.8 to 46.1, 40.4 to 52.9 against the panel) and 2 of the tuned warriors stayed past their batch. On the real hill it did not pay (16th November 2026, from random code, seed 4, 16 threads each, the same time): the run with `--tune-novel 5` had a best holdout of 120.3 against 128.5 of the run without and 20 to 32% fewer batches; 15% of its searches found a step, and 2 of 26 tuned warriors stayed past their batch. The search does not close the gap of a new design, and it costs batches.

## Competitive fitness sharing: `--sharing c`

`--sharing c` was removed in #193: from random code it did not help (sh2 99.8 against 103.3 of its control in the tenth comparison).

An hour with a panel of every kind (kd1, 15th November 2026) left papers and imps that 58 to 73 of the 80 members lost to. `--specialists` kept one place per such panel warrior, at a price of 26 points against the hill. `--sharing c` changes the value instead: the average of the push-off value is a weighted one, panel warrior j weighing 1 / (m_j + c), m_j the members' mean score against it in points per 100 rounds, a member's column the mean of the panel's weights. A child that does a little better against a paper is worth more at once, without a protected place. Each member's average stays linear in its own scores: luck in one match moves it by that match's weight only, unlike shares of a resource (score / sum of all scores against j), where a member alone in a column of near zeros takes it all. c bounds the weights: with c 50 the hardest panel warrior weighs at most about 4 times the easiest. The weights come from the list at the end of a batch and hold for the whole next batch, so a newcomer does not change everybody's value; the distance is unchanged, and so is the plain average in the events' sixth number and on the hill. Event `sharing` after each batch: the panel warriors' weights and means, and the weight of a member's column. Not with `--rotate` or `--map-elites`.

## MAP-Elites: `--map-elites`

`--map-elites` was removed in #193: no run reached the scores of the push-off lists.

In the list, every design competes with every other for 80 places, and the push-off's distance keeps odd warriors without regard to age: in the best run of E5, 65 of 80 members were older than 1,000 batches, and one of them had had 1,431 children enter the list, 4 of which stayed. `--map-elites` (#147) keeps an archive instead: a cell for each kind of style (`tools/style.js`), 4 bins of copies of its own code (under 20, 200, 600, more) × 4 of processes (1, under 50, under 250, more) × 3 of cells read far from home (under 50, 300, more), 48 cells. Each cell keeps the warrior with the best average against the panel over all panel rounds. Its defaults: a panel of 80 drawn at random, 125 rounds a match. A batch breeds children of random occupied cells (crossover with another random one; random warriors while fewer than 4 cells are filled with `--fill`), measures each child's style, which gives its cell (none for one that dies at once), plays the screen rounds against the panel, and only a child that beats its cell's warrior there, over the same rounds with the same seeds, or whose cell is empty, plays the rest; it takes a filled cell only when the mean of its differences to the cell's warrior per panel warrior (the same seeds) is more than 2 standard errors above 0: without that, the average of a cell rose by 0.66 per replacement, about its standard error, and the cells kept their luckiest children. A child in another cell than its parent's starts a new family. No warrior competes with another design, a new kind keeps its cell while it is weak, and parents come from all kinds evenly. There is no self-play: no member plays another. Event `elite` (the cell, the warrior, its style, its matches against the panel, the one it replaced); the dashboard shows the archive as a grid in place of the matrix. The benchmark plays the best cell's warrior against the holdout every `--bench-every` batches.

Warriors of different cells often score alike: a style says how a warrior uses the core, not whom it beats. `--map-elites crowding` drops the cells and keeps `--list` places (80). "Alike" is the SD-score of two rows against the panel: the sum over panel warriors of the difference in points divided by the standard deviation of the archive's results against that panel warrior, taken once a batch. A child nearer to its nearest member than the archive's closest pair are to each other competes with that member and takes its place by the same margin of 2 standard errors. A child farther than that plays like none of them: it takes the place of the weaker of the closest pair when its average is higher, and starts a new family. So a warrior competes only with warriors that play like it, and the places spread over what the panel can tell apart. The screen lets through a child ahead of its nearest member (by the screen rows) or of the weaker of the closest pair, over the same rounds. With `--fill` the first batches are random warriors until all places are filled. Event `elite` adds `rule` (`empty`, `near`, `far`), `distance` (to the nearest) and `pair` (of the closest pair); the dashboard shows the matrix of the archive.

## The constants of a warrior: `--optimize`

`build/42evolve <folder> --optimize <warrior.red> --opponents <dir> [--panel N | --panel-files ...] [--rounds 100]` tunes the constants of one warrior against a panel drawn from the folder (no run): the operand values that are not references into the warrior and more than 16 away from 0, and the start. For each constant in turn the candidates are its value ±1 to ±8, ±1% and ±5%, 1/2, 1/3, 2/3, 1/4 and 3/4 of the core, the other constants of the warrior and their negatives, and the nearest values coprime to the core size. All of them play the panel at once with the seeds of the warrior's own matches, 20 rounds first and the rest only for those ahead then. The best counts as better when the mean of its differences per panel warrior is more than 2 standard errors above 0, and again with other seeds: of about 30 candidates the best is lucky too, and on a tuned hill warrior a step of +2.2 (standard error 0.9) was +1.25 (1.6) with other seeds. An accepted value stays, and the same constant is tried again; a pass that accepts nothing ends it (8 passes at most). The folder gets `optimized.red` and `events.jsonl` (`optimize` with the panel and its seeds, `optimize-step` for each value taken, `optimize-end`), and the holdout before and after. A stone with a step of 100 in a core of 800 (8 cells bombed) went to 102 in one step, from 12.5 to 70.9 against 20 tiny panel warriors and from 27 to 89 against 20 holdout warriors.

## The style of a warrior

The SD-score sees only rows of scores. What a warrior does to the core, [`tools/style.js`](../tools/style.js) measures with the watch of the engine: a few rounds against some opponents, a look every 500 instructions, the last look while it lives counts, up to 4,000 instructions:

- copies: cells outside its code that hold a copy of one of its instructions (the bombs of a stone, the body of a paper, the trail of an imp);
- moved: cells outside its code that it executed (papers and imps run their copies);
- written, and how many of those stores were whole instructions or fields rather than increments;
- read only: cells outside its code that it read and did not write (a scanner);
- processes.

From those a rough kind: a paper (copies, runs them, 250 processes or more), a moving warrior with few processes (imps, stones that boot), a scanner (reads more than half as many cells as it copies, 50 or more), a warrior that throws copies of its code (stones, clears), one that writes fields without copies, one that damages by increments. The card of every warrior in the dashboard has the line (against the first 3 panel warriors), `node tools/style.mjs <dir>` grades a folder (against our Dwarf, Origami and Seeker), and 42evolve grades every newcomer the same way ([`evolver/style.c`](../evolver/style.c), the same numbers: `test/evolver.test.js` compares them with `tools/style.js` in the WebAssembly engine) for `--niche` (removed in #193, never measured against the hill). On the 1,107 '94nop Koenigstuhl warriors, by the design their `;strategy` line names (the part after the last `->`), 15th November 2026:

| Strategy line | paper | moves, few processes | scanner | throws copies | writes fields | other |
|---|---|---|---|---|---|---|
| paper (231) | 200 | 24 | 3 | 4 | 0 | 0 |
| stone (159) | 22 | 64 | 12 | 58 | 2 | 1 |
| scanner (269) | 7 | 10 | 121 | 127 | 0 | 4 |
| clear (73) | 9 | 9 | 13 | 41 | 1 | 0 |
| imp (34) | 9 | 13 | 6 | 5 | 1 | 0 |
| all 1,107 | 321 | 178 | 219 | 360 | 17 | 12 |

Papers are found (87%); stones are a stone that moves or one that throws copies (77%); of the scanners, half have found their target by 4,000 instructions and throw bombs like a stone. A warrior that writes fields without copying its code is 17 of 1,107 on the hill: that is the design the lists of the sixth and seventh comparisons were full of (83 of 90 there).

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
- `--select value`, `--rotate`, `--prior` and `--fractions` were removed in #193.
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
- With `--prior hill` (removed in #193) the gain is 1 to 2 points: Origami has the instruction mix of the hill already.
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

`--noise z` was removed in #193: `--noise 1` brought the tie swarm back, with batches 6 times as long.

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

`build/42spectrum` (`evolver/spectrum.c`) gives a warrior 250 children per kind of change (`--changes name,...`: only those kinds, each child the same as in a run of all), each with exactly that one change, and plays them against 40 panel warriors with the same seeds as the parent, 50 rounds each. A child is *identical* (the same result in every round: the change hit code that does not matter), *fatal* (20 points per 100 rounds or more below the parent), *worse* (2 to 20), *the same* (within 2) or *better*; every better child plays again against the parent with other seeds and 200 rounds and is *confirmed* when it is still 1 point or more above. Besides the 14 changes of the default `--changes` four small steps: `related-opcode` (ADD/SUB, JMZ/JMN/DJN, SEQ/SNE/CMP/SLT, SPL/JMP, MUL/DIV/MOD, DAT/NOP), `related-mode` (`$ @ *`, `< > { }`), `shared-constant` (a far value set to another far value of the warrior or its negative), `tune` (a far value moved by up to 2%). 14th November 2026, 32 threads, 8 minutes:

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

**The change `loop`** (#182) was removed in #193: fatal on the tiny hill, and on '94 (`94-loop16`, 700 batches) no best line contained a `loop` step. What it was: it copied a loop of a donor into the child: an instruction that jumps back (`JMP`, `JMZ`, `JMN` or `DJN` with a direct A operand) to an instruction before it, everything between, and the cells of the donor that those instructions point at (not `#`), and theirs: the data the loop works through (copied without it, the stun carpet's loop pointed at whatever lay before it in the child); on a generator the units of the donor's top level that write it, as `crossover-insert` copies them. Where it does not fit, it replaces as many units. The donors are the warriors that left the list (its archive) and, in a run of islands, a copy of the best member against the panel of every other island, made before each round; an island that takes no migrants (an explorer, a young nemesis island, a leaf of the tree) gets none of those. A donor is drawn only when `loop` is, so a mix without it breeds as before. Weight 0 by default. `42spectrum` (24th November 2026), 250 children each on the tiny hill, 100 on '94: on the tiny hill, where every strong warrior has the 20 instructions of the limit, the stun carpet's loop with its data (8 instructions) replaced part of the backbone and was fatal in 100% (the best of `tiny-own16`) and 74% (Zealous Yeti CCLV) of the children, against 62% and 55% for `crossover-replace`. On '94, with room for it, no child was fatal: Zesty Coyote with Eager Ferret II's loop 57% the same, 18% better at first (none confirmed), mean +0.04; Eager Ferret II with Zesty Coyote's 47% the same, mean −4.65; `crossover-insert` was fatal in 39% and 40%, `insert` in 56% and 64%. So it gives children that carry a second loop at no cost, where the length limit leaves room.

**The change `random-loop`** (#201): a small loop in one step, the part of a scanner or a paper that no single change makes. 2 to 5 new random instructions (operands as `insert` draws them), the last a jump back to the first, `$` and a reference: `DJN`, `JMN` or `JMZ`, or a `JMP` behind a `SEQ` or `SNE`, each a fifth of the time. Where the warrior is at the length limit the loop takes the place of as many old instructions as it needs, at the same place. Weight 0 by default. `42spectrum` (25th November 2026; Infinite Locust XLIII and Volatile Tardigrade XVIII of the table above are not kept, so their places take Giddy Locust XX, 27 instructions from a run started from our five warriors (`s-seeded`), and Humble Sloth V, 7 from random code (`kd1b`); Origami's row reproduces the table's):

```sh
build/42spectrum --opponents warriors/koenigstuhl/94nop --changes insert,duplicate,random-loop \
  warriors/origami.red warriors/evolved/94nop/giddy-locust-xx.red warriors/evolved/94nop/humble-sloth-v.red
build/42spectrum --opponents warriors/koenigstuhl/tiny --size 800 --cycles 8000 --processes 800 --length 20 --distance 20 \
  --changes replace,crossover-replace,random-loop warriors/evolved/tiny/zealous-adder-cxxvii.red warriors/evolved/tiny/vengeful-kitten-ccxc.red
```

| Warrior | Change | identical | fatal | worse | same | better | confirmed | mean Δ |
|---|---|---|---|---|---|---|---|---|
| Origami (9, 149.2) | insert | 0 | 60.8% | 20.0% | 17.2% | 2.0% | 0.8% | −44.2 |
| | duplicate | 0 | 51.2% | 25.6% | 19.6% | 3.6% | 3.6% (best +4.3) | −29.1 |
| | random-loop | 0 | **71.6%** | 14.0% | 12.8% | 1.6% | 1.6% (best +1.3) | −53.2 |
| Giddy Locust XX (27, 160.3) | insert | 0 | 23.2% | 23.6% | 52.8% | 0.4% | 0 | −20.8 |
| | duplicate | 0 | 22.4% | 21.6% | 56.0% | 0 | 0 | −21.4 |
| | random-loop | 0 | **29.2%** | 31.6% | 38.4% | 0.8% | 0 | −27.2 |
| Humble Sloth V (7, 146.4) | insert | 0 | 42.0% | 49.2% | 8.8% | 0 | 0 | −36.7 |
| | duplicate | 0 | 21.6% | 68.8% | 9.6% | 0 | 0 | −18.9 |
| | random-loop | 0 | **47.6%** | 49.2% | 3.2% | 0 | 0 | −46.9 |
| tiny: Zealous Adder CXXVII (20 of 20, 161.4) | replace | 0 | 50.8% | 46.8% | 2.4% | 0 | 0 | −33.4 |
| | crossover-replace | 0 | 60.0% | 38.4% | 1.6% | 0 | 0 | −31.1 |
| | random-loop | 0 | **76.4%** | 23.2% | 0.4% | 0 | 0 | −47.9 |
| tiny: Vengeful Kitten CCXC (20 of 20, 137.4) | replace | 0 | 43.2% | 40.0% | 16.8% | 0 | 0 | −26.0 |
| | crossover-replace | 0 | 54.4% | 34.4% | 11.2% | 0 | 0 | −25.5 |
| | random-loop | 0 | **64.8%** | 34.0% | 1.2% | 0 | 0 | −41.9 |

250 children per change, 40 panel warriors, 50 rounds; mean Δ in points per 100 rounds over the children that are not identical. On the tiny hill `insert` and `duplicate` do not apply at the limit, so the changes that replace stand there.

- `random-loop` is the most fatal change on every warrior: 6 to 11 points more than `insert` on '94, 10 and 16 more than `crossover-replace` on the tiny hill, and no child is identical (a loop changes what runs, or what the warrior's streams read next to it). On '94 it is fatal for 29 to 72% of the children, not for most of them on two of the three warriors; on the tiny hill, where a loop pushes out working code, for 65 and 76%.
- It found improvements only on Origami, the paper: 4 children confirmed better, at most +1.3, against 9 of `duplicate`. On the two tuned warriors none, as for `insert` and `duplicate`.
- So, as #201 asks, the run decides: on '94, where the spectrum is not mostly fatal, against the baseline of #196 with the same seeds, and whether a best line contains the change. On the tiny hill it is mostly fatal, like `loop` was.

Ideas from this, to measure in E5 (#142) against the holdout at equal time: survivors by an estimate of their push-off value (the distance to the members on the panel columns, which the screen has), a panel that rotates (a new hill warrior every few batches costs one match per member), islands with migration against the takeover by one family, and fewer `insert` and `duplicate`.

## Ideas from RedRace: `shared-target`, `--parsimony` (#172)

Of the four ideas of #172 (RedRace in prose, the paragraph above; its source was not read here), two are built, off by default until runs with several seeds measure them.

**`shared-target`**, a change kind (weight 0 by default): a far value of the warrior (not a reference, more than 16 from 0) is set to point at the cell another far value points at, its value plus the distance between the two instructions; `shared-constant` copies the value, which points at another cell unless both are on one instruction. Two lines that work on one far cell need it: two lines of a scan that compare one pair of cells, a bomb and its pointer. On a generator it takes the operands that are one number, at the first instance of their lines. `42spectrum` (25th November 2026, the warriors of the `random-loop` table):

```sh
build/42spectrum --opponents warriors/koenigstuhl/94nop --changes a-operand,b-operand,shared-constant,shared-target \
  warriors/origami.red warriors/evolved/94nop/giddy-locust-xx.red warriors/evolved/94nop/humble-sloth-v.red
```

| Warrior | Change | identical | fatal | worse | same | better | confirmed | mean Δ |
|---|---|---|---|---|---|---|---|---|
| Origami (9, 149.2) | a-operand | 8.0% | 56.4% | 31.6% | 4.0% | 0 | 0 | −46.7 |
| | b-operand | 6.4% | 27.6% | 12.4% | 48.8% | 4.8% | 1.6% (best +5.8) | −26.8 |
| | shared-constant | 0 | 28.4% | 33.2% | 29.6% | 8.8% | 4.0% (best +4.3) | −13.9 |
| | shared-target | 0 | **8.0%** | 42.8% | 34.0% | 15.2% | **10.4%** (best +3.6) | −3.6 |
| Giddy Locust XX (27, 160.3) | a-operand | 6.4% | 18.8% | 11.6% | 63.2% | 0 | 0 | −19.6 |
| | b-operand | 5.2% | 8.8% | 8.0% | 76.8% | 1.2% | 0.4% (best +2.2) | −10.9 |
| | shared-constant | 3.2% | 6.8% | 20.4% | 68.4% | 1.2% | 1.2% (best +2.3) | −4.8 |
| | shared-target | 0 | **3.2%** | 25.2% | 70.8% | 0.8% | 0 | −3.4 |
| Humble Sloth V (7, 146.4) | a-operand | 13.2% | 44.0% | 20.4% | 21.6% | 0.8% | 0.8% (best +2.1) | −31.2 |
| | b-operand | 4.0% | 58.0% | 10.4% | 27.6% | 0 | 0 | −50.2 |
| | shared-constant | 0 | 28.0% | 28.4% | 43.6% | 0 | 0 | −21.4 |
| | shared-target | 0 | 33.6% | 18.0% | 48.4% | 0 | 0 | −30.0 |

- On Origami, the paper, `shared-target` is the best change measured so far: fatal for 8% of the children (`shared-constant` 28%), and 26 children confirmed better (10.4%; `shared-constant` 4.0%, `duplicate` 3.6%). Origami's bomb lines and copy pointers work on cells that other lines name.
- On Giddy Locust XX, from batch 169 of a run started from our five warriors, it is the least fatal change too (3.2%), with no child confirmed better; on Humble Sloth V, 7 instructions from random code, a little more fatal than `shared-constant` (33.6% and 28.0%) and nothing better, as for every change but one child of `a-operand`.
- Next, as #172 asks: runs with and without it, several seeds each.

**`--parsimony`**, an option (off by default, the table at the top): of a newcomer and a member with the same results, the longer one leaves. Twins are told exactly: every match uses the seed of its opponent, so the newcomer and the member played the panel and the members that were in when the member entered at the same positions, and twins have the same wins, losses and ties there. The rule comes before the push-off: the push-off has no reason to prefer either (equal rows give equal values), and the shorter warrior is a smaller target and easier to read. At the size of a test (the tiny hill with 8000 cycles, a panel of 10 drawn, a list of 30, batches of 64, lists, 16 batches, seeds 31 to 33 with and without, 25th November 2026) it applied to 2, 5 and 3 of the 128 newcomers of a run, each time to a newcomer at least as long as its twin; the members' mean length after batch 16 was 10.6, 11.8 and 10.5 with it and 10.9, 9.0 and 11.6 without, which says nothing after 16 batches of mostly random warriors. Next, as #172 asks: the mean length, how often the rule applies and the score, in runs of several seeds per arm.

**Not built:**
- Idea 3, several lists that play one shared hill (islands that also play the best members of the other islands): only runs can say anything about it, islands with and without the shared opponents at equal time, and #172 puts it after ideas 1 and 2 are measured. Those runs wait for the machine (the baseline of #196).
- Idea 4, a warrior back from the archive with changes in half of the cases: not cheap here. Such a child has a parent that is no member (the archive's), so its line (`origin`), the counts per change of the batch event, the Operators tab and the line of best.red in `tools/run-report.mjs` would each need a case for it, and a test. It can come with the runs of idea 1 or 2 if those show that the list needs more new material.
