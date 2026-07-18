import { describe, expect, it, vi } from "vitest"
import {
  createShaderImageRenderer,
  defineEffect,
  WebGLUnavailableError,
} from "../src/index.js"

const effect = defineEffect({
  id: "test",
  source: {
    vertex: "void main() {}",
    fragment: "void main() {}",
  },
  uniforms: {},
})

const particleGeometryEffect = defineEffect({
  id: "particle-geometry",
  geometry: { type: "particles" },
  source: effect.source,
  uniforms: {
    spacing: { type: "float", default: 10, min: 3, max: 48 },
    force: { type: "float", default: 18, min: 0, max: 60 },
    forceRadius: { type: "float", default: 0.2, min: 0.01, max: 1 },
    spring: { type: "float", default: 20, min: 0, max: 80 },
    damping: { type: "float", default: 0.88, min: 0, max: 1 },
    interactionStrength: { type: "float", default: 1, min: 0, max: 2 },
    alphaThreshold: { type: "float", default: 0.1, min: 0, max: 1 },
  },
})

const configurableEffect = defineEffect({
  id: "configurable",
  source: effect.source,
  uniforms: {
    intensity: { type: "float", default: 0.5, min: 0, max: 1 },
  },
})

class RendererContext {
  readonly VERTEX_SHADER = 0x8b31
  readonly FRAGMENT_SHADER = 0x8b30
  readonly COMPILE_STATUS = 0x8b81
  readonly LINK_STATUS = 0x8b82
  readonly POINTS = 0x0000
  readonly TRIANGLES = 0x0004
  readonly ARRAY_BUFFER = 0x8892
  readonly STATIC_DRAW = 0x88e4
  readonly FLOAT = 0x1406
  readonly TEXTURE0 = 0x84c0
  readonly COLOR_BUFFER_BIT = 0x4000
  readonly BLEND = 0x0be2
  readonly SRC_ALPHA = 0x0302
  readonly ONE_MINUS_SRC_ALPHA = 0x0303
  readonly program = {}
  readonly texture = {}
  deletedProgram: unknown
  uploadedSource: unknown
  textureUploads = 0
  viewportSize: unknown[] = []
  drawArguments: unknown[] = []
  uniformValues = new Map<string, unknown>()
  clearCalls = 0
  bufferDataCalls = 0
  uploadedPositions: Float32Array | undefined

  createShader(type: number) {
    return { type }
  }
  shaderSource() {}
  compileShader() {}
  getShaderParameter() {
    return true
  }
  getShaderInfoLog() {
    return null
  }
  deleteShader() {}
  createProgram() {
    return this.program
  }
  attachShader() {}
  detachShader() {}
  linkProgram() {}
  getProgramParameter() {
    return true
  }
  getProgramInfoLog() {
    return null
  }
  deleteProgram(program: unknown) {
    this.deletedProgram = program
  }
  createTexture() {
    return this.texture
  }
  bindTexture() {}
  pixelStorei() {}
  texParameteri() {}
  texImage2D(...args: unknown[]) {
    this.uploadedSource = args.at(-1)
    this.textureUploads += 1
  }
  deleteTexture() {}
  viewport(...args: unknown[]) {
    this.viewportSize = args
  }
  createVertexArray() {
    return {}
  }
  bindVertexArray() {}
  deleteVertexArray() {}
  createBuffer() {
    return {}
  }
  bindBuffer() {}
  bufferData() {
    this.bufferDataCalls += 1
  }
  bufferSubData(_target: unknown, _offset: unknown, data: ArrayBufferView) {
    this.uploadedPositions = new Float32Array(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    )
  }
  deleteBuffer() {}
  getAttribLocation() {
    return 0
  }
  enableVertexAttribArray() {}
  vertexAttribPointer() {}
  useProgram() {}
  activeTexture() {}
  getUniformLocation(_program: unknown, name: string) {
    return { name }
  }
  uniform1i(location: { name: string }, value: unknown) {
    this.uniformValues.set(location.name, value)
  }
  uniform1f(location: { name: string }, value: unknown) {
    this.uniformValues.set(location.name, value)
  }
  uniform2f(location: { name: string }, x: unknown, y: unknown) {
    this.uniformValues.set(location.name, [x, y])
  }
  uniform3f(location: { name: string }, x: unknown, y: unknown, z: unknown) {
    this.uniformValues.set(location.name, [x, y, z])
  }
  clearColor() {}
  enable() {}
  blendFunc() {}
  clear() {
    this.clearCalls += 1
  }
  drawArrays(...args: unknown[]) {
    this.drawArguments = args
  }
}

describe("createShaderImageRenderer", () => {
  it("springs interaction in on hover and eases it out on leave", () => {
    const context = new RendererContext()
    const canvas = {
      width: 320,
      height: 180,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, { effect })
    renderer.render({ time: 1 / 60, pointer: [0.5, 0.5], pointerActive: true })
    renderer.render({ time: 2 / 60, pointer: [0.5, 0.5], pointerActive: true })
    const hoveredAmount = context.uniformValues.get("u_pointerActive") as number

    renderer.render({ time: 3 / 60, pointer: [0.5, 0.5], pointerActive: false })
    const leavingAmount = context.uniformValues.get("u_pointerActive") as number

    expect(hoveredAmount).toBeGreaterThan(0)
    expect(leavingAmount).toBeGreaterThan(0)
    expect(leavingAmount).toBeLessThanOrEqual(hoveredAmount + 0.2)
  })

  it("re-uploads continuous sources each frame without rebuilding particles", () => {
    const context = new RendererContext()
    const canvas = {
      width: 40,
      height: 20,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, {
      effect: particleGeometryEffect,
    })
    renderer.resize(40, 20)
    const video = {} as HTMLVideoElement
    renderer.setSource(video, { continuous: true })
    const allocations = context.bufferDataCalls

    renderer.render({ time: 1 / 60 })
    renderer.render({ time: 2 / 60 })

    // Texture re-uploaded per frame (initial upload + 2 renders)…
    expect(context.textureUploads).toBe(3)
    // …but the particle field must not be reallocated per frame.
    expect(context.bufferDataCalls).toBe(allocations)
  })

  it("animates particles ambiently when an ambient mode is configured", () => {
    const context = new RendererContext()
    const canvas = {
      width: 40,
      height: 20,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, {
      effect: particleGeometryEffect,
      ambient: { mode: "wave", strength: 1, speed: 1, scale: 1 },
    })
    renderer.resize(40, 20)
    for (let frame = 1; frame <= 30; frame += 1) {
      renderer.render({ time: frame / 60 })
    }

    const positions = context.uploadedPositions!
    const homeY = 0.75
    expect(Math.abs(positions[1]! - homeY)).toBeGreaterThan(0.0001)
  })

  it("keeps particle positions when physics-only slider values change", () => {
    const context = new RendererContext()
    const canvas = {
      width: 320,
      height: 180,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, {
      effect: particleGeometryEffect,
    })
    renderer.resize(320, 180)
    const allocationsBeforeUpdate = context.bufferDataCalls
    renderer.updateEffectOptions({ force: 8 })

    expect(context.bufferDataCalls).toBe(allocationsBeforeUpdate)
  })

  it("updates effect uniforms without rebuilding the renderer", () => {
    const context = new RendererContext()
    const canvas = {
      width: 320,
      height: 180,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, {
      effect: configurableEffect,
    })
    renderer.updateEffectOptions({ intensity: 0.8 })
    renderer.render()

    expect(context.uniformValues.get("u_intensity")).toBe(0.8)
  })

  it("lets interaction strength disable pointer force without disabling spring physics", () => {
    const context = new RendererContext()
    const canvas = {
      width: 40,
      height: 20,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, {
      effect: particleGeometryEffect,
      effectOptions: { interactionStrength: 0 },
    })
    renderer.resize(40, 20)
    renderer.render({
      time: 1 / 60,
      pointer: [0.1, 0.75],
      pointerActive: true,
    })

    expect(context.uploadedPositions?.[0]).toBeCloseTo(0.125, 5)
  })

  it("passes the backing-store pixel ratio to point shaders", () => {
    const context = new RendererContext()
    const canvas = {
      width: 40,
      height: 20,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, {
      effect: particleGeometryEffect,
    })
    renderer.resize(40, 20, 2)
    renderer.render()

    expect(context.uniformValues.get("u_pixelRatio")).toBe(2)
  })

  it("allocates point geometry only for source pixels above the alpha threshold", () => {
    const context = new RendererContext()
    const canvas = {
      width: 40,
      height: 20,
      getContext: () => context,
    } as unknown as HTMLCanvasElement
    const rgba = new Uint8ClampedArray(8 * 4)
    ;[255, 0, 255, 0, 255, 0, 255, 0].forEach((alpha, index) => {
      rgba[index * 4 + 3] = alpha
    })
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          clearRect() {},
          drawImage() {},
          getImageData: () => ({ data: rgba }),
        }),
      }),
    })

    const renderer = createShaderImageRenderer(canvas, {
      effect: particleGeometryEffect,
    })
    renderer.setSource({} as HTMLImageElement)
    renderer.resize(40, 20)
    renderer.render()

    expect(context.drawArguments).toEqual([context.POINTS, 0, 4])
    vi.unstubAllGlobals()
  })

  it("clears the particle frame before drawing moving points", () => {
    const context = new RendererContext()
    const canvas = {
      width: 40,
      height: 20,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, {
      effect: particleGeometryEffect,
    })
    renderer.resize(40, 20)
    renderer.render()

    expect(context.clearCalls).toBe(1)
  })

  it("draws particle geometry as independently simulated points", () => {
    const context = new RendererContext()
    const canvas = {
      width: 40,
      height: 20,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, {
      effect: particleGeometryEffect,
    })
    renderer.resize(40, 20)
    renderer.render({
      time: 1 / 60,
      pointer: [0.4, 0.5],
      pointerActive: true,
    })

    expect(context.drawArguments).toEqual([context.POINTS, 0, 8])
  })

  it("renders a fullscreen triangle", () => {
    const context = new RendererContext()
    const canvas = {
      width: 320,
      height: 180,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, { effect })
    renderer.render({ time: 1, pointer: [0.5, 0.5] })

    expect(context.drawArguments).toEqual([context.TRIANGLES, 0, 3])
  })

  it("resizes the canvas backing store and viewport", () => {
    const context = new RendererContext()
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, { effect })
    renderer.resize(320, 180, 2)

    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(360)
    expect(context.viewportSize).toEqual([0, 0, 640, 360])
  })

  it("uploads a media source into its texture", () => {
    const context = new RendererContext()
    const canvas = {
      getContext: () => context,
    } as unknown as HTMLCanvasElement
    const source = {} as HTMLImageElement

    const renderer = createShaderImageRenderer(canvas, { effect })
    renderer.setSource(source)

    expect(context.uploadedSource).toBe(source)
  })

  it("releases its shader program when destroyed", () => {
    const context = new RendererContext()
    const canvas = {
      getContext: () => context,
    } as unknown as HTMLCanvasElement

    const renderer = createShaderImageRenderer(canvas, { effect })
    renderer.destroy()

    expect(context.deletedProgram).toBe(context.program)
  })

  it("reports when WebGL2 is unavailable", () => {
    const canvas = {
      getContext: () => null,
    } as unknown as HTMLCanvasElement

    expect(() => createShaderImageRenderer(canvas, { effect })).toThrowError(
      new WebGLUnavailableError(),
    )
  })
})
