import React from 'react';

import { SceneComponentProps, SceneFlexLayout, SceneObjectBase } from '@grafana/scenes';

import { LineLimitScene } from 'Components/ServiceScene/LineLimitScene';
import { LogOptionsButtonsScene } from 'Components/ServiceScene/LogOptionsButtonsScene';
import { LogOptionsScene } from 'Components/ServiceScene/LogOptionsScene';
import { LogsListSceneState } from 'Components/ServiceScene/LogsListScene';

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      displayedFields: state.displayedFields ?? [],
      otelDisplayedFields: state.otelDisplayedFields ?? [],
      userDisplayedFields: state.userDisplayedFields ?? false,
      controlsExpanded: false,
      headerHeight: 48,
      panel: new SceneFlexLayout({
        children: [
          new LogOptionsScene({
            buttonRendererScene: new LogOptionsButtonsScene({}),
            lineLimitScene: new LineLimitScene({}),
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
