export interface EffectSource {
  vertex: string
  fragment: string
}

export interface FloatUniformDefinition {
  type: "float"
  default: number
  min?: number
  max?: number
}

export interface ColorUniformDefinition {
  type: "color"
  default: string
}

export interface BooleanUniformDefinition {
  type: "boolean"
  default: boolean
}

export type UniformDefinition =
  | FloatUniformDefinition
  | ColorUniformDefinition
  | BooleanUniformDefinition

export type UniformSchema = Record<string, UniformDefinition>

export type UniformValue<T extends UniformDefinition> = T extends FloatUniformDefinition
  ? number
  : T extends ColorUniformDefinition
    ? string
    : T extends BooleanUniformDefinition
      ? boolean
      : never

export type ResolvedUniforms<T extends UniformSchema> = {
  [K in keyof T]: UniformValue<T[K]>
}

export type EffectGeometry =
  | { type: "fullscreen" }
  | { type: "particles" }

export interface EffectDefinition<TUniforms extends UniformSchema = UniformSchema> {
  id: string
  source: EffectSource
  geometry?: EffectGeometry
  uniforms: TUniforms
  presets?: Record<string, Partial<ResolvedUniforms<TUniforms>>>
}

export function defineEffect<const T extends EffectDefinition>(definition: T): T {
  if (definition.id.trim().length === 0) {
    throw new Error("Effect id must not be empty")
  }

  return definition
}

function validateUniformValue(
  effectId: string,
  name: string,
  uniform: UniformDefinition,
  value: unknown,
): void {
  if (uniform.type !== "float") {
    return
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Uniform "${name}" for effect "${effectId}" must be a finite number`)
  }

  if (uniform.min !== undefined && value < uniform.min) {
    throw new Error(
      `Uniform "${name}" for effect "${effectId}" must be at least ${uniform.min}`,
    )
  }

  if (uniform.max !== undefined && value > uniform.max) {
    throw new Error(
      `Uniform "${name}" for effect "${effectId}" must be at most ${uniform.max}`,
    )
  }
}

export interface EffectRegistry {
  get(id: string): EffectDefinition | undefined
}

export function createEffectRegistry(
  effects: readonly EffectDefinition[] = [],
): EffectRegistry {
  const registered = new Map<string, EffectDefinition>()

  for (const effect of effects) {
    if (registered.has(effect.id)) {
      throw new Error(`Effect "${effect.id}" is already registered`)
    }
    registered.set(effect.id, effect)
  }

  return {
    get(id) {
      return registered.get(id)
    },
  }
}

export function resolveEffectOptions<TUniforms extends UniformSchema>(
  effect: EffectDefinition<TUniforms>,
  overrides: Partial<ResolvedUniforms<TUniforms>> = {},
  presetName?: string,
): ResolvedUniforms<TUniforms> {
  const preset = presetName === undefined ? {} : effect.presets?.[presetName] ?? {}
  const values: Record<string, unknown> = { ...preset, ...overrides }

  for (const name of Object.keys(values)) {
    if (!(name in effect.uniforms)) {
      throw new Error(`Unknown uniform "${name}" for effect "${effect.id}"`)
    }
  }

  return Object.fromEntries(
    Object.entries(effect.uniforms).map(([name, uniform]) => {
      const value = name in values ? values[name] : uniform.default
      validateUniformValue(effect.id, name, uniform, value)
      return [name, value]
    }),
  ) as ResolvedUniforms<TUniforms>
}
