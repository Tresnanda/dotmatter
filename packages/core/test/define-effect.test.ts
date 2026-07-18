import { describe, expect, expectTypeOf, it } from "vitest"
import { defineEffect, resolveEffectOptions } from "../src/index.js"

describe("defineEffect", () => {
  it("rejects an empty effect id", () => {
    expect(() =>
      defineEffect({
        id: "",
        source: {
          vertex: "void main() {}",
          fragment: "void main() {}",
        },
        uniforms: {},
      }),
    ).toThrowError("Effect id must not be empty")
  })

  it("resolves uniform defaults with consumer overrides", () => {
    const effect = defineEffect({
      id: "heat",
      source: {
        vertex: "void main() {}",
        fragment: "void main() {}",
      },
      uniforms: {
        intensity: {
          type: "float",
          default: 0.5,
          min: 0,
          max: 1,
        },
        tint: {
          type: "color",
          default: "#ff3300",
        },
      },
    })

    expect(resolveEffectOptions(effect, { intensity: 0.8 })).toEqual({
      intensity: 0.8,
      tint: "#ff3300",
    })
  })

  it("rejects unknown uniform overrides", () => {
    const effect = defineEffect({
      id: "heat",
      source: {
        vertex: "void main() {}",
        fragment: "void main() {}",
      },
      uniforms: {
        intensity: {
          type: "float",
          default: 0.5,
        },
      },
    })

    expect(() => resolveEffectOptions(effect, { strength: 1 } as never)).toThrowError(
      'Unknown uniform "strength" for effect "heat"',
    )
  })

  it("applies preset values before consumer overrides", () => {
    const effect = defineEffect({
      id: "heat",
      source: {
        vertex: "void main() {}",
        fragment: "void main() {}",
      },
      uniforms: {
        intensity: {
          type: "float",
          default: 0.5,
          min: 0,
          max: 1,
        },
        tint: {
          type: "color",
          default: "#ff3300",
        },
      },
      presets: {
        subtle: {
          intensity: 0.2,
          tint: "#ffaa00",
        },
      },
    })

    expect(resolveEffectOptions(effect, { intensity: 0.3 }, "subtle")).toEqual({
      intensity: 0.3,
      tint: "#ffaa00",
    })
  })

  it("infers resolved option types from uniform definitions", () => {
    const effect = defineEffect({
      id: "typed",
      source: {
        vertex: "void main() {}",
        fragment: "void main() {}",
      },
      uniforms: {
        intensity: { type: "float", default: 0.5 },
        tint: { type: "color", default: "#ffffff" },
        enabled: { type: "boolean", default: true },
      },
    })

    const options = resolveEffectOptions(effect)

    expectTypeOf(options.intensity).toEqualTypeOf<number>()
    expectTypeOf(options.tint).toEqualTypeOf<string>()
    expectTypeOf(options.enabled).toEqualTypeOf<boolean>()
  })

  it("rejects float values outside their declared range", () => {
    const effect = defineEffect({
      id: "heat",
      source: {
        vertex: "void main() {}",
        fragment: "void main() {}",
      },
      uniforms: {
        intensity: {
          type: "float",
          default: 0.5,
          min: 0,
          max: 1,
        },
      },
    })

    expect(() => resolveEffectOptions(effect, { intensity: 1.2 })).toThrowError(
      'Uniform "intensity" for effect "heat" must be at most 1',
    )
  })
})
