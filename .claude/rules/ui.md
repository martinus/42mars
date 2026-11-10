---
paths:
  - "ui/**"
---
# UI rules

Two audiences, both must be served:
- Watchers: it has to look spectacular and readable at a glance: glow on fresh writes, process pulses, death shockwaves, arcs for writes/jumps/scans, one consistent color per warrior across core, cards and timeline.
- Expert warrior authors: exact, dense information they cannot get from pMARS's display, e.g. decoded instructions with addresses relative to the warrior start, process queues, p-space, per-line execution heat, where bombs land, why a process died, cycle-exact stepping and replay. Show numbers, not only color. Ideas not on the roadmap yet go into `PLAN.md` (M2, M3).

Facts that are not obvious from the code:
- No framework, no build step: `ui/index.html` loads `app.js` as an ES module, which imports the engine from `../js/`; `npm run serve` serves the repo root and redirects `/` to `/ui/`.
- `app.js` owns state and the frame loop (`frame` → `advance` → `consumeTrace`/`consumeEvents` → `updateTextures`). At speed `max` it simulates about 11 ms per frame on the main thread; moving the simulator into a Web Worker is roadmap item M1.
- `renderer.js` draws every cell in one fragment shader from data textures (`TEX_W` = 128 wide), then bloom. `layout.js` maps addresses to pixels, and the shader repeats that mapping: change both together.
- `overlay.js` is a 2D canvas above the WebGL canvas (arcs, pointer tags, instruction text in big cells).
- The UI reads `mars.js` bookkeeping (`owner`, `execBy`, `readBy`, `bump`, `origin`, `tWrite`, `tRead`, `tExec`, `execHeat`, `events`) and the trace ring buffer (4096 entries, semantics doc 3.4 and 3.6). Above about 240,000 instructions/s at 60 fps a frame spans more than 4096 instructions, so trace consumers must cope with gaps.
- `explain.js` turns trace entries into English (`explainStep`) and classifies activity (`ActivityTracker`, a heuristic that can be wrong).
- `window.__theater` exposes the app state for debugging and screenshots.
- URL parameters for reproducible views: `cast=lantern,origami`, `preset=nano`, `layout=grid|ring`, `speed=0..16`, `steps=N` (run N instructions, then pause), `rounds=N`, `paused`, `noguide`.

Constraints:
- 60 fps on an 8000-cell core at every speed: no allocation per frame or per trace entry in the hot paths, typed arrays for per-cell data.
- Keyboard shortcuts and the guide (`?`) must stay in sync with features; README lists the keys.
- Verify visual changes with the `ui-check` skill (headless Chrome screenshot) and look at the image before calling it done.
