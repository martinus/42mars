// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Generators (evolver/generator.c, docs/evolver-gen.md): what each part of
// the language writes, the limits, the text form both ways, a list genome as
// a generator, and random generators, texts and bytes: gen_compile() always
// gives a warrior within the limits.
// Prints "ok" and exits 0, or names the first failures and exits 1.
//
//   cc -O2 -Ilib -Ievolver -o generator-test test/c/generator-test.c evolver/generator.c evolver/genome.c lib/42mars.c -lm

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "42mars.h"
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
  // a function sees the loops of its caller; an argument is the caller's expression
  WRITES("g: def\n DAT.F #x, #i\nend\nrepeat 2\n g(i*10)\nend\n", "0: DAT.F #0, #0; DAT.F #10, #1;");
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
    genome_random(&g, &r, CORE, 1 + rng_below(&r, round % 50 ? 60 : GENOME_MAX), 0);
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
  if (failures) {
    fprintf(stderr, "%d failures\n", failures);
    return 1;
  }
  puts("ok");
  return 0;
}
