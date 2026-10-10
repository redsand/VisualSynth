import type { PresetIndexEntry } from '../../shared/presetIndex';
import { filterPresetsForPicker } from '../../shared/slideshow';

export interface SlideshowPickerOptions {
  overlay: HTMLElement;
  input: HTMLInputElement;
  results: HTMLElement;
  status: HTMLElement;
  getEntries: () => PresetIndexEntry[];
  getFavorites: () => string[];
  getRecents: () => string[];
  /** True when a scene from this preset path is already in the rotation. */
  isInRotation: (presetPath: string) => boolean;
  onAdd: (presetPath: string) => Promise<void>;
  onAddAndQueue: (presetPath: string) => Promise<void>;
}

export interface SlideshowPicker {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
}

const MAX_ROWS = 20;

/**
 * Keyboard-driven quick-add overlay for the live slideshow (Ctrl+K).
 *
 * The picker stays open after each add so the performer can queue up several
 * scenes in one pass without leaving the palette. All handled keys call
 * preventDefault/stopPropagation so the global window shortcuts never see
 * them.
 */
export const createSlideshowPicker = ({
  overlay,
  input,
  results,
  status,
  getEntries,
  getFavorites,
  getRecents,
  isInRotation,
  onAdd,
  onAddAndQueue
}: SlideshowPickerOptions): SlideshowPicker => {
  let open = false;
  let visible: PresetIndexEntry[] = [];
  let selectedIndex = 0;

  const flashStatus = (message: string) => {
    status.textContent = message;
  };

  const renderRows = () => {
    results.innerHTML = '';
    visible.slice(0, MAX_ROWS).forEach((preset, index) => {
      const row = document.createElement('div');
      row.className = `slideshow-picker-row${index === selectedIndex ? ' selected' : ''}`;
      row.dataset.presetPath = preset.path;
      row.setAttribute('role', 'button');
      row.tabIndex = -1;

      const name = document.createElement('span');
      name.className = 'slideshow-picker-name';
      name.textContent = preset.name;

      const meta = document.createElement('span');
      meta.className = 'slideshow-picker-meta';
      meta.textContent = [preset.primaryCategory, preset.energy].filter(Boolean).join(' · ');

      if (isInRotation(preset.path)) {
        const badge = document.createElement('span');
        badge.className = 'slideshow-picker-badge';
        badge.textContent = 'in rotation';
        meta.appendChild(badge);
      }

      const queue = document.createElement('button');
      queue.type = 'button';
      queue.className = 'slideshow-picker-queue';
      queue.textContent = '+ Queue';
      queue.title = 'Add and queue on the next bar';
      queue.addEventListener('click', (event) => {
        event.stopPropagation();
        void onAddAndQueue(preset.path).then(() => renderRows());
      });

      row.appendChild(name);
      row.appendChild(meta);
      row.appendChild(queue);
      row.addEventListener('click', () => {
        void onAdd(preset.path).then(() => renderRows());
      });
      results.appendChild(row);
    });

    if (visible.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'slideshow-picker-empty';
      empty.textContent = 'No presets match.';
      results.appendChild(empty);
    }
  };

  const refresh = () => {
    visible = filterPresetsForPicker(getEntries(), input.value, {
      favorites: getFavorites(),
      recents: getRecents()
    });
    selectedIndex = 0;
    renderRows();
  };

  const addSelected = (queueNext: boolean) => {
    const preset = visible[selectedIndex];
    if (!preset) return;
    const action = queueNext ? onAddAndQueue : onAdd;
    void action(preset.path)
      .then(() => {
        renderRows();
        input.focus();
      })
      .catch(() => {
        flashStatus(`Failed to add: ${preset.name}`);
      });
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.ctrlKey && event.key.toLowerCase() === 'k') {
      // The global shortcut handler ignores INPUT targets, so the open
      // picker's search box would otherwise swallow Ctrl+K. Toggle here.
      event.preventDefault();
      event.stopPropagation();
      picker.close();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      picker.close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      selectedIndex = Math.min(selectedIndex + 1, Math.min(visible.length, MAX_ROWS) - 1);
      renderRows();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderRows();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      addSelected(event.shiftKey || event.ctrlKey);
    }
  };

  const picker: SlideshowPicker = {
    open: () => {
      if (open) return;
      open = true;
      input.value = '';
      overlay.classList.remove('hidden');
      refresh();
      input.focus();
    },
    close: () => {
      if (!open) return;
      open = false;
      overlay.classList.add('hidden');
    },
    toggle: () => {
      if (open) picker.close();
      else picker.open();
    },
    isOpen: () => open
  };

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', handleKeydown);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) picker.close();
  });

  return picker;
};