import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { Resizable, ResizeCallback } from 're-resizable';
import { ScrollSync } from 'react-scroll-sync';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  CustomTransformOperator,
  DataFrame,
  DataFrameType,
  DataTransformerConfig,
  Field,
  FieldType,
  FieldWithIndex,
  GrafanaTheme2,
  Labels,
  MappingType,
  transformDataFrame,
  ValueMap,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { LogsSortOrder, TableCellHeight, TableColoredBackgroundCellOptions } from '@grafana/schema';
import { Table as GrafanaTable, TableCellDisplayMode, TableCustomCellOptions, useTheme2 } from '@grafana/ui';

import { getBodyName, getIdName, LogsFrame } from '../../services/logsFrame';
import { testIds } from '../../services/testIds';
import { useQueryContext } from './Context/QueryContext';
import {
  ColumnSelectionDrawerWrap,
  getReorderColumn,
} from 'Components/Table/ColumnSelection/ColumnSelectionDrawerWrap';
import { TableCellContextProvider } from 'Components/Table/Context/TableCellContext';
import { useTableColumnContext } from 'Components/Table/Context/TableColumnsContext';
import { TableHeaderContextProvider } from 'Components/Table/Context/TableHeaderContext';
import { DefaultCellComponent } from 'Components/Table/DefaultCellComponent';
import { LogLineCellComponent } from 'Components/Table/LogLineCellComponent';
import { CustomHeaderRendererProps } from 'Components/Table/LogsTableHeader';
import { LogsTableHeaderWrap } from 'Components/Table/LogsTableHeaderWrap';
import { FieldName, FieldNameMeta, FieldNameMetaStore } from 'Components/Table/TableTypes';
import { guessLogsFieldTypeForValue } from 'Components/Table/TableWrap';

interface Props {
  height: number;
  labels: Labels[];
  logsFrame: LogsFrame;
  logsSortOrder: LogsSortOrder;
  timeZone: string;
  width: number;
}

const getStyles = (theme: GrafanaTheme2, height: number, sideBarWidth: number) => ({
  // Sidebar resize styles matching https://github.com/grafana/grafana/blob/main/public/app/features/explore/Logs/LogsTableWrap.tsx#L561
  collapsedTableSidebar: css({
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    paddingRight: theme.spacing(1),
    paddingTop: theme.spacing(8),
    width: '40px !important', // Space for the collapse button
  }),
  collapseTableSidebarButton: css({
    '&:hover': {
      background: theme.colors.background.primary,
      borderColor: theme.colors.border.medium,
    },
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    padding: theme.spacing(0.5),
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    transition: 'all 0.2s ease-in-out',
    zIndex: 10,
  }),
  rzHandle: css({
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: '0.3s background ease-in-out',
    },
    ['&:hover']: {
      background: theme.colors.secondary.shade,
    },
    background: theme.colors.secondary.main,
    borderRadius: theme.shape.radius.pill,
    cursor: 'grab',
    height: '50% !important',
    position: 'relative',
    right: `${theme.spacing(1)} !important`,
    top: '25% !important',
    width: `${theme.spacing(1)} !important`,
  }),
  sidebar: css({
    fontSize: theme.typography.pxToRem(11),
    height: height,
    overflowY: 'hidden',
    paddingRight: theme.spacing(3),
    position: 'relative',
    width: sideBarWidth,
  }),
  tableWrap: css({
    '.cellActions': {
      // Hacky but without inspect turned on the table will change the width of the row on hover, but we don't want the default icons to show
      display: 'none !important',
    },
  }),
  wrapper: css({
    display: 'flex',
    position: 'relative',
  }),
});

function TableAndContext(props: {
  data: DataFrame;
  height: number;
  logsFrame: LogsFrame;
  logsSortOrder: LogsSortOrder;
  onResize: (fieldDisplayName: string, width: number) => void;
  selectedLine?: number;
  width: number;
}) {
  return (
    <GrafanaTable
      onColumnResize={props.onResize}
      initialRowIndex={props.selectedLine}
      cellHeight={TableCellHeight.Sm}
      data={props.data}
      height={props.height}
      width={props.width}
      footerOptions={{ countRows: true, reducer: ['count'], show: true }}
    />
  );
}

export const Table = (props: Props) => {
  const { height, labels, logsFrame, timeZone, width } = props;
  const theme = useTheme2();

  const [tableFrame, setTableFrame] = useState<DataFrame | undefined>(undefined);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [isTableSidebarCollapsed, setIsTableSidebarCollapsed] = useState(false);
  const tableWidth = width - (isTableSidebarCollapsed ? 40 : sidebarWidth);
  const styles = getStyles(theme, height, sidebarWidth);

  const { clearSelectedLine, columns, columnWidthMap, setColumns, setColumnWidthMap } = useTableColumnContext();

  const { selectedLine } = useQueryContext();

  // Create a local state for selected line so we can clear the state tied to the URL
  const [localSelectedLine] = useState(selectedLine);

  const reorderColumn = getReorderColumn(setColumns);

  const templateSrv = getTemplateSrv();
  const replace = useMemo(() => templateSrv.replace.bind(templateSrv), [templateSrv]);

  const prepareTableFrame = useCallback(
    (frame: DataFrame): DataFrame => {
      if (!frame.length) {
        return frame;
      }
      const [frameWithOverrides] = applyFieldOverrides({
        data: [frame],
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
        replaceVariables: replace,
        theme: theme,
        timeZone: timeZone,
      });

      // `getLinks` and `applyFieldOverrides` are taken from TableContainer.tsx
      for (const [index, field] of frameWithOverrides.fields.entries()) {
        // If it's a string, then try to guess for a better type for numeric support in viz
        field.type =
          field.type === FieldType.string ? guessLogsFieldTypeForField(field) ?? FieldType.string : field.type;

        field.config = {
          ...field.config,

          custom: {
            cellOptions: getTableCellOptions(field, index, labels, logsFrame),
            filterable: true, // This sets the columns to be filterable
            headerComponent: (props: CustomHeaderRendererProps) => (
              <TableHeaderContextProvider>
                <LogsTableHeaderWrap
                  headerProps={{ ...props, fieldIndex: index }}
                  slideLeft={
                    index !== 0 ? (cols: FieldNameMetaStore) => reorderColumn(cols, index, index - 1) : undefined
                  }
                  slideRight={
                    index !== frame.fields.length - 1
                      ? (cols: FieldNameMetaStore) => reorderColumn(cols, index, index + 1)
                      : undefined
                  }
                  autoColumnWidths={
                    Object.keys(columnWidthMap).length > 0
                      ? () => {
                          setColumnWidthMap({});
                        }
                      : undefined
                  }
                />
              </TableHeaderContextProvider>
            ),
            inspect: true,
            width:
              columnWidthMap[field.name] ??
              getInitialFieldWidth(field, index, columns, width, frameWithOverrides.fields.length, logsFrame),
            ...field.config.custom,
          },
          // This sets the individual field value as filterable
          // filterable: isFieldFilterable(field, logsFrame?.bodyField.name ?? '', logsFrame?.timeField.name ?? ''),
          filterable: true,
        };
      }

      return frameWithOverrides;
    },
    // This function is building the table dataframe that will be transformed, even though the components within the dataframe (cells, headers) can mutate the dataframe!
    // If we try to update the dataframe whenever the columns are changed (which are rebuilt using this dataframe after being transformed), react will infinitely update frame -> columns -> frame -> ...
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeZone, theme, labels, width, replace, columnWidthMap]
  );

  // prepare dataFrame
  useEffect(() => {
    const prepare = async () => {
      const transformations: Array<DataTransformerConfig | CustomTransformOperator> = getExtractFieldsTransform(
        logsFrame.raw
      );

      let labelFilters = buildColumnsWithMeta(columns);

      const labelFiltersTransform = getOrganizeFieldsTransform(labelFilters);
      if (labelFiltersTransform) {
        transformations.push(labelFiltersTransform);
      } else {
        const specialFields = {
          body: logsFrame.bodyField,
          extraFields: logsFrame.extraFields,
          time: logsFrame.timeField,
        };
        if (specialFields && specialFields.body !== undefined && specialFields.time !== undefined) {
          transformations.push(
            getDefaultStateOrganizeFieldsTransform(
              specialFields as {
                body: FieldWithIndex;
                time: FieldWithIndex;
              }
            )
          );
        }
      }

      if (transformations.length > 0) {
        const transformedDataFrame: DataFrame[] = await lastValueFrom(
          // @ts-ignore
          transformDataFrame(transformations, [logsFrame.raw])
        );
        const tableFrame = prepareTableFrame(transformedDataFrame[0]);
        setTableFrame(tableFrame);
      } else {
        setTableFrame(prepareTableFrame(logsFrame.raw));
      }
    };
    prepare();
  }, [logsFrame.raw, logsFrame.bodyField, logsFrame.timeField, logsFrame.extraFields, prepareTableFrame, columns]);

  // Clear selected line from URL so it doesn't pollute future queries
  useEffect(() => {
    if (localSelectedLine && selectedLine) {
      clearSelectedLine();
      return;
    }
  }, [localSelectedLine, clearSelectedLine, selectedLine]);

  const idField = logsFrame.raw.fields.find((field) => field.name === getIdName(logsFrame));
  const lineIndex = idField?.values.findIndex((v) => v === localSelectedLine?.id);
  const cleanLineIndex = lineIndex && lineIndex !== -1 ? lineIndex : undefined;

  if (!tableFrame) {
    return <></>;
  }

  const onResize = (fieldDisplayName: string, width: number) => {
    const key = Object.keys(columns)
      .filter((key) => columns[key].active)
      .find((key) => key === fieldDisplayName);

    if (key && width > 0) {
      const map = { ...columnWidthMap };
      map[key] = width;
      setColumnWidthMap(map);
    }
  };

  const getOnResize: ResizeCallback = (event, direction, ref) => {
    const newSidebarWidth = Number(ref.style.width.slice(0, -2));
    if (!isNaN(newSidebarWidth)) {
      setSidebarWidth(newSidebarWidth);
    }
  };

  const toggleTableSidebarCollapse = () => {
    setIsTableSidebarCollapsed(!isTableSidebarCollapsed);
  };

  return (
    <div data-testid={testIds.table.wrapper} className={styles.wrapper}>
      <Resizable
        enable={{
          right: !isTableSidebarCollapsed,
        }}
        handleClasses={{ right: styles.rzHandle }}
        onResize={getOnResize}
        minWidth={isTableSidebarCollapsed ? 40 : 150}
        maxWidth={isTableSidebarCollapsed ? 40 : width * 0.8}
        size={{
          height: height,
          width: isTableSidebarCollapsed ? 40 : sidebarWidth,
        }}
      >
        <section className={`${styles.sidebar} ${isTableSidebarCollapsed ? styles.collapsedTableSidebar : ''}`}>
          <ColumnSelectionDrawerWrap
            isTableSidebarCollapsed={isTableSidebarCollapsed}
            onToggleTableSidebarCollapse={toggleTableSidebarCollapse}
            collapseTableSidebarButtonClassName={styles.collapseTableSidebarButton}
          />
        </section>
      </Resizable>

      <div className={styles.tableWrap}>
        <TableCellContextProvider>
          <ScrollSync horizontal={true} vertical={false} proportional={false}>
            <TableAndContext
              logsFrame={logsFrame}
              selectedLine={cleanLineIndex}
              data={tableFrame}
              height={height}
              width={tableWidth}
              onResize={debounce(onResize, 100)}
              logsSortOrder={props.logsSortOrder}
            />
          </ScrollSync>
        </TableCellContextProvider>
      </div>
    </div>
  );
};

function getDefaultStateOrganizeFieldsTransform(specialFields: { body: FieldWithIndex; time: FieldWithIndex }) {
  return {
    id: 'organize',
    options: {
      includeByName: {
        [specialFields.body.name]: true,
        [specialFields.time.name]: true,
      },
      indexByName: {
        [specialFields.time.name]: 0,
        [specialFields.body.name]: 1,
      },
    },
  };
}

function guessLogsFieldTypeForField(field: Field): FieldType | undefined {
  // 1. Use the column name to guess
  if (field.name) {
    const name = field.name.toLowerCase();
    if (name === 'date' || name === 'time') {
      return FieldType.time;
    }
  }

  // 2. Check the first non-null value
  for (let i = 0; i < field.values.length; i++) {
    const v = field.values[i];
    if (v != null) {
      return guessLogsFieldTypeForValue(v);
    }
  }

  // Could not find anything
  return undefined;
}

export const getFieldMappings = (): ValueMap => {
  return {
    options: {
      crit: {
        color: '#705da0',
        index: 1,
      },
      critical: {
        color: '#705da0',
        index: 0,
      },
      debug: {
        color: '#1f78c1',
        index: 8,
      },
      eror: {
        color: '#e24d42',
        index: 4,
      },
      err: {
        color: '#e24d42',
        index: 3,
      },
      error: {
        color: '#e24d42',
        index: 2,
      },
      info: {
        color: '#7eb26d',
        index: 7,
      },
      trace: {
        color: '#6ed0e0',
        index: 9,
      },
      warn: {
        color: '#FF9900',
        index: 6,
      },
      warning: {
        color: '#FF9900',
        index: 5,
      },
    },
    type: MappingType.ValueToText,
  };
};

function buildColumnsWithMeta(columnsWithMeta: Record<FieldName, FieldNameMeta>) {
  // Create object of label filters to include columns selected by the user
  let labelFilters: Record<FieldName, number> = {};
  Object.keys(columnsWithMeta)
    .filter((key) => columnsWithMeta[key].active)
    .forEach((key) => {
      const index = columnsWithMeta[key].index;
      // Index should always be defined for any active column
      if (index !== undefined) {
        labelFilters[key] = index;
      }
    });

  return labelFilters;
}

function getOrganizeFieldsTransform(labelFilters: Record<FieldName, number>) {
  let labelFiltersInclude: Record<FieldName, boolean> = {};

  for (const key in labelFilters) {
    labelFiltersInclude[key] = true;
  }

  if (Object.keys(labelFilters).length > 0) {
    return {
      id: 'organize',
      options: {
        includeByName: labelFiltersInclude,
        indexByName: labelFilters,
      },
    };
  }
  return null;
}

export function getExtractFieldsTransform(dataFrame: DataFrame) {
  return dataFrame.fields
    .filter((field: Field & { typeInfo?: { frame: string } }) => {
      const isFieldLokiLabels =
        field.typeInfo?.frame === 'json.RawMessage' &&
        field.name === 'labels' &&
        dataFrame?.meta?.type !== DataFrameType.LogLines;
      const isFieldDataplaneLabels =
        field.name === 'labels' && field.type === FieldType.other && dataFrame?.meta?.type === DataFrameType.LogLines;
      return isFieldLokiLabels || isFieldDataplaneLabels;
    })
    .flatMap((field: Field) => {
      return [
        {
          id: 'extractFields',
          options: {
            format: 'json',
            keepTime: false,
            replace: false,
            source: field.name,
          },
        },
      ];
    });
}

function getTableCellOptions(
  field: Field,
  fieldIndex: number,
  labels: Labels[],
  logsFrame: LogsFrame
): TableCustomCellOptions | TableColoredBackgroundCellOptions {
  if (field.name === getBodyName(logsFrame)) {
    return {
      cellComponent: (props) => (
        <LogLineCellComponent {...props} fieldIndex={fieldIndex} labels={labels[props.rowIndex]} />
      ),
      type: TableCellDisplayMode.Custom,
    };
  }

  return {
    cellComponent: (props) => <DefaultCellComponent {...props} fieldIndex={fieldIndex} />,
    type: TableCellDisplayMode.Custom,
  };
}

function getInitialFieldWidth(
  field: Field,
  fieldIndex: number,
  columns: FieldNameMetaStore,
  tableWidth: number,
  numberOfFields: number,
  logsFrame: LogsFrame
): number | undefined {
  const minWidth = 90;

  // Columns shouldn't take more than half the available space, unless there are only 2 columns
  const maxWidth = numberOfFields <= 2 ? tableWidth : Math.min(tableWidth / 2);

  // First field gets icons, and a little extra width
  const extraPadding = fieldIndex === 0 ? 50 : 0;

  // Time fields have consistent widths
  if (field.type === FieldType.time) {
    return 200 + extraPadding;
  }

  const columnMeta = columns[field.name];

  if (columnMeta === undefined) {
    return undefined;
  }

  const maxLength = Math.max(columnMeta.maxLength ?? 0, field.name.length);

  if (columnMeta.maxLength) {
    // Super rough estimate, about 6.5px per char, and 95px for some space for the header icons (remember when sorted a new icon is added to the table header).
    // I guess to be a little tighter we could only add the extra padding IF the field name is longer then the longest value
    return Math.min(Math.max(maxLength * 6.5 + 95 + extraPadding, minWidth + extraPadding), maxWidth);
  }

  if (field.name === getBodyName(logsFrame)) {
    return undefined;
  }

  // Just derived fields, which should have uniform length
  return Math.min(
    Math.max((field.values?.[0]?.length ?? 80) * 6.5 + 95 + extraPadding, minWidth + extraPadding),
    maxWidth
  );
}
