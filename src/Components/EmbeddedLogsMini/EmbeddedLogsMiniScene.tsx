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

import { buildLogsPanel, buildTablePanel, buildVolumePanel } from './panels';
import { buildLogsQuery, buildVolumeQuery } from './queries';
import { EmbeddedLogsMiniLogsOptions, EmbeddedLogsMiniVisualizationType } from './types';
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
  logsOptions?: EmbeddedLogsMiniLogsOptions;
  query: string;
  showLogsPanel?: boolean;
  showLogsVolume?: boolean;
  timeRange?: TimeRange;
  visualizationType?: EmbeddedLogsMiniVisualizationType;
}

export interface EmbeddedLogsMiniSceneState extends SceneObjectState {
  body: SceneFlexLayout;
}

// Built from scratch: owns a datasource variable, a time range, the query runner(s), and a
// volume-panel-on-top (optional)/content-panel-below layout. No IndexScene/ServiceScene reuse.
export class EmbeddedLogsMiniScene extends SceneObjectBase<EmbeddedLogsMiniSceneState> {
  public constructor({
    datasourceUid,
    logsOptions,
    query,
    showLogsPanel = true,
    showLogsVolume = true,
    timeRange,
    visualizationType = 'logs',
  }: EmbeddedLogsMiniSceneOptions) {
    // Never render nothing: if both panels are turned off, fall back to the logs panel.
    const renderLogsPanel = showLogsPanel || !showLogsVolume;

    // Total log volume, broken down by level; grouping by other fields is a later, configurable step.
    // Skipped entirely (no query, no panel) when the caller doesn't want it.
    const volumeQueryRunner = showLogsVolume
      ? new SceneQueryRunner({
          datasource: { uid: VAR_DATASOURCE_MINI_EXPR },
          queries: [buildVolumeQuery(query)],
        })
      : undefined;

    const bodyChildren: SceneFlexItem[] = [];
    if (volumeQueryRunner) {
      bodyChildren.push(
        new SceneFlexItem({
          body: buildVolumePanel(volumeQueryRunner),
          minHeight: VOLUME_PANEL_MIN_HEIGHT,
          // Only pin the volume panel to its preferred size when it shares the layout with the
          // logs panel; alone, it should fill the whole body.
          ...(renderLogsPanel ? { height: VOLUME_PANEL_HEIGHT } : {}),
        })
      );
    }
    if (renderLogsPanel) {
      const logsQueryRunner = new SceneQueryRunner({
        datasource: { uid: VAR_DATASOURCE_MINI_EXPR },
        queries: [buildLogsQuery(query)],
      });
      // logsOptions only applies to the logs view; the table view has no exposed options yet and
      // always uses buildTablePanel's own good defaults.
      const contentPanel =
        visualizationType === 'table' ? buildTablePanel(logsQueryRunner) : buildLogsPanel(logsQueryRunner, logsOptions);
      bodyChildren.push(new SceneFlexItem({ body: contentPanel, minHeight: LOGS_PANEL_MIN_HEIGHT }));
    }

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
      // the panels together, down to minHeight floors rather than disappearing.
      body: new SceneFlexLayout({
        children: bodyChildren,
        direction: 'column',
        height: '100%',
        minHeight: BODY_MIN_HEIGHT,
      }),
    });
  }

  public static Component = ({ model }: SceneComponentProps<EmbeddedLogsMiniScene>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}
