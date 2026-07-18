import { describe, expect, it } from "vitest"
import { effectControls } from "./controls.js"

describe("effectControls", () => {
  it("gives every flagship the same particle push controls first", () => {
    const pushKeys = ["force", "forceRadius", "spring", "damping"]
    for (const controls of Object.values(effectControls)) {
      expect(controls.slice(0, 4).map((control) => control.key)).toEqual(pushKeys)
    }
  })

  it("keeps effect-specific appearance controls after the push controls", () => {
    expect(effectControls.dither.map((c) => c.key)).toContain("threshold")
    expect(effectControls.particles.map((c) => c.key)).toContain("pointSize")
    expect(effectControls.halftone.map((c) => c.key)).toContain("channelOffset")
  })
})
