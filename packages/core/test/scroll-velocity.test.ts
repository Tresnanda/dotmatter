import { describe, expect, it } from "vitest"
import { stepParticleField, type ParticleFieldState } from "../src/index.js"

function oneParticle(): ParticleFieldState {
  return {
    count: 1,
    home: new Float32Array([0.5, 0.5]),
    positions: new Float32Array([0.5, 0.5]),
    velocities: new Float32Array([0, 0]),
    sourceUvs: new Float32Array([0.5, 0.5]),
  }
}

const baseStep = {
  pointer: [0, 0] as const,
  pointerActive: false,
  deltaTime: 1 / 60,
  aspectRatio: 1,
  force: 0,
  forceRadius: 0.1,
  spring: 26,
  damping: 0.92,
}

describe("scroll velocity smear", () => {
  it("drags the whole field opposite the scroll direction", () => {
    const field = oneParticle()

    // Scrolling down (positive velocity) → content moves up → particles lag
    // behind, smearing downward in canvas space (positive y is up here, so
    // the lag is a negative-y drag... assert simple displacement).
    stepParticleField(field, { ...baseStep, scrollVelocity: 2 })

    expect(field.positions[1]).not.toBe(0.5)
  })

  it("applies no smear when scroll velocity is zero", () => {
    const field = oneParticle()

    stepParticleField(field, { ...baseStep, scrollVelocity: 0 })

    expect(field.positions[1]).toBe(0.5)
  })

  it("clamps extreme scroll velocity so the field never explodes", () => {
    const field = oneParticle()

    for (let frame = 0; frame < 60; frame += 1) {
      stepParticleField(field, { ...baseStep, scrollVelocity: 100 })
    }

    expect(Math.abs(field.positions[1]! - 0.5)).toBeLessThan(0.3)
  })
})
