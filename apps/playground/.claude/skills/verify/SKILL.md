---
name: verify
summary: Launch and drive the shader playground in Chrome.
---

# Verify shader playground

1. Start the app:
   `pnpm --filter @shader-image/playground dev --host 127.0.0.1 --port 4173`
2. Poll `http://127.0.0.1:4173` until it responds.
3. Drive it with Playwright using installed Chrome:
   - Launch `chromium` with `channel: "chrome"`, `headless: true`, and `--use-angle=swiftshader`.
   - Open the page and wait for `Turn pixels into a responsive field.`
   - Move the pointer over the canvas.
   - Switch among Particles, Halftone, and Dither and check `[data-shader-effect]`.
   - Upload a local image through `input[type=file]` and wait for `Replace image`.
   - Capture desktop and mobile screenshots.
   - Fail on page errors or persistent console errors.
4. Evidence is stored under `artifacts/playground/`.

The first favicon request may log a transient generic 404 in Chrome even when no failed response or request is observable. Confirm with response/request-failure listeners before treating it as app failure.
