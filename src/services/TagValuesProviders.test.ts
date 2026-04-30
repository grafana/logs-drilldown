import { dateTime, TimeRange } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, AdHocFilterWithLabels, sceneGraph } from '@grafana/scenes';

import { LabelFilterOp } from './filterTypes';
import { LokiDatasource } from './lokiQuery';
import { getDataSource } from './scenes';
import { getLabelValues, getLabelsTagValuesProvider, tagValuesFilterAdHocFilters } from './TagValuesProviders';
import { getDataSourceVariable } from './variableGetters';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));
jest.mock('./scenes', () => ({
  ...jest.requireActual('./scenes'),
  getDataSource: jest.fn(),
}));
jest.mock('./variableGetters', () => ({
  ...jest.requireActual('./variableGetters'),
  getDataSourceVariable: jest.fn(),
}));

function mockDsMethod(ds: object): LokiDatasource {
  Object.setPrototypeOf(ds, DataSourceWithBackend.prototype);
  return ds as LokiDatasource;
}

const getNewFilter = (key: string, operator: LabelFilterOp): AdHocFilterWithLabels => {
  return {
    key,
    keyLabel: key,
    operator,
    value: '',
  };
};

describe('tagValuesFilterAdHocFilters', () => {
  test('Should return empty: Single existing value for same label', () => {
    // Single existing value for same label
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'env',
            operator: LabelFilterOp.Equal,
            value: '1',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([]);
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'env',
            operator: LabelFilterOp.Equal,
            value: '1',
          },
        ],
        getNewFilter('env', LabelFilterOp.RegexEqual)
      )
    ).toEqual([]);
  });
  test('Should return empty:  Multiple existing values for same label', () => {
    expect(
      tagValuesFilterAdHocFilters(
        [
          { key: 'env', operator: LabelFilterOp.Equal, value: '1' },
          {
            key: 'env',
            operator: LabelFilterOp.Equal,
            value: '2',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([]);
    expect(
      tagValuesFilterAdHocFilters(
        [
          { key: 'env', operator: LabelFilterOp.Equal, value: '1' },
          {
            key: 'env',
            operator: LabelFilterOp.Equal,
            value: '2',
          },
        ],
        getNewFilter('env', LabelFilterOp.RegexEqual)
      )
    ).toEqual([]);
  });
  test('Should return empty: Regex value for same label', () => {
    expect(
      tagValuesFilterAdHocFilters(
        [
          { key: 'env', operator: LabelFilterOp.RegexEqual, value: '1|2' },
          {
            key: 'env',
            operator: LabelFilterOp.RegexEqual,
            value: '3|4',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([]);
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'env',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2|.+',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([]);
  });
  test('Existing filter for same label, but adding negative filter', () => {
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'env',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2',
          },
        ],
        getNewFilter('env', LabelFilterOp.NotEqual)
      )
    ).toEqual([
      {
        key: 'env',
        operator: LabelFilterOp.RegexEqual,
        value: '1|2',
      },
    ]);
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'env',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2',
          },
        ],
        getNewFilter('env', LabelFilterOp.RegexNotEqual)
      )
    ).toEqual([
      {
        key: 'env',
        operator: LabelFilterOp.RegexEqual,
        value: '1|2',
      },
    ]);
  });
  test('Contains filter for another label', () => {
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'service_name',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([
      {
        key: 'service_name',
        operator: LabelFilterOp.RegexEqual,
        value: '1|2',
      },
    ]);
  });
  test('Contains filter for same label, and another label', () => {
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'service_name',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2',
          },
          {
            key: 'env',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([
      {
        key: 'service_name',
        operator: LabelFilterOp.RegexEqual,
        value: '1|2',
      },
    ]);
  });
});

describe('getLabelValues', () => {
  it('forwards timeRange to datasource.getTagValues when provided', async () => {
    const getTagValues = jest.fn().mockResolvedValue([{ text: 'app-a' }]);
    const datasource = mockDsMethod({ getTagValues });

    const range: TimeRange = {
      from: dateTime('2024-02-01T00:00:00Z'),
      to: dateTime('2024-02-01T02:00:00Z'),
      raw: { from: '2024-02-01T00:00:00Z', to: '2024-02-01T02:00:00Z' },
    };

    const filter: AdHocFilterWithLabels = {
      key: 'app',
      operator: LabelFilterOp.NotEqual,
      value: '""',
    };

    await getLabelValues([], filter, datasource, 'ds-uid', range);

    expect(getTagValues).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'app',
        timeRange: range,
      })
    );
  });

  it('does not pass a defined timeRange when the argument is omitted', async () => {
    const getTagValues = jest.fn().mockResolvedValue([{ text: 'app-a' }]);
    const datasource = mockDsMethod({ getTagValues });

    const filter: AdHocFilterWithLabels = {
      key: 'app',
      operator: LabelFilterOp.NotEqual,
      value: '""',
    };

    await getLabelValues([], filter, datasource, 'ds-uid');

    expect(getTagValues.mock.calls[0][0].timeRange).toBeUndefined();
  });
});

describe('getLabelsTagValuesProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses scene time range from sceneGraph.getTimeRange for getTagValues', async () => {
    const sceneTimeRange: TimeRange = {
      from: dateTime('2024-07-01T08:00:00Z'),
      to: dateTime('2024-07-01T09:00:00Z'),
      raw: { from: '2024-07-01T08:00:00Z', to: '2024-07-01T09:00:00Z' },
    };

    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      state: { value: sceneTimeRange },
    } as ReturnType<typeof sceneGraph.getTimeRange>);

    const getTagValues = jest.fn().mockResolvedValue([{ text: 'value-1' }]);
    const datasource = mockDsMethod({ getTagValues });

    jest.mocked(getDataSource).mockReturnValue('loki-uid');
    jest.mocked(getDataSourceSrv).mockReturnValue({
      get: jest.fn().mockResolvedValue(datasource),
    } as unknown as ReturnType<typeof getDataSourceSrv>);
    jest.mocked(getDataSourceVariable).mockReturnValue({
      getValue: () => 'ds-uid',
    } as ReturnType<typeof getDataSourceVariable>);

    const variable = new AdHocFiltersVariable({ name: 'labels', filters: [] });
    const filter: AdHocFilterWithLabels = {
      key: 'job',
      operator: LabelFilterOp.NotEqual,
      value: '""',
    };

    const result = await getLabelsTagValuesProvider(variable, filter);

    expect(result.replace).toBe(true);
    expect(getTagValues).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'job',
        timeRange: sceneTimeRange,
      })
    );
  });
});
