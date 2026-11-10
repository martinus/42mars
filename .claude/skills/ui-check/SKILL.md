---
name: ui-check
description: Run the Core War Theater visualizer headless and take screenshots, to verify a UI change visually or reproduce a UI bug. Use after any change to ui/**, before calling it done.
---
# UI check

1. Serve: `node tools/serve.mjs 8123 &`, note the PID, kill that PID at the end (not `pkill -f`).
2. Screenshot with headless Chrome (WebGL2 through SwiftShader):
   ```sh
   S=$(mktemp -d)
   google-chrome --headless=new --no-sandbox --user-data-dir=$S/prof \
     --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1600,1000 \
     --virtual-time-budget=6000 --enable-logging=stderr --v=0 \
     --screenshot=$S/shot.png 'http://127.0.0.1:8123/ui/?cast=lantern,origami&steps=3000&paused&noguide' 2>&1 | grep -i 'console\|error'
   ```
   Then open `$S/shot.png` with the Read tool and look at it. Console errors in the output are failures. Add `--force-device-scale-factor=2` for a screenshot a person will see.
3. Cover what changed: `layout=grid` and `layout=ring`; `preset=nano` (instruction text in cells); `speed=16` without `paused` for the running look; `steps=N` to stop at an interesting moment (deterministic for a given cast and preset); with and without `noguide`.
4. Interaction (hover, keys, clicks): if `node -e "require('playwright')"` works, use Playwright (`chromium.launch()`); otherwise start Chrome with `--remote-debugging-port=9222` and drive it over the DevTools protocol with Node's built-in `WebSocket`. `window.__theater` holds the app state for assertions.
5. Software rendering is slow: judge layout, colors and text from screenshots, not frame rate. For frame time, ask Martin to check in a real browser, or measure `frame()` time through `window.__theater` in a non-headless run.
