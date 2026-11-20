// Trace what the live app's renderer is doing for a few seconds: console
// output (compiles, errors), canvas sizes, program cache growth, frame times.
import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = (await browser.pages()).find((p) => p.url().includes('index.html'))!;
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 160)}`));
  const before = await page.evaluate(() => {
    const c = document.querySelector('#gl-canvas') as HTMLCanvasElement;
    const api = (window as any).__visualSynthCaptureApi;
    const d = api?.getDiagnostics?.() ?? {};
    const p = api?.getCurrentProject?.();
    const scene = p?.scenes?.find((s: any) => s.id === p.activeSceneId);
    return {
      canvas: `${c?.width}x${c?.height}`, client: `${c?.clientWidth}x${c?.clientHeight}`, dpr: devicePixelRatio,
      scene: scene?.name, layers: (scene?.layers ?? []).map((l: any) => l.generatorId ?? l.id),
      hasShaderData: Boolean(scene?._shaderData),
      programCache: d.programCacheSize ?? d.renderSnapshot?.programCacheSize ?? '?',
      safeMode: d.safeModeReasons ?? [], shaderErr: d.lastShaderError ? String(d.lastShaderError).slice(0, 120) : null
    };
  });
  console.log('before:', JSON.stringify(before));
  // frame-time sampling
  const ft = await page.evaluate(() => new Promise<number[]>((res) => {
    const out: number[] = []; let last = performance.now();
    const tick = (t: number) => { out.push(Math.round(t - last)); last = t; if (out.length < 6) requestAnimationFrame(tick); else res(out); };
    requestAnimationFrame(tick);
    setTimeout(() => res(out), 15000);
  }));
  console.log('frame intervals (ms):', ft.join(', '));
  console.log('console during trace:');
  const counts = new Map<string, number>();
  for (const l of logs) counts.set(l.slice(0, 90), (counts.get(l.slice(0, 90)) ?? 0) + 1);
  [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log(`  x${v} ${k}`));
  browser.disconnect(); process.exit(0);
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
