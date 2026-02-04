import { VISUAL_MODES, VisualMode } from '../../../shared/modes';
import type { Store } from '../../state/store';
import { setStatus } from '../../state/events';

export interface ModeDashboardDeps {
  store: Store;
  onApplyMode: (modeId: string) => void;
}

export interface ModeDashboardApi {
  render: () => void;
}

export const createModeDashboard = ({
  store,
  onApplyMode
}: ModeDashboardDeps): ModeDashboardApi => {
  const container = document.getElementById('mixer-role-weights-anchor') as HTMLDivElement;

  const render = () => {
    if (!container) return;
    container.innerHTML = '';

    const dashboard = document.createElement('div');
    dashboard.className = 'mode-dashboard';
    
    const title = document.createElement('h3');
    title.textContent = 'Active Mode Tuning';
    dashboard.appendChild(title);

    const activeModeId = store.getState().project.activeModeId || 'mode-cosmic';
    const mode = VISUAL_MODES.find(m => m.id === activeModeId);

    if (mode) {
        const info = document.createElement('div');
        info.className = 'mode-info-box';
        info.innerHTML = `
            <div class="mode-info-name">${mode.name}</div>
            <div class="mode-info-desc">${mode.description}</div>
        `;
        dashboard.appendChild(info);

        const controls = document.createElement('div');
        controls.className = 'mode-tuning-grid';

        // Intensity
        const envRow = document.createElement('div');
        envRow.className = 'scene-row';
        envRow.innerHTML = `
            <label class="scene-inline"><span>Env Attack</span><input type="range" min="0.01" max="1" step="0.01" value="${mode.intensityEnvelopes.attack}"></label>
            <label class="scene-inline"><span>Env Release</span><input type="range" min="0.01" max="2" step="0.01" value="${mode.intensityEnvelopes.release}"></label>
        `;
        envRow.querySelectorAll('input').forEach((input, i) => {
            input.addEventListener('input', () => {
                if (i === 0) mode.intensityEnvelopes.attack = Number(input.value);
                else mode.intensityEnvelopes.release = Number(input.value);
                onApplyMode(mode.id); // Hot reload
            });
        });

        // Glow/Depth
        const glowRow = document.createElement('div');
        glowRow.className = 'scene-row';
        glowRow.innerHTML = `
            <label class="scene-inline"><span>Glow</span><input type="range" min="0" max="1" step="0.05" value="${mode.glowDepth.glow}"></label>
            <label class="scene-inline"><span>Depth</span><input type="range" min="0" max="1" step="0.05" value="${mode.glowDepth.depth}"></label>
        `;
        glowRow.querySelectorAll('input').forEach((input, i) => {
            input.addEventListener('input', () => {
                if (i === 0) mode.glowDepth.glow = Number(input.value);
                else mode.glowDepth.depth = Number(input.value);
                onApplyMode(mode.id); // Hot reload
            });
        });

        dashboard.appendChild(envRow);
        dashboard.appendChild(glowRow);
    }

    container.appendChild(dashboard);
  };

  return { render };
};
