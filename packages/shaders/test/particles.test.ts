import { describe, expect, it } from "vitest"
import { resolveEffectOptions } from "@dotmatter/core"
import { particleEffect } from "../src/index.js"

describe("particleEffect", () => {
  it("provides a soft pointer-repel preset", () => {
    expect(particleEffect.id).toBe("particles")
    expect(particleEffect.geometry).toEqual({ type: "particles" })
    expect(resolveEffectOptions(particleEffect, {}, "soft-repel")).toMatchObject({
      spacing: 12,
      pointSize: 0.72,
      force: 14,
      forceRadius: 0.085,
      spring: 26,
      damping: 0.92,
      alphaThreshold: 0.04,
      invert: false,
    })
  })
})
