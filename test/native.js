// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl
//
// The native programs of the C tests (test/c-api.test.js, test/cli.test.js):
// built by the tests with `cc`, or prebuilt in the folder that M42_BIN names
// (`make test`, and CI on Windows, which builds them with MSVC through
// build-msvc.bat). Without either, those tests are skipped.

import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

export const prebuilt = process.env.M42_BIN ? resolve(process.env.M42_BIN) : null;
export const hasCc = spawnSync('cc', ['--version']).status === 0;
export const skip = !prebuilt && !hasCc && 'no cc and no M42_BIN';

// The path of program `name` in folder dir.
export const program = (dir, name) => join(dir, process.platform === 'win32' ? `${name}.exe` : name);

// The text a program printed, with Windows line ends as \n (stdout is a text
// stream: the C library writes \r\n there).
export const lines = (text) => text.replace(/\r\n/g, '\n');
