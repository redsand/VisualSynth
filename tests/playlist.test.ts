import { describe, expect, it } from 'vitest';
import {
  durationToMs,
  msToDuration,
  formatDuration,
  createPlaylistSlot,
  createCuePoint,
  clonePlaylist,
  validatePlaylist,
  checkAdvanceCondition,
  serializePlaylist,
  deserializePlaylist,
  migrateLegacyPlaylist,
  createPlaylistExecutionState,
  DEFAULT_PLAYLIST,
  DEFAULT_PLAYLIST_SLOT,
  PlaylistTimingMode,
  Playlist,
  PlaylistSlot,
  PlaylistExecutionState
} from '../src/shared/playlist';

// ============================================================================
// Duration Conversion Tests
// ============================================================================

describe('durationToMs', () => {
  const BPM_120 = 120; // 500ms per beat
  const BPM_128 = 128; // 468.75ms per beat
  const BEATS_PER_BAR = 4;

  it('converts seconds to milliseconds', () => {
    expect(durationToMs(1, 'seconds', BPM_120)).toBe(1000);
    expect(durationToMs(10, 'seconds', BPM_120)).toBe(10000);
    expect(durationToMs(0.5, 'seconds', BPM_120)).toBe(500);
  });

  it('converts beats to milliseconds', () => {
    // At 120 BPM: 1 beat = 500ms
    expect(durationToMs(1, 'beats', BPM_120)).toBe(500);
    expect(durationToMs(4, 'beats', BPM_120)).toBe(2000);
    expect(durationToMs(8, 'beats', BPM_120)).toBe(4000);
  });

  it('converts bars to milliseconds', () => {
    // At 120 BPM with 4 beats/bar: 1 bar = 2000ms
    expect(durationToMs(1, 'bars', BPM_120, BEATS_PER_BAR)).toBe(2000);
    expect(durationToMs(4, 'bars', BPM_120, BEATS_PER_BAR)).toBe(8000);
  });

  it('handles different BPMs correctly', () => {
    // At 128 BPM: 1 beat = 468.75ms
    expect(durationToMs(1, 'beats', BPM_128)).toBeCloseTo(468.75, 2);
    expect(durationToMs(4, 'beats', BPM_128)).toBeCloseTo(1875, 2);
  });

  it('uses default 4 beats per bar', () => {
    expect(durationToMs(1, 'bars', BPM_120)).toBe(2000);
  });

  it('handles unknown timing mode as seconds', () => {
    expect(durationToMs(5, 'unknown' as PlaylistTimingMode, BPM_120)).toBe(5000);
  });
});

describe('msToDuration', () => {
  const BPM_120 = 120;
  const BEATS_PER_BAR = 4;

  it('converts milliseconds to seconds', () => {
    expect(msToDuration(1000, 'seconds', BPM_120)).toBe(1);
    expect(msToDuration(5000, 'seconds', BPM_120)).toBe(5);
  });

  it('converts milliseconds to beats', () => {
    expect(msToDuration(500, 'beats', BPM_120)).toBe(1);
    expect(msToDuration(2000, 'beats', BPM_120)).toBe(4);
  });

  it('converts milliseconds to bars', () => {
    expect(msToDuration(2000, 'bars', BPM_120, BEATS_PER_BAR)).toBe(1);
    expect(msToDuration(8000, 'bars', BPM_120, BEATS_PER_BAR)).toBe(4);
  });

  it('is inverse of durationToMs', () => {
    const duration = 8;
    const ms = durationToMs(duration, 'beats', BPM_120);
    expect(msToDuration(ms, 'beats', BPM_120)).toBe(duration);
  });
});

describe('formatDuration', () => {
  it('formats seconds with decimal', () => {
    expect(formatDuration(5.5, 'seconds')).toBe('5.5s');
    expect(formatDuration(10, 'seconds')).toBe('10.0s');
  });

  it('formats beats as integers', () => {
    expect(formatDuration(4, 'beats')).toBe('4 beats');
    expect(formatDuration(8.5, 'beats')).toBe('9 beats'); // Rounds
  });

  it('formats bars as integers', () => {
    expect(formatDuration(2, 'bars')).toBe('2 bars');
    expect(formatDuration(4.7, 'bars')).toBe('5 bars'); // Rounds
  });
});

// ============================================================================
// Slot and Cue Point Creation Tests
// ============================================================================

describe('createPlaylistSlot', () => {
  it('creates slot with name and path', () => {
    const slot = createPlaylistSlot('Test Preset', '/path/to/preset.vsp');
    expect(slot.name).toBe('Test Preset');
    expect(slot.path).toBe('/path/to/preset.vsp');
    expect(slot.id).toMatch(/^slot_\d+_[a-z0-9]+$/);
  });

  it('applies default values', () => {
    const slot = createPlaylistSlot('Test', '/test');
    expect(slot.duration).toBe(DEFAULT_PLAYLIST_SLOT.duration);
    expect(slot.transitionDuration).toBe(DEFAULT_PLAYLIST_SLOT.transitionDuration);
    expect(slot.transitionType).toBe(DEFAULT_PLAYLIST_SLOT.transitionType);
    expect(slot.advanceCondition).toBe(DEFAULT_PLAYLIST_SLOT.advanceCondition);
    expect(slot.cuePoints).toEqual([]);
    expect(slot.overrides).toEqual({});
  });

  it('allows overriding defaults', () => {
    const slot = createPlaylistSlot('Test', '/test', {
      duration: 32,
      advanceCondition: 'energy-high',
      energyThreshold: 0.8
    });
    expect(slot.duration).toBe(32);
    expect(slot.advanceCondition).toBe('energy-high');
    expect(slot.energyThreshold).toBe(0.8);
  });

  it('generates unique IDs', () => {
    const slot1 = createPlaylistSlot('A', '/a');
    const slot2 = createPlaylistSlot('B', '/b');
    expect(slot1.id).not.toBe(slot2.id);
  });
});

describe('createCuePoint', () => {
  it('creates cue point with required fields', () => {
    const cue = createCuePoint('Drop', 8);
    expect(cue.name).toBe('Drop');
    expect(cue.offset).toBe(8);
    expect(cue.id).toMatch(/^cue_\d+_[a-z0-9]+$/);
  });

  it('uses default orange color', () => {
    const cue = createCuePoint('Test', 4);
    expect(cue.color).toEqual([1, 0.5, 0]);
  });

  it('allows custom color', () => {
    const cue = createCuePoint('Test', 4, [0, 1, 0]);
    expect(cue.color).toEqual([0, 1, 0]);
  });
});

// ============================================================================
// Playlist Validation Tests
// ============================================================================

describe('validatePlaylist', () => {
  it('validates correct playlist', () => {
    const result = validatePlaylist(DEFAULT_PLAYLIST);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects non-object input', () => {
    expect(validatePlaylist(null).valid).toBe(false);
    expect(validatePlaylist(undefined).valid).toBe(false);
    expect(validatePlaylist('string').valid).toBe(false);
    expect(validatePlaylist(123).valid).toBe(false);
  });

  it('rejects wrong schema version', () => {
    const bad = { ...DEFAULT_PLAYLIST, schemaVersion: 2 };
    const result = validatePlaylist(bad);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unsupported schema version: 2');
  });

  it('rejects missing playlist name', () => {
    const bad = { ...DEFAULT_PLAYLIST, metadata: { ...DEFAULT_PLAYLIST.metadata, name: '' } };
    const result = validatePlaylist(bad);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing playlist name');
  });

  it('rejects missing slots array', () => {
    const bad = { ...DEFAULT_PLAYLIST, slots: undefined };
    const result = validatePlaylist(bad);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid slots array');
  });

  it('validates slot structure', () => {
    const bad = {
      ...DEFAULT_PLAYLIST,
      slots: [{ name: 'Test' }] // Missing id and path
    };
    const result = validatePlaylist(bad);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Slot 0: missing id');
    expect(result.errors).toContain('Slot 0: missing path');
  });
});

// ============================================================================
// Clone Playlist Tests
// ============================================================================

describe('clonePlaylist', () => {
  it('creates deep copy', () => {
    const original = { ...DEFAULT_PLAYLIST };
    original.slots.push(createPlaylistSlot('Test', '/test'));

    const cloned = clonePlaylist(original);
    cloned.slots[0].name = 'Modified';

    expect(original.slots[0].name).toBe('Test');
    expect(cloned.slots[0].name).toBe('Modified');
  });

  it('appends (Copy) to name by default', () => {
    const original = {
      ...DEFAULT_PLAYLIST,
      metadata: { ...DEFAULT_PLAYLIST.metadata, name: 'My Playlist' }
    };
    const cloned = clonePlaylist(original);
    expect(cloned.metadata.name).toBe('My Playlist (Copy)');
  });

  it('uses provided new name', () => {
    const cloned = clonePlaylist(DEFAULT_PLAYLIST, 'New Name');
    expect(cloned.metadata.name).toBe('New Name');
  });

  it('updates timestamps', () => {
    const original = {
      ...DEFAULT_PLAYLIST,
      metadata: {
        ...DEFAULT_PLAYLIST.metadata,
        created: '2020-01-01T00:00:00.000Z',
        modified: '2020-01-01T00:00:00.000Z'
      }
    };
    const cloned = clonePlaylist(original);
    expect(cloned.metadata.created).not.toBe(original.metadata.created);
    expect(cloned.metadata.modified).not.toBe(original.metadata.modified);
  });
});

// ============================================================================
// Advance Condition Tests
// ============================================================================

describe('checkAdvanceCondition', () => {
  const createState = (overrides: Partial<PlaylistExecutionState> = {}): PlaylistExecutionState => ({
    ...createPlaylistExecutionState(),
    playlist: DEFAULT_PLAYLIST,
    ...overrides
  });

  const createSlot = (overrides: Partial<PlaylistSlot> = {}): PlaylistSlot =>
    createPlaylistSlot('Test', '/test', overrides);

  const BPM = 120;

  describe('timer condition', () => {
    it('advances when elapsed exceeds duration', () => {
      const slot = createSlot({ duration: 8, advanceCondition: 'timer' });
      const state = createState({
        slotElapsed: 5000 // 8 beats at 120 BPM = 4000ms, so 5000 > 4000
      });
      // With 'seconds' timing mode, 8s = 8000ms, so 5000 < 8000 = false
      // Need to test with 'beats' mode
      const playlist: Playlist = { ...DEFAULT_PLAYLIST, timingMode: 'beats' };
      state.playlist = playlist;

      expect(checkAdvanceCondition(state, slot, BPM)).toBe(true);
    });

    it('does not advance before duration', () => {
      const slot = createSlot({ duration: 8, advanceCondition: 'timer' });
      const playlist: Playlist = { ...DEFAULT_PLAYLIST, timingMode: 'beats' };
      const state = createState({
        playlist,
        slotElapsed: 3000 // 8 beats at 120 BPM = 4000ms
      });

      expect(checkAdvanceCondition(state, slot, BPM)).toBe(false);
    });
  });

  describe('energy-high condition', () => {
    it('advances when past half duration AND energy above threshold', () => {
      const slot = createSlot({
        duration: 8,
        advanceCondition: 'energy-high',
        energyThreshold: 0.7
      });
      const playlist: Playlist = { ...DEFAULT_PLAYLIST, timingMode: 'beats' };
      const state = createState({
        playlist,
        slotElapsed: 2500, // > half of 4000ms
        currentEnergy: 0.8 // > 0.7 threshold
      });

      expect(checkAdvanceCondition(state, slot, BPM)).toBe(true);
    });

    it('does not advance if energy below threshold', () => {
      const slot = createSlot({
        duration: 8,
        advanceCondition: 'energy-high',
        energyThreshold: 0.7
      });
      const playlist: Playlist = { ...DEFAULT_PLAYLIST, timingMode: 'beats' };
      const state = createState({
        playlist,
        slotElapsed: 3000,
        currentEnergy: 0.5 // < 0.7 threshold
      });

      expect(checkAdvanceCondition(state, slot, BPM)).toBe(false);
    });

    it('does not advance if not past half duration', () => {
      const slot = createSlot({
        duration: 8,
        advanceCondition: 'energy-high',
        energyThreshold: 0.7
      });
      const playlist: Playlist = { ...DEFAULT_PLAYLIST, timingMode: 'beats' };
      const state = createState({
        playlist,
        slotElapsed: 1000, // < half of 4000ms
        currentEnergy: 0.9
      });

      expect(checkAdvanceCondition(state, slot, BPM)).toBe(false);
    });
  });

  describe('energy-low condition', () => {
    it('advances when past half duration AND energy below threshold', () => {
      const slot = createSlot({
        duration: 8,
        advanceCondition: 'energy-low',
        energyThreshold: 0.7
      });
      const playlist: Playlist = { ...DEFAULT_PLAYLIST, timingMode: 'beats' };
      const state = createState({
        playlist,
        slotElapsed: 2500,
        currentEnergy: 0.3 // < 0.7 threshold
      });

      expect(checkAdvanceCondition(state, slot, BPM)).toBe(true);
    });
  });

  describe('beat-drop condition', () => {
    it('advances when past half duration AND beat drop detected', () => {
      const slot = createSlot({ duration: 8, advanceCondition: 'beat-drop' });
      const playlist: Playlist = { ...DEFAULT_PLAYLIST, timingMode: 'beats' };
      const state = createState({
        playlist,
        slotElapsed: 2500,
        slotStartTime: 1000,
        lastBeatDrop: 2000 // After slot started
      });

      expect(checkAdvanceCondition(state, slot, BPM)).toBe(true);
    });

    it('does not advance if beat drop before slot started', () => {
      const slot = createSlot({ duration: 8, advanceCondition: 'beat-drop' });
      const playlist: Playlist = { ...DEFAULT_PLAYLIST, timingMode: 'beats' };
      const state = createState({
        playlist,
        slotElapsed: 2500,
        slotStartTime: 3000,
        lastBeatDrop: 2000 // Before slot started
      });

      expect(checkAdvanceCondition(state, slot, BPM)).toBe(false);
    });
  });

  describe('manual condition', () => {
    it('never auto-advances', () => {
      const slot = createSlot({ duration: 8, advanceCondition: 'manual' });
      const playlist: Playlist = { ...DEFAULT_PLAYLIST, timingMode: 'beats' };
      const state = createState({
        playlist,
        slotElapsed: 100000, // Way past duration
        currentEnergy: 1.0
      });

      expect(checkAdvanceCondition(state, slot, BPM)).toBe(false);
    });
  });

  it('returns false if no playlist loaded', () => {
    const state = createState({ playlist: null });
    const slot = createSlot();
    expect(checkAdvanceCondition(state, slot, BPM)).toBe(false);
  });
});

// ============================================================================
// Serialization Tests
// ============================================================================

describe('serializePlaylist', () => {
  it('serializes to valid JSON', () => {
    const json = serializePlaylist(DEFAULT_PLAYLIST);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('preserves all fields', () => {
    const playlist: Playlist = {
      ...DEFAULT_PLAYLIST,
      metadata: { ...DEFAULT_PLAYLIST.metadata, name: 'Test Playlist' },
      slots: [createPlaylistSlot('Slot 1', '/slot1')]
    };

    const json = serializePlaylist(playlist);
    const parsed = JSON.parse(json);

    expect(parsed.metadata.name).toBe('Test Playlist');
    expect(parsed.slots.length).toBe(1);
    expect(parsed.slots[0].name).toBe('Slot 1');
  });

  it('produces pretty-printed JSON', () => {
    const json = serializePlaylist(DEFAULT_PLAYLIST);
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });
});

describe('deserializePlaylist', () => {
  it('deserializes valid JSON', () => {
    const json = serializePlaylist(DEFAULT_PLAYLIST);
    const result = deserializePlaylist(json);

    expect(result.playlist).not.toBeNull();
    expect(result.errors).toEqual([]);
  });

  it('round-trips correctly', () => {
    const original: Playlist = {
      ...DEFAULT_PLAYLIST,
      slots: [
        createPlaylistSlot('A', '/a', { duration: 10 }),
        createPlaylistSlot('B', '/b', { duration: 20 })
      ]
    };

    const json = serializePlaylist(original);
    const result = deserializePlaylist(json);

    expect(result.playlist?.slots.length).toBe(2);
    expect(result.playlist?.slots[0].name).toBe('A');
    expect(result.playlist?.slots[1].duration).toBe(20);
  });

  it('returns errors for invalid JSON', () => {
    const result = deserializePlaylist('not valid json');
    expect(result.playlist).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Parse error');
  });

  it('returns validation errors for invalid structure', () => {
    const result = deserializePlaylist('{"schemaVersion": 99}');
    expect(result.playlist).toBeNull();
    expect(result.errors).toContain('Unsupported schema version: 99');
  });
});

// ============================================================================
// Legacy Migration Tests
// ============================================================================

describe('migrateLegacyPlaylist', () => {
  it('converts legacy format to new format', () => {
    const legacy = [
      { name: 'Preset A', path: '/presets/a.vsp' },
      { name: 'Preset B', path: '/presets/b.vsp' }
    ];

    const playlist = migrateLegacyPlaylist(legacy);

    expect(playlist.schemaVersion).toBe(1);
    expect(playlist.slots.length).toBe(2);
    expect(playlist.slots[0].name).toBe('Preset A');
    expect(playlist.slots[1].path).toBe('/presets/b.vsp');
  });

  it('uses seconds timing mode for legacy compatibility', () => {
    const playlist = migrateLegacyPlaylist([]);
    expect(playlist.timingMode).toBe('seconds');
  });

  it('preserves duration if provided', () => {
    const legacy = [{ name: 'Test', path: '/test', duration: 30 }];
    const playlist = migrateLegacyPlaylist(legacy);
    expect(playlist.slots[0].duration).toBe(30);
  });

  it('uses default duration if not provided', () => {
    const legacy = [{ name: 'Test', path: '/test' }];
    const playlist = migrateLegacyPlaylist(legacy);
    expect(playlist.slots[0].duration).toBe(16);
  });

  it('preserves crossfade as transitionDuration', () => {
    const legacy = [{ name: 'Test', path: '/test', crossfade: 5 }];
    const playlist = migrateLegacyPlaylist(legacy);
    expect(playlist.slots[0].transitionDuration).toBe(5);
  });

  it('uses default crossfade if not provided', () => {
    const legacy = [{ name: 'Test', path: '/test' }];
    const playlist = migrateLegacyPlaylist(legacy);
    expect(playlist.slots[0].transitionDuration).toBe(2);
  });

  it('generates unique slot IDs', () => {
    const legacy = [
      { name: 'A', path: '/a' },
      { name: 'B', path: '/b' }
    ];
    const playlist = migrateLegacyPlaylist(legacy);
    expect(playlist.slots[0].id).not.toBe(playlist.slots[1].id);
  });

  it('sets metadata name to "Imported Playlist"', () => {
    const playlist = migrateLegacyPlaylist([]);
    expect(playlist.metadata.name).toBe('Imported Playlist');
  });
});

// ============================================================================
// Execution State Tests
// ============================================================================

describe('createPlaylistExecutionState', () => {
  it('creates default state', () => {
    const state = createPlaylistExecutionState();

    expect(state.playlist).toBeNull();
    expect(state.currentIndex).toBe(0);
    expect(state.isPlaying).toBe(false);
    expect(state.slotStartTime).toBe(0);
    expect(state.slotElapsed).toBe(0);
    expect(state.slotProgress).toBe(0);
    expect(state.waitingForCondition).toBe(false);
    expect(state.currentEnergy).toBe(0);
    expect(state.lastBeatDrop).toBe(0);
  });
});
