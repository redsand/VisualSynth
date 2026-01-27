import type { AssetItem, LayerConfig } from '../../shared/project';
import type { Store } from '../../state/store';
import { actions } from '../../state/actions';
import { GENERATORS, GeneratorId, toggleFavorite, updateRecents } from '../../shared/generatorLibrary';
import { assetService } from '../assetService';
import { setStatus } from '../../state/events';

type AssetLayerId = 'layer-plasma' | 'layer-spectrum';

export interface LayerPanelDeps {
  store: Store;
  setLayerAsset: (layerId: AssetLayerId, asset: AssetItem | null, video?: HTMLVideoElement, textCanvas?: HTMLCanvasElement) => Promise<void>;
  onEffectBoost: (id: 'bloom' | 'feedback' | 'kaleidoscope' | 'chroma' | 'posterize' | 'blur' | 'trails') => void;
  onEnableParticles: () => void;
  onEnableSdf: () => void;
  onSetVisualizerMode: (mode: 'off' | 'spectrum' | 'waveform' | 'oscilloscope') => void;
  onLayerListChanged: () => void;
  onPerformanceToggleSync: () => void;
}

export interface LayerPanelApi {
  renderLayerList: () => void;
  refreshGeneratorUI: () => void;
  loadGeneratorLibrary: () => void;
  addGenerator: (id: GeneratorId) => void;
  syncLayerAsset: (layer: LayerConfig) => void;
}

export const createLayerPanel = ({
  store,
  setLayerAsset,
  onEffectBoost,
  onEnableParticles,
  onEnableSdf,
  onSetVisualizerMode,
  onLayerListChanged,
  onPerformanceToggleSync
}: LayerPanelDeps): LayerPanelApi => {
  const layerList = document.getElementById('layer-list') as HTMLDivElement;
  const generatorSelect = document.getElementById('generator-select') as HTMLSelectElement;
  const generatorFavorites = document.getElementById('generator-favorites') as HTMLDivElement;
  const generatorRecents = document.getElementById('generator-recents') as HTMLDivElement;

  let generatorFavoritesState: GeneratorId[] = [];
  let generatorRecentsState: GeneratorId[] = [];

  const assetLayerBlendModes: Record<AssetLayerId, number> = {
    'layer-plasma': store.getState().renderSettings.assetLayerBlendModes['layer-plasma'],
    'layer-spectrum': store.getState().renderSettings.assetLayerBlendModes['layer-spectrum']
  };
  const assetLayerAudioReact: Record<AssetLayerId, number> = {
    'layer-plasma': store.getState().renderSettings.assetLayerAudioReact['layer-plasma'],
    'layer-spectrum': store.getState().renderSettings.assetLayerAudioReact['layer-spectrum']
  };

  const formatAssetLabel = (asset: AssetItem) => `${asset.name} (${asset.kind})`;
  const isAssetLayerId = (value: string): value is AssetLayerId =>
    (['layer-plasma', 'layer-spectrum'] as const).includes(value as AssetLayerId);

  const assignAssetToLayer = async (layer: LayerConfig, assetId: string | null, forceRefresh = false) => {
    if (!forceRefresh && layer.assetId === assetId) return;
    layer.assetId = assetId ?? undefined;
    const target = assetId ? store.getState().project.assets.find((item) => item.id === assetId) ?? null : null;
    if (!isAssetLayerId(layer.id)) {
      setStatus(`${layer.name} does not support texture overrides yet`);
      return;
    }
    try {
      const previewVideo = target ? assetService.getLivePreview(target.id) : undefined;
      const textCanvas = target?.kind === 'text' ? assetService.getTextCanvas(target) ?? undefined : undefined;
      await setLayerAsset(layer.id, target, previewVideo, textCanvas);
      if (target) {
        setStatus(`${layer.name} now using ${target.name}`);
      } else {
        setStatus(`${layer.name} asset cleared`);
      }
    } catch {
      setStatus(`Failed to bind asset to ${layer.name}`);
    }
  };

  const syncLayerAsset = (layer: LayerConfig) => {
    void assignAssetToLayer(layer, layer.assetId ?? null);
  };

  const refreshLayersForAsset = (assetId: string) => {
    store.getState().project.scenes.forEach((scene) => {
      scene.layers.forEach((layer) => {
        if (layer.assetId === assetId) {
          void assignAssetToLayer(layer, assetId, true);
        }
      });
    });
  };

  const buildLayerAssetSelect = (layer: LayerConfig) => {
    const select = document.createElement('select');
    select.className = 'layer-asset-select';
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = 'None';
    select.appendChild(noneOption);
    const assets = store.getState().project.assets;
    if (assets.length === 0) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = 'No assets loaded (System > Assets)';
      emptyOption.disabled = true;
      select.appendChild(emptyOption);
    }
    assets.forEach((asset) => {
      const option = document.createElement('option');
      option.value = asset.id;
      option.textContent = formatAssetLabel(asset);
      select.appendChild(option);
    });
    select.value = layer.assetId ?? '';
    select.addEventListener('change', () => {
      void assignAssetToLayer(layer, select.value || null);
    });
    return select;
  };

  const renderLayerList = () => {
    layerList.innerHTML = '';
    const scene = store.getState().project.scenes.find((item) => item.id === store.getState().project.activeSceneId);
    if (!scene) return;
    scene.layers.forEach((layer, index) => {
      const row = document.createElement('div');
      row.className = 'layer-row';

      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = layer.enabled;
      checkbox.dataset.learnTarget = `${layer.id}.enabled`;
      checkbox.dataset.learnLabel = `${layer.name} Enabled`;
      checkbox.addEventListener('change', () => {
        layer.enabled = checkbox.checked;
        onPerformanceToggleSync();
        setStatus(`${layer.name} ${checkbox.checked ? 'enabled' : 'disabled'}`);
      });
      const text = document.createElement('span');
      text.textContent = layer.name;
      label.appendChild(checkbox);
      label.appendChild(text);

      const controls = document.createElement('div');
      controls.className = 'layer-controls';
      const upButton = document.createElement('button');
      upButton.textContent = '↑';
      upButton.disabled = index === 0;
      upButton.addEventListener('click', () => moveLayer(scene.id, layer.id, -1));
      const downButton = document.createElement('button');
      downButton.textContent = '↓';
      downButton.disabled = index === scene.layers.length - 1;
      downButton.addEventListener('click', () => moveLayer(scene.id, layer.id, 1));
      controls.appendChild(upButton);
      controls.appendChild(downButton);

      row.appendChild(label);
      row.appendChild(controls);
      const assetControl = document.createElement('div');
      assetControl.className = 'layer-asset-control';
      assetControl.appendChild(buildLayerAssetSelect(layer));

      if (layer.id === 'layer-plasma' || layer.id === 'layer-spectrum') {
        const layerId = layer.id as AssetLayerId;

        const blendLabel = document.createElement('label');
        blendLabel.textContent = 'Blend:';
        blendLabel.className = 'asset-control-label';
        const blendSelect = document.createElement('select');
        blendSelect.className = 'asset-blend-select';
        const blendModes = ['Normal', 'Add', 'Multiply', 'Screen', 'Overlay', 'Difference'];
        blendModes.forEach((mode, i) => {
          const opt = document.createElement('option');
          opt.value = String(i);
          opt.textContent = mode;
          blendSelect.appendChild(opt);
        });
        blendSelect.value = String(assetLayerBlendModes[layerId]);
        blendSelect.addEventListener('change', () => {
          const value = Number(blendSelect.value);
          assetLayerBlendModes[layerId] = value;
          actions.setAssetBlendMode(store, layerId, value);
        });
        assetControl.appendChild(blendLabel);
        assetControl.appendChild(blendSelect);

        const reactLabel = document.createElement('label');
        reactLabel.textContent = 'Audio:';
        reactLabel.className = 'asset-control-label';
        const reactSlider = document.createElement('input');
        reactSlider.type = 'range';
        reactSlider.min = '0';
        reactSlider.max = '1';
        reactSlider.step = '0.05';
        reactSlider.value = String(assetLayerAudioReact[layerId]);
        reactSlider.className = 'asset-audio-react';
        reactSlider.addEventListener('input', () => {
          const value = Number(reactSlider.value);
          assetLayerAudioReact[layerId] = value;
          actions.setAssetAudioReact(store, layerId, value);
        });
        assetControl.appendChild(reactLabel);
        assetControl.appendChild(reactSlider);
      }

      row.appendChild(assetControl);
      layerList.appendChild(row);
      syncLayerAsset(layer);
    });

    const visualizerRow = document.createElement('div');
    visualizerRow.className = 'layer-row';
    const vizLabel = document.createElement('label');
    const vizToggle = document.createElement('input');
    vizToggle.type = 'checkbox';
    vizToggle.checked = store.getState().project.visualizer.enabled;
    vizToggle.addEventListener('change', () => {
      actions.mutateProject(store, (project) => {
        project.visualizer.enabled = vizToggle.checked;
      });
      setStatus(`Visualizer ${vizToggle.checked ? 'enabled' : 'disabled'}`);
    });
    const vizText = document.createElement('span');
    vizText.textContent = 'Visualizer Overlay';
    vizLabel.appendChild(vizToggle);
    vizLabel.appendChild(vizText);
    const vizControls = document.createElement('div');
    vizControls.className = 'layer-controls';
    visualizerRow.appendChild(vizLabel);
    visualizerRow.appendChild(vizControls);
    layerList.appendChild(visualizerRow);
  };

  const moveLayer = (sceneId: string, layerId: string, direction: -1 | 1) => {
    const scene = store.getState().project.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    const index = scene.layers.findIndex((layer) => layer.id === layerId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= scene.layers.length) return;
    const next = [...scene.layers];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    scene.layers = next;
    renderLayerList();
  };

  const loadGeneratorLibrary = () => {
    try {
      const favorites = localStorage.getItem('vs.generator.favorites');
      const recents = localStorage.getItem('vs.generator.recents');
      if (favorites) {
        generatorFavoritesState = JSON.parse(favorites) as GeneratorId[];
      }
      if (recents) {
        generatorRecentsState = JSON.parse(recents) as GeneratorId[];
      }
    } catch {
      generatorFavoritesState = [];
      generatorRecentsState = [];
    }
  };

  const saveGeneratorLibrary = () => {
    localStorage.setItem('vs.generator.favorites', JSON.stringify(generatorFavoritesState));
    localStorage.setItem('vs.generator.recents', JSON.stringify(generatorRecentsState));
  };

  const renderGeneratorList = (container: HTMLElement, items: GeneratorId[]) => {
    container.innerHTML = '';
    items.forEach((id) => {
      const entry = GENERATORS.find((gen) => gen.id === id);
      if (!entry) return;
      const chip = document.createElement('div');
      chip.className = 'generator-chip';
      const label = document.createElement('span');
      label.textContent = entry.name;
      const addButton = document.createElement('button');
      addButton.textContent = '+';
      addButton.title = 'Add generator';
      addButton.addEventListener('click', () => addGenerator(entry.id));
      const favButton = document.createElement('button');
      favButton.textContent = '★';
      favButton.title = 'Toggle favorite';
      favButton.addEventListener('click', () => {
        generatorFavoritesState = toggleFavorite(generatorFavoritesState, entry.id);
        saveGeneratorLibrary();
        refreshGeneratorUI();
      });
      chip.appendChild(label);
      chip.appendChild(addButton);
      chip.appendChild(favButton);
      container.appendChild(chip);
    });
  };

  const refreshGeneratorUI = () => {
    generatorSelect.innerHTML = '';
    GENERATORS.forEach((gen) => {
      const option = document.createElement('option');
      option.value = gen.id;
      option.textContent = gen.name;
      generatorSelect.appendChild(option);
    });
    renderGeneratorList(generatorFavorites, generatorFavoritesState);
    renderGeneratorList(generatorRecents, generatorRecentsState);
  };

  const addGenerator = (id: GeneratorId) => {
    if (id === 'layer-plasma') {
      actions.setLayerEnabled(store, 'layer-plasma', true);
      setStatus('Plasma layer enabled.');
    }
    if (id === 'layer-spectrum') {
      actions.setLayerEnabled(store, 'layer-spectrum', true);
      setStatus('Spectrum layer enabled.');
    }
    if (id === 'layer-origami') {
      actions.ensureLayer(store, 'layer-origami');
      setStatus('Origami fold layer enabled.');
    }
    if (id === 'layer-glyph') {
      actions.ensureLayer(store, 'layer-glyph');
      setStatus('Glyph language layer enabled.');
    }
    if (id === 'layer-crystal') {
      actions.ensureLayer(store, 'layer-crystal');
      setStatus('Crystal harmonics layer enabled.');
    }
    if (id === 'layer-inkflow') {
      actions.ensureLayer(store, 'layer-inkflow');
      setStatus('Ink flow layer enabled.');
    }
    if (id === 'layer-topo') {
      actions.ensureLayer(store, 'layer-topo');
      setStatus('Topo terrain layer enabled.');
    }
    if (id === 'layer-weather') {
      actions.ensureLayer(store, 'layer-weather');
      setStatus('Audio weather layer enabled.');
    }
    if (id === 'layer-portal') {
      actions.ensureLayer(store, 'layer-portal');
      setStatus('Wormhole portal layer enabled.');
    }
    if (id === 'layer-oscillo') {
      actions.ensureLayer(store, 'layer-oscillo');
      setStatus('Sacred oscilloscope layer enabled.');
    }
    if (id === 'viz-off') {
      actions.mutateProject(store, (project) => {
        project.visualizer.enabled = false;
      });
      onSetVisualizerMode('off');
      setStatus('Visualizer off.');
    }
    if (id === 'viz-spectrum') {
      actions.mutateProject(store, (project) => {
        project.visualizer.enabled = true;
      });
      onSetVisualizerMode('spectrum');
      setStatus('Visualizer: Spectrum.');
    }
    if (id === 'viz-waveform') {
      actions.mutateProject(store, (project) => {
        project.visualizer.enabled = true;
      });
      onSetVisualizerMode('waveform');
      setStatus('Visualizer: Waveform.');
    }
    if (id === 'viz-oscilloscope') {
      actions.mutateProject(store, (project) => {
        project.visualizer.enabled = true;
      });
      onSetVisualizerMode('oscilloscope');
      setStatus('Visualizer: Oscilloscope.');
    }
    if (id === 'gen-particles') {
      onEnableParticles();
      setStatus('Particle field enabled.');
    }
    if (id === 'gen-sdf') {
      onEnableSdf();
      setStatus('SDF shapes enabled.');
    }
    if (id === 'fx-bloom') {
      onEffectBoost('bloom');
      setStatus('Bloom effect boosted.');
    }
    if (id === 'fx-feedback') {
      onEffectBoost('feedback');
      setStatus('Feedback tunnel enabled.');
    }
    if (id === 'fx-kaleidoscope') {
      onEffectBoost('kaleidoscope');
      setStatus('Kaleidoscope effect enabled.');
    }
    if (id === 'fx-chroma') {
      onEffectBoost('chroma');
      setStatus('Chromatic aberration enabled.');
    }
    if (id === 'fx-posterize') {
      onEffectBoost('posterize');
      setStatus('Posterize effect enabled.');
    }
    if (id === 'fx-blur') {
      onEffectBoost('blur');
      setStatus('Blur effect enabled.');
    }
    if (id === 'fx-trails') {
      onEffectBoost('trails');
      setStatus('Trails enabled.');
    }
    generatorRecentsState = updateRecents(generatorRecentsState, id);
    saveGeneratorLibrary();
    refreshGeneratorUI();
    onLayerListChanged();
  };

  return {
    renderLayerList,
    refreshGeneratorUI,
    loadGeneratorLibrary,
    addGenerator,
    syncLayerAsset
  };
};
