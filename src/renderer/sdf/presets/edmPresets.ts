/**
 * EDM SDF Presets
 *
 * Pre-configured burst SDF setups for common EDM visual patterns.
 * These can be loaded into the BurstSdfManager for beat-reactive visuals.
 */

import type { BurstSdfConfig } from '../runtime/burstSdfManager';
import { DEFAULT_BURST_PARAMS } from '../../../shared/lfoUtils';

// ============================================================================
// Color Palettes
// ============================================================================

export const EDM_COLORS = {
  neonCyan: [0.0, 1.0, 1.0] as [number, number, number],
  neonMagenta: [1.0, 0.0, 1.0] as [number, number, number],
  neonOrange: [1.0, 0.5, 0.0] as [number, number, number],
  neonGreen: [0.0, 1.0, 0.3] as [number, number, number],
  neonPink: [1.0, 0.2, 0.6] as [number, number, number],
  neonBlue: [0.2, 0.4, 1.0] as [number, number, number],
  neonYellow: [1.0, 1.0, 0.2] as [number, number, number],
  pureWhite: [1.0, 1.0, 1.0] as [number, number, number],
  warmWhite: [1.0, 0.95, 0.9] as [number, number, number],
};

// ============================================================================
// Ring Presets - Classic expanding rings
// ============================================================================

/** Bass-triggered expanding ring - classic EDM drop visual */
export const BASS_RING_DROP: BurstSdfConfig = {
  shapeId: 'ring',
  baseParams: {
    radius: 0.03,
    thickness: 0.025
  },
  envelope: {
    attack: 0.03,
    hold: 0,
    decay: 0.7,
    trigger: 'audio.bass',
    threshold: 0.45,
    maxConcurrent: 6
  },
  animatedParam: 'radius',
  animStartValue: 0.03,
  animEndValue: 0.9,
  fadeOpacity: true,
  color: EDM_COLORS.neonCyan
};

/** Quick snappy ring for hi-hats/snares */
export const SNARE_RING_SNAP: BurstSdfConfig = {
  shapeId: 'ring',
  baseParams: {
    radius: 0.02,
    thickness: 0.015
  },
  envelope: {
    attack: 0.02,
    hold: 0,
    decay: 0.25,
    trigger: 'audio.mid',
    threshold: 0.55,
    maxConcurrent: 4
  },
  animatedParam: 'radius',
  animStartValue: 0.02,
  animEndValue: 0.4,
  fadeOpacity: true,
  color: EDM_COLORS.neonMagenta
};

/** Thick ring for impactful moments */
export const IMPACT_RING_THICK: BurstSdfConfig = {
  shapeId: 'ring',
  baseParams: {
    radius: 0.05,
    thickness: 0.06
  },
  envelope: {
    attack: 0.02,
    hold: 0.08,
    decay: 0.5,
    trigger: 'audio.peak',
    threshold: 0.7,
    maxConcurrent: 3
  },
  animatedParam: 'radius',
  animStartValue: 0.05,
  animEndValue: 1.0,
  fadeOpacity: true,
  color: EDM_COLORS.pureWhite
};

// ============================================================================
// Star Presets - Energetic star bursts
// ============================================================================

/** Five-pointed star burst on peaks */
export const STAR_BURST_CLASSIC: BurstSdfConfig = {
  shapeId: 'star',
  baseParams: {
    outerRadius: 0.08,
    innerRadius: 0.03,
    points: 5
  },
  envelope: {
    attack: 0.03,
    hold: 0.05,
    decay: 0.4,
    trigger: 'audio.peak',
    threshold: 0.6,
    maxConcurrent: 4
  },
  animatedParam: 'outerRadius',
  animStartValue: 0.08,
  animEndValue: 0.55,
  fadeOpacity: true,
  color: EDM_COLORS.neonOrange
};

/** 8-pointed star for sparkle effect */
export const STAR_SPARKLE: BurstSdfConfig = {
  shapeId: 'star',
  baseParams: {
    outerRadius: 0.06,
    innerRadius: 0.02,
    points: 8
  },
  envelope: {
    attack: 0.015,
    hold: 0,
    decay: 0.2,
    trigger: 'audio.high',
    threshold: 0.5,
    maxConcurrent: 6
  },
  animatedParam: 'outerRadius',
  animStartValue: 0.06,
  animEndValue: 0.35,
  fadeOpacity: true,
  color: EDM_COLORS.neonYellow
};

// ============================================================================
// Polygon Presets - Geometric shapes
// ============================================================================

/** Hexagon pulse - tech/futuristic feel */
export const HEXAGON_PULSE: BurstSdfConfig = {
  shapeId: 'polygon',
  baseParams: {
    radius: 0.05,
    sides: 6
  },
  envelope: {
    attack: 0.02,
    hold: 0.1,
    decay: 0.35,
    trigger: 'audio.mid',
    threshold: 0.5,
    maxConcurrent: 4
  },
  animatedParam: 'radius',
  animStartValue: 0.05,
  animEndValue: 0.45,
  fadeOpacity: true,
  color: EDM_COLORS.neonBlue
};

/** Triangle burst - sharp and angular */
export const TRIANGLE_BURST: BurstSdfConfig = {
  shapeId: 'triangle-equilateral',
  baseParams: {
    size: 0.06
  },
  envelope: {
    attack: 0.025,
    hold: 0.03,
    decay: 0.3,
    trigger: 'audio.peak',
    threshold: 0.55,
    maxConcurrent: 5
  },
  animatedParam: 'size',
  animStartValue: 0.06,
  animEndValue: 0.5,
  fadeOpacity: true,
  color: EDM_COLORS.neonGreen
};

/** Pentagon for variety */
export const PENTAGON_EXPAND: BurstSdfConfig = {
  shapeId: 'polygon',
  baseParams: {
    radius: 0.04,
    sides: 5
  },
  envelope: {
    attack: 0.03,
    hold: 0.05,
    decay: 0.4,
    trigger: 'audio.bass',
    threshold: 0.5,
    maxConcurrent: 4
  },
  animatedParam: 'radius',
  animStartValue: 0.04,
  animEndValue: 0.6,
  fadeOpacity: true,
  color: EDM_COLORS.neonPink
};

// ============================================================================
// Cross/X Presets - Aggressive patterns
// ============================================================================

/** X shape burst for intense moments */
export const X_BURST_AGGRESSIVE: BurstSdfConfig = {
  shapeId: 'x-shape',
  baseParams: {
    size: 0.08,
    thickness: 0.02
  },
  envelope: {
    attack: 0.02,
    hold: 0.02,
    decay: 0.25,
    trigger: 'audio.peak',
    threshold: 0.65,
    maxConcurrent: 3
  },
  animatedParam: 'size',
  animStartValue: 0.08,
  animEndValue: 0.5,
  fadeOpacity: true,
  color: EDM_COLORS.neonMagenta
};

/** Plus/cross for structured visuals */
export const CROSS_EXPAND: BurstSdfConfig = {
  shapeId: 'cross',
  baseParams: {
    length: 0.06,
    thickness: 0.02
  },
  envelope: {
    attack: 0.025,
    hold: 0.04,
    decay: 0.35,
    trigger: 'audio.mid',
    threshold: 0.5,
    maxConcurrent: 4
  },
  animatedParam: 'length',
  animStartValue: 0.06,
  animEndValue: 0.45,
  fadeOpacity: true,
  color: EDM_COLORS.neonCyan
};

// ============================================================================
// Arc Presets - Partial circles for variety
// ============================================================================

/** Arc sweep effect */
export const ARC_SWEEP: BurstSdfConfig = {
  shapeId: 'arc',
  baseParams: {
    radius: 0.04,
    thickness: 0.02,
    aperture: 1.0 // ~60 degrees
  },
  envelope: {
    attack: 0.03,
    hold: 0.05,
    decay: 0.4,
    trigger: 'audio.bass',
    threshold: 0.5,
    maxConcurrent: 4
  },
  animatedParam: 'radius',
  animStartValue: 0.04,
  animEndValue: 0.6,
  fadeOpacity: true,
  color: EDM_COLORS.warmWhite
};

// ============================================================================
// Composite Preset Collections
// ============================================================================

/** Classic EDM drop preset collection */
export const EDM_DROP_COLLECTION: BurstSdfConfig[] = [
  BASS_RING_DROP,
  STAR_BURST_CLASSIC,
  IMPACT_RING_THICK
];

/** High energy preset collection */
export const HIGH_ENERGY_COLLECTION: BurstSdfConfig[] = [
  SNARE_RING_SNAP,
  STAR_SPARKLE,
  X_BURST_AGGRESSIVE,
  TRIANGLE_BURST
];

/** Tech/Futuristic preset collection */
export const TECH_COLLECTION: BurstSdfConfig[] = [
  HEXAGON_PULSE,
  PENTAGON_EXPAND,
  CROSS_EXPAND,
  ARC_SWEEP
];

/** Minimal preset collection (fewer simultaneous bursts) */
export const MINIMAL_COLLECTION: BurstSdfConfig[] = [
  {
    ...BASS_RING_DROP,
    envelope: { ...BASS_RING_DROP.envelope, maxConcurrent: 2 }
  },
  {
    ...STAR_BURST_CLASSIC,
    envelope: { ...STAR_BURST_CLASSIC.envelope, maxConcurrent: 2 }
  }
];

// ============================================================================
// Concentric Ring Sets - Multiple rings expanding together
// ============================================================================

/**
 * Create a set of concentric expanding rings
 * @param ringCount Number of rings
 * @param baseColor Base color (each ring slightly varies)
 * @param trigger Trigger type
 */
export const createConcentricRings = (
  ringCount: number = 3,
  baseColor: [number, number, number] = EDM_COLORS.neonCyan,
  trigger: 'audio.peak' | 'audio.bass' | 'audio.mid' | 'audio.high' = 'audio.bass'
): BurstSdfConfig[] => {
  const rings: BurstSdfConfig[] = [];

  for (let i = 0; i < ringCount; i++) {
    const delay = i * 0.03; // Stagger timing
    const sizeOffset = i * 0.15; // Each ring larger

    // Color variation - slightly shift hue for each ring
    const colorShift = i * 0.1;
    const color: [number, number, number] = [
      Math.min(1, baseColor[0] + colorShift * 0.3),
      Math.min(1, baseColor[1] - colorShift * 0.2),
      Math.min(1, baseColor[2] + colorShift * 0.2)
    ];

    rings.push({
      shapeId: 'ring',
      baseParams: {
        radius: 0.02 + i * 0.01,
        thickness: 0.015 - i * 0.002
      },
      envelope: {
        attack: 0.02 + delay,
        hold: 0,
        decay: 0.5 + i * 0.1,
        trigger,
        threshold: 0.5,
        maxConcurrent: 2
      },
      animatedParam: 'radius',
      animStartValue: 0.02 + i * 0.01,
      animEndValue: 0.5 + sizeOffset,
      fadeOpacity: true,
      color
    });
  }

  return rings;
};

/**
 * Create a radial spike burst (multiple shapes arranged in a circle)
 * @param spikeCount Number of spikes
 * @param color Color for all spikes
 */
export const createRadialSpikes = (
  spikeCount: number = 6,
  color: [number, number, number] = EDM_COLORS.neonOrange
): BurstSdfConfig[] => {
  const spikes: BurstSdfConfig[] = [];
  const angleStep = (Math.PI * 2) / spikeCount;

  for (let i = 0; i < spikeCount; i++) {
    const angle = i * angleStep;
    const offsetX = Math.cos(angle) * 0.15;
    const offsetY = Math.sin(angle) * 0.15;

    spikes.push({
      shapeId: 'triangle-equilateral',
      baseParams: {
        size: 0.04
      },
      envelope: {
        attack: 0.02,
        hold: 0.03,
        decay: 0.35,
        trigger: 'audio.peak',
        threshold: 0.6,
        maxConcurrent: 2
      },
      animatedParam: 'size',
      animStartValue: 0.04,
      animEndValue: 0.25,
      fadeOpacity: true,
      color,
      position: [offsetX, offsetY]
    });
  }

  return spikes;
};

// ============================================================================
// Preset Registry
// ============================================================================

export interface EdmPresetInfo {
  id: string;
  name: string;
  description: string;
  configs: BurstSdfConfig[];
  tags: string[];
}

export const EDM_PRESET_REGISTRY: EdmPresetInfo[] = [
  {
    id: 'drop-classic',
    name: 'Classic Drop',
    description: 'Bass-triggered expanding rings and stars for drops',
    configs: EDM_DROP_COLLECTION,
    tags: ['drop', 'bass', 'classic']
  },
  {
    id: 'high-energy',
    name: 'High Energy',
    description: 'Fast, aggressive shapes for high-energy sections',
    configs: HIGH_ENERGY_COLLECTION,
    tags: ['energy', 'fast', 'aggressive']
  },
  {
    id: 'tech-future',
    name: 'Tech Future',
    description: 'Geometric shapes for tech/futuristic vibes',
    configs: TECH_COLLECTION,
    tags: ['tech', 'geometric', 'future']
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Subtle, less busy visual response',
    configs: MINIMAL_COLLECTION,
    tags: ['minimal', 'subtle', 'clean']
  },
  {
    id: 'concentric-cyan',
    name: 'Concentric Cyan',
    description: 'Multiple expanding cyan rings',
    configs: createConcentricRings(3, EDM_COLORS.neonCyan, 'audio.bass'),
    tags: ['rings', 'concentric', 'bass']
  },
  {
    id: 'concentric-magenta',
    name: 'Concentric Magenta',
    description: 'Multiple expanding magenta rings',
    configs: createConcentricRings(4, EDM_COLORS.neonMagenta, 'audio.peak'),
    tags: ['rings', 'concentric', 'peak']
  },
  {
    id: 'radial-spikes',
    name: 'Radial Spikes',
    description: 'Triangles arranged in a radial pattern',
    configs: createRadialSpikes(6, EDM_COLORS.neonOrange),
    tags: ['radial', 'spikes', 'triangles']
  }
];

/**
 * Get a preset by ID
 */
export const getEdmPreset = (id: string): EdmPresetInfo | undefined => {
  return EDM_PRESET_REGISTRY.find(p => p.id === id);
};

/**
 * Get presets by tag
 */
export const getEdmPresetsByTag = (tag: string): EdmPresetInfo[] => {
  return EDM_PRESET_REGISTRY.filter(p => p.tags.includes(tag));
};
