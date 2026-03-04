import type { RenderState } from '../glRenderer';

type OutputExtendedRenderState = RenderState & {
  myceliumGrowthEnabled?: boolean;
  myceliumGrowthOpacity?: number;
  myceliumGrowthSpread?: number;
  myceliumGrowthDecay?: number;
};

type ExcludedOutputField = 'sdfScene' | 'debugTint';

export type RendererOutputPayload = Omit<OutputExtendedRenderState, ExcludedOutputField>;

export const buildRendererOutputPayload = (
  renderState: OutputExtendedRenderState
): RendererOutputPayload => {
  const {
    spectrum,
    sdfScene: _ignoredSdfScene,
    debugTint: _ignoredDebugTint,
    ...rest
  } = renderState;

  return {
    ...rest,
    spectrum: spectrum.slice()
  };
};
