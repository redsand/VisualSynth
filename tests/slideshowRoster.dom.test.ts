/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { renderSlideshowRoster } from '../src/renderer/ui/slideshowRoster';
import { DEFAULT_PROJECT } from '../src/shared/project';

const makeProject = () => {
  const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
  const baseScene = project.scenes[0];
  project.scenes = [
    { ...baseScene, id: 'scene-1', name: 'Scene 1' },
    { ...baseScene, id: 'scene-2', name: 'Scene 2' }
  ];
  project.activeSceneId = 'scene-1';
  return project;
};

const render = () => {
  const host = document.createElement('div');
  const project = makeProject();
  const onQueue = vi.fn();
  const onRemove = vi.fn();
  renderSlideshowRoster({
    host,
    getProject: () => project,
    onQueue,
    onRemove
  });
  return { host, project, onQueue, onRemove };
};

describe('Slideshow roster DOM', () => {
  it('renders a count chip plus one chip per scene', () => {
    const { host } = render();
    const chips = host.querySelectorAll('.roster-chip');
    expect(chips.length).toBe(3); // count + 2 scenes
    expect(chips[0].textContent).toBe('Rotation: 2');
  });

  it('renders scene names on the chips', () => {
    const { host } = render();
    const chips = host.querySelectorAll('.roster-chip');
    expect(chips[1].textContent).toContain('Scene 1');
    expect(chips[2].textContent).toContain('Scene 2');
  });

  it('highlights the active scene', () => {
    const { host } = render();
    const chips = host.querySelectorAll('.roster-chip');
    expect(chips[1].classList.contains('active')).toBe(true);
    expect(chips[2].classList.contains('active')).toBe(false);
  });

  it('clicking a chip fires onQueue with the scene id', () => {
    const { host, onQueue } = render();
    const chips = host.querySelectorAll<HTMLButtonElement>('.roster-chip');
    chips[2].click();
    expect(onQueue).toHaveBeenCalledWith('scene-2', 'Scene 2');
  });

  it('clicking the ✕ fires onRemove and stops propagation', () => {
    const { host, onRemove, onQueue } = render();
    const chips = host.querySelectorAll<HTMLButtonElement>('.roster-chip');
    const remove = chips[2].querySelector<HTMLElement>('.roster-chip-remove');
    remove?.click();
    expect(onRemove).toHaveBeenCalledWith('scene-2');
    expect(onQueue).not.toHaveBeenCalled();
  });

  it('re-renders cleanly when scenes change', () => {
    const host = document.createElement('div');
    const project = makeProject();
    const renderOnce = () =>
      renderSlideshowRoster({
        host,
        getProject: () => project,
        onQueue: vi.fn(),
        onRemove: vi.fn()
      });
    renderOnce();
    project.scenes.pop();
    renderOnce();
    expect(host.querySelectorAll('.roster-chip').length).toBe(2); // count + 1 scene
    expect(host.querySelectorAll('.roster-chip')[0].textContent).toBe('Rotation: 1');
  });
});