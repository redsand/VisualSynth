const fs = require('fs');
const path = require('path');

const presetsDir = path.join(process.cwd(), 'assets', 'presets');
const files = fs.readdirSync(presetsDir).filter((f) => f.endsWith('.json'));

const keywordToLayer = [
  { keys: ['spectrum', 'bars'], id: 'layer-spectrum' },
  { keys: ['plasma'], id: 'layer-plasma' },
  { keys: ['origami'], id: 'layer-origami' },
  { keys: ['glyph'], id: 'layer-glyph' },
  { keys: ['crystal'], id: 'layer-crystal' },
  { keys: ['ink'], id: 'layer-inkflow' },
  { keys: ['topo', 'terrain'], id: 'layer-topo' },
  { keys: ['weather', 'storm', 'hurricane'], id: 'layer-weather' },
  { keys: ['portal', 'wormhole'], id: 'layer-portal' },
  { keys: ['oscillo', 'oscilloscope'], id: 'layer-oscillo' },
  { keys: ['media', 'video', 'typography', 'text'], id: 'layer-media' }
];

const sdfPairLayers = [
  'layer-plasma',
  'layer-spectrum',
  'layer-origami',
  'layer-glyph',
  'layer-crystal',
  'layer-inkflow',
  'layer-topo',
  'layer-weather',
  'layer-portal',
  'layer-oscillo'
];

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const pickSdfLayer = (filename) => {
  const index = hashString(filename) % sdfPairLayers.length;
  return sdfPairLayers[index];
};

const collectIdentityLayers = (text) => {
  const lowered = text.toLowerCase();
  const ids = new Set();
  keywordToLayer.forEach(({ keys, id }) => {
    if (keys.some((key) => lowered.includes(key))) {
      ids.add(id);
    }
  });
  return ids;
};

const rebuildAssignedLayers = (layers) => {
  const roles = { core: [], support: [], atmosphere: [] };
  layers.forEach((layer) => {
    const role = layer.role || 'support';
    if (!roles[role]) roles[role] = [];
    roles[role].push(layer.id);
  });
  return roles;
};

const report = [];

files.forEach((file) => {
  const fullPath = path.join(presetsDir, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const preset = JSON.parse(raw);
  const presetName = preset?.metadata?.name || preset?.name || file;
  const presetCategory = preset?.metadata?.category || preset?.category || '';
  const identityFromName = collectIdentityLayers(`${presetName} ${presetCategory}`);
  const isSdf = `${presetName} ${presetCategory}`.toLowerCase().includes('sdf');
  const sdfLayer = isSdf ? pickSdfLayer(file) : null;

  let changed = false;
  preset.scenes?.forEach((scene) => {
    if (!scene.layers || scene.layers.length === 0) return;

    const enabledIds = new Set(
      scene.layers.filter((layer) => layer.enabled).map((layer) => layer.id)
    );
    const identityIds = new Set(identityFromName);
    if (isSdf && sdfLayer) identityIds.add(sdfLayer);

    const keepIds = new Set([...enabledIds, ...identityIds]);
    if (keepIds.size === 0) {
      const fallback = sdfLayer || scene.layers[0].id;
      keepIds.add(fallback);
    }

    const nextLayers = scene.layers.filter((layer) => keepIds.has(layer.id));
    if (nextLayers.length !== scene.layers.length) {
      scene.layers = nextLayers;
      changed = true;
    }

    if (!nextLayers.some((layer) => layer.enabled)) {
      const preferred =
        (sdfLayer && nextLayers.find((layer) => layer.id === sdfLayer)) ||
        nextLayers.find((layer) => identityIds.has(layer.id)) ||
        nextLayers[0];
      if (preferred) {
        preferred.enabled = true;
        changed = true;
      }
    }

    const nextAssigned = rebuildAssignedLayers(scene.layers);
    scene.assigned_layers = nextAssigned;
    changed = true;
  });

  if (changed) {
    fs.writeFileSync(fullPath, JSON.stringify(preset, null, 2) + '\n');
  }

  const enabledSummary = preset.scenes
    ?.map((scene) => {
      const enabled = scene.layers?.filter((layer) => layer.enabled).length || 0;
      const total = scene.layers?.length || 0;
      return `${enabled}/${total}`;
    })
    .join(',');

  report.push({ file, changed, enabledSummary });
});

const changed = report.filter((item) => item.changed);
console.log(`Presets scanned: ${report.length}`);
console.log(`Presets changed: ${changed.length}`);
if (changed.length > 0) {
  changed.forEach((item) => {
    console.log(`${item.file} -> ${item.enabledSummary}`);
  });
}
