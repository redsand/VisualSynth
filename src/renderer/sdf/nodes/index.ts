/**
 * SDF Nodes Index
 *
 * Exports all SDF node definitions and provides registration utilities.
 */

export * from './shapes2d';
export * from './shapes3d';
export * from './ops';
export * from './domain';
export * from './fields';
export * from './utils/glslUtils';

import { allShapes2D } from './shapes2d';
import { allShapes3D } from './shapes3d';
import { allOperations } from './ops';
import { allDomainTransforms } from './domain';
import { allFields } from './fields';
import type { SdfNodeDefinition } from '../api';
import { sdfRegistry, registerSdfNodes as registerInternalNodes } from '../registry';

export { sdfRegistry };

/**
 * All built-in SDF node definitions
 */
export const allSdfNodes: SdfNodeDefinition[] = [
  ...allShapes2D,
  ...allShapes3D,
  ...allOperations,
  ...allDomainTransforms,
  ...allFields
];

/**
 * Register all built-in SDF nodes with the global registry
 */
export const registerSdfNodes = (): void => {
  registerInternalNodes(allSdfNodes);
};

/**
 * Get node counts by category for statistics
 */
export const getSdfNodeStats = () => ({
  shapes2d: allShapes2D.length,
  shapes3d: allShapes3D.length,
  operations: allOperations.length,
  domainTransforms: allDomainTransforms.length,
  fields: allFields.length,
  total: allSdfNodes.length
});
