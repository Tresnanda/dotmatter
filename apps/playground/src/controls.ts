import type { PlaygroundEffectId } from "./effects.js"

export interface EffectControl {
  key: string
  label: string
  min: number
  max: number
  step: number
  unit?: string
  decimals?: number
}

export interface ColorControl {
  key: string
  label: string
}

/** Per-effect color pickers shown when colorMode is "tint" (or always, for dither's palette). */
export const colorControls: Record<PlaygroundEffectId, readonly ColorControl[]> = {
  particles: [{ key: "tint", label: "Dot color" }],
  dither: [
    { key: "colorDark", label: "Dark ink" },
    { key: "colorLight", label: "Light ink" },
  ],
  halftone: [{ key: "tint", label: "Ink color" }],
  ascii: [{ key: "tint", label: "Glyph color" }],
  led: [{ key: "tint", label: "Pixel color" }],
  stitch: [{ key: "tint", label: "Thread color" }],
  scanline: [{ key: "tint", label: "Line color" }],
}

/** Effects where colorMode 0 = source imagery, 1 = tint. All seven support it. */
export const defaultColorMode: Record<PlaygroundEffectId, number> = {
  particles: 1,
  dither: 0,
  halftone: 0,
  ascii: 1,
  led: 0,
  stitch: 0,
  scanline: 0,
}

/** Universal image adjustments shared by every effect. */
export const imageAdjustments: readonly EffectControl[] = [
  { key: "hue", label: "Hue", min: -180, max: 180, step: 1, unit: "°" },
  { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.01, decimals: 2 },
  { key: "exposure", label: "Exposure", min: -2, max: 2, step: 0.01, decimals: 2 },
  { key: "contrast", label: "Contrast", min: 0.5, max: 2.5, step: 0.01, decimals: 2 },
]

export const defaultAdjustments: Record<string, number> = {
  hue: 0,
  saturation: 1,
  exposure: 0,
}

export const defaultColors: Record<PlaygroundEffectId, Record<string, string>> = {
  particles: { tint: "#ffffff" },
  dither: { colorDark: "#0a0a0a", colorLight: "#f5f5f0", tint: "#f5f5f0" },
  halftone: { tint: "#ffffff" },
  ascii: { tint: "#83ff9d" },
  led: { tint: "#d8ff36" },
  stitch: { tint: "#ffffff" },
  scanline: { tint: "#ffffff" },
}

const pushControls: readonly EffectControl[] = [
  { key: "force", label: "Push force", min: 2, max: 30, step: 0.5, decimals: 1 },
  { key: "forceRadius", label: "Push size", min: 0.025, max: 0.18, step: 0.005, decimals: 3 },
  { key: "spring", label: "Return spring", min: 4, max: 40, step: 0.5, decimals: 1 },
  { key: "damping", label: "Damping", min: 0.75, max: 0.98, step: 0.01, decimals: 2 },
]

export const effectControls: Record<PlaygroundEffectId, readonly EffectControl[]> = {
  dither: [
    ...pushControls,
    { key: "spacing", label: "Cell size", min: 3, max: 12, step: 1 },
    { key: "threshold", label: "Threshold", min: 0, max: 1, step: 0.01, decimals: 2 },
  ],
  particles: [
    ...pushControls,
    { key: "pointSize", label: "Dot size", min: 0.25, max: 1.2, step: 0.01, decimals: 2 },
    { key: "spacing", label: "Spacing", min: 6, max: 22, step: 1 },
  ],
  halftone: [
    ...pushControls,
    { key: "spacing", label: "Cell size", min: 4, max: 20, step: 1 },
    { key: "channelOffset", label: "Channel offset", min: 0, max: 1.2, step: 0.01, decimals: 2 },
  ],
  ascii: [
    ...pushControls,
    { key: "spacing", label: "Glyph size", min: 6, max: 28, step: 1 },
  ],
  led: [
    ...pushControls,
    { key: "spacing", label: "Pixel size", min: 5, max: 26, step: 1 },
    { key: "glow", label: "Glow", min: 0, max: 2, step: 0.01, decimals: 2 },
  ],
  stitch: [
    ...pushControls,
    { key: "spacing", label: "Stitch size", min: 6, max: 28, step: 1 },
  ],
  scanline: [
    ...pushControls,
    { key: "spacing", label: "Line pitch", min: 4, max: 24, step: 1 },
  ],
}

export const defaultEffectOptions: Record<PlaygroundEffectId, Record<string, number>> = {
  dither: {
    interactionStrength: 0.9,
    force: 14,
    forceRadius: 0.085,
    spring: 26,
    damping: 0.92,
    spacing: 5,
    scale: 4,
    threshold: 0.5,
    contrast: 1.15,
  },
  particles: {
    interactionStrength: 1,
    force: 14,
    forceRadius: 0.085,
    pointSize: 0.72,
    spacing: 12,
    spring: 26,
    damping: 0.92,
  },
  halftone: {
    interactionStrength: 1,
    force: 16,
    forceRadius: 0.1,
    spring: 24,
    damping: 0.92,
    spacing: 10,
    contrast: 1.2,
    channelOffset: 0.35,
  },
  ascii: {
    interactionStrength: 1,
    force: 14,
    forceRadius: 0.085,
    spring: 26,
    damping: 0.92,
    spacing: 11,
    contrast: 1.15,
  },
  led: {
    interactionStrength: 1,
    force: 16,
    forceRadius: 0.09,
    spring: 26,
    damping: 0.92,
    spacing: 10,
    glow: 0.9,
    contrast: 1.2,
  },
  stitch: {
    interactionStrength: 1,
    force: 14,
    forceRadius: 0.09,
    spring: 24,
    damping: 0.92,
    spacing: 12,
    contrast: 1.15,
  },
  scanline: {
    interactionStrength: 1,
    force: 14,
    forceRadius: 0.09,
    spring: 26,
    damping: 0.92,
    spacing: 8,
    contrast: 1.2,
  },
}

export function formatControlValue(control: EffectControl, value: number): string {
  return `${value.toFixed(control.decimals ?? 0)}${control.unit ?? ""}`
}
