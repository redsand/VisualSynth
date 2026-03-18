/**
 * Auto-sync utility for output renderer state synchronization.
 * 
 * Provides a type-safe, maintainable way to sync RenderState fields
 * from the preview renderer to the output renderer via BroadcastChannel.
 * Handles Float32Arrays, plain objects, and primitive values.
 */

import type { RenderState } from '../renderState';

const ARRAY_FIELDS = new Set<keyof RenderState>([
  'spectrum',
  'portalPositions',
  'portalRadii',
  'portalActives',
  'mediaBurstPositions',
  'mediaBurstRadii',
  'mediaBurstTypes',
  'mediaBurstActives',
  'oscilloData',
  'modulatorValues',
  'midiData',
  'trailSpectrum',
  'gravityPositions',
  'gravityStrengths',
  'gravityPolarities',
  'gravityActives',
  'shapeBurstSpawnTimes',
  'shapeBurstActives'
]);

const SPECIAL_OBJECT_FIELDS = new Set<keyof RenderState>([
  'roleWeights',
  'genUniforms',
  'sdfColor'
]);

const IGNORED_FIELDS = new Set<keyof RenderState>([
  'sdfScene',
  'debugTint',
  'debugColorStage',
  'milkDropShaderData'
]);

export const syncRenderState = (
  source: Partial<RenderState>,
  target: RenderState
): void => {
  for (const key in source) {
    if (IGNORED_FIELDS.has(key as keyof RenderState)) {
      continue;
    }

    const value = source[key as keyof RenderState];
    if (value === undefined) {
      continue;
    }

    if (ARRAY_FIELDS.has(key as keyof RenderState)) {
      (target as any)[key] = new Float32Array(value as any);
    } else if (SPECIAL_OBJECT_FIELDS.has(key as keyof RenderState)) {
      if (key === 'genUniforms') {
        target.genUniforms = { ...(value as Record<string, number>) };
      } else if (key === 'roleWeights') {
        target.roleWeights = {
          core: (value as any).core ?? target.roleWeights.core,
          support: (value as any).support ?? target.roleWeights.support,
          atmosphere: (value as any).atmosphere ?? target.roleWeights.atmosphere
        };
      } else if (key === 'sdfColor') {
        target.sdfColor = value as [number, number, number];
      }
    } else {
      (target as any)[key] = value;
    }
  }
};
