import { dateTime, TimeRange } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, sceneGraph, SceneObject } from '@grafana/scenes';

import { LokiDatasource } from './lokiQuery';
import { getParserEnabled } from './parserToggle';
import { getDataSource } from './scenes';
import { DetectedFieldsResult } from './TagValuesProviders';
import { getFieldsKeysProvider, getLabelsKeys, getLabelsTagKeysProvider } from './TagKeysProviders';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS_AND_METADATA } from './variables';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));
jest.mock('./scenes', () => ({
  ...jest.requireActual('./scenes'),
  getDataSource: jest.fn(),
}));
jest.mock('./parserToggle', () => ({
  getParserEnabled: jest.fn(),
}));

function mockDsMethod(ds: object): LokiDatasource {
  Object.setPrototypeOf(ds, DataSourceWithBackend.prototype);
  return ds as LokiDatasource;
}

function mockFieldsDatasource(fields: DetectedFieldsResult): {
  datasource: LokiDatasource;
  fetchDetectedFields: jest.Mock;
} {
  const fetchDetectedFields = jest.fn().mockResolvedValue(fields);
  const datasource = mockDsMethod({
    languageProvider: { fetchDetectedFields },
  });

  jest.mocked(getDataSource).mockReturnValue('loki-uid');
  jest.mocked(getDataSourceSrv).mockReturnValue({
    get: jest.fn().mockResolvedValue(datasource),
  } as unknown as ReturnType<typeof getDataSourceSrv>);

  return { datasource, fetchDetectedFields };
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

describe('getFieldsKeysProvider with parsers disabled', () => {
  const sceneRef = {} as SceneObject;

  const detectedFields: DetectedFieldsResult = [
    { cardinality: 1, label: 'trace_id', parsers: null, type: 'string' },
    { cardinality: 2, label: 'pod', parsers: null, type: 'string' },
    { cardinality: 3, label: 'level', parsers: ['logfmt'], type: 'string' },
    { cardinality: 4, label: 'duration', parsers: ['json', 'logfmt'], type: 'string' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getParserEnabled).mockReturnValue(false);
  });

  it('returns only structured-metadata fields (parsers === null) for VAR_FIELDS_AND_METADATA', async () => {
    mockFieldsDatasource(detectedFields);

    const result = await getFieldsKeysProvider({
      expr: '{service_name="test"}',
      sceneRef,
      variableType: VAR_FIELDS_AND_METADATA,
    });

    expect(result.replace).toBe(true);
    expect(result.values.map((value) => value.text)).toEqual(['trace_id', 'pod']);
  });

  it('marks the returned structured-metadata fields with the structuredMetadata parser group', async () => {
    mockFieldsDatasource(detectedFields);

    const result = await getFieldsKeysProvider({
      expr: '{service_name="test"}',
      sceneRef,
      variableType: VAR_FIELDS_AND_METADATA,
    });

    expect(result.values).toEqual([
      expect.objectContaining({
        group: 'structuredMetadata',
        meta: expect.objectContaining({ parser: 'structuredMetadata' }),
        text: 'trace_id',
        value: 'trace_id',
      }),
      expect.objectContaining({
        group: 'structuredMetadata',
        meta: expect.objectContaining({ parser: 'structuredMetadata' }),
        text: 'pod',
        value: 'pod',
      }),
    ]);
  });

  it('excludes parser-dependent fields when no structured-metadata fields exist', async () => {
    mockFieldsDatasource([
      { cardinality: 3, label: 'level', parsers: ['logfmt'], type: 'string' },
      { cardinality: 4, label: 'duration', parsers: ['json', 'logfmt'], type: 'string' },
    ]);

    const result = await getFieldsKeysProvider({
      expr: '{service_name="test"}',
      sceneRef,
      variableType: VAR_FIELDS_AND_METADATA,
    });

    expect(result.values).toEqual([]);
  });

  it('still includes the detected level field even when it requires a parser', async () => {
    mockFieldsDatasource([
      { cardinality: 1, label: 'trace_id', parsers: null, type: 'string' },
      { cardinality: 5, label: LEVEL_VARIABLE_VALUE, parsers: ['logfmt'], type: 'string' },
    ]);

    const result = await getFieldsKeysProvider({
      expr: '{service_name="test"}',
      sceneRef,
      variableType: VAR_FIELDS_AND_METADATA,
    });

    expect(result.values.map((value) => value.text)).toEqual(
      expect.arrayContaining(['trace_id', LEVEL_VARIABLE_VALUE])
    );
  });
});
