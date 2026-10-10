import type { VisualSynthProject } from '../../shared/project';

export interface SlideshowRosterOptions {
  host: HTMLElement;
  getProject: () => VisualSynthProject;
  onQueue: (sceneId: string, sceneName: string) => void;
  onRemove: (sceneId: string) => void;
}

/**
 * Compact always-visible rotation strip for show modes (performance/live).
 *
 * One chip per project scene: click = queue on the next bar, ✕ = remove,
 * active scene highlighted. Rendered from the same `renderSceneStrip` call
 * sites so it stays in sync with every scene mutation.
 */
export const renderSlideshowRoster = ({
  host,
  getProject,
  onQueue,
  onRemove
}: SlideshowRosterOptions): void => {
  const project = getProject();
  host.innerHTML = '';

  const count = document.createElement('span');
  count.className = 'roster-chip roster-count';
  count.textContent = `Rotation: ${project.scenes.length}`;
  host.appendChild(count);

  project.scenes.forEach((scene) => {
    const isActive = scene.id === project.activeSceneId;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `roster-chip${isActive ? ' active' : ''}`;
    chip.dataset.sceneId = scene.id;
    chip.title = `${scene.name} — click to queue on the next bar`;
    chip.textContent = scene.name;

    const remove = document.createElement('span');
    remove.className = 'roster-chip-remove';
    remove.textContent = '✕';
    remove.title = 'Remove scene from rotation';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      onRemove(scene.id);
    });

    chip.appendChild(remove);
    chip.addEventListener('click', () => onQueue(scene.id, scene.name));
    host.appendChild(chip);
  });
};