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

describe("scroll reveal", () => {
  it("holds particles scattered away from home at reveal 0", () => {
    const field = oneParticle()

    for (let frame = 0; frame < 120; frame += 1) {
      stepParticleField(field, { ...baseStep, reveal: 0 })
    }

    // The scatter target pulls the particle well away from home.
    expect(Math.abs(field.positions[1]! - 0.5)).toBeGreaterThan(0.1)
  })

  it("assembles particles at their homes at reveal 1", () => {
    const field = oneParticle()
    field.positions[1] = 0.9

    for (let frame = 0; frame < 240; frame += 1) {
      stepParticleField(field, { ...baseStep, reveal: 1 })
    }

    expect(Math.abs(field.positions[1]! - 0.5)).toBeLessThan(0.01)
  })

  it("mid-reveal holds particles partway between scatter and home", () => {
    const field = oneParticle()

    for (let frame = 0; frame < 240; frame += 1) {
      stepParticleField(field, { ...baseStep, reveal: 0.5 })
    }

    const offset = Math.abs(field.positions[1]! - 0.5)
    expect(offset).toBeGreaterThan(0.02)
    expect(offset).toBeLessThan(0.2)
  })

  it("reveal undefined behaves as fully assembled", () => {
    const field = oneParticle()

    stepParticleField(field, { ...baseStep })

    expect(field.positions[0]).toBe(0.5)
    expect(field.positions[1]).toBe(0.5)
  })
})
