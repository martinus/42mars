// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The evolver (evolver/, #142): its C unit test (test/c/evolver-test.c), and
// 42evolve on the tiny hill of warriors/koenigstuhl: the same run for any
// number of threads and after a resume, push-off values as tools/diversity.js
// computes them from the logged scores, and logged matches that the
// WebAssembly engine plays the same, which the dashboard's battle view needs.
// Built with cc, or prebuilt in M42_BIN (test/native.js). POSIX only.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assemble, createMarsSync } from '../wasm/42mars.js';
import { pushoffValues } from '../tools/diversity.js';
import { prebuilt, program, skip as noCc } from './native.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'evolver-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const evolve = program(prebuilt ?? tmp, '42evolve');
const unit = program(prebuilt ?? tmp, 'evolver-test');
const skip = noCc || (process.platform === 'win32' && 'POSIX only') || (prebuilt && !existsSync(evolve) && `no 42evolve in ${prebuilt}`) || false;

async function build() {
  const cc = promisify(execFile);
  const lib = join(tmp, '42mars.o');
  await cc('cc', ['-O2', '-c', '-o', lib, join(root, 'lib/42mars.c')]);
  const src = (f) => join(root, 'evolver', f);
  await Promise.all([
    cc('cc', ['-O2', '-pthread', '-I', join(root, 'lib'), '-o', evolve, src('evolve.c'), src('genome.c'), src('pushoff.c'), lib, '-lm']),
    cc('cc', ['-O2', '-I', join(root, 'lib'), '-I', join(root, 'evolver'), '-o', unit, join(root, 'test/c/evolver-test.c'), src('genome.c'), src('pushoff.c'), lib, '-lm']),
  ]);
}

const RULES = { coreSize: 800, maxCycles: 8000, maxProcesses: 800, maxLength: 20, minDistance: 20 };
const TINY = ['--opponents', join(root, 'warriors/koenigstuhl/tiny'), '--size', '800', '--cycles', '8000', '--processes', '800',
  '--length', '20', '--distance', '20', '--panel', '10', '--holdout', '8', '--batch', '24', '--rounds', '40', '--screen-rounds', '10',
  '--bench-every', '2', '--seed', '7'];

function run(dir, args) {
  const r = spawnSync(evolve, [dir, ...args], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  return r;
}
const events = (dir) => readFileSync(join(dir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
// what has to be the same in two runs: everything but timings and resumes
const stable = (evs) => evs.filter((e) => e.type !== 'speed' && e.type !== 'resume');

let base; // the events of the run on one thread, 6 batches
before(async () => {
  if (skip) return;
  if (!prebuilt) await build();
  run(join(tmp, 'one'), [...TINY, '--threads', '1', '--batches', '6']);
  base = events(join(tmp, 'one'));
});

test('genome and push-off in C', { skip }, () => {
  const r = spawnSync(unit, { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'ok');
});

test('the same seed gives the same run on 1 and 4 threads, and after a resume', { skip }, () => {
  run(join(tmp, 'four'), [...TINY, '--threads', '4', '--batches', '6']);
  assert.deepEqual(stable(events(join(tmp, 'four'))), stable(base));
  run(join(tmp, 'resumed'), [...TINY, '--threads', '3', '--batches', '2']);
  run(join(tmp, 'resumed'), ['--threads', '2', '--batches', '4']);
  const resumed = events(join(tmp, 'resumed'));
  assert.equal(resumed.filter((e) => e.type === 'resume').length, 1);
  assert.deepEqual(stable(resumed), stable(base));
  // a run with another seed is another run
  run(join(tmp, 'other'), [...TINY, '--seed', '8', '--threads', '4', '--batches', '2']);
  assert.notDeepEqual(stable(events(join(tmp, 'other'))).slice(0, 4), stable(base).slice(0, 4));
});

test('a run folder takes no new evolution options', { skip }, () => {
  const r = spawnSync(evolve, [join(tmp, 'one'), '--rounds', '50'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /only --threads, --batches and --seconds/);
  assert.equal(spawnSync(evolve, [join(tmp, 'none')], { encoding: 'utf8' }).status, 2); // no --opponents
});

// The matrix after every event, with slots given out as 42evolve does
// (the lowest free one), and the push-off values of tools/diversity.js.
test('the logged values are the push-off of the logged scores', { skip }, () => {
  const start = base[0];
  const rounds = start.params.rounds;
  const P = start.panel.length;
  const pts = new Map(); // "a,b" -> points per 100 rounds of a against b
  const put = (a, b, w, l, t) => {
    pts.set(`${a},${b}`, ((3 * w + t) * 100) / rounds);
    pts.set(`${b},${a}`, ((3 * l + t) * 100) / rounds);
  };
  const slots = start.panel.map((w) => w.id);
  let checked = 0;
  for (const e of base) {
    if (e.type === 'panel') for (const [a, b, w, l, t] of e.scores) put(a, b, w, l, t);
    if (e.type === 'enter') {
      let s = slots.indexOf(null, P);
      if (s < 0) s = slots.push(null) - 1;
      slots[s] = e.id;
      for (const [o, w, l, t] of e.scores) put(e.id, o, w, l, t);
      assert.equal(e.scores.length, slots.filter((x) => x !== null).length - 1, 'an entering warrior plays everyone in');
    }
    if (e.type === 'leave') {
      assert.ok(!start.panel.some((w) => w.id === e.id), `panel warrior ${e.id} left`);
      slots[slots.indexOf(e.id)] = null;
    }
    if (e.type === 'values') {
      const ids = slots.filter((x) => x !== null);
      assert.ok(ids.length - P <= start.params.list);
      const score = ids.map((a) => ids.map((b) => (a === b ? null : pts.get(`${a},${b}`))));
      const js = pushoffValues(score, ids.map((_, i) => i), { variant: start.params.sd, alpha: start.params.alpha });
      assert.deepEqual(e.values.map((v) => v[0]), ids);
      e.values.forEach(([id, avg, distance, nearest, value], i) => {
        const near = (x, y) => Math.abs(x - y) <= 1e-5 * Math.max(1, Math.abs(y));
        assert.ok(near(avg, js[i].avg) && near(distance, js[i].distance) && near(value, js[i].value), `values of ${id}`);
        assert.equal(nearest, ids[js[i].nearest]);
      });
      checked++;
    }
  }
  assert.equal(checked, 6);
});

test('panel warriors never leave, also the weakest', { skip }, () => {
  // a panel of 6 tiny hill warriors and one that dies in its first cycle
  const opp = join(tmp, 'opponents');
  mkdirSync(opp);
  const tiny = join(root, 'warriors/koenigstuhl/tiny');
  for (const f of readdirSync(tiny).sort().slice(0, 6)) copyFileSync(join(tiny, f), join(opp, f));
  writeFileSync(join(opp, 'dies.red'), ';name Dies\n dat #0, #0\n');
  const args = TINY.map((a, i) => (TINY[i - 1] === '--opponents' ? opp : a));
  run(join(tmp, 'weak'), [...args, '--panel', '7', '--holdout', '0', '--list', '4', '--threads', '4', '--batches', '3']);
  const evs = events(join(tmp, 'weak'));
  const dies = evs[0].panel.find((w) => w.name === 'Dies');
  assert.ok(dies);
  const values = evs.filter((e) => e.type === 'values');
  assert.equal(values.length, 3);
  for (const v of values) {
    const it = v.values.find((x) => x[0] === dies.id);
    assert.ok(it, 'Dies is still in');
    assert.equal(it[4], Math.min(...v.values.map((x) => x[4])), 'Dies has the lowest value');
  }
  assert.ok(evs.some((e) => e.type === 'leave'), 'the list was full and someone left');
});

test('a logged match plays the same in the WebAssembly engine', { skip }, () => {
  const start = base[0];
  const code = new Map(start.panel.map((w) => [w.id, w.source]));
  const m = createMarsSync(RULES);
  let played = 0;
  for (const e of base) {
    if (e.type !== 'enter') continue;
    code.set(e.id, `;redcode\n;name e${e.id}\n${e.code}`);
    // one match against the panel and one against another evolved warrior
    for (const [o, w, l, t, seed] of [e.scores[0], e.scores.at(-1)]) {
      const a = assemble(code.get(e.id), RULES), b = assemble(code.get(o), RULES);
      assert.ok(a.ok && b.ok);
      const r = m.runMatch([a, b], { seed, rounds: start.params.rounds });
      assert.deepEqual([r.warriors[0].wins, r.warriors[0].losses, r.warriors[0].ties], [w, l, t], `e${e.id} against ${o}`);
      played++;
    }
    if (played >= 12) break;
  }
  assert.ok(played >= 12);
});

test('the best warrior against the holdout warriors is in best.red', { skip }, () => {
  // after batches 1, 3 and 5, unless the best against the panel was measured already
  const benches = base.filter((e) => e.type === 'bench');
  assert.ok(benches.length >= 1 && benches.length <= 3);
  assert.equal(new Set(benches.map((b) => b.id)).size, benches.length);
  assert.ok(benches.every((b) => [1, 3, 5].includes(b.batch) && b.scores.length === base[0].holdout.length));
  const best = benches.reduce((x, y) => (y.avg > x.avg ? y : x));
  const text = readFileSync(join(tmp, 'one/best.red'), 'latin1');
  assert.match(text, new RegExp(`^;name e${best.id}$`, 'm'));
  const w = assemble(text, RULES);
  assert.ok(w.ok);
  const entered = base.find((e) => e.type === 'enter' && e.id === best.id);
  assert.equal(w.instructions.length, entered.length);
});
