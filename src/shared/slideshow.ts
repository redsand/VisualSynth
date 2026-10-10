import type { SceneConfig } from './project';
import type { PresetIndexEntry } from './presetIndex';

/**
 * Default per-scene duration for scenes added to the live slideshow.
 * Matches the legacy scene playlist's 16s slot default.
 */
export const SLIDESHOW_DEFAULT_DURATION_MS = 16000;

/**
 * Make a scene participate in the live auto-advance rotation.
 *
 * Shipped presets carry `trigger: { type: 'manual' }` and `duration: 0`, and
 * `SceneManager.updateAutoSwitch` returns null while the *active* scene's
 * trigger is manual — so a scene that is merely appended freezes the slideshow
 * the moment the auto-DJ lands on it. Scenes added through the slideshow
 * workflow get auto-advance defaults instead; authored 'time'/'audio' triggers
 * and non-zero durations are left untouched.
 */
export const applySlideshowDefaults = (
  scene: SceneConfig,
  durationMs = SLIDESHOW_DEFAULT_DURATION_MS
): SceneConfig => ({
  ...scene,
  trigger:
    !scene.trigger || scene.trigger.type === 'manual'
      ? { type: 'time' }
      : scene.trigger,
  duration: scene.duration && scene.duration > 0 ? scene.duration : durationMs
});

/**
 * Search + sort preset entries for the quick-add picker.
 *
 * Mirrors the preset browser's search (substring on searchText, then name)
 * and its favorites-first / recents-first / name ordering, so the picker
 * ranks presets the same way the full browser does.
 */
export const filterPresetsForPicker = (
  entries: PresetIndexEntry[],
  query: string,
  opts: { favorites: string[]; recents: string[] }
): PresetIndexEntry[] => {
  const search = query.trim().toLowerCase();
  const matched = search
    ? entries.filter(
        (entry) =>
          entry.searchText.includes(search) || entry.name.toLowerCase().includes(search)
      )
    : [...entries];

  const recentIndex = (path: string) => {
    const index = opts.recents.indexOf(path);
    return index === -1 ? 999 : index;
  };

  return matched.sort((a, b) => {
    const favoriteDiff =
      Number(opts.favorites.includes(b.path)) - Number(opts.favorites.includes(a.path));
    if (favoriteDiff !== 0) return favoriteDiff;
    const recentDiff = recentIndex(a.path) - recentIndex(b.path);
    if (recentDiff !== 0) return recentDiff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
};

export interface SlideshowAdvanceResult {
  sceneId: string | null;
  nextIndex: number;
}

/**
 * Pick the next scene for the "slideshow on new song" feature: cycle through
 * the configured scene ids, skipping ids that no longer resolve (e.g. the
 * scene was deleted, or a live-mode preset trigger replaced the project).
 *
 * `lastIndex` is the index of the scene chosen on the previous song change
 * (-1 before the first one). Returns sceneId null when the list is empty or
 * every id is stale.
 */
export const advanceSlideshowOnSongChange = (
  sceneIds: string[],
  lastIndex: number,
  resolveScene: (id: string) => SceneConfig | undefined
): SlideshowAdvanceResult => {
  for (let step = 1; step <= sceneIds.length; step++) {
    const index = (lastIndex + step + sceneIds.length) % sceneIds.length;
    const sceneId = sceneIds[index];
    if (sceneId && resolveScene(sceneId)) {
      return { sceneId, nextIndex: index };
    }
  }
  return { sceneId: null, nextIndex: lastIndex };
};