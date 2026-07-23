# dotmatter

Turn any image or video into an interactive field of physical particles.

Ten effects — **Particles, Dither, Halftone, ASCII, LED, Stitch, Scanline, Mosaic, Rings, Contour** — all running on one shared WebGL2 particle simulation. Every dot, glyph, and cell is an independently simulated object with a home position, velocity, and spring: the cursor physically pushes them aside, they carry momentum, and they bounce back with a liquid overshoot.

Inspired by the interactive shader components popularized by Figma and Framer.

**Live playground:** [dotmatter.treshnanda.tech](https://dotmatter.treshnanda.tech)

**Using an AI coding agent?** Point it at [dotmatter.treshnanda.tech/llms.txt](https://dotmatter.treshnanda.tech/llms.txt) — a complete, standalone reference for the entire API written for LLMs (also at [`llms.txt`](./llms.txt) in this repo).

## Quick start

Install with your package manager of choice — `@dotmatter/react` pulls in the engine and effects automatically:

```bash
npm install @dotmatter/react
# or
pnpm add @dotmatter/react
# or
yarn add @dotmatter/react
# or
bun add @dotmatter/react
```

```tsx
import { DotMatter } from "@dotmatter/react"
import { particleEffect } from "@dotmatter/shaders"

<DotMatter
  src="/portrait.jpg"
  effect={particleEffect}
  preset="soft-repel"
  alt="Portrait"
  style={{ width: "100%", aspectRatio: "3 / 4" }}
/>
```

That's it. The component renders an accessible `<img>` fallback, streams the image to the GPU, and animates the particle field at 60fps. Move the cursor across it.

> **Give it a size.** dotmatter fills its own box — always set `width` + `aspect-ratio` (or an explicit height) via `style`/`className`. A zero-height container renders nothing.

### Not showing? Check these first

1. **No height** — see above. If it's in a flex/grid cell, that cell can collapse it to `0`; give it a size or `flex: 1` + a `min-height`.
2. **Next.js / RSC** — the file must be a Client Component. Put `"use client"` at the top. In a Server Component the effect never runs, so you only get the static fallback image (no particles).
3. **Cross-origin images** — the image is uploaded to a WebGL texture, so it must be same-origin or served with `Access-Control-Allow-Origin`. A hotlinked image with no CORS headers taints the canvas and the effect fails (fallback `<img>` still shows).
4. **WebGL2 off** — rare; `onError` fires and the plain `<img>` stays visible, so the page degrades gracefully.

Full agent-oriented reference: [dotmatter.treshnanda.tech/llms.txt](https://dotmatter.treshnanda.tech/llms.txt).

## Effects

| Effect | Import | Look |
| --- | --- | --- |
| Particles | `particleEffect` | Soft dots sized by luminance |
| Dither | `ditherEffect` | Ordered Bayer tiles, 1-bit editorial texture |
| Halftone | `halftoneEffect` | Print-style dots, tone as radius |
| ASCII | `asciiEffect` | Glyph ramp picked by brightness |
| LED | `ledEffect` | Glowing matrix pixels |
| Stitch | `stitchEffect` | Cross-stitch X marks |
| Scanline | `scanlineEffect` | Bar segments, CRT feel |
| Mosaic | `mosaicEffect` | Rounded mosaic tiles |
| Rings | `ringsEffect` | Concentric engraved rings |
| Contour | `contourEffect` | Gradient-following strokes, sketch-like |

## Features

- **Real physics, not a warp.** Cursor push with configurable force/radius, spring return with a slight overshoot bounce, momentum, damping.
- **Ambient motion.** `wave`, `breathe`, `flow`, `jitter` — time-based forces composed with cursor interaction:
  ```tsx
  <DotMatter ambient={{ mode: "wave", strength: 0.6, speed: 1, scale: 1.4 }} ... />
  ```
- **Universal color system.** Every effect supports `colorMode: 0` (source image colors) or `1` (custom `tint`); dither adds a two-tone ink palette.
- **Image adjustments.** `hue`, `saturation`, `exposure`, `contrast` uniforms on every effect — they drive both color and the luminance-based geometry.
- **Transparency-aware.** Transparent PNG regions allocate no particles — a logo becomes its own interactive silhouette.
- **Video sources.** `<DotMatter src="/clip.mp4" video ... />` streams frames straight to the GPU.
- **Any aspect ratio, responsive, SSR-safe.** Static `<img>` fallback when WebGL2 is unavailable.

## Custom effects

Effects are data — shaders plus typed uniforms on the shared physics:

```ts
import { defineEffect } from "@dotmatter/core"

export const myEffect = defineEffect({
  id: "my-effect",
  geometry: { type: "particles" },
  source: { vertex, fragment },
  uniforms: { /* typed, validated, presetable */ },
  presets: { default: { /* ... */ } },
})
```

## Scroll reveal & particle text

```tsx
// Particles assemble into place as the element scrolls into view
<DotMatter src={img} effect={particleEffect} scrollReveal="auto" alt="…" />

// Headlines as interactive particle fields (accessible text stays in the DOM)
import { DotMatterText } from "@dotmatter/react"
<DotMatterText text="HELLO" effect={particleEffect} />
```

`prefers-reduced-motion` is respected automatically, and rendering pauses when the element is offscreen or the tab is hidden.

## Development

This repo uses pnpm workspaces (contributors need [pnpm](https://pnpm.io)):

```bash
pnpm install
pnpm test        # full test suite
pnpm dev         # playground at localhost:5173
pnpm build
```

## License

MIT © Treshnanda
