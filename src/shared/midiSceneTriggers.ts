/**
 * MIDI Scene Triggers
 *
 * Maps MIDI notes and CCs to scene macros, presets, and playlist controls.
 */

// ============================================================================
// Types
// ============================================================================

export type MidiTriggerType =
  | 'macro'           // Trigger a scene macro
  | 'preset'          // Load a preset
  | 'scene'           // Switch to a scene
  | 'playlist-slot'   // Jump to playlist slot
  | 'playlist-control' // Playlist transport controls
  | 'burst-preset'    // Switch burst SDF preset
  | 'action';         // Generic action string

export type PlaylistControl =
  | 'play'
  | 'stop'
  | 'pause'
  | 'next'
  | 'previous'
  | 'toggle';

export interface MidiSceneTrigger {
  /** Unique identifier */
  id: string;
  /** Friendly name */
  name: string;
  /** MIDI message type */
  message: 'note' | 'cc';
  /** MIDI channel (1-16) */
  channel: number;
  /** Note number or CC number */
  control: number;
  /** Whether note velocity affects intensity (for macros) */
  velocitySensitive: boolean;
  /** Trigger behavior */
  mode: 'trigger' | 'toggle' | 'hold';
  /** Type of action to perform */
  triggerType: MidiTriggerType;
  /** Value depends on triggerType:
   * - macro: macro ID (e.g., 'drop-classic')
   * - preset: preset path
   * - scene: scene ID
   * - playlist-slot: slot index
   * - playlist-control: PlaylistControl value
   * - burst-preset: preset ID
   * - action: action string
   */
  value: string | number;
  /** Color for visual feedback */
  color: [number, number, number];
  /** Whether this trigger is enabled */
  enabled: boolean;
}

export interface MidiCCParameter {
  /** Unique identifier */
  id: string;
  /** Friendly name */
  name: string;
  /** MIDI channel (1-16) */
  channel: number;
  /** CC number */
  cc: number;
  /** Parameter target path */
  target: string;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Whether parameter is bipolar (-1 to 1) */
  bipolar: boolean;
  /** Smoothing factor (0-1) */
  smoothing: number;
  /** Whether this mapping is enabled */
  enabled: boolean;
}

export interface MidiSceneConfig {
  /** Scene triggers */
  triggers: MidiSceneTrigger[];
  /** CC parameter mappings for scene control */
  parameters: MidiCCParameter[];
  /** Default bank (for pad controllers) */
  defaultBank: number;
  /** Number of banks */
  bankCount: number;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_MIDI_SCENE_CONFIG: MidiSceneConfig = {
  triggers: [],
  parameters: [],
  defaultBank: 0,
  bankCount: 4
};

/**
 * Generate a unique trigger ID
 */
export const generateTriggerId = (): string => {
  return `trig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Generate a unique CC parameter ID
 */
export const generateCCParamId = (): string => {
  return `cc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a macro trigger
 */
export const createMacroTrigger = (
  note: number,
  macroId: string,
  options?: Partial<MidiSceneTrigger>
): MidiSceneTrigger => ({
  id: generateTriggerId(),
  name: `Macro: ${macroId}`,
  message: 'note',
  channel: 1,
  control: note,
  velocitySensitive: true,
  mode: 'trigger',
  triggerType: 'macro',
  value: macroId,
  color: [1, 0.5, 0],
  enabled: true,
  ...options
});

/**
 * Create a preset trigger
 */
export const createPresetTrigger = (
  note: number,
  presetPath: string,
  name: string,
  options?: Partial<MidiSceneTrigger>
): MidiSceneTrigger => ({
  id: generateTriggerId(),
  name: `Preset: ${name}`,
  message: 'note',
  channel: 1,
  control: note,
  velocitySensitive: false,
  mode: 'trigger',
  triggerType: 'preset',
  value: presetPath,
  color: [0, 1, 0.5],
  enabled: true,
  ...options
});

/**
 * Create a playlist control trigger
 */
export const createPlaylistControlTrigger = (
  note: number,
  control: PlaylistControl,
  options?: Partial<MidiSceneTrigger>
): MidiSceneTrigger => ({
  id: generateTriggerId(),
  name: `Playlist: ${control}`,
  message: 'note',
  channel: 1,
  control: note,
  velocitySensitive: false,
  mode: control === 'toggle' ? 'toggle' : 'trigger',
  triggerType: 'playlist-control',
  value: control,
  color: [0.5, 0.5, 1],
  enabled: true,
  ...options
});

/**
 * Create a burst preset trigger
 */
export const createBurstPresetTrigger = (
  note: number,
  presetId: string,
  options?: Partial<MidiSceneTrigger>
): MidiSceneTrigger => ({
  id: generateTriggerId(),
  name: `Burst: ${presetId}`,
  message: 'note',
  channel: 1,
  control: note,
  velocitySensitive: false,
  mode: 'trigger',
  triggerType: 'burst-preset',
  value: presetId,
  color: [1, 0, 1],
  enabled: true,
  ...options
});

/**
 * Create a CC parameter mapping
 */
export const createCCParameter = (
  cc: number,
  target: string,
  name: string,
  options?: Partial<MidiCCParameter>
): MidiCCParameter => ({
  id: generateCCParamId(),
  name,
  channel: 1,
  cc,
  target,
  min: 0,
  max: 1,
  bipolar: false,
  smoothing: 0.1,
  enabled: true,
  ...options
});

// ============================================================================
// Default Trigger Layouts
// ============================================================================

/**
 * Create a default Launchpad-style layout
 * Maps pads to common EDM performance actions
 */
export const createLaunchpadLayout = (): MidiSceneConfig => {
  const triggers: MidiSceneTrigger[] = [];

  // Row 1 (notes 36-43): Drop macros
  triggers.push(createMacroTrigger(36, 'drop-classic', { name: 'Drop', color: [1, 0, 0] }));
  triggers.push(createMacroTrigger(37, 'drop-hard', { name: 'Hard Drop', color: [1, 0.2, 0] }));
  triggers.push(createMacroTrigger(38, 'drop-subtle', { name: 'Subtle Drop', color: [1, 0.5, 0] }));

  // Row 2 (notes 44-51): Build macros
  triggers.push(createMacroTrigger(44, 'build-4bar', { name: '4 Bar Build', color: [1, 1, 0] }));
  triggers.push(createMacroTrigger(45, 'build-8bar', { name: '8 Bar Build', color: [0.8, 1, 0] }));
  triggers.push(createMacroTrigger(46, 'build-epic', { name: 'Epic Build', color: [0.5, 1, 0] }));

  // Row 3 (notes 52-59): Breakdown macros
  triggers.push(createMacroTrigger(52, 'breakdown-calm', { name: 'Calm', color: [0, 0.5, 1] }));
  triggers.push(createMacroTrigger(53, 'breakdown-atmospheric', { name: 'Atmospheric', color: [0, 0.7, 1] }));
  triggers.push(createMacroTrigger(54, 'breakdown-trance', { name: 'Trance', color: [0.3, 0.5, 1] }));

  // Row 4 (notes 60-67): Transitions
  triggers.push(createMacroTrigger(60, 'transition-flash', { name: 'Flash', color: [1, 1, 1] }));
  triggers.push(createMacroTrigger(61, 'transition-fade-out', { name: 'Fade Out', color: [0.5, 0.5, 0.5] }));
  triggers.push(createMacroTrigger(62, 'transition-fade-in', { name: 'Fade In', color: [0.7, 0.7, 0.7] }));

  // Row 5 (notes 68-75): Burst presets
  triggers.push(createBurstPresetTrigger(68, 'drop-classic', { name: 'Burst: Drop', color: [1, 0, 1] }));
  triggers.push(createBurstPresetTrigger(69, 'high-energy', { name: 'Burst: Energy', color: [1, 0.3, 1] }));
  triggers.push(createBurstPresetTrigger(70, 'tech-future', { name: 'Burst: Tech', color: [0.7, 0, 1] }));
  triggers.push(createBurstPresetTrigger(71, 'minimal', { name: 'Burst: Minimal', color: [0.5, 0, 0.7] }));

  // Row 6 (notes 76-83): Playlist controls
  triggers.push(createPlaylistControlTrigger(76, 'play', { color: [0, 1, 0] }));
  triggers.push(createPlaylistControlTrigger(77, 'stop', { color: [1, 0, 0] }));
  triggers.push(createPlaylistControlTrigger(78, 'previous', { color: [0.5, 0.5, 1] }));
  triggers.push(createPlaylistControlTrigger(79, 'next', { color: [0.5, 0.5, 1] }));

  // CC mappings for common parameters
  const parameters: MidiCCParameter[] = [
    createCCParameter(1, 'effects.bloom', 'Bloom', { min: 0, max: 1 }),
    createCCParameter(2, 'effects.chroma', 'Chroma', { min: 0, max: 0.5 }),
    createCCParameter(3, 'effects.blur', 'Blur', { min: 0, max: 0.5 }),
    createCCParameter(4, 'effects.feedback', 'Feedback', { min: 0, max: 0.6 }),
    createCCParameter(5, 'particles.density', 'Particles', { min: 0, max: 1 }),
    createCCParameter(6, 'particles.speed', 'Part Speed', { min: 0, max: 1 }),
    createCCParameter(7, 'laser.opacity', 'Laser', { min: 0, max: 1 }),
    createCCParameter(8, 'laser.glow', 'Laser Glow', { min: 0, max: 1 })
  ];

  return {
    triggers,
    parameters,
    defaultBank: 0,
    bankCount: 4
  };
};

/**
 * Create a minimal layout for basic controllers
 */
export const createMinimalLayout = (): MidiSceneConfig => {
  const triggers: MidiSceneTrigger[] = [
    createMacroTrigger(36, 'drop-classic', { name: 'Drop' }),
    createMacroTrigger(37, 'breakdown-calm', { name: 'Breakdown' }),
    createMacroTrigger(38, 'build-8bar', { name: 'Build' }),
    createMacroTrigger(39, 'transition-flash', { name: 'Flash' }),
    createPlaylistControlTrigger(40, 'play'),
    createPlaylistControlTrigger(41, 'stop'),
    createPlaylistControlTrigger(42, 'next'),
    createPlaylistControlTrigger(43, 'previous')
  ];

  const parameters: MidiCCParameter[] = [
    createCCParameter(1, 'effects.bloom', 'Bloom'),
    createCCParameter(2, 'effects.chroma', 'Chroma'),
    createCCParameter(7, 'master.intensity', 'Intensity', { min: 0, max: 1.5 })
  ];

  return {
    triggers,
    parameters,
    defaultBank: 0,
    bankCount: 1
  };
};

// ============================================================================
// Processing Functions
// ============================================================================

export interface MidiTriggerResult {
  handled: boolean;
  action?: {
    type: MidiTriggerType;
    value: string | number;
    velocity: number;
  };
}

/**
 * Process a MIDI note message against scene triggers
 */
export const processMidiNote = (
  config: MidiSceneConfig,
  channel: number,
  note: number,
  velocity: number,
  bank: number = 0
): MidiTriggerResult => {
  // Adjust note for bank if needed
  const bankOffset = bank * 16; // Assuming 16 notes per bank
  const adjustedNote = note - bankOffset;

  for (const trigger of config.triggers) {
    if (!trigger.enabled) continue;
    if (trigger.message !== 'note') continue;
    if (trigger.channel !== channel) continue;
    if (trigger.control !== note && trigger.control !== adjustedNote) continue;

    // Note off (velocity 0) handling
    if (velocity === 0) {
      if (trigger.mode === 'hold') {
        // Could emit a "release" action here
        return { handled: true };
      }
      return { handled: false };
    }

    return {
      handled: true,
      action: {
        type: trigger.triggerType,
        value: trigger.value,
        velocity: trigger.velocitySensitive ? velocity / 127 : 1
      }
    };
  }

  return { handled: false };
};

/**
 * Process a MIDI CC message against parameter mappings
 */
export const processMidiCC = (
  config: MidiSceneConfig,
  channel: number,
  cc: number,
  value: number
): { handled: boolean; target?: string; value?: number } => {
  for (const param of config.parameters) {
    if (!param.enabled) continue;
    if (param.channel !== channel) continue;
    if (param.cc !== cc) continue;

    // Map 0-127 to param range
    const normalized = value / 127;
    let mapped: number;

    if (param.bipolar) {
      mapped = param.min + (param.max - param.min) * (normalized * 2 - 1);
    } else {
      mapped = param.min + (param.max - param.min) * normalized;
    }

    return {
      handled: true,
      target: param.target,
      value: mapped
    };
  }

  return { handled: false };
};

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize config to JSON
 */
export const serializeMidiSceneConfig = (config: MidiSceneConfig): string => {
  return JSON.stringify(config, null, 2);
};

/**
 * Deserialize config from JSON
 */
export const deserializeMidiSceneConfig = (json: string): MidiSceneConfig | null => {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed.triggers)) return null;
    if (!Array.isArray(parsed.parameters)) return null;
    return parsed as MidiSceneConfig;
  } catch {
    return null;
  }
};
