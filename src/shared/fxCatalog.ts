import {
  VisualNode,
  createVisualNode,
  createFloatParameter,
  createBoolParameter,
  createEnumParameter,
  createInputPort,
  createOutputPort,
  createModulationTarget,
  createResourceRequirements,
  createTestHooks,
  gpuCostEstimate
} from './visualNode';

/**
 * FX Catalog - Standard Effect and Generator Library
 *
 * Every effect and generator declares:
 * - Inputs/Outputs
 * - Default values with min/max ranges
 * - Modulation targets
 * - GPU cost tier
 * - Verification guidance via test hooks
 */

// ============================================================================
// GENERATORS - Create visuals from nothing
// ============================================================================

export const plasmaGenerator: VisualNode = createVisualNode({
  id: 'gen-plasma',
  name: 'Plasma',
  kind: 'generator',
  category: 'generative',
  description: 'Classic plasma effect with audio-reactive distortion',
  tags: ['classic', 'reactive', 'organic'],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('speed', 'Speed', 1.0, 0.1, 5.0, { group: 'animation' }),
    createFloatParameter('scale', 'Scale', 1.0, 0.1, 4.0, { group: 'transform' }),
    createFloatParameter('complexity', 'Complexity', 3.0, 1.0, 8.0, { group: 'shape' }),
    createFloatParameter('colorShift', 'Color Shift', 0.0, -1.0, 1.0, { group: 'color' }),
    createFloatParameter('brightness', 'Brightness', 1.0, 0.0, 2.0, { group: 'color' }),
    createFloatParameter('audioReact', 'Audio Reactivity', 0.5, 0.0, 1.0, { group: 'modulation' }),
    createBoolParameter('invertColors', 'Invert Colors', false, { group: 'color' })
  ],

  modulationTargets: [
    createModulationTarget('speed', { minRange: 0.1, maxRange: 5.0 }),
    createModulationTarget('scale', { minRange: 0.1, maxRange: 4.0 }),
    createModulationTarget('colorShift', { minRange: -1.0, maxRange: 1.0, bipolar: true }),
    createModulationTarget('brightness', { minRange: 0.0, maxRange: 2.0 }),
    createModulationTarget('audioReact', { minRange: 0.0, maxRange: 1.0 })
  ],

  gpuCostTier: 'light',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({ snapshotPoints: ['frame-0', 'frame-60', 'frame-120'] }),
  supportsAudioReactivity: true
});

export const particleFieldGenerator: VisualNode = createVisualNode({
  id: 'gen-particles',
  name: 'Particle Field',
  kind: 'generator',
  category: 'generative',
  description: 'GPU-accelerated particle system with audio reactivity',
  tags: ['particles', 'reactive', 'performant'],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('density', 'Density', 0.35, 0.0, 1.0, { group: 'particles' }),
    createFloatParameter('speed', 'Speed', 0.3, 0.0, 1.0, { group: 'animation' }),
    createFloatParameter('size', 'Size', 0.45, 0.0, 1.0, { group: 'particles' }),
    createFloatParameter('glow', 'Glow', 0.6, 0.0, 1.0, { group: 'appearance' }),
    createFloatParameter('spread', 'Spread', 0.5, 0.0, 1.0, { group: 'particles' }),
    createFloatParameter('turbulence', 'Turbulence', 0.3, 0.0, 1.0, { group: 'motion' }),
    createFloatParameter('audioLift', 'Audio Lift', 0.5, 0.0, 1.0, { group: 'modulation' }),
    createEnumParameter('shape', 'Shape', 'circle', [
      { value: 'circle', label: 'Circle' },
      { value: 'square', label: 'Square' },
      { value: 'star', label: 'Star' },
      { value: 'custom', label: 'Custom' }
    ], { group: 'appearance' })
  ],

  modulationTargets: [
    createModulationTarget('density'),
    createModulationTarget('speed'),
    createModulationTarget('size'),
    createModulationTarget('glow'),
    createModulationTarget('turbulence')
  ],

  gpuCostTier: 'moderate',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({ deterministicSeed: true }),
  supportsAudioReactivity: true
});

export const sdfShapeGenerator: VisualNode = createVisualNode({
  id: 'gen-sdf',
  name: 'SDF Shapes',
  kind: 'generator',
  category: 'generative',
  description: 'Signed distance field shapes with glow and animation',
  tags: ['sdf', 'geometric', 'clean'],

  outputs: [
    createOutputPort('out', 'Output', 'rgba'),
    createOutputPort('mask', 'Mask', 'mask')
  ],

  parameters: [
    createEnumParameter('shape', 'Shape', 'circle', [
      { value: 'circle', label: 'Circle' },
      { value: 'box', label: 'Box' },
      { value: 'triangle', label: 'Triangle' },
      { value: 'star', label: 'Star' },
      { value: 'hexagon', label: 'Hexagon' },
      { value: 'ring', label: 'Ring' }
    ], { group: 'shape' }),
    createFloatParameter('scale', 'Scale', 0.45, 0.1, 1.0, { group: 'transform' }),
    createFloatParameter('rotation', 'Rotation', 0.0, -3.14159, 3.14159, { group: 'transform' }),
    createFloatParameter('edge', 'Edge Width', 0.08, 0.0, 0.5, { group: 'appearance' }),
    createFloatParameter('glow', 'Glow', 0.5, 0.0, 1.0, { group: 'appearance' }),
    createFloatParameter('fill', 'Fill', 0.35, 0.0, 1.0, { group: 'appearance' }),
    createFloatParameter('audioPulse', 'Audio Pulse', 0.6, 0.0, 1.0, { group: 'modulation' })
  ],

  modulationTargets: [
    createModulationTarget('scale'),
    createModulationTarget('rotation', { minRange: -3.14159, maxRange: 3.14159, bipolar: true }),
    createModulationTarget('edge'),
    createModulationTarget('glow'),
    createModulationTarget('fill')
  ],

  gpuCostTier: 'light',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({ snapshotPoints: ['shape-circle', 'shape-box', 'shape-triangle'] }),
  supportsAudioReactivity: true
});

export const spectrumVisualizer: VisualNode = createVisualNode({
  id: 'gen-spectrum',
  name: 'Audio Spectrum',
  kind: 'generator',
  category: 'audio-visual',
  description: 'Real-time audio spectrum visualization',
  tags: ['audio', 'spectrum', 'analyzer'],

  inputs: [
    createInputPort('audio', 'Audio', 'audio', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('smoothing', 'Smoothing', 0.8, 0.0, 0.99, { group: 'response' }),
    createFloatParameter('sensitivity', 'Sensitivity', 1.0, 0.1, 3.0, { group: 'response' }),
    createFloatParameter('barWidth', 'Bar Width', 0.8, 0.1, 1.0, { group: 'appearance' }),
    createFloatParameter('glow', 'Glow', 0.3, 0.0, 1.0, { group: 'appearance' }),
    createEnumParameter('style', 'Style', 'bars', [
      { value: 'bars', label: 'Bars' },
      { value: 'wave', label: 'Waveform' },
      { value: 'circle', label: 'Circular' },
      { value: 'mirror', label: 'Mirror' }
    ], { group: 'appearance' }),
    createBoolParameter('logScale', 'Logarithmic Scale', true, { group: 'response' })
  ],

  modulationTargets: [
    createModulationTarget('smoothing'),
    createModulationTarget('sensitivity'),
    createModulationTarget('glow')
  ],

  gpuCostTier: 'light',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({ fixedTimestep: false }),
  supportsAudioReactivity: true
});

export const noiseGenerator: VisualNode = createVisualNode({
  id: 'gen-noise',
  name: 'Procedural Noise',
  kind: 'generator',
  category: 'generative',
  description: 'Various noise patterns: Perlin, Simplex, Worley, FBM',
  tags: ['noise', 'procedural', 'texture'],

  outputs: [
    createOutputPort('out', 'Output', 'rgba'),
    createOutputPort('grayscale', 'Grayscale', 'mask')
  ],

  parameters: [
    createEnumParameter('type', 'Noise Type', 'simplex', [
      { value: 'perlin', label: 'Perlin' },
      { value: 'simplex', label: 'Simplex' },
      { value: 'worley', label: 'Worley/Cellular' },
      { value: 'fbm', label: 'FBM' },
      { value: 'turbulence', label: 'Turbulence' }
    ], { group: 'type' }),
    createFloatParameter('scale', 'Scale', 4.0, 0.5, 20.0, { group: 'transform' }),
    createFloatParameter('speed', 'Animation Speed', 0.5, 0.0, 2.0, { group: 'animation' }),
    createFloatParameter('octaves', 'Octaves', 4, 1, 8, { group: 'detail', step: 1 }),
    createFloatParameter('persistence', 'Persistence', 0.5, 0.0, 1.0, { group: 'detail' }),
    createFloatParameter('lacunarity', 'Lacunarity', 2.0, 1.0, 4.0, { group: 'detail' }),
    createFloatParameter('contrast', 'Contrast', 1.0, 0.5, 2.0, { group: 'color' })
  ],

  modulationTargets: [
    createModulationTarget('scale', { minRange: 0.5, maxRange: 20.0 }),
    createModulationTarget('speed', { minRange: 0.0, maxRange: 2.0 }),
    createModulationTarget('contrast', { minRange: 0.5, maxRange: 2.0 })
  ],

  gpuCostTier: 'moderate',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({ deterministicSeed: true })
});

// ============================================================================
// EFFECTS - Process input visuals
// ============================================================================

export const bloomEffect: VisualNode = createVisualNode({
  id: 'fx-bloom',
  name: 'Bloom',
  kind: 'effect',
  category: 'glow',
  description: 'High-quality bloom with threshold and color tinting',
  tags: ['glow', 'cinematic', 'dreamy'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('intensity', 'Intensity', 0.5, 0.0, 2.0, { group: 'bloom' }),
    createFloatParameter('threshold', 'Threshold', 0.8, 0.0, 1.0, { group: 'bloom' }),
    createFloatParameter('softKnee', 'Soft Knee', 0.5, 0.0, 1.0, { group: 'bloom' }),
    createFloatParameter('radius', 'Radius', 0.5, 0.1, 1.0, { group: 'bloom' }),
    createFloatParameter('tintR', 'Tint Red', 1.0, 0.0, 1.0, { group: 'color' }),
    createFloatParameter('tintG', 'Tint Green', 1.0, 0.0, 1.0, { group: 'color' }),
    createFloatParameter('tintB', 'Tint Blue', 1.0, 0.0, 1.0, { group: 'color' })
  ],

  modulationTargets: [
    createModulationTarget('intensity', { minRange: 0.0, maxRange: 2.0 }),
    createModulationTarget('threshold'),
    createModulationTarget('radius')
  ],

  gpuCostTier: 'moderate',
  resourceRequirements: createResourceRequirements({
    framebuffers: 3,
    preferredResolution: 'half'
  }),
  testHooks: createTestHooks({ toleranceThreshold: 0.02 })
});

export const blurEffect: VisualNode = createVisualNode({
  id: 'fx-blur',
  name: 'Blur',
  kind: 'effect',
  category: 'blur',
  description: 'Gaussian blur with variable radius',
  tags: ['blur', 'smooth', 'soft'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('radius', 'Radius', 0.0, 0.0, 1.0, { group: 'blur' }),
    createEnumParameter('quality', 'Quality', 'medium', [
      { value: 'low', label: 'Low (Fast)' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High (Slow)' }
    ], { group: 'quality' }),
    createBoolParameter('directional', 'Directional', false, { group: 'type' }),
    createFloatParameter('angle', 'Angle', 0.0, 0.0, 6.28318, { group: 'directional' })
  ],

  modulationTargets: [
    createModulationTarget('radius'),
    createModulationTarget('angle', { minRange: 0, maxRange: 6.28318 })
  ],

  gpuCostTier: 'moderate',
  resourceRequirements: createResourceRequirements({
    framebuffers: 2,
    preferredResolution: 'dynamic'
  }),
  testHooks: createTestHooks({})
});

export const chromaticAberrationEffect: VisualNode = createVisualNode({
  id: 'fx-chroma',
  name: 'Chromatic Aberration',
  kind: 'effect',
  category: 'distortion',
  description: 'RGB channel separation for lens distortion look',
  tags: ['distortion', 'glitch', 'cinematic'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('amount', 'Amount', 0.1, 0.0, 0.5, { group: 'distortion' }),
    createFloatParameter('angle', 'Angle', 0.0, 0.0, 6.28318, { group: 'distortion' }),
    createBoolParameter('radial', 'Radial Mode', false, { group: 'type' }),
    createFloatParameter('centerX', 'Center X', 0.5, 0.0, 1.0, { group: 'center' }),
    createFloatParameter('centerY', 'Center Y', 0.5, 0.0, 1.0, { group: 'center' })
  ],

  modulationTargets: [
    createModulationTarget('amount', { minRange: 0.0, maxRange: 0.5 }),
    createModulationTarget('angle', { minRange: 0, maxRange: 6.28318 })
  ],

  gpuCostTier: 'light',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({})
});

export const posterizeEffect: VisualNode = createVisualNode({
  id: 'fx-posterize',
  name: 'Posterize',
  kind: 'effect',
  category: 'color',
  description: 'Reduce color depth for stylized look',
  tags: ['color', 'stylized', 'retro'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('levels', 'Color Levels', 8, 2, 32, { step: 1, group: 'posterize' }),
    createBoolParameter('dither', 'Dithering', false, { group: 'posterize' }),
    createFloatParameter('ditherStrength', 'Dither Strength', 0.5, 0.0, 1.0, { group: 'posterize' })
  ],

  modulationTargets: [
    createModulationTarget('levels', { minRange: 2, maxRange: 32 })
  ],

  gpuCostTier: 'trivial',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({})
});

export const kaleidoscopeEffect: VisualNode = createVisualNode({
  id: 'fx-kaleidoscope',
  name: 'Kaleidoscope',
  kind: 'effect',
  category: 'distortion',
  description: 'Mirror and rotate for kaleidoscopic patterns',
  tags: ['mirror', 'pattern', 'psychedelic'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('segments', 'Segments', 6, 2, 16, { step: 1, group: 'kaleidoscope' }),
    createFloatParameter('rotation', 'Rotation', 0.0, -3.14159, 3.14159, { group: 'transform' }),
    createFloatParameter('zoom', 'Zoom', 1.0, 0.5, 2.0, { group: 'transform' }),
    createFloatParameter('centerX', 'Center X', 0.5, 0.0, 1.0, { group: 'center' }),
    createFloatParameter('centerY', 'Center Y', 0.5, 0.0, 1.0, { group: 'center' })
  ],

  modulationTargets: [
    createModulationTarget('segments', { minRange: 2, maxRange: 16 }),
    createModulationTarget('rotation', { minRange: -3.14159, maxRange: 3.14159, bipolar: true }),
    createModulationTarget('zoom', { minRange: 0.5, maxRange: 2.0 })
  ],

  gpuCostTier: 'light',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({})
});

export const feedbackEffect: VisualNode = createVisualNode({
  id: 'fx-feedback',
  name: 'Feedback Tunnel',
  kind: 'effect',
  category: 'temporal',
  description: 'Video feedback with zoom/rotation for tunnel effect',
  tags: ['feedback', 'tunnel', 'hypnotic'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('amount', 'Feedback Amount', 0.5, 0.0, 1.0, { group: 'feedback' }),
    createFloatParameter('zoom', 'Zoom', 0.98, 0.9, 1.1, { group: 'transform' }),
    createFloatParameter('rotation', 'Rotation', 0.02, -0.1, 0.1, { group: 'transform' }),
    createFloatParameter('offsetX', 'Offset X', 0.0, -0.1, 0.1, { group: 'transform' }),
    createFloatParameter('offsetY', 'Offset Y', 0.0, -0.1, 0.1, { group: 'transform' }),
    createFloatParameter('decay', 'Color Decay', 0.98, 0.8, 1.0, { group: 'appearance' }),
    createFloatParameter('hueShift', 'Hue Shift', 0.0, -0.1, 0.1, { group: 'color' })
  ],

  modulationTargets: [
    createModulationTarget('amount'),
    createModulationTarget('zoom', { minRange: 0.9, maxRange: 1.1 }),
    createModulationTarget('rotation', { minRange: -0.1, maxRange: 0.1, bipolar: true }),
    createModulationTarget('hueShift', { minRange: -0.1, maxRange: 0.1, bipolar: true })
  ],

  gpuCostTier: 'light',
  resourceRequirements: createResourceRequirements({
    framebuffers: 2,
    requiresDoubleBuffer: true
  }),
  testHooks: createTestHooks({ snapshotPoints: ['frame-0', 'frame-30', 'frame-60'] }),
  supportsFeedback: true
});

export const trailsEffect: VisualNode = createVisualNode({
  id: 'fx-trails',
  name: 'Trails/Persistence',
  kind: 'effect',
  category: 'temporal',
  description: 'Motion trails and persistence of vision effect',
  tags: ['trails', 'motion', 'persistence'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('persistence', 'Persistence', 0.9, 0.0, 0.99, { group: 'trails' }),
    createEnumParameter('blendMode', 'Blend Mode', 'screen', [
      { value: 'normal', label: 'Normal' },
      { value: 'add', label: 'Add' },
      { value: 'screen', label: 'Screen' },
      { value: 'max', label: 'Lighten' }
    ], { group: 'trails' }),
    createFloatParameter('fadeSpeed', 'Fade Speed', 0.02, 0.001, 0.1, { group: 'trails' })
  ],

  modulationTargets: [
    createModulationTarget('persistence', { minRange: 0.0, maxRange: 0.99 }),
    createModulationTarget('fadeSpeed', { minRange: 0.001, maxRange: 0.1 })
  ],

  gpuCostTier: 'light',
  resourceRequirements: createResourceRequirements({
    framebuffers: 2,
    requiresDoubleBuffer: true
  }),
  testHooks: createTestHooks({}),
  supportsFeedback: true
});

export const colorCorrectionEffect: VisualNode = createVisualNode({
  id: 'fx-color',
  name: 'Color Correction',
  kind: 'effect',
  category: 'color',
  description: 'Brightness, contrast, saturation, and hue adjustments',
  tags: ['color', 'correction', 'grading'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('brightness', 'Brightness', 0.0, -1.0, 1.0, { group: 'levels' }),
    createFloatParameter('contrast', 'Contrast', 1.0, 0.5, 2.0, { group: 'levels' }),
    createFloatParameter('saturation', 'Saturation', 1.0, 0.0, 2.0, { group: 'color' }),
    createFloatParameter('hue', 'Hue Shift', 0.0, -1.0, 1.0, { group: 'color' }),
    createFloatParameter('gamma', 'Gamma', 1.0, 0.5, 2.0, { group: 'levels' }),
    createFloatParameter('exposure', 'Exposure', 0.0, -2.0, 2.0, { group: 'levels' })
  ],

  modulationTargets: [
    createModulationTarget('brightness', { minRange: -1.0, maxRange: 1.0, bipolar: true }),
    createModulationTarget('contrast', { minRange: 0.5, maxRange: 2.0 }),
    createModulationTarget('saturation', { minRange: 0.0, maxRange: 2.0 }),
    createModulationTarget('hue', { minRange: -1.0, maxRange: 1.0, bipolar: true })
  ],

  gpuCostTier: 'trivial',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({})
});

export const glitchEffect: VisualNode = createVisualNode({
  id: 'fx-glitch',
  name: 'Glitch',
  kind: 'effect',
  category: 'distortion',
  description: 'Digital glitch effects: scanlines, displacement, artifacts',
  tags: ['glitch', 'digital', 'distortion'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('intensity', 'Intensity', 0.5, 0.0, 1.0, { group: 'glitch' }),
    createFloatParameter('blockSize', 'Block Size', 0.1, 0.01, 0.5, { group: 'glitch' }),
    createFloatParameter('scanlines', 'Scanlines', 0.0, 0.0, 1.0, { group: 'scanlines' }),
    createFloatParameter('rgbSplit', 'RGB Split', 0.0, 0.0, 0.1, { group: 'distortion' }),
    createFloatParameter('noise', 'Noise', 0.0, 0.0, 1.0, { group: 'noise' }),
    createFloatParameter('speed', 'Speed', 1.0, 0.1, 5.0, { group: 'animation' }),
    createBoolParameter('syncToAudio', 'Sync to Audio', true, { group: 'modulation' })
  ],

  modulationTargets: [
    createModulationTarget('intensity'),
    createModulationTarget('blockSize', { minRange: 0.01, maxRange: 0.5 }),
    createModulationTarget('rgbSplit', { minRange: 0.0, maxRange: 0.1 })
  ],

  gpuCostTier: 'light',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({ deterministicSeed: true }),
  supportsAudioReactivity: true
});

export const vignetteEffect: VisualNode = createVisualNode({
  id: 'fx-vignette',
  name: 'Vignette',
  kind: 'effect',
  category: 'color',
  description: 'Darkened corners for cinematic framing',
  tags: ['vignette', 'cinematic', 'framing'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('intensity', 'Intensity', 0.5, 0.0, 1.0, { group: 'vignette' }),
    createFloatParameter('radius', 'Radius', 0.7, 0.0, 1.0, { group: 'vignette' }),
    createFloatParameter('softness', 'Softness', 0.5, 0.0, 1.0, { group: 'vignette' }),
    createFloatParameter('roundness', 'Roundness', 1.0, 0.0, 2.0, { group: 'vignette' })
  ],

  modulationTargets: [
    createModulationTarget('intensity'),
    createModulationTarget('radius'),
    createModulationTarget('softness')
  ],

  gpuCostTier: 'trivial',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({})
});

export const filmGrainEffect: VisualNode = createVisualNode({
  id: 'fx-grain',
  name: 'Film Grain',
  kind: 'effect',
  category: 'texture',
  description: 'Analog film grain overlay',
  tags: ['grain', 'film', 'analog'],

  inputs: [
    createInputPort('in', 'Input', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createFloatParameter('intensity', 'Intensity', 0.3, 0.0, 1.0, { group: 'grain' }),
    createFloatParameter('size', 'Grain Size', 1.0, 0.5, 3.0, { group: 'grain' }),
    createFloatParameter('speed', 'Animation Speed', 24, 1, 60, { step: 1, group: 'animation' }),
    createBoolParameter('colored', 'Colored Grain', false, { group: 'grain' })
  ],

  modulationTargets: [
    createModulationTarget('intensity'),
    createModulationTarget('size', { minRange: 0.5, maxRange: 3.0 })
  ],

  gpuCostTier: 'trivial',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({ deterministicSeed: true })
});

// ============================================================================
// COMPOSITORS - Combine multiple inputs
// ============================================================================

export const blendCompositor: VisualNode = createVisualNode({
  id: 'comp-blend',
  name: 'Blend',
  kind: 'compositor',
  category: 'compositing',
  description: 'Blend two layers with various modes',
  tags: ['blend', 'layer', 'composite'],

  inputs: [
    createInputPort('base', 'Base', 'rgba', true),
    createInputPort('blend', 'Blend', 'rgba', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createEnumParameter('mode', 'Blend Mode', 'normal', [
      { value: 'normal', label: 'Normal' },
      { value: 'add', label: 'Add' },
      { value: 'multiply', label: 'Multiply' },
      { value: 'screen', label: 'Screen' },
      { value: 'overlay', label: 'Overlay' },
      { value: 'difference', label: 'Difference' },
      { value: 'exclusion', label: 'Exclusion' },
      { value: 'hardLight', label: 'Hard Light' },
      { value: 'softLight', label: 'Soft Light' }
    ], { group: 'blend' }),
    createFloatParameter('opacity', 'Opacity', 1.0, 0.0, 1.0, { group: 'blend' })
  ],

  modulationTargets: [
    createModulationTarget('opacity')
  ],

  gpuCostTier: 'trivial',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({})
});

export const maskCompositor: VisualNode = createVisualNode({
  id: 'comp-mask',
  name: 'Mask',
  kind: 'compositor',
  category: 'compositing',
  description: 'Use a mask to blend between two layers',
  tags: ['mask', 'composite', 'cutout'],

  inputs: [
    createInputPort('foreground', 'Foreground', 'rgba', true),
    createInputPort('background', 'Background', 'rgba', true),
    createInputPort('mask', 'Mask', 'mask', true)
  ],

  outputs: [
    createOutputPort('out', 'Output', 'rgba')
  ],

  parameters: [
    createBoolParameter('invertMask', 'Invert Mask', false, { group: 'mask' }),
    createFloatParameter('feather', 'Feather', 0.0, 0.0, 1.0, { group: 'mask' })
  ],

  modulationTargets: [
    createModulationTarget('feather')
  ],

  gpuCostTier: 'trivial',
  resourceRequirements: createResourceRequirements({ framebuffers: 1 }),
  testHooks: createTestHooks({})
});

// ============================================================================
// FX Catalog Registry
// ============================================================================

export const FX_CATALOG: VisualNode[] = [
  // Generators
  plasmaGenerator,
  particleFieldGenerator,
  sdfShapeGenerator,
  spectrumVisualizer,
  noiseGenerator,

  // Effects
  bloomEffect,
  blurEffect,
  chromaticAberrationEffect,
  posterizeEffect,
  kaleidoscopeEffect,
  feedbackEffect,
  trailsEffect,
  colorCorrectionEffect,
  glitchEffect,
  vignetteEffect,
  filmGrainEffect,

  // Compositors
  blendCompositor,
  maskCompositor
];

export const getNodeById = (id: string): VisualNode | undefined =>
  FX_CATALOG.find((node) => node.id === id);

export const getNodesByKind = (kind: VisualNode['kind']): VisualNode[] =>
  FX_CATALOG.filter((node) => node.kind === kind);

export const getNodesByCategory = (category: string): VisualNode[] =>
  FX_CATALOG.filter((node) => node.category === category);

export const getNodesByTag = (tag: string): VisualNode[] =>
  FX_CATALOG.filter((node) => node.tags.includes(tag));

export const getGenerators = (): VisualNode[] => getNodesByKind('generator');
export const getEffects = (): VisualNode[] => getNodesByKind('effect');
export const getCompositors = (): VisualNode[] => getNodesByKind('compositor');

export const getCostEstimate = (nodeIds: string[]): number => {
  return nodeIds.reduce((total, id) => {
    const node = getNodeById(id);
    if (!node) return total;
    return total + (gpuCostEstimate[node.gpuCostTier] || 1.0);
  }, 0);
};

export const validateNodeChain = (nodeIds: string[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const id of nodeIds) {
    const node = getNodeById(id);
    if (!node) {
      errors.push(`Unknown node: ${id}`);
    }
  }

  return { valid: errors.length === 0, errors };
};
