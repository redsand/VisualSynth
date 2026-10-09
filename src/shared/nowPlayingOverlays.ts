import type { OverlayConfig, VisualSynthProject } from './project';
import type { NowPlayingSettings } from './nowPlaying';

// Factory + migration helpers for the auto-created now-playing overlays.
// The managed overlays (title + artwork) are deliberately GLOBAL: they carry
// no `targetSceneId`, so the main-window overlay filter
// (`!o.targetSceneId || o.targetSceneId === target`) shows them in every
// scene, and the projector window (which renders overlays unfiltered) shows
// them too. Scoping them to the scene that happened to be active when a song
// was detected made the title vanish on the next scene change.

export const createNowPlayingOverlayConfig = (
  type: 'text' | 'image',
  overlayId: string
): OverlayConfig =>
  type === 'text'
    ? {
        id: overlayId,
        name: 'Now Playing',
        type: 'text',
        enabled: true,
        x: 0.03,
        y: 0.82,
        width: 0.38,
        height: 0.13,
        opacity: 1,
        rotation: 0,
        includeInFx: false,
        text: 'Listening...',
        fontSize: 30,
        fontColor: '#ffffff',
        fontWeight: 'bold',
        textShadow: true
      }
    : {
        id: overlayId,
        name: 'Now Playing Artwork',
        type: 'image',
        enabled: true,
        x: 0.03,
        y: 0.62,
        width: 0.14,
        height: 0.18,
        opacity: 0.95,
        rotation: 0,
        includeInFx: false
      };

/**
 * Clear `targetSceneId` on the managed now-playing overlays (matched by id,
 * never by name) so projects saved before the global-scope change self-heal
 * on load. User-created overlays are never touched. Returns true when the
 * project was mutated (so callers know a re-save is worthwhile).
 */
export const migrateProjectNowPlayingOverlays = (
  project: VisualSynthProject,
  settings: NowPlayingSettings
): boolean => {
  const managedIds = new Set<string>([settings.titleOverlayId, settings.artworkOverlayId]);
  let changed = false;
  for (const overlay of project.overlays ?? []) {
    if (managedIds.has(overlay.id) && overlay.targetSceneId !== undefined) {
      overlay.targetSceneId = undefined;
      changed = true;
    }
  }
  return changed;
};