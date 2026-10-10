// Compile-only probe for milkwave shader fix iteration.
//
// The batch tester drives the full app (~14s/preset); for patcher fixes we
// only need "does the patched shader compile now, and if not, what are the
// driver error signatures". This script:
//   1. reads the raw warp/comp GLSL saved by a batch run
//      (milkwave-test-results/shaders/batch-<N>/),
//   2. runs it through the REAL runtime patcher (patchMilkDropGlsl),
//   3. compiles each stage in a headless Chromium WebGL2 context,
//   4. aggregates the normalized driver error signatures.
//
// Usage:
//   ts-node --transpile-only scripts/probe-compile.ts --list <file> [--batch 9221]
//   <file> holds one preset filename per line (e.g. tier-2 swizzle presets).
// Without --list, probes every preset with a saved shader in the batch dir.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer';
import { patchMilkDropGlsl } from '../src/shared/milkwaveGlslPatcher';

const readArg = (flag: string, def: string | null): string | null => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

const BATCH = readArg('--batch', '9221')!;
const LIST = readArg('--list', null);
const SHADER_DIR = path.resolve(__dirname, `../milkwave-test-results/shaders/batch-${BATCH}`);

const COMPILE_JS = (src: string) => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return { ok: false, log: 'no webgl2' };
  const sh = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  const ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS);
  const log = gl.getShaderInfoLog(sh) || '';
  return { ok, log };
};

const main = async () => {
  let names: string[];
  if (LIST) {
    names = fs.readFileSync(LIST, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
      .map((f) => f.replace(/\.json$/, ''));
  } else {
    names = [...new Set(fs.readdirSync(SHADER_DIR).map((f) => f.replace(/\.(warp|comp)\.glsl$/, '')))].sort();
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');

  const families: Record<string, number> = {};
  const byPreset: Record<string, string> = {};
  let compiled = 0;
  let clean = 0;
  let patchFail = 0;

  for (const name of names) {
    for (const stage of ['warp', 'comp'] as const) {
      const file = path.join(SHADER_DIR, `${name}.${stage}.glsl`);
      if (!fs.existsSync(file)) continue;
      let patched: string;
      try {
        patched = patchMilkDropGlsl(fs.readFileSync(file, 'utf-8'));
      } catch (e) {
        patchFail++;
        byPreset[`${name}(${stage})`] = `PATCHER THREW: ${String(e).slice(0, 120)}`;
        continue;
      }
      compiled++;
      const res = (await page.evaluate(COMPILE_JS, patched)) as { ok?: boolean; log?: string };
      if (res?.ok || !res?.log?.trim()) {
        clean++;
        continue;
      }
      const sigs = (res?.log ?? "").split('\n')
        .filter((l) => l.includes('ERROR'))
        .map((l) => l.replace(/^ERROR: \d+:\s*/, '').slice(0, 90));
      const sigKey = sigs.join(' | ') || res.log.slice(0, 120);
      families[sigKey] = (families[sigKey] ?? 0) + 1;
      byPreset[`${name}(${stage})`] = sigKey || String(res?.log).slice(0, 120);
    }
  }
  await browser.close();

  console.log(`probed ${names.length} presets, ${compiled} stages compiled, ${clean} clean, ${patchFail} patcher exceptions`);
  console.log('--- remaining error families:');
  Object.entries(families).sort((a, b) => b[1] - a[1]).slice(0, 30)
    .forEach(([k, v]) => console.log(String(v).padStart(4), k));
  if (process.argv.includes('--verbose')) {
    console.log('--- per preset:');
    for (const [k, v] of Object.entries(byPreset)) console.log(k, '=>', v);
  }
};

main();