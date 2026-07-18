import { describe, expect, it } from "vitest"
import { ambientModes, effectCatalog } from "./effects.js"

describe("effectCatalog", () => {
  it("exposes all seven effect families", () => {
    expect(effectCatalog.map((entry) => entry.id)).toEqual([
      "particles",
      "dither",
      "halftone",
      "ascii",
      "led",
      "stitch",
      "scanline",
    ])
  })

  it("offers ambient motion modes including a still default", () => {
    expect(ambientModes.map((mode) => mode.id)).toEqual([
      "none",
      "wave",
      "breathe",
      "flow",
      "jitter",
    ])
  })
})
