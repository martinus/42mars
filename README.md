# Core War Theater

A browser visualizer for [Core War](https://corewar.co.uk/), with a Redcode assembler and MARS simulator that reproduce pMARS 0.9.x behavior.

```sh
npm run serve          # http://127.0.0.1:8000/
npm test               # 245 tests, Node 20 or newer, no dependencies
node tools/asm.mjs warriors/dwarf.red      # pMARS-style listing
node tools/corpus.mjs path/to/warriors     # assemble a whole folder
node tools/pmars-diff.mjs --pmars path/to/pmars --corpus path/to/warriors   # compare with pMARS
node tools/tournament.mjs path/to/warriors --rounds 100 --engine wasm   # round robin on all cores
node tools/bench.mjs path/to/warriors --wasm-match   # simulator speed (see the file for the warriors)
tools/build-wasm.sh    # rebuild src/engine/wasm/mars.wasm (clang with the wasm32 target)
```

`src/engine/mars-wasm.js` is a headless WebAssembly simulator with the same results as `src/engine/mars.js` and pMARS, for tournaments: about 190M instructions/s in a single thread, against 61M for mars.js headless, 91M for native pMARS and 132M for the exMARS build on corewar.dev. An 80-warrior round robin (3,160 pairings, 100 rounds) takes 4.75 s on 16 cores. Details in [PLAN.md](PLAN.md#speed).

New to Core War? Press `?` in the app for a short guide, then press **learn**: every instruction gets explained while it runs. The rules `nano · 80` show the instruction text inside the cells.

Drop `.red` files onto the page to load them. Keys: `Space` play/pause, `→` step (`Shift+→` 100 steps), `N` next round, `R` restart, `L` switch ring/grid, `[` `]` speed, `?` guide.

URL parameters: `?cast=lantern,origami,seeker` picks sample warriors, `preset=nano`, `layout=grid`, `speed=0..16`, `steps=N` (run N instructions and pause), `rounds=N`, `paused`, `noguide`.

See [PLAN.md](PLAN.md) for the design, how the engine is validated so far and what comes next, and [docs/redcode-semantics.md](docs/redcode-semantics.md) for the exact behavior of assembler and simulator.

## License

MIT, see [LICENSE](LICENSE).
