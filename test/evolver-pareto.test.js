// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142) on the tiny hill of warriors/koenigstuhl:
// --pushoff pareto, pareto-age and pareto-sd, --difference ahead. What the evolver's test files share is in
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
import { paretoFronts, pushoffValues, sdDistance, standardError, weakest } from '../tools/diversity.js';
import { kind as styleKind, measureStyle } from '../tools/style.js';
import { bestRedInfo } from '../tools/progress.js';
import { setup, cleanup, tmp, evolve, skip, TINY, run, events, without, stable, base, checkValues, checkEarly } from './evolver-common.js';

before(setup);
after(cleanup);

test('--difference ahead: the SD-score only where a warrior scores more; from the start, and from a resume on', { skip }, () => {
  assert.equal(base[0].params.difference, 'abs');
  const BATCHES = 12;
  const args = [...TINY, '--difference', 'ahead', '--list', '16', '--survivors', '8'];
  run(join(tmp, 'ahead1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'ahead1'));
  assert.equal(one[0].params.difference, 'ahead');
  // every value, estimate and push-off with the one-sided SD-score
  assert.equal(checkValues(one), BATCHES);
  assert.ok(checkValues.aheadLeaves >= 2, `ahead changed who left in ${checkValues.aheadLeaves} push-offs`);
  run(join(tmp, 'ahead3'), [...args, '--threads', '3', '--batches', String(BATCHES)]);
  assert.deepEqual(stable(events(join(tmp, 'ahead3'))), stable(one));
  // a run that continues with it: the run so far is the one without, then
  // an event and the values of the list with it, and the state keeps it
  const sw = join(tmp, 'ahead-switch');
  run(sw, [...TINY, '--threads', '2', '--batches', '6']);
  run(sw, ['--threads', '2', '--batches', '6', '--difference', 'ahead']);
  run(sw, ['--threads', '2', '--batches', '2']);
  const evs = events(sw);
  assert.deepEqual(stable(evs).slice(0, stable(base).length), stable(base));
  const k = evs.findIndex((e) => e.type === 'difference');
  assert.deepEqual([evs[k].difference, evs[k].batch, evs[k + 1].type], ['ahead', 6, 'values']);
  assert.equal(evs.filter((e) => e.type === 'difference').length, 1);
  assert.equal(checkValues(evs), 6 + 1 + 6 + 2);
  assert.ok(checkValues.aheadLeaves >= 1, `ahead changed who left in ${checkValues.aheadLeaves} push-offs`);
  // refused with --simple (--diversity panel, which --simple needs), and a value other than abs and ahead
  for (const [bad, why] of [[['--simple', '--diversity', 'panel'], /--difference ahead not with --simple/], [['--difference', 'sideways'], /usage/]]) {
    const r = spawnSync(evolve, [join(tmp, 'ahead-bad'), ...args, ...bad, '--batches', '1'], { encoding: 'utf8' });
    assert.equal(r.status, 2, bad.join(' '));
    assert.match(r.stderr, why);
  }
});

test('--pushoff pareto: NSGA-II on panel and members, pareto-age also on the age of the line, pareto-sd on the SD-score, also one-sided; the same run on any thread count and after a resume', { skip }, () => {
  assert.equal(base[0].params.pushoff, 'value');
  const BATCHES = 12;
  // seed 11: with 2000 cycles the seed of TINY had no child that started a line of its own
  const args = [...without(TINY, '--seed'), '--seed', '11', '--pushoff', 'pareto', '--list', '16', '--survivors', '8'];
  run(join(tmp, 'pareto1'), [...args, '--threads', '1', '--batches', String(BATCHES)]);
  const one = events(join(tmp, 'pareto1'));
  assert.equal(one[0].params.pushoff, 'pareto');
  // every origin, value and push-off as tools/diversity.js computes them
  assert.equal(checkValues(one), BATCHES);
  assert.ok(checkValues.paretoLeaves >= 2, `pareto changed who left in ${checkValues.paretoLeaves} push-offs`);
  assert.ok(checkValues.newLines >= 1, `${checkValues.newLines} children started a line of their own`);
  // a value is 10 (fronts - front) + min(crowding, 5): the first front has the highest values
  const last = one.filter((e) => e.type === 'values').at(-1), P = new Set(one[0].panel.map((x) => x.id));
  const vs = last.values.filter((x) => !P.has(x[0])).map((x) => x[4]);
  assert.ok(vs.every((x) => x > 0) && Math.max(...vs) - Math.min(...vs) >= 10, `values ${vs}`);
  // the state keeps the origins and the option
  run(join(tmp, 'pareto-resumed'), [...args, '--threads', '2', '--batches', String(BATCHES >> 1)]);
  run(join(tmp, 'pareto-resumed'), ['--threads', '4', '--batches', String(BATCHES - (BATCHES >> 1))]);
  assert.deepEqual(stable(events(join(tmp, 'pareto-resumed'))), stable(one));
  // with --stage: the early decisions on the first-stage results by the fronts too; many crossovers, some of
  // which continue the older line of their second parent
  const cross = 'opcode=81,a-operand=108,b-operand=108,insert=100,crossover-insert=400,crossover-replace=400';
  run(join(tmp, 'pareto-stage'), [...without(args, '--pushoff'), '--pushoff', 'pareto-age', '--panel-rounds', '100', '--stage', '20', '--changes', cross, '--threads', '2', '--batches', '16']);
  const st = events(join(tmp, 'pareto-stage'));
  assert.equal(st[0].params.pushoff, 'pareto-age');
  // pareto-sd: the SD-score to the nearest as the third objective, every value and push-off replayed
  run(join(tmp, 'pareto-sd'), [...without(args, '--pushoff'), '--pushoff', 'pareto-sd', '--threads', '2', '--batches', String(BATCHES)]);
  const sd = events(join(tmp, 'pareto-sd'));
  assert.equal(sd[0].params.pushoff, 'pareto-sd');
  assert.equal(checkValues(sd), BATCHES);
  assert.ok(checkValues.paretoLeaves >= 2, `pareto-sd changed who left in ${checkValues.paretoLeaves} push-offs`);
  assert.notDeepEqual(stable(sd).filter((e) => e.type === 'leave').map((e) => e.id), stable(one).filter((e) => e.type === 'leave').map((e) => e.id), 'pareto-sd pushed out the same as pareto');
  // pareto-sd with --difference ahead: the SD-score only where a warrior scores more than its nearest
  run(join(tmp, 'pareto-sda'), [...without(args, '--pushoff'), '--pushoff', 'pareto-sd', '--difference', 'ahead', '--threads', '2', '--batches', String(BATCHES)]);
  const sda = events(join(tmp, 'pareto-sda'));
  assert.deepEqual([sda[0].params.pushoff, sda[0].params.difference], ['pareto-sd', 'ahead']);
  assert.equal(checkValues(sda), BATCHES);
  assert.notDeepEqual(stable(sda).filter((e) => e.type === 'leave').map((e) => e.id), stable(sd).filter((e) => e.type === 'leave').map((e) => e.id), 'ahead pushed out the same as both ways');
  assert.equal(checkValues(st), 16);
  assert.ok(checkValues.olderSecond >= 1, `${checkValues.olderSecond} crossovers took the older line of the second parent`);
  const rule = checkEarly(st);
  assert.ok(rule.decisions >= 2, `${rule.decisions} early decisions`);
  // refused with the options that change the value otherwise, and a value other than value and pareto
  for (const [bad, why] of [[['--sharing', '20'], /--pushoff pareto not with/], [['--select', 'value'], /--pushoff pareto not with/], [['--difference', 'ahead'], /pareto-sd only/], [['--pushoff', 'front'], /usage/]]) {
    const r = spawnSync(evolve, [join(tmp, 'pareto-bad'), ...args, ...bad, '--batches', '1'], { encoding: 'utf8' });
    assert.equal(r.status, 2, bad.join(' '));
    assert.match(r.stderr, why);
  }
});
