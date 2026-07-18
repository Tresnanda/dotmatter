import { describe, expect, it } from "vitest"
import { normalizePointerPosition } from "../src/index.js"

describe("normalizePointerPosition", () => {
  it("maps client coordinates into bottom-left normalized canvas space", () => {
    expect(
      normalizePointerPosition(
        { x: 150, y: 75 },
        { left: 100, top: 50, width: 200, height: 100 },
      ),
    ).toEqual([0.25, 0.75])
  })

  it("clamps coordinates outside the canvas bounds", () => {
    expect(
      normalizePointerPosition(
        { x: 350, y: 25 },
        { left: 100, top: 50, width: 200, height: 100 },
      ),
    ).toEqual([1, 1])
  })
})
