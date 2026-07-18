import {
  createShaderImageRenderer,
  normalizePointerPosition,
  type AmbientMotion,
  type PointerMode,
  type EffectDefinition,
  type ShaderImageRenderer,
} from "@dotmatter/core"
import {
  ditherEffect,
  halftoneEffect,
  particleEffect,
} from "@dotmatter/shaders"
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react"

export interface DotMatterProps {
  /** Image/video URL, or a canvas element used directly as the source. */
  src: string | HTMLCanvasElement
  effect: EffectDefinition
  alt: string
  /** Treat src as a video: renders a muted looped <video> streamed to the GPU. */
  video?: boolean
  preset?: string
  effectOptions?: Record<string, unknown>
  ambient?: AmbientMotion
  /** repel (default) pushes particles away from the cursor; attract pulls them in. */
  pointerMode?: PointerMode
  /** Feed page scroll velocity into the field as a momentum smear. */
  scrollSmear?: boolean
  /**
   * Scroll-driven assembly. Pass "auto" to track this element's viewport
   * position (particles condense into place as it scrolls in), or a number
   * 0–1 to drive the progress yourself.
   */
  scrollReveal?: "auto" | number
  /**
   * Gentle mode: no ambient drift, no reveal scatter, calmer springs.
   * Defaults to the user's prefers-reduced-motion setting.
   */
  reduceMotion?: boolean
  className?: string
  style?: CSSProperties
  onError?: (error: Error & { code?: string }) => void
  /** Receives imperative controls ({ capture }) once the renderer is live. */
  controls?: (controls: DotMatterControls | null) => void
}

export interface DotMatterControls {
  /** Snapshot the current frame as a PNG data URL. */
  capture(): string
}

const mediaStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
}

export type FlagshipDotMatterProps = Omit<DotMatterProps, "effect">

export function DotMatter({
  src,
  effect,
  alt,
  video = false,
  preset,
  effectOptions,
  ambient,
  pointerMode,
  scrollSmear = false,
  scrollReveal,
  reduceMotion,
  className,
  style,
  onError,
  controls,
}: DotMatterProps): ReactElement {
  const containerRef = useRef<HTMLSpanElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ShaderImageRenderer>(null)
  const pointerRef = useRef<readonly [number, number]>([0.5, 0.5])
  const pointerActiveRef = useRef(false)
  const extraPointersRef = useRef<Map<number, readonly [number, number]>>(new Map())
  const primaryPointerIdRef = useRef<number | null>(null)
  const scrollVelocityRef = useRef(0)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const controlsRef = useRef(controls)
  controlsRef.current = controls
  const scrollSmearRef = useRef(scrollSmear)
  scrollSmearRef.current = scrollSmear
  const [sourceRevision, setSourceRevision] = useState(0)
  const [rendererReady, setRendererReady] = useState(false)
  const [systemReducedMotion, setSystemReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof matchMedia === "undefined") return
    const query = matchMedia("(prefers-reduced-motion: reduce)")
    setSystemReducedMotion(query.matches)
    const onChange = (event: MediaQueryListEvent) => setSystemReducedMotion(event.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  const motionReduced = reduceMotion ?? systemReducedMotion

  const canvasSource = typeof src === "string" ? null : src

  useEffect(() => {
    const container = containerRef.current
    const image = canvasSource ?? (video ? videoRef.current : imageRef.current)
    const canvas = canvasRef.current

    if (
      (canvasSource === null && sourceRevision === 0) ||
      container === null ||
      image === null ||
      canvas === null
    ) {
      return
    }

    let animationFrame = 0
    let renderer: ShaderImageRenderer

    try {
      renderer = createShaderImageRenderer(canvas, {
        effect,
        ...(effectOptions === undefined ? {} : { effectOptions }),
        ...(preset === undefined ? {} : { preset }),
        ...(ambient === undefined ? {} : { ambient }),
        ...(pointerMode === undefined ? {} : { pointerMode }),
      })
      rendererRef.current = renderer
      controlsRef.current?.({ capture: () => renderer.capture() })
      renderer.setSource(
        image as TexImageSource,
        video ? { continuous: true } : undefined,
      )
      setRendererReady(true)
    } catch (error) {
      setRendererReady(false)
      onErrorRef.current?.(error as Error & { code?: string })
      return
    }

    const resize = () => {
      const bounds = container.getBoundingClientRect()
      renderer.resize(bounds.width, bounds.height, Math.min(devicePixelRatio || 1, 2))
    }

    const handlePointerEnter = () => {
      pointerActiveRef.current = true
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect()
      const position = normalizePointerPosition(event, bounds)
      if (
        primaryPointerIdRef.current === null ||
        primaryPointerIdRef.current === event.pointerId
      ) {
        primaryPointerIdRef.current = event.pointerId
        pointerRef.current = position
      } else {
        extraPointersRef.current.set(event.pointerId, position)
      }
      // Touch: a finger down is an active pointer even without hover.
      if (event.pointerType === "touch") pointerActiveRef.current = true
    }

    const handlePointerLeave = () => {
      pointerActiveRef.current = false
      primaryPointerIdRef.current = null
      extraPointersRef.current.clear()
    }

    const handlePointerUp = (event: PointerEvent) => {
      extraPointersRef.current.delete(event.pointerId)
      if (primaryPointerIdRef.current === event.pointerId) {
        primaryPointerIdRef.current = null
        if (event.pointerType === "touch") pointerActiveRef.current = false
      }
    }

    const startedAt = performance.now()
    let running = true
    let visible = true

    const render = (now: number) => {
      // Velocity lingers ~half a second after scrolling stops so the smear
      // has time to read before the spring reels it back.
      scrollVelocityRef.current *= 0.94
      if (Math.abs(scrollVelocityRef.current) < 0.01) scrollVelocityRef.current = 0
      const extras = Array.from(extraPointersRef.current.values())
      renderer.render({
        time: (now - startedAt) / 1000,
        pointer: pointerRef.current,
        pointerActive: pointerActiveRef.current,
        ...(extras.length === 0 ? {} : { extraPointers: extras }),
        ...(scrollVelocityRef.current === 0
          ? {}
          : { scrollVelocity: scrollVelocityRef.current }),
      })
      if (running && visible && !document.hidden) {
        animationFrame = requestAnimationFrame(render)
      }
    }

    const resume = () => {
      if (!running || !visible || document.hidden) return
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(render)
    }

    // Offscreen and hidden-tab pause: a stopped field costs nothing.
    const handleVisibility = () => resume()
    const intersectionObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            visible = entries[entries.length - 1]?.isIntersecting ?? true
            resume()
          })
    intersectionObserver?.observe(container)
    document.addEventListener("visibilitychange", handleVisibility)

    resize()
    container.addEventListener("pointerenter", handlePointerEnter)
    container.addEventListener("pointermove", handlePointerMove)
    container.addEventListener("pointerleave", handlePointerLeave)
    container.addEventListener("pointerup", handlePointerUp)
    container.addEventListener("pointercancel", handlePointerUp)

    // Scroll smear: exponential decay of instantaneous scroll velocity in
    // viewport-heights/second, so a flick leaves a momentum tail.
    let lastScrollY = window.scrollY
    let lastScrollTime = performance.now()
    const handleScroll = () => {
      const now = performance.now()
      const dt = Math.max((now - lastScrollTime) / 1000, 1 / 240)
      const dy = (window.scrollY - lastScrollY) / (window.innerHeight || 1)
      // Gate by the live ref so the smear toggle works without remounting.
      scrollVelocityRef.current = scrollSmearRef.current ? dy / dt : 0
      lastScrollY = window.scrollY
      lastScrollTime = now
    }
    window.addEventListener("scroll", handleScroll, { passive: true })

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize)
    resizeObserver?.observe(container)
    animationFrame = requestAnimationFrame(render)

    return () => {
      running = false
      cancelAnimationFrame(animationFrame)
      intersectionObserver?.disconnect()
      document.removeEventListener("visibilitychange", handleVisibility)
      resizeObserver?.disconnect()
      container.removeEventListener("pointerenter", handlePointerEnter)
      container.removeEventListener("pointermove", handlePointerMove)
      container.removeEventListener("pointerleave", handlePointerLeave)
      container.removeEventListener("pointerup", handlePointerUp)
      container.removeEventListener("pointercancel", handlePointerUp)
      window.removeEventListener("scroll", handleScroll)
      controlsRef.current?.(null)
      renderer.destroy()
      rendererRef.current = null
    }
  }, [effect, sourceRevision, video, canvasSource])

  useEffect(() => {
    rendererRef.current?.updateEffectOptions(effectOptions ?? {}, preset)
  }, [effectOptions, preset])

  useEffect(() => {
    rendererRef.current?.setAmbient(motionReduced ? null : ambient ?? null)
  }, [ambient, motionReduced, sourceRevision])

  useEffect(() => {
    rendererRef.current?.setPointerMode(pointerMode ?? "repel")
  }, [pointerMode, sourceRevision])

  // Scroll reveal: numeric prop drives directly; "auto" tracks viewport
  // position via scroll + resize (progress 0 at bottom edge entry, 1 once
  // the element's center clears ~35% up the viewport). Reduced motion pins
  // the field fully assembled.
  useEffect(() => {
    const renderer = rendererRef.current
    if (renderer === null) return

    if (motionReduced || scrollReveal === undefined) {
      renderer.setReveal(null)
      return
    }

    if (typeof scrollReveal === "number") {
      renderer.setReveal(Math.min(Math.max(scrollReveal, 0), 1))
      return
    }

    const container = containerRef.current
    if (container === null) return

    const update = () => {
      const bounds = container.getBoundingClientRect()
      const viewport = window.innerHeight || 1
      // 0 when the element top touches the viewport bottom; 1 when it has
      // risen 65% of the way up. Clamped and monotonic per position.
      const progress = (viewport - bounds.top) / (viewport * 0.65)
      renderer.setReveal(Math.min(Math.max(progress, 0), 1))
    }

    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [scrollReveal, motionReduced, sourceRevision])

  return (
    <span
      ref={containerRef}
      className={className}
      data-shader-effect={effect.id}
      style={{
        display: "block",
        position: "relative",
        cursor: "default",
        // Touch moves drive the particle field instead of scrolling the
        // page while a finger is on the canvas. Override via style if the
        // element should scroll normally on touch.
        touchAction: "none",
        ...style,
      }}
    >
      {canvasSource !== null ? null : video ? (
        <video
          ref={videoRef}
          src={src as string}
          muted
          loop
          playsInline
          autoPlay
          aria-label={alt}
          onLoadedData={() => setSourceRevision((revision) => revision + 1)}
          style={{
            ...mediaStyle,
            visibility: rendererReady ? "hidden" : "visible",
          }}
        />
      ) : (
        <img
          ref={imageRef}
          src={src as string}
          alt={alt}
          onLoad={() => setSourceRevision((revision) => revision + 1)}
          style={{
            ...mediaStyle,
            visibility: rendererReady ? "hidden" : "visible",
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          ...mediaStyle,
          position: "absolute",
          inset: 0,
          visibility: rendererReady ? "visible" : "hidden",
        }}
      />
    </span>
  )
}

export function DitherImage(props: FlagshipDotMatterProps): ReactElement {
  return <DotMatter {...props} effect={ditherEffect} />
}

export function ParticleImage(props: FlagshipDotMatterProps): ReactElement {
  return <DotMatter {...props} effect={particleEffect} />
}

export function HalftoneImage(props: FlagshipDotMatterProps): ReactElement {
  return <DotMatter {...props} effect={halftoneEffect} />
}


export interface DotMatterTextProps {
  /** The text to render as a particle field. */
  text: string
  effect: EffectDefinition
  preset?: string
  effectOptions?: Record<string, unknown>
  ambient?: AmbientMotion
  scrollReveal?: "auto" | number
  reduceMotion?: boolean
  pointerMode?: PointerMode
  scrollSmear?: boolean
  controls?: (controls: DotMatterControls | null) => void
  /** CSS font shorthand for rasterization. Default: bold sans at 200px. */
  font?: string
  /** Text fill used for luminance sampling. Default: white on transparent. */
  fill?: string
  className?: string
  style?: CSSProperties
  onError?: (error: Error & { code?: string }) => void
}

/**
 * Render a headline as an interactive particle field. The text is
 * rasterized once to an offscreen canvas (white on transparent, so the
 * alpha mask allocates particles only inside the glyphs), then fed through
 * the exact same pipeline as images. The real text stays in the DOM,
 * visually hidden, for screen readers and SEO.
 */
export function DotMatterText({
  text,
  font = "700 200px system-ui, sans-serif",
  fill = "#ffffff",
  ...rest
}: DotMatterTextProps): ReactElement {
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    const padding = 48

    if (context !== null) {
      context.font = font
      const metrics = context.measureText(text)
      canvas.width = Math.max(2, Math.ceil(metrics.width) + padding * 2)
      canvas.height = Math.max(
        2,
        Math.ceil(
          (metrics.actualBoundingBoxAscent || 150) +
            (metrics.actualBoundingBoxDescent || 50),
        ) + padding * 2,
      )
      // Canvas state resets when resized — set font again.
      const draw = canvas.getContext("2d")!
      draw.font = font
      draw.fillStyle = fill
      draw.textBaseline = "top"
      draw.fillText(text, padding, padding)
    }

    setSourceCanvas(canvas)
  }, [text, font, fill])

  return (
    <span style={{ position: "relative", display: "block" }}>
      {sourceCanvas !== null && (
        <DotMatter src={sourceCanvas} alt="" {...rest} />
      )}
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </span>
  )
}

// Back-compat aliases from the pre-rename API.
export { DotMatter as ShaderImage }
export type { DotMatterProps as ShaderImageProps }
