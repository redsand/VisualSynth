import type { AssetItem, LayerConfig, SceneConfig } from './project';
import type { CertificationLevel } from './certification';

export type PresetEnergy = 'low' | 'medium' | 'high' | 'peak';
export type PresetDensity = 'minimal' | 'balanced' | 'dense';
export type PresetMotion = 'static' | 'slow' | 'rhythmic' | 'aggressive';
export type PresetSourceDependency = 'none' | 'audio-reactive' | 'text-media' | 'hybrid';
export type PresetUseCase =
  | 'opener'
  | 'bridge'
  | 'build'
  | 'drop'
  | 'breakdown'
  | 'ambient-bed'
  | 'utility';
export type PresetRiskFlag =
  | 'subtle'
  | 'flash-heavy'
  | 'media-required'
  | 'audio-required'
  | 'cpu-heavy';

export interface PresetIndexEntry {
  name: string;
  path: string;
  category: string;
  primaryCategory: string;
  subcategory: string;
  visualFamilies: string[];
  useCases: PresetUseCase[];
  energy: PresetEnergy;
  density: PresetDensity;
  motion: PresetMotion;
  sourceDependency: PresetSourceDependency;
  riskFlags: PresetRiskFlag[];
  sceneCount: number;
  certification?: CertificationLevel;
  importedFrom?: string;
  thumbnail?: string;
  searchText: string;
}

const FAMILY_PATTERNS: Array<{ family: string; patterns: string[] }> = [
  { family: 'Oscillo', patterns: ['oscillo', 'waveform', 'speaker', 'cone'] },
  { family: 'Spectrum', patterns: ['spectrum', 'freq', 'equalizer', 'audio-weather'] },
  { family: 'Liquid', patterns: ['liquid', 'plasma', 'caustic', 'fluid', 'ink'] },
  { family: 'Feedback', patterns: ['feedback', 'trail', 'echo', 'persistence'] },
  { family: 'Particles', patterns: ['particle', 'burst', 'swarm', 'shape-burst', 'pyro'] },
  { family: 'Laser', patterns: ['laser', 'beam', 'arc', 'tesla'] },
  { family: 'Strobe', patterns: ['strobe', 'flash', 'posterize'] },
  { family: 'Grid/Tunnel', patterns: ['grid', 'tunnel', 'highway', 'wormhole', 'portal'] },
  { family: 'Fractal', patterns: ['fractal', 'sdf', 'kaleido', 'prism', 'geo-wireframe'] },
  { family: 'Glyph/Text', patterns: ['glyph', 'text', 'typography', 'data', 'code', 'hud'] },
  { family: 'Weather', patterns: ['weather', 'rain', 'storm', 'lightning', 'hurricane'] },
  { family: 'Terrain', patterns: ['terrain', 'topo', 'mountain'] },
  { family: 'Glitch', patterns: ['glitch', 'signal', 'vhs', 'datamosh', 'scanline'] },
  { family: 'Organic', patterns: ['organic', 'nebula', 'aura', 'ribbon', 'origami'] }
];

const CATEGORY_RULES: Array<{ category: string; subcategory: string; match: (families: Set<string>, blob: string) => boolean }> = [
  {
    category: 'Utility/Test',
    subcategory: 'Calibration and tools',
    match: (_families, blob) => blob.includes('test') || blob.includes('debug') || blob.includes('utility')
  },
  {
    category: 'Imported/Milkwave',
    subcategory: 'Imported packs',
    match: (_families, blob) => blob.includes('milkwave') || blob.includes('milkdrop')
  },
  {
    category: 'Typography/Data',
    subcategory: 'Text and overlays',
    match: (families, blob) => families.has('Glyph/Text') || blob.includes('typography') || blob.includes('hud') || blob.includes('data-overlay')
  },
  {
    category: 'Audio-Reactive',
    subcategory: 'Audio driven',
    match: (families, blob) =>
      families.has('Oscillo') || families.has('Spectrum') || blob.includes('audio') || blob.includes('speaker') || blob.includes('waveform')
  },
  {
    category: 'Laser/Beam',
    subcategory: 'Laser and arc effects',
    match: (families, blob) =>
      families.has('Laser') || blob.includes('laser') || blob.includes('beam') || blob.includes('arc') || blob.includes('tesla')
  },
  {
    category: 'Strobe/Flash',
    subcategory: 'High-energy flash',
    match: (families, blob) =>
      families.has('Strobe') || blob.includes('strobe') || blob.includes('flash')
  },
  {
    category: 'Particles/Burst',
    subcategory: 'Particle systems',
    match: (families, blob) =>
      families.has('Particles') || blob.includes('particle') || blob.includes('burst') || blob.includes('pyro') || blob.includes('swarm')
  },
  {
    category: 'Fractal/Geometric',
    subcategory: 'Fractal and SDF shapes',
    match: (families, blob) =>
      families.has('Fractal') || blob.includes('fractal') || blob.includes('kaleido') || blob.includes('sdf') || blob.includes('prism') || blob.includes('geo')
  },
  {
    category: 'Grid/Tunnel',
    subcategory: 'Tunnels and corridors',
    match: (families, blob) =>
      families.has('Grid/Tunnel') || blob.includes('tunnel') || blob.includes('grid') || blob.includes('wormhole') || blob.includes('portal') || blob.includes('highway')
  },
  {
    category: 'Glitch/Digital',
    subcategory: 'Glitch and digital artifacts',
    match: (families, blob) =>
      families.has('Glitch') || blob.includes('glitch') || blob.includes('vhs') || blob.includes('scanline') || blob.includes('datamosh') || blob.includes('signal')
  },
  {
    category: 'Weather/Storm',
    subcategory: 'Weather and natural forces',
    match: (families, blob) =>
      families.has('Weather') || blob.includes('weather') || blob.includes('storm') || blob.includes('lightning') || blob.includes('rain') || blob.includes('hurricane')
  },
  {
    category: 'Terrain/Landscape',
    subcategory: 'Terrain and topographic',
    match: (families, blob) =>
      families.has('Terrain') || blob.includes('terrain') || blob.includes('topo') || blob.includes('mountain') || blob.includes('landscape')
  },
  {
    category: 'Transitions',
    subcategory: 'Scene switches',
    match: (families, blob) =>
      families.has('Feedback') || blob.includes('transition') || blob.includes('bridge') || blob.includes('crossfade')
  },
  {
    category: 'Atmospheric',
    subcategory: 'Ambient mood beds',
    match: (families, blob) =>
      blob.includes('ambient') || blob.includes('nebula') || blob.includes('aura') || blob.includes('drift') || blob.includes('dream')
  },
  {
    category: 'Liquid/Organic',
    subcategory: 'Fluid and organic motion',
    match: (families, blob) =>
      families.has('Liquid') || families.has('Organic') || blob.includes('liquid') || blob.includes('plasma') || blob.includes('fluid') || blob.includes('organic') || blob.includes('ink') || blob.includes('ribbon')
  }
];

const tokenize = (...values: Array<string | undefined | null>) =>
  values
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();

const uniq = <T>(values: T[]) => Array.from(new Set(values));

const extractScenes = (data: any): SceneConfig[] => {
  if (Array.isArray(data?.scenes)) return data.scenes as SceneConfig[];
  if (Array.isArray(data?.project?.scenes)) return data.project.scenes as SceneConfig[];
  if (Array.isArray(data?.layers)) {
    return [
      {
        id: 'scene-1',
        name: data?.metadata?.name ?? data?.name ?? 'Preset',
        layers: data.layers as LayerConfig[]
      } as SceneConfig
    ];
  }
  return [];
};

const extractAssets = (data: any): AssetItem[] => {
  if (Array.isArray(data?.assets)) return data.assets as AssetItem[];
  if (Array.isArray(data?.project?.assets)) return data.project.assets as AssetItem[];
  return [];
};

const collectLayerTokens = (scenes: SceneConfig[]) =>
  scenes.flatMap((scene) =>
    scene.layers.flatMap((layer) => [
      layer.id,
      layer.name,
      layer.generatorId,
      ...(layer.assetId ? [layer.assetId] : [])
    ])
  );

const detectFamilies = (blob: string) => {
  const families = FAMILY_PATTERNS
    .filter((entry) => entry.patterns.some((pattern) => blob.includes(pattern)))
    .map((entry) => entry.family);
  return families.length > 0 ? families : ['Organic'];
};

const detectSourceDependency = (blob: string, assets: AssetItem[]) => {
  const hasTextMedia =
    assets.some((asset) => asset.kind === 'text' || asset.kind === 'texture' || asset.kind === 'video') ||
    blob.includes('typography') ||
    blob.includes('data-overlay') ||
    blob.includes('video') ||
    blob.includes('text');
  const hasAudioReactive =
    blob.includes('oscillo') ||
    blob.includes('spectrum') ||
    blob.includes('speaker') ||
    blob.includes('waveform') ||
    blob.includes('audio');
  if (hasAudioReactive && hasTextMedia) return 'hybrid';
  if (hasAudioReactive) return 'audio-reactive';
  if (hasTextMedia) return 'text-media';
  return 'none';
};

const detectUseCases = (blob: string, energy: PresetEnergy, sourceDependency: PresetSourceDependency): PresetUseCase[] => {
  const useCases: PresetUseCase[] = [];
  if (blob.includes('ambient') || energy === 'low') useCases.push('ambient-bed');
  if (blob.includes('build') || energy === 'high') useCases.push('build');
  if (blob.includes('drop') || energy === 'peak' || blob.includes('arena')) useCases.push('drop');
  if (blob.includes('break') || blob.includes('breakdown')) useCases.push('breakdown');
  if (blob.includes('intro') || blob.includes('opener')) useCases.push('opener');
  if (blob.includes('transition') || blob.includes('feedback') || blob.includes('bridge')) useCases.push('bridge');
  if (blob.includes('test') || blob.includes('utility') || sourceDependency === 'text-media') useCases.push('utility');
  return uniq(useCases.length > 0 ? useCases : ['bridge']);
};

const detectEnergy = (blob: string): PresetEnergy => {
  if (/(drop|arena|pyro|laser|strobe|shred|chaos|overdrive|show)/.test(blob)) return 'peak';
  if (/(build|storm|electric|bass|acid|voltage|burst)/.test(blob)) return 'high';
  if (/(soft|calm|slow|ambient|drift|dream|liquid)/.test(blob)) return 'low';
  return 'medium';
};

const detectDensity = (blob: string, families: Set<string>): PresetDensity => {
  const score =
    (families.has('Particles') ? 1 : 0) +
    (families.has('Feedback') ? 1 : 0) +
    (families.has('Fractal') ? 1 : 0) +
    (blob.includes('swarm') ? 1 : 0);
  if (score >= 3) return 'dense';
  if (score === 0) return 'minimal';
  return 'balanced';
};

const detectMotion = (blob: string, families: Set<string>): PresetMotion => {
  if (families.has('Strobe') || /(strobe|flash|burst|shred)/.test(blob)) return 'aggressive';
  if (families.has('Feedback') || families.has('Laser') || /(pulse|drive|beat|arena)/.test(blob)) return 'rhythmic';
  if (/(drift|liquid|slow|nebula|ambient)/.test(blob)) return 'slow';
  return 'static';
};

const detectRiskFlags = (
  blob: string,
  sourceDependency: PresetSourceDependency,
  energy: PresetEnergy,
  density: PresetDensity
) => {
  const flags: PresetRiskFlag[] = [];
  if (sourceDependency === 'audio-reactive' || sourceDependency === 'hybrid') flags.push('audio-required');
  if (sourceDependency === 'text-media' || sourceDependency === 'hybrid') flags.push('media-required');
  if (/(strobe|flash)/.test(blob) || energy === 'peak') flags.push('flash-heavy');
  if (/(soft|ambient|minimal|subtle|drift)/.test(blob)) flags.push('subtle');
  if (density === 'dense' || /(feedback|particle|fractal|liquid)/.test(blob)) flags.push('cpu-heavy');
  return uniq(flags);
};

const detectCategory = (families: Set<string>, blob: string, importedFrom?: string) => {
  const importedBlob = tokenize(blob, importedFrom);
  for (const rule of CATEGORY_RULES) {
    if (rule.match(families, importedBlob)) {
      return { primaryCategory: rule.category, subcategory: rule.subcategory };
    }
  }
  return { primaryCategory: 'Performance', subcategory: 'General live visuals' };
};

export const buildPresetIndexEntry = (presetPath: string, data: any): PresetIndexEntry => {
  const metadataName = data?.metadata?.name;
  const fileName = presetPath.split(/[\\/]/).pop() ?? presetPath;
  const name = metadataName || data?.name || fileName.replace(/\.\w+$/, '');
  const importedFrom = data?.metadata?.importedFrom;
  const scenes = extractScenes(data);
  const assets = extractAssets(data);
  const layerBlob = tokenize(
    name,
    data?.metadata?.category,
    data?.metadata?.source,
    data?.metadata?.importedFrom,
    ...collectLayerTokens(scenes),
    ...assets.map((asset) => `${asset.kind} ${asset.name} ${asset.tags?.join(' ') ?? ''}`)
  );
  const visualFamilies = uniq(detectFamilies(layerBlob));
  const familySet = new Set(visualFamilies);
  const sourceDependency = detectSourceDependency(layerBlob, assets);
  const energy = detectEnergy(layerBlob);
  const density = detectDensity(layerBlob, familySet);
  const motion = detectMotion(layerBlob, familySet);
  const riskFlags = detectRiskFlags(layerBlob, sourceDependency, energy, density);
  const useCases = detectUseCases(layerBlob, energy, sourceDependency);
  const certification = (data?.metadata?.certification ?? data?.certification) as CertificationLevel | undefined;
  const metadataCategory = (data?.metadata?.category as string | undefined)?.trim();
  const categoryInfo = metadataCategory
    ? { primaryCategory: metadataCategory, subcategory: metadataCategory }
    : detectCategory(familySet, layerBlob, importedFrom);
  const thumbnail = data?.thumbnail || data?.metadata?.thumbnail;
  const searchText = tokenize(
    name,
    categoryInfo.primaryCategory,
    categoryInfo.subcategory,
    importedFrom,
    certification,
    ...visualFamilies,
    ...useCases,
    ...riskFlags,
    sourceDependency,
    energy,
    density,
    motion
  );

  return {
    name,
    path: presetPath,
    category: categoryInfo.primaryCategory,
    primaryCategory: categoryInfo.primaryCategory,
    subcategory: categoryInfo.subcategory,
    visualFamilies,
    useCases,
    energy,
    density,
    motion,
    sourceDependency,
    riskFlags,
    sceneCount: scenes.length || 1,
    certification,
    importedFrom,
    thumbnail,
    searchText
  };
};
