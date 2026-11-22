// Compile report for every MilkDrop scene in a show: which scenes run their
// warp/comp shaders as authored and which fall back.
// Usage: npm run build && ts-node --transpile-only scripts/check-show-shaders.ts [show.json]
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
const file = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? path.join(os.homedir(), 'Documents/visualsynth-show-2026-11-21.json');
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
(async () => {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const project = raw.project ?? raw;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  let errs: string[] = [];
  const verbose = process.argv.includes('--lines');
  page.on('console', async (m) => {
    const t = m.text();
    if (/ERROR: 0:/.test(t)) errs.push(t.split('\n')[0].replace(/^.*ERROR: /, '').slice(0, 110));
    if (verbose && /Shader lines around errors/.test(t)) {
      const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '')));
      console.log('LINES', JSON.stringify(args).slice(0, 1500));
    }
  });
  await page.evaluateOnNewDocument(() => {
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])), setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true }) };
    (window as any).__vsDisablePrewarm = true;
  });
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 2000));
  const bad: string[] = [];
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split('|');
  for (const scene of project.scenes.filter((s: any) => s._shaderData && (!only || only.some((o) => s.name.startsWith(o))))) {
    errs = [];
    try {
      await withTimeout(page.evaluate((i: string) => (window as any).__visualSynthCaptureApi.applyScene(i), scene.id), 20000);
      await new Promise((r) => setTimeout(r, 1500));
      const rep = await withTimeout(page.evaluate(() => { const c = (window as any).__visualSynthCaptureApi.getDiagnostics().milkdropCompileReport; return c ? { warp: c.warp?.status, comp: c.comp?.status } : null; }), 20000);
      const ok = rep && ['success', 'not_requested'].includes(rep.warp) && ['success', 'not_requested'].includes(rep.comp);
      if (!ok) bad.push(scene.name);
      console.log(`${ok ? 'ok  ' : 'FALL'} ${String(scene.name).slice(0, 44).padEnd(44)} warp=${rep?.warp} comp=${rep?.comp}${errs.length ? '  ' + errs[0] : ''}`);
    } catch (e) {
      bad.push(scene.name);
      console.log(`HUNG ${scene.name}: ${String(e).slice(0, 60)}`);
      break;
    }
  }
  console.log(`\n${bad.length} scene(s) not running as authored: ${bad.join(' | ')}`);
  await browser.close();
  process.exit(0);
})();
