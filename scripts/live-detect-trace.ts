// Press Detect Song in the live app and trace the whole lookup chain from the
// renderer console (Shazam fingerprint size, per-provider results).
import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = (await browser.pages()).find((p) => p.url().includes('index.html'))!;
  const lines: string[] = [];
  page.on('console', (m) => { const t = m.text(); if (/Now Playing|Shazam|AudD|PCM|identify/i.test(t)) lines.push(t.slice(0, 200)); });
  await page.evaluate(() => (document.getElementById('transport-detect') as HTMLButtonElement)?.click());
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const label = await page.evaluate(() => (document.getElementById('transport-detect') as HTMLButtonElement)?.textContent);
    if (label === 'Detect Song' && i > 1) break;
  }
  const out = await page.evaluate(() => ({
    status: document.getElementById('status')?.textContent,
    overlay: (window as any).__visualSynthCaptureApi?.getCurrentProject?.()?.overlays?.find?.((o: any) => o.id === 'now-playing-title')?.text
  }));
  lines.forEach((l) => console.log(' ', l));
  console.log('status:', out.status);
  console.log('overlay:', String(out.overlay ?? '').replace(/\n/g, ' / '));
  browser.disconnect(); process.exit(0);
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
