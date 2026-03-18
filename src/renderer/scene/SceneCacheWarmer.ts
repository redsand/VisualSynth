import type { VisualSynthProject } from '../../shared/project';
import type { ShaderCompiler } from '../shaderLifecycle';
import { collectSceneGeneratorIds } from '../../shared/shaderUtils';

export class SceneCacheWarmer {
  private requestHandle: number | null = null;
  private project: VisualSynthProject | null = null;
  private renderer: ShaderCompiler;

  constructor(renderer: ShaderCompiler) {
    this.renderer = renderer;
    this.warmCache = this.warmCache.bind(this);
  }

  public notifyProjectChanged(project: VisualSynthProject) {
    this.project = project;
    if (this.requestHandle === null && 'requestIdleCallback' in globalThis) {
      this.requestHandle = (globalThis as any).requestIdleCallback(this.warmCache);
    }
  }

  private warmCache() {
    this.requestHandle = null;
    if (!this.project) return;

    // Identify all unique permutations of generators across all scenes
    const scenesToCheck = [...this.project.scenes];

    // If SDF is enabled globally, we must add it to the active sets
    const hasSdf = this.project.sdf?.enabled ?? false;

    for (const scene of scenesToCheck) {
      const activeIds = collectSceneGeneratorIds(scene);
      if (hasSdf) activeIds.add('gen-sdf');

      // The renderer handles caching internally. We can just call precompileVariant
      // If it's already cached, it's an immediate no-op return.
      // If it's not, it will kick off an async compile (if supported) and add to its internal queue.
      this.renderer.precompileVariant(activeIds);
    }
  }
}
