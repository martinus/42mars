# Redcode and MARS semantics

This document describes the observable behavior of the engine in
`src/engine/`: the expression evaluator, the assembler and the simulator. The
behavior matches pMARS 0.9.x, the reference Core War simulator, including some
of its quirks, because existing warriors depend on them.

The engine was written from this description, without access to pMARS source
code, and checked against reference outputs: 4031 expressions, 146 small
sources (`test/fixtures/`), 567 hill warriors and 319 battles with core
hashes. `tools/pmars-diff.mjs` and `tools/expr-fuzz.mjs` compare it with a
pMARS binary, used as a black box, on corpus warriors and random input.
Section 4 lists where the engine deliberately differs.

Three modules, plain JavaScript ES modules, no dependencies:

- `expr.js`: expression evaluator
- `assembler.js`: Redcode assembler
- `mars.js`: simulator

`opcodes.js` holds the opcode, modifier and mode tables and the formatting.

---------------------------------------------------------------------------

## 1. expr.js

### API

```js
export const EVAL_OK = 0;
export const EVAL_OVERFLOW = 1;   // result valid, but 64-bit overflow happened
export const EVAL_BAD = -1;       // syntax error
export const EVAL_DIV_ZERO = -2;  // division or modulo by zero
export class Evaluator {
  constructor();          // all 26 registers are 0n
  resetRegisters();
  evaluate(text) -> { status, value }   // value is a BigInt
}
```

Registers persist across `evaluate` calls of one `Evaluator` instance.

### Syntax and semantics

- Integers are signed 64-bit (`BigInt` clamped by wrapping with
  `BigInt.asIntN(64, x)`). When a binary `+`, `-` or `*` result leaves the
  64-bit range, the result wraps and the status becomes `EVAL_OVERFLOW`,
  unless the status already is an error. Unary minus wraps without changing
  the status (`-(-9223372036854775807-1)` is -2^63 with `EVAL_OK`). `/` and
  `%` truncate toward zero, the sign of `%` follows the dividend (like C).
  Division or modulo by zero gives `EVAL_DIV_ZERO` and the value 0 for that
  operation; the evaluation continues.
- A number literal is a run of up to 20 decimal digits. Values above
  2^63 - 1 saturate to 2^63 - 1 (no overflow status). A digit run longer than
  20 digits leaves the remaining digits unconsumed, which ends as a bad
  expression.
- Whitespace (space, tab, CR, LF, VT, FF) may appear between tokens.
- Unary operators `-`, `+`, `!` (logical not: 1 if operand is 0, else 0) bind
  tightest and can be stacked: `3--2` is 5, `!!5` is 1.
- Parentheses group. A missing `)` is `EVAL_BAD`. Text left over after the
  expression (e.g. an extra `)`, or `1 2`) is `EVAL_BAD`.
- A single letter `a`..`z` or `A`..`Z` (case-insensitive, same register) is a
  register. A register followed by `=` (but not `==`) is an assignment: a new
  expression starts after the `=` and runs to the end of the text or to the
  next `)` that it does not open itself; its value is stored in the register
  and is the value of the assignment. E.g. `(b=3)+b` is 6 and `a=b=4` sets
  both to 4.
- Binary operators, from highest to lowest precedence:
  1. `*` `/` `%`
  2. `+` `-`
  3. `==` `!=` `<` `>` `<=` `>=` (one level, result 1 or 0)
  4. `&&` (result 1 or 0, both sides always evaluated)
  5. `||` (result 1 or 0, both sides always evaluated)

  The order in which they are applied follows pMARS, see "Evaluation order".
  For most expressions this is ordinary left-associative precedence.
- A single `&`, single `|`, single `=` (outside an assignment), a single `!`
  or any other character where an operator is expected makes the expression
  `EVAL_BAD` (for the first four pMARS has no defined result, see
  "Deviations from pMARS").
- An empty expression is `EVAL_BAD`.
- Status: `EVAL_BAD` and `EVAL_DIV_ZERO` replace whatever status there was,
  `EVAL_OVERFLOW` is only set while the status is `EVAL_OK`. So the last
  error wins, and once an error happened the result is an error. An operand
  that is missing or invalid (e.g. `1+)`) sets `EVAL_BAD`, counts as 0 and the
  evaluation goes on; a non-operator where an operator is expected sets
  `EVAL_BAD` when it is applied and gives 0.

### Evaluation order

pMARS evaluates with a precedence-climbing parser that has two defects, and
the engine reproduces its procedure:

- An operator that ends a nested part (a part started because the operator
  after an operand binds tighter than the one before it) is handed back
  through one variable shared by all levels of the parser. The level that
  started the nested part continues with it only if its precedence is at
  least that level's minimum precedence, otherwise it is handed back further.
  The comparison is "at least", where correct precedence climbing would use
  "higher than", so the operator can be applied at a level that is too deep.
- A handed-back `==` is dropped: the level returns without reading further,
  so the rest of the text stays unread and the expression normally ends as
  `EVAL_BAD` (missing `)` or text left over). `!=`, `<` etc. are not dropped.

The procedure, with precedences IDENTITY 0, `||` 1, `&&` 2, comparisons 3,
`+ -` 4, `* / %` 5, where IDENTITY is the operator in front of the first
operand of an expression and gives its right operand:

```
evaluate(text):
  status = OK
  value = E(-1, 0, IDENTITY)
  if text is left: status = BAD
  return status, value

E(minPrec, acc, op1):            # acc op1 <operand> ...
  saved = NONE                   # one variable for all calls of E
  v = operand()                  # may call E itself (parentheses, assignment)
  skip whitespace
  if at the end of the text or at ')': return apply(op1, acc, v)
  op2 = read operator
  if prec(op1) >= prec(op2):
    if prec(op2) > minPrec: return E(minPrec, apply(op1, acc, v), op2)
    saved = op2                  # hand op2 back
    return apply(op1, acc, v)
  r = E(prec(op1), v, op2)       # op2 binds tighter: nested part
  result = apply(op1, acc, r)
  if saved is not NONE and not '==' and prec(saved) >= minPrec:
    return E(minPrec, result, saved)
  return result                  # saved stays set for the caller

operand():
  skip whitespace
  '(' : v = E(-1, 0, IDENTITY); if not at ')': status = BAD; skip one character
  '-', '!', '+': unary operator applied to operand()
  letter: register; with '=' (not '==') after it: register = E(-1, 0, IDENTITY)
  digits: number
  else: status = BAD, value 0, nothing consumed
```

Examples (more in `test/fixtures/expressions.json` and
`test/pmars-quirks.test.js`):

| expression | result |
|---|---|
| `5<7-6/8<8` | 0 (ordinary precedence: 1) |
| `1>=9+a%6>=8` | 1 (ordinary precedence: 0) |
| `b=0==2%9==8` | bad |
| `1+2*3==7` | bad (nested `2*3` under `+`, ended by `==`) |
| `2*3+4*5==26` | bad |
| `1==2+3==0` | bad (nested `2+3` under `==`, ended by `==`) |
| `7==1+2*3` | 1 |
| `1+2==3` | 1 (no nesting: `+` and `==` simply continue left to right) |
| `1*2+3==5` | 1 |
| `1+2*3!=7` | 0 |

`test/fixtures/expressions.json` has 4031 expressions, including 4000
random ones, with their expected status and value. `tools/expr-fuzz.mjs`
compares the evaluator with an external reference evaluator on random
expressions.

---------------------------------------------------------------------------

## 2. assembler.js

### API

```js
export const DEFAULT_OPTIONS = Object.freeze({
  coreSize: 8000, maxProcesses: 8000, maxCycles: 80000, maxLength: 100,
  minDistance: 100, rounds: 1, warriors: 2,
  pSpaceSize: 0,   // 0 means floor(coreSize / 16)
  readLimit: 0,    // 0 means coreSize
  writeLimit: 0,   // 0 means coreSize
});
export const PMARS_VERSION = 95;
export function defaultModifier(op, aMode, bMode) -> modifier index
export function assemble(source, options = {}) -> result
```

`result`:

```js
{
  ok,                 // true when there is no error
  name, author,       // defaults 'Unknown', 'Anonymous'
  date, version,      // defaults ''
  strategy,           // ;strategy lines joined with '\n', '' if none
  instructions,       // [] when !ok, else [{ op, mod, aMode, aVal, bMode, bVal, line }]
  start,              // start offset, default 0
  pin,                // number or null
  errors,             // [{ severity: 'error', line, text }]
  warnings,           // [{ severity: 'warning', line, text }]
  expanded,           // array of the statement strings after expansion (debug aid, free format)
  options,            // the effective options (defaults filled in)
}
```

`op`, `mod`, `aMode`, `bMode` are indices into `OPCODES`, `MODIFIERS` and
`MODE_SYMBOLS` of `opcodes.js` (modes `#$@<>*{}` are 0..7). Values `aVal` and
`bVal` are normalized into `0 .. coreSize-1`. `line` is the 1-based physical
source line of the statement the instruction came from (see "Line numbers").
`line` in messages is that line number or `null`.

Error and warning texts are short, plain English and say what is wrong.
Which conditions are errors and which are warnings is specified below; the
reference tests compare `ok` and the number of warnings.

### 2.1 Reading lines

- A physical line is the text up to and including the next LF (the last one
  may have no LF). A final LF does not start another line.
- The content of a physical line ends at its first CR or LF. Text after a
  lone CR up to the next LF is ignored: `mov 1, 2\rdat 3\n` is only
  `mov 1, 2`. A CRLF line end is just the end of the content.
- Line continuation: if the content of a physical line, after appending it to
  the current logical line, makes the logical line end with `\`, and no `;`
  appeared in any of its physical lines so far, the `\` is removed and the
  content of the next physical line is appended directly. A `\` at the end of
  the last physical line of the file stays part of the text.
- The line number of a logical line is the number of its first physical line.

Each logical line is classified by its first non-whitespace character:

- Empty: ignored.
- `;`: a comment line. Look at the identifier (see tokens) that follows the
  `;` after optional whitespace:
  - `redcode` (case-insensitive), only when it starts directly after the `;`
    with no whitespace in between, and the identifier is exactly that word
    (`;redcode-94` and `;REDCODE` count, `; redcode` and `;redcode94` do not).
    The first such line discards all statement lines and assert lines
    collected so far (metadata already read stays). The second such line ends
    reading: it and everything after it are ignored.
  - `name`, `author`, `date`, `version` (case-insensitive): the value is the
    rest of the line after the word and the whitespace following it,
    unchanged, trailing whitespace and any `;` included (`;author Scott
    Adkins ` gives `"Scott Adkins "`). An empty value resets name to
    `Unknown`, author to `Anonymous`, date and version to `''`. Later lines
    overwrite earlier ones.
  - `strategy`: the rest of the line after the word, without leading and
    trailing whitespace, is appended to the strategy list (pMARS does not
    show it).
  - `assert`: the line is kept, in order, among the statement lines, as an
    assert line. Its expression is the text after the word, up to a further
    `;` if there is one.
  - Anything else: ignored.
- Otherwise: a statement line. Everything from the first `;` on is removed.

### 2.2 Tokens

Used in both passes:

- number: a run of decimal digits
- identifier: a letter or `_`, followed by letters, digits or `_` (ASCII)
- operator characters: `(` `)` `/` `+` `-` `%` `!` `=`, and the two-character
  tokens `&&` and `||`
- mode characters: `#` `$` `@` `<` `>` `*` `{` `}`
- `&` (a single one): concatenation
- `,` field separator, `.` modifier separator, `;`
- anything else is a single-character "other" token (e.g. `[`, `|` alone)

### 2.3 Pass 1: expansion

Pass 1 walks the lines in order and produces the list of statements, where
each statement is a text string that begins with an opcode, plus its line
number. It handles labels, `EQU`, `FOR`/`ROF`, `CURLINE`, asserts and `END`.
There is an instruction counter, starting at 0, that counts emitted real
instructions (not `ORG`, `END`, `PIN`).

The symbol table holds three kinds of names, all case-sensitive:

- label: value is an instruction index
- EQU name: value is a list of text lines (the body)
- FOR counter: value is the current iteration number, only while its FOR block
  is being expanded

Predefined EQU names exist from the start, each with one body line holding a
decimal number: `CORESIZE`, `MAXPROCESSES`, `MAXCYCLES`, `MAXLENGTH`,
`MINDISTANCE`, `VERSION` (95), `WARRIORS`, `ROUNDS`, `READLIMIT`,
`WRITELIMIT`, `PSPACESIZE`, with values from the options (`READLIMIT`,
`WRITELIMIT` and `PSPACESIZE` after defaults are filled in).

When a name is looked up and several definitions exist (e.g. a FOR counter
that shadows an outer one of the same name), the newest wins.

#### Statement structure

A statement line consists of, in this order:

1. Zero or more new labels: identifiers that are not defined yet. A label may
   be directly followed by `:` (no whitespace in between), which is skipped.
   Pending labels collect across lines until a statement uses them, so a
   label may be alone on its line. At most 7 labels may be pending; the 8th
   is an error ("too many labels") and is not added.
2. One of:
   - an opcode or pseudo-opcode (`ORG`, `END`, `PIN`), case-insensitive,
     followed by operands
   - `EQU` (case-insensitive)
   - `FOR` (case-insensitive)
   - `ROF` (case-insensitive)
   - an EQU name, which is substituted (see EQU)
   - nothing (only labels): they stay pending
   An opcode name is always an opcode, never a label, e.g. `div dat 0` is the
   opcode `DIV` with a bad operand.

At the label position:

- An identifier that is a defined label or FOR counter is a redefinition:
  warning ("label redefined"), and the whole line is dropped (no statement,
  pending labels stay pending).
- A number, operator, mode character or other token where a label or opcode
  is expected is an error ("unexpected token").

#### Building the statement text

For an opcode line, the statement text is built token by token:

- The opcode word, uppercased, followed by all non-whitespace characters that
  are glued to it in the source (e.g. `mov.ab` gives `MOV.ab`, `mov.ab#1,2 `
  gives `MOV.ab#1,2 `), followed by one space if the next source character is
  whitespace. When glued characters run to the end of the line, old content
  of pMARS's scratch buffer follows them (see "The scratch buffer").
- Then the operand tokens:
  - a defined label: replaced by its value minus the current instruction
    counter, in decimal (e.g. `-3`). For `ORG`, `END` and `PIN` operands: the
    label value itself (absolute).
  - a FOR counter: its iteration number, at least two digits, zero-padded
    (`01`, `02`, ..., `10`, `120`).
  - an EQU name: its body is substituted (see below).
  - `CURLINE` (exactly this spelling, case-sensitive): the current instruction
    counter in decimal.
  - any other identifier (a forward reference, or a register letter): copied
    unchanged.
  - after a replaced or copied identifier (all four cases above, except EQU
    names, see below), one space is added if the next source character is
    whitespace.
  - numbers, operators, mode characters, `,`, `.` and other tokens: copied
    without any space. A consequence: `dat 1 2` becomes `DAT 12`.
- `CURLINE` at the label position is an error.

After the operands, the pending labels get the instruction counter as value
(so a label may refer to itself: `imp mov imp, imp+1`, where `imp` in the
operands is still unknown in pass 1 and is resolved in pass 2). For a real
opcode the counter then increments. For `END`, pass 1 stops completely:
nothing after the `END` statement (also not later lines) is processed. `ORG`,
`END` and `PIN` produce statements too (pass 2 evaluates them).

#### Identifier concatenation with `&`

An identifier directly followed by `&` and a letter is a concatenation: the
identifier after `&` must be an active FOR counter, and its iteration number
(at least two digits) is appended to the name. Several can follow each other
(`x&i&j`). This applies everywhere an identifier is read in pass 1 (label
position and operands). If the name after `&` is not a FOR counter: error;
the name read so far is used, further `&` parts are skipped, and the line is
processed on (its statement still counts as an instruction). The resulting
name is then treated like any identifier (new label, defined label, EQU name
...).

#### The scratch buffer

pMARS keeps one character buffer of 256 bytes, all 0 at the start, that
several steps overwrite with a string followed by a 0 byte. Older bytes
after that 0 byte stay. This is visible in one case only: an opcode with
characters glued to it at the end of a line. Corpus warrior `asianflu.red`
has the line `\tdat#9`, which pMARS assembles as `DAT.F #0, #90`. The engine
models the buffer for each assembly (class `Scratch` in `assembler.js`).

Writes, in program order:

1. Reading the source: each physical line is stored at the current end of
   the logical line (position 0 for a new logical line, the position of the
   removed `\` for a continued one), all its characters including CR and LF,
   then a 0 byte. Then the CR or LF that ends the content is replaced by a 0
   byte. Reading stops at the second `;redcode` line. At the end of the file
   the first byte becomes 0.
2. Pass 1, every identifier it reads, anywhere: labels, opcodes, keywords,
   EQU names, operands, FOR counts, assert expressions, lines of EQU and FOR
   bodies each time they are expanded, and the identifiers passed over while
   a block with count <= 0 is skipped: the identifier uppercased, then a 0
   byte. Not written: the `assert` keyword of an `;assert` line, other
   comment lines, and EQU bodies when they are defined.
3. Pass 1, a label, FOR counter or `CURLINE` replaced by a number in an
   operand: the number text, a space if one is added to the statement text,
   then a 0 byte.
4. Pass 1, `&` concatenation: for each `&name`, the name as written, then a 0
   byte; if it is a FOR counter, its two-digit text, then a 0 byte.
5. After an opcode (stored by step 2): the glued characters right behind it,
   without a 0 byte; then, if whitespace follows, a space and a 0 byte.

The opcode part of the statement text is the buffer from the start up to its
first 0 byte. With whitespace after the glued text this is the opcode, the
glued text and a space, as described above. When the glued text runs to the
end of the line, older bytes follow. Example, a file whose last line is
`\tdat#9`: reading leaves `\tdat#9` in the buffer, `DAT` replaces the first
three bytes and `#9` the next two, the old `9` and the 0 byte after it stay,
so the statement text is `DAT#99`.

pMARS keeps the buffer between the warriors of one run. The engine starts
every assembly with a fresh buffer, which is exact for the first warrior.

#### EQU

`labels EQU text`: all pending labels become names for the text that follows
the `EQU` keyword on that line (raw, comment already removed, leading
whitespace kept). The pending labels are consumed. Each directly following
statement line whose first token is `EQU` (without labels) adds one more body
line (the text after its `EQU`); comment lines between them were already
removed in reading, so they do not break the chain. `EQU` lines produce no
statements. `EQU` without pending labels: warning, the line is ignored.

When an EQU name is used (at the statement start or in operands), its body is
expanded in place, as if the text was written there, with these details:

- The current output text and pending labels carry over into the first body
  line.
- If the body has several lines: each body line that ends up as a complete
  statement (opcode with operands) is emitted as its own statement (with the
  line number of the body line), and the next body line starts a fresh
  statement text. The last body line is continued by the rest of the line
  where the name was used.
- After the body, if the character following the EQU name at the use site is
  whitespace, one space is added.
- Body text is processed with the same rules (labels, nested EQU names, FOR
  counters, CURLINE). Using an EQU name inside its own expansion is an error
  ("recursive EQU").
- Using an EQU name at the label position when the name is already defined as
  an EQU name expands it (so `x equ 1` followed by `x equ 2` expands the first
  `x` and then fails on `1 equ 2`).

A `FOR ... ROF` block may be written inside one multi-line EQU body and is
expanded when the EQU is used.

#### FOR and ROF

`[labels] FOR expression`: if labels are pending, the last one (the one
written directly before `FOR`) is the counter name, and the others become
labels with the current instruction counter as value. The expression text is
built like operand text (labels relative to the instruction counter) and
evaluated (error if it fails: division by zero or bad expression; then the
block is not expanded and nothing is skipped either).

- If the count is <= 0: the following lines are skipped up to the matching
  `ROF`. While skipping, each line is scanned from the start: identifiers
  that are not keywords are passed over; the first `FOR` raises the nesting
  depth and the first `ROF` lowers it (the block ends when the depth returns
  to zero), and either one ends the scan of that line; an opcode, `EQU`,
  `CURLINE`, a comment token or any non-identifier token also ends the scan
  of the line. Nothing else is processed: no labels, no EQU definitions, no
  asserts.
- Otherwise the count is taken modulo 65536 and the lines between `FOR` and
  the matching `ROF` are expanded that many times, with the counter set to
  1, 2, ..., count. Nested `FOR` blocks inside are expanded recursively each
  time. Label definitions inside the block happen on every iteration, so a
  plain label inside a repeated block is redefined in the second iteration
  (warning, line dropped); concatenation (`imp&N`) avoids that.
- After the block, the counter name is undefined again. Expansion continues
  after the `ROF` line. Text after `ROF` on that line is ignored.
- A `FOR` whose `ROF` is missing: warning ("FOR without ROF"), the block is
  expanded once as far as it goes, and then pass 1 stops (nothing after is
  processed).
- A `ROF` without `FOR`: error. `FOR`, `ROF` or `EQU` after a label-position
  opcode (e.g. in an operand): error.

#### Asserts

An assert line is processed when pass 1 reaches it (so inside an expanded FOR
block once per iteration, and never inside a skipped block). Its expression
text is built like operand text and evaluated. If evaluation fails: warning
("invalid assert"). If it succeeds: the warrior counts as having an assert;
value 0 is an error ("assertion failed"); overflow is a warning. If no assert
succeeded in evaluation in the whole file: warning ("missing ;assert").

#### End of pass 1

Labels still pending after the last line: warning ("labels discarded").

### 2.4 Pass 2: parsing statements

Each statement from pass 1 is parsed. The instruction counter starts at 0
again and counts real instructions.

Grammar of a statement text:

```
opcode [ '.' modifier ] [ mode ] expr [ ',' [ mode ] expr ]
ORG|END|PIN expr
```

- Modifier: `A B AB BA F X I`, case-insensitive. Anything else after `.` is an
  error. A `.` anywhere else is an error.
- Mode: one of `#$@<>*{}` directly at the start of an operand. Default `$`.
- Expression text: the tokens up to `,` (A operand) or the end (B operand).
  Inside an expression (after its first token), the characters `<`, `>` and
  `*` are operators (comparison, multiplication); other mode characters there
  are an error. A second `,` is an error.
- Identifiers that are still in the text:
  - a label: replaced by its value minus the instruction counter. In the
    operand of `ORG`, `END` and `PIN`: by its value (absolute). The value is
    kept apart from the text before it, as if a space were there: `2x` with
    x = 1 is the bad expression `2 1`, not 21. (Pass 1 joins: `dat #2x` with
    x defined before the line gives `2-1`.)
  - an EQU name (only possible when it was defined after its use): replaced by
    the first line of its body only, parsed in place (it can supply a mode,
    a modifier or several tokens). The body is kept apart from the text
    before it like a label value.
  - a single letter that is not defined: a register, stays in the expression.
  - anything else: error ("undefined symbol").
- Syntax error: the statement ends while an operand is expected, i.e. right
  after the opcode or modifier, after a mode of the last operand, or after a
  `,`. An A operand that consists only of a mode and is followed by `,` is
  fine and has the value 0 (`mov #, 1` is `MOV.AB #0, $1`). A `,` where the A
  operand should start is an error.
- Exactly one operand:
  - `DAT x`: the operand becomes the B operand (with its mode), the A operand
    is `#0`.
  - `JMP`, `SPL`, `NOP`: the B operand is `$0`.
  - any other opcode: error ("missing operand").
- No modifier given: the default, see `defaultModifier`:
  - `DAT`, `NOP`: `F`
  - `MOV`, `CMP`, `SEQ`, `SNE`: `AB` if the A mode is `#`; else `B` if the B
    mode is `#`; else `I`
  - `ADD`, `SUB`, `MUL`, `DIV`, `MOD`: `AB` if A is `#`; else `B` if B is `#`;
    else `F`
  - `SLT`, `LDP`, `STP`: `AB` if A is `#`, else `B`
  - all others (`JMP`, `JMZ`, `JMN`, `DJN`, `SPL`): `B`
- Expressions are evaluated with one `Evaluator` per assembly, shared with
  pass 1 (registers carry over in order of evaluation: pass 1 asserts and FOR
  counts first, then the A then B operand of each statement in order).
  Evaluation errors are errors; overflow is a warning. Values are normalized
  modulo `coreSize` into `0 .. coreSize-1`.
- After any error has happened anywhere in the assembly, statements are still
  parsed (to report syntax errors), but no expressions are evaluated any more
  and no instructions are produced.
- `ORG expr`: start = value (normalized).
- `END expr`: if the value is non-zero: if start is already non-zero, warning
  ("END start ignored"), else start = value (normalized). `END` without
  operand or with 0 changes nothing.
- `PIN expr`: pin = value (not normalized).

After pass 2:

- More real instructions (counted in pass 1) than `maxLength`: error.
- No instructions (counted in pass 1): warning ("no instructions"), and pass
  2 does not run at all, so `ORG`, `END` and `PIN` statements are neither
  checked nor evaluated (`end 1/0` is fine); start stays 0 and pin null.
  Errors of pass 1 still reject the warrior. Without errors the result is
  `ok` with no instructions.
- If there is no error, there are instructions, and start is not in
  `0 .. length-1`: warning.

### 2.5 Line numbers

Each statement carries a line number: the line being processed when the
statement was completed. For a statement from a FOR body: the body line. For
an EQU expansion that is completed at the use site: the use site. For the
inner statements of a multi-line EQU body: the body line in the EQU
definition. `instructions[i].line` is that number.

---------------------------------------------------------------------------

## 3. mars.js

### API (used by the UI and tests)

```js
export function rng(seed) -> next seed     // Park-Miller, see below
export class Mars {
  constructor(options = {})   // same option names as DEFAULT_OPTIONS, plus
                              // headless: true to skip the bookkeeping of 3.4,
                              // the trace (3.6) and execHeat; default false
  opt                // effective options
  coreSize
  op, am, bm         // Uint8Array(coreSize): op = opcode << 3 | modifier; modes 0..7
  av, bv             // Int32Array(coreSize), values 0..coreSize-1
  owner              // Int8Array, last warrior that wrote any part of the cell, -1 never
  execBy             // Int8Array, last warrior that executed the cell, -1 never
  origin             // Int32Array, (warrior << 16) | instruction index of the
                     //   warrior instruction this cell is a copy of, -1 none
  tWrite, tRead, tExec   // Int32Array, time of last write/read/execution, initially -0x40000000
  warriors           // array, see below
  events             // array of { type: 'kill' | 'death', addr, warrior, time }
  round              // number of rounds started
  roundOver, roundResult, results
  time               // instructions executed in this round (1 for the first)
  cyclesLeft, warriorsLeft
  current            // index of the warrior that executes next
  load(codes, { seed, positions })   // codes: assemble() results; starts a match
  startRound()
  endRound()
  step()             // execute one instruction
  run(n) -> executed count, stops early when the round ends
  cell(addr) -> { op, mod, aMode, aVal, bMode, bVal }
  // trace ring buffer, see 3.6
  traceSize, tracePc, traceA, traceB, traceMeta
}
```

Warrior object (keep these fields, the UI reads them):

```
index, code (the assemble() result), name, author, position,
queue (Int32Array of length maxProcesses + 1, a ring buffer),
head, tail, tasks (number of processes; the live entries are
queue[(head + k) % queue.length] for k < tasks, between steps),
alive, pspace, lastResult, score, wins, losses, ties,
territory (number of cells with owner == index),
execHeat (Float32Array(code.instructions.length): += 1 each time a cell whose
origin points at that instruction of this warrior is executed, by anyone),
diedAt (time of death or null)
```

### 3.1 Match and rounds

- `load(codes, { seed, positions })`: throws if a code is not `ok`, is longer
  than `maxLength`, or `codes.length * minDistance > coreSize`. Sets up the
  warriors (scores 0), p-space, `round = 0`, `results = []`, `roundOver =
  true`. `seed` undefined: a random seed is drawn (`rng` of a random number in
  1 .. 2^31-2); otherwise `seed` is used directly as the generator state.
  `positions` (optional array) fixes the positions for every round.
- P-space: each warrior has `pSpaceSize` cells, all 0 initially, plus a
  "last result" value that starts at `coreSize - 1`. Warriors whose `pin` is
  the same non-null number share one p-space (cells, not the last result).
- `startRound()`:
  1. `round++`, positions are chosen (3.2).
  2. The whole core becomes `DAT.F $0, $0`, owner/execBy/origin -1,
     timestamps -0x40000000, events cleared, time 0.
  3. `cyclesLeft = warriors * maxCycles`, `warriorsLeft = warriors`.
  4. Each warrior's instructions are copied to `position + i` (mod
     coreSize), owner = warrior index, origin = (index << 16) | i,
     territory = length. One process at `(position + start) % coreSize`.
     execHeat zeroed, alive, diedAt null.
  5. The execution order is the warrior list order, starting with the
     "starter" warrior: warrior 0 in round 1, then warrior 1 in round 2, and
     so on, cyclic.
- Each `step()` executes one instruction of the current warrior, then the
  next living warrior in order becomes current.
- After an instruction that did not kill the warrior: `cyclesLeft--`; when it
  reaches 0 the round ends.
- When a process dies and it was the warrior's last one: the warrior is out.
  `score[warriorsLeft + warriors - 2]++` for it, then
  `cyclesLeft = cyclesLeft - 1 - trunc((cyclesLeft - 1) / warriorsLeft)`,
  then `warriorsLeft--`. If fewer than 2 warriors are left now, the round
  ends right away. Otherwise the warrior is removed from the order, the next
  one becomes current, and `cyclesLeft--` (round ends at 0). Note: with a
  single warrior in the match, its death ends the round.
- A process that dies without being the last one: `cyclesLeft--` as usual.
- Round end: for each warrior with processes: `score[warriorsLeft - 1]++`,
  lastResult = warriorsLeft; others: lastResult = 0. With more than one
  warrior: a single survivor gets a win and the others a loss; otherwise the
  survivors get a tie and the dead a loss. `roundResult = { round, cycles:
  time, survivors: [indices] }`, appended to `results`. The starter advances.
  `roundOver = true`.
- Events: every dying process pushes `{ type: 'kill', addr, warrior, time }`;
  a warrior that is out additionally pushes `{ type: 'death', ... }` after it.
  The UI clears `events` after reading.

### 3.2 Positions

`seed` is the generator state, `rng(s)` is Park-Miller: `t = 16807 * (s %
127773) - 2836 * trunc(s / 127773)`, plus 2147483647 if negative.

- Fixed `positions`: used as given.
- Warrior 0 is always at 0.
- Two warriors: warrior 1 at `minDistance + seed % (coreSize + 1 - 2 *
  minDistance)`, then `seed = rng(seed)`. (So seed `pos - minDistance`
  reproduces `pmars -F pos`.)
- More warriors, method A, for warriors 1..n-1: draw `seed = rng(seed)` and
  set the position of the current warrior to `seed % (coreSize - 2 *
  minDistance + 1) + minDistance`. If it is closer than `minDistance` (plain
  absolute difference of the positions, not circular) to any warrior
  1..current-1, retry: up to 20 retries for the same warrior; when those are
  used up, go back and restart from the warrior it conflicted with (the first
  conflicting one in index order), with a fresh 20 retries; this backtracking
  can happen 4 times, after that method A fails. Method A succeeds when all
  warriors are placed.
- If method A fails, method B (the seed continues from where A stopped):
  `room = coreSize - minDistance * warriors + 1`. For i = 1..n-1: `seed =
  rng(seed)`, `t = seed % room`, insert t into the sorted list of positions
  of warriors 1..i (insertion sort into positions[1..i], shifting larger ones
  up; comparison: walk j from i-1 down to 1, stop when t > position[j],
  otherwise move position[j] to j+1). Then add `minDistance * i` to
  position[i] for i = 1..n-1. Then for i = 1..n-1: `seed = rng(seed)`,
  `j = seed % (n - i) + i`, swap positions i and j.

### 3.3 Instruction execution

Notation: N = coreSize, all address arithmetic modulo N, results in 0..N-1.
The current warrior W takes the process at the head of its queue: PC.

1. Fetch: copy the instruction at PC into a register IR (opcode, modifier,
   modes, A value, B value). Later changes to the core cell do not change IR.
2. A operand:
   - `#`: A pointer = PC. A-values: AA = IR.A, AB = IR.B.
   - otherwise let P = PC + IR.A.
     - `$`: A pointer = P.
     - `@ < >` use the B field of cell P, `* { }` the A field of cell P, call
       it F. For `<` and `{`: F = F - 1 first (stored back into cell P,
       wrapping to N-1). A pointer = P + F. Then AA = core[A pointer].A, AB =
       core[A pointer].B are read. Then for `>` and `}`: cell P's field
       F = F + 1 (stored, wrapping to 0), using the F value from before the
       read (that is, after any decrement, which cannot happen together).
     - For `$`, AA and AB are read from the A pointer cell.
3. B operand, same rules, but:
   - `#`: B pointer = PC, BA = core[PC].A, BB = core[PC].B read from the core
     now (after the A operand's increments and decrements, not from IR).
   - otherwise P = PC + IR.B, and the indirection reads the core after step 2.
     BA, BB read from the B pointer cell.
4. Execute (results stored into the core at the B pointer unless stated):
   - `DAT`: the process dies.
   - `MOV`: `.A` A←AA, `.B` B←AB, `.AB` B←AA, `.BA` A←AB, `.F` A←AA and B←AB,
     `.X` B←AA and A←AB, `.I`: opcode, modifier and both modes are copied
     from the core cell at the A pointer as it is now, A←AA, B←AB.
   - `ADD`, `SUB`, `MUL` (mod N, `SUB` is target minus source): `.A`
     A←op(BA, AA), `.B` B←op(BB, AB), `.AB` B←op(BB, AA), `.BA` A←op(BA, AB),
     `.F`/`.I` both A←op(BA,AA) and B←op(BB,AB), `.X` B←op(BB,AA) and
     A←op(BA,AB).
   - `DIV`, `MOD` (integer division / remainder of the non-negative values):
     same pairs as `ADD`. Each pair is only computed and stored when its
     divisor is non-zero. If any divisor of the used pairs is 0, the process
     dies after the other pair was stored.
   - `JMP`: jump to the A pointer.
   - `JMZ`: `.A`/`.BA`: jump if BA = 0; `.B`/`.AB`: if BB = 0; `.F`/`.X`/`.I`:
     if BA = 0 and BB = 0.
   - `JMN`: `.A`/`.BA`: jump if BA != 0; `.B`/`.AB`: if BB != 0;
     `.F`/`.X`/`.I`: if BA != 0 or BB != 0.
   - `DJN`: `.A`/`.BA`: decrement the A field of the core cell at the B
     pointer (wrap to N-1); jump unless BA was 1 (the value read in step 3).
     `.B`/`.AB`: same with the B field and BB. `.F`/`.X`/`.I`: decrement both
     fields, jump unless BA was 1 and BB was 1.
   - `SEQ`/`CMP` (identical) skip the next instruction when equal, `SNE` when
     not equal. Equal means: `.A` BA=AA, `.B` BB=AB, `.AB` BB=AA, `.BA`
     BA=AB, `.F` BA=AA and BB=AB, `.X` BB=AA and BA=AB, `.I`: opcode+modifier
     and both modes of the core cells at the A and B pointers (read now) are
     equal, and BA=AA and BB=AB.
   - `SLT`: skip when `.A` AA<BA, `.B` AB<BB, `.AB` AA<BB, `.BA` AB<BA,
     `.F`/`.I` AA<BA and AB<BB, `.X` AA<BB and AB<BA.
   - `SPL`: queue PC+1 first. Then, if W has fewer than `maxProcesses`
     processes, W gets one more process and the A pointer is queued too.
   - `NOP`: nothing.
   - `LDP` (p-space index i is taken modulo pSpaceSize; index 0 means the last
     result): `.A` A←p[AA], `.B`/`.F`/`.X`/`.I` B←p[AB], `.AB` B←p[AA],
     `.BA` A←p[AB].
   - `STP`: `.A` p[BA]←AA, `.B`/`.F`/`.X`/`.I` p[BB]←AB, `.AB` p[BB]←AA,
     `.BA` p[BA]←AB. Storing to index 0 sets the last result.
5. Next process: unless the process died or it was a `SPL` (which queued
   itself), the next address is queued at the tail of W's queue: the jump
   target if a jump happened, PC+2 if a skip happened, else PC+1.

### 3.4 Bookkeeping for the visualizer

- `tExec[PC] = time` and `execBy[PC] = W` on fetch (time was incremented
  before, so the first instruction of a round has time 1). If `origin[PC] >=
  0`, the referenced warrior's `execHeat[instruction]` += 1.
- Every store into a cell (pre-decrement and post-increment of a pointer
  field, all results in step 4 including `DJN` decrements) sets `tWrite` to
  the time and makes W the owner (adjust `territory` of the old and new owner
  when the owner changes).
- `MOV.I` copies `origin` from the A pointer cell to the B pointer cell.
  No other instruction changes `origin`.
- `tRead` is set for the A pointer when the A mode is not `#`, and for the B
  pointer for `CMP`, `SEQ`, `SNE`, `SLT`.

### 3.5 Performance

The instruction loop does not allocate: no closures or objects per step,
typed arrays only. `tools/bench.mjs` measures it, `--headless` for the mode
without visualizer bookkeeping. In headless mode the core, the queues, the
events, the scores and all round results are the same as with bookkeeping;
`owner`, `execBy`, `origin`, the timestamps, `territory`, `execHeat` and the
trace are not updated.

### 3.6 Trace ring buffer

For the visualizer, every executed instruction is recorded:

```
traceSize = 4096
tracePc, traceA, traceB, traceMeta: Int32Array(traceSize)
```

The entry for the instruction executed at time t is at index
`t & (traceSize - 1)`: PC, the A pointer, the B pointer, and `traceMeta`:

- bits 0..7: warrior index
- bits 8..15: the IR opcode byte (opcode << 3 | modifier)
- bit 16: something was stored at the B pointer by step 4
- bit 17: the A pointer became a new process location (a jump was taken, or
  `SPL` queued a new process there)
- bit 18: the process died
- bit 19: a skip happened

---------------------------------------------------------------------------

## 4. Deviations from pMARS

The engine always produces a result. Where pMARS does not terminate,
crashes, or has no defined result, it does something reasonable instead.
The random generators of `tools/pmars-diff.mjs` and `tools/expr-fuzz.mjs`
leave these inputs out.

- pMARS loops forever on a line whose content is longer than 255 characters.
  The engine reads it like any other line.
- pMARS loops forever on a `\` at the end of the last line of the file. The
  engine keeps the `\` in the text (usually a bad expression).
- pMARS reduces operand values into the core by repeated steps of the core
  size, so a value around 2^63 never finishes (`dat #9223372036854775807+1`),
  and values above about 10^12 already take seconds to hours. The engine
  takes the value modulo the core size.
- pMARS crashes on -2^63 divided by -1 and on -2^63 modulo -1. The engine
  gives -2^63 and 0.
- A single `!`, `=`, `&` or `|` where an operator is expected (`9!12`,
  `2=10`, `1&2`, also after a dropped `==` as in `a=1+2*3==!4`) makes pMARS read
  an uninitialized variable, so its result depends on how it was compiled.
  The engine treats it as a bad expression.
- The error kind of a failed expression can differ: after a missing operand
  pMARS goes on with a value that is apparently uninitialized, which decides
  whether a later division by it reports division by zero or a bad
  expression. The engine uses 0. Both are errors, so the assembler result is
  the same (about 0.05% of random expressions differ in the kind only).
- pMARS counts logical lines in its messages (a continued line counts once);
  the engine's `line` is the physical line number.
- An opcode name in an operand (`div dat 0`) is an error in both. pMARS drops
  the statement already in pass 1, so it additionally warns that there are
  no instructions; the engine reports the error in pass 2.
- pMARS keeps its scratch buffer between the warriors of one run (see "The
  scratch buffer"); the engine starts each assembly with a fresh one.
