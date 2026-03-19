import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { parseMilkFile } from '../src/shared/milkwaveParser';
import { inferPresetCategory } from '../src/shared/hlslToGlsl';
import { translateMilkwavePresetOffline } from '../src/shared/milkwaveOfflineTranslation';

interface Options {
  folder?: string;
  batch?: number;
  settleFrames?: number;
  evidenceTimeout?: number;
}

const args = process.argv.slice(2);
const positional: string[] = [];
const options: Options = {};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--folder' && args[i + 1]) {
    options.folder = args[++i];
  } else if (arg === '--batch' && args[i + 1]) {
    options.batch = Number.parseInt(args[++i], 10);
  } else if (arg === '--settle-frames' && args[i + 1]) {
    options.settleFrames = Number.parseInt(args[++i], 10);
  } else if (arg === '--evidence-timeout' && args[i + 1]) {
    options.evidenceTimeout = Number.parseInt(args[++i], 10);
  } else {
    positional.push(arg);
  }
}

const defaultMilkwaveRoot = path.resolve(process.cwd(), '..', 'Milkwave', 'Visualizer', 'resources', 'presets');

const collectMilkFiles = (): string[] => {
  if (positional.length > 0) {
    return positional.map((entry) => path.resolve(process.cwd(), entry));
  }
  if (!options.folder) {
    throw new Error('Usage: npx tsx scripts/runtime-audit-milkwave-offline.ts <preset1.milk> [preset2.milk ...] OR --folder <folder> [--batch N]');
  }
  const folderPath = path.join(defaultMilkwaveRoot, options.folder);
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Folder not found: ${folderPath}`);
  }
  const files = fs.readdirSync(folderPath)
    .filter((file) => file.toLowerCase().endsWith('.milk'))
    .sort()
    .map((file) => path.join(folderPath, file));
  return options.batch ? files.slice(0, options.batch) : files;
};

const buildProject = (files: string[]) => {
  const now = new Date().toISOString();
  const scenes = files.map((filePath, index) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const folder = path.basename(path.dirname(filePath));
    const preset = parseMilkFile(content, path.basename(filePath), folder);
    if (!preset) {
      throw new Error(`Failed to parse ${filePath}`);
    }

    const translated = translateMilkwavePresetOffline(preset);
    const sceneId = `milkwave-offline-scene-${String(index + 1).padStart(4, '0')}`;

    return {
      id: sceneId,
      scene_id: sceneId,
      name: preset.metadata.name,
      intent: 'ambient',
      duration: 0,
      transition_in: { durationMs: 600, curve: 'easeInOut' },
      transition_out: { durationMs: 600, curve: 'easeInOut' },
      trigger: { type: 'manual' },
      assigned_layers: { core: [], support: ['layer-milkwave'], atmosphere: [] },
      layers: [
        {
          id: 'layer-milkwave',
          name: 'Milkwave',
          role: 'support',
          enabled: true,
          opacity: 1,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          params: {
            opacity: 1,
            enabled: true,
            blendMode: 'screen',
            zoom: preset.parameters.zoom ?? 1,
            rotation: preset.parameters.rot ?? 0,
            warp: preset.parameters.warp ?? 0.01,
            decay: preset.parameters.fDecay ?? 0.95,
            gamma: preset.parameters.fGammaAdj ?? 1
          }
        }
      ],
      _shaderData: {
        warp: translated.translation.passes.warp.source,
        comp: translated.translation.passes.comp.source,
        perFrameCode: preset.perFrameCode,
        perFrameInitCode: preset.perFrameInitCode,
        perPixelCode: preset.perPixelCode,
        waves: preset.waves,
        shapes: preset.shapes,
        originalParameters: preset.parameters,
        translation: translated.translation
      }
    };
  });

  const firstScene = scenes[0];
  return {
    version: 6,
    metadata: {
      version: 6,
      name: `Milkwave Offline Runtime Audit (${scenes.length} scenes)`,
      createdAt: now,
      updatedAt: now,
      category: inferPresetCategory('Milkwave Offline Runtime Audit', ''),
      compatibility: { minVersion: '1.4.0' },
      importedFrom: 'Milkwave',
      activeEngineId: 'engine-radial-core',
      activeModeId: 'mode-cosmic',
      intendedMusicStyle: 'Electronic',
      visualIntentTags: ['imported', 'milkwave', 'runtime-audit'],
      colorChemistry: ['analog', 'balanced'],
      defaultTransition: { durationMs: 600, curve: 'easeInOut' }
    },
    scenes,
    activeSceneId: firstScene?.id ?? 'scene-1',
    roleWeights: { core: 1, support: 1, atmosphere: 1 },
    tempoSync: { bpm: 120, source: 'manual' },
    modulations: [],
    macros: []
  };
};

const main = () => {
  const files = collectMilkFiles();
  if (files.length === 0) {
    throw new Error('No .milk files selected for audit.');
  }

  const project = buildProject(files);
  const outDir = path.join(process.cwd(), 'milkwave-runtime-samples');
  fs.mkdirSync(outDir, { recursive: true });
  const fileName = `milkwave-offline-runtime-sample-${Date.now()}.project.json`;
  const projectPath = path.join(outDir, fileName);
  fs.writeFileSync(projectPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');

  console.log(`[OfflineAudit] Wrote sample project: ${projectPath}`);

  const auditArgs = [path.join(process.cwd(), 'scripts', 'runtime-audit-milkwave-project.js'), projectPath];
  if (options.settleFrames) {
    auditArgs.push('--settle-frames', String(options.settleFrames));
  }
  if (options.evidenceTimeout) {
    auditArgs.push('--evidence-timeout', String(options.evidenceTimeout));
  }

  const result = spawnSync(process.execPath, auditArgs, {
    cwd: process.cwd(),
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

main();
