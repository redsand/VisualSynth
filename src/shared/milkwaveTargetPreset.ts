export interface FocusedMilkwavePreset {
  id: string;
  file: string;
  name: string;
  expectedAuditClassification: 'native-supported' | 'supported-with-degradation' | 'fallback-only' | 'runtime-failed';
  expectedFallbackUsed: boolean;
  notes: string;
}

export const FOCUSED_MILKWAVE_PRESETS: FocusedMilkwavePreset[] = [
  {
    id: 'preset-1030-milkwave-tumbling-cubes-gedit',
    file: 'preset-1030-milkwave-tumbling-cubes-gedit.json',
    name: 'tumbling cubes gedit',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Primary baseline: no custom warp/comp, waves and shapes only.'
  },
  {
    id: 'preset-755-milkwave-brain-coral-(left-brained)',
    file: 'preset-755-milkwave-brain-coral-(left-brained).json',
    name: 'brain coral (left brained)',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-1042-milkwave-shards-(in-the-dark)',
    file: 'preset-1042-milkwave-shards-(in-the-dark).json',
    name: 'Shards (In the Dark)',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Shard preset variant with native-only baseline path.'
  },
  {
    id: 'preset-756-milkwave-brain-coral',
    file: 'preset-756-milkwave-brain-coral.json',
    name: 'brain coral',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-1044-milkwave-bass-detector---arms-3',
    file: 'preset-1044-milkwave-bass-detector---arms-3.json',
    name: 'bass detector - arms 3',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Audio-reactive baseline candidate.'
  },
  {
    id: 'preset-1045-milkwave-bass-detector---arms-4',
    file: 'preset-1045-milkwave-bass-detector---arms-4.json',
    name: 'bass detector - arms 4',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Audio-reactive baseline candidate.'
  },
  {
    id: 'preset-1046-milkwave-bass-detector---arms-5',
    file: 'preset-1046-milkwave-bass-detector---arms-5.json',
    name: 'bass detector - arms 5',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Audio-reactive baseline candidate.'
  },
  {
    id: 'preset-1047-milkwave-bass-detector---arms-6',
    file: 'preset-1047-milkwave-bass-detector---arms-6.json',
    name: 'bass detector - arms 6',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Audio-reactive baseline candidate.'
  },
  {
    id: 'preset-762-milkwave-lazerspecs_phat_edit',
    file: 'preset-762-milkwave-lazerspecs_phat_edit.json',
    name: 'lazerspecs_phat_edit',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-852-milkwave-290---sonic-brainstorm',
    file: 'preset-852-milkwave-290---sonic-brainstorm.json',
    name: '290 - Sonic brainstorm',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-853-milkwave-300---daydreamer',
    file: 'preset-853-milkwave-300---daydreamer.json',
    name: '300 - Daydreamer',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-863-milkwave-crosshair-dimension-(light-of-ages)',
    file: 'preset-863-milkwave-crosshair-dimension-(light-of-ages).json',
    name: 'Crosshair Dimension (Light of Ages)',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-1896-milkwave-blitz-3',
    file: 'preset-1896-milkwave-blitz-3.json',
    name: 'blitz 3',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-1901-milkwave-circuit-2',
    file: 'preset-1901-milkwave-circuit-2.json',
    name: 'circuit 2',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-1922-milkwave-final-hour',
    file: 'preset-1922-milkwave-final-hour.json',
    name: 'final hour',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-1928-milkwave-fly',
    file: 'preset-1928-milkwave-fly.json',
    name: 'fly',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-319-milkwave-songflower-(hybrid-plant)',
    file: 'preset-319-milkwave-songflower-(hybrid-plant).json',
    name: 'Songflower (Hybrid Plant)',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Shaderless native candidate selected for proof expansion.'
  },
  {
    id: 'preset-1943-milkwave-jazz-singer-2',
    file: 'preset-1943-milkwave-jazz-singer-2.json',
    name: 'jazz singer 2',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Enabled-wave and enabled-shape native candidate.'
  },
  {
    id: 'preset-329-milkwave-river-of-illusion-(infected-acid-mix)',
    file: 'preset-329-milkwave-river-of-illusion-(infected-acid-mix).json',
    name: 'River of Illusion (InfecteD acid mix)',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Shaderless native candidate selected for proof expansion.'
  },
  {
    id: 'preset-336-milkwave-re-entry',
    file: 'preset-336-milkwave-re-entry.json',
    name: 're entry',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Shaderless native candidate selected for proof expansion.'
  }
];

export const TARGET_MILKWAVE_PRESET_ID = FOCUSED_MILKWAVE_PRESETS[0].id;
export const TARGET_MILKWAVE_PRESET_FILE = FOCUSED_MILKWAVE_PRESETS[0].file;
export const TARGET_MILKWAVE_PRESET_NAME = FOCUSED_MILKWAVE_PRESETS[0].name;

export const isTargetMilkwavePresetId = (presetId: string): boolean =>
  presetId === TARGET_MILKWAVE_PRESET_ID;

export const isFocusedMilkwavePresetId = (presetId: string): boolean =>
  FOCUSED_MILKWAVE_PRESETS.some((preset) => preset.id === presetId);
