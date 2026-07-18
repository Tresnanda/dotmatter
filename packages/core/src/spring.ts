export interface SpringValueState {
  value: number
  velocity: number
}

export interface SpringValueStep {
  response: number
  dampingRatio: number
  deltaTime: number
}

export function stepSpringValue(
  state: SpringValueState,
  target: number,
  step: SpringValueStep,
): SpringValueState {
  const deltaTime = Math.min(Math.max(step.deltaTime, 0), 1 / 30)
  const response = Math.max(step.response, 0.05)
  const angularFrequency = (Math.PI * 2) / response
  const acceleration =
    angularFrequency * angularFrequency * (target - state.value) -
    2 * step.dampingRatio * angularFrequency * state.velocity
  const velocity = state.velocity + acceleration * deltaTime

  return {
    value: state.value + velocity * deltaTime,
    velocity,
  }
}
