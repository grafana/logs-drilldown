import React from 'react';

import { DataFrame } from '@grafana/data';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  sceneGraph,
  AdHocFiltersVariable,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
import { FilterButton } from 'Components/FilterButton';

export interface AddToFiltersButtonState extends SceneObjectState {
  frame: DataFrame;
  variableName: string;
}

type FilterType = 'include' | 'reset';

export class AddToFiltersButton extends SceneObjectBase<AddToFiltersButtonState> {
  public onClick = (type: FilterType) => {
    const variable = sceneGraph.lookupVariable(this.state.variableName, this);
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }

    const selectedFilter = getFilter(this.state.frame);
    if (!selectedFilter) {
      return;
    }

    // In a case filter is already there, remove it
    let filters = variable.state.filters.filter((f) => {
      return f.key !== selectedFilter.name && f.value !== selectedFilter.value;
    });

    // If type is include, then add the filter
    if (type === 'include') {
      filters = [
        ...filters,
        {
          key: selectedFilter.name,
          operator: '=',
          value: selectedFilter.value,
        },
      ];
    }

    variable.setState({
      filters,
      hide: VariableHide.hideLabel,
    });

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.add_to_filters_in_breakdown_clicked,
      {
        filterType: this.state.variableName,
        key: selectedFilter.name,
        action: filters.length === variable.state.filters.length ? 'added' : 'removed',
        filtersLength: variable.state.filters.length,
      }
    );
  };

  isIncluded = () => {
    const variable = sceneGraph.lookupVariable(this.state.variableName, this);
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }
    const filter = getFilter(this.state.frame);
    if (!filter) {
      return;
    }
    // Check if the filter is already there
    return variable.state.filters.some((f) => {
      return f.key === filter.name && f.value === filter.value;
    });
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersButton>) => {
    const isIncluded = model.isIncluded();
    return (
      <FilterButton
        isIncluded={!!isIncluded}
        onInclude={() => model.onClick('include')}
        onReset={() => model.onClick('reset')}
        onlyIncluded
      />
    );
  };
}

const getFilter = (frame: DataFrame) => {
  // current filter name and value is format {name: value}
  const filterNameAndValueObj = frame.fields[1]?.labels ?? {};
  // Sanity check - filter should have only one key-value pair
  if (Object.keys(filterNameAndValueObj).length !== 1) {
    return;
  }
  const name = Object.keys(filterNameAndValueObj)[0];
  const value = filterNameAndValueObj[name];
  return { name, value };
};
