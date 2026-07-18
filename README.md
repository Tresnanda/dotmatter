# dotmatter

Turn any image or video into an interactive field of physical particles.

Seven effects — **Particles, Dither, Halftone, ASCII, LED, Stitch, Scanline** — all running on one shared WebGL2 particle simulation. Every dot, glyph, and cell is an independently simulated object with a home position, velocity, and spring: the cursor physically pushes them aside, they carry momentum, and they bounce back with a liquid overshoot.

Inspired by the interactive shader components popularized by Figma and Framer.

## Quick start

```bash
pnpm add @dotmatter/react @dotmatter/shaders @dotmatter/core
```

```tsx
import { DotMatter } from "@dotmatter/react"
import { particleEffect } from "@dotmatter/shaders"

<DotMatter
  src="/portrait.jpg"
  effect={particleEffect}
  preset="soft-repel"
  alt="Portrait"
/>
```

That's it. The component renders an accessible `<img>` fallback, streams the image to the GPU, and animates the particle field at 60fps. Move the cursor across it.

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

## Development

```bash
pnpm install
pnpm test        # 102 tests
pnpm dev         # playground at localhost:5173
pnpm build
```

## License

MIT © Treshnanda
