export interface AlphaSamplingCanvas {
  width: number
  height: number
  getContext(contextId: "2d"): {
    clearRect(x: number, y: number, width: number, height: number): void
    drawImage(source: CanvasImageSource, x: number, y: number, width: number, height: number): void
    getImageData(x: number, y: number, width: number, height: number): {
      data: Uint8ClampedArray
    }
  } | null
}

export type AlphaSamplingCanvasFactory = () => AlphaSamplingCanvas

function createBrowserCanvas(): AlphaSamplingCanvas {
  if (typeof document === "undefined") {
    throw new Error("Alpha sampling requires a browser document")
  }

  return document.createElement("canvas")
}

export function sampleSourceAlpha(
  source: CanvasImageSource,
  columns: number,
  rows: number,
  createCanvas: AlphaSamplingCanvasFactory = createBrowserCanvas,
): Uint8Array | null {
  try {
    const canvas = createCanvas()
    canvas.width = columns
    canvas.height = rows
    const context = canvas.getContext("2d")
    if (context === null) return null

    context.clearRect(0, 0, columns, rows)
    context.drawImage(source, 0, 0, columns, rows)
    const pixels = context.getImageData(0, 0, columns, rows).data
    const alpha = new Uint8Array(columns * rows)

    for (let index = 0; index < alpha.length; index += 1) {
      alpha[index] = pixels[index * 4 + 3] ?? 0
    }

    return alpha
  } catch {
    return null
  }
}
