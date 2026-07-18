import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { DotMatter, DotMatterText, type DotMatterControls } from "@dotmatter/react"
import type { AmbientMotion } from "@dotmatter/core"
import {
  colorControls,
  defaultAdjustments,
  defaultColorMode,
  defaultColors,
  defaultEffectOptions,
  effectControls,
  formatControlValue,
  imageAdjustments,
} from "./controls.js"
import {
  ambientModes,
  effectCatalog,
  type PlaygroundAmbientId,
  type PlaygroundEffectId,
} from "./effects.js"

const DEFAULT_SOURCE = "/sample.svg"

export function App() {
  const [effectId, setEffectId] = useState<PlaygroundEffectId>("particles")
  const [source, setSource] = useState(DEFAULT_SOURCE)
  const [uploadedSource, setUploadedSource] = useState<string | null>(null)
  const [optionsByEffect, setOptionsByEffect] = useState(() =>
    Object.fromEntries(
      effectCatalog.map((entry) => [entry.id, { ...defaultEffectOptions[entry.id] }]),
    ) as Record<PlaygroundEffectId, Record<string, number>>,
  )
  const [colorsByEffect, setColorsByEffect] = useState(() =>
    Object.fromEntries(
      effectCatalog.map((entry) => [entry.id, { ...defaultColors[entry.id] }]),
    ) as Record<PlaygroundEffectId, Record<string, string>>,
  )
  const [colorModeByEffect, setColorModeByEffect] = useState(() =>
    ({ ...defaultColorMode }),
  )
  const [ambientId, setAmbientId] = useState<PlaygroundAmbientId>("none")
  const [ambientStrength, setAmbientStrength] = useState(0.6)
  const [adjustments, setAdjustments] = useState<Record<string, number>>(
    () => ({ ...defaultAdjustments }),
  )
  // Natural aspect ratio of the current source; the frame follows the image.
  const [sourceRatio, setSourceRatio] = useState(16 / 10)
  const [textMode, setTextMode] = useState(false)
  const [scrollDemo, setScrollDemo] = useState(false)
  const [pointerMode, setPointerMode] = useState<"repel" | "attract">("repel")
  const [scrollSmear, setScrollSmear] = useState(false)
  const [customText, setCustomText] = useState("DOTMATTER")
  const controlsRef = useRef<DotMatterControls | null>(null)
  const selected = effectCatalog.find((entry) => entry.id === effectId)!
  const selectedOptions = optionsByEffect[effectId]
  const selectedColors = colorsByEffect[effectId]
  const selectedColorMode = colorModeByEffect[effectId]

  const ambient = useMemo<AmbientMotion | undefined>(
    () =>
      ambientId === "none"
        ? undefined
        : { mode: ambientId, strength: ambientStrength, speed: 1, scale: 1.4 },
    [ambientId, ambientStrength],
  )

  const effectOptions = useMemo(
    () => ({
      ...selectedOptions,
      ...adjustments,
      ...selectedColors,
      colorMode: selectedColorMode,
    }),
    [selectedOptions, adjustments, selectedColors, selectedColorMode],
  )

  useEffect(() => {
    return () => {
      if (uploadedSource !== null) URL.revokeObjectURL(uploadedSource)
    }
  }, [uploadedSource])

  const updateOption = (key: string, value: number) => {
    setOptionsByEffect((current) => ({
      ...current,
      [effectId]: { ...current[effectId], [key]: value },
    }))
  }

  const updateColor = (key: string, value: string) => {
    setColorsByEffect((current) => ({
      ...current,
      [effectId]: {
        ...current[effectId],
        [key]: value,
        // Dither's tint mode recolors the light ink via u_tint — keep the
        // two in sync so the "Light ink" picker works in both modes.
        ...(key === "colorLight" ? { tint: value } : {}),
      },
    }))
  }

  const resetOptions = () => {
    setOptionsByEffect((current) => ({
      ...current,
      [effectId]: { ...defaultEffectOptions[effectId] },
    }))
    setColorsByEffect((current) => ({
      ...current,
      [effectId]: { ...defaultColors[effectId] },
    }))
    setColorModeByEffect((current) => ({
      ...current,
      [effectId]: defaultColorMode[effectId],
    }))
  }

  const handleUpload = (file: File | undefined) => {
    if (file === undefined) return
    const nextSource = URL.createObjectURL(file)
    // Adopt the upload's natural aspect ratio so nothing gets cropped.
    const probe = new Image()
    probe.onload = () => {
      if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
        setSourceRatio(probe.naturalWidth / probe.naturalHeight)
      }
    }
    probe.src = nextSource
    setUploadedSource((previous) => {
      if (previous !== null) URL.revokeObjectURL(previous)
      return nextSource
    })
    setSource(nextSource)
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="dotmatter home">
          <span className="wordmark-mark" />
          dotmatter
        </a>
        <p>WebGL2 · React · local rendering</p>
        <a className="code-link" href="#usage">View API</a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Interactive image study / 001</div>
          <h1>Turn pixels into a responsive field.</h1>
          <p className="intro">
            Upload an image, pick a method, then move across the frame.
            Nothing leaves your browser.
          </p>
        </div>
        <div className="hero-source">
          <div className="source-mode-toggle">
            <button
              type="button"
              className={textMode ? "ambient-option" : "ambient-option is-active"}
              onClick={() => setTextMode(false)}
            >
              Image
            </button>
            <button
              type="button"
              className={textMode ? "ambient-option is-active" : "ambient-option"}
              onClick={() => setTextMode(true)}
            >
              Text
            </button>
          </div>
          {textMode && (
            <input
              className="text-input"
              type="text"
              value={customText}
              maxLength={24}
              onChange={(event) => setCustomText(event.currentTarget.value.toUpperCase())}
              aria-label="Text to render"
            />
          )}
          {!textMode && (
          <label className="upload-control">
            <span>{uploadedSource === null ? "Choose an image" : "Replace image"}</span>
            <span aria-hidden="true">↗</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              onChange={(event) => handleUpload(event.currentTarget.files?.[0])}
            />
          </label>
          )}
          {!textMode && uploadedSource !== null && (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                URL.revokeObjectURL(uploadedSource)
                setUploadedSource(null)
                setSource(DEFAULT_SOURCE)
                setSourceRatio(16 / 10)
              }}
            >
              Restore sample
            </button>
          )}
        </div>
      </section>

      <section className="stage-column">
        <div className="stage-meta">
          <span>Live canvas</span>
          <nav className="method-tabs" aria-label="Rendering method">
            {effectCatalog.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={entry.id === effectId ? "method-tab is-active" : "method-tab"}
                onClick={() => setEffectId(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className={pointerMode === "attract" ? "ambient-option is-active" : "ambient-option"}
            onClick={() => setPointerMode((m) => (m === "repel" ? "attract" : "repel"))}
          >
            {pointerMode === "attract" ? "Attract" : "Repel"}
          </button>
          <button
            type="button"
            className={scrollSmear ? "ambient-option is-active" : "ambient-option"}
            onClick={() => setScrollSmear((v) => !v)}
          >
            Smear
          </button>
          <button
            type="button"
            className={scrollDemo ? "ambient-option is-active" : "ambient-option"}
            onClick={() => {
              setScrollDemo((current) => !current)
              if (!scrollDemo) {
                // Jump to the demo strip so the reveal starts from scattered.
                setTimeout(() => {
                  document.querySelector(".scroll-demo")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }, 50)
              }
            }}
          >
            Scroll reveal
          </button>
          <span>{selected.label} / {selected.preset}</span>
        </div>

        <div className="stage">
          {textMode ? (
            <DotMatterText
              key={`${effectId}-text-${customText}`}
              text={customText || "DOTMATTER"}
              effect={selected.effect}
              preset={selected.preset}
              effectOptions={effectOptions}
              {...(ambient === undefined ? {} : { ambient })}
              pointerMode={pointerMode}
              scrollSmear={scrollSmear}
              controls={(c: DotMatterControls | null) => { controlsRef.current = c }}
              className="shader-frame"
              style={{ "--ratio": 3.2 } as CSSProperties}
            />
          ) : (
          <DotMatter
            key={`${effectId}-${source}`}
            src={source}
            effect={selected.effect}
            preset={selected.preset}
            effectOptions={effectOptions}
            {...(ambient === undefined ? {} : { ambient })}
            pointerMode={pointerMode}
            scrollSmear={scrollSmear}
            controls={(c: DotMatterControls | null) => { controlsRef.current = c }}
            alt="Interactive shader preview"
            className="shader-frame"
            style={{ "--ratio": sourceRatio } as CSSProperties}
          />
          )}
          <div className="stage-corner stage-corner-left">Move pointer</div>
          <button
            type="button"
            className="stage-corner stage-corner-right stage-download"
            onClick={() => {
              const url = controlsRef.current?.capture()
              if (url === undefined) return
              const link = document.createElement("a")
              link.href = url
              link.download = "dotmatter.png"
              link.click()
            }}
          >
            ↓ PNG
          </button>
        </div>

        <div className="control-deck">
          <div className="deck-section">
            <div className="deck-heading">
              <span className="control-label">Tune {selected.label}</span>
              <button className="reset-button" type="button" onClick={resetOptions}>
                Reset
              </button>
            </div>
            <div className="deck-sliders">
              {effectControls[effectId].map((control) => {
                const value = selectedOptions[control.key] ?? control.min
                const progress = ((value - control.min) / (control.max - control.min)) * 100
                return (
                  <label className="slider-control" key={control.key} htmlFor={`${effectId}-${control.key}`}>
                    <span className="slider-meta">
                      <span>{control.label}</span>
                      <output>{formatControlValue(control, value)}</output>
                    </span>
                    <input
                      id={`${effectId}-${control.key}`}
                      className="range"
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={value}
                      style={{
                        background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${progress}%, rgba(255,255,255,.16) ${progress}%, rgba(255,255,255,.16) 100%)`,
                      }}
                      onChange={(event) => updateOption(control.key, Number(event.currentTarget.value))}
                    />
                  </label>
                )
              })}
            </div>
          </div>

          <div className="deck-section">
            <div className="deck-heading">
              <span className="control-label">Image</span>
              <button
                className="reset-button"
                type="button"
                onClick={() => setAdjustments({ ...defaultAdjustments })}
              >
                Reset
              </button>
            </div>
            <div className="deck-sliders deck-sliders-single">
              {imageAdjustments.map((control) => {
                const value =
                  control.key === "contrast"
                    ? selectedOptions[control.key] ?? 1
                    : adjustments[control.key] ?? control.min
                const progress = ((value - control.min) / (control.max - control.min)) * 100
                return (
                  <label className="slider-control" key={control.key} htmlFor={`image-${control.key}`}>
                    <span className="slider-meta">
                      <span>{control.label}</span>
                      <output>{formatControlValue(control, value)}</output>
                    </span>
                    <input
                      id={`image-${control.key}`}
                      className="range"
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={value}
                      style={{
                        background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${progress}%, rgba(255,255,255,.16) ${progress}%, rgba(255,255,255,.16) 100%)`,
                      }}
                      onChange={(event) => {
                        const next = Number(event.currentTarget.value)
                        if (control.key === "contrast") updateOption("contrast", next)
                        else setAdjustments((c) => ({ ...c, [control.key]: next }))
                      }}
                    />
                  </label>
                )
              })}
            </div>
          </div>

          <div className="deck-section">
            <span className="control-label">Color</span>
            <div className="color-mode-toggle" role="radiogroup" aria-label="Color mode">
              <button
                type="button"
                className={selectedColorMode === 0 ? "ambient-option is-active" : "ambient-option"}
                onClick={() => setColorModeByEffect((c) => ({ ...c, [effectId]: 0 }))}
              >
                Source
              </button>
              <button
                type="button"
                className={selectedColorMode === 1 ? "ambient-option is-active" : "ambient-option"}
                onClick={() => setColorModeByEffect((c) => ({ ...c, [effectId]: 1 }))}
              >
                Tint
              </button>
            </div>
            <div className="color-pickers">
              {colorControls[effectId]
                .filter((control) => control.key !== "tint" || selectedColorMode === 1)
                .map((control) => (
                  <label className="color-control" key={control.key}>
                    <input
                      type="color"
                      value={selectedColors[control.key] ?? "#ffffff"}
                      onChange={(event) => updateColor(control.key, event.currentTarget.value)}
                    />
                    <span>{control.label}</span>
                  </label>
                ))}
            </div>
          </div>

          <div className="deck-section">
            <span className="control-label">Ambient motion</span>
            <div className="ambient-options">
              {ambientModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={mode.id === ambientId ? "ambient-option is-active" : "ambient-option"}
                  onClick={() => setAmbientId(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {ambientId !== "none" && (
              <label className="slider-control" htmlFor="ambient-strength">
                <span className="slider-meta">
                  <span>Drift strength</span>
                  <output>{ambientStrength.toFixed(2)}</output>
                </span>
                <input
                  id="ambient-strength"
                  className="range"
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.01"
                  value={ambientStrength}
                  style={{
                    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((ambientStrength - 0.1) / 1.9) * 100}%, rgba(255,255,255,.16) ${((ambientStrength - 0.1) / 1.9) * 100}%, rgba(255,255,255,.16) 100%)`,
                  }}
                  onChange={(event) => setAmbientStrength(Number(event.currentTarget.value))}
                />
              </label>
            )}
          </div>
        </div>

        <section className="usage" id="usage">
          <div>
            <span className="control-label">Current configuration</span>
            <p>One component. The original image remains as an accessible fallback.</p>
          </div>
          <pre><code>{`<DotMatter
  src={image}
  effect="${effectId}"
  preset="${selected.preset}"${selectedColorMode === 1 ? `\n  effectOptions={{ colorMode: 1, tint: "${selectedColors.tint ?? "#ffffff"}" }}` : ""}${ambientId === "none" ? "" : `\n  ambient={{ mode: "${ambientId}" }}`}
/>`}</code></pre>
        </section>

        {scrollDemo && (
          <section className="scroll-demo">
            <div className="scroll-demo-spacer">
              <p className="control-label">Keep scrolling — the field assembles as it enters the viewport</p>
              <span aria-hidden="true">↓</span>
            </div>
            <div className="scroll-demo-stage">
              <DotMatter
                key={`reveal-${effectId}-${source}`}
                src={source}
                effect={selected.effect}
                preset={selected.preset}
                effectOptions={effectOptions}
                scrollReveal="auto"
                alt="Scroll reveal demo"
                className="shader-frame"
                style={{ "--ratio": sourceRatio } as CSSProperties}
              />
            </div>
            <div className="scroll-demo-spacer">
              <p className="control-label">Scroll back up to scatter it again — fully interruptible</p>
              <span aria-hidden="true">↑</span>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
