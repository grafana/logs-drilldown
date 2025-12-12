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
  controlsExpanded: boolean;
  dataFrame: DataFrame;
  displayedFields: string[];
  logsSortOrder: LogsSortOrder;
  panelWrap: React.RefObject<HTMLDivElement | null>;
  selectedLine?: SelectedTableRow;
  setDisplayedFields: (columns: string[]) => void;
  setUrlTableBodyState: (logLineState: LogLineState) => void;
  timeRange?: TimeRange;
  urlTableBodyState?: LogLineState;
}

export default function TableProvider({
  addFilter,
  clearSelectedLine,
  controlsExpanded,
  dataFrame,
  displayedFields,
  logsSortOrder,
  panelWrap,
  selectedLine,
  setDisplayedFields,
  setUrlTableBodyState,
  timeRange,
  urlTableBodyState,
}: TableProviderProps) {
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
        setDisplayedFields={setDisplayedFields}
        setUrlTableBodyState={setUrlTableBodyState}
        displayedFields={displayedFields}
        panelWrap={panelWrap}
        clearSelectedLine={clearSelectedLine}
        logsSortOrder={logsSortOrder}
        controlsExpanded={controlsExpanded}
      />
    </QueryContextProvider>
  );
}
