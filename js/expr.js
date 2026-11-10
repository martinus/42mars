// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Expression evaluator for Redcode operands, FOR counts and ;assert lines.
// Signed 64-bit arithmetic on BigInt, 26 single-letter registers.
//
// The parser reproduces the evaluation order of pMARS, including its defects:
// an operator that ends a nested higher-precedence part is handed back to the
// enclosing level through one variable shared by all levels (`saved`), and a
// handed-back `==` is dropped. See docs/redcode-semantics.md, section 1.

export const EVAL_OK = 0;
export const EVAL_OVERFLOW = 1; // result valid, but 64-bit overflow happened
export const EVAL_BAD = -1; // syntax error
export const EVAL_DIV_ZERO = -2; // division or modulo by zero

const MAX_INT = (1n << 63n) - 1n;

// Operators. IDENTITY is the pending operator in front of the first operand of
// an expression: it yields its right operand. BAD_OP stands for a character
// that is not an operator where one is expected.
const NONE = -1;
const IDENTITY = 0;
const MUL = 1, DIV = 2, MOD = 3, ADD = 4, SUB = 5;
const EQ = 6, NE = 7, LT = 8, GT = 9, LE = 10, GE = 11, AND = 12, OR = 13;
const BAD_OP = 14;
// Precedence, higher binds tighter.
const PREC = [0, 5, 5, 5, 4, 4, 3, 3, 3, 3, 3, 3, 2, 1, 0];

const isSpace = (c) => c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\v' || c === '\f';
const isDigit = (c) => c >= '0' && c <= '9';
const isLetter = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

export class Evaluator {
  constructor() {
    this.registers = new Array(26).fill(0n);
    this.text = '';
    this.pos = 0;
    this.status = EVAL_OK;
    this.saved = NONE;
  }

  resetRegisters() {
    this.registers.fill(0n);
  }

  evaluate(text) {
    this.text = text;
    this.pos = 0;
    this.status = EVAL_OK;
    const value = this.expression(-1, 0n, IDENTITY);
    if (this.pos < this.text.length) this.status = EVAL_BAD;
    return { status: this.status, value };
  }

  // ---- scanning helpers

  skipSpace() {
    while (this.pos < this.text.length && isSpace(this.text[this.pos])) this.pos++;
  }

  peek(offset = 0) {
    return this.text[this.pos + offset] ?? '';
  }

  // ---- arithmetic with status tracking

  // An error status (bad expression, division by zero) replaces any status,
  // overflow is only recorded while the status is still OK. So once an error
  // happened, the evaluation can never succeed.
  fail(status) {
    this.status = status;
    return 0n;
  }

  wrap(x) {
    const w = BigInt.asIntN(64, x);
    if (w !== x && this.status === EVAL_OK) this.status = EVAL_OVERFLOW;
    return w;
  }

  apply(op, a, b) {
    switch (op) {
      case IDENTITY: return b;
      case MUL: return this.wrap(a * b);
      case ADD: return this.wrap(a + b);
      case SUB: return this.wrap(a - b);
      case DIV:
      case MOD:
        // Division by zero yields 0 for this operation and the evaluation goes on.
        if (b === 0n) return this.fail(EVAL_DIV_ZERO);
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
      default: return this.fail(EVAL_BAD);
    }
  }

  // ---- grammar

  // Continues an expression whose left value is `acc` and whose pending
  // operator is `op1`: reads the next operand and the operator after it, and
  // returns the value when the text ends, at ')' or at an operator that binds
  // no tighter than `minPrec`. That operator is handed back in this.saved.
  //
  // pMARS quirks, kept on purpose:
  // - this.saved is one variable for all levels, and every call (also the ones
  //   for parentheses and register assignments inside the operand) clears it.
  //   After a nested call, the value left by the last call anywhere below
  //   decides how this level continues.
  // - A handed-back `==` is dropped: the level returns without consuming
  //   more text, which normally ends as a bad expression.
  expression(minPrec, acc, op1) {
    this.saved = NONE;
    const v = this.operand();
    this.skipSpace();
    if (this.pos >= this.text.length || this.peek() === ')') return this.apply(op1, acc, v);
    const op2 = this.operator();
    if (PREC[op1] >= PREC[op2]) {
      // op2 does not bind tighter: finish op1 first.
      if (PREC[op2] > minPrec) return this.expression(minPrec, this.apply(op1, acc, v), op2);
      this.saved = op2;
      return this.apply(op1, acc, v);
    }
    // op2 binds tighter: its part becomes the right operand of op1.
    const right = this.expression(PREC[op1], v, op2);
    const result = this.apply(op1, acc, right);
    const saved = this.saved;
    if (saved !== NONE && saved !== EQ && PREC[saved] >= minPrec) return this.expression(minPrec, result, saved);
    return result;
  }

  // Reads a binary operator. A character that is no operator gives BAD_OP and
  // is consumed.
  operator() {
    const c = this.peek();
    const c2 = this.peek(1);
    const two = (op) => { this.pos += 2; return op; };
    const one = (op) => { this.pos += 1; return op; };
    switch (c) {
      case '*': return one(MUL);
      case '/': return one(DIV);
      case '%': return one(MOD);
      case '+': return one(ADD);
      case '-': return one(SUB);
      case '<': return c2 === '=' ? two(LE) : one(LT);
      case '>': return c2 === '=' ? two(GE) : one(GT);
      case '=': if (c2 === '=') return two(EQ); break;
      case '!': if (c2 === '=') return two(NE); break;
      case '&': if (c2 === '&') return two(AND); break;
      case '|': if (c2 === '|') return two(OR); break;
      default: break;
    }
    return one(BAD_OP);
  }

  // Operand: unary operators, a number, a register (or assignment) or a
  // parenthesized expression.
  operand() {
    this.skipSpace();
    const c = this.peek();
    if (c === '(') {
      this.pos++;
      const v = this.expression(-1, 0n, IDENTITY);
      if (this.peek() !== ')') this.fail(EVAL_BAD);
      this.pos++;
      return v;
    }
    // Unary minus wraps without setting the overflow status.
    if (c === '-') { this.pos++; return BigInt.asIntN(64, -this.operand()); }
    if (c === '!') { this.pos++; return this.operand() === 0n ? 1n : 0n; }
    if (c === '+') { this.pos++; return this.operand(); }
    if (isLetter(c)) {
      const reg = c.toLowerCase().charCodeAt(0) - 97;
      this.pos++;
      this.skipSpace();
      // `x=` (not `x==`) assigns a whole new expression, up to the end of the
      // text or the next unmatched ')', to the register.
      if (this.peek() === '=' && this.peek(1) !== '=') {
        this.pos++;
        const v = this.expression(-1, 0n, IDENTITY);
        this.registers[reg] = v;
        return v;
      }
      return this.registers[reg];
    }
    if (isDigit(c)) return this.number();
    return this.fail(EVAL_BAD);
  }

  // Up to 20 digits; larger values saturate at 2^63 - 1.
  number() {
    const start = this.pos;
    while (this.pos - start < 20 && isDigit(this.peek())) this.pos++;
    const v = BigInt(this.text.slice(start, this.pos));
    return v > MAX_INT ? MAX_INT : v;
  }
}
