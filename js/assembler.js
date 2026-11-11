// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Redcode assembler (ICWS'94 dialect as accepted by pMARS).
//
// The source goes through three stages:
//   1. readSource: splits lines, joins continuations, reads ;name etc. and
//      keeps statement lines and ;assert lines.
//   2. Expander (pass 1): handles labels, EQU, FOR/ROF, CURLINE and asserts
//      and produces one statement text per instruction or pseudo-op.
//   3. StatementParser (pass 2): parses each statement text, evaluates the
//      operands and builds the instructions.

import { OPCODES, PSEUDO_OPS, MODIFIERS, MODE_SYMBOLS, OP, MOD } from './opcodes.js';
import { Evaluator, EVAL_OK, EVAL_OVERFLOW } from './expr.js';
import { DEFAULT_OPTIONS } from '../wasm/42mars.js';

export { DEFAULT_OPTIONS };
export const PMARS_VERSION = 95;

const MAX_LABELS = 7;

// ICWS'88 (`icws88`, pmars -8): the opcodes it has, each with the modes its A
// and its B operand may have (pMARS's table, found by running pmars -8 on
// every opcode and mode pair, semantics doc 2.4).
const ICWS88_MODES = new Map([
  [OP.DAT, ['#<', '#<']],
  ...[OP.MOV, OP.ADD, OP.SUB, OP.CMP].map((op) => [op, ['#$@<', '$@<']]),
  ...[OP.JMP, OP.JMZ, OP.JMN, OP.DJN, OP.SPL].map((op) => [op, ['$@<', '#$@<']]),
  [OP.SLT, ['#$@<', '#$@<']],
]);
const OPCODE_SET = new Set([...OPCODES, ...PSEUDO_OPS]);
const PSEUDO_SET = new Set(PSEUDO_OPS);

const isSpace = (c) => c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\v' || c === '\f';
const isDigit = (c) => c >= '0' && c <= '9';
const isLetter = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
const isIdentStart = (c) => isLetter(c) || c === '_';
const isIdentChar = (c) => isIdentStart(c) || isDigit(c);

// The ICWS'94 default modifier table.
export function defaultModifier(op, aMode, bMode) {
  const aImm = aMode === 0;
  const bImm = bMode === 0;
  switch (op) {
    case OP.DAT: case OP.NOP:
      return MOD.F;
    case OP.MOV: case OP.CMP: case OP.SEQ: case OP.SNE:
      return aImm ? MOD.AB : bImm ? MOD.B : MOD.I;
    case OP.ADD: case OP.SUB: case OP.MUL: case OP.DIV: case OP.MOD:
      return aImm ? MOD.AB : bImm ? MOD.B : MOD.F;
    case OP.SLT: case OP.LDP: case OP.STP:
      return aImm ? MOD.AB : MOD.B;
    default:
      return MOD.B;
  }
}

function effectiveOptions(options) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  if (!o.pSpaceSize) o.pSpaceSize = Math.floor(o.coreSize / 16);
  if (!o.readLimit) o.readLimit = o.coreSize;
  if (!o.writeLimit) o.writeLimit = o.coreSize;
  return o;
}

// FOR counters print with at least two digits: 01, 02, ..., 10, 120.
const counterText = (n) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------
// Stage 1: reading lines

// A line for pass 1 is a list of parts. Source lines have one part; EQU
// expansion splices the body text in as further parts. Each part remembers
// which EQU names it was expanded from, to detect recursion. SPACE is a
// marker part that adds one space to the statement text.
const SPACE = Object.freeze({ space: true });

class Line {
  constructor(parts, lineNo, assert = false) {
    this.parts = parts;
    this.lineNo = lineNo;
    this.assert = assert; // true for ;assert lines, parts hold the expression
  }
}

const sourceLine = (text, lineNo, assert = false) => new Line([{ text, active: null }], lineNo, assert);

const trimEnd = (s) => {
  let e = s.length;
  while (e > 0 && isSpace(s[e - 1])) e--;
  return s.slice(0, e);
};
const trimStart = (s) => {
  let b = 0;
  while (b < s.length && isSpace(s[b])) b++;
  return s.slice(b);
};

// pMARS keeps one 256-byte character buffer for reading lines and for the
// identifiers of pass 1. Each write stores a string, usually followed by a 0
// byte, and leaves older bytes behind it in place. This matters for one quirk
// only: an opcode with characters glued to it at the end of a line takes the
// old bytes after the glued text along (see Expander.opcodeLine). The model
// here is not limited to 256 bytes.
class Scratch {
  constructor() {
    this.bytes = []; // single characters; a missing entry is a 0 byte
  }

  // Stores `text` at `at`, followed by a 0 byte unless `terminate` is false.
  write(text, at = 0, terminate = true) {
    for (let i = 0; i < text.length; i++) this.bytes[at + i] = text[i];
    if (terminate) this.bytes[at + text.length] = '\0';
  }

  // The string at the start of the buffer, up to the first 0 byte.
  string() {
    let out = '';
    for (let i = 0; this.bytes[i] !== undefined && this.bytes[i] !== '\0'; i++) out += this.bytes[i];
    return out;
  }
}

function readSource(source, meta, scratch) {
  // A physical line ends with LF. A final LF does not start another line.
  const physical = source.split('\n');
  const last = physical.length - 1;
  if (last > 0 && physical[last] === '') physical.pop();

  // Reads physical line i into the scratch buffer at `at`, the way pMARS
  // does, and returns its content: the text up to the first CR or LF. Text
  // after a lone CR is ignored.
  const readPhysical = (i, at) => {
    const raw = i < last ? `${physical[i]}\n` : physical[i];
    let end = raw.search(/[\r\n]/);
    if (end < 0) end = raw.length;
    scratch.write(raw, at);
    scratch.write('', at + end); // the CR or LF that ends the content becomes 0
    return raw.slice(0, end);
  };

  let lines = [];
  let redcodeCount = 0;
  let i = 0;
  while (i < physical.length) {
    const lineNo = i + 1;
    let text = readPhysical(i++, 0);
    // A trailing backslash joins the next physical line, unless the logical
    // line already contains a comment. The next line is read over the `\`.
    while (text.endsWith('\\') && !text.includes(';') && i < physical.length) {
      text = text.slice(0, -1);
      text += readPhysical(i++, text.length);
    }

    const body = trimStart(text);
    if (body === '') continue;
    if (body[0] !== ';') {
      const semi = body.indexOf(';');
      lines.push(sourceLine(semi < 0 ? body : body.slice(0, semi), lineNo));
      continue;
    }

    // Comment line: look at the word after the ';'.
    const m = /^;([ \t\v\f]*)([A-Za-z_][A-Za-z0-9_]*)?/.exec(body);
    const word = (m[2] ?? '').toLowerCase();
    const rest = body.slice(m[0].length);
    if (word === 'redcode' && m[1] === '') {
      // The first ;redcode starts the warrior, the second one ends it and
      // stops reading the source.
      if (++redcodeCount === 2) return lines;
      lines = [];
      continue;
    }
    // pMARS keeps trailing whitespace in the metadata values.
    const value = trimStart(rest);
    switch (word) {
      case 'name': meta.name = value || 'Unknown'; break;
      case 'author': meta.author = value || 'Anonymous'; break;
      case 'date': meta.date = value; break;
      case 'version': meta.version = value; break;
      case 'strategy': meta.strategy.push(trimEnd(value)); break;
      case 'assert': {
        const semi = rest.indexOf(';');
        lines.push(sourceLine(semi < 0 ? rest : rest.slice(0, semi), lineNo, true));
        break;
      }
      default: break;
    }
  }
  // At the end of the file, the failed read clears the first byte.
  scratch.write('', 0);
  return lines;
}

// ---------------------------------------------------------------------------
// Stage 2: pass 1, expansion

// Reads tokens from the parts of one line.
class Cursor {
  constructor(line, expander) {
    this.parts = line.parts;
    this.lineNo = line.lineNo;
    this.pi = 0;
    this.pos = 0;
    this.expander = expander;
    this.quiet = false;
  }

  get part() {
    return this.parts[this.pi];
  }

  // Next character of the current part, '' at its end.
  peekChar() {
    const p = this.part;
    return p && p !== SPACE ? p.text[this.pos] ?? '' : '';
  }

  nextIsSpace() {
    return isSpace(this.peekChar());
  }

  // Returns the next token:
  //   { t: 'end' } | { t: 'space' } (a SPACE marker part)
  //   { t: 'ident', name, active, spaceAfter } | { t: 'num', text }
  //   { t: 'char', text } (operators, modes, punctuation, anything else)
  next() {
    for (;;) {
      const p = this.part;
      if (!p) return { t: 'end' };
      if (p === SPACE) { this.pi++; this.pos = 0; return { t: 'space' }; }
      const s = p.text;
      if (this.pos >= s.length) { this.pi++; this.pos = 0; continue; }
      const c = s[this.pos];
      if (isSpace(c)) { this.pos++; continue; }
      if (isIdentStart(c)) return this.identifier(p);
      const start = this.pos++;
      if (isDigit(c)) {
        while (isDigit(s[this.pos] ?? '')) this.pos++;
        return { t: 'num', text: s.slice(start, this.pos) };
      }
      if ((c === '&' || c === '|') && s[this.pos] === c) this.pos++;
      return { t: 'char', text: s.slice(start, this.pos) };
    }
  }

  // An identifier, with `name&counter` concatenations resolved. Each
  // identifier read goes into the scratch buffer, uppercased; the name after
  // `&` as written, then the counter text. A name after `&` that is not a FOR
  // counter is an error; like pMARS, reading goes on with the name so far and
  // skips further `&` parts.
  identifier(p) {
    const s = p.text;
    // A look-ahead cursor (quiet) leaves the buffer alone.
    const store = (text) => { if (!this.quiet) this.expander.scratch.write(text); };
    let start = this.pos;
    while (isIdentChar(s[this.pos] ?? '')) this.pos++;
    let name = s.slice(start, this.pos);
    store(name.toUpperCase());
    let failed = false;
    while (s[this.pos] === '&' && isLetter(s[this.pos + 1] ?? '')) {
      start = ++this.pos;
      while (isIdentChar(s[this.pos] ?? '')) this.pos++;
      if (failed) continue;
      const counter = s.slice(start, this.pos);
      store(counter);
      const def = this.expander.lookup(counter);
      if (!def || def.kind !== 'for') {
        if (!this.quiet) this.expander.msg.error(this.lineNo, `'${counter}' after '&' is not a FOR counter`);
        failed = true;
        continue;
      }
      store(counterText(def.value));
      name += counterText(def.value);
    }
    return { t: 'ident', name, active: p.active, spaceAfter: isSpace(s[this.pos] ?? '') };
  }

  // Non-whitespace characters glued to the current position (after an opcode).
  readGlued() {
    const p = this.part;
    if (!p || p === SPACE) return '';
    const start = this.pos;
    while (this.pos < p.text.length && !isSpace(p.text[this.pos])) this.pos++;
    return p.text.slice(start, this.pos);
  }

  // The raw rest of the line, consumed.
  restRaw() {
    let out = '';
    for (; this.pi < this.parts.length; this.pi++, this.pos = 0) {
      const p = this.parts[this.pi];
      out += p === SPACE ? ' ' : p.text.slice(this.pos);
    }
    return out;
  }

  // The parts after the current position, consumed.
  takeRest() {
    const p = this.part;
    const rest = [];
    if (p) rest.push(p === SPACE ? SPACE : { text: p.text.slice(this.pos), active: p.active });
    rest.push(...this.parts.slice(this.pi + 1));
    this.parts = [];
    this.pi = 0;
    this.pos = 0;
    return rest;
  }

  // Continues reading with `parts` before the rest of the line.
  insert(parts) {
    this.parts = [...parts, ...this.takeRest()];
  }

  // Ends the line after `parts`.
  replaceRest(parts) {
    this.takeRest();
    this.parts = parts;
  }
}

// Source of lines for pass 1; EQU expansion and FOR blocks feed lines back.
class LineStream {
  constructor(lines) {
    this.lines = lines;
    this.i = 0;
    this.front = [];
  }

  next() {
    return this.front.length ? this.front.shift() : this.lines[this.i++];
  }

  peek() {
    return this.front.length ? this.front[0] : this.lines[this.i];
  }

  unshift(lines) {
    this.front.unshift(...lines);
  }
}

// Skip scan used to find the ROF that matches a FOR: +1 for a line that opens
// a FOR block, -1 for a ROF line, 0 otherwise. Plain identifiers (labels) at
// the start are passed over; the first keyword or other token decides.
// While a block is skipped (count <= 0), pass `expander`: the identifiers read
// then go into the scratch buffer as usual.
function blockDelta(line, expander = null) {
  if (line.assert) return 0;
  const text = line.parts.map((p) => (p === SPACE ? ' ' : p.text)).join('');
  const re = /[ \t\r\n\v\f]*([A-Za-z_][A-Za-z0-9_]*(?:&[A-Za-z][A-Za-z0-9_]*)*)?/y;
  for (;;) {
    const m = re.exec(text);
    if (!m[1]) return 0;
    if (expander) {
      const [first, ...counters] = m[1].split('&');
      expander.scratch.write(first.toUpperCase());
      for (const name of counters) {
        expander.scratch.write(name);
        const def = expander.lookup(name);
        if (def?.kind === 'for') expander.scratch.write(counterText(def.value));
      }
    }
    const upper = m[1].toUpperCase();
    if (upper === 'FOR') return 1;
    if (upper === 'ROF') return -1;
    if (OPCODE_SET.has(upper) || upper === 'EQU' || m[1] === 'CURLINE') return 0;
  }
}

class Expander {
  constructor(options, evaluator, messages, scratch) {
    this.evaluator = evaluator;
    this.msg = messages;
    this.scratch = scratch;
    this.symbols = new Map(); // name -> stack of definitions, the newest last
    this.pending = []; // labels waiting for a statement
    this.ic = 0; // instruction counter
    this.statements = []; // { text, line, pseudo }
    this.stopped = false; // END seen or FOR without ROF
    this.hasAssert = false;
    const predefined = {
      CORESIZE: options.coreSize, MAXPROCESSES: options.maxProcesses, MAXCYCLES: options.maxCycles,
      MAXLENGTH: options.maxLength, MINDISTANCE: options.minDistance, VERSION: PMARS_VERSION,
      WARRIORS: options.warriors, ROUNDS: options.rounds, READLIMIT: options.readLimit,
      WRITELIMIT: options.writeLimit, PSPACESIZE: options.pSpaceSize,
    };
    for (const [name, value] of Object.entries(predefined)) {
      this.define(name, { kind: 'equ', body: [{ text: String(value), lineNo: null }] });
    }
  }

  lookup(name) {
    const defs = this.symbols.get(name);
    return defs ? defs[defs.length - 1] : undefined;
  }

  define(name, def) {
    const defs = this.symbols.get(name);
    if (defs) defs.push(def); else this.symbols.set(name, [def]);
  }

  undefine(name) {
    const defs = this.symbols.get(name);
    defs.pop();
    if (!defs.length) this.symbols.delete(name);
  }

  run(lines) {
    this.processLines(new LineStream(lines));
    if (this.pending.length) this.msg.warning(null, `labels discarded: ${this.pending.join(', ')}`);
    if (!this.hasAssert) this.msg.warning(null, 'missing ;assert');
  }

  processLines(stream) {
    while (!this.stopped) {
      const line = stream.next();
      if (!line) return;
      if (line.assert) this.assertLine(line, stream);
      else this.statementLine(line, stream);
    }
  }

  // Label position: labels, then an opcode, EQU, FOR, ROF or an EQU name.
  statementLine(line, stream) {
    const cur = new Cursor(line, this);
    for (;;) {
      const tok = cur.next();
      if (tok.t === 'end') return; // only labels: they stay pending
      if (tok.t === 'space') continue;
      if (tok.t !== 'ident') {
        this.msg.error(cur.lineNo, `unexpected '${tok.text}'`);
        // An error inside an EQU body abandons only the body; the rest of the
        // use-site line is still read.
        if (!cur.part?.active) return;
        cur.pos = cur.part.text.length;
        continue;
      }

      const upper = tok.name.toUpperCase();
      if (OPCODE_SET.has(upper)) { this.opcodeLine(cur, upper, stream); return; }
      if (upper === 'EQU') { this.equLine(cur, stream); return; }
      if (upper === 'FOR') { this.forLine(cur, stream); return; }
      if (upper === 'ROF') { this.msg.error(cur.lineNo, 'ROF without FOR'); return; }
      if (tok.name === 'CURLINE') { this.msg.error(cur.lineNo, 'CURLINE cannot be a label'); return; }

      const def = this.lookup(tok.name);
      if (def?.kind === 'equ') {
        if (!this.expand(cur, tok, def, stream)) return;
        continue;
      }
      if (def) {
        // pMARS drops the whole line of a redefined label.
        this.msg.warning(cur.lineNo, `label '${tok.name}' redefined, line ignored`);
        return;
      }
      if (this.pending.length >= MAX_LABELS) this.msg.error(cur.lineNo, `too many labels at '${tok.name}'`);
      else this.pending.push(tok.name);
      if (cur.peekChar() === ':') cur.pos++;
    }
  }

  // Substitutes an EQU body at the cursor. A multi-line body ends the current
  // line after its first line; the other lines follow as lines of their own,
  // the last one continued by the rest of the use-site line.
  expand(cur, tok, def, stream) {
    if (tok.active?.has(tok.name)) {
      this.msg.error(cur.lineNo, `recursive EQU '${tok.name}'`);
      return false;
    }
    const active = new Set(tok.active ?? []).add(tok.name);
    const body = def.body;
    const space = tok.spaceAfter ? [SPACE] : [];
    if (body.length === 1) {
      cur.insert([{ text: body[0].text, active }, ...space]);
      return true;
    }
    const useSite = cur.lineNo;
    const rest = cur.takeRest();
    cur.replaceRest([{ text: body[0].text, active }]);
    cur.lineNo = body[0].lineNo;
    const more = [];
    for (let i = 1; i < body.length - 1; i++) more.push(new Line([{ text: body[i].text, active }], body[i].lineNo));
    more.push(new Line([{ text: body[body.length - 1].text, active }, ...space, ...rest], useSite));
    stream.unshift(more);
    return true;
  }

  // Builds the operand text after an opcode, FOR or in an assert. Labels
  // become numbers relative to the instruction counter (absolute for ORG, END
  // and PIN), FOR counters their iteration number, EQU names their body.
  // Returns null after an error.
  operandText(cur, stream, absolute) {
    let out = '';
    for (;;) {
      const tok = cur.next();
      switch (tok.t) {
        case 'end': return out;
        case 'space': out += ' '; continue;
        case 'num': case 'char': out += tok.text; continue;
        default: break;
      }
      const upper = tok.name.toUpperCase();
      if (upper === 'FOR' || upper === 'ROF' || upper === 'EQU') {
        this.msg.error(cur.lineNo, `${upper} not allowed here`);
        return null;
      }
      const def = this.lookup(tok.name);
      let number = null;
      if (tok.name === 'CURLINE') number = String(this.ic);
      else if (def?.kind === 'equ') {
        if (!this.expand(cur, tok, def, stream)) return null;
        continue;
      } else if (def?.kind === 'label') number = String(absolute ? def.value : def.value - this.ic);
      else if (def?.kind === 'for') number = counterText(def.value);
      const space = tok.spaceAfter ? ' ' : '';
      if (number === null) out += tok.name + space; // forward reference or register, resolved in pass 2
      else {
        // The replacement text goes through the scratch buffer too.
        this.scratch.write(number + space);
        out += number + space;
      }
    }
  }

  opcodeLine(cur, upper, stream) {
    const pseudo = PSEUDO_SET.has(upper);
    // The opcode is in the scratch buffer (identifiers go there). Characters
    // glued to it are stored right behind it, followed by a space and a 0
    // byte if whitespace follows, else by nothing. The opcode text is read
    // back up to the first 0 byte. So glued text at the end of a line picks up
    // older buffer content: pMARS reads `dat#9` on the last line of a file as
    // `DAT#99`.
    const glued = cur.readGlued();
    this.scratch.write(glued, upper.length, false);
    if (cur.nextIsSpace()) this.scratch.write(' ', upper.length + glued.length);
    const text = this.scratch.string();
    const operands = this.operandText(cur, stream, pseudo);
    if (operands === null) return;
    for (const name of this.pending) this.define(name, { kind: 'label', value: this.ic });
    this.pending = [];
    this.statements.push({ text: text + operands, line: cur.lineNo, pseudo });
    if (!pseudo) this.ic++;
    if (upper === 'END') this.stopped = true;
  }

  equLine(cur, stream) {
    if (!this.pending.length) {
      this.msg.warning(cur.lineNo, 'EQU without label, line ignored');
      return;
    }
    const body = [{ text: cur.restRaw(), lineNo: cur.lineNo }];
    // Directly following `EQU text` lines add more body lines.
    for (let next = stream.peek(); next && !next.assert; next = stream.peek()) {
      const c = new Cursor(next, this);
      c.quiet = true;
      const tok = c.next();
      if (tok.t !== 'ident' || tok.name.toUpperCase() !== 'EQU') break;
      stream.next();
      body.push({ text: c.restRaw(), lineNo: next.lineNo });
    }
    for (const name of this.pending) this.define(name, { kind: 'equ', body });
    this.pending = [];
  }

  forLine(cur, stream) {
    // The label written directly before FOR names the counter.
    const counter = this.pending.length ? this.pending.pop() : null;
    for (const name of this.pending) this.define(name, { kind: 'label', value: this.ic });
    this.pending = [];

    const text = this.operandText(cur, stream, false);
    if (text === null) return;
    const r = this.evaluator.evaluate(text);
    if (r.status < 0) {
      this.msg.error(cur.lineNo, `bad FOR count '${text.trim()}'`);
      return;
    }

    // Collect the block up to the matching ROF.
    let times = r.value > 0n ? Number(r.value % 65536n) : 0;
    const body = [];
    let found = false;
    for (let depth = 1, line = stream.next(); line; line = stream.next()) {
      depth += blockDelta(line, times === 0 ? this : null);
      if (depth === 0) { found = true; break; }
      body.push(line);
    }
    if (!found) {
      this.msg.warning(cur.lineNo, 'FOR without matching ROF');
      times = Math.min(times, 1);
    }
    for (let k = 1; k <= times && !this.stopped; k++) {
      if (counter !== null) this.define(counter, { kind: 'for', value: k });
      this.processLines(new LineStream(body));
      if (counter !== null) this.undefine(counter);
    }
    if (!found) this.stopped = true;
  }

  assertLine(line, stream) {
    const cur = new Cursor(line, this);
    const text = this.operandText(cur, stream, false);
    if (text === null) return;
    const r = this.evaluator.evaluate(text);
    if (r.status < 0) {
      this.msg.warning(line.lineNo, `invalid assert '${text.trim()}'`);
      return;
    }
    this.hasAssert = true;
    if (r.value === 0n) this.msg.error(line.lineNo, `assertion failed: ${text.trim()}`);
    else if (r.status === EVAL_OVERFLOW) this.msg.warning(line.lineNo, 'overflow in assert');
  }
}

// ---------------------------------------------------------------------------
// Stage 3: pass 2, parsing statements

// Tokens of a statement text. Identifiers that are EQU names (defined after
// their use, so pass 1 left them) are replaced by the first body line.
class StatementTokens {
  constructor(text, symbols) {
    this.symbols = symbols;
    this.stack = [{ text, pos: 0, active: new Set() }];
    this.peeked = null;
    this.raw = false; // true while reading the opcode and modifier: no EQU expansion
  }

  peek() {
    if (!this.peeked) this.peeked = this.read();
    return this.peeked;
  }

  next() {
    const t = this.peek();
    this.peeked = null;
    return t;
  }

  // { t: 'end' | 'ident' | 'num' | 'char' | 'error', text, space }; `space`
  // tells whether whitespace came before the token.
  read() {
    let space = false;
    for (;;) {
      const top = this.stack[this.stack.length - 1];
      if (!top) return { t: 'end', text: '', space };
      const s = top.text;
      if (top.pos >= s.length) { this.stack.pop(); continue; }
      const c = s[top.pos];
      if (isSpace(c)) { top.pos++; space = true; continue; }
      const start = top.pos++;
      if (isIdentStart(c)) {
        while (isIdentChar(s[top.pos] ?? '')) top.pos++;
        const name = s.slice(start, top.pos);
        const def = this.symbols.lookup(name);
        if (def?.kind === 'equ' && !this.raw) {
          if (top.active.has(name)) return { t: 'error', text: `recursive EQU '${name}'`, space };
          this.stack.push({ text: def.body[0].text, pos: 0, active: new Set(top.active).add(name) });
          // Like a label value, the body stays apart from the text before it.
          space = true;
          continue;
        }
        return { t: 'ident', text: name, space, def };
      }
      if (isDigit(c)) {
        while (isDigit(s[top.pos] ?? '')) top.pos++;
        return { t: 'num', text: s.slice(start, top.pos), space };
      }
      if ((c === '&' || c === '|') && s[top.pos] === c) top.pos++;
      return { t: 'char', text: s.slice(start, top.pos), space };
    }
  }
}

class StatementParser {
  constructor(options, evaluator, symbols, messages) {
    this.coreSize = options.coreSize;
    this.icws88 = Boolean(options.icws88);
    this.evaluator = evaluator;
    this.symbols = symbols;
    this.msg = messages;
    this.ic = 0;
    this.start = 0;
    this.pin = null;
    this.instructions = [];
  }

  // Parses one operand: [mode] expression. Returns { mode, expr } where expr
  // is the expression text or null for a mode-only A operand, or null after an
  // error.
  operand(ts, isA, absolute, line) {
    let t = ts.peek();
    if (t.t === 'end' || t.text === ',') {
      this.msg.error(line, t.t === 'end' ? 'missing operand' : "unexpected ','");
      return null;
    }
    let mode = 1; // $
    if (t.t === 'char' && t.text.length === 1 && MODE_SYMBOLS.includes(t.text)) {
      ts.next();
      mode = MODE_SYMBOLS.indexOf(t.text);
      t = ts.peek();
      if (t.t === 'end') { this.msg.error(line, 'missing expression after mode'); return null; }
      if (t.text === ',') {
        if (isA) return { mode, expr: null };
        this.msg.error(line, "unexpected ','");
        return null;
      }
    }
    const expr = this.expression(ts, absolute, line, isA);
    return expr === null ? null : { mode, expr };
  }

  // Expression text up to ',' (A operand) or the end. Labels become numbers.
  expression(ts, absolute, line, stopAtComma) {
    let out = '';
    for (;;) {
      const t = ts.peek();
      if (t.t === 'end') return out;
      if (t.text === ',') {
        if (stopAtComma) return out;
        this.msg.error(line, 'too many operands');
        return null;
      }
      ts.next();
      if (t.t === 'error') { this.msg.error(line, t.text); return null; }
      if (out && t.space) out += ' ';
      if (t.t === 'char' && '#$@{}.'.includes(t.text)) {
        this.msg.error(line, `unexpected '${t.text}' in expression`);
        return null;
      }
      if (t.t !== 'ident') { out += t.text; continue; }
      if (t.def?.kind === 'label') {
        // pMARS keeps a label value apart from the text before it: `2x` with
        // x = 1 is the bad expression `2 1`, not 21.
        if (out && !t.space) out += ' ';
        out += absolute ? t.def.value : t.def.value - this.ic;
      }
      else if (!t.def && t.text.length === 1) out += t.text; // register
      else { this.msg.error(line, `undefined symbol '${t.text}'`); return null; }
    }
  }

  // Evaluates an expression; returns the BigInt value or null.
  evaluate(text, line) {
    const r = this.evaluator.evaluate(text);
    if (r.status < 0) {
      this.msg.error(line, r.status === -2 ? `division by zero in '${text}'` : `bad expression '${text}'`);
      return null;
    }
    if (r.status === EVAL_OVERFLOW) this.msg.warning(line, `overflow in '${text}'`);
    return r.value;
  }

  normalize(v) {
    const n = BigInt(this.coreSize);
    return Number(((v % n) + n) % n);
  }

  parse(stmt) {
    const { line } = stmt;
    const ts = new StatementTokens(stmt.text, this.symbols);
    ts.raw = true;
    const opName = ts.next().text.toUpperCase();
    ts.raw = false;
    let mod = null;
    if (ts.peek().text === '.') {
      ts.next();
      ts.raw = true;
      const m = ts.next();
      ts.raw = false;
      mod = m.t === 'ident' ? MODIFIERS.indexOf(m.text.toUpperCase()) : -1;
      if (mod < 0) { this.msg.error(line, `bad modifier '${m.text}'`); return; }
      if (this.icws88) { this.msg.error(line, "ICWS'88 has no modifiers"); return; }
    }
    if (this.icws88 && (opName === 'ORG' || opName === 'PIN')) { this.msg.error(line, `ICWS'88 has no ${opName}`); return; }

    if (PSEUDO_SET.has(opName)) {
      if (mod !== null) { this.msg.error(line, `${opName} takes no modifier`); return; }
      if (opName !== 'END' && ts.peek().t === 'end') { this.msg.error(line, `${opName} needs an operand`); return; }
      const expr = this.expression(ts, true, line, false);
      if (expr === null || this.msg.failed || expr === '') return;
      const v = this.evaluate(expr, line);
      if (v === null) return;
      if (opName === 'ORG') this.start = this.normalize(v);
      else if (opName === 'PIN') this.pin = Number(v);
      else if (v !== 0n) {
        if (this.start !== 0) this.msg.warning(line, 'END start ignored, ORG already set it');
        else this.start = this.normalize(v);
      }
      return;
    }

    this.instruction(ts, OP[opName], mod, line);
    this.ic++;
  }

  instruction(ts, op, mod, line) {
    let a = this.operand(ts, true, false, line);
    if (a === null) return;
    let b;
    if (ts.peek().text === ',') {
      ts.next();
      b = this.operand(ts, false, false, line);
      if (b === null) return;
    } else if (op === OP.DAT) {
      // A single DAT operand is the B operand, A becomes #0.
      b = a;
      a = { mode: 0, expr: null };
    } else if (op === OP.JMP || op === OP.SPL || op === OP.NOP) {
      b = { mode: 1, expr: null };
    } else {
      this.msg.error(line, 'missing operand');
      return;
    }
    this.finish(op, mod, a, b, line);
  }

  finish(op, mod, a, b, line) {
    if (this.msg.failed) return;
    if (this.icws88) {
      const modes = ICWS88_MODES.get(op);
      if (!modes) { this.msg.error(line, `ICWS'88 has no ${OPCODES[op]}`); return; }
      if (!modes[0].includes(MODE_SYMBOLS[a.mode]) || !modes[1].includes(MODE_SYMBOLS[b.mode])) {
        this.msg.error(line, `ICWS'88: ${OPCODES[op]} takes [${modes[0]}] [${modes[1]}]`);
        return;
      }
    }
    let aVal = 0n;
    let bVal = 0n;
    if (a.expr !== null) {
      aVal = this.evaluate(a.expr, line);
      if (aVal === null) return;
    }
    if (b.expr !== null) {
      bVal = this.evaluate(b.expr, line);
      if (bVal === null) return;
    }
    this.instructions.push({
      op,
      mod: mod ?? defaultModifier(op, a.mode, b.mode),
      aMode: a.mode,
      aVal: this.normalize(aVal),
      bMode: b.mode,
      bVal: this.normalize(bVal),
      line,
    });
  }
}

// ---------------------------------------------------------------------------

class Messages {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  get failed() {
    return this.errors.length > 0;
  }

  error(line, text) {
    this.errors.push({ severity: 'error', line, text });
  }

  warning(line, text) {
    this.warnings.push({ severity: 'warning', line, text });
  }
}

export function assemble(source, options = {}) {
  const opts = effectiveOptions(options);
  const meta = { name: 'Unknown', author: 'Anonymous', date: '', version: '', strategy: [] };
  const msg = new Messages();
  const evaluator = new Evaluator();

  const scratch = new Scratch();
  const lines = readSource(source, meta, scratch);
  const expander = new Expander(opts, evaluator, msg, scratch);
  expander.run(lines);

  const parser = new StatementParser(opts, evaluator, expander, msg);
  // pMARS accepts a warrior without instructions with a warning. It skips
  // pass 2 then, so ORG, END and PIN statements are not even checked.
  if (expander.ic === 0) msg.warning(null, 'no instructions');
  else for (const stmt of expander.statements) parser.parse(stmt);

  if (expander.ic > opts.maxLength) msg.error(null, `too many instructions (${expander.ic}, limit ${opts.maxLength})`);
  const ok = !msg.failed;
  if (ok && expander.ic > 0 && (parser.start < 0 || parser.start >= parser.instructions.length)) {
    msg.warning(null, `start ${parser.start} is outside the warrior`);
  }

  return {
    ok,
    name: meta.name,
    author: meta.author,
    date: meta.date,
    version: meta.version,
    strategy: meta.strategy.join('\n'),
    instructions: ok ? parser.instructions : [],
    start: parser.start,
    pin: parser.pin,
    errors: msg.errors,
    warnings: msg.warnings,
    expanded: expander.statements.map((s) => s.text),
    options: opts,
  };
}
