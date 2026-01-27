import type { Store } from '../../state/store';
import { sdfRegistry } from '../../sdf/registry';
import { SdfNodeInstance, DEFAULT_SDF_SCENE, SdfSceneConfig, createNodeInstance } from '../../sdf/api';
import { setStatus } from '../../state/events';
import { actions } from '../../state/actions';

export interface SdfPanelDeps {
  store: Store;
}

export const createSdfPanel = ({ store }: SdfPanelDeps) => {
  // We'll create the container dynamically if it doesn't exist, or expect it in DOM.
  // For now, let's assume we append it to the main view or it sits in the 'design' tab.
  // Given the existing structure, let's look for a 'sdf-editor' or create one in the design section.
  
  let container = document.getElementById('sdf-editor') as HTMLDivElement;
  if (!container) {
      // Fallback: Create it and append to generator panel for now
      const parent = document.getElementById('generator-panel');
      if (parent) {
          container = document.createElement('div');
          container.id = 'sdf-editor';
          container.className = 'panel hidden'; // Start hidden
          parent.appendChild(container);
      }
  }

  const render = () => {
    if (!container) return;

    const state = store.getState();
    const scene = state.project.scenes.find(s => s.id === state.project.activeSceneId);
    if (!scene) return;

    // Look for the specific SDF Scene generator layer
    const layer = scene.layers.find(l => l.id === 'gen-sdf-scene');

    if (!layer || !layer.enabled) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    container.innerHTML = ''; 

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<h3>SDF Scene Editor</h3>';
    container.appendChild(header);

    // Mode Toggle (2D/3D)
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
    container.appendChild(modeRow);

    // Node List
    const nodeList = document.createElement('div');
    nodeList.className = 'sdf-node-list';
    
    if (config.nodes.length === 0) {
        nodeList.innerHTML = '<div class="matrix-empty">No nodes. Add a shape to start.</div>';
    } else {
        config.nodes.forEach((node, index) => {
            const item = document.createElement('div');
            item.className = 'layer-row';
            item.style.paddingLeft = '10px';
            
            const def = sdfRegistry.get(node.nodeId);
            
            // Name
            const name = document.createElement('span');
            name.textContent = `${index + 1}. ${node.label || def?.name || node.nodeId}`;
            name.style.flex = '1';
            
            // Controls
            const controls = document.createElement('div');
            
            // Move Up
            const upBtn = document.createElement('button');
            upBtn.textContent = '↑';
            upBtn.disabled = index === 0;
            upBtn.onclick = () => moveNode(layer.id, index, -1);
            
            // Move Down
            const downBtn = document.createElement('button');
            downBtn.textContent = '↓';
            downBtn.disabled = index === config.nodes.length - 1;
            downBtn.onclick = () => moveNode(layer.id, index, 1);

            // Delete
            const delBtn = document.createElement('button');
            delBtn.textContent = 'x';
            delBtn.onclick = () => removeNode(layer.id, index);

            controls.appendChild(upBtn);
            controls.appendChild(downBtn);
            controls.appendChild(delBtn);
            
            item.appendChild(name);
            item.appendChild(controls);
            nodeList.appendChild(item);
            
            // Params (Simple rendering)
            if (def && def.parameters.length > 0) {
                const paramContainer = document.createElement('div');
                paramContainer.className = 'sdf-params';
                paramContainer.style.marginLeft = '20px';
                paramContainer.style.fontSize = '0.9em';
                paramContainer.style.opacity = '0.8';
                
                def.parameters.forEach(param => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';
                    const label = document.createElement('label');
                    label.textContent = param.name;
                    
                    const val = node.params[param.id] ?? param.default;
                    const valDisplay = document.createElement('span');
                    valDisplay.textContent = String(val); // Editable inputs omitted for brevity in MVP
                    
                    row.appendChild(label);
                    row.appendChild(valDisplay);
                    paramContainer.appendChild(row);
                });
                nodeList.appendChild(paramContainer);
            }
        });
    }
    container.appendChild(nodeList);

    // Add Node UI
    const addRow = document.createElement('div');
    addRow.className = 'layer-row';
    addRow.style.marginTop = '10px';
    addRow.style.borderTop = '1px solid rgba(255,255,255,0.1)';
    addRow.style.paddingTop = '10px';
    
    const catSelect = document.createElement('select');
    const categories = ['shapes2d', 'shapes3d', 'ops', 'domain'];
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    });
    
    const nodeSelect = document.createElement('select');
    const updateNodes = () => {
        nodeSelect.innerHTML = '';
        const nodes = sdfRegistry.getByCategory(catSelect.value as any);
        nodes.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n.id;
            opt.textContent = n.name;
            nodeSelect.appendChild(opt);
        });
    };
    catSelect.onchange = updateNodes;
    updateNodes();

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.onclick = () => addNode(layer.id, nodeSelect.value);

    addRow.appendChild(catSelect);
    addRow.appendChild(nodeSelect);
    addRow.appendChild(addBtn);
    container.appendChild(addRow);
  };

  const addNode = (layerId: string, nodeId: string) => {
      actions.mutateProject(store, (project) => {
          const scene = project.scenes.find(s => s.id === project.activeSceneId);
          const layer = scene?.layers.find(l => l.id === layerId);
          if (layer) {
              if (!layer.sdfScene) layer.sdfScene = JSON.parse(JSON.stringify(DEFAULT_SDF_SCENE));
              const def = sdfRegistry.get(nodeId);
              if (def) {
                  // Initialize params with defaults
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
