// E2E: the song ALREADY playing gets identified without any song change.
// (After the detector misfire fix, nothing identified the first song: lookups
// only ran on a detected change.) Fake music + a lookup service that answers.
// Usage: npm run build && ts-node --transpile-only scripts/check-initial-song-id.ts
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
(async () => {
  const wav = fs.readFileSync(path.join(__dirname, 'test-audio-fake.wav')).toString('base64');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((w: string) => {
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    navigator.mediaDevices.getUserMedia = async () => { const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination(); const buf = await ctx.decodeAudioData(Uint8Array.from(atob(w), (c) => c.charCodeAt(0)).buffer); await ctx.resume(); const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start(); return dest.stream; };
    (navigator.mediaDevices as any).enumerateDevices = async () => [{ deviceId: 'default', kind: 'audioinput', label: 'test mic' }];
    const settings: any = { enabled: true, provider: 'shazam', freeShazamFirst: true, autoCreateOverlays: true, slideshowEnabled: false, slideshowSceneIds: [], cooldownMs: 15000, changeThreshold: 0.15, confirmWindows: 2, minTrackMs: 30000, silenceThreshold: 0.025, market: 'US' };
    (window as any).__lookups = [];
    (window as any).visualSynth = {
      listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }),
      checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])),
      setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true }),
      getNowPlayingSettings: async () => settings, saveNowPlayingSettings: async (s: any) => Object.assign(settings, s),
      identifyNowPlaying: async () => { (window as any).__lookups.push(Date.now()); return { matched: true, title: 'Already Playing', artist: 'Test Artist', provider: 'Shazam' }; },
      enrichNowPlayingArtwork: async () => ({}), cacheNowPlayingArtwork: async () => ({ cached: false }), getEmbeddedArtwork: async () => ({}),
      getSessionId: async () => 'e2e', writeSessionLog: (e: unknown) => { ((window as any).__logs ??= []).push(e); }
    };
    (window as any).__vsDisablePrewarm = true;
  }, wav);
  // Headless Chromium cannot run the app's PCM clip capture, so the lookup
  // itself fails here (the real app captures fine). This checks the part that
  // was missing: an initial lookup fires once music has played ~15s, with no
  // song change, and not again within a minute.
  const initialAt: number[] = [];
  const t0 = Date.now();
  page.on('console', (m) => { if (m.text().includes('[InitialSongId] looking up')) initialAt.push(Math.round((Date.now() - t0) / 1000)); });
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 50000));
  const r = await page.evaluate(() => {
    const logs = ((window as any).__logs ?? []) as any[];
    return {
      lookups: (window as any).__lookups.length,
      triggers: logs.filter((e) => e.event === 'song.lookup_result').map((e) => e.data.trigger),
      changes: logs.filter((e) => e.event === 'song.change_detected').length,
      overlay: logs.filter((e) => e.event === 'overlay.track_text').map((e) => e.data.text),
      debug: logs.filter((e) => ['heartbeat', 'song.settings', 'song.lookup_skipped', 'audio.engine_init', 'audio.engine_failure'].includes(e.event)).map((e) => `${e.event} ${JSON.stringify(e.data).slice(0, 150)}`)
    };
  });
  console.log(`initial lookups fired at (s since load): ${JSON.stringify(initialAt)} | song changes detected: ${r.changes}`);
  const pass = initialAt.length === 1 && initialAt[0] >= 15 && initialAt[0] <= 35 && r.changes === 0;
  console.log(pass ? 'PASS' : 'FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
