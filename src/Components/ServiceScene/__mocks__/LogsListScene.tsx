import React from 'react';

import { SceneComponentProps, SceneFlexLayout, SceneObjectBase } from '@grafana/scenes';

import { LogOptionsScene } from '../LogOptionsScene';
import { LogsListSceneState } from '../LogsListScene';

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      displayedFields: state.displayedFields ?? [],
      panel: new SceneFlexLayout({
        children: [
          new LogOptionsScene({
            onChangeVisualizationType: () => {},
            visualizationType: 'logs',
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
