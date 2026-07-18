import {
  asciiEffect,
  contourEffect,
  ditherEffect,
  halftoneEffect,
  ledEffect,
  mosaicEffect,
  particleEffect,
  ringsEffect,
  scanlineEffect,
  stitchEffect,
} from "@dotmatter/shaders"

export const effectCatalog = [
  {
    id: "particles",
    label: "Particles",
    description: "Soft dots sized by luminance.",
    effect: particleEffect,
    preset: "soft-repel",
  },
  {
    id: "dither",
    label: "Dither",
    description: "Ordered Bayer tiles, 1-bit editorial texture.",
    effect: ditherEffect,
    preset: "editorial",
  },
  {
    id: "halftone",
    label: "Halftone",
    description: "Print-style dots, tone as radius.",
    effect: halftoneEffect,
    preset: "cmyk-print",
  },
  {
    id: "ascii",
    label: "ASCII",
    description: "Glyph ramp picked by brightness.",
    effect: asciiEffect,
    preset: "terminal",
  },
  {
    id: "led",
    label: "LED",
    description: "Glowing matrix pixels, stadium screen.",
    effect: ledEffect,
    preset: "stadium",
  },
  {
    id: "stitch",
    label: "Stitch",
    description: "Cross-stitch X marks, embroidery feel.",
    effect: stitchEffect,
    preset: "embroidery",
  },
  {
    id: "scanline",
    label: "Scanline",
    description: "Bar segments, CRT / receipt printer.",
    effect: scanlineEffect,
    preset: "crt",
  },
  {
    id: "mosaic",
    label: "Mosaic",
    description: "Rounded tiles sized by tone.",
    effect: mosaicEffect,
    preset: "tiles",
  },
  {
    id: "rings",
    label: "Rings",
    description: "Concentric strokes, engraved medallions.",
    effect: ringsEffect,
    preset: "engraving",
  },
  {
    id: "contour",
    label: "Contour",
    description: "Gradient-angled strokes, pen sketch.",
    effect: contourEffect,
    preset: "sketch",
  },
] as const

export type PlaygroundEffectId = (typeof effectCatalog)[number]["id"]

export const ambientModes = [
  { id: "none", label: "Still" },
  { id: "wave", label: "Wave" },
  { id: "breathe", label: "Breathe" },
  { id: "flow", label: "Flow" },
  { id: "jitter", label: "Jitter" },
] as const

export type PlaygroundAmbientId = (typeof ambientModes)[number]["id"]
