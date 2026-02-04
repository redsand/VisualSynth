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
      row.draggable = true;
      row.dataset.id = layer.id;

      // Icon & Role
      const icon = document.createElement('div');
      icon.className = `mixer-role-icon ${layer.role}`;
      icon.textContent = getRoleIcon(layer.role || 'support');
      icon.title = `Role: ${layer.role}`;

      // Name
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

      // Drag & Drop
      row.ondragstart = (e) => {
        e.dataTransfer?.setData('text/plain', String(index));
        row.classList.add('dragging');
      };
      row.ondragend = () => row.classList.remove('dragging');
      row.ondragover = (e) => e.preventDefault();
      row.ondrop = (e) => {
        const fromIndex = Number(e.dataTransfer?.getData('text/plain'));
        if (fromIndex === index) return;
        scene.layers = reorderLayers(scene, fromIndex, index);
        render();
        onLayerListChanged();
      };

      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(meterContainer);
      row.appendChild(controls);
      row.appendChild(fader);
      table.appendChild(row);
    });

    container.appendChild(table);

    // Envelope Section
    const envSection = document.createElement('div');
    envSection.className = 'mixer-envelope-panel';
    envSection.innerHTML = '<h3>Intensity Envelopes</h3>';
    
    const project = store.getState().project;
    if (project.envelopes && project.envelopes[0]) {
        const env = project.envelopes[0];
        const row = document.createElement('div');
        row.className = 'scene-row';
        
        const attackLabel = document.createElement('label');
        attackLabel.className = 'scene-inline';
        attackLabel.innerHTML = `<span>Attack</span><input type="number" step="0.05" value="${env.attack}">`;
        attackLabel.querySelector('input')?.addEventListener('change', (e) => {
            env.attack = Number((e.target as HTMLInputElement).value);
        });

        const releaseLabel = document.createElement('label');
        releaseLabel.className = 'scene-inline';
        releaseLabel.innerHTML = `<span>Release</span><input type="number" step="0.05" value="${env.release}">`;
        releaseLabel.querySelector('input')?.addEventListener('change', (e) => {
            env.release = Number((e.target as HTMLInputElement).value);
        });

        row.appendChild(attackLabel);
        row.appendChild(releaseLabel);
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
        meter.style.width = `${height}%`;
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
