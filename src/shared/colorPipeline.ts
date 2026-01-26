/**
 * Color Pipeline - Color management, LUTs, and professional finishing
 *
 * This module provides:
 * - sRGB/linear color space handling
 * - Gamma-correct blending
 * - Tone mapping controls
 * - 3D LUT support
 * - Palette/ramp presets
 * - Dithering and film grain helpers
 */

// ============================================================================
// Color Space Definitions
// ============================================================================

export type ColorSpace = 'srgb' | 'linear' | 'rec709' | 'rec2020' | 'acescg';

export interface ColorSpaceConfig {
  inputSpace: ColorSpace;
  workingSpace: ColorSpace;
  outputSpace: ColorSpace;
  linearizeInput: boolean;
  gammaCorrectOutput: boolean;
}

export const DEFAULT_COLOR_SPACE_CONFIG: ColorSpaceConfig = {
  inputSpace: 'srgb',
  workingSpace: 'linear',
  outputSpace: 'srgb',
  linearizeInput: true,
  gammaCorrectOutput: true
};

// ============================================================================
// Gamma / Color Conversion Functions
// ============================================================================

export const SRGB_GAMMA = 2.2;
export const REC709_GAMMA = 2.4;

export const srgbToLinear = (value: number): number => {
  // Precise sRGB transfer function
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return Math.pow((value + 0.055) / 1.055, 2.4);
};

export const linearToSrgb = (value: number): number => {
  if (value <= 0.0031308) {
    return value * 12.92;
  }
  return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
};

export const gammaEncode = (value: number, gamma: number): number =>
  Math.pow(Math.max(0, value), 1 / gamma);

export const gammaDecode = (value: number, gamma: number): number =>
  Math.pow(Math.max(0, value), gamma);

// ============================================================================
// Tone Mapping
// ============================================================================

export type ToneMappingMode =
  | 'none'
  | 'reinhard'
  | 'reinhardExtended'
  | 'aces'
  | 'acesApprox'
  | 'filmic'
  | 'uncharted2'
  | 'agx';

export interface ToneMappingConfig {
  mode: ToneMappingMode;
  exposure: number;      // EV stops
  whitePoint: number;    // For extended Reinhard
  contrast: number;      // Post-tonemap contrast
  saturation: number;    // Post-tonemap saturation
  shoulderStrength: number; // For filmic curves
  linearStrength: number;
  linearAngle: number;
  toeStrength: number;
  toeNumerator: number;
  toeDenominator: number;
}

export const DEFAULT_TONE_MAPPING_CONFIG: ToneMappingConfig = {
  mode: 'acesApprox',
  exposure: 0,
  whitePoint: 4,
  contrast: 1,
  saturation: 1,
  shoulderStrength: 0.22,
  linearStrength: 0.30,
  linearAngle: 0.10,
  toeStrength: 0.20,
  toeNumerator: 0.01,
  toeDenominator: 0.30
};

// Reinhard simple
export const tonemapReinhard = (hdr: number): number => hdr / (1 + hdr);

// Reinhard extended
export const tonemapReinhardExtended = (hdr: number, whitePoint: number): number =>
  (hdr * (1 + hdr / (whitePoint * whitePoint))) / (1 + hdr);

// ACES approximation (fast)
export const tonemapAcesApprox = (hdr: number): number => {
  if (hdr <= 0) return 0; // Clamp negative/zero inputs
  const a = 2.51;
  const b = 0.03;
  const c = 2.43;
  const d = 0.59;
  const e = 0.14;
  return Math.min(1, (hdr * (a * hdr + b)) / (hdr * (c * hdr + d) + e));
};

// Uncharted 2 / Hable
const uncharted2Curve = (x: number, config: ToneMappingConfig): number => {
  const { shoulderStrength: A, linearStrength: B, linearAngle: C,
          toeStrength: D, toeNumerator: E, toeDenominator: F } = config;
  return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
};

export const tonemapUncharted2 = (hdr: number, config: ToneMappingConfig): number => {
  const W = 11.2; // White point
  const exposureBias = 2.0;
  const curr = uncharted2Curve(exposureBias * hdr, config);
  const whiteScale = 1 / uncharted2Curve(W, config);
  return curr * whiteScale;
};

export const applyToneMapping = (
  value: number,
  config: ToneMappingConfig
): number => {
  // Apply exposure
  const exposed = value * Math.pow(2, config.exposure);

  let mapped: number;
  switch (config.mode) {
    case 'none':
      mapped = exposed;
      break;
    case 'reinhard':
      mapped = tonemapReinhard(exposed);
      break;
    case 'reinhardExtended':
      mapped = tonemapReinhardExtended(exposed, config.whitePoint);
      break;
    case 'acesApprox':
    case 'aces':
      mapped = tonemapAcesApprox(exposed);
      break;
    case 'uncharted2':
    case 'filmic':
      mapped = tonemapUncharted2(exposed, config);
      break;
    case 'agx':
      // AgX is complex - use ACES approx as fallback
      mapped = tonemapAcesApprox(exposed);
      break;
    default:
      mapped = exposed;
  }

  return Math.max(0, Math.min(1, mapped));
};

// ============================================================================
// 3D LUT Support
// ============================================================================

export interface LUT3D {
  id: string;
  name: string;
  size: number;        // Typically 17, 33, or 65
  data: Float32Array;  // RGB triplets, size^3 * 3
  domain: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

export const createIdentityLUT = (size: number): LUT3D => {
  const data = new Float32Array(size * size * size * 3);
  let index = 0;

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        data[index++] = r / (size - 1);
        data[index++] = g / (size - 1);
        data[index++] = b / (size - 1);
      }
    }
  }

  return {
    id: 'identity',
    name: 'Identity',
    size,
    data,
    domain: {
      min: [0, 0, 0],
      max: [1, 1, 1]
    }
  };
};

export const trilinearInterpolate = (
  lut: LUT3D,
  r: number,
  g: number,
  b: number
): [number, number, number] => {
  const { size, data, domain } = lut;

  // Normalize to domain
  const rn = (r - domain.min[0]) / (domain.max[0] - domain.min[0]);
  const gn = (g - domain.min[1]) / (domain.max[1] - domain.min[1]);
  const bn = (b - domain.min[2]) / (domain.max[2] - domain.min[2]);

  // Scale to LUT coordinates
  const rs = Math.max(0, Math.min(size - 1, rn * (size - 1)));
  const gs = Math.max(0, Math.min(size - 1, gn * (size - 1)));
  const bs = Math.max(0, Math.min(size - 1, bn * (size - 1)));

  // Get integer and fractional parts
  const ri = Math.floor(rs);
  const gi = Math.floor(gs);
  const bi = Math.floor(bs);
  const rf = rs - ri;
  const gf = gs - gi;
  const bf = bs - bi;

  // Get 8 corner indices
  const idx = (r: number, g: number, b: number) =>
    ((b * size + g) * size + r) * 3;

  const r0 = Math.min(ri, size - 1);
  const r1 = Math.min(ri + 1, size - 1);
  const g0 = Math.min(gi, size - 1);
  const g1 = Math.min(gi + 1, size - 1);
  const b0 = Math.min(bi, size - 1);
  const b1 = Math.min(bi + 1, size - 1);

  // Trilinear interpolation
  const result: [number, number, number] = [0, 0, 0];

  for (let c = 0; c < 3; c++) {
    const c000 = data[idx(r0, g0, b0) + c];
    const c100 = data[idx(r1, g0, b0) + c];
    const c010 = data[idx(r0, g1, b0) + c];
    const c110 = data[idx(r1, g1, b0) + c];
    const c001 = data[idx(r0, g0, b1) + c];
    const c101 = data[idx(r1, g0, b1) + c];
    const c011 = data[idx(r0, g1, b1) + c];
    const c111 = data[idx(r1, g1, b1) + c];

    // Interpolate along R
    const c00 = c000 * (1 - rf) + c100 * rf;
    const c10 = c010 * (1 - rf) + c110 * rf;
    const c01 = c001 * (1 - rf) + c101 * rf;
    const c11 = c011 * (1 - rf) + c111 * rf;

    // Interpolate along G
    const c0 = c00 * (1 - gf) + c10 * gf;
    const c1 = c01 * (1 - gf) + c11 * gf;

    // Interpolate along B
    result[c] = c0 * (1 - bf) + c1 * bf;
  }

  return result;
};

// ============================================================================
// Color Palettes and Ramps
// ============================================================================

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: ColorRGB[];
  interpolation: 'linear' | 'smooth' | 'step';
  locked: boolean;
}

export const DEFAULT_PALETTES: ColorPalette[] = [
  {
    id: 'palette-sunset',
    name: 'Sunset',
    colors: [
      { r: 0.1, g: 0.05, b: 0.2 },
      { r: 0.6, g: 0.1, b: 0.3 },
      { r: 1.0, g: 0.4, b: 0.2 },
      { r: 1.0, g: 0.8, b: 0.4 }
    ],
    interpolation: 'smooth',
    locked: false
  },
  {
    id: 'palette-ocean',
    name: 'Ocean',
    colors: [
      { r: 0.0, g: 0.05, b: 0.1 },
      { r: 0.0, g: 0.2, b: 0.4 },
      { r: 0.1, g: 0.5, b: 0.7 },
      { r: 0.5, g: 0.9, b: 1.0 }
    ],
    interpolation: 'smooth',
    locked: false
  },
  {
    id: 'palette-neon',
    name: 'Neon',
    colors: [
      { r: 0.0, g: 0.0, b: 0.1 },
      { r: 1.0, g: 0.0, b: 0.5 },
      { r: 0.0, g: 1.0, b: 1.0 },
      { r: 1.0, g: 1.0, b: 0.0 }
    ],
    interpolation: 'linear',
    locked: false
  },
  {
    id: 'palette-fire',
    name: 'Fire',
    colors: [
      { r: 0.1, g: 0.0, b: 0.0 },
      { r: 0.8, g: 0.1, b: 0.0 },
      { r: 1.0, g: 0.6, b: 0.0 },
      { r: 1.0, g: 1.0, b: 0.8 }
    ],
    interpolation: 'smooth',
    locked: false
  },
  {
    id: 'palette-bw',
    name: 'Black & White',
    colors: [
      { r: 0.0, g: 0.0, b: 0.0 },
      { r: 1.0, g: 1.0, b: 1.0 }
    ],
    interpolation: 'linear',
    locked: true
  }
];

export const samplePalette = (
  palette: ColorPalette,
  t: number
): ColorRGB => {
  const { colors, interpolation } = palette;
  if (colors.length === 0) return { r: 0, g: 0, b: 0 };
  if (colors.length === 1) return colors[0];

  t = Math.max(0, Math.min(1, t));

  if (interpolation === 'step') {
    const index = Math.min(colors.length - 1, Math.floor(t * colors.length));
    return colors[index];
  }

  const scaled = t * (colors.length - 1);
  const index = Math.floor(scaled);
  const frac = scaled - index;

  const c0 = colors[Math.min(index, colors.length - 1)];
  const c1 = colors[Math.min(index + 1, colors.length - 1)];

  let factor = frac;
  if (interpolation === 'smooth') {
    // Smoothstep
    factor = frac * frac * (3 - 2 * frac);
  }

  return {
    r: c0.r + (c1.r - c0.r) * factor,
    g: c0.g + (c1.g - c0.g) * factor,
    b: c0.b + (c1.b - c0.b) * factor
  };
};

// ============================================================================
// Dithering
// ============================================================================

export type DitheringMode = 'none' | 'bayer2' | 'bayer4' | 'bayer8' | 'blueNoise' | 'whiteNoise';

export interface DitheringConfig {
  mode: DitheringMode;
  intensity: number;  // 0-1
  bitDepth: number;   // Target bit depth (8, 10, 12)
}

export const DEFAULT_DITHERING_CONFIG: DitheringConfig = {
  mode: 'bayer4',
  intensity: 0.5,
  bitDepth: 8
};

// Bayer matrices
const BAYER_2X2 = [
  [0, 2],
  [3, 1]
];

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21]
];

export const getBayerThreshold = (
  x: number,
  y: number,
  config: DitheringConfig
): number => {
  let matrix: number[][];
  let size: number;

  switch (config.mode) {
    case 'bayer2':
      matrix = BAYER_2X2;
      size = 2;
      break;
    case 'bayer4':
      matrix = BAYER_4X4;
      size = 4;
      break;
    case 'bayer8':
      matrix = BAYER_8X8;
      size = 8;
      break;
    default:
      return 0;
  }

  const xi = x % size;
  const yi = y % size;
  const threshold = matrix[yi][xi] / (size * size);

  return (threshold - 0.5) * config.intensity;
};

export const applyDithering = (
  value: number,
  x: number,
  y: number,
  config: DitheringConfig
): number => {
  if (config.mode === 'none') return value;

  const levels = Math.pow(2, config.bitDepth);
  let threshold: number;

  if (config.mode === 'whiteNoise') {
    threshold = (Math.random() - 0.5) * config.intensity / levels;
  } else if (config.mode === 'blueNoise') {
    // Simple approximation - in production use precomputed blue noise texture
    const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    threshold = ((noise - Math.floor(noise)) - 0.5) * config.intensity / levels;
  } else {
    threshold = getBayerThreshold(x, y, config) / levels;
  }

  return Math.max(0, Math.min(1, value + threshold));
};

// ============================================================================
// Film Grain
// ============================================================================

export interface FilmGrainConfig {
  enabled: boolean;
  intensity: number;    // 0-1
  size: number;         // Grain size multiplier
  colored: boolean;     // Color grain vs monochrome
  speed: number;        // Animation speed (0 = static)
  luminanceResponse: number; // How much grain appears in shadows vs highlights
}

export const DEFAULT_FILM_GRAIN_CONFIG: FilmGrainConfig = {
  enabled: false,
  intensity: 0.15,
  size: 1.0,
  colored: false,
  speed: 24,
  luminanceResponse: 0.5
};

export const generateGrainValue = (
  x: number,
  y: number,
  frame: number,
  config: FilmGrainConfig
): number => {
  // Simple grain noise
  const seed = x * 12.9898 + y * 78.233 + frame * config.speed * 0.1;
  const noise = Math.sin(seed) * 43758.5453;
  return (noise - Math.floor(noise)) * 2 - 1;
};

export const applyFilmGrain = (
  value: number,
  x: number,
  y: number,
  frame: number,
  config: FilmGrainConfig
): number => {
  if (!config.enabled || config.intensity === 0) return value;

  const grain = generateGrainValue(x / config.size, y / config.size, frame, config);

  // Reduce grain in very dark and very bright areas
  const luminanceWeight = 1 - Math.abs(value - 0.5) * 2 * config.luminanceResponse;

  return Math.max(0, Math.min(1, value + grain * config.intensity * luminanceWeight));
};

// ============================================================================
// System Presets (Scene/Master Level)
// ============================================================================

export interface ColorGradingPreset {
  id: string;
  name: string;
  category: 'cinematic' | 'creative' | 'technical' | 'custom';
  toneMapping: Partial<ToneMappingConfig>;
  palette?: string;  // Palette ID reference
  lut?: string;      // LUT ID reference
  dithering: Partial<DitheringConfig>;
  filmGrain: Partial<FilmGrainConfig>;
  tags: string[];
}

export const DEFAULT_GRADING_PRESETS: ColorGradingPreset[] = [
  {
    id: 'grade-neutral',
    name: 'Neutral',
    category: 'technical',
    toneMapping: { mode: 'none', exposure: 0, contrast: 1, saturation: 1 },
    dithering: { mode: 'bayer4', intensity: 0.3 },
    filmGrain: { enabled: false },
    tags: ['clean', 'reference']
  },
  {
    id: 'grade-cinematic',
    name: 'Cinematic',
    category: 'cinematic',
    toneMapping: { mode: 'acesApprox', exposure: 0.2, contrast: 1.1, saturation: 0.95 },
    dithering: { mode: 'bayer4', intensity: 0.5 },
    filmGrain: { enabled: true, intensity: 0.1, colored: false },
    tags: ['film', 'dramatic']
  },
  {
    id: 'grade-vibrant',
    name: 'Vibrant',
    category: 'creative',
    toneMapping: { mode: 'reinhard', exposure: 0.1, contrast: 1.15, saturation: 1.3 },
    palette: 'palette-neon',
    dithering: { mode: 'bayer4', intensity: 0.4 },
    filmGrain: { enabled: false },
    tags: ['colorful', 'punchy']
  },
  {
    id: 'grade-noir',
    name: 'Noir',
    category: 'cinematic',
    toneMapping: { mode: 'uncharted2', exposure: -0.3, contrast: 1.4, saturation: 0.3 },
    dithering: { mode: 'bayer8', intensity: 0.6 },
    filmGrain: { enabled: true, intensity: 0.2, colored: false },
    tags: ['dark', 'dramatic', 'desaturated']
  },
  {
    id: 'grade-sunset',
    name: 'Golden Hour',
    category: 'creative',
    toneMapping: { mode: 'acesApprox', exposure: 0.3, contrast: 1.05, saturation: 1.1 },
    palette: 'palette-sunset',
    dithering: { mode: 'bayer4', intensity: 0.4 },
    filmGrain: { enabled: true, intensity: 0.08, colored: true },
    tags: ['warm', 'golden']
  },
  {
    id: 'grade-broadcast',
    name: 'Broadcast Safe',
    category: 'technical',
    toneMapping: { mode: 'reinhard', exposure: 0, contrast: 0.95, saturation: 0.9 },
    dithering: { mode: 'bayer4', intensity: 0.5 },
    filmGrain: { enabled: false },
    tags: ['safe', 'broadcast', 'legal']
  }
];

export const getPresetById = (id: string): ColorGradingPreset | undefined =>
  DEFAULT_GRADING_PRESETS.find((p) => p.id === id);

export const getPresetsByCategory = (category: ColorGradingPreset['category']): ColorGradingPreset[] =>
  DEFAULT_GRADING_PRESETS.filter((p) => p.category === category);

export const getPresetsByTag = (tag: string): ColorGradingPreset[] =>
  DEFAULT_GRADING_PRESETS.filter((p) => p.tags.includes(tag));

// ============================================================================
// Color Pipeline State
// ============================================================================

export interface ColorPipelineState {
  colorSpace: ColorSpaceConfig;
  toneMapping: ToneMappingConfig;
  activePaletteId: string | null;
  activeLutId: string | null;
  dithering: DitheringConfig;
  filmGrain: FilmGrainConfig;
  activePresetId: string | null;
}

export const DEFAULT_COLOR_PIPELINE_STATE: ColorPipelineState = {
  colorSpace: { ...DEFAULT_COLOR_SPACE_CONFIG },
  toneMapping: { ...DEFAULT_TONE_MAPPING_CONFIG },
  activePaletteId: null,
  activeLutId: null,
  dithering: { ...DEFAULT_DITHERING_CONFIG },
  filmGrain: { ...DEFAULT_FILM_GRAIN_CONFIG },
  activePresetId: null
};

export const applyGradingPreset = (
  state: ColorPipelineState,
  preset: ColorGradingPreset
): ColorPipelineState => ({
  ...state,
  toneMapping: {
    ...state.toneMapping,
    ...preset.toneMapping
  },
  activePaletteId: preset.palette ?? state.activePaletteId,
  activeLutId: preset.lut ?? state.activeLutId,
  dithering: {
    ...state.dithering,
    ...preset.dithering
  },
  filmGrain: {
    ...state.filmGrain,
    ...preset.filmGrain
  },
  activePresetId: preset.id
});
