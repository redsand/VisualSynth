import { describe, expect, it } from 'vitest';
import {
  createNowPlayingOverlayConfig,
  migrateProjectNowPlayingOverlays
} from '../src/shared/nowPlayingOverlays';
import { DEFAULT_NOW_PLAYING_SETTINGS } from '../src/shared/nowPlaying';
import type { OverlayConfig, VisualSynthProject } from '../src/shared/project';

const makeOverlay = (overrides: Partial<OverlayConfig>): OverlayConfig => ({
  id: 'user-overlay',
  name: 'User Overlay',
  type: 'text',
  enabled: true,
  x: 0,
  y: 0,
  width: 0.1,
  height: 0.1,
  opacity: 1,
  rotation: 0,
  includeInFx: false,
  ...overrides
});

const makeProject = (overlays: OverlayConfig[]): VisualSynthProject =>
  ({ overlays }) as unknown as VisualSynthProject;

describe('createNowPlayingOverlayConfig', () => {
  it('creates a GLOBAL title overlay with no targetSceneId', () => {
    const overlay = createNowPlayingOverlayConfig('text', 'now-playing-title');

    expect(overlay.type).toBe('text');
    expect(overlay.targetSceneId).toBeUndefined();
    expect(overlay.text).toBe('Listening...');
    expect(overlay.fontWeight).toBe('bold');
  });

  it('creates a GLOBAL artwork overlay with no targetSceneId', () => {
    const overlay = createNowPlayingOverlayConfig('image', 'now-playing-artwork');

    expect(overlay.type).toBe('image');
    expect(overlay.targetSceneId).toBeUndefined();
  });
});

describe('migrateProjectNowPlayingOverlays', () => {
  it('clears targetSceneId on the managed overlay ids only', () => {
    const project = makeProject([
      makeOverlay({ id: DEFAULT_NOW_PLAYING_SETTINGS.titleOverlayId, targetSceneId: 'scene-1' }),
      makeOverlay({ id: DEFAULT_NOW_PLAYING_SETTINGS.artworkOverlayId, targetSceneId: 'scene-1' }),
      makeOverlay({ id: 'user-overlay', targetSceneId: 'scene-1' })
    ]);

    const changed = migrateProjectNowPlayingOverlays(project, DEFAULT_NOW_PLAYING_SETTINGS);

    expect(changed).toBe(true);
    expect(project.overlays?.[0].targetSceneId).toBeUndefined();
    expect(project.overlays?.[1].targetSceneId).toBeUndefined();
    // A user overlay with the same scoping must be left untouched.
    expect(project.overlays?.[2].targetSceneId).toBe('scene-1');
  });

  it('never touches user overlays that merely share the managed name', () => {
    const project = makeProject([
      makeOverlay({ id: 'some-other-id', name: 'Now Playing', targetSceneId: 'scene-2' })
    ]);

    const changed = migrateProjectNowPlayingOverlays(project, DEFAULT_NOW_PLAYING_SETTINGS);

    expect(changed).toBe(false);
    expect(project.overlays?.[0].targetSceneId).toBe('scene-2');
  });

  it('is idempotent and returns false when there is nothing to migrate', () => {
    const project = makeProject([
      makeOverlay({ id: DEFAULT_NOW_PLAYING_SETTINGS.titleOverlayId }),
      makeOverlay({ id: DEFAULT_NOW_PLAYING_SETTINGS.artworkOverlayId })
    ]);

    expect(migrateProjectNowPlayingOverlays(project, DEFAULT_NOW_PLAYING_SETTINGS)).toBe(false);
  });

  it('tolerates projects with no overlays array', () => {
    const project = {} as VisualSynthProject;

    expect(migrateProjectNowPlayingOverlays(project, DEFAULT_NOW_PLAYING_SETTINGS)).toBe(false);
  });
});