import React from 'react';

import { urlUtil } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, sceneUtils } from '@grafana/scenes';
import { LinkButton } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { logger } from '../../services/logger';
import { ROUTES } from '../../services/routing';
import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getLineFiltersVariable,
  getMetadataVariable,
  getPatternsVariable,
} from '../../services/variableGetters';
import { getPrimaryLabelFromEmbeddedScene } from '../../services/variableHelpers';
import { IndexScene } from '../IndexScene/IndexScene';
import { ServiceScene } from '../ServiceScene/ServiceScene';

export class EmbeddedLinkScene extends SceneObjectBase {
  public static Component = ({ model }: SceneComponentProps<EmbeddedLinkScene>) => {
    const labelsVar = getLabelsVariable(model);
    const timeRange = sceneGraph.getTimeRange(model);

    // Rerender this scene whenever any dependent variables are updated
    // @todo how do we keep this up to date if new variables are added?
    const { filters: labelsVarFilters } = labelsVar.useState();
    getFieldsVariable(model).useState();
    getLevelsVariable(model).useState();
    getMetadataVariable(model).useState();
    getLineFiltersVariable(model).useState();
    getPatternsVariable(model).useState();
    timeRange.useState();

    const indexScene = sceneGraph.getAncestor(model, IndexScene);
    const serviceScene = indexScene.getContentScene();
    if (!(serviceScene instanceof ServiceScene) || !serviceScene.state.embedded) {
      logger.error(new Error('Service scene does not exist, or is not embedded!'));
      return null;
    }
    const params = sceneUtils.getUrlState(indexScene);

    // The link to breakdown cannot be created without labels
    // Alternatively we could build a link to ServiceSelectionScene
    if (labelsVarFilters.length === 0) {
      return null;
    }

    const { labelName, labelValue } = getPrimaryLabelFromEmbeddedScene(serviceScene, labelsVar);

    return (
      <LinkButton
        onClick={() => {
          reportAppInteraction(
            USER_EVENTS_PAGES.service_details,
            USER_EVENTS_ACTIONS.service_details.embedded_go_to_explore_clicked
          );
        }}
        href={urlUtil.renderUrl(ROUTES.logs(labelValue, labelName), params)}
        variant="secondary"
        icon="arrow-right"
      >
        Logs Drilldown
      </LinkButton>
    );
  };
}
