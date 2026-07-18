import { parseHexColor } from "./color.js"
import {
  resolveEffectOptions,
  type EffectDefinition,
  type UniformDefinition,
} from "./effect.js"
import { sampleSourceAlpha } from "./particle-alpha.js"
import {
  createParticleField,
  stepParticleField,
  type AmbientMotion,
  type ParticleFieldState,
} from "./particle-field.js"
import { stepSpringValue, type SpringValueState } from "./spring.js"
import { compileShaderProgram } from "./webgl.js"

export class WebGLUnavailableError extends Error {
  readonly code = "WEBGL_UNAVAILABLE"

  constructor() {
    super("WebGL2 is unavailable")
    this.name = "WebGLUnavailableError"
  }
}

export interface ShaderImageRendererOptions {
  effect: EffectDefinition
  effectOptions?: Record<string, unknown>
  preset?: string
  ambient?: AmbientMotion
}

export interface RenderFrame {
  time?: number
  pointer?: readonly [number, number]
  pointerActive?: boolean
}

export interface ShaderImageRenderer {
  render(frame?: RenderFrame): void
  resize(width: number, height: number, pixelRatio?: number): void
  setSource(source: TexImageSource, options?: { continuous?: boolean }): void
  updateEffectOptions(options: Record<string, unknown>, preset?: string): void
  setAmbient(ambient: AmbientMotion | null): void
  destroy(): void
}

function setEffectUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  definition: UniformDefinition,
  value: unknown,
): void {
  const location = gl.getUniformLocation(program, `u_${name}`)

  if (location === null) {
    return
  }

  if (definition.type === "float") {
    gl.uniform1f(location, value as number)
    return
  }

  if (definition.type === "boolean") {
    gl.uniform1i(location, value ? 1 : 0)
    return
  }

  const [red, green, blue] = parseHexColor(value as string)
  gl.uniform3f(location, red, green, blue)
}

export function createShaderImageRenderer(
  canvas: HTMLCanvasElement,
  options: ShaderImageRendererOptions,
): ShaderImageRenderer {
  const gl = canvas.getContext("webgl2")

  if (gl === null) {
    throw new WebGLUnavailableError()
  }

  const program = compileShaderProgram(
    gl,
    options.effect.id,
    options.effect.source.vertex,
    options.effect.source.fragment,
  )
  const texture = gl.createTexture()

  if (texture === null) {
    gl.deleteProgram(program)
    throw new Error(`Unable to allocate source texture for effect "${options.effect.id}"`)
  }

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const isParticleGeometry = options.effect.geometry?.type === "particles"
  const vertexArray = gl.createVertexArray()
  const positionBuffer = gl.createBuffer()
  const sourceUvBuffer = isParticleGeometry ? gl.createBuffer() : null

  if (isParticleGeometry) {
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  if (
    vertexArray === null ||
    positionBuffer === null ||
    (isParticleGeometry && sourceUvBuffer === null)
  ) {
    gl.deleteTexture(texture)
    gl.deleteProgram(program)
    throw new Error(`Unable to allocate geometry for effect "${options.effect.id}"`)
  }

  gl.bindVertexArray(vertexArray)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

  if (isParticleGeometry) {
    gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW)
  } else {
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    )
  }

  const positionLocation = gl.getAttribLocation(program, "a_position")
  if (positionLocation >= 0) {
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
  }

  if (sourceUvBuffer !== null) {
    gl.bindBuffer(gl.ARRAY_BUFFER, sourceUvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, 0, gl.STATIC_DRAW)
    const sourceUvLocation = gl.getAttribLocation(program, "a_sourceUv")
    if (sourceUvLocation >= 0) {
      gl.enableVertexAttribArray(sourceUvLocation)
      gl.vertexAttribPointer(sourceUvLocation, 2, gl.FLOAT, false, 0, 0)
    }
  }

  let resolvedOptions = resolveEffectOptions(
    options.effect,
    options.effectOptions as never,
    options.preset,
  ) as Record<string, unknown>
  let logicalWidth = Math.max(1, canvas.width)
  let logicalHeight = Math.max(1, canvas.height)
  let renderPixelRatio = 1
  let particleField: ParticleFieldState | null = null
  let currentSource: TexImageSource | null = null
  let continuousSource = false
  let previousTime: number | null = null
  let previousPointer: readonly [number, number] | null = null
  let pointerVelocity: [number, number] = [0, 0]
  let interactionState: SpringValueState = { value: 0, velocity: 0 }
  let ambient: AmbientMotion | null = options.ambient ?? null

  const rebuildParticleField = () => {
    if (!isParticleGeometry || sourceUvBuffer === null) {
      return
    }

    const spacing = resolvedOptions.spacing as number
    const columns = Math.max(1, Math.floor(logicalWidth / spacing))
    const rows = Math.max(1, Math.floor(logicalHeight / spacing))
    const alphaMask =
      currentSource === null
        ? null
        : sampleSourceAlpha(currentSource as CanvasImageSource, columns, rows)
    const alphaThreshold = Math.round(
      ((resolvedOptions.alphaThreshold as number | undefined) ?? 0.01) * 255,
    )

    particleField = createParticleField({
      width: logicalWidth,
      height: logicalHeight,
      spacing,
      ...(alphaMask === null ? {} : { alphaMask, alphaThreshold }),
    })
    gl.bindVertexArray(vertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, particleField.positions.byteLength, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, sourceUvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, particleField.sourceUvs, gl.STATIC_DRAW)
  }

  return {
    render(frame = {}) {
      const pointer = frame.pointer ?? [0.5, 0.5]
      const time = frame.time ?? 0
      const deltaTime = previousTime === null ? 1 / 60 : time - previousTime
      const pointerIsActive = frame.pointerActive ?? false
      const safeDeltaTime = Math.max(deltaTime, 1 / 240)

      if (pointerIsActive && previousPointer !== null) {
        const rawVelocityX = (pointer[0] - previousPointer[0]) / safeDeltaTime
        const rawVelocityY = (pointer[1] - previousPointer[1]) / safeDeltaTime
        const blend = 1 - Math.exp(-safeDeltaTime / 0.045)
        pointerVelocity = [
          pointerVelocity[0] + (rawVelocityX - pointerVelocity[0]) * blend,
          pointerVelocity[1] + (rawVelocityY - pointerVelocity[1]) * blend,
        ]
      } else {
        const decay = Math.exp(-safeDeltaTime / 0.06)
        pointerVelocity = [pointerVelocity[0] * decay, pointerVelocity[1] * decay]
      }

      previousPointer = pointerIsActive ? pointer : null
      // Presence-driven envelope: hovering springs the effect in with a
      // liquid, slightly underdamped feel; leaving lets it settle out softly.
      interactionState = stepSpringValue(interactionState, pointerIsActive ? 1 : 0, {
        response: pointerIsActive ? 0.26 : 0.45,
        dampingRatio: pointerIsActive ? 0.78 : 0.9,
        deltaTime,
      })
      previousTime = time

      if (isParticleGeometry) {
        if (particleField === null) rebuildParticleField()

        if (particleField !== null) {
          stepParticleField(particleField, {
            pointer,
            pointerVelocity,
            pointerActive: pointerIsActive,
            deltaTime,
            aspectRatio: logicalWidth / logicalHeight,
            force:
              (resolvedOptions.force as number) *
              ((resolvedOptions.interactionStrength as number | undefined) ?? 1),
            forceRadius: resolvedOptions.forceRadius as number,
            spring: resolvedOptions.spring as number,
            damping: resolvedOptions.damping as number,
            time,
            ...(ambient === null ? {} : { ambient }),
          })
          gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, particleField.positions)
        }
      }

      gl.useProgram(program)
      gl.bindVertexArray(vertexArray)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)

      if (continuousSource && currentSource !== null) {
        // Live sources (video, animating canvas) stream a fresh frame into
        // the texture every render; the particle field itself is untouched.
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, currentSource)
      }

      const textureLocation = gl.getUniformLocation(program, "u_texture")
      const resolutionLocation = gl.getUniformLocation(program, "u_resolution")
      const pointerLocation = gl.getUniformLocation(program, "u_pointer")
      const pointerVelocityLocation = gl.getUniformLocation(program, "u_pointerVelocity")
      const pointerActiveLocation = gl.getUniformLocation(program, "u_pointerActive")
      const timeLocation = gl.getUniformLocation(program, "u_time")
      const pixelRatioLocation = gl.getUniformLocation(program, "u_pixelRatio")

      if (textureLocation !== null) gl.uniform1i(textureLocation, 0)
      if (resolutionLocation !== null) {
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
      }
      if (pointerLocation !== null) {
        gl.uniform2f(pointerLocation, pointer[0], pointer[1])
      }
      if (pointerVelocityLocation !== null) {
        gl.uniform2f(
          pointerVelocityLocation,
          pointerVelocity[0],
          pointerVelocity[1],
        )
      }
      if (pointerActiveLocation !== null) {
        gl.uniform1f(pointerActiveLocation, interactionState.value)
      }
      if (timeLocation !== null) gl.uniform1f(timeLocation, time)
      if (pixelRatioLocation !== null) gl.uniform1f(pixelRatioLocation, renderPixelRatio)

      for (const [name, definition] of Object.entries(options.effect.uniforms)) {
        setEffectUniform(gl, program, name, definition, resolvedOptions[name])
      }

      if (particleField !== null) {
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.POINTS, 0, particleField.count)
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    },
    resize(width, height, pixelRatio = 1) {
      logicalWidth = Math.max(1, width)
      renderPixelRatio = Math.max(0.1, pixelRatio)
      logicalHeight = Math.max(1, height)
      const renderWidth = Math.max(1, Math.round(width * pixelRatio))
      const renderHeight = Math.max(1, Math.round(height * pixelRatio))
      canvas.width = renderWidth
      canvas.height = renderHeight
      gl.viewport(0, 0, renderWidth, renderHeight)
      rebuildParticleField()
      previousTime = null
    },
    setSource(source, sourceOptions) {
      currentSource = source
      continuousSource = sourceOptions?.continuous ?? false
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      )
      rebuildParticleField()
      previousTime = null
    },
    updateEffectOptions(nextOptions, preset) {
      const previousSpacing = resolvedOptions.spacing
      const previousAlphaThreshold = resolvedOptions.alphaThreshold
      resolvedOptions = resolveEffectOptions(
        options.effect,
        nextOptions as never,
        preset,
      ) as Record<string, unknown>

      if (
        resolvedOptions.spacing !== previousSpacing ||
        resolvedOptions.alphaThreshold !== previousAlphaThreshold
      ) {
        rebuildParticleField()
      }
    },
    setAmbient(nextAmbient) {
      ambient = nextAmbient
    },
    destroy() {
      gl.deleteBuffer(positionBuffer)
      if (sourceUvBuffer !== null) gl.deleteBuffer(sourceUvBuffer)
      gl.deleteVertexArray(vertexArray)
      gl.deleteTexture(texture)
      gl.deleteProgram(program)
    },
  }
}
