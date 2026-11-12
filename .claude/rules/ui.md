---
paths:
  - "ui/**"
---
# UI rules

Two audiences, both served:
- Watchers: spectacular and readable at a glance: glow on fresh writes, process pulses, death shockwaves, arcs for writes/jumps/scans, one color per warrior across core, cards and timeline.
- Expert warrior authors: exact, dense information pMARS's display does not give: decoded instructions with addresses relative to the warrior start, process queues, p-space, per-line execution heat, where bombs land, why a process died, cycle-exact stepping. Numbers, not only color. New ideas go into `docs/plan.md` (M2, M3).

How it works:
- No framework, no build step: `ui/index.html` loads `app.js` as an ES module; it imports the engine from `../wasm/42mars.js` (compiled once at start) and the opcode tables from `../tools/opcodes.js`. `npm run serve` serves the repo root.
- `app.js` owns state and the frame loop (`frame` → `advance` → `consumeTrace`/`consumeEvents` → `updateTextures`). At speed `max` it simulates about 11 ms per frame on the main thread (a Web Worker is roadmap M1).
- `renderer.js` draws every cell in one fragment shader from data textures (`TEX_W` = 128), then bloom. `layout.js` maps addresses to pixels and the shader repeats that mapping: change both together. `overlay.js` is a 2D canvas on top (arcs, pointer tags, cell text).
- The engine runs with a watch (`createWasmMarsSync({ watch: true })`). `watch()`: `owner`, `execBy`, `readBy` (warrior + 1, 0 none), `bump`, `origin`, `tWrite`, `tRead`, `tExec` (0 never), `execCount` (the UI decays its own heat from the counts), the trace (4096 entries of 4 numbers); `events()`; queues through `queue()`. Semantics doc 3.4 and 3.6.
- Above about 240,000 instructions/s at 60 fps a frame spans more than 4096 instructions: trace consumers must cope with gaps.
- `explain.js`: trace entries in English (`explainStep`), activity classification (`ActivityTracker`, a heuristic).
- `window.__theater` is the app state, for debugging and the ui-check skill. URL parameters for reproducible views: `cast=lantern,origami`, `preset=nano`, `layout=grid|ring`, `speed=0..16`, `steps=N` (run N instructions, then pause), `rounds=N`, `paused`, `noguide`.

Constraints:
- 60 fps on an 8000-cell core at every speed: no allocation per frame or per trace entry in hot paths, typed arrays for per-cell data.
- Every engine getter crosses into wasm (`m.time`, `m.current`, `w.tasks`: one `m42_get_state`/`m42_get_warrior` call and an object each). Read them once per frame or per function, not per cell, arc or trace entry. Take `watch()` and `core()` once per frame and pass the arrays down (`traceEntry(trace, t)`, the tracker gets `{ op, origin }`).
- `queue()` is a view of scratch memory, overwritten by the next engine call: read it fully before the next `queue()`.
- Keyboard shortcuts and the guide (`?`) stay in sync with features; README lists the keys.
- Verify with the `ui-check` skill: screenshots for looks, `compare.mjs` against main for anything that must not change.
