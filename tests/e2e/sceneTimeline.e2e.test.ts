import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const shouldRun = process.env.RUN_E2E === '1';
const distHtml = path.resolve('dist/renderer/index.html');

const maybe = shouldRun && existsSync(distHtml) ? it : it.skip;

describe('E2E scene timeline smoke', () => {
  maybe('shows timeline items in rendered app', async () => {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--disable-gpu', '--no-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(pathToFileURL(distHtml).href, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.scene-timeline', { timeout: 10000 });
    const count = await page.$$eval('.scene-timeline-item', (items) => items.length);
    await browser.close();
    expect(count).toBeGreaterThan(0);
  }, 15000);
});
