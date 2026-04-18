import { VisualSynthProject } from '../../shared/project';

export interface SceneTimelineOptions {
  project: VisualSynthProject;
  track: HTMLElement;
  status?: HTMLElement | null;
  onSelect: (sceneId: string, sceneName: string) => void;
  onActivate: (sceneId: string, sceneName: string) => void;
  onRemove: (sceneId: string, sceneName: string) => void;
  onRename: (sceneId: string, newName: string) => void;
  onIntentChange: (sceneId: string, newIntent: string) => void;
  onContextMenu?: (sceneId: string, sceneName: string, event: MouseEvent) => void;
  onImport?: () => void;
  onNewScene?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  previewedSceneId?: string | null;
}

const SCENE_INTENTS: string[] = ['calm', 'pulse', 'build', 'chaos', 'ambient'];

let dragSourceIndex: number | null = null;

export const renderSceneTimelineItems = ({
  project,
  track,
  status,
  onSelect,
  onActivate,
  onRemove,
  onRename,
  onIntentChange,
  onContextMenu,
  onImport,
  onNewScene,
  onReorder,
  previewedSceneId
}: SceneTimelineOptions) => {
  track.innerHTML = '';
  if (project.scenes.length === 0) {
    if (status) status.textContent = 'No scenes';
    return;
  }
  const durations = project.scenes.map((scene) => Math.max(scene.duration ?? 0, 0));
  const hasDurations = durations.some((value) => value > 0);
  project.scenes.forEach((scene, index) => {
    const isActive = scene.id === project.activeSceneId;
    const isPreviewed = scene.id === previewedSceneId;
    const item = document.createElement('div');
    const classes = ['scene-timeline-item'];
    if (isActive) classes.push('active');
    if (isPreviewed && !isActive) classes.push('previewed');
    item.className = classes.join(' ');
    item.dataset.sceneId = scene.id;
    item.dataset.sceneIndex = String(index);
    item.style.flexGrow = String(hasDurations ? Math.max(scene.duration ?? 0, 1) : 1);
    item.style.flexBasis = '0';
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.draggable = true;

    const name = document.createElement('div');
    name.className = 'scene-timeline-name';
    name.textContent = scene.name;
    name.title = 'Double-click to rename';

    // Inline rename input (hidden by default)
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'scene-timeline-name-input';
    nameInput.value = scene.name;
    nameInput.style.display = 'none';

    const finishRename = () => {
      if (nameInput.style.display === 'none') return;
      const newName = nameInput.value.trim();
      if (newName && newName !== scene.name) {
        onRename(scene.id, newName);
      }
      nameInput.style.display = 'none';
      name.style.display = '';
      name.textContent = scene.name;
    };

    nameInput.addEventListener('blur', finishRename);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finishRename(); }
      if (e.key === 'Escape') { nameInput.value = scene.name; finishRename(); }
      e.stopPropagation();
    });
    nameInput.addEventListener('click', (e) => e.stopPropagation());
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      name.style.display = 'none';
      nameInput.style.display = '';
      nameInput.value = scene.name;
      nameInput.focus();
      nameInput.select();
    });

    const meta = document.createElement('div');
    meta.className = 'scene-timeline-meta';
    meta.textContent = scene.intent ?? 'ambient';
    meta.title = 'Click to cycle intent';
    meta.style.cursor = 'pointer';

    meta.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentIntent = scene.intent ?? 'ambient';
      const idx = SCENE_INTENTS.indexOf(currentIntent);
      const nextIntent = SCENE_INTENTS[(idx + 1) % SCENE_INTENTS.length];
      onIntentChange(scene.id, nextIntent);
    });

    const progress = document.createElement('div');
    progress.className = 'scene-timeline-progress';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'scene-timeline-remove';
    remove.setAttribute('aria-label', `Remove scene ${scene.name}`);
    remove.innerHTML =
      '<img alt="" src="data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath d=%27M2 2l8 8M10 2L2 10%27 stroke=%27%23ff5a5a%27 stroke-width=%271.6%27 stroke-linecap=%27round%27/%3E%3C/svg%3E" />';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      onRemove(scene.id, scene.name);
    });

    item.appendChild(name);
    item.appendChild(nameInput);
    item.appendChild(meta);
    item.appendChild(progress);
    item.appendChild(remove);
    item.addEventListener('click', () => onSelect(scene.id, scene.name));
    item.addEventListener('dblclick', () => onActivate(scene.id, scene.name));
    item.addEventListener('contextmenu', (event) => {
      if (!onContextMenu) return;
      event.preventDefault();
      onContextMenu(scene.id, scene.name, event);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(scene.id, scene.name);
      }
    });

    // Drag-and-drop handlers
    item.addEventListener('dragstart', (e) => {
      dragSourceIndex = index;
      item.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', String(index));
      e.dataTransfer!.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dragSourceIndex = null;
      // Clear all drag-over classes
      Array.from(track.querySelectorAll('.scene-timeline-item')).forEach((el) => {
        el.classList.remove('drag-over');
      });
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
    });
    item.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (dragSourceIndex !== null && dragSourceIndex !== index) {
        item.classList.add('drag-over');
      }
    });
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const fromIndex = dragSourceIndex;
      if (fromIndex === null || fromIndex === index) return;
      if (onReorder) {
        onReorder(fromIndex, index);
      }
    });

    track.appendChild(item);
  });

  if (onImport) {
    const item = document.createElement('div');
    item.className = 'scene-timeline-item scene-timeline-item-import';
    item.style.flexGrow = '0';
    item.style.flexBasis = '104px';
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.setAttribute('aria-label', 'Open scene from disk');

    const icon = document.createElement('div');
    icon.className = 'scene-timeline-import-icon';
    icon.innerHTML = '<img alt="" src="data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2720%27 height=%2720%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2362e7ff%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z%27/%3E%3C/svg%3E" />';

    const label = document.createElement('div');
    label.className = 'scene-timeline-name';
    label.textContent = 'Open Scene';

    const meta = document.createElement('div');
    meta.className = 'scene-timeline-meta';
    meta.textContent = 'From disk';

    item.appendChild(icon);
    item.appendChild(label);
    item.appendChild(meta);
    item.addEventListener('click', () => onImport());
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onImport();
      }
    });
    track.appendChild(item);
  }

  if (onNewScene) {
    const item = document.createElement('div');
    item.className = 'scene-timeline-item scene-timeline-item-import';
    item.style.flexGrow = '0';
    item.style.flexBasis = '104px';
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.setAttribute('aria-label', 'Create new empty scene');

    const icon = document.createElement('div');
    icon.className = 'scene-timeline-import-icon';
    icon.innerHTML = '<img alt="" src="data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2720%27 height=%2720%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2362e7ff%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z%27/%3E%3Cpolyline points=%2714 2 14 8 20 8%27/%3E%3Cline x1=%2712%27 y1=%2718%27 x2=%2712%27 y2=%2712%27/%3E%3Cline x1=%279%27 y1=%2715%27 x2=%2715%27 y2=%2715%27/%3E%3C/svg%3E" />';

    const label = document.createElement('div');
    label.className = 'scene-timeline-name';
    label.textContent = 'New Scene';

    const meta = document.createElement('div');
    meta.className = 'scene-timeline-meta';
    meta.textContent = 'Empty scene';

    item.appendChild(icon);
    item.appendChild(label);
    item.appendChild(meta);
    item.addEventListener('click', () => onNewScene());
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onNewScene();
      }
    });
    track.appendChild(item);
  }
};
