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
          parser: undefined,
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
});
