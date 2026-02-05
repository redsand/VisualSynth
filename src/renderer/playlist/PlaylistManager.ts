/**
 * Playlist Manager
 *
 * Manages playlist execution with BPM-locked timing and conditional transitions.
 */

import {
  Playlist,
  PlaylistSlot,
  PlaylistExecutionState,
  PlaylistTimingMode,
  createPlaylistExecutionState,
  durationToMs,
  checkAdvanceCondition,
  serializePlaylist,
  deserializePlaylist,
  migrateLegacyPlaylist,
  createPlaylistSlot,
  DEFAULT_PLAYLIST,
  PLAYLIST_FILE_EXTENSION
} from '../../shared/playlist';

// ============================================================================
// Event Types
// ============================================================================

export type PlaylistEventType =
  | 'slot-changed'
  | 'playlist-loaded'
  | 'playlist-started'
  | 'playlist-stopped'
  | 'condition-waiting'
  | 'cue-point-reached'
  | 'playlist-completed';

export interface PlaylistEvent {
  type: PlaylistEventType;
  slotIndex?: number;
  slot?: PlaylistSlot;
  cuePoint?: { id: string; name: string };
  playlist?: Playlist;
}

export type PlaylistEventHandler = (event: PlaylistEvent) => void;

// ============================================================================
// Playlist Manager Class
// ============================================================================

export class PlaylistManager {
  private state: PlaylistExecutionState = createPlaylistExecutionState();
  private eventHandlers: PlaylistEventHandler[] = [];
  private updateTimer: number | null = null;
  private currentBpm: number = 128;
  private onLoadPreset: ((path: string, name: string, crossfadeSeconds: number) => Promise<void>) | null = null;
  private onTriggerMacro: ((macroId: string) => void) | null = null;

  constructor() {}

  /**
   * Set callback for loading presets
   */
  setPresetLoader(handler: (path: string, name: string, crossfadeSeconds: number) => Promise<void>): void {
    this.onLoadPreset = handler;
  }

  /**
   * Set callback for triggering macros
   */
  setMacroTrigger(handler: (macroId: string) => void): void {
    this.onTriggerMacro = handler;
  }

  /**
   * Subscribe to playlist events
   */
  on(handler: PlaylistEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index >= 0) this.eventHandlers.splice(index, 1);
    };
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: PlaylistEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  /**
   * Get current execution state
   */
  getState(): PlaylistExecutionState {
    return { ...this.state };
  }

  /**
   * Get current playlist
   */
  getPlaylist(): Playlist | null {
    return this.state.playlist;
  }

  /**
   * Get current slot
   */
  getCurrentSlot(): PlaylistSlot | null {
    if (!this.state.playlist) return null;
    return this.state.playlist.slots[this.state.currentIndex] ?? null;
  }

  /**
   * Update current BPM (call this from audio/tap tempo system)
   */
  setBpm(bpm: number): void {
    this.currentBpm = bpm;
  }

  /**
   * Update audio energy (call this from audio analysis)
   */
  setEnergy(energy: number): void {
    this.state.currentEnergy = energy;
  }

  /**
   * Mark a beat drop (call this from beat detection)
   */
  markBeatDrop(): void {
    this.state.lastBeatDrop = Date.now();
  }

  /**
   * Load a new playlist
   */
  loadPlaylist(playlist: Playlist): void {
    this.stop();
    this.state.playlist = playlist;
    this.state.currentIndex = 0;
    this.emit({ type: 'playlist-loaded', playlist });
  }

  /**
   * Load playlist from JSON string
   */
  loadPlaylistFromJson(json: string): { success: boolean; errors: string[] } {
    const result = deserializePlaylist(json);
    if (result.playlist) {
      this.loadPlaylist(result.playlist);
      return { success: true, errors: [] };
    }
    return { success: false, errors: result.errors };
  }

  /**
   * Import legacy playlist format
   */
  importLegacyPlaylist(legacy: { name: string; path: string; duration?: number; crossfade?: number }[]): void {
    const playlist = migrateLegacyPlaylist(legacy);
    this.loadPlaylist(playlist);
  }

  /**
   * Export playlist as JSON string
   */
  exportPlaylist(): string | null {
    if (!this.state.playlist) return null;
    return serializePlaylist(this.state.playlist);
  }

  /**
   * Create a new empty playlist
   */
  createPlaylist(name: string): void {
    const playlist: Playlist = {
      ...DEFAULT_PLAYLIST,
      metadata: {
        ...DEFAULT_PLAYLIST.metadata,
        name,
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      },
      slots: []
    };
    this.loadPlaylist(playlist);
  }

  /**
   * Add a slot to the current playlist
   */
  addSlot(name: string, path: string, options?: Partial<PlaylistSlot>): void {
    if (!this.state.playlist) return;

    const defaults = this.state.playlist.defaults;
    const slot = createPlaylistSlot(name, path, {
      duration: options?.duration ?? defaults.duration,
      transitionDuration: options?.transitionDuration ?? defaults.transitionDuration,
      transitionType: options?.transitionType ?? defaults.transitionType,
      advanceCondition: options?.advanceCondition ?? defaults.advanceCondition,
      energyThreshold: options?.energyThreshold ?? defaults.energyThreshold,
      ...options
    });

    this.state.playlist.slots.push(slot);
    this.state.playlist.metadata.modified = new Date().toISOString();
  }

  /**
   * Remove a slot by index
   */
  removeSlot(index: number): void {
    if (!this.state.playlist) return;
    if (index < 0 || index >= this.state.playlist.slots.length) return;

    this.state.playlist.slots.splice(index, 1);
    this.state.playlist.metadata.modified = new Date().toISOString();

    if (this.state.currentIndex >= this.state.playlist.slots.length) {
      this.state.currentIndex = Math.max(0, this.state.playlist.slots.length - 1);
    }
  }

  /**
   * Move a slot to a new position
   */
  moveSlot(fromIndex: number, toIndex: number): void {
    if (!this.state.playlist) return;
    const slots = this.state.playlist.slots;

    if (fromIndex < 0 || fromIndex >= slots.length) return;
    if (toIndex < 0 || toIndex >= slots.length) return;

    const [slot] = slots.splice(fromIndex, 1);
    slots.splice(toIndex, 0, slot);
    this.state.playlist.metadata.modified = new Date().toISOString();
  }

  /**
   * Update slot properties
   */
  updateSlot(index: number, updates: Partial<PlaylistSlot>): void {
    if (!this.state.playlist) return;
    const slot = this.state.playlist.slots[index];
    if (!slot) return;

    Object.assign(slot, updates);
    this.state.playlist.metadata.modified = new Date().toISOString();
  }

  /**
   * Start playlist playback
   */
  async start(fromIndex: number = 0): Promise<void> {
    if (!this.state.playlist || this.state.playlist.slots.length === 0) return;

    this.state.currentIndex = Math.min(fromIndex, this.state.playlist.slots.length - 1);
    this.state.isPlaying = true;
    this.state.slotStartTime = Date.now();
    this.state.slotElapsed = 0;
    this.state.slotProgress = 0;
    this.state.waitingForCondition = false;

    this.emit({ type: 'playlist-started', playlist: this.state.playlist });

    await this.triggerCurrentSlot();
    this.startUpdateLoop();
  }

  /**
   * Stop playlist playback
   */
  stop(): void {
    this.state.isPlaying = false;
    this.state.waitingForCondition = false;
    this.stopUpdateLoop();
    this.emit({ type: 'playlist-stopped' });
  }

  /**
   * Pause playlist (keeps position)
   */
  pause(): void {
    this.state.isPlaying = false;
    this.stopUpdateLoop();
  }

  /**
   * Resume playlist from current position
   */
  async resume(): Promise<void> {
    if (!this.state.playlist || this.state.playlist.slots.length === 0) return;
    this.state.isPlaying = true;
    this.state.slotStartTime = Date.now() - this.state.slotElapsed;
    this.startUpdateLoop();
  }

  /**
   * Jump to a specific slot
   */
  async jumpTo(index: number): Promise<void> {
    if (!this.state.playlist) return;
    if (index < 0 || index >= this.state.playlist.slots.length) return;

    const wasPlaying = this.state.isPlaying;
    this.state.currentIndex = index;
    this.state.slotStartTime = Date.now();
    this.state.slotElapsed = 0;
    this.state.slotProgress = 0;
    this.state.waitingForCondition = false;

    await this.triggerCurrentSlot();

    if (wasPlaying) {
      this.state.isPlaying = true;
    }
  }

  /**
   * Advance to next slot manually
   */
  async next(): Promise<void> {
    if (!this.state.playlist) return;

    const nextIndex = this.state.currentIndex + 1;
    if (nextIndex >= this.state.playlist.slots.length) {
      if (this.state.playlist.loop) {
        await this.jumpTo(0);
      } else {
        this.stop();
        this.emit({ type: 'playlist-completed' });
      }
    } else {
      await this.jumpTo(nextIndex);
    }
  }

  /**
   * Go to previous slot
   */
  async previous(): Promise<void> {
    if (!this.state.playlist) return;

    const prevIndex = this.state.currentIndex - 1;
    if (prevIndex >= 0) {
      await this.jumpTo(prevIndex);
    } else if (this.state.playlist.loop) {
      await this.jumpTo(this.state.playlist.slots.length - 1);
    }
  }

  /**
   * Set timing mode
   */
  setTimingMode(mode: PlaylistTimingMode): void {
    if (!this.state.playlist) return;
    this.state.playlist.timingMode = mode;
    this.state.playlist.metadata.modified = new Date().toISOString();
  }

  /**
   * Set reference BPM for the playlist
   */
  setReferenceBpm(bpm: number): void {
    if (!this.state.playlist) return;
    this.state.playlist.referenceBpm = bpm;
    this.state.playlist.metadata.modified = new Date().toISOString();
  }

  /**
   * Trigger the current slot's preset and macros
   */
  private async triggerCurrentSlot(): Promise<void> {
    const slot = this.getCurrentSlot();
    if (!slot) return;

    // Trigger entry macro
    if (slot.entryMacro && this.onTriggerMacro) {
      this.onTriggerMacro(slot.entryMacro);
    }

    // Load preset with transition
    if (this.onLoadPreset) {
      const transitionMs = durationToMs(
        slot.transitionDuration,
        this.state.playlist!.timingMode,
        this.currentBpm,
        this.state.playlist!.beatsPerBar
      );
      const transitionSeconds = transitionMs / 1000;

      await this.onLoadPreset(slot.path, slot.name, transitionSeconds);
    }

    this.emit({
      type: 'slot-changed',
      slotIndex: this.state.currentIndex,
      slot
    });
  }

  /**
   * Start the update loop
   */
  private startUpdateLoop(): void {
    this.stopUpdateLoop();
    this.updateTimer = window.setInterval(() => this.update(), 50);
  }

  /**
   * Stop the update loop
   */
  private stopUpdateLoop(): void {
    if (this.updateTimer !== null) {
      window.clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Update function called periodically
   */
  private async update(): Promise<void> {
    if (!this.state.isPlaying || !this.state.playlist) return;

    const now = Date.now();
    this.state.slotElapsed = now - this.state.slotStartTime;

    const slot = this.getCurrentSlot();
    if (!slot) return;

    // Calculate progress
    const totalDurationMs = durationToMs(
      slot.duration,
      this.state.playlist.timingMode,
      this.currentBpm,
      this.state.playlist.beatsPerBar
    );
    this.state.slotProgress = Math.min(1, this.state.slotElapsed / totalDurationMs);

    // Check cue points
    this.checkCuePoints(slot);

    // Check advance condition
    if (checkAdvanceCondition(this.state, slot, this.currentBpm)) {
      // Trigger exit macro
      if (slot.exitMacro && this.onTriggerMacro) {
        this.onTriggerMacro(slot.exitMacro);
      }

      await this.next();
    } else if (slot.advanceCondition !== 'timer' && slot.advanceCondition !== 'manual') {
      // Show waiting indicator for conditional advances
      if (!this.state.waitingForCondition && this.state.slotProgress > 0.5) {
        this.state.waitingForCondition = true;
        this.emit({ type: 'condition-waiting', slot });
      }
    }
  }

  /**
   * Check and trigger cue points
   */
  private checkCuePoints(slot: PlaylistSlot): void {
    if (!this.state.playlist) return;

    for (const cue of slot.cuePoints) {
      const cueTimeMs = durationToMs(
        cue.offset,
        this.state.playlist.timingMode,
        this.currentBpm,
        this.state.playlist.beatsPerBar
      );

      // Check if we just passed this cue point
      const prevElapsed = this.state.slotElapsed - 50; // Approximate previous check
      if (prevElapsed < cueTimeMs && this.state.slotElapsed >= cueTimeMs) {
        // Trigger cue action
        if (cue.action && this.onTriggerMacro) {
          this.onTriggerMacro(cue.action);
        }

        this.emit({
          type: 'cue-point-reached',
          cuePoint: { id: cue.id, name: cue.name }
        });
      }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const playlistManager = new PlaylistManager();
