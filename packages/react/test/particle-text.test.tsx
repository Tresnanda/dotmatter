import { act } from "react"
import { createRoot } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { particleEffect } from "@dotmatter/shaders"

const mocks = vi.hoisted(() => {
  const renderer = {
    render: vi.fn(),
    resize: vi.fn(),
    setSource: vi.fn(),
    updateEffectOptions: vi.fn(),
    setAmbient: vi.fn(),
    setReveal: vi.fn(),
    capture: vi.fn(),
    destroy: vi.fn(),
  }
  return { renderer, createRenderer: vi.fn(() => renderer) }
})

vi.mock("@dotmatter/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dotmatter/core")>()
  return { ...actual, createShaderImageRenderer: mocks.createRenderer }
})

import { DotMatterText } from "../src/index.js"

describe("DotMatterText", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
  })

  it("rasterizes text to a canvas and feeds it as the particle source", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DotMatterText text="HELLO" effect={particleEffect} />,
      )
    })

    // Source must be a canvas carrying the rasterized text.
    expect(mocks.renderer.setSource).toHaveBeenCalled()
    const source = mocks.renderer.setSource.mock.calls[0]![0]
    expect(source).toBeInstanceOf(HTMLCanvasElement)
    // Accessible text remains in the DOM for screen readers.
    expect(container.textContent).toContain("HELLO")

    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })
})
