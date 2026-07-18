import { describe, expect, it } from "vitest"
import { ditherEffect, halftoneEffect } from "../src/index.js"

describe("shared particle interaction", () => {
  it.each([
    ["dither", ditherEffect],
    ["halftone", halftoneEffect],
  ])("simulates %s cells as real pushed particles", (_name, effect) => {
    // Both effects must use the same particle geometry as the particle
    // effect so every cell is an independently simulated object that gets
    // physically pushed and springs back — not a warped sampling field.
    expect(effect.geometry).toEqual({ type: "particles" })
    expect(effect.source.vertex).toContain("a_position")
    expect(effect.source.vertex).toContain("a_sourceUv")
  })

  it("renders the fine Bayer pattern inside each dither particle sprite", () => {
    // One particle must carry a tile of sub-pixels, not act as a single
    // giant on/off pixel — otherwise dithering degrades to a blocky grid.
    expect(ditherEffect.source.fragment).toContain("gl_PointCoord")
    expect(ditherEffect.source.fragment).toContain("bayer4(")
    expect(ditherEffect.source.fragment).toContain("u_spacing")
  })

  it("keeps halftone dots inside their own cell so the screen stays visible", () => {
    // Sprite size must be exactly one cell (no overlap factor) or the dots
    // blend into a continuous image.
    expect(halftoneEffect.source.vertex).toContain("u_spacing * u_pixelRatio")
    expect(halftoneEffect.source.vertex).not.toContain("1.35")
  })

  it.each([
    ["dither", ditherEffect],
    ["halftone", halftoneEffect],
  ])("exposes the particle physics uniforms on %s", (_name, effect) => {
    expect(effect.uniforms).toHaveProperty("forceRadius")
    expect(effect.uniforms).toHaveProperty("force")
    expect(effect.uniforms).toHaveProperty("spring")
    expect(effect.uniforms).toHaveProperty("damping")
    expect(effect.uniforms).toHaveProperty("spacing")
  })
})
