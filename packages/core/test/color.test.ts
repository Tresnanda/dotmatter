import { describe, expect, it } from "vitest"
import { parseHexColor } from "../src/index.js"

describe("parseHexColor", () => {
  it("converts six-digit hex colors into normalized RGB", () => {
    expect(parseHexColor("#ff8000")).toEqual([1, 128 / 255, 0])
  })
})
