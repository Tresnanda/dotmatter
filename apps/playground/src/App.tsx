import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
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
  type EffectControl,
} from "./controls.js"
import {
  ambientModes,
  effectCatalog,
  type PlaygroundAmbientId,
  type PlaygroundEffectId,
} from "./effects.js"

const DEFAULT_SOURCE = "/sample.svg"

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={option.value === value ? "segment is-active" : "segment"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Slider({
  id,
  control,
  value,
  onChange,
}: {
  id: string
  control: EffectControl
  value: number
  onChange: (value: number) => void
}) {
  const progress = ((value - control.min) / (control.max - control.min)) * 100
  return (
    <label className="slider-control" htmlFor={id}>
      <span className="slider-meta">
        <span>{control.label}</span>
        <output>{formatControlValue(control, value)}</output>
      </span>
      <input
        id={id}
        className="range"
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        style={{ "--progress": `${progress}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel-section">
      <header className="panel-section-header">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

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
  const [colorModeByEffect, setColorModeByEffect] = useState(() => ({ ...defaultColorMode }))
  const [ambientId, setAmbientId] = useState<PlaygroundAmbientId>("none")
  const [ambientStrength, setAmbientStrength] = useState(0.6)
  const [adjustments, setAdjustments] = useState<Record<string, number>>(() => ({
    ...defaultAdjustments,
  }))
  const [sourceRatio, setSourceRatio] = useState(16 / 10)
  const [textMode, setTextMode] = useState(false)
  const [scrollDemo, setScrollDemo] = useState(false)
  const [pointerMode, setPointerMode] = useState<"repel" | "attract">("repel")
  const [customText, setCustomText] = useState("DOTMATTER")
  const [showAdjust, setShowAdjust] = useState(false)
  const [showTune, setShowTune] = useState(false)
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
        // Dither's tint mode recolors the light ink via u_tint — keep in sync.
        ...(key === "colorLight" ? { tint: value } : {}),
      },
    }))
  }

  const resetEffect = () => {
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
    setAdjustments({ ...defaultAdjustments })
  }

  const handleUpload = (file: File | undefined) => {
    if (file === undefined) return
    const nextSource = URL.createObjectURL(file)
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

  const downloadPng = () => {
    const url = controlsRef.current?.capture()
    if (url === undefined) return
    const link = document.createElement("a")
    link.href = url
    link.download = "dotmatter.png"
    link.click()
  }

  const snippet = `<DotMatter
  src={image}
  effect="${effectId}"
  preset="${selected.preset}"${selectedColorMode === 1 ? `\n  effectOptions={{ colorMode: 1, tint: "${selectedColors.tint ?? "#ffffff"}" }}` : ""}${pointerMode === "attract" ? `\n  pointerMode="attract"` : ""}${ambientId === "none" ? "" : `\n  ambient={{ mode: "${ambientId}" }}`}
/>`

  return (
    <div className="shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="dotmatter home">
          <span className="wordmark-mark" aria-hidden="true" />
          dotmatter
        </a>
        <p className="topbar-tagline">
          Images become fields of physical particles · nothing leaves your browser
        </p>
        <nav className="topbar-actions">
          <button type="button" className="ghost-button" onClick={downloadPng}>
            Export PNG
          </button>
          <a
            className="ghost-button"
            href="https://github.com/Tresnanda/dotmatter"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </nav>
      </header>

      <div className="workspace">
        <main className="stage-area">
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
                controls={(c: DotMatterControls | null) => {
                  controlsRef.current = c
                }}
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
                controls={(c: DotMatterControls | null) => {
                  controlsRef.current = c
                }}
                alt="Interactive particle preview"
                className="shader-frame"
                style={{ "--ratio": sourceRatio } as CSSProperties}
              />
            )}
            <p className="stage-hint" aria-hidden="true">
              move your cursor through the field
            </p>
          </div>

          <footer className="stage-footer">
            <details className="usage">
              <summary>Use this configuration</summary>
              <pre>
                <code>{snippet}</code>
              </pre>
            </details>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setScrollDemo((current) => !current)
                if (!scrollDemo) {
                  setTimeout(() => {
                    document
                      .querySelector(".scroll-demo")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }, 50)
                }
              }}
            >
              {scrollDemo ? "Hide scroll demo" : "Scroll reveal demo ↓"}
            </button>
          </footer>

          {scrollDemo && (
            <section className="scroll-demo">
              <div className="scroll-demo-spacer">
                <p>Keep scrolling — the field assembles as it comes into view</p>
                <span aria-hidden="true">↓</span>
              </div>
              <div className="scroll-demo-track">
                <div className="scroll-demo-sticky">
                  <DotMatter
                    key={`reveal-${effectId}-${source}`}
                    src={source}
                    effect={selected.effect}
                    preset={selected.preset}
                    effectOptions={effectOptions}
                    scrollReveal="auto"
                    pointerMode={pointerMode}
                    alt="Scroll reveal demo"
                    className="shader-frame"
                    style={{ "--ratio": sourceRatio } as CSSProperties}
                  />
                </div>
              </div>
              <div className="scroll-demo-spacer">
                <p>Scroll back up to scatter it again — fully interruptible</p>
                <span aria-hidden="true">↑</span>
              </div>
            </section>
          )}
        </main>

        <aside className="inspector" aria-label="Controls">
          <Section title="Source">
            <Segmented
              label="Source type"
              value={textMode ? "text" : "image"}
              options={[
                { value: "image", label: "Image" },
                { value: "text", label: "Text" },
              ]}
              onChange={(mode) => setTextMode(mode === "text")}
            />
            {textMode ? (
              <input
                className="text-input"
                type="text"
                value={customText}
                maxLength={24}
                placeholder="Type something"
                onChange={(event) => setCustomText(event.currentTarget.value.toUpperCase())}
                aria-label="Text to render"
              />
            ) : (
              <>
                <label className="upload-control">
                  <span>{uploadedSource === null ? "Upload an image" : "Replace image"}</span>
                  <span aria-hidden="true">↗</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    onChange={(event) => handleUpload(event.currentTarget.files?.[0])}
                  />
                </label>
                {uploadedSource !== null && (
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
              </>
            )}
          </Section>

          <Section title="Effect">
            <div className="effect-grid" role="radiogroup" aria-label="Effect">
              {effectCatalog.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={entry.id === effectId}
                  title={entry.description}
                  className={entry.id === effectId ? "effect-chip is-active" : "effect-chip"}
                  onClick={() => setEffectId(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Cursor">
            <Segmented
              label="Cursor behavior"
              value={pointerMode}
              options={[
                { value: "repel", label: "Repel" },
                { value: "attract", label: "Attract" },
              ]}
              onChange={setPointerMode}
            />
          </Section>

          <Section title="Motion">
            <Segmented
              label="Ambient motion"
              value={ambientId}
              options={ambientModes.map((mode) => ({ value: mode.id, label: mode.label }))}
              onChange={setAmbientId}
            />
            {ambientId !== "none" && (
              <Slider
                id="ambient-strength"
                control={{
                  key: "ambientStrength",
                  label: "Drift",
                  min: 0.1,
                  max: 2,
                  step: 0.01,
                  decimals: 2,
                }}
                value={ambientStrength}
                onChange={setAmbientStrength}
              />
            )}
          </Section>

          <Section title="Color">
            <Segmented
              label="Color mode"
              value={selectedColorMode}
              options={[
                { value: 0, label: "From image" },
                { value: 1, label: "Custom" },
              ]}
              onChange={(mode) => setColorModeByEffect((c) => ({ ...c, [effectId]: mode }))}
            />
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
          </Section>

          <Section
            title="Image adjustments"
            action={
              <button
                type="button"
                className="disclosure"
                aria-expanded={showAdjust}
                onClick={() => setShowAdjust((v) => !v)}
              >
                {showAdjust ? "Hide" : "Show"}
              </button>
            }
          >
            {showAdjust && (
              <div className="slider-stack">
                {imageAdjustments.map((control) => (
                  <Slider
                    key={control.key}
                    id={`image-${control.key}`}
                    control={control}
                    value={
                      control.key === "contrast"
                        ? selectedOptions[control.key] ?? 1
                        : adjustments[control.key] ?? control.min
                    }
                    onChange={(next) => {
                      if (control.key === "contrast") updateOption("contrast", next)
                      else setAdjustments((c) => ({ ...c, [control.key]: next }))
                    }}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            title={`Fine-tune ${selected.label.toLowerCase()}`}
            action={
              <button
                type="button"
                className="disclosure"
                aria-expanded={showTune}
                onClick={() => setShowTune((v) => !v)}
              >
                {showTune ? "Hide" : "Show"}
              </button>
            }
          >
            {showTune && (
              <div className="slider-stack">
                {effectControls[effectId].map((control) => (
                  <Slider
                    key={control.key}
                    id={`${effectId}-${control.key}`}
                    control={control}
                    value={selectedOptions[control.key] ?? control.min}
                    onChange={(next) => updateOption(control.key, next)}
                  />
                ))}
              </div>
            )}
          </Section>

          <button type="button" className="reset-all" onClick={resetEffect}>
            Reset everything
          </button>
        </aside>
      </div>
    </div>
  )
}
