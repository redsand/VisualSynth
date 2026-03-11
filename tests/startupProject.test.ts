import { describe, expect, it, vi } from 'vitest';
import { selectStartupProject } from '../src/renderer/startupProject';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('selectStartupProject', () => {
  it('prefers a valid recovery project over showcase loading', async () => {
    const loadShowcaseProject = vi.fn().mockResolvedValue({ found: false });

    const result = await selectStartupProject(
      {
        getRecovery: async () => ({ found: true, payload: JSON.stringify(DEFAULT_PROJECT) }),
        loadShowcaseProject
      },
      {
        getItem: () => '1',
        setItem: vi.fn()
      }
    );

    expect(result.kind).toBe('recovery');
    expect(loadShowcaseProject).not.toHaveBeenCalled();
  });

  it('loads showcase on first launch when recovery is absent', async () => {
    const setItem = vi.fn();

    const result = await selectStartupProject(
      {
        getRecovery: async () => ({ found: false }),
        loadShowcaseProject: async () => ({ found: true, payload: JSON.stringify(DEFAULT_PROJECT) })
      },
      {
        getItem: () => null,
        setItem
      }
    );

    expect(result.kind).toBe('showcase');
    expect(setItem).toHaveBeenCalledWith('visualsynth.firstLaunchComplete', '1');
  });

  it('returns invalid recovery when recovery payload cannot be parsed', async () => {
    const result = await selectStartupProject(
      {
        getRecovery: async () => ({ found: true, payload: '{bad-json' }),
        loadShowcaseProject: async () => ({ found: false })
      },
      {
        getItem: () => '1',
        setItem: vi.fn()
      }
    );

    expect(result.kind).toBe('invalid-recovery');
    expect(result.status).toBe('Recovery session found but invalid.');
  });

  it('does nothing when not first launch and no recovery exists', async () => {
    const loadShowcaseProject = vi.fn().mockResolvedValue({ found: true, payload: JSON.stringify(DEFAULT_PROJECT) });

    const result = await selectStartupProject(
      {
        getRecovery: async () => ({ found: false }),
        loadShowcaseProject
      },
      {
        getItem: () => '1',
        setItem: vi.fn()
      }
    );

    expect(result.kind).toBe('none');
    expect(loadShowcaseProject).not.toHaveBeenCalled();
  });
});
