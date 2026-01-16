// eslint-disable-next-line sort/imports
import * as grafanaRuntime from '@grafana/runtime';

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

import {
  AnnoKeyCreatedBy,
  convertAddQueryTemplateCommandToDataQuerySpec,
  convertDataQueryResponseToSavedSearchDTO,
} from './saveSearch';
import { OrgRole } from '@grafana/data';

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

    test.only('Should convert let the UI know when a search is editable', () => {
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
