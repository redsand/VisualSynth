import { describe, expect, it } from 'vitest';
import { resolveProjectOutputConfig } from '../src/renderer/outputRuntime';
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT } from '../src/shared/project';

describe('resolveProjectOutputConfig', () => {
  it('merges project output over defaults', () => {
    const project = {
      ...DEFAULT_PROJECT,
      output: {
        enabled: true,
        fullscreen: true,
        scale: 2
      }
    };

    const result = resolveProjectOutputConfig(project);

    expect(result).toEqual({
      ...DEFAULT_OUTPUT_CONFIG,
      enabled: true,
      fullscreen: true,
      scale: 2
    });
  });

  it('preserves current runtime output fields until the project overrides them', () => {
    const project: any = {
      ...DEFAULT_PROJECT,
      output: {
        enabled: true
      }
    };

    const result = resolveProjectOutputConfig(project, {
      fullscreen: true,
      scale: 0.5
    });

    expect(result).toEqual({
      ...DEFAULT_OUTPUT_CONFIG,
      enabled: true,
      fullscreen: true,
      scale: 0.5
    });
  });

  it('lets the project output override the current runtime window for fields it sets', () => {
    // resolveProjectOutputConfig is project-wins: the loaded project's output
    // takes precedence over the current runtime window config (the current
    // runtime only fills fields the project leaves unset). This is what makes
    // output travel with a project/preset on load.
    const project: any = {
      ...DEFAULT_PROJECT,
      output: { ...DEFAULT_OUTPUT_CONFIG, scale: 0.25, fullscreen: true }
    };

    const result = resolveProjectOutputConfig(project, {
      scale: 0.5,
      fullscreen: false
    });

    expect(result.scale).toBe(0.25);
    expect(result.fullscreen).toBe(true);
  });
});
