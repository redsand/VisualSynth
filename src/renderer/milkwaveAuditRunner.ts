import { createMilkDropRenderer } from './milkdropRenderer';
import type { MilkDropShaderData } from '../shared/project';

interface AuditResult {
  id: string;
  name: string;
  classification: 'native-supported' | 'supported-with-degradation' | 'fallback-only' | 'runtime-failed';
  warpCompiled: boolean;
  compCompiled: boolean;
  fallbackUsed: boolean;
  shapesRendered: number;
  wavesRendered: number;
  errors: string[];
  warnings: string[];
}

export async function runMilkwaveAudit(presets: { id: string, name: string, shaderData: MilkDropShaderData }[]) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  // document.body.appendChild(canvas); // Optional: for debugging if needed

  const errors: string[] = [];
  const renderer = createMilkDropRenderer({
    canvas,
    onError: (err, type) => {
      errors.push(`[${type}] ${err}`);
    }
  });

  const results: AuditResult[] = [];

  for (const preset of presets) {
    errors.length = 0;
    const startTime = performance.now();
    
    let compiled = false;
    try {
      compiled = renderer.compileShaders(preset.shaderData);
    } catch (e) {
      errors.push(`Runtime exception during compile: ${e}`);
    }

    const compileReport = renderer.getLastCompileReport();
    
    // Render a few frames to trigger runtime evaluation
    for (let i = 0; i < 5; i++) {
      renderer.render({
        time: i * 0.016,
        frame: i,
        fps: 60,
        bass: 1.0,
        mid: 1.0,
        treb: 1.0,
        bass_att: 1.0,
        mid_att: 1.0,
        treb_att: 1.0
      });
    }

    const runtimeReport = renderer.getLastNativeRuntimeReport();
    
    let classification: AuditResult['classification'] = 'runtime-failed';
    const warpStatus = compileReport?.warp.status;
    const compStatus = reportStatus(compileReport?.comp.status); // Fixed typo below

    function reportStatus(s?: string) { return s; }

    if (warpStatus === 'success' && compStatus === 'success') {
      classification = 'native-supported';
    } else if (warpStatus === 'degraded' || compStatus === 'degraded') {
      classification = 'supported-with-degradation';
    } else if (warpStatus === 'fallback' || compStatus === 'fallback') {
      classification = 'fallback-only';
    } else if (warpStatus === 'failed' || compStatus === 'failed') {
      classification = 'runtime-failed';
    }

    if (errors.length > 0) {
      classification = 'runtime-failed';
    }

    results.push({
      id: preset.id,
      name: preset.name,
      classification,
      warpCompiled: compileReport?.warp.compiled ?? false,
      compCompiled: compileReport?.comp.compiled ?? false,
      fallbackUsed: (compileReport?.warp.fallbackUsed || compileReport?.comp.fallbackUsed) ?? false,
      shapesRendered: runtimeReport.shapes.rendered,
      wavesRendered: runtimeReport.waves.rendered,
      errors: [...errors],
      warnings: [], // Could extract from diagnostics if needed
      auditAt: new Date().toISOString()
    });
  }

  return results;
}

// Expose to window for Puppeteer
(window as any).runMilkwaveAudit = runMilkwaveAudit;
