import React, { useMemo } from 'react';

import { AdHocVariableFilter, DataFrame, FieldType, LogsSortOrder, sortDataFrame, TimeRange } from '@grafana/data';

import { parseLogsFrame } from '../../services/logsFrame';
import { LogLineState } from './Context/TableColumnsContext';
import { SelectedTableRow } from './LogLineCellComponent';
import { QueryContextProvider } from 'Components/Table/Context/QueryContext';
import { TableWrap } from 'Components/Table/TableWrap';

interface TableProviderProps {
  addFilter: (filter: AdHocVariableFilter) => void;
  clearSelectedLine: () => void;
  dataFrame: DataFrame;
  isColumnManagementActive: boolean;
  logsSortOrder: LogsSortOrder;
  panelWrap: React.RefObject<HTMLDivElement | null>;
  selectedLine?: SelectedTableRow;
  setUrlColumns: (columns: string[]) => void;
  setUrlTableBodyState: (logLineState: LogLineState) => void;
  showColumnManagementDrawer: (isActive: boolean) => void;
  timeRange?: TimeRange;
  urlColumns: string[];
  urlTableBodyState?: LogLineState;
}

export const TableProvider = ({
  addFilter,
  clearSelectedLine,
  dataFrame,
  isColumnManagementActive,
  logsSortOrder,
  panelWrap,
  selectedLine,
  setUrlColumns,
  setUrlTableBodyState,
  showColumnManagementDrawer,
  timeRange,
  urlColumns,
  urlTableBodyState,
}: TableProviderProps) => {
  const logsFrame = useMemo(() => {
    if (!dataFrame) {
      return null;
    }
    const timeIndex = dataFrame.fields.findIndex((field) => field.type === FieldType.time);
    const sortedFrame = sortDataFrame(dataFrame, timeIndex, logsSortOrder === LogsSortOrder.Descending);
    const logsFrame = parseLogsFrame(sortedFrame);
    return logsFrame;
  }, [dataFrame, logsSortOrder]);

  if (!logsFrame) {
    return null;
  }

  return (
    <QueryContextProvider addFilter={addFilter} selectedLine={selectedLine} timeRange={timeRange} logsFrame={logsFrame}>
      <TableWrap
        urlTableBodyState={urlTableBodyState}
        setUrlColumns={setUrlColumns}
        setUrlTableBodyState={setUrlTableBodyState}
        urlColumns={urlColumns}
        panelWrap={panelWrap}
        clearSelectedLine={clearSelectedLine}
        showColumnManagementDrawer={showColumnManagementDrawer}
        isColumnManagementActive={isColumnManagementActive}
        logsSortOrder={logsSortOrder}
      />
    </QueryContextProvider>
  );
};
