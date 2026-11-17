// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// What the evolver's dashboard shows of a run without its whole history, in
// one place for the page (ui/evolver.js) and the server (tools/serve.mjs):
// the point of the progress chart of a batch, and what the head of a run's
// best.red says.

// The progress of a batch: the best and the mean of the members' averages
// against the panel (0 without members), and the best against the holdout
// so far.
export function progressPoint(panelAverages, holdout) {
  const n = panelAverages.length;
  return { best: n ? Math.max(...panelAverages) : 0, mean: n ? panelAverages.reduce((a, b) => a + b, 0) / n : 0, holdout };
}

// From a best.red as 42evolve writes it: its score against the holdout and
// the batch it is from, null where the head does not say
// (";strategy evolved, warrior 9 of run seed 3, batch 5",
// ";strategy 101.5 against 100 holdout warriors, 88.0 against the panel").
export function bestRedInfo(text) {
  const holdout = /^;strategy ([\d.]+) against \d+ holdout/m.exec(text), batch = /^;strategy evolved, .*\bbatch (\d+)/m.exec(text);
  return { holdout: holdout ? Number(holdout[1]) : null, batch: batch ? Number(batch[1]) : null };
}
