import React, { createContext, ReactNode, useContext } from 'react';

import { AdHocVariableFilter, TimeRange } from '@grafana/data';

import { LogsFrame } from '../../../services/logsFrame';
import { SelectedTableRow } from '../LogLineCellComponent';

export type Label = { indexed: boolean; name: string; values: string[] };

export type QueryContextType = {
  addFilter: (filter: AdHocVariableFilter) => void;
  logsFrame: LogsFrame | null;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
};

export const initialState = {
  addFilter: (filter: AdHocVariableFilter) => {},
  logsFrame: null,
  selectedLine: undefined,
  timeRange: undefined,
};

export const QueryContext = createContext<QueryContextType>(initialState);

export const QueryContextProvider = ({
  addFilter,
  children,
  logsFrame,
  selectedLine,
  timeRange,
}: {
  addFilter: (filter: AdHocVariableFilter) => void;
  children: ReactNode;
  logsFrame: LogsFrame;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
}) => {
  return (
    <QueryContext.Provider
      value={{
        addFilter,
        logsFrame,
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
