// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --island-panels own and --optimize (--islands and --island-variant are in
// files of their own, #161). What the evolver's test files share is in
// test/evolver-common.js; built with cc, or prebuilt in M42_BIN
// (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { paretoFronts, pushoffValues, sdDistance, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { bestRedInfo } from '../tools/progress.js';
import { setup, cleanup, root, tmp, evolve, skip, RULES, TINY, run, events, without, stable, checkValues } from './evolver-common.js';

// Each [extra, message] of cases is refused: exit code 2, the message on stderr, no folder made.
function refuses(dir, base, cases) {
  for (const [extra, message] of cases) {
    const r = spawnSync(evolve, [dir, ...base, ...extra, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 2, extra.join(' '));
    assert.match(r.stderr, message, extra.join(' '));
  }
  assert.ok(!existsSync(dir));
}

before(() => setup({ base: false })); // no test here reads the base run
after(cleanup);



test('--island-panels own: each island its own panel from one round robin, one holdout for all in no panel; the same on any thread count and after a resume', { skip }, () => {
  // a picked panel of 6 from the strongest quarter of 80: 20 candidates, each island chooses from 10 of them
  const args = [...without(without(TINY, '--panel-choice'), '--panel'), '--panel-choice', 'picked', '--pick-sample', '80', '--panel', '6',
    '--list', '16', '--survivors', '8'];
  const isl = ['--islands', '4', '--island-panels', 'own', '--migrate', '0', '--island-variant', ''];
  const dir = join(tmp, 'own');
  run(dir, [...args, ...isl, '--threads', '2', '--batches', '4']);
  const re = events(dir, 'islands.jsonl');
  assert.equal(re[0].islandPanels, 'own');
  assert.ok(!re.some((e) => e.type === 'pick'), 'no panel for all');
  const all = [1, 2, 3, 4].map((i) => events(join(dir, `island-0${i}`)));
  const files = (ws) => ws.map((w) => w.file);
  const panels = all.map((ev) => files(ev[0].panel));
  all.forEach((ev, k) => {
    // its panel is what its event pick names: 6 of the strongest quarter of the one round robin
    const pick = ev.find((e) => e.type === 'pick');
    assert.ok(pick, `island ${k + 1}: its pick`);
    assert.deepEqual(files(pick.picked), panels[k]);
    assert.equal(panels[k].length, 6);
    assert.ok(pick.picked.every((p) => p.rank < 20), `island ${k + 1}: ranks ${pick.picked.map((p) => p.rank)}`);
    assert.equal(pick.cut, all[0].find((e) => e.type === 'pick').cut);
    // the holdout: the same for every island, 8 warriors in no island's panel
    assert.deepEqual(files(ev[0].holdout), files(all[0][0].holdout));
    assert.equal(ev[0].holdout.length, 8);
    for (const p of panels) assert.ok(!files(ev[0].holdout).some((f) => p.includes(f)), 'a holdout warrior in a panel');
  });
  // the panels differ: no two islands have the same
  assert.equal(new Set(panels.map((p) => [...p].sort().join())).size, 4, panels.join(' | '));
  // shared: one panel, picked once
  const shared = join(tmp, 'own-shared');
  run(shared, [...args, ...isl.map((x) => (x === 'own' ? 'shared' : x)), '--threads', '2', '--batches', '1']);
  assert.equal(events(shared, 'islands.jsonl')[0].islandPanels, 'shared');
  assert.equal(new Set([1, 2, 3, 4].map((i) => files(events(join(shared, `island-0${i}`))[0].panel).join())).size, 1);
  // the same stopped and continued on other thread counts
  const again = join(tmp, 'own-resumed');
  run(again, [...args, ...isl, '--threads', '3', '--batches', '1']);
  run(again, ['--threads', '1', '--batches', '3']);
  [1, 2, 3, 4].forEach((i) => assert.deepEqual(stable(events(join(again, `island-0${i}`))), stable(all[i - 1]), `island ${i}`));
  // a panel drawn or given, one island, or in a variant: refused
  const refused = [
    [['--islands', '3', '--island-panels', 'own', '--panel-choice', 'random'], /--island-panels own with 2 islands or more, a panel that is picked/],
    [['--islands', '3', '--island-panels', 'own', '--panel-files', 'imp.red,dwarf.red'], /--island-panels own with 2 islands or more/],
    [['--islands', '1', '--island-panels', 'own'], /--island-panels own with 2 islands or more/],
    [['--islands', '3', '--island-variant', '--island-panels own'], /an option of the islands the same/],
    [['--island-panels', 'own'], /usage/],
    [['--islands', '3', '--island-panels', 'mine'], /usage/],
  ];
  refuses(join(tmp, 'own-no'), args, refused);
  // too few candidates (10 of a sample of 40 for a panel of 10): every island would get the same panel
  const few = spawnSync(evolve, [join(tmp, 'own-few'), ...without(args, '--pick-sample', '--panel'), '--pick-sample', '40', '--panel', '10', ...isl, '--batches', '1'], { encoding: 'utf8', timeout: 60000 });
  assert.notEqual(few.status, 0);
  assert.match(few.stderr, /--island-panels own: 10 candidates of a sample of 40 for a panel of 10; it needs twice the panel/);
  // a holdout of 420, more than the warriors in no panel (of the 436 files, those that fit the rules): each island the
  // same, as many as there are, in no panel
  const big = join(tmp, 'own-holdout');
  run(big, [...without(args, '--holdout'), '--holdout', '420', ...isl, '--threads', '4', '--batches', '1']);
  const starts = [1, 2, 3, 4].map((i) => events(join(big, `island-0${i}`))[0]);
  const inPanels = new Set(starts.flatMap((e) => files(e.panel)));
  for (const e of starts) {
    assert.deepEqual(files(e.holdout), files(starts[0].holdout));
    assert.ok(!files(e.holdout).some((x) => inPanels.has(x)), 'a holdout warrior in a panel');
  }
  // of the warriors that fit the rules all are in a panel or the holdout: fewer than 420 are left
  assert.ok(starts[0].holdout.length < 420, `a holdout of ${starts[0].holdout.length}`);
});

test('--optimize: the constants of a warrior, steps confirmed with other seeds, the same on any thread count', { skip }, () => {
  // a stone whose step of 100 bombs 8 cells of a core of 800
  const file = join(tmp, 'badstep.red');
  writeFileSync(file, ';redcode\n;name bad step\nstep equ 100\nloop add.ab #step, bomb\nmov.i bomb, @bomb\njmp loop\nbomb dat #0, #step\n');
  const args = ['--optimize', file, ...TINY.slice(0, TINY.indexOf('--panel')), '--panel', '12', '--holdout', '8', '--rounds', '60', '--seed', '3', '--positions', 'pmars'];
  run(join(tmp, 'opt1'), [...args, '--threads', '1']);
  const one = events(join(tmp, 'opt1'));
  const start = one[0], end = one.at(-1), steps = one.filter((e) => e.type === 'optimize-step');
  assert.equal(start.type, 'optimize');
  assert.equal(end.type, 'optimize-end');
  assert.ok(steps.length >= 1 && end.avg > start.avg + 20, `${steps.length} steps, ${start.avg} to ${end.avg}`);
  for (const s of steps) assert.ok(s.gain > 2 * s.se && s.confirm > 2 * s.confirmSe, JSON.stringify(s));
  // the optimized warrior against the panel, replayed in the WebAssembly engine with the logged seeds
  const opt = assemble(readFileSync(join(tmp, 'opt1', 'optimized.red'), 'latin1'), RULES);
  assert.ok(opt.ok);
  const m = createMarsSync(RULES);
  let sum = 0;
  for (const p of start.panel) {
    const r = m.runMatch([opt, assemble(readFileSync(join(root, 'warriors/koenigstuhl/tiny', p.file), 'latin1'), RULES)], { seed: p.seed, rounds: start.rounds });
    sum += ((3 * r.warriors[0].wins + r.warriors[0].ties) * 100) / start.rounds;
  }
  assert.ok(Math.abs(sum / start.panel.length - end.avg) < 1e-6, `replayed ${sum / start.panel.length}, logged ${end.avg}`);
  assert.match(readFileSync(join(tmp, 'opt1', 'optimized.red'), 'latin1'), /;strategy bad step with its constants optimized by 42evolve: \d+ steps/);
  run(join(tmp, 'opt3'), [...args, '--threads', '3']);
  assert.deepEqual(events(join(tmp, 'opt3')), one);
  // a hill warrior whose constants are good already: what it might accept is
  // near the noise, and every step taken must be clear of it twice
  const hill = ['--optimize', join(root, 'warriors/koenigstuhl/tiny/afterstorm.red'), ...args.slice(2)];
  run(join(tmp, 'opt-hill'), [...hill, '--threads', '4']);
  const h = events(join(tmp, 'opt-hill'));
  for (const s of h.filter((e) => e.type === 'optimize-step')) assert.ok(s.gain > 2 * s.se && s.confirm > 2 * s.confirmSe, JSON.stringify(s));
  assert.ok(h.at(-1).avg >= h[0].avg, `${h[0].avg} to ${h.at(-1).avg}`);
});
