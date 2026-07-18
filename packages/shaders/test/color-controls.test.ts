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

describe("universal color controls", () => {
  it.each(allEffects)(
    "%s exposes colorMode (source vs tint) and a tint color",
    (_name, effect) => {
      // colorMode: 0 = source image colors, 1 = custom tint.
      expect(effect.uniforms).toHaveProperty("colorMode")
      expect(effect.uniforms).toHaveProperty("tint")
      expect(
        (effect.uniforms as Record<string, { type: string }>)["tint"]?.type,
      ).toBe("color")
    },
  )

  it.each(allEffects)("%s blends source and tint in its fragment", (_name, effect) => {
    expect(effect.source.fragment).toContain("u_colorMode")
    expect(effect.source.fragment).toContain("u_tint")
  })

  it("dither keeps its two-tone palette as the tint pair", () => {
    expect(ditherEffect.uniforms).toHaveProperty("colorDark")
    expect(ditherEffect.uniforms).toHaveProperty("colorLight")
  })

  it("dither paints dark ink instead of leaving it transparent", () => {
    // Opaque tiles must render the full two-tone palette: alpha comes from
    // the source pixel, not from the Bayer ink bit — otherwise the dark ink
    // color can never be seen.
    expect(ditherEffect.source.fragment).toContain("float alpha = v_sourceAlpha;")
    expect(ditherEffect.source.fragment).not.toContain("v_sourceAlpha * ink")
  })
})
