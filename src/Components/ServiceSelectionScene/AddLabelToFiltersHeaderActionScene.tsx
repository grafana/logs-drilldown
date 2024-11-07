import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { testIds } from '../../services/testIds';
import { addToFilters, FilterType } from '../ServiceScene/Breakdowns/AddToFiltersButton';
import { VAR_LABELS } from '../../services/variables';
import { getLabelsVariable } from '../../services/variableGetters';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import React from 'react';

export interface AddLabelToFiltersHeaderActionSceneState extends SceneObjectState {
  name: string;
  value: string;
}

export class AddLabelToFiltersHeaderActionScene extends SceneObjectBase<AddLabelToFiltersHeaderActionSceneState> {
  constructor(state: AddLabelToFiltersHeaderActionSceneState) {
    super({
      ...state,
    });
  }

  public static Component = ({ model }: SceneComponentProps<AddLabelToFiltersHeaderActionScene>) => {
    const { value } = model.useState();
    const isIncluded = false;
    const isExcluded = false;

    const styles = useStyles2(getStyles, isIncluded, isExcluded);
    return (
      <span className={styles.wrapper}>
        <Button
          tooltip={`Add ${value} to filters`}
          variant={isIncluded ? 'primary' : 'secondary'}
          fill={'outline'}
          icon={'plus'}
          size="sm"
          aria-selected={isIncluded}
          className={styles.includeButton}
          onClick={() => (isIncluded ? () => model.onClick('clear') : model.onClick('include'))}
          data-testid={testIds.exploreServiceDetails.buttonFilterInclude}
        />
      </span>
    );
  };

  public getFilter() {
    return { name: this.state.name, value: this.state.value };
  }

  public onClick = (type: FilterType) => {
    const filter = this.getFilter();
    if (!filter) {
      return;
    }

    addToFilters(filter.name, filter.value, type, this, VAR_LABELS);

    const variable = getLabelsVariable(this);
    reportAppInteraction(USER_EVENTS_PAGES.service_selection, USER_EVENTS_ACTIONS.service_selection.add_to_filters, {
      filterType: 'index-filters',
      key: filter.name,
      action: type,
      filtersLength: variable?.state.filters.length || 0,
    });
  };
}

const getStyles = (theme: GrafanaTheme2, isIncluded: boolean, isExcluded: boolean) => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'center',
    }),
    includeButton: css({
      borderRadius: 0,
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignSelf: 'center',
    }),
  };
};
