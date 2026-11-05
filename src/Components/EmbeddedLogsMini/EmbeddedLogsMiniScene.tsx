import React from 'react';

import { DateTime, TimeRange } from '@grafana/data';
import {
  DataSourceVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
} from '@grafana/scenes';

import { buildLogsPanel, buildVolumePanel } from './panels';
import { buildLogsQuery, buildVolumeQuery } from './queries';
import { VAR_DATASOURCE_MINI, VAR_DATASOURCE_MINI_EXPR } from './variables';

const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };
// Preferred sizes when there's room; minHeights are floors so panels shrink together, rather than
// disappearing, when the host container is shorter than this.
const VOLUME_PANEL_HEIGHT = '200px';
const VOLUME_PANEL_MIN_HEIGHT = '100px';
const LOGS_PANEL_MIN_HEIGHT = '150px';
const BODY_MIN_HEIGHT = '250px';

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
  body: SceneFlexLayout;
  logsQueryRunner: SceneQueryRunner;
  volumeQueryRunner: SceneQueryRunner;
}

// Built from scratch: owns a datasource variable, a time range, the two query runners (logs +
// volume), and a volume-panel-on-top/logs-panel-below layout. No IndexScene/ServiceScene reuse.
export class EmbeddedLogsMiniScene extends SceneObjectBase<EmbeddedLogsMiniSceneState> {
  public constructor({ datasourceUid, query, timeRange }: EmbeddedLogsMiniSceneOptions) {
    const logsQueryRunner = new SceneQueryRunner({
      datasource: { uid: VAR_DATASOURCE_MINI_EXPR },
      queries: [buildLogsQuery(query)],
    });
    // Total log volume, broken down by level; grouping by other fields is a later, configurable step.
    const volumeQueryRunner = new SceneQueryRunner({
      datasource: { uid: VAR_DATASOURCE_MINI_EXPR },
      queries: [buildVolumeQuery(query)],
    });

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
      // No fixed total height: fills whatever the host container gives it, shrinking (or growing)
      // both panels together, down to minHeight floors rather than disappearing.
      body: new SceneFlexLayout({
        children: [
          new SceneFlexItem({
            body: buildVolumePanel(volumeQueryRunner),
            height: VOLUME_PANEL_HEIGHT,
            minHeight: VOLUME_PANEL_MIN_HEIGHT,
          }),
          new SceneFlexItem({ body: buildLogsPanel(logsQueryRunner), minHeight: LOGS_PANEL_MIN_HEIGHT }),
        ],
        direction: 'column',
        height: '100%',
        minHeight: BODY_MIN_HEIGHT,
      }),
      logsQueryRunner,
      volumeQueryRunner,
    });
  }

  public static Component = ({ model }: SceneComponentProps<EmbeddedLogsMiniScene>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}
