import { describe, expect, it } from 'vitest';
import {
  applySceneActivationRuntime,
  applySceneLookToProject,
  resolveSceneActivationRuntime
} from '../src/renderer/sceneRuntime';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('applySceneLookToProject', () => {
  it('activates the target scene without changing project look when no scene look exists', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    const scene = {
      ...project.scenes[0],
      id: 'scene-b',
      name: 'Scene B',
      look: undefined
    };

    const result = applySceneLookToProject(project, scene);

    expect(result.activeSceneId).toBe('scene-b');
    expect(result.activePaletteId).toBe(project.activePaletteId);
    expect(result.effects).toEqual(project.effects);
  });

  it('overrides look-bound project sections from the active scene', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    const scene = {
      ...project.scenes[0],
      id: 'scene-look',
      look: {
        effects: { ...project.effects, bloom: 0.9 },
        particles: { ...project.particles, enabled: false },
        sdf: { ...project.sdf, glow: 0.2 },
        visualizer: { ...project.visualizer, enabled: true, mode: 'waveform' as const },
        activeStylePresetId: 'style-surge',
        activePaletteId: 'ocean',
        macros: project.macros.slice(0, 1),
        modMatrix: project.modMatrix.slice(0, 1)
      }
    };

    const result = applySceneLookToProject(project, scene);

    expect(result.activeSceneId).toBe('scene-look');
    expect(result.effects.bloom).toBe(0.9);
    expect(result.particles.enabled).toBe(false);
    expect(result.sdf.glow).toBe(0.2);
    expect(result.visualizer.enabled).toBe(true);
    expect(result.visualizer.mode).toBe('waveform');
    expect(result.activeStylePresetId).toBe('style-surge');
    expect(result.activePaletteId).toBe('ocean');
    expect(result.macros).toHaveLength(1);
  });

  it('resolves scene activation runtime with shared transition metadata', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.scenes = [
      {
        ...project.scenes[0],
        id: 'scene-a',
        scene_id: 'scene-a',
        name: 'Scene A',
        transition_out: { durationMs: 400, curve: 'linear', type: 'fade' },
        layers: [{ ...project.scenes[0].layers[0], id: 'layer-plasma', opacity: 0.2, enabled: true }]
      },
      {
        ...project.scenes[0],
        id: 'scene-b',
        scene_id: 'scene-b',
        name: 'Scene B',
        transition_in: { durationMs: 900, curve: 'easeInOut', type: 'warp' },
        look: {
          activePaletteId: 'ocean'
        },
        layers: [{ ...project.scenes[0].layers[0], id: 'layer-plasma', opacity: 0.8, enabled: true }]
      }
    ];
    project.activeSceneId = 'scene-a';

    const result = resolveSceneActivationRuntime(project, 'scene-b');

    expect(result).toBeTruthy();
    expect(result?.project.activeSceneId).toBe('scene-b');
    expect(result?.paletteApplied).toBe(true);
    expect(result?.project.activePaletteId).toBe('ocean');
    expect(result?.visualTransition).toEqual({
      type: 2,
      amount: 1,
      decay: 1 / 900
    });
    expect(result?.blendTransition?.durationMs).toBe(900);
    expect(result?.blendTransition?.curve).toBe('easeInOut');
  });

  it('applies activation side effects and scene shader warmup through shared runtime helper', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.scenes = [
      {
        ...project.scenes[0],
        id: 'scene-a',
        scene_id: 'scene-a',
        name: 'Scene A',
        transition_out: { durationMs: 300, curve: 'linear', type: 'fade' },
        layers: [{ ...project.scenes[0].layers[0], id: 'layer-plasma', opacity: 0.25, enabled: true }]
      },
      {
        ...project.scenes[0],
        id: 'scene-b',
        scene_id: 'scene-b',
        name: 'Scene B',
        transition_in: { durationMs: 600, curve: 'easeInOut', type: 'glitch' },
        layers: [{ ...project.scenes[0].layers[0], id: 'layer-plasma', opacity: 0.8, enabled: true }]
      }
    ];
    project.activeSceneId = 'scene-a';

    const activation = resolveSceneActivationRuntime(project, 'scene-b');
    expect(activation).toBeTruthy();
    if (!activation) return;

    const calls: string[] = [];
    const result = applySceneActivationRuntime(activation, {
      transportTimeMs: 1234,
      onVisualTransition: () => calls.push('visual'),
      startBlendTransition: () => calls.push('start-blend'),
      clearBlendTransition: () => calls.push('clear-blend'),
      markSceneActivated: () => calls.push('mark-activated'),
      setPaletteApplied: () => calls.push('set-palette'),
      compileSceneShaders: () => {
        calls.push('compile');
        return 2;
      }
    });

    expect(result.activeGeneratorCount).toBe(2);
    expect(calls).toEqual(['visual', 'start-blend', 'mark-activated', 'set-palette', 'compile']);
  });
});

describe('resolveSceneActivationRuntime — transition type mapping', () => {
  const makeProject = (transitionType: string, durationMs = 600) => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.scenes = [
      { ...project.scenes[0], id: 'scene-a', scene_id: 'scene-a', name: 'A' },
      {
        ...project.scenes[0],
        id: 'scene-b',
        scene_id: 'scene-b',
        name: 'B',
        transition_in: { durationMs, curve: 'easeInOut', type: transitionType }
      }
    ];
    project.activeSceneId = 'scene-a';
    return project;
  };

  it.each([
    ['fade',      1],
    ['crossfade', 1],
    ['warp',      2],
    ['glitch',    3],
    ['dissolve',  4],
  ])('maps transition type "%s" → numeric type %i', (type, expected) => {
    const result = resolveSceneActivationRuntime(makeProject(type), 'scene-b');
    expect(result?.visualTransition?.type).toBe(expected);
  });

  it('sets amount=1 and decay=1/durationMs for all transitions', () => {
    const result = resolveSceneActivationRuntime(makeProject('warp', 800), 'scene-b');
    expect(result?.visualTransition?.amount).toBe(1.0);
    expect(result?.visualTransition?.decay).toBeCloseTo(1 / 800);
  });

  it('produces no visual transition when transition_in is absent', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.scenes = [
      { ...project.scenes[0], id: 'scene-a', scene_id: 'scene-a', name: 'A' },
      { ...project.scenes[0], id: 'scene-b', scene_id: 'scene-b', name: 'B', transition_in: undefined }
    ];
    project.activeSceneId = 'scene-a';
    const result = resolveSceneActivationRuntime(project, 'scene-b');
    expect(result?.visualTransition).toBeNull();
  });

  it('produces no visual transition when durationMs is 0 (cut)', () => {
    const project = makeProject('fade', 0);
    const result = resolveSceneActivationRuntime(project, 'scene-b');
    expect(result?.visualTransition).toBeNull();
  });

  it('blend duration is max(from_out, to_in)', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.scenes = [
      {
        ...project.scenes[0],
        id: 'scene-a',
        scene_id: 'scene-a',
        name: 'A',
        transition_out: { durationMs: 800, curve: 'linear' }
      },
      {
        ...project.scenes[0],
        id: 'scene-b',
        scene_id: 'scene-b',
        name: 'B',
        transition_in: { durationMs: 400, curve: 'easeInOut', type: 'fade' }
      }
    ];
    project.activeSceneId = 'scene-a';
    const result = resolveSceneActivationRuntime(project, 'scene-b');
    expect(result?.blendTransition?.durationMs).toBe(800);
  });

  it('produces no blend when both sides have durationMs=0 (cut)', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.scenes = [
      {
        ...project.scenes[0],
        id: 'scene-a',
        scene_id: 'scene-a',
        name: 'A',
        transition_out: { durationMs: 0, curve: 'linear' }
      },
      {
        ...project.scenes[0],
        id: 'scene-b',
        scene_id: 'scene-b',
        name: 'B',
        transition_in: { durationMs: 0, curve: 'linear' }
      }
    ];
    project.activeSceneId = 'scene-a';
    const result = resolveSceneActivationRuntime(project, 'scene-b');
    // blend duration should be 0 → SceneManager.startTransition will clear immediately
    expect(result?.blendTransition?.durationMs).toBe(0);
    // no visual transition
    expect(result?.visualTransition).toBeNull();
  });

  it('clearBlendTransition is called (not startBlendTransition) when switching to the same scene', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.activeSceneId = project.scenes[0].id;
    const activation = resolveSceneActivationRuntime(project, project.scenes[0].id);
    expect(activation).toBeTruthy();
    if (!activation) return;
    const calls: string[] = [];
    applySceneActivationRuntime(activation, {
      transportTimeMs: 0,
      onVisualTransition: () => calls.push('visual'),
      startBlendTransition: () => calls.push('start-blend'),
      clearBlendTransition: () => calls.push('clear-blend'),
      markSceneActivated: () => calls.push('mark-activated'),
      setPaletteApplied: () => calls.push('set-palette'),
    });
    expect(calls).not.toContain('start-blend');
    expect(calls).toContain('clear-blend');
  });
});
