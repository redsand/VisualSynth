// CPU-profile the live app's main window for N seconds and print the top
// self-time functions — finds main-thread stalls in a running session.
import puppeteer from 'puppeteer';
(async () => {
  const seconds = Number(process.argv[2] ?? 6);
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = (await browser.pages()).find((p) => p.url().includes('index.html'))!;
  const cdp = await page.createCDPSession();
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  await new Promise((r) => setTimeout(r, seconds * 1000));
  const { profile } = (await cdp.send('Profiler.stop')) as any;
  const self = new Map<number, number>();
  const dt = profile.timeDeltas as number[];
  (profile.samples as number[]).forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (dt[i] ?? 0)));
  const byFn = new Map<string, number>();
  for (const node of profile.nodes) {
    const t = self.get(node.id) ?? 0;
    if (!t) continue;
    const cf = node.callFrame;
    const key = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`;
    byFn.set(key, (byFn.get(key) ?? 0) + t);
  }
  const total = [...byFn.values()].reduce((a, b) => a + b, 0);
  console.log(`profiled ${seconds}s, sampled ${(total / 1000).toFixed(0)}ms`);
  [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([k, v]) => console.log(`${(v / 1000).toFixed(0).padStart(6)}ms ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`));
  // Callers of the hottest native frames (e.g. a blocking WebGL getter).
  const byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]));
  const parentOf = new Map<number, number>();
  for (const n of profile.nodes) for (const c of n.children ?? []) parentOf.set(c, n.id);
  const hotNative = profile.nodes.filter((n: any) => !n.callFrame.url && (self.get(n.id) ?? 0) > total * 0.05);
  for (const n of hotNative) {
    const chain: string[] = [];
    let p = parentOf.get(n.id);
    while (p !== undefined && chain.length < 6) {
      const cf = byId.get(p).callFrame;
      chain.push(`${cf.functionName || '(anon)'}:${cf.lineNumber + 1}`);
      p = parentOf.get(p);
    }
    console.log(`caller chain of ${n.callFrame.functionName} (${((self.get(n.id) ?? 0) / 1000).toFixed(0)}ms): ${chain.join(' <- ')}`);
  }
  await cdp.detach(); browser.disconnect(); process.exit(0);
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
