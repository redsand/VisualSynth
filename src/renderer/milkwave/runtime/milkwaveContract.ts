export interface MilkwaveBuiltinVec4 {
  name: string;
  source: 'c-bank' | 'q-bank' | 'runtime' | 'texture-meta';
  description: string;
}

export interface MilkwaveSamplerBinding {
  name: string;
  kind: '2d' | '3d';
  source:
    | 'previous-frame'
    | 'blur1'
    | 'blur2'
    | 'blur3'
    | 'noise-lq'
    | 'noise-mq'
    | 'noise-hq'
    | 'noisevol-lq'
    | 'noisevol-hq'
    | 'custom-slot';
  aliases?: string[];
}

export interface MilkwaveRuntimeContract {
  vec4Builtins: MilkwaveBuiltinVec4[];
  samplerBindings: MilkwaveSamplerBinding[];
  qVariableCount: number;
  customWaveSlots: number;
  customShapeSlots: number;
}

export const MILKWAVE_VEC4_BUILTINS: MilkwaveBuiltinVec4[] = [
  { name: '_c0', source: 'c-bank', description: 'Aspect-aware screen scale and inverse.' },
  { name: '_c1', source: 'c-bank', description: 'Core constant bank 1.' },
  { name: '_c2', source: 'runtime', description: 'time, fps, frame, progress.' },
  { name: '_c3', source: 'runtime', description: 'bass, mid, treb, vol.' },
  { name: '_c4', source: 'runtime', description: 'bass_att, mid_att, treb_att, vol_att.' },
  { name: '_c5', source: 'texture-meta', description: 'Blur1 and blur2 scale/bias.' },
  { name: '_c6', source: 'texture-meta', description: 'Blur3 scale/bias and blur1 thresholds.' },
  { name: '_c7', source: 'texture-meta', description: 'Main texture size and inverse size.' },
  { name: '_c8', source: 'runtime', description: 'Fast roaming cosine bank.' },
  { name: '_c9', source: 'runtime', description: 'Fast roaming sine bank.' },
  { name: '_c10', source: 'runtime', description: 'Slow roaming cosine bank.' },
  { name: '_c11', source: 'runtime', description: 'Slow roaming sine bank.' },
  { name: '_c12', source: 'texture-meta', description: 'MIP metadata for main texture.' },
  { name: '_c13', source: 'texture-meta', description: 'Blur2 and blur3 thresholds.' },
  { name: '_c14', source: 'runtime', description: 'Mouse data.' },
  { name: '_c15', source: 'runtime', description: 'Smooth bass, mid, treb, vol.' },
  { name: '_c16', source: 'runtime', description: 'Milkwave visualization controls.' },
  { name: '_c17', source: 'runtime', description: 'Milkwave color shift controls.' },
  { name: '_qa', source: 'q-bank', description: 'q1-q4' },
  { name: '_qb', source: 'q-bank', description: 'q5-q8' },
  { name: '_qc', source: 'q-bank', description: 'q9-q12' },
  { name: '_qd', source: 'q-bank', description: 'q13-q16' },
  { name: '_qe', source: 'q-bank', description: 'q17-q20' },
  { name: '_qf', source: 'q-bank', description: 'q21-q24' },
  { name: '_qg', source: 'q-bank', description: 'q25-q28' },
  { name: '_qh', source: 'q-bank', description: 'q29-q32' },
  { name: 'rand_frame', source: 'runtime', description: 'Per-frame random vec4.' },
  { name: 'rand_preset', source: 'runtime', description: 'Per-preset random vec4.' },
  { name: 'texsize_noise_lq', source: 'texture-meta', description: 'Low-quality noise texture size.' },
  { name: 'texsize_noise_mq', source: 'texture-meta', description: 'Medium-quality noise texture size.' },
  { name: 'texsize_noise_hq', source: 'texture-meta', description: 'High-quality noise texture size.' }
];

export const MILKWAVE_SAMPLER_BINDINGS: MilkwaveSamplerBinding[] = [
  {
    name: 'sampler_main',
    kind: '2d',
    source: 'previous-frame',
    aliases: ['sampler_fc_main', 'sampler_pc_main', 'sampler_fw_main', 'sampler_pw_main']
  },
  { name: 'sampler_blur1', kind: '2d', source: 'blur1' },
  { name: 'sampler_blur2', kind: '2d', source: 'blur2' },
  { name: 'sampler_blur3', kind: '2d', source: 'blur3' },
  { name: 'sampler_noise_lq', kind: '2d', source: 'noise-lq', aliases: ['sampler_noise_lq_lite'] },
  { name: 'sampler_noise_mq', kind: '2d', source: 'noise-mq' },
  { name: 'sampler_noise_hq', kind: '2d', source: 'noise-hq' },
  { name: 'sampler_noisevol_lq', kind: '3d', source: 'noisevol-lq' },
  { name: 'sampler_noisevol_hq', kind: '3d', source: 'noisevol-hq' }
];

export const MILKWAVE_RUNTIME_CONTRACT: MilkwaveRuntimeContract = {
  vec4Builtins: MILKWAVE_VEC4_BUILTINS,
  samplerBindings: MILKWAVE_SAMPLER_BINDINGS,
  qVariableCount: 32,
  customWaveSlots: 4,
  customShapeSlots: 4
};
