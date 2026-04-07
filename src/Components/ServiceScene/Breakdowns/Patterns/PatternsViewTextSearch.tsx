import React, { ChangeEvent } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Alert, Field, useStyles2 } from '@grafana/ui';

import { areArraysEqual } from '../../../../services/comparison';
import { debouncedFuzzySearch, fuzzySearch } from '../../../../services/search';
import { getFieldsVariable, getLineFiltersVariable, getMetadataVariable } from '../../../../services/variableGetters';
import { SearchInput } from '../SearchInput';
import { PatternFrame, PatternsBreakdownScene } from './PatternsBreakdownScene';

export interface PatternsViewTextSearchState extends SceneObjectState {}

export class PatternsViewTextSearch extends SceneObjectBase<PatternsViewTextSearchState> {
  public static Component = PatternTextSearchComponent;

  constructor(state?: Partial<PatternsViewTextSearchState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  /**
   * On click callback to clear current text search
   */
  public clearSearch = () => {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    patternsBreakdownScene.setState({
      patternFilter: '',
    });
  };

  /**
   * Search input onchange callback
   * @param e
   */
  public handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    patternsBreakdownScene.setState({
      patternFilter: e.target.value,
    });
  };

  /**
   * Activation handler
   * @private
   */
  private onActivate() {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    this._subs.add(
      patternsBreakdownScene.subscribeToState((newState, prevState) => {
        if (newState.patternFilter !== prevState.patternFilter) {
          const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
          if (patternsBreakdownScene.state.patternFrames) {
            debouncedFuzzySearch(
              patternsBreakdownScene.state.patternFrames.map((frame) => frame.pattern),
              patternsBreakdownScene.state.patternFilter,
              this.onSearchResult
            );
          }
        }
      })
    );

    this._subs.add(
      patternsBreakdownScene.subscribeToState((newState, prevState) => {
        // If we have a search string, but no filtered patterns, run the search
        if (
          newState.patternFilter &&
          !newState.filteredPatterns &&
          newState.patternFrames &&
          !areArraysEqual(newState.filteredPatterns, prevState.filteredPatterns)
        ) {
          fuzzySearch(
            newState.patternFrames.map((frame) => frame.pattern),
            newState.patternFilter,
            this.onSearchResult
          );
        }
      })
    );
  }

  /**
   * Sets the patterns filtered by string match
   * @param patterns
   * @param patternFramesOverride
   */
  setFilteredPatterns(patterns: string[], patternFramesOverride?: PatternFrame[]) {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    const patternFrames = patternFramesOverride ?? patternsBreakdownScene.state.patternFrames;

    if (patternFrames) {
      const filteredPatternFrames = patternFrames.filter((patternFrame) => {
        if (patternsBreakdownScene.state.patternFilter && patternFrames?.length) {
          return patterns.find((pattern) => pattern === patternFrame.pattern);
        }
        return false;
      });

      patternsBreakdownScene.setState({
        filteredPatterns: filteredPatternFrames,
      });
    }
  }

  /**
   * Fuzzy search callback
   * @param data
   */
  onSearchResult = (data: string[][]) => {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    // If we have a search string
    if (patternsBreakdownScene.state.patternFilter) {
      this.setFilteredPatterns(data[0]);
    } else if (patternsBreakdownScene.state.filteredPatterns && !patternsBreakdownScene.state.patternFilter) {
      // Wipe the parent filtered state
      this.setEmptySearch();
    }
  };

  /**
   * Wipes filtered patterns when search string is empty
   */
  private setEmptySearch() {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    patternsBreakdownScene.setState({
      filteredPatterns: undefined,
    });
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  field: css({
    label: 'field',
    marginBottom: 0,
  }),
  icon: css({
    cursor: 'pointer',
  }),
  infoAlert: css({
    marginBottom: 0,
  }),
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
});

export function PatternTextSearchComponent({ model }: SceneComponentProps<PatternsViewTextSearch>) {
  const patternsBreakdownScene = sceneGraph.getAncestor(model, PatternsBreakdownScene);
  const { patternFilter } = patternsBreakdownScene.useState();
  const { filters: fieldFilters } = getFieldsVariable(model).useState();
  const { filters: metadataFilters } = getMetadataVariable(model).useState();
  const { filters: lineFilters } = getLineFiltersVariable(model).useState();

  const hasNonIndexedFilters = fieldFilters.length > 0 || metadataFilters.length > 0 || lineFilters.length > 0;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <Field className={styles.field}>
        <SearchInput
          onChange={model.handleSearchChange}
          onClear={model.clearSearch}
          value={patternFilter}
          placeholder={t("Components.pattern-text-search.placeholder-search-patterns", "Search patterns")}
        />
      </Field>
      {hasNonIndexedFilters && (
        <Alert severity="info" title="" className={styles.infoAlert}>
          {t(
            'logs.logs-drilldown.patterns.indexed-labels-only',
            'Patterns are selected by label and may be filtered by level. Parsed fields, structured metadata, and string filters are not supported for the pattern list.'
          )}
        </Alert>
      )}
    </div>
  );
}
