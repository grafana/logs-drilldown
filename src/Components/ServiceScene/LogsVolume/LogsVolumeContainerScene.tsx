import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { InsightsWidgetScene } from './InsightsWidgetScene';
import { LogsVolumePanel } from './LogsVolumePanel';

export interface LogsVolumeContainerSceneState extends SceneObjectState {
  body?: SceneFlexLayout;
}

export class LogsVolumeContainerScene extends SceneObjectBase<LogsVolumeContainerSceneState> {
  constructor(state: LogsVolumeContainerSceneState) {
    super(state);
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.setState({
      body: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            body: new LogsVolumePanel({}),
          }),
          new SceneFlexItem({
            body: new InsightsWidgetScene({}),
            height: 'auto',
            minHeight: 'auto',
          }),
        ],
      }),
    });
  }
  public static Component = ({ model }: SceneComponentProps<LogsVolumeContainerScene>) => {
    const { body } = model.useState();
    const styles = useStyles2(getStyles);

    if (body) {
      return <div className={styles.container}>{body && <body.Component model={body} />}</div>;
    }

    return null;
  };
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      // Override flex layout styles
      '> div': {
        gap: 0,
      },

      // Override panel border styles

      section: {
        borderColor: 'transparent',
      },
      label: 'logs-volume-container',
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
  };
};
