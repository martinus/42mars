# Redcode and MARS semantics

This document describes the observable behavior of the engine: the
expression evaluator and the assembler in `lib/src/asm.c`, the simulator in
`lib/src/mars.c` (the C files built to `wasm/42mars.wasm`). The behavior
matches pMARS 0.9.x, the reference Core War simulator, including some of its
quirks, because existing warriors depend on them.

The engine was written from this description, without access to pMARS source
code, and checked against reference outputs: 4031 expressions, 146 small
sources (`test/fixtures/`), 567 hill warriors and 319 battles with core
hashes. `tools/pmars-diff.mjs` and `tools/expr-fuzz.mjs` compare it with a
pMARS binary, used as a black box, on corpus warriors and random input.
Section 4 lists where the engine deliberately differs.

The expression evaluator and the assembler are C (`lib/src/asm.c`);
`wasm/42mars.js` calls them as `evaluate(text)` and
`assemble(source, options)`. They started as a port of a JavaScript
assembler (`expr.js`, `assembler.js`), removed in November 2026 after the
tools and the visualizer had moved to the C one. The simulator is C too
(`lib/src/mars.c`, section 3); the visualizer ran on a JavaScript copy of it,
`js/mars.js`, until it moved to the library's watch (#75, #76).
`tools/opcodes.js` holds the opcode, modifier and mode tables and the
formatting.

The C library's interface is `lib/42mars.h`, documented in the header; its
functions have the behavior described here.

`cli/42mars.c` is a command line program with pMARS's options and output
(section 5).

---------------------------------------------------------------------------

## 1. The expression evaluator

### API

```js
evaluate(text) -> { status, value }   // value is a BigInt
// status, named as in lib/src/asm.c:
//   EVAL_OK        0
//   EVAL_OVERFLOW  1   result valid, but 64-bit overflow happened
//   EVAL_BAD      -1   syntax error
//   EVAL_DIV_ZERO -2   division or modulo by zero
```

Each `evaluate` call starts with all 26 registers 0. Within one
assembly the registers persist from one expression to the next.

### Syntax and semantics

- Integers are signed 64-bit and wrap around. When a binary `+`, `-` or `*` result leaves the
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

## 2. The assembler

### API

```js
// wasm/42mars.js
export const DEFAULT_OPTIONS = Object.freeze({
  coreSize: 8000, maxProcesses: 8000, maxCycles: 80000, maxLength: 100,
  minDistance: 100, rounds: 1, warriors: 2,
  pSpaceSize: 0,   // 0 means floor(coreSize / 16)
  readLimit: 0,    // 0 means coreSize
  writeLimit: 0,   // 0 means coreSize
});
export function assemble(source, options = {}) -> result
```

`VERSION` is 95 (pMARS 0.9.5).

`options` takes the names of `DEFAULT_OPTIONS` and `icws88: true`, pMARS's
`-8` (ICWS'88 only, end of 2.4). `formatListing()` of `opcodes.js` prints a
result assembled with it in the ICWS'88 form. `registers`, e.g. `{ s: 2, w:
2 }`, gives registers to start with instead of 0 (`m42_assemble()` in C: 26
values a..z): pMARS assembles the first warrior of a run with the registers
its score formula check left (section 5), so `w` and `s` are the number of
warriors there with the default formula, and the other warriors with all 0.
`tools/pmars-diff.mjs`, `tools/tournament.mjs` and `42mars` do the same.

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
- The content of a physical line ends at its first CR, LF or NUL byte. Text
  after a lone CR or a NUL up to the next LF is ignored: `mov 1, 2\rdat 3\n`
  and `mov 1, 2\0dat 3\n` are only `mov 1, 2`. A CRLF line end is just the
  end of the content. This holds for every kind of line below, also inside
  `EQU` bodies, `FOR` blocks and continued lines: `;name A\0B` gives the name
  `A`, `mov\0 0, 1` is `mov` without operands, an error. The ignored text
  still goes into pMARS's scratch buffer (end of 2.4).
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

End of a warrior in a stream. pMARS reads several warriors from one stream
(`pmars - -`, stdin). Each one ends before the line that ends reading above,
its second `;redcode` line, and the next warrior starts at that line, which
is the next one's first `;redcode`. Without such a line a warrior takes the
rest of the stream, its `END` included: the lines after `END` still give
metadata (`;name X` there renames the warrior), and the next `-` gets an
empty warrior. Found by running pMARS 0.9.5 on streams of two and three
warriors, with and without `;redcode` and `END` lines, with CRLF, a 200 KB
first warrior, and files or `-@` between the `-` (#93). `m42_warrior_source_end()`
(`sourceEnd` in JS) gives where a warrior ended.

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
models the buffer for each assembly.

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
- When the opcode comes from an EQU body (the name stands at the statement
  start), the statement counts as done when the expansion that holds the
  opcode ends, before the rest of the line is read: the pending labels get
  the instruction counter as value, a real opcode increments the counter,
  and labels and `CURLINE` in the rest of the line count from there, also
  those of EQU names expanded in the rest. For `ORG`, `END` and `PIN`, the
  counter stays, but labels in the rest are relative (value minus counter)
  instead of absolute. Inside the expansion that holds the opcode, labels
  and `CURLINE` count at the instruction's own address. That expansion is
  the innermost one: with `a equ dat`, `b equ a -x`, the `-x` of `b`'s body
  is already in the rest. With `s equ dat 1` and `x dat 0`, the line `s -x`
  is `DAT.F #0, $3`, and `l s -l` alone is `DAT.F #0, $2` (`l` is defined
  before `-l` is read). Not affected: names that are still undefined, which
  pass 2 reads as usual (absolute for `ORG`, `END`, `PIN`); an opcode from
  the source text with EQU names in its operands; an EQU body of only
  labels (`s equ lbl`, `s dat -x`); for the last body line of a multi-line
  EQU in an operand see the next point. The same in ICWS'88 mode. Found
  with `manipulatedlight2.red` of the Koenigstuhl corpus (#116).
- A multi-line EQU name in an operand of a statement from the source (an
  opcode, `ORG`, `END` or `PIN` read from the source, an assert, a `FOR`
  count) loses that statement in pMARS (#119). The first body line ends its
  text as above, but the text is never used; its pending labels stay
  pending. The further body lines are read next, and the last one, with
  the rest of the use-site line, takes the lost statement over: when the
  EQU's text in it ends, the pending labels get their value and a lost
  instruction counts (as in the point above, so the rest is one further),
  then the line's own statement counts and is stored as usual. So with
  `a equ 5`, ` equ dat 1`, `x dat 0` before, `jmp a -x` gives `DAT.F #0,
  $3`, and the `jmp 5` is gone. The lost instruction still counts for the
  labels after it, for `MAXLENGTH` and for the length of the warrior, but
  pass 2 numbers the stored statements without it, so labels defined later
  point one further. pMARS leaves the last instruction of the warrior
  undefined then (a random A-field, different from run to run); the engine
  puts `MOV.A #0, #0` there, what pMARS shows when that memory is 0, and
  warns (section 4). A lost `ORG`, `END` or `PIN` loses its value (start
  0, no PIN); `END` still ends pass 1, after the last body line. A lost
  assert is invalid (a warning) and the last body line's statement counts
  but is not stored, which again leaves the last instruction undefined. A
  lost `FOR` count is an error. A last body line without an opcode is an
  error (pMARS: "Missing 'opcode'", here `bad opcode '<line>'`). Not lost: a statement whose opcode comes from
  an EQU (`s equ jmp`, `s a`), where the body lines follow as statements of
  their own.
- Body text is processed with the same rules (labels, nested EQU names, FOR
  counters, CURLINE). Using an EQU name inside its own expansion is an error
  ("recursive EQU").
- Using an EQU name at the label position when the name is already defined as
  an EQU name expands it (so `x equ 1` followed by `x equ 2` expands the first
  `x` and then fails on `1 equ 2`).

A `FOR ... ROF` block may be written inside one multi-line EQU body and is
expanded when the EQU is used. A `FOR` or `ROF` that comes from an EQU name
follows its own rules, see "FOR and ROF from an EQU".

Substituted text has a limit, which pMARS reports as "Buffer overflow.
Substitution is too complex", an error. Counted are the characters of the
text after substitution, without whitespace and without the mode character:

- an instruction operand, A and B each, also with EQU names defined after
  their use: at most 5332 characters (`dat 1, v` where `v` gives 5332
  characters assembles, 5333 is the error);
- the operand of `ORG`, `END` and `PIN`: at most 5333;
- the expression of a `FOR` count or an assert: at most 7999.

The engine reports `substitution too long: more than <n> characters without
spaces`. Measured with sources whose substituted text was every length
from 5326 to 5339 characters, in these places; at 4095 characters pMARS and
the engine assemble, at 8191 and more both report the error. The number of
EQU substitutions in one operand has the same limit in the engine, so that
EQU bodies without text are bounded too (pMARS: not measured).

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
- Otherwise the count is taken modulo 65536 and the block runs that many
  times, with the counter set to 1, 2, ..., count. Nested `FOR` blocks inside
  are expanded recursively each time. Label definitions inside the block
  happen on every iteration, so a plain label inside a repeated block is
  redefined in the second iteration (warning, line dropped); concatenation
  (`imp&N`) avoids that.
- The end of a running block is found while it runs, not by scanning
  ahead: it is the first `ROF` that a line of the block reads at its own
  level. A line that is dropped as a redefinition opens no block and ends
  none, so a `FOR` line whose label is defined at that moment (the block's
  own counter, a label defined before, also one defined earlier in the same
  iteration) does not count, and the next `ROF` ends the outer block:
  `i for 2`, `dat i`, `i for 1`, `dat 7`, `rof`, `dat 9` is `dat 1`, `dat 7`,
  `dat 2`, `dat 7`, `dat 9` with a warning per iteration. An iteration repeats
  the lines the first one read, and when such a `ROF` line is dropped in a
  later iteration, that iteration reads on after the block until a `ROF`
  (`for 3`, `dat 1`, `x rof`, `dat 5`, `rof`, `dat x`: from the second
  iteration on, `x rof` is a redefinition, giving `dat 1`, `dat 1`, `dat 5`,
  `dat 1`, `dat 5`, `dat -4`). Labels in front of a `ROF` stay pending: the
  next instruction defines them, in the next iteration if there is one. A
  skipped block (count <= 0) is scanned as above, and there every `FOR`
  counts, defined label or not.
- After the block, the counter name is undefined again. Expansion continues
  after the `ROF` line. Text after `ROF` on that line is ignored.
- A `FOR` whose `ROF` is missing: warning ("FOR without ROF"), the block is
  expanded once as far as it goes, and then pass 1 stops (nothing after is
  processed).
- A `ROF` without `FOR`: error. `FOR`, `ROF` or `EQU` after a label-position
  opcode (e.g. in an operand): error. So is an opcode name (also `ORG`,
  `END`, `PIN`) in an operand, an assert or a `FOR` count (pMARS: "Improper
  placement"); the statement is dropped, so `div dat 0` alone also warns
  that there are no instructions.

#### FOR and ROF from an EQU

When the `FOR` or `ROF` keyword comes from an EQU body (the name stands at
the statement start), pMARS reads less of the source. Call the innermost
expansion that holds the keyword its EQU, and the text of the use-site line
after that expansion the rest (with a multi-line body, the rest goes with
the last body line, as for any EQU).

- The count of a `FOR` is the text after `FOR` inside its EQU only; the rest
  is not part of it (`s equ for 0`, `s 1` counts 0).
- Count above 0: the block reads only the further body lines of its EQU (and
  what EQU names in them expand to), never the source after the use. Without
  a `ROF` there: warning (pMARS: "Unclosed ROF"), the block is expanded once
  and pass 1 stops, as for a missing `ROF`. `s equ for 2` alone as `s`
  assembles no instruction. Where the last body line ends the block with
  `ROF`, the rest stays with it; where it does not, it is taken without the
  rest.
- Count 0: the block is skipped as usual, over the further body lines and on
  into the source. The rest is scanned like a line of its own: for a
  one-line body right after the `FOR` (`s equ for 0`, `s x rof` ends the
  skipped block there), else after the last body line. When the skip ends
  on the last body line, the rest is read as a statement line (with
  `f equ for 0`, ` equ rof`, the line `f dat 7` gives `DAT.F #0, $7`).
- After a `FOR` with count above 0 or a `ROF` from an EQU, the rest is
  checked and else ignored: an opcode, `ORG`, `END`, `PIN`, `EQU`, `FOR` or
  `ROF` there is an error (pMARS: "Improper placement"), also one that a
  one-line EQU name there expands to (`r equ rof`, `x equ dat`, `r x`); the
  `ROF` then does not count. Labels, `CURLINE`, numbers and other
  characters are fine, and so is text inside the EQU after the keyword
  (`r equ rof dat 5`). A multi-line EQU name in the rest is not looked at
  (pMARS adds a warning "Unclosed ROF" there, the instructions are the
  same).

Found with `tools/pmars-diff.mjs` (#118).

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
- No modifier given: the default (`default_modifier()` in `asm.c`):
  - `DAT`, `NOP`: `F`
  - `MOV`, `CMP`, `SEQ`, `SNE`: `AB` if the A mode is `#`; else `B` if the B
    mode is `#`; else `I`
  - `ADD`, `SUB`, `MUL`, `DIV`, `MOD`: `AB` if A is `#`; else `B` if B is `#`;
    else `F`
  - `SLT`, `LDP`, `STP`: `AB` if A is `#`, else `B`
  - all others (`JMP`, `JMZ`, `JMN`, `DJN`, `SPL`): `B`
- Expressions are evaluated with one set of registers per assembly, shared
  with pass 1 (registers carry over in order of evaluation: pass 1 asserts
  and FOR counts first, then the A then B operand of each statement in
  order). Evaluation errors are errors; overflow is a warning. Every
  expression the assembler evaluates (asserts, FOR counts, operands, ORG,
  END, PIN) also gets a warning where pMARS has no defined result or takes
  very long (section 4); those texts start with `pMARS`. Values are normalized
  modulo `coreSize` into `0 .. coreSize-1`.
- After any error has happened anywhere in the assembly, statements are still
  parsed (to report syntax errors), but no expressions are evaluated any more
  and no instructions are produced.
- `ORG expr`: start = value (normalized).
- `END expr`: if the value is non-zero: if start is already non-zero, warning
  ("END start ignored"), else start = value (normalized). `END` without
  operand or with 0 changes nothing.
- `PIN expr`: pin = value (not normalized).
- An empty operand (nothing after the keyword, or only a comment) counts as
  0, as in pMARS: `org` sets the start to 0, also after `org 1`; `pin` is
  `pin 0` and shares p-space with it.

After pass 2:

- More real instructions (counted in pass 1) than `maxLength`: error.
- No instructions (counted in pass 1): warning ("no instructions"), and pass
  2 does not run at all, so `ORG`, `END` and `PIN` statements are neither
  checked nor evaluated (`end 1/0` is fine); start stays 0 and pin null.
  Errors of pass 1 still reject the warrior. Without errors the result is
  `ok` with no instructions.
- If there is no error, there are instructions, and start is not in
  `0 .. length-1`: warning.

ICWS'88 (`icws88`, pmars `-8`). Pass 1 is the same (EQU, FOR, `;assert`,
expressions, predefined constants); in pass 2 each statement is checked
after its EQU names are replaced, and these are errors:

- a modifier (any `.` after the opcode), `ORG` and `PIN` (`END` stays);
- an opcode that ICWS'88 does not have: `MUL DIV MOD SEQ SNE NOP LDP STP`;
- an operand mode not in this table, checked after a single operand was
  completed (`DAT x` gives A `#0`, `JMP x` and `SPL x` give B `$0`; other
  opcodes need two operands anyway). No mode is `$`; `> * { }` are never
  allowed.

| Opcode | A modes | B modes |
|---|---|---|
| `DAT` | `# <` | `# <` |
| `MOV ADD SUB CMP` | `# $ @ <` | `$ @ <` |
| `JMP JMZ JMN DJN SPL` | `$ @ <` | `# $ @ <` |
| `SLT` | `# $ @ <` | `# $ @ <` |

The table is pMARS's: `pmars -8` accepted exactly these of 1710 sources
(19 opcodes, the modes `'' # $ @ < > * { }` for A and B, and one operand),
and says so in its own messages ("Proper format: 'MOV [#$@<] [$@<]'"). The
instructions, modifiers included, are the same as without `icws88`, and so
is the simulation: pmars-trace gave the same instruction counts and core
hashes with and without `-8` for 300 corpus pairs and 1500 pairs of random
ICWS'88 warriors. The listing (`pmars -8`, `formatListing()`) has no
modifiers (`MOV    $     0, $     1`, the opcode padded to 7 characters) and
no `ORG      START` line; instead `       END      START` follows the code
when the start lies in it.

### 2.5 Line numbers

Each statement carries a line number: the line being processed when the
statement was completed. For a statement from a FOR body: the body line. For
an EQU expansion that is completed at the use site: the use site. For the
inner statements of a multi-line EQU body: the body line in the EQU
definition. `instructions[i].line` is that number.

---------------------------------------------------------------------------

## 3. The simulator

`lib/src/mars.c`, in C through `lib/42mars.h` (`m42_load`,
`m42_start_round`, `m42_run`, `m42_match` ...), in JS through
`wasm/42mars.js`:

```js
export function rng(seed) -> next seed     // Park-Miller, see 3.2
export async function compileMars() -> WebAssembly.Module   // cached
export async function createMars(options) -> engine        // Node and browsers
export function createMarsSync(options, module?) -> engine
// options: the names of DEFAULT_OPTIONS (section 2), and watch: true for
// the watch (3.4, 3.6)
engine:
  opt, coreSize
  load(codes, { seed, positions, permute })   // assemble() or packWarrior() results; starts a match
  startRound(), endRound()
  step()             // one instruction
  run(n) -> executed count; stops early when the round ends; a fraction rounds up
  runMatch(codes, { rounds, seed, positions, permute, earlyTie = true, firstRound = 0, pspace })
    -> { warriors: [{ name, wins, losses, ties, score, pspace? }], results, instructions }  (3.7)
  round              // number of rounds started
  roundOver, roundResult, results
  time               // instructions executed in this round (1 for the first)
  cyclesLeft, warriorsLeft
  current            // index of the warrior that executes next
  core() -> { op, am, bm, av, bv }   // also as op, am, bm, av, bv: op = opcode << 3 |
                     // modifier, modes 0..7, values 0..coreSize-1
  cell(addr) -> { op, mod, aMode, aVal, bMode, bVal }
  watch(), events()  // with options.watch: 3.4, 3.6
  warriors[i]: index, code, name, author, position, tasks, alive,
    diedAt (time of death or null), score, wins, losses, ties, lastResult,
    pspace, processes() (the queue, next first), queue() (the same as a view),
    territory and execCount (with options.watch)
```

`core()`'s arrays are a snapshot decoded from the wasm core, valid until the
next call that runs or loads; warrior fields are getters, `score` and
`pspace` copies, `queue()` a view of engine memory until the next call. The
core size is at most 65536, there are at most 255 warriors, and `seed` must
be a non-negative safe integer.

### 3.1 Match and rounds

- `load(codes, { seed, positions, permute })`: throws if a code is not `ok`,
  is longer than `maxLength`, does not fit the rules (an opcode above 18, a
  modifier above 6, a mode above 7, an A or B value or the start outside
  0 .. coreSize-1, e.g. assembled for another core size; the message names
  the warrior, the instruction and the field), or `codes.length * minDistance
  > coreSize`, and (RangeError) `permute` with other than two warriors or
  with `positions`, or a position outside 0 .. coreSize-1. `m42_load()`,
  `m42_match()` and `m42_bench()` return `M42_ERR_WARRIOR` and
  `M42_ERR_ARGUMENT` for the same (#86). Sets up the
  warriors (scores 0), p-space, `round = 0`, `results = []`, `roundOver =
  true`. `seed` undefined: a random seed is drawn (`rng` of a random number in
  1 .. 2^31-2); otherwise `seed` is used directly as the generator state.
  `positions` (optional array) fixes the positions for every round.
- P-space: each warrior has `pSpaceSize` cells, all 0 initially, plus a
  "last result" value that starts at `coreSize - 1`. Warriors whose `pin` is
  the same non-null number share one p-space (cells, not the last result).
  Every value is below `coreSize`: `STP` stores a field, and the results are
  small. A value given from outside (`runMatch({ pspace })`,
  `m42_match()`'s `options->pspace`, `m42_pspace_set()`) must be too, else a
  RangeError or `M42_ERR_ARGUMENT`: `LDP` copies it into a field unchanged.
- Errors: every status other than `M42_OK` from a function of `lib/42mars.h`
  is an `Error` whose message is the method's name and `m42_status_text()`,
  e.g. `run: no warriors loaded` for `startRound()`, `run()`, `step()`,
  `endRound()`, `state()` and its getters, `core()` and `watch()` before the
  first `load()` (#90). Argument errors the JS interface finds itself are
  `RangeError`s and `TypeError`s.
- `startRound()`:
  1. `round++`, positions are chosen (3.2).
  2. The whole core becomes `DAT.F $0, $0`, time 0; a watch is reset
     (3.4).
  3. `cyclesLeft = warriors * maxCycles`, `warriorsLeft = warriors`.
  4. Each warrior's instructions are copied to `position + i` (mod
     coreSize). One process at `(position + start) % coreSize`. alive,
     diedAt null.
  5. The execution order is the warrior list order, starting with the
     "starter" warrior: warrior 0 in round 1, then warrior 1 in round 2, and
     so on, cyclic. With `permute` the draw of 3.2 chooses it instead.
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
- With a watch, every dying process is recorded, and whether it was the
  warrior's last one (3.6).

### 3.2 Positions

`seed` is the generator state, `rng(s)` is Park-Miller: `t = 16807 * (s %
127773) - 2836 * trunc(s / 127773)`, plus 2147483647 if negative.

- Fixed `positions`: used as given, each below `coreSize`. Warriors may
  overlap or be closer than `minDistance`; a later warrior's code overwrites
  an earlier one's, and in the watch (3.4) the later warrior owns the cell
  while each counts its whole length in `territory`.
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
- `permute` (pMARS's `-P`), two warriors only: every combination of a
  position of warrior 1 and a first mover comes once before any comes
  again. There are `K = 2 * (coreSize + 1 - 2 * minDistance)` combinations
  `c = 2 * (position - minDistance) + f`, f = 1 when warrior 1 moves first.
  They are drawn from a list, initially `0, 1, .., K - 1`: per round `i =
  seed % left`, `c = list[i]`, `list[i] = list[left - 1]`, `left--`, then
  `seed = rng(seed)`; when nothing is left, the list starts again from `0 ..
  K - 1`. Position and first mover come from `c`; the starter rule of 3.1 does
  not apply. The seed is the same as without `permute` for `pmars -f`; for
  `pmars -F pos` it is `2 * (pos - minDistance)`, which draws `pos` with
  warrior 0 first in round 1. Found with warriors whose final core shows
  both positions and the first mover, through the per-round core hash of
  the trace build, and checked over 15,700 rounds with core 8000 (one full
  list and a second begun) and for cores 100 and 801.

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

Read and write limits (`readLimit` R and `writeLimit` W, pmars `-R` and
`-W`): each a divisor of N (else a RangeError, exit 2 in `42mars`; 0 in the
library is N). With both equal to N everything above holds. Below N, every
operand has a read address and a write address instead of one pointer. An
offset x (0..2N-2) is folded into the window of a limit L: `fold(x, L) = x
mod L`, plus N - L when that is above `floor(L / 2)`. For an operand with
value V that is not `#`:

- `$`: read offset `r = fold(V, R)`, write offset `w = fold(V, W)`.
- `@` and `*`: the pointer cell is PC + fold(V, R); its B (A) field F is
  added to both: `r = fold(fold(V, R) + F, R)`, `w = fold(fold(V, W) + F, W)`.
- `< > { }`: the pointer cell is PC + fold(V, W), so the decrement or
  increment goes there; F is its field (after a decrement, before an
  increment), and both offsets start from the write offset: `r =
  fold(fold(V, W) + F, R)`, `w = fold(fold(V, W) + F, W)`.

The read address is PC + r, the write address PC + w; `#` has both at PC.
The values (AA, AB, BA, BB, the instruction word for `.I`) are read at the
read addresses, the A operand's read address is the jump and `SPL` target,
and every store of step 4 (`MOV`, the arithmetic, `DJN`'s decrement, `LDP`)
goes to the B operand's write address. The ICWS'94 draft reads the pointer
cell of `@` through the write offset for the write address, and starts the
read address of `< >` from the read offset: pMARS does neither. Found by
running single instructions on pmars-trace and finding the copy that gives
its core hash (`test/limits.test.js`), then 4200 random battles with limits
against it. `tools/pmars-diff.mjs` has three fuzz rule sets with limits.

### 3.4 The watch: bookkeeping for the visualizer

With a watch attached (`m42_watch_attach()` in C, `createMars({ watch:
true })` in JS, `watch()` gives typed array views of it), `m42_run()`
(`run()`) records per cell, in the time of the round mod 2^32 (0 for never)
and with warriors as index + 1 (0 for none):

- `t_exec[PC] = time` and `exec_by[PC] = W` on fetch (time was incremented
  before, so the first instruction of a round has time 1). If `origin[PC] >=
  0`, `exec_count` of the instruction it points at goes up by one (per
  warrior, `code_stride` entries each; the visualizer decays it).
- Every store into a cell (pre-decrement and post-increment of a pointer
  field, all results in step 4 including `DJN` decrements) sets `t_write` to
  the time and makes W the owner (adjust `territory` of the old and new owner
  when the owner changes).
- `MOV.I` copies `origin` from the A pointer cell to the B pointer cell.
  No other instruction changes `origin`; it is warrior << 16 | instruction,
  so `max_length` is at most 65536 with a watch.
- `t_read` is set for the A pointer when the A mode is not `#`, and for the B
  pointer for `CMP`, `SEQ`, `SNE`, `SLT`; `read_by` of that cell becomes W.
- `bump` holds the kind of the last store into a cell: +1 for the increment
  of a `>` or `}` operand, -1 for the decrement of a `<` or `{` operand, 0
  for a store of step 4 (including `DJN` decrements). Within one instruction
  the A operand's change comes first, then the B operand's, then step 4.

`m42_start_round()` resets the watch: every cell untouched (`origin` -1,
`bump` 0), each warrior owns its code with `origin` pointing at it,
`territory` is its code length (warriors placed over each other each count
their whole length), the counts, the trace and the deaths are empty.
Attached during a round, it records from there. `m42_match()` and
`runMatch()` play without it and leave it as it was.

### 3.5 Performance

The loops that do not record (`execute`, `execute2_8000`, `execute2_any`,
`execute_limited`, 3.7) run without a watch; with one, `execute_watched`
runs one instruction per iteration through the generic operand code of the
limits and records around it. Both give the same core, queues, scores and
round results (`test/wasm.test.js` compares them after every chunk of random
battles, `tools/pmars-diff.mjs --watch` the watched one with pMARS).
`bench/bench.mjs` measures both (`--watch`) and `runMatch` (`--wasm-match`),
`bench/bench-native.mjs` the C code natively.

### 3.6 Trace and process deaths

With a watch, every executed instruction is recorded: `M42_TRACE_SIZE` =
4096 entries of pc, A pointer, B pointer and meta (in JS `watch().trace`,
4 numbers per entry), the instruction executed at time t at entry
`t % 4096`. The trace is cleared at round start. `meta`:

- bits 0..7: warrior index
- bits 8..15: the IR opcode byte (opcode << 3 | modifier)
- bit 16: something was stored at the B pointer by step 4
- bit 17: the A pointer became a new process location (a jump was taken, or
  `SPL` queued a new process there)
- bit 18: the process died
- bit 19: a skip happened

Process deaths: the last `M42_DEATH_SIZE` = 1024 of the round, each with
address, warrior, time and whether it was the warrior's last process, and
their count (`deaths`). `events()` returns those since its last call as
`{ type: 'kill', addr, warrior, time }`, followed by a `'death'` with the
same fields for a warrior's last process. A warrior's end also shows in its
state (`alive`, `diedAt`).

### 3.7 Inside the engine

`lib/src/mars.c` implements 3.1 to 3.6. With the assembler it is compiled to
`wasm/42mars.wasm` (committed, no imports; `wasm/build.sh` rebuilds it with
`lib/src/gen-dispatch.mjs` and clang), which exports the functions of
`lib/42mars.h`; `wasm/42mars.js` wraps them (API above).
`tools/pmars-diff.mjs` compares the core, the instruction count and the
scores of every round with pMARS.

A core cell is 8 bytes: A and B value (16 bits each) and a 16-bit word with
the op byte and both modes. Each warrior has a ring buffer of 16-bit
addresses whose length is a power of two. Two warriors with `maxCycles` up
to 80000 get linear queues instead, long enough for a whole round: a round
runs at most `max(2 * maxCycles, 1)` instructions with alternating turns, so
a warrior's tail stays at most `1 + 2 * (maxCycles + 1)`.

`runMatch` plays all rounds inside wasm. `firstRound` k plays rounds k + 1
to k + `rounds` of the match: the position generator steps k times first
(placement does not depend on the core), the first mover is warrior k mod
the number of warriors (with `permute`: the draws of the k rounds are made
first, and the draw gives the first mover), and the round numbers in
`results` start at k + 1.
P-space and the last results start empty, as at the start of a match. Only
LDP reads them, and opcodes are only copied, so when no warrior's code
contains LDP every round gives the same result as in the whole match, and
blocks of rounds can run on several engines (`tools/tournament.mjs` plays
every pairing without LDP as blocks of 8 rounds, or of 1 with `--progress`).
With `pspace` the blocks give the rounds of the whole match also with LDP:
`pspace: true` starts as a match starts (p-space cells 0, last result
coreSize - 1), an array per warrior (pSpaceSize cells, at least 1, cell 0
the last result) continues from a previous call, and the result's warriors
then have `pspace` after the last round (`m42_match_options.pspace` in C).
Warriors with the same PIN share cells 1 and up; the last one's copy wins.

`packWarrior(code)` returns the warrior with its instructions as an
`Int32Array` `packed`, 5 integers per instruction (op byte, A mode, A
value, B mode, B value). `load` and `runMatch` take packed warriors in
place of `assemble()` results and copy `packed` in one piece; the array may
be a view into a `SharedArrayBuffer` that several threads read.

With `earlyTie` (the default) a
round stops as soon as it can only end in a tie: a warrior loses at most one
process per own turn, and while nobody dies the round runs exactly
`max(cyclesLeft, 1)` more instructions, of which each living warrior gets at
most `ceil(max(cyclesLeft, 1) / warriorsLeft)`; when every living warrior
has more processes than that, nobody can die. The round then ends with
`time` and `cyclesLeft` as if those instructions had run. Scores, round
results, last results and later rounds are the same; the final core and
queues of such a round are not. This test is off when any warrior's code
contains STP, because skipped STP instructions could change p-space cells
that later rounds read (no instruction creates an opcode that is not in the
core yet).

A second test: only DAT, and DIV or MOD with a zero divisor, kill a
process, and only STP changes the p-space. A core without any cell with one
of these opcodes stays without (opcodes are only copied), so the round is a
tie. The empty core is DAT, so this happens after imp spirals or papers
wrote over the whole core. The check scans from the cell where it found
such an opcode last time, so the instruction loop has no bookkeeping for it.
Both tests run at most 4096 instructions apart.

For exactly two warriors the instruction loop keeps both queues' counters
in local variables and alternates the two warriors without looking up the
next one (the round ends when one of them dies).

The 32 most executed instruction words (opcode, modifier and both modes;
`HOT` in `lib/src/gen-dispatch.mjs`, generated into `lib/src/dispatch.h`)
each have a copy of the instruction code compiled for that word, without
run-time mode and opcode tests; all other words run the generic code. With
the standard settings (core size 8000, 8000 processes) a second copy of the
two-warrior loop has the core size and the queue mask as constants. The
core and the first two warriors' queues (up to 65536 entries) are at fixed
addresses in the linear memory.

---------------------------------------------------------------------------

## 4. Deviations from pMARS

The engine always produces a result. Where pMARS does not terminate,
crashes, or has no defined result, it does something reasonable instead.
The random generators of `tools/pmars-diff.mjs` and `tools/expr-fuzz.mjs`
leave these inputs out. For the expression cases below (a value of 2^40 or
more, -2^63 divided by -1, a lone `!`, `=`, `&` or `|`), the assembler
warns, with a text that starts with `pMARS`:

- `pMARS takes very long for the value of '<expression>'`
- `pMARS crashes on -2^63 / -1 in '<expression>'`
- `pMARS has no defined result for '<expression>': a lone ! = & or | where
  an operator belongs`

pMARS has no such warnings, so `test/golden.test.js` leaves them out of the
warning counts it compares, and the tools skip sources that get them.

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
- A statement lost to a multi-line EQU in an operand (2.3, EQU) still
  counts, and pMARS leaves the last instruction of the warrior undefined:
  its A-field is random memory, different from run to run. The engine puts
  `MOV.A #0, #0` there and warns `pMARS has no defined result for
  '<statement>'` at the lost statement (for an assert: at the body line it
  read). The generators of `tools/pmars-diff.mjs` put multi-line EQU names only at
  the statement start.
- pMARS keeps its scratch buffer between the warriors of one run (see "The
  scratch buffer"); the engine starts each assembly with a fresh one.

### Limits of the assembler

- Deep nesting. The evaluator allows 6000 nested calls of its two recursive
  functions, then the expression is bad: 2999 nested parentheses or
  register assignments, 5998 unary operators or binary operators in a row.
- Work and memory (#87). Pass 1 counts lines read, FOR repetitions and
  lines scanned for a `ROF`; past 1,000,000 of them, or past 64 MB of
  working memory taken after reading the source, the assembly ends with the
  error `pMARS has no limit here, this assembler has: FOR blocks and EQU
  substitutions give over 1000000 lines or 64 MB`, and pass 2 stops too.
  pMARS has no such limit: two nested `for 1000` take it 0.02 s, two nested
  `for 1000000` (16960 repetitions each) did not end within 30 s and took
  19 GB. Without the limit, 38 bytes of nested FOR blocks took the engine
  18 s and 14.7 GB. `tools/pmars-diff.mjs` skips sources with this error.
  `m42_assemble_new()` and `assemble` grow the working memory up to 128 MB
  plus 64 bytes per source byte, which held every source measured (the most:
  161 MB for a source of 3.6 MB).
- FOR blocks nested deeper than 100 are the error `FOR blocks nested too
  deep`, which also stops pass 1. Each level takes about 600 bytes of the
  64 KB stack of the wasm build (107 levels fit, measured with the limit
  raised, #119).
- An exception inside wasm (V8 out of stack when the caller's JS stack is
  nearly used up) leaves the C stack pointer of that instance behind;
  `assemble` and `evaluate` then drop the instance and rethrow.
- A core size below 1 is rejected (`assemble` throws a RangeError).
- The C code works on bytes. `assemble` passes Latin-1 when every
  character of the source is below 256, else UTF-8. In UTF-8 mode one
  character outside ASCII is one token, and message texts trim the Unicode
  spaces that JavaScript's `trim()` trims.

---------------------------------------------------------------------------

## 5. The command line program

`cli/42mars.c` (built by `make` to `build/42mars`) takes pMARS
0.9.5's options and writes pMARS's stdout and exit codes, so that tools that
run pMARS can run it instead. It uses only `lib/42mars.h`. Everything below
was found by running the pMARS server build (`$O/bin/pmars`, and the trace
build for positions); `tools/pmars-diff.mjs --cli build/42mars` compares the
two on corpus warriors, `test/cli.test.js` holds recorded pMARS outputs.

### Options

- `-r # -s # -c # -p # -l # -d # -S #` take the next argument, digits only
  (`-r5`, `-r -1`, `-r 10abc`: exit 2). Flags without a value combine
  (`-bk`); options and files mix in any order. `-@ file` reads more options
  and files from a file, separated by whitespace. `-` reads the next warrior
  from stdin: stdin is read once, and each `-` goes on where the previous
  warrior ended (2.1, "End of a warrior in a stream"), also with files or
  `-@` in between; after the end of the stream a `-` gets an empty warrior.
  A file named twice is read from its start each time (#93).
- pMARS's ranges, exit 2 outside them: `-s` and `-S` 1 .. 2^30, `-p` 1 ..
  2^31-1, `-c` 1 .. 2^63-1, `-l` 1 .. 1000, `-r` from 0. The default `-d`
  is the `-l` value (100 for both by default); `-d` below `-l` is exit 2.
  The default `-S` is core size / 16.
- At most 36 warriors (37: exit 2). `warriors * distance > core size`:
  exit 2, checked before anything is assembled, as is the score formula.
- `-F pos`: the position of warrior 2 in the first round; the generator
  starts at `pos - distance`, so a position beyond the core wraps (7901
  with core 8000 and distance 100 is position 100). Below the distance:
  exit 2. pMARS takes anything that is not a plain number (`4000+1`,
  `0x10`, ` 4001`) as "no -F" and uses random positions; `42mars` exits 2.
  `-f` and `-F` together: exit 2.
- Neither `-F` nor `-f`: random positions (pMARS's and ours differ).
- `-P`: permuted positions and first movers (3.2); with `-F pos` the
  generator starts at `2 * (pos - distance)`. Other than two warriors: exit
  2 before anything is assembled.
- `-f`, the fixed position series: the generator starts at `rng(sum)`,
  where `sum` adds `field XOR k` over all fields of all warriors in file
  order, five per instruction (op byte `op << 3 | mod`, A mode, B mode, A
  value, B value), `k` counting the fields from 0 over all warriors, values
  in 0 .. core size - 1. pMARS codes the modes `# $ @ < >` as 0 .. 4 and
  `* { }` as 130 .. 132. Checked for sums below 2^31.
- `-= formula`: the score formula, default `(W*W-1)/S`, evaluated with the
  expression rules of section 1 and registers `w` (warriors) and `s`
  (survivors). Before assembling it is evaluated for s = 1 .. warriors with
  one set of registers, all 0 at first: `w` is set to the number of warriors
  once, `s` before each evaluation, and assignments stay (`x=x+5` leaves 5 *
  warriors, `w=w+10` with 2 warriors 22). An error (bad expression,
  division by zero) is "Bad score formula", exit 2. The first warrior is
  assembled with the registers this leaves (a `;assert s == 2` passes there
  with two warriors), the others with all 0: `dat #w, #s` is `#2, #2` in the
  first of two warriors and `#0, #0` in the second. (Found from a fuzzed
  `spl*` at the end of a line, whose operand was the leftover `S` of a
  label in the scratch buffer, 2.3.) For the scores it is evaluated for every warrior in file
  order and s = 1 .. warriors, with the registers kept from one evaluation
  to the next (`x=x+1` counts the evaluations). A warrior's score is the
  sum over s of (rounds it survived with s warriors alive) * formula.
- `-R #`, `-W #`: read and write limits (3.3), 1 .. 2^30 and a divisor of
  the core size, else exit 2 before anything is assembled.
- `-8`: ICWS'88 only (section 2.4); listings and `-A` without modifiers,
  `-A` prints `       END      START` before its `       END` when the
  start lies in the code. The simulation is the same.
- `-e` (the debugger, off in the server build) is ignored.
- `-V` changes nothing on stdout or in the exit code, in pMARS as here
  (run with `-b`, `-A`, a warrior that does not assemble, two warriors).
  pMARS prints its assembler's passes on stderr: "After pass 0" with every
  statement and assert line as `(    2) step equ 4`, then parameter checks,
  "After pass 1" with the statements after expansion as `(    4) ADD #4,3`,
  and a table of every label and its references. `42mars -V` prints pass 0
  and pass 1 per warrior in that format, before the warrior's messages; the
  statements of ORG, END and PIN get no line number (the library has none
  for them), and the parameter checks and the label table are left out
  (#92).
- Not supported by `42mars` (exit 2): values beyond the engine: core size
  above 65536, more than 2^24 processes or p-space cells, more than 2^32-1
  cycles.

### Output

Warriors are assembled in file order. Without `-b`, each warrior's listing
is printed as soon as it assembled: the listing of section 2 (`Program
"name" (length n) by "author"`, an empty line, `ORG START` when the start is
inside the warrior, one line per instruction with `START` in front of the
start instruction), then an empty line. The first warrior that does not
assemble ends the run with exit 3 (messages on stderr, ours in our words);
a file that cannot be read too. With `-A`, instead of the listing, each
warrior as `"       ORG %10d"` (the start, also outside the warrior), its
instructions without labels, `"       PIN %10d"` if it has one, and `END`;
then the run ends. `-b` with `-A` prints nothing. `-r 0` prints the
listings only.

Results (survived[s]: rounds survived with s warriors alive; rest: rounds
not survived):

| Warriors | Default | `-k` |
|---|---|---|
| 1 | `name by author scores S` | `S survived[1] rest` |
| 2 | `name by author scores S` per warrior, then `Results: W1 W2 T` | `survived[1] survived[2]` per warrior |
| 3+ | per warrior `name by author scores S` and `  Results: survived[1] .. survived[n] rest` | `S survived[1] .. survived[n] rest` per warrior |

`-o` sorts the default output by score, highest first, stable; with two
warriors the wins in `Results:` follow that order. `-k` ignores `-o`. A
single warrior that dies counts the round in survived[1] too (its death
counter is its survival counter, in pMARS and here), so `rest` is not its
losses.
