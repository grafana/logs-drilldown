import {
  createDataFrame,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PluginExtensionPanelContext,
} from '@grafana/data';

import { getLabelFormatIdentifiersFromQuery, getMatcherFromQuery } from './logqlMatchers';

describe('getMatcherFromQuery', () => {
  describe('Fields', () => {
    const context: PluginExtensionPanelContext = {
      data: {
        state: LoadingState.Done,
        series: [
          createDataFrame({
            refId: 'test',
            fields: [
              { name: 'Time', values: [111111], type: FieldType.time },
              { name: 'Value', values: ['A'], type: FieldType.string },
              { name: 'labelTypes', values: [{ label: 'P' }], type: FieldType.other },
            ],
          }),
        ],
        timeRange: getDefaultTimeRange(),
      },
      pluginId: '',
      id: 0,
      title: '',
      timeRange: getDefaultTimeRange(),
      timeZone: '',
      dashboard: {
        uid: '',
        title: '',
        tags: [],
      },
      targets: [],
    };

    test('Parses fields filters in queries', () => {
      const result = getMatcherFromQuery('{service_name="tempo-distributor"} | label="value"');

      expect(result.fields).toEqual([
        {
          key: 'label',
          operator: '=',
          parser: 'structuredMetadata',
          type: 'S',
          value: 'value',
        },
      ]);
    });

    test('Parses fields filters in queries with a given context', () => {
      const result = getMatcherFromQuery('{service_name="tempo-distributor"} | logfmt | label="value"', context, {
        refId: 'test',
        expr: '',
      });

      expect(result.fields).toEqual([
        {
          key: 'label',
          operator: '=',
          parser: 'logfmt',
          type: 'P',
          value: 'value',
        },
      ]);
    });

    describe('or', () => {
      const field = (key: string, operator: string, value: string, orGroup?: number) => ({
        key,
        operator,
        orGroup,
        parser: 'logfmt',
        type: 'P',
        value,
      });

      test('Parses "or" between different fields into an OR group', () => {
        const result = getMatcherFromQuery(
          '{service_name="api"} | logfmt | status >= 500 or duration > 5s | level="error"'
        );

        expect(result.fields).toEqual([
          field('status', '>=', '500', 1),
          field('duration', '>', '5s', 1),
          field('level', '=', 'error'),
        ]);
      });

      test('Gives each pipeline stage its own OR group', () => {
        const result = getMatcherFromQuery('{service_name="api"} | logfmt | a="1" or b="2" | c="3" or c="4"');

        expect(result.fields).toEqual([
          field('a', '=', '1', 1),
          field('b', '=', '2', 1),
          field('c', '=', '3', 2),
          field('c', '=', '4', 2),
        ]);
      });

      test('Binds "and" tighter than "or"', () => {
        const result = getMatcherFromQuery('{service_name="api"} | logfmt | a="1" or b="2" and c="3"');

        // a or (b and c) == (a or b) and (a or c)
        expect(result.fields).toEqual([
          field('a', '=', '1', 1),
          field('b', '=', '2', 1),
          field('a', '=', '1', 2),
          field('c', '=', '3', 2),
        ]);
      });

      test('Respects parentheses and commas', () => {
        const result = getMatcherFromQuery('{service_name="api"} | logfmt | (a="1" or b="2"), c="3"');

        expect(result.fields).toEqual([field('a', '=', '1', 1), field('b', '=', '2', 1), field('c', '=', '3')]);
      });

      test('Skips an OR clause that contains a filter that cannot be imported', () => {
        const result = getMatcherFromQuery('{service_name="api"} | logfmt | __error__="" or a="1" | b="2"');

        expect(result.fields).toEqual([field('b', '=', '2')]);
      });

      test('Skips label filter stages that are too complex to expand', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const tooComplex = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => `(${key}="1" and ${key}="2")`).join(' or ');
        const result = getMatcherFromQuery(`{service_name="api"} | logfmt | ${tooComplex} | b="2"`);

        expect(result.fields).toEqual([field('b', '=', '2')]);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
      });
    });
  });

  describe('Label filters', () => {
    test('Parses fields filters in queries', () => {
      const result = getMatcherFromQuery('{label="value", other_label=~"other value", another_label!="another value"}');

      expect(result.labelFilters).toEqual([
        {
          key: 'label',
          operator: '=',
          type: 'I',
          value: 'value',
        },
        {
          key: 'other_label',
          operator: '=~',
          type: 'I',
          value: 'other value',
        },
        {
          key: 'another_label',
          operator: '!=',
          type: 'I',
          value: 'another value',
        },
      ]);
    });
  });

  describe('Line filters', () => {
    test('Line filters', () => {
      const result = getMatcherFromQuery('{service_name="tempo-distributor"} |~ "(?i)Error"');

      expect(result.lineFilters).toEqual([
        {
          key: 'caseInsensitive',
          operator: '|~',
          value: 'Error',
        },
      ]);
    });
  });
});

describe('getLabelFormatIdentifiersFromQuery', () => {
  test('Should return the label format labels from a query', () => {
    const result = getLabelFormatIdentifiersFromQuery(
      '{cluster="test"}  | label_format log_line_contains_trace_id=`{{ contains "abcd2134" __line__  }}` | log_line_contains_trace_id="true" or trace_id="abcd2134" | label_format log_line_contains_span_id=`{{ contains "c0ff33" __line__  }}` | log_line_contains_span_id="true" or span_id="c0ff33" | metadata="value"'
    );
    expect(result).toEqual(['log_line_contains_trace_id', 'log_line_contains_span_id']);
  });
});
