// Pre-show verification for the quality-showcase project built by
// scripts/build-quality-showcase.ts. Boots the SHIPPED dist headless with the
// same environment mocks as ui-proof, applies the built project through the
// real capture API, then cycles every scene checking the app's own
// diagnostics: no shader errors, no safe-mode fallbacks, warp+comp compiled.
//
// Usage: ts-node --transpile-only scripts/verify-quality-showcase.ts
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { buildPresetIndexEntry } from '../src/shared/presetIndex';

const ROOT = path.resolve(__dirname, '..');
const PROJECT_PATH = path.join(ROOT, 'showcase-quality-tonight.project.json');
const PRESET_DIR = path.join(ROOT, 'assets/presets');
const DIST = 'file://' + path.join(ROOT, 'dist/renderer/index.html');
const WAV = path.join(__dirname, 'test-audio-fake.wav');
// --only <name-substring>[,<name-substring>...] restricts the cycle to matching
// scenes; --settle <ms> overrides the per-scene settle wait (headless first
// compile of a heavy warp shader can stall frames — give it room).
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY: string[] | null = onlyArg ? onlyArg.slice(7).split(',') : null;
const settleArg = process.argv.find((a) => a.startsWith('--settle='));
const SETTLE_MS = settleArg ? Number(settleArg.slice(9)) : 1400;

const main = async () => {
  const project = JSON.parse(fs.readFileSync(PROJECT_PATH, 'utf8'));
  console.log(`project "${project.name}": ${project.scenes.length} scenes, activePalette=${project.activePaletteId}`);

  // preset library mock (same as ui-proof) — presetPath scenes resolve their
  // shader data from the scene itself, but the browser list must be healthy
  const files = fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith('.json'));
  const entries: unknown[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PRESET_DIR, file), 'utf8'));
      entries.push(buildPresetIndexEntry(path.join(PRESET_DIR, file), data));
    } catch { /* unreadable -> stub entry in the real app */ }
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream'
    ]
  });
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 200)}`));

  const wavBase64 = fs.existsSync(WAV) ? fs.readFileSync(WAV).toString('base64') : '';
  await page.evaluateOnNewDocument((lib: unknown[], wav: string) => {
    (window.navigator as any).requestMIDIAccess = async () => ({
      inputs: new Map(), outputs: new Map(), onstatechange: null, sysexEnabled: false
    });
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia = async () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        if (wav) {
          try {
            const binary = atob(wav);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            const buffer = await audioContext.decodeAudioData(bytes.buffer);
            if (audioContext.state === 'suspended') await audioContext.resume();
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(destination);
            source.start();
          } catch { /* silent stream is fine */ }
        }
        return destination.stream;
      };
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [
        { deviceId: 'default', kind: 'audioinput', label: 'Synthetic WAV Audio Source' }
      ];
    }
    window.visualSynth = {
      ...(window.visualSynth ?? {}),
      listPresets: async () => lib as never[],
      onCloseRequested: (cb: () => void) => { (window as any).__mockOnCloseRequested = cb; },
      showSaveDialog: async () => ({ result: 'cancel' }),
      saveProject: async () => ({ canceled: true }),
      saveProjectAs: async () => ({ canceled: true }),
      confirmClose: async () => {},
    } as any;
  }, entries, wavBase64);

  await page.goto(DIST, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthCaptureApi?.applyProject), { timeout: 60000 });

  // apply the built project through the real path
  await page.evaluate(async (p: unknown) => {
    await (window as any).__visualSynthCaptureApi.applyProject(p);
  }, project);
  await new Promise((r) => setTimeout(r, 4000));

  const applied = await page.evaluate(() => {
    const p = (window as any).__visualSynthCaptureApi.getCurrentProject();
    return { sceneCount: p.scenes.length, activeSceneId: p.activeSceneId, name: p.name };
  });
  const sceneCountOk = applied.sceneCount === project.scenes.length;
  console.log(`${sceneCountOk ? 'PASS' : 'FAIL'}  project applied — ${applied.sceneCount}/${project.scenes.length} scenes, active=${applied.activeSceneId}`);

  // cycle every scene, checking the app's own render diagnostics
  const bad: string[] = [];
  const sceneIds: string[] = project.scenes
    .map((s: any, i: number) => ({ id: s.id as string, name: s.name as string, index: i }))
    .filter((s: { id: string; name: string; index: number }) =>
      !ONLY || ONLY.some((q) => s.name.toLowerCase().includes(q)))
    .map((s: { id: string }) => s.id);
  const nameById = new Map<string, { name: string; index: number }>(
    project.scenes.map((s: any, i: number) => [s.id, { name: s.name as string, index: i }])
  );
  for (let i = 0; i < sceneIds.length; i += 1) {
    const diag = await page.evaluate(async (sceneId: string, settleMs: number) => {
      (window as any).__visualSynthCaptureApi.applyScene(sceneId);
      await new Promise((r) => setTimeout(r, settleMs));
      return (window as any).__visualSynthCaptureApi.getDiagnostics();
    }, sceneIds[i], SETTLE_MS);
    const problems: string[] = [];
    if (diag.lastShaderError) problems.push(`shaderError: ${String(diag.lastShaderError).slice(0, 80)}`);
    if (Array.isArray(diag.safeModeReasons) && diag.safeModeReasons.length > 0) {
      problems.push(`safeMode: ${diag.safeModeReasons.join('|').slice(0, 80)}`);
    }
    const compile = diag.milkdropCompileReport ?? {};
    for (const stage of ['warp', 'comp'] as const) {
      const status = compile[stage]?.status;
      if (status && status !== 'success' && status !== 'not_present') {
        problems.push(`${stage} compile: ${status}`);
      }
    }
    const meta = nameById.get(sceneIds[i]) ?? { name: `scene ${i}`, index: i };
    const label = meta.name;
    if (problems.length > 0) {
      bad.push(label);
      console.log(`FAIL  ${meta.index + 1}. ${label} — ${problems.join(' | ')}`);
    } else {
      console.log(`PASS  ${meta.index + 1}. ${label}`);
    }
  }

  const realErrors = consoleErrors.filter((e) => !/favicon|net::ERR|ResizeObserver/.test(e));
  console.log(`${realErrors.length === 0 ? 'PASS' : 'FAIL'}  no console errors ${realErrors.length ? `(${realErrors.slice(0, 3).join(' | ')})` : ''}`);

  await browser.close();
  const failed = (!sceneCountOk ? 1 : 0) + bad.length + (realErrors.length > 0 ? 1 : 0);
  const total = ONLY ? sceneIds.length : project.scenes.length;
  console.log(`\nSHOWCASE VERIFY: ${total - bad.length}/${total} scenes clean${bad.length ? ` — FAILED scenes: ${bad.join(', ')}` : ''}`);
  process.exit(failed ? 1 : 0);
};

main();