import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { registerSdfNodes } from '../src/renderer/sdf/nodes';

describe('New Presets Smoke Test', () => {
  beforeAll(() => {
    registerSdfNodes();
  });

  const presetsDir = path.resolve(__dirname, '../assets/presets');
  const files = fs.readdirSync(presetsDir).filter(f => {
    const id = parseInt(f.split('-')[1]);
    return id >= 120 && id <= 150;
  });

  files.forEach(file => {
    it(`loads and builds state for ${file}`, () => {
      const store = createStore(createInitialState());
      const renderGraph = new RenderGraph(store);
      const preset = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf8'));
      
      // Merge preset into DEFAULT_PROJECT to ensure all fields are present
      const fullProject = {
        ...DEFAULT_PROJECT,
        ...preset
      };

      store.update((state: any) => {
        state.project = fullProject;
      });

      const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
      expect(renderState).toBeDefined();
      expect(renderState.timeMs).toBe(0);
    });
  });
});