/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { renderSceneTimelineItems } from '../src/renderer/scene/sceneTimeline';
import { DEFAULT_PROJECT } from '../src/shared/project';

const makeProject = () => {
  const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
  project.scenes = project.scenes.slice(0, 2).map((scene, index) => ({
    ...scene,
    id: `scene-${index + 1}`,
    scene_id: `scene-${index + 1}`,
    name: `Scene ${index + 1}`,
    duration: 0
  }));
  project.activeSceneId = 'scene-1';
  return project;
};

describe('Scene timeline DOM', () => {
  it('renders timeline items and delete buttons', () => {
    const track = document.createElement('div');
    const status = document.createElement('div');
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    renderSceneTimelineItems({
      project: makeProject(),
      track,
      status,
      onSelect,
      onRemove
    });
    const items = track.querySelectorAll('.scene-timeline-item');
    expect(items.length).toBe(2);
    const remove = track.querySelector('.scene-timeline-remove');
    expect(remove).toBeTruthy();
  });

  it('invokes callbacks for select/remove', () => {
    const track = document.createElement('div');
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    renderSceneTimelineItems({
      project: makeProject(),
      track,
      onSelect,
      onRemove
    });
    const item = track.querySelector<HTMLElement>('.scene-timeline-item');
    const remove = track.querySelector<HTMLButtonElement>('.scene-timeline-remove');
    item?.click();
    remove?.click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
