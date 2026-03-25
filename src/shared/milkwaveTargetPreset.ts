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
    id: 'preset-1044-milkwave-bass-detector---arms-3',
    file: 'preset-1044-milkwave-bass-detector---arms-3.json',
    name: 'bass detector - arms 3',
    expectedAuditClassification: 'native-supported',
    expectedFallbackUsed: false,
    notes: 'Audio-reactive baseline candidate.'
  },
  {
    id: 'preset-1000-milkwave-!!-!!-!!-!!-v-violas-rainbows-qradjo-pw-ps32yax240',
    file: 'preset-1000-milkwave-!!-!!-!!-!!-v-violas-rainbows-qradjo-pw-ps32yax240.json',
    name: '!! !! !! !! v violas rainbows qradjo pw ps32yax240000zqk000!000000000000000000000000000000000',
    expectedAuditClassification: 'supported-with-degradation',
    expectedFallbackUsed: true,
    notes: 'Custom warp/comp degradation case.'
  },
  {
    id: 'preset-1007-milkwave-threads-of-fate0',
    file: 'preset-1007-milkwave-threads-of-fate0.json',
    name: 'Threads of Fate0',
    expectedAuditClassification: 'runtime-failed',
    expectedFallbackUsed: true,
    notes: 'Known comp-link failure case.'
  }
];

export const TARGET_MILKWAVE_PRESET_ID = FOCUSED_MILKWAVE_PRESETS[0].id;
export const TARGET_MILKWAVE_PRESET_FILE = FOCUSED_MILKWAVE_PRESETS[0].file;
export const TARGET_MILKWAVE_PRESET_NAME = FOCUSED_MILKWAVE_PRESETS[0].name;

export const isTargetMilkwavePresetId = (presetId: string): boolean =>
  presetId === TARGET_MILKWAVE_PRESET_ID;

export const isFocusedMilkwavePresetId = (presetId: string): boolean =>
  FOCUSED_MILKWAVE_PRESETS.some((preset) => preset.id === presetId);
