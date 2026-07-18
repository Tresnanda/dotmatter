import { describe, expect, it } from "vitest"
import { compileShaderProgram, ShaderCompileError } from "../src/index.js"

class FailingVertexContext {
  readonly VERTEX_SHADER = 0x8b31
  readonly FRAGMENT_SHADER = 0x8b30
  readonly COMPILE_STATUS = 0x8b81

  createShader(type: number) {
    return { type }
  }

  shaderSource() {}
  compileShader() {}

  getShaderParameter(shader: { type: number }) {
    return shader.type !== this.VERTEX_SHADER
  }

  getShaderInfoLog() {
    return "vertex syntax error"
  }

  deleteShader() {}
}

class SuccessfulContext {
  readonly VERTEX_SHADER = 0x8b31
  readonly FRAGMENT_SHADER = 0x8b30
  readonly COMPILE_STATUS = 0x8b81
  readonly LINK_STATUS = 0x8b82
  readonly program = { linked: false }
  readonly deletedShaders: unknown[] = []

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
  createProgram() {
    return this.program
  }
  attachShader() {}
  linkProgram() {
    this.program.linked = true
  }
  getProgramParameter() {
    return this.program.linked
  }
  getProgramInfoLog() {
    return null
  }
  deleteProgram() {}
  detachShader() {}
  deleteShader(shader: unknown) {
    this.deletedShaders.push(shader)
  }
}

describe("compileShaderProgram", () => {
  it("links a program and releases compiled shaders", () => {
    const context = new SuccessfulContext()
    const gl = context as unknown as WebGL2RenderingContext

    const program = compileShaderProgram(
      gl,
      "dither",
      "valid vertex",
      "valid fragment",
    )

    expect(program).toBe(context.program)
    expect(context.deletedShaders).toHaveLength(2)
  })

  it("reports the effect and stage when shader compilation fails", () => {
    const gl = new FailingVertexContext() as unknown as WebGL2RenderingContext

    expect(() =>
      compileShaderProgram(gl, "dither", "broken vertex", "valid fragment"),
    ).toThrowError(
      new ShaderCompileError("dither", "vertex", "vertex syntax error"),
    )
  })
})
