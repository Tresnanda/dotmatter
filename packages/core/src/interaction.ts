export interface PointerCoordinates {
  x: number
  y: number
}

export interface ElementBounds {
  left: number
  top: number
  width: number
  height: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function normalizePointerPosition(
  point: PointerCoordinates,
  bounds: ElementBounds,
): [number, number] {
  return [
    clamp01((point.x - bounds.left) / bounds.width),
    clamp01(1 - (point.y - bounds.top) / bounds.height),
  ]
}
