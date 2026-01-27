/**
 * 3D SDF Shapes Index
 *
 * Exports all 3D shape definitions for registration.
 */

export * from './primitives';
export * from './advanced';

import { shapes3dPrimitives } from './primitives';
import { shapes3dAdvanced } from './advanced';
import type { SdfNodeDefinition } from '../../api';

export const allShapes3D: SdfNodeDefinition[] = [
  ...shapes3dPrimitives,
  ...shapes3dAdvanced
];
