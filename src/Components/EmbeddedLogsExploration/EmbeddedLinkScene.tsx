import React from 'react';

import { SceneComponentProps, sceneGraph, SceneObjectBase } from '@grafana/scenes';
import { LinkButton } from '@grafana/ui';

import { getOpenInDrilldownURL } from '../../services/extensions/links';
import {
  getDataSourceVariable,
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getLineFiltersVariable,
  getMetadataVariable,
  getPatternsVariable,
} from '../../services/variableGetters';
import { LOG_STREAM_SELECTOR_EXPR } from '../../services/variables';

export class EmbeddedLinkScene extends SceneObjectBase {
  public static Component = ({ model }: SceneComponentProps<EmbeddedLinkScene>) => {
    const labelsVar = getLabelsVariable(model);
    labelsVar.useState();
    getFieldsVariable(model).useState();
    getLevelsVariable(model).useState();
    getMetadataVariable(model).useState();
    getLineFiltersVariable(model).useState();
    getPatternsVariable(model).useState();
    const dataSourceVariable = getDataSourceVariable(model);
    const queryExpr = sceneGraph.interpolate(model, LOG_STREAM_SELECTOR_EXPR);
    const timeRange = sceneGraph.getTimeRange(model);

    return (
      <LinkButton
        href={getOpenInDrilldownURL(dataSourceVariable, queryExpr, labelsVar, timeRange)}
        variant="secondary"
        icon="arrow-right"
      >
        Logs Drilldown
      </LinkButton>
    );
  };
}
