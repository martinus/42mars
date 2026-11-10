# 42mars

A fast [Core War](https://corewar.co.uk/) simulator (MARS) with a Redcode assembler, both reproducing pMARS 0.9.x behavior, and Core War Theater, a browser visualizer built on them. MIT licensed.

```sh
npm run serve          # http://127.0.0.1:8000/ (the visualizer in ui/)
npm test               # 418 tests, Node 20 or newer, no dependencies
node tools/asm.mjs warriors/dwarf.red      # pMARS-style listing
node tools/corpus.mjs path/to/warriors     # assemble a whole folder
node tools/pmars-diff.mjs --pmars path/to/pmars --corpus path/to/warriors   # compare with pMARS
node tools/tournament.mjs path/to/warriors --rounds 100 --engine wasm   # round robin on all cores
node tools/tournament.mjs path/to/warriors --bench my.red             # my.red against each of them, worst first
node tools/bench.mjs path/to/warriors --wasm-match   # simulator speed (see the file for the warriors)
wasm/build.sh          # rebuild wasm/42mars.wasm (Node, clang with the wasm32 target)
```

Layout: `lib/` is the 42mars C library (the simulator `lib/src/mars.c` and the assembler `lib/src/asm.c`), `wasm/` its WebAssembly build and JavaScript interface, `ui/` the Core War Theater visualizer on top. `js/` holds the JavaScript assembler and simulator; the assembler goes once the tools and the visualizer assemble through wasm, the simulator once the visualizer runs on the library (roadmap L3).

`wasm/42mars.js` is a headless WebAssembly simulator with the same results as `js/mars.js` and pMARS, for tournaments: about 310M instructions/s in a single thread, against 61M for mars.js headless, 91M for native pMARS and, warmed up, about 1.8 times the exMARS build on corewar.dev. An 80-warrior round robin (3,160 pairings, 100 rounds) takes 2.96 s on 16 cores, against 5.4 s with corewar.dev's exMARS; on rmars's own start positions ours takes 3.1 s and rmars 5.9 s. Details in [PLAN.md](PLAN.md#speed).

New to Core War? Press `?` in the app for a short guide, then press **learn**: every instruction gets explained while it runs. The rules `nano · 80` show the instruction text inside the cells.

Drop `.red` files onto the page to load them. Keys: `Space` play/pause, `→` step (`Shift+→` 100 steps), `N` next round, `R` restart, `L` switch ring/grid, `F` footprints (which cells a warrior looked at or only incremented this round), `[` `]` speed, `?` guide.

URL parameters: `?cast=lantern,origami,seeker` picks sample warriors, `preset=nano`, `layout=grid`, `speed=0..16`, `steps=N` (run N instructions and pause), `rounds=N`, `paused`, `noguide`.

See [PLAN.md](PLAN.md) for the design, how the engine is validated so far and what comes next, and [docs/redcode-semantics.md](docs/redcode-semantics.md) for the exact behavior of assembler and simulator.

## License

MIT, see [LICENSE](LICENSE).
