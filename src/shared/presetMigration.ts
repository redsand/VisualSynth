/**
 * Preset Migration Layer
 *
 * Handles migration of presets between different versions of the application.
 * This ensures backward compatibility and allows presets to evolve with the application.
 */

import { z } from 'zod';
import { PARAMETER_REGISTRY, getLayerType, getParamDef, parseLegacyTarget, buildLegacyTarget } from './parameterRegistry';
import { DEFAULT_PROJECT, DEFAULT_SCENE_TRANSITION, SceneConfig, SceneTransition, VisualSynthProject } from './project';
import { projectSchema } from './projectSchema';
import { ENGINE_REGISTRY, EngineId } from './engines';

export const APP_VERSION = '0.9.0';

export interface PresetCompatibility {
  /** Minimum app version this preset works with */
  minVersion: string;
  /** Maximum app version this preset works with (if applicable) */
  maxVersion?: string;
}

export type PresetType = 'scene' | 'performance';

export interface PresetMetadata {
  version: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  compatibility?: PresetCompatibility;
}

export interface PresetMetadataV4 extends PresetMetadata {
  version: 4;
  presetType: PresetType;
  intendedMusicStyle: string;
  visualIntentTags: string[];
  defaultTransition: SceneTransition;
}

export interface PresetMetadataV5 extends PresetMetadata {
  version: 5;
  activeModeId: string;
  intendedMusicStyle: string;
  visualIntentTags: string[];
  colorChemistry: string[];
  defaultTransition: SceneTransition;
}

export interface PresetMetadataV6 extends PresetMetadata {
  version: 6;
  activeEngineId: string;
  activeModeId: string;
  intendedMusicStyle: string;
  visualIntentTags: string[];
  colorChemistry: string[];
  defaultTransition: SceneTransition;
}

/**
 * Version 1 preset schema (legacy format with hardcoded layer IDs)
 */
const presetV1LayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  opacity: z.number(),
  blendMode: z.string(),
  transform: z.object({
    x: z.number(),
    y: z.number(),
    scale: z.number(),
    rotation: z.number()
  })
});

const presetV1Schema = z.object({
  version: z.literal(1),
  name: z.string(),
  scenes: z.array(z.object({
    id: z.string(),
    name: z.string(),
    layers: z.array(presetV1LayerSchema)
  })),
  modMatrix: z.array(z.any()),
  midiMappings: z.array(z.any())
});

/**
 * Version 2 preset schema (current format)
 */
const presetV2Schema = z.object({
  version: z.literal(2),
  name: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  category: z.string().optional(),
  scenes: z.array(z.object({
    id: z.string(),
    name: z.string(),
    layers: z.array(z.any())
  })),
  modMatrix: z.array(z.any()),
  midiMappings: z.array(z.any()),
  macros: z.array(z.any()).optional()
});

/**
 * Version 3 preset schema (new format with type-based references)
 */
const presetV3LayerSchema = z.object({
  type: z.string(),
  params: z.record(z.any())
});

const presetV3ModulationTargetSchema = z.object({
  type: z.string(),
  param: z.string()
});

const presetV3ModulationSchema = z.object({
  source: z.string(),
  target: presetV3ModulationTargetSchema,
  amount: z.number(),
  min: z.number(),
  max: z.number(),
  curve: z.enum(['linear', 'exp', 'log']),
  smoothing: z.number(),
  bipolar: z.boolean()
});

export const presetV3Schema = z.object({
  version: z.literal(3),
  metadata: z.object({
    version: z.literal(3),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    category: z.string().optional(),
    compatibility: z.object({
      minVersion: z.string(),
      maxVersion: z.string().optional()
    }).optional()
  }),
  layers: z.array(presetV3LayerSchema),
  modulations: z.array(presetV3ModulationSchema),
  macros: z.array(z.any())
});

export const presetV4Schema = z.object({
  version: z.literal(4),
  metadata: z.object({
    version: z.literal(4),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    category: z.string().optional(),
    compatibility: z.object({
      minVersion: z.string(),
      maxVersion: z.string().optional()
    }).optional(),
    presetType: z.enum(['scene', 'performance']),
    intendedMusicStyle: z.string(),
    visualIntentTags: z.array(z.string()),
    defaultTransition: z.object({
      durationMs: z.number(),
      curve: z.enum(['linear', 'easeInOut'])
    })
  }),
  scenes: projectSchema.shape.scenes,
  activeSceneId: z.string().optional(),
  modulations: z.array(presetV3ModulationSchema).optional(),
  macros: z.array(z.any()).optional(),
  project: projectSchema.optional()
});

export const presetV5Schema = z.object({
  version: z.literal(5),
  metadata: z.object({
    version: z.literal(5),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    category: z.string().optional(),
    compatibility: z.object({
      minVersion: z.string(),
      maxVersion: z.string().optional()
    }).optional(),
    activeModeId: z.string(),
    intendedMusicStyle: z.string(),
    visualIntentTags: z.array(z.string()),
    colorChemistry: z.array(z.string()),
    defaultTransition: z.object({
      durationMs: z.number(),
      curve: z.enum(['linear', 'easeInOut'])
    })
  }),
  scenes: projectSchema.shape.scenes,
  activeSceneId: z.string().optional(),
  roleWeights: projectSchema.shape.roleWeights,
  tempoSync: projectSchema.shape.tempoSync,
  modulations: z.array(presetV3ModulationSchema).optional(),
  macros: z.array(z.any()).optional(),
  project: projectSchema.optional()
});

export const presetV6Schema = z.object({
  version: z.literal(6),
  metadata: z.object({
    version: z.literal(6),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    category: z.string().optional(),
    compatibility: z.object({
      minVersion: z.string(),
      maxVersion: z.string().optional()
    }).optional(),
    activeEngineId: z.string(),
    activeModeId: z.string(),
    intendedMusicStyle: z.string(),
    visualIntentTags: z.array(z.string()),
    colorChemistry: z.array(z.string()),
    defaultTransition: z.object({
      durationMs: z.number(),
      curve: z.enum(['linear', 'easeInOut'])
    })
  }),
  scenes: projectSchema.shape.scenes,
  activeSceneId: z.string().optional(),
  roleWeights: projectSchema.shape.roleWeights,
  tempoSync: projectSchema.shape.tempoSync,
  modulations: z.array(presetV3ModulationSchema).optional(),
  macros: z.array(z.any()).optional(),
  project: projectSchema.optional()
});

export type PresetV1 = z.infer<typeof presetV1Schema>;
export type PresetV2 = z.infer<typeof presetV2Schema>;
export type PresetV3 = z.infer<typeof presetV3Schema>;
export type PresetV4 = z.infer<typeof presetV4Schema>;
export type PresetV5 = z.infer<typeof presetV5Schema>;
export type PresetV6 = z.infer<typeof presetV6Schema>;

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  preset: any;
  warnings: string[];
  errors: string[];
}

/**
 * Compare two version strings
 * Returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
export const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
};

/**
 * Check if preset is compatible with current app version
 */
export const checkCompatibility = (preset: any): { compatible: boolean; reason?: string } => {
  // Version 1 and 2 presets are always compatible (no compatibility field)
  if (preset.version < 3) return { compatible: true };

  // Version 3+ presets have compatibility info
  if (preset.metadata?.compatibility) {
    const { minVersion, maxVersion } = preset.metadata.compatibility;

    if (minVersion && compareVersions(APP_VERSION, minVersion) < 0) {
      return {
        compatible: false,
        reason: `Preset requires app version ${minVersion} or higher (current: ${APP_VERSION})`
      };
    }

    if (maxVersion && compareVersions(APP_VERSION, maxVersion) > 0) {
      return {
        compatible: false,
        reason: `Preset requires app version ${maxVersion} or lower (current: ${APP_VERSION})`
      };
    }
  }

  return { compatible: true };
};

/**
 * Migrate a preset to the latest version
 */
export const migratePreset = (preset: any): MigrationResult => {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Check compatibility first
    const compatibility = checkCompatibility(preset);
    if (!compatibility.compatible) {
      errors.push(compatibility.reason!);
      return { success: false, preset, warnings, errors };
    }

    // Already at latest version
    if (preset.version === 6) {
      return { success: true, preset, warnings, errors };
    }

    let migratedPreset = preset;

    // Migrate from v1 to v2
    if (preset.version === 1) {
      const result = migrateV1ToV2(preset);
      migratedPreset = result.preset;
      warnings.push(...result.warnings);
      errors.push(...result.errors);
    }

    // Migrate from v2 to v3
    if (migratedPreset.version === 2) {
      const result = migrateV2ToV3(migratedPreset);
      migratedPreset = result.preset;
      warnings.push(...result.warnings);
      errors.push(...result.errors);
    }

    // Migrate from v3 to v4
    if (migratedPreset.version === 3) {
      const result = migrateV3ToV4(migratedPreset);
      migratedPreset = result.preset;
      warnings.push(...result.warnings);
      errors.push(...result.errors);
    }

    // Migrate from v4 to v5
    if (migratedPreset.version === 4) {
      const result = migrateV4ToV5(migratedPreset);
      migratedPreset = result.preset;
      warnings.push(...result.warnings);
      errors.push(...result.errors);
    }

    // Migrate from v5 to v6
    if (migratedPreset.version === 5) {
      const result = migrateV5ToV6(migratedPreset);
      migratedPreset = result.preset;
      warnings.push(...result.warnings);
      errors.push(...result.errors);
    }

    if (errors.length > 0) {
      return { success: false, preset: migratedPreset, warnings, errors };
    }

    return { success: true, preset: migratedPreset, warnings, errors };
  } catch (error) {
    errors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, preset, warnings, errors };
  }
};

/**
 * Migrate preset from version 1 to version 2
 */
const migrateV1ToV2 = (preset: PresetV1): { preset: any; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];

  const presetV2 = {
    ...preset,
    version: 2 as const,
    updatedAt: new Date().toISOString()
  };

  return { preset: presetV2, warnings, errors };
};

/**
 * Migrate preset from version 2 to version 3
 */
const migrateV2ToV3 = (preset: PresetV2): { preset: any; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];

  const layers: any[] = [];
  const modulations: any[] = [];

  // Get the first scene (presets usually have one)
  const scene = preset.scenes[0];
  if (!scene) {
    errors.push('Preset has no scenes');
    return { preset, warnings, errors };
  }

  // Convert layers to type-based format
  for (const layer of scene.layers) {
    const layerType = getLayerType(layer.id);
    if (!layerType) {
      warnings.push(`Unknown layer type: ${layer.id}, skipping layer`);
      continue;
    }

    const params: Record<string, any> = {
      opacity: layer.opacity,
      enabled: layer.enabled,
      blendMode: layer.blendMode,
      transform: layer.transform,
      ...(layer.params ?? {})
    };

    // Check if layer has params in the registry
    for (const paramDef of layerType.params) {
      if (!(paramDef.id in params)) {
        // Use default value if not set
        params[paramDef.id] = paramDef.default;
      } else {
        // Validate and clamp the value
        const value = params[paramDef.id];
        if (paramDef.type === 'number' && typeof value === 'number') {
          if (paramDef.min !== undefined && value < paramDef.min) {
            params[paramDef.id] = paramDef.min;
            warnings.push(`Clamped ${layer.id}.${paramDef.id} to minimum ${paramDef.min}`);
          }
          if (paramDef.max !== undefined && value > paramDef.max) {
            params[paramDef.id] = paramDef.max;
            warnings.push(`Clamped ${layer.id}.${paramDef.id} to maximum ${paramDef.max}`);
          }
        }
      }
    }

    layers.push({
      type: layerType.id,
      params
    });
  }

  // Convert modulations to type-based format
  for (const mod of preset.modMatrix || []) {
    const target = parseLegacyTarget(mod.target);
    if (!target) {
      warnings.push(`Invalid modulation target: ${mod.target}, skipping modulation`);
      continue;
    }

    // Verify the parameter exists for the layer type
    if (!getParamDef(target.layerType, target.param)) {
      warnings.push(`Parameter ${target.param} not found for layer type ${target.layerType}, skipping modulation`);
      continue;
    }

    modulations.push({
      source: mod.source,
      target,
      amount: mod.amount,
      min: mod.min,
      max: mod.max,
      curve: mod.curve || 'linear',
      smoothing: mod.smoothing || 0,
      bipolar: mod.bipolar || false
    });
  }

  const presetV3: any = {
    version: 3,
    metadata: {
      version: 3,
      name: preset.name,
      createdAt: preset.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: preset.category || 'Uncategorized',
      compatibility: {
        minVersion: '0.9.0',
        maxVersion: undefined
      }
    },
    layers,
    modulations,
    macros: preset.macros || []
  };

  // Convert macros if they use legacy target paths
  for (const macro of presetV3.macros) {
    if (macro.targets) {
      const migratedTargets = macro.targets
        .map((t: any) => {
          const target = parseLegacyTarget(t.target);
          if (!target) {
            warnings.push(`Invalid macro target: ${t.target}, skipping macro target`);
            return null;
          }
          return { ...t, target };
        })
        .filter((t: any) => t !== null);

      macro.targets = migratedTargets;
    }
  }

  return { preset: presetV3, warnings, errors };
};

/**
 * Migrate preset from version 3 to version 4 (scene/performance presets)
 */
const migrateV3ToV4 = (preset: PresetV3): { preset: any; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];

  const applied = applyPresetV3(preset, DEFAULT_PROJECT);
  if (!applied.project) {
    errors.push('Failed to apply v3 preset during migration.');
    return { preset, warnings, errors };
  }

  const scenes = applied.project.scenes.map((scene: SceneConfig) => ({
    ...scene,
    transition_in: scene.transition_in ?? { ...DEFAULT_SCENE_TRANSITION },
    transition_out: scene.transition_out ?? { ...DEFAULT_SCENE_TRANSITION }
  }));

  const presetV4: any = {
    version: 4,
    metadata: {
      version: 4,
      name: preset.metadata?.name ?? 'Untitled Preset',
      createdAt: preset.metadata?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: preset.metadata?.category ?? 'Uncategorized',
      compatibility: preset.metadata?.compatibility ?? { minVersion: APP_VERSION },
      presetType: 'scene',
      intendedMusicStyle: preset.metadata?.category ?? 'Any',
      visualIntentTags: [],
      defaultTransition: { ...DEFAULT_SCENE_TRANSITION }
    },
    scenes,
    activeSceneId: applied.project.activeSceneId ?? scenes[0]?.id,
    modulations: preset.modulations ?? [],
    macros: preset.macros ?? []
  };

  return { preset: presetV4, warnings, errors };
};

/**
 * Migrate preset from version 4 to version 5 (Performance focus)
 */
const migrateV4ToV5 = (preset: PresetV4): { preset: any; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];

  const presetV5: any = {
    version: 5,
    metadata: {
      ...preset.metadata,
      version: 5,
      activeModeId: 'mode-cosmic', // Default mode for migration
      colorChemistry: ['analog', 'balanced'],
      updatedAt: new Date().toISOString()
    },
    scenes: preset.scenes,
    activeSceneId: preset.activeSceneId,
    roleWeights: { core: 1, support: 1, atmosphere: 1 },
    tempoSync: { bpm: 120, source: 'manual' },
    modulations: preset.modulations ?? [],
    macros: preset.macros ?? [],
    project: preset.project
  };

  return { preset: presetV5, warnings, errors };
};

/**
 * Migrate preset from version 5 to version 6 (Engine scoped)
 */
const migrateV5ToV6 = (preset: PresetV5): { preset: any; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];

  const presetV6: any = {
    version: 6,
    metadata: {
      ...preset.metadata,
      version: 6,
      activeEngineId: 'engine-radial-core', // Default engine for legacy conversion
      updatedAt: new Date().toISOString()
    },
    scenes: preset.scenes,
    activeSceneId: preset.activeSceneId,
    roleWeights: preset.roleWeights || { core: 1, support: 1, atmosphere: 1 },
    tempoSync: preset.tempoSync || { bpm: 120, source: 'manual' },
    modulations: preset.modulations ?? [],
    macros: preset.macros ?? [],
    project: preset.project
  };

  return { preset: presetV6, warnings, errors };
};

/**
 * Validate a preset against the current parameter registry
 */
export const validatePreset = (preset: any): { valid: boolean; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check preset version
  if (preset.version < 3) {
    return { valid: true, warnings: ['Preset is in legacy format, migration recommended'], errors: [] };
  }

  if (preset.version === 4) {
    const parsed = presetV4Schema.safeParse(preset);
    if (!parsed.success) {
      errors.push(`Preset v4 schema invalid: ${JSON.stringify(parsed.error.format())}`);
      return { valid: false, warnings, errors };
    }
  }

  if (preset.version === 5) {
    const parsed = presetV5Schema.safeParse(preset);
    if (!parsed.success) {
      errors.push(`Preset v5 schema invalid: ${JSON.stringify(parsed.error.format())}`);
      return { valid: false, warnings, errors };
    }
  }

  if (preset.version === 6) {
    const parsed = presetV6Schema.safeParse(preset);
    if (!parsed.success) {
      errors.push(`Preset v6 schema invalid: ${JSON.stringify(parsed.error.format())}`);
      return { valid: false, warnings, errors };
    }
  }

  // Validate layers
  if (preset.layers) {
    for (const layer of preset.layers) {
      const layerType = getLayerType(layer.type);
      if (!layerType) {
        errors.push(`Unknown layer type: ${layer.type}`);
        continue;
      }

      // Validate parameters
      if (layer.params) {
        for (const [paramId, value] of Object.entries(layer.params)) {
          const param = getParamDef(layer.type, paramId);
          if (!param) {
            warnings.push(`Unknown parameter: ${layer.type}.${paramId}`);
            continue;
          }

          // Type validation
          if (param.type === 'number' && typeof value !== 'number') {
            errors.push(`Parameter ${layer.type}.${paramId} must be a number`);
          } else if (param.type === 'boolean' && typeof value !== 'boolean') {
            errors.push(`Parameter ${layer.type}.${paramId} must be a boolean`);
          } else if (param.type === 'number') {
            // Range validation
            if (param.min !== undefined && (value as number) < param.min) {
              warnings.push(`Parameter ${layer.type}.${paramId} below minimum (${param.min}), will be clamped`);
            }
            if (param.max !== undefined && (value as number) > param.max) {
              warnings.push(`Parameter ${layer.type}.${paramId} above maximum (${param.max}), will be clamped`);
            }
          }
        }
      }
    }
  }

  // Validate modulations
  if (preset.modulations) {
    for (const mod of preset.modulations) {
      if (!mod.target) {
        errors.push('Modulation missing target');
        continue;
      }

      const parsedTarget =
        typeof mod.target === 'string'
          ? parseLegacyTarget(mod.target)
          : mod.target;
      if (!parsedTarget) {
        errors.push(`Modulation has invalid target: ${JSON.stringify(mod.target)}`);
        continue;
      }
      const layerType = parsedTarget.type ?? parsedTarget.layerType;
      const param = parsedTarget.param;
      if (!layerTypeExists(layerType)) {
        errors.push(`Modulation target has unknown layer type: ${layerType}`);
        continue;
      }

      if (!paramExists(layerType, param)) {
        warnings.push(`Modulation target has unknown parameter: ${layerType}.${param}`);
      }
    }
  }

  // Validate macros
  if (preset.macros) {
    for (const macro of preset.macros) {
      if (!macro.targets) continue;

      for (const target of macro.targets) {
        const parsed = typeof target.target === 'string' ? parseLegacyTarget(target.target) : target.target;
        if (!parsed) {
          warnings.push(`Macro has invalid target: ${JSON.stringify(target.target)}`);
          continue;
        }

        const layerType = parsed.type || parsed.layerType;
        if (!layerTypeExists(layerType)) {
          errors.push(`Macro target has unknown layer type: ${layerType}`);
          continue;
        }

        if (!paramExists(layerType, parsed.param)) {
          warnings.push(`Macro target has unknown parameter: ${layerType}.${parsed.param}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
};

/**
 * Helper to check if layer type exists
 */
const layerTypeExists = (layerType: string): boolean => {
  return getLayerType(layerType) !== undefined;
};

/**
 * Helper to check if parameter exists
 */
const paramExists = (layerType: string, paramId: string): boolean => {
  return getParamDef(layerType, paramId) !== undefined;
};

/**
 * Apply a v3 preset to the current project format (v2)
 */
export const applyPresetV3 = (preset: any, currentProject: any): { project: any; warnings: string[] } => {
  const warnings: string[] = [];
  // Deep clone to avoid mutating the caller (DEFAULT_PROJECT or current project state).
  const project = JSON.parse(JSON.stringify(currentProject));

  // Get the active scene, or use the first scene from DEFAULT_PROJECT if none exists
  const defaultScene = DEFAULT_PROJECT.scenes[0];
  let scene = project.scenes.find((s: any) => s.id === project.activeSceneId);

  // If no active scene or it doesn't exist, create it from DEFAULT_PROJECT
  if (!scene) {
    scene = { ...defaultScene, id: defaultScene.id };
    if (!project.scenes || project.scenes.length === 0) {
      project.scenes = [scene];
    } else {
      project.scenes[0] = scene;
    }
    project.activeSceneId = scene.id;
  }

  // Map v3 layers to v2 format
  const presetLayers = preset.layers.map((layer: any) => {
    // Build legacy layer ID from type
    const legacyId = buildLegacyTarget(layer.type, '').split('.')[0];
    const layerDef = getLayerType(layer.type);

    return {
      id: legacyId,
      name: layerDef?.name || layer.type,
      enabled: layer.params.enabled ?? true,
      opacity: layer.params.opacity ?? 1,
      blendMode: layer.params.blendMode || 'normal',
      transform: layer.params.transform || { x: 0, y: 0, scale: 1, rotation: 0 },
      params: { ...layer.params }
    };
  });

  // Start with all layers from DEFAULT_PROJECT disabled as a stable baseline.
  const defaultLayers = defaultScene.layers.map((l: any) => ({ ...l, enabled: false }));

  // Apply preset layers over the disabled baseline.
  const newLayers = defaultLayers.map((baseLayer: any) => {
    const presetLayer = presetLayers.find((l: any) => l.id === baseLayer.id);
    if (presetLayer) {
      return { ...presetLayer };
    }
    return baseLayer;
  });

  // Add new layers from preset that aren't in the project
  for (const presetLayer of presetLayers) {
    if (!newLayers.find((l: any) => l.id === presetLayer.id)) {
      newLayers.push(presetLayer);
    }
  }

  scene.layers = newLayers;

  // Map v3 modulations to v2 format
  const newModMatrix = (preset.modulations || []).map((mod: any) => {
    return {
      id: `mod-${Date.now()}-${Math.random()}`,
      source: mod.source,
      target: buildLegacyTarget(mod.target.type, mod.target.param),
      amount: mod.amount,
      min: mod.min,
      max: mod.max,
      curve: mod.curve,
      smoothing: mod.smoothing,
      bipolar: mod.bipolar
    };
  });

  project.modMatrix = newModMatrix;

  // Convert macros from v3 to v2 format
  project.macros = (preset.macros || []).map((macro: any) => {
    if (!macro.targets) return macro;

    const migratedTargets = macro.targets
      .map((t: any) => {
        const target = t.target;
        if (typeof target === 'string') {
          return { ...t, target };
        }
        // Convert structured target to legacy string
        return {
          ...t,
          target: buildLegacyTarget(target.type || target.layerType, target.param)
        };
      })
      .filter((t: any) => t !== null);

    return { ...macro, targets: migratedTargets };
  });

  return { project, warnings };
};

/**
 * Apply a v4 preset (scene/performance) to a project.
 */
export const applyPresetV4 = (preset: any, currentProject: any): { project: any; warnings: string[] } => {
  const warnings: string[] = [];
  const presetType = preset?.metadata?.presetType ?? 'scene';

  if (presetType === 'performance' && preset.project) {
    const parsed = projectSchema.safeParse(preset.project);
    if (!parsed.success) {
      warnings.push('Performance preset project failed schema validation; using DEFAULT_PROJECT fallback.');
      return { project: JSON.parse(JSON.stringify(DEFAULT_PROJECT)), warnings };
    }
    return { project: parsed.data, warnings };
  }

  // Scene preset: build a fresh project with the preset scenes.
  const project: VisualSynthProject = JSON.parse(JSON.stringify(currentProject ?? DEFAULT_PROJECT));
  const scenes = Array.isArray(preset.scenes) ? preset.scenes : [];
  const defaultTransition = preset?.metadata?.defaultTransition ?? DEFAULT_SCENE_TRANSITION;

  project.scenes = scenes.map((scene: SceneConfig) => ({
    ...scene,
    transition_in: scene.transition_in ?? { ...defaultTransition },
    transition_out: scene.transition_out ?? { ...defaultTransition }
  }));

  if (project.scenes.length === 0) {
    warnings.push('Scene preset contained no scenes; falling back to DEFAULT_PROJECT.');
    return { project: JSON.parse(JSON.stringify(DEFAULT_PROJECT)), warnings };
  }

  project.activeSceneId = preset.activeSceneId ?? project.scenes[0].id;

  // Map metadata
  if (preset.metadata) {
    project.intendedMusicStyle = preset.metadata.intendedMusicStyle;
    project.visualIntentTags = preset.metadata.visualIntentTags;
  }

  // Map v3-style modulations into legacy modMatrix.
  if (preset.modulations) {
    project.modMatrix = preset.modulations.map((mod: any) => ({
      id: `mod-${Date.now()}-${Math.random()}`,
      source: mod.source,
      target: buildLegacyTarget(mod.target.type ?? mod.target.layerType, mod.target.param),
      amount: mod.amount,
      min: mod.min,
      max: mod.max,
      curve: mod.curve,
      smoothing: mod.smoothing,
      bipolar: mod.bipolar
    }));
  }

  if (preset.macros) {
    project.macros = preset.macros.map((macro: any) => {
      if (!macro.targets) return macro;
      const migratedTargets = macro.targets
        .map((t: any) => {
          const target = t.target;
          if (typeof target === 'string') {
            return { ...t, target };
          }
          return { ...t, target: buildLegacyTarget(target.type || target.layerType, target.param) };
        })
        .filter((t: any) => t !== null);
      return { ...macro, targets: migratedTargets };
    });
  }

  return { project, warnings };
};

/**
 * Apply a v5 preset (Performance) to a project.
 * Autoloads for immediate pleasing visuals.
 */
export const applyPresetV5 = (preset: any, currentProject: any): { project: any; warnings: string[] } => {
  const warnings: string[] = [];
  
  // Start with a fresh project based on preset project if available, otherwise current or default
  const project: VisualSynthProject = JSON.parse(JSON.stringify(preset.project ?? currentProject ?? DEFAULT_PROJECT));
  
  // Core performance mapping
  project.activeModeId = preset.metadata?.activeModeId || 'mode-cosmic';
  project.colorChemistry = preset.metadata?.colorChemistry || ['analog', 'balanced'];
  project.roleWeights = preset.roleWeights || { core: 1, support: 1, atmosphere: 1 };
  project.tempoSync = preset.tempoSync || { bpm: 120, source: 'manual' };
  
  // Narrative scenes
  if (Array.isArray(preset.scenes) && preset.scenes.length > 0) {
    const defaultTransition = preset.metadata?.defaultTransition ?? DEFAULT_SCENE_TRANSITION;
    project.scenes = preset.scenes.map((scene: SceneConfig) => ({
      ...scene,
      transition_in: scene.transition_in ?? { ...defaultTransition },
      transition_out: scene.transition_out ?? { ...defaultTransition }
    }));
    project.activeSceneId = preset.activeSceneId ?? project.scenes[0].id;
  }

  // Modulations and Macros (Performance defaults)
  if (preset.modulations) {
    project.modMatrix = preset.modulations.map((mod: any) => ({
      id: `mod-v5-${Date.now()}-${Math.random()}`,
      source: mod.source,
      target: typeof mod.target === 'string' ? mod.target : buildLegacyTarget(mod.target.type || mod.target.layerType, mod.target.param),
      amount: mod.amount,
      min: mod.min,
      max: mod.max,
      curve: mod.curve,
      smoothing: mod.smoothing,
      bipolar: mod.bipolar
    }));
  }

  if (preset.macros) {
    project.macros = preset.macros.map((macro: any) => {
      // Version 5 presets expect default macro values
      return {
        ...macro,
        value: macro.value ?? 0.5,
        targets: macro.targets?.map((t: any) => ({
          ...t,
          target: typeof t.target === 'string' ? t.target : buildLegacyTarget(t.target.type || t.target.layerType, t.target.param)
        })) || []
      };
    });
  }

  return { project, warnings };
};

/**
 * Apply a v6 preset (Engine Scoped) to a project.
 */
export const applyPresetV6 = (preset: any, currentProject: any): { project: any; warnings: string[] } => {
  const warnings: string[] = [];
  
  // Scoped fresh project
  const project: VisualSynthProject = JSON.parse(JSON.stringify(preset.project ?? currentProject ?? DEFAULT_PROJECT));
  
  project.activeEngineId = preset.metadata?.activeEngineId || 'engine-radial-core';
  project.activeModeId = preset.metadata?.activeModeId || 'mode-cosmic';
  project.colorChemistry = preset.metadata?.colorChemistry || ['analog', 'balanced'];
  project.roleWeights = preset.roleWeights || { core: 1, support: 1, atmosphere: 1 };
  project.tempoSync = preset.tempoSync || { bpm: 120, source: 'manual' };
  
  if (Array.isArray(preset.scenes)) {
    project.scenes = preset.scenes;
    project.activeSceneId = preset.activeSceneId ?? project.scenes[0].id;
  }

  if (preset.modulations) {
    project.modMatrix = preset.modulations.map((mod: any) => ({
      id: `mod-v6-${Date.now()}-${Math.random()}`,
      source: mod.source,
      target: typeof mod.target === 'string' ? mod.target : buildLegacyTarget(mod.target.type || mod.target.layerType, mod.target.param),
      amount: mod.amount,
      min: mod.min,
      max: mod.max,
      curve: mod.curve,
      smoothing: mod.smoothing,
      bipolar: mod.bipolar
    }));
  }

  if (preset.macros) {
    const engineId = project.activeEngineId as EngineId;
    const engine = ENGINE_REGISTRY[engineId];
    if (engine) {
      // Re-map macros to ensure they adhere to Engine Surface (5-7 macros)
      project.macros = engine.macros.map((m, i) => {
        const incoming = preset.macros.find((pm: any) => pm.name === m.name || pm.id === `macro-${i + 1}`);
        return {
          id: `macro-${i + 1}`,
          name: m.name,
          value: incoming?.value ?? m.defaultValue,
          targets: [{ target: m.target, amount: 1.0 }]
        };
      });
      // Fill remaining to 8 with empty to keep UI stable
      for (let i = engine.macros.length; i < 8; i++) {
        project.macros.push({
          id: `macro-${i + 1}`,
          name: `Macro ${i + 1}`,
          value: 0.5,
          targets: []
        });
      }
    } else {
      project.macros = preset.macros;
    }
  }

  return { project, warnings };
};
