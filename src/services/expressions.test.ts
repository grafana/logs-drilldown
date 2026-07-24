import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';

import { getTimeSeriesExpr } from './expressions';
import { getParserFromFieldsFilters } from './fields';
import { getParserEnabled } from './parserToggle';
import { getFieldsVariable } from './variableGetters';
import { JSON_FORMAT_EXPR, LEVEL_VARIABLE_VALUE, LOGS_FORMAT_EXPR, MIXED_FORMAT_EXPR } from './variables';

jest.mock('./parserToggle');
jest.mock('./fields');
jest.mock('./variableGetters');

const getParserEnabledMock = jest.mocked(getParserEnabled);
const getParserFromFieldsFiltersMock = jest.mocked(getParserFromFieldsFilters);
const getFieldsVariableMock = jest.mocked(getFieldsVariable);

const sceneRef = {} as SceneObject;

/**
 * Configure the mocked dependencies for a single test case.
 */
function setup(options: {
  filterCount: number;
  parser: 'json' | 'logfmt' | 'mixed' | 'structuredMetadata';
  parserEnabled: boolean;
}) {
  getParserEnabledMock.mockReturnValue(options.parserEnabled);
  getParserFromFieldsFiltersMock.mockReturnValue(options.parser);
  getFieldsVariableMock.mockReturnValue({
    state: {
      filters: new Array(options.filterCount).fill({}),
    },
  } as unknown as AdHocFiltersVariable);
}

describe('getTimeSeriesExpr', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when parsers are disabled', () => {
    it.each(['json', 'logfmt', 'mixed'] as const)(
      'does not append the %s parser format even when field filters are present',
      (parser) => {
        setup({ filterCount: 2, parser, parserEnabled: false });

        const expr = getTimeSeriesExpr(sceneRef, 'pod');

        expect(expr).not.toContain(JSON_FORMAT_EXPR);
        expect(expr).not.toContain(LOGS_FORMAT_EXPR);
        expect(expr).not.toContain(MIXED_FORMAT_EXPR);
        expect(expr).not.toContain('| json');
        expect(expr).not.toContain('| logfmt');
      }
    );

    it('returns the base query without parser segments when field filters are present', () => {
      setup({ filterCount: 3, parser: 'json', parserEnabled: false });

      const expr = getTimeSeriesExpr(sceneRef, 'pod');

      expect(expr).toBe(
        'sum(count_over_time({${filters}}  ${metadata} ${patterns} ${lineFilters} ${fields} ${lineFormat} [$__auto])) by (pod)'
      );
    });

    it('produces the same query whether or not field filters exist', () => {
      setup({ filterCount: 0, parser: 'json', parserEnabled: false });
      const exprWithoutFilters = getTimeSeriesExpr(sceneRef, 'pod');

      setup({ filterCount: 5, parser: 'json', parserEnabled: false });
      const exprWithFilters = getTimeSeriesExpr(sceneRef, 'pod');

      expect(exprWithFilters).toBe(exprWithoutFilters);
    });

    it('still appends the level metadata expression when excluding empty values for the level selector', () => {
      setup({ filterCount: 2, parser: 'json', parserEnabled: false });

      const expr = getTimeSeriesExpr(sceneRef, LEVEL_VARIABLE_VALUE);

      expect(expr).toContain(`| ${LEVEL_VARIABLE_VALUE} != ""`);
      expect(expr).not.toContain(JSON_FORMAT_EXPR);
      expect(expr).toBe(
        `sum(count_over_time({\${filters}} | ${LEVEL_VARIABLE_VALUE} != "" \${metadata} \${patterns} \${lineFilters} \${fields} \${lineFormat} [$__auto])) by (${LEVEL_VARIABLE_VALUE})`
      );
    });
  });

  describe('when parsers are enabled', () => {
    it('appends the json parser format when field filters are present', () => {
      setup({ filterCount: 1, parser: 'json', parserEnabled: true });

      const expr = getTimeSeriesExpr(sceneRef, 'pod');

      expect(expr).toContain(JSON_FORMAT_EXPR);
    });

    it('does not append a parser format when there are no field filters', () => {
      setup({ filterCount: 0, parser: 'json', parserEnabled: true });

      const expr = getTimeSeriesExpr(sceneRef, 'pod');

      expect(expr).not.toContain(JSON_FORMAT_EXPR);
    });
  });
});
