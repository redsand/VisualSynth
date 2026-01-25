export type LayerBlendMode = 'normal' | 'add' | 'multiply' | 'screen' | 'overlay' | 'difference';

export interface LayerConfig {
  id: string;
  name: string;
  enabled: boolean;
  opacity: number;
  blendMode: LayerBlendMode;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
}

export interface ModConnection {
  id: string;
  source: string;
  target: string;
  amount: number;
  curve: 'linear' | 'exp' | 'log';
  smoothing: number;
  bipolar: boolean;
  min: number;
  max: number;
}

export interface MidiMapping {
  id: string;
  message: 'note' | 'cc' | 'aftertouch' | 'pitchbend';
  channel: number;
  control: number;
  target: string;
  mode: 'toggle' | 'momentary' | 'trigger';
}

export interface SceneConfig {
  id: string;
  name: string;
  layers: LayerConfig[];
}

export interface VisualSynthProject {
  version: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  scenes: SceneConfig[];
  modMatrix: ModConnection[];
  midiMappings: MidiMapping[];
  activeSceneId: string;
}

export const DEFAULT_PROJECT: VisualSynthProject = {
  version: 1,
  name: 'Untitled VisualSynth Project',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  scenes: [
    {
      id: 'scene-1',
      name: 'Main Scene',
      layers: [
        {
          id: 'layer-plasma',
          name: 'Shader Plasma',
          enabled: true,
          opacity: 0.95,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-spectrum',
          name: 'Audio Spectrum',
          enabled: true,
          opacity: 0.9,
          blendMode: 'add',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        }
      ]
    }
  ],
  modMatrix: [],
  midiMappings: [],
  activeSceneId: 'scene-1'
};
