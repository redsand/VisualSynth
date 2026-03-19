import fs from 'fs';
import path from 'path';
import { parseMilkFile } from '../src/shared/milkwaveParser';
import { transpileMilkDropShader } from '../src/shared/hlslToGlsl';
import {
  analyzeMilkwaveShaderSource,
  summarizeMilkwaveShaderDiagnostics
} from '../src/shared/milkwaveDiagnostics';
import { buildMilkwaveIR } from '../src/shared/milkwaveIr';
import { classifyMilkwaveIR } from '../src/shared/milkwaveCapability';

const readJsonShaderData = (filePath: string) => {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return {
    shaderData: parsed?._shaderData ?? null,
    metadata: parsed?.metadata?.milkwave ?? null
  };
};

const printNativeRuntimeReadiness = ({
  perPixelCount,
  waveCount,
  shapeCount
}: {
  perPixelCount: number;
  waveCount: number;
  shapeCount: number;
}) => {
  const available: string[] = [];
  const pending: string[] = [];

  if (shapeCount > 0) {
    available.push(`custom-shapes(${shapeCount})`);
  }
  if (waveCount > 0) {
    available.push(`custom-waves(${waveCount})`);
  }
  if (perPixelCount > 0) {
    pending.push(`preset-per-pixel(${perPixelCount})`);
  }

  console.log(`native-runtime/available=${available.join(', ') || '(none)'}`);
  console.log(`native-runtime/pending=${pending.join(', ') || '(none)'}`);
};

const printDiagnostics = (label: string, source: string, pass: 'warp' | 'comp', stage: 'raw' | 'glsl') => {
  const diagnostics = analyzeMilkwaveShaderSource({ source, pass, stage });
  console.log(`${label}: ${summarizeMilkwaveShaderDiagnostics(diagnostics)}`);
  diagnostics.issues.slice(0, 10).forEach((issue) => {
    console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}${issue.evidence ? ` (${issue.evidence})` : ''}`);
  });
};

const target = process.argv[2];
if (!target) {
  console.error('Usage: npx tsx scripts/debug-milkwave-preset.ts <preset.milk|preset.json>');
  process.exit(1);
}

const resolved = path.resolve(process.cwd(), target);
if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

if (resolved.toLowerCase().endsWith('.milk')) {
  const content = fs.readFileSync(resolved, 'utf-8');
  const preset = parseMilkFile(content, path.basename(resolved), path.basename(path.dirname(resolved)));
  if (!preset) {
    console.error('Failed to parse .milk preset');
    process.exit(2);
  }

  const ir = buildMilkwaveIR(preset);
  const capability = classifyMilkwaveIR(ir);
  console.log(`Parsed preset: ${preset.metadata.author} - ${preset.metadata.name}`);
  console.log(`perFrame=${preset.perFrameCode.length} perFrameInit=${preset.perFrameInitCode.length} perPixel=${preset.perPixelCode.length}`);
  console.log(`customWaves=${preset.waves.length} customShapes=${preset.shapes.length}`);
  console.log(`support=${capability.tier} features=${capability.featureSummary.join(', ') || '(none)'}`);
  capability.reasonsDetailed.forEach((reason) => {
    console.log(`  [${reason.severity}] ${reason.key}: ${reason.message}`);
  });
  printNativeRuntimeReadiness({
    perPixelCount: preset.perPixelCode.length,
    waveCount: preset.waves.length,
    shapeCount: preset.shapes.length
  });
  if (preset.warpShader) {
    printDiagnostics('warp/raw', preset.warpShader, 'warp', 'raw');
    const warpGlsl = transpileMilkDropShader(preset.warpShader, 'warp').glsl;
    printDiagnostics('warp/glsl', warpGlsl, 'warp', 'glsl');
  }
  if (preset.compShader) {
    printDiagnostics('comp/raw', preset.compShader, 'comp', 'raw');
    const compGlsl = transpileMilkDropShader(preset.compShader, 'comp').glsl;
    printDiagnostics('comp/glsl', compGlsl, 'comp', 'glsl');
  }
} else if (resolved.toLowerCase().endsWith('.json')) {
  const { shaderData, metadata } = readJsonShaderData(resolved);
  if (!shaderData) {
    console.error('Preset JSON has no _shaderData');
    process.exit(2);
  }

  console.log(`Loaded preset JSON: ${path.basename(resolved)}`);
  console.log(
    `shaderData/perFrame=${shaderData.perFrameCode?.length ?? 0} perFrameInit=${shaderData.perFrameInitCode?.length ?? 0} perPixel=${shaderData.perPixelCode?.length ?? 0}`
  );
  console.log(`shaderData/customWaves=${shaderData.waves?.length ?? 0} customShapes=${shaderData.shapes?.length ?? 0}`);
  if (metadata) {
    console.log(`metadata/support=${metadata.supportTier} features=${(metadata.featureSummary ?? []).join(', ') || '(none)'}`);
    (metadata.reasons ?? []).forEach((reason: { severity: string; key: string; message: string }) => {
      console.log(`  [${reason.severity}] ${reason.key}: ${reason.message}`);
    });
  }
  printNativeRuntimeReadiness({
    perPixelCount: shaderData.perPixelCode?.length ?? 0,
    waveCount: shaderData.waves?.length ?? 0,
    shapeCount: shaderData.shapes?.length ?? 0
  });
  printDiagnostics('warp/raw', shaderData.warp ?? '', 'warp', 'raw');
  printDiagnostics('comp/raw', shaderData.comp ?? '', 'comp', 'raw');
} else {
  console.error('Expected a .milk or .json file');
  process.exit(1);
}
