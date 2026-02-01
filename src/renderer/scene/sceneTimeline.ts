import { VisualSynthProject } from '../../shared/project';

export interface SceneTimelineOptions {
  project: VisualSynthProject;
  track: HTMLElement;
  status?: HTMLElement | null;
  onSelect: (sceneId: string, sceneName: string) => void;
  onRemove: (sceneId: string, sceneName: string) => void;
}

export const renderSceneTimelineItems = ({
  project,
  track,
  status,
  onSelect,
  onRemove
}: SceneTimelineOptions) => {
  track.innerHTML = '';
  if (project.scenes.length === 0) {
    if (status) status.textContent = 'No scenes';
    return;
  }
  const durations = project.scenes.map((scene) => Math.max(scene.duration ?? 0, 0));
  const hasDurations = durations.some((value) => value > 0);
  project.scenes.forEach((scene) => {
    const isActive = scene.id === project.activeSceneId;
    const item = document.createElement('div');
    item.className = `scene-timeline-item${isActive ? ' active' : ''}`;
    item.dataset.sceneId = scene.id;
    item.style.flexGrow = String(hasDurations ? Math.max(scene.duration ?? 0, 1) : 1);
    item.style.flexBasis = '0';
    item.setAttribute('role', 'button');
    item.tabIndex = 0;

    const name = document.createElement('div');
    name.className = 'scene-timeline-name';
    name.textContent = scene.name;

    const meta = document.createElement('div');
    meta.className = 'scene-timeline-meta';
    meta.textContent = scene.intent ?? 'ambient';

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
    item.appendChild(meta);
    item.appendChild(progress);
    item.appendChild(remove);
    item.addEventListener('click', () => onSelect(scene.id, scene.name));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(scene.id, scene.name);
      }
    });
    track.appendChild(item);
  });
};
