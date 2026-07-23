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

describe("canvas source sizing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
  })

  it("derives an intrinsic aspect ratio so a canvas source is not 0-height", async () => {
    // Canvas sources have no in-flow media element to give the wrapper height.
    // Without a derived aspect ratio the wrapper collapses and nothing renders.
    const canvas = document.createElement("canvas")
    canvas.width = 200
    canvas.height = 100

    const container = document.createElement("div")
    const root = createRoot(container)

    await act(async () => {
      root.render(<DotMatter src={canvas} effect={particleEffect} alt="" />)
    })

    const wrapper = container.querySelector("span")!
    expect(wrapper.style.aspectRatio.replace(/\s/g, "")).toBe("200/100")

    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })

  it("lets an explicit style override the derived ratio", async () => {
    const canvas = document.createElement("canvas")
    canvas.width = 200
    canvas.height = 100

    const container = document.createElement("div")
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DotMatter
          src={canvas}
          effect={particleEffect}
          alt=""
          style={{ aspectRatio: "1 / 1" }}
        />,
      )
    })

    const wrapper = container.querySelector("span")!
    expect(wrapper.style.aspectRatio.replace(/\s/g, "")).toBe("1/1")

    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })
})
