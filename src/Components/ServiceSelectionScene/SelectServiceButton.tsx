import React from 'react';

import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getDrillDownIndexLink, pushUrlHandler } from '../../services/navigate';
import { getLabelsVariable } from '../../services/variableGetters';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { SERVICE_NAME, SERVICE_UI_LABEL } from '../../services/variables';
import { FilterOp } from '../../services/filterTypes';
import { testIds } from '../../services/testIds';
import { addToFavorites } from '../../services/favorites';

export interface SelectServiceButtonState extends SceneObjectState {
  labelValue: string;
  labelName: string;
  hidden?: boolean;
}

export class SelectServiceButton extends SceneObjectBase<SelectServiceButtonState> {
  constructor(state: SelectServiceButtonState) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }
  onActivate() {
    const labelsVar = getLabelsVariable(this);
    this.setState({ hidden: labelsVar.state.filters.length > 0 });
    labelsVar.subscribeToState((newState) => {
      this.setState({ hidden: newState.filters.length > 0 });
    });
  }

  public getLink = () => {
    if (!this.state.labelValue) {
      return;
    }

    return getLabelDrilldownLink(this.state.labelName, this.state.labelValue, this);
  };

  public onClick = () => {
    selectLabel(this.state.labelName, this.state.labelValue, this);
  };

  public static Component = ({ model }: SceneComponentProps<SelectServiceButton>) => {
    const styles = useStyles2(getStyles);
    const labels = getLabelsVariable(model);
    // Re-render links on label filter changes
    labels.useState();
    const { hidden } = model.useState();
    if (hidden) {
      return null;
    }
    const link = model.getLink();
    return (
      <LinkButton
        data-testid={testIds.index.selectServiceButton}
        tooltip={`View logs for ${model.state.labelValue}`}
        className={styles.button}
        variant={'primary'}
        fill={'outline'}
        size="sm"
        disabled={!link}
        href={model.getLink()}
        onClick={model.onClick}
      >
        Show logs
      </LinkButton>
    );
  };
}

/**
 * Select label tracking and add to favorites
 */
function selectLabel(primaryLabelName: string, primaryLabelValue: string, sceneRef: SceneObject) {
  reportAppInteraction(USER_EVENTS_PAGES.service_selection, USER_EVENTS_ACTIONS.service_selection.service_selected, {
    value: primaryLabelValue,
    label: primaryLabelName,
  });

  addToFavorites(primaryLabelName, primaryLabelValue, sceneRef);
}

/**
 * Builds label drilldown link
 */
export function getLabelDrilldownLink(primaryLabelName: string, primaryLabelValue: string, sceneRef: SceneObject) {
  const variable = getLabelsVariable(sceneRef);

  const filteredFilters = variable.state.filters.filter(
    (f) => !(f.key === primaryLabelName && f.value === primaryLabelValue)
  );

  const filters = [
    ...filteredFilters,
    {
      key: primaryLabelName,
      operator: FilterOp.Equal,
      value: primaryLabelValue,
    },
  ];

  if (primaryLabelName === SERVICE_NAME) {
    primaryLabelName = SERVICE_UI_LABEL;
  }

  const clonedVar = variable.clone({ filters });

  // In this case, we don't have a ServiceScene created yet, so we call a special function to navigate there for the first time
  return getDrillDownIndexLink(primaryLabelName, primaryLabelValue, clonedVar.urlSync?.getUrlState());
}

/**
 * Navigates to drilldown
 */
export function goToLabelDrillDownLink(primaryLabelName: string, primaryLabelValue: string, sceneRef: SceneObject) {
  const link = getLabelDrilldownLink(primaryLabelName, primaryLabelValue, sceneRef);
  selectLabel(primaryLabelName, primaryLabelValue, sceneRef);
  pushUrlHandler(link);
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      alignSelf: 'center',
    }),
  };
}
