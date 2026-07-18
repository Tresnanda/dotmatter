import { describe, expect, it } from "vitest"
import { stepSpringValue } from "../src/index.js"

describe("stepSpringValue", () => {
  it("releases gradually instead of snapping to zero", () => {
    const next = stepSpringValue(
      { value: 1, velocity: 0 },
      0,
      { response: 0.32, dampingRatio: 1, deltaTime: 1 / 60 },
    )

    expect(next.value).toBeGreaterThan(0)
    expect(next.value).toBeLessThan(1)
  })
})
