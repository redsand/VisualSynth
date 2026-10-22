// Probe: compile + LINK comp shaders against the app's real vertex shader,
// printing the driver's link log. ANGLE (Metal backend) tolerates some GLSL
// at compile that dies in MSL codegen at LINK (e.g. global-shadowed locals),
// so a compile-only probe cannot see this error class. Usage:
//   ts-node --transpile-only scripts/probe-link.ts <name>... <batch>
// <name> is the preset filename stem; the LAST argument is the batch whose
// saved raw shaders to read.
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { patchMilkDropGlsl } from '../src/shared/milkwaveGlslPatcher';

const args = process.argv.slice(2);
const batch = args.pop() ?? '9231';
if (args.length === 0) {
  console.error('usage: probe-link.ts <preset-name>... <batch>');
  process.exit(1);
}

const VS = `#version 300 es
precision highp float;
in vec2 position;
out vec2 vUv;
out vec2 vUvOriginal;
out float vRadius;
out float vAngle;
void main() {
  vUv = position * 0.5 + 0.5;
  vUvOriginal = vUv;
  vec2 centered = position;
  vRadius = length(centered);
  vAngle = atan(centered.y, centered.x);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const LINK_JS = (fsSrc: string, vsSrc: string) => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'no webgl2' };
  const mk = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return { sh, ok: gl.getShaderParameter(sh, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(sh) || '' };
  };
  const fs = mk(gl.FRAGMENT_SHADER, fsSrc);
  if (!fs.ok) return { stage: 'compile', linked: false, log: fs.log.slice(0, 400) };
  const vs = mk(gl.VERTEX_SHADER, vsSrc);
  if (!vs.ok) return { stage: 'vs-compile', linked: false, log: vs.log.slice(0, 400) };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs.sh);
  gl.attachShader(prog, fs.sh);
  gl.linkProgram(prog);
  const linked = gl.getProgramParameter(prog, gl.LINK_STATUS);
  return {
    stage: 'link',
    linked,
    log: (gl.getProgramInfoLog(prog) || '').slice(0, 400),
  };
};

const main = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');
  let failed = 0;
  for (const name of args) {
    const file = path.resolve(__dirname, `../milkwave-test-results/shaders/batch-${batch}/${name}.comp.glsl`);
    if (!fs.existsSync(file)) {
      console.log(`${name}\tNO_SHADER_FILE`);
      failed++;
      continue;
    }
    const patched = patchMilkDropGlsl(fs.readFileSync(file, 'utf8'));
    const res = await page.evaluate(LINK_JS, patched, VS);
    const ok = res && (res as { linked?: boolean }).linked === true;
    if (!ok) failed++;
    console.log(`${name}\t${ok ? 'LINKED' : 'FAIL'}\t${JSON.stringify(res).slice(0, 300)}`);
  }
  console.log(`--- ${args.length} probed, ${args.length - failed} linked, ${failed} failed`);
  await browser.close();
};
main();