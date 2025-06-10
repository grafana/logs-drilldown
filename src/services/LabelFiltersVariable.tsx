import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';

export interface LabelFiltersVariableProps extends Partial<AdHocFiltersVariable['state']> {
  readonlyFilters?: AdHocFilterWithLabels[];
}

export class LabelFiltersVariable extends AdHocFiltersVariable {
  private readonlyFilters?: AdHocFilterWithLabels[];

  constructor(props: LabelFiltersVariableProps) {
    const { readonlyFilters, ...state } = props;
    super(state);

    this.readonlyFilters = readonlyFilters;

    // Subscribe to state changes to update readOnly and origin for matching filters
    this.subscribeToState((newState) => {
      if (newState.filters && this.readonlyFilters?.length) {
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
      }
    });
  }
}
