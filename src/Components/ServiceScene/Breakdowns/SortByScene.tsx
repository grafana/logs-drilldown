import React from 'react';

import { BusEventBase, DataFrame, FieldReducerInfo, fieldReducers, ReducerID, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { InlineField, Select } from '@grafana/ui';

import { getLabelValueFromDataFrame } from 'services/levels';
import {
  DEFAULT_SORT_BY,
  DEFAULT_SORT_DIRECTION,
  getDefaultSortBy,
  isWasmInit,
  SORT_BY_OUTLIERS,
  SortBy,
} from 'services/sorting';
import { getSortByPreference, setSortByPreference } from 'services/store';
import { testIds } from 'services/testIds';

export type SortDirection = 'asc' | 'desc';
export interface SortBySceneState extends SceneObjectState {
  direction: SortDirection;
  sortBy: SortBy;
  target: 'fields' | 'labels';
}

export class SortCriteriaChanged extends BusEventBase {
  constructor(
    public target: 'fields' | 'labels',
    public sortBy: string,
    public direction: string
  ) {
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
          description: t(
            'components.sort-by-scene.description.smart-ordering',
            'Smart ordering of graphs based on the most significant spikes in the data'
          ),
          label: t('components.sort-by-scene.label.most-relevant', 'Most relevant'),
          value: DEFAULT_SORT_BY,
        },
        {
          description: t(
            'components.sort-by-scene.description.order-amount-outlying-values',
            'Order by the amount of outlying values in the data'
          ),
          label: t('components.sort-by-scene.label.outlying-values', 'Outlying values'),
          value: SORT_BY_OUTLIERS,
        },
        {
          description: t(
            'components.sort-by-scene.description.graphs-deviation-average-value',
            'Sort graphs by deviation from the average value'
          ),
          label: t('components.sort-by-scene.label.widest-spread', 'Widest spread'),
          value: ReducerID.stdDev,
        },
        {
          description: t('components.sort-by-scene.description.alphabetical-order', 'Alphabetical order'),
          label: t('components.sort-by-scene.label.name', 'Name'),
          value: 'alphabetical',
        },
        {
          description: t(
            'components.sort-by-scene.description.graphs-total-number',
            'Sort graphs by total number of logs'
          ),
          label: t('components.sort-by-scene.label.count', 'Count'),
          value: ReducerID.sum,
        },
        {
          description: t(
            'components.sort-by-scene.description.graphs-highest-values',
            'Sort graphs by the highest values (max)'
          ),
          label: t('components.sort-by-scene.label.highest-spike', 'Highest spike'),
          value: ReducerID.max,
        },
        {
          description: t(
            'components.sort-by-scene.description.graphs-smallest-values',
            'Sort graphs by the smallest values (min)'
          ),
          label: t('components.sort-by-scene.label.lowest-dip', 'Lowest dip'),
          value: ReducerID.min,
        },
      ],
    },
    {
      label: t('components.sort-by-scene.label.percentiles', 'Percentiles'),
      options: [...fieldReducers.selectOptions([], filterReducerOptions).options],
    },
  ];

  constructor(state: Pick<SortBySceneState, 'target'>) {
    const defaultSortBy = getDefaultSortBy();
    const { direction, sortBy } = getSortByPreference(state.target, defaultSortBy, DEFAULT_SORT_DIRECTION);
    const finalSortBy: SortBy =
      (sortBy === DEFAULT_SORT_BY || sortBy === SORT_BY_OUTLIERS) && !isWasmInit() ? defaultSortBy : sortBy;
    super({
      direction,
      sortBy: finalSortBy,
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
    const wasmInit = isWasmInit();
    const defaultOptions = wasmInit
      ? model.sortingOptions
      : model.sortingOptions.map((group) => ({
          ...group,
          options: group.options.filter(
            (opt: SelectableValue<SortBy>) => opt.value !== DEFAULT_SORT_BY && opt.value !== SORT_BY_OUTLIERS
          ),
        }));
    const group = defaultOptions.find((g) =>
      g.options.find((option: SelectableValue<SortBy>) => option.value === sortBy)
    );
    const sortByValue: SelectableValue<SortBy> | undefined = group?.options.find(
      (option: SelectableValue<SortBy>) => option.value === sortBy
    );
    return (
      <>
        <InlineField
          label={t('components.sort-by-scene.label-sort-by', 'Sort by')}
          htmlFor="sort-by-criteria"
          tooltip={t(
            'components.sort-by-scene.tooltip-sort-by',
            'Calculate a derived quantity from the values in your time series and sort by this criteria. Defaults to standard deviation.'
          )}
        >
          <Select
            data-testid={testIds.breakdowns.common.sortByFunction}
            value={sortByValue}
            width={20}
            isSearchable={true}
            options={defaultOptions}
            placeholder={t('components.sort-by-scene.placeholder-choose-criteria', 'Choose criteria')}
            onChange={model.onCriteriaChange}
            inputId="sort-by-criteria"
          />
        </InlineField>
        <InlineField>
          <Select
            data-testid={testIds.breakdowns.common.sortByDirection}
            onChange={model.onDirectionChange}
            aria-label={t('components.sort-by-scene.aria-label-sort-direction', 'Sort direction')}
            placeholder=""
            value={direction}
            options={[
              {
                label: t('components.sort-by-scene.label.asc', 'Asc'),
                value: 'asc',
              },
              {
                label: t('components.sort-by-scene.label.desc', 'Desc'),
                value: DEFAULT_SORT_DIRECTION,
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
