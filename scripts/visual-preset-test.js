#!/usr/bin/env node

/**
 * Visual milkwave tester - adds milkwave scenes to the running project.
 *
 * Usage:
 *   node scripts/visual-preset-test.js --presets 1000,1001
 *   node scripts/visual-preset-test.js --presets 1000 --duration 30
 *
 * Instead of applying a full project (which fails Zod validation),
 * this adds a milkwave scene to the current project and switches to it.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PRESETS_DIR = path.join(__dirname, '..', 'assets', 'presets');
const RENDERER_DIR = path.join(__dirname, '..', 'dist', 'renderer');
const SLEEP = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Simple static file server
const createServer = (dir) => {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.glsl': 'text/plain',
  };
  return http.createServer((req, res) => {
    let filePath = path.join(dir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
};

const args = process.argv.slice(2);
const readArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
};

const presetNumbers = (readArg('--presets', '1000,1001,1002,1003,1004') || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const durationSeconds = parseInt(readArg('--duration', '20'), 10) || 20;

const findPresetFile = (num) => {
  const prefix = `preset-${num}`;
  const files = fs.readdirSync(PRESETS_DIR);
  return files.find(f => f.startsWith(prefix) && f.endsWith('.json') && f.includes('milkwave'));
};

(async () => {
  console.log('=== Visual Milkwave Tester ===');
  console.log(`Presets: ${presetNumbers.join(', ')}`);
  console.log(`Duration per preset: ${durationSeconds}s\n`);

  // Start HTTP server
  const server = createServer(RENDERER_DIR);
  const PORT = 8765;
  await new Promise(r => server.listen(PORT, r));
  console.log(`Serving at http://localhost:${PORT}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ]
  });

  const page = await browser.newPage();
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(`http://localhost:${PORT}`, ['microphone']);

  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('Capture') || t.includes('milk') || t.includes('Milk') ||
        t.includes('Scene') || t.includes('Project') || t.includes('[TEST]') ||
        t.includes('Shader') || t.includes('init')) {
      console.log(`  [${msg.type().toUpperCase()}] ${t.substring(0, 200)}`);
    }
  });
  page.on('pageerror', err => {
    console.log(`  [ERROR] ${err.message.substring(0, 200)}`);
  });
  page.on('dialog', async dialog => {
    console.log(`  [DIALOG] ${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  const url = `http://localhost:${PORT}`;
  console.log(`Loading: ${url}\n`);

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });

  console.log('Waiting for capture API (up to 120s)...');
  let captureReady = false;
  for (let i = 0; i < 60; i++) {
    await SLEEP(2000);
    captureReady = await page.evaluate(() => !!window.__visualSynthCaptureApi?.applyProject);
    if (captureReady) {
      console.log('Capture API ready ✓\n');
      break;
    }
    if (i % 10 === 0) {
      const state = await page.evaluate(() => ({
        hasVS: !!window.visualSynth,
        hasInit: !!window.__visualSynthInitialized,
        hasCapture: !!window.__visualSynthCaptureApi,
        hasAP: !!window.__visualSynthCaptureApi?.applyProject,
      }));
      console.log(`  Poll ${i * 2}s: ${JSON.stringify(state)}`);
    }
  }
  if (!captureReady) {
    console.error('Capture API never became available');
    await browser.close();
    process.exit(1);
  }

  for (const num of presetNumbers) {
    const presetFile = findPresetFile(num);
    if (!presetFile) {
      console.log(`⏭️  Preset ${num}: not found\n`);
      continue;
    }

    console.log(`▶️  Preset ${num}: ${presetFile}`);
    const presetJson = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, presetFile), 'utf8'));

    // Extract shader data from the preset
    const rawSd = presetJson._shaderData || presetJson.scenes?.[0]?._shaderData;
    if (!rawSd) {
      console.log(`  ❌ No shader data found\n`);
      continue;
    }

    // Clean null values in arrays (prevents .trim() errors)
    const cleanArr = (arr) => Array.isArray(arr) ? arr.map(v => (v == null ? '' : String(v))) : [];
    const shaderData = {
      warp: rawSd.warp || null,
      comp: rawSd.comp || null,
      perFrameCode: cleanArr(rawSd.perFrameCode),
      perFrameInitCode: cleanArr(rawSd.perFrameInitCode),
      perPixelCode: cleanArr(rawSd.perPixelCode),
      waves: (rawSd.waves || []).map(w => ({
        ...w,
        initCode: cleanArr(w.initCode),
        perFrameCode: cleanArr(w.perFrameCode),
        perPointCode: cleanArr(w.perPointCode)
      })),
      shapes: (rawSd.shapes || []).map(s => ({
        ...s,
        initCode: cleanArr(s.initCode),
        perFrameCode: cleanArr(s.perFrameCode),
        perPointCode: cleanArr(s.perPointCode)
      })),
      textures: rawSd.textures || [],
      originalParameters: rawSd.originalParameters || {},
      translation: rawSd.translation || null
    };

    console.log(`  Shader: warp=${shaderData.warp ? shaderData.warp.length + ' chars' : 'NONE'}, comp=${shaderData.comp ? shaderData.comp.length + ' chars' : 'NONE'}`);

    try {
      // Add a milkwave scene to the CURRENT project (don't replace the whole project)
      const result = await page.evaluate(async (shaderData, presetName) => {
        const api = window.__visualSynthCaptureApi;
        if (!api) return { error: 'No capture API' };

        // Get current project
        const currentProject = api.getCurrentProject();
        if (!currentProject) return { error: 'No current project' };

        console.log('[TEST] Current project:', currentProject.name);
        console.log('[TEST] Current scenes:', currentProject.scenes?.length);

        // Build a minimal milkwave scene that matches VisualSynth's schema
        const sceneId = `milk-${Date.now()}`;
        const newScene = {
          id: sceneId,
          scene_id: sceneId,
          name: `Milkwave: ${presetName.substring(0, 40)}`,
          intent: 'ambient',
          duration: 0,
          transition_in: { durationMs: 0, type: 'fade' },
          transition_out: { durationMs: 0, type: 'fade' },
          trigger: { type: 'manual' },
          assigned_layers: {
            core: [],
            support: ['layer-milkwave'],
            atmosphere: []
          },
          layers: [
            {
              id: 'layer-milkwave',
              name: 'Milkwave',
              role: 'support',
              enabled: true,
              generatorId: 'gen-milkwave',
              opacity: 1.0,
              blendMode: 'screen',
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              params: {}
            }
          ],
          _shaderData: {
            warp: shaderData.warp || null,
            comp: shaderData.comp || null,
            perFrameCode: (shaderData.perFrameCode || []).filter(Boolean),
            perFrameInitCode: (shaderData.perFrameInitCode || []).filter(Boolean),
            perPixelCode: (shaderData.perPixelCode || []).filter(Boolean),
            waves: shaderData.waves || [],
            shapes: shaderData.shapes || [],
            textures: shaderData.textures || [],
            originalParameters: shaderData.originalParameters || {},
            translation: shaderData.translation || null
          }
        };

        console.log('[TEST] Adding milkwave scene:', newScene.name);
        console.log('[TEST] Scene layers:', JSON.stringify(newScene.layers.map(l => `${l.id}(gen=${l.generatorId})`)));
        console.log('[TEST] Shader data: warp=' + (newScene._shaderData.warp ? 'YES' : 'NO') + ', comp=' + (newScene._shaderData.comp ? 'YES' : 'NO'));

        // Add scene to current project
        currentProject.scenes.push(newScene);

        // Switch to the new scene
        await api.applyScene(sceneId);

        // Verify
        const updated = api.getCurrentProject();
        const active = updated?.scenes?.find(s => s.id === updated.activeSceneId);
        return {
          ok: true,
          sceneId,
          activeScene: active?.name || 'unknown',
          activeSceneId: updated?.activeSceneId,
          layers: active?.layers?.map(l => ({ id: l.id, gen: l.generatorId })) || [],
          hasShaderData: !!active?._shaderData,
          totalScenes: updated?.scenes?.length
        };
      }, shaderData, presetFile);

      if (result.error) {
        console.log(`  ❌ ${result.error}`);
        continue;
      }

      console.log(`  ✅ Scene added: ${result.activeScene} (${result.totalScenes} total scenes)`);
      console.log(`    Layers: ${result.layers.map(l => `${l.id}→${l.gen || 'NONE!'}`).join(', ')}`);
      console.log(`    Has shader data: ${result.hasShaderData}`);

      // Wait for shaders to compile
      await page.evaluate(async () => {
        for (let i = 0; i < 15; i++) {
          await new Promise(r => requestAnimationFrame(() => r()));
        }
      });

      const canvasInfo = await page.evaluate(() => {
        const c = document.getElementById('gl-canvas');
        return { width: c?.width, height: c?.height };
      });
      console.log(`    Canvas: ${canvasInfo.width}x${canvasInfo.height}`);
      console.log(`\n  Watching for ${durationSeconds}s... (check the browser window)\n`);
      await SLEEP(durationSeconds * 1000);

    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }
  }

  console.log('\n✅ Done. Close the browser window when ready.');
  await new Promise(() => {});
})().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
