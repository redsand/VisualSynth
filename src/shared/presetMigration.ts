/**
 * Preset Migration Layer
 *
 * Handles migration of presets between different versions of the application.
 * This ensures backward compatibility and allows presets to evolve with the application.
 */

import { z } from 'zod';
import { PARAMETER_REGISTRY, getLayerType, getParamDef, parseLegacyTarget, buildLegacyTarget } from './parameterRegistry';

export const APP_VERSION = '0.9.0';

export interface PresetCompatibility {
  /** Minimum app version this preset works with */
  minVersion: string;
  /** Maximum app version this preset works with (if applicable) */
  maxVersion?: string;
}

export interface PresetMetadata {
  version: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  compatibility?: PresetCompatibility;
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

export type PresetV1 = z.infer<typeof presetV1Schema>;
export type PresetV2 = z.infer<typeof presetV2Schema>;
export type PresetV3 = z.infer<typeof presetV3Schema>;

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
    if (preset.version === 3) {
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
      transform: layer.transform
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
 * Validate a preset against the current parameter registry
 */
export const validatePreset = (preset: any): { valid: boolean; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check preset version
  if (preset.version < 3) {
    return { valid: true, warnings: ['Preset is in legacy format, migration recommended'], errors: [] };
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

      const { type: layerType, param } = mod.target;
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
  const project = { ...currentProject };

  // Clear existing layers from the active scene
  const scene = project.scenes.find((s: any) => s.id === project.activeSceneId);
  if (!scene) {
    warnings.push('No active scene found');
    return { project, warnings };
  }

  // Map v3 layers to v2 format
  const newLayers = preset.layers.map((layer: any) => {
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