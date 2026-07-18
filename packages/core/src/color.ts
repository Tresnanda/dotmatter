export function parseHexColor(color: string): [number, number, number] {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color)

  if (match === null) {
    throw new Error(`Unsupported color "${color}". Expected a six-digit hex color.`)
  }

  return [
    Number.parseInt(match[1]!, 16) / 255,
    Number.parseInt(match[2]!, 16) / 255,
    Number.parseInt(match[3]!, 16) / 255,
  ]
}
