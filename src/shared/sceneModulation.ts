/**
 * Scene Modulation Integration
 *
 * Provides modulation targets for scene switching, blending, and layer control.
 * Integrates with the ModMatrix for performance-driven scene transitions.
 */

import type { ModConnection } from './project';

export type SceneModulationTarget =
  | 'scene.next'
  | 'scene.prev'
  | 'scene.mix'
  | 'scene.transition.duration'
  | 'scene.intent.intensity';

export type SceneModulationSource =
  | 'audio.peak'
  | 'audio.rms'
  | 'audio.frequency.low'
  | 'audio.frequency.mid'
  | 'audio.frequency.high'
  | 'midi.cc'
  | 'lfo.rate'
  | 'macro.value';

export interface SceneModulationRule {
  source: SceneModulationSource;
  target: SceneModulationTarget;
  threshold?: number;
  enabled: boolean;
}

export interface SceneTransitionConfig {
  fromSceneId: string;
  toSceneId: string;
  durationMs: number;
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  trigger: 'manual' | 'audio' | 'time' | 'midi';
  audioThreshold?: number;
  timeMs?: number;
  midiNote?: number;
  midiChannel?: number;
}

export const SCENE_MODULATION_TARGETS: Record<SceneModulationTarget, {
  label: string;
  description: string;
  min: number;
  max: number;
  defaultAmount: number;
}> = {
  'scene.next': {
    label: 'Next Scene Trigger',
    description: 'Trigger transition to next scene when source exceeds threshold',
    min: 0,
    max: 1,
    defaultAmount: 0.7
  },
  'scene.prev': {
    label: 'Previous Scene Trigger',
    description: 'Trigger transition to previous scene when source exceeds threshold',
    min: 0,
    max: 1,
    defaultAmount: 0.7
  },
  'scene.mix': {
    label: 'Scene Blend',
    description: 'Crossfade between scenes based on modulation value (0=scene A, 1=scene B)',
    min: 0,
    max: 1,
    defaultAmount: 0.5
  },
  'scene.transition.duration': {
    label: 'Transition Duration',
    description: 'Modulate transition speed (0=fast, 1=slow)',
    min: 100,
    max: 3000,
    defaultAmount: 0.5
  },
  'scene.intent.intensity': {
    label: 'Scene Intent Intensity',
    description: 'Drive the intensity of scene intent-based modulations',
    min: 0,
    max: 1,
    defaultAmount: 0.5
  }
};

export const DEFAULT_SCENE_MODULATIONS: ModConnection[] = [
  {
    id: 'scene-audio-trigger',
    source: 'audio.peak',
    target: 'scene.next',
    amount: 0.75,
    curve: 'linear',
    smoothing: 0.2,
    bipolar: false,
    min: 0,
    max: 1,
    enabled: false
  },
  {
    id: 'scene-lfo-crossfade',
    source: 'lfo-1.rate',
    target: 'scene.mix',
    amount: 0.5,
    curve: 'linear',
    smoothing: 0,
    bipolar: true,
    min: 0,
    max: 1,
    enabled: false
  }
];

export interface SceneLayerBinding {
  sceneId: string;
  layerId: string;
  modulationTarget: string;
  activeInScene: boolean;
}

export const createSceneLayerModulation = (
  source: string,
  layerId: string,
  param: 'opacity' | 'transform.scale' | 'transform.rotation' | 'blendMode',
  options?: Partial<ModConnection>
): ModConnection => {
  return {
    id: `mod-${layerId}-${param}-${Date.now()}`,
    source,
    target: `layer-${layerId}.${param}`,
    amount: options?.amount ?? 0.5,
    curve: options?.curve ?? 'linear',
    smoothing: options?.smoothing ?? 0.3,
    bipolar: options?.bipolar ?? false,
    min: options?.min ?? 0,
    max: options?.max ?? 1,
    enabled: options?.enabled ?? true
  };
};

export const createSceneSwitchModulation = (
  source: SceneModulationSource,
  target: SceneModulationTarget,
  options?: Partial<ModConnection>
): ModConnection => {
  const targetConfig = SCENE_MODULATION_TARGETS[target];
  return {
    id: `mod-scene-switch-${Date.now()}`,
    source,
    target,
    amount: options?.amount ?? targetConfig.defaultAmount,
    curve: options?.curve ?? 'linear',
    smoothing: options?.smoothing ?? 0.2,
    bipolar: options?.bipolar ?? false,
    min: options?.min ?? targetConfig.min,
    max: options?.max ?? targetConfig.max,
    enabled: options?.enabled ?? false
  };
};

export const getSceneModulationsForProject = (
  sceneCount: number
): ModConnection[] => {
  const modulations: ModConnection[] = [];
  
  if (sceneCount >= 2) {
    modulations.push(
      createSceneSwitchModulation('audio.peak', 'scene.next', {
        amount: 0.7,
        enabled: false
      })
    );
    
    modulations.push(
      createSceneSwitchModulation('audio.rms', 'scene.mix', {
        amount: 0.3,
        smoothing: 0.5,
        enabled: false
      })
    );
  }
  
  return modulations;
};

export interface ScenePerformanceTrigger {
  id: string;
  name: string;
  sceneId: string;
  triggerType: 'audio.peak' | 'audio.rms' | 'midi' | 'macro' | 'keyboard';
  threshold: number;
  enabled: boolean;
  oneShot: boolean;
}

export const DEFAULT_PERFORMANCE_TRIGGERS: ScenePerformanceTrigger[] = [
  {
    id: 'trigger-1',
    name: 'Drop Trigger',
    sceneId: '',
    triggerType: 'audio.peak',
    threshold: 0.75,
    enabled: false,
    oneShot: true
  },
  {
    id: 'trigger-2',
    name: 'Build Trigger',
    sceneId: '',
    triggerType: 'midi',
    threshold: 0.5,
    enabled: false,
    oneShot: false
  }
];

export const createPerformanceTrigger = (
  name: string,
  sceneId: string,
  triggerType: ScenePerformanceTrigger['triggerType'],
  options?: Partial<ScenePerformanceTrigger>
): ScenePerformanceTrigger => {
  return {
    id: `trigger-${Date.now()}`,
    name,
    sceneId,
    triggerType,
    threshold: options?.threshold ?? 0.7,
    enabled: options?.enabled ?? true,
    oneShot: options?.oneShot ?? false
  };
};