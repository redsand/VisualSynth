// Live end-to-end check against the REAL running app (not a headless dist):
// launch VisualSynth with `open -a VisualSynth --args --remote-debugging-port=9222`,
// play music near the mic, then run this. It drives the actual UI and reads
// the actual session log, proving the listening chain works in the room:
//   transport playing → mic heard → BPM locked → Detect Song → song identified.
//
// Usage: ts-node --transpile-only scripts/live-session-check.ts [--detect] [--provider=audd|shazam|custom|acrcloud]
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';

const LOG_DIR = path.join(os.homedir(), 'Library/Application Support/VisualSynth/logs');
const DO_DETECT = process.argv.includes('--detect');
const providerArg = process.argv.find((a) => a.startsWith('--provider='));
const PROVIDER = providerArg ? providerArg.slice('--provider='.length) : null;

const latestLog = (): string | null => {
  const files = fs.readdirSync(LOG_DIR).filter((f) => /^session-.*\.jsonl$/.test(f))
    .map((f) => ({ f, m: fs.statSync(path.join(LOG_DIR, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return files[0] ? path.join(LOG_DIR, files[0].f) : null;
};

const logEvents = (sinceMs: number, pattern: RegExp) => {
  const file = latestLog();
  if (!file) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e) => e && e.ts >= sinceMs && pattern.test(e.event));
};

const main = async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = (await browser.pages()).find((p) => p.url().includes('index.html'));
  if (!page) throw new Error('VisualSynth main window not found on :9222');
  const started = Date.now();

  const read = () => page.evaluate(() => ({
    paused: (document.getElementById('transport-pause') as HTMLButtonElement)?.textContent?.trim() === 'Resume',
    bpm: (document.getElementById('transport-bpm') as HTMLInputElement)?.value || '(empty)',
    bpmState: (document.getElementById('transport-bpm-state') as HTMLElement)?.textContent?.trim(),
    bpmStateClass: (document.getElementById('transport-bpm-state') as HTMLElement)?.className,
    audioLatency: (document.getElementById('diag-latency') as HTMLElement)?.textContent?.trim(),
    device: (document.getElementById('audio-device') as HTMLSelectElement)?.selectedOptions[0]?.textContent?.trim(),
    status: (document.getElementById('status') as HTMLElement)?.textContent?.trim()?.slice(0, 120),
    scenes: (window as any).__visualSynthCaptureApi?.getCurrentProject?.()?.scenes?.length ?? 0
  }));

  let s = await read();
  console.log('initial:', JSON.stringify(s));
  if (s.paused) {
    console.log('transport PAUSED — resuming (pausing freezes all audio analysis)');
    await page.evaluate(() => (document.getElementById('transport-pause') as HTMLButtonElement)?.click());
  }

  if (PROVIDER) {
    const r = await page.evaluate((prov: string) => {
      (document.getElementById('now-playing-configure') as HTMLButtonElement)?.click();
      const sel = document.getElementById('now-playing-provider') as HTMLSelectElement | null;
      if (!sel) return 'provider select missing';
      sel.value = prov;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      (document.getElementById('now-playing-save') as HTMLButtonElement)?.click();
      return `provider -> ${sel.value}`;
    }, PROVIDER);
    console.log(r);
  }

  // Let BPM settle on the live music
  for (let i = 0; i < 6; i += 1) {
    await new Promise((r) => setTimeout(r, 4000));
    s = await read();
    console.log(`t=${(i + 1) * 4}s bpm=${s.bpm} state=${s.bpmState} (${s.bpmStateClass}) latency=${s.audioLatency}`);
  }

  if (DO_DETECT) {
    const detectAt = Date.now();
    const clicked = await page.evaluate(() => {
      const b = document.getElementById('transport-detect') as HTMLButtonElement | null;
      if (!b) return false;
      b.click();
      return true;
    });
    console.log(clicked ? '\nclicked Detect Song' : '\nDetect Song button MISSING');
    let result = '';
    for (let i = 0; i < 20 && clicked; i += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await read();
      const btn = await page.evaluate(() => (document.getElementById('transport-detect') as HTMLButtonElement)?.textContent?.trim());
      if (btn === 'Detect Song' && st.status && !/Identifying/.test(st.status)) { result = st.status; break; }
    }
    const overlay = await page.evaluate(() => {
      const p = (window as any).__visualSynthCaptureApi?.getCurrentProject?.();
      return p?.overlays?.find?.((o: { id?: string }) => o.id === 'now-playing-title')?.text ?? null;
    });
    console.log('detect result status:', result || '(timed out)');
    console.log('title overlay:', overlay ? String(overlay).replace(/\n/g, ' / ') : '(none)');
    for (const e of logEvents(detectAt, /^song\./)) {
      console.log('  log:', e.event, JSON.stringify(e.data).slice(0, 140));
    }
  }

  console.log('\nsession-log events since check start:');
  for (const e of logEvents(started, /^(song\.|audio\.bpm|perf\.fps_governor|shader\.)/).slice(-12)) {
    console.log('  ', e.event, JSON.stringify(e.data).slice(0, 120));
  }
  browser.disconnect();
  process.exit(0);
};
main().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
