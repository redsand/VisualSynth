/**
 * Batch Preset Migration Script
 *
 * Migrates all existing presets from v1/v2 to v3 format.
 * This script reads all preset files, migrates them, and saves them back.
 */

import fs from 'fs';
import path from 'path';

// Mock the migration module (since it uses browser APIs)
// We'll implement the core migration logic here

interface PresetV1 {
  version: 1;
  name: string;
  scenes: Array<{
    id: string;
    name: string;
    layers: Array<{
      id: string;
      name: string;
      enabled: boolean;
      opacity: number;
      blendMode: string;
      transform: {
        x: number;
        y: number;
        scale: number;
        rotation: number;
      };
    }>;
  }>;
  modMatrix: any[];
  midiMappings: any[];
}

interface PresetV2 {
  version: 2;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  category?: string;
  scenes: Array<{
    id: string;
    name: string;
    layers: any[];
  }>;
  modMatrix: any[];
  midiMappings: any[];
  macros?: any[];
}

interface PresetV3 {
  version: 3;
  metadata: {
    version: 3;
    name: string;
    createdAt: string;
    updatedAt: string;
    category?: string;
    compatibility?: {
      minVersion: string;
      maxVersion?: string;
    };
  };
  layers: Array<{
    type: string;
    params: Record<string, any>;
  }>;
  modulations: Array<{
    source: string;
    target: {
      type: string;
      param: string;
    };
    amount: number;
    min: number;
    max: number;
    curve: 'linear' | 'exp' | 'log';
    smoothing: number;
    bipolar: boolean;
  }>;
  macros: any[];
}

// Layer type mapping (old ID -> type)
const LAYER_TYPE_MAPPING: Record<string, string> = {
  'layer-plasma': 'plasma',
  'layer-spectrum': 'spectrum',
  'layer-origami': 'origami',
  'layer-glyph': 'glyph',
  'layer-crystal': 'crystal',
  'layer-inkflow': 'inkflow',
  'layer-topo': 'topo',
  'layer-weather': 'weather',
  'layer-portal': 'portal',
  'layer-oscillo': 'oscillo'
};

// Parameter definitions (simplified version for migration)
const PARAMETER_DEFINITIONS: Record<string, Record<string, { type: 'number' | 'boolean' | 'string'; min?: number; max?: number; default: any }>> = {
  plasma: {
    opacity: { type: 'number', min: 0, max: 1, default: 1 },
    speed: { type: 'number', min: 0.1, max: 3, default: 1 },
    scale: { type: 'number', min: 0.1, max: 3, default: 1 },
    complexity: { type: 'number', min: 0, max: 1, default: 0.5 }
  },
  spectrum: {
    opacity: { type: 'number', min: 0, max: 1, default: 1 }
  },
  origami: {
    opacity: { type: 'number', min: 0, max: 1, default: 1 },
    speed: { type: 'number', min: 0.1, max: 3, default: 1 }
  },
  glyph: {
    opacity: { type: 'number', min: 0, max: 1, default: 1 },
    speed: { type: 'number', min: 0.1, max: 3, default: 1 }
  },
  crystal: {
    opacity: { type: 'number', min: 0, max: 1, default: 1 },
    scale: { type: 'number', min: 0.1, max: 3, default: 1 },
    speed: { type: 'number', min: 0.1, max: 3, default: 1 }
  },
  inkflow: {
    opacity: { type: 'number', min: 0, max: 1, default: 1 },
    speed: { type: 'number', min: 0.1, max: 3, default: 1 },
    scale: { type: 'number', min: 0.1, max: 3, default: 1 }
  },
  topo: {
    opacity: { type: 'number', min: 0, max: 1, default: 1 },
    scale: { type: 'number', min: 0.1, max: 3, default: 1 },
    elevation: { type: 'number', min: 0, max: 1, default: 0.5 }
  },
  weather: {
    opacity: { type: 'number', min: 0, max: 1, default: 1 },
    speed: { type: 'number', min: 0.1, max: 3, default: 1 }
  },
  portal: {
    opacity: { type: 'number', min: 0, max: 1, default: 1 }
  },
  oscillo: {
    opacity: { type: 'number', min: 0, max: 1, default: 1 }
  }
};

/**
 * Parse legacy target string (e.g., "layer-plasma.speed")
 */
function parseLegacyTarget(target: string): { layerType: string; param: string } | null {
  const parts = target.split('.');
  if (parts.length < 2) return null;

  const layerId = parts[0];
  const paramId = parts.slice(1).join('.');

  const layerType = LAYER_TYPE_MAPPING[layerId] || layerId.replace(/^layer-/, '');
  const paramDefs = PARAMETER_DEFINITIONS[layerType];

  if (!paramDefs || !(paramId in paramDefs)) {
    return null;
  }

  return { layerType, param: paramId };
}

/**
 * Build legacy target string from type and param
 */
function buildLegacyTarget(layerType: string, param: string): string {
  const reverseMapping: Record<string, string> = {};
  for (const [id, type] of Object.entries(LAYER_TYPE_MAPPING)) {
    reverseMapping[type] = id;
  }

  const layerId = reverseMapping[layerType] || `layer-${layerType}`;
  return `${layerId}.${param}`;
}

/**
 * Migrate v1/v2 preset to v3 format
 */
function migrateToV3(preset: PresetV1 | PresetV2): { preset: PresetV3; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  const v1 = preset as PresetV1;
  const v2 = preset as PresetV2;

  // Get the first scene
  const scene = v2.scenes?.[0] || v1.scenes?.[0];
  if (!scene) {
    errors.push('Preset has no scenes');
    return { preset: {} as any, warnings, errors };
  }

  const layers: any[] = [];
  const modulations: any[] = [];

  // Convert layers
  const layersToProcess = scene.layers || [];
  for (const layer of layersToProcess) {
    const layerId = layer.id;
    const layerType = LAYER_TYPE_MAPPING[layerId];

    if (!layerType) {
      warnings.push(`Unknown layer type: ${layerId}, skipping layer`);
      continue;
    }

    const paramDefs = PARAMETER_DEFINITIONS[layerType] || {};
    const params: Record<string, any> = {
      opacity: layer.opacity ?? paramDefs.opacity?.default ?? 1,
      enabled: layer.enabled ?? true,
      blendMode: layer.blendMode || 'normal',
      transform: layer.transform || { x: 0, y: 0, scale: 1, rotation: 0 }
    };

    // Add any extra params from layer object
    for (const [key, value] of Object.entries(layer)) {
      if (!['id', 'name', 'enabled', 'opacity', 'blendMode', 'transform', 'assetId', 'generatorId'].includes(key)) {
        params[key] = value;
      }
    }

    // Add missing params with defaults
    for (const [paramId, paramDef] of Object.entries(paramDefs)) {
      if (!(paramId in params)) {
        params[paramId] = paramDef.default;
      } else {
        // Validate and clamp
        const value = params[paramId];
        if (paramDef.type === 'number' && typeof value === 'number') {
          if (paramDef.min !== undefined && value < paramDef.min) {
            params[paramId] = paramDef.min;
            warnings.push(`Clamped ${layerId}.${paramId} to minimum ${paramDef.min}`);
          }
          if (paramDef.max !== undefined && value > paramDef.max) {
            params[paramId] = paramDef.max;
            warnings.push(`Clamped ${layerId}.${paramId} to maximum ${paramDef.max}`);
          }
        }
      }
    }

    layers.push({
      type: layerType,
      params
    });
  }

  // Convert modulations
  const modMatrix = v2.modMatrix || v1.modMatrix || [];
  for (const mod of modMatrix) {
    const target = parseLegacyTarget(mod.target);
    if (!target) {
      warnings.push(`Invalid modulation target: ${mod.target}, skipping modulation`);
      continue;
    }

    modulations.push({
      source: mod.source,
      target: { type: target.layerType, param: target.param },
      amount: mod.amount,
      min: mod.min,
      max: mod.max,
      curve: mod.curve || 'linear',
      smoothing: mod.smoothing || 0,
      bipolar: mod.bipolar || false
    });
  }

  // Handle macros
  const macros = (v2.macros || []).map((macro: any) => {
    if (!macro.targets) return macro;

    const migratedTargets = macro.targets
      .map((t: any) => {
        const target = parseLegacyTarget(t.target);
        if (!target) {
          warnings.push(`Invalid macro target: ${t.target}, skipping macro target`);
          return null;
        }
        return { ...t, target: { type: target.layerType, param: target.param } };
      })
      .filter((t: any) => t !== null);

    return { ...macro, targets: migratedTargets };
  });

  const now = new Date().toISOString();

  const presetV3: PresetV3 = {
    version: 3,
    metadata: {
      version: 3,
      name: v2.name || v1.name,
      createdAt: v2.createdAt || now,
      updatedAt: now,
      category: v2.category || 'Uncategorized',
      compatibility: {
        minVersion: '0.9.0'
      }
    },
    layers,
    modulations,
    macros
  };

  return { preset: presetV3, warnings, errors };
}

/**
 * Get all preset files in the assets/presets directory
 */
function getPresetFiles(): string[] {
  // Use process.cwd() to get the working directory (project root)
  const presetsDir = path.join(process.cwd(), 'assets/presets');

  if (!fs.existsSync(presetsDir)) {
    console.error(`Presets directory not found: ${presetsDir}`);
    return [];
  }

  return fs.readdirSync(presetsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(presetsDir, file));
}

/**
 * Migrate all presets
 */
function migrateAllPresets(): void {
  console.log('=== Preset Migration Tool ===\n');
  console.log('This tool will migrate all presets to v3 format.\n');

  const presetFiles = getPresetFiles();

  if (presetFiles.length === 0) {
    console.log('No preset files found.');
    return;
  }

  console.log(`Found ${presetFiles.length} preset file(s).\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const allWarnings: string[] = [];

  for (const presetFile of presetFiles) {
    try {
      const content = fs.readFileSync(presetFile, 'utf-8');
      const preset = JSON.parse(content);

      // Check if already v3
      if (preset.version === 3) {
        console.log(`✓ ${path.basename(presetFile)} - Already v3, skipped`);
        skipped++;
        continue;
      }

      // Migrate to v3
      const result = migrateToV3(preset);

      if (result.errors.length > 0) {
        console.error(`✗ ${path.basename(presetFile)} - Migration failed:`);
        for (const error of result.errors) {
          console.error(`  - ${error}`);
        }
        failed++;
        continue;
      }

      // Backup original file
      const backupFile = `${presetFile}.backup`;
      fs.copyFileSync(presetFile, backupFile);

      // Write migrated preset
      fs.writeFileSync(presetFile, JSON.stringify(result.preset, null, 2), 'utf-8');

      console.log(`✓ ${path.basename(presetFile)} - Migrated to v3`);

      if (result.warnings.length > 0) {
        console.log(`  Warnings: ${result.warnings.length}`);
        for (const warning of result.warnings) {
          allWarnings.push(`${path.basename(presetFile)}: ${warning}`);
        }
      }

      migrated++;
    } catch (error) {
      console.error(`✗ ${path.basename(presetFile)} - Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped (already v3): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${presetFiles.length}`);

  if (allWarnings.length > 0) {
    console.log(`\n=== Warnings (${allWarnings.length}) ===`);
    allWarnings.slice(0, 10).forEach(w => console.log(`  ${w}`));
    if (allWarnings.length > 10) {
      console.log(`  ... and ${allWarnings.length - 10} more`);
    }
  }

  if (failed > 0) {
    console.log('\n⚠ Some presets failed to migrate. Backup files are preserved.');
    process.exit(1);
  } else {
    console.log('\n✓ All presets migrated successfully!');
    console.log('\nOriginal files have been backed up with .backup extension.');
  }
}

// Run migration
migrateAllPresets();