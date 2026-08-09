import type { RenderState } from '../../renderState';

export interface MilkwaveBuiltinState {
  timeSeconds: number;
  frame: number;
  width: number;
  height: number;
  rms: number;
  bass: number;
  mid: number;
  treb: number;
  bassAtt: number;
  midAtt: number;
  trebAtt: number;
  qVars: number[];
  randomPreset: [number, number];
  randomFrame: [number, number, number, number];
  mouseX?: number;
  mouseY?: number;
  isMouseDown?: boolean;
  blurInfo?: {
    scale1: number; bias1: number;
    scale2: number; bias2: number;
    scale3: number; bias3: number;
  };
}

type UniformGL = Pick<WebGL2RenderingContext, 'uniform1f' | 'uniform4f' | 'uniformMatrix4fv'>;

export const bindMilkwaveBuiltins = ({
  gl,
  loc,
  state
}: {
  gl: UniformGL;
  loc: (name: string) => WebGLUniformLocation | null;
  state: MilkwaveBuiltinState;
}) => {
  const aspect = state.width / state.height;

  // q1..q32 are declared as uniforms on the comp pass (read-only) and as
  // uQ1..uQ32 uniforms + local q1..q32 copies on the warp pass (writable, so
  // per-pixel EEL can reassign them). Set whichever the program exposes.
  const qLoc = (index: number) => loc(`q${index + 1}`);
  const uQLoc = (index: number) => loc(`uQ${index + 1}`);
  for (let i = 0; i < 32; i++) {
    const qTarget = qLoc(i);
    if (qTarget) gl.uniform1f(qTarget, state.qVars[i] ?? 0);
    const uQTarget = uQLoc(i);
    if (uQTarget) gl.uniform1f(uQTarget, state.qVars[i] ?? 0);
  }

  const c0 = loc('_c0');
  if (c0) gl.uniform4f(c0, aspect, 1.0, 1.0 / aspect, 1.0);

  const c1 = loc('_c1');
  if (c1) gl.uniform4f(c1, 0, 0, 0, 0);

  const c2 = loc('_c2');
  if (c2) gl.uniform4f(c2, state.timeSeconds, 60, state.frame, 0);

  const c3 = loc('_c3');
  if (c3) gl.uniform4f(c3, state.bass, state.mid, state.treb, state.rms);

  const c4 = loc('_c4');
  if (c4) gl.uniform4f(c4, state.bassAtt, state.midAtt, state.trebAtt, state.rms);

  const b = state.blurInfo;
  const c5 = loc('_c5');
  if (c5) gl.uniform4f(c5, b?.scale1 ?? 1.0, b?.scale2 ?? 1.0, b?.bias1 ?? 0.0, b?.bias2 ?? 0.0);

  const c6 = loc('_c6');
  if (c6) gl.uniform4f(c6, b?.scale3 ?? 1.0, 0.0, b?.bias3 ?? 0.0, 0.0); // plus blur1 threshold?

  const c7 = loc('_c7');
  if (c7) gl.uniform4f(c7, state.width, state.height, 1 / state.width, 1 / state.height);

  const c8 = loc('_c8');
  if (c8) {
    gl.uniform4f(
      c8,
      0.5 + 0.5 * Math.cos(state.timeSeconds * 0.3),
      0.5 + 0.5 * Math.cos(state.timeSeconds * 1.3),
      0.5 + 0.5 * Math.cos(state.timeSeconds * 5),
      0.5 + 0.5 * Math.cos(state.timeSeconds * 20)
    );
  }

  const c9 = loc('_c9');
  if (c9) {
    gl.uniform4f(
      c9,
      0.5 + 0.5 * Math.sin(state.timeSeconds * 0.3),
      0.5 + 0.5 * Math.sin(state.timeSeconds * 1.3),
      0.5 + 0.5 * Math.sin(state.timeSeconds * 5),
      0.5 + 0.5 * Math.sin(state.timeSeconds * 20)
    );
  }

  const c10 = loc('_c10');
  if (c10) {
    gl.uniform4f(
      c10,
      0.5 + 0.5 * Math.cos(state.timeSeconds * 0.005),
      0.5 + 0.5 * Math.cos(state.timeSeconds * 0.008),
      0.5 + 0.5 * Math.cos(state.timeSeconds * 0.013),
      0.5 + 0.5 * Math.cos(state.timeSeconds * 0.022)
    );
  }

  const c11 = loc('_c11');
  if (c11) {
    gl.uniform4f(
      c11,
      0.5 + 0.5 * Math.sin(state.timeSeconds * 0.005),
      0.5 + 0.5 * Math.sin(state.timeSeconds * 0.008),
      0.5 + 0.5 * Math.sin(state.timeSeconds * 0.013),
      0.5 + 0.5 * Math.sin(state.timeSeconds * 0.022)
    );
  }

  const c12 = loc('_c12');
  if (c12) {
    gl.uniform4f(
      c12,
      0.5 + 0.5 * Math.cos(state.timeSeconds * 0.0005 + 1),
      0.5 + 0.5 * Math.cos(state.timeSeconds * 0.0008 + 2),
      0.5 + 0.5 * Math.cos(state.timeSeconds * 0.0013 + 3),
      0.5 + 0.5 * Math.cos(state.timeSeconds * 0.0022 + 5)
    );
  }

  const c13 = loc('_c13');
  if (c13) {
    gl.uniform4f(
      c13,
      0.5 + 0.5 * Math.sin(state.timeSeconds * 0.0005 + 1),
      0.5 + 0.5 * Math.sin(state.timeSeconds * 0.0008 + 2),
      0.5 + 0.5 * Math.sin(state.timeSeconds * 0.0013 + 3),
      0.5 + 0.5 * Math.sin(state.timeSeconds * 0.0022 + 5)
    );
  }

  const c14 = loc('_c14');
  if (c14) gl.uniform4f(c14, state.mouseX ?? 0.5, state.mouseY ?? 0.5, state.isMouseDown ? 1.0 : 0.0, 0.0);

  const c15 = loc('_c15');
  if (c15) gl.uniform4f(c15, state.bassAtt, state.midAtt, state.trebAtt, state.rms);

  const c16 = loc('_c16');
  if (c16) gl.uniform4f(c16, 0, 0, 0, 0);

  const c17 = loc('_c17');
  if (c17) gl.uniform4f(c17, 0, 0, 0, 0);

  const tsnLq = loc('texsize_noise_lq');
  if (tsnLq) gl.uniform4f(tsnLq, 256, 256, 1 / 256, 1 / 256);
  const tsnMq = loc('texsize_noise_mq');
  if (tsnMq) gl.uniform4f(tsnMq, 256, 256, 1 / 256, 1 / 256);
  const tsnHq = loc('texsize_noise_hq');
  if (tsnHq) gl.uniform4f(tsnHq, 256, 256, 1 / 256, 1 / 256);

  const rf = loc('rand_frame');
  if (rf) gl.uniform4f(rf, ...state.randomFrame);
  const rp = loc('rand_preset');
  if (rp) gl.uniform4f(rp, state.randomPreset[0], state.randomPreset[1], state.randomFrame[2], state.randomFrame[3]);

  const banks = ['_qa', '_qb', '_qc', '_qd', '_qe', '_qf', '_qg', '_qh'] as const;
  banks.forEach((name, bankIndex) => {
    const target = loc(name);
    if (!target) return;
    const base = bankIndex * 4;
    gl.uniform4f(
      target,
      state.qVars[base] ?? 0,
      state.qVars[base + 1] ?? 0,
      state.qVars[base + 2] ?? 0,
      state.qVars[base + 3] ?? 0
    );
  });

  // rotation matrices (item 1 gap - basic identity for now to avoid crashes)
  const rotNames = [
    'rot_s1', 'rot_s2', 'rot_s3', 'rot_s4',
    'rot_d1', 'rot_d2', 'rot_d3', 'rot_d4',
    'rot_f1', 'rot_f2', 'rot_f3', 'rot_f4',
    'rot_vf1', 'rot_vf2', 'rot_vf3', 'rot_vf4',
    'rot_uf1', 'rot_uf2', 'rot_uf3', 'rot_uf4',
    'rot_rand1', 'rot_rand2', 'rot_rand3', 'rot_rand4'
  ];
  const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  rotNames.forEach(name => {
    const target = loc(name);
    if (target) gl.uniformMatrix4fv(target, false, identity);
  });
};

export const createMilkwaveBuiltinState = ({
  renderState,
  timeSeconds,
  frame,
  width,
  height,
  qVars,
  randomPreset
}: {
  renderState: RenderState;
  timeSeconds: number;
  frame: number;
  width: number;
  height: number;
  qVars: number[];
  randomPreset: [number, number];
}): MilkwaveBuiltinState => ({
  timeSeconds,
  frame,
  width,
  height,
  rms: renderState.rms,
  bass: renderState.spectrum?.[0] ?? renderState.rms ?? 0,
  mid: renderState.spectrum?.[Math.floor((renderState.spectrum?.length ?? 0) / 2)] ?? renderState.rms ?? 0,
  treb: renderState.spectrum?.[(renderState.spectrum?.length ?? 1) - 1] ?? renderState.rms ?? 0,
  bassAtt: renderState.rms,
  midAtt: renderState.rms,
  trebAtt: renderState.rms,
  qVars,
  randomPreset,
  randomFrame: [Math.random(), Math.random(), Math.random(), Math.random()]
});
