import { describe, expect, it } from 'vitest';
import { buildCaptureDiagnostics } from '../src/renderer/captureDiagnostics';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('buildCaptureDiagnostics', () => {
  it('summarizes the active scene and skips disabled layers for active generators', () => {
    const project = {
      ...DEFAULT_PROJECT,
      name: 'Diagnostic Project',
      activeSceneId: 'scene-b',
      scenes: [
        {
          id: 'scene-a',
          name: 'Scene A',
          layers: []
        },
        {
          id: 'scene-b',
          name: 'Scene B',
          layers: [
            { id: 'layer-spectrum', type: 'spectrum', enabled: true, opacity: 1, params: {} },
            { id: 'layer-plasma', type: 'plasma', enabled: false, opacity: 1, params: {} },
            { id: 'layer-bars', type: 'bars', opacity: 0.5, params: {} }
          ]
        }
      ]
    };

    const diagnostics = buildCaptureDiagnostics(
      project as any,
      ['Renderer init failed'],
      '[fragment] compile failed',
      [
        { name: 'gen-spectrum', enabled: true, opacity: 1, uniformsBound: true },
        { name: 'gen-bars', enabled: true, opacity: 0.5, uniformsBound: false }
      ],
      ['uFeedbackMix'],
      {
        timeMs: 1000,
        rms: 0.25,
        peak: 0.5,
        strobe: 0.1,
        legacyNeutral: true,
        activeEngineId: null,
        activeModeId: null,
        roleCoreWeight: 1,
        roleSupportWeight: 1,
        roleAtmosphereWeight: 1,
        effectsEnabled: true,
        plasmaEnabled: true,
        spectrumEnabled: true,
        plasmaOpacity: 0.9,
        spectrumOpacity: 0.8,
        glyphBeat: 0.4,
        topoOpacity: 0.2,
        weatherOpacity: 0.3,
        weatherMode: 1,
        weatherIntensity: 0.7,
        weatherSpeed: 1.1,
        portalOpacity: 0.4,
        portalStyle: 2,
        portalShift: 0.15,
        sdfEnabled: true,
        sdfShape: 3,
        sdfScale: 0.6,
        sdfEdge: 0.1,
        sdfGlow: 0.35,
        sdfRotation: 0.2,
        sdfFill: 0.8,
        transitionAmount: 0,
        transitionType: 0,
        chemistryMode: 0,
        motionTemplate: 0,
        contrast: 1.1,
        saturation: 0.95,
        paletteShift: 0.2,
        bloom: 0.15,
        blur: 0.05,
        chroma: 0.1,
        feedback: 0.2,
        kaleidoscope: 0,
        posterize: 0
      }
    );

    expect(diagnostics.projectName).toBe('Diagnostic Project');
    expect(diagnostics.activeSceneId).toBe('scene-b');
    expect(diagnostics.activeSceneName).toBe('Scene B');
    expect(diagnostics.sceneCount).toBe(2);
    expect(diagnostics.enabledLayerIds).toEqual(['layer-bars', 'layer-spectrum']);
    expect(diagnostics.disabledLayerIds).toEqual(['layer-plasma']);
    expect(diagnostics.activeGeneratorIds).toEqual(['layer-spectrum']);
    expect(diagnostics.safeModeReasons).toEqual(['Renderer init failed']);
    expect(diagnostics.lastShaderError).toBe('[fragment] compile failed');
    expect(diagnostics.generatorDiagnostics.map((entry) => entry.name)).toEqual(['gen-bars', 'gen-spectrum']);
    expect(diagnostics.missingUniforms).toEqual(['uFeedbackMix']);
    expect(diagnostics.renderSnapshot?.plasmaOpacity).toBe(0.9);
    expect(diagnostics.renderSnapshot?.activePalettePreview.length).toBeGreaterThan(0);
  });

  it('falls back cleanly when the project has no scenes', () => {
    const project = {
      ...DEFAULT_PROJECT,
      scenes: [],
      activeSceneId: ''
    };

    const diagnostics = buildCaptureDiagnostics(project, [], null, [], []);

    expect(diagnostics.activeSceneId).toBe('');
    expect(diagnostics.activeSceneName).toBeNull();
    expect(diagnostics.enabledLayerIds).toEqual([]);
    expect(diagnostics.activeGeneratorIds).toEqual([]);
    expect(diagnostics.safeModeReasons).toEqual([]);
    expect(diagnostics.lastShaderError).toBeNull();
    expect(diagnostics.renderSnapshot).toBeNull();
  });
});
