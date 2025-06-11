import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';

import { areArraysEqual } from './comparison';
import { addFiltersToSet, getFilterSetKey } from './variableHelpers';

export interface ReadOnlyAdHocFiltersVariableProps extends Partial<AdHocFiltersVariable['state']> {
  readonlyFilters?: AdHocFilterWithLabels[];
}

// @todo - can we fix readonly filters persisting upstream in scenes instead of extending the AdHocFiltersVariable?
export class ReadOnlyAdHocFiltersVariable extends AdHocFiltersVariable {
  private readonly readonlyFilters?: AdHocFilterWithLabels[];

  constructor(props: ReadOnlyAdHocFiltersVariableProps) {
    const { readonlyFilters, ...state } = props;
    super({ filters: readonlyFilters, ...state });

    this.readonlyFilters = readonlyFilters;

    this.subscribeToState((newState, prevState) => {
      if (this.readonlyFilters?.length && !areArraysEqual(newState.filters, prevState.filters)) {
        this.addReadonlyFilters(newState);
        this.setReadOnlyFilters(newState);
      }
    });
  }

  /**
   * Sets readonly and origin flags on filters exactly matching the read only filters, that don't have the flags set.
   */
  private setReadOnlyFilters = (newState: AdHocFiltersVariable['state']) => {
    let hasChanges = false;
    const updatedFilters = newState.filters.map((filter) => {
      // Check if this filter matches any of the initial filters
      const matchingInitialFilter = this.readonlyFilters?.find(
        (initialFilter) =>
          initialFilter.key === filter.key &&
          initialFilter.operator === filter.operator &&
          initialFilter.value === filter.value &&
          initialFilter.readOnly !== filter.readOnly &&
          initialFilter.origin !== filter.origin
      );

      if (matchingInitialFilter) {
        hasChanges = true;
        return {
          ...filter,
          origin: matchingInitialFilter.origin,
          readOnly: matchingInitialFilter.readOnly,
        };
      }

      return filter;
    });

    // Only update if there are actual changes
    if (hasChanges) {
      this.setState({ filters: updatedFilters });
    }
  };

  /**
   * If the user managed to remove the read only filters, let's add them back in
   */
  private addReadonlyFilters = (newState: AdHocFiltersVariable['state']) => {
    if (this.readonlyFilters?.length) {
      const filterSet = new Set<string>();
      addFiltersToSet(newState.filters, filterSet);
      if (!this.readonlyFilters.every((readonlyFilter) => filterSet.has(getFilterSetKey(readonlyFilter)))) {
        const filterSet = new Set();
        const dedupedFiltersWithReadonly = [...this.readonlyFilters, ...newState.filters].filter((filter) => {
          const filterKey = getFilterSetKey(filter);
          if (filterSet.has(filterKey)) {
            return false;
          } else {
            filterSet.add(filterKey);
            return true;
          }
        });

        this.setState({ filters: dedupedFiltersWithReadonly });

        const appEvents = getAppEvents();
        appEvents.publish({
          payload: [`Cannot remove ${this.readonlyFilters?.[0]?.origin} managed filters!`],
          type: AppEvents.alertError.name,
        });
      }
    }
  };

  public getReadonlyFilters() {
    return this.readonlyFilters;
  }
}
