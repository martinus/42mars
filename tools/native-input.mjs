// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// One match in the input format of lib/tools/bench-native.c: the
// header line "coreSize maxProcesses maxCycles minDistance pSpaceSize
// warriors instructions seed rounds", then the load area of mars_config().
// Used by tools/bench-native.mjs, and by tools/tournament.mjs and
// tools/bench-pairs.mjs with --native-input, so that the native build can
// run (and profile, and count) the same matches.

// codes: assemble() results; rules: { coreSize, maxProcesses, maxCycles,
// minDistance, pSpaceSize }; seed: the runMatch seed.
export function nativeMatch(codes, rules, seed, rounds) {
  const o = rules;
  const total = codes.reduce((s, c) => s + c.instructions.length, 0);
  let text = `${o.coreSize} ${o.maxProcesses} ${o.maxCycles} ${o.minDistance} ${o.pSpaceSize} ${codes.length} ${total} ${seed} ${rounds}\n`;
  // Warriors with the same PIN share a p-space, like WasmMars.load().
  const groups = new Map();
  codes.forEach((c, i) => {
    let group = i;
    if (c.pin !== null && c.pin !== undefined) {
      if (groups.has(c.pin)) group = groups.get(c.pin);
      else groups.set(c.pin, i);
    }
    text += `${c.instructions.length} ${c.start} ${group} 0\n`;
  });
  for (const c of codes) for (const x of c.instructions) text += `${(x.op << 3) | x.mod} ${x.aMode} ${x.aVal} ${x.bMode} ${x.bVal}\n`;
  return text;
}
