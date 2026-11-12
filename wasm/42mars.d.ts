// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Types of wasm/42mars.js, the JS interface of the WebAssembly build of
// lib/42mars.h. Kept by hand: change it together with 42mars.js.

/** Rules and match settings; names as in the visualizer, pMARS options in parentheses. */
export interface Options {
  /** Core size, 1 to 65536 (-s). Default 8000. */
  coreSize?: number;
  /** Processes per warrior, up to 2^24 (-p). Default 8000. */
  maxProcesses?: number;
  /** Cycles until a tie (-c). Default 80000. */
  maxCycles?: number;
  /** Instructions per warrior (-l). Default 100. */
  maxLength?: number;
  /** Minimum distance between warriors (-d). Default 100. */
  minDistance?: number;
  /** Rounds of runMatch() without its own `rounds` (-r). Default 1. */
  rounds?: number;
  /** Number of warriors, as the assembler sees it (WARRIORS). Default 2. */
  warriors?: number;
  /** P-space cells (-S); 0 means coreSize / 16. */
  pSpaceSize?: number;
  /** Read limit (-R), a divisor of coreSize; 0 means coreSize. */
  readLimit?: number;
  /** Write limit (-W), a divisor of coreSize; 0 means coreSize. */
  writeLimit?: number;
  /** Assembler: ICWS'88 only (pmars -8): its opcodes and modes, no modifiers, ORG or PIN; the listing in its form. */
  icws88?: boolean;
}

/** The rules of pMARS 0.9.5 without options (ICWS'94). */
export const DEFAULT_OPTIONS: Readonly<Required<Options>>;

/** Park-Miller minimal standard generator, the one pMARS places warriors with. */
export function rng(seed: number): number;

/** One instruction: op and mod are the indices of OPCODES and MODIFIERS, modes 0..7 are # $ @ < > * { }. */
export interface Instruction {
  op: number;
  mod: number;
  aMode: number;
  aVal: number;
  bMode: number;
  bVal: number;
  /** Source line, 1-based. */
  line: number;
}

export interface Message {
  severity: 'error' | 'warning';
  /** Source line, 1-based, or null for the whole warrior. */
  line: number | null;
  text: string;
}

/** The result of assemble(). */
export interface Warrior {
  /** True when there were no errors: only then can the warrior be loaded. */
  ok: boolean;
  name: string;
  author: string;
  date: string;
  version: string;
  strategy: string;
  instructions: Instruction[];
  /** Offset of the first instruction to run (ORG, END). */
  start: number;
  /** Characters of the source the assembler read: up to the start of a second ;redcode line, else all. The next warrior of a stream starts there (pMARS reads several warriors from stdin). */
  sourceEnd: number;
  /** PIN, or null without one. */
  pin: number | null;
  errors: Message[];
  warnings: Message[];
  /** The statements after EQU and FOR expansion, as pMARS lists them. */
  expanded: string[];
  /** The options it was assembled with, defaults filled in. */
  options: Required<Options>;
}

/** A warrior from packWarrior(): 5 integers per instruction. */
export interface PackedWarrior {
  ok: boolean;
  name: string;
  author: string;
  start: number;
  pin: number | null;
  /** Per instruction: op << 3 | mod, A mode, A value, B mode, B value. */
  packed: Int32Array;
}

export type Code = Warrior | PackedWarrior;

/** Status of evaluate(): 0 ok, 1 overflow (the value wrapped around), -1 not an expression, -2 division by zero. */
export type EvalStatus = 0 | 1 | -1 | -2;

export interface LoadOptions {
  /** Non-negative safe integer; random when left out. Same as pmars -F for the first round. */
  seed?: number;
  /** Fixed positions, one per warrior, each below coreSize (else a RangeError): no random placement. Warriors may overlap. */
  positions?: number[];
  /** pmars -P, two warriors without fixed positions: each position and first mover once before any repeats. The seed of pmars -P -F x is 2 * (x - minDistance). */
  permute?: boolean;
}

export interface MatchOptions extends LoadOptions {
  /** Rounds to play; default `rounds` of the options. */
  rounds?: number;
  /** Stop rounds early that can only end in a tie (default true): same scores, a different final core. */
  earlyTie?: boolean;
  /** Play rounds firstRound + 1 .. firstRound + rounds, with empty p-space (unless pspace is given). Default 0. */
  firstRound?: number;
  /** Carry p-space over: true starts as a match starts, else one array per warrior (pSpaceSize cells, at least 1, cell 0 the last result, each value from 0 to coreSize-1) as a previous call returned it. Then the result's warriors have `pspace`. */
  pspace?: true | Int32Array[];
}

export interface RoundResult {
  /** 1-based. */
  round: number;
  /** Cycles the round ran. */
  cycles: number;
  /** Indices of the warriors alive at its end. */
  survivors: number[];
}

export interface MatchResult {
  warriors: { name: string; wins: number; losses: number; ties: number; score: number[]; pspace?: Int32Array }[];
  results: RoundResult[];
  /** Instructions executed. */
  instructions: number;
}

export interface State {
  round: number;
  roundOver: boolean;
  /** Index of the warrior to move next; 0 is a valid warrior. */
  current: number;
  warriorsLeft: number;
  time: number;
  cyclesLeft: number;
}

export interface Cell {
  op: number;
  mod: number;
  aMode: number;
  aVal: number;
  bMode: number;
  bVal: number;
}

/** A loaded warrior; the getters read the engine. */
export interface WarriorView {
  readonly index: number;
  readonly code: Code;
  readonly name: string;
  readonly author: string;
  readonly position: number;
  readonly tasks: number;
  readonly alive: boolean;
  /** Time it died in the current round, or null. */
  readonly diedAt: number | null;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly lastResult: number;
  /** 2 * warriors - 1 counters (a copy): [k] for k < warriors, rounds it survived with k + 1 warriors left; [warriors - 1 + k], rounds it died in while k + 1 were alive. */
  readonly score: number[];
  /** P-space cells; cell 0 is unused (a copy). */
  readonly pspace: Int32Array;
  /** Queued addresses, the next one to run first. */
  processes(): number[];
  /** The same as a view of engine memory, without a copy: valid until the next call into the engine. */
  queue(): Uint32Array;
  /** With { watch: true }: the cells it owns (watch().owner); its code length at round start. */
  readonly territory: number;
  /** With { watch: true }: executions of copies of each instruction of its code, by any warrior (a live view). */
  readonly execCount: Uint32Array;
}

/** The watch of an engine created with { watch: true } (m42_watch in 42mars.h): live views, changed in place by run(). */
export interface Watch {
  /** Per cell: the last warrior that stored anything there, as index + 1; 0 none. */
  owner: Uint8Array;
  /** Per cell: the last warrior that executed it, read it (index + 1, 0 none). */
  execBy: Uint8Array;
  readBy: Uint8Array;
  /** Per cell, the last store: +1 an increment of > or }, -1 a decrement of < or {, 0 a store of the instruction. */
  bump: Int8Array;
  /** Per cell: warrior << 16 | instruction of the code it is a copy of (MOV.I copies it), -1 none. */
  origin: Int32Array;
  /** Per cell: the time of the last store, read, execution in this round (the first instruction is 1); 0 never. */
  tWrite: Uint32Array;
  tRead: Uint32Array;
  tExec: Uint32Array;
  /** Per warrior: cells owned. */
  territory: Uint32Array;
  /** execCount[w * codeStride + i]: executions of copies of instruction i of warrior w. */
  execCount: Uint32Array;
  codeStride: number;
  /** 4096 entries of 4 numbers, instruction t at entry t % 4096: pc, A pointer, B pointer, meta (warrior | op byte << 8 | flags: 0x10000 stored at B, 0x20000 new process at A, 0x40000 died, 0x80000 skipped). */
  trace: Uint32Array;
  /** Process deaths this round, read from the engine on each access; death k is entry k % 1024 of `death`. */
  readonly deaths: number;
  /** 1024 entries of 4 numbers: address, warrior, time, 1 when it was the warrior's last process. */
  death: Uint32Array;
}

export interface Event {
  type: 'kill' | 'death';
  addr: number;
  warrior: number;
  time: number;
}

export interface EngineOptions extends Options {
  /** Record what a visualizer shows (watch(), events()); run() is then slower. */
  watch?: boolean;
}

/** One simulator, an instance of the WebAssembly module. Every status other than M42_OK from the library is an Error "<method>: <m42_status_text()>", e.g. "run: no warriors loaded" for startRound(), run(), step(), endRound(), state() and its getters, core() and watch() before the first load(). */
export interface Mars {
  readonly coreSize: number;
  readonly opt: Readonly<Required<Options>>;
  readonly warriors: WarriorView[];
  /** Results of the rounds since load() or of the last runMatch(). */
  readonly results: RoundResult[];
  readonly roundResult: RoundResult | null;
  /** Throws when a code is not ok, longer than maxLength, or does not fit the rules: an opcode above 18, a modifier above 6, a mode above 7, an A or B value or the start outside 0 .. coreSize-1 (e.g. assembled for another core size). The message names the warrior, the instruction and the field. */
  load(codes: Code[], options?: LoadOptions): void;
  startRound(): void;
  /** Executes up to n instructions and returns how many ran; stops when the round ends. */
  run(n: number): number;
  step(): void;
  endRound(): void;
  /** Loads the warriors as load() does, with the same errors, and plays the match inside the engine. */
  runMatch(codes: Code[], options?: MatchOptions): MatchResult;
  state(): State;
  readonly round: number;
  readonly roundOver: boolean;
  readonly time: number;
  readonly cyclesLeft: number;
  readonly warriorsLeft: number;
  readonly current: number;
  /** The core decoded, reused until it can change: do not write into it. */
  core(): { op: Uint8Array; am: Uint8Array; bm: Uint8Array; av: Int32Array; bv: Int32Array };
  /** Per cell: op << 3 | mod. */
  readonly op: Uint8Array;
  readonly am: Uint8Array;
  readonly bm: Uint8Array;
  readonly av: Int32Array;
  readonly bv: Int32Array;
  cell(addr: number): Cell;
  /** With { watch: true }: the views of the watch, new ones after the memory grew. */
  watch(): Watch;
  /** With { watch: true }: the process deaths since the last call in this round (at most the last 1024; a warrior's end also shows in its alive and diedAt): a 'kill' for each, then a 'death' when it was the warrior's last process. */
  events(): Event[];
}

/** Compiles 42mars.wasm once (fetch in browsers, the file system in Node). */
export function compileMars(): Promise<WebAssembly.Module>;

export function createMars(options?: EngineOptions): Promise<Mars>;

/** With a module from compileMars(), or in Node 20.16+ / 22.3+ without one. */
export function createMarsSync(options?: EngineOptions, module?: WebAssembly.Module): Mars;

export function packWarrior(code: Warrior, packed?: Int32Array): PackedWarrior;

/** Assembles Redcode as pMARS 0.9.5 does. In a browser, call compileMars() first or pass the module. */
export function assemble(source: string, options?: Options, module?: WebAssembly.Module): Warrior;

/** Evaluates one Redcode expression with 64-bit integers, as pMARS does. */
export function evaluate(text: string, module?: WebAssembly.Module): { status: EvalStatus; value: bigint };
