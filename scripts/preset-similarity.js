const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

const parseArgValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const options = {
  threshold: 0.75,
  limit: 30,
  showAll: false,
  json: false,
  perPreset: 0
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--threshold' || arg === '-t') {
    options.threshold = parseArgValue(args[i + 1], options.threshold);
    i += 1;
  } else if (arg === '--limit' || arg === '-l') {
    options.limit = Math.max(1, parseArgValue(args[i + 1], options.limit));
    i += 1;
  } else if (arg === '--show-all') {
    options.showAll = true;
  } else if (arg === '--json') {
    options.json = true;
  } else if (arg === '--per-preset') {
    options.perPreset = Math.max(0, parseArgValue(args[i + 1], 0));
    i += 1;
  } else if (arg === '--help' || arg === '-h') {
    console.log('Usage: node scripts/preset-similarity.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  -t, --threshold <num>   Minimum similarity score (0-1). Default 0.75');
    console.log('  -l, --limit <num>       Max pairs to print. Default 30');
    console.log('  --show-all              Show all pairs regardless of threshold');
    console.log('  --json                  Output JSON');
    console.log('  --per-preset <num>      Show top N neighbors per preset');
    process.exit(0);
  }
}

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');
const files = fs.readdirSync(presetsDir).filter((name) => name.endsWith('.json'));

const toToken = (value) => `${value}`.trim().toLowerCase();
const addToken = (set, value, prefix = '') => {
  if (value === undefined || value === null) return;
  const token = toToken(value);
  if (!token) return;
  set.add(prefix ? `${prefix}:${token}` : token);
};

const collectNumeric = (map, prefix, obj) => {
  if (!obj || typeof obj !== 'object') return;
  Object.entries(obj).forEach(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'number' && Number.isFinite(value)) {
      map.set(nextPrefix, value);
    } else if (value && typeof value === 'object') {
      collectNumeric(map, nextPrefix, value);
    }
  });
};

const buildFeatures = (preset) => {
  const layerIds = new Set();
  const enabledLayerIds = new Set();
  const metaTokens = new Set();
  const catTokens = new Set();
  const numeric = new Map();

  const metadata = preset?.metadata || {};
  addToken(metaTokens, metadata.category, 'category');
  addToken(metaTokens, metadata.presetType, 'type');
  addToken(metaTokens, metadata.intendedMusicStyle, 'music');
  addToken(metaTokens, metadata.activeModeId, 'mode');
  addToken(metaTokens, metadata.activeEngineId, 'engine');
  (metadata.visualIntentTags || []).forEach((tag) => addToken(metaTokens, tag, 'intent'));
  (metadata.colorChemistry || []).forEach((tag) => addToken(metaTokens, tag, 'color'));

  (preset.scenes || []).forEach((scene, sceneIndex) => {
    addToken(catTokens, scene.intent, 'scene-intent');
    addToken(catTokens, scene.trigger?.type, 'scene-trigger');
    const scenePrefix = `scene${sceneIndex + 1}`;
    collectNumeric(numeric, `${scenePrefix}.transition_in`, scene.transition_in);
    collectNumeric(numeric, `${scenePrefix}.transition_out`, scene.transition_out);

    (scene.layers || []).forEach((layer) => {
      if (!layer || !layer.id) return;
      layerIds.add(layer.id);
      if (layer.enabled) enabledLayerIds.add(layer.id);

      addToken(catTokens, layer.role, `role:${layer.id}`);
      addToken(catTokens, layer.blendMode, `blend:${layer.id}`);
      addToken(catTokens, layer.generator, `generator:${layer.id}`);

      collectNumeric(numeric, `${layer.id}.transform`, layer.transform);
      collectNumeric(numeric, `${layer.id}.params`, layer.params);
    });
  });

  return { layerIds, enabledLayerIds, metaTokens, catTokens, numeric };
};

const jaccard = (a, b) => {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  a.forEach((value) => {
    if (b.has(value)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const numericSimilarity = (a, b) => {
  const sharedKeys = [];
  a.forEach((value, key) => {
    if (b.has(key)) sharedKeys.push(key);
  });
  if (sharedKeys.length === 0) return 0.5;
  let total = 0;
  sharedKeys.forEach((key) => {
    const valueA = a.get(key);
    const valueB = b.get(key);
    const denom = Math.max(Math.abs(valueA), Math.abs(valueB), 1);
    const score = Math.max(0, 1 - Math.abs(valueA - valueB) / denom);
    total += score;
  });
  return total / sharedKeys.length;
};

const presets = files.map((file) => {
  const fullPath = path.join(presetsDir, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const preset = JSON.parse(raw);
  const name = preset?.metadata?.name || preset?.name || file;
  return {
    file,
    name,
    features: buildFeatures(preset)
  };
});

const pairs = [];

for (let i = 0; i < presets.length; i += 1) {
  for (let j = i + 1; j < presets.length; j += 1) {
    const left = presets[i];
    const right = presets[j];
    const layerSim = jaccard(left.features.layerIds, right.features.layerIds);
    const enabledSim = jaccard(left.features.enabledLayerIds, right.features.enabledLayerIds);
    const metaSim = jaccard(left.features.metaTokens, right.features.metaTokens);
    const catSim = jaccard(left.features.catTokens, right.features.catTokens);
    const numSim = numericSimilarity(left.features.numeric, right.features.numeric);

    const score =
      layerSim * 0.4 +
      enabledSim * 0.2 +
      metaSim * 0.2 +
      catSim * 0.1 +
      numSim * 0.1;

    if (options.showAll || score >= options.threshold) {
      pairs.push({
        a: left.file,
        b: right.file,
        score,
        layerSim,
        enabledSim,
        metaSim,
        catSim,
        numSim
      });
    }
  }
}

pairs.sort((a, b) => b.score - a.score);

const formatPct = (value) => `${(value * 100).toFixed(1)}%`;

if (options.json) {
  console.log(JSON.stringify(pairs, null, 2));
  process.exit(0);
}

console.log(`Presets: ${presets.length}`);
console.log(`Pairs evaluated: ${(presets.length * (presets.length - 1)) / 2}`);
console.log(`Threshold: ${options.showAll ? 'none' : options.threshold}`);
console.log('');

const topPairs = pairs.slice(0, options.limit);
if (topPairs.length === 0) {
  console.log('No pairs exceeded the threshold.');
} else {
  console.log(`Top pairs (limit ${options.limit}):`);
  topPairs.forEach((pair) => {
    console.log(
      `${formatPct(pair.score)} ${pair.a} <> ${pair.b} | layers ${formatPct(pair.layerSim)} enabled ${formatPct(
        pair.enabledSim
      )} meta ${formatPct(pair.metaSim)} params ${formatPct(pair.numSim)}`
    );
  });
}

if (options.perPreset > 0) {
  console.log('');
  console.log(`Top ${options.perPreset} neighbors per preset:`);
  presets.forEach((preset) => {
    const neighbors = pairs
      .filter((pair) => pair.a === preset.file || pair.b === preset.file)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.perPreset)
      .map((pair) => {
        const other = pair.a === preset.file ? pair.b : pair.a;
        return `${formatPct(pair.score)} ${other}`;
      });

    console.log(`${preset.file}: ${neighbors.join(' | ') || 'none'}`);
  });
}
