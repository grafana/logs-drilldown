import React, { createContext, ReactNode, useContext } from 'react';

import { AdHocVariableFilter, LogsSortOrder, TimeRange } from '@grafana/data';

import { SelectedTableRow } from 'Components/Table/LogLineCellComponent';
import { LogsFrame } from 'services/logsFrame';

export type Label = { indexed: boolean; name: string; values: string[] };

export type QueryContextType = {
  addFilter: (filter: AdHocVariableFilter) => void;
  logsFrame: LogsFrame | null;
  logsSortOrder: LogsSortOrder;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
};

export const initialState = {
  addFilter: (filter: AdHocVariableFilter) => {},
  logsFrame: null,
  logsSortOrder: LogsSortOrder.Descending,
  selectedLine: undefined,
  timeRange: undefined,
};

export const QueryContext = createContext<QueryContextType>(initialState);

export const QueryContextProvider = ({
  addFilter,
  children,
  logsFrame,
  logsSortOrder,
  selectedLine,
  timeRange,
}: {
  addFilter: (filter: AdHocVariableFilter) => void;
  children: ReactNode;
  logsFrame: LogsFrame;
  logsSortOrder: LogsSortOrder;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
}) => {
  return (
    <QueryContext.Provider
      value={{
        addFilter,
        logsFrame,
        logsSortOrder,
        selectedLine,
        timeRange,
      }}
    >
      {children}
    </QueryContext.Provider>
  );
};

export const useQueryContext = () => {
  return useContext(QueryContext);
};
