/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { createSlideshowPicker, SlideshowPickerOptions } from '../src/renderer/ui/slideshowPicker';
import type { PresetIndexEntry } from '../src/shared/presetIndex';

const makeEntry = (name: string, path: string): PresetIndexEntry => ({
  name,
  path,
  category: 'Test',
  primaryCategory: 'Test',
  subcategory: 'Test',
  visualFamilies: [],
  useCases: ['bridge'],
  energy: 'medium',
  density: 'balanced',
  motion: 'static',
  sourceDependency: 'none',
  riskFlags: [],
  sceneCount: 1,
  searchText: name.toLowerCase(),
  presetMode: 'live'
});

const makePicker = (overrides: Partial<SlideshowPickerOptions> = {}) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay hidden';
  const input = document.createElement('input');
  const results = document.createElement('div');
  const status = document.createElement('div');
  document.body.appendChild(overlay);
  overlay.appendChild(input);
  overlay.appendChild(results);
  overlay.appendChild(status);

  const entries = [
    makeEntry('Laser Storm', '/presets/laser.json'),
    makeEntry('Rain Fall', '/presets/rain.json')
  ];
  const rotation = new Set<string>();
  const onAdd = vi.fn().mockResolvedValue(undefined);
  const onAddAndQueue = vi.fn().mockResolvedValue(undefined);

  const picker = createSlideshowPicker({
    overlay,
    input,
    results,
    status,
    getEntries: () => entries,
    getFavorites: () => [],
    getRecents: () => [],
    isInRotation: (path) => rotation.has(path),
    onAdd: async (path) => {
      rotation.add(path);
      await onAdd(path);
    },
    onAddAndQueue: async (path) => {
      rotation.add(path);
      await onAddAndQueue(path);
    },
    ...overrides
  });

  return { picker, overlay, input, results, status, onAdd, onAddAndQueue, rotation };
};

const keydown = (input: HTMLInputElement, key: string, opts: KeyboardEventInit = {}) => {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
};

describe('Slideshow picker DOM', () => {
  it('opens, shows all entries, and closes with Escape', () => {
    const { picker, overlay, input } = makePicker();
    picker.open();
    expect(overlay.classList.contains('hidden')).toBe(false);
    expect(input.ownerDocument.activeElement).toBe(input);
    expect(overlay.querySelectorAll('.slideshow-picker-row').length).toBe(2);

    keydown(input, 'Escape');
    expect(overlay.classList.contains('hidden')).toBe(true);
    expect(picker.isOpen()).toBe(false);
  });

  it('filters rendered rows as the user types', () => {
    const { picker, input, results } = makePicker();
    picker.open();
    input.value = 'rain';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const rows = results.querySelectorAll('.slideshow-picker-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Rain Fall');
  });

  it('Enter triggers onAdd with the selected preset and stays open', async () => {
    const { picker, input, overlay, onAdd } = makePicker();
    picker.open();
    keydown(input, 'Enter');
    await Promise.resolve();
    expect(onAdd).toHaveBeenCalledWith('/presets/laser.json');
    expect(overlay.classList.contains('hidden')).toBe(false);
  });

  it('Shift+Enter triggers onAddAndQueue', async () => {
    const { picker, input, onAddAndQueue } = makePicker();
    picker.open();
    keydown(input, 'Enter', { shiftKey: true });
    await Promise.resolve();
    expect(onAddAndQueue).toHaveBeenCalledWith('/presets/laser.json');
  });

  it('ArrowDown moves the selection', () => {
    const { picker, input, results } = makePicker();
    picker.open();
    keydown(input, 'ArrowDown');
    const rows = results.querySelectorAll('.slideshow-picker-row');
    expect(rows[0].classList.contains('selected')).toBe(false);
    expect(rows[1].classList.contains('selected')).toBe(true);
  });

  it('badges entries already in the rotation', () => {
    const { picker, results, rotation } = makePicker();
    rotation.add('/presets/laser.json');
    picker.open();
    const rows = results.querySelectorAll('.slideshow-picker-row');
    expect(rows[0].querySelector('.slideshow-picker-badge')?.textContent).toBe('in rotation');
    expect(rows[1].querySelector('.slideshow-picker-badge')).toBeNull();
  });

  it('toggle opens and closes', () => {
    const { picker, overlay } = makePicker();
    picker.toggle();
    expect(picker.isOpen()).toBe(true);
    picker.toggle();
    expect(overlay.classList.contains('hidden')).toBe(true);
  });

  it('shows an empty state when nothing matches', () => {
    const { picker, input, results } = makePicker();
    picker.open();
    input.value = 'zzz-no-match';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(results.querySelector('.slideshow-picker-empty')).toBeTruthy();
  });
});