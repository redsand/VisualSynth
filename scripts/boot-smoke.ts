// Boot smoke: boots dist headless with NO audio mocks and reports init
// errors — used to isolate app-boot failures from harness noise.
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(__dirname, '..');
const DIST = 'file://' + path.join(ROOT, 'dist/renderer/index.html');

const main = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400) console.log(`[HTTP ${r.status()}]`, r.url().slice(-90)); });
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || /\[Init\]|shader|Shader|compile/i.test(t)) console.log(`[${m.type()}]`, t.slice(0, 220));
  });
  await page.goto(DIST, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 45000 });
    console.log('INIT OK');
  } catch {
    console.log('INIT TIMED OUT');
  }
  await browser.close();
  process.exit(0);
};
main().catch((e) => { console.error(e); process.exit(1); });
