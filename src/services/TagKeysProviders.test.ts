import { dateTime, TimeRange } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';

import { LokiDatasource } from './lokiQuery';
import { getDataSource } from './scenes';
import { getLabelsKeys, getLabelsTagKeysProvider } from './TagKeysProviders';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));
jest.mock('./scenes', () => ({
  ...jest.requireActual('./scenes'),
  getDataSource: jest.fn(),
}));

function mockDsMethod(ds: object): LokiDatasource {
  Object.setPrototypeOf(ds, DataSourceWithBackend.prototype);
  return ds as LokiDatasource;
}

describe('getLabelsKeys', () => {
  it('forwards timeRange to datasource.getTagKeys when provided', async () => {
    const getTagKeys = jest.fn().mockResolvedValue([{ text: 'job' }]);
    const datasource = mockDsMethod({ getTagKeys });

    const range: TimeRange = {
      from: dateTime('2024-01-01T00:00:00Z'),
      to: dateTime('2024-01-01T01:00:00Z'),
      raw: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T01:00:00Z' },
    };

    await getLabelsKeys([], datasource, range);

    expect(getTagKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [],
        timeRange: range,
      })
    );
  });

  it('does not pass a defined timeRange when the argument is omitted', async () => {
    const getTagKeys = jest.fn().mockResolvedValue([{ text: 'job' }]);
    const datasource = mockDsMethod({ getTagKeys });

    await getLabelsKeys([], datasource);

    const callOpts = getTagKeys.mock.calls[0][0];
    expect(callOpts.filters).toEqual([]);
    expect(callOpts.timeRange).toBeUndefined();
  });
});

describe('getLabelsTagKeysProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses scene time range from sceneGraph.getTimeRange for getTagKeys', async () => {
    const sceneTimeRange: TimeRange = {
      from: dateTime('2024-06-15T10:00:00Z'),
      to: dateTime('2024-06-15T11:00:00Z'),
      raw: { from: '2024-06-15T10:00:00Z', to: '2024-06-15T11:00:00Z' },
    };

    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue({
      state: { value: sceneTimeRange },
    } as ReturnType<typeof sceneGraph.getTimeRange>);

    const getTagKeys = jest.fn().mockResolvedValue([{ text: 'namespace' }]);
    const datasource = mockDsMethod({ getTagKeys });

    jest.mocked(getDataSource).mockReturnValue('loki-uid');
    jest.mocked(getDataSourceSrv).mockReturnValue({
      get: jest.fn().mockResolvedValue(datasource),
    } as unknown as ReturnType<typeof getDataSourceSrv>);

    const variable = new AdHocFiltersVariable({ name: 'labels', filters: [] });

    const result = await getLabelsTagKeysProvider(variable);

    expect(result.replace).toBe(true);
    expect(getTagKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        timeRange: sceneTimeRange,
      })
    );
  });
});
