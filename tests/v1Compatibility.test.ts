import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { buildFragmentShader } from '../src/renderer/render/shaderBuilder';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { GENERATORS } from '../src/shared/generatorLibrary';
import { GENERATOR_SHADER_BLOCKS } from '../src/shared/generatorShaderBlocks';
import { collectSceneGeneratorIds } from '../src/shared/shaderUtils';
import {
  applyPresetV3,
  applyPresetV4,
  applyPresetV5,
  applyPresetV6,
  migratePreset
} from '../src/shared/presetMigration';

const gitShow = (refPath: string) =>
  execSync(`git show ${refPath}`, {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

const gitList = (treePath: string) =>
  execSync(`git ls-tree -r --name-only v1.0 -- ${treePath}`, {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();

const extractIds = (source: string) =>
  Array.from(source.matchAll(/id:\s*'([^']+)'/g)).map((match) => match[1]);

// The v1.0 backward-compatibility checks read generator/parameter/preset/template
// sources straight out of the `v1.0` git ref. That tag is only present in release
// checkouts, so in a plain working clone `git show v1.0:...` throws and would
// hard-fail the whole suite before any assertion runs. Probe the ref up front and
// skip the suite (rather than error) when it is absent — full coverage still runs
// wherever the tag exists.
const v1Available = (() => {
  try {
    execSync('git rev-parse --verify v1.0', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return true;
  } catch {
    return false;
  }
})();

const currentGeneratorIds = new Set(GENERATORS.map((generator) => generator.id));
const currentParameterIds = new Set(extractIds(gitShow('HEAD:src/shared/parameterRegistry.ts')));
const v1GeneratorIds = v1Available
  ? Array.from(new Set(extractIds(gitShow('v1.0:src/shared/generatorLibrary.ts')))).sort()
  : [];
const v1ParameterIds = v1Available
  ? Array.from(new Set(extractIds(gitShow('v1.0:src/shared/parameterRegistry.ts')))).sort()
  : [];
const v1PresetPaths = v1Available ? gitList('assets/presets') : [];
const v1TemplatePaths = v1Available ? gitList('assets/templates') : [];
const shaderParts = {
  preamble: fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'shaders', 'preamble.glsl'), 'utf-8'),
  mainTemplate: fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'shaders', 'mainTemplate.glsl'), 'utf-8')
};

const applyMigratedPreset = (preset: any) => {
  const migrated = migratePreset(preset);
  if (!migrated.success) {
    throw new Error(`Preset migration failed: ${(migrated.errors || []).join(', ')}`);
  }
  if (migrated.preset.version === 6) return applyPresetV6(migrated.preset, DEFAULT_PROJECT).project;
  if (migrated.preset.version === 5) return applyPresetV5(migrated.preset, DEFAULT_PROJECT).project;
  if (migrated.preset.version === 4) return applyPresetV4(migrated.preset, DEFAULT_PROJECT).project;
  if (migrated.preset.version === 3) return applyPresetV3(migrated.preset, DEFAULT_PROJECT).project;
  throw new Error(`Unsupported migrated preset version: ${migrated.preset.version}`);
};

const describeV1 = v1Available ? describe : describe.skip;
if (!v1Available) {
  console.warn('[v1Compatibility] v1.0 git tag not found in this repo — skipping v1.0 compatibility suite.');
}
describeV1('v1.0 compatibility', () => {
  it('retains every v1.0 generator id', () => {
    const missing = v1GeneratorIds
      .filter((id) => !id.startsWith('fx-'))
      .filter((id) => !currentGeneratorIds.has(id as any));
    expect(missing).toEqual([]);
  });

  it('retains every v1.0 parameter registry id', () => {
    const missing = v1ParameterIds.filter((id) => !currentParameterIds.has(id));
    expect(missing).toEqual([]);
  });

  v1PresetPaths.forEach((presetPath) => {
    it(`loads and renders v1.0 preset ${presetPath}`, () => {
      const preset = JSON.parse(gitShow(`v1.0:${presetPath}`));
      const project = applyMigratedPreset(preset);
      const store = createStore(createInitialState());
      const renderGraph = new RenderGraph(store);
      store.update((state: any) => {
        state.project = project;
      });

      const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });

      expect(project.scenes.length).toBeGreaterThan(0);
      expect(project.scenes.map((scene: any) => scene.id)).toContain(project.activeSceneId);
      expect(renderState).toBeDefined();
    });
  });

  it('builds scene-scoped fragment shaders for every v1.0 preset without unrelated generator blocks', () => {
    const failures: string[] = [];

    for (const presetPath of v1PresetPaths) {
      const preset = JSON.parse(gitShow(`v1.0:${presetPath}`));
      const project = applyMigratedPreset(preset);
      const activeScene =
        project.scenes.find((scene: any) => scene.id === project.activeSceneId) ?? project.scenes[0];
      const activeIds = collectSceneGeneratorIds(activeScene);
      const source = buildFragmentShader(
        shaderParts,
        GENERATOR_SHADER_BLOCKS,
        activeIds
      );

      if (source.includes('uMilkwaveEnabled')) {
        failures.push(`${presetPath}: included unrelated Milkwave uniforms`);
        continue;
      }
      if (source.includes('uVizSpectrumEnabled')) {
        failures.push(`${presetPath}: included visualizer placeholder uniforms`);
        continue;
      }
      if (activeIds.size > 0) {
        const firstActiveBlock = GENERATOR_SHADER_BLOCKS.find((block) => activeIds.has(block.id));
        const firstUniform = firstActiveBlock?.uniforms.split('\n').find(Boolean);
        if (firstUniform && !source.includes(firstUniform)) {
          failures.push(`${presetPath}: missing active block uniforms for ${firstActiveBlock!.id}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  v1TemplatePaths.forEach((templatePath) => {
    it(`loads v1.0 template ${templatePath}`, () => {
      const template = JSON.parse(gitShow(`v1.0:${templatePath}`));
      expect(template.scenes.length).toBeGreaterThan(0);
    });
  });
});
