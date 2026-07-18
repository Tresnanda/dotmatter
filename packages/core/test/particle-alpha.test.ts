import { describe, expect, it } from "vitest"
import { sampleSourceAlpha } from "../src/particle-alpha.js"

describe("sampleSourceAlpha", () => {
  it("extracts one alpha value for each particle grid cell", () => {
    const pixels = new Uint8ClampedArray([
      10, 20, 30, 255,
      40, 50, 60, 0,
      70, 80, 90, 128,
      100, 110, 120, 64,
    ])
    const context = {
      clearRect() {},
      drawImage() {},
      getImageData: () => ({ data: pixels }),
    }
    const createCanvas = () => ({
      width: 0,
      height: 0,
      getContext: () => context,
    })

    const alpha = sampleSourceAlpha(
      {} as CanvasImageSource,
      2,
      2,
      createCanvas,
    )

    expect(Array.from(alpha ?? [])).toEqual([255, 0, 128, 64])
  })
})
