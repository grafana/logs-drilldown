import { act, renderHook, waitFor } from '@testing-library/react';

import { OrgRole } from '@grafana/data';
import * as grafanaRuntime from '@grafana/runtime';

import { narrowSavedSearches } from './narrowing';
import {
  AnnoKeyCreatedBy,
  convertAddQueryTemplateCommandToDataQuerySpec,
  convertDataQueryResponseToSavedSearchDTO,
  SAVED_SEARCHES_KEY,
  SavedSearch,
  useCheckForExistingSearch,
  useHasSavedSearches,
  useLocalSavedSearches,
  useRemoteSavedSearches,
} from './saveSearch';
import {
  useCreateQueryMutation,
  useDeleteQueryMutation,
  useListQueryQuery,
  useUpdateQueryMutation,
} from 'lib/api-clients/queries/v1beta1';

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

describe('convertDataQueryResponseToSavedSearchDTO', () => {
  test('Should return an empty array when items are undefined', () => {
    const result = convertDataQueryResponseToSavedSearchDTO({});
    expect(result).toEqual([]);
  });

  test('Should filter out items with isVisible set to false', () => {
    const response = {
      items: [
        {
          spec: {
            isVisible: false,
            title: 'Hidden Search',
            description: 'Should be filtered',
            targets: [{ properties: { datasource: { uid: 'ds1', type: 'loki' }, expr: 'query1' }, variables: {} }],
          },
          metadata: { name: 'uid1', creationTimestamp: '2024-01-01T00:00:00Z' },
        },
        {
          spec: {
            isVisible: true,
            title: 'Visible Search',
            description: 'Should appear',
            targets: [{ properties: { datasource: { uid: 'ds2', type: 'loki' }, expr: 'query2' }, variables: {} }],
          },
          metadata: { name: 'uid2', creationTimestamp: '2024-01-02T00:00:00Z' },
        },
      ],
    };

    const result = convertDataQueryResponseToSavedSearchDTO(response);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Visible Search');
  });

  describe('Saved search DTOs', () => {
    const apiResponse = {
      items: [
        {
          spec: {
            title: 'Test Search',
            description: 'A test',
            isLocked: true,
            targets: [
              { properties: { datasource: { uid: 'loki-uid', type: 'loki' }, expr: '{job="test"}' }, variables: {} },
            ],
          },
          metadata: { name: 'search-uid', creationTimestamp: '2024-01-15T12:00:00Z' },
        },
      ],
    };

    const expectedResponse = [
      {
        dsUid: 'loki-uid',
        description: 'A test',
        isEditable: true,
        isLocked: true,
        query: '{job="test"}',
        title: 'Test Search',
        uid: 'search-uid',
        timestamp: new Date('2024-01-15T12:00:00Z').getTime(),
      },
    ];

    test('Should convert API response to SavedSearch DTOs', () => {
      const result = convertDataQueryResponseToSavedSearchDTO(apiResponse);
      expect(result).toEqual([
        {
          ...expectedResponse[0],
          isEditable: false,
        },
      ]);
    });

    test('Should convert let the UI know when a search is not editable', () => {
      const result = convertDataQueryResponseToSavedSearchDTO({
        items: [
          {
            ...apiResponse.items[0],
            metadata: {
              ...apiResponse.items[0].metadata,
              annotations: {
                [AnnoKeyCreatedBy]: 'User: not me',
              },
            },
          },
        ],
      });
      expect(result).toEqual([
        {
          ...expectedResponse[0],
          isEditable: false,
        },
      ]);
    });

    test('Should convert let the UI know when a search is editable', () => {
      jest.spyOn(grafanaRuntime.config.bootData.user, 'uid', 'get').mockReturnValueOnce('me');
      const result = convertDataQueryResponseToSavedSearchDTO({
        items: [
          {
            ...apiResponse.items[0],
            metadata: {
              ...apiResponse.items[0].metadata,
              annotations: {
                [AnnoKeyCreatedBy]: 'user:me',
              },
            },
          },
        ],
      });
      expect(result).toEqual([
        {
          ...expectedResponse[0],
          isEditable: true,
        },
      ]);
    });

    test('Should convert let the admins bypass permissions', () => {
      jest.spyOn(grafanaRuntime.config.bootData.user, 'isGrafanaAdmin', 'get').mockReturnValueOnce(true);
      expect(convertDataQueryResponseToSavedSearchDTO(apiResponse)).toEqual([
        {
          ...expectedResponse[0],
          isEditable: true,
        },
      ]);

      jest.spyOn(grafanaRuntime.config.bootData.user, 'orgRole', 'get').mockReturnValueOnce(OrgRole.Admin);
      expect(convertDataQueryResponseToSavedSearchDTO(apiResponse)).toEqual([
        {
          ...expectedResponse[0],
          isEditable: true,
        },
      ]);
    });
  });

  test('Should sort results by timestamp in descending order', () => {
    const response = {
      items: [
        {
          spec: {
            title: 'Old Search',
            targets: [{ properties: { datasource: { uid: 'ds1', type: 'loki' }, expr: 'query1' }, variables: {} }],
          },
          metadata: { name: 'uid1', creationTimestamp: '2026-01-01T00:00:00Z' },
        },
        {
          spec: {
            title: 'New Search',
            targets: [{ properties: { datasource: { uid: 'ds2', type: 'loki' }, expr: 'query2' }, variables: {} }],
          },
          metadata: { name: 'uid2', creationTimestamp: '2026-01-13T00:00:00Z' },
        },
      ],
    };

    const result = convertDataQueryResponseToSavedSearchDTO(response);
    expect(result[0].title).toBe('New Search');
    expect(result[1].title).toBe('Old Search');
  });
});

describe('convertAddQueryTemplateCommandToDataQuerySpec', () => {
  test('should convert SavedSearch DTO to API spec', () => {
    const input = {
      dsUid: 'loki-ds',
      title: 'My Search',
      query: '{job="api"}',
      description: 'API logs',
      isVisible: true,
    };

    const result = convertAddQueryTemplateCommandToDataQuerySpec(input);

    expect(result.metadata.generateName).toBeDefined();
    expect(result.spec.title).toBe('My Search');
    expect(result.spec.description).toBe('API logs');
    expect(result.spec.isVisible).toBe(true);
    expect(result.spec.isLocked).toBe(true);
    expect(result.spec.targets[0].properties.datasource.uid).toBe('loki-ds');
    expect(result.spec.targets[0].properties.datasource.type).toBe('loki');
    expect(result.spec.targets[0].properties.expr).toBe('{job="api"}');
  });

  test('should include empty vars and tags arrays', () => {
    const input = {
      dsUid: 'loki-ds',
      title: 'Test',
      query: '{}',
      description: '',
    };

    const result = convertAddQueryTemplateCommandToDataQuerySpec(input);

    expect(result.spec.vars).toEqual([]);
    expect(result.spec.tags).toEqual([]);
  });
});

describe('Hooks', () => {
  const mockListQueryQuery = jest.mocked(useListQueryQuery);
  const mockCreateQueryMutation = jest.mocked(useCreateQueryMutation);
  const mockUpdateQueryMutation = jest.mocked(useUpdateQueryMutation);
  const mockDeleteQueryMutation = jest.mocked(useDeleteQueryMutation);

  const mockApiResponse = {
    items: [
      {
        spec: {
          title: 'Search 1',
          description: 'First search',
          targets: [
            { properties: { datasource: { uid: 'ds-uid-1', type: 'loki' }, expr: '{job="app1"}' }, variables: {} },
          ],
        },
        metadata: { name: 'uid-1', creationTimestamp: '2026-01-10T00:00:00Z' },
      },
      {
        spec: {
          title: 'Search 2',
          description: 'Second search',
          targets: [
            { properties: { datasource: { uid: 'ds-uid-1', type: 'loki' }, expr: '{job="app2"}' }, variables: {} },
          ],
        },
        metadata: { name: 'uid-2', creationTimestamp: '2026-01-15T00:00:00Z' },
      },
      {
        spec: {
          title: 'Search 3',
          description: 'Third search',
          targets: [
            { properties: { datasource: { uid: 'ds-uid-2', type: 'loki' }, expr: '{job="app3"}' }, variables: {} },
          ],
        },
        metadata: { name: 'uid-3', creationTimestamp: '2026-01-12T00:00:00Z' },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default mocks for remote backend
    mockListQueryQuery.mockReturnValue({
      data: mockApiResponse,
      isLoading: false,
    } as any);

    mockCreateQueryMutation.mockReturnValue([jest.fn().mockResolvedValue({ unwrap: jest.fn() }), {} as any] as any);

    mockUpdateQueryMutation.mockReturnValue([jest.fn().mockResolvedValue({ unwrap: jest.fn() }), {} as any] as any);

    mockDeleteQueryMutation.mockReturnValue([jest.fn().mockResolvedValue({ unwrap: jest.fn() }), {} as any] as any);
  });

  describe('useCheckForExistingSearch', () => {
    test('Should return undefined when no matching search exists', () => {
      const { result } = renderHook(() => useCheckForExistingSearch('ds-uid-1', '{job="nonexistent"}'));
      expect(result.current).toBeUndefined();
    });

    test('Should return the search when a matching query exists', () => {
      const { result } = renderHook(() => useCheckForExistingSearch('ds-uid-1', '{job="app1"}'));
      expect(result.current).toBeDefined();
      expect(result.current?.title).toBe('Search 1');
      expect(result.current?.query).toBe('{job="app1"}');
    });

    test('Should only find searches for the specified datasource', () => {
      const { result } = renderHook(() => useCheckForExistingSearch('ds-uid-1', '{job="app3"}'));
      expect(result.current).toBeUndefined();
    });
  });

  describe('useHasSavedSearches', () => {
    test('Should return true when searches exist for datasource', () => {
      const { result } = renderHook(() => useHasSavedSearches('ds-uid-1'));
      expect(result.current).toBe(true);
    });

    test('Should return false when no searches exist for datasource', () => {
      const { result } = renderHook(() => useHasSavedSearches('ds-uid-nonexistent'));
      expect(result.current).toBe(false);
    });

    test('Should return false when API returns no data', () => {
      mockListQueryQuery.mockReturnValue({
        data: { items: [] },
        isLoading: false,
      } as any);

      const { result } = renderHook(() => useHasSavedSearches('ds-uid-1'));
      expect(result.current).toBe(false);
    });
  });

  describe('useRemoteSavedSearches', () => {
    test('Should filter searches by datasource', async () => {
      const { result } = renderHook(() => useRemoteSavedSearches('ds-uid-1'));

      await waitFor(() => {
        expect(result.current.searches).toHaveLength(2);
        expect(result.current.searches.every((s) => s.dsUid === 'ds-uid-1')).toBe(true);
      });
    });

    test('Should call saveSearch API when saving a new search', async () => {
      const mockAddQuery = jest.fn().mockReturnValue({ unwrap: jest.fn() });
      mockCreateQueryMutation.mockReturnValue([mockAddQuery, {} as any] as any);

      const { result } = renderHook(() => useRemoteSavedSearches('ds-uid-1'));

      const searchToSave = {
        dsUid: 'ds-uid-1',
        title: 'New Search',
        query: '{job="new"}',
        description: 'A new search',
      };

      await result.current.saveSearch(searchToSave);

      expect(mockAddQuery).toHaveBeenCalledWith({
        query: expect.objectContaining({
          spec: expect.objectContaining({
            title: 'New Search',
            description: 'A new search',
          }),
        }),
      });
    });

    test('Should call editSearch API when editing a search', async () => {
      const mockEditQuery = jest.fn().mockReturnValue({ unwrap: jest.fn() });
      mockUpdateQueryMutation.mockReturnValue([mockEditQuery, {} as any] as any);

      const { result } = renderHook(() => useRemoteSavedSearches('ds-uid-1'));

      await result.current.editSearch('uid-1', { title: 'Updated Title' });

      expect(mockEditQuery).toHaveBeenCalledWith({
        name: 'uid-1',
        patch: {
          spec: {
            title: 'Updated Title',
          },
        },
      });
    });

    test('Should call deleteSearch API when deleting a search', async () => {
      const mockDeleteQuery = jest.fn().mockReturnValue({ unwrap: jest.fn() });
      mockDeleteQueryMutation.mockReturnValue([mockDeleteQuery, {} as any] as any);

      const { result } = renderHook(() => useRemoteSavedSearches('ds-uid-1'));

      await result.current.deleteSearch('uid-1');

      expect(mockDeleteQuery).toHaveBeenCalledWith({ name: 'uid-1' });
    });

    test('Should indicate remote backend', () => {
      const { result } = renderHook(() => useRemoteSavedSearches('ds-uid-1'));
      expect(result.current.backend).toBe('remote');
    });
  });

  describe('useLocalSavedSearches', () => {
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
      const { result } = renderHook(() => useLocalSavedSearches('ds-local-1'));

      expect(result.current.searches).toHaveLength(2);
      expect(result.current.searches.every((s) => s.dsUid === 'ds-local-1')).toBe(true);
    });

    test('Should save search to localStorage', async () => {
      const { result } = renderHook(() => useLocalSavedSearches('ds-local-1'));

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
      const { result, rerender } = renderHook(() => useLocalSavedSearches('ds-local-1'));

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
      const { result } = renderHook(() => useLocalSavedSearches('ds-local-1'));

      expect(result.current.searches[0].title).toBe('Local Search 2'); // 2026-01-15
      expect(result.current.searches[1].title).toBe('Local Search 1'); // 2026-01-10
    });

    test('Should indicate local backend', () => {
      const { result } = renderHook(() => useLocalSavedSearches('ds-local-1'));
      expect(result.current.backend).toBe('local');
    });

    test('Should handle empty localStorage gracefully', () => {
      localStorage.clear();
      const { result } = renderHook(() => useLocalSavedSearches('ds-local-1'));

      expect(result.current.searches).toHaveLength(0);
    });
  });
});
