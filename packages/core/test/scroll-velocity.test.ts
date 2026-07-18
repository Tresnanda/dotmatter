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

function twoParticles(): ParticleFieldState {
  return {
    count: 2,
    home: new Float32Array([0.3, 0.5, 0.7, 0.5]),
    positions: new Float32Array([0.3, 0.5, 0.7, 0.5]),
    velocities: new Float32Array([0, 0, 0, 0]),
    sourceUvs: new Float32Array([0.3, 0.5, 0.7, 0.5]),
  }
}

describe("scroll velocity smear", () => {
  it("visibly stretches the field during a sustained scroll", () => {
    const field = oneParticle()

    for (let frame = 0; frame < 12; frame += 1) {
      stepParticleField(field, { ...baseStep, scrollVelocity: 2 })
    }

    // A fifth of a second of moderate scrolling must move particles at
    // least ~2% of the field — clearly perceptible, not a sub-pixel twitch.
    expect(Math.abs(field.positions[1]! - 0.5)).toBeGreaterThan(0.02)
  })

  it("lags particles by different amounts so the smear stretches, not slides", () => {
    const field = twoParticles()

    for (let frame = 0; frame < 12; frame += 1) {
      stepParticleField(field, { ...baseStep, scrollVelocity: 2 })
    }

    // Uniform translation is invisible while the page itself scrolls; the
    // per-particle lag variation is what reads as a smear.
    expect(field.positions[1]).not.toBeCloseTo(field.positions[3]!, 4)
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
