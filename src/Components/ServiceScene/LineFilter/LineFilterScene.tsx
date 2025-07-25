import { ChangeEvent, KeyboardEvent, useState } from 'react';

import debounce from 'lodash/debounce';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { LineFilterCaseSensitive, LineFilterOp } from '../../../services/filterTypes';
import { addCurrentUrlToHistory } from '../../../services/navigate';
import {
  getLineFilterCase,
  getLineFilterExclusive,
  getLineFilterRegex,
  setLineFilterCase,
  setLineFilterExclusive,
  setLineFilterRegex,
} from '../../../services/store';
import { getLineFiltersVariable, getLineFilterVariable } from '../../../services/variableGetters';
import { LineFilterEditor } from './LineFilterEditor';
import { RegexInputValue } from './RegexIconButton';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';

interface LineFilterState extends SceneObjectState {
  caseSensitive: boolean;
  exclusive: boolean;
  lineFilter: string;
  regex: boolean;
}

/**
 * The line filter scene used in the logs tab
 */
export class LineFilterScene extends SceneObjectBase<LineFilterState> {
  static Component = LineFilterComponent;

  /**
   * Sets default regex/sensitivity/exclusivity state from local storage
   */
  constructor(state?: Partial<LineFilterState>) {
    super({
      caseSensitive: state?.caseSensitive ?? getLineFilterCase(false),
      exclusive: state?.exclusive ?? getLineFilterExclusive(false),
      lineFilter: state?.lineFilter ?? '',
      regex: state?.regex ?? getLineFilterRegex(false),
      ...state,
    });
    this.addActivationHandler(this.onActivate);
  }

  /**
   * Set initial state on activation
   */
  private onActivate = () => {
    const filter = this.getFilter();

    if (!filter) {
      return;
    }

    this.setState({
      caseSensitive: filter.key === LineFilterCaseSensitive.caseSensitive,
      exclusive: filter.operator === LineFilterOp.negativeMatch || filter.operator === LineFilterOp.negativeRegex,
      lineFilter: filter.value,
      regex: filter.operator === LineFilterOp.regex || filter.operator === LineFilterOp.negativeRegex,
    });

    return () => {
      // This won't clear the variable as the URL won't have time to sync, but it does prevent changes to the variable that haven't yet been synced with this scene state
      this.clearFilter();
    };
  };

  /**
   * Clear filter variable
   */
  private clearVariable() {
    const variable = getLineFilterVariable(this);
    variable.updateFilters([], {
      skipPublish: true,
    });
    this.setState({
      lineFilter: '',
    });
  }
  /**
   * Returns operator from current state
   */
  private getOperator(): LineFilterOp {
    if (this.state.regex && this.state.exclusive) {
      return LineFilterOp.negativeRegex;
    }
    if (this.state.regex && !this.state.exclusive) {
      return LineFilterOp.regex;
    }
    if (!this.state.regex && this.state.exclusive) {
      return LineFilterOp.negativeMatch;
    }
    if (!this.state.regex && !this.state.exclusive) {
      return LineFilterOp.match;
    }

    throw new Error('getOperator: failed to determine operation');
  }

  /**
   * Since there is no "key" for line-filters in logQL that will map to the key of the ad-hoc filter, we currently use the key to store the case sensitivity state
   * Note: This is technically a non-standard implementation (hack) of the ad-hoc variable, we should look into adding metadata to the ad-hoc variables in scenes
   * However the behavior of the ad-hoc variable lines up well with our use-case, we want case sensitivity state to be saved in the URL and to trigger query updates.
   * Since we use a custom renderer, this should be fine, but a source of tech-debt nonetheless.
   */
  private getFilterKey() {
    return this.state.caseSensitive ? LineFilterCaseSensitive.caseSensitive : LineFilterCaseSensitive.caseInsensitive;
  }

  /**
   * Returns the current ad-hoc variable filter
   */
  private getFilter() {
    const lineFilterVariable = getLineFilterVariable(this);
    return lineFilterVariable.state.filters[0];
  }

  /**
   * Clears filter input and clears debounce queue
   */
  clearFilter = () => {
    this.updateVariableDebounced.cancel();
    this.updateFilter('', false);
  };

  /**
   * Updates line filter state
   * Note: Updating/debouncing the queries onChange was removed to prevent people from accidentally hammering loki while writing line filters (particularly regex)
   * The code has been left in for now as we discussed adding an "edit" mode with a dedicated logs panel with a smaller line limit to let users debug the results as they type
   */
  updateFilter(lineFilter: string, debounced = true) {
    this.updateInputState(lineFilter);
    if (debounced) {
      this.updateVariableDebounced(lineFilter);
    } else {
      this.updateVariable(lineFilter);
    }
  }

  updateInputState(lineFilter: string) {
    this.setState({
      lineFilter,
    });
  }

  /**
   * Update exclusive state, triggers re-query without debounce
   */
  onToggleExclusive = (exclusive: boolean) => {
    setLineFilterExclusive(exclusive);
    this.setState({
      exclusive,
    });

    this.updateFilter(this.state.lineFilter, false);
  };

  /**
   * Moves the filter to the "global" line-filter ad-hoc variable after flushing the debounce queue.
   * Clears the state of the local ad-hoc variable.
   */
  onSubmitLineFilter = () => {
    addCurrentUrlToHistory();
    this.updateFilter(this.state.lineFilter, false);
    // Flush any debounced updates before grabbing the filter. Important that this happens before getFilter is called!
    this.updateVariableDebounced.flush();

    const lineFiltersVariable = getLineFiltersVariable(this);
    const existingFilters = lineFiltersVariable.state.filters;
    const thisFilter = this.getFilter();

    lineFiltersVariable.updateFilters([...existingFilters, thisFilter]);
    this.clearVariable();
  };

  /**
   * Passes the input value to the updateFilter method
   */
  handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.updateInputState(e.target.value);
  };

  /**
   * Submits on enter
   */
  handleEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && this.state.lineFilter) {
      this.onSubmitLineFilter();
    }
  };

  /**
   * Sets local state and triggers query on case sensitivity toggle
   */
  onCaseSensitiveToggle = (newState: LineFilterCaseSensitive) => {
    const caseSensitive = newState === LineFilterCaseSensitive.caseSensitive;

    // Set value to scene state
    this.setState({
      caseSensitive,
    });

    // Set value in local storage
    setLineFilterCase(caseSensitive);

    this.updateFilter(this.state.lineFilter, false);
  };

  /**
   * Sets local state and triggers query on regex toggle
   */
  onRegexToggle = (newState: RegexInputValue) => {
    const regex = newState === 'regex';

    // Set value to scene state
    this.setState({
      regex,
    });

    // Set value in local storage
    setLineFilterRegex(regex);

    this.updateFilter(this.state.lineFilter, false);
  };

  /**
   * Instance variable reference to debounced update method
   */
  updateVariableDebounced = debounce((search: string) => {
    this.updateVariable(search);
  }, 1000);

  /**
   * Updates the ad-hoc variable from local state and triggers a query.
   * Sends analytics event.
   */
  updateVariable = (search?: string) => {
    this.updateVariableDebounced.flush();
    const variable = getLineFilterVariable(this);
    const variables = getLineFiltersVariable(this);
    const filter = {
      key: this.getFilterKey(),
      // The keyLabel is used to sort line filters by order added.
      keyLabel: variables.state.filters.length.toString(),
      operator: this.getOperator(),
      value: search ?? '',
    };

    variable.updateFilters([filter]);

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.search_string_in_logs_changed,
      {
        caseSensitive: filter.key,
        containsLevel: search?.toLowerCase().includes('level'),
        operator: filter.operator,
        searchQueryLength: search?.length,
      }
    );
  };
}

function LineFilterComponent({ model }: SceneComponentProps<LineFilterScene>) {
  const { caseSensitive, exclusive, lineFilter, regex } = model.useState();
  const [focus, setFocus] = useState(false);
  return LineFilterEditor({
    caseSensitive,
    exclusive,
    focus,
    handleEnter: model.handleEnter,
    lineFilter,
    onCaseSensitiveToggle: model.onCaseSensitiveToggle,
    onClearLineFilter: model.clearFilter,
    onInputChange: model.handleChange,
    onRegexToggle: model.onRegexToggle,
    onSubmitLineFilter: model.onSubmitLineFilter,
    regex,
    setExclusive: model.onToggleExclusive,
    setFocus,
    type: 'editor',
    updateFilter: model.updateFilter,
  });
}
