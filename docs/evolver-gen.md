# Generators: a genome that writes the warrior

Design, 20th November 2026. Status: steps 1, 2a and 2b are built. Step 1 is the language (`evolver/generator.c`, the program `42gen`). Step 2a is the changes of a list on generators (`evolver/gen-change.c`) and `42evolve --genome gen`; with the changes of a list it is the run on lists, event for event. Step 2b is seven kinds of change that make and vary blocks, steps and constants, which `--genome gen` draws by default. Functions (2c) and steps 3 and 4 are the plan.

## The goal

`42evolve` evolves warriors that rival the ones people write, from random starts, with nothing written by hand in them: no template, no library of parts, no built-in decoy or boot.

Today's genome is a list of instructions. What it finds is one loop of 2 to 7 instructions (`docs/evolver.md`, "Stages around evolved warriors"). The best of `warriors/evolved/94nop` scores 142.7 against the 1,107 '94nop Koenigstuhl warriors; the median warrior of that hill scores 145.

**What the list cannot reach.** A change of the list touches one instruction or one block. Hill warriors have structure that takes many changes which only pay together:

- **Regular blocks:** a decoy of 85 different cells, a table of scan positions, a row of `SPL`. In the list that is 85 insertions, each of them useless alone.
- **Constants that belong together:** the distance of a boot appears in every copying instruction and in the jump. A step appears in the bomber and in its loop check. The list has one number per operand; `shared-constant` copies a number once, and the next change separates the two again.
- **Parts used more than once:** two copies of a loop with different steps.
- **Lengths:** copying a block needs the block's length, which changes with every insertion.

The measurements say that such structure pays, and that it is out of reach: a decoy of 85 cells and a boot, written by hand around five evolved warriors, gained 0.5 to 2.3 points. No run has made a decoy.

**The idea.** The genome is a generator: a small program that writes the warrior. A block of 85 cells is one line with a count. A constant has a name and every use follows it. A part is a function. One change of a generator is a large, regular change of the warrior. The warrior is still what plays; everything behind the compiler stays as it is.

**What a generator does not do.** It widens what one change can reach. It adds no selection pressure: a structure appears only when each step towards it scores at least as well as what the list holds. Whether that is enough is what steps 2 and 3 measure.

## Principles

1. **A superset.** A generator without structure is today's genome, line for line. The old changes give the same child on it as `genome_change()` gives on the list, for the same random numbers (a test compares the two). So `--genome gen` with only the old changes is today's run, event for event, and every difference measured later comes from the structure.
2. **Total.** Every well-formed generator compiles, in bounded time, to a warrior of 1 to `max_length` instructions. No change can make one that does not.
3. **No strategy built in.** The language has counts, an index, named constants, functions, positions and lengths. A decoy, a boot or a table is something a generator can say, not something the language knows.
4. **References follow edits.** A line refers to another line, not to a distance: as in the list genome, inserting or moving lines keeps what every reference points at.
5. **Structure comes with a difference.** `42evolve` skips a child whose warrior was seen before, so a change that only rewrites the generator never enters the list. Every structural change is therefore a rewrite plus one variation of what the rewrite made variable.
6. **The warrior is the interface.** Battles, screen, push-off, names, style, islands, the dashboard's battle view and `best.red` work on the compiled warrior and do not change.

## The language

A generator is a list of lines and 16 constants. Text form, as `42gen` reads and prints it:

```
c0 = 6000                              ; a constant
        repeat 85                      ; the decoy: 85 different cells
          DAT.F   #i, #37*i%800        ;   i: the repetition, from 0
        end
body:   repeat 1                       ; a block, so that it has a length
          SPL.I   #-3830, >-20
loop:     MOV.I   *1, <1
          MOV.I   <0, <3989
          DJN.X   $loop, {1781         ; a reference: wherever loop ends up
        end
boot:   repeat body.len                ; one MOV per instruction of the body
          MOV.I   $body+i, $body+c0+i
        end
        JMP.B   $body+c0, $0
        org     boot
```

That is the decoy and boot of "Stages around evolved warriors" around Cranky Mongoose VI: 15 lines for 94 instructions. Changing 85, 37, or `c0` keeps it a decoy and a boot.

```sh
make
build/42gen decoy.gen > decoy.red        # the warrior
build/42gen --text decoy.gen             # the generator as 42gen prints one: labels L<line>, f<line>
build/42gen --from warriors/dwarf.red    # a warrior as a generator, one line per instruction
```

`--size` and `--length` set the core size and the longest warrior (8000 and 100).

**Lines:**

| line | meaning |
|---|---|
| `OP.M ma, mb` | one instruction: opcode, modifier, two modes and two expressions (`MOV` to `NOP`, no `LDP` and `STP`, as today) |
| `repeat n` ... `end` | the lines between, n times; n is an expression, below 0 it is 0 |
| `def` ... `end` | a function: its lines are written where it is called, not here. Only at the top level; its label is its name |
| `f(a, b)` | a call of the function at label `f`, with up to 2 expressions as arguments |
| `org label` | the warrior starts at the first instruction of that line. Without an `org`: at its first instruction |
| `cN = v` | constant N (0 to 15) |

**Expressions** (at most 7 tokens, kept in postfix): numbers, `+ - * / %`, parentheses, and

| | value |
|---|---|
| `c0` .. `c15` | a constant |
| `i`, `j`, `k` | the repetition (from 0) of the innermost `repeat` around the line, the next one out, the third; 0 without one. The lines of a function do not see the loops of its caller: `f(i)` passes one |
| `x`, `y` | the arguments of the call running; 0 outside a function or without that argument. An argument is evaluated where it is used, so a label passed as an argument stays a place |
| `label` | the distance from this instruction to the first instruction of that line (of an `end`: to the cell behind its block), as a label in Redcode |
| `label.len` | how many instructions that line wrote (a `repeat`, a call, a `def`: its block) |
| `CORESIZE` | the core size |

`*` and `%` in front of an operand's expression are a mode only as its first character.

**A function, called twice:**

```
f:      def
top:      SPL.B   $0, <x               ; x: the first argument
          MOV.I   }top, >top           ; top: this call's own SPL
          JMP.B   $top+y, $0
        end
        f(c0, 2667)
        f(c0+7, 2*2667)
```

## What a generator means

**Writing.** The top-level lines run in order; `def` blocks are skipped. An instruction line appends one instruction. A `repeat` evaluates its count, then runs its lines that many times. A call runs the lines of its function. Each repetition and each call is a *frame*; the frames form a tree with the top level as root.

**Limits,** which make every generator stop:

- 256 lines, 7 tokens per expression.
- 8 frames deep. A `repeat` or a call beyond that writes nothing. A call of a function that is already running writes nothing (no recursion), also a call of a line that is no `def`.
- 1024 steps (lines written, repetitions, calls). Out of steps, or one instruction more than `max_length`: writing stops there, and the generator is *truncated*. Breeding never keeps a truncated generator.
- A generator that writes nothing gives one `DAT.F $0, $0`.

**Instances.** A line inside a `repeat` or a function is written several times. A reference means the instance *nearest in the frame tree*: the one whose frame shares the longest path from the root with the frame of the instruction that refers to it, and of several the first written. So:

- inside a repetition or a call, a label of the same block means this repetition's or this call's own instance (in the function above, each call's `top` is its own `SPL`);
- from outside, it means the first instance;
- the label of a `def`, used inside it, is where this call's block starts: a function can refer to itself.

A line that wrote nothing still has a place: where its instruction would have been.

**Operands** are evaluated after all instructions are written, so they can refer forwards. **Counts** are evaluated while writing: a label that is not written yet is 0 there, a `.len` of a block that is still being written is its length so far, and a place is taken relative to the next instruction.

**Arithmetic** is on integers. A number is written and kept mod the core size and stands for the value between -core/2 and core/2. `/` rounds towards 0; `/` and `%` by 0 give 0. A value beyond ±2³¹ is replaced by its remainder mod the core size. The result of an operand is taken mod the core size; a count below 0 is 0.

**A missing thing is 0:** a constant, argument or loop that is not there, a label whose line was never written.

## The data (`evolver/generator.h`)

```c
typedef struct { uint8_t n, kind[7]; uint32_t v[7]; } gen_expr;   // postfix
typedef struct {
  uint8_t kind, op, mod, am, bm;   // GL_EMIT, GL_REPEAT, GL_END, GL_DEF, GL_CALL
  uint32_t callee;                 // GL_CALL: the line of the def
  gen_expr x[2];                   // operands; the count; the arguments
} gen_line;
typedef struct { uint32_t n, start, c[16]; gen_line l[256]; } gen;
```

Plain data without pointers, 21.6 KB, copied like today's genome (4 KB). `gen_compile()` takes 0.1 µs for a warrior of 4 instructions, 3 µs for the decoy and boot above, and 0.8 ms for the worst generator found (a label with 144 instances, used 800 times from 8 frames deep); a battle takes about a millisecond. References (label tokens, `callee`, `start`) are line indices. `i`, `x` and the constants are not references: a line keeps its meaning when it moves into another loop or function.

A list genome becomes a generator line by line: an operand that is a reference becomes a label, a value a number. `gen_compile()` of that gives back `genome_code()`.

## Changes (step 2)

**Units.** A unit is an instruction line, a call, or a whole block (`repeat` or `def` with everything to its `end`). The old changes that insert, delete, duplicate, move or cross over work on runs of units within one block, through one rebuild that renumbers every reference, as `genome_rebuild()` does. In a generator without structure the units are the lines, and the rebuild is the list's.

**The old kinds** (built), unchanged in name and weight: `opcode`, `modifier`, `a-mode`, `b-mode`, `a-operand`, `b-operand`, `org`, `replace`, `insert`, `delete`, `duplicate`, `move`, `crossover-insert`, `crossover-replace`, `related-opcode`, `related-mode`, `shared-constant`, `tune`. On a generator with structure:

- **The point changes** take one of the instruction lines.
- **An operand change** takes one number or label of the expression and changes it as today; `i`, `x`, the constants and the operations stay. A label that becomes a number is the distance it stood for in the warrior.
- **Insert, delete, duplicate, move** take a sequence (the top level or the inside of a block, a longer one more often), then units of it as today.
- **A crossover** takes units of one sequence of the second parent, and the functions that they call. A label of a line that does not come along becomes its distance in the second parent's warrior, a constant its number. A `def` goes to the top level only.
- **`shared-constant` and `tune`** take the far numbers in the operands of instructions and in the arguments of calls. A count is not one.

**The new kinds.** Each rewrites and then varies (principle 5). The first seven are built (step 2b), the functions are step 2c:

| kind | rewrite, which leaves the warrior as it is | variation |
|---|---|---|
| `repeat` | a run of units goes into `repeat 1` (`gen_wrap()`) | the count becomes 2 to 8, as far as the length allows; half of the time one operand of one of its instructions gets `+ i*d` |
| `count` | | a number of a count: one more or less (half of the time), doubled, halved, or 0 to 8; a count without a number gets `+ 1` or `- 1` |
| `fold` | two neighbouring instructions with the same opcode, modifier and modes become a `repeat 2` around one (`gen_fold()`): two numbers become `a + i*d`, d their difference; an expression that both have stays; each one's own label stays | the count becomes 3 to 9: the two are continued as a row |
| `unroll` | a `repeat` whose count is a number up to 16 becomes its repetitions, `i` replaced by their numbers and what that leaves (`+ 0`, `2*5`) worked out (`gen_unroll()`) | one point change (opcode, modifier, a mode or an operand) in one of them: the copies may differ now |
| `index` | | an operand inside a `repeat`: the d of its `i*d` changes, or it gets `+ i*d` (d 1 to 8 or a far value; a quarter of the time the `i` of a loop further out) |
| `expression` | | an operand or an argument: a value replaced (40%), one more operation with a new value (40%), or the last operation removed and one of its sides kept (20%) |
| `constant` | a far number becomes an unused `cN`; other far numbers that are the same, its negative, its double or within 16 of it become `cN`, `0-cN`, `cN*2`, `cN+d` (`gen_bind()`) | the constant moves by a `tune` step: every use moves with it. Half of the time (when a constant is in use) one of those moves instead |
| `extract` | a run of units becomes a `def` and one call | a second call somewhere else |
| `parameter` | a number in a function becomes `x` or `y`; every call passes that number | one call passes another |
| `call` | | one more call of a function, with the arguments of an existing call, one of them changed |
| `inline` | a call becomes the function's lines, arguments filled in | one change in them |
| `transplant` | | a function of the second parent and a call of it |

- **Live lines.** A change of a line takes a line that the warrior has. A line of a function nobody calls, or of a block that repeats 0 times, gives the same warrior whatever it becomes, and `42evolve` has seen that one. In a generator without structure every line is live.
- **A constant that nothing uses any more is 0** after breeding, so that the text of a generator shows the ones that matter.
- **Where a rewrite does not apply,** because it would not keep the warrior:
  - a wrap or an unroll with a call among the lines, while some line refers to a line of a function from outside that function: such a label means the nearest call's instance, and the block changes which one that is;
  - an unroll when something uses the block's length, or its end while no instruction, repeat or call follows it, or when a count inside the block uses a place of the block (a count sees the repetitions before its own);
  - a fold when a third line refers to the second instruction;
  - a constant's double or negative only as integers, not mod the core size: the number may be divided further on.
- **How often a change leaves the warrior as it was,** on generators grown from lists by 200,000 changes that each gave another warrior (the default mix; such a child is skipped as seen):

| | | | | | |
|---|---|---|---|---|---|
| `repeat` 0.0% | `count` 0.1% | `fold` 0.0% | `unroll` 9% | `index` 14% | `expression` 8% |
| `constant` 1.5% | `opcode` 6% | `modifier` 14% | `a-mode`, `b-mode` 12% | `a-operand`, `b-operand` 5% | `move` 10% |

Nobody writes a function: `extract` makes one from lines that evolved, `call` and `parameter` reuse and vary it, `transplant` and the crossovers carry it to other warriors, and a function nobody calls is removed.

**Limits on a child:** at most `max_length` instruction lines, 256 lines, and a warrior of 1 to `max_length` instructions that is not truncated. A change that breaks one of them does not apply and another is drawn, as today for an insert at the longest length.

## In `42evolve` (step 2)

- **`--genome list|gen`,** `list` the default. A run folder keeps its kind.
- **The `genome` struct** has a `gen` next to its list (26 KB instead of 4). For a generator the list holds the compiled warrior, so `make_warrior()`, `genome_hash()`, `genome_text()`, the names, the style and the events' `length` need no change. `genome_breed()`, `genome_save()` and `genome_load()` branch on the kind; a random or a start warrior is made as a list and becomes a generator line for line (`genome_as_generator()`).
- **Random starts** are generators without structure, drawn as today: structure has to pay to appear.
- **Events** carry the generator's text next to the code (`"gen"`), `best.gen` is the generator of `best.red`, and the state file has the generator's numbers (`gen_save()`).
- **`--changes`** takes the new names, with `--genome gen` only. Without `--changes` a run on generators draws the weights of a list and `repeat` 30, `count` 40, `fold` 30, `unroll` 15, `index` 40, `expression` 40, `constant` 40: a fifth of the changes. A first guess; step 2 sets it by measurement.
- **Refused with `--genome gen` at first:** `--tune-novel`, which writes into the list's operands. Later it tunes the numbers and constants of the generator. (`--optimize` takes a warrior file and stays a list.)
- **The dashboard** shows the generator's text above the code (step 4). No parser in JavaScript: the text comes from the events.

## Steps and gates

| step | what | gate |
|---|---|---|
| 1, done | The language: `gen_compile()`, text form both ways, `42gen` | The hand-written decoy and boot of 20th November as a generator gives the same warrior. 2,000 random list genomes as generators compile to `genome_code()`, and the 282 warriors of `warriors/evolved` write themselves. 20,000 random generators, 3,000 with random bytes and 5,000 changed texts stay within the limits under ASan and UBSan. 38 mutants of `generator.c`: 37 fail a test, one is equivalent (an eighth token is refused one push later) |
| 2a, done | The old kinds on generators, `--genome gen` | For generators without structure: the same child, the same answer and the same random numbers as `genome_change()` in 60,000 changes of all 18 kinds, and as `genome_breed()` in 20,000 children. A run with `--genome gen` writes the events of `--genome list`, the generator texts aside: 40 batches on the tiny hill with the default mix and with all 18 kinds, 3 islands, and both equal the build before this step. 40,000 changes of random generators with structure give well-formed children within the limits. 44 mutants: all fail a test |
| 2b, done | `repeat`, `count`, `fold`, `unroll`, `index`, `expression`, `constant` | Tiny hill, the setting of the thirteenth comparison, 48 pairs of islands with the same seeds: the mean at batch 100 not below the list's by more than 1 point. It is 3.2 above ("Step 2b on the tiny hill" below) |
| 2c | Functions: `extract`, `parameter`, `call`, `inline`, `transplant` | The same comparison |
| 3 | '94nop: 8 islands against 8, the setting of the twelfth comparison, then the long runs | The top three against the 1,107: above the list's. And by looking: decoys, tables, a second stage? |
| 4 | The dashboard shows the generator; `--optimize` and `--tune-novel` on generators | |

The reference for "rivals" is to be measured once before step 3: the scores of the hill's own warriors on the same bench (median 145; the top is not recorded yet).

## Step 2b on the tiny hill

20th November 2026. The setting of the thirteenth comparison of `docs/evolver.md`: 16 islands per run, a panel of 30 picked by kinds, `--batch 128 --screen-stop 3 --positions mirror --pushoff pareto-sd`, each island's best of four warriors against the 429 tiny warriors at batch 100. `--genome gen` with its default mix on seeds 201, 217 and 233; the list arm is that comparison's (`sh167-abs`), and its block 201 run again with this build gave the same 16 scores. An island of each arm starts from the same random warriors.

| | mean | sd | worst, best | blocks 201, 217, 233 |
|---|---|---|---|---|
| lists | 89.9 | 10.3 | 79.7, 128.7 | 91.2, 90.1, 88.4 |
| generators | 93.1 | 11.9 | 74.1, 123.9 | 98.0, 90.4, 90.8 |

- **Island by island:** generators less lists is +3.2 (sd 15.0, t 1.45), ahead on 31 of 48. The gate (not more than 1 point below) holds; that generators are better is likely and not shown.
- **The structure is used.** Of the 15,360 warriors that entered in batches 80 to 99, 70% have a `repeat`, 83% a constant, and 69% write more instructions than they have instruction lines.
- **The new kinds make warriors that enter about as often as the old ones:** 17% of the changes behind the warriors that entered, with 19% of the draws (`constant` 5,780, `expression` 3,963, `index` 3,089, `count` 1,146, `repeat` 1,137, `unroll` 1,062, `fold` 186).
- **What they build** is rows of one instruction with a step. The best island's best warrior (Binary Hedgehog IX, 123.9, 20 instructions from 12 instruction lines):

```
c0 = 232
c1 = -137
        SPL.F   #2, #L2-2
        repeat  7
L2:       MOV.I   }3, }14+i*(-3-c0)
        end
L4:     SPL.B   #15+14, #L6--4
        repeat  3
L6:       MOV.I   }1, }14+i*c0
        end
        repeat  2
L9:       MOV.I   @L9+i*L4+5, <c1+-3+i*-12
          JMP.A   <317, }12+i*46
        end
        JMP.A   }4, }11
        JMN.BA  {12, <c1
        JMP.A   }4, }16
        JMN.BA  {4, <c1+6
```

- **What this hill cannot show:** its warriors have 20 instructions at most, and both arms fill them (17.9 and 18.7 on average, 57% and 56% at 20). There is no room for a decoy or a second stage. That is the '94 hill, step 3.

## Risks

- **No gradient.** A boot alone loses 1 to 9 points (same section); only boot, offset and decoy together gain. One change will not make all three. The language shortens such paths; it does not remove them. If step 3 shows structure but no gain, the next lever is the evaluation, not the language.
- **A larger space is slower at first.** The new kinds take draws from the old ones. Gate 2b is set to catch that; the share of the new kinds is a setting.
- **Bloat.** Hidden lines (a `repeat 0`, an uncalled function) cost nothing in a battle. Limits: the line counts above, and functions nobody calls are removed.
- **Evolved code reads the core next to it.** A part moved into another warrior meets other neighbours and often breaks (16 unused instructions in front cost 15 to 20 points). `DAT.F $0, $0` is what empty core holds, so a `repeat` of it is a gap that a scanner comparing cells cannot see; it costs length only.
- **Effort in `evolve.c`.** The options that write into operands (`--optimize`, `--tune-novel`) need their own code for generators.

## Decided against

- **Trees with names and scopes.** A changed tree needs its names checked and repaired. Line indices that one rebuild renumbers, and `i`, `x` without names, need neither.
- **Conditions and recursion.** A generator has no input, so a condition only selects by `i`; two lines in a `repeat` do that. Left out until something needs them.
- **A library shared by the list.** Functions live in the generator that uses them and travel by crossover. A shared library needs credit assignment between warriors and a second kind of state.
- **Changes that keep the warrior, entering the list.** They would need the seen-table to let them pass and a rule for which of two equal warriors stays.
