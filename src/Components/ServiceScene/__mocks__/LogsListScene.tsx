import React from 'react';

import { SceneComponentProps, SceneFlexLayout, SceneObjectBase } from '@grafana/scenes';

import { LogOptionsButtonsScene } from '../LogOptionsButtonsScene';
import { LogOptionsScene } from '../LogOptionsScene';
import { LogsListSceneState } from '../LogsListScene';

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      displayedFields: state.displayedFields ?? [],
      otelDisplayedFields: state.otelDisplayedFields ?? [],
      userDisplayedFields: state.userDisplayedFields ?? false,
      controlsExpanded: false,
      panel: new SceneFlexLayout({
        children: [
          new LogOptionsScene({
            onChangeVisualizationType: () => {},
            visualizationType: 'logs',
            buttonRendererScene: new LogOptionsButtonsScene({}),
          }),
        ],
      }),
      visualizationType: 'logs',
    });
  }

  public updateLogsPanel = jest.fn();
  public setLogsVizOption = jest.fn();
  public clearDisplayedFields = jest.fn();

  public static Component = ({ model }: SceneComponentProps<LogsListScene>) => {
    const { panel } = model.useState();
    if (!panel) {
      return null;
    }
    return (
      <div>
        <panel.Component model={panel} />
      </div>
    );
  };
}
