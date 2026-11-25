// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Generators (evolver/generator.c, docs/evolver-gen.md): what each part of
// the language writes, the limits, the text form both ways, a list genome as
// a generator, and random generators, texts and bytes: gen_compile() always
// gives a warrior within the limits. And their changes
// (evolver/gen-change.c): on a generator without structure each kind gives
// the child that genome_change() gives on the list, from the same random
// numbers; on any generator a child keeps the limits; references follow
// the lines; the state form reads back.
// Prints "ok" and exits 0, or names the first failures and exits 1.
//
//   cc -O2 -Ilib -Ievolver -o generator-test test/c/generator-test.c evolver/generator.c evolver/gen-change.c evolver/genome.c lib/42mars.c -lm

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "42mars.h"
#include "gen-change.h"
#include "generator.h"
#include "genome.h"

static int failures = 0;
#define CHECK(c, ...)                                     \
  do {                                                    \
    if (!(c)) {                                           \
      if (failures++ < 10) {                              \
        fprintf(stderr, "%s:%d: ", __FILE__, __LINE__);   \
        fprintf(stderr, __VA_ARGS__);                     \
        fputc('\n', stderr);                              \
      }                                                   \
    }                                                     \
  } while (0)

#define CORE 8000u

static const char *const OPCODES[] = {"MOV", "ADD", "SUB", "MUL", "DIV", "MOD", "JMZ", "JMN", "DJN",
                                      "CMP", "SLT", "SPL", "DAT", "JMP", "SEQ", "SNE", "NOP"};
static const char *const MODIFIERS[] = {"A", "B", "AB", "BA", "F", "X", "I"};

// The warrior of x on one line: "start: OP.M ma, mb; ...", and "..." behind
// it when it was truncated.
static const char *listing(const gen *x, uint32_t max) {
  static char buf[64 * GEN_LINES];
  m42_instruction code[GEN_LINES];
  uint32_t start = 99999;
  int truncated = -1;
  const uint32_t n = gen_compile(x, CORE, max, code, &start, &truncated);
  size_t len = (size_t)snprintf(buf, sizeof buf, "%u:", start);
  for (uint32_t i = 0; i < n; i++) {
    const m42_instruction *c = &code[i];
    len += (size_t)snprintf(buf + len, sizeof buf - len, " %s.%s %c%d, %c%d;", OPCODES[c->opcode], MODIFIERS[c->modifier],
                            "#$@<>*{}"[c->a_mode], c->a > CORE / 2 ? (int)c->a - (int)CORE : (int)c->a,
                            "#$@<>*{}"[c->b_mode], c->b > CORE / 2 ? (int)c->b - (int)CORE : (int)c->b);
  }
  if (truncated) snprintf(buf + len, sizeof buf - len, " ...");
  return buf;
}

// The warrior of a text.
static const char *written(const char *text, uint32_t max) {
  static gen x;
  char err[160];
  if (gen_parse(&x, text, CORE, err, sizeof err)) {
    static char bad[200];
    snprintf(bad, sizeof bad, "error: %s", err);
    return bad;
  }
  return listing(&x, max);
}

#define WRITES(text, expected)                                                         \
  do {                                                                                 \
    const char *got_ = written(text, 100);                                             \
    CHECK(!strcmp(got_, expected), "wrote\n  %s\ninstead of\n  %s", got_, expected);   \
  } while (0)

// ---------------------------------------------------------------- the language

static void test_repeat(void) {
  WRITES("repeat 3\n DAT.F #i, #10*i+1\nend\n", "0: DAT.F #0, #1; DAT.F #1, #11; DAT.F #2, #21;");
  // i is the innermost loop, j the one around it, k without a third loop 0
  WRITES("repeat 2\n repeat 2\n  DAT.F #i, #j+k\n end\nend\n", "0: DAT.F #0, #0; DAT.F #1, #0; DAT.F #0, #1; DAT.F #1, #1;");
  WRITES("DAT.F #i, #j\n", "0: DAT.F #0, #0;");
  // a count below 0 is 0; nothing written gives what an empty cell holds
  WRITES("repeat 0-3\n NOP.B $0, $0\nend\n", "0: DAT.F $0, $0;");
  WRITES("f: def\n NOP.B $0, $0\nend\n", "0: DAT.F $0, $0;");
}

static void test_labels(void) {
  // inside a repetition a label is this repetition's instruction, from
  // outside the first one
  WRITES("a: JMP.B $a, $b\n"
         "repeat 2\n"
         "b: SPL.B $b, $a\n"
         "c: JMP.B $c, $b\n"
         "end\n"
         "e: DAT.F $c, $e\n",
         "0: JMP.B $0, $1; SPL.B $0, $-1; JMP.B $0, $-1; SPL.B $0, $-3; JMP.B $0, $-1; DAT.F $-3, $0;");
  // a block: where it starts, how long it is, and its end
  WRITES("r: repeat 3\n"
         " NOP.B $r, $r.len\n"
         "z: end\n"
         "DAT.F $z, $r.len\n"
         "DAT.F #z, #z-r\n",
         "0: NOP.B $0, $3; NOP.B $-1, $3; NOP.B $-2, $3; DAT.F $0, $3; DAT.F #-1, #3;");
  // a line that wrote nothing: where its instruction would have been
  WRITES("DAT.F #r, #r.len\nr: repeat 0\n NOP.B $0, $0\nend\nDAT.F #r, #0\n", "0: DAT.F #1, #0; DAT.F #0, #0;");
  // nested repeats: the instance of the same outer repetition
  WRITES("repeat 2\n"
         "a: NOP.B $0, $0\n"
         " repeat 2\n"
         "  DAT.F $a, $0\n"
         " end\n"
         "end\n",
         "0: NOP.B $0, $0; DAT.F $-1, $0; DAT.F $-2, $0; NOP.B $0, $0; DAT.F $-1, $0; DAT.F $-2, $0;");
}

static void test_functions(void) {
  // each call's labels are its own; the def's label is where this call
  // starts; an argument that is a label stays a place
  WRITES("f: def\n"
         "t: SPL.B $t, #x\n"
         " JMP.B $f, $y\n"
         "end\n"
         "f(5, t2)\n"
         "t2: f(i+7, 3)\n",
         "0: SPL.B $0, #5; JMP.B $-1, $1; SPL.B $0, #7; JMP.B $-1, $3;");
  // a function does not see the loops of its caller, only its own; an argument is the caller's expression
  WRITES("g: def\n DAT.F #x, #i\nend\nrepeat 2\n g(i*10)\nend\n", "0: DAT.F #0, #0; DAT.F #10, #0;");
  WRITES("g: def\n repeat 2\n  DAT.F #i, #j+x\n end\nend\nrepeat 2\n g(i*10)\nend\n",
         "0: DAT.F #0, #0; DAT.F #1, #0; DAT.F #0, #10; DAT.F #1, #10;");
  WRITES("h: def\n DAT.F #x, #y\nend\ng: def\n h(x+1, y*2)\nend\ng(3, 4)\n", "0: DAT.F #4, #8;");
  // an argument that is not given is 0, also outside a function
  WRITES("h: def\n DAT.F #x, #y\nend\nh()\nh(1)\nDAT.F #x, #y\n", "0: DAT.F #0, #0; DAT.F #1, #0; DAT.F #0, #0;");
  // no recursion; a call of a line that is no def writes nothing
  WRITES("f: def\n"
         " NOP.B $0, $0\n"
         " f()\n"
         "end\n"
         "a: f()\n"
         "a()\n"
         "DAT.F #a.len, #f.len\n",
         "0: NOP.B $0, $0; DAT.F #1, #1;");
  // two functions that call each other stop too
  WRITES("f: def\n NOP.B $0, $0\n g()\nend\ng: def\n SPL.B $0, $0\n f()\nend\nf()\n", "0: NOP.B $0, $0; SPL.B $0, $0;");
  // from a function, a label in a block somewhere else is its first instance
  WRITES("repeat 2\na: NOP.B $0, $0\nend\nf: def\n DAT.F $a, $0\nend\nf()\n", "0: NOP.B $0, $0; NOP.B $0, $0; DAT.F $-2, $0;");
  // from outside, a function's label is its first call
  WRITES("f: def\n NOP.B $0, $0\nend\nDAT.F $f, $f.len\nf()\nf()\n", "0: DAT.F $1, $1; NOP.B $0, $0; NOP.B $0, $0;");
}

static void test_counts(void) {
  // a count is evaluated while writing: a label that is not written yet is
  // 0, one that is written counts, a block that is being written has its
  // length so far
  WRITES("repeat b.len+1\n"
         " NOP.B $0, $0\n"
         "end\n"
         "b: repeat 2\n"
         " DAT.F #0, #0\n"
         "end\n"
         "repeat b.len\n"
         " SPL.B $0, $0\n"
         "end\n",
         "0: NOP.B $0, $0; DAT.F #0, #0; DAT.F #0, #0; SPL.B $0, $0; SPL.B $0, $0;");
  WRITES("a: repeat 3\n NOP.B $0, $0\n repeat a.len\n  DAT.F #0, #0\n end\nend\n",
         "0: NOP.B $0, $0; DAT.F #0, #0; NOP.B $0, $0; DAT.F #0, #0; DAT.F #0, #0; DAT.F #0, #0; NOP.B $0, $0; DAT.F #0, #0; "
         "DAT.F #0, #0; DAT.F #0, #0; DAT.F #0, #0; DAT.F #0, #0; DAT.F #0, #0; DAT.F #0, #0;");
  // a place in a count is taken from the next instruction
  WRITES("a: NOP.B $0, $0\nNOP.B $0, $0\nrepeat 0-a\n DAT.F #0, #0\nend\n", "0: NOP.B $0, $0; NOP.B $0, $0; DAT.F #0, #0; DAT.F #0, #0;");
}

static void test_arithmetic(void) {
  WRITES("c0 = -7\nc15 = 2667\nDAT.F #c0, #c15*3\n", "0: DAT.F #-7, #1;");
  WRITES("DAT.F #7/2, #-7/2\nDAT.F #7%3, #-7%3\nDAT.F #5/0, #5%0\n", "0: DAT.F #3, #-3; DAT.F #1, #-1; DAT.F #0, #0;");
  WRITES("DAT.F #CORESIZE/3+1, #(CORESIZE+1)/3\n", "0: DAT.F #2667, #2667;");
  WRITES("DAT.F #2-3-4, #2-(3-4)\nDAT.F #2*3+4, #2*(3+4)\nDAT.F #-(1+2), #8/4/2\n", "0: DAT.F #-5, #3; DAT.F #10, #14; DAT.F #-3, #1;");
  // a number stands for the value between -core/2 and core/2
  WRITES("DAT.F #7999, #4000\nDAT.F #4001/2, #12001\n", "0: DAT.F #-1, #4000; DAT.F #-1999, #-3999;");
  // beyond 2^31 a value becomes its remainder mod the core size:
  // 3999 * 3999 = 15992001, its square is beyond, and 1 mod 8000; 1 / 7 = 0
  WRITES("f: def\n DAT.F #x*x/7, #x/7\nend\nf(3999*3999)\n", "0: DAT.F #0, #-3429;");
  // 37 * i mod 800 over a decoy
  WRITES("repeat 3\n DAT.F #i+1, #37*(i+30)%800\nend\n", "0: DAT.F #1, #310; DAT.F #2, #347; DAT.F #3, #384;");
}

static void test_start(void) {
  WRITES("DAT.F #0, #0\nrepeat 2\ns: NOP.B $0, $0\nend\norg s\n", "1: DAT.F #0, #0; NOP.B $0, $0; NOP.B $0, $0;");
  WRITES("f: def\n NOP.B $0, $0\ns: SPL.B $0, $0\nend\nf()\nf()\norg s\n", "1: NOP.B $0, $0; SPL.B $0, $0; NOP.B $0, $0; SPL.B $0, $0;");
  // a line that wrote nothing: the next instruction, or the first when none follows
  WRITES("DAT.F #0, #0\ns: repeat 0\nend\nNOP.B $0, $0\norg s\n", "1: DAT.F #0, #0; NOP.B $0, $0;");
  WRITES("DAT.F #0, #0\ns: repeat 0\nend\norg s\n", "0: DAT.F #0, #0;");
  WRITES("s: def\nend\nDAT.F #0, #0\nNOP.B $0, $0\norg s\n", "0: DAT.F #0, #0; NOP.B $0, $0;");
}

static void test_limits(void) {
  static gen x;
  char err[160];
  m42_instruction code[GEN_LINES];
  uint32_t start;
  int truncated;
  // max_length: exactly that many is whole, one more is truncated
  CHECK(!gen_parse(&x, "repeat 100\n DAT.F #i, #0\nend\n", CORE, err, sizeof err), "%s", err);
  CHECK(gen_compile(&x, CORE, 100, code, &start, &truncated) == 100 && !truncated, "100 of 100");
  CHECK(gen_compile(&x, CORE, 99, code, &start, &truncated) == 99 && truncated, "100 of 99");
  CHECK(code[98].a == 98, "the last instruction written");
  CHECK(gen_compile(&x, CORE, 0, code, &start, &truncated) == 1 && truncated, "a length of 0 is 1");
  // what follows a truncation is not written, whatever it is
  CHECK(!gen_parse(&x, "repeat 3\n DAT.F #i, #0\nend\ns: NOP.B $0, $0\norg s\n", CORE, err, sizeof err), "%s", err);
  CHECK(!strcmp(listing(&x, 2), "0: DAT.F #0, #0; DAT.F #1, #0; ..."), "%s", listing(&x, 2));
  // repetitions of nothing take steps only
  CHECK(!strcmp(written("repeat 500\nend\nNOP.B $0, $0\n", 100), "0: NOP.B $0, $0;"), "an empty block");
  CHECK(!strcmp(written("repeat 4000\nend\nNOP.B $0, $0\n", 100), "0: DAT.F $0, $0; ..."), "a long empty block");
  // the steps: empty loops inside each other stop the generator
  CHECK(!strcmp(written("repeat 100\n repeat 100\n end\nend\nNOP.B $0, $0\n", 100), "0: DAT.F $0, $0; ..."), "out of steps");
  // 8 repetitions inside each other are written, a ninth writes nothing
  char text[1024] = "";
  for (int depth = 8; depth <= 9; depth++) {
    text[0] = 0;
    for (int k = 0; k < depth; k++) strcat(text, "repeat 1\n");
    strcat(text, "NOP.B $0, $0\n");
    for (int k = 0; k < depth; k++) strcat(text, "end\n");
    strcat(text, "SPL.B $0, $0\n");
    CHECK(!strcmp(written(text, 100), depth == 8 ? "0: NOP.B $0, $0; SPL.B $0, $0;" : "0: SPL.B $0, $0;"), "%d deep: %s", depth,
          written(text, 100));
  }
  // calls count as well: 8 functions that call the next one
  text[0] = 0;
  for (int k = 0; k < 9; k++) sprintf(text + strlen(text), "f%d: def\n DAT.F #%d, #0\n f%d()\nend\n", k, k, (k + 1) % 9);
  strcat(text, "f0()\n");
  CHECK(!strcmp(written(text, 100), "0: DAT.F #0, #0; DAT.F #1, #0; DAT.F #2, #0; DAT.F #3, #0; DAT.F #4, #0; DAT.F #5, #0; DAT.F #6, "
                                    "#0; DAT.F #7, #0;"),
        "calls 8 deep: %s", written(text, 100));
  // an expression of 7 tokens is the longest
  CHECK(!strcmp(written("DAT.F #1+2+3+4, #0\n", 100), "0: DAT.F #10, #0;"), "7 tokens");
  CHECK(!strncmp(written("DAT.F #1+2+3+4+5, #0\n", 100), "error: line 1: an expression of more than 7 tokens", 50), "9 tokens: %s",
        written("DAT.F #1+2+3+4+5, #0\n", 100));
  // 256 lines are the most
  static char many[16 * 300];
  many[0] = 0;
  for (int k = 0; k < GEN_LINES; k++) strcat(many, "NOP.B $0, $0\n");
  CHECK(!gen_parse(&x, many, CORE, err, sizeof err) && x.n == GEN_LINES, "256 lines: %s", err);
  CHECK(gen_compile(&x, CORE, 1000, code, &start, &truncated) == GEN_LINES && !truncated, "256 instructions");
  strcat(many, "NOP.B $0, $0\n");
  CHECK(gen_parse(&x, many, CORE, err, sizeof err) && strstr(err, "more than 256 lines"), "257 lines: %s", err);
}

// ---------------------------------------------------------------- text

static void test_errors(void) {
  static const struct {
    const char *text, *error;
  } cases[] = {
      {"", "no lines"},
      {"; nothing\n\n", "no lines"},
      {"c0 = 5\n", "no lines"},
      {"DAT.F #0, #nowhere\n", "line 1: an unknown label"},
      {"DAT.F 0, #0\n", "line 1: an operand needs its mode"},
      {"DAT #0, #0\n", "line 1: an instruction needs its modifier"},
      {"DAT.Q #0, #0\n", "line 1: an unknown modifier"},
      {"DAT.F #0\n", "line 1: an instruction needs two operands"},
      {"DAT.F #0, #0 1\n", "line 1: something behind the end of the line"},
      {"DAT.F #(1, #0\n", "line 1: a missing )"},
      {"DAT.F #, #0\n", "line 1: a value is missing"},
      {"DAT.F #1+, #0\n", "line 1: a value is missing"},
      {"DAT.F #c16, #0\n", "line 1: a constant above c15"},
      {"DAT.F #1234567890123, #0\n", "line 1: a number of more than 12 digits"},
      {"LDP.A #0, #0\n", "line 1: not a line of a generator"},
      {"repeat 2\nDAT.F #0, #0\n", "a block is not closed"},
      {"DAT.F #0, #0\nend\n", "line 2: an end without a block"},
      {"repeat 1\nf: def\nend\nend\n", "line 2: a def inside a block"},
      {"a: DAT.F #0, #0\na: DAT.F #0, #0\n", "line 2: the label 'a' again"},
      {"i: DAT.F #0, #0\n", "line 1: 'i' cannot be a label"},
      {"mov: DAT.F #0, #0\n", "line 1: 'mov' cannot be a label"},
      {"c3: DAT.F #0, #0\n", "line 1: 'c3' cannot be a label"},
      {"a: DAT.F #0, #0\norg a\norg a\n", "line 3: a second org"},
      {"DAT.F #0, #0\norg b\n", "line 2: org needs one label that exists"},
      {"c16 = 1\nDAT.F #0, #0\n", "line 1: a constant is c0 to c15 = a number"},
      {"c1 = x\nDAT.F #0, #0\n", "line 1: a constant is c0 to c15 = a number"},
      {"f: def\nend\nf(1, 2, 3)\n", "line 3: a call takes up to 2 arguments and ends with )"},
      {"g(1)\n", "line 1: a call of an unknown label"},
      {"a:\nDAT.F #0, #0\n", "line 1: not a line of a generator"},
      {"repeat\nend\n", "line 1: a value is missing"},
      {"DAT.F #((((((((((((((((((1)))))))))))))))))), #0\n", "line 1: parentheses more than 16 deep"},
  };
  static gen x;
  char err[160];
  for (size_t k = 0; k < sizeof cases / sizeof *cases; k++) {
    err[0] = 0;
    const int r = gen_parse(&x, cases[k].text, CORE, err, sizeof err);
    CHECK(r == -1 && !strncmp(err, cases[k].error, strlen(cases[k].error)), "'%s' gave %d '%s', not '%s'", cases[k].text, r, err,
          cases[k].error);
  }
  // a line longer than the reader's buffer
  static char longline[700];
  memset(longline, ' ', sizeof longline - 1);
  CHECK(gen_parse(&x, longline, CORE, err, sizeof err) && strstr(err, "longer than"), "a long line: %s", err);
  // opcodes and modifiers in any case, comments, tabs, Windows line ends
  CHECK(!strcmp(written("\tmov.i\t$ 1 ,@( 2 + 3 ) ; a comment\r\n  Jmp.b $-1,$0;x\r\n", 100), "0: MOV.I $1, @5; JMP.B $-1, $0;"), "%s",
        written("\tmov.i\t$ 1 ,@( 2 + 3 ) ; a comment\r\n  Jmp.b $-1,$0;x\r\n", 100));
}

// The decoy and boot of docs/evolver-gen.md, as gen_text() prints it.
static void test_text(void) {
  static const char *const source = "c0 = 6000                 ; where the body goes\n"
                                    "        repeat 85\n"
                                    "          DAT.F   #i, #37*i%800\n"
                                    "        end\n"
                                    "body:   repeat 1\n"
                                    "          SPL.I   #-3830, >-20\n"
                                    "loop:     MOV.I   *1, <1\n"
                                    "          MOV.I   <0, <3989\n"
                                    "          DJN.X   $loop, {1781\n"
                                    "        end\n"
                                    "boot:   repeat body.len\n"
                                    "          MOV.I   $body+i, $body+c0+i\n"
                                    "        end\n"
                                    "        JMP.B   $body+c0, $0\n"
                                    "        org     boot\n";
  static const char *const printed = "c0 = -2000\n"
                                     "        repeat  85\n"
                                     "          DAT.F   #i, #37*i%800\n"
                                     "        end\n"
                                     "L3:     repeat  1\n"
                                     "          SPL.I   #-3830, >-20\n"
                                     "L5:       MOV.I   *1, <1\n"
                                     "          MOV.I   <0, <3989\n"
                                     "          DJN.X   $L5, {1781\n"
                                     "        end\n"
                                     "L9:     repeat  L3.len\n"
                                     "          MOV.I   $L3+i, $L3+c0+i\n"
                                     "        end\n"
                                     "        JMP.B   $L3+c0, $0\n"
                                     "        org     L9\n";
  static gen x, y;
  char err[160], text[4096], again[4096];
  CHECK(!gen_parse(&x, source, CORE, err, sizeof err), "%s", err);
  const size_t len = gen_text(&x, CORE, text, sizeof text);
  CHECK(len == strlen(text) && !strcmp(text, printed), "printed\n%s", text);
  CHECK(!gen_parse(&y, text, CORE, err, sizeof err), "%s", err);
  gen_text(&y, CORE, again, sizeof again);
  CHECK(!strcmp(again, text), "the text read back and printed again differs");
  // the warrior: 85 cells of decoy, the body, 4 MOV and the JMP; it starts at the boot
  m42_instruction code[GEN_LINES];
  uint32_t start;
  int truncated;
  CHECK(gen_compile(&x, CORE, 100, code, &start, &truncated) == 94 && start == 89 && !truncated, "94 instructions from 89");
  CHECK(code[84].a == 84 && code[84].b == 37 * 84 % 800, "the last cell of the decoy");
  CHECK(code[88].opcode == 8 && code[88].a == CORE - 2, "the body's loop");
  CHECK(code[91].a == CORE - 4 && code[91].b == 6000 - 4, "the third MOV copies the third instruction 6000 on");
  CHECK(code[93].opcode == 13 && code[93].a == CORE - 2000 - 8, "the jump to the copy");
  // a buffer that is too small: the full length, a terminated start
  char small[20];
  CHECK(gen_text(&x, CORE, small, sizeof small) == len && strlen(small) == sizeof small - 1 && !strncmp(small, printed, 19),
        "a small buffer");
  CHECK(gen_text(&x, CORE, 0, 0) == len, "no buffer");
  // a call, its arguments, a def's label; parentheses only where they are needed
  static const char *const calls = "f0:     def\n"
                                   "          DAT.F   #(x+1)*y, #x-(y-1)\n"
                                   "          DAT.F   #x*y+1, #0-x\n"
                                   "          DAT.F   #x/(y*2), #x-y-1\n"
                                   "        end\n"
                                   "        f0()\n"
                                   "L6:     f0(1)\n"
                                   "        f0(L6.len, CORESIZE/3)\n";
  CHECK(!gen_parse(&x, calls, CORE, err, sizeof err), "%s", err);
  gen_text(&x, CORE, text, sizeof text);
  CHECK(!strcmp(text, calls), "printed\n%s", text);
}

// ---------------------------------------------------------------- the list genome

// A generator without structure is the list genome: the same instructions.
static void test_list(void) {
  rng r = rng_seed(31, 32, 33);
  static genome g;
  static gen x, y;
  m42_instruction code[GENOME_MAX], again[GEN_LINES];
  char err[160];
  static char text[64 * GEN_LINES];
  uint32_t labels = 0;
  for (int round = 0; round < 2000; round++) {
    genome_random(&g, &r, CORE, 1 + rng_below(&r, round % 50 ? 60 : GENOME_MAX));
    genome_code(&g, CORE, code);
    gen_from_code(&x, code, g.len, g.start, CORE);
    CHECK(!gen_check(&x, CORE, err, sizeof err), "a generator from code: %s", err);
    uint32_t start;
    int truncated;
    const uint32_t n = gen_compile(&x, CORE, GENOME_MAX, again, &start, &truncated);
    CHECK(n == g.len && start == g.start && !truncated, "length %u, start %u instead of %u, %u", n, start, g.len, g.start);
    CHECK(!memcmp(code, again, n * sizeof *code), "the instructions differ");
    // the same operands are references as genome_from_code() makes
    genome back;
    genome_from_code(&back, code, g.len, g.start, CORE);
    for (uint32_t i = 0; i < g.len; i++) {
      const gen_line *l = &x.l[i];
      CHECK(l->kind == GL_EMIT && l->x[0].n == 1 && l->x[1].n == 1, "line %u is not one instruction of two values", i);
      CHECK((l->x[0].kind[0] == GT_POS) == back.g[i].aref && l->x[0].v[0] == back.g[i].a, "line %u: the A operand", i);
      CHECK((l->x[1].kind[0] == GT_POS) == back.g[i].bref && l->x[1].v[0] == back.g[i].b, "line %u: the B operand", i);
      labels += back.g[i].aref + back.g[i].bref;
    }
    // and through the text
    gen_text(&x, CORE, text, sizeof text);
    CHECK(!gen_parse(&y, text, CORE, err, sizeof err), "%s", err);
    CHECK(gen_compile(&y, CORE, GENOME_MAX, again, &start, &truncated) == g.len && start == g.start &&
              !memcmp(code, again, g.len * sizeof *code),
          "the text of a list gives another warrior");
  }
  CHECK(labels > 1000, "only %u labels", labels);
}

// ---------------------------------------------------------------- random generators

static void random_expr(gen_expr *e, rng *r, uint32_t lines) {
  memset(e, 0, sizeof *e);
  uint32_t leaves = 1 + rng_below(r, 4), ops = leaves - 1, depth = 0;
  while (leaves || ops) {
    if (ops && depth >= 2 && (!leaves || rng_below(r, 2))) {
      e->kind[e->n++] = (uint8_t)(GT_ADD + rng_below(r, 5));
      ops--, depth--;
      continue;
    }
    const uint32_t kind = rng_below(r, 10);
    uint8_t k = GT_NUM;
    uint32_t v = rng_below(r, 5) ? rng_below(r, 6) : rng_below(r, CORE);
    if (kind == 4) k = GT_CONST, v = rng_below(r, GEN_CONSTS);
    else if (kind == 5) k = GT_INDEX, v = rng_below(r, 3);
    else if (kind == 6) k = GT_ARG, v = rng_below(r, 2);
    else if (kind == 7) k = GT_POS, v = rng_below(r, lines);
    else if (kind == 8) k = GT_LEN, v = rng_below(r, lines);
    else if (kind == 9) k = GT_CORE, v = 0;
    e->kind[e->n] = k;
    e->v[e->n++] = v;
    leaves--, depth++;
  }
}

// A well-formed generator of up to 40 lines with blocks, functions and calls.
static void random_gen(gen *x, rng *r) {
  memset(x, 0, sizeof *x);
  const uint32_t want = 1 + rng_below(r, 40);
  uint8_t kinds[64];
  uint32_t n = 0, open = 0;
  while (n + open < want) {
    const uint32_t d = rng_below(r, 100);
    if (d < 55) kinds[n++] = GL_EMIT;
    else if (d < 70 && open < 5 && n + open + 2 <= want) kinds[n++] = GL_REPEAT, open++;
    else if (d < 80 && !open && n + 2 <= want) kinds[n++] = GL_DEF, open++;
    else if (d < 90 && open) kinds[n++] = GL_END, open--;
    else kinds[n++] = GL_CALL;
  }
  while (open) kinds[n++] = GL_END, open--;
  x->n = n;
  x->start = rng_below(r, n);
  for (uint32_t k = 0; k < GEN_CONSTS; k++) x->c[k] = rng_below(r, 3) ? 0 : rng_below(r, CORE);
  uint32_t defs[64], nd = 0;
  for (uint32_t i = 0; i < n; i++)
    if (kinds[i] == GL_DEF) defs[nd++] = i;
  for (uint32_t i = 0; i < n; i++) {
    gen_line *l = &x->l[i];
    l->kind = kinds[i];
    if (l->kind == GL_EMIT) {
      l->op = (uint8_t)rng_below(r, GEN_OPCODES), l->mod = (uint8_t)rng_below(r, 7);
      l->am = (uint8_t)rng_below(r, 8), l->bm = (uint8_t)rng_below(r, 8);
      random_expr(&l->x[0], r, n);
      random_expr(&l->x[1], r, n);
    } else if (l->kind == GL_REPEAT) {
      random_expr(&l->x[0], r, n);
    } else if (l->kind == GL_CALL) {
      l->callee = nd && rng_below(r, 8) ? defs[rng_below(r, nd)] : rng_below(r, n);
      const uint32_t args = rng_below(r, 3);
      if (args > 0) random_expr(&l->x[0], r, n);
      if (args > 1) random_expr(&l->x[1], r, n);
    }
  }
}

// What gen_compile() promises for any generator.
static void check_compile(const gen *x, uint32_t max, const char *what) {
  m42_instruction code[GEN_LINES + 1];
  code[max < GEN_LINES ? max : GEN_LINES].line = -77; // must stay
  uint32_t start = 99999;
  int truncated = -1;
  const uint32_t n = gen_compile(x, CORE, max, code, &start, &truncated);
  CHECK(n >= 1 && n <= (max ? max : 1) && n <= GEN_LINES, "%s: %u instructions with a length of %u", what, n, max);
  CHECK(start < n && (truncated == 0 || truncated == 1), "%s: start %u of %u, truncated %d", what, start, n, truncated);
  CHECK(max == 0 || code[max < GEN_LINES ? max : GEN_LINES].line == -77, "%s: wrote behind the longest length", what);
  for (uint32_t i = 0; i < n; i++)
    CHECK(code[i].opcode < GEN_OPCODES && code[i].modifier < 7 && code[i].a_mode < 8 && code[i].b_mode < 8 && code[i].a < CORE &&
              code[i].b < CORE && code[i].line == (int32_t)i + 1,
          "%s: instruction %u is out of range", what, i);
  m42_rules rules = m42_rules_94();
  if (n <= rules.max_length) {
    const size_t size = m42_warrior_make_size(n);
    void *mem = malloc(size);
    CHECK(mem && m42_warrior_make(code, n, start, 0, mem, size) != 0, "%s: the library refuses the warrior", what);
    free(mem);
  }
}

static void test_random(void) {
  rng r = rng_seed(41, 42, 43);
  static gen x, y;
  char err[160];
  static char text[96 * GEN_LINES], again[96 * GEN_LINES];
  uint32_t whole = 0, cut = 0, calls = 0, longest = 0;
  for (int round = 0; round < 20000; round++) {
    random_gen(&x, &r);
    CHECK(!gen_check(&x, CORE, err, sizeof err), "a random generator: %s", err);
    const uint32_t max = round % 7 ? 100 : 1 + rng_below(&r, 300);
    check_compile(&x, max, "random");
    m42_instruction code[GEN_LINES], code2[GEN_LINES];
    uint32_t start, start2;
    int truncated, truncated2;
    const uint32_t n = gen_compile(&x, CORE, max, code, &start, &truncated);
    truncated ? cut++ : whole++;
    if (n > longest) longest = n;
    for (uint32_t i = 0; i < x.n; i++) calls += x.l[i].kind == GL_CALL;
    // the same warrior again, and through the text
    CHECK(gen_compile(&x, CORE, max, code2, &start2, &truncated2) == n && start2 == start && truncated2 == truncated &&
              !memcmp(code, code2, n * sizeof *code),
          "the second compile differs");
    const size_t len = gen_text(&x, CORE, text, sizeof text);
    CHECK(len < sizeof text, "a text of %zu bytes", len);
    if (gen_parse(&y, text, CORE, err, sizeof err)) {
      CHECK(0, "the text of a random generator: %s\n%s", err, text);
      continue;
    }
    gen_text(&y, CORE, again, sizeof again);
    CHECK(!strcmp(text, again), "read back and printed again:\n%s\ninstead of\n%s", again, text);
    CHECK(gen_compile(&y, CORE, max, code2, &start2, &truncated2) == n && start2 == start && truncated2 == truncated &&
              !memcmp(code, code2, n * sizeof *code),
          "the text gives another warrior:\n%s", text);
  }
  CHECK(whole > 5000 && cut > 200 && calls > 5000 && longest >= 100, "%u whole, %u truncated, %u calls, longest %u", whole, cut, calls,
        longest);
}

// Any bytes: gen_compile() and gen_text() stay within their limits (the
// sanitizers of CI watch the rest), and what gen_check() accepts reads back.
static void test_bytes(void) {
  rng r = rng_seed(51, 52, 53);
  static gen x, y;
  static char text[512 * GEN_LINES];
  char err[160];
  uint32_t accepted = 0;
  for (int round = 0; round < 3000; round++) {
    random_gen(&x, &r);
    uint8_t *bytes = (uint8_t *)&x;
    if (round % 3 == 0) {
      for (size_t k = 0; k < sizeof x; k++) bytes[k] = (uint8_t)rng_below(&r, round % 2 ? 256 : 6);
      x.n = rng_below(&r, 300);
    } else { // a few bytes of a generator changed
      const size_t size = 8 + sizeof x.c + x.n * sizeof x.l[0]; // n, start, the constants and the lines
      for (uint32_t k = 1 + rng_below(&r, 2); k; k--) bytes[rng_below(&r, size)] = (uint8_t)rng_below(&r, rng_below(&r, 4) ? 6 : 256);
    }
    check_compile(&x, round % 5 ? 100 : rng_below(&r, 300), "bytes");
    const size_t len = gen_text(&x, CORE, text, sizeof text);
    CHECK(len < sizeof text && strlen(text) == len, "a text of %zu bytes", len);
    if (gen_check(&x, CORE, err, sizeof err)) continue;
    accepted++;
    CHECK(!gen_parse(&y, text, CORE, err, sizeof err), "a generator that passes the check does not read back: %s\n%s", err, text);
  }
  CHECK(accepted > 150, "only %u changed generators passed the check", accepted);
  // texts with characters changed: no crash, and what is accepted is well formed
  uint32_t read = 0;
  for (int round = 0; round < 5000; round++) {
    random_gen(&x, &r);
    const size_t len = gen_text(&x, CORE, text, sizeof text);
    static const char chars[] = " \n,:;()+-*/%.#$@<>{}0123456789cfLijkxyendrpatMOVDJNSPLCORESIZE";
    for (uint32_t k = 1 + rng_below(&r, 2); k; k--) text[rng_below(&r, len)] = chars[rng_below(&r, sizeof chars - 1)];
    if (gen_parse(&y, text, CORE, err, sizeof err)) continue;
    read++;
    CHECK(!gen_check(&y, CORE, err, sizeof err), "a text that was read is not well formed: %s", err);
    check_compile(&y, 100, "text");
  }
  CHECK(read > 100, "only %u changed texts were read", read);
}

// gen_check() refuses what is not well formed.
static void test_check(void) {
  static gen x, y;
  char err[160];
  CHECK(!gen_parse(&x, "c1 = 5\nf: def\n DAT.F #x, #f\nend\nrepeat 2\n f(i, c1)\nend\n", CORE, err, sizeof err), "%s", err);
  CHECK(!gen_check(&x, CORE, err, sizeof err), "%s", err);
#define REFUSED(change, what)                                                        \
  do {                                                                               \
    y = x;                                                                           \
    change;                                                                          \
    err[0] = 0;                                                                      \
    CHECK(gen_check(&y, CORE, err, sizeof err) == -1 && strstr(err, what), "'%s' gave '%s'", #change, err); \
  } while (0)
  // lines: 0 def, 1 DAT.F #x, #f, 2 end, 3 repeat 2, 4 f(i, c1), 5 end
  REFUSED(y.n = 0, "0 lines");
  REFUSED(y.n = GEN_LINES + 1, "257 lines");
  REFUSED(y.start = y.n, "the start");
  REFUSED(y.c[15] = CORE, "c15");
  REFUSED(y.l[1].kind = 9, "line 1: an unknown kind");
  REFUSED(y.l[1].op = GEN_OPCODES, "line 1: its instruction");
  REFUSED(y.l[1].mod = 7, "line 1: its instruction");
  REFUSED(y.l[1].am = 8, "line 1: its instruction");
  REFUSED(y.l[1].bm = 8, "line 1: its instruction");
  REFUSED(y.l[2].op = 1, "line 2: its instruction"); // an end has none
  REFUSED(y.l[4].callee = y.n, "line 4: its function");
  REFUSED(y.l[1].callee = 1, "line 1: its function"); // an instruction calls nothing
  REFUSED(y.l[1].x[0].n = 0, "line 1: an expression");
  REFUSED(y.l[1].x[1].n = 8, "line 1: an expression");
  REFUSED(y.l[1].x[1].v[0] = y.n, "line 1: an expression"); // a label behind the last line
  REFUSED(y.l[1].x[0].v[0] = 2, "line 1: an expression");   // a third argument
  REFUSED(y.l[1].x[0].kind[0] = GT_ADD, "line 1: an expression");
  REFUSED(y.l[1].x[0].kind[0] = GT_MOD + 1, "line 1: an expression");
  REFUSED(y.l[1].x[0].n = 2, "line 1: an expression");    // two values, no operation
  REFUSED(y.l[1].x[0].v[6] = 1, "line 1: an expression"); // something behind its tokens
  REFUSED(y.l[2].x[0].n = 1, "line 2: an expression");    // an end has none
  REFUSED(y.l[0].x[1].n = 1, "line 0: an expression");    // nor a def
  REFUSED(y.l[3].x[1] = y.l[1].x[0], "line 3: an expression"); // a repeat has one
  REFUSED(y.l[3].x[0].n = 0, "line 3: an expression");
  REFUSED(memset(&y.l[4].x[0], 0, sizeof y.l[4].x[0]), "line 4: an expression"); // a second argument without a first
  REFUSED(y.l[4].x[1].v[0] = GEN_CONSTS, "line 4: an expression");
  REFUSED(y.l[4].x[0].v[0] = 3, "line 4: an expression"); // a fourth loop
  REFUSED(y.l[5].kind = GL_EMIT; y.l[5].x[0] = y.l[5].x[1] = y.l[1].x[0], "is not closed");
  REFUSED(y.l[0].kind = GL_EMIT; y.l[0].x[0] = y.l[0].x[1] = y.l[1].x[0], "line 2: an end without a block");
  REFUSED(y.l[4].kind = GL_DEF; y.l[4].callee = 0; memset(y.l[4].x, 0, sizeof y.l[4].x), "line 4: a def inside a block");
  CHECK(gen_check(&x, 0, err, sizeof err) == -1 && gen_check(&x, 0, 0, 0) == -1, "no core");
  CHECK(gen_check(&x, 6, err, sizeof err) == 0 && gen_check(&x, 5, err, sizeof err) == -1, "a small core: %s", err);
#undef REFUSED
}

// ---------------------------------------------------------------- changes

static int same_gen(const gen *a, const gen *b) {
  if (a->n != b->n || a->start != b->start || memcmp(a->c, b->c, sizeof a->c)) return 0;
  for (uint32_t i = 0; i < a->n; i++) {
    const gen_line *l = &a->l[i], *m = &b->l[i];
    if (l->kind != m->kind || l->op != m->op || l->mod != m->mod || l->am != m->am || l->bm != m->bm || l->callee != m->callee) return 0;
    for (int k = 0; k < 2; k++) {
      if (l->x[k].n != m->x[k].n) return 0;
      for (uint32_t t = 0; t < l->x[k].n; t++)
        if (l->x[k].kind[t] != m->x[k].kind[t] || l->x[k].v[t] != m->x[k].v[t]) return 0;
    }
  }
  return 1;
}

static const char *text_of(const gen *x) {
  static char buf[4][96 * GEN_LINES]; // up to 4 texts in one message
  static int which;
  which = (which + 1) % 4;
  gen_text(x, CORE, buf[which], sizeof buf[which]);
  return buf[which];
}

// Do a and b write the same warrior?
static int same_warrior(const gen *a, const gen *b, uint32_t max) {
  m42_instruction ca[GEN_LINES], cb[GEN_LINES];
  uint32_t sa, sb;
  int ta, tb;
  const uint32_t na = gen_compile(a, CORE, max, ca, &sa, &ta), nb = gen_compile(b, CORE, max, cb, &sb, &tb);
  return na == nb && sa == sb && ta == tb && !memcmp(ca, cb, na * sizeof *ca);
}

// A random generator with what the rewrites look for: instructions that
// repeat with a step or as they are, and far numbers that are equal, each
// other's negative or double, or near each other.
static void regular_gen(gen *x, rng *r) {
  do random_gen(x, r);
  while (x->n > 30);
  for (uint32_t pass = 1 + rng_below(r, 3); pass; pass--) {
    const uint32_t i = rng_below(r, x->n);
    if (x->l[i].kind != GL_EMIT) continue;
    memmove(&x->l[i + 1], &x->l[i], (x->n - i) * sizeof x->l[0]); // a copy in front; references behind it move
    x->n++;
    if (x->start > i) x->start++;
    for (uint32_t j = 0; j < x->n; j++) {
      if (x->l[j].kind == GL_CALL && x->l[j].callee > i) x->l[j].callee++;
      for (int k = 0; k < 2; k++)
        for (uint32_t t = 0; t < x->l[j].x[k].n; t++)
          if ((x->l[j].x[k].kind[t] == GT_POS || x->l[j].x[k].kind[t] == GT_LEN) && x->l[j].x[k].v[t] > i) x->l[j].x[k].v[t]++;
    }
    for (int k = 0; k < 2; k++) { // some operands a number, with a step in the copy
      if (rng_below(r, 2)) continue;
      gen_expr *e = &x->l[i].x[k], *f = &x->l[i + 1].x[k];
      memset(e, 0, sizeof *e);
      e->n = 1, e->v[0] = rng_below(r, CORE);
      *f = *e;
      f->v[0] = (e->v[0] + rng_below(r, 20)) % CORE;
    }
  }
  // an instruction in a block of its own, 1 to 4 times
  const uint32_t i = rng_below(r, x->n);
  if (x->l[i].kind == GL_EMIT && rng_below(r, 2) && gen_wrap(x, i, i + 1, CORE)) x->l[i].x[0].v[0] = 1 + rng_below(r, 4);
  uint32_t *far[2 * GEN_TOKENS * GEN_LINES], fn = 0;
  for (uint32_t i = 0; i < x->n; i++)
    for (int k = 0; k < 2; k++)
      for (uint32_t t = 0; t < x->l[i].x[k].n; t++)
        if (x->l[i].x[k].kind[t] == GT_NUM && x->l[i].x[k].v[t] > 16 && x->l[i].x[k].v[t] < CORE - 16) far[fn++] = &x->l[i].x[k].v[t];
  for (uint32_t pass = fn > 1 ? 3 : 0; pass; pass--) {
    const uint32_t v = *far[rng_below(r, fn)], how = rng_below(r, 4);
    *far[rng_below(r, fn)] = how == 0 ? v : how == 1 ? (CORE - v) % CORE : how == 2 ? v * 2 % CORE : (v + 1 + rng_below(r, 16)) % CORE;
  }
}

// A generator without structure is the list genome under every change: the
// same child, the same answer, the same random numbers used.
static void test_mirror(void) {
  rng seeds = rng_seed(61, 62, 63);
  static genome g, p2, before;
  static gen x, x2, want;
  uint32_t applied[CH_COUNT] = {0}, refused[CH_COUNT] = {0};
  for (int round = 0; round < 60000; round++) {
    const int kind = round % CH_COUNT;
    const uint32_t lengths[] = {1, 2, 3, 5, 8, 20, 60, 100, 255, 256};
    const uint32_t len = round % 11 ? 1 + rng_below(&seeds, 24) : lengths[rng_below(&seeds, 10)];
    const int room = (round + round / CH_COUNT) % 5; // not round % 5: with a multiple of 5 kinds each kind would have one
    uint32_t max = room == 0 ? len : room == 1 ? len + 1 + rng_below(&seeds, 5) : room == 2 ? 20 : room == 3 ? 100 : 300;
    if (max < len) max = len;
    genome_random(&g, &seeds, CORE, len);
    genome_random(&p2, &seeds, CORE, 1 + rng_below(&seeds, round % 7 ? 24 : 256));
    const int second = round % 13 != 0; // sometimes no second parent
    gen_from_genome(&x, &g);
    gen_from_genome(&x2, &p2);
    before = g;
    rng r1 = rng_seed(71, (uint64_t)round, 0), r2 = r1;
    const int a = genome_change(&g, second ? &p2 : 0, &r1, CORE, max, kind);
    const int b = gen_change(&x, second ? &x2 : 0, &r2, CORE, max, kind);
    gen_from_genome(&want, &g);
    a ? applied[kind]++ : refused[kind]++;
    if (a != b || r1.s != r2.s || !same_gen(&want, &x)) {
      gen_from_genome(&x2, &before);
      CHECK(0, "%s, round %d, length %u of %u: the list said %d, the generator %d, %s random numbers\nfrom\n%s\nthe list gives\n%s\nthe generator\n%s",
            genome_change_name(kind), round, len, max, a, b, r1.s == r2.s ? "the same" : "other", text_of(&x2), text_of(&want), text_of(&x));
      if (failures > 3) return;
    }
    char err[160];
    CHECK(!gen_check(&x, CORE, err, sizeof err), "%s gave a generator that is not well formed: %s", genome_change_name(kind), err);
  }
  for (int k = 0; k < CH_COUNT; k++) CHECK(applied[k] > 1000, "%s applied %u times", genome_change_name(k), applied[k]);
  CHECK(refused[CH_INSERT] > 100 && refused[CH_DELETE] > 50 && refused[CH_XINSERT] > 100 && refused[CH_TUNE] > 50, "too few refusals");
  // breeding, with the default mix and with the small steps: the same child and the same names
  genome_mix small = genome_mix_default();
  small.w[CH_RELATED_OPCODE] = small.w[CH_RELATED_MODE] = small.w[CH_SHARED] = small.w[CH_TUNE] = 60;
  static genome child, generated, gchild;
  uint32_t several = 0;
  for (int round = 0; round < 20000; round++) {
    genome_random(&g, &seeds, CORE, 1 + rng_below(&seeds, 20));
    genome_random(&p2, &seeds, CORE, 1 + rng_below(&seeds, 20));
    const uint32_t max = round % 2 ? 20 : 100;
    rng r1 = rng_seed(81, (uint64_t)round, 0), r2 = r1, r3 = r1;
    char ops1[96], ops2[96], ops3[96];
    genome_breed(&child, &g, &p2, &r1, CORE, max, round % 3 ? 0 : &small, ops1, sizeof ops1);
    gen_from_genome(&x, &g);
    gen_from_genome(&x2, &p2);
    gen_breed(&x, &x, &x2, &r2, CORE, max, round % 3 ? 0 : &small, ops2, sizeof ops2);
    gen_from_genome(&want, &child);
    CHECK(r1.s == r2.s && !strcmp(ops1, ops2) && same_gen(&want, &x), "breeding, round %d: '%s' and '%s'", round, ops1, ops2);
    several += strchr(ops1, ' ') != 0;
    // and through genome_breed(): the list of a generated genome is the child's warrior
    generated = g;
    genome_as_generator(&generated);
    static genome second;
    second = p2;
    genome_as_generator(&second);
    genome_breed(&gchild, &generated, &second, &r3, CORE, max, round % 3 ? 0 : &small, ops3, sizeof ops3);
    CHECK(gchild.generated == 1 && r3.s == r1.s && !strcmp(ops1, ops3) && genome_hash(&gchild, CORE) == genome_hash(&child, CORE) &&
              gchild.len == child.len && gchild.start == child.start && same_gen(&gchild.p, &x),
          "genome_breed() of a generator, round %d: '%s' and '%s'", round, ops1, ops3);
    CHECK(generated.generated == 1 && genome_hash(&generated, CORE) == genome_hash(&g, CORE), "a genome as a generator is another warrior");
  }
  CHECK(several > 3000, "only %u children with several changes", several);
}

// A parent for the changes: a random generator that keeps the limits.
static uint32_t emits_of(const gen *x) {
  uint32_t n = 0;
  for (uint32_t i = 0; i < x->n; i++) n += x->l[i].kind == GL_EMIT;
  return n;
}

static int keeps_limits(const gen *x, uint32_t max) {
  m42_instruction code[GEN_LINES];
  static gen_info info;
  gen_compile_info(x, CORE, max, code, &info);
  return !info.truncated && info.written >= 1 && emits_of(x) <= max;
}

// Any generator under every change: a child is well formed and keeps the
// limits, and a change that does not apply leaves the generator as it was.
static void test_structured(void) {
  rng r = rng_seed(91, 92, 93);
  static gen x, p2, before;
  char err[160];
  uint32_t applied[CH_ALL] = {0}, refused[CH_ALL] = {0}, same[CH_ALL] = {0}, blocks = 0;
  for (int round = 0; round < 90000; round++) {
    const uint32_t max = round % 7 < 5 ? 100 : 20;
    do round / CH_ALL % 2 ? random_gen(&x, &r) : regular_gen(&x, &r);
    while (!keeps_limits(&x, max));
    do random_gen(&p2, &r);
    while (!keeps_limits(&p2, max));
    const int kind = round % CH_ALL;
    before = x;
    const int ok = gen_change(&x, &p2, &r, CORE, max, kind);
    ok ? applied[kind]++ : refused[kind]++;
    if (!ok) {
      CHECK(same_gen(&x, &before), "%s did not apply and changed the generator", genome_change_name(kind));
      continue;
    }
    if (gen_check(&x, CORE, err, sizeof err) || !keeps_limits(&x, max)) {
      CHECK(0, "%s, round %d: %s\nfrom\n%s\nand\n%s\ncame\n%s", genome_change_name(kind), round,
            gen_check(&x, CORE, err, sizeof err) ? err : "the child does not keep the limits", text_of(&before), text_of(&p2), text_of(&x));
      if (failures > 3) return;
    }
    for (uint32_t i = 0; i < x.n; i++) blocks += x.l[i].kind == GL_REPEAT;
  }
  for (int k = 0; k < CH_ALL; k++)
    CHECK(applied[k] > (k == CH_UNROLL || k == CH_INDEX || k == CH_FOLD || k == CH_PARAMETER || k == CH_INLINE ? 100 : 500), "%s applied %u times, refused %u times", genome_change_name(k), applied[k], refused[k]);
  // A change of the structure changes the warrior (a rewrite alone would be
  // skipped as seen). Measured where 42evolve is: on generators that grew
  // from lists by changes that each gave another warrior.
  memset(applied, 0, sizeof applied);
  const genome_mix mix = gen_mix_default();
  uint32_t total = 0;
  for (int k = 0; k < CH_ALL; k++) total += mix.w[k];
  for (int round = 0; round < 200000; round++) {
    if (round % 400 == 0) {
      static genome g;
      genome_random(&g, &r, CORE, 2 + rng_below(&r, 10));
      gen_from_genome(&x, &g);
      genome_random(&g, &r, CORE, 2 + rng_below(&r, 10));
      gen_from_genome(&p2, &g);
    }
    uint32_t d = rng_below(&r, total);
    int kind = 0;
    while (d >= mix.w[kind]) d -= mix.w[kind++];
    before = x;
    if (!gen_change(&x, &p2, &r, CORE, 100, kind)) continue;
    applied[kind]++;
    if (same_warrior(&x, &before, 100)) same[kind]++, x = before; // as if never made
    else if (round % 7 == 0) p2 = before;
  }
  for (int k = CH_COUNT; k < CH_ALL; k++)
    CHECK(applied[k] > 300 && same[k] * 4 < applied[k], "%s left the warrior as it was %u of %u times", genome_change_name(k), same[k], applied[k]);
  if (getenv("GEN_RATES"))
    for (int k = 0; k < CH_ALL; k++) fprintf(stderr, "%-18s applied %6u, the same warrior %5.1f%%\n", genome_change_name(k), applied[k], 100.0 * same[k] / (applied[k] ? applied[k] : 1));
  CHECK(blocks > 10000, "only %u blocks in the children", blocks);
  // a long line of children stays within the limits
  do random_gen(&x, &r);
  while (!keeps_limits(&x, 100));
  genome_mix all = gen_mix_default();
  all.w[CH_RELATED_OPCODE] = all.w[CH_RELATED_MODE] = all.w[CH_SHARED] = all.w[CH_TUNE] = 60;
  uint32_t structured = 0, constants = 0, functions = 0;
  for (int round = 0; round < 30000; round++) {
    char ops[96];
    if (round % 50 == 0) do random_gen(&p2, &r);
      while (!keeps_limits(&p2, 100));
    if (round % 3000 == 0) { // from a list again
      static genome g;
      genome_random(&g, &r, CORE, 1 + rng_below(&r, 12));
      gen_from_genome(&x, &g);
    }
    gen_breed(&x, &x, &p2, &r, CORE, 100, &all, ops, sizeof ops);
    if (gen_check(&x, CORE, err, sizeof err) || !keeps_limits(&x, 100)) {
      CHECK(0, "after %d generations (%s): %s\n%s", round, ops, err, text_of(&x));
      return;
    }
    uint8_t used[GEN_CONSTS] = {0};
    int repeat = 0;
    for (uint32_t i = 0; i < x.n; i++) {
      repeat |= x.l[i].kind == GL_REPEAT;
      for (int k = 0; k < 2; k++)
        for (uint32_t t = 0; t < x.l[i].x[k].n; t++)
          if (x.l[i].x[k].kind[t] == GT_CONST) used[x.l[i].x[k].v[t]] = 1;
    }
    structured += repeat;
    // every function is called or referred to
    uint32_t match[GEN_LINES];
    gen_blocks(&x, match);
    for (uint32_t d = 0; d < x.n; d++) {
      if (x.l[d].kind != GL_DEF) continue;
      int needed = x.start >= d && x.start <= match[d];
      for (uint32_t i = 0; i < x.n; i++) {
        if (i >= d && i <= match[d]) continue;
        needed |= x.l[i].kind == GL_CALL && x.l[i].callee >= d && x.l[i].callee <= match[d];
        for (int k = 0; k < 2; k++)
          for (uint32_t t = 0; t < x.l[i].x[k].n; t++)
            needed |= (x.l[i].x[k].kind[t] == GT_POS || x.l[i].x[k].kind[t] == GT_LEN) && x.l[i].x[k].v[t] >= d && x.l[i].x[k].v[t] <= match[d];
      }
      functions++;
      CHECK(needed, "a function that nothing calls or refers to stayed after %s:\n%s", ops, text_of(&x));
    }
    for (uint32_t k = 0; k < GEN_CONSTS; k++) {
      constants += used[k];
      CHECK(used[k] || !x.c[k], "c%u is set and not used after %s", k, ops);
    }
  }
  CHECK(structured > 3000 && constants > 3000 && functions > 3000, "%u children with a repeat, %u constants in use, %u functions", structured, constants, functions);
}

static void parse(gen *x, const char *text);

// The rewrites alone leave the warrior as it is.
static void test_rewrites(void) {
  rng r = rng_seed(111, 112, 113);
  static gen x, y;
  char err[160];
  uint32_t wrapped = 0, folded = 0, unrolled = 0, bound = 0, linked = 0, extracted = 0, inlined = 0, parameters = 0, dropped = 0;
#define KEPT(what)                                                                                                    \
  do {                                                                                                                \
    if (gen_check(&y, CORE, err, sizeof err)) CHECK(0, "%s: %s\nfrom\n%s\ncame\n%s", what, err, text_of(&x), text_of(&y)); \
    else if (keeps_limits(&y, GEN_LINES) && !same_warrior(&x, &y, GEN_LINES))                                         \
      CHECK(0, "%s gave another warrior\nfrom\n%s\ncame\n%s", what, text_of(&x), text_of(&y));                       \
    if (failures > 3) return;                                                                                         \
  } while (0)
  for (int round = 0; round < 6000; round++) {
    do round % 2 ? random_gen(&x, &r) : regular_gen(&x, &r);
    while (!keeps_limits(&x, GEN_LINES));
    for (uint32_t i = 0; i < x.n; i++) {
      y = x;
      if (gen_fold(&y, i, CORE)) {
        folded++;
        KEPT("gen_fold");
        CHECK(y.n == x.n + 1 && y.l[i].kind == GL_REPEAT && y.l[i].x[0].v[0] == 2 && y.l[i + 2].kind == GL_END, "the lines of a fold");
      } else {
        CHECK(same_gen(&x, &y), "gen_fold said 0 and changed the generator");
      }
      y = x;
      uint32_t copies = 0, lines = 0;
      if (gen_unroll(&y, i, CORE, &copies, &lines)) {
        unrolled++;
        KEPT("gen_unroll");
        CHECK(y.n == x.n - 2 - lines + copies * lines && copies == x.l[i].x[0].v[0], "the lines of an unrolled block");
      } else {
        CHECK(same_gen(&x, &y), "gen_unroll said 0 and changed the generator");
      }
      y = x;
      const uint32_t end = i + 1 + rng_below(&r, x.n - i < 6 ? x.n - i : 6);
      if (gen_wrap(&y, i, end, CORE)) {
        wrapped++;
        KEPT("gen_wrap");
        CHECK(y.n == x.n + 2 && y.l[i].kind == GL_REPEAT && y.l[i].x[0].v[0] == 1 && y.l[end + 1].kind == GL_END, "the lines of a wrapped block");
      } else {
        CHECK(same_gen(&x, &y), "gen_wrap said 0 and changed the generator");
      }
      y = x;
      uint32_t def = 0;
      if (gen_extract(&y, i, end, CORE, &def)) {
        extracted++;
        KEPT("gen_extract");
        CHECK(y.n == x.n + 3 && y.l[i].kind == GL_CALL && y.l[i].callee == def && y.l[def].kind == GL_DEF && def + (end - i) + 2 == y.n &&
                  y.l[y.n - 1].kind == GL_END,
              "the lines of an extracted function");
      } else {
        CHECK(same_gen(&x, &y), "gen_extract said 0 and changed the generator");
      }
      y = x;
      uint32_t at = 0, body = 0;
      if (gen_inline(&y, i, CORE, &at, &body)) {
        inlined++;
        KEPT("gen_inline");
        dropped += y.n < x.n + body - 1;
        CHECK((y.n == x.n + body - 1 || y.n + 3 == x.n) && body, "the lines of an inlined call: %u, %u and %u", x.n, y.n, body);
      } else {
        CHECK(same_gen(&x, &y), "gen_inline said 0 and changed the generator");
      }
      for (int k = 0; k < 2; k++)
        for (uint32_t t = 0; t < x.l[i].x[k].n; t++) {
          y = x;
          if (gen_parameter(&y, i, k, t, rng_below(&r, 2), CORE)) {
            parameters++;
            KEPT("gen_parameter");
            CHECK(y.n == x.n && y.l[i].x[k].kind[t] == GT_ARG, "the token of a parameter");
          } else {
            CHECK(same_gen(&x, &y), "gen_parameter said 0 and changed the generator");
          }
          y = x;
          const uint32_t c = rng_below(&r, GEN_CONSTS);
          if (!gen_bind(&y, i, k, t, c, CORE)) {
            CHECK(same_gen(&x, &y), "gen_bind said 0 and changed the generator");
            continue;
          }
          bound++;
          KEPT("gen_bind");
          uint32_t uses = 0;
          for (uint32_t j = 0; j < y.n; j++)
            for (int m = 0; m < 2; m++)
              for (uint32_t q = 0; q < y.l[j].x[m].n; q++) uses += y.l[j].x[m].kind[q] == GT_CONST && y.l[j].x[m].v[q] == c;
          linked += uses > 1;
        }
    }
  }
#undef KEPT
  CHECK(wrapped > 3000 && folded > 1000 && unrolled > 500 && bound > 3000 && linked > 300, "%u wrapped, %u folded, %u unrolled, %u bound, %u linked",
        wrapped, folded, unrolled, bound, linked);
  CHECK(extracted > 3000 && inlined > 300 && dropped > 10 && parameters > 300, "%u extracted, %u inlined (%u with the function gone), %u parameters",
        extracted, inlined, dropped, parameters);
  // by hand: a function from lines in a loop of a function: the loop and the argument they use are its arguments
  parse(&x, "g: def\n"
            "  repeat 2\n"
            "    a: DAT.F #i+x, #a\n"
            "    repeat 2\n"
            "      SPL.B $a, #i+j\n"
            "    end\n"
            "  end\n"
            "end\n"
            "g(7)\n");
  y = x;
  CHECK(gen_extract(&y, 2, 6, CORE, 0), "an extract");
  CHECK(!strcmp(text_of(&y), "f0:     def\n"
                             "          repeat  2\n"
                             "            f6(i, x)\n"
                             "          end\n"
                             "        end\n"
                             "        f0(7)\n"
                             "f6:     def\n"
                             "L7:       DAT.F   #x+y, #L7\n"
                             "          repeat  2\n"
                             "            SPL.B   $L7, #i+x\n"
                             "          end\n"
                             "        end\n"),
        "extracted:\n%s", text_of(&y));
  CHECK(same_warrior(&x, &y, 100), "an extract gave another warrior");
  // not: three values from around the lines; a def among them; half a block
  parse(&x, "g: def\n  repeat 2\n    DAT.F #i+x, #y\n  end\nend\ng(7, 8)\nNOP.B $0, $0\n");
  y = x;
  CHECK(!gen_extract(&y, 2, 3, CORE, 0) && !gen_extract(&y, 0, 5, CORE, 0) && !gen_extract(&y, 1, 3, CORE, 0) && gen_extract(&y, 6, 7, CORE, 0),
        "what does not extract");
  // a call into the function's lines: the arguments are the caller's expressions, in the loops of each line
  parse(&x, "f: def\n"
            "  DAT.F #x, #y+1\n"
            "  repeat 2\n"
            "t:   SPL.B $t, #x+i\n"
            "  end\n"
            "end\n"
            "repeat 2\n"
            "  f(i*10, 5)\n"
            "end\n"
            "f(3)\n");
  y = x;
  uint32_t at = 0, lines = 0, copies;
  CHECK(gen_inline(&y, 7, CORE, &at, &lines) && at == 7 && lines == 4, "an inline: %u, %u", at, lines);
  CHECK(!strcmp(text_of(&y), "f0:     def\n"
                             "          DAT.F   #x, #y+1\n"
                             "          repeat  2\n"
                             "L3:         SPL.B   $L3, #x+i\n"
                             "          end\n"
                             "        end\n"
                             "        repeat  2\n"
                             "          DAT.F   #i*10, #6\n"
                             "          repeat  2\n"
                             "L9:         SPL.B   $L9, #j*10+i\n"
                             "          end\n"
                             "        end\n"
                             "        f0(3)\n"),
        "inlined:\n%s", text_of(&y));
  CHECK(same_warrior(&x, &y, 100), "an inline gave another warrior");
  // the last call inlined: the function goes
  CHECK(gen_inline(&y, 12, CORE, &at, &lines), "the last call");
  uint32_t defs = 0;
  for (uint32_t i = 0; i < y.n; i++) defs += y.l[i].kind == GL_DEF;
  CHECK(!defs && same_warrior(&x, &y, 100) && !strcmp(text_of(&y), "        repeat  2\n"
                                                                    "          DAT.F   #i*10, #6\n"
                                                                    "          repeat  2\n"
                                                                    "L3:         SPL.B   $L3, #j*10+i\n"
                                                                    "          end\n"
                                                                    "        end\n"
                                                                    "        DAT.F   #3, #1\n"
                                                                    "        repeat  2\n"
                                                                    "L8:       SPL.B   $L8, #3+i\n"
                                                                    "        end\n"),
        "after the last call:\n%s", text_of(&y));
  // a function does not see its caller's loops: its i is 0, also after it came into a loop
  parse(&x, "f: def\n  DAT.F #i, #x\nend\nrepeat 2\n  f(i+5)\nend\n");
  y = x;
  CHECK(gen_inline(&y, 4, CORE, 0, 0) && !strcmp(text_of(&y), "        repeat  2\n          DAT.F   #0, #i+5\n        end\n"), "inlined into a loop:\n%s", text_of(&y));
  // a number of a function as its argument: every call passes it
  parse(&x, "f: def\n  DAT.F #x, #300\n  NOP.B $0, #5\nend\nf(1)\nf(2)\n");
  y = x;
  CHECK(gen_parameter(&y, 1, 1, 0, 1, CORE), "a parameter");
  CHECK(!strcmp(text_of(&y), "f0:     def\n          DAT.F   #x, #y\n          NOP.B   $0, #5\n        end\n        f0(1, 300)\n        f0(2, 300)\n"),
        "a parameter:\n%s", text_of(&y));
  CHECK(same_warrior(&x, &y, 100) && y.l[4].x[1].v[0] == 300 && y.l[5].x[1].v[0] == 300 && y.l[1].x[1].kind[0] == GT_ARG, "a parameter gave another warrior");
  CHECK(!gen_parameter(&y, 2, 1, 0, 1, CORE) && !gen_parameter(&y, 2, 1, 0, 0, CORE) && !gen_parameter(&y, 4, 0, 0, 0, CORE) && !gen_parameter(&y, 1, 0, 0, 0, CORE),
        "an argument that is used for another number, a line outside a function, a token that is no number");
  // a number that every call passes already takes the same argument
  parse(&x, "f: def\n  DAT.F #x, #300\nend\nf(300)\nf(300)\n");
  CHECK(gen_parameter(&x, 1, 1, 0, 0, CORE) && !strcmp(text_of(&x), "f0:     def\n          DAT.F   #x, #x\n        end\n        f0(300)\n        f0(300)\n"),
        "the same argument:\n%s", text_of(&x));
  // by hand: a fold of two numbers is a + i*d; the same label stays; each its own label stays
  parse(&x, "t: NOP.B $0, $0\na: DAT.F #5, $t\nb: DAT.F #-7, $t\nc: SPL.B $c, #100\nd: SPL.B $d, #90\n");
  y = x;
  CHECK(gen_fold(&y, 1, CORE) && gen_fold(&y, 4, CORE), "two folds");
  CHECK(!strcmp(text_of(&y), "L0:     NOP.B   $0, $0\n"
                             "        repeat  2\n"
                             "          DAT.F   #5+i*-12, $L0\n"
                             "        end\n"
                             "        repeat  2\n"
                             "L5:       SPL.B   $L5, #100+i*-10\n"
                             "        end\n"),
        "folded:\n%s", text_of(&y));
  // not: other opcodes, modifiers or modes, the start at the second, a third line that refers to the second
  parse(&x, "DAT.F #1, #2\nDAT.A #1, #3\nDAT.A $1, #3\nDAT.A $1, $4\nb: NOP.B $0, $0\nNOP.B $b, #1\nd: JMP.B $0, $0\ne: JMP.B $0, $0\nNOP.B $0, #1\ns: NOP.B $0, #2\nMOV.I $s, $0\norg e\n");
  for (uint32_t i = 0; i < x.n; i++) {
    y = x;
    CHECK(!gen_fold(&y, i, CORE), "line %u folds:\n%s", i, text_of(&y));
  }
  // an unrolled block: i its numbers, j comes in as i, the labels of each repetition its own
  parse(&x, "repeat 2\n"
            "  r: repeat 2\n"
            "  a: DAT.F #i, #j\n"
            "    repeat 2\n"
            "      SPL.B $a, #i+j*10+k\n"
            "    end\n"
            "  e: end\n"
            "  JMP.B $r, $e\n"
            "end\n"
            "NOP.B $a, $0\n");
  y = x;
  CHECK(gen_unroll(&y, 1, CORE, &copies, &lines) && copies == 2 && lines == 4, "the inner block unrolls");
  CHECK(!strcmp(text_of(&y), "        repeat  2\n"
                             "L1:       DAT.F   #0, #i\n"
                             "          repeat  2\n"
                             "            SPL.B   $L1, #i+j\n"
                             "          end\n"
                             "L5:       DAT.F   #1, #i\n"
                             "          repeat  2\n"
                             "            SPL.B   $L5, #i+10+j\n"
                             "          end\n"
                             "L9:       JMP.B   $L1, $L9\n"
                             "        end\n"
                             "        NOP.B   $L1, $0\n"),
        "unrolled:\n%s", text_of(&y));
  // what a number in place of i leaves behind goes: i*5 is 0, 5, 10; c0 - i is c0, c0-1; (i+1)*4000 stays where it is no number of the core
  parse(&x, "c0 = 9\nrepeat 3\n  DAT.F #7+i*5, #c0-i\n  DAT.F #(i+1)*4000/3, #100/(i-1)\nend\n");
  y = x;
  CHECK(gen_unroll(&y, 0, CORE, 0, 0), "a block unrolls");
  CHECK(!strcmp(text_of(&y), "c0 = 9\n"
                             "        DAT.F   #7, #c0\n"
                             "        DAT.F   #1333, #-100\n"
                             "        DAT.F   #12, #c0-1\n"
                             "        DAT.F   #2*4000/3, #0\n"
                             "        DAT.F   #17, #c0-2\n"
                             "        DAT.F   #3*4000/3, #100\n"),
        "simplified:\n%s", text_of(&y));
  // not: a count that is no number or above 16, the block's length used, an empty block
  parse(&x, "a: repeat 2+1\nNOP.B $0, $0\nend\nb: repeat 17\nNOP.B $0, $0\nend\n"
            "d: repeat 2\nNOP.B $0, #d.len\nend\ne: repeat 2\nend\nNOP.B $0, $0\n");
  for (uint32_t i = 0; i < x.n; i++) {
    y = x;
    CHECK(!gen_unroll(&y, i, CORE, 0, 0), "line %u unrolls:\n%s", i, text_of(&y));
  }
  // a wrapped block: the loops of its lines move out
  parse(&x, "repeat 3\n  DAT.F #i, #j\n  repeat 2\n    NOP.B #i, #j\n  end\nend\n");
  y = x;
  CHECK(gen_wrap(&y, 1, 5, CORE), "a wrap");
  CHECK(!strcmp(text_of(&y), "        repeat  3\n"
                             "          repeat  1\n"
                             "            DAT.F   #j, #k\n"
                             "            repeat  2\n"
                             "              NOP.B   #i, #k\n"
                             "            end\n"
                             "          end\n"
                             "        end\n"),
        "wrapped:\n%s", text_of(&y));
  y = x;
  CHECK(!gen_wrap(&y, 1, 3, CORE) && !gen_wrap(&y, 2, 6, CORE) && !gen_wrap(&y, 3, 3, CORE) && !gen_wrap(&y, 4, 7, CORE), "half a block wraps");
  parse(&x, "f: def\nend\nNOP.B $0, $0\n");
  CHECK(!gen_wrap(&x, 0, 2, CORE) && gen_wrap(&x, 2, 3, CORE), "a def wraps");
  // a constant: what is equal, its negative, its double and near it follows
  parse(&x, "DAT.F #300, #-300\nDAT.F #600, #310\nDAT.F #300+5, #2*290\nDAT.F #16, #1000\nrepeat 300\nend\n");
  y = x;
  CHECK(gen_bind(&y, 0, 0, 0, 3, CORE), "a constant");
  CHECK(!strcmp(text_of(&y), "c3 = 300\n"
                             "        DAT.F   #c3, #0-c3\n"
                             "        DAT.F   #c3*2, #c3+10\n"
                             "        DAT.F   #c3+5, #2*(c3+-10)\n"
                             "        DAT.F   #16, #1000\n"
                             "        repeat  300\n"
                             "        end\n"),
        "bound:\n%s", text_of(&y));
  CHECK(!gen_bind(&y, 3, 1, 0, 3, CORE) && !gen_bind(&y, 3, 0, 0, 4, CORE) && !gen_bind(&y, 0, 0, 0, 4, CORE) && !gen_bind(&y, 3, 1, 0, 16, CORE),
        "a constant in use, a near number, a token that is no number, c16");
}

// The mix: the new kinds have names, the list never draws them, a generator does.
static void test_kinds(void) {
  genome_mix m;
  char text[CH_ALL * 32];
  CHECK(!genome_mix_parse(&m, "repeat=3,count=4,fold=5,unroll=6,index=7,expression=8,constant=9,tune=1"), "the names of the new kinds");
  CHECK(m.w[CH_REPEAT] == 3 && m.w[CH_REPEATS] == 4 && m.w[CH_FOLD] == 5 && m.w[CH_UNROLL] == 6 && m.w[CH_INDEX] == 7 &&
            m.w[CH_EXPRESSION] == 8 && m.w[CH_CONSTANT] == 9 && m.w[CH_TUNE] == 1 && m.w[CH_INSERT] == 0,
        "their weights");
  genome_mix_text(&m, text, sizeof text);
  CHECK(!strcmp(text, "tune=1,repeat=3,count=4,fold=5,unroll=6,index=7,expression=8,constant=9"), "%s", text);
  const genome_mix list = genome_mix_default(), gen = gen_mix_default();
  uint32_t old = 0, new = 0;
  for (int k = 0; k < CH_ALL; k++) {
    CHECK(k >= CH_COUNT ? !list.w[k] && gen.w[k] : list.w[k] == gen.w[k], "the weight of %s", genome_change_name(k));
    *(k < CH_COUNT ? &old : &new) += gen.w[k];
  }
  CHECK(old == 1000 && new == 325, "%u and %u", old, new);
  CHECK(!genome_mix_parse(&m, "extract=1,parameter=2,call=3,inline=4,transplant=5") && m.w[CH_EXTRACT] == 1 && m.w[CH_PARAMETER] == 2 &&
            m.w[CH_CALL] == 3 && m.w[CH_INLINE] == 4 && m.w[CH_TRANSPLANT] == 5,
        "the kinds of functions");
  // a list: the new kinds do not apply, and breeding with them draws the others
  rng r = rng_seed(121, 122, 123);
  static genome g, before, child;
  for (int round = 0; round < 500; round++) {
    genome_random(&g, &r, CORE, 1 + rng_below(&r, 20));
    before = g;
    for (int k = CH_COUNT; k < CH_ALL; k++)
      CHECK(!genome_change(&g, &before, &r, CORE, 100, k) && g.len == before.len && !memcmp(g.g, before.g, g.len * sizeof g.g[0]),
            "%s applies to a list", genome_change_name(k));
    char ops[96];
    rng r1 = rng_seed(124, (uint64_t)round, 0), r2 = r1;
    genome_breed(&child, &g, &g, &r1, CORE, 100, &gen, ops, sizeof ops);
    CHECK(!strstr(ops, "repeat") && !strstr(ops, "fold") && !strstr(ops, "constant"), "a list bred with %s", ops);
    // and the same child as without them: their weights are not drawn
    genome_breed(&before, &g, &g, &r2, CORE, 100, &list, ops, sizeof ops);
    CHECK(r1.s == r2.s, "a list bred with the weights of the new kinds drew other numbers");
  }
}


static void parse(gen *x, const char *text) {
  char err[160];
  if (gen_parse(x, text, CORE, err, sizeof err)) CHECK(0, "%s in\n%s", err, text);
}

// gen_rebuild(): the references follow their lines.
static void test_rebuild(void) {
  static gen a, b, child;
  rng r = rng_seed(95, 96, 97);
  parse(&a, "c0 = 7\n"
            "f: def\n"                  // 0
            "t: SPL.B $t, #x\n"         // 1
            "end\n"                     // 2
            "s: MOV.I $r, $r.len\n"     // 3
            "r: repeat 2\n"             // 4
            "l: DAT.F #c0, #s\n"        // 5
            " JMP.B $l, $e\n"           // 6
            "e: end\n"                  // 7
            "f(e, 1)\n"                 // 8
            "org s\n");
  // lines 5 and 6 leave the block, a new line in front: every label follows
  const slot moved[] = {{SLOT_NEW, 0}, {SLOT_A, 0}, {SLOT_A, 1}, {SLOT_A, 2}, {SLOT_A, 5}, {SLOT_A, 6}, {SLOT_A, 3}, {SLOT_A, 4}, {SLOT_A, 7}, {SLOT_A, 8}};
  gen_rebuild(&child, &a, &a, moved, 10, CORE, &r, 0);
  child.l[0] = a.l[5], child.l[0].x[1].v[0] = 6; // the new line: something known
  CHECK(!strcmp(text_of(&child), "c0 = 7\n"
                                 "        DAT.F   #c0, #L6\n"
                                 "f1:     def\n"
                                 "L2:       SPL.B   $L2, #x\n"
                                 "        end\n"
                                 "L4:     DAT.F   #c0, #L6\n"
                                 "        JMP.B   $L4, $L8\n"
                                 "L6:     MOV.I   $L7, $L7.len\n"
                                 "L7:     repeat  2\n"
                                 "L8:     end\n"
                                 "        f1(L8, 1)\n"
                                 "        org     L6\n"),
        "moved:\n%s", text_of(&child));
  // lines 3 and 4 gone (with 7, the block's end): a reference to them goes to the next line left,
  // the start too (line 3 of the child, where its text starts anyway)
  const slot gone[] = {{SLOT_A, 0}, {SLOT_A, 1}, {SLOT_A, 2}, {SLOT_A, 5}, {SLOT_A, 6}, {SLOT_A, 8}};
  gen_rebuild(&child, &a, &a, gone, 6, CORE, &r, 0);
  CHECK(!strcmp(text_of(&child), "c0 = 7\n"
                                 "f0:     def\n"
                                 "L1:       SPL.B   $L1, #x\n"
                                 "        end\n"
                                 "L3:     DAT.F   #c0, #L3\n"
                                 "        JMP.B   $L3, $L5\n"
                                 "L5:     f0(L5, 1)\n"),
        "gone:\n%s", text_of(&child));
  // the block a second time (a is b): the copy's labels are its own, the others stay
  const slot twice[] = {{SLOT_A, 0}, {SLOT_A, 1}, {SLOT_A, 2}, {SLOT_A, 3}, {SLOT_A, 4}, {SLOT_A, 5}, {SLOT_A, 6}, {SLOT_A, 7},
                        {SLOT_B, 4}, {SLOT_B, 5}, {SLOT_B, 6}, {SLOT_B, 7}, {SLOT_A, 8}};
  gen_rebuild(&child, &a, &a, twice, 13, CORE, &r, 0);
  CHECK(!strcmp(text_of(&child), "c0 = 7\n"
                                 "f0:     def\n"
                                 "L1:       SPL.B   $L1, #x\n"
                                 "        end\n"
                                 "L3:     MOV.I   $L4, $L4.len\n"
                                 "L4:     repeat  2\n"
                                 "L5:       DAT.F   #c0, #L3\n"
                                 "          JMP.B   $L5, $L7\n"
                                 "L7:     end\n"
                                 "        repeat  2\n"
                                 "L9:       DAT.F   #c0, #L3\n"
                                 "          JMP.B   $L9, $L11\n"
                                 "L11:    end\n"
                                 "        f0(L7, 1)\n"),
        "twice:\n%s", text_of(&child));
  // lines of another generator: what they refer to and is not copied
  // becomes its number in b's warrior, b's constants their numbers, and a
  // function that is not copied is no function
  parse(&b, "c0 = 300\nc1 = -5\n"
            "g: def\n"                    // 0
            " NOP.B $0, $0\n"             // 1
            " NOP.B $0, $0\n"             // 2
            "end\n"                       // 3
            "h: def\n"                    // 4
            " g()\n"                      // 5
            "end\n"                       // 6
            "p: DAT.F #c0, #c1+i\n"       // 7
            "q: JMP.B $p, $w\n"           // 8
            " h(q, g.len)\n"              // 9
            "w: SPL.B $q, $h.len\n"       // 10
            " g()\n");                    // 11
  m42_instruction code[GEN_LINES];
  static gen_info info;
  gen_compile_info(&b, CORE, 100, code, &info);
  // b's warrior: DAT, JMP, NOP NOP (h calls g), SPL, NOP NOP
  CHECK(info.n == 7 && info.pos[10] == 4 && info.pos[4] == 2 && info.len[4] == 2, "b's warrior");
  const slot cross[] = {{SLOT_A, 3}, {SLOT_B, 8}, {SLOT_B, 9}, {SLOT_B, 10}, {SLOT_B, 11}, {SLOT_B, 4}, {SLOT_B, 5}, {SLOT_B, 6}, {SLOT_B, 7}};
  gen_rebuild(&child, &a, &b, cross, 9, CORE, &r, &info);
  CHECK(!strcmp(text_of(&child), "c0 = 7\n"
                                 "L0:     MOV.I   $L0, $L0.len\n"
                                 "L1:     JMP.B   $L8, $L3\n"
                                 "        f5(L1, 2)\n"
                                 "L3:     SPL.B   $L1, $f5.len\n"
                                 "L4:     L4()\n"
                                 "f5:     def\n"
                                 "L6:       L6()\n"
                                 "        end\n"
                                 "L8:     DAT.F   #300, #-5+i\n"),
        "crossed:\n%s", text_of(&child));
  // without the copy of line 7, JMP's label p is the distance in b's warrior: 1 back
  gen_rebuild(&child, &a, &b, cross, 8, CORE, &r, &info);
  CHECK(child.l[1].x[0].kind[0] == GT_NUM && child.l[1].x[0].v[0] == CORE - 1, "a label of b that is not copied: %s", text_of(&child));
  // and w, two lines on, is 3 instructions on: the call of h between them writes two
  const slot one[] = {{SLOT_A, 3}, {SLOT_B, 8}};
  gen_rebuild(&child, &a, &b, one, 2, CORE, &r, &info);
  CHECK(child.l[1].x[1].kind[0] == GT_NUM && child.l[1].x[1].v[0] == 3, "a label of b across a call: %s", text_of(&child));
  char err[160];
  CHECK(!gen_check(&child, CORE, err, sizeof err), "%s", err);
}

// A crossover takes the functions along that its lines call, and their functions.
static void test_crossover(void) {
  static gen a, b, x;
  parse(&a, "MOV.I $0, $1\n");
  parse(&b, "g: def\n NOP.B $0, #x\nend\n"
            "h: def\n g(y)\n SPL.B $0, $0\nend\n"
            "u: def\n DAT.F #9, #9\nend\n"
            "h(1, 2)\n");
  uint32_t with = 0, calls = 0;
  for (uint64_t seed = 0; seed < 400; seed++) {
    rng r = rng_seed(98, seed, 0);
    x = a;
    if (!gen_change(&x, &b, &r, CORE, 100, CH_XINSERT)) continue;
    char err[160];
    CHECK(!gen_check(&x, CORE, err, sizeof err), "%s", err);
    const char *text = text_of(&x);
    const int call = strstr(text, "(1, 2)") != 0;
    calls += call;
    // the call came with h, and h with g; u, which nothing calls, stayed unless it was among the lines taken
    if (call) CHECK(strstr(text, "NOP.B") && strstr(text, "SPL.B"), "a call without its functions:\n%s", text);
    with += call && !strstr(text, "DAT.F   #9");
    if (call && !strstr(text, "DAT.F   #9")) {
      m42_instruction code[GEN_LINES];
      uint32_t start;
      CHECK(gen_compile(&x, CORE, 100, code, &start, 0) == 3, "MOV, and NOP and SPL of the call:\n%s", text);
    }
  }
  CHECK(calls > 50 && with > 10, "%u crossovers took the call, %u of them only its functions", calls, with);
}

// The changes of a list on a generator with structure touch its numbers and
// labels, not its structure.
static void test_parts(void) {
  static gen x, y;
  parse(&x, "c0 = 500\n"
            "r: repeat 50\n"
            "  DAT.F #i*7+c0, #r.len-i\n"
            "end\n"
            "f: def\n"
            "  NOP.B $x, $y\n"
            "end\n"
            "f(i, 3)\n");
  // no far number: the count 50, the constant and the 7 are none
  for (uint64_t seed = 0; seed < 200; seed++) {
    rng r = rng_seed(102, seed, 0);
    y = x;
    CHECK(!gen_change(&y, 0, &r, CORE, 100, CH_TUNE) && !gen_change(&y, 0, &r, CORE, 100, CH_SHARED) && same_gen(&x, &y),
          "tune or shared-constant changed\n%s", text_of(&y));
  }
  // a far number in an argument and one in an operand are two
  parse(&x, "f: def\n  NOP.B $x, $y\nend\nr: repeat 50\n  DAT.F #i*700, #1\nend\nf(i, 300)\n");
  uint32_t argument = 0, operand = 0;
  for (uint64_t seed = 0; seed < 200; seed++) {
    rng r = rng_seed(103, seed, 0);
    y = x;
    CHECK(gen_change(&y, 0, &r, CORE, 100, CH_TUNE), "tune does not apply");
    argument += y.l[6].x[1].v[0] != 300;
    operand += y.l[4].x[0].v[1] != 700;
    CHECK(y.l[3].x[0].v[0] == 50 && (y.l[6].x[1].v[0] != 300) != (y.l[4].x[0].v[1] != 700), "tune changed\n%s", text_of(&y));
  }
  CHECK(argument > 50 && operand > 50, "tune: %u times the argument, %u times the operand", argument, operand);
  // a step of tune: 1 to 4, or up to a fiftieth of the number
  parse(&x, "DAT.F #100, #-1000\n");
  uint32_t steps[2][21] = {{0}};
  for (uint64_t seed = 0; seed < 2000; seed++) {
    rng r = rng_seed(107, seed, 0);
    y = x;
    gen_change(&y, 0, &r, CORE, 100, CH_TUNE);
    const int32_t a = (int32_t)y.l[0].x[0].v[0] - 100, b = (int32_t)y.l[0].x[1].v[0] - (int32_t)(CORE - 1000);
    CHECK((a == 0) != (b == 0) && abs(a) <= 4 && abs(b) <= 20, "tune moved 100 by %d and -1000 by %d", a, b);
    if (abs(a) <= 4 && abs(b) <= 20) steps[0][abs(a)]++, steps[1][abs(b)]++;
  }
  CHECK(steps[0][1] > 100 && steps[0][4] > 100 && steps[1][1] > 10 && steps[1][20] > 10, "the steps of tune");
  // an operand change takes one number or label of the expression; i, c0 and the operations stay
  parse(&x, "c0 = 500\nr: repeat 5\n  DAT.F #i*7+c0, #r.len-i+r\nend\n");
  uint32_t number = 0, label = 0;
  for (uint64_t seed = 0; seed < 400; seed++) {
    rng r = rng_seed(104, seed, 0);
    y = x;
    const int kind = seed % 2 ? CH_AOPERAND : CH_BOPERAND;
    CHECK(gen_change(&y, 0, &r, CORE, 100, kind), "an operand change does not apply");
    const gen_expr *a = &y.l[1].x[0], *b = &y.l[1].x[1];
    CHECK(a->n == 5 && a->kind[0] == GT_INDEX && a->kind[2] == GT_MUL && a->kind[3] == GT_CONST && a->kind[4] == GT_ADD && b->n == 5 &&
              b->kind[0] == GT_LEN && b->kind[1] == GT_INDEX && b->kind[2] == GT_SUB && b->kind[4] == GT_ADD,
          "an operand change took more than a number or a label:\n%s", text_of(&y));
    number += a->v[1] != 7 || a->kind[1] != GT_NUM;
    label += b->kind[3] != GT_POS || b->v[3] != 0;
    char err[160];
    CHECK(!gen_check(&y, CORE, err, sizeof err), "%s", err);
  }
  CHECK(number > 150 && label > 150, "%u numbers and %u labels changed", number, label);
  // a label that becomes a number is the distance it stood for in the warrior, not between the lines
  parse(&x, "NOP.B $0, $0\nNOP.B $0, $0\nr: repeat 3\n  DAT.F #0, #r\nend\n");
  uint32_t numbers = 0;
  for (uint64_t seed = 0; seed < 400; seed++) {
    rng r = rng_seed(105, seed, 0);
    y = x;
    gen_change(&y, 0, &r, CORE, 100, CH_BOPERAND);
    const gen_expr *b = &y.l[3].x[1];
    if (b->kind[0] != GT_NUM) continue;
    numbers++;
    // the first instance of the DAT is the block's first instruction: distance 0, give or take 2
    const int32_t v = b->v[0] > CORE / 2 ? (int32_t)b->v[0] - (int32_t)CORE : (int32_t)b->v[0];
    CHECK(v >= -2 && v <= 2, "the label became %d", v);
  }
  CHECK(numbers > 10, "%u labels became numbers", numbers);
  // the changes of a line take a line that the warrior has: not one of a function nobody calls or of a block that repeats 0 times
  parse(&x, "f: def\n  DAT.F #1000, #f\nend\nrepeat 0\n  SPL.B #2000, $f\nend\nNOP.B $3000, $-3000\n");
  for (uint64_t seed = 0; seed < 900; seed++) {
    rng r = rng_seed(108, seed, 0);
    y = x;
    const int kinds[] = {CH_OPCODE, CH_MODIFIER, CH_AMODE, CH_BMODE, CH_AOPERAND, CH_BOPERAND, CH_REPLACE, CH_RELATED_OPCODE, CH_RELATED_MODE,
                         CH_SHARED, CH_TUNE, CH_EXPRESSION, CH_CONSTANT};
    const int kind = kinds[seed % 13];
    if (!gen_change(&y, 0, &r, CORE, 100, kind)) continue;
    y.l[6] = x.l[6];
    memcpy(y.c, x.c, sizeof y.c);
    CHECK(same_gen(&x, &y), "%s changed a line that is never written:\n%s", genome_change_name(kind), text_of(&y));
  }
  // after breeding, a function that nothing calls is gone, and one that is called stays
  parse(&x, "dead: def\n  DAT.F #1, #1\nend\nlive: def\n  NOP.B $1000, $0\nend\nlive()\nlater: def\n  SPL.B $0, $0\nend\nMOV.I $0, $later\n");
  for (uint64_t seed = 0; seed < 50; seed++) {
    rng r = rng_seed(109, seed, 0);
    genome_mix only = {{0}};
    only.w[CH_TUNE] = 1;
    char ops[64];
    gen_breed(&y, &x, 0, &r, CORE, 100, &only, ops, sizeof ops);
    uint32_t defs = 0, calls = 0;
    for (uint32_t i = 0; i < y.n; i++) defs += y.l[i].kind == GL_DEF, calls += y.l[i].kind == GL_CALL && y.l[y.l[i].callee].kind == GL_DEF;
    char err[160];
    CHECK(defs == 2 && calls == 1 && y.n == x.n - 3 && !gen_check(&y, CORE, err, sizeof err) && strstr(ops, "tune"), "after %s:\n%s", ops, text_of(&y));
    m42_instruction code[GEN_LINES];
    uint32_t start;
    CHECK(gen_compile(&y, CORE, 100, code, &start, 0) == 2 && code[0].opcode == 16 && code[1].opcode == 0, "the warrior after %s", ops);
  }
  // a block is one unit: deleting, moving and duplicating never split one
  parse(&x, "NOP.B $0, $0\nrepeat 2\n  DAT.F #1, #1\n  repeat 2\n    SPL.B $0, $0\n  end\nend\nJMP.B $0, $0\n");
  for (uint64_t seed = 0; seed < 600; seed++) {
    rng r = rng_seed(106, seed, 0);
    y = x;
    const int kinds[] = {CH_DELETE, CH_MOVE, CH_DUPLICATE, CH_INSERT};
    if (!gen_change(&y, 0, &r, CORE, 100, kinds[seed % 4])) continue;
    char err[160];
    CHECK(!gen_check(&y, CORE, err, sizeof err), "%s:\n%s", err, text_of(&y));
    uint32_t repeats = 0, ends = 0;
    for (uint32_t i = 0; i < y.n; i++) repeats += y.l[i].kind == GL_REPEAT, ends += y.l[i].kind == GL_END;
    CHECK(repeats == ends, "%u repeats and %u ends", repeats, ends);
  }
}

static void test_state(void) {
  rng r = rng_seed(99, 100, 101);
  static gen x, y;
  static genome g, back;
  static char text[GENOME_SAVE_MAX], again[GENOME_SAVE_MAX];
  size_t longest = 0;
  for (int round = 0; round < 3000; round++) {
    random_gen(&x, &r);
    const size_t len = gen_save(&x, text, sizeof text);
    CHECK(len < sizeof text - 4 && strlen(text) == len, "a state text of %zu bytes", len);
    const char *end = 0;
    CHECK(!gen_load(&y, text, CORE, &end) && same_gen(&x, &y) && end == text + len, "a generator's state does not read back");
    // a genome that is a generator: its list is the warrior
    if (!keeps_limits(&x, 100)) continue;
    genome_random(&g, &r, CORE, 3);
    genome_as_generator(&g);
    g.p = x;
    const size_t glen = genome_save(&g, text, sizeof text);
    if (glen > longest) longest = glen;
    CHECK(!strncmp(text, "gen ", 4) && !genome_load(&back, text, CORE, &end) && back.generated == 1 && same_gen(&back.p, &x) && end == text + glen,
          "a generated genome's state does not read back");
    m42_instruction code[GEN_LINES], list[GENOME_MAX];
    uint32_t start;
    const uint32_t n = gen_compile(&x, CORE, 100, code, &start, 0);
    genome_code(&back, CORE, list);
    CHECK(back.len == n && back.start == start && !memcmp(code, list, n * sizeof *code), "the list of a loaded generator is not its warrior");
    genome_save(&back, again, sizeof again);
    CHECK(!strcmp(text, again), "saved again it differs");
    // a text cut short or with a number out of range is refused
    text[4 + rng_below(&r, (uint32_t)glen - 4)] = 0;
    const size_t cut = strlen(text);
    if (cut < glen - 1 && text[cut - 1] != ' ' && text[cut + 1] != ' ') continue; // a number cut in the middle may read
    CHECK(genome_load(&back, text, CORE, &end) == -1, "a state cut after %zu of %zu bytes was read", cut, glen);
  }
  // the longest generator fits
  memset(&x, 0, sizeof x);
  x.n = GEN_LINES;
  x.start = GEN_LINES - 1;
  for (uint32_t k = 0; k < GEN_CONSTS; k++) x.c[k] = CORE - 1;
  for (uint32_t i = 0; i < GEN_LINES; i++) {
    gen_line *l = &x.l[i];
    l->kind = GL_EMIT, l->op = 16, l->mod = 6, l->am = l->bm = 7;
    for (int k = 0; k < 2; k++) {
      l->x[k].n = 7;
      for (int t = 0; t < 7; t++) l->x[k].kind[t] = t % 2 ? GT_MOD : GT_NUM, l->x[k].v[t] = t % 2 ? 0 : 4294967295u % CORE;
      l->x[k].kind[1] = GT_NUM, l->x[k].v[1] = CORE - 1, l->x[k].kind[2] = GT_MOD, l->x[k].kind[3] = GT_NUM, l->x[k].v[3] = CORE - 1;
      l->x[k].kind[4] = GT_MOD, l->x[k].kind[5] = GT_NUM, l->x[k].v[5] = CORE - 1, l->x[k].kind[6] = GT_MOD;
      l->x[k].v[2] = l->x[k].v[4] = l->x[k].v[6] = 0;
    }
  }
  char err[160];
  CHECK(!gen_check(&x, CORE, err, sizeof err), "%s", err);
  const size_t len = gen_save(&x, text, sizeof text);
  CHECK(len + 4 < GENOME_SAVE_MAX && !gen_load(&y, text, CORE, 0) && same_gen(&x, &y), "the longest generator takes %zu bytes", len);
  CHECK(longest > 500, "the longest state text had %zu bytes", longest);
  CHECK(gen_load(&y, "", CORE, 0) == -1 && gen_load(&y, "1 0", CORE, 0) == -1 && gen_load(&y, "300 0", CORE, 0) == -1, "a short text");
  // numbers that are no generator: a line of kind 4 is a call and reads, kind 5 is none, an instruction needs its operands
#define STATE(line) "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 " line
  CHECK(gen_load(&y, STATE("4 0 0 0 0 0 0 0"), CORE, 0) == 0 && y.l[0].kind == GL_CALL, "a call");
  CHECK(gen_load(&y, STATE("5 0 0 0 0 0 0 0"), CORE, 0) == -1, "a line of kind 5");
  CHECK(gen_load(&y, STATE("0 0 0 0 0 0 0 0"), CORE, 0) == -1, "an instruction without operands");
  CHECK(gen_load(&y, STATE("0 0 0 0 0 0 1 0 5 1 0 8000"), CORE, 0) == -1 && gen_load(&y, STATE("0 0 0 0 0 0 1 0 5 1 0 7999"), CORE, 0) == 0, "a number of the core size");
#undef STATE
}

int main(void) {
  test_repeat();
  test_labels();
  test_functions();
  test_counts();
  test_arithmetic();
  test_start();
  test_limits();
  test_errors();
  test_text();
  test_list();
  test_random();
  test_bytes();
  test_check();
  test_mirror();
  test_structured();
  test_rebuild();
  test_crossover();
  test_parts();
  test_rewrites();
  test_kinds();
  test_state();
  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ok");
  return 0;
}
