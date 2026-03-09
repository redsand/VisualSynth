import type { RenderState } from '../glRenderer';

type ExcludedOutputField = 'sdfScene' | 'debugTint';

export type RendererOutputPayload = Omit<RenderState, ExcludedOutputField>;

export const buildRendererOutputPayload = (
  renderState: RenderState
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
