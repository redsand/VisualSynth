import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const buildScriptPath = path.join(repoRoot, 'scripts', 'build-renderer.js');
const indexPath = path.join(repoRoot, 'src', 'renderer', 'index.ts');
const bootstrapPath = path.join(repoRoot, 'src', 'renderer', 'bootstrap.ts');
const renderGraphPath = path.join(repoRoot, 'src', 'renderer', 'render', 'RenderGraph.ts');
const storeRendererPath = path.join(repoRoot, 'src', 'renderer', 'render', 'Renderer.ts');
const outputPath = path.join(repoRoot, 'src', 'renderer', 'output.ts');
const startupApplyPath = path.join(repoRoot, 'src', 'renderer', 'startupProjectApply.ts');
const unificationDocPath = path.join(repoRoot, 'docs', 'RENDERER_ENTRYPOINT_UNIFICATION.md');

describe('renderer architecture', () => {
  it('defaults to shipped renderer index.ts and supports bootstrap override', () => {
    const script = fs.readFileSync(buildScriptPath, 'utf-8');
    expect(script).toContain("const entryArg = process.argv.find((arg) => arg.startsWith('--entry='));");
    expect(script).toContain("const requestedEntry = entryArg ? entryArg.split('=')[1] : null;");
    expect(script).toContain("const rendererEntry = requestedEntry === 'bootstrap' ? 'bootstrap' : 'index';");
    expect(script).toContain("const rendererEntryPath = path.join(srcDir, `${rendererEntry}.ts`);");
    expect(script).toContain("entryPoints: [");
    expect(script).toContain("{ in: rendererEntryPath, out: 'index' }");
    expect(script).toContain("{ in: path.join(srcDir, 'output.ts'), out: 'output' }");
    expect(script).toContain("entryNames: '[name]'");
  });

  it('documents index.ts as the shipped renderer entrypoint', () => {
    const indexSource = fs.readFileSync(indexPath, 'utf-8');
    expect(indexSource).toContain('default browser entrypoint');
  });

  it('documents bootstrap.ts as the fallback renderer path', () => {
    const bootstrapSource = fs.readFileSync(bootstrapPath, 'utf-8');
    expect(bootstrapSource).toContain('minimal/fallback entrypoint');
  });

  it('tracks the split and target architecture in the unification doc', () => {
    const doc = fs.readFileSync(unificationDocPath, 'utf-8');
    expect(doc).toContain('Current State');
    expect(doc).toContain('index.ts');
    expect(doc).toContain('src/renderer/index.ts');
    expect(doc).toContain('bootstrap.ts');
  });

  it('uses shared startup selection application in both entry wrappers', () => {
    const indexSource = fs.readFileSync(indexPath, 'utf-8');
    const bootstrapSource = fs.readFileSync(bootstrapPath, 'utf-8');
    const startupApplySource = fs.readFileSync(startupApplyPath, 'utf-8');

    expect(startupApplySource).toContain('export const applyStartupSelection');
    expect(indexSource).toContain("import { applyStartupSelection } from './startupProjectApply'");
    expect(bootstrapSource).toContain("import { applyStartupSelection } from './startupProjectApply'");
    expect(indexSource).toContain('await applyStartupSelection(startupSelection');
  });

  it('routes bootstrap scene activation through shared scene runtime resolution', () => {
    const bootstrapSource = fs.readFileSync(bootstrapPath, 'utf-8');
    expect(bootstrapSource).toContain("import { applySceneActivationRuntime, resolveSceneActivationRuntime } from './sceneRuntime'");
    expect(bootstrapSource).toContain("import { compileSceneShaders, primeProjectShaders } from './shaderLifecycle'");
    expect(bootstrapSource).toContain('const activation = resolveSceneActivationRuntime(store.getState().project, sceneId);');
    expect(bootstrapSource).toContain('const runtime = applySceneActivationRuntime(activation, {');
    expect(bootstrapSource).toContain('compileSceneShaders: (scene, project) =>');
    expect(bootstrapSource).toContain('actions.setProject(store, activation.project);');
  });

  it('uses shared output session initialization in both entry wrappers', () => {
    const indexSource = fs.readFileSync(indexPath, 'utf-8');
    const bootstrapSource = fs.readFileSync(bootstrapPath, 'utf-8');
    expect(indexSource).toContain("import { initializeOutputSession } from './outputSessionRuntime'");
    expect(bootstrapSource).toContain("import { initializeOutputSession } from './outputSessionRuntime'");
    expect(indexSource).toContain('await initializeOutputSession(window.visualSynth');
    expect(bootstrapSource).toContain('await initializeOutputSession(window.visualSynth');
  });

  it('keeps runtime-critical helper imports aligned across wrappers', () => {
    const indexSource = fs.readFileSync(indexPath, 'utf-8');
    const bootstrapSource = fs.readFileSync(bootstrapPath, 'utf-8');

    expect(indexSource).toContain("import { applyStartupSelection } from './startupProjectApply'");
    expect(bootstrapSource).toContain("import { applyStartupSelection } from './startupProjectApply'");

    expect(indexSource).toContain("import { applyLoadableProjectRuntime } from './projectApplyRuntime'");

    expect(indexSource).toContain("import { applySceneActivationRuntime, resolveSceneActivationRuntime } from './sceneRuntime'");
    expect(bootstrapSource).toContain("import { applySceneActivationRuntime, resolveSceneActivationRuntime } from './sceneRuntime'");

    expect(indexSource).toContain("import { initializeOutputSession } from './outputSessionRuntime'");
    expect(bootstrapSource).toContain("import { initializeOutputSession } from './outputSessionRuntime'");

    expect(indexSource).toContain("import { compileSceneShaders, primeProjectShaders } from './shaderLifecycle'");
    expect(bootstrapSource).toContain("import { compileSceneShaders, primeProjectShaders } from './shaderLifecycle'");

    expect(indexSource).toContain("import { ensureVisualSynthBridge } from './visualSynthBridge'");
    expect(bootstrapSource).toContain("import { ensureVisualSynthBridge } from './visualSynthBridge'");
    expect(indexSource).toContain('ensureVisualSynthBridge(window);');
    expect(bootstrapSource).toContain('ensureVisualSynthBridge(window);');
  });

  it('routes renderer output payload composition through shared helper in both runtime paths', () => {
    const indexSource = fs.readFileSync(indexPath, 'utf-8');
    const storeRendererSource = fs.readFileSync(storeRendererPath, 'utf-8');

    expect(indexSource).toContain("import { buildRendererOutputBroadcastPayload } from './render/outputPayload'");
    expect(indexSource).toContain('buildRendererOutputBroadcastPayload({');
    expect(storeRendererSource).toContain("import { buildRendererOutputBroadcastPayload } from './outputPayload'");
    expect(storeRendererSource).toContain('buildRendererOutputBroadcastPayload({');
  });

  it('exposes bootstrap capture API parity hooks for project/scene apply and diagnostics', () => {
    const bootstrapSource = fs.readFileSync(bootstrapPath, 'utf-8');
    expect(bootstrapSource).toContain("import { buildCaptureDiagnostics } from './captureDiagnostics'");
    expect(bootstrapSource).toContain('(window as any).__visualSynthCaptureApi = {');
    expect(bootstrapSource).toContain('applyProject: async (project: VisualSynthProject, options: { skipRecovery?: boolean } = {}) =>');
    expect(bootstrapSource).toContain('getDiagnostics: () => {');
    expect(bootstrapSource).toContain('applyScene: (sceneId: string) => {');
    expect(bootstrapSource).toContain("setMode: (mode: 'performance' | 'scene' | 'design' | 'system') => {");
    expect(bootstrapSource).toContain('(window as any).__visualSynthInitialized = true;');
    expect(bootstrapSource).toContain('renderGraph.handlePadAction(action, velocity);');
  });

  it('keeps shipped index renderer engine finish neutral when no engine is active', () => {
    const indexSource = fs.readFileSync(indexPath, 'utf-8');
    expect(indexSource).toContain("const hasActiveEngine = Boolean(currentProject.activeEngineId && currentProject.activeEngineId !== 'engine-none');");
    expect(indexSource).toContain("engineGrain: (currentProject as any).engineFinish?.grain ?? (hasActiveEngine ? 0.2 : 0),");
    expect(indexSource).toContain("engineVignette: (currentProject as any).engineFinish?.vignette ?? (hasActiveEngine ? 1.0 : 0),");
    expect(indexSource).toContain("engineCA: (currentProject as any).engineFinish?.ca ?? (hasActiveEngine ? 0.3 : 0),");
    expect(indexSource).toContain("(currentProject as any).engineFinish = { grain: 0, vignette: 0, ca: 0 };");
  });

  it('starts output renderer with neutral engine finish defaults', () => {
    const outputSource = fs.readFileSync(outputPath, 'utf-8');
    expect(outputSource).toContain('engineGrain: 0,');
    expect(outputSource).toContain('engineVignette: 0,');
    expect(outputSource).toContain('engineCA: 0,');
  });

  it('keeps shipped index beat-detection defaults aligned with v1 full-spectrum behavior', () => {
    const indexSource = fs.readFileSync(indexPath, 'utf-8');
    expect(indexSource).toContain("let beatFilterRange: 'full' | 'bass' | 'mids' = 'full';");
    expect(indexSource).toContain('let beatHoldOffMs = 0;');
    expect(indexSource).toContain('beatHoldOffMs = Number(beatHoldOffInput.value) || 0;');
  });

  it('keeps bootstrap render graph defaults aligned with shipped index core layer behavior', () => {
    const renderGraphSource = fs.readFileSync(renderGraphPath, 'utf-8');
    expect(renderGraphSource).toContain("const spectrumEnabled = spectrumLayer?.enabled ?? false;");
    expect(renderGraphSource).toContain("findLayerById(activeScene?.layers, 'gen-8bit-grid')");
  });

});
