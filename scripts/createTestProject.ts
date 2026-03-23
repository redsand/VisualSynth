import fs from 'fs';
import path from 'path';
import { DEFAULT_PROJECT } from '../src/shared/project';

const presetsDir = path.resolve(__dirname, '../assets/presets');
const presetFiles = fs.readdirSync(presetsDir).filter(f => f.includes('-milkwave-'));

// Try to pick a diverse set of 20 presets.
// We can just take the first 20 or pick some evenly distributed ones.
const step = Math.floor(presetFiles.length / 20);
const selectedFiles = [];
for (let i = 0; i < 20; i++) {
  selectedFiles.push(presetFiles[i * step]);
}

const project: any = {
  ...DEFAULT_PROJECT,
  name: "Milkwave 20-Preset Test",
  scenes: []
};

let sceneIndex = 1;
for (const file of selectedFiles) {
  const presetContent = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
  const presetData = JSON.parse(presetContent);
  
  const presetScene = presetData.scenes[0];
  if (presetScene) {
    // Re-ID the scene to ensure uniqueness
    presetScene.id = `scene-${sceneIndex}`;
    presetScene.name = presetData.metadata?.name || file.replace('.json', '');
    // Ensure shader data is there
    if (presetData._shaderData) {
      presetScene._shaderData = presetData._shaderData;
    }
    if (presetScene.layers && presetScene.layers.length > 0) {
      presetScene.layers[0].generatorId = 'gen-milkwave';
    }
    project.scenes.push(presetScene);
    sceneIndex++;
  }
}

if (project.scenes.length > 0) {
  project.activeSceneId = project.scenes[0].id;
}

const outPath = path.resolve(__dirname, '../milkwave-test-20.project.json');
fs.writeFileSync(outPath, JSON.stringify(project, null, 2), 'utf-8');
console.log(`Created test project with ${project.scenes.length} scenes at ${outPath}`);
