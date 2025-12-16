import {
  createDataFrame,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PluginExtensionPanelContext,
} from '@grafana/data';

import { getMatcherFromQuery } from './logqlMatchers';

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
