export type ShaderStage = "vertex" | "fragment"

export class ShaderCompileError extends Error {
  readonly code = "SHADER_COMPILE_FAILED"

  constructor(
    readonly effectId: string,
    readonly stage: ShaderStage,
    readonly log: string,
  ) {
    super(`Failed to compile ${stage} shader for effect "${effectId}": ${log}`)
    this.name = "ShaderCompileError"
  }
}

function compileShader(
  gl: WebGL2RenderingContext,
  effectId: string,
  stage: ShaderStage,
  source: string,
): WebGLShader {
  const shaderType = stage === "vertex" ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER
  const shader = gl.createShader(shaderType)

  if (shader === null) {
    throw new ShaderCompileError(effectId, stage, "Unable to allocate shader")
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "Unknown shader compiler error"
    gl.deleteShader(shader)
    throw new ShaderCompileError(effectId, stage, log)
  }

  return shader
}

export function compileShaderProgram(
  gl: WebGL2RenderingContext,
  effectId: string,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertexShader = compileShader(gl, effectId, "vertex", vertexSource)
  const fragmentShader = compileShader(gl, effectId, "fragment", fragmentSource)
  const program = gl.createProgram()

  if (program === null) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    throw new Error(`Unable to allocate shader program for effect "${effectId}"`)
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.detachShader(program, vertexShader)
  gl.detachShader(program, fragmentShader)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "Unknown shader linker error"
    gl.deleteProgram(program)
    throw new Error(`Failed to link shader program for effect "${effectId}": ${log}`)
  }

  return program
}
