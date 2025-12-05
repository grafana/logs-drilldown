import React from 'react';

import { css, cx } from '@emotion/css';
import { Draggable, DraggableProvided } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { Combobox, Icon, IconButton, useStyles2 } from '@grafana/ui';

import { logger } from '../../services/logger';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { getKeys } from './DefaultColumnsState';

interface Props {
  containerDragging: boolean;
  recordIndex: number;
}
export function DefaultColumnsColumns({ recordIndex, containerDragging }: Props) {
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();
  const record = localDefaultColumnsState?.[dsUID]?.records[recordIndex];
  const columns = record?.columns ?? [];
  const styles = useStyles2(getStyles, containerDragging);

  if (!record) {
    const error = new Error('DefaultColumnsColumns: missing record!');
    logger.error(error, { msg: `DefaultColumnsColumns: no record at ${recordIndex} for datasource ${dsUID}` });
    throw error;
  }

  const onSelectColumn = (column: string, columnIndex: number) => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = ds.records;
      const recordToUpdate = records[recordIndex];
      recordToUpdate.columns[columnIndex] = column;

      setLocalDefaultColumnsDatasourceState({ records });
    }
  };

  const onRemoveColumn = (columnIndex: number) => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = ds.records;
      const recordToUpdate = records[recordIndex];
      recordToUpdate.columns.splice(columnIndex, 1);

      setLocalDefaultColumnsDatasourceState({ records });
    }
  };

  return (
    <div className={styles.columns}>
      {columns?.map((column, colIdx) => (
        <Draggable draggableId={column} key={column} index={colIdx}>
          {(provided: DraggableProvided, snapshot) => (
            <div
              key={colIdx}
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              className={cx(styles.column, snapshot.isDropAnimating ? styles['column--drop-animating'] : undefined)}
            >
              <Icon
                aria-label="Drag and drop icon"
                title="Drag and drop to reorder"
                name="draggabledots"
                size="lg"
                className={styles.column__dragIcon}
              />
              <Combobox<string>
                invalid={!column}
                value={column}
                placeholder={'Select column'}
                width={'auto'}
                minWidth={30}
                isClearable={false}
                onChange={(column) => onSelectColumn(column?.value, colIdx)}
                createCustomValue={true}
                options={(typeAhead) =>
                  getKeys(dsUID, record, colIdx).then((opts) => opts.filter((opt) => opt.value.includes(typeAhead)))
                }
              />
              <IconButton
                variant={'destructive'}
                tooltip={`Remove ${column}`}
                name={'minus'}
                size={'lg'}
                className={styles.column__removeIcon}
                onClick={() => onRemoveColumn(colIdx)}
              />
            </div>
          )}
        </Draggable>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, containerDragging: boolean) => ({
  columns: css({
    display: 'flex',
    overflow: 'hidden',
    flexDirection: 'column',
    paddingBottom: containerDragging ? theme.spacing(6) : theme.spacing(1),
  }),
  column: css({
    marginTop: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    transition: theme.transitions.create(['background-color', 'opacity'], { duration: '350ms' }),
    opacity: 1,
  }),
  'column--drop-animating': css({
    opacity: 0.6,
  }),
  column__removeIcon: css({
    marginLeft: theme.spacing(1),
  }),
  column__dragIcon: css({
    cursor: 'drag',
    opacity: 0.4,
    marginRight: theme.spacing(1),
  }),
});
