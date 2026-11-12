import { filter, firstValueFrom, isObservable, Observable, tap } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourcePluginMeta,
  dateTime,
  LoadingState,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';

import { WrappedLokiDatasource } from './datasource';
import { SceneDataQueryRequest, SceneDataQueryResourceRequest } from './datasourceTypes';
import { DetectedFieldsResponse } from './fields';
import { LokiDatasource, LokiQuery } from './lokiQuery';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstance: (ds: DataSourceWithBackend) => Promise.resolve(ds),
}));

let datasource = new DataSourceWithBackend<LokiQuery>({
  access: 'direct',
  id: 0,
  jsonData: {},
  meta: {} as DataSourcePluginMeta,
  name: '',
  readOnly: false,
  type: '',
  uid: '',
}) as LokiDatasource;
datasource.interpolateString = (s) => s;
datasource.getTimeRangeParams = () => ({ end: 0, start: 0 });

jest.mock('./scenes', () => ({
  ...jest.requireActual('./scenes'),
  getDataSource: () => datasource,
}));
describe('datasource', () => {
  describe('detected_fields', () => {
    let detectedFieldsResponse: DetectedFieldsResponse;
    beforeEach(() => {
      detectedFieldsResponse = {
        fields: [
          {
            cardinality: 2,
            jsonPath: ['caller'],
            label: 'caller',
            parsers: ['logfmt'],
            type: 'string',
          },
          {
            cardinality: 4,
            jsonPath: ['detected-level'],
            label: 'detected_level',
            parsers: ['logfmt'],
            type: 'string',
          },
        ],
      };

      //@ts-expect-error
      datasource.getResource = (path, params, options) => {
        const detectedFieldResponse: DetectedFieldsResponse = detectedFieldsResponse;
        return Promise.resolve(detectedFieldResponse);
      };
    });
    it('should strip out detected_level', (done) => {
      const datasource = new WrappedLokiDatasource('logs-explore', 'abc-123');
      const request = {
        app: 'logs-explore',
        range: {
          from: dateTime(),
          raw: {
            from: dateTime(),
            to: dateTime(),
          },
          to: dateTime(),
        },
        scopedVars: {
          __sceneObject: {},
        },
        targets: [
          {
            datasource: '',
            editorMode: 'code',
            expr: '',
            queryType: '',
            refId: '',
            resource: 'detected_fields',
            supportingQueryType: '',
          },
        ],
      } as unknown as DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>;
      const response = datasource.query(request) as Observable<DataQueryResponse>;

      response.subscribe((value) => {
        if (value.state === LoadingState.Done) {
          const dataFrame: DataFrame = value.data[0];
          expect(dataFrame.fields[0].values).toEqual(['caller']);
          expect(dataFrame.fields[1].values).toEqual([2]);
          expect(dataFrame.fields[2].values).toEqual(['logfmt']);
          done();
        }
      });
    });
    it('should strip out level_extracted and level', (done) => {
      detectedFieldsResponse = {
        fields: [
          {
            cardinality: 2,
            jsonPath: ['caller'],
            label: 'caller',
            parsers: ['logfmt'],
            type: 'string',
          },
          {
            cardinality: 4,
            jsonPath: ['level_extracted'],
            label: 'level_extracted',
            parsers: ['logfmt'],
            type: 'string',
          },
          {
            cardinality: 4,
            jsonPath: ['level'],
            label: 'level',
            parsers: ['logfmt'],
            type: 'string',
          },
        ],
      };
      const datasource = new WrappedLokiDatasource('logs-explore', 'abc-123');
      const request = {
        app: 'logs-explore',
        range: {
          from: dateTime(),
          raw: {
            from: dateTime(),
            to: dateTime(),
          },
          to: dateTime(),
        },
        scopedVars: {
          __sceneObject: {},
        },
        targets: [
          {
            datasource: '',
            editorMode: 'code',
            expr: '',
            queryType: '',
            refId: '',
            resource: 'detected_fields',
            supportingQueryType: '',
          },
        ],
      } as unknown as DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>;
      const response = datasource.query(request) as Observable<DataQueryResponse>;

      response.subscribe((value) => {
        const dataFrame: DataFrame = value.data[0];
        if (value.state === LoadingState.Done) {
          expect(dataFrame.fields[0].values).toEqual(['caller']);
          expect(dataFrame.fields[1].values).toEqual([2]);
          expect(dataFrame.fields[2].values).toEqual(['logfmt']);
          done();
        }
      });
    });
  });
});

it.each([false, true])('preserves the normal Patterns query lifecycle and options (failure: %s)', async (failing) => {
  const getResource = jest.spyOn(datasource, 'getResource');
  if (failing) {
    getResource.mockRejectedValueOnce(new Error('Loki unavailable'));
  } else {
    getResource.mockResolvedValueOnce({ data: [{ pattern: 'request <_>', level: 'info', samples: [[1, 3]] }] });
  }

  const scene = new SceneTimeRange({ from: 'now-15m', to: 'now' });
  const sceneVar = { value: scene, valueOf: () => scene };
  const request: SceneDataQueryRequest = {
    app: 'test',
    requestId: 'normal-patterns',
    interval: '1m',
    intervalMs: 60000,
    range: scene.state.value,
    startTime: Date.now(),
    timezone: 'utc',
    scopedVars: { __sceneObject: sceneVar },
    targets: [{ expr: '{app="api"}', refId: 'patterns-ref', resource: 'patterns' }],
  };
  const response = new WrappedLokiDatasource('test', 'wrapped-test').query(request);
  if (!isObservable(response)) {
    throw new Error('Expected an observable query response');
  }

  const states: Array<LoadingState | undefined> = [];
  const result = await firstValueFrom(
    response.pipe(
      tap((value) => states.push(value.state)),
      filter((value) => value.state === LoadingState.Done || value.state === LoadingState.Error)
    )
  );

  expect(states).toEqual([LoadingState.Loading, failing ? LoadingState.Error : LoadingState.Done]);
  expect(getResource).toHaveBeenCalledWith(
    'patterns',
    expect.objectContaining({ query: '{app="api"}', step: '1m' }),
    expect.objectContaining({ requestId: 'normal-patterns', showErrorAlert: false })
  );
  if (failing) {
    expect(result.data).toEqual([]);
  } else {
    expect(result.data[0]).toMatchObject({
      refId: 'patterns-ref',
      name: 'request <_>',
      meta: { custom: { sum: 3, level: ['info'] } },
    });
  }

  getResource.mockRestore();
});
