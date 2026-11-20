// Hot-patch a RUNNING VisualSynth (remote debugging :9222) so bare Space can
// never pause the visuals or start the live playlist — Serato DJ owns the
// spacebar. Builds from 0.9.4-post-fix ship this as Shift+Space natively;
// this patch covers a session already in progress without a restart.
import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = (await browser.pages()).find((p) => p.url().includes('index.html'))!;
  const r = await page.evaluate(() => {
    if ((window as any).__vsSpaceGuard) return 'already patched';
    (window as any).__vsSpaceGuard = true;
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t?.isContentEditable) return;
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
    return 'patched';
  });
  console.log('spacebar guard:', r);
  // verify: dispatch a bare Space and confirm the transport is untouched
  const before = await page.evaluate(() => document.getElementById('transport-pause')?.textContent);
  await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })));
  await new Promise((res) => setTimeout(res, 300));
  const after = await page.evaluate(() => document.getElementById('transport-pause')?.textContent);
  console.log(`bare Space test: transport ${before} -> ${after} ${before === after ? '(unaffected — guard works)' : '(CHANGED — guard failed)'}`);
  browser.disconnect(); process.exit(0);
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
