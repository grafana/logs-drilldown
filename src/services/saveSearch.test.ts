import { act, renderHook, waitFor } from '@testing-library/react';

import { OrgRole } from '@grafana/data';

import { narrowSavedSearches } from './narrowing';
import { SAVED_SEARCHES_KEY, SavedSearch, useSavedSearches } from './saveSearch';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    bootData: {
      user: {
        get isGrafanaAdmin() {
          return false;
        },
        get orgRole() {
          return OrgRole.None;
        },
        get uid() {
          return 'test';
        },
      },
    },
    buildInfo: {
      version: '12.4.0',
    },
    featureToggles: {
      queryLibrary: true,
    },
  },
}));

jest.mock('lib/api-clients/queries/v1beta1', () => ({
  useListQueryQuery: jest.fn(),
  useCreateQueryMutation: jest.fn(),
  useUpdateQueryMutation: jest.fn(),
  useDeleteQueryMutation: jest.fn(),
}));

describe('Hooks', () => {
  describe('useSavedSearches', () => {
    beforeEach(() => {
      // Mock local storage with some initial data
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

      await result.current.saveSearch(newSearch);

      const stored = narrowSavedSearches(JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) || '[]'));
      // Note: saveInLocalStorage filters by dsUid, so it only saves searches for the current datasource
      expect(stored).toHaveLength(3); // 2 existing + 1 new for ds-local-1
      expect(stored.some((s: SavedSearch) => s.title === 'New Local Search')).toBe(true);
      expect(stored.every((s: SavedSearch) => s.dsUid === 'ds-local-1')).toBe(true);
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
});
