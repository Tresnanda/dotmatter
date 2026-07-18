export interface ParticleFieldState {
  count: number
  home: Float32Array
  positions: Float32Array
  velocities: Float32Array
  sourceUvs: Float32Array
}

export interface ParticleFieldDimensions {
  width: number
  height: number
  spacing: number
  alphaMask?: Uint8Array
  alphaThreshold?: number
}

export type AmbientMode = "wave" | "breathe" | "flow" | "jitter"

export interface AmbientMotion {
  mode: AmbientMode
  /** 0–2: how far particles drift from home. */
  strength: number
  /** 0–3: how fast the motion evolves. */
  speed: number
  /** 0.25–4: spatial frequency — how tightly packed the motion pattern is. */
  scale: number
}

export interface ParticleFieldStep {
  pointer: readonly [number, number]
  pointerVelocity?: readonly [number, number]
  pointerActive: boolean
  deltaTime: number
  aspectRatio: number
  force: number
  forceRadius: number
  spring: number
  damping: number
  /** Simulation clock in seconds; required for ambient motion. */
  time?: number
  ambient?: AmbientMotion
  /**
   * Scroll-reveal progress 0–1. At 0, particles seek a scattered target
   * (drifted below their home with hashed offsets); at 1 they assemble at
   * home. Undefined = fully assembled. Values are interruptible — scrolling
   * back re-scatters through the same spring.
   */
  reveal?: number
}

// Cheap deterministic per-particle hash for jitter phase offsets.
function hash(index: number): number {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

// Time-varying acceleration applied to every particle each step. All modes
// are forces (not position offsets) so they compose with cursor pushes and
// the home spring exactly like any other physical influence.
function ambientAcceleration(
  ambient: AmbientMotion,
  homeX: number,
  homeY: number,
  index: number,
  time: number,
): [number, number] {
  const amplitude = ambient.strength * 0.55
  const clock = time * ambient.speed
  const frequency = ambient.scale * Math.PI * 2

  switch (ambient.mode) {
    case "wave": {
      // A diagonal sine front rolling through the field.
      const phase = homeX * frequency + clock * 1.6
      return [
        Math.cos(phase) * amplitude * 0.35,
        Math.sin(phase + homeY * frequency * 0.5) * amplitude,
      ]
    }
    case "breathe": {
      // Radial pulse from the center.
      const deltaX = homeX - 0.5
      const deltaY = homeY - 0.5
      const distance = Math.hypot(deltaX, deltaY) + 0.0001
      const pulse = Math.sin(clock * 1.8 - distance * frequency * 0.6) * amplitude
      return [(deltaX / distance) * pulse, (deltaY / distance) * pulse]
    }
    case "flow": {
      // Pseudo-noise currents: two incommensurate sine fields.
      const angle =
        Math.sin(homeX * frequency + clock) * 1.7 +
        Math.cos(homeY * frequency * 1.3 - clock * 0.7) * 1.3
      return [Math.cos(angle) * amplitude, Math.sin(angle) * amplitude]
    }
    case "jitter": {
      // Per-particle shimmer with hashed phase so neighbors decorrelate.
      const phase = hash(index) * Math.PI * 2
      return [
        Math.sin(clock * 7 + phase) * amplitude * 0.6,
        Math.cos(clock * 6.3 + phase * 1.7) * amplitude * 0.6,
      ]
    }
  }
}

export function createParticleField(
  dimensions: ParticleFieldDimensions,
): ParticleFieldState {
  const columns = Math.max(1, Math.floor(dimensions.width / dimensions.spacing))
  const rows = Math.max(1, Math.floor(dimensions.height / dimensions.spacing))
  const totalCells = columns * rows
  const alphaThreshold = dimensions.alphaThreshold ?? 1
  const homeValues: number[] = []
  const sourceUvValues: number[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cellIndex = row * columns + column
      const alpha = dimensions.alphaMask?.[cellIndex] ?? 255
      if (alpha < alphaThreshold) continue

      const x = (column + 0.5) / columns
      const y = 1 - (row + 0.5) / rows
      homeValues.push(x, y)
      sourceUvValues.push(x, y)
    }
  }

  const home = new Float32Array(homeValues)
  const sourceUvs = new Float32Array(sourceUvValues)
  const count = home.length / 2

  if (
    dimensions.alphaMask !== undefined &&
    dimensions.alphaMask.length !== totalCells
  ) {
    throw new Error(
      `Alpha mask length ${dimensions.alphaMask.length} does not match particle grid size ${totalCells}`,
    )
  }

  return {
    count,
    home,
    positions: home.slice(),
    velocities: new Float32Array(count * 2),
    sourceUvs,
  }
}

export function stepParticleField(
  field: ParticleFieldState,
  step: ParticleFieldStep,
): void {
  const deltaTime = Math.min(Math.max(step.deltaTime, 0), 1 / 30)

  for (let index = 0; index < field.count; index += 1) {
    const offset = index * 2
    const positionX = field.positions[offset]!
    const positionY = field.positions[offset + 1]!
    let velocityX = field.velocities[offset]!
    let velocityY = field.velocities[offset + 1]!

    let homeX = field.home[offset]!
    let homeY = field.home[offset + 1]!

    if (step.reveal !== undefined && step.reveal < 1) {
      // Assembly reveal: the spring target slides from a hashed scatter
      // position (drifted downward, spread sideways) to the true home as
      // reveal goes 0 → 1. Cheap per-particle hash keeps neighbors
      // decorrelated so the reveal reads as a cloud condensing, not a slide.
      const scatterSeed = hash(index)
      const scatterX = homeX + (scatterSeed - 0.5) * 0.6
      const scatterY = homeY - 0.35 - scatterSeed * 0.4
      const progress = Math.min(Math.max(step.reveal, 0), 1)
      // Ease-out on the blend: early scroll moves particles most of the way,
      // the last stretch is a gentle settle.
      const eased = 1 - (1 - progress) * (1 - progress)
      homeX = scatterX + (homeX - scatterX) * eased
      homeY = scatterY + (homeY - scatterY) * eased
    }

    velocityX += (homeX - positionX) * step.spring * deltaTime
    velocityY += (homeY - positionY) * step.spring * deltaTime

    if (step.ambient !== undefined && step.ambient.strength > 0) {
      const [ambientX, ambientY] = ambientAcceleration(
        step.ambient,
        homeX,
        homeY,
        index,
        step.time ?? 0,
      )
      velocityX += ambientX * deltaTime
      velocityY += ambientY * deltaTime
    }

    const pointerVelocity = step.pointerVelocity ?? [0, 0]
    const pointerSpeed = Math.hypot(
      pointerVelocity[0] * step.aspectRatio,
      pointerVelocity[1],
    )

    if (step.pointerActive) {
      const deltaX = (positionX - step.pointer[0]) * step.aspectRatio
      const deltaY = positionY - step.pointer[1]
      const distance = Math.hypot(deltaX, deltaY)

      if (distance > 0 && distance < step.forceRadius) {
        const falloff = 1 - distance / step.forceRadius
        const shapedFalloff = falloff * falloff
        // Constant radial pressure gives the small hover circle; cursor
        // velocity adds a directional sweep so fast strokes feel fluid.
        const radialAcceleration = step.force * shapedFalloff
        const sweepScale = Math.min(pointerSpeed, 1.6) * 0.55
        velocityX +=
          ((deltaX / distance / step.aspectRatio) * radialAcceleration +
            pointerVelocity[0] * step.force * shapedFalloff * sweepScale) *
          deltaTime
        velocityY +=
          ((deltaY / distance) * radialAcceleration +
            pointerVelocity[1] * step.force * shapedFalloff * sweepScale) *
          deltaTime
      }
    }

    const damping = Math.pow(step.damping, deltaTime * 60)
    velocityX *= damping
    velocityY *= damping

    field.velocities[offset] = velocityX
    field.velocities[offset + 1] = velocityY
    field.positions[offset] = positionX + velocityX * deltaTime
    field.positions[offset + 1] = positionY + velocityY * deltaTime
  }
}
