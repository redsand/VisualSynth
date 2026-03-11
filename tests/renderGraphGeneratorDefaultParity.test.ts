import { describe, expect, it } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createInitialState, createStore } from '../src/renderer/state/store';

describe('RenderGraph generator default parity', () => {
  it('matches shipped index defaults for retro and gothic generator parameters', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });

    expect(renderState.pixelDustPixelSize).toBeCloseTo(0.02, 6);
    expect(renderState.eightBitGridPixelSize).toBeCloseTo(0.02, 6);
    expect(renderState.retroStarfieldSize).toBeCloseTo(0.01, 6);

    expect(renderState.crimsonVeilDarkness).toBeCloseTo(0.5, 6);
    expect(renderState.victorianCryptComplexity).toBeCloseTo(0.5, 6);
    expect(renderState.spectralApparitionDensity).toBeCloseTo(0.5, 6);
    expect(renderState.gothicCobwebsDensity).toBeCloseTo(0.5, 6);
    expect(renderState.bloodMoonRiseEclipse).toBeCloseTo(0.5, 6);

    expect(renderState.arcadeInvadersDensity).toBeCloseTo(0.5, 6);
    expect(renderState.powerUpPulseIntensity).toBeCloseTo(0.5, 6);
    expect(renderState.dungeonTilesPattern).toBeCloseTo(0.5, 6);
    expect(renderState.chiptuneWaveBits).toBeCloseTo(4.0, 6);
    expect(renderState.bossHealthValue).toBeCloseTo(0.5, 6);
    expect(renderState.bossHealthBars).toBeCloseTo(3.0, 6);
  });
});

