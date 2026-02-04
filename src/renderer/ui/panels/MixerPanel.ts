import { reorderLayers } from '../../../shared/layers';
import type { LayerConfig } from '../../../shared/project';
import type { Store } from '../../state/store';
import { actions } from '../../state/actions';
import { setStatus } from '../../state/events';

export interface MixerPanelDeps {
  store: Store;
  onLayerListChanged: () => void;
}

export interface MixerPanelApi {
  render: () => void;
  updateMeters: (rms: number, peak: number, bands: number[]) => void;
}

export const createMixerPanel = ({
  store,
  onLayerListChanged
}: MixerPanelDeps): MixerPanelApi => {
  const container = document.getElementById('mixer-panel-anchor') as HTMLDivElement;
  let soloedLayerId: string | null = null;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'core': return '⚛';
      case 'support': return '⬡';
      case 'atmosphere': return '☁';
      default: return '●';
    }
  };

  const render = () => {
    if (!container) return;
    container.innerHTML = '';

    const scene = store.getState().project.scenes.find(s => s.id === store.getState().project.activeSceneId);
    if (!scene) return;

    const table = document.createElement('div');
    table.className = 'mixer-table';

    scene.layers.forEach((layer, index) => {
      const row = document.createElement('div');
      row.className = 'mixer-row-layer';
      row.dataset.id = layer.id;

      // Icon & Role
      const icon = document.createElement('div');
      icon.className = `mixer-role-icon ${layer.role}`;
      icon.textContent = getRoleIcon(layer.role || 'support');
      icon.title = `Role: ${layer.role}`;
      icon.draggable = true;

      // Name + Opacity (stacked)
      const nameStack = document.createElement('div');
      nameStack.className = 'mixer-layer-stack';
      const name = document.createElement('div');
      name.className = 'mixer-layer-name';
      name.textContent = layer.name;

      // Meters (Visualizer)
      const meterContainer = document.createElement('div');
      meterContainer.className = 'mixer-meter-container';
      const meterFill = document.createElement('div');
      meterFill.className = 'mixer-meter-fill';
      meterFill.id = `meter-${layer.id}`;
      meterContainer.appendChild(meterFill);

      // Controls (Mute/Solo)
      const controls = document.createElement('div');
      controls.className = 'mixer-row-controls';

      const muteBtn = document.createElement('button');
      muteBtn.className = `mixer-btn-mute ${!layer.enabled ? 'active' : ''}`;
      muteBtn.textContent = 'M';
      muteBtn.title = 'Mute';
      muteBtn.onclick = () => {
        layer.enabled = !layer.enabled;
        render();
        onLayerListChanged();
      };

      const soloBtn = document.createElement('button');
      soloBtn.className = `mixer-btn-solo ${soloedLayerId === layer.id ? 'active' : ''}`;
      soloBtn.textContent = 'S';
      soloBtn.title = 'Solo';
      soloBtn.onclick = () => {
        if (soloedLayerId === layer.id) {
          // Unsolo all
          scene.layers.forEach(l => l.enabled = true);
          soloedLayerId = null;
        } else {
          // Solo this one
          scene.layers.forEach(l => l.enabled = (l.id === layer.id));
          soloedLayerId = layer.id;
        }
        render();
        onLayerListChanged();
      };

      controls.appendChild(muteBtn);
      controls.appendChild(soloBtn);

      // Opacity Slider
      const fader = document.createElement('input');
      fader.type = 'range';
      fader.className = 'mixer-fader';
      fader.min = '0';
      fader.max = '1';
      fader.step = '0.01';
      fader.value = String(layer.opacity);
      fader.oninput = () => {
        layer.opacity = Number(fader.value);
      };
      nameStack.appendChild(name);
      nameStack.appendChild(fader);

      // Drag & Drop
      icon.ondragstart = (e) => {
        e.dataTransfer?.setData('text/plain', String(index));
        row.classList.add('dragging');
      };
      icon.ondragend = () => row.classList.remove('dragging');
      row.ondragover = (e) => e.preventDefault();
      row.ondrop = (e) => {
        const fromIndex = Number(e.dataTransfer?.getData('text/plain'));
        if (fromIndex === index) return;
        scene.layers = reorderLayers(scene, fromIndex, index);
        render();
        onLayerListChanged();
      };

      row.appendChild(icon);
      row.appendChild(nameStack);
      row.appendChild(meterContainer);
      row.appendChild(controls);
      table.appendChild(row);
    });

    container.appendChild(table);

    const createDial = (
      labelText: string,
      value: number,
      min: number,
      max: number,
      step: number,
      onChange: (nextValue: number) => void
    ) => {
      const dial = document.createElement('div');
      dial.className = 'dial-control';

      const label = document.createElement('div');
      label.className = 'dial-label';
      label.textContent = labelText;

      const visual = document.createElement('div');
      visual.className = 'dial-visual';

      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'dial-input';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(value);

      const valueLabel = document.createElement('div');
      valueLabel.className = 'dial-value';

      const syncDial = (nextValue: number) => {
        const clamped = Math.max(min, Math.min(max, nextValue));
        const ratio = (clamped - min) / (max - min);
        visual.style.setProperty('--dial', `${Math.round(ratio * 100)}%`);
        visual.style.setProperty('--dial-rotation', `${-135 + ratio * 270}deg`);
        valueLabel.textContent = clamped.toFixed(2);
      };

      input.addEventListener('input', () => {
        const nextValue = Number(input.value);
        syncDial(nextValue);
        onChange(nextValue);
      });

      syncDial(value);

      dial.appendChild(label);
      dial.appendChild(visual);
      dial.appendChild(input);
      dial.appendChild(valueLabel);
      return dial;
    };

    // Envelope Section
    const envSection = document.createElement('div');
    envSection.className = 'mixer-envelope-panel';
    envSection.innerHTML = '<h3>Intensity Envelopes</h3>';
    
    const project = store.getState().project;
    if (project.envelopes && project.envelopes[0]) {
        const env = project.envelopes[0];
        const row = document.createElement('div');
        row.className = 'mixer-env-dials';

        row.appendChild(
          createDial('Attack', env.attack, 0, 1, 0.01, (value) => {
            env.attack = value;
          })
        );
        row.appendChild(
          createDial('Release', env.release, 0, 1, 0.01, (value) => {
            env.release = value;
          })
        );

        envSection.appendChild(row);
    }
    
    container.appendChild(envSection);
  };

  const updateMeters = (rms: number, peak: number, bands: number[]) => {
    const scene = store.getState().project.scenes.find(s => s.id === store.getState().project.activeSceneId);
    if (!scene) return;

    scene.layers.forEach((layer, index) => {
      const meter = document.getElementById(`meter-${layer.id}`);
      if (meter) {
        // Calculate a simulated level based on role and global RMS
        // In a real system we might have per-layer FFT analysis if they were separate sources
        // For now, we scale global RMS by role weight or band
        let level = rms;
        if (layer.role === 'core') level = rms * 1.2;
        if (layer.role === 'support') level = bands[Math.min(index % 8, 7)] || rms;
        if (layer.role === 'atmosphere') level = rms * 0.6;
        
        const height = Math.min(100, level * 150);
        meter.style.height = `${height}%`;
        // Color based on level
        if (height > 85) meter.style.background = '#ff4b4b';
        else if (height > 60) meter.style.background = '#ffd166';
        else meter.style.background = '#1ec8ff';
      }
    });
  };

  return {
    render,
    updateMeters
  };
};
