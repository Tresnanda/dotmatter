import { defineEffect } from "@dotmatter/core"

const adjustmentUniforms = {
  hue: { type: "float", default: 0, min: -180, max: 180 },
  saturation: { type: "float", default: 1, min: 0, max: 2 },
  exposure: { type: "float", default: 0, min: -2, max: 2 },
} as const

export const fullscreenVertexShader = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

// Every effect in the toolkit is a real particle field: each cell is an
// independently simulated object with a home position, velocity, and spring —
// pushed aside by the cursor and bouncing back. The effects differ only in
// how each particle is drawn (soft dot, Bayer square, halftone dot).
const particleVertexShaderBase = (extra: string, sizeExpr: string) => `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_sourceUv;

uniform sampler2D u_texture;
uniform float u_spacing;
uniform float u_pixelRatio;
uniform float u_contrast;
uniform float u_hue;
uniform float u_saturation;
uniform float u_exposure;

out vec2 v_sourceUv;
out float v_luminance;
out float v_sourceAlpha;
out vec3 v_adjustedColor;
${extra}

// Hue rotation in YIQ space — cheap and stable for small UI adjustments.
vec3 adjustColor(vec3 color) {
  color *= pow(2.0, u_exposure);
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_saturation);
  float angle = radians(u_hue);
  float s = sin(angle), c = cos(angle);
  mat3 toYIQ = mat3(0.299, 0.587, 0.114, 0.596, -0.274, -0.322, 0.211, -0.523, 0.312);
  mat3 toRGB = mat3(1.0, 0.956, 0.621, 1.0, -0.272, -0.647, 1.0, -1.106, 1.703);
  vec3 yiq = color * toYIQ;
  vec3 rotated = vec3(yiq.x, yiq.y * c - yiq.z * s, yiq.y * s + yiq.z * c);
  return clamp(rotated * toRGB, 0.0, 1.0);
}

void main() {
  vec4 source = texture(u_texture, a_sourceUv);
  vec3 adjusted = adjustColor(source.rgb);
  float luminance = dot(adjusted, vec3(0.2126, 0.7152, 0.0722));
  luminance = clamp((luminance - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  v_sourceUv = a_sourceUv;
  v_luminance = luminance;
  v_sourceAlpha = source.a;
  v_adjustedColor = adjusted;
  gl_Position = vec4(a_position * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = max(1.0, ${sizeExpr});
}
`

// ---------------------------------------------------------------------------
// Dither — every particle renders as a hard square whose on/off state comes
// from a Bayer threshold of its own sampled luminance. Squares physically
// scatter when pushed because they are simulated particles.
// ---------------------------------------------------------------------------

const ditherVertexShader = particleVertexShaderBase(
  "",
  "u_spacing * u_pixelRatio",
)

// Universal color contract shared by every effect:
//   u_colorMode 0 → use the source image's own colors
//   u_colorMode 1 → use the custom u_tint color
const colorModeShaderChunk = `
uniform float u_colorMode;
uniform vec3 u_tint;

vec3 resolveColor(vec3 sourceColor) {
  return u_colorMode > 0.5 ? u_tint : sourceColor;
}
`

const ditherFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform float u_threshold;
uniform float u_scale;
uniform vec3 u_colorDark;
uniform vec3 u_colorLight;
uniform float u_spacing;

in vec2 v_sourceUv;
in float v_luminance;
in float v_sourceAlpha;
in vec3 v_adjustedColor;
out vec4 outColor;
${colorModeShaderChunk}
float bayer4(vec2 position) {
  ivec2 cell = ivec2(mod(floor(position), 4.0));
  int index = cell.x + cell.y * 4;
  float matrix[16] = float[16](
    0.0, 8.0, 2.0, 10.0,
    12.0, 4.0, 14.0, 6.0,
    3.0, 11.0, 1.0, 9.0,
    15.0, 7.0, 13.0, 5.0
  );
  return (matrix[index] + 0.5) / 16.0;
}

void main() {
  // Each particle sprite carries a tile of fine Bayer sub-pixels so the
  // classic ordered-dither texture survives while the tile itself is a
  // simulated object that scatters and springs back.
  vec2 subPixel = floor(gl_PointCoord * u_spacing / max(u_scale * 0.25, 1.0));
  float pattern = bayer4(subPixel);
  float ink = step(pattern, v_luminance + (u_threshold - 0.5));
  // Full two-tone palette: dark ink is painted, not transparent, so both
  // pickers are visible. Tint mode recolors the light ink with u_tint.
  vec3 lightInk = resolveColor(u_colorLight);
  vec3 color = mix(u_colorDark, lightInk, ink);
  float alpha = v_sourceAlpha;
  if (alpha < 0.01) discard;
  outColor = vec4(color * alpha, alpha);
}
`

export const ditherEffect = defineEffect({
  id: "dither",
  geometry: { type: "particles" },
  source: {
    vertex: ditherVertexShader,
    fragment: ditherFragmentShader,
  },
  uniforms: {
    spacing: { type: "float", default: 5, min: 3, max: 20 },
    scale: { type: "float", default: 4, min: 1, max: 24 },
    threshold: { type: "float", default: 0.5, min: 0, max: 1 },
    contrast: { type: "float", default: 1, min: 0, max: 3 },
    ...adjustmentUniforms,
    colorDark: { type: "color", default: "#000000" },
    colorLight: { type: "color", default: "#ffffff" },
    colorMode: { type: "float", default: 0, min: 0, max: 1 },
    tint: { type: "color", default: "#ffffff" },
    force: { type: "float", default: 16, min: 0, max: 80 },
    forceRadius: { type: "float", default: 0.09, min: 0.02, max: 0.35 },
    spring: { type: "float", default: 26, min: 0, max: 80 },
    damping: { type: "float", default: 0.92, min: 0.5, max: 1 },
    alphaThreshold: { type: "float", default: 0.04, min: 0, max: 1 },
    interactionStrength: { type: "float", default: 1, min: 0, max: 2 },
  },
  presets: {
    editorial: {
      spacing: 5,
      scale: 4,
      threshold: 0.5,
      contrast: 1.15,
      colorDark: "#0a0a0a",
      colorLight: "#f5f5f0",
      force: 14,
      forceRadius: 0.085,
      spring: 26,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 0.9,
    },
    terminal: {
      spacing: 4,
      scale: 3,
      threshold: 0.48,
      contrast: 1.3,
      colorDark: "#06130b",
      colorLight: "#83ff9d",
      force: 16,
      forceRadius: 0.1,
      spring: 24,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 1.1,
    },
  },
})

// ---------------------------------------------------------------------------
// Dot / Particle — soft luminance-sized dots.
// ---------------------------------------------------------------------------

const particleVertexShader = particleVertexShaderBase(
  `uniform float u_pointSize;
uniform bool u_invert;
uniform float u_opacityThreshold;
uniform float u_alphaThreshold;
out float v_visibility;`,
  "u_spacing * u_pointSize * mix(0.18, 1.0, u_invert ? 1.0 - v_luminance : v_luminance) * u_pixelRatio",
).replace(
  "  gl_PointSize = max(1.0,",
  `  float lum = u_invert ? 1.0 - luminance : luminance;
  float visibility = smoothstep(u_opacityThreshold, u_opacityThreshold + 0.08, lum);
  float alphaVisibility = smoothstep(u_alphaThreshold, u_alphaThreshold + 0.06, source.a);
  v_visibility = visibility * alphaVisibility;
  v_luminance = lum;
  gl_PointSize = max(1.0,`,
)

const particleFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D u_texture;

in vec2 v_sourceUv;
in float v_luminance;
in float v_sourceAlpha;
in float v_visibility;
in vec3 v_adjustedColor;
out vec4 outColor;
${colorModeShaderChunk}
void main() {
  float distanceToCenter = length(gl_PointCoord - vec2(0.5));
  float circle = 1.0 - smoothstep(0.42, 0.5, distanceToCenter);
  float alpha = circle * v_sourceAlpha * v_visibility;
  if (alpha < 0.01) discard;
  vec3 sourceColor = v_adjustedColor;
  outColor = vec4(resolveColor(sourceColor), alpha);
}
`

export const particleEffect = defineEffect({
  id: "particles",
  geometry: { type: "particles" },
  source: {
    vertex: particleVertexShader,
    fragment: particleFragmentShader,
  },
  uniforms: {
    spacing: { type: "float", default: 12, min: 5, max: 36 },
    pointSize: { type: "float", default: 0.75, min: 0.15, max: 1.5 },
    contrast: { type: "float", default: 1, min: 0, max: 3 },
    ...adjustmentUniforms,
    force: { type: "float", default: 16, min: 0, max: 80 },
    forceRadius: { type: "float", default: 0.09, min: 0.02, max: 0.35 },
    spring: { type: "float", default: 26, min: 0, max: 80 },
    damping: { type: "float", default: 0.92, min: 0.5, max: 1 },
    invert: { type: "boolean", default: false },
    colorMode: { type: "float", default: 1, min: 0, max: 1 },
    tint: { type: "color", default: "#ffffff" },
    opacityThreshold: { type: "float", default: 0.02, min: 0, max: 1 },
    alphaThreshold: { type: "float", default: 0.04, min: 0, max: 1 },
    interactionStrength: { type: "float", default: 1, min: 0, max: 2 },
  },
  presets: {
    "soft-repel": {
      spacing: 12,
      pointSize: 0.72,
      contrast: 1,
      force: 14,
      forceRadius: 0.085,
      spring: 26,
      damping: 0.92,
      invert: false,
      colorMode: 1,
      tint: "#ffffff",
      opacityThreshold: 0.02,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
    "dense-field": {
      spacing: 8,
      pointSize: 0.68,
      contrast: 1,
      force: 18,
      forceRadius: 0.07,
      spring: 30,
      damping: 0.91,
      invert: false,
      colorMode: 1,
      tint: "#ffffff",
      opacityThreshold: 0.04,
      alphaThreshold: 0.04,
      interactionStrength: 1.1,
    },
  },
})

// ---------------------------------------------------------------------------
// Halftone — print-style dots whose radius encodes darkness. Each dot is a
// simulated particle, so the cursor physically scatters the halftone screen.
// ---------------------------------------------------------------------------

const halftoneVertexShader = particleVertexShaderBase(
  "",
  // Exactly one cell per sprite — overlap would blend the dots back into a
  // continuous image and destroy the halftone screen.
  "u_spacing * u_pixelRatio",
)

const halftoneFragmentShader = `#version 300 es
precision highp float;

uniform float u_channelOffset;
uniform sampler2D u_texture;

in vec2 v_sourceUv;
in float v_luminance;
in float v_sourceAlpha;
in vec3 v_adjustedColor;
out vec4 outColor;
${colorModeShaderChunk}
float toneDot(float tone, vec2 offset) {
  // Dot radius encodes tone: bright areas grow large dots so the image
  // stays legible on the dark canvas (screen-print rather than newsprint).
  float radius = 0.46 * sqrt(clamp(tone, 0.0, 1.0));
  float dist = length(gl_PointCoord - vec2(0.5) - offset);
  return 1.0 - smoothstep(radius - 0.05, radius + 0.05, dist);
}

void main() {
  if (u_colorMode < 0.5) {
    // Source mode: additive RGB separation — each channel gets its own
    // offset dot sized by that channel's brightness.
    vec4 source = vec4(v_adjustedColor, v_sourceAlpha);
    vec2 shift = vec2(u_channelOffset * 0.12, -u_channelOffset * 0.08);
    float red = toneDot(source.r, shift);
    float green = toneDot(source.g, -shift);
    float blue = toneDot(source.b, vec2(0.0));
    vec3 color = vec3(red * source.r, green * source.g, blue * source.b);
    float coverage = max(red, max(green, blue));
    float alpha = v_sourceAlpha * coverage;
    if (alpha < 0.01) discard;
    outColor = vec4(color * v_sourceAlpha, alpha);
  } else {
    // Tint mode: mono dots in the custom ink color.
    float dotValue = toneDot(v_luminance, vec2(0.0));
    float alpha = v_sourceAlpha * dotValue;
    if (alpha < 0.01) discard;
    outColor = vec4(u_tint * alpha, alpha);
  }
}
`

export const halftoneEffect = defineEffect({
  id: "halftone",
  geometry: { type: "particles" },
  source: {
    vertex: halftoneVertexShader,
    fragment: halftoneFragmentShader,
  },
  uniforms: {
    spacing: { type: "float", default: 9, min: 4, max: 28 },
    contrast: { type: "float", default: 1, min: 0, max: 3 },
    ...adjustmentUniforms,
    colorMode: { type: "float", default: 0, min: 0, max: 1 },
    tint: { type: "color", default: "#ffffff" },
    channelOffset: { type: "float", default: 0, min: 0, max: 2 },
    force: { type: "float", default: 16, min: 0, max: 80 },
    forceRadius: { type: "float", default: 0.09, min: 0.02, max: 0.35 },
    spring: { type: "float", default: 26, min: 0, max: 80 },
    damping: { type: "float", default: 0.92, min: 0.5, max: 1 },
    alphaThreshold: { type: "float", default: 0.04, min: 0, max: 1 },
    interactionStrength: { type: "float", default: 1, min: 0, max: 2 },
  },
  presets: {
    "mono-newsprint": {
      spacing: 8,
      contrast: 1.1,
      colorMode: 1,
      tint: "#f5f5f0",
      channelOffset: 0,
      force: 14,
      forceRadius: 0.09,
      spring: 26,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 0.9,
    },
    "cmyk-print": {
      spacing: 10,
      contrast: 1.2,
      colorMode: 0,
      tint: "#ffffff",
      channelOffset: 0.35,
      force: 16,
      forceRadius: 0.1,
      spring: 24,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
  },
})

// ---------------------------------------------------------------------------
// Shared physics uniform block for the Figma/Framer-style families below.
// ---------------------------------------------------------------------------

const physicsUniforms = {
  force: { type: "float", default: 16, min: 0, max: 80 },
  forceRadius: { type: "float", default: 0.09, min: 0.02, max: 0.35 },
  spring: { type: "float", default: 26, min: 0, max: 80 },
  damping: { type: "float", default: 0.92, min: 0.5, max: 1 },
  alphaThreshold: { type: "float", default: 0.04, min: 0, max: 1 },
  interactionStrength: { type: "float", default: 1, min: 0, max: 2 },
} as const

const colorUniforms = {
  colorMode: { type: "float", default: 0, min: 0, max: 1 },
  tint: { type: "color", default: "#ffffff" },
} as const


// ---------------------------------------------------------------------------
// ASCII — each particle is a character cell; luminance picks the glyph from
// a procedural ramp (space · : + x # @) drawn with signed-distance strokes.
// ---------------------------------------------------------------------------

const asciiFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D u_texture;

in vec2 v_sourceUv;
in float v_luminance;
in float v_sourceAlpha;
in vec3 v_adjustedColor;
out vec4 outColor;
${colorModeShaderChunk}
float strokeH(vec2 p, float y, float half_) {
  return step(abs(p.y - y), half_);
}
float strokeV(vec2 p, float x, float half_) {
  return step(abs(p.x - x), half_);
}
float dotMark(vec2 p, float r) {
  return 1.0 - smoothstep(r - 0.05, r + 0.05, length(p - vec2(0.5)));
}

void main() {
  vec2 p = gl_PointCoord;
  // Glyph ramp by luminance: nothing, dot, colon, plus, x, block.
  float level = floor(v_luminance * 5.999);
  float ink = 0.0;
  vec2 c = p - vec2(0.5);
  if (level < 0.5) {
    ink = 0.0;
  } else if (level < 1.5) {
    ink = dotMark(p, 0.09);
  } else if (level < 2.5) {
    ink = max(dotMark(p + vec2(0.0, 0.18), 0.08), dotMark(p - vec2(0.0, 0.18), 0.08));
  } else if (level < 3.5) {
    float bar = 0.30;
    ink = max(strokeH(p, 0.5, 0.055) * step(abs(c.x), bar), strokeV(p, 0.5, 0.055) * step(abs(c.y), bar));
  } else if (level < 4.5) {
    float d = min(abs(c.x - c.y), abs(c.x + c.y));
    ink = step(d, 0.075) * step(max(abs(c.x), abs(c.y)), 0.32);
  } else {
    ink = step(max(abs(c.x), abs(c.y)), 0.34);
  }
  float alpha = ink * v_sourceAlpha;
  if (alpha < 0.01) discard;
  vec3 sourceColor = v_adjustedColor;
  outColor = vec4(resolveColor(sourceColor) * alpha, alpha);
}
`

export const asciiEffect = defineEffect({
  id: "ascii",
  geometry: { type: "particles" },
  source: {
    vertex: particleVertexShaderBase("", "u_spacing * u_pixelRatio"),
    fragment: asciiFragmentShader,
  },
  uniforms: {
    spacing: { type: "float", default: 11, min: 6, max: 28 },
    contrast: { type: "float", default: 1.1, min: 0, max: 3 },
    ...adjustmentUniforms,
    colorMode: { type: "float", default: 1, min: 0, max: 1 },
    tint: { type: "color", default: "#d8ff36" },
    ...physicsUniforms,
  },
  presets: {
    terminal: {
      spacing: 11,
      contrast: 1.15,
      colorMode: 1,
      tint: "#83ff9d",
      force: 14,
      forceRadius: 0.085,
      spring: 26,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
    typewriter: {
      spacing: 13,
      contrast: 1.2,
      colorMode: 1,
      tint: "#f0efe9",
      force: 12,
      forceRadius: 0.08,
      spring: 24,
      damping: 0.93,
      alphaThreshold: 0.04,
      interactionStrength: 0.9,
    },
  },
})

// ---------------------------------------------------------------------------
// LED matrix — glowing rounded pixels: bright core plus soft halo, tinted by
// the source color like a stadium screen.
// ---------------------------------------------------------------------------

const ledFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform float u_glow;

in vec2 v_sourceUv;
in float v_luminance;
in float v_sourceAlpha;
in vec3 v_adjustedColor;
out vec4 outColor;
${colorModeShaderChunk}
void main() {
  vec4 source = vec4(v_adjustedColor, v_sourceAlpha);
  vec2 c = gl_PointCoord - vec2(0.5);
  // Rounded-square core with a soft glow skirt.
  float box = max(abs(c.x), abs(c.y));
  float core = 1.0 - smoothstep(0.26, 0.34, box);
  float halo = (1.0 - smoothstep(0.2, 0.5, length(c))) * u_glow * 0.6;
  float brightness = v_luminance * (core + halo);
  vec3 base = resolveColor(source.rgb);
  vec3 color = mix(base, vec3(1.0), v_luminance * 0.25);
  float alpha = clamp(brightness, 0.0, 1.0) * v_sourceAlpha;
  if (alpha < 0.01) discard;
  outColor = vec4(color * alpha, alpha);
}
`

export const ledEffect = defineEffect({
  id: "led",
  geometry: { type: "particles" },
  source: {
    vertex: particleVertexShaderBase("", "u_spacing * u_pixelRatio"),
    fragment: ledFragmentShader,
  },
  uniforms: {
    spacing: { type: "float", default: 10, min: 5, max: 26 },
    contrast: { type: "float", default: 1.15, min: 0, max: 3 },
    ...adjustmentUniforms,
    glow: { type: "float", default: 0.8, min: 0, max: 2 },
    ...colorUniforms,
    ...physicsUniforms,
  },
  presets: {
    stadium: {
      spacing: 10,
      contrast: 1.2,
      glow: 0.9,
      force: 16,
      forceRadius: 0.09,
      spring: 26,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
    "soft-billboard": {
      spacing: 14,
      contrast: 1.1,
      glow: 1.3,
      force: 14,
      forceRadius: 0.1,
      spring: 22,
      damping: 0.93,
      alphaThreshold: 0.04,
      interactionStrength: 0.9,
    },
  },
})

// ---------------------------------------------------------------------------
// Cross-stitch — X-shaped marks sized by luminance, embroidery feel.
// ---------------------------------------------------------------------------

const stitchFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D u_texture;

in vec2 v_sourceUv;
in float v_luminance;
in float v_sourceAlpha;
in vec3 v_adjustedColor;
out vec4 outColor;
${colorModeShaderChunk}
void main() {
  vec4 source = vec4(v_adjustedColor, v_sourceAlpha);
  vec2 c = gl_PointCoord - vec2(0.5);
  // X mark: two diagonal strokes; extent scales with luminance so bright
  // cells stitch bigger crosses.
  float extent = mix(0.08, 0.4, v_luminance);
  float d = min(abs(c.x - c.y), abs(c.x + c.y));
  float within = step(max(abs(c.x), abs(c.y)), extent);
  float stroke = (1.0 - smoothstep(0.04, 0.09, d)) * within;
  float alpha = stroke * v_sourceAlpha;
  if (alpha < 0.01) discard;
  vec3 color = resolveColor(mix(source.rgb, vec3(1.0), 0.2));
  outColor = vec4(color * alpha, alpha);
}
`

export const stitchEffect = defineEffect({
  id: "stitch",
  geometry: { type: "particles" },
  source: {
    vertex: particleVertexShaderBase("", "u_spacing * u_pixelRatio"),
    fragment: stitchFragmentShader,
  },
  uniforms: {
    spacing: { type: "float", default: 12, min: 6, max: 28 },
    contrast: { type: "float", default: 1.1, min: 0, max: 3 },
    ...adjustmentUniforms,
    ...colorUniforms,
    ...physicsUniforms,
  },
  presets: {
    embroidery: {
      spacing: 12,
      contrast: 1.15,
      force: 14,
      forceRadius: 0.09,
      spring: 24,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
    "fine-thread": {
      spacing: 8,
      contrast: 1.2,
      force: 16,
      forceRadius: 0.075,
      spring: 28,
      damping: 0.91,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
  },
})

// ---------------------------------------------------------------------------
// Scanline — horizontal bar segments whose thickness encodes luminance,
// CRT / receipt-printer feel. Bars are particles, so they scatter too.
// ---------------------------------------------------------------------------

const scanlineFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D u_texture;

in vec2 v_sourceUv;
in float v_luminance;
in float v_sourceAlpha;
in vec3 v_adjustedColor;
out vec4 outColor;
${colorModeShaderChunk}
void main() {
  vec4 source = vec4(v_adjustedColor, v_sourceAlpha);
  vec2 c = gl_PointCoord - vec2(0.5);
  // Bar thickness follows luminance; slight horizontal fade at segment ends.
  float halfThickness = mix(0.03, 0.42, v_luminance);
  float bar = 1.0 - smoothstep(halfThickness - 0.04, halfThickness + 0.04, abs(c.y));
  float ends = 1.0 - smoothstep(0.38, 0.5, abs(c.x));
  float alpha = bar * ends * v_sourceAlpha;
  if (alpha < 0.01) discard;
  vec3 color = resolveColor(mix(source.rgb, vec3(1.0), 0.15));
  outColor = vec4(color * alpha, alpha);
}
`

export const scanlineEffect = defineEffect({
  id: "scanline",
  geometry: { type: "particles" },
  source: {
    vertex: particleVertexShaderBase("", "u_spacing * u_pixelRatio"),
    fragment: scanlineFragmentShader,
  },
  uniforms: {
    spacing: { type: "float", default: 9, min: 4, max: 24 },
    contrast: { type: "float", default: 1.15, min: 0, max: 3 },
    ...adjustmentUniforms,
    ...colorUniforms,
    ...physicsUniforms,
  },
  presets: {
    crt: {
      spacing: 8,
      contrast: 1.2,
      force: 14,
      forceRadius: 0.09,
      spring: 26,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
    receipt: {
      spacing: 12,
      contrast: 1.3,
      force: 12,
      forceRadius: 0.1,
      spring: 22,
      damping: 0.93,
      alphaThreshold: 0.04,
      interactionStrength: 0.9,
    },
  },
})

// ---------------------------------------------------------------------------
// Mosaic — rounded tiles whose inset breathes with luminance; bright cells
// fill their sprite, dark cells shrink to slivers.
// ---------------------------------------------------------------------------

const mosaicFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D u_texture;

in vec2 v_sourceUv;
in float v_luminance;
in float v_sourceAlpha;
in vec3 v_adjustedColor;
out vec4 outColor;
${colorModeShaderChunk}
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  // Tile half-extent grows with luminance; rounded corners via corner circle.
  float extent = mix(0.1, 0.46, v_luminance);
  vec2 q = abs(c) - vec2(extent - 0.1);
  float dist = length(max(q, 0.0)) - 0.1;
  float tile = 1.0 - smoothstep(-0.02, 0.03, dist);
  float alpha = tile * v_sourceAlpha;
  if (alpha < 0.01) discard;
  outColor = vec4(resolveColor(v_adjustedColor) * alpha, alpha);
}
`

export const mosaicEffect = defineEffect({
  id: "mosaic",
  geometry: { type: "particles" },
  source: {
    vertex: particleVertexShaderBase("", "u_spacing * u_pixelRatio"),
    fragment: mosaicFragmentShader,
  },
  uniforms: {
    spacing: { type: "float", default: 14, min: 6, max: 32 },
    contrast: { type: "float", default: 1.1, min: 0, max: 3 },
    ...adjustmentUniforms,
    ...colorUniforms,
    ...physicsUniforms,
  },
  presets: {
    tiles: {
      spacing: 14,
      contrast: 1.15,
      force: 14,
      forceRadius: 0.09,
      spring: 26,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
    "fine-grid": {
      spacing: 9,
      contrast: 1.2,
      force: 16,
      forceRadius: 0.08,
      spring: 28,
      damping: 0.91,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
  },
})

// ---------------------------------------------------------------------------
// Rings — concentric circular strokes per cell; ring density follows tone,
// like tree rings or engraved medallions.
// ---------------------------------------------------------------------------

const ringsFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D u_texture;

in vec2 v_sourceUv;
in float v_luminance;
in float v_sourceAlpha;
in vec3 v_adjustedColor;
out vec4 outColor;
${colorModeShaderChunk}
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float radius = length(c);
  if (radius > 0.5) discard;
  // Ring count 1–4 by luminance; stroke from the fractional radial band.
  float ringCount = 1.0 + floor(v_luminance * 3.999);
  float band = fract(radius * ringCount * 2.0);
  float stroke = 1.0 - smoothstep(0.28, 0.42, abs(band - 0.5));
  // Outermost edge fades so rings sit inside their cell.
  float edge = 1.0 - smoothstep(0.42, 0.5, radius);
  float alpha = stroke * edge * v_sourceAlpha * smoothstep(0.02, 0.12, v_luminance);
  if (alpha < 0.01) discard;
  outColor = vec4(resolveColor(v_adjustedColor) * alpha, alpha);
}
`

export const ringsEffect = defineEffect({
  id: "rings",
  geometry: { type: "particles" },
  source: {
    vertex: particleVertexShaderBase("", "u_spacing * u_pixelRatio"),
    fragment: ringsFragmentShader,
  },
  uniforms: {
    spacing: { type: "float", default: 16, min: 8, max: 36 },
    contrast: { type: "float", default: 1.15, min: 0, max: 3 },
    ...adjustmentUniforms,
    ...colorUniforms,
    ...physicsUniforms,
  },
  presets: {
    engraving: {
      spacing: 16,
      contrast: 1.2,
      force: 14,
      forceRadius: 0.09,
      spring: 24,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
    medallion: {
      spacing: 24,
      contrast: 1.25,
      force: 12,
      forceRadius: 0.11,
      spring: 22,
      damping: 0.93,
      alphaThreshold: 0.04,
      interactionStrength: 0.9,
    },
  },
})

// ---------------------------------------------------------------------------
// Contour — short line segments angled by local image gradient, like a
// flow-field pen sketch. Angle comes from neighboring luminance samples.
// ---------------------------------------------------------------------------

const contourVertexShader = particleVertexShaderBase(
  `uniform float u_angleRange;
out float v_angle;`,
  "u_spacing * 1.2 * u_pixelRatio",
).replace(
  "  gl_PointSize = max(1.0,",
  `  // Local gradient via two extra taps; segment lies along the contour
  // (perpendicular to the gradient), clamped to u_angleRange degrees.
  float rightLum = dot(adjustColor(texture(u_texture, a_sourceUv + vec2(0.004, 0.0)).rgb), vec3(0.2126, 0.7152, 0.0722));
  float upLum = dot(adjustColor(texture(u_texture, a_sourceUv + vec2(0.0, 0.004)).rgb), vec3(0.2126, 0.7152, 0.0722));
  float rawAngle = atan(upLum - luminance, rightLum - luminance) + 1.5707963;
  float range = radians(u_angleRange);
  v_angle = clamp(rawAngle, -range, range);
  gl_PointSize = max(1.0,`,
)

const contourFragmentShader = `#version 300 es
precision highp float;

uniform sampler2D u_texture;

in vec2 v_sourceUv;
in float v_luminance;
in float v_sourceAlpha;
in vec3 v_adjustedColor;
in float v_angle;
out vec4 outColor;
${colorModeShaderChunk}
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  // Rotate the sprite frame by the contour angle, draw a horizontal stroke.
  float s = sin(v_angle), co = cos(v_angle);
  vec2 r = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
  float len = mix(0.12, 0.46, v_luminance);
  float thickness = 0.07;
  float stroke = (1.0 - smoothstep(thickness - 0.03, thickness + 0.03, abs(r.y)))
    * (1.0 - smoothstep(len - 0.05, len, abs(r.x)));
  float alpha = stroke * v_sourceAlpha * smoothstep(0.02, 0.1, v_luminance);
  if (alpha < 0.01) discard;
  outColor = vec4(resolveColor(v_adjustedColor) * alpha, alpha);
}
`

export const contourEffect = defineEffect({
  id: "contour",
  geometry: { type: "particles" },
  source: {
    vertex: contourVertexShader,
    fragment: contourFragmentShader,
  },
  uniforms: {
    spacing: { type: "float", default: 10, min: 5, max: 24 },
    contrast: { type: "float", default: 1.15, min: 0, max: 3 },
    angleRange: { type: "float", default: 180, min: 15, max: 180 },
    ...adjustmentUniforms,
    ...colorUniforms,
    ...physicsUniforms,
  },
  presets: {
    sketch: {
      spacing: 10,
      contrast: 1.2,
      angleRange: 180,
      force: 14,
      forceRadius: 0.09,
      spring: 26,
      damping: 0.92,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
    "cross-hatch": {
      spacing: 7,
      contrast: 1.3,
      angleRange: 60,
      force: 16,
      forceRadius: 0.08,
      spring: 28,
      damping: 0.91,
      alphaThreshold: 0.04,
      interactionStrength: 1,
    },
  },
})
