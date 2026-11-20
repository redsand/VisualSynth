// Live render-health probe against the running app (remote debugging :9222).
import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  console.log('windows:', pages.map((p) => p.url().split('/').pop()));
  for (const page of pages) {
    const s = await page.evaluate(() => new Promise((res) => {
      const t0 = performance.now(); let n = 0;
      const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(n / 2); };
      requestAnimationFrame(tick);
      setTimeout(() => res(n / 2), 4000);
    }).then((raf) => ({
      raf,
      fpsLabel: document.getElementById('health-fps')?.textContent ?? null,
      pause: document.getElementById('transport-pause')?.textContent ?? null,
      status: document.getElementById('status')?.textContent?.slice(0, 100) ?? null,
      visibility: document.visibilityState,
      focus: document.hasFocus()
    })));
    console.log(page.url().split('/').pop(), JSON.stringify(s));
  }
  browser.disconnect(); process.exit(0);
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
