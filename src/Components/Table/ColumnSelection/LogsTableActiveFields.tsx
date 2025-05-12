import React, { ReactElement } from 'react';

import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, DraggableProvided, Droppable, DropResult } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { FieldNameMeta, FieldNameMetaStore } from '../TableTypes';
import { LogsTableEmptyFields } from './LogsTableEmptyFields';
import { LogsTableNavField } from './LogsTableNavField';
import { useTableColumnContext } from 'Components/Table/Context/TableColumnsContext';

export function getLogsFieldsStyles(theme: GrafanaTheme2) {
  return {
    columnWrapper: css({
      marginBottom: theme.spacing(1.5),
      // need some space or the outline of the checkbox is cut off
      paddingLeft: theme.spacing(0.5),
    }),
    dragging: css({
      background: theme.colors.background.secondary,
    }),
    wrap: css({
      background: theme.colors.background.primary,
      display: 'flex',
      marginBottom: theme.spacing(1),
      marginTop: theme.spacing(1),
    }),
  };
}

function sortLabels(labels: Record<string, FieldNameMeta>) {
  return (a: string, b: string) => {
    const la = labels[a];
    const lb = labels[b];

    // Sort by index
    if (la.index != null && lb.index != null) {
      return la.index - lb.index;
    }

    // otherwise do not sort
    return 0;
  };
}

export const LogsTableActiveFields = (props: {
  id: string;
  labels: Record<string, FieldNameMeta>;
  reorderColumn: (cols: FieldNameMetaStore, sourceIndex: number, destinationIndex: number) => void;
  toggleColumn: (columnName: string) => void;
  valueFilter: (value: string) => boolean;
}): ReactElement => {
  const { columnWidthMap, setColumnWidthMap } = useTableColumnContext();
  const { labels, reorderColumn, toggleColumn, valueFilter } = props;
  const theme = useTheme2();
  const { columns } = useTableColumnContext();
  const styles = getLogsFieldsStyles(theme);
  const labelKeys = Object.keys(labels).filter((labelName) => valueFilter(labelName));

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    reorderColumn(columns, result.source.index, result.destination.index);
  };

  const renderTitle = (labelName: string) => {
    const label = labels[labelName];
    if (label) {
      return `${labelName} appears in ${label?.percentOfLinesWithLabel}% of log lines`;
    }

    return undefined;
  };

  if (labelKeys.length) {
    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="order-fields" direction="vertical">
          {(provided) => (
            <div className={styles.columnWrapper} {...provided.droppableProps} ref={provided.innerRef}>
              {labelKeys.sort(sortLabels(labels)).map((labelName, index) => (
                <Draggable draggableId={labelName} key={labelName} index={index}>
                  {(provided: DraggableProvided, snapshot) => (
                    <div
                      className={cx(styles.wrap, snapshot.isDragging ? styles.dragging : undefined)}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      title={renderTitle(labelName)}
                    >
                      <LogsTableNavField
                        setColumnWidthMap={setColumnWidthMap}
                        columnWidthMap={columnWidthMap}
                        label={labelName}
                        onChange={() => toggleColumn(labelName)}
                        labels={labels}
                        draggable={true}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }

  return <LogsTableEmptyFields />;
};
