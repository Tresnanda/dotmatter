import { describe, expect, it } from "vitest"
import { stepParticleField, type ParticleFieldState } from "../src/index.js"

function twoParticles(): ParticleFieldState {
  return {
    count: 2,
    home: new Float32Array([0.2, 0.5, 0.8, 0.5]),
    positions: new Float32Array([0.2, 0.5, 0.8, 0.5]),
    velocities: new Float32Array([0, 0, 0, 0]),
    sourceUvs: new Float32Array([0.2, 0.5, 0.8, 0.5]),
  }
}

describe("multiple pointers", () => {
  it("each extra pointer applies its own independent push zone", () => {
    const field = twoParticles()

    stepParticleField(field, {
      pointer: [0.15, 0.5],
      pointerActive: true,
      // A second finger near the right particle.
      extraPointers: [[0.75, 0.5]],
      deltaTime: 1 / 60,
      aspectRatio: 1,
      force: 18,
      forceRadius: 0.15,
      spring: 0,
      damping: 1,
    })

    // Left particle pushed right by primary; right particle pushed right by extra.
    expect(field.positions[0]).toBeGreaterThan(0.2)
    expect(field.positions[2]).toBeGreaterThan(0.8)
  })
})
