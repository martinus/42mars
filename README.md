# 42mars

A fast [Core War](https://corewar.co.uk/) simulator (MARS) with a Redcode assembler, both reproducing pMARS 0.9.x behavior, and Core War Theater, a browser visualizer built on them. MIT licensed.

## Quick start

**C.** The library is one file to compile with your program, C11 with gcc, clang or MSVC:

```sh
cc -O2 -o example lib/example.c lib/42mars.c
./example -r 100 warriors/imp.red warriors/dwarf.red     # wins losses ties, per warrior
```

`lib/42mars.h` documents the interface, `lib/example.c` uses it. To build and install the static and the shared library, the program `42mars` and a pkg-config file (Linux and macOS):

```sh
make                    # into build/
make test               # the C tests, needs Node 20 or newer
sudo make install       # into /usr/local, or make install PREFIX=...; on Linux, sudo ldconfig after the first install
cc -O2 -o example lib/example.c $(pkg-config --cflags --libs 42mars)
```

With MSVC, `build-msvc.bat` builds the same into `build\`, or compile directly: `cl /O2 /std:c11 lib\example.c lib\42mars.c`. Each release on GitHub has these builds for Linux, macOS and Windows.

**Command line.** `42mars` takes pMARS's options and prints its output, for tools that call pMARS (differences: [docs/redcode-semantics.md](docs/redcode-semantics.md), section 5):

```sh
make
build/42mars -b -r 100 warriors/imp.red warriors/dwarf.red
```

**JavaScript.** The npm package `42mars` is the WebAssembly build with its JS interface and types, for Node 20 or newer and browsers, without a bundler:

```sh
npm install 42mars
```

```js
import { assembleWasm, createWasmMars } from '42mars';

const mars = await createWasmMars(); // compiles the module; first, so that assembleWasm() also works in a browser
const imp = assembleWasm(';name Imp\nmov 0, 1\n');
const dwarf = assembleWasm(';name Dwarf\nadd #4, 3\nmov 2, @2\njmp -2\ndat #0, #0\n');
const { warriors } = mars.runMatch([imp, dwarf], { rounds: 100, seed: 1 });
for (const w of warriors) console.log(w.name, w.wins, w.losses, w.ties);
```

In a browser without npm: `import { ... } from 'https://cdn.jsdelivr.net/npm/42mars@0.1.0/wasm/42mars.js'`. The types are in `wasm/42mars.d.ts`.

## This repository

```sh
npm run serve          # http://127.0.0.1:8000/ (the visualizer in ui/)
npm test               # 442 tests, Node 20 or newer, no dependencies
node tools/asm.mjs warriors/dwarf.red      # pMARS-style listing
node tools/corpus.mjs path/to/warriors     # assemble a whole folder
node tools/pmars-diff.mjs --pmars path/to/pmars --corpus path/to/warriors   # compare with pMARS
node tools/tournament.mjs path/to/warriors --rounds 100 --engine wasm   # round robin on all cores
node tools/tournament.mjs path/to/warriors --bench my.red             # my.red against each of them, worst first
node tools/bench.mjs path/to/warriors --wasm-match   # simulator speed (see the file for the warriors)
wasm/build.sh          # rebuild wasm/42mars.wasm (Node, clang with the wasm32 target)
make                   # build/: the library and 42mars, e.g. build/42mars -b -k -r 100 -f a.red b.red
```

Layout: `lib/` is the 42mars C library: the header `lib/42mars.h` and one file to compile with your program, `lib/42mars.c`, which includes its parts: the simulator `lib/src/mars.c`, the assembler `lib/src/asm.c` and the header's functions `lib/src/api.c`, with what differs between compilers in `lib/src/platform.h`. `wasm/` is its WebAssembly build and JavaScript interface, `ui/` the Core War Theater visualizer on top. `js/` holds the JavaScript assembler and simulator; the assembler goes once the tools and the visualizer assemble through wasm, the simulator once the visualizer runs on the library (roadmap L3).

`wasm/42mars.js` is a headless WebAssembly simulator with the same results as `js/mars.js` and pMARS, for tournaments: about 310M instructions/s in a single thread, against 61M for mars.js headless, 91M for native pMARS and, warmed up, about 1.8 times the exMARS build on corewar.dev. An 80-warrior round robin (3,160 pairings, 100 rounds) takes 2.96 s on 16 cores, against 5.4 s with corewar.dev's exMARS; on rmars's own start positions ours takes 3.1 s and rmars 5.9 s. Details in [PLAN.md](PLAN.md#speed).

New to Core War? Press `?` in the app for a short guide, then press **learn**: every instruction gets explained while it runs. The rules `nano · 80` show the instruction text inside the cells.

Drop `.red` files onto the page to load them. Keys: `Space` play/pause, `→` step (`Shift+→` 100 steps), `N` next round, `R` restart, `L` switch ring/grid, `F` footprints (which cells a warrior looked at or only incremented this round), `[` `]` speed, `?` guide.

URL parameters: `?cast=lantern,origami,seeker` picks sample warriors, `preset=nano`, `layout=grid`, `speed=0..16`, `steps=N` (run N instructions and pause), `rounds=N`, `paused`, `noguide`.

See [PLAN.md](PLAN.md) for the design, how the engine is validated so far and what comes next, and [docs/redcode-semantics.md](docs/redcode-semantics.md) for the exact behavior of assembler and simulator.

## License

MIT, see [LICENSE](LICENSE).
