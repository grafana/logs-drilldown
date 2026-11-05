import { DateTime, TimeRange } from '@grafana/data';
import {
  DataSourceVariable,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
} from '@grafana/scenes';

import { VAR_DATASOURCE_MINI, VAR_DATASOURCE_MINI_EXPR } from './variables';
import { LokiQuery } from 'services/lokiQuery';
import { PLUGIN_ID } from 'services/plugin';

const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };
const DEFAULT_MAX_LOG_LINES = 100;

// Standalone equivalent of services/query.ts's buildDataQuery: that file also pulls in
// Components/IndexScene/LineFilter/LineFilterVariablesScene and other scene-tree-only code,
// which would drag the whole IndexScene stack into this lazy-loaded, from-scratch chunk.
function buildMiniDataQuery(expr: string, overrides: Partial<LokiQuery>): LokiQuery {
  return {
    editorMode: 'code',
    queryType: 'range',
    refId: 'A',
    supportingQueryType: PLUGIN_ID,
    ...overrides,
    expr,
  };
}

// `raw.from`/`raw.to` are a relative string (e.g. "now-15m") or an absolute DateTime; SceneTimeRange wants a string either way.
function toRawRangeString(value: DateTime | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

export interface EmbeddedLogsMiniSceneOptions {
  datasourceUid: string;
  query: string;
  timeRange?: TimeRange;
}

export interface EmbeddedLogsMiniSceneState extends SceneObjectState {
  logsQueryRunner: SceneQueryRunner;
  volumeQueryRunner: SceneQueryRunner;
}

// Built from scratch: owns just a datasource variable, a time range, and the two query runners
// (logs + volume) the mini embed needs. No IndexScene/ServiceScene reuse.
export class EmbeddedLogsMiniScene extends SceneObjectBase<EmbeddedLogsMiniSceneState> {
  public constructor({ datasourceUid, query, timeRange }: EmbeddedLogsMiniSceneOptions) {
    super({
      $timeRange: timeRange
        ? new SceneTimeRange({
            from: toRawRangeString(timeRange.raw.from),
            to: toRawRangeString(timeRange.raw.to),
            value: timeRange,
          })
        : new SceneTimeRange(DEFAULT_TIME_RANGE),
      $variables: new SceneVariableSet({
        variables: [
          new DataSourceVariable({
            name: VAR_DATASOURCE_MINI,
            pluginId: 'loki',
            value: datasourceUid,
          }),
        ],
      }),
      logsQueryRunner: new SceneQueryRunner({
        datasource: { uid: VAR_DATASOURCE_MINI_EXPR },
        queries: [buildMiniDataQuery(query, { maxLines: DEFAULT_MAX_LOG_LINES, refId: 'logs' })],
      }),
      // Total log volume over time; grouping by level/label is left for a later, configurable pass.
      volumeQueryRunner: new SceneQueryRunner({
        datasource: { uid: VAR_DATASOURCE_MINI_EXPR },
        queries: [
          buildMiniDataQuery(`sum(count_over_time(${query} [$__auto]))`, { legendFormat: 'Logs', refId: 'volume' }),
        ],
      }),
    });
  }
}
