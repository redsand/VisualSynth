/**
 * PlaylistManager Integration Tests
 *
 * Tests the PlaylistManager class with mock callbacks and realistic scenarios.
 * These tests verify the full flow from playlist operations to callback invocations.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaylistManager, PlaylistEvent } from '../../src/renderer/playlist/PlaylistManager';
import {
  Playlist,
  PlaylistSlot,
  createPlaylistSlot,
  DEFAULT_PLAYLIST,
  migrateLegacyPlaylist
} from '../../src/shared/playlist';

// ============================================================================
// Test Helpers
// ============================================================================

const createTestPlaylist = (slots: Partial<PlaylistSlot>[] = []): Playlist => ({
  ...DEFAULT_PLAYLIST,
  metadata: {
    ...DEFAULT_PLAYLIST.metadata,
    name: 'Test Playlist'
  },
  timingMode: 'beats',
  referenceBpm: 120,
  slots: slots.map((s, i) => createPlaylistSlot(
    s.name ?? `Slot ${i + 1}`,
    s.path ?? `/preset${i + 1}.vsp`,
    s
  ))
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// PlaylistManager Integration Tests
// ============================================================================

describe('PlaylistManager Integration', () => {
  let manager: PlaylistManager;
  let presetLoaderMock: ReturnType<typeof vi.fn>;
  let macroTriggerMock: ReturnType<typeof vi.fn>;
  let eventLog: PlaylistEvent[];

  beforeEach(() => {
    manager = new PlaylistManager();
    presetLoaderMock = vi.fn().mockResolvedValue(undefined);
    macroTriggerMock = vi.fn();
    eventLog = [];

    manager.setPresetLoader(presetLoaderMock);
    manager.setMacroTrigger(macroTriggerMock);
    manager.on((event) => eventLog.push(event));
  });

  afterEach(() => {
    manager.stop();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Playlist Loading Tests
  // ==========================================================================

  describe('Playlist Loading', () => {
    it('loads a playlist and emits playlist-loaded event', () => {
      const playlist = createTestPlaylist([{ name: 'Preset A' }]);

      manager.loadPlaylist(playlist);

      expect(manager.getPlaylist()).toEqual(playlist);
      expect(eventLog).toContainEqual(
        expect.objectContaining({ type: 'playlist-loaded' })
      );
    });

    it('resets state when loading new playlist', () => {
      const playlist1 = createTestPlaylist([{ name: 'A' }, { name: 'B' }]);
      const playlist2 = createTestPlaylist([{ name: 'X' }]);

      manager.loadPlaylist(playlist1);
      manager.start(1); // Start at index 1

      manager.loadPlaylist(playlist2);

      const state = manager.getState();
      expect(state.currentIndex).toBe(0);
      expect(state.isPlaying).toBe(false);
    });

    it('loads playlist from JSON string', () => {
      const playlist = createTestPlaylist([{ name: 'Test' }]);
      const json = JSON.stringify(playlist);

      const result = manager.loadPlaylistFromJson(json);

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(manager.getPlaylist()?.metadata.name).toBe('Test Playlist');
    });

    it('returns errors for invalid JSON', () => {
      const result = manager.loadPlaylistFromJson('invalid json');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Legacy Playlist Import Tests
  // ==========================================================================

  describe('Legacy Playlist Import', () => {
    it('imports legacy format and converts to new format', () => {
      const legacy = [
        { name: 'Old Preset 1', path: '/old/1.vsp', duration: 10, crossfade: 3 },
        { name: 'Old Preset 2', path: '/old/2.vsp' }
      ];

      manager.importLegacyPlaylist(legacy);

      const playlist = manager.getPlaylist();
      expect(playlist).not.toBeNull();
      expect(playlist!.slots.length).toBe(2);
      expect(playlist!.slots[0].name).toBe('Old Preset 1');
      expect(playlist!.slots[0].duration).toBe(10);
      expect(playlist!.slots[0].transitionDuration).toBe(3);
      expect(playlist!.slots[1].duration).toBe(16); // Default
      expect(playlist!.timingMode).toBe('seconds'); // Legacy mode
    });

    it('can play imported legacy playlist', async () => {
      const legacy = [
        { name: 'Legacy 1', path: '/legacy/1.vsp', duration: 0.1 }
      ];

      manager.importLegacyPlaylist(legacy);
      await manager.start();

      expect(presetLoaderMock).toHaveBeenCalledWith(
        '/legacy/1.vsp',
        'Legacy 1',
        expect.any(Number)
      );
    });
  });

  // ==========================================================================
  // Playback Control Tests
  // ==========================================================================

  describe('Playback Control', () => {
    it('starts playback and calls preset loader', async () => {
      const playlist = createTestPlaylist([
        { name: 'First', path: '/first.vsp' }
      ]);
      manager.loadPlaylist(playlist);

      await manager.start();

      expect(presetLoaderMock).toHaveBeenCalledWith(
        '/first.vsp',
        'First',
        expect.any(Number)
      );
      expect(manager.getState().isPlaying).toBe(true);
      expect(eventLog).toContainEqual(
        expect.objectContaining({ type: 'playlist-started' })
      );
    });

    it('starts from specified index', async () => {
      const playlist = createTestPlaylist([
        { name: 'A', path: '/a.vsp' },
        { name: 'B', path: '/b.vsp' },
        { name: 'C', path: '/c.vsp' }
      ]);
      manager.loadPlaylist(playlist);

      await manager.start(1);

      expect(presetLoaderMock).toHaveBeenCalledWith('/b.vsp', 'B', expect.any(Number));
      expect(manager.getState().currentIndex).toBe(1);
    });

    it('stops playback and emits event', async () => {
      const playlist = createTestPlaylist([{ name: 'Test' }]);
      manager.loadPlaylist(playlist);
      await manager.start();

      manager.stop();

      expect(manager.getState().isPlaying).toBe(false);
      expect(eventLog).toContainEqual(
        expect.objectContaining({ type: 'playlist-stopped' })
      );
    });

    it('pauses and resumes playback', async () => {
      const playlist = createTestPlaylist([{ name: 'Test', duration: 100 }]);
      manager.loadPlaylist(playlist);
      await manager.start();

      // Let some time pass
      await wait(100);
      const elapsedBeforePause = manager.getState().slotElapsed;

      manager.pause();
      expect(manager.getState().isPlaying).toBe(false);

      // Wait while paused
      await wait(100);
      expect(manager.getState().slotElapsed).toBe(elapsedBeforePause);

      // Resume
      await manager.resume();
      expect(manager.getState().isPlaying).toBe(true);
    });
  });

  // ==========================================================================
  // Navigation Tests
  // ==========================================================================

  describe('Navigation', () => {
    it('jumps to specific slot', async () => {
      const playlist = createTestPlaylist([
        { name: 'A' },
        { name: 'B' },
        { name: 'C' }
      ]);
      manager.loadPlaylist(playlist);
      await manager.start();

      await manager.jumpTo(2);

      expect(manager.getState().currentIndex).toBe(2);
      expect(manager.getCurrentSlot()?.name).toBe('C');
      expect(presetLoaderMock).toHaveBeenLastCalledWith(
        expect.any(String),
        'C',
        expect.any(Number)
      );
    });

    it('advances to next slot', async () => {
      const playlist = createTestPlaylist([{ name: 'A' }, { name: 'B' }]);
      manager.loadPlaylist(playlist);
      await manager.start();

      await manager.next();

      expect(manager.getState().currentIndex).toBe(1);
    });

    it('loops when advancing past last slot', async () => {
      const playlist = createTestPlaylist([{ name: 'A' }, { name: 'B' }]);
      playlist.loop = true;
      manager.loadPlaylist(playlist);
      await manager.start(1); // Start at last slot

      await manager.next();

      expect(manager.getState().currentIndex).toBe(0);
    });

    it('stops when advancing past last slot without loop', async () => {
      const playlist = createTestPlaylist([{ name: 'A' }, { name: 'B' }]);
      playlist.loop = false;
      manager.loadPlaylist(playlist);
      await manager.start(1);

      await manager.next();

      expect(manager.getState().isPlaying).toBe(false);
      expect(eventLog).toContainEqual(
        expect.objectContaining({ type: 'playlist-completed' })
      );
    });

    it('goes to previous slot', async () => {
      const playlist = createTestPlaylist([{ name: 'A' }, { name: 'B' }]);
      manager.loadPlaylist(playlist);
      await manager.start(1);

      await manager.previous();

      expect(manager.getState().currentIndex).toBe(0);
    });

    it('loops to end when going previous from first slot', async () => {
      const playlist = createTestPlaylist([{ name: 'A' }, { name: 'B' }]);
      playlist.loop = true;
      manager.loadPlaylist(playlist);
      await manager.start(0);

      await manager.previous();

      expect(manager.getState().currentIndex).toBe(1);
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe('Event Emission', () => {
    it('emits slot-changed on navigation', async () => {
      const playlist = createTestPlaylist([{ name: 'A' }, { name: 'B' }]);
      manager.loadPlaylist(playlist);
      await manager.start();
      eventLog.length = 0; // Clear previous events

      await manager.jumpTo(1);

      const slotChangedEvent = eventLog.find(e => e.type === 'slot-changed');
      expect(slotChangedEvent).toBeDefined();
      expect(slotChangedEvent?.slotIndex).toBe(1);
      expect(slotChangedEvent?.slot?.name).toBe('B');
    });

    it('allows multiple event handlers', async () => {
      const handler1Events: PlaylistEvent[] = [];
      const handler2Events: PlaylistEvent[] = [];

      manager.on(e => handler1Events.push(e));
      manager.on(e => handler2Events.push(e));

      const playlist = createTestPlaylist([{ name: 'Test' }]);
      manager.loadPlaylist(playlist);

      expect(handler1Events.length).toBeGreaterThan(0);
      expect(handler2Events.length).toBeGreaterThan(0);
    });

    it('unsubscribes event handler', () => {
      const events: PlaylistEvent[] = [];
      const unsubscribe = manager.on(e => events.push(e));

      manager.loadPlaylist(createTestPlaylist([{ name: 'A' }]));
      const countBefore = events.length;

      unsubscribe();
      manager.loadPlaylist(createTestPlaylist([{ name: 'B' }]));

      expect(events.length).toBe(countBefore);
    });
  });

  // ==========================================================================
  // BPM Integration Tests
  // ==========================================================================

  describe('BPM Integration', () => {
    it('updates BPM for timing calculations', () => {
      manager.setBpm(140);
      // BPM is used internally for duration calculations
      // This mainly verifies the method doesn't throw
    });

    it('uses BPM for beat-based timing', async () => {
      const playlist = createTestPlaylist([
        { name: 'Test', duration: 4 } // 4 beats
      ]);
      playlist.timingMode = 'beats';
      manager.loadPlaylist(playlist);
      manager.setBpm(120); // 500ms per beat, so 4 beats = 2000ms

      await manager.start();

      // The manager uses BPM to calculate actual milliseconds
      // We can verify this indirectly through the preset loader call
      expect(presetLoaderMock).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Energy-Based Advance Tests
  // ==========================================================================

  describe('Energy-Based Advance', () => {
    it('tracks energy updates', () => {
      const playlist = createTestPlaylist([
        { name: 'Test', advanceCondition: 'energy-high', energyThreshold: 0.7 }
      ]);
      manager.loadPlaylist(playlist);

      manager.setEnergy(0.8);

      expect(manager.getState().currentEnergy).toBe(0.8);
    });

    it('tracks beat drop markers', () => {
      const playlist = createTestPlaylist([
        { name: 'Test', advanceCondition: 'beat-drop' }
      ]);
      manager.loadPlaylist(playlist);

      const beforeMark = manager.getState().lastBeatDrop;
      manager.markBeatDrop();
      const afterMark = manager.getState().lastBeatDrop;

      expect(afterMark).toBeGreaterThan(beforeMark);
    });
  });

  // ==========================================================================
  // Macro Trigger Tests
  // ==========================================================================

  describe('Macro Triggers', () => {
    it('triggers entry macro when slot starts', async () => {
      const playlist = createTestPlaylist([
        { name: 'Test', entryMacro: 'drop-classic' }
      ]);
      manager.loadPlaylist(playlist);

      await manager.start();

      expect(macroTriggerMock).toHaveBeenCalledWith('drop-classic');
    });

    it('triggers entry macro on jump', async () => {
      const playlist = createTestPlaylist([
        { name: 'A' },
        { name: 'B', entryMacro: 'build-8bar' }
      ]);
      manager.loadPlaylist(playlist);
      await manager.start();
      macroTriggerMock.mockClear();

      await manager.jumpTo(1);

      expect(macroTriggerMock).toHaveBeenCalledWith('build-8bar');
    });
  });

  // ==========================================================================
  // Slot Management Tests
  // ==========================================================================

  describe('Slot Management', () => {
    it('adds slot to playlist', () => {
      manager.createPlaylist('New Playlist');

      manager.addSlot('New Preset', '/new/preset.vsp');

      const playlist = manager.getPlaylist();
      expect(playlist?.slots.length).toBe(1);
      expect(playlist?.slots[0].name).toBe('New Preset');
    });

    it('adds slot with custom options', () => {
      manager.createPlaylist('Test');

      manager.addSlot('Custom', '/custom.vsp', {
        duration: 32,
        advanceCondition: 'energy-high',
        entryMacro: 'drop-classic'
      });

      const slot = manager.getPlaylist()?.slots[0];
      expect(slot?.duration).toBe(32);
      expect(slot?.advanceCondition).toBe('energy-high');
      expect(slot?.entryMacro).toBe('drop-classic');
    });

    it('removes slot by index', () => {
      const playlist = createTestPlaylist([
        { name: 'A' },
        { name: 'B' },
        { name: 'C' }
      ]);
      manager.loadPlaylist(playlist);

      manager.removeSlot(1);

      const updated = manager.getPlaylist();
      expect(updated?.slots.length).toBe(2);
      expect(updated?.slots.map(s => s.name)).toEqual(['A', 'C']);
    });

    it('adjusts current index when removing earlier slot', async () => {
      const playlist = createTestPlaylist([
        { name: 'A' },
        { name: 'B' },
        { name: 'C' }
      ]);
      manager.loadPlaylist(playlist);
      await manager.start(2); // At index 2 (C)

      manager.removeSlot(0);

      // Current index should still point to valid slot
      expect(manager.getState().currentIndex).toBeLessThanOrEqual(1);
    });

    it('updates slot properties', () => {
      const playlist = createTestPlaylist([{ name: 'Original' }]);
      manager.loadPlaylist(playlist);

      manager.updateSlot(0, {
        name: 'Updated',
        duration: 64,
        advanceCondition: 'manual'
      });

      const slot = manager.getCurrentSlot();
      expect(slot?.name).toBe('Updated');
      expect(slot?.duration).toBe(64);
      expect(slot?.advanceCondition).toBe('manual');
    });

    it('moves slot to new position', () => {
      const playlist = createTestPlaylist([
        { name: 'A' },
        { name: 'B' },
        { name: 'C' }
      ]);
      manager.loadPlaylist(playlist);

      manager.moveSlot(2, 0);

      const names = manager.getPlaylist()?.slots.map(s => s.name);
      expect(names).toEqual(['C', 'A', 'B']);
    });
  });

  // ==========================================================================
  // Timing Mode Tests
  // ==========================================================================

  describe('Timing Mode', () => {
    it('sets timing mode', () => {
      const playlist = createTestPlaylist([{ name: 'Test' }]);
      manager.loadPlaylist(playlist);

      manager.setTimingMode('bars');

      expect(manager.getPlaylist()?.timingMode).toBe('bars');
    });

    it('sets reference BPM', () => {
      const playlist = createTestPlaylist([{ name: 'Test' }]);
      manager.loadPlaylist(playlist);

      manager.setReferenceBpm(140);

      expect(manager.getPlaylist()?.referenceBpm).toBe(140);
    });
  });

  // ==========================================================================
  // Export Tests
  // ==========================================================================

  describe('Export', () => {
    it('exports playlist as JSON', () => {
      const playlist = createTestPlaylist([
        { name: 'A', duration: 16 },
        { name: 'B', duration: 32 }
      ]);
      manager.loadPlaylist(playlist);

      const json = manager.exportPlaylist();

      expect(json).not.toBeNull();
      const parsed = JSON.parse(json!);
      expect(parsed.slots.length).toBe(2);
      expect(parsed.metadata.name).toBe('Test Playlist');
    });

    it('returns null when no playlist loaded', () => {
      const json = manager.exportPlaylist();
      expect(json).toBeNull();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles empty playlist', async () => {
      const playlist = createTestPlaylist([]);
      manager.loadPlaylist(playlist);

      await manager.start();

      expect(manager.getState().isPlaying).toBe(false);
      expect(presetLoaderMock).not.toHaveBeenCalled();
    });

    it('handles null playlist gracefully', () => {
      expect(() => manager.start()).not.toThrow();
      expect(() => manager.jumpTo(5)).not.toThrow();
      expect(() => manager.next()).not.toThrow();
      expect(() => manager.previous()).not.toThrow();
    });

    it('clamps jump index to valid range', async () => {
      const playlist = createTestPlaylist([{ name: 'A' }, { name: 'B' }]);
      manager.loadPlaylist(playlist);

      await manager.jumpTo(100); // Way out of range

      // Should not throw, but also should not change to invalid index
      expect(manager.getState().currentIndex).toBeLessThan(100);
    });

    it('ignores invalid slot operations', () => {
      const playlist = createTestPlaylist([{ name: 'A' }]);
      manager.loadPlaylist(playlist);

      manager.removeSlot(-1);
      manager.removeSlot(100);
      manager.updateSlot(-1, { name: 'Bad' });
      manager.updateSlot(100, { name: 'Bad' });

      expect(manager.getPlaylist()?.slots.length).toBe(1);
      expect(manager.getPlaylist()?.slots[0].name).toBe('A');
    });
  });
});
