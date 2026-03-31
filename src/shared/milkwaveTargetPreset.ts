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
    id: 'preset-1041-milkwave-shards-(fast)',
    file: 'preset-1041-milkwave-shards-(fast).json',
    name: 'Shards (Fast)',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Secondary baseline: shard-style visual with no reported fallback.'
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
    id: 'preset-1043-milkwave-shards',
    file: 'preset-1043-milkwave-shards.json',
    name: 'Shards',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Shard preset variant with native-only baseline path.'
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
    id: 'preset-1078-milkwave-anuera',
    file: 'preset-1078-milkwave-anuera.json',
    name: 'Anuera',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'High-confidence native-supported preset with active shapes and waves.'
  },
  {
    id: 'preset-1080-milkwave-drug-addict',
    file: 'preset-1080-milkwave-drug-addict.json',
    name: 'Drug Addict',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'High-confidence native-supported preset with active shapes and waves.'
  },
  {
    id: 'preset-1081-milkwave-soul-amplifier',
    file: 'preset-1081-milkwave-soul-amplifier.json',
    name: 'Soul Amplifier',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Previously certified-safe baseline candidate.'
  },
  {
    id: 'preset-1082-milkwave-soul-amplifier(unreal-remix)',
    file: 'preset-1082-milkwave-soul-amplifier(unreal-remix).json',
    name: 'Soul Amplifier(Unreal remix)',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Previously certified-safe baseline candidate.'
  },
  {
    id: 'preset-1083-milkwave-[mashup-by-tony]-a-thousand-time-to-play-this-game',
    file: 'preset-1083-milkwave-[mashup-by-tony]-a-thousand-time-to-play-this-game.json',
    name: '[MASHUP by Tony] A Thousand Time To Play This Game, Escape The Worm, Julian Sploosh, Bitterfeld, Artificial Poles Of The Continuum',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Previously certified-safe baseline candidate.'
  },
  {
    id: 'preset-305-milkwave-airhandler-(principle-of-sharing)',
    file: 'preset-305-milkwave-airhandler-(principle-of-sharing).json',
    name: 'Airhandler (Principle of Sharing)',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Shaderless native candidate selected for proof expansion.'
  },
  {
    id: 'preset-314-milkwave-hard-drink-(half-infinitea)',
    file: 'preset-314-milkwave-hard-drink-(half-infinitea).json',
    name: 'Hard Drink (Half-Infinitea)',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Shaderless native candidate selected for proof expansion.'
  },
  {
    id: 'preset-317-milkwave-potion-of-spirits',
    file: 'preset-317-milkwave-potion-of-spirits.json',
    name: 'Potion of Spirits',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Shaderless native candidate selected for proof expansion.'
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
    id: 'preset-320-milkwave-songflower-(moss-posy)',
    file: 'preset-320-milkwave-songflower-(moss-posy).json',
    name: 'Songflower (Moss Posy)',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Shaderless native candidate selected for proof expansion.'
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
