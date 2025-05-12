import React from 'react';

import { BusEventBase, DataFrame, FieldReducerInfo, fieldReducers, ReducerID, SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { InlineField, Select } from '@grafana/ui';

import { DEFAULT_SORT_BY } from '../../../services/sorting';
import { testIds } from '../../../services/testIds';
import { getLabelValueFromDataFrame } from 'services/levels';
import { getSortByPreference, setSortByPreference } from 'services/store';

export type SortBy = 'changepoint' | 'outliers' | ReducerID | '';
export type SortDirection = 'asc' | 'desc';
export interface SortBySceneState extends SceneObjectState {
  direction: SortDirection;
  sortBy: SortBy;
  target: 'fields' | 'labels';
}

export class SortCriteriaChanged extends BusEventBase {
  constructor(public target: 'fields' | 'labels', public sortBy: string, public direction: string) {
    super();
  }
  public static type = 'sort-criteria-changed';
}

export class SortByScene extends SceneObjectBase<SortBySceneState> {
  public sortingOptions: Array<{ label: string; options: SelectableValue<SortBy> }> = [
    {
      label: '',
      options: [
        {
          description: 'Smart ordering of graphs based on the most significant spikes in the data',
          label: 'Most relevant',
          value: 'changepoint',
        },
        {
          description: 'Order by the amount of outlying values in the data',
          label: 'Outlying values',
          value: 'outliers',
        },
        {
          description: 'Sort graphs by deviation from the average value',
          label: 'Widest spread',
          value: ReducerID.stdDev,
        },
        {
          description: 'Alphabetical order',
          label: 'Name',
          value: 'alphabetical',
        },
        {
          description: 'Sort graphs by total number of logs',
          label: 'Count',
          value: ReducerID.sum,
        },
        {
          description: 'Sort graphs by the highest values (max)',
          label: 'Highest spike',
          value: ReducerID.max,
        },
        {
          description: 'Sort graphs by the smallest values (min)',
          label: 'Lowest dip',
          value: ReducerID.min,
        },
      ],
    },
    {
      label: 'Percentiles',
      options: [...fieldReducers.selectOptions([], filterReducerOptions).options],
    },
  ];

  constructor(state: Pick<SortBySceneState, 'target'>) {
    const { direction, sortBy } = getSortByPreference(state.target, DEFAULT_SORT_BY, 'desc');
    super({
      direction,
      sortBy,
      target: state.target,
    });
  }

  public onCriteriaChange = (criteria: SelectableValue<SortBy>) => {
    if (!criteria.value) {
      return;
    }
    this.setState({ sortBy: criteria.value });
    setSortByPreference(this.state.target, criteria.value, this.state.direction);
    this.publishEvent(new SortCriteriaChanged(this.state.target, criteria.value, this.state.direction), true);
  };

  public onDirectionChange = (direction: SelectableValue<SortDirection>) => {
    if (!direction.value) {
      return;
    }
    this.setState({ direction: direction.value });
    setSortByPreference(this.state.target, this.state.sortBy, direction.value);
    this.publishEvent(new SortCriteriaChanged(this.state.target, this.state.sortBy, direction.value), true);
  };

  public static Component = ({ model }: SceneComponentProps<SortByScene>) => {
    const { direction, sortBy } = model.useState();
    const group = model.sortingOptions.find((group) =>
      group.options.find((option: SelectableValue<SortBy>) => option.value === sortBy)
    );
    const sortByValue: SelectableValue<SortBy> | undefined = group?.options.find(
      (option: SelectableValue<SortBy>) => option.value === sortBy
    );
    return (
      <>
        <InlineField
          label="Sort by"
          htmlFor="sort-by-criteria"
          tooltip="Calculate a derived quantity from the values in your time series and sort by this criteria. Defaults to standard deviation."
        >
          <Select
            data-testid={testIds.breakdowns.common.sortByFunction}
            value={sortByValue}
            width={20}
            isSearchable={true}
            options={model.sortingOptions}
            placeholder={'Choose criteria'}
            onChange={model.onCriteriaChange}
            inputId="sort-by-criteria"
          />
        </InlineField>
        <InlineField>
          <Select
            data-testid={testIds.breakdowns.common.sortByDirection}
            onChange={model.onDirectionChange}
            aria-label="Sort direction"
            placeholder=""
            value={direction}
            options={[
              {
                label: 'Asc',
                value: 'asc',
              },
              {
                label: 'Desc',
                value: 'desc',
              },
            ]}
          ></Select>
        </InlineField>
      </>
    );
  };
}

const ENABLED_PERCENTILES = ['p10', 'p25', 'p75', 'p90', 'p99'];
function filterReducerOptions(ext: FieldReducerInfo) {
  if (ext.id >= 'p1' && ext.id <= 'p99') {
    return ENABLED_PERCENTILES.includes(ext.id);
  }
  return false;
}

export function getLabelValue(frame: DataFrame) {
  return getLabelValueFromDataFrame(frame) ?? 'No labels';
}
