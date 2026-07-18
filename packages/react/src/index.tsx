import {
  createShaderImageRenderer,
  normalizePointerPosition,
  type AmbientMotion,
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
  src: string
  effect: EffectDefinition
  alt: string
  /** Treat src as a video: renders a muted looped <video> streamed to the GPU. */
  video?: boolean
  preset?: string
  effectOptions?: Record<string, unknown>
  ambient?: AmbientMotion
  className?: string
  style?: CSSProperties
  onError?: (error: Error & { code?: string }) => void
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
  className,
  style,
  onError,
}: DotMatterProps): ReactElement {
  const containerRef = useRef<HTMLSpanElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ShaderImageRenderer>(null)
  const pointerRef = useRef<readonly [number, number]>([0.5, 0.5])
  const pointerActiveRef = useRef(false)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const [sourceRevision, setSourceRevision] = useState(0)
  const [rendererReady, setRendererReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const image = video ? videoRef.current : imageRef.current
    const canvas = canvasRef.current

    if (sourceRevision === 0 || container === null || image === null || canvas === null) {
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
      })
      rendererRef.current = renderer
      renderer.setSource(image, video ? { continuous: true } : undefined)
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
      pointerRef.current = normalizePointerPosition(event, bounds)
    }

    const handlePointerLeave = () => {
      pointerActiveRef.current = false
    }

    const startedAt = performance.now()
    const render = (now: number) => {
      renderer.render({
        time: (now - startedAt) / 1000,
        pointer: pointerRef.current,
        pointerActive: pointerActiveRef.current,
      })
      animationFrame = requestAnimationFrame(render)
    }

    resize()
    container.addEventListener("pointerenter", handlePointerEnter)
    container.addEventListener("pointermove", handlePointerMove)
    container.addEventListener("pointerleave", handlePointerLeave)

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize)
    resizeObserver?.observe(container)
    animationFrame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      container.removeEventListener("pointerenter", handlePointerEnter)
      container.removeEventListener("pointermove", handlePointerMove)
      container.removeEventListener("pointerleave", handlePointerLeave)
      renderer.destroy()
      rendererRef.current = null
    }
  }, [effect, sourceRevision, video])

  useEffect(() => {
    rendererRef.current?.updateEffectOptions(effectOptions ?? {}, preset)
  }, [effectOptions, preset])

  useEffect(() => {
    rendererRef.current?.setAmbient(ambient ?? null)
  }, [ambient])

  return (
    <span
      ref={containerRef}
      className={className}
      data-shader-effect={effect.id}
      style={{
        display: "block",
        position: "relative",
        cursor: "default",
        ...style,
      }}
    >
      {video ? (
        <video
          ref={videoRef}
          src={src}
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
          src={src}
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

// Back-compat aliases from the pre-rename API.
export { DotMatter as ShaderImage }
export type { DotMatterProps as ShaderImageProps }
