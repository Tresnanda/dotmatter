import { describe, expect, it } from "vitest"
import { createEffectRegistry, defineEffect } from "../src/index.js"

const effect = defineEffect({
  id: "dither",
  source: {
    vertex: "void main() {}",
    fragment: "void main() {}",
  },
  uniforms: {},
})

describe("effect registry", () => {
  it("returns a registered effect by id", () => {
    const registry = createEffectRegistry([effect])

    expect(registry.get("dither")).toBe(effect)
  })

  it("rejects duplicate effect ids", () => {
    expect(() => createEffectRegistry([effect, effect])).toThrowError(
      'Effect "dither" is already registered',
    )
  })
})
