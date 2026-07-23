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
    setPointerMode: vi.fn(),
    capture: vi.fn(() => "data:image/png;base64,x"),
    destroy: vi.fn(),
  }
  return { renderer, createRenderer: vi.fn(() => renderer) }
})

vi.mock("@dotmatter/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dotmatter/core")>()
  return { ...actual, createShaderImageRenderer: mocks.createRenderer }
})

import { DotMatter } from "../src/index.js"

describe("cached image (already-complete) source", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
  })

  it("initializes the renderer when the image is already loaded and no load event fires", async () => {
    // A cached image is `complete` with a real size before React attaches
    // onLoad, so the load event never arrives. The renderer must still start.
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get() {
        return true
      },
    })
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() {
        return 800
      },
    })

    const container = document.createElement("div")
    const root = createRoot(container)

    // Note: we deliberately never dispatch a "load" event on the <img>.
    await act(async () => {
      root.render(<DotMatter src="/cached.jpg" effect={particleEffect} alt="Cached" />)
    })

    expect(mocks.createRenderer).toHaveBeenCalledTimes(1)
    expect(mocks.renderer.setSource).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
    // @ts-expect-error restore jsdom defaults
    delete HTMLImageElement.prototype.complete
    // @ts-expect-error restore jsdom defaults
    delete HTMLImageElement.prototype.naturalWidth
    vi.unstubAllGlobals()
  })
})
