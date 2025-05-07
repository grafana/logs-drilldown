import React from 'react';

import { css } from '@emotion/css';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { FilterOp } from '../../services/filterTypes';
import { testIds } from '../../services/testIds';
import { getLabelsVariable, getValueFromAdHocVariableFilter } from '../../services/variableGetters';
import { VAR_LABELS } from '../../services/variables';
import { addToFilters, FilterType } from '../ServiceScene/Breakdowns/AddToFiltersButton';

export interface AddLabelToFiltersHeaderActionSceneState extends SceneObjectState {
  included: boolean | null;
  name: string;
  value: string;
}

export class AddLabelToFiltersHeaderActionScene extends SceneObjectBase<AddLabelToFiltersHeaderActionSceneState> {
  constructor(state: Omit<AddLabelToFiltersHeaderActionSceneState, 'included'>) {
    super({
      ...state,
      included: null,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    this.setState({ ...this.isSelected() });
    this._subs.add(
      getLabelsVariable(this).subscribeToState(() => {
        const selected = this.isSelected();
        if (this.state.included !== selected.included) {
          this.setState({ ...selected });
        }
      })
    );
  }

  isSelected = () => {
    const variable = getLabelsVariable(this);

    // Check if the filter is already there
    const filterInSelectedFilters = variable.state.filters.find((f) => {
      const value = getValueFromAdHocVariableFilter(VAR_LABELS, f);
      return f.key === this.state.name && value.value === this.state.value;
    });

    if (!filterInSelectedFilters) {
      return { included: false };
    }

    // @todo support regex operator
    return {
      included: filterInSelectedFilters.operator === FilterOp.Equal,
    };
  };

  public static Component = ({ model }: SceneComponentProps<AddLabelToFiltersHeaderActionScene>) => {
    const { included, value } = model.useState();

    const styles = useStyles2(getStyles);
    return (
      <span className={styles.wrapper}>
        <Button
          tooltip={included === true ? `Remove ${value} from filters` : `Add ${value} to filters`}
          variant={'secondary'}
          fill={'outline'}
          size="sm"
          aria-selected={included === true}
          className={styles.includeButton}
          onClick={() => (included === true ? model.onClick('clear') : model.onClick('include'))}
          data-testid={testIds.exploreServiceDetails.buttonFilterInclude}
        >
          {included ? 'Remove' : 'Include'}
        </Button>
      </span>
    );
  };

  public getFilter() {
    return { name: this.state.name, value: this.state.value };
  }

  public onClick = (type: FilterType) => {
    const filter = this.getFilter();

    addToFilters(filter.name, filter.value, type, this, VAR_LABELS);

    const variable = getLabelsVariable(this);
    reportAppInteraction(USER_EVENTS_PAGES.service_selection, USER_EVENTS_ACTIONS.service_selection.add_to_filters, {
      action: type,
      filtersLength: variable?.state.filters.length || 0,
      filterType: 'index-filters',
      key: filter.name,
    });

    this.setState({ ...this.isSelected() });
  };
}

const getStyles = () => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'center',
    }),
    includeButton: css({
      borderRadius: 0,
    }),
    wrapper: css({
      alignSelf: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }),
  };
};
