import React, { ReactElement } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { sceneGraph, SceneObject } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

export type AssertionSeverity = 'critical' | 'info' | 'warning';

interface InsightsTimelineWidgetProps {
  end: string | number;
  filterBySeverity?: AssertionSeverity[];
  filterBySummaryKeywords?: string[];
  label?: ReactElement;
  serviceName: string;
  start: string | number;
}

interface Props {
  model: SceneObject;
  serviceName: string;
}

export function InsightsTimelineWidget({ serviceName, model }: Props) {
  const { isLoading, component: InsightsTimelineWidgetExternal } = usePluginComponent<InsightsTimelineWidgetProps>(
    'grafana-asserts-app/insights-timeline-widget/v1'
  );
  const styles = useStyles2(getStyles);
  const sceneTimeRange = sceneGraph.getTimeRange(model).useState();

  if (isLoading || !InsightsTimelineWidgetExternal || !sceneTimeRange || !serviceName) {
    return null;
  }

  return (
    <div className={styles.container}>
      <InsightsTimelineWidgetExternal
        serviceName={serviceName}
        start={sceneTimeRange.from.valueOf()}
        end={sceneTimeRange.to.valueOf()}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      label: 'insights-timeline-widget',
      marginLeft: '15px',
    }),
    // label: css({
    //   fontSize: '12px',
    //   color: theme.colors.text.secondary,
    //   marginTop: '-3px',
    // }),
  };
}
