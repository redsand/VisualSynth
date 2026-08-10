import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { applyLoadableProjectRuntime } from '../src/renderer/projectApplyRuntime';

describe('applyLoadableProjectRuntime', () => {
  it('normalizes a valid project and syncs output config', async () => {
    const project = {
      ...DEFAULT_PROJECT,
      name: 'Runtime Apply',
      output: {
        ...DEFAULT_PROJECT.output,
        enabled: true,
        scale: 0.5
      }
    };
    const onResolvedProject = vi.fn().mockResolvedValue(undefined);
    const syncOutputConfig = vi.fn().mockResolvedValue(undefined);
    const setOutputEnabled = vi.fn().mockResolvedValue(undefined);

    const result = await applyLoadableProjectRuntime(project, {
      currentOutputConfig: DEFAULT_PROJECT.output,
      onResolvedProject,
      syncOutputConfig,
      setOutputEnabled
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.name).toBe('Runtime Apply');
      expect(result.outputConfig.enabled).toBe(true);
      expect(result.outputConfig.scale).toBe(0.5);
    }
    expect(onResolvedProject).toHaveBeenCalledTimes(1);
    expect(syncOutputConfig).toHaveBeenCalledTimes(1);
    expect(setOutputEnabled).toHaveBeenCalledWith(true);
  });

  it('returns validation failure without side effects', async () => {
    const invalidProject = {
      name: 'Invalid Project',
      scenes: 'not-an-array'
    };
    const onResolvedProject = vi.fn().mockResolvedValue(undefined);
    const syncOutputConfig = vi.fn().mockResolvedValue(undefined);
    const setOutputEnabled = vi.fn().mockResolvedValue(undefined);

    const result = await applyLoadableProjectRuntime(invalidProject as any, {
      currentOutputConfig: DEFAULT_PROJECT.output,
      onResolvedProject,
      syncOutputConfig,
      setOutputEnabled
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.name).toBe('Invalid Project');
      expect(result.errorDetail.length).toBeGreaterThan(0);
    }
    expect(onResolvedProject).not.toHaveBeenCalled();
    expect(syncOutputConfig).not.toHaveBeenCalled();
    expect(setOutputEnabled).not.toHaveBeenCalled();
  });

  it('resolves a relative overlay assetPath to absolute and links assetId on load', async () => {
    // resolveAllAssets calls into the main process via window.visualSynth
    // .checkAssetPaths, which does not exist in the node test env. Stub it:
    // absolute paths "exist", relative paths do not, which forces the
    // projectDir-relative remap that turns 'flyer.png' into 'C:/shows/flyer.png'.
    const checkAssetPaths = vi.fn(async (paths: string[]) => {
      const out: Record<string, boolean> = {};
      for (const p of paths) out[p] = /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/');
      return out;
    });
    const previousWindow = (globalThis as any).window;
    (globalThis as any).window = { visualSynth: { checkAssetPaths } };

    try {
      const project = {
        ...DEFAULT_PROJECT,
        assets: [],
        overlays: [
          {
            id: 'o1', name: 'Flyer', type: 'image' as const, assetPath: 'flyer.png',
            enabled: true, x: 0, y: 0, width: 1, height: 1,
            opacity: 1, rotation: 0, includeInFx: false
          }
        ]
      };
      const onResolvedProject = vi.fn().mockResolvedValue(undefined);
      const syncOutputConfig = vi.fn().mockResolvedValue(undefined);
      const setOutputEnabled = vi.fn().mockResolvedValue(undefined);

      const result = await applyLoadableProjectRuntime(
        project,
        { currentOutputConfig: DEFAULT_PROJECT.output, onResolvedProject, syncOutputConfig, setOutputEnabled },
        'C:/shows/myshow.json'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const overlay = result.project.overlays![0];
        // The overlay's relative assetPath must be rewritten to the resolved
        // absolute path, and the overlay must be linked to the asset by id.
        expect(overlay.assetPath).toBe('C:/shows/flyer.png');
        expect(overlay.assetId).toBeTruthy();
        const linked = result.project.assets.find((a: any) => a.id === overlay.assetId);
        expect(linked).toBeTruthy();
        expect(linked?.path).toBe('C:/shows/flyer.png');
      }
    } finally {
      if (previousWindow === undefined) delete (globalThis as any).window;
      else (globalThis as any).window = previousWindow;
    }
  });
});
