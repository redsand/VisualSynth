/**
 * Scene Templates
 *
 * Pre-configured scene setups for multi-scene presets.
 * Each template defines layer roles, modulation targets, and transition behaviors.
 */

import type { SceneConfig, SceneIntent, SceneLayerRoles, LayerConfig, LayerRole, ModConnection } from './project';

export type SceneTemplateCategory = 
  | 'ambient-to-drop'
  | 'calm-to-chaos'
  | 'build-to-climax'
  | 'breakdown-to-riser'
  | 'day-to-night'
  | 'minimal-to-full';

export interface SceneTemplate {
  id: string;
  name: string;
  category: SceneTemplateCategory;
  description: string;
  intent: SceneIntent;
  suggestedTransition: {
    durationMs: number;
    curve: 'linear' | 'easeInOut';
  };
  layerRoles: {
    core: Omit<LayerConfig, 'id'>[];
    support: Omit<LayerConfig, 'id'>[];
    atmosphere: Omit<LayerConfig, 'id'>[];
  };
  defaultSdf: {
    enabled: boolean;
    shape: 'circle' | 'box' | 'triangle' | 'hexagon' | 'star' | 'ring';
    scale: number;
    edge: number;
    glow: number;
    rotation: number;
    fill: number;
  };
  suggestedModulations: Omit<ModConnection, 'id'>[];
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'ambient-base',
    name: 'Ambient Base',
    category: 'ambient-to-drop',
    description: 'Starting ambient scene with subtle core layers, ready for a drop transition',
    intent: 'ambient',
    suggestedTransition: { durationMs: 800, curve: 'easeInOut' },
    layerRoles: {
      core: [{
        name: 'Core Shader',
        role: 'core',
        enabled: true,
        opacity: 1,
        blendMode: 'normal',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }],
      support: [{
        name: 'Subtle Support',
        role: 'support',
        enabled: true,
        opacity: 0.6,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }],
      atmosphere: [{
        name: 'Background Atmosphere',
        role: 'atmosphere',
        enabled: true,
        opacity: 0.4,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }]
    },
    defaultSdf: {
      enabled: false,
      shape: 'circle',
      scale: 0.5,
      edge: 0.05,
      glow: 0.1,
      rotation: 0,
      fill: 0
    },
    suggestedModulations: [
      { source: 'audio.rms', target: 'core.opacity', amount: 0.2, curve: 'linear', smoothing: 0.3, bipolar: false, min: 0.5, max: 1, enabled: true }
    ]
  },
  {
    id: 'drop-scene',
    name: 'Drop Impact',
    category: 'ambient-to-drop',
    description: 'High-impact drop scene with aggressive layers',
    intent: 'chaos',
    suggestedTransition: { durationMs: 200, curve: 'linear' },
    layerRoles: {
      core: [{
        name: 'Drop Core',
        role: 'core',
        enabled: true,
        opacity: 1,
        blendMode: 'normal',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }],
      support: [{
        name: 'Impact Support',
        role: 'support',
        enabled: true,
        opacity: 1,
        blendMode: 'add',
        transform: { x: 0, y: 0, scale: 1.1, rotation: 0 }
      }],
      atmosphere: [{
        name: 'Energy Atmosphere',
        role: 'atmosphere',
        enabled: true,
        opacity: 0.9,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }]
    },
    defaultSdf: {
      enabled: true,
      shape: 'box',
      scale: 0.6,
      edge: 0.1,
      glow: 0.3,
      rotation: 0.2,
      fill: 0.5
    },
    suggestedModulations: [
      { source: 'audio.peak', target: 'core.opacity', amount: 0.4, curve: 'log', smoothing: 0.1, bipolar: false, min: 0.7, max: 1, enabled: true },
      { source: 'audio.rms', target: 'support.opacity', amount: 0.3, curve: 'linear', smoothing: 0.2, bipolar: false, min: 0.5, max: 1, enabled: true }
    ]
  },
  {
    id: 'calm-scene',
    name: 'Calm Minimal',
    category: 'calm-to-chaos',
    description: 'Minimal calm scene for breakdowns',
    intent: 'calm',
    suggestedTransition: { durationMs: 1200, curve: 'easeInOut' },
    layerRoles: {
      core: [{
        name: 'Minimal Core',
        role: 'core',
        enabled: true,
        opacity: 0.7,
        blendMode: 'normal',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }],
      support: [],
      atmosphere: [{
        name: 'Soft Atmosphere',
        role: 'atmosphere',
        enabled: true,
        opacity: 0.3,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }]
    },
    defaultSdf: {
      enabled: true,
      shape: 'circle',
      scale: 0.4,
      edge: 0.03,
      glow: 0.15,
      rotation: 0,
      fill: 0.2
    },
    suggestedModulations: []
  },
  {
    id: 'chaos-scene',
    name: 'Chaos Mode',
    category: 'calm-to-chaos',
    description: 'Full chaos scene with maximum visual impact',
    intent: 'chaos',
    suggestedTransition: { durationMs: 400, curve: 'linear' },
    layerRoles: {
      core: [{
        name: 'Chaos Core',
        role: 'core',
        enabled: true,
        opacity: 1,
        blendMode: 'normal',
        transform: { x: 0, y: 0, scale: 1.1, rotation: 0 }
      }],
      support: [{
        name: 'Chaos Support A',
        role: 'support',
        enabled: true,
        opacity: 0.9,
        blendMode: 'add',
        transform: { x: 0, y: 0, scale: 1, rotation: 0.1 }
      }, {
        name: 'Chaos Support B',
        role: 'support',
        enabled: true,
        opacity: 0.8,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 0.9, rotation: -0.1 }
      }],
      atmosphere: [{
        name: 'Chaos Overlay',
        role: 'atmosphere',
        enabled: true,
        opacity: 0.7,
        blendMode: 'overlay',
        transform: { x: 0, y: 0, scale: 1.2, rotation: 0 }
      }]
    },
    defaultSdf: {
      enabled: true,
      shape: 'star',
      scale: 0.7,
      edge: 0.15,
      glow: 0.4,
      rotation: 0,
      fill: 0.6
    },
    suggestedModulations: [
      { source: 'audio.rms', target: 'core.transform.scale', amount: 0.2, curve: 'linear', smoothing: 0.1, bipolar: false, min: 0.9, max: 1.3, enabled: true }
    ]
  },
  {
    id: 'build-scene',
    name: 'Building Tension',
    category: 'build-to-climax',
    description: 'Progressive build scene that increases intensity',
    intent: 'build',
    suggestedTransition: { durationMs: 600, curve: 'linear' },
    layerRoles: {
      core: [{
        name: 'Build Core',
        role: 'core',
        enabled: true,
        opacity: 0.8,
        blendMode: 'normal',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }],
      support: [{
        name: 'Rising Support',
        role: 'support',
        enabled: true,
        opacity: 0.5,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }],
      atmosphere: []
    },
    defaultSdf: {
      enabled: false,
      shape: 'triangle',
      scale: 0.5,
      edge: 0.08,
      glow: 0.2,
      rotation: 0,
      fill: 0.4
    },
    suggestedModulations: [
      { source: 'lfo-1.rate', target: 'core.opacity', amount: 0.3, curve: 'linear', smoothing: 0.5, bipolar: true, min: 0.5, max: 1, enabled: true }
    ]
  },
  {
    id: 'climax-scene',
    name: 'Climax Peak',
    category: 'build-to-climax',
    description: 'Peak intensity scene with all layers active',
    intent: 'pulse',
    suggestedTransition: { durationMs: 300, curve: 'easeInOut' },
    layerRoles: {
      core: [{
        name: 'Peak Core',
        role: 'core',
        enabled: true,
        opacity: 1,
        blendMode: 'normal',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }],
      support: [{
        name: 'Peak Support',
        role: 'support',
        enabled: true,
        opacity: 1,
        blendMode: 'add',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }],
      atmosphere: [{
        name: 'Peak Atmosphere',
        role: 'atmosphere',
        enabled: true,
        opacity: 0.8,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      }]
    },
    defaultSdf: {
      enabled: true,
      shape: 'hexagon',
      scale: 0.55,
      edge: 0.12,
      glow: 0.35,
      rotation: 0,
      fill: 0.5
    },
    suggestedModulations: [
      { source: 'audio.peak', target: 'core.opacity', amount: 0.5, curve: 'exp', smoothing: 0.05, bipolar: false, min: 0.6, max: 1, enabled: true },
      { source: 'audio.rms', target: 'effects.bloom', amount: 0.4, curve: 'linear', smoothing: 0.2, bipolar: false, min: 0.2, max: 0.8, enabled: true }
    ]
  }
];

export interface ScenePairTemplate {
  id: string;
  name: string;
  description: string;
  sceneA: SceneTemplate;
  sceneB: SceneTemplate;
  transitionStyle: 'instant' | 'fade' | 'crossfade' | 'aggressive';
  recommendedTriggers: {
    audioThreshold?: number;
    timeBased?: number;
    manual?: boolean;
  };
}

export const SCENE_PAIR_TEMPLATES: ScenePairTemplate[] = [
  {
    id: 'ambient-drop',
    name: 'Ambient to Drop',
    description: 'Classic EDM structure: ambient breakdown transitioning to high-energy drop',
    sceneA: SCENE_TEMPLATES.find(t => t.id === 'ambient-base')!,
    sceneB: SCENE_TEMPLATES.find(t => t.id === 'drop-scene')!,
    transitionStyle: 'aggressive',
    recommendedTriggers: {
      audioThreshold: 0.7,
      manual: true
    }
  },
  {
    id: 'calm-chaos',
    name: 'Calm to Chaos',
    description: 'Breakdown to full chaos transition',
    sceneA: SCENE_TEMPLATES.find(t => t.id === 'calm-scene')!,
    sceneB: SCENE_TEMPLATES.find(t => t.id === 'chaos-scene')!,
    transitionStyle: 'crossfade',
    recommendedTriggers: {
      audioThreshold: 0.65,
      manual: true
    }
  },
  {
    id: 'build-climax',
    name: 'Build to Climax',
    description: 'Progressive build reaching a climax',
    sceneA: SCENE_TEMPLATES.find(t => t.id === 'build-scene')!,
    sceneB: SCENE_TEMPLATES.find(t => t.id === 'climax-scene')!,
    transitionStyle: 'fade',
    recommendedTriggers: {
      timeBased: 8000,
      manual: true
    }
  }
];

let sceneCounter = 1;
let layerCounter = 1;

export const generateSceneId = (): string => {
  sceneCounter += 1;
  return `scene-${sceneCounter}`;
};

export const generateLayerId = (): string => {
  layerCounter += 1;
  return `layer-${layerCounter}`;
};

export const createSceneFromTemplate = (
  template: SceneTemplate,
  overrides?: Partial<SceneConfig>
): SceneConfig => {
  const sceneId = generateSceneId();
  const layers: LayerConfig[] = [];
  const assignedLayers: SceneLayerRoles = { core: [], support: [], atmosphere: [] };

  template.layerRoles.core.forEach((layerTemplate, index) => {
    const layerId = generateLayerId();
    layers.push({
      ...layerTemplate,
      id: layerId,
      name: layerTemplate.name || `Core ${index + 1}`
    } as LayerConfig);
    assignedLayers.core.push(layerId);
  });

  template.layerRoles.support.forEach((layerTemplate, index) => {
    const layerId = generateLayerId();
    layers.push({
      ...layerTemplate,
      id: layerId,
      name: layerTemplate.name || `Support ${index + 1}`
    } as LayerConfig);
    assignedLayers.support.push(layerId);
  });

  template.layerRoles.atmosphere.forEach((layerTemplate, index) => {
    const layerId = generateLayerId();
    layers.push({
      ...layerTemplate,
      id: layerId,
      name: layerTemplate.name || `Atmosphere ${index + 1}`
    } as LayerConfig);
    assignedLayers.atmosphere.push(layerId);
  });

  return {
    id: sceneId,
    scene_id: sceneId,
    name: template.name,
    intent: template.intent,
    duration: 0,
    transition_in: template.suggestedTransition,
    transition_out: template.suggestedTransition,
    trigger: { type: 'manual' },
    assigned_layers: assignedLayers,
    layers,
    ...overrides
  };
};

export const createScenePairFromTemplate = (
  pairTemplate: ScenePairTemplate,
  overrides?: { sceneA?: Partial<SceneConfig>; sceneB?: Partial<SceneConfig> }
): { sceneA: SceneConfig; sceneB: SceneConfig; modulations: ModConnection[] } => {
  const sceneA = createSceneFromTemplate(pairTemplate.sceneA, overrides?.sceneA);
  const sceneB = createSceneFromTemplate(pairTemplate.sceneB, overrides?.sceneB);
  
  const modulations: ModConnection[] = [
    ...pairTemplate.sceneA.suggestedModulations.map((mod, index) => ({
      ...mod,
      id: `mod-${index}`
    })),
    ...pairTemplate.sceneB.suggestedModulations.map((mod, index) => ({
      ...mod,
      id: `mod-${pairTemplate.sceneA.suggestedModulations.length + index}`
    }))
  ].map(m => ({ ...m, id: m.id || `mod-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` })) as ModConnection[];

  return { sceneA, sceneB, modulations };
};

export const getTemplateById = (id: string): SceneTemplate | undefined => {
  return SCENE_TEMPLATES.find(t => t.id === id);
};

export const getTemplatesByCategory = (category: SceneTemplateCategory): SceneTemplate[] => {
  return SCENE_TEMPLATES.filter(t => t.category === category);
};

export const getScenePairTemplateById = (id: string): ScenePairTemplate | undefined => {
  return SCENE_PAIR_TEMPLATES.find(t => t.id === id);
};