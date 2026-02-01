import {
  DEFAULT_SCENE_TRANSITION,
  type EffectConfig,
  type MacroConfig,
  type ParticleConfig,
  type SceneConfig,
  type SceneTransition,
  type SdfConfig,
  type VisualSynthProject,
  type VisualizerConfig
} from '../../shared/project';
import { cloneLayerConfig } from '../../shared/layers';

export interface SceneSnapshot {
  scene: SceneConfig;
  effects: EffectConfig;
  particles: ParticleConfig;
  sdf: SdfConfig;
  visualizer: VisualizerConfig;
  styleSettings: { contrast: number; saturation: number; paletteShift: number };
  macros: MacroConfig[];
}

export interface SceneTransitionState {
  from: SceneSnapshot;
  to: SceneSnapshot;
  startTimeMs: number;
  durationMs: number;
  curve: SceneTransition['curve'];
}

export interface SceneBlendSnapshot {
  scene: SceneConfig;
  effects: EffectConfig;
  particles: ParticleConfig;
  sdf: SdfConfig;
  visualizer: VisualizerConfig;
  styleSettings: { contrast: number; saturation: number; paletteShift: number };
  macros: MacroConfig[];
  mix: number;
  inTransition: boolean;
}

export const captureSceneSnapshot = (
  project: VisualSynthProject,
  sceneId: string
): SceneSnapshot | null => {
  const scene = project.scenes.find((item) => item.id === sceneId);
  if (!scene) return null;
  const activeStyle =
    project.stylePresets?.find((preset) => preset.id === project.activeStylePresetId) ?? null;
  const styleSettings = activeStyle?.settings ?? { contrast: 1, saturation: 1, paletteShift: 0 };
  const sceneClone: SceneConfig = {
    ...scene,
    assigned_layers: scene.assigned_layers
      ? {
          core: [...scene.assigned_layers.core],
          support: [...scene.assigned_layers.support],
          atmosphere: [...scene.assigned_layers.atmosphere]
        }
      : scene.assigned_layers,
    layers: scene.layers.map((layer) => cloneLayerConfig(layer)),
    look: scene.look ? JSON.parse(JSON.stringify(scene.look)) : undefined
  };
  return {
    scene: sceneClone,
    effects: JSON.parse(JSON.stringify(project.effects)),
    particles: JSON.parse(JSON.stringify(project.particles)),
    sdf: JSON.parse(JSON.stringify(project.sdf)),
    visualizer: JSON.parse(JSON.stringify(project.visualizer)),
    styleSettings: { ...styleSettings },
    macros: project.macros.map((macro) => ({
      ...macro,
      targets: macro.targets.map((target) => ({ ...target }))
    }))
  };
};

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const easeInOut = (t: number) => t * t * (3 - 2 * t);

const blendNumber = (from: number | undefined, to: number | undefined, t: number) =>
  lerp(from ?? 0, to ?? 0, t);

const blendBoolean = (from: boolean | undefined, to: boolean | undefined, t: number) =>
  t < 0.5 ? Boolean(from) : Boolean(to);

const blendParams = (
  from: Record<string, any> | undefined,
  to: Record<string, any> | undefined,
  t: number
) => {
  if (!from && !to) return undefined;
  const entries = new Set<string>([
    ...Object.keys(from ?? {}),
    ...Object.keys(to ?? {})
  ]);
  const blended: Record<string, any> = {};
  entries.forEach((key) => {
    const fromVal = from?.[key];
    const toVal = to?.[key];
    if (typeof fromVal === 'number' && typeof toVal === 'number') {
      blended[key] = blendNumber(fromVal, toVal, t);
      return;
    }
    if (Array.isArray(fromVal) && Array.isArray(toVal)) {
      blended[key] = fromVal.map((value: number, index: number) =>
        blendNumber(value, toVal[index], t)
      );
      return;
    }
    blended[key] = t < 0.5 ? fromVal ?? toVal : toVal ?? fromVal;
  });
  return blended;
};

const blendLayerConfig = (
  fromLayer: SceneConfig['layers'][number] | undefined,
  toLayer: SceneConfig['layers'][number] | undefined,
  t: number
) => {
  if (!fromLayer && !toLayer) return null;
  const base = toLayer ? cloneLayerConfig(toLayer) : cloneLayerConfig(fromLayer!);
  const fromOpacity = fromLayer ? (fromLayer.enabled ? fromLayer.opacity : 0) : 0;
  const toOpacity = toLayer ? (toLayer.enabled ? toLayer.opacity : 0) : 0;
  const opacity = blendNumber(fromOpacity, toOpacity, t);
  base.opacity = opacity;
  base.enabled = opacity > 0.01;
  base.transform = {
    x: blendNumber(fromLayer?.transform?.x, toLayer?.transform?.x, t),
    y: blendNumber(fromLayer?.transform?.y, toLayer?.transform?.y, t),
    scale: blendNumber(fromLayer?.transform?.scale, toLayer?.transform?.scale, t),
    rotation: blendNumber(fromLayer?.transform?.rotation, toLayer?.transform?.rotation, t)
  };
  base.params = blendParams(fromLayer?.params, toLayer?.params, t);
  base.blendMode = (t < 0.5 ? fromLayer?.blendMode : toLayer?.blendMode) ?? base.blendMode;
  base.assetId = (t < 0.5 ? fromLayer?.assetId : toLayer?.assetId) ?? base.assetId;
  base.generatorId = (t < 0.5 ? fromLayer?.generatorId : toLayer?.generatorId) ?? base.generatorId;
  base.sdfScene = t < 0.5 ? fromLayer?.sdfScene : toLayer?.sdfScene;
  return base;
};

const blendLayers = (fromScene: SceneConfig, toScene: SceneConfig, t: number) => {
  const ids = new Set<string>([
    ...fromScene.layers.map((layer) => layer.id),
    ...toScene.layers.map((layer) => layer.id)
  ]);
  const blended: SceneConfig['layers'] = [];
  ids.forEach((id) => {
    const fromLayer = fromScene.layers.find((layer) => layer.id === id);
    const toLayer = toScene.layers.find((layer) => layer.id === id);
    const blendedLayer = blendLayerConfig(fromLayer, toLayer, t);
    if (blendedLayer) blended.push(blendedLayer);
  });
  return blended;
};

const blendEffects = (from: EffectConfig, to: EffectConfig, t: number): EffectConfig => {
  const fromEnabled = from.enabled;
  const toEnabled = to.enabled;
  return {
    enabled: fromEnabled || toEnabled,
    bloom: blendNumber(fromEnabled ? from.bloom : 0, toEnabled ? to.bloom : 0, t),
    blur: blendNumber(fromEnabled ? from.blur : 0, toEnabled ? to.blur : 0, t),
    chroma: blendNumber(fromEnabled ? from.chroma : 0, toEnabled ? to.chroma : 0, t),
    posterize: blendNumber(fromEnabled ? from.posterize : 0, toEnabled ? to.posterize : 0, t),
    kaleidoscope: blendNumber(fromEnabled ? from.kaleidoscope : 0, toEnabled ? to.kaleidoscope : 0, t),
    feedback: blendNumber(fromEnabled ? from.feedback : 0, toEnabled ? to.feedback : 0, t),
    persistence: blendNumber(fromEnabled ? from.persistence : 0, toEnabled ? to.persistence : 0, t)
  };
};

const blendParticles = (from: ParticleConfig, to: ParticleConfig, t: number): ParticleConfig => {
  const fromEnabled = from.enabled;
  const toEnabled = to.enabled;
  return {
    enabled: fromEnabled || toEnabled,
    density: blendNumber(fromEnabled ? from.density : 0, toEnabled ? to.density : 0, t),
    speed: blendNumber(fromEnabled ? from.speed : 0, toEnabled ? to.speed : 0, t),
    size: blendNumber(fromEnabled ? from.size : 0, toEnabled ? to.size : 0, t),
    glow: blendNumber(fromEnabled ? from.glow : 0, toEnabled ? to.glow : 0, t),
    turbulence: blendNumber(fromEnabled ? from.turbulence : 0, toEnabled ? to.turbulence : 0, t),
    audioLift: blendNumber(fromEnabled ? from.audioLift : 0, toEnabled ? to.audioLift : 0, t)
  };
};

const blendSdf = (from: SdfConfig, to: SdfConfig, t: number): SdfConfig => {
  const fromEnabled = from.enabled;
  const toEnabled = to.enabled;
  return {
    enabled: fromEnabled || toEnabled,
    shape: (t < 0.5 ? from.shape : to.shape),
    scale: blendNumber(fromEnabled ? from.scale : 0, toEnabled ? to.scale : 0, t),
    edge: blendNumber(fromEnabled ? from.edge : 0, toEnabled ? to.edge : 0, t),
    glow: blendNumber(fromEnabled ? from.glow : 0, toEnabled ? to.glow : 0, t),
    rotation: blendNumber(fromEnabled ? from.rotation : 0, toEnabled ? to.rotation : 0, t),
    fill: blendNumber(fromEnabled ? from.fill : 0, toEnabled ? to.fill : 0, t),
    color: (t < 0.5 ? from.color : to.color)
  };
};

const blendVisualizer = (
  from: VisualizerConfig,
  to: VisualizerConfig,
  t: number
): VisualizerConfig => ({
  enabled: from.enabled || to.enabled,
  mode: (t < 0.5 ? from.mode : to.mode),
  opacity: blendNumber(from.opacity, to.opacity, t),
  macroEnabled: blendBoolean(from.macroEnabled, to.macroEnabled, t),
  macroId: blendNumber(from.macroId, to.macroId, t)
});

const blendMacros = (from: MacroConfig[], to: MacroConfig[], t: number): MacroConfig[] => {
  const length = Math.max(from.length, to.length);
  const blended: MacroConfig[] = [];
  for (let i = 0; i < length; i += 1) {
    const fromMacro = from[i];
    const toMacro = to[i];
    const base = toMacro ?? fromMacro;
    if (!base) continue;
    blended.push({
      ...base,
      value: blendNumber(fromMacro?.value, toMacro?.value, t),
      targets: (t < 0.5 ? fromMacro?.targets : toMacro?.targets) ?? base.targets
    });
  }
  return blended;
};

export class SceneManager {
  private transition: SceneTransitionState | null = null;
  private activeSceneStartMs = 0;
  private lastAudioTriggerMs = -Infinity;

  constructor(private getProject: () => VisualSynthProject) {}

  markSceneActivated(timeMs: number) {
    this.activeSceneStartMs = timeMs;
  }

  clearTransition() {
    this.transition = null;
  }

  startTransition(
    from: SceneSnapshot,
    to: SceneSnapshot,
    startTimeMs: number,
    durationMs: number,
    curve: SceneTransition['curve']
  ) {
    if (durationMs <= 0) {
      this.transition = null;
      return;
    }
    this.transition = {
      from,
      to,
      startTimeMs,
      durationMs,
      curve
    };
  }

  getBlendSnapshot(timeMs: number): SceneBlendSnapshot | null {
    if (!this.transition) return null;
    const elapsed = timeMs - this.transition.startTimeMs;
    if (elapsed >= this.transition.durationMs) {
      this.transition = null;
      return null;
    }
    const raw = Math.min(Math.max(elapsed / this.transition.durationMs, 0), 1);
    const mix = this.transition.curve === 'easeInOut' ? easeInOut(raw) : raw;
    const blendedScene: SceneConfig = {
      ...this.transition.to.scene,
      layers: blendLayers(this.transition.from.scene, this.transition.to.scene, mix)
    };
    return {
      scene: blendedScene,
      effects: blendEffects(this.transition.from.effects, this.transition.to.effects, mix),
      particles: blendParticles(this.transition.from.particles, this.transition.to.particles, mix),
      sdf: blendSdf(this.transition.from.sdf, this.transition.to.sdf, mix),
      visualizer: blendVisualizer(this.transition.from.visualizer, this.transition.to.visualizer, mix),
      styleSettings: {
        contrast: blendNumber(
          this.transition.from.styleSettings.contrast,
          this.transition.to.styleSettings.contrast,
          mix
        ),
        saturation: blendNumber(
          this.transition.from.styleSettings.saturation,
          this.transition.to.styleSettings.saturation,
          mix
        ),
        paletteShift: blendNumber(
          this.transition.from.styleSettings.paletteShift,
          this.transition.to.styleSettings.paletteShift,
          mix
        )
      },
      macros: blendMacros(this.transition.from.macros, this.transition.to.macros, mix),
      mix,
      inTransition: true
    };
  }

  getActiveSceneProgress(transportMs: number) {
    const project = this.getProject();
    const scene = project.scenes.find((item) => item.id === project.activeSceneId);
    if (!scene) return null;
    const duration = Math.max(0, scene.duration ?? 0);
    if (!duration) return null;
    const elapsed = Math.max(0, transportMs - this.activeSceneStartMs);
    return {
      progress: Math.min(1, elapsed / duration),
      remainingMs: Math.max(0, duration - elapsed)
    };
  }

  updateAutoSwitch(transportMs: number, audio: { rms: number; peak: number }) {
    if (this.transition) return null;
    const project = this.getProject();
    const activeScene = project.scenes.find((item) => item.id === project.activeSceneId);
    if (!activeScene) return null;
    const trigger =
      activeScene.trigger?.type ??
      ((activeScene.duration ?? 0) > 0 ? 'time' : 'manual');
    if (trigger === 'manual') return null;
    if (project.scenes.length < 2) return null;
    const activeIndex = project.scenes.findIndex((scene) => scene.id === activeScene.id);
    const nextIndex = (activeIndex + 1) % project.scenes.length;
    const nextScene = project.scenes[nextIndex];
    if (!nextScene) return null;

    if (trigger === 'time') {
      const duration = Math.max(0, activeScene.duration ?? 0);
      if (!duration) return null;
      if (transportMs - this.activeSceneStartMs >= duration) {
        return nextScene.id;
      }
      return null;
    }

    const threshold = activeScene.trigger?.threshold ?? 0.7;
    const minIntervalMs = activeScene.trigger?.minIntervalMs ?? 1200;
    if (audio.peak >= threshold && transportMs - this.lastAudioTriggerMs >= minIntervalMs) {
      this.lastAudioTriggerMs = transportMs;
      return nextScene.id;
    }
    return null;
  }

  static resolveTransitionDuration(fromScene: SceneConfig | null, toScene: SceneConfig | null) {
    const fromDuration = fromScene?.transition_out?.durationMs ?? DEFAULT_SCENE_TRANSITION.durationMs;
    const toDuration = toScene?.transition_in?.durationMs ?? DEFAULT_SCENE_TRANSITION.durationMs;
    const durationMs = Math.max(fromDuration, toDuration);
    const curve =
      toScene?.transition_in?.curve ??
      fromScene?.transition_out?.curve ??
      DEFAULT_SCENE_TRANSITION.curve;
    return { durationMs, curve };
  }
}
