/**
 * Enhanced Playlist System
 *
 * Types and utilities for BPM-locked, energy-aware playlists.
 */

// ============================================================================
// Types
// ============================================================================

export type PlaylistTimingMode = 'seconds' | 'beats' | 'bars';

export type PlaylistTransitionType = 'instant' | 'crossfade' | 'cut' | 'warp' | 'glitch';

export type PlaylistAdvanceCondition =
  | 'timer'           // Advance after duration
  | 'energy-high'     // Advance when energy exceeds threshold
  | 'energy-low'      // Advance when energy drops below threshold
  | 'beat-drop'       // Advance on detected beat drop
  | 'manual';         // Only advance manually

export interface PlaylistCuePoint {
  /** Unique identifier */
  id: string;
  /** Name/label for the cue point */
  name: string;
  /** Time offset in current timing mode units */
  offset: number;
  /** Color for visual marker */
  color: [number, number, number];
  /** Optional action to trigger */
  action?: string;
}

export interface PlaylistSlot {
  /** Unique slot ID */
  id: string;
  /** Preset name for display */
  name: string;
  /** Path to preset file */
  path: string;
  /** Duration value (interpreted based on timing mode) */
  duration: number;
  /** Transition duration to next slot */
  transitionDuration: number;
  /** Transition type */
  transitionType: PlaylistTransitionType;
  /** When to advance to next slot */
  advanceCondition: PlaylistAdvanceCondition;
  /** Threshold for energy-based conditions (0-1) */
  energyThreshold: number;
  /** Cue points within this slot */
  cuePoints: PlaylistCuePoint[];
  /** Scene macro to trigger on entry */
  entryMacro?: string;
  /** Scene macro to trigger on exit */
  exitMacro?: string;
  /** Parameter overrides for this slot */
  overrides: Record<string, Record<string, number | boolean | string>>;
}

export interface PlaylistMetadata {
  /** Playlist name */
  name: string;
  /** Author/creator */
  author: string;
  /** Description */
  description: string;
  /** Creation date (ISO string) */
  created: string;
  /** Last modified date (ISO string) */
  modified: string;
  /** Version for compatibility */
  version: number;
  /** Tags for organization */
  tags: string[];
}

export interface Playlist {
  /** Schema version */
  schemaVersion: 1;
  /** Playlist metadata */
  metadata: PlaylistMetadata;
  /** Global timing mode */
  timingMode: PlaylistTimingMode;
  /** Reference BPM for beat/bar calculations */
  referenceBpm: number;
  /** Beats per bar (typically 4) */
  beatsPerBar: number;
  /** Whether to loop the playlist */
  loop: boolean;
  /** Slots in the playlist */
  slots: PlaylistSlot[];
  /** Default transition settings */
  defaults: {
    duration: number;
    transitionDuration: number;
    transitionType: PlaylistTransitionType;
    advanceCondition: PlaylistAdvanceCondition;
    energyThreshold: number;
  };
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_PLAYLIST_SLOT: Omit<PlaylistSlot, 'id' | 'name' | 'path'> = {
  duration: 16,
  transitionDuration: 2,
  transitionType: 'crossfade',
  advanceCondition: 'timer',
  energyThreshold: 0.7,
  cuePoints: [],
  overrides: {}
};

export const DEFAULT_PLAYLIST_METADATA: PlaylistMetadata = {
  name: 'Untitled Playlist',
  author: '',
  description: '',
  created: new Date().toISOString(),
  modified: new Date().toISOString(),
  version: 1,
  tags: []
};

export const DEFAULT_PLAYLIST: Playlist = {
  schemaVersion: 1,
  metadata: { ...DEFAULT_PLAYLIST_METADATA },
  timingMode: 'beats',
  referenceBpm: 128,
  beatsPerBar: 4,
  loop: true,
  slots: [],
  defaults: {
    duration: 32, // 8 bars at 4 beats/bar
    transitionDuration: 4, // 1 bar
    transitionType: 'crossfade',
    advanceCondition: 'timer',
    energyThreshold: 0.7
  }
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique slot ID
 */
export const generateSlotId = (): string => {
  return `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Generate a unique cue point ID
 */
export const generateCueId = (): string => {
  return `cue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Convert duration to milliseconds based on timing mode and BPM
 */
export const durationToMs = (
  duration: number,
  timingMode: PlaylistTimingMode,
  bpm: number,
  beatsPerBar: number = 4
): number => {
  const msPerBeat = 60000 / bpm;

  switch (timingMode) {
    case 'seconds':
      return duration * 1000;
    case 'beats':
      return duration * msPerBeat;
    case 'bars':
      return duration * beatsPerBar * msPerBeat;
    default:
      return duration * 1000;
  }
};

/**
 * Convert milliseconds to duration units
 */
export const msToDuration = (
  ms: number,
  timingMode: PlaylistTimingMode,
  bpm: number,
  beatsPerBar: number = 4
): number => {
  const msPerBeat = 60000 / bpm;

  switch (timingMode) {
    case 'seconds':
      return ms / 1000;
    case 'beats':
      return ms / msPerBeat;
    case 'bars':
      return ms / (beatsPerBar * msPerBeat);
    default:
      return ms / 1000;
  }
};

/**
 * Format duration for display
 */
export const formatDuration = (
  duration: number,
  timingMode: PlaylistTimingMode
): string => {
  switch (timingMode) {
    case 'seconds':
      return `${duration.toFixed(1)}s`;
    case 'beats':
      return `${Math.round(duration)} beats`;
    case 'bars':
      return `${Math.round(duration)} bars`;
    default:
      return `${duration}`;
  }
};

/**
 * Create a new playlist slot
 */
export const createPlaylistSlot = (
  name: string,
  path: string,
  defaults?: Partial<PlaylistSlot>
): PlaylistSlot => ({
  id: generateSlotId(),
  name,
  path,
  ...DEFAULT_PLAYLIST_SLOT,
  ...defaults
});

/**
 * Create a new cue point
 */
export const createCuePoint = (
  name: string,
  offset: number,
  color: [number, number, number] = [1, 0.5, 0]
): PlaylistCuePoint => ({
  id: generateCueId(),
  name,
  offset,
  color
});

/**
 * Clone a playlist with new metadata
 */
export const clonePlaylist = (playlist: Playlist, newName?: string): Playlist => {
  const now = new Date().toISOString();
  return {
    ...JSON.parse(JSON.stringify(playlist)),
    metadata: {
      ...playlist.metadata,
      name: newName ?? `${playlist.metadata.name} (Copy)`,
      created: now,
      modified: now
    }
  };
};

/**
 * Validate a playlist structure
 */
export const validatePlaylist = (playlist: unknown): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!playlist || typeof playlist !== 'object') {
    return { valid: false, errors: ['Invalid playlist object'] };
  }

  const p = playlist as Partial<Playlist>;

  if (p.schemaVersion !== 1) {
    errors.push(`Unsupported schema version: ${p.schemaVersion}`);
  }

  if (!p.metadata?.name) {
    errors.push('Missing playlist name');
  }

  if (!Array.isArray(p.slots)) {
    errors.push('Missing or invalid slots array');
  } else {
    p.slots.forEach((slot, index) => {
      if (!slot.id) errors.push(`Slot ${index}: missing id`);
      if (!slot.path) errors.push(`Slot ${index}: missing path`);
    });
  }

  return { valid: errors.length === 0, errors };
};

// ============================================================================
// Playlist Execution State
// ============================================================================

export interface PlaylistExecutionState {
  /** Currently loaded playlist */
  playlist: Playlist | null;
  /** Current slot index */
  currentIndex: number;
  /** Whether playlist is playing */
  isPlaying: boolean;
  /** Time when current slot started (ms) */
  slotStartTime: number;
  /** Elapsed time in current slot (ms) */
  slotElapsed: number;
  /** Progress through current slot (0-1) */
  slotProgress: number;
  /** Whether waiting for energy condition */
  waitingForCondition: boolean;
  /** Current energy level being tracked */
  currentEnergy: number;
  /** Last detected beat drop time */
  lastBeatDrop: number;
}

export const createPlaylistExecutionState = (): PlaylistExecutionState => ({
  playlist: null,
  currentIndex: 0,
  isPlaying: false,
  slotStartTime: 0,
  slotElapsed: 0,
  slotProgress: 0,
  waitingForCondition: false,
  currentEnergy: 0,
  lastBeatDrop: 0
});

/**
 * Check if advance condition is met
 */
export const checkAdvanceCondition = (
  state: PlaylistExecutionState,
  slot: PlaylistSlot,
  currentBpm: number
): boolean => {
  if (!state.playlist) return false;

  const durationMs = durationToMs(
    slot.duration,
    state.playlist.timingMode,
    currentBpm,
    state.playlist.beatsPerBar
  );

  switch (slot.advanceCondition) {
    case 'timer':
      return state.slotElapsed >= durationMs;

    case 'energy-high':
      // Must be past minimum duration AND energy above threshold
      return state.slotElapsed >= durationMs * 0.5 && state.currentEnergy >= slot.energyThreshold;

    case 'energy-low':
      // Must be past minimum duration AND energy below threshold
      return state.slotElapsed >= durationMs * 0.5 && state.currentEnergy < slot.energyThreshold;

    case 'beat-drop':
      // Must be past minimum duration AND detect a beat drop
      return state.slotElapsed >= durationMs * 0.5 && state.lastBeatDrop > state.slotStartTime;

    case 'manual':
      return false; // Never auto-advance

    default:
      return state.slotElapsed >= durationMs;
  }
};

// ============================================================================
// File I/O Helpers
// ============================================================================

export const PLAYLIST_FILE_EXTENSION = '.vspl';
export const PLAYLIST_MIME_TYPE = 'application/json';

/**
 * Serialize playlist to JSON string
 */
export const serializePlaylist = (playlist: Playlist): string => {
  return JSON.stringify(playlist, null, 2);
};

/**
 * Deserialize playlist from JSON string
 */
export const deserializePlaylist = (json: string): { playlist: Playlist | null; errors: string[] } => {
  try {
    const parsed = JSON.parse(json);
    const validation = validatePlaylist(parsed);

    if (!validation.valid) {
      return { playlist: null, errors: validation.errors };
    }

    return { playlist: parsed as Playlist, errors: [] };
  } catch (error) {
    return { playlist: null, errors: [`Parse error: ${(error as Error).message}`] };
  }
};

/**
 * Migrate legacy playlist format to new format
 */
export const migrateLegacyPlaylist = (
  legacy: { name: string; path: string; duration?: number; crossfade?: number }[]
): Playlist => {
  const now = new Date().toISOString();

  return {
    ...DEFAULT_PLAYLIST,
    metadata: {
      ...DEFAULT_PLAYLIST_METADATA,
      name: 'Imported Playlist',
      created: now,
      modified: now
    },
    timingMode: 'seconds', // Legacy used seconds
    slots: legacy.map((item) => createPlaylistSlot(item.name, item.path, {
      duration: item.duration ?? 16,
      transitionDuration: item.crossfade ?? 2
    }))
  };
};
