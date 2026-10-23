// Pre-show UI proof: boot the SHIPPED dist bundle with the REAL preset
// library (entries built by the same buildPresetIndexEntry the Electron
// main process uses — only the IPC transport is mocked) and assert the
// live DOM reflects the certification chain:
//   1. app initializes, no console errors
//   2. "All" filter shows the full library count
//   3. "Showable" filter shows exactly the safe+degraded count
//   4. a broken-archive preset (blown_output 1691) shows its "needs fix"
//      badge under "All" and is EXCLUDED from "Showable"
//   5. clicking a showable preset selects it without errors
// Usage: ts-node --transpile-only scripts/ui-proof.ts
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { buildPresetIndexEntry } from '../src/shared/presetIndex';

const PRESET_DIR = path.resolve(__dirname, '../assets/presets');
const DIST = 'file://' + path.resolve(__dirname, '../dist/renderer/index.html');
const NEEDS_FIX_NAME = '02_mw_new03t4b'; // preset-1691, blown_output -> broken-archive
const WAV = path.resolve(__dirname, 'test-audio-fake.wav');

const main = async () => {
  // ── build the real library exactly as the main process does ──
  const files = fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith('.json'));
  const entries: unknown[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PRESET_DIR, file), 'utf8'));
      entries.push(buildPresetIndexEntry(path.join(PRESET_DIR, file), data));
    } catch {
      // unreadable preset -> main process serves a stub entry; skip for proof
    }
  }
  const typed = entries as Array<{ certification?: string; name?: string }>;
  const expectedShowable = typed.filter((e) => e.certification === 'safe' || e.certification === 'degraded').length;
  const expectedNeedsFix = typed.filter((e) => e.certification === 'archived').length;
  console.log(`library: ${entries.length} presets (main-process read), showable=${expectedShowable}, needs-fix=${expectedNeedsFix}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // without this headless Chrome blocks AudioContext.resume()/getUserMedia
      // and song detection hangs at "initializing" (see batch tester)
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
    // Same environment mocks the batch tester uses: synthetic mic (so song
    // detection initializes without a permission error), no MIDI devices.
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
          } catch { /* silent stream is fine for the UI proof */ }
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
  await page.waitForFunction(() => document.getElementById('preset-results-count')?.textContent !== '0 presets', { timeout: 60000 });

  const readCount = () =>
    page.$eval('#preset-results-count', (el) => el.textContent || '');
  const clickChip = (label: string) =>
    page.evaluate((l: string) => {
      const chip = Array.from(document.querySelectorAll('.preset-filter-chip')).find((b) => b.textContent === l);
      if (!chip) throw new Error(`filter chip "${l}" not found`);
      (chip as HTMLElement).click();
    }, label);
  const setSearch = (text: string) =>
    page.evaluate((t: string) => {
      const input = document.getElementById('preset-search') as HTMLInputElement;
      input.value = t;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);

  const results: Array<[string, boolean, string]> = [];
  const check = (name: string, ok: boolean, detail: string) => {
    results.push([name, ok, detail]);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  };

  // 2. All filter count
  await clickChip('All');
  const allCount = await readCount();
  check('All filter count', allCount.startsWith(`${entries.length} presets`), `"${allCount}"`);

  // 3. Showable filter count
  await clickChip('Showable');
  const showableCount = await readCount();
  check('Showable filter count', showableCount.startsWith(`${expectedShowable} presets`), `"${showableCount}" (expected ${expectedShowable})`);

  // 4a. needs-fix badge visible under All (the same search matches an
  // unswept edit of the preset — target the specific broken-archive file)
  await clickChip('All');
  await setSearch(NEEDS_FIX_NAME);
  const badge = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.preset-card'));
    const target = cards.find((c) => (c as HTMLElement).dataset.presetPath?.includes('preset-1691'));
    if (!target) return { found: false, cards: cards.length, badged: false };
    return { found: true, cards: cards.length, badged: Boolean(target.querySelector('.preset-tag.needs-fix')) };
  });
  check('needs-fix preset found + badged', badge.found && badge.badged,
    `cards=${badge.cards}, preset-1691 badged=${badge.badged}`);

  // 4b. integrity: broken preset NOT showable
  await clickChip('Showable');
  const excluded = await readCount();
  check('needs-fix preset excluded from Showable', excluded.trim() === '0 presets', `"${excluded}"`);
  await setSearch('');

  // 5. select a showable preset card
  await clickChip('Showable');
  const selected = await page.evaluate(() => {
    const card = document.querySelector('.preset-card') as HTMLElement | null;
    if (!card) return { ok: false, detail: 'no cards' };
    card.click();
    return { ok: true, detail: card.dataset.presetPath || 'no-path' };
  });
  await new Promise((r) => setTimeout(r, 1500));
  const selectedState = await page.evaluate(() => ({
    hasSelected: Boolean(document.querySelector('.preset-card.selected')),
    status: (document.getElementById('status')?.textContent || '').slice(0, 80),
  }));
  check('showable preset selectable', selected.ok && selectedState.hasSelected,
    `path=${selected.detail.slice(0, 60)}, selected=${selectedState.hasSelected}, status="${selectedState.status}"`);

  // 1. console errors (boot + all interactions above)
  const realErrors = consoleErrors.filter((e) => !/favicon|net::ERR|ResizeObserver/.test(e));
  check('no console errors', realErrors.length === 0, realErrors.length ? realErrors.slice(0, 3).join(' | ') : 'clean');

  await browser.close();
  const failed = results.filter(([, ok]) => !ok).length;
  console.log(`\nUI PROOF: ${results.length - failed}/${results.length} checks passed${failed ? ` — ${failed} FAILED` : ''}`);
  process.exit(failed ? 1 : 0);
};

main();