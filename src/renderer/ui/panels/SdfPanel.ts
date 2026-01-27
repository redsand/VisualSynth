import type { Store } from '../../state/store';
import { sdfRegistry } from '../../sdf/registry';
import { SdfNodeInstance, DEFAULT_SDF_SCENE, SdfSceneConfig, createNodeInstance, SdfParameter } from '../../sdf/api';
import { setStatus } from '../../state/events';
import { actions } from '../../state/actions';

export interface SdfPanelDeps {
  store: Store;
}

export const createSdfPanel = ({ store }: SdfPanelDeps) => {
  let container = document.getElementById('sdf-editor') as HTMLDivElement;
  if (!container) {
      const parent = document.getElementById('generator-panel');
      if (parent) {
          container = document.createElement('div');
          container.id = 'sdf-editor';
          container.className = 'panel hidden';
          parent.appendChild(container);
      }
  }

  const render = () => {
    if (!container) return;

    const state = store.getState();
    const scene = state.project.scenes.find(s => s.id === state.project.activeSceneId);
    if (!scene) return;

    const layer = scene.layers.find(l => l.id === 'gen-sdf-scene');
    if (!layer || !layer.enabled) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    container.innerHTML = ''; 

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<h3>SDF Scene Editor</h3>';
    container.appendChild(header);

    const modeRow = document.createElement('div');
    modeRow.className = 'layer-row';
    const config: SdfSceneConfig = layer.sdfScene || JSON.parse(JSON.stringify(DEFAULT_SDF_SCENE));
    
    const modeLabel = document.createElement('span');
    modeLabel.textContent = 'Mode: ';
    const modeSelect = document.createElement('select');
    ['2d', '3d'].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m.toUpperCase();
        modeSelect.appendChild(opt);
    });
    modeSelect.value = config.mode;
    modeSelect.onchange = () => {
        actions.mutateProject(store, (p) => {
             const l = p.scenes.find(s=>s.id === p.activeSceneId)?.layers.find(x=>x.id==='gen-sdf-scene');
             if(l && l.sdfScene) l.sdfScene.mode = modeSelect.value as '2d'|'3d';
        });
    };
    modeRow.appendChild(modeLabel);
    modeRow.appendChild(modeSelect);
    
    // Settings Toggle
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '⚙ Settings';
    settingsBtn.style.marginLeft = '10px';
    settingsBtn.onclick = () => {
        const settingsPanel = container.querySelector('.sdf-advanced-settings');
        if (settingsPanel) settingsPanel.classList.toggle('hidden');
    };
    modeRow.appendChild(settingsBtn);
    container.appendChild(modeRow);

    // Advanced Settings Panel (Hidden by default)
    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'sdf-advanced-settings hidden';
    settingsPanel.style.background = 'rgba(0,0,0,0.2)';
    settingsPanel.style.padding = '10px';
    settingsPanel.style.marginBottom = '10px';
    settingsPanel.style.border = '1px solid rgba(255,255,255,0.1)';
    
    if (config.mode === '3d') {
        const lightingHeader = document.createElement('h4');
        lightingHeader.textContent = 'Lighting & Env';
        settingsPanel.appendChild(lightingHeader);

        // Ambient Occlusion
        const aoRow = createToggleRow('Ambient Occlusion', config.render3d.aoEnabled, (val) => {
             actions.mutateProject(store, (p) => {
                const l = p.scenes.find(s=>s.id === p.activeSceneId)?.layers.find(x=>x.id==='gen-sdf-scene');
                if(l && l.sdfScene) l.sdfScene.render3d.aoEnabled = val;
             });
        });
        settingsPanel.appendChild(aoRow);

        // Shadows
        const shadowRow = createToggleRow('Soft Shadows', config.render3d.softShadowsEnabled, (val) => {
            actions.mutateProject(store, (p) => {
               const l = p.scenes.find(s=>s.id === p.activeSceneId)?.layers.find(x=>x.id==='gen-sdf-scene');
               if(l && l.sdfScene) l.sdfScene.render3d.softShadowsEnabled = val;
            });
       });
       settingsPanel.appendChild(shadowRow);

       // Fog
       const fogRow = createToggleRow('Fog', config.render3d.fogEnabled, (val) => {
            actions.mutateProject(store, (p) => {
                const l = p.scenes.find(s=>s.id === p.activeSceneId)?.layers.find(x=>x.id==='gen-sdf-scene');
                if(l && l.sdfScene) l.sdfScene.render3d.fogEnabled = val;
            });
        });
        settingsPanel.appendChild(fogRow);
    } else {
        const render2dHeader = document.createElement('h4');
        render2dHeader.textContent = '2D Render Settings';
        settingsPanel.appendChild(render2dHeader);

        const fillRow = createToggleRow('Fill Enabled', config.render2d.fillEnabled, (val) => {
            actions.mutateProject(store, (p) => {
                const l = p.scenes.find(s=>s.id === p.activeSceneId)?.layers.find(x=>x.id==='gen-sdf-scene');
                if(l && l.sdfScene) l.sdfScene.render2d.fillEnabled = val;
            });
        });
        settingsPanel.appendChild(fillRow);

        const glowRow = createToggleRow('Glow Enabled', config.render2d.glowEnabled, (val) => {
            actions.mutateProject(store, (p) => {
                const l = p.scenes.find(s=>s.id === p.activeSceneId)?.layers.find(x=>x.id==='gen-sdf-scene');
                if(l && l.sdfScene) l.sdfScene.render2d.glowEnabled = val;
            });
        });
        settingsPanel.appendChild(glowRow);
    }
    container.appendChild(settingsPanel);

    const nodeList = document.createElement('div');
    nodeList.className = 'sdf-node-list';
    
    if (config.nodes.length === 0) {
        nodeList.innerHTML = '<div class="matrix-empty">No nodes. Add a shape to start.</div>';
    } else {
        config.nodes.forEach((node, index) => {
            const item = document.createElement('div');
            item.className = 'layer-row';
            item.style.borderTop = '1px solid rgba(255,255,255,0.05)';
            item.style.paddingTop = '5px';
            
            const def = sdfRegistry.get(node.nodeId);
            
            const name = document.createElement('span');
            name.textContent = `${index + 1}. ${node.label || def?.name || node.nodeId}`;
            name.style.flex = '1';
            name.style.fontWeight = 'bold';
            
            const controls = document.createElement('div');
            const upBtn = document.createElement('button');
            upBtn.textContent = '↑';
            upBtn.disabled = index === 0;
            upBtn.onclick = () => moveNode(layer.id, index, -1);
            
            const downBtn = document.createElement('button');
            downBtn.textContent = '↓';
            downBtn.disabled = index === config.nodes.length - 1;
            downBtn.onclick = () => moveNode(layer.id, index, 1);

            const delBtn = document.createElement('button');
            delBtn.textContent = 'x';
            delBtn.onclick = () => removeNode(layer.id, index);

            controls.appendChild(upBtn);
            controls.appendChild(downBtn);
            controls.appendChild(delBtn);
            
            item.appendChild(name);
            item.appendChild(controls);
            nodeList.appendChild(item);
            
            if (def && def.parameters.length > 0) {
                const paramContainer = document.createElement('div');
                paramContainer.className = 'sdf-params';
                paramContainer.style.marginLeft = '15px';
                paramContainer.style.paddingBottom = '10px';
                
                def.parameters.forEach(param => {
                    const row = document.createElement('div');
                    row.className = 'layer-row';
                    row.style.minHeight = '24px';
                    const label = document.createElement('label');
                    label.textContent = param.name;
                    label.style.fontSize = '0.85em';
                    label.style.width = '100px';
                    
                    const val = node.params[param.id] ?? param.default;
                    const input = createParamInput(param, val, (newVal) => {
                        updateNodeParam(layer.id, index, param.id, newVal);
                    });
                    
                    row.appendChild(label);
                    row.appendChild(input);
                    paramContainer.appendChild(row);
                });
                nodeList.appendChild(paramContainer);
            }
        });
    }
    container.appendChild(nodeList);

    const addRow = document.createElement('div');
    addRow.className = 'layer-row';
    addRow.style.marginTop = '10px';
    addRow.style.borderTop = '1px solid rgba(255,255,255,0.2)';
    addRow.style.paddingTop = '10px';
    
    const catSelect = document.createElement('select');
    const categories = [
        { id: 'shapes2d', name: '2D Primitives' },
        { id: 'shapes2d-advanced', name: '2D Advanced' },
        { id: 'shapes3d', name: '3D Primitives' },
        { id: 'shapes3d-advanced', name: '3D Advanced' },
        { id: 'ops', name: 'Boolean Ops' },
        { id: 'ops-smooth', name: 'Smooth Ops' },
        { id: 'domain', name: 'Domain Transforms' },
        { id: 'domain-warp', name: 'Domain Warps' },
        { id: 'fields', name: 'Fields' }
    ];
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        catSelect.appendChild(opt);
    });
    
    const nodeSelect = document.createElement('select');
    nodeSelect.style.flex = '1';
    nodeSelect.style.margin = '0 5px';
    const updateNodesList = () => {
        nodeSelect.innerHTML = '';
        const nodes = sdfRegistry.getByCategory(catSelect.value as any);
        nodes.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n.id;
            opt.textContent = n.name;
            nodeSelect.appendChild(opt);
        });
    };
    catSelect.onchange = updateNodesList;
    updateNodesList();

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add Node';
    addBtn.onclick = () => addNode(layer.id, nodeSelect.value);

    addRow.appendChild(catSelect);
    addRow.appendChild(nodeSelect);
    addRow.appendChild(addBtn);
    container.appendChild(addRow);
  };

  const createToggleRow = (label: string, value: boolean, onChange: (v: boolean) => void) => {
      const row = document.createElement('div');
      row.className = 'layer-row';
      const lbl = document.createElement('span');
      lbl.textContent = label;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = value;
      cb.onchange = () => onChange(cb.checked);
      row.appendChild(lbl);
      row.appendChild(cb);
      return row;
  };

  const createParamInput = (param: SdfParameter, value: any, onChange: (v: any) => void) => {
      if (param.type === 'float' || param.type === 'angle') {
          const input = document.createElement('input');
          input.type = 'range';
          input.min = String(param.min ?? 0);
          input.max = String(param.max ?? 1);
          input.step = String(param.step ?? 0.01);
          input.value = String(value);
          input.style.flex = '1';
          input.oninput = () => onChange(Number(input.value));
          return input;
      }
      if (param.type === 'int') {
          const input = document.createElement('input');
          input.type = 'number';
          input.min = String(param.min ?? 0);
          input.max = String(param.max ?? 100);
          input.value = String(value);
          input.style.width = '60px';
          input.onchange = () => onChange(Math.round(Number(input.value)));
          return input;
      }
      if (param.type === 'bool') {
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = Boolean(value);
          input.onchange = () => onChange(input.checked);
          return input;
      }
      if (param.type === 'color') {
          const input = document.createElement('input');
          input.type = 'color';
          // Convert [r,g,b,a] to hex
          if (Array.isArray(value)) {
              const r = Math.round(value[0] * 255).toString(16).padStart(2, '0');
              const g = Math.round(value[1] * 255).toString(16).padStart(2, '0');
              const b = Math.round(value[2] * 255).toString(16).padStart(2, '0');
              input.value = `#${r}${g}${b}`;
          }
          input.onchange = () => {
              const r = parseInt(input.value.slice(1, 3), 16) / 255;
              const g = parseInt(input.value.slice(3, 5), 16) / 255;
              const b = parseInt(input.value.slice(5, 7), 16) / 255;
              onChange([r, g, b, 1.0]);
          };
          return input;
      }
      if (param.type === 'vec2' || param.type === 'vec3') {
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flex = '1';
          const count = param.type === 'vec2' ? 2 : 3;
          const vals = Array.isArray(value) ? value : new Array(count).fill(0);
          for (let i = 0; i < count; i++) {
              const sub = document.createElement('input');
              sub.type = 'number';
              sub.step = '0.1';
              sub.value = String(vals[i] ?? 0);
              sub.style.width = '50px';
              sub.style.marginRight = '2px';
              sub.onchange = () => {
                  vals[i] = Number(sub.value);
                  onChange([...vals]);
              };
              container.appendChild(sub);
          }
          return container;
      }
      
      const fallback = document.createElement('span');
      fallback.textContent = String(value);
      return fallback;
  };

  const updateNodeParam = (layerId: string, nodeIndex: number, paramId: string, value: any) => {
      actions.mutateProject(store, (project) => {
          const scene = project.scenes.find(s => s.id === project.activeSceneId);
          const layer = scene?.layers.find(l => l.id === layerId);
          if (layer && layer.sdfScene) {
              layer.sdfScene.nodes[nodeIndex].params[paramId] = value;
          }
      });
  };

  const addNode = (layerId: string, nodeId: string) => {
      actions.mutateProject(store, (project) => {
          const scene = project.scenes.find(s => s.id === project.activeSceneId);
          const layer = scene?.layers.find(l => l.id === layerId);
          if (layer) {
              if (!layer.sdfScene) layer.sdfScene = JSON.parse(JSON.stringify(DEFAULT_SDF_SCENE));
              const def = sdfRegistry.get(nodeId);
              if (def) {
                  const params: Record<string, any> = {};
                  def.parameters.forEach(p => params[p.id] = p.default);
                  const newNode = createNodeInstance(nodeId, params);
                  layer.sdfScene!.nodes.push(newNode);
                  setStatus(`Added ${def.name}`);
              }
          }
      });
      render();
  };

  const removeNode = (layerId: string, index: number) => {
      actions.mutateProject(store, (project) => {
          const scene = project.scenes.find(s => s.id === project.activeSceneId);
          const layer = scene?.layers.find(l => l.id === layerId);
          if (layer && layer.sdfScene) {
              layer.sdfScene.nodes.splice(index, 1);
          }
      });
      render();
  };

  const moveNode = (layerId: string, index: number, dir: number) => {
      actions.mutateProject(store, (project) => {
          const scene = project.scenes.find(s => s.id === project.activeSceneId);
          const layer = scene?.layers.find(l => l.id === layerId);
          if (layer && layer.sdfScene) {
              const item = layer.sdfScene.nodes.splice(index, 1)[0];
              layer.sdfScene.nodes.splice(index + dir, 0, item);
          }
      });
      render();
  };

  return { render };
};

