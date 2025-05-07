import { Observable } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourcePluginMeta,
  dateTime,
  LoadingState,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { WrappedLokiDatasource } from './datasource';
import { SceneDataQueryResourceRequest } from './datasourceTypes';
import { DetectedFieldsResponse } from './fields';
import { LokiDatasource, LokiQuery } from './lokiQuery';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(() => {
    return {
      get: (ds: DataSourceWithBackend) => Promise.resolve(ds),
    };
  }),
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
