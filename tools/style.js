// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The style of a warrior: what it does to the core, measured with the watch
// of the engine (wasm/42mars.js, createMarsSync({ watch: true })). The
// warrior plays `rounds` rounds against each opponent; each round is looked
// at after `instructions` instructions of both (about half of them its own),
// when it is still alive then. The numbers are means over those looks:
//
//   copies   cells outside its own code that hold a copy of one of its
//            instructions (MOV.I of its code: bombs of a stone, the body of a
//            paper, the trail of an imp)
//   moved    cells outside its own code that it executed (papers and imps
//            run their copies; stones and scanners stay home)
//   written  cells outside its own code it stored into last; whole is the share of those stores
//            that wrote whole instructions or fields, the rest increments and
//            decrements (side effects of < > { })
//   read     cells outside its own code that it read and did not write
//            last (a scanner looks before it attacks)
//   tasks    its processes
//   alive    the share of the rounds it was still alive at the end; a round
//            in which it dies counts with its last look before that
//
// For the evolver's dashboard (ui/evolver.js, the card of a warrior) and
// tools/style.mjs. The kind is a rough guess from these numbers, nothing
// more: kind() names the rule that fits first.

// The numbers of one look at warrior 0 now.
function look(m, len) {
  const wa = m.watch(), core = m.coreSize, w = m.warriors[0], pos = w.position;
  let copies = 0, moved = 0, written = 0, whole = 0, read = 0;
  for (let c = 0; c < core; c++) {
    const away = (c - pos + core) % core >= len;
    const org = wa.origin[c];
    if (away && org >= 0 && org >> 16 === 0) copies++;
    if (away && wa.execBy[c] === 1 && wa.tExec[c] > 0) moved++;
    if (!away) continue; // its own code is its own from the load on
    if (wa.owner[c] === 1) {
      written++;
      if (wa.bump[c] === 0) whole++;
    } else if (wa.readBy[c] === 1 && wa.tRead[c] > 0) read++;
  }
  return { copies, moved, written, whole, read, tasks: w.tasks };
}

export function measureStyle(m, warrior, opponents, { rounds = 2, instructions = 4000, seed = 7, step = 500 } = {}) {
  const sum = { copies: 0, moved: 0, written: 0, whole: 0, read: 0, tasks: 0, looks: 0 };
  let tried = 0, full = 0;
  for (const o of opponents) {
    for (let r = 0; r < rounds; r++) {
      // a fresh load per round: the rest of the round is not needed. A look
      // every `step` instructions; the last one while it is alive counts, so
      // that a warrior that dies early is measured up to then
      m.load([warrior, o], { seed: seed + r });
      m.startRound();
      tried++;
      let last = null, ran = 0;
      while (ran < instructions && !m.roundOver && m.warriors[0].alive) {
        ran += m.run(Math.min(step, instructions - ran));
        if (m.warriors[0].alive) last = look(m, warrior.instructions.length);
      }
      if (ran >= instructions && m.warriors[0].alive) full++;
      if (!last) continue;
      for (const k of ['copies', 'moved', 'written', 'whole', 'read', 'tasks']) sum[k] += last[k];
      sum.looks++;
    }
  }
  const n = Math.max(1, sum.looks);
  return {
    copies: sum.copies / n,
    moved: sum.moved / n,
    written: sum.written / n,
    whole: sum.written ? sum.whole / sum.written : 0,
    read: sum.read / n,
    tasks: sum.tasks / n,
    alive: tried ? full / tried : 0,
    measured: tried ? sum.looks / tried : 0,
  };
}

// A rough name for a style.
export function kind(s) {
  if (s.measured === 0) return 'dies at once';
  // the thresholds: tools/style.mjs on the 1,107 '94nop Koenigstuhl warriors
  // against their strategy lines, docs/evolver.md
  if (s.copies >= 20 && s.moved >= 20 && s.tasks >= 250) return 'copies itself with many processes (paper)';
  if (s.copies >= 20 && s.moved >= 20) return 'runs copies of its code, few processes (imp, a stone that moves)';
  if (s.read >= 50 && s.read >= s.copies / 2) return 'reads far cells before it writes (scanner)';
  if (s.copies >= 20) return 'throws copies of its code (stone, clear)';
  if (s.written >= 100 && s.whole >= 0.5) return 'writes fields, no copies of its code';
  if (s.written >= 100) return 'damages by increments (< > { })';
  return 'writes little (scanner, or waits)';
}

// One line for a person.
export function describe(s) {
  if (s.measured === 0) return 'dies before it can be measured';
  return `${kind(s)} · ${Math.round(s.copies)} copies of its code, ${Math.round(s.moved)} cells run away from home, ${Math.round(s.written)} written (${Math.round(100 * s.whole)}% whole), ${Math.round(s.read)} read only, ${Math.round(s.tasks)} processes${s.alive < 1 ? `, alive after ${s.instructions ?? 4000} instructions in ${Math.round(100 * s.alive)}% of the rounds` : ''}`;
}
