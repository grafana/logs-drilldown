import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { isOperatorInclusive } from '../../services/operatorHelpers';
import { getLabelsVariable } from '../../services/variableGetters';
import { SERVICE_NAME } from '../../services/variables';
import { InsightsTimelineWidget } from '../AddedComponents/InsightsTimelineWidget';

interface InsightsWidgetSceneState extends SceneObjectState {}
export class InsightsWidgetScene extends SceneObjectBase<InsightsWidgetSceneState> {
  constructor(state: InsightsWidgetSceneState) {
    super(state);
  }

  public static Component = ({ model }: SceneComponentProps<InsightsWidgetScene>) => {
    const labelsVar = getLabelsVariable(model);
    const serviceNameFilter = labelsVar.state.filters.find(
      (filter) => isOperatorInclusive(filter.operator) && filter.key === SERVICE_NAME
    );
    const serviceName = serviceNameFilter?.value;

    return <InsightsTimelineWidget serviceName={serviceName ?? 'frontend-proxy'} model={model} />;
  };
}
