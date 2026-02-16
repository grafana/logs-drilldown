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
