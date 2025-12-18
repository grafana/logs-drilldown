import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { LOG_LINE_BODY_FIELD_NAME, LOG_LINE_TIME_FIELD_NAME } from '../../ServiceScene/LogPanels';
import { ActiveFieldMeta, FieldNameMetaStore } from 'Components/Table/TableTypes';
import { areArraysStrictlyEqual } from 'services/comparison';
import { logger } from 'services/logger';
import { getBodyName, getTimeName, LogsFrame } from 'services/logsFrame';
import { NarrowingError, narrowRecordStringNumber } from 'services/narrowing';
import { PLUGIN_ID } from 'services/plugin';
import { setTableLogLine } from 'services/store';

const tableColumnCustomWidths = `${PLUGIN_ID}.tableColumnWidths`;

type TableColumnsContextType = {
  bodyState: LogLineState;
  clearSelectedLine: () => void;
  // the current list of labels from the dataframe combined with UI metadata
  columns: FieldNameMetaStore;
  columnWidthMap: Record<string, number>;
  // The active search results
  filteredColumns?: FieldNameMetaStore;
  setBodyState: (s: LogLineState) => void;
  // Update the column state
  setColumns(newColumns: FieldNameMetaStore): void;
  setColumnWidthMap(map: Record<string, number>): void;
  // Update search state
  setFilteredColumns(newColumns?: FieldNameMetaStore): void;
};

export enum LogLineState {
  text = 'text',
  labels = 'labels',
  auto = 'auto',
}

const TableColumnsContext = createContext<TableColumnsContextType>({
  bodyState: LogLineState.text,
  clearSelectedLine: () => {},
  columns: {},
  columnWidthMap: {},
  filteredColumns: {},
  setBodyState: () => {},
  setColumns: () => {},
  setColumnWidthMap: () => {},
  setFilteredColumns: () => {},
});

function setDefaultColumns(
  columns: FieldNameMetaStore,
  handleSetColumns: (newColumns: FieldNameMetaStore) => void,
  logsFrame: LogsFrame
) {
  const pendingColumns = { ...columns };

  pendingColumns[getTimeName(logsFrame)] = {
    active: true,
    cardinality: Infinity,
    index: 0,
    percentOfLinesWithLabel: 100,
    type: 'TIME_FIELD',
  };
  pendingColumns[getBodyName(logsFrame)] = {
    active: true,
    cardinality: Infinity,
    index: 1,
    percentOfLinesWithLabel: 100,
    type: 'BODY_FIELD',
  };

  handleSetColumns(pendingColumns);
}

function getColumnWidthsFromLocalStorage(): Record<string, number> {
  let initialColumnWidths = {};
  const existingWidths = localStorage.getItem(tableColumnCustomWidths);
  if (existingWidths) {
    try {
      initialColumnWidths = narrowRecordStringNumber(JSON.parse(existingWidths));
      if (initialColumnWidths === false) {
        logger.error(
          new NarrowingError('getColumnWidthsFromLocalStorage: unable to validate values in local storage'),
          { msg: 'NarrowingError: error parsing table column widths from local storage' }
        );
      }
      return initialColumnWidths;
    } catch (e) {
      logger.error(e, { msg: 'error parsing table column widths from local storage' });
    }
  }
  return initialColumnWidths;
}

export const TableColumnContextProvider = ({
  children,
  clearSelectedLine,
  initialColumns,
  logsFrame,
  displayedFields,
  setDisplayedFields,
  setUrlTableBodyState,
  urlTableBodyState,
}: {
  children: ReactNode;
  clearSelectedLine: () => void;
  displayedFields: string[];
  initialColumns: FieldNameMetaStore;
  logsFrame: LogsFrame;
  setDisplayedFields: (columns: string[]) => void;
  setUrlTableBodyState: (logLineState: LogLineState) => void;
  urlTableBodyState?: LogLineState;
}) => {
  const [columns, setColumns] = useState<FieldNameMetaStore>(removeExtraColumns(initialColumns));
  const [bodyState, setBodyState] = useState<LogLineState>(urlTableBodyState ?? LogLineState.text);
  const [filteredColumns, setFilteredColumns] = useState<FieldNameMetaStore | undefined>(undefined);
  const prevInitialColumnsRef = useRef<FieldNameMetaStore | null>(null);

  const initialColumnWidths = getColumnWidthsFromLocalStorage();
  const [columnWidthMap, setColumnWidthMapState] = useState<Record<string, number>>(initialColumnWidths);
  const setColumnWidthMap = (map: Record<string, number>) => {
    localStorage.setItem(tableColumnCustomWidths, JSON.stringify(map));
    setColumnWidthMapState(map);
  };

  const getActiveColumns = (columns: FieldNameMetaStore): string[] => {
    let activeColumns: string[] = [];
    Object.keys(columns).forEach((fieldName) => {
      if (columns[fieldName].active && columns[fieldName].index !== undefined) {
        activeColumns.push(fieldName);
      }
    });
    activeColumns.sort((a, b) => {
      // Typescript doesn't seem to know that the indicies we picked in the loop above are only for ActiveFieldMeta, so we're forced to assert
      const colA: ActiveFieldMeta = columns[a] as ActiveFieldMeta;
      const colB: ActiveFieldMeta = columns[b] as ActiveFieldMeta;
      return colA.index - colB.index;
    });
    return activeColumns;
  };

  const handleSetColumns = useCallback(
    (newColumns: FieldNameMetaStore) => {
      if (newColumns) {
        const columns = removeExtraColumns(newColumns);
        setColumns(columns);

        // Get active columns from the table
        const activeColumns = getActiveColumns(columns);

        // Map the actual body field name (e.g., 'Line' or 'body') back to ___LOG_LINE_BODY___
        // Map the actual time field name back to 'Time'
        const bodyFieldName = getBodyName(logsFrame);
        const timeFieldName = getTimeName(logsFrame);
        const mappedColumns = activeColumns.map((col) => {
          if (col === bodyFieldName) {
            return LOG_LINE_BODY_FIELD_NAME;
          }
          if (col === timeFieldName) {
            return LOG_LINE_TIME_FIELD_NAME;
          }
          return col;
        });

        // Use mappedColumns as-is to preserve user's ordering
        // Defaults can be deselected and reordered by the user
        const finalColumns = mappedColumns;

        // Only update displayedFields if it's actually different to prevent infinite loops
        if (!areArraysStrictlyEqual(finalColumns, displayedFields)) {
          setDisplayedFields(finalColumns);
        }
      }
    },
    [setDisplayedFields, logsFrame, displayedFields]
  );

  const handleSetBodyState = useCallback(
    (logLineState: LogLineState) => {
      setBodyState(logLineState);

      // Sync change with url state
      setUrlTableBodyState(logLineState);
      // Set table log line state in local storage
      setTableLogLine(logLineState);
    },
    [setUrlTableBodyState]
  );

  const handleClearSelectedLine = () => {
    clearSelectedLine();
  };

  // When the parent component recalculates new columns on dataframe change, we need to update or the column UI will be stale!
  // Use a ref to track previous initialColumns and only update if it actually changed to prevent infinite loops
  useEffect(() => {
    if (initialColumns) {
      // Deep comparison to check if initialColumns actually changed
      const prevInitialColumns = prevInitialColumnsRef.current;
      if (!prevInitialColumns || JSON.stringify(prevInitialColumns) !== JSON.stringify(initialColumns)) {
        prevInitialColumnsRef.current = initialColumns;
        // Only update columns state, don't call handleSetColumns which would update displayedFields
        const columns = removeExtraColumns(initialColumns);
        setColumns(columns);
      }
    }
  }, [initialColumns]);

  useEffect(() => {
    if (urlTableBodyState) {
      setBodyState(urlTableBodyState);
    }
  }, [urlTableBodyState]);

  // When the columns are updated, we need to check if nothing is selected so we can set the default
  useEffect(() => {
    const activeColumns = getDefaultColumns(columns, logsFrame);
    if (activeColumns?.length) {
      const activeFields = Object.keys(columns).filter((col) => columns[col].active);

      // If we're missing all fields, the user must have removed the last column, let's revert back to the default state
      if (activeFields.length === 0) {
        setDefaultColumns(columns, handleSetColumns, logsFrame);
      }

      // Reset any local search state
      setFilteredColumns(undefined);
    }
  }, [columns, logsFrame, setFilteredColumns, handleSetColumns]);

  return (
    <TableColumnsContext.Provider
      value={{
        bodyState,
        clearSelectedLine: handleClearSelectedLine,
        columns,
        columnWidthMap,
        filteredColumns,
        setBodyState: handleSetBodyState,
        setColumns: handleSetColumns,
        setColumnWidthMap,
        setFilteredColumns,
      }}
    >
      {children}
    </TableColumnsContext.Provider>
  );
};
/**
 * Filter out fields that shouldn't be exposed in the UI
 * @param columns
 */
const removeExtraColumns = (columns: FieldNameMetaStore): FieldNameMetaStore => {
  // Remove label Types
  if ('labelTypes' in columns) {
    const { labelTypes, ...columnsToSet }: FieldNameMetaStore = {
      ...columns,
    };
    return columnsToSet;
  }
  return columns;
};

function getDefaultColumns(pendingLabelState: FieldNameMetaStore, logsFrame: LogsFrame) {
  if (!logsFrame) {
    logger.warn('missing dataframe, cannot set url state');
    return;
  }
  // Get all active columns and sort by index
  const newColumnsArray = Object.keys(pendingLabelState)
    // Only include active filters
    .filter((key) => pendingLabelState[key]?.active)
    .sort((a, b) => {
      const pa = pendingLabelState[a];
      const pb = pendingLabelState[b];
      if (pa.index !== undefined && pb.index !== undefined) {
        return pa.index - pb.index; // sort by index
      }
      return 0;
    });

  const timeField = logsFrame.timeField;
  const bodyField = logsFrame.bodyField;

  if ((timeField && bodyField) || newColumnsArray.length) {
    const defaultColumns = [];
    if (timeField?.name) {
      defaultColumns.push(timeField.name);
    }
    if (bodyField?.name) {
      defaultColumns.push(bodyField.name);
    }

    // Update url state
    return newColumnsArray.length ? newColumnsArray : defaultColumns;
  }

  return [];
}

export const useTableColumnContext = () => {
  return useContext(TableColumnsContext);
};
