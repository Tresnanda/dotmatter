import { describe, expect, it } from "vitest"
import {
  createParticleField,
  stepParticleField,
  type ParticleFieldState,
} from "../src/index.js"

function oneParticle(): ParticleFieldState {
  return {
    count: 1,
    home: new Float32Array([0.5, 0.5]),
    positions: new Float32Array([0.5, 0.5]),
    velocities: new Float32Array([0, 0]),
    sourceUvs: new Float32Array([0.5, 0.5]),
  }
}

describe("createParticleField", () => {
  it("omits cells whose sampled source alpha is below the threshold", () => {
    const field = createParticleField({
      width: 40,
      height: 20,
      spacing: 10,
      alphaMask: new Uint8Array([255, 0, 140, 80, 255, 127, 128, 10]),
      alphaThreshold: 128,
    })

    expect(field.count).toBe(4)
    expect(Array.from(field.sourceUvs)).toEqual([
      0.125, 0.75,
      0.625, 0.75,
      0.125, 0.25,
      0.625, 0.25,
    ])
  })

  it("creates one independently addressable particle per grid cell", () => {
    const field = createParticleField({ width: 40, height: 20, spacing: 10 })

    expect(field.count).toBe(8)
    expect(field.positions).not.toBe(field.home)
    expect(Array.from(field.positions)).toEqual(Array.from(field.home))
    expect(field.sourceUvs).toHaveLength(16)
  })
})

describe("stepParticleField", () => {
  it("carries momentum after the pointer leaves", () => {
    const field = oneParticle()
    field.velocities[0] = 0.4

    stepParticleField(field, {
      pointer: [0, 0],
      pointerActive: false,
      deltaTime: 1 / 60,
      aspectRatio: 1,
      force: 18,
      forceRadius: 0.2,
      spring: 0,
      damping: 1,
    })

    expect(field.positions[0]).toBeGreaterThan(0.5)
  })

  it("springs a displaced particle back toward its home position", () => {
    const field = oneParticle()
    field.positions[0] = 0.7

    for (let frame = 0; frame < 180; frame += 1) {
      stepParticleField(field, {
        pointer: [0, 0],
        pointerActive: false,
        deltaTime: 1 / 60,
        aspectRatio: 1,
        force: 18,
        forceRadius: 0.2,
        spring: 20,
        damping: 0.88,
      })
    }

    expect(Math.abs(field.positions[0]! - 0.5)).toBeLessThan(0.02)
  })

  it("clamps long frame gaps so particles cannot explode after tab suspension", () => {
    const field = oneParticle()
    field.velocities[0] = 1

    stepParticleField(field, {
      pointer: [0, 0],
      pointerActive: false,
      deltaTime: 2,
      aspectRatio: 1,
      force: 18,
      forceRadius: 0.2,
      spring: 0,
      damping: 1,
    })

    expect(field.positions[0]).toBeLessThanOrEqual(0.534)
  })

  it("pushes particles radially away from a stationary hovered pointer", () => {
    const field = oneParticle()

    stepParticleField(field, {
      pointer: [0.4, 0.5],
      pointerVelocity: [0, 0],
      pointerActive: true,
      deltaTime: 1 / 60,
      aspectRatio: 1,
      force: 18,
      forceRadius: 0.2,
      spring: 0,
      damping: 1,
    })

    expect(field.positions[0]).toBeGreaterThan(0.5)
  })

  it("returns with a perceptible but slight overshoot bounce", () => {
    const field = oneParticle()
    field.positions[0] = 0.56

    let minPosition = 0.56
    for (let frame = 0; frame < 240; frame += 1) {
      stepParticleField(field, {
        pointer: [0, 0],
        pointerActive: false,
        deltaTime: 1 / 60,
        aspectRatio: 1,
        force: 18,
        forceRadius: 0.2,
        spring: 26,
        damping: 0.92,
      })
      minPosition = Math.min(minPosition, field.positions[0]!)
    }

    // The overshoot must be visible (>= ~8% of the displacement) but stay
    // slight (<= ~22%) — one clear liquid bounce, then settle.
    const overshoot = 0.5 - minPosition
    expect(overshoot).toBeGreaterThan(0.06 * 0.08)
    expect(overshoot).toBeLessThan(0.06 * 0.22)
    expect(Math.abs(field.positions[0]! - 0.5)).toBeLessThan(0.005)
  })

  it("pushes nearby particles in the direction of cursor movement", () => {
    const field = oneParticle()

    stepParticleField(field, {
      pointer: [0.4, 0.5],
      pointerVelocity: [1, 0],
      pointerActive: true,
      deltaTime: 1 / 60,
      aspectRatio: 1,
      force: 18,
      forceRadius: 0.2,
      spring: 0,
      damping: 1,
    })

    expect(field.positions[0]).toBeGreaterThan(0.5)
  })
})
