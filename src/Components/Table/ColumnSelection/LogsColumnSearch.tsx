import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Field, IconButton, Input, useTheme2 } from '@grafana/ui';

import { debouncedFuzzySearch } from '../../../services/search';
import { useTableColumnContext } from 'Components/Table/Context/TableColumnsContext';
import { FieldNameMetaStore } from 'Components/Table/TableTypes';

function getStyles(theme: GrafanaTheme2) {
  return {
    collapseButton: css({
      position: 'absolute',
      right: theme.spacing(0.2),
      top: theme.spacing(1),
    }),
  };
}

interface LogsColumnSearchProps {
  collapseButtonClassName?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  searchValue: string;
  setSearchValue: (value: string) => void;
}

export function LogsColumnSearch({
  collapseButtonClassName,
  isCollapsed,
  onToggleCollapse,
  searchValue,
  setSearchValue,
}: LogsColumnSearchProps) {
  const { columns, setFilteredColumns } = useTableColumnContext();

  // uFuzzy search dispatcher, adds any matches to the local state
  const dispatcher = (data: string[][]) => {
    const matches = data[0];
    let newColumnsWithMeta: FieldNameMetaStore = {};
    let numberOfResults = 0;
    matches.forEach((match) => {
      if (match in columns) {
        newColumnsWithMeta[match] = columns[match];
        numberOfResults++;
      }
    });
    setFilteredColumns(newColumnsWithMeta);
    searchFilterEvent(numberOfResults);
  };

  // uFuzzy search
  const search = (needle: string) => {
    debouncedFuzzySearch(Object.keys(columns), needle, dispatcher);
  };

  // onChange handler for search input
  const onSearchInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget?.value;
    setSearchValue(value);
    if (value) {
      search(value);
    } else {
      // If the search input is empty, reset the local search state.
      setFilteredColumns(undefined);
    }
  };

  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <>
      <IconButton
        className={collapseButtonClassName || styles.collapseButton}
        onClick={onToggleCollapse}
        name={isCollapsed ? 'angle-right' : 'angle-left'}
        tooltip={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        size="sm"
      />
      {!isCollapsed && (
        <Field>
          <Input
            value={searchValue}
            type={'text'}
            placeholder={'Search fields by name'}
            onChange={onSearchInputChange}
          />
        </Field>
      )}
    </>
  );
}

function searchFilterEvent(searchResultCount: number) {
  reportInteraction('grafana_logs_app_table_text_search_result_count', {
    resultCount: searchResultCount,
  });
}
