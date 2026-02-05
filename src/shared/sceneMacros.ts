/**
 * Scene Macros
 *
 * Quick-access presets for common EDM performance moments.
 * These apply multiple parameter changes at once for instant visual impact.
 */

// ============================================================================
// Types
// ============================================================================

export type MacroParamTarget =
  | 'effects.bloom'
  | 'effects.blur'
  | 'effects.chroma'
  | 'effects.feedback'
  | 'effects.persistence'
  | 'effects.kaleidoscope'
  | 'strobe.intensity'
  | 'strobe.rate'
  | 'burst.enabled'
  | 'burst.preset'
  | 'laser.opacity'
  | 'laser.glow'
  | 'shapeBurst.opacity'
  | 'gridTunnel.opacity'
  | 'gridTunnel.speed'
  | 'particles.density'
  | 'particles.speed'
  | 'particles.glow';

export interface MacroParamChange {
  target: MacroParamTarget;
  value: number | string | boolean;
  /** For build macros: starting value */
  from?: number;
  /** For build macros: ending value */
  to?: number;
}

export interface SceneMacro {
  id: string;
  name: string;
  description: string;
  /** Immediate parameter changes */
  changes: MacroParamChange[];
  /** Duration for build/transition macros (in beats, 0 = instant) */
  durationBeats: number;
  /** Easing curve for timed macros */
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  /** Category for UI grouping */
  category: 'drop' | 'build' | 'breakdown' | 'transition' | 'custom';
  /** Tags for search */
  tags: string[];
}

// ============================================================================
// Easing Functions
// ============================================================================

export const easingFunctions = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
};

// ============================================================================
// Drop Macros - High impact moments
// ============================================================================

/** Classic EDM drop - maximum visual impact */
export const DROP_CLASSIC: SceneMacro = {
  id: 'drop-classic',
  name: 'Drop',
  description: 'Maximum impact: strobe, burst shapes, high bloom',
  changes: [
    { target: 'strobe.intensity', value: 0.9 },
    { target: 'strobe.rate', value: 8 },
    { target: 'effects.bloom', value: 0.6 },
    { target: 'effects.chroma', value: 0.15 },
    { target: 'burst.enabled', value: true },
    { target: 'burst.preset', value: 'drop-classic' },
    { target: 'laser.opacity', value: 1.0 },
    { target: 'laser.glow', value: 0.8 },
    { target: 'shapeBurst.opacity', value: 1.0 },
    { target: 'particles.glow', value: 0.9 }
  ],
  durationBeats: 0,
  easing: 'linear',
  category: 'drop',
  tags: ['drop', 'impact', 'bass', 'high-energy']
};

/** Hard drop - aggressive visuals */
export const DROP_HARD: SceneMacro = {
  id: 'drop-hard',
  name: 'Hard Drop',
  description: 'Aggressive visuals with X-bursts and high chroma',
  changes: [
    { target: 'strobe.intensity', value: 1.0 },
    { target: 'strobe.rate', value: 12 },
    { target: 'effects.bloom', value: 0.7 },
    { target: 'effects.chroma', value: 0.25 },
    { target: 'burst.enabled', value: true },
    { target: 'burst.preset', value: 'high-energy' },
    { target: 'laser.opacity', value: 1.0 },
    { target: 'laser.glow', value: 1.0 },
    { target: 'particles.speed', value: 0.8 }
  ],
  durationBeats: 0,
  easing: 'linear',
  category: 'drop',
  tags: ['drop', 'hard', 'aggressive', 'dubstep']
};

/** Subtle drop - less intense but impactful */
export const DROP_SUBTLE: SceneMacro = {
  id: 'drop-subtle',
  name: 'Subtle Drop',
  description: 'Moderate impact with cleaner visuals',
  changes: [
    { target: 'strobe.intensity', value: 0.5 },
    { target: 'strobe.rate', value: 4 },
    { target: 'effects.bloom', value: 0.4 },
    { target: 'burst.enabled', value: true },
    { target: 'burst.preset', value: 'minimal' },
    { target: 'laser.opacity', value: 0.7 },
    { target: 'shapeBurst.opacity', value: 0.8 }
  ],
  durationBeats: 0,
  easing: 'linear',
  category: 'drop',
  tags: ['drop', 'subtle', 'house', 'melodic']
};

// ============================================================================
// Build Macros - Gradual intensity increase
// ============================================================================

/** 8-bar build to drop */
export const BUILD_8BAR: SceneMacro = {
  id: 'build-8bar',
  name: '8 Bar Build',
  description: 'Gradual intensity increase over 8 bars',
  changes: [
    { target: 'effects.bloom', from: 0.2, to: 0.6, value: 0.6 },
    { target: 'effects.chroma', from: 0, to: 0.2, value: 0.2 },
    { target: 'strobe.rate', from: 1, to: 16, value: 16 },
    { target: 'particles.speed', from: 0.2, to: 0.7, value: 0.7 },
    { target: 'particles.glow', from: 0.4, to: 0.9, value: 0.9 },
    { target: 'laser.glow', from: 0.3, to: 0.9, value: 0.9 },
    { target: 'gridTunnel.speed', from: 0.5, to: 3.0, value: 3.0 }
  ],
  durationBeats: 32, // 8 bars x 4 beats
  easing: 'easeIn',
  category: 'build',
  tags: ['build', 'riser', 'tension']
};

/** 4-bar quick build */
export const BUILD_4BAR: SceneMacro = {
  id: 'build-4bar',
  name: '4 Bar Build',
  description: 'Quick intensity increase over 4 bars',
  changes: [
    { target: 'effects.bloom', from: 0.25, to: 0.55, value: 0.55 },
    { target: 'strobe.rate', from: 2, to: 12, value: 12 },
    { target: 'particles.speed', from: 0.3, to: 0.6, value: 0.6 },
    { target: 'laser.glow', from: 0.4, to: 0.8, value: 0.8 }
  ],
  durationBeats: 16, // 4 bars x 4 beats
  easing: 'easeIn',
  category: 'build',
  tags: ['build', 'quick', 'riser']
};

/** 16-bar epic build */
export const BUILD_EPIC: SceneMacro = {
  id: 'build-epic',
  name: 'Epic Build',
  description: 'Long dramatic build over 16 bars',
  changes: [
    { target: 'effects.bloom', from: 0.1, to: 0.7, value: 0.7 },
    { target: 'effects.chroma', from: 0, to: 0.3, value: 0.3 },
    { target: 'effects.feedback', from: 0, to: 0.3, value: 0.3 },
    { target: 'strobe.rate', from: 0.5, to: 20, value: 20 },
    { target: 'particles.density', from: 0.2, to: 0.6, value: 0.6 },
    { target: 'particles.speed', from: 0.1, to: 0.8, value: 0.8 },
    { target: 'gridTunnel.speed', from: 0.3, to: 4.0, value: 4.0 }
  ],
  durationBeats: 64, // 16 bars x 4 beats
  easing: 'easeIn',
  category: 'build',
  tags: ['build', 'epic', 'long', 'dramatic']
};

// ============================================================================
// Breakdown Macros - Calm, atmospheric moments
// ============================================================================

/** Calm breakdown - minimal visuals */
export const BREAKDOWN_CALM: SceneMacro = {
  id: 'breakdown-calm',
  name: 'Calm Breakdown',
  description: 'Minimal, peaceful visuals for melodic sections',
  changes: [
    { target: 'strobe.intensity', value: 0 },
    { target: 'effects.bloom', value: 0.15 },
    { target: 'effects.chroma', value: 0.02 },
    { target: 'effects.blur', value: 0.1 },
    { target: 'burst.enabled', value: false },
    { target: 'laser.opacity', value: 0.3 },
    { target: 'laser.glow', value: 0.3 },
    { target: 'shapeBurst.opacity', value: 0.2 },
    { target: 'particles.speed', value: 0.15 },
    { target: 'particles.glow', value: 0.4 },
    { target: 'gridTunnel.speed', value: 0.3 }
  ],
  durationBeats: 0,
  easing: 'linear',
  category: 'breakdown',
  tags: ['breakdown', 'calm', 'peaceful', 'melodic']
};

/** Atmospheric breakdown - dreamy visuals */
export const BREAKDOWN_ATMOSPHERIC: SceneMacro = {
  id: 'breakdown-atmospheric',
  name: 'Atmospheric',
  description: 'Dreamy, atmospheric visuals with blur and persistence',
  changes: [
    { target: 'strobe.intensity', value: 0 },
    { target: 'effects.bloom', value: 0.3 },
    { target: 'effects.blur', value: 0.15 },
    { target: 'effects.persistence', value: 0.4 },
    { target: 'effects.chroma', value: 0.05 },
    { target: 'burst.enabled', value: false },
    { target: 'laser.opacity', value: 0.4 },
    { target: 'particles.speed', value: 0.1 },
    { target: 'particles.glow', value: 0.6 },
    { target: 'gridTunnel.opacity', value: 0.5 }
  ],
  durationBeats: 0,
  easing: 'linear',
  category: 'breakdown',
  tags: ['breakdown', 'atmospheric', 'dreamy', 'ambient']
};

/** Trance breakdown - hypnotic feel */
export const BREAKDOWN_TRANCE: SceneMacro = {
  id: 'breakdown-trance',
  name: 'Trance Breakdown',
  description: 'Hypnotic visuals with persistence and kaleidoscope',
  changes: [
    { target: 'strobe.intensity', value: 0 },
    { target: 'effects.bloom', value: 0.25 },
    { target: 'effects.persistence', value: 0.5 },
    { target: 'effects.kaleidoscope', value: 0.3 },
    { target: 'burst.enabled', value: false },
    { target: 'gridTunnel.speed', value: 0.5 },
    { target: 'particles.speed', value: 0.2 }
  ],
  durationBeats: 0,
  easing: 'linear',
  category: 'breakdown',
  tags: ['breakdown', 'trance', 'hypnotic']
};

// ============================================================================
// Transition Macros - Scene changes
// ============================================================================

/** Quick flash transition */
export const TRANSITION_FLASH: SceneMacro = {
  id: 'transition-flash',
  name: 'Flash Transition',
  description: 'Quick white flash to transition between scenes',
  changes: [
    { target: 'strobe.intensity', value: 1.0 },
    { target: 'effects.bloom', value: 1.0 }
  ],
  durationBeats: 1,
  easing: 'easeOut',
  category: 'transition',
  tags: ['transition', 'flash', 'quick']
};

/** Fade out transition */
export const TRANSITION_FADE_OUT: SceneMacro = {
  id: 'transition-fade-out',
  name: 'Fade Out',
  description: 'Gradual fade to black',
  changes: [
    { target: 'effects.bloom', from: 0.3, to: 0, value: 0 },
    { target: 'laser.opacity', from: 1, to: 0, value: 0 },
    { target: 'shapeBurst.opacity', from: 1, to: 0, value: 0 },
    { target: 'particles.glow', from: 0.6, to: 0, value: 0 },
    { target: 'gridTunnel.opacity', from: 1, to: 0, value: 0 }
  ],
  durationBeats: 8,
  easing: 'easeOut',
  category: 'transition',
  tags: ['transition', 'fade', 'out']
};

/** Fade in transition */
export const TRANSITION_FADE_IN: SceneMacro = {
  id: 'transition-fade-in',
  name: 'Fade In',
  description: 'Gradual fade from black',
  changes: [
    { target: 'effects.bloom', from: 0, to: 0.3, value: 0.3 },
    { target: 'laser.opacity', from: 0, to: 1, value: 1 },
    { target: 'shapeBurst.opacity', from: 0, to: 1, value: 1 },
    { target: 'particles.glow', from: 0, to: 0.6, value: 0.6 },
    { target: 'gridTunnel.opacity', from: 0, to: 1, value: 1 }
  ],
  durationBeats: 8,
  easing: 'easeIn',
  category: 'transition',
  tags: ['transition', 'fade', 'in']
};

/** Crossfade style transition with blur */
export const TRANSITION_BLUR: SceneMacro = {
  id: 'transition-blur',
  name: 'Blur Transition',
  description: 'Blur out then back in',
  changes: [
    { target: 'effects.blur', from: 0, to: 0.4, value: 0.4 },
    { target: 'effects.bloom', from: 0.3, to: 0.5, value: 0.5 }
  ],
  durationBeats: 4,
  easing: 'easeInOut',
  category: 'transition',
  tags: ['transition', 'blur', 'smooth']
};

// ============================================================================
// Preset Registry
// ============================================================================

export const SCENE_MACROS: SceneMacro[] = [
  // Drops
  DROP_CLASSIC,
  DROP_HARD,
  DROP_SUBTLE,
  // Builds
  BUILD_8BAR,
  BUILD_4BAR,
  BUILD_EPIC,
  // Breakdowns
  BREAKDOWN_CALM,
  BREAKDOWN_ATMOSPHERIC,
  BREAKDOWN_TRANCE,
  // Transitions
  TRANSITION_FLASH,
  TRANSITION_FADE_OUT,
  TRANSITION_FADE_IN,
  TRANSITION_BLUR
];

/**
 * Get a macro by ID
 */
export const getSceneMacro = (id: string): SceneMacro | undefined => {
  return SCENE_MACROS.find(m => m.id === id);
};

/**
 * Get macros by category
 */
export const getMacrosByCategory = (category: SceneMacro['category']): SceneMacro[] => {
  return SCENE_MACROS.filter(m => m.category === category);
};

/**
 * Get macros by tag
 */
export const getMacrosByTag = (tag: string): SceneMacro[] => {
  return SCENE_MACROS.filter(m => m.tags.includes(tag));
};

// ============================================================================
// Macro Execution State
// ============================================================================

export interface MacroExecutionState {
  activeMacro: SceneMacro | null;
  startTime: number;
  startBeat: number;
  progress: number; // 0-1
  isRunning: boolean;
}

export const createMacroExecutionState = (): MacroExecutionState => ({
  activeMacro: null,
  startTime: 0,
  startBeat: 0,
  progress: 0,
  isRunning: false
});

/**
 * Calculate interpolated value for a timed macro
 */
export const interpolateMacroValue = (
  change: MacroParamChange,
  progress: number,
  easing: SceneMacro['easing']
): number => {
  if (change.from === undefined || change.to === undefined) {
    return typeof change.value === 'number' ? change.value : 0;
  }

  const easedProgress = easingFunctions[easing](progress);
  return change.from + (change.to - change.from) * easedProgress;
};
