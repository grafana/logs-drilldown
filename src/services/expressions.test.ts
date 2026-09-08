import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';

import { excludeAggregateByFromLogsVolumeQuery, getFieldsTagValuesExpression, getLogsVolumeQuery } from './expressions';
import { getParserForField, getParserFromFieldsFilters } from './fields';
import { logger } from './logger';
import { renderLogQLFieldFilters, renderLogQLMetadataFilters } from './query';
import { getFieldsVariable, getMetadataVariable } from './variableGetters';
import {
  DETECTED_FIELD_AND_METADATA_VALUES_EXPR,
  DETECTED_LEVELS_VALUES_EXPR,
  JSON_FORMAT_EXPR,
  LEVEL_VARIABLE_VALUE,
  LOGS_FORMAT_EXPR,
  MIXED_FORMAT_EXPR,
  ParserType,
  VAR_FIELDS_AND_METADATA,
  VAR_FIELDS_EXPR,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_LINE_FILTERS_EXPR,
  VAR_LINE_FORMAT_EXPR,
  VAR_METADATA_EXPR,
  VAR_PATTERNS_EXPR,
} from './variables';

jest.mock('./fields');
jest.mock('./variableGetters');
jest.mock('./logger');
jest.mock('./query', () => ({
  renderLogQLFieldFilters: jest.fn(() => '| cluster="eu"'),
  renderLogQLMetadataFilters: jest.fn(() => '| namespace="prod"'),
}));

const getParserFromFieldsFiltersMock = jest.mocked(getParserFromFieldsFilters);
const getParserForFieldMock = jest.mocked(getParserForField);
const getFieldsVariableMock = jest.mocked(getFieldsVariable);
const getMetadataVariableMock = jest.mocked(getMetadataVariable);
const renderLogQLFieldFiltersMock = jest.mocked(renderLogQLFieldFilters);
const renderLogQLMetadataFiltersMock = jest.mocked(renderLogQLMetadataFilters);
const loggerErrorMock = jest.mocked(logger.error);

const sceneRef = {} as SceneObject;

const baseQuery = (fieldName: string) =>
  `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${fieldName})`;

const queryWithParser = (fieldName: string, format: string) =>
  `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${format} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${fieldName})`;

/**
 * Configure the mocked dependencies for a single test case.
 */
function setup(options: { fieldParser?: ParserType; filterCount: number; parser: ParserType }) {
  getParserFromFieldsFiltersMock.mockReturnValue(options.parser);
  getParserForFieldMock.mockReturnValue(options.fieldParser ?? options.parser);
  getFieldsVariableMock.mockReturnValue({
    state: {
      filters: new Array(options.filterCount).fill({}),
    },
  } as unknown as AdHocFiltersVariable);
}

describe('getLogsVolumeQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when field filters are present', () => {
    it.each([
      ['json', JSON_FORMAT_EXPR],
      ['logfmt', LOGS_FORMAT_EXPR],
      ['mixed', MIXED_FORMAT_EXPR],
    ] as const)('appends the %s parser format', (parser, format) => {
      setup({ filterCount: 1, parser });

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(queryWithParser('pod', format));
      expect(getParserFromFieldsFiltersMock).toHaveBeenCalled();
      expect(getParserForFieldMock).not.toHaveBeenCalled();
    });

    it('does not append a parser format for structured metadata', () => {
      setup({ filterCount: 1, parser: 'structuredMetadata' });

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(baseQuery('pod'));
    });
  });

  describe('when there are no field filters', () => {
    it.each([
      ['json', JSON_FORMAT_EXPR],
      ['logfmt', LOGS_FORMAT_EXPR],
      ['mixed', MIXED_FORMAT_EXPR],
    ] as const)('appends the %s parser from the detected field type', (fieldParser, format) => {
      setup({ fieldParser, filterCount: 0, parser: 'json' });

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(queryWithParser('pod', format));
      expect(getParserForFieldMock).toHaveBeenCalledWith('pod', sceneRef);
      expect(getParserFromFieldsFiltersMock).not.toHaveBeenCalled();
    });

    it('does not append a parser format when the detected field type is structured metadata', () => {
      setup({ fieldParser: 'structuredMetadata', filterCount: 0, parser: 'json' });

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(baseQuery('pod'));
      expect(getParserForFieldMock).toHaveBeenCalledWith('pod', sceneRef);
    });

    it('falls back to mixed when the detected field type is missing', () => {
      setup({ filterCount: 0, parser: 'json' });
      getParserForFieldMock.mockReturnValue(undefined);

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(queryWithParser('pod', MIXED_FORMAT_EXPR));
      expect(getParserForFieldMock).toHaveBeenCalledWith('pod', sceneRef);
    });

    it('treats the level field as structured metadata without looking up detected fields', () => {
      setup({ fieldParser: 'json', filterCount: 0, parser: 'json' });

      const expr = getLogsVolumeQuery(sceneRef, LEVEL_VARIABLE_VALUE);

      expect(expr).toBe(baseQuery(LEVEL_VARIABLE_VALUE));
      expect(getParserForFieldMock).not.toHaveBeenCalled();
      expect(getParserFromFieldsFiltersMock).not.toHaveBeenCalled();
    });
  });
});

describe('excludeAggregateByFromLogsVolumeQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    renderLogQLFieldFiltersMock.mockReturnValue('| cluster="eu"');
    renderLogQLMetadataFiltersMock.mockReturnValue('| namespace="prod"');
  });

  it('leaves the level query unchanged', () => {
    const expr = baseQuery(LEVEL_VARIABLE_VALUE);

    expect(excludeAggregateByFromLogsVolumeQuery(expr, LEVEL_VARIABLE_VALUE, sceneRef)).toBe(expr);
    expect(getParserForFieldMock).not.toHaveBeenCalled();
    expect(renderLogQLFieldFiltersMock).not.toHaveBeenCalled();
    expect(renderLogQLMetadataFiltersMock).not.toHaveBeenCalled();
  });

  it('replaces ${fields} with field filters excluding the grouped-by field', () => {
    const fieldFilters = [
      { key: 'pod', operator: '=', value: '{"parser":"logfmt","value":"api-1"}' },
      { key: 'cluster', operator: '=', value: '{"parser":"logfmt","value":"eu"}' },
    ];
    getParserForFieldMock.mockReturnValue('logfmt');
    getFieldsVariableMock.mockReturnValue({
      state: { filters: fieldFilters },
    } as unknown as AdHocFiltersVariable);

    const expr = queryWithParser('pod', LOGS_FORMAT_EXPR);
    const result = excludeAggregateByFromLogsVolumeQuery(expr, 'pod', sceneRef);

    expect(getParserForFieldMock).toHaveBeenCalledWith('pod', sceneRef);
    expect(renderLogQLFieldFiltersMock).toHaveBeenCalledWith(fieldFilters, ['pod']);
    expect(renderLogQLMetadataFiltersMock).not.toHaveBeenCalled();
    expect(result).toBe(expr.replace(VAR_FIELDS_EXPR, '| cluster="eu"'));
    expect(result).toContain(VAR_METADATA_EXPR);
  });

  it('replaces ${metadata} when the grouped-by field is structured metadata', () => {
    const metadataFilters = [
      { key: 'cluster', operator: '=', value: 'eu' },
      { key: 'namespace', operator: '=', value: 'prod' },
    ];
    getParserForFieldMock.mockReturnValue('structuredMetadata');
    getMetadataVariableMock.mockReturnValue({
      state: { filters: metadataFilters },
    } as unknown as AdHocFiltersVariable);

    const expr = baseQuery('cluster');
    const result = excludeAggregateByFromLogsVolumeQuery(expr, 'cluster', sceneRef);

    expect(getParserForFieldMock).toHaveBeenCalledWith('cluster', sceneRef);
    expect(renderLogQLMetadataFiltersMock).toHaveBeenCalledWith(metadataFilters, ['cluster']);
    expect(renderLogQLFieldFiltersMock).not.toHaveBeenCalled();
    expect(result).toBe(expr.replace(VAR_METADATA_EXPR, '| namespace="prod"'));
    expect(result).toContain(VAR_FIELDS_EXPR);
  });
});

describe('getFieldsTagValuesExpression', () => {
  it('returns the detected levels expression', () => {
    expect(getFieldsTagValuesExpression(VAR_LEVELS)).toBe(DETECTED_LEVELS_VALUES_EXPR);
  });

  it('returns the detected fields and metadata expression', () => {
    expect(getFieldsTagValuesExpression(VAR_FIELDS_AND_METADATA)).toBe(DETECTED_FIELD_AND_METADATA_VALUES_EXPR);
  });

  it('throws and logs for an unknown variable type', () => {
    expect(() => getFieldsTagValuesExpression('unknown' as typeof VAR_LEVELS)).toThrow(
      'Unknown variable type: unknown'
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(expect.any(Error), {
      msg: 'getFieldsTagValuesExpression: Unknown variable type: unknown',
      variableType: 'unknown',
    });
  });
});
