import { act } from "react"
import { createRoot } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ditherEffect } from "@dotmatter/shaders"

const mocks = vi.hoisted(() => {
  const renderer = {
    render: vi.fn(),
    resize: vi.fn(),
    setSource: vi.fn(),
    updateEffectOptions: vi.fn(),
    setAmbient: vi.fn(),
    setReveal: vi.fn(),
    setPointerMode: vi.fn(),
    destroy: vi.fn(),
  }
  return {
    renderer,
    createRenderer: vi.fn(() => renderer),
  }
})

vi.mock("@dotmatter/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dotmatter/core")>()
  return {
    ...actual,
    createShaderImageRenderer: mocks.createRenderer,
  }
})

import { DotMatter } from "../src/index.js"

describe("ShaderImage option updates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
  })

  it("updates uniforms without recreating the renderer", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DotMatter
          src="/portrait.jpg"
          effect={ditherEffect}
          effectOptions={{ scale: 4 }}
          alt="Portrait"
        />,
      )
    })
    await act(async () => {
      container.querySelector("img")!.dispatchEvent(new Event("load", { bubbles: true }))
    })

    await act(async () => {
      root.render(
        <DotMatter
          src="/portrait.jpg"
          effect={ditherEffect}
          effectOptions={{ scale: 7 }}
          alt="Portrait"
        />,
      )
    })

    expect(mocks.createRenderer).toHaveBeenCalledTimes(1)
    expect(mocks.renderer.updateEffectOptions).toHaveBeenLastCalledWith(
      { scale: 7 },
      undefined,
    )

    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })

  it("forwards ambient motion changes without recreating the renderer", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)
    const wave = { mode: "wave" as const, strength: 1, speed: 1, scale: 1 }

    await act(async () => {
      root.render(
        <DotMatter src="/portrait.jpg" effect={ditherEffect} alt="Portrait" />,
      )
    })
    await act(async () => {
      container.querySelector("img")!.dispatchEvent(new Event("load", { bubbles: true }))
    })

    await act(async () => {
      root.render(
        <DotMatter
          src="/portrait.jpg"
          effect={ditherEffect}
          ambient={wave}
          alt="Portrait"
        />,
      )
    })

    expect(mocks.createRenderer).toHaveBeenCalledTimes(1)
    expect(mocks.renderer.setAmbient).toHaveBeenLastCalledWith(wave)

    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })
})
