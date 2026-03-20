const fs = require('fs');
const path = require('path');

const { DEFAULT_PROJECT } = require('../dist/main/shared/project.js');
const {
  applyPresetV3,
  applyPresetV4,
  applyPresetV5,
  applyPresetV6,
  migratePreset
} = require('../dist/main/shared/presetMigration.js');
const { projectSchema } = require('../dist/main/shared/projectSchema.js');
const { buildMilkwaveIR } = require('../dist/main/shared/milkwaveIr.js');
const { classifyMilkwaveIR } = require('../dist/main/shared/milkwaveCapability.js');

const repoRoot = path.resolve(__dirname, '..');
const presetsDir = path.join(repoRoot, 'assets', 'presets');
const outputPath = path.join(repoRoot, 'milkwave-confirmed-manual-test.project.json');
const BANK_SIZE = 250;

const clone = (value) => JSON.parse(JSON.stringify(value));

const cleanCodeArray = (arr) =>
  Array.isArray(arr) ? arr.filter((line) => typeof line === 'string') : [];

const cleanCodeBlocks = (items) =>
  (items || []).map((item) => ({
    ...item,
    initCode: cleanCodeArray(item.initCode),
    perFrameCode: cleanCodeArray(item.perFrameCode),
    perPointCode: cleanCodeArray(item.perPointCode)
  }));

const sanitizeOriginalParameters = (shaderData) => {
  if (!shaderData) return shaderData;

  const sanitized = {};
  if (shaderData.originalParameters && typeof shaderData.originalParameters === 'object') {
    for (const [key, value] of Object.entries(shaderData.originalParameters)) {
      if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      }
    }
  }

  return {
    ...shaderData,
    originalParameters: sanitized,
    perFrameCode: cleanCodeArray(shaderData.perFrameCode),
    perFrameInitCode: cleanCodeArray(shaderData.perFrameInitCode),
    perPixelCode: cleanCodeArray(shaderData.perPixelCode),
    waves: cleanCodeBlocks(shaderData.waves),
    shapes: cleanCodeBlocks(shaderData.shapes)
  };
};

const milkwavePresetFiles = fs
  .readdirSync(presetsDir)
  .filter((file) => file.includes('-milkwave-') && file.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

const deriveMilkwaveSupportTier = (preset) => {
  const shaderData = preset._shaderData;
  if (!shaderData) {
    return null;
  }

  const pseudoPreset = {
    metadata: {
      name: preset.metadata?.name || 'Unknown',
      author: preset.metadata?.author || 'Unknown',
      sourcePath: preset.metadata?.source || '',
      folder: 'imported'
    },
    version: 2,
    psVersion: 3,
    psVersionWarp: 3,
    psVersionComp: 3,
    parameters: shaderData.originalParameters || {},
    perFrameCode: shaderData.perFrameCode || [],
    perFrameInitCode: shaderData.perFrameInitCode || [],
    perPixelCode: shaderData.perPixelCode || [],
    warpShader: shaderData.warp || null,
    compShader: shaderData.comp || null,
    waves: shaderData.waves || [],
    shapes: shaderData.shapes || []
  };

  const ir = buildMilkwaveIR(pseudoPreset);
  const capability = classifyMilkwaveIR(ir);
  return capability.tier;
};

const applyPresetToProject = (preset) => {
  const migrated = migratePreset(preset);
  if (!migrated.success) {
    throw new Error(`Preset migration failed: ${(migrated.errors || []).join(', ')}`);
  }
  if (migrated.preset.version === 6) {
    return applyPresetV6(migrated.preset, clone(DEFAULT_PROJECT)).project;
  }
  if (migrated.preset.version === 5) {
    return applyPresetV5(migrated.preset, clone(DEFAULT_PROJECT)).project;
  }
  if (migrated.preset.version === 4) {
    return applyPresetV4(migrated.preset, clone(DEFAULT_PROJECT)).project;
  }
  if (migrated.preset.version === 3) {
    return applyPresetV3(migrated.preset, clone(DEFAULT_PROJECT)).project;
  }
  throw new Error(`Unsupported migrated preset version: ${migrated.preset.version}`);
};

const project = clone(DEFAULT_PROJECT);
project.name = 'Milkwave Native Supported Manual Test';
project.createdAt = new Date().toISOString();
project.updatedAt = project.createdAt;
project.scenes = [];

let includedCount = 0;
let skippedCount = 0;

for (let index = 0; index < milkwavePresetFiles.length; index += 1) {
  const fileName = milkwavePresetFiles[index];
  const presetPath = path.join(presetsDir, fileName);
  const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
  const supportTier = deriveMilkwaveSupportTier(preset);
  if (supportTier !== 'native-supported') {
    skippedCount += 1;
    continue;
  }
  const appliedProject = applyPresetToProject(preset);
  const baseScene = clone(appliedProject.scenes[0]);
  const sceneId = `milkwave-scene-${String(includedCount + 1).padStart(4, '0')}`;
  baseScene.id = sceneId;
  baseScene.scene_id = sceneId;
  if (baseScene._shaderData) {
    baseScene._shaderData = sanitizeOriginalParameters(baseScene._shaderData);
  }
  baseScene.name =
    preset.metadata?.name ||
    fileName.replace(/^preset-\d+-milkwave-/, '').replace(/\.json$/i, '');
  project.scenes.push(baseScene);
  includedCount += 1;
}

project.activeSceneId = project.scenes[0]?.id || 'scene-1';

const validation = projectSchema.safeParse(project);
if (!validation.success) {
  throw new Error(`Generated project failed validation: ${JSON.stringify(validation.error.format())}`);
}

fs.writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`, 'utf-8');

const bankDir = path.join(repoRoot, 'milkwave-native-supported-banks');
fs.mkdirSync(bankDir, { recursive: true });
const bankCount = Math.ceil(project.scenes.length / BANK_SIZE);

for (let bankIndex = 0; bankIndex < bankCount; bankIndex += 1) {
  const start = bankIndex * BANK_SIZE;
  const end = Math.min(start + BANK_SIZE, project.scenes.length);
  const bankProject = clone(DEFAULT_PROJECT);
  bankProject.name = `Milkwave Native Supported Bank ${bankIndex + 1} (${start + 1}-${end})`;
  bankProject.createdAt = project.createdAt;
  bankProject.updatedAt = project.updatedAt;
  bankProject.scenes = clone(project.scenes.slice(start, end));
  bankProject.activeSceneId = bankProject.scenes[0]?.id || 'scene-1';
  const bankValidation = projectSchema.safeParse(bankProject);
  if (!bankValidation.success) {
    throw new Error(
      `Bank ${bankIndex + 1} failed validation: ${JSON.stringify(bankValidation.error.format())}`
    );
  }

  const bankPath = path.join(
    bankDir,
    `milkwave-native-supported-bank-${String(bankIndex + 1).padStart(2, '0')}.project.json`
  );
  fs.writeFileSync(bankPath, `${JSON.stringify(bankProject, null, 2)}\n`, 'utf-8');
}

console.log(`Generated ${outputPath}`);
console.log(`Included ${project.scenes.length} native-supported milkwave scenes.`);
console.log(`Skipped ${skippedCount} non-native milkwave presets.`);
console.log(`Wrote ${bankCount} bank files to ${bankDir}.`);
