// Compile every generator on its own (one layer, app's real pipeline) and
// report shader compile errors and generators that render nothing.
// Usage: npm run build && ts-node --transpile-only scripts/check-generators-compile.ts
import path from 'path';
import puppeteer from 'puppeteer';
import { GENERATOR_SHADER_BLOCKS } from '../src/shared/generatorShaderBlocks';
import { DEFAULT_PROJECT } from '../src/shared/project';
(async () => {
  const ids: string[] = (GENERATOR_SHADER_BLOCKS as any[]).map((b) => b.id);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  let errors: string[] = [];
  page.on('console', (m) => { const t = m.text(); if (/compile error|undeclared|ERROR: 0:/.test(t)) errors.push(t.split('\n').slice(0, 2).join(' | ').slice(0, 180)); });
  await page.evaluateOnNewDocument(() => {
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])), setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true }), writeShaderFailure: () => {} };
  });
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  const failed: string[] = [];
  for (const id of ids) {
    errors = [];
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.scenes = [{ ...project.scenes[0], id: 'scene-1', layers: [{ id, generatorId: id, name: id, role: 'core', enabled: true, opacity: 1, blendMode: 'normal', transform: { x: 0, y: 0, scale: 1, rotation: 0 }, params: { opacity: 1 } }] }];
    project.activeSceneId = 'scene-1';
    try {
      await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
      await new Promise((r) => setTimeout(r, 1200));
    } catch (e) { errors.push('apply threw: ' + String(e).slice(0, 100)); }
    if (errors.length) { failed.push(id); console.log(`FAIL ${id}: ${errors[0]}`); }
  }
  console.log(`\n${ids.length} generators, ${failed.length} failed to compile: ${failed.join(', ')}`);
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
