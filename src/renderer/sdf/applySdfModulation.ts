import { applyModMatrix, ModMatrixContext } from '../../shared/modMatrix';
import { sdfRegistry } from './nodes';

/**
 * Clone an SDF scene and apply the project modMatrix to each node's
 * parameters, returning the modulated clone (the original scene is untouched).
 *
 * Per-node params are addressed as `${instanceId}.${paramId}`; vector params
 * modulate per-component as `${instanceId}.${paramId}.x/y/z/w`. Each param's
 * true min/max is resolved from the SDF registry so connections still carrying
 * the schema-default [0,1] clamp substitute the real range (mirroring the
 * fallback-range behavior of the rest of the modMatrix).
 *
 * This is shared by BOTH render paths so they modulate SDF node params
 * identically: the bootstrap `RenderGraph.getModdedSdfScene` (which then also
 * injects beat-triggered burst nodes) and the live `index.ts` path. Previously
 * only the bootstrap path modulated SDF node params — the live path passed the
 * layer's `sdfScene` through raw, so a modMatrix connection targeting e.g.
 * `nodeId.radius` silently did nothing on the default render path.
 *
 * The temporal low-pass `ctx` is passed through to every `applyModMatrix` call
 * so a connection's `smoothing` behaves the same here as on style/effects/param
 * targets.
 */
export const modulateSdfScene = (
  scene: any,
  modSources: Record<string, number>,
  modMatrix: any[],
  ctx: ModMatrixContext
): any => {
  if (!scene) return undefined;

  // Deep clone so the project's scene is never mutated by modulation.
  const cloned = JSON.parse(JSON.stringify(scene));

  if (!cloned.nodes) return cloned;

  cloned.nodes.forEach((node: any) => {
    if (!node.params) return;

    const nodeDef = sdfRegistry.get(node.nodeId);
    const paramRange = (pid: string): { min: number; max: number } | undefined => {
      const p = nodeDef?.parameters.find((sp) => sp.id === pid);
      if (!p || p.min == null || p.max == null) return undefined;
      return { min: p.min, max: p.max };
    };

    Object.keys(node.params).forEach((paramId) => {
      const targetId = `${node.instanceId}.${paramId}`;
      const baseValue = node.params[paramId];
      const fallback = paramRange(paramId);

      if (typeof baseValue === 'number') {
        node.params[paramId] = applyModMatrix(baseValue, targetId, modSources, modMatrix, fallback, ctx);
      } else if (Array.isArray(baseValue)) {
        // Modulate vector params per component: nodeId.paramId.x/y/z/w
        const components = ['x', 'y', 'z', 'w'];
        const modded = [...baseValue];
        for (let i = 0; i < Math.min(baseValue.length, 4); i++) {
          const subTargetId = `${targetId}.${components[i]}`;
          modded[i] = applyModMatrix(baseValue[i], subTargetId, modSources, modMatrix, fallback, ctx);
        }
        node.params[paramId] = modded;
      }
    });
  });

  return cloned;
};