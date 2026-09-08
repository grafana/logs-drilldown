import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';

import { getFieldsTagValuesExpression, getLogsVolumeQuery } from './expressions';
import { getParserForField, getParserFromFieldsFilters } from './fields';
import { logger } from './logger';
import { getParserEnabled } from './parserToggle';
import { getFieldsVariable } from './variableGetters';
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
import { getDetectedFieldsFrame } from 'Components/ServiceScene/ServiceScene';

jest.mock('./parserToggle');
jest.mock('./fields');
jest.mock('./variableGetters');
jest.mock('./logger');
jest.mock('Components/ServiceScene/ServiceScene', () => ({
  getDetectedFieldsFrame: jest.fn(),
}));

const getParserEnabledMock = jest.mocked(getParserEnabled);
const getParserFromFieldsFiltersMock = jest.mocked(getParserFromFieldsFilters);
const getParserForFieldMock = jest.mocked(getParserForField);
const getFieldsVariableMock = jest.mocked(getFieldsVariable);
const getDetectedFieldsFrameMock = jest.mocked(getDetectedFieldsFrame);
const loggerErrorMock = jest.mocked(logger.error);

const sceneRef = {} as SceneObject;

const baseQuery = (fieldName: string) =>
  `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${fieldName})`;

const queryWithParser = (fieldName: string, format: string) =>
  `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${format} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${fieldName})`;

/**
 * Configure the mocked dependencies for a single test case.
 */
function setup(options: {
  detectedFieldsAvailable?: boolean;
  fieldParser?: ParserType;
  filterCount: number;
  parser: ParserType;
  parserEnabled: boolean;
}) {
  getParserEnabledMock.mockReturnValue(options.parserEnabled);
  getParserFromFieldsFiltersMock.mockReturnValue(options.parser);
  getParserForFieldMock.mockReturnValue(options.fieldParser ?? options.parser);
  getDetectedFieldsFrameMock.mockReturnValue(
    options.detectedFieldsAvailable
      ? ({ fields: [], length: 1 } as ReturnType<typeof getDetectedFieldsFrame>)
      : undefined
  );
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

  describe('when parsers are disabled', () => {
    it.each(['json', 'logfmt', 'mixed', 'structuredMetadata'] as const)(
      'does not append the %s parser format even when field filters are present',
      (parser) => {
        setup({ filterCount: 2, parser, parserEnabled: false });

        const expr = getLogsVolumeQuery(sceneRef, 'pod');

        expect(expr).toBe(baseQuery('pod'));
        expect(expr).not.toContain(JSON_FORMAT_EXPR);
        expect(expr).not.toContain(LOGS_FORMAT_EXPR);
        expect(expr).not.toContain(MIXED_FORMAT_EXPR);
        expect(expr).not.toContain('| json');
        expect(expr).not.toContain('| logfmt');
      }
    );

    it('produces the same query whether or not field filters exist', () => {
      setup({ filterCount: 0, parser: 'json', parserEnabled: false });
      const exprWithoutFilters = getLogsVolumeQuery(sceneRef, 'pod');

      setup({ filterCount: 5, parser: 'json', parserEnabled: false });
      const exprWithFilters = getLogsVolumeQuery(sceneRef, 'pod');

      expect(exprWithFilters).toBe(exprWithoutFilters);
      expect(exprWithoutFilters).toBe(baseQuery('pod'));
    });

    it('does not append a parser format when aggregating by the level selector', () => {
      setup({ filterCount: 2, parser: 'json', parserEnabled: false });

      const expr = getLogsVolumeQuery(sceneRef, LEVEL_VARIABLE_VALUE);

      expect(expr).toBe(baseQuery(LEVEL_VARIABLE_VALUE));
    });
  });

  describe('when parsers are enabled and field filters are present', () => {
    it.each([
      ['json', JSON_FORMAT_EXPR],
      ['logfmt', LOGS_FORMAT_EXPR],
      ['mixed', MIXED_FORMAT_EXPR],
    ] as const)('appends the %s parser format', (parser, format) => {
      setup({ filterCount: 1, parser, parserEnabled: true });

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(queryWithParser('pod', format));
      expect(getParserFromFieldsFiltersMock).toHaveBeenCalled();
      expect(getParserForFieldMock).not.toHaveBeenCalled();
      expect(getDetectedFieldsFrameMock).not.toHaveBeenCalled();
    });

    it('does not append a parser format for structured metadata', () => {
      setup({ filterCount: 1, parser: 'structuredMetadata', parserEnabled: true });

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(baseQuery('pod'));
    });

    it('uses field filters instead of detected fields even when a detected fields response is available', () => {
      setup({ detectedFieldsAvailable: true, filterCount: 1, parser: 'json', parserEnabled: true });

      getLogsVolumeQuery(sceneRef, 'pod');

      expect(getParserFromFieldsFiltersMock).toHaveBeenCalled();
      expect(getParserForFieldMock).not.toHaveBeenCalled();
      expect(getDetectedFieldsFrameMock).not.toHaveBeenCalled();
    });
  });

  describe('when parsers are enabled and there are no field filters', () => {
    it('does not append a parser format', () => {
      setup({ filterCount: 0, parser: 'json', parserEnabled: true });

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(baseQuery('pod'));
      expect(expr).not.toContain(JSON_FORMAT_EXPR);
    });

    it('uses the detected field type when the detected fields response is available', () => {
      setup({
        detectedFieldsAvailable: true,
        fieldParser: 'logfmt',
        filterCount: 0,
        parser: 'json',
        parserEnabled: true,
      });

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(baseQuery('pod'));
      expect(getParserForFieldMock).toHaveBeenCalledWith('pod', sceneRef);
      expect(getParserFromFieldsFiltersMock).not.toHaveBeenCalled();
    });

    it('falls back to mixed when the detected field type is missing', () => {
      setup({ detectedFieldsAvailable: true, filterCount: 0, parser: 'json', parserEnabled: true });
      getParserForFieldMock.mockReturnValue(undefined);

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(baseQuery('pod'));
      expect(getParserForFieldMock).toHaveBeenCalledWith('pod', sceneRef);
    });

    it('uses the detected field type for the level selector when the detected fields response is available', () => {
      setup({
        detectedFieldsAvailable: true,
        fieldParser: 'structuredMetadata',
        filterCount: 0,
        parser: 'json',
        parserEnabled: true,
      });

      getLogsVolumeQuery(sceneRef, LEVEL_VARIABLE_VALUE);

      expect(getParserForFieldMock).toHaveBeenCalledWith(LEVEL_VARIABLE_VALUE, sceneRef);
      expect(getParserFromFieldsFiltersMock).not.toHaveBeenCalled();
    });

    it('treats the level field as structured metadata when detected fields are unavailable', () => {
      setup({ detectedFieldsAvailable: false, filterCount: 0, parser: 'json', parserEnabled: true });

      const expr = getLogsVolumeQuery(sceneRef, LEVEL_VARIABLE_VALUE);

      expect(expr).toBe(baseQuery(LEVEL_VARIABLE_VALUE));
      expect(getParserForFieldMock).not.toHaveBeenCalled();
      expect(getParserFromFieldsFiltersMock).not.toHaveBeenCalled();
    });

    it('falls back to mixed when detected fields are unavailable and the field is not the level selector', () => {
      setup({ detectedFieldsAvailable: false, filterCount: 0, parser: 'json', parserEnabled: true });

      const expr = getLogsVolumeQuery(sceneRef, 'pod');

      expect(expr).toBe(baseQuery('pod'));
      expect(getParserForFieldMock).not.toHaveBeenCalled();
      expect(getParserFromFieldsFiltersMock).not.toHaveBeenCalled();
    });
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
