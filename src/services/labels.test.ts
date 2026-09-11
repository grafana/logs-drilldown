import { VAR_FIELD_NAME } from '@grafana/data';
import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';

import SpyInstance = jest.SpyInstance;
import { getParserForField } from './fields';
import { FilterOp } from './filterTypes';
import { getVisibleFilters, toggleFieldFromFilter } from './labels';
import { getFieldsAndMetadataVariable } from './variableGetters';
import { VAR_FIELDS, VAR_LABELS, VAR_METADATA } from './variables';
import { addToFilters } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';

jest.mock('./fields', () => ({
  getParserForField: jest.fn(),
  getParserFromFieldsFilters: jest.fn(),
}));
jest.mock('./variableGetters', () => {
  const actual = jest.requireActual('./variableGetters');
  return {
    ...actual,
    getFieldsAndMetadataVariable: jest.fn(),
  };
});
jest.mock('Components/ServiceScene/Breakdowns/AddToFiltersButton', () => ({
  addToFilters: jest.fn(),
}));

const getParserForFieldMock = jest.mocked(getParserForField);
const getFieldsAndMetadataVariableMock = jest.mocked(getFieldsAndMetadataVariable);
const addToFiltersMock = jest.mocked(addToFilters);

describe('getVisibleFilters', () => {
  let logSpy: SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(global.console, 'error');
  });
  afterEach(() => {
    // If a field does not properly encode the value we will throw a console error, but it will still return a "proper" value.
    // We want the test to fail in this case
    expect(logSpy).toHaveBeenCalledTimes(0);
  });
  describe('labels', () => {
    it('Returns an empty array when everything is empty', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [],
        name: VAR_LABELS,
      });
      expect(getVisibleFilters('', [], labelsVariable)).toEqual([]);
    });
    it('Returns all levels when there are no filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [],
        name: VAR_LABELS,
      });
      expect(getVisibleFilters('', ['error', 'info'], labelsVariable)).toEqual(['error', 'info']);
    });
    it('Removes negatively filtered levels', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
        ],
        name: VAR_LABELS,
      });
      expect(getVisibleFilters('detected_level', ['error', 'info'], labelsVariable)).toEqual(['info']);
    });
    it('Returns the positive levels from the filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'warn',
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: 'info',
          },
        ],
        name: VAR_LABELS,
      });
      expect(getVisibleFilters('detected_level', ['info'], labelsVariable)).toEqual(['info']);
    });
    it('Filters the levels by the current filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'warn',
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: 'info',
          },
        ],
        name: VAR_LABELS,
      });

      expect(getVisibleFilters('detected_level', ['error', 'warn', 'info', 'debug'], labelsVariable)).toEqual(['info']);
    });
    it('Handles empty positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: '""',
          },
        ],
        name: VAR_LABELS,
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual([]);
    });
    it('Handles negative positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: '""',
          },
        ],
        name: VAR_LABELS,
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual(['error', 'logs']);
    });
    it('Handles exclusion regex negative log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.RegexNotEqual,
            value: '""',
          },
        ],
        name: VAR_LABELS,
      });
      expect(getVisibleFilters('detected_level', ['error'], labelsVariable)).toEqual(['error']);
    });
  });
  describe('fields', () => {
    it('Returns an empty array when everything is empty', () => {
      const fieldsVariable = new AdHocFiltersVariable({
        filters: [],
        name: VAR_FIELDS,
      });
      expect(getVisibleFilters('', [], fieldsVariable)).toEqual([]);
    });
    it('Returns all levels when there are no filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [],
        name: VAR_FIELDS,
      });
      expect(getVisibleFilters('', ['error', 'info'], labelsVariable)).toEqual(['error', 'info']);
    });
    it('Removes negatively filtered levels', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              parser: 'logfmt',
              value: 'error',
            }),
          },
        ],
        name: VAR_FIELDS,
      });
      expect(getVisibleFilters('detected_level', ['error', 'info'], labelsVariable)).toEqual(['info']);
    });
    it('Returns the positive levels from the filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              parser: 'logfmt',
              value: 'error',
            }),
            valueLabels: ['error'],
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              parser: 'logfmt',
              value: 'warn',
            }),
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: JSON.stringify({
              parser: 'logfmt',
              value: 'info',
            }),
          },
        ],
        name: VAR_FIELDS,
      });
      expect(getVisibleFilters('detected_level', ['info'], labelsVariable)).toEqual(['info']);
    });
    it('Filters the levels by the current filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              parser: 'logfmt',
              value: 'error',
            }),
            valueLabels: ['error'],
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              parser: 'logfmt',
              value: 'warn',
            }),
            valueLabels: ['error'],
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: JSON.stringify({
              parser: 'logfmt',
              value: 'info',
            }),
            valueLabels: ['info'],
          },
        ],
        name: VAR_FIELDS,
      });

      expect(getVisibleFilters('detected_level', ['error', 'warn', 'info', 'debug'], labelsVariable)).toEqual(['info']);
    });
    it('Handles empty positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: JSON.stringify({
              parser: 'logfmt',
              value: '""',
            }),
            valueLabels: ['""'],
          },
        ],
        name: VAR_FIELDS,
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual([]);
    });
    it('Handles negative positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              parser: 'logfmt',
              value: '""',
            }),
            valueLabels: ['""'],
          },
        ],
        name: VAR_FIELD_NAME,
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual(['error', 'logs']);
    });
    it('Handles exclusion regex negative log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.RegexNotEqual,
            value: JSON.stringify({
              parser: 'logfmt',
              value: '""',
            }),
            valueLabels: ['""'],
          },
        ],
        name: VAR_FIELDS,
      });
      expect(getVisibleFilters('detected_level', ['error'], labelsVariable)).toEqual(['error']);
    });
  });
  describe('metadata', () => {
    it('Returns an empty array when everything is empty', () => {
      const fieldsVariable = new AdHocFiltersVariable({
        filters: [],
        name: VAR_METADATA,
      });
      expect(getVisibleFilters('', [], fieldsVariable)).toEqual([]);
    });
    it('Returns all levels when there are no filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [],
        name: VAR_METADATA,
      });
      expect(getVisibleFilters('', ['error', 'info'], labelsVariable)).toEqual(['error', 'info']);
    });
    it('Removes negatively filtered levels', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
        ],
        name: VAR_METADATA,
      });
      expect(getVisibleFilters('detected_level', ['error', 'info'], labelsVariable)).toEqual(['info']);
    });
    it('Returns the positive levels from the filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'warn',
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: 'info',
          },
        ],
        name: VAR_METADATA,
      });
      expect(getVisibleFilters('detected_level', ['info'], labelsVariable)).toEqual(['info']);
    });
    it('Filters the levels by the current filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'warn',
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: 'info',
          },
        ],
        name: VAR_METADATA,
      });

      expect(getVisibleFilters('detected_level', ['error', 'warn', 'info', 'debug'], labelsVariable)).toEqual(['info']);
    });
    it('Handles empty positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: '""',
          },
        ],
        name: VAR_METADATA,
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual([]);
    });
    it('Handles negative positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: '""',
          },
        ],
        name: VAR_METADATA,
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual(['error', 'logs']);
    });
    it('Handles exclusion regex negative log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.RegexNotEqual,
            value: '""',
          },
        ],
        name: VAR_METADATA,
      });
      expect(getVisibleFilters('detected_level', ['error'], labelsVariable)).toEqual(['error']);
    });
  });
});

describe('toggleFieldFromFilter', () => {
  const scene = {} as SceneObject;

  function setup(options: {
    filters?: AdHocFiltersVariable['state']['filters'];
    parser?: 'logfmt' | 'structuredMetadata';
  }) {
    getParserForFieldMock.mockReturnValue(options.parser ?? 'logfmt');
    getFieldsAndMetadataVariableMock.mockReturnValue({
      state: { filters: options.filters ?? [] },
    } as AdHocFiltersVariable);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes a parsed field when there are no filters', () => {
    setup({ filters: [] });

    expect(toggleFieldFromFilter('pod', 'api-1', scene)).toBe('include');
    expect(addToFiltersMock).toHaveBeenCalledWith('pod', 'api-1', 'include', scene, VAR_FIELDS);
  });

  it('includes structured metadata on the metadata variable', () => {
    setup({ filters: [], parser: 'structuredMetadata' });

    expect(toggleFieldFromFilter('cluster', 'eu', scene)).toBe('include');
    expect(addToFiltersMock).toHaveBeenCalledWith('cluster', 'eu', 'include', scene, VAR_METADATA);
  });

  it('toggles an existing inclusive parsed-field filter', () => {
    setup({
      filters: [
        {
          key: 'pod',
          operator: FilterOp.Equal,
          value: JSON.stringify({ parser: 'logfmt', value: 'api-1' }),
        },
      ],
    });

    expect(toggleFieldFromFilter('pod', 'api-1', scene)).toBe('toggle');
    expect(addToFiltersMock).toHaveBeenCalledWith('pod', 'api-1', 'toggle', scene, VAR_FIELDS);
  });

  it('includes when a different value is already filtered', () => {
    setup({
      filters: [
        {
          key: 'pod',
          operator: FilterOp.Equal,
          value: JSON.stringify({ parser: 'logfmt', value: 'api-2' }),
        },
      ],
    });

    expect(toggleFieldFromFilter('pod', 'api-1', scene)).toBe('include');
    expect(addToFiltersMock).toHaveBeenCalledWith('pod', 'api-1', 'include', scene, VAR_FIELDS);
  });

  it('toggles an existing inclusive metadata filter', () => {
    setup({
      filters: [{ key: 'cluster', operator: FilterOp.Equal, value: 'eu' }],
      parser: 'structuredMetadata',
    });

    expect(toggleFieldFromFilter('cluster', 'eu', scene)).toBe('toggle');
    expect(addToFiltersMock).toHaveBeenCalledWith('cluster', 'eu', 'toggle', scene, VAR_METADATA);
  });
});
