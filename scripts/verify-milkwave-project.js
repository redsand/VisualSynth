const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const { projectSchema } = require('../dist/main/shared/projectSchema.js');
const {
  analyzeMilkwaveShaderSource,
  summarizeMilkwaveShaderDiagnostics
} = require('../dist/main/shared/milkwaveDiagnostics.js');

const loadRuntimePatch = () => {
  const sourcePath = path.join(process.cwd(), 'src', 'renderer', 'milkdropRenderer.ts');
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const start = sourceText.indexOf('export const patchMilkDropGlsl = (source: string): string => {');
  const end = sourceText.indexOf('const createMilkDropVertexShader =', start);
  if (start === -1 || end === -1) {
    throw new Error('Unable to locate patchMilkDropGlsl in src/renderer/milkdropRenderer.ts');
  }
  const functionSource = sourceText.slice(start, end) + '\nmodule.exports = { patchMilkDropGlsl };';
  const transpiled = ts.transpileModule(functionSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', transpiled)(mod, mod.exports);
  return mod.exports.patchMilkDropGlsl;
};

const patchMilkDropGlsl = loadRuntimePatch();

const inputArg = process.argv[2];
if (!inputArg) {
  console.error('Usage: node scripts/verify-milkwave-project.js <project.json>');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const parsed = projectSchema.safeParse(project);
if (!parsed.success) {
  console.error(`Project schema validation failed: ${JSON.stringify(parsed.error.format())}`);
  process.exit(2);
}

const summarizePass = (source, pass) => {
  const raw = analyzeMilkwaveShaderSource({
    source: source || '',
    pass,
    stage: 'glsl'
  });
  const patchedSource = source ? patchMilkDropGlsl(source) : '';
  const patched = analyzeMilkwaveShaderSource({
    source: patchedSource,
    pass,
    stage: 'glsl'
  });

  return {
    raw,
    patched,
    patchedSource,
    rawFatal: raw.issues.some((issue) => issue.severity === 'error'),
    patchedFatal: patched.issues.some((issue) => issue.severity === 'error')
  };
};

const scenes = parsed.data.scenes || [];
const reports = scenes.map((scene) => {
  const shaderData = scene._shaderData || null;
  const warp = summarizePass(shaderData?.warp || '', 'warp');
  const comp = summarizePass(shaderData?.comp || '', 'comp');
  const verified = !warp.rawFatal && !warp.patchedFatal && !comp.rawFatal && !comp.patchedFatal;

  return {
    id: scene.id,
    name: scene.name || scene.id,
    verified,
    shaderPresence: {
      warp: Boolean(shaderData?.warp),
      comp: Boolean(shaderData?.comp)
    },
    warp,
    comp,
    scene
  };
});

const verifiedReports = reports.filter((report) => report.verified);
const rejectedReports = reports.filter((report) => !report.verified);

console.log(`Verified ${verifiedReports.length}/${reports.length} scenes in ${path.basename(inputPath)}`);
console.log(`Rejected ${rejectedReports.length} scenes`);

rejectedReports.slice(0, 25).forEach((report) => {
  const warpIssues = [...report.warp.raw.issues, ...report.warp.patched.issues]
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.code);
  const compIssues = [...report.comp.raw.issues, ...report.comp.patched.issues]
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.code);

  console.log(`REJECT ${report.name}`);
  if (warpIssues.length) {
    console.log(`  warp: ${[...new Set(warpIssues)].join(', ')} (${summarizeMilkwaveShaderDiagnostics(report.warp.patched)})`);
  }
  if (compIssues.length) {
    console.log(`  comp: ${[...new Set(compIssues)].join(', ')} (${summarizeMilkwaveShaderDiagnostics(report.comp.patched)})`);
  }
});

const verifiedProject = {
  ...parsed.data,
  name: `${parsed.data.name} [Verified Runtime Patch]`,
  scenes: verifiedReports.map((report) => report.scene),
  activeSceneId: verifiedReports[0]?.scene?.id ?? parsed.data.activeSceneId
};

const outputPath = inputPath.replace(/\.project\.json$/i, '.verified.project.json');
fs.writeFileSync(outputPath, `${JSON.stringify(verifiedProject, null, 2)}\n`, 'utf8');
console.log(`Wrote verified project: ${outputPath}`);
