import { describe, expect, it } from "vitest"
import { resolveEffectOptions } from "@dotmatter/core"
import { ditherEffect } from "../src/index.js"

describe("ditherEffect", () => {
  it("provides an ordered dither preset with configurable colors", () => {
    expect(ditherEffect.id).toBe("dither")
    expect(resolveEffectOptions(ditherEffect, {}, "editorial")).toMatchObject({
      scale: 4,
      threshold: 0.5,
      contrast: 1.15,
      colorDark: "#0a0a0a",
      colorLight: "#f5f5f0",
    })
  })
})
