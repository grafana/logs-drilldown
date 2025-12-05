import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Combobox, IconButton, useStyles2 } from '@grafana/ui';

import { logger } from '../../services/logger';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { getKeys } from './DefaultColumnsState';

interface Props {
  recordIndex: number;
}
export function DefaultColumnsColumns({ recordIndex }: Props) {
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();
  const record = localDefaultColumnsState?.[dsUID]?.records[recordIndex];
  const columns = record?.columns ?? [];
  const styles = useStyles2(getStyles, !columns.length);

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
    <>
      {columns?.map((column, colIdx) => (
        <div key={colIdx} className={styles.fieldsContainer__inputContainer}>
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
            className={styles.fieldsContainer__remove}
            onClick={() => onRemoveColumn(colIdx)}
          />
        </div>
      ))}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2, invalid: boolean) => ({
  fieldsContainer__inputContainer: css({
    marginTop: theme.spacing(1),
    display: 'flex',
  }),
  fieldsContainer__remove: css({
    marginLeft: theme.spacing(1),
  }),
});
