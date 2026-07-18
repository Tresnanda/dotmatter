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

async function mountWithLoadedImage(element: React.ReactElement) {
  const container = document.createElement("div")
  const root = createRoot(container)
  await act(async () => root.render(element))
  await act(async () => {
    container.querySelector("img")!.dispatchEvent(new Event("load", { bubbles: true }))
  })
  return { container, root }
}

describe("scroll reveal prop", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
  })

  it("forwards numeric scrollReveal progress to the renderer", async () => {
    const { root } = await mountWithLoadedImage(
      <DotMatter
        src="/a.jpg"
        effect={particleEffect}
        scrollReveal={0.4}
        alt="A"
      />,
    )

    expect(mocks.renderer.setReveal).toHaveBeenLastCalledWith(0.4)
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })

  it("pauses the render loop while the element is offscreen", async () => {
    let intersectionCallback: IntersectionObserverCallback | null = null
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersectionCallback = callback
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    )
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })

    const { root } = await mountWithLoadedImage(
      <DotMatter src="/a.jpg" effect={particleEffect} alt="A" />,
    )

    const framesWhileVisible = frames.length
    expect(framesWhileVisible).toBeGreaterThan(0)

    // Element scrolls offscreen → loop must stop requesting frames.
    await act(async () => {
      intersectionCallback!(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })
    const framesAtPause = frames.length
    frames.at(-1)?.(16)
    expect(frames.length).toBe(framesAtPause)

    // Back onscreen → loop resumes.
    await act(async () => {
      intersectionCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })
    expect(frames.length).toBeGreaterThan(framesAtPause)

    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })

  it("forwards pointerMode toggles to the live renderer without recreating it", async () => {
    const { root } = await mountWithLoadedImage(
      <DotMatter src="/a.jpg" effect={particleEffect} alt="A" />,
    )

    await act(async () => {
      root.render(
        <DotMatter
          src="/a.jpg"
          effect={particleEffect}
          pointerMode="attract"
          alt="A"
        />,
      )
    })

    expect(mocks.createRenderer).toHaveBeenCalledTimes(1)
    expect(mocks.renderer.setPointerMode).toHaveBeenLastCalledWith("attract")

    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })

  it("starts feeding scroll velocity when scrollSmear is enabled after mount", async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })

    const { root } = await mountWithLoadedImage(
      <DotMatter src="/a.jpg" effect={particleEffect} alt="A" />,
    )

    // Enable smear AFTER mount — the toggle path the playground uses.
    await act(async () => {
      root.render(
        <DotMatter src="/a.jpg" effect={particleEffect} scrollSmear alt="A" />,
      )
    })

    // Simulate a scroll burst, then run a frame.
    Object.defineProperty(window, "scrollY", { value: 400, configurable: true })
    window.dispatchEvent(new Event("scroll"))
    mocks.renderer.render.mockClear()
    frames.at(-1)?.(32)

    expect(mocks.renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ scrollVelocity: expect.any(Number) }),
    )

    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })

  it("disables ambient motion when reduceMotion is set", async () => {
    const { root } = await mountWithLoadedImage(
      <DotMatter
        src="/a.jpg"
        effect={particleEffect}
        ambient={{ mode: "wave", strength: 1, speed: 1, scale: 1 }}
        reduceMotion
        alt="A"
      />,
    )

    expect(mocks.renderer.setAmbient).toHaveBeenLastCalledWith(null)
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })
})
