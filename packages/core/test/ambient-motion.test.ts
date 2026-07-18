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
  spring: 20,
  damping: 0.9,
}

describe("ambient motion", () => {
  it("wave mode rolls particles without pointer input", () => {
    const field = oneParticle()

    for (let frame = 0; frame < 30; frame += 1) {
      stepParticleField(field, {
        ...baseStep,
        time: frame / 60,
        ambient: { mode: "wave", strength: 1, speed: 1, scale: 1 },
      })
    }

    expect(field.positions[1]).not.toBeCloseTo(0.5, 4)
  })

  it("no ambient mode leaves a resting field perfectly still", () => {
    const field = oneParticle()

    stepParticleField(field, { ...baseStep, time: 0.5 })

    expect(field.positions[0]).toBe(0.5)
    expect(field.positions[1]).toBe(0.5)
  })

  it("ambient displacement stays bounded by the spring", () => {
    const field = oneParticle()

    for (let frame = 0; frame < 600; frame += 1) {
      stepParticleField(field, {
        ...baseStep,
        time: frame / 60,
        ambient: { mode: "flow", strength: 1, speed: 1, scale: 1 },
      })
    }

    expect(Math.abs(field.positions[0]! - 0.5)).toBeLessThan(0.15)
    expect(Math.abs(field.positions[1]! - 0.5)).toBeLessThan(0.15)
  })
})
