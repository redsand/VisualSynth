import { removeLayer as removeLayerFromScene } from '../../../shared/layers';
import type { AssetItem, LayerConfig } from '../../../shared/project';
import type { Store } from '../../state/store';
import { actions } from '../../state/actions';
import { GENERATORS, GeneratorId, getVisibleGenerators, toggleFavorite, updateRecents, supportsAsset } from '../../../shared/generatorLibrary';
import { assetService } from '../assetService';
import { setStatus } from '../../state/events';
import type { CustomShaderBlock } from '../../../shared/customShaderBlock';

type AssetLayerId = 'layer-plasma' | 'layer-spectrum' | 'layer-media';

export interface LayerPanelDeps {
  store: Store;
  setLayerAsset: (layerId: string, asset: AssetItem | null, video?: HTMLVideoElement, textCanvas?: HTMLCanvasElement) => Promise<void>;
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
  const visibleGenerators = getVisibleGenerators();

  const assetLayerBlendModes: Record<AssetLayerId, number> = {
    'layer-plasma': store.getState().renderSettings.assetLayerBlendModes['layer-plasma'],
    'layer-spectrum': store.getState().renderSettings.assetLayerBlendModes['layer-spectrum'],
    'layer-media': 3
  };
  const assetLayerAudioReact: Record<AssetLayerId, number> = {
    'layer-plasma': store.getState().renderSettings.assetLayerAudioReact['layer-plasma'],
    'layer-spectrum': store.getState().renderSettings.assetLayerAudioReact['layer-spectrum'],
    'layer-media': 0.5
  };

  const formatAssetLabel = (asset: AssetItem) => {
    const status = asset.missing ? ' [MISSING]' : '';
    return `${asset.name} (${asset.kind})${status}`;
  };

  const assignAssetToLayer = async (layer: LayerConfig, assetId: string | null, forceRefresh = false) => {
    if (!forceRefresh && layer.assetId === assetId) return;
    layer.assetId = assetId ?? undefined;
    const target = assetId ? store.getState().project.assets.find((item) => item.id === assetId) ?? null : null;
    
    if (target?.kind === 'internal') {
        setStatus(`${layer.name} now using internal source: ${target.name}`);
        if (supportsAsset(layer.id)) {
            await setLayerAsset(layer.id as AssetLayerId, target);
        }
        return;
    }

    if (!supportsAsset(layer.id)) {
      setStatus(`${layer.name} does not support texture overrides`);
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

  const buildCustomParamsPanel = (layer: LayerConfig, block: CustomShaderBlock): HTMLDivElement => {
    const panel = document.createElement('div');
    panel.className = 'custom-params-panel';

    Object.entries(block.params).forEach(([key, def]) => {
      const row = document.createElement('div');
      row.className = 'custom-param-row';

      const label = document.createElement('label');
      label.className = 'custom-param-label';
      label.textContent = def.label ?? key;

      const currentVal = layer.params?.[key] ?? def.default;
      const isFloat = def.type === 'float';

      if (isFloat) {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(def.min ?? 0);
        slider.max = String(def.max ?? 1);
        slider.step = '0.01';
        slider.value = String(currentVal as number);
        slider.className = 'custom-param-slider';
        slider.addEventListener('input', () => {
          if (!layer.params) layer.params = {};
          layer.params[key] = parseFloat(slider.value);
        });
        row.appendChild(label);
        row.appendChild(slider);
      } else {
        // vec2/vec3: render as readonly display for now
        const display = document.createElement('span');
        display.className = 'custom-param-display';
        display.textContent = Array.isArray(currentVal)
          ? `[${(currentVal as number[]).map(v => v.toFixed(2)).join(', ')}]`
          : String(currentVal);
        row.appendChild(label);
        row.appendChild(display);
      }

      panel.appendChild(row);
    });

    return panel;
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
      if (!layer.role) {
        layer.role = 'support';
      }
      const roleBadge = document.createElement('span');
      roleBadge.className = `layer-role-badge ${layer.role}`;
      roleBadge.textContent = layer.role.toUpperCase();
      label.appendChild(checkbox);
      label.appendChild(text);
      label.appendChild(roleBadge);

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
      const removeButton = document.createElement('button');
      removeButton.textContent = 'x';
      removeButton.addEventListener('click', () => removeLayer(scene.id, layer.id));
      controls.appendChild(upButton);
      controls.appendChild(downButton);
      controls.appendChild(removeButton);

      row.appendChild(label);
      row.appendChild(controls);
      const assetControl = document.createElement('div');
      assetControl.className = 'layer-asset-control';

      if (supportsAsset(layer.id)) {
        assetControl.appendChild(buildLayerAssetSelect(layer));
      }

      if (layer.id === 'layer-oscillo') {
        const runtime = store.getState().runtime;
        
        const modeLabel = document.createElement('label');
        modeLabel.textContent = 'Mode:';
        modeLabel.className = 'asset-control-label';
        const modeSelect = document.createElement('select');
        modeSelect.className = 'oscillo-mode-select';
        const modes = ['Circle', 'Lissajous', 'Rose'];
        modes.forEach((m, i) => {
          const opt = document.createElement('option');
          opt.value = String(i);
          opt.textContent = m;
          modeSelect.appendChild(opt);
        });
        modeSelect.value = String(runtime.oscilloMode);
        modeSelect.addEventListener('change', () => {
          actions.setOscilloMode(store, Number(modeSelect.value));
        });
        assetControl.appendChild(modeLabel);
        assetControl.appendChild(modeSelect);

        const freezeLabel = document.createElement('label');
        freezeLabel.textContent = 'Freeze:';
        freezeLabel.className = 'asset-control-label';
        const freezeCheck = document.createElement('input');
        freezeCheck.type = 'checkbox';
        freezeCheck.className = 'oscillo-freeze-check';
        freezeCheck.checked = runtime.oscilloFreeze > 0.5;
        freezeCheck.addEventListener('change', () => {
          actions.setOscilloFreeze(store, freezeCheck.checked ? 1 : 0);
        });
        assetControl.appendChild(freezeLabel);
        assetControl.appendChild(freezeCheck);

        const rotateLabel = document.createElement('label');
        rotateLabel.textContent = 'Rotate:';
        rotateLabel.className = 'asset-control-label';
        const rotateSlider = document.createElement('input');
        rotateSlider.type = 'range';
        rotateSlider.min = '0';
        rotateSlider.max = '5';
        rotateSlider.step = '1';
        rotateSlider.value = String(runtime.oscilloRotate);
        rotateSlider.className = 'oscillo-rotate-slider';
        rotateSlider.addEventListener('input', () => {
          actions.setOscilloRotate(store, Number(rotateSlider.value));
        });
        assetControl.appendChild(rotateLabel);
        assetControl.appendChild(rotateSlider);
      }

      if (supportsAsset(layer.id)) {
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

      // Find custom shader block for this layer (if any)
      const customBlock = layer.generatorId
        ? (store.getState().project.customShaderBlocks ?? []).find(b => b.id === layer.generatorId)
        : undefined;

      if (customBlock && Object.keys(customBlock.params).length > 0) {
        const paramsPanel = buildCustomParamsPanel(layer, customBlock);
        row.appendChild(paramsPanel);
      }

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
    const coreIndex = scene.layers.findIndex((layer) => layer.role === 'core');
    if (coreIndex >= 0 && coreIndex !== scene.layers.length - 1) {
      const [coreLayer] = scene.layers.splice(coreIndex, 1);
      scene.layers.push(coreLayer);
    }
    renderLayerList();
  };

  const removeLayer = (sceneId: string, layerId: string) => {
    const scene = store.getState().project.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    scene.layers = removeLayerFromScene(scene, layerId);
    let coreAssigned = false;
    scene.layers.forEach((layer) => {
      if (layer.role === 'core') {
        if (coreAssigned) {
          layer.role = 'support';
        } else {
          coreAssigned = true;
        }
      }
    });
    if (!coreAssigned && scene.layers.length > 0) {
      const fallback = scene.layers.find((item) => item.enabled) ?? scene.layers[0];
      if (fallback) fallback.role = 'core';
    }
    const coreIndex = scene.layers.findIndex((layer) => layer.role === 'core');
    if (coreIndex >= 0 && coreIndex !== scene.layers.length - 1) {
      const [coreLayer] = scene.layers.splice(coreIndex, 1);
      scene.layers.push(coreLayer);
    }
    renderLayerList();
    onLayerListChanged();
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
      const entry = visibleGenerators.find((gen) => gen.id === id);
      if (!entry) return;
      const chip = document.createElement('div');
      chip.className = 'generator-chip';
      if (entry.supportsAsset) {
        chip.classList.add('supports-asset');
        chip.title = 'Supports image/video assets';
      }
      const label = document.createElement('span');
      label.textContent = entry.name;
      if (entry.supportsAsset) {
        const assetIcon = document.createElement('span');
        assetIcon.className = 'asset-support-icon';
        assetIcon.textContent = '🖼️';
        assetIcon.style.marginLeft = '4px';
        assetIcon.style.fontSize = '10px';
        label.appendChild(assetIcon);
      }
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
    visibleGenerators.forEach((gen) => {
      const option = document.createElement('option');
      option.value = gen.id;
      option.textContent = gen.supportsAsset ? `${gen.name} 🖼️` : gen.name;
      generatorSelect.appendChild(option);
    });
    renderGeneratorList(generatorFavorites, generatorFavoritesState);
    renderGeneratorList(generatorRecents, generatorRecentsState);
  };

  const addGenerator = (id: GeneratorId) => {
    const tweakLayer = (
      layerId: string,
      patch: { opacity?: number; blendMode?: LayerConfig['blendMode']; params?: Record<string, number> }
    ) => {
      actions.ensureLayer(store, layerId);
      actions.mutateProject(store, (project) => {
        const scene = project.scenes.find((item) => item.id === project.activeSceneId);
        const layer = scene?.layers.find((item) => item.id === layerId);
        if (!layer) return;
        layer.enabled = true;
        if (patch.opacity !== undefined) layer.opacity = patch.opacity;
        if (patch.blendMode) layer.blendMode = patch.blendMode;
        if (patch.params) {
          layer.params = { ...(layer.params ?? {}), ...patch.params };
        }
      });
      onLayerListChanged();
      onPerformanceToggleSync();
    };

    const setEffects = (patch: Partial<ReturnType<typeof store.getState>['project']['effects']>) => {
      actions.mutateProject(store, (project) => {
        project.effects = {
          ...project.effects,
          ...patch,
          enabled: patch.enabled ?? project.effects.enabled
        };
      });
    };

    const setParticles = (patch: Partial<ReturnType<typeof store.getState>['project']['particles']>) => {
      actions.mutateProject(store, (project) => {
        project.particles = { ...project.particles, ...patch };
      });
    };

    if (id === 'layer-plasma') {
      actions.ensureLayer(store, 'layer-plasma');
      setStatus('Plasma layer enabled.');
    }
    if (id === 'layer-spectrum') {
      actions.ensureLayer(store, 'layer-spectrum');
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
    if (id === 'gen-audio-geometry') {
      tweakLayer('layer-glyph', { opacity: 0.7, blendMode: 'screen', params: { speed: 1.2 } });
      tweakLayer('layer-spectrum', { opacity: 0.85, blendMode: 'add' });
      setStatus('Generator: Audio Geometry added.');
    }
    if (id === 'variant-audio-geometry-prism') {
      tweakLayer('layer-glyph', { opacity: 0.6, blendMode: 'screen', params: { speed: 1.4 } });
      tweakLayer('layer-crystal', { opacity: 0.55, blendMode: 'screen', params: { speed: 1.2, scale: 1.4 } });
      setStatus('Generator: Audio Geometry (Prism) added.');
    }
    if (id === 'gen-organic-fluid') {
      tweakLayer('layer-plasma', { opacity: 0.8, blendMode: 'screen', params: { speed: 0.85, scale: 1.6, complexity: 0.65 } });
      tweakLayer('layer-inkflow', { opacity: 0.65, blendMode: 'screen', params: { speed: 1.1, scale: 1.3 } });
      setStatus('Generator: Organic Fluid added.');
    }
    if (id === 'variant-organic-fluid-ink') {
      tweakLayer('layer-inkflow', { opacity: 0.85, blendMode: 'screen', params: { speed: 1.4, scale: 1.8 } });
      tweakLayer('layer-plasma', { opacity: 0.45, blendMode: 'screen', params: { speed: 0.6, scale: 1.3, complexity: 0.5 } });
      setStatus('Generator: Organic Fluid (Ink) added.');
    }
    if (id === 'gen-neon-wireframe') {
      tweakLayer('layer-topo', { opacity: 0.75, blendMode: 'screen', params: { scale: 1.6, elevation: 0.75 } });
      tweakLayer('layer-glyph', { opacity: 0.4, blendMode: 'screen', params: { speed: 1.1 } });
      setStatus('Generator: Neon Wireframe added.');
    }
    if (id === 'variant-neon-wireframe-grid') {
      tweakLayer('layer-topo', { opacity: 0.8, blendMode: 'screen', params: { scale: 2.0, elevation: 0.9 } });
      tweakLayer('layer-spectrum', { opacity: 0.25, blendMode: 'add' });
      setStatus('Generator: Neon Wireframe (Grid) added.');
    }
    if (id === 'gen-glitch-datamosh') {
      setEffects({ enabled: true, feedback: 0.55, chroma: 0.25, posterize: 0.3, blur: 0.12 });
      setStatus('Generator: Glitch Datamosh added.');
    }
    if (id === 'variant-glitch-datamosh-hard') {
      setEffects({ enabled: true, feedback: 0.7, chroma: 0.35, posterize: 0.45, blur: 0.2 });
      setStatus('Generator: Glitch Datamosh (Hard) added.');
    }
    if (id === 'gen-particle-swarm') {
      tweakLayer('gen-particle-swarm', { opacity: 0.85, blendMode: 'screen' });
      setStatus('Generator: Particle Swarm added.');
    }
    if (id === 'variant-particle-swarm-bloom') {
      tweakLayer('variant-particle-swarm-bloom', { opacity: 0.9, blendMode: 'screen' });
      setStatus('Generator: Particle Swarm (Bloom) added.');
    }
    if (id === 'gen-typography-reveal') {
      tweakLayer('layer-media', { opacity: 0.9, blendMode: 'screen' });
      setStatus('Generator: Typography Reveal (add a text/media asset).');
    }
    if (id === 'variant-typography-reveal-glow') {
      tweakLayer('layer-media', { opacity: 0.95, blendMode: 'screen' });
      setEffects({ enabled: true, bloom: 0.35 });
      setStatus('Generator: Typography Reveal (Glow) added.');
    }
    if (id === 'gen-kaleido-shard') {
      tweakLayer('layer-plasma', { opacity: 0.8, blendMode: 'screen', params: { speed: 1.1, scale: 1.4, complexity: 0.6 } });
      setEffects({ enabled: true, kaleidoscope: 0.7, bloom: 0.25 });
      setStatus('Generator: Kaleido Shards added.');
    }
    if (id === 'variant-kaleido-shard-iris') {
      tweakLayer('layer-plasma', { opacity: 0.85, blendMode: 'screen', params: { speed: 0.9, scale: 1.8, complexity: 0.7 } });
      setEffects({ enabled: true, kaleidoscope: 0.9, bloom: 0.3 });
      setStatus('Generator: Kaleido Shards (Iris) added.');
    }
    if (id === 'gen-radar-hud') {
      tweakLayer('layer-oscillo', { opacity: 0.9, blendMode: 'screen' });
      tweakLayer('layer-spectrum', { opacity: 0.35, blendMode: 'add' });
      setStatus('Generator: Radar HUD added.');
    }
    if (id === 'variant-radar-hud-deep') {
      tweakLayer('layer-oscillo', { opacity: 0.95, blendMode: 'screen' });
      tweakLayer('layer-topo', { opacity: 0.35, blendMode: 'screen', params: { scale: 1.3, elevation: 0.6 } });
      setStatus('Generator: Radar HUD (Deep) added.');
    }
    if (id === 'gen-fractal-bloom') {
      tweakLayer('layer-plasma', { opacity: 0.85, blendMode: 'screen', params: { speed: 0.6, scale: 1.8, complexity: 0.8 } });
      setEffects({ enabled: true, bloom: 0.4 });
      setStatus('Generator: Fractal Bloom added.');
    }
    if (id === 'variant-fractal-bloom-ember') {
      tweakLayer('layer-plasma', { opacity: 0.9, blendMode: 'screen', params: { speed: 0.75, scale: 2.0, complexity: 0.9 } });
      setEffects({ enabled: true, bloom: 0.5, posterize: 0.15 });
      setStatus('Generator: Fractal Bloom (Ember) added.');
    }
    if (id === 'gen-vhs-scanline') {
      setEffects({ enabled: true, chroma: 0.22, blur: 0.18, posterize: 0.15, feedback: 0.05 });
      setStatus('Generator: VHS Scanline added.');
    }
    if (id === 'variant-vhs-scanline-warp') {
      setEffects({ enabled: true, chroma: 0.3, blur: 0.25, posterize: 0.25, feedback: 0.12 });
      setStatus('Generator: VHS Scanline (Warp) added.');
    }
    if (id === 'gen-tunnel-warp') {
      tweakLayer('layer-plasma', { opacity: 0.7, blendMode: 'screen', params: { speed: 1.0, scale: 1.3, complexity: 0.7 } });
      setEffects({ enabled: true, feedback: 0.6, kaleidoscope: 0.3 });
      setStatus('Generator: Tunnel Warp added.');
    }
    if (id === 'variant-tunnel-warp-spiral') {
      tweakLayer('layer-plasma', { opacity: 0.8, blendMode: 'screen', params: { speed: 1.2, scale: 1.5, complexity: 0.8 } });
      setEffects({ enabled: true, feedback: 0.7, kaleidoscope: 0.45 });
      setStatus('Generator: Tunnel Warp (Spiral) added.');
    }
    if (id === 'gen-wormhole-core') {
      tweakLayer('layer-portal', { opacity: 0.8, blendMode: 'screen', params: { style: 2, autoSpawn: 1 } });
      setEffects({ enabled: true, feedback: 0.45 });
      setStatus('Generator: Wormhole Core added.');
    }
    if (id === 'variant-wormhole-core-echo') {
      tweakLayer('layer-portal', { opacity: 0.85, blendMode: 'screen', params: { style: 1, autoSpawn: 1 } });
      setEffects({ enabled: true, feedback: 0.55, bloom: 0.2 });
      setStatus('Generator: Wormhole Core (Echo) added.');
    }
    if (id === 'gen-nebula-drift') {
      tweakLayer('layer-plasma', { opacity: 0.65, blendMode: 'screen', params: { speed: 0.7, scale: 1.9, complexity: 0.55 } });
      tweakLayer('layer-spectrum', { opacity: 0.35, blendMode: 'add' });
      setStatus('Generator: Nebula Drift added.');
    }
    if (id === 'variant-nebula-drift-cold') {
      tweakLayer('layer-plasma', { opacity: 0.7, blendMode: 'screen', params: { speed: 0.6, scale: 2.1, complexity: 0.5 } });
      tweakLayer('layer-spectrum', { opacity: 0.25, blendMode: 'add' });
      setStatus('Generator: Nebula Drift (Cold) added.');
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
