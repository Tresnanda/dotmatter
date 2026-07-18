import { describe, expect, it } from "vitest"
import {
  asciiEffect,
  ditherEffect,
  halftoneEffect,
  ledEffect,
  particleEffect,
  scanlineEffect,
  stitchEffect,
} from "../src/index.js"

const allEffects = [
  ["particles", particleEffect],
  ["dither", ditherEffect],
  ["halftone", halftoneEffect],
  ["ascii", asciiEffect],
  ["led", ledEffect],
  ["stitch", stitchEffect],
  ["scanline", scanlineEffect],
] as const

describe("universal image adjustments", () => {
  it.each(allEffects)(
    "%s exposes hue, saturation, and exposure alongside contrast",
    (_name, effect) => {
      expect(effect.uniforms).toHaveProperty("hue")
      expect(effect.uniforms).toHaveProperty("saturation")
      expect(effect.uniforms).toHaveProperty("exposure")
      expect(effect.uniforms).toHaveProperty("contrast")
    },
  )

  it.each(allEffects)(
    "%s applies the adjustments in the shared vertex sampler",
    (_name, effect) => {
      // Adjustments live in the vertex shader where the source is sampled,
      // so both luminance-driven geometry and color output see them.
      expect(effect.source.vertex).toContain("u_hue")
      expect(effect.source.vertex).toContain("u_saturation")
      expect(effect.source.vertex).toContain("u_exposure")
      expect(effect.source.vertex).toContain("v_adjustedColor")
    },
  )
})
