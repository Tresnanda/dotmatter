import { describe, expect, it } from "vitest"
import {
  asciiEffect,
  ledEffect,
  scanlineEffect,
  stitchEffect,
} from "../src/index.js"

describe("figma/framer-style effect families", () => {
  it.each([
    ["ascii", asciiEffect],
    ["led", ledEffect],
    ["stitch", stitchEffect],
    ["scanline", scanlineEffect],
  ])("%s runs on the shared particle physics", (_name, effect) => {
    expect(effect.geometry).toEqual({ type: "particles" })
    expect(effect.uniforms).toHaveProperty("force")
    expect(effect.uniforms).toHaveProperty("forceRadius")
    expect(effect.uniforms).toHaveProperty("spring")
    expect(effect.uniforms).toHaveProperty("damping")
    expect(effect.uniforms).toHaveProperty("spacing")
    expect(effect.uniforms).toHaveProperty("alphaThreshold")
    expect(Object.keys(effect.presets ?? {}).length).toBeGreaterThan(0)
  })

  it("ascii picks a glyph by luminance inside the sprite", () => {
    expect(asciiEffect.source.fragment).toContain("gl_PointCoord")
    expect(asciiEffect.source.fragment).toContain("v_luminance")
  })

  it("led renders a glowing rounded pixel", () => {
    expect(ledEffect.source.fragment).toContain("gl_PointCoord")
    expect(ledEffect.uniforms).toHaveProperty("glow")
  })

  it("stitch draws an X mark", () => {
    expect(stitchEffect.source.fragment).toContain("abs(")
  })

  it("scanline thickness follows luminance", () => {
    expect(scanlineEffect.source.fragment).toContain("v_luminance")
  })
})
