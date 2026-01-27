/**
 * 2D SDF Shapes Index
 *
 * Exports all 2D shape definitions for registration.
 */

export * from './primitives';
export * from './advanced';

import { shapes2dPrimitives } from './primitives';
import { shapes2dAdvanced } from './advanced';
import type { SdfNodeDefinition } from '../../api';

export const allShapes2D: SdfNodeDefinition[] = [
  ...shapes2dPrimitives,
  ...shapes2dAdvanced
];
