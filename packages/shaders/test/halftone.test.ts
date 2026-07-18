import { describe, expect, it } from "vitest"
import { resolveEffectOptions } from "@dotmatter/core"
import { halftoneEffect } from "../src/index.js"

describe("halftoneEffect", () => {
  it("provides a print-oriented CMYK preset", () => {
    expect(halftoneEffect.id).toBe("halftone")
    expect(halftoneEffect.geometry).toEqual({ type: "particles" })
    expect(resolveEffectOptions(halftoneEffect, {}, "cmyk-print")).toMatchObject({
      spacing: 10,
      contrast: 1.2,
      // 0 = source colors (RGB-separation print look)
      colorMode: 0,
      channelOffset: 0.35,
      spring: 24,
    })
  })
})
