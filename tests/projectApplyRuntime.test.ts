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
});
