import { act, renderHook, waitFor } from '@testing-library/react';

import { config } from '@grafana/runtime';

import { narrowSavedSearches } from './narrowing';
import {
  isQueryLibrarySupported,
  SAVED_SEARCHES_KEY,
  SavedSearch,
  useCheckForExistingSearch,
  useHasSavedSearches,
  useSavedSearches,
} from './saveSearch';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    buildInfo: {
      version: '12.4.0',
    },
    featureToggles: {
      queryLibrary: true,
    },
  },
}));
jest.unmock('semver/preload');

const localSearches = [
  {
    dsUid: 'ds-local-1',
    title: 'Local Search 1',
    query: '{job="local1"}',
    description: 'First local search',
    timestamp: new Date('2026-01-10T00:00:00Z').getTime(),
    uid: 'local-uid-1',
  },
  {
    dsUid: 'ds-local-1',
    title: 'Local Search 2',
    query: '{job="local2"}',
    description: 'Second local search',
    timestamp: new Date('2026-01-15T00:00:00Z').getTime(),
    uid: 'local-uid-2',
  },
  {
    dsUid: 'ds-local-2',
    title: 'Local Search 3',
    query: '{job="local3"}',
    description: 'Third local search',
    timestamp: new Date('2026-01-12T00:00:00Z').getTime(),
    uid: 'local-uid-3',
  },
];

beforeEach(() => {
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(localSearches));
});

describe('useSavedSearches', () => {
  beforeEach(() => {
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(localSearches));
  });

  test('Should load searches from localStorage', () => {
    const { result } = renderHook(() => useSavedSearches('ds-local-1'));

    expect(result.current.searches).toHaveLength(2);
    expect(result.current.searches.every((s) => s.dsUid === 'ds-local-1')).toBe(true);
  });

  test('Should save search to localStorage', async () => {
    const { result } = renderHook(() => useSavedSearches('ds-local-1'));

    const newSearch = {
      dsUid: 'ds-local-1',
      title: 'New Local Search',
      query: '{job="newlocal"}',
      description: 'A new local search',
    };

    await act(async () => {
      await result.current.saveSearch(newSearch);
    });

    const stored = narrowSavedSearches(JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) || '[]'));
    expect(stored).toHaveLength(4);
    expect(stored.some((s: SavedSearch) => s.title === 'New Local Search')).toBe(true);
  });

  test('Should delete search from localStorage', async () => {
    const { result, rerender } = renderHook(() => useSavedSearches('ds-local-1'));

    expect(result.current.searches).toHaveLength(2);

    await act(async () => {
      await result.current.deleteSearch('local-uid-1');
    });
    rerender();

    await waitFor(() => {
      expect(result.current.searches).toHaveLength(1);
      expect(result.current.searches[0].uid).toBe('local-uid-2');
    });
  });

  test('should sort searches by timestamp descending', () => {
    const { result } = renderHook(() => useSavedSearches('ds-local-1'));

    expect(result.current.searches[0].title).toBe('Local Search 2'); // 2026-01-15
    expect(result.current.searches[1].title).toBe('Local Search 1'); // 2026-01-10
  });

  test('Should handle empty localStorage gracefully', () => {
    localStorage.clear();
    const { result } = renderHook(() => useSavedSearches('ds-local-1'));

    expect(result.current.searches).toHaveLength(0);
  });
});

describe('useCheckForExistingSearch', () => {
  test('Checks for existing searches', () => {
    const { result } = renderHook(() => useCheckForExistingSearch('ds-local-1', localSearches[0].query));
    expect(result.current).toBeDefined();
  });

  test('Checks for non-existing searches', () => {
    const { result } = renderHook(() => useCheckForExistingSearch('ds-local-1', '{nope="nope"}'));
    expect(result.current).toBeUndefined();
  });
});

describe('useHasSavedSearches', () => {
  test('Checks for existing searches', () => {
    const { result } = renderHook(() => useHasSavedSearches('ds-local-1'));
    expect(result.current).toBe(true);
  });

  test('Checks for empty searches', () => {
    const { result } = renderHook(() => useHasSavedSearches('ds-local-nope'));
    expect(result.current).toBe(false);
  });
});

describe('isQueryLibrarySupported', () => {
  test('Returns true when supported', () => {
    expect(isQueryLibrarySupported()).toBe(true);
  });

  test('Returns false if the feature is not enabled', () => {
    config.featureToggles.queryLibrary = false;
    expect(isQueryLibrarySupported()).toBe(false);
  });

  test('Returns false if the Grafana version is not supported', () => {
    config.featureToggles.queryLibrary = true;
    config.buildInfo.version = '12.3.0';
    expect(isQueryLibrarySupported()).toBe(false);
  });
});
