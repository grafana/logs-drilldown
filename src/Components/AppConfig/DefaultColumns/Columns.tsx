import React from 'react';

import { css, cx } from '@emotion/css';
import { Draggable, DraggableProvided } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { Combobox, Icon, IconButton, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './Context';
import { getKeys } from './State';
import { getNormalizedFieldName } from 'Components/ServiceScene/LogOptionsScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { logger } from 'services/logger';

interface Props {
  containerDragging: boolean;
  recordIndex: number;
}

export function Columns({ recordIndex, containerDragging }: Props) {
  const { dsUID, records, setRecords } = useDefaultColumnsContext();
  const record = records?.[recordIndex];
  const columns = record?.columns ?? [];
  const styles = useStyles2(getStyles, containerDragging);

  if (!record) {
    const error = new Error('Columns: missing record!');
    logger.error(error, { msg: `Columns: no record at ${recordIndex} for datasource ${dsUID}` });
    throw error;
  }

  const onSelectColumn = (column: string, columnIndex: number) => {
    if (records) {
      const recordToUpdate = records[recordIndex];
      recordToUpdate.columns[columnIndex] = column;
      setRecords(records);
    }
  };

  const onRemoveColumn = (columnIndex: number) => {
    if (records) {
      const recordToUpdate = records[recordIndex];
      recordToUpdate.columns.splice(columnIndex, 1);
      setRecords(records);

      reportAppInteraction(
        USER_EVENTS_PAGES.default_columns_config,
        USER_EVENTS_ACTIONS.default_columns_config.remove_column
      );
    }
  };

  return (
    <div className={styles.columns}>
      {columns?.map((column, colIdx) => {
        const draggableIdx = column ? column : '__pendingIdx__';
        return (
          <Draggable draggableId={draggableIdx} key={draggableIdx} index={colIdx}>
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
                  value={{
                    value: column,
                    label: getNormalizedFieldName(column),
                  }}
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
                {columns.length > 1 && (
                  <IconButton
                    variant={'destructive'}
                    tooltip={`Remove ${getNormalizedFieldName(column)}`}
                    name="trash-alt"
                    size={'lg'}
                    className={styles.column__removeIcon}
                    onClick={() => onRemoveColumn(colIdx)}
                  />
                )}
              </div>
            )}
          </Draggable>
        );
      })}
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
