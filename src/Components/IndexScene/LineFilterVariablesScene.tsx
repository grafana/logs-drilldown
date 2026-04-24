import React, { ChangeEvent, KeyboardEvent, useEffect } from 'react';

import { css } from '@emotion/css';
import { debounce } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdHocFilterWithLabels, SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';

import { LineFilterProps, LineFilterVariable } from './LineFilterVariable';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { LineFilterCaseSensitive, LineFilterOp } from 'services/filterTypes';
import { addCurrentUrlToHistory } from 'services/navigate';
import { getLineFilterCase, getLineFilterExclusive, getLineFilterRegex } from 'services/store';
import { testIds } from 'services/testIds';
import { getLineFiltersVariable } from 'services/variableGetters';

export const LINE_FILTER_VARIABLES_SCENE_KEY = 'line-filters-var-custom-renderer';

/**
 * Next unique numeric keyLabel: max existing + 1, so new rows never collide after deletes
 * (e.g. filters 0 and 2 ⇒ next is 3, not `String(length)` which could be "2").
 */
export function nextLineFilterKeyLabel(filters: AdHocFilterWithLabels[]): string {
  const max = filters.reduce((acc, f) => {
    const n = parseInt(f.keyLabel ?? '0', 10);
    return Number.isNaN(n) ? acc : Math.max(acc, n);
  }, -1);
  return String(max + 1);
}

interface LineFilterRendererState extends SceneObjectState {
  visible: boolean;
}

/**
 * Renders line filters in the control strip with the other variables.
 * Hidden until the service drilldown scene activates.
 */
export class LineFilterVariablesScene extends SceneObjectBase<LineFilterRendererState> {
  constructor(state?: Partial<LineFilterRendererState>) {
    super({ ...state, visible: false, key: LINE_FILTER_VARIABLES_SCENE_KEY });
  }

  static Component = ({ model }: SceneComponentProps<LineFilterVariablesScene>) => {
    const lineFilterVar = getLineFiltersVariable(model);
    const { filters } = lineFilterVar.useState();
    const { visible } = model.useState();
    const styles = useStyles2(getStyles);
    sortLineFilters(filters);

    useEffect(() => {
      if (visible && filters.length === 0) {
        model.ensureAtLeastOneEmptyLineFilter();
      }
    }, [visible, filters.length, model]);

    const lastFilter = filters.length > 0 ? filters[filters.length - 1] : undefined;
    const lastLineFilterFilled = lastFilter !== undefined && (lastFilter.value?.trim() ?? '').length > 0;
    const showAddLineFilterButton = lastLineFilterFilled;

    if (!visible) {
      return null;
    }

    return (
      <div className={styles.lineFiltersWrap}>
        {filters.map((filter, index) => (
          <LineFilterVariable
            key={filter.keyLabel}
            isFirstLineFilterRow={index === 0}
            onClick={() => model.removeFilter(filter)}
            props={getLineFilterPropsForRow(model, filter)}
          />
        ))}
        {showAddLineFilterButton && (
          <Button
            data-testid={testIds.variables.lineFilters.addButton}
            icon="plus"
            variant="secondary"
            onClick={() => model.addLineFilter()}
            tooltip={t(
              'components.index-scene.line-filter-variables-scene.aria-label-add-line-filter',
              'Add line filter'
            )}
            aria-label={t(
              'components.index-scene.line-filter-variables-scene.aria-label-add-line-filter',
              'Add line filter'
            )}
          />
        )}
      </div>
    );
  };

  /**
   * Append a new empty line filter.
   */
  addLineFilter = () => {
    addCurrentUrlToHistory();
    const variable = getLineFiltersVariable(this);
    const { key, operator } = this.getDefaultsForNewLineFilter();
    const keyLabel = nextLineFilterKeyLabel(variable.state.filters);
    variable.setState({
      filters: [...variable.state.filters, { key, keyLabel, operator, value: '' }],
    });
  };

  /**
   * Ensures the variable has one empty row so the UI always maps over `filters` (no orphan local state).
   */
  ensureAtLeastOneEmptyLineFilter = () => {
    const variable = getLineFiltersVariable(this);
    if (variable.state.filters.length > 0) {
      return;
    }
    addCurrentUrlToHistory();
    const { key, operator } = this.getDefaultsForNewLineFilter();
    variable.setState({
      filters: [{ key, keyLabel: nextLineFilterKeyLabel([]), operator, value: '' }],
    });
  };

  private getDefaultsForNewLineFilter = (): Pick<AdHocFilterWithLabels, 'key' | 'operator'> => {
    const caseSensitivePref = getLineFilterCase(false);
    const exclusive = getLineFilterExclusive(false);
    const regex = getLineFilterRegex(false);
    const key = caseSensitivePref ? LineFilterCaseSensitive.caseSensitive : LineFilterCaseSensitive.caseInsensitive;
    const operator = operatorFromFlags(regex, exclusive);
    return { key, operator };
  };

  /**
   * Submit on enter
   */
  handleEnter = (e: KeyboardEvent<HTMLInputElement>, lineFilter: string, filter: AdHocFilterWithLabels) => {
    if (e.key === 'Enter') {
      // Add the current url to browser history before the state is changed so the user can revert their change.
      addCurrentUrlToHistory();
      this.updateVariableLineFilter(filter, { ...filter, value: lineFilter });
    }
  };

  isFilterExclusive = ({ operator }: AdHocFilterWithLabels): boolean =>
    operator === LineFilterOp.negativeMatch || operator === LineFilterOp.negativeRegex;

  /**
   * Updates filter operator when user toggles regex
   */
  onRegexToggle = (filter: AdHocFilterWithLabels) => {
    let newOperator: LineFilterOp;
    // Set value to scene state
    switch (filter.operator) {
      case LineFilterOp.match: {
        newOperator = LineFilterOp.regex;
        break;
      }
      case LineFilterOp.negativeMatch: {
        newOperator = LineFilterOp.negativeRegex;
        break;
      }
      case LineFilterOp.regex: {
        newOperator = LineFilterOp.match;
        break;
      }
      case LineFilterOp.negativeRegex: {
        newOperator = LineFilterOp.negativeMatch;
        break;
      }
      default: {
        throw new Error('Invalid operator!');
      }
    }

    this.updateFilter(filter, { ...filter, operator: newOperator }, false);
  };

  /**
   * Updates filter operator when user toggles exclusion
   */
  onToggleExclusive = (filter: AdHocFilterWithLabels) => {
    let newOperator: string;
    switch (filter.operator) {
      case LineFilterOp.match: {
        newOperator = LineFilterOp.negativeMatch;
        break;
      }
      case LineFilterOp.negativeMatch: {
        newOperator = LineFilterOp.match;
        break;
      }
      case LineFilterOp.regex: {
        newOperator = LineFilterOp.negativeRegex;
        break;
      }
      case LineFilterOp.negativeRegex: {
        newOperator = LineFilterOp.regex;
        break;
      }
      default: {
        throw new Error('Invalid operator!');
      }
    }

    this.updateFilter(filter, { ...filter, operator: newOperator }, false);
  };

  /**
   * Updates filter key when user toggles case sensitivity
   */
  onCaseSensitiveToggle = (filter: AdHocFilterWithLabels) => {
    const caseSensitive =
      filter.key === LineFilterCaseSensitive.caseSensitive
        ? LineFilterCaseSensitive.caseInsensitive
        : LineFilterCaseSensitive.caseSensitive;
    this.updateFilter(filter, { ...filter, key: caseSensitive }, false);
  };

  /**
   * Updates existing line filter ad-hoc variable filter
   */
  updateFilter = (existingFilter: AdHocFilterWithLabels, filterUpdate: AdHocFilterWithLabels, debounced = true) => {
    if (debounced) {
      // We want to update the UI right away, which uses the filter state as the UI state, but we don't want to execute the query immediately
      this.updateVariableLineFilter(existingFilter, filterUpdate, true);
      // Run the debounce to force the event emit, as the prior setState will have already set the filterExpression, which will otherwise prevent the emit of the event which will trigger the query
      this.updateVariableDebounced(existingFilter, filterUpdate, false, true);
    } else {
      this.updateVariableLineFilter(existingFilter, filterUpdate);
    }
  };

  /**
   * Line filter input onChange helper method
   */
  onInputChange = (e: ChangeEvent<HTMLInputElement>, filter: AdHocFilterWithLabels) => {
    this.updateFilter(filter, { ...filter, value: e.target.value }, true);
  };

  /**
   * Remove a filter, will trigger query
   */
  removeFilter = (filter: AdHocFilterWithLabels) => {
    addCurrentUrlToHistory();
    const variable = getLineFiltersVariable(this);
    const otherFilters = variable.state.filters.filter(
      (f) => f.keyLabel !== undefined && f.keyLabel !== filter.keyLabel
    );

    if (otherFilters.length === 0) {
      const { key, operator } = this.getDefaultsForNewLineFilter();
      variable.setState({
        filters: [{ key, keyLabel: nextLineFilterKeyLabel([]), operator, value: '' }],
      });
    } else {
      variable.setState({
        filters: otherFilters,
      });
    }
  };

  /**
   * Update existing line filter ad-hoc variable
   */
  private updateVariableLineFilter = (
    existingFilter: AdHocFilterWithLabels,
    filterUpdate: AdHocFilterWithLabels,
    skipPublish = false,
    forcePublish = false
  ) => {
    const variable = getLineFiltersVariable(this);
    const otherFilters = variable.state.filters.filter(
      (f) => f.keyLabel !== undefined && f.keyLabel !== existingFilter.keyLabel
    );

    variable.updateFilters(
      [
        {
          key: filterUpdate.key,
          keyLabel: existingFilter.keyLabel,
          operator: filterUpdate.operator,
          value: filterUpdate.value,
        },
        ...otherFilters,
      ],
      { forcePublish, skipPublish }
    );

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.search_string_in_variables_changed,
      {
        caseSensitive: filterUpdate.key,
        containsLevel: (existingFilter.value ?? '').toLowerCase().includes('level'),
        operator: filterUpdate.operator,
        searchQueryLength: (existingFilter.value ?? '').length,
      }
    );
  };

  /**
   * Debounce line-filter ad-hoc variable update
   */
  private updateVariableDebounced = debounce(
    (
      existingFilter: AdHocFilterWithLabels,
      filterUpdate: AdHocFilterWithLabels,
      skipPublish = false,
      forcePublish = false
    ) => {
      this.updateVariableLineFilter(existingFilter, filterUpdate, skipPublish, forcePublish);
    },
    1000
  );
}

/**
 * Sort line filters by keyLabel, i.e. the order the line filter was added
 */
export const sortLineFilters = (filters: AdHocFilterWithLabels[]) => {
  filters.sort((a, b) => parseInt(a.keyLabel ?? '0', 10) - parseInt(b.keyLabel ?? '0', 10));
};

/**
 * Map regex and exclude toggles to the corresponding LineFilter operator.
 * Used for defaults and when bootstrapping an empty row.
 */
const operatorFromFlags = (regex: boolean, exclusive: boolean): LineFilterOp => {
  if (regex && exclusive) {
    return LineFilterOp.negativeRegex;
  }
  if (regex && !exclusive) {
    return LineFilterOp.regex;
  }
  if (!regex && exclusive) {
    return LineFilterOp.negativeMatch;
  }
  return LineFilterOp.match;
};

/**
 * Build LineFilterVariable props for one row in the control strip.
 * Wires the scene model and this filter from VAR_LINE_FILTERS.
 */
const getLineFilterPropsForRow = (model: LineFilterVariablesScene, filter: AdHocFilterWithLabels): LineFilterProps => ({
  caseSensitive: filter.key === LineFilterCaseSensitive.caseSensitive,
  exclusive: model.isFilterExclusive(filter),
  handleEnter: (e, lineFilter) => model.handleEnter(e, lineFilter, filter),
  lineFilter: filter.value,
  onCaseSensitiveToggle: () => model.onCaseSensitiveToggle(filter),
  onInputChange: (e) => model.onInputChange(e, filter),
  onRegexToggle: () => model.onRegexToggle(filter),
  regex: filter.operator === LineFilterOp.regex || filter.operator === LineFilterOp.negativeRegex,
  setExclusive: () => model.onToggleExclusive(filter),
  updateFilter: (lineFilterValue, debounced) =>
    model.updateFilter(
      filter,
      {
        ...filter,
        value: lineFilterValue,
      },
      debounced
    ),
});

const getStyles = (theme: GrafanaTheme2) => ({
  lineFiltersWrap: css({
    alignItems: 'flex-end',
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${theme.spacing(0.25)} ${theme.spacing(2)}`,
    label: 'lineFiltersWrap',
  }),
});
