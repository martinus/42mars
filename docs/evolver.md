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
| `--panel N`, `--holdout N` | 20, 100 | warriors the evolved ones play all the time, picked (`--panel-choice`); warriors only the benchmark plays, drawn from the rest |
| `--panel-choice picked\|random\|kinds`, `--pick-sample N` | picked, 300 | picked: N warriors of the folder (drawn with the seed) play a round robin of 100 rounds; of the strongest quarter (at least the panel's size) the strongest first, then each time the one with the largest SD-score to the nearest one picked (event `pick`). About 2 minutes for 300 '94nop warriors on 32 threads. random: the first warriors drawn with the seed, as before 15th November 2026. kinds: the same round robin, then a panel of every kind of design from the strongest half (below)
| `--panel-files a.red,b.red,...` | | the panel is these warriors of `--opponents` instead of N drawn ones; the holdout is drawn from the rest |
| `--screen-members N` | 10 | the screen plays the panel and N members of the list, drawn anew each batch with its seed; the threshold is the weakest member's average against the same opponents. With a small panel and a long list the score is then mostly against the list, as in YACE |
| `--list N` | 80 | evolved warriors kept |
| `--batch N`, `--survivors N` | 4 per thread, batch / 8 | candidates per batch; most of them that get past the screen |
| `--rounds N`, `--screen-rounds N` | 100, 20 | rounds per match; the first of them are the screen |
| `--screen-factor x` | 0.8 | a candidate needs this share of the weakest member's panel average after the screen |
| `--alpha x`, `--sd opponent\|sum` | 1, opponent | push-off value = average * distance^alpha; the reading of the SD-score |
| `--diversity all\|panel` | panel | the columns of the push-off's SD-score: everyone in, or the panel only (the average stays over everyone). Among warriors of one design the results against each other differ in small details, so their rows look different by the evolved columns; against the fixed panel two warriors of one design score alike |
| `--average all\|panel` | all | the push-off's average: over everyone in, or over the panel only (the members still play each other, and the screen with `--screen-members`). Over everyone, the design that holds most of the list sets what a high average is, and a design it beats leaves whatever its SD-score: in a merge of 8 islands, isl14's best (103.0 against the 1,107) had an average of 37.8 when it left, the list's median was 147. Not with `--sharing` or `--map-elites` |
| `--difference abs\|ahead` | abs | how a column counts in the SD-score from a warrior to another: \|a_k - b_k\|, or ahead only max(0, a_k - b_k), where it scores more. A warrior is then far from its nearest only when it does better somewhere, not when it does worse; one that a warrior nearby matches or beats in every column has distance 0 and leaves first (on a tie of values the lower average). In 7 lists of 17th November 2026 the distance both ways went against the panel average (rank correlation -0.50 to -0.88: the weakest quarter of a list had the largest distances), and the value had nothing to do with it (-0.57 to 0.21); recomputed ahead on 3 of them, the distance went with it (0.34 to 0.86), and the 20 members of the highest value were 7 to 9 points stronger against the panel. It did not help a run: all55 (`--average all`, a panel of 55 at 200 rounds, 32 threads) switched to it at batch 134. The weakest quarter of its list went from 48.4 to 79.7 against the panel by batch 320 and the families from 9 to 3; the best panel average went from 89.9 (batch 120, still climbing about 2.5 every 40 batches) to 91.2 at batch 280 and stayed there until it was stopped at batch 486, the best holdout at 110.3 from before the switch. The weak warriors it pushes off were the stepping stones. With `--noise z` the part of a_k - b_k above the errors. A run folder continues with it (event `difference`, then the values of the list with it). Not with `--simple` or `--map-elites` |
| `--member-games all\|none` | all | none: members never play each other. The screen plays the panel only (`--screen-members 0`), a survivor plays the rest of its rounds against the panel only, and the family name compares rows on the panel columns. Only with `--average panel --diversity panel`, where those games count for nothing, and not with `--parents duel`. The dashboard shows no cells between members |
| `--islands N`, `--select-after B`, `--keep K`, `--score-rounds R` | | N runs in one process, in `<folder>/island-01` ... (each an ordinary run folder: it can be continued, served and read alone). The panel is picked once and every island has it and the same holdout (`--draw-seed`); island i evolves with seed + i - 1. One pool of threads, and the islands take turns, always the one with the fewest batches: they advance by batches, not by time, and the run is the same on any thread count. Every B batches of each, the `best.red` of each island and its three members best against the panel play every warrior of the opponent folder (R rounds each, 100); the first time, the K islands with the best of those scores go on and the others stop. The folder has `islands.jsonl` (events `islands`, `pick`, `score` with every score, the opponents and the seeds), `islands.txt` (its state) and `best.red`, the best warrior scored so far. `tools/serve.mjs --run <folder>` shows all its islands in the dashboard's list. A folder with islands continues with `--threads`, `--batches` (of each island) and `--seconds` only |
| `--draw-seed S` | the seed | the order of the opponent folder, so which warriors are the panel and the holdout; the islands share it |
| `--simple` | off | a candidate plays the panel only, in checkpoints of 5, S, 5 S and all F rounds (S `--screen-rounds`, F `--panel-rounds`), and stops when it cannot make it onto the hill: its average cannot reach `--screen-factor` of the weakest member's (strength), its first S rounds are those of a member against every panel warrior (twin, the same seeds), or its push-off value cannot reach the `--list`-th largest of the members' values and the other candidates' lower bounds (value). Whoever plays all F rounds enters, no quota of survivors, and the push-off decides. `--screen-stop z` (3) is how sure a stop is, `--screen-check z` plays everything and logs every row (event `simple`). Sets `--average panel --diversity panel --member-games none`, one length of match; not with `--race`, `--select value`, `--specialists`, `--niche`, `--rotate`, `--tune-novel`, `--sd sum` |
| `--panel-rounds N` | 500, at least `--rounds` | rounds of a match against a panel warrior, at least `--rounds`: less noise in the panel's columns. Matches are played in blocks of at most 100 rounds, so the threads end a step together |
| `--screen-stop z`, `--screen-check z` | off | the screen in steps of 5 rounds: a child stops when its score plus z standard errors cannot get past (below). `--screen-check` plays everything and logs what `--screen-stop` would have done. Both also go with a run that continues |
| `--sharing c` | off | competitive fitness sharing: the average of the push-off value weights each panel warrior by 1 / (members' mean against it + c), so that a win against a panel warrior most members lose to counts more (below) |
| `--specialists` | off | the member clearly best against a panel warrior does not leave, and a quarter of the parents are such members (below) |
| `--niche N` | 0 | each kind of style (`tools/style.js`) keeps at least N members: the push-off takes the weakest of the others, so a design that is losing the list keeps N places to improve in, and the leading one can still grow to the rest. The two kinds of junk ("dies at once", "writes little") get no places. Every newcomer's style is measured when it enters (`style` in its `enter` event): 2 rounds against each of the first 3 panel warriors with the watch, as `tools/style.js` does. A first version capped the largest kind instead (`--niche 0.4`: at most 32 of 80); with two kinds at their cap the other 16 places held warriors that scored 4 against the panel and could not be pushed out |
| `--map-elites [cells\|crowding]` | cells | an archive instead of the list (#147, below): cells by style, or `crowding`, `--list` places where a child competes with its nearest by SD-score |
| `--noise z` | 0 | the SD-score counts a column only as far as the difference is larger than z standard errors of the two scores: max(0, \|a_k - b_k\| - z sqrt(se_ak² + se_bk²)), each standard error from the wins, losses and ties of its match (#148); 0 is the plain SD-score of the tournament |
| `--reintroduce p` | 0.02 | chance that a candidate is a warrior that was pushed off earlier (one of the last 256), unless its code is a member's or came back in the same batch. Also goes with a run that continues (event `reintroduce`). In a list that has settled they are most of what stays: in kd1a (483 batches from batch 7,453) 1,139 of 1,296 passed the screen and 201 of the 222 warriors still in after their batch had come back, 940 of 1,141 left in their batch, 12 stayed 10 batches; 204 were copies of a member, before that check. About three quarters of the completions went to them |
| `--list N` on a run that continues | | the list grows to N (a smaller N is refused, as is a run with `--map-elites`); `--fill` goes off, so children of the members fill the new places, not random warriors. Event `list` |
| `--tune-novel N` | 0 (never) | every N batches the survivor of the screen that entered and left again with the largest SD-score to the list gets the search of `--optimize` (2 passes at most); with a step confirmed it is the first candidate of the next batch (ops `tuned`). A new design loses on untuned constants against members tuned for thousands of batches. Event `tune`; also goes with a run that continues |
| `--select screen\|value` | screen | what the survivors of the screen are picked by: the screen score, or the estimated push-off value (screen score times the SD-score to the nearest warrior in, on the panel columns, to the power alpha) |
| `--start <dir>` | | the first batch starts from the warriors of the folder (as they are, then mutants of them) instead of random ones; each starts a family; an operand that points into the warrior's code becomes a reference |
| `--parents value\|duel` | value | the tournament of two that picks a parent: the higher push-off value, or the one with more points in their match against each other (a draw by value) |
| `--prior uniform\|hill` | uniform | how opcodes, modifiers and modes of new instructions and point changes are drawn: uniform, or as often as they occur in all warriors of `--opponents` (plus 1 each, so none is impossible) |
| `--stage N` | the screen rounds | 0 for none; else at least the screen rounds: every match is played as its first N rounds and the rest, and 42evolve keeps both results. A survivor of the screen plays only the first N rounds against everyone in and enters with them; the push-off then runs on everyone's first-N results, the same noise for all. A newcomer among the 8 weakest members there leaves at once (`leave` with `early`), unless its nearest warrior is weaker still (mostly its first parent: then the whole results decide which of the two goes). Every other newcomer plays the rest of its rounds first (event `complete`), and the push-off decides on the whole results, so no newcomer pushes out a member on the noise of its few rounds |
| `--fill`, `--no-fill` | fill | new random warriors until the list is full, not only in the first batch: with a list of 80 about 5 batches of them, and the push-off keeps the most different ones |
| `--race N`, `--race-keep K` | 0, batch / 4 | the screen in two stages: every candidate plays the first N screen rounds, only the best K by the key the rest |
| `--changes name=w,...` | see below | how often each kind of change is drawn, weights of any scale; a kind not named is never drawn. The names are those of the dashboard's Operators tab and of `42spectrum`: `opcode`, `modifier`, `a-mode`, `b-mode`, `a-operand`, `b-operand`, `org`, `replace`, `insert`, `delete`, `duplicate`, `move`, `crossover-insert`, `crossover-replace`, `related-opcode`, `related-mode`, `shared-constant`, `tune`. The default is `opcode=81,modifier=81,a-mode=54,b-mode=54,a-operand=108,b-operand=108,org=27,replace=27,insert=100,delete=100,duplicate=70,move=70,crossover-insert=60,crossover-replace=60`, the rates from before the option (since the option, 15th November 2026, a seed gives another run than before, also with these rates: a change that does not fit is drawn again instead of becoming the next kind). The one evolution option a run that continues takes: from then on its children get the new weights (event `changes`, and the state keeps them), and the run is no longer the one it would have been without a break |
| `--fractions p` | 0 | chance that a new far value (any value of the core otherwise) is 1/2, 1/3, 2/3, 1/4 or 3/4 of the core give or take 20 |
| `--rotate N` | 0 | every N batches the oldest panel warrior makes room for the next warrior of the folder that is neither in the panel nor in the holdout; it plays everyone in once |
| `--bench-every N`, `--bench-rounds N` | 10, 100 | the best member against the panel plays the holdout every N batches |
| `--init-length N` | 10 | the longest random warrior of the start |
| `--size --cycles --processes --length --distance` | pMARS's | the rules, e.g. `--size 800 --cycles 8000 --processes 800 --length 20 --distance 20` for the tiny hill |
| `--seed N`, `--threads N`, `--batches N`, `--seconds S` | 1, all | |

The defaults are the settings of the best run of the E5 comparisons (the eighth, 119.1 against the 1,107 '94nop Koenigstuhl warriors after an hour): a list of 80, a picked panel of 20 at 500 rounds a match, the push-off's SD-score over the panel only, 10 members in the screen, `--stage` at the screen rounds and `--fill`. A run started before keeps its own settings; the comparisons below name theirs.

The run folder gets `events.jsonl` (everything that happened, one JSON object per line), `state.txt` (to continue) and `best.red` (the best warrior against the holdout so far). After each batch the event `parents` has, for every member that was a first parent in it, how far its children got: `[id, bred, evaluated, past the screen, still in after the batch]`.

## How it works

**The list.** Like YACE: a list of evolved warriors (80 by default), and each newcomer plays the whole list. The list is kept by the diversity push-off of [Tournament Weekend 2026](https://corewar.co.uk/tournamentweekend2026a.htm): each warrior's value is its average score times the lowest SD-score between its row of scores and the row of any other warrior; when the list has 21, the lowest value leaves. A close clone of a strong warrior has a distance near 0 and goes first, so the rule keeps the list diverse. The math is [`tools/diversity.js`](../tools/diversity.js) and [`evolver/pushoff.c`](../evolver/pushoff.c), the same operations in the same order; [`tools/pushoff.mjs`](../tools/pushoff.mjs) ranks a whole tournament that way. The SD-score is from [Ismael 2025](https://doi.org/10.1186/s40537-025-01091-z), whose Eq. 6 (`--sd sum`: sum of differences over sum of standard deviations, the order of plain Manhattan distance) and pseudocode (`--sd opponent`: each column divided by its own standard deviation) differ.

**The matrix.** Rows and columns are the panel (20 picked hill warriors by default, they never leave) and the members. So a warrior's row is its score against the panel and the other members, and the distance to the nearest panel warrior counts too: copying a hill warrior does not pay either.

**A batch.** 4 candidates per thread are bred from the list (tournament of two on the push-off value). The screen plays each against the panel and 10 members of the list for 20 rounds. Those with at least 0.8 of the weakest member's average against the same opponents, at most batch / 8 of them, play 20 rounds against every member and every survivor before them, and enter one by one with those results (`--stage`, by default at the screen rounds). The push-off on everyone's first 20 rounds sends a newcomer among the 8 weakest away at once, about 80% of them in a long run; every other one plays the rest of its 100 rounds against everyone, and the push-off on the whole results decides. Without `--stage` (`--stage 0`) every survivor plays all 100 rounds before it enters. Candidates whose warrior is one of the last 16,384 that were tried are skipped. Every match uses the seed of its opponent, so all candidates meet an opponent at the same positions and differ by their code, not by their luck.

**The genome.** [`evolver/genome.c`](../evolver/genome.c): a list of instructions whose operands are typed, a reference to an instruction of the genome or a value. A reference becomes a relative offset only when the genome becomes a warrior, so inserting, deleting or moving instructions keeps what it points at; with raw offsets every insertion breaks the references that cross it. Changes: a field of one instruction (opcode, modifier, mode, operand, start, the whole instruction), insert new instructions, delete, duplicate or move a block, and crossover, a block of another member inserted or put over a block; and four small steps, off by default: an opcode or mode of the same family, a far value set to another one of the warrior, a far value moved a little (see the mutation spectrum below). A child gets 1 change, and one more with probability 0.35 each time, up to 6; each is drawn by the weights of `--changes`, and drawn again when it does not fit (an insert at the longest length, a crossover without a second parent). A copied block keeps its references inside the block; references out of it go to the original (duplicate) or become plain offsets (crossover). No strategy is built in: no qscan, paper or stone templates.

**Names.** Each warrior that enters gets a name of its own adjective and its family's noun. The family is its first parent's: a child of "Crimson Mantis" may be "Sneaky Mantis". It starts a family of its own, with a new noun, when it plays clearly unlike its first parent: its scores against everyone else in differ from the parent's by more than 30 points per 100 rounds on average (`parentDifference` and `newFamily` in its `enter` event; in the runs of 15th November 2026 the median was 1 to 9, and 0.1 to 2.3% of the children were above 30). Without that rule every run ended with one noun, the descendants of one early warrior, whatever they played. A warrior bred from nothing starts a new family too. A name given before gets a Roman numeral ("Sneaky Mantis II"), so names are unique in a run. 128 adjectives and 128 nouns ([`evolver/names.c`](../evolver/names.c)); the dashboard colors a family alike, a new family in a new color. Names change nothing else; the number of a warrior (`id`) stays the key in the events.

**All cores.** One thread per hardware thread, each with its own `m42_ctx`, takes matches from one shared queue; the main thread plays too. A match is one pair and one block of rounds, at most 100 rounds, so the queue has no long tail at the end of a phase. On the run below, 16 threads were 97.7% busy over 600 s, measured as time inside `m42_match()` over threads times wall time. The plan in #142 had batches bred one batch behind so that no thread waits at the end of a batch; with matches this small that was not needed.

**Two answers to the long run below.** `--select value` picks the survivors of the screen by an estimate of their push-off value instead of their strength: the screen gives a candidate's row against the panel, so its SD-score to every warrior in can be computed on the panel columns. Every newcomer logs its `estimate` and its `screenPoints`, also with `--select screen`. `--rotate N` replaces the oldest panel warrior every N batches with the next one of the folder (those that leave go to the end of that queue), so the list cannot tune itself to 40 fixed opponents; the event `rotate` has the new warrior and its matches. Whether they help is E5: measured against the holdout at equal time. `--fractions p` comes from YACE (2000, GPL): half of its numbers are a small value plus 1/2, 1/3 or 1/4 of the core, the distances of bombers and replicators, which a uniform far value almost never hits. Its source was read by a separate agent that wrote down the ideas in prose; nobody who writes 42evolve read it. YACE has no crossover, no references that survive insertions and no start that changes; its other ideas (a hill with a spare slot and a cached score matrix, a cheap screen before a precise test, champions brought back, replacement of a similar member) are here in some form already. Not taken yet: a test against a one-line `spl 0` before the screen, which throws out warriors that die at once. `--race N` makes the screen cheaper: on the tiny hill (batches 2 to 9 of 10, batch 128), `--race 4` played 1,082,400 instead of 1,548,000 rounds and 10.1 instead of 12.3 million instructions per candidate, 18% less. The survivors' full matches cost more than the screen, so it pays most together with fewer survivors.

**What it does not have yet.** An LLM as mutation operator, islands, an opponent ladder (the panel is a random sample of the folder, weak and strong warriors), MSVC (it needs POSIX threads and `dirent.h`).

## The dashboard

[`ui/evolver.html`](../ui/evolver.html), on the events of a run: live through `node tools/serve.mjs --run <folder>`, or `?log=<url of an events.jsonl>`, or an `events.jsonl` dropped on the page. Live events are applied every 2 seconds (`?every=<seconds>`, 0 at once); in between the matrix and the map stand still, and the newcomers that came and went in one update are one line in the ticker. A run with `--stage` on 32 threads writes about 4 batches a second, and drawn as they come the matrix took a core of its own. A history longer than 16 MB goes out compacted: without the warriors that left (except each that set a new best against the holdout, so that the ★ best chip names the warrior of `best.red`), with only the last `values` event, and with the progress chart of every batch computed from the whole history (the event `compacted` carries it); a continued run of 7,453 batches had 463 MB of events, of which 5 MB are left that way, and the page showed nothing while it read them all. The server keeps the compacted history for the next page (the first took 21 s for 463 MB on a busy machine) and makes it again once the run has grown by another 16 MB; `serve.mjs --full` sends everything.

- **Score matrix**: the members by push-off value, against each other and the panel, points per 100 rounds. A newcomer slides in from below and glows, a member that leaves fades out. A click on a cell opens that match in the visualizer. The buttons above it sort it, a second click turns the order around: the evolved warriors (rows and their columns) by value, by score (the push-off's average; the button says panel with `--average panel`, where it is over the panel columns only), by row (the mean of every cell of the row, evolved and panel: the brightest rows on top) or by SD (the SD-score to the nearest), the panel columns by the panel warrior's strength, by the evolved warriors' average score against it, or by SD (the standard deviation of their scores against it, what the SD-score divides the column by: the columns that tell the list apart come first).
- **Novelty map**: classical multidimensional scaling of the rows against the panel, with the SD-score as distance: two warriors are close when they win and lose against the same panel warriors. The axes are the two directions in which the rows differ most and have no unit; each end of an axis names the 2 panel warriors whose scores go most with it (the correlation over the members), "better against ... →". Grey points are the hill warriors, colored ones the members (a family shares a color), faint ones members that left. A newcomer flares up.
- **Lineage**: every warrior that stayed past its batch, by its batch and its score against the panel, large while in the list; a ring where a new family starts (its scores were more than 30 points per 100 rounds from its first parent's, on average over everyone in). A click on a warrior shows its line: its first parents in yellow, crossover parents dashed in cyan, its descendants in white, everything else dimmed. Without a click there are no lines: the faint lines from every member to its parents did not say which one was meant.
- **Operators** (tab): per kind of change its children, the share past the screen, the share kept after their own batch with a bar (the longest bar: the change whose children were kept most often), how many stayed 5 batches, and the mean change against the first parent.
- **Progress**: the best and mean member against the panel, and the best against the holdout, over the batches.
- **★ best** in the header is the best warrior against the holdout warriors so far, also after the push-off removed it from the list (the same warrior as `best.red`); **strongest now** is the member with the highest average against the panel. A click opens the card. The best one has a ★ in the matrix and on the map.
- A click on a warrior opens its card: code, scores, parents, nearest warrior, its style (below), its result against each panel warrior, and every match with a **watch** button.

**Several runs**: `node tools/serve.mjs --run ~/42evolve.a ~/42evolve.b ...` (one `--run`, any number of folders, so `--run ~/42evolve.*` works) serves each run's events; `ui/evolver.html` is then one dashboard for all of them: a list on the left names each run with its batch, the age of its `best.red` (batches since it was found) and its score against the holdout, colored from red for the lowest of the runs to green for the highest (a click on a heading sorts by that column, a second one turns the order around; a grey dot when the run has not written for 3 of its batch times: such a stopped run goes into a second part below the running ones, and its cores busy chip says stopped), a click or `[` and `]` switches the page to another run, and `?run=<n>` keeps which (0 is the first); the list comes from `/runs`, every 5 seconds. Besides, [`ui/runs.html`](../ui/runs.html) shows them all on one page: the best against the holdout and the best member against the panel over the minutes of each run (the fair axis when runs share a machine), and a table with the settings in which they differ, where each stands, the speed, the families and the opcodes of the list.

**Watch** opens `ui/index.html#battle=...`, which carries both warriors, the rules, the seed and the rounds. It starts in the grid layout at learn speed, every step explained (`?layout=ring` and `?speed=` before the `#` still win). The visualizer plays the same rounds as the evolver did: the WebAssembly build gives the same results as the native one, and stepping a match round by round with a watch gives the same rounds as `m42_match()`. `test/evolver.test.js` replays logged matches in the WebAssembly engine.

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

**The panel as a yardstick.** The 80 members of ap24's list against the 1,107, and their panel averages:

| Panel | Correlation with the score against the 1,107 | Error of a line through it |
|---|---|---|
| 20 by kinds, 500 rounds | 0.77 | 7.1 points |
| 53 (three such panels), 200 rounds | **0.91** | 4.5 points |

The scores of the 80 spread by 11.1 points. 7 of the 20 columns do not go with the score at all (correlation -0.09 to 0.05: warriors the list beats anyway), the 20 columns are 7.2 independent directions, and 5 pairs correlate above 0.8, mostly the papers.

## Specialists and a panel of every kind: `--specialists`, `--panel-choice kinds`

An hour of the defaults (pd81, 15th November 2026, 16 threads) kept 80 members whose rows against the panel differed, but 75 of them were the same design: SPL, MOV, DJN and ADD, a median of 825 processes and 1 copy of their own code. All 80 lost to King of Metal (6 points on average), 76 to procoptodon, 75 to Mirage 2: 6 of the 20 panel warriors beat everything evolved. A child that did a little better against one of them but worse overall left at once.

`--specialists`: for each panel warrior, the member that does best against it does not leave when its score there is ahead of the members' median by more than 2 standard errors of that score. Against a panel warrior that every member loses to, the best is luck, and nobody is protected for it. A quarter of the parents are drawn from the protected members, without a tournament: their push-off value is often low, and a protected member without children holds a place for nothing. Event `specialists` after each batch: for each panel warrior with a protected member, the panel warrior, the member, its score, its standard error and the members' median. The dashboard marks a protected member with ◆ and outlines its cell in the column of the panel warrior it is protected for.

`--panel-choice kinds`: the round robin of `picked`, then each warrior of the strongest half gets its kind of style (`tools/style.js`, against the first 3 of the sample), and the kinds take turns: the kind with the fewest picks first (on a tie the one with the strongest warrior left), within a kind its strongest first, then the one with the largest SD-score to the nearest picked one. Warriors that die at once are not picked. The event `pick` names each one's kind.

## Stopping hopeless children early: `--screen-stop z`

In kd1 a batch played about 120,000 rounds, 57% of them in the screen: 114 children, 20 rounds against each of 30 opponents, for 16 survivors. The mutation spectrum (below) found about half of all children fatal or identical to their parent. `--screen-stop z` plays the screen in steps of 5 rounds and stops a child after a step when it cannot get past. After n of the F rounds against each of the q opponents, x is its mean over the opponents of its points per 100 rounds. A round against opponent k gives 300, 100 or 0 points; from its wins, ties and losses there, each counted once more (5 losses in 5 rounds are not a certain loss), comes the variance v_k of one round, and one round's mean over the opponents has variance s2 = sum v_k / q^2. Its score after all F rounds lies around x with a standard deviation of sqrt(s2 (F - n) / (F n)): the rounds still to come, and the error of x. hi and lo are x plus and minus z of those. A child stops when hi is below the survivors' threshold (known before the screen), or below the 16th largest lo of the children still in (the survivors are the best 16 by screen score, so that many others end above it). With z 3 a bound fails in 0.13% of the cases of a normal distribution; the decisions are made in the batch, the same on any thread count.

`--screen-check z` plays the whole screen as before, in the same steps, and logs per batch whom `--screen-stop z` would have stopped, every bound, the stopped children's whole screen and how many of the survivors it would have missed (event `screen`); the run is the one without it. On a copy of kd1 at batch 7,453, 150 batches with `--screen-check 3`: 10,639 of 17,025 children would have stopped, the screen would have played 61% of its rounds, 22.0% of all rounds of those batches, and of the 2,400 survivors none would have been missed.

## Tuning new designs: `--tune-novel N`

`--optimize` gained nothing on warriors evolution had tuned: the best of E5, a tuned hill warrior, and Humble Sloth V (135.3 against the 1,107; its constants 107, -2638 and 106, about 30 candidates each, none 2 standard errors ahead against kd1b's panel). It took a stone with a bad step from 12.5 to 70.9 against its panel. A child of a new design is in the second situation: it competes with untuned constants against members that have been tuned for thousands of batches. `--tune-novel N` gives it the search: every N batches, of the survivors of the screen that entered and left again in the batch, the one with the largest SD-score to the nearest warrior in (from its screen against the panel), 2 passes at most over its constants, each step confirmed as with `--optimize`. With a step the tuned warrior waits in the state and is the first candidate of the next batch (ops `tuned`), and has to win its place in the push-off like any child. On the tiny hill, seeded with the bad stone, 3 of 7 survivors were tuned (20.4 to 59.0, 27.8 to 46.1, 40.4 to 52.9 against the panel) and 2 of the tuned warriors stayed past their batch. On the real hill it did not pay (16th November 2026, from random code, seed 4, 16 threads each, the same time): the run with `--tune-novel 5` had a best holdout of 120.3 against 128.5 of the run without and 20 to 32% fewer batches; 15% of its searches found a step, and 2 of 26 tuned warriors stayed past their batch. The search does not close the gap of a new design, and it costs batches.

## Competitive fitness sharing: `--sharing c`

An hour with a panel of every kind (kd1, 15th November 2026) left papers and imps that 58 to 73 of the 80 members lost to. `--specialists` kept one place per such panel warrior, at a price of 26 points against the hill. `--sharing c` changes the value instead: the average of the push-off value is a weighted one, panel warrior j weighing 1 / (m_j + c), m_j the members' mean score against it in points per 100 rounds, a member's column the mean of the panel's weights. A child that does a little better against a paper is worth more at once, without a protected place. Each member's average stays linear in its own scores: luck in one match moves it by that match's weight only, unlike shares of a resource (score / sum of all scores against j), where a member alone in a column of near zeros takes it all. c bounds the weights: with c 50 the hardest panel warrior weighs at most about 4 times the easiest. The weights come from the list at the end of a batch and hold for the whole next batch, so a newcomer does not change everybody's value; the distance is unchanged, and so is the plain average in the events' sixth number and on the hill. Event `sharing` after each batch: the panel warriors' weights and means, and the weight of a member's column. Not with `--rotate` or `--map-elites`.

## MAP-Elites: `--map-elites`

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

From those a rough kind: a paper (copies, runs them, 250 processes or more), a moving warrior with few processes (imps, stones that boot), a scanner (reads more than half as many cells as it copies, 50 or more), a warrior that throws copies of its code (stones, clears), one that writes fields without copies, one that damages by increments. The card of every warrior in the dashboard has the line (against the first 3 panel warriors), `node tools/style.mjs <dir>` grades a folder (against our Dwarf, Origami and Seeker), and 42evolve grades every newcomer the same way ([`evolver/style.c`](../evolver/style.c), the same numbers: `test/evolver.test.js` compares them with `tools/style.js` in the WebAssembly engine) for `--niche`. On the 1,107 '94nop Koenigstuhl warriors, by the design their `;strategy` line names (the part after the last `->`), 15th November 2026:

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
