import { act } from "react"
import { createRoot } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { particleEffect } from "@dotmatter/shaders"

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  resize: vi.fn(),
  setSource: vi.fn(),
  updateEffectOptions: vi.fn(),
  setAmbient: vi.fn(),
  setReveal: vi.fn(),
  destroy: vi.fn(),
}))

vi.mock("@dotmatter/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dotmatter/core")>()
  return {
    ...actual,
    createShaderImageRenderer: () => mocks,
  }
})

import { ShaderImage } from "../src/index.js"

describe("ShaderImage pointer interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("tracks pointer movement while hovered without requiring a button press", async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())

    const container = document.createElement("div")
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <ShaderImage
          src="/portrait.jpg"
          effect={particleEffect}
          alt="Portrait"
        />,
      )
    })

    await act(async () => {
      const image = container.querySelector("img")!
      image.dispatchEvent(new Event("load", { bubbles: true }))
    })

    const frame = container.querySelector("[data-shader-effect]")!
    frame.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }))
    frame.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 10,
        clientY: 10,
      }),
    )
    callbacks[0]?.(16)
    expect(mocks.render).toHaveBeenLastCalledWith(
      expect.objectContaining({ pointerActive: true }),
    )

    frame.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }))
    callbacks[1]?.(32)
    expect(mocks.render).toHaveBeenLastCalledWith(
      expect.objectContaining({ pointerActive: false }),
    )

    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })
})
