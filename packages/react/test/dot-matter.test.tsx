import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { ditherEffect } from "@dotmatter/shaders"
import { DitherImage, HalftoneImage, ParticleImage, ShaderImage } from "../src/index.js"

describe("ShaderImage", () => {
  it("keeps the fallback visible when WebGL2 is unavailable", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)
    const onError = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

    await act(async () => {
      root.render(
        <ShaderImage
          src="/portrait.jpg"
          effect={ditherEffect}
          alt="Portrait"
          onError={onError}
        />,
      )
    })

    await act(async () => {
      container.querySelector("img")?.dispatchEvent(new Event("load", { bubbles: true }))
    })

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "WEBGL_UNAVAILABLE" }),
    )
    expect(container.querySelector("img")?.style.visibility).not.toBe("hidden")

    await act(async () => root.unmount())
  })

  it("provides typed wrappers for all three flagship effects", () => {
    const html = [
      renderToStaticMarkup(<DitherImage src="/a.jpg" alt="A" />),
      renderToStaticMarkup(<ParticleImage src="/b.jpg" alt="B" />),
      renderToStaticMarkup(<HalftoneImage src="/c.jpg" alt="C" />),
    ].join("")

    expect(html).toContain('data-shader-effect="dither"')
    expect(html).toContain('data-shader-effect="particles"')
    expect(html).toContain('data-shader-effect="halftone"')
  })

  it("server-renders an accessible image fallback", () => {
    const html = renderToStaticMarkup(
      <ShaderImage
        src="/portrait.jpg"
        effect={ditherEffect}
        alt="Portrait"
      />,
    )

    expect(html).toContain('<img src="/portrait.jpg" alt="Portrait"')
    expect(html).toContain("<canvas")
    expect(html).toContain('aria-hidden="true"')
  })
})
