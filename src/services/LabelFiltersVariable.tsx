import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';

export interface LabelFiltersVariableProps extends Partial<AdHocFiltersVariable['state']> {
  readonlyFilters?: AdHocFilterWithLabels[];
}

// @todo - can we fix readonly filters persisting upstream in scenes instead of extending the AdHocFiltersVariable?
export class LabelFiltersVariable extends AdHocFiltersVariable {
  private readonly readonlyFilters?: AdHocFilterWithLabels[];

  constructor(props: LabelFiltersVariableProps) {
    const { readonlyFilters, ...state } = props;
    super({ filters: readonlyFilters, ...state });

    this.readonlyFilters = readonlyFilters;

    // Subscribe to state changes to update readOnly and origin for matching filters
    this.subscribeToState((newState) => {
      if (this.readonlyFilters?.length) {
        // If readonly filters were somehow removed, let's add them back in
        if (
          !this.readonlyFilters.every((readonlyFilter) =>
            newState.filters.find(
              (filter) =>
                filter.operator === readonlyFilter.operator &&
                filter.value === readonlyFilter.value &&
                filter.key === readonlyFilter.key
            )
          )
        ) {
          const filterSet = new Set();
          const dedupedFiltersWithReadonly = [...this.readonlyFilters, ...newState.filters].filter((filter) => {
            const filterKey = filter.key + '_' + filter.operator + '_' + filter.value;
            if (filterSet.has(filterKey)) {
              return false;
            } else {
              filterSet.add(filterKey);
              return true;
            }
          });

          console.warn('Cannot remove readonly filters!');
          this.setState({ filters: dedupedFiltersWithReadonly });

          const appEvents = getAppEvents();
          appEvents.publish({
            payload: [`Cannot remove ${this.readonlyFilters?.[0]?.origin} managed filters!`],
            type: AppEvents.alertError.name,
          });
        }

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
          console.log('has changes', updatedFilters);
          this.setState({ filters: updatedFilters });
        }
      }
    });
  }

  public getReadonlyFilters() {
    return this.readonlyFilters;
  }
}
