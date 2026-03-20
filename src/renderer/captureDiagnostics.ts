import type { SceneConfig, VisualSynthProject } from '../shared/project';
import { collectSceneGeneratorIds } from '../shared/shaderUtils';

type GeneratorDiagnostic = {
  name: string;
  enabled: boolean;
  opacity: number;
  uniformsBound: boolean;
};

type MilkDropCompileReport = {
  warp: {
    requested: boolean;
    compiled: boolean;
    fallbackUsed: boolean;
  };
  comp: {
    requested: boolean;
    compiled: boolean;
    fallbackUsed: boolean;
  };
};

type MilkDropNativeRuntimeReport = {
  shapes: {
    requested: number;
    rendered: number;
    borders: number;
    texturedFallbacks: number;
    evaluatedShapes: number;
    evaluatedPoints: number;
  };
  waves: {
    requested: number;
    rendered: number;
    renderedPoints: number;
    evaluatedPoints: number;
  };
};

export type CaptureDiagnostics = {
  projectName: string;
  activeSceneId: string;
  activeSceneName: string | null;
  sceneCount: number;
  enabledLayerIds: string[];
  disabledLayerIds: string[];
  activeGeneratorIds: string[];
  safeModeReasons: string[];
  lastShaderError: string | null;
  generatorDiagnostics: GeneratorDiagnostic[];
  missingUniforms: string[];
  milkdropCompileReport: MilkDropCompileReport | null;
  milkdropNativeRuntimeReport: MilkDropNativeRuntimeReport | null;
  renderSnapshot: CaptureRenderSnapshot | null;
};

export type CaptureRenderSnapshot = {
  timeMs: number;
  rms: number;
  peak: number;
  strobe: number;
  legacyNeutral: boolean;
  activeEngineId: string | null;
  activeModeId: string | null;
  roleCoreWeight: number;
  roleSupportWeight: number;
  roleAtmosphereWeight: number;
  effectsEnabled: boolean;
  plasmaEnabled: boolean;
  spectrumEnabled: boolean;
  plasmaOpacity: number;
  spectrumOpacity: number;
  glyphBeat: number;
  topoOpacity: number;
  weatherOpacity: number;
  weatherMode: number;
  weatherIntensity: number;
  weatherSpeed: number;
  portalOpacity: number;
  portalStyle: number;
  portalShift: number;
  sdfEnabled: boolean;
  sdfShape: number;
  sdfScale: number;
  sdfEdge: number;
  sdfGlow: number;
  sdfRotation: number;
  sdfFill: number;
  transitionAmount: number;
  transitionType: number;
  chemistryMode: number;
  motionTemplate: number;
  contrast: number;
  saturation: number;
  paletteShift: number;
  bloom: number;
  blur: number;
  chroma: number;
  feedback: number;
  kaleidoscope: number;
  posterize: number;
  activePaletteId: string | null;
  activePalettePreview: number[][];
};

const getLayerId = (layer: { id?: string; type?: string }) => layer.id ?? layer.type ?? 'unknown-layer';

const sortStrings = (values: Iterable<string>) => Array.from(values).sort((a, b) => a.localeCompare(b));

const hexToRgb = (hex: string): number[] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

const getActiveScene = (project: VisualSynthProject): SceneConfig | null =>
  project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0] ?? null;

export const buildCaptureDiagnostics = (
  project: VisualSynthProject,
  safeModeReasons: string[],
  lastShaderError: string | null,
  generatorDiagnostics: GeneratorDiagnostic[],
  missingUniforms: string[],
  milkdropCompileReport: MilkDropCompileReport | null = null,
  milkdropNativeRuntimeReport: MilkDropNativeRuntimeReport | null = null,
  renderSnapshot: Omit<CaptureRenderSnapshot, 'activePaletteId' | 'activePalettePreview'> | null = null
): CaptureDiagnostics => {
  const activeScene = getActiveScene(project);
  const activePaletteId = activeScene?.look?.activePaletteId ?? project.activePaletteId ?? null;
  const activePalette =
    (activePaletteId ? project.palettes.find((palette) => palette.id === activePaletteId) : null) ??
    project.palettes[0] ??
    null;
  const enabledLayerIds = (activeScene?.layers ?? [])
    .filter((layer) => layer.enabled !== false)
    .map(getLayerId);
  const disabledLayerIds = (activeScene?.layers ?? [])
    .filter((layer) => layer.enabled === false)
    .map(getLayerId);

  return {
    projectName: project.name,
    activeSceneId: activeScene?.id ?? '',
    activeSceneName: activeScene?.name ?? null,
    sceneCount: project.scenes.length,
    enabledLayerIds: sortStrings(enabledLayerIds),
    disabledLayerIds: sortStrings(disabledLayerIds),
    activeGeneratorIds: sortStrings(activeScene ? collectSceneGeneratorIds(activeScene) : []),
    safeModeReasons: [...safeModeReasons],
    lastShaderError,
    generatorDiagnostics: [...generatorDiagnostics].sort((a, b) => a.name.localeCompare(b.name)),
    missingUniforms: sortStrings(missingUniforms),
    milkdropCompileReport,
    milkdropNativeRuntimeReport,
    renderSnapshot: renderSnapshot
      ? {
          ...renderSnapshot,
          activePaletteId,
          activePalettePreview: activePalette?.colors?.slice(0, 4).map(hexToRgb) ?? []
        }
      : null
  };
};
