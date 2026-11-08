// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Expression evaluator for Redcode operands, FOR counts and ;assert lines.
// Signed 64-bit arithmetic on BigInt, 26 single-letter registers.

export const EVAL_OK = 0;
export const EVAL_OVERFLOW = 1; // result valid, but 64-bit overflow happened
export const EVAL_BAD = -1; // syntax error
export const EVAL_DIV_ZERO = -2; // division or modulo by zero

const MAX_INT = (1n << 63n) - 1n;

// Binary operators. The precedence is the second field: higher binds tighter.
const NONE = 0;
const MUL = 1, DIV = 2, MOD = 3, ADD = 4, SUB = 5;
const EQ = 6, NE = 7, LT = 8, GT = 9, LE = 10, GE = 11, AND = 12, OR = 13;
const PREC = [0, 5, 5, 5, 4, 4, 3, 3, 3, 3, 3, 3, 2, 1];

// Thrown to abort the evaluation with a syntax error.
class SyntaxFailure extends Error {}

const isSpace = (c) => c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\v' || c === '\f';
const isDigit = (c) => c >= '0' && c <= '9';
const isLetter = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

export class Evaluator {
  constructor() {
    this.registers = new Array(26).fill(0n);
    this.text = '';
    this.pos = 0;
    this.status = EVAL_OK;
  }

  resetRegisters() {
    this.registers.fill(0n);
  }

  evaluate(text) {
    this.text = text;
    this.pos = 0;
    this.status = EVAL_OK;
    let value = 0n;
    try {
      value = this.group();
      this.skipSpace();
      if (this.pos < this.text.length) throw new SyntaxFailure();
    } catch (e) {
      if (!(e instanceof SyntaxFailure)) throw e;
      return { status: EVAL_BAD, value };
    }
    return { status: this.status, value };
  }

  // ---- scanning helpers

  skipSpace() {
    while (this.pos < this.text.length && isSpace(this.text[this.pos])) this.pos++;
  }

  peek(offset = 0) {
    return this.text[this.pos + offset] ?? '';
  }

  // ---- arithmetic with overflow tracking

  wrap(x) {
    const w = BigInt.asIntN(64, x);
    if (w !== x && this.status === EVAL_OK) this.status = EVAL_OVERFLOW;
    return w;
  }

  apply(op, a, b) {
    switch (op) {
      case MUL: return this.wrap(a * b);
      case ADD: return this.wrap(a + b);
      case SUB: return this.wrap(a - b);
      case DIV:
      case MOD:
        // Division by zero yields 0 for this operation and the evaluation goes on.
        if (b === 0n) { this.status = EVAL_DIV_ZERO; return 0n; }
        // BigInt division truncates toward zero and % follows the dividend, like C.
        return BigInt.asIntN(64, op === DIV ? a / b : a % b);
      case EQ: return a === b ? 1n : 0n;
      case NE: return a !== b ? 1n : 0n;
      case LT: return a < b ? 1n : 0n;
      case GT: return a > b ? 1n : 0n;
      case LE: return a <= b ? 1n : 0n;
      case GE: return a >= b ? 1n : 0n;
      case AND: return a !== 0n && b !== 0n ? 1n : 0n;
      case OR: return a !== 0n || b !== 0n ? 1n : 0n;
    }
    throw new Error('unknown operator');
  }

  // ---- grammar

  // A group: a full expression up to a ')' or the end of the text.
  group() {
    const left = this.operand();
    return this.climb(0, left, this.operator());
  }

  // Precedence climbing. `left` is the value read so far and `op` the operator
  // after it. Consumes operators that bind tighter than `minPrec` and stores the
  // operator that stopped it in this.handedBack.
  //
  // pMARS quirk: when a nested parse (started because the following operator
  // binds tighter) is ended by `==`, that operator is lost: the enclosing
  // levels see no operator and the whole group ends right after the `==`.
  // The text after it stays unconsumed, which normally ends as a syntax error
  // (missing ')' or text left over). Inside an assignment see operand().
  climb(minPrec, left, op) {
    while (op !== NONE && PREC[op] > minPrec) {
      let right = this.operand();
      let next = this.operator();
      if (next !== NONE && PREC[next] > PREC[op]) {
        right = this.climb(PREC[op], right, next);
        next = this.handedBack;
        if (next === EQ) next = NONE;
      }
      left = this.apply(op, left, right);
      op = next;
    }
    this.handedBack = op;
    return left;
  }

  // Reads a binary operator, or returns NONE at ')' or the end of the text.
  operator() {
    this.skipSpace();
    const c = this.peek();
    const c2 = this.peek(1);
    let op, len = 1;
    switch (c) {
      case '': case ')': return NONE;
      case '*': op = MUL; break;
      case '/': op = DIV; break;
      case '%': op = MOD; break;
      case '+': op = ADD; break;
      case '-': op = SUB; break;
      case '=': if (c2 !== '=') throw new SyntaxFailure(); op = EQ; len = 2; break;
      case '!': if (c2 !== '=') throw new SyntaxFailure(); op = NE; len = 2; break;
      case '<': if (c2 === '=') { op = LE; len = 2; } else op = LT; break;
      case '>': if (c2 === '=') { op = GE; len = 2; } else op = GT; break;
      case '&': if (c2 !== '&') throw new SyntaxFailure(); op = AND; len = 2; break;
      case '|': if (c2 !== '|') throw new SyntaxFailure(); op = OR; len = 2; break;
      default: throw new SyntaxFailure();
    }
    this.pos += len;
    return op;
  }

  // Operand: unary operators, a number, a register (or assignment) or a group.
  operand() {
    this.skipSpace();
    const c = this.peek();
    if (c === '-') { this.pos++; return this.wrap(-this.operand()); }
    if (c === '+') { this.pos++; return this.operand(); }
    if (c === '!') { this.pos++; return this.operand() === 0n ? 1n : 0n; }
    if (c === '(') {
      this.pos++;
      const v = this.group();
      this.skipSpace();
      if (this.peek() !== ')') throw new SyntaxFailure();
      this.pos++;
      return v;
    }
    if (isDigit(c)) return this.number();
    if (isLetter(c)) {
      const reg = (c.toLowerCase().charCodeAt(0) - 97);
      this.pos++;
      this.skipSpace();
      // `x=` (not `x==`) assigns the rest of the current group to the register.
      if (this.peek() === '=' && this.peek(1) !== '=') {
        this.pos++;
        // If the right-hand side stopped early (a lost `==`, see climb), the
        // parse resumes at the first ')' after the `=`, or the end of the text.
        let close = this.text.indexOf(')', this.pos);
        if (close < 0) close = this.text.length;
        const v = this.group();
        if (this.pos < close) this.pos = close;
        this.registers[reg] = v;
        return v;
      }
      return this.registers[reg];
    }
    throw new SyntaxFailure();
  }

  // Up to 20 digits; larger values saturate at 2^63 - 1.
  number() {
    const start = this.pos;
    while (this.pos - start < 20 && isDigit(this.peek())) this.pos++;
    const v = BigInt(this.text.slice(start, this.pos));
    return v > MAX_INT ? MAX_INT : v;
  }
}
