import { describe, expect, it } from "vitest"
import { ditherEffect, halftoneEffect } from "../src/index.js"

describe("transparent particle effects", () => {
  it.each([
    ["dither", ditherEffect],
    ["halftone", halftoneEffect],
  ])("premultiplies %s output by the sampled source alpha", (_name, effect) => {
    // Every particle carries its source pixel's alpha; fragments multiply
    // color by that alpha and discard nearly-invisible output.
    expect(effect.source.fragment).toContain("v_sourceAlpha")
    expect(effect.source.fragment).toMatch(/\* alpha, alpha\)/)
    expect(effect.source.fragment).toContain("discard")
  })

  it.each([
    ["dither", ditherEffect],
    ["halftone", halftoneEffect],
  ])("lets %s skip fully transparent cells via alphaThreshold", (_name, effect) => {
    expect(effect.uniforms).toHaveProperty("alphaThreshold")
  })
})
