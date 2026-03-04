/**
 * Milkwave Preset Import Script
 *
 * Imports presets from Milkwave (MilkDrop) format to VisualSynth presets.
 *
 * Usage: npx tsx scripts/importMilkwavePresets.ts [--folder <folder>] [--batch <n>] [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseMilkFile,
  extractAuthorFromFilename,
  extractNameFromFilename,
  MilkPresetData
} from '../src/shared/milkwaveParser';
import { transpileMilkDropShader, inferPresetCategory } from '../src/shared/hlslToGlsl';

const MILKWAVE_PATH = path.resolve(__dirname, '../../Milkwave/Visualizer/resources/presets');
const OUTPUT_PATH = path.resolve(__dirname, '../assets/presets');

interface ImportOptions {
  folder?: string;
  batch?: number;
  dryRun: boolean;
  startIndex: number;
}

interface ImportResult {
  file: string;
  success: boolean;
  author: string;
  name: string;
  category: string;
  error?: string;
}

// Default preset structure for Milkwave imports
function createMilkwavePreset(
  milkData: MilkPresetData,
  glslWarp: string | null,
  glslComp: string | null,
  presetNumber: number
): any {
  const now = new Date().toISOString();
  const category = inferPresetCategory(milkData.metadata.name, (glslWarp || '') + (glslComp || ''));

  return {
    version: 6,
    metadata: {
      version: 6,
      name: milkData.metadata.name,
      author: milkData.metadata.author,
      source: milkData.metadata.sourcePath,
      importedFrom: 'Milkwave',
      createdAt: now,
      updatedAt: now,
      category,
      compatibility: {
        minVersion: '1.4.0'
      },
      activeEngineId: 'engine-radial-core',
      activeModeId: 'mode-cosmic',
      intendedMusicStyle: 'Electronic',
      visualIntentTags: ['imported', 'milkwave'],
      colorChemistry: ['analog', 'balanced'],
      defaultTransition: {
        durationMs: 600,
        curve: 'easeInOut'
      }
    },
    scenes: [
      {
        id: 'scene-1',
        scene_id: 'scene-1',
        name: 'Main',
        intent: 'ambient',
        duration: 0,
        transition_in: { durationMs: 600, curve: 'easeInOut' },
        transition_out: { durationMs: 600, curve: 'easeInOut' },
        trigger: { type: 'manual' },
        assigned_layers: {
          core: [],
          support: ['layer-milkwave'],
          atmosphere: []
        },
        layers: [
          {
            id: 'layer-milkwave',
            name: 'Milkwave',
            role: 'support',
            enabled: true,
            opacity: milkData.parameters.fGammaAdj ?? 1,
            blendMode: 'screen',
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            params: {
              opacity: milkData.parameters.fGammaAdj ?? 1,
              enabled: true,
              blendMode: 'screen',
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              zoom: milkData.parameters.zoom ?? 1,
              rotation: milkData.parameters.rot ?? 0,
              warp: milkData.parameters.warp ?? 0.01,
              decay: milkData.parameters.fDecay ?? 0.95,
              gamma: milkData.parameters.fGammaAdj ?? 1,
              bassSensitivity: 1,
              midSensitivity: 1,
              trebSensitivity: 1
            }
          }
        ]
      }
    ],
    activeSceneId: 'scene-1',
    roleWeights: { core: 1, support: 1, atmosphere: 1 },
    tempoSync: { bpm: 120, source: 'manual' },
    modulations: [],
    macros: [],
    // Store shader code for later use
    _shaderData: {
      warp: glslWarp,
      comp: glslComp,
      perFrameCode: milkData.perFrameCode,
      perFrameInitCode: milkData.perFrameInitCode,
      perPixelCode: milkData.perPixelCode,
      originalParameters: milkData.parameters
    }
  };
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50);
}

async function importMilkwavePresets(options: ImportOptions): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  // Determine which folders to process
  let folders: string[];
  if (options.folder) {
    folders = [options.folder];
  } else {
    try {
      const entries = fs.readdirSync(MILKWAVE_PATH, { withFileTypes: true });
      folders = entries
        .filter(e => e.isDirectory())
        .map(e => e.name);
    } catch {
      console.error(`Milkwave path not found: ${MILKWAVE_PATH}`);
      return [];
    }
  }

  console.log(`Found ${folders.length} folders to process`);

  let presetNumber = options.startIndex;

  for (const folder of folders) {
    const folderPath = path.join(MILKWAVE_PATH, folder);
    const files = fs.readdirSync(folderPath)
      .filter(f => f.toLowerCase().endsWith('.milk'))
      .sort();

    // Apply batch limit if specified
    const filesToProcess = options.batch ? files.slice(0, options.batch) : files;

    console.log(`Processing ${filesToProcess.length} files from ${folder}...`);

    for (const file of filesToProcess) {
      const filePath = path.join(folderPath, file);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const milkData = parseMilkFile(content, file, folder);

        if (!milkData) {
          results.push({
            file: `${folder}/${file}`,
            success: false,
            author: 'Unknown',
            name: file,
            category: 'Imported',
            error: 'Failed to parse .milk file'
          });
          continue;
        }

        // Transpile shaders
        let glslWarp: string | null = null;
        let glslComp: string | null = null;

        if (milkData.warpShader) {
          const result = transpileMilkDropShader(milkData.warpShader, 'warp');
          glslWarp = result.glsl;
          if (result.errors.length > 0) {
            console.warn(`  Warp shader errors in ${file}:`, result.errors);
          }
        }

        if (milkData.compShader) {
          const result = transpileMilkDropShader(milkData.compShader, 'comp');
          glslComp = result.glsl;
          if (result.errors.length > 0) {
            console.warn(`  Comp shader errors in ${file}:`, result.errors);
          }
        }

        // Create preset
        const preset = createMilkwavePreset(milkData, glslWarp, glslComp, presetNumber);

        // Generate output filename
        const sanitizedName = sanitizeFilename(milkData.metadata.name);
        const outputFilename = `preset-${String(presetNumber).padStart(3, '0')}-milkwave-${sanitizedName}.json`;
        const outputPath = path.join(OUTPUT_PATH, outputFilename);

        if (!options.dryRun) {
          fs.writeFileSync(outputPath, JSON.stringify(preset, null, 2));
        }

        results.push({
          file: `${folder}/${file}`,
          success: true,
          author: milkData.metadata.author,
          name: milkData.metadata.name,
          category: preset.metadata.category
        });

        presetNumber++;
      } catch (err: any) {
        results.push({
          file: `${folder}/${file}`,
          success: false,
          author: 'Unknown',
          name: file,
          category: 'Imported',
          error: err?.message ?? String(err)
        });
      }
    }
  }

  return results;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    dryRun: false,
    startIndex: 300  // Start numbering presets at 300 to avoid conflicts
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--folder' && args[i + 1]) {
      options.folder = args[i + 1];
      i++;
    } else if (args[i] === '--batch' && args[i + 1]) {
      options.batch = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--start' && args[i + 1]) {
      options.startIndex = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log('Milkwave Preset Import');
  console.log('=====================');
  console.log(`Milkwave path: ${MILKWAVE_PATH}`);
  console.log(`Output path: ${OUTPUT_PATH}`);
  console.log(`Options: ${JSON.stringify(options)}`);
  console.log('');

  const results = await importMilkwavePresets(options);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('');
  console.log('Import Summary');
  console.log('==============');
  console.log(`Total processed: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('');
    console.log('Failed imports:');
    for (const f of failed) {
      console.log(`  - ${f.file}: ${f.error}`);
    }
  }

  // Category breakdown
  const categoryCount = new Map<string, number>();
  for (const r of successful) {
    categoryCount.set(r.category, (categoryCount.get(r.category) || 0) + 1);
  }
  console.log('');
  console.log('Category distribution:');
  for (const [cat, count] of categoryCount.entries()) {
    console.log(`  ${cat}: ${count}`);
  }

  // Author breakdown (top 10)
  const authorCount = new Map<string, number>();
  for (const r of successful) {
    authorCount.set(r.author, (authorCount.get(r.author) || 0) + 1);
  }
  const topAuthors = [...authorCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log('');
  console.log('Top authors:');
  for (const [author, count] of topAuthors) {
    console.log(`  ${author}: ${count}`);
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main();