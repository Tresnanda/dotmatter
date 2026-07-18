# Interactive Shader Image Toolkit Design

**Date:** 2026-07-17
**Status:** Approved

## Summary

Build a client-side TypeScript and React toolkit that renders image, video, and canvas sources through real-time interactive WebGL2 effects. It behaves like an enhanced responsive image component rather than exporting a one-time processed image.

The three flagship effect families are equal first-class features:

1. Dither
2. Dot / Particle
3. Halftone

The package also includes six supporting effect families, normalized pointer/touch/scroll/time interactions, adaptive rendering quality, accessible static fallbacks, and a public effect-plugin API for custom GLSL effects.

This is a rendering library, not a SaaS. It has no accounts, database, backend, billing, cloud storage, or hosted shader marketplace.

## Goals

A React or Next.js developer can:

- Install the package and render a supported media source with one component.
- Select a built-in effect and polished preset.
- Customize effects through typed properties.
- Add pointer, touch, scroll, viewport, or autoplay behavior.
- Use uploaded local images without sending them to a server.
- Render image, video, and canvas sources.
- Register custom effects through a structured plugin contract.
- Receive a normal accessible media fallback when GPU rendering fails.

## Architecture

The system has a framework-neutral WebGL2 core with adapters above it.

```text
React adapter ───────────────┐
Future Framer adapter ───────┼──> WebGL2 core ──> Effect modules ──> GPU
Future Web Component ────────┘
                                  ↑
                     media + normalized interactions
```

### Core renderer

The core owns:

- Canvas and WebGL2 context lifecycle
- Shader compilation and program linking
- Textures, buffers, geometry, and resource disposal
- Media source loading and updates
- Responsive sizing and device-pixel-ratio limits
- Render-loop scheduling
- Pointer, touch, scroll, viewport, and time normalization
- Context loss and restoration
- Quality selection and performance adaptation
- Static fallback decisions
- Effect registration and plugin validation

The core never imports React.

### React adapter

React owns declarative configuration and lifecycle only. It does not update React state on every animation frame.

The adapter provides:

- `ShaderImage`
- `DitherImage`
- `ParticleImage`
- `HalftoneImage`
- Hooks and imperative controls
- SSR-safe initialization
- Accessible fallback markup
- React Strict Mode-safe setup and cleanup

### Effect modules

Every effect is independently importable and follows the shared effect contract. Effects may use different rendering strategies without exposing those differences to consumers:

- Dither, Halftone, Pixelation, Chromatic, Grain, Displacement, Edge/Glitch, and ASCII primarily use fullscreen passes.
- Dot/Particle uses points or instanced geometry and may maintain simulation state.

## Proposed workspace structure

```text
packages/
  core/
    src/
      renderer/
      media/
      interaction/
      effects/
      plugins/
      quality/
      errors/
  react/
    src/
      components/
      effects/
      hooks/
  shaders/
    src/
      dither/
      particles/
      halftone/
      displacement/
      pixelation/
      chromatic/
      grain/
      edge-glitch/
      ascii/
  testing/
    src/
      fixtures/
      render-harness/
      matchers/
apps/
  playground/
  docs/
```

A pnpm 11 workspace will use exact dependency versions and pnpm's built-dependency allowlist. The package will be ESM and TypeScript-first. Package names such as `@shader-image/core` and `@shader-image/react` are working names until the final npm scope is chosen.

## Public React API

```tsx
import { ShaderImage } from "@shader-image/react"

<ShaderImage
  src="/portrait.jpg"
  effect="halftone"
  preset="editorial-cmyk"
  interaction={{
    pointer: "distort",
    scroll: "intensity",
  }}
  effectOptions={{
    cellSize: 8,
    angle: 45,
    contrast: 1.15,
  }}
  quality="auto"
  alt="Portrait of a musician"
/>
```

Typed convenience wrappers are thin adapters over the same renderer:

```tsx
<DitherImage src={image} method="bayer" scale={3} interaction="ripple" />
<ParticleImage src={image} density={120} interaction="repel" />
<HalftoneImage src={image} mode="cmyk" cellSize={8} />
```

### Imperative controls

Advanced consumers may pause, resume, update normalized inputs, adjust intensity, invalidate dynamic canvas sources, and capture a snapshot.

```ts
controls.pause()
controls.play()
controls.setPointer({ x, y })
controls.setIntensity(0.8)
controls.invalidateSource()
controls.capture()
```

Capturing is a secondary utility. The live interactive renderer remains the primary product.

## Framework-neutral core API

```ts
const renderer = createShaderImage(canvas, {
  src,
  effect: "particles",
  options: {},
})

renderer.setEffect("dither")
renderer.updateOptions({ scale: 4 })
renderer.pause()
renderer.play()
renderer.destroy()
```

## Media sources

### Images

Supported image inputs include URLs, uploaded `File` objects, `HTMLImageElement`, and `ImageBitmap`. Browser-supported PNG, JPEG, WebP, and AVIF files require no package-specific decoder.

Uploaded files are processed locally through object URLs, which the package revokes when no longer needed. Remote sources require appropriate CORS headers.

### Video

Supported video inputs include URLs, uploaded video files, and existing `HTMLVideoElement` instances. The consumer may let the component own basic playback or supply and control the element.

Video textures update only while playback is active and the component is visible. The renderer uses `requestVideoFrameCallback()` when available and falls back safely when it is not.

### Canvas

Supported canvas inputs include `HTMLCanvasElement` and `OffscreenCanvas` where the browser can upload them as textures. Consumers can explicitly invalidate a canvas source or mark it continuous.

### Transparency and alpha masking

All effects preserve source alpha. Fully transparent pixels remain transparent, and partially transparent pixels retain proportional opacity. Fullscreen effects output premultiplied color so transparent RGB data cannot leak into the composited canvas.

Particle effects treat alpha as a physical allocation mask, not only a drawing mask. For static image sources, the renderer samples one alpha value per prospective grid cell and creates particle state only when that value meets the configurable `alphaThreshold`. Transparent regions therefore contain no invisible simulated particles, while partially transparent regions keep their original alpha in the point shader.

If browser security rules prevent CPU alpha sampling, the renderer falls back to the complete grid and performs alpha rejection in the shader. The visual result remains correct, but the optimization is unavailable. Dynamic video and canvas sources may re-sample their mask when the source is explicitly invalidated rather than rebuilding particle geometry every frame.

## Interaction model

Browser events are normalized once by the engine. Effects consume signals rather than installing their own listeners.

```ts
interface InteractionFrame {
  pointer: {
    position: [number, number]
    velocity: [number, number]
    pressure: number
    active: boolean
  }
  scroll: {
    progress: number
    velocity: number
  }
  viewport: {
    visible: boolean
    visibility: number
  }
  time: {
    elapsed: number
    delta: number
  }
}
```

Built-in interaction behaviors include:

- `none`
- `repel`
- `attract`
- `ripple`
- `distort`
- `reveal`
- `magnify`
- `flow`

Pointer coordinates are relative to the rendered canvas and remain correct under resizing, cropping, and scrolling.

## Built-in effects

### Flagship: Dither

Modes include ordered/Bayer, blue-noise or random threshold, monochrome, duotone, and palette-based dithering. Controls include scale, resolution, threshold, contrast, palette, pattern movement, and animation speed. Interactions include ripple, reveal, and pattern distortion.

### Flagship: Dot / Particle

Modes include fixed sampled grids, depth/displacement fields, spring-mounted particles, and free-settling particles. Sampling can use brightness, color, alpha, or edges. Controls include density, spacing, radius, depth, spring, damping, and sampling mode. Interactions include repel, attract, ripple, scatter, and flow.

### Flagship: Halftone

Modes include circular cells, line cells, crosshatch, RGB separation, and CMYK separation. Controls include frequency, cell size, angle, shape, contrast, and channel offset. Interactions include magnification, warping, reveal, and channel separation.

### Supporting families

1. **Displacement:** noise displacement, liquid lens, directional waves, refraction, and scroll deformation.
2. **Pixelation:** square, rectangular, and mosaic cells; dynamic resolution; focus reveal; trails.
3. **Chromatic:** RGB split, radial aberration, velocity separation, and prism effects.
4. **Grain / Noise:** film grain, digital noise, color grain, texture overlays, and luminance-sensitive grain.
5. **Edge / Glitch:** edge extraction, scanline displacement, block glitch, and signal tearing.
6. **ASCII / Glyph:** glyph atlases, luminance mapping, source-color mode, custom character sets, and adjustable cell resolution.

## Presets

Presets are serializable configuration objects. Consumers may override any documented option.

Targets for the initial release:

- Six polished presets for each flagship family
- Three polished presets for each supporting family
- Approximately 36 built-in presets total

Every preset must have a clear visual purpose rather than existing only to increase count.

## Custom effect plugin API

Developers register structured effect definitions:

```ts
export const heatVision = defineEffect({
  id: "heat-vision",
  source: {
    vertex: vertexShader,
    fragment: fragmentShader,
  },
  uniforms: {
    intensity: {
      type: "float",
      default: 0.6,
      min: 0,
      max: 1,
    },
    hotColor: {
      type: "color",
      default: "#ff3b00",
    },
  },
  presets: {
    subtle: { intensity: 0.25 },
    extreme: { intensity: 1 },
  },
  interaction: {
    pointer: true,
    scroll: true,
    time: true,
  },
})
```

Plugins may define:

- Vertex and fragment shaders
- Typed uniforms, defaults, and validation constraints
- Presets
- Fullscreen, point, or instanced geometry
- Required interaction signals
- Setup and per-frame hooks
- Additional textures
- Resource cleanup
- Capability checks and fallback behavior

The plugin interface is constrained so the engine can guarantee cleanup, scheduling, context restoration, and predictable compatibility. Unrestricted raw WebGL2 context access is not part of the stable v1 plugin API.

## Rendering lifecycle

1. Render a semantic container, accessible fallback media, and canvas.
2. Observe the rendered container size.
3. Resolve and decode the source.
4. Create the WebGL2 context and upload the source texture.
5. Initialize the selected effect's program, geometry, and uniforms.
6. Render only while animation or changed input requires it.
7. Pause when offscreen or when the document is hidden.
8. Dispose every texture, buffer, program, observer, callback, and event listener on teardown.

Uniform-only option changes do not rebuild the renderer. Geometry is reused when effects are compatible and rebuilt when an effect requires a different geometry strategy.

## Performance and quality

`quality="auto"` is the default. Supported values are `auto`, `low`, `medium`, and `high`.

Quality may control:

- Canvas pixel ratio
- Texture resolution
- Particle density
- Simulation iterations
- Glyph or cell resolution
- Optional antialiasing

Static effects render once and sleep. Animated effects request frames only while active. Interactive effects wake on input and settle. Offscreen components pause through `IntersectionObserver`, and hidden pages pause through the Page Visibility API.

Automatic quality responds to sustained frame-time pressure and uses hysteresis to avoid rapid visual oscillation.

## Error handling and fallback

```ts
type ShaderImageError =
  | { code: "WEBGL_UNAVAILABLE" }
  | { code: "IMAGE_LOAD_FAILED"; cause: unknown }
  | { code: "IMAGE_CORS_BLOCKED"; url: string }
  | { code: "VIDEO_LOAD_FAILED"; cause: unknown }
  | { code: "SHADER_COMPILE_FAILED"; effect: string }
  | { code: "PLUGIN_INVALID"; effect: string; reason: string }
  | { code: "CONTEXT_LOST" }
```

For any unrecoverable error, the component calls `onError`, removes or hides the unusable canvas, and exposes the original media fallback while preserving dimensions, cropping, alternative text, and layout.

Context loss triggers one controlled restoration attempt. Persistent failure leaves the component in fallback mode.

## Accessibility and privacy

- Image alternative text remains available to assistive technology.
- Decorative sources support `alt=""`.
- Effects do not introduce keyboard focus unless they expose an actual control.
- `prefers-reduced-motion` disables autoplay and high-motion interaction by default.
- Essential information must not depend only on a visual effect.
- Uploaded local files remain in the browser and are not transmitted by the package.

## Bundle strategy

- Effects are independently importable and tree-shakeable.
- Loading one effect does not bundle unrelated simulation or glyph resources.
- React and React DOM are peer dependencies.
- Browser-only initialization is lazy and safe to import during Next.js server rendering.
- Development builds provide detailed shader diagnostics.
- Production builds omit unnecessary diagnostic payloads.

## Testing

### Unit tests

Cover option validation, preset resolution, coordinate normalization, velocity smoothing, scroll mapping, quality selection, scheduler wake/sleep behavior, plugin schemas, and disposal decisions.

### Shader and plugin conformance

Compile and link every shader in WebGL2. Validate uniforms and required attributes. Exercise documented option ranges. Custom-effect conformance tests verify compilation, cleanup, resize, source replacement, context restoration, reduced motion, and duplicate IDs.

The testing package exposes a public conformance helper:

```ts
await validateEffectPlugin(customEffect)
```

### Visual regression

Render fixed source fixtures at deterministic dimensions and compare output with a small cross-GPU tolerance. Cover every mode and preset, deterministic interaction coordinates, scroll states, reduced motion, and fallback output.

### Media tests

Cover image files, object URL cleanup, video playback states, seeking, looping, video-frame callbacks, canvas invalidation, source replacement, and remote CORS failures.

### React and Next.js integration

Cover mounting, unmounting, prop updates, effect switching, resizing, Strict Mode, SSR imports, hydration, cleanup, fallback accessibility, and structured errors.

### Real-device and performance checks

Exercise current Chrome, Safari, Firefox, Edge, iOS Safari, and Android Chrome. Benchmark one large renderer, many thumbnails, multiple videos, high-density particles, scrolling galleries, rapid effect switching, and sustained pointer movement.

## Documentation

The initial documentation includes:

1. React quick start
2. Next.js App Router example
3. Local file uploads
4. Video and canvas sources
5. Interaction recipes
6. Complete effect and preset gallery
7. Custom effect tutorial
8. Uniform and geometry reference
9. Performance guide
10. Accessibility and reduced-motion guide
11. CORS and WebGL troubleshooting
12. Semantic-versioning and migration policy

## Compatibility and versioning

The package targets React 19, current supported Next.js App Router releases, TypeScript, ESM, modern evergreen browsers with WebGL2, current iOS Safari, and current Android Chrome. Exact minimum versions will be chosen from current official documentation during implementation.

Stable public contracts include component props, effect IDs and documented options, plugin schemas, source contracts, error codes, and released preset names. Shader implementation details, GPU geometry layouts, and adaptive-quality heuristics remain private.

## Out of scope for v1

- Visual shader editor
- Framer and Figma adapters
- Vue and Svelte adapters
- Web Component adapter
- WebGPU renderer
- Webcam permissions and MediaStream ownership
- Server-side GPU rendering
- Hosted presets, accounts, storage, billing, or marketplace infrastructure

## Acceptance criteria

The v1 implementation is complete when:

- All nine effect families are available, with Dither, Dot/Particle, and Halftone meeting the flagship depth described above.
- Approximately 36 useful presets ship.
- Image, video, and canvas sources work through both core and React APIs.
- Pointer, touch, scroll, viewport, and time signals are normalized and reusable across effects.
- Custom effects can be registered and validated through the plugin API.
- React and Next.js consumers receive typed, SSR-safe components.
- Renderers pause, resume, resize, and dispose resources correctly.
- Failures preserve an accessible static media fallback.
- Automated tests and real-device checks cover the documented contracts.
