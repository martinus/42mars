// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The command line program (cli/42mars.c) against outputs of pMARS 0.9.5:
// test/fixtures/cli.json holds, per case, the arguments, pMARS's exit code
// and stdout, recorded with `pmars <args>` (the server build in the oracle
// folder) on the warriors in warriors/ (W/) and the three below (P/). Built
// natively (test/native.js).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { lines, prebuilt, program, skip } from './native.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'cli-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const bin = program(prebuilt ?? tmp, '42mars');

// P/: a PIN, an ORG, negative values and A-field modes; a source with an
// error; a warrior that dies.
writeFileSync(join(tmp, 'pinny.red'), ';name pinny\n pin 77\n org 2\n dat -1, 7999\n spl.b #-3, }5\nfoo jmp foo\n end\n');
writeFileSync(join(tmp, 'broken.red'), ' mov 0\n');
writeFileSync(join(tmp, 'die.red'), ' dat 0\n'); // alone, it dies in every round

before(() => (prebuilt || skip ? undefined : promisify(execFile)('cc', ['-O2', '-o', bin, join(root, 'cli/42mars.c'), join(root, 'lib/42mars.c')])));

const cases = JSON.parse(readFileSync(new URL('./fixtures/cli.json', import.meta.url), 'utf8'));
for (const c of cases) {
  test(`42mars ${c.args}`, { skip }, () => {
    const argv = c.args.split(' ').map((a) => a.replace(/^W\//, join(root, 'warriors') + '/').replace(/^P\//, tmp + '/'));
    const r = spawnSync(bin, argv, { encoding: 'latin1' });
    assert.equal(r.status, c.code, r.stderr);
    assert.equal(lines(r.stdout), c.stdout);
  });
}

test('42mars rejects what the engine does not support', { skip }, () => {
  const w = [join(root, 'warriors/imp.red'), join(root, 'warriors/dwarf.red')];
  for (const args of [['-V'], ['-R', '100'], ['-W', '100'], ['-s', '70000'], ['-F', '4000+1']]) {
    const r = spawnSync(bin, ['-b', ...args, ...w], { encoding: 'latin1' });
    assert.equal(r.status, 2, args.join(' '));
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /^42mars: /);
  }
});
