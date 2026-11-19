import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { LogsFieldExtremesPanel } from './LogsFieldExtremesPanel';
import { LogsVolumePanel } from './LogsVolumePanel';
import { ChangeLogsVolumeViewEvent, LogsVolumeView, LogsVolumeViewSwitch } from './LogsVolumeViewSwitch';
import { ServiceScene } from 'Components/ServiceScene/ServiceScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { syncLogsListPanelHeightFromScene } from 'services/scenes';

export interface LogsVolumeContainerSceneState extends SceneObjectState {
  body?: SceneFlexLayout;
  extremes?: LogsFieldExtremesPanel;
  view: LogsVolumeView;
}

export class LogsVolumeContainerScene extends SceneObjectBase<LogsVolumeContainerSceneState> {
  constructor(state: Partial<LogsVolumeContainerSceneState>) {
    super({ view: 'volume', ...state });
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onViewChange(view: LogsVolumeView) {
    if (view === this.state.view) {
      return;
    }
    if (view !== 'volume') {
      if (this.state.extremes) {
        this.state.extremes.setAggregation(view);
      } else {
        this.setState({ extremes: new LogsFieldExtremesPanel({ aggregation: view }) });
      }
    }
    this.setState({ view });
    sceneGraph
      .findAllObjects(this, (obj) => obj instanceof LogsVolumeViewSwitch)
      .forEach((viewSwitch) => {
        if (viewSwitch instanceof LogsVolumeViewSwitch) {
          viewSwitch.setState({ view });
        }
      });
    syncLogsListPanelHeightFromScene(sceneGraph.getAncestor(this, ServiceScene));
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_volume_view_changed,
      {
        view,
      }
    );
  }

  private onActivate() {
    this._subs.add(this.subscribeToEvent(ChangeLogsVolumeViewEvent, (event) => this.onViewChange(event.view)));

    this.setState({
      body: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            body: new LogsVolumePanel({}),
          }),
        ],
      }),
    });
  }
  public static Component = ({ model }: SceneComponentProps<LogsVolumeContainerScene>) => {
    const { body, extremes, view } = model.useState();
    const styles = useStyles2(getStyles);

    if (body) {
      return (
        <div className={styles.container}>
          {/* The volume stays mounted so its query and the levels it feeds keep updating. */}
          <div className={view === 'volume' ? undefined : styles.hidden}>
            <body.Component model={body} />
          </div>
          {view !== 'volume' && extremes && <extremes.Component model={extremes} />}
        </div>
      );
    }

    return null;
  };
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    hidden: css({ display: 'none' }),
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
