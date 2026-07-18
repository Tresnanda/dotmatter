import { describe, expect, it } from "vitest"
import { contourEffect, mosaicEffect, ringsEffect } from "../src/index.js"

describe("v0.3 effect families", () => {
  it.each([
    ["mosaic", mosaicEffect],
    ["rings", ringsEffect],
    ["contour", contourEffect],
  ])("%s runs on the shared particle physics with color + adjustments", (_name, effect) => {
    expect(effect.geometry).toEqual({ type: "particles" })
    expect(effect.uniforms).toHaveProperty("force")
    expect(effect.uniforms).toHaveProperty("spring")
    expect(effect.uniforms).toHaveProperty("spacing")
    expect(effect.uniforms).toHaveProperty("colorMode")
    expect(effect.uniforms).toHaveProperty("tint")
    expect(effect.uniforms).toHaveProperty("hue")
    expect(Object.keys(effect.presets ?? {}).length).toBeGreaterThan(0)
  })

  it("mosaic renders rounded tiles with luminance-driven inset", () => {
    expect(mosaicEffect.source.fragment).toContain("gl_PointCoord")
    expect(mosaicEffect.source.fragment).toContain("v_luminance")
  })

  it("rings renders concentric strokes whose count follows luminance", () => {
    expect(ringsEffect.source.fragment).toContain("fract(")
  })

  it("contour draws oriented line segments", () => {
    expect(contourEffect.uniforms).toHaveProperty("angleRange")
  })
})
