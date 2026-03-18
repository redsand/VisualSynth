import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SceneCacheWarmer } from '../src/renderer/scene/SceneCacheWarmer';
import type { VisualSynthProject } from '../src/shared/project';

describe('SceneCacheWarmer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).requestIdleCallback = vi.fn((cb) => setTimeout(cb, 1));
  });

  it('scans a project and requests compilation for all unique active generator variants', () => {
    const mockRenderer = {
      precompileVariant: vi.fn(),
    };

    const warmer = new SceneCacheWarmer(mockRenderer as any);

    const mockProject = {
      sdf: { enabled: false },
      scenes: [
        {
          id: 'scene-1',
          layers: [{ enabled: true, generatorId: 'layer-plasma' }],
          look: {}
        },
        {
          id: 'scene-2',
          layers: [{ enabled: true, generatorId: 'layer-spectrum' }],
          look: {}
        }
      ]
    } as unknown as VisualSynthProject;

    warmer.notifyProjectChanged(mockProject);
    
    // Fast forward to process requestIdleCallback (which we mocked with setTimeout)
    vi.runAllTimers();

    expect(mockRenderer.precompileVariant).toHaveBeenCalledTimes(2);
    expect(mockRenderer.precompileVariant).toHaveBeenNthCalledWith(1, new Set(['layer-plasma']));
    expect(mockRenderer.precompileVariant).toHaveBeenNthCalledWith(2, new Set(['layer-spectrum']));
  });

  it('includes sdf in precompile requests if enabled globally', () => {
    const mockRenderer = {
      precompileVariant: vi.fn(),
    };

    const warmer = new SceneCacheWarmer(mockRenderer as any);

    const mockProject = {
      sdf: { enabled: true },
      scenes: [
        {
          id: 'scene-1',
          layers: [{ enabled: true, generatorId: 'layer-origami' }],
          look: {}
        }
      ]
    } as unknown as VisualSynthProject;

    warmer.notifyProjectChanged(mockProject);
    vi.runAllTimers();

    expect(mockRenderer.precompileVariant).toHaveBeenCalledWith(new Set(['layer-origami', 'gen-sdf']));
  });
});
