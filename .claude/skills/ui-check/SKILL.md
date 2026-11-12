---
name: ui-check
description: Runs the Core War Theater visualizer in headless Chrome to compare it with main (identical textures for the same seed), take screenshots, check console errors and compare engine time per frame. Use after any change to ui/** or to what the visualizer reads (the watch, wasm/42mars.js), before calling it done.
---
# UI check

No Playwright on Martin's machine: Chrome is driven over the DevTools protocol with Node's built-in `WebSocket` (`compare.mjs` here does that).

1. Serve main and the working tree, remember the server PIDs, kill those PIDs at the end:
   ```sh
   S=<scratchpad>; mkdir $S/main && git archive origin/main | tar -x -C $S/main
   (cd $S/main && exec node tools/serve.mjs 8124 > /dev/null 2>&1) & P1=$!
   node tools/serve.mjs 8125 > /dev/null 2>&1 & P2=$!
   until curl -so /dev/null http://127.0.0.1:8124/ui/ && curl -so /dev/null http://127.0.0.1:8125/ui/; do sleep 0.3; done
   ```
2. Anything that must not change (engine, glue, a refactor of `ui/`): compare with main.
   `node .claude/skills/ui-check/compare.mjs --base 8124 --head 8125 --out $S/shots '<query>' ...`
   It seeds `Math.random` the same for both, so both place the warriors alike, then compares after `steps=N&paused` the textures the renderer gets (`window.__theater.dataA/dataB`), time, round, processes, territories and the story; it prints SAME or DIFF, exits 1 on a difference or a console error, and saves screenshots with `--out`. Views that covered #75: `cast=lantern,origami&steps=3000&paused&noguide`, `cast=dwarf,imp&steps=500&paused&preset=nano&layout=ring&noguide`, `cast=lantern,origami,seeker&steps=2500&paused&noguide&layout=grid`, `cast=seeker,imp&steps=20000&paused&noguide` (Seeker dies at 2553: events and the death cause). The three-warrior grid view gives DIFF in the story now and then also for main against itself (#89): judge it by the textures, tasks and territories. A paused snapshot after `steps` is one frame: it does not show per-frame effects (heat decay, arcs while running), so check those on screenshots of a running view.
3. A change meant to look different: screenshots, and open each with the Read tool. `compare.mjs --out` saves them; a single one without the script:
   `google-chrome --headless=new --no-sandbox --user-data-dir=$S/prof --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1600,1000 --virtual-time-budget=6000 --screenshot=$S/shot.png 'http://127.0.0.1:8125/ui/?<query>'`. Add `--force-device-scale-factor=2` for a screenshot a person will see. Cover what changed: `layout=grid` and `ring`, `preset=nano` (instruction text in cells), `speed=16` without `paused`, with and without `noguide`.
4. Speed: `compare.mjs --time '<query without paused>'` runs each view 5 s and prints the engine's instructions/s inside `run()` and the ms per frame outside it, for base and head. Software rendering makes the frame time 40 to 60 ms: compare base with head only; for real frame times ask Martin to check in a browser.
5. Interaction (hover, keys, clicks): extend `compare.mjs`'s `open()` (`Runtime.evaluate` on `window.__theater`, `Input.dispatchMouseEvent`).
6. `kill $P1 $P2`.
