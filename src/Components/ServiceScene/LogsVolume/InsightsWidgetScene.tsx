import React from 'react';

import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { isOperatorInclusive } from '../../../services/operatorHelpers';
import { getLabelsVariable } from '../../../services/variableGetters';
import { SERVICE_NAME } from '../../../services/variables';
import { InsightsTimelineWidget } from '../../AddedComponents/InsightsTimelineWidget';
import { LogsVolumeContainerScene } from './LogsVolumeContainerScene';
import { LogsVolumePanel } from './LogsVolumePanel';

interface InsightsWidgetSceneState extends SceneObjectState {
  collapsed: boolean;
}
export class InsightsWidgetScene extends SceneObjectBase<InsightsWidgetSceneState> {
  constructor(state: Partial<InsightsWidgetSceneState>) {
    super({ ...state, collapsed: false });
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const logsVolumeContainer = sceneGraph.getAncestor(this, LogsVolumeContainerScene);
    const logsVolumePanel = sceneGraph.findAllObjects(
      logsVolumeContainer,
      (scene) => scene instanceof LogsVolumePanel
    )[0];

    if (logsVolumePanel instanceof LogsVolumePanel) {
      this.setState({ collapsed: logsVolumePanel.state.panel?.state.collapsed });
      this._subs.add(
        logsVolumePanel.state.panel?.subscribeToState((newState) => {
          if (newState.collapsed !== this.state.collapsed) {
            this.setState({ collapsed: newState.collapsed });
          }
        })
      );
    }
  }

  public static Component = ({ model }: SceneComponentProps<InsightsWidgetScene>) => {
    const { collapsed } = model.useState();
    const labelsVar = getLabelsVariable(model);
    const { filters } = labelsVar.useState();
    const serviceNameFilter = filters.find(
      (filter) => isOperatorInclusive(filter.operator) && filter.key === SERVICE_NAME
    );
    const serviceName = serviceNameFilter?.value;

    if (serviceName && !collapsed) {
      return <InsightsTimelineWidget serviceName={serviceName} model={model} />;
    }

    return null;
  };
}
