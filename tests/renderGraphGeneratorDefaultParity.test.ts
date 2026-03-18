import { describe, expect, it } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createInitialState, createStore } from '../src/renderer/state/store';

describe('RenderGraph generator default parity', () => {
  it('matches shipped index defaults for retro and gothic generator parameters', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });

    expect(renderState.genUniforms.PixelDustPixelSize).toBeCloseTo(0.02, 6);
    expect(renderState.genUniforms['8BitGridPixelSize']).toBeCloseTo(0.02, 6);
    expect(renderState.genUniforms.RetroStarfieldSize).toBeCloseTo(0.01, 6);

    expect(renderState.genUniforms.CrimsonVeilDarkness).toBeCloseTo(0.5, 6);
    expect(renderState.genUniforms.VictorianCryptComplexity).toBeCloseTo(0.5, 6);
    expect(renderState.genUniforms.SpectralApparitionDensity).toBeCloseTo(0.5, 6);
    expect(renderState.genUniforms.GothicCobwebsDensity).toBeCloseTo(0.5, 6);
    expect(renderState.genUniforms.BloodMoonRiseEclipse).toBeCloseTo(0.5, 6);

    expect(renderState.genUniforms.ArcadeInvadersDensity).toBeCloseTo(0.5, 6);
    expect(renderState.genUniforms.PowerUpPulseIntensity).toBeCloseTo(0.5, 6);
    expect(renderState.genUniforms.DungeonTilesPattern).toBeCloseTo(0.5, 6);
    expect(renderState.genUniforms.ChiptuneWaveBits).toBeCloseTo(4.0, 6);
    expect(renderState.genUniforms.BossHealthValue).toBeCloseTo(0.5, 6);
    expect(renderState.genUniforms.BossHealthBars).toBeCloseTo(3.0, 6);
  });
});

