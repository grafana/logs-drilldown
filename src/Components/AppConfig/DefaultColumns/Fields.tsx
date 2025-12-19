import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { ColumnsDragContext } from './ColumnsDragContext';
import { useDefaultColumnsContext } from './Context';
import { recordColumnsAreNotLogLine, recordColumnsHaveValues } from './Validation';
import { logger } from 'services/logger';

interface Props {
  recordIndex: number;
}

export function Fields({ recordIndex }: Props) {
  const { dsUID, records, setRecords } = useDefaultColumnsContext();
  const record = records?.[recordIndex];
  const notOnlyLogLine = !record || recordColumnsAreNotLogLine(record);
  const recordHasValues = !record || recordColumnsHaveValues(record);

  const styles = useStyles2(getStyles, !recordHasValues);

  if (!record) {
    const error = new Error('DefaultColumnsFields: missing record!');
    logger.error(error, { msg: `DefaultColumnsFields: no record at ${recordIndex} for datasource ${dsUID}` });
    throw error;
  }

  const addDisplayField = () => {
    if (records) {
      const recordToUpdate = records[recordIndex];
      recordToUpdate.columns = [...recordToUpdate.columns, ''];
      setRecords(records);
    }
  };

  return (
    <div className={styles.fieldsContainer}>
      <ColumnsDragContext recordIndex={recordIndex} />

      <Button
        disabled={!recordHasValues}
        tooltip={
          !notOnlyLogLine
            ? 'Include at least one column that is not Log line'
            : !recordHasValues
            ? 'Invalid columns'
            : 'Add a default column to display in the logs'
        }
        variant={'secondary'}
        fill={'outline'}
        icon={'plus'}
        onClick={() => addDisplayField()}
        className={styles.fieldsContainer__button}
      >
        Add column
      </Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, invalid: boolean) => ({
  fieldsContainer: css({
    label: 'fieldsContainer',
  }),
  fieldsContainer__button: css({
    alignSelf: 'flex-start',
    marginTop: theme.spacing(1),
    borderColor: invalid ? theme.colors.error.border : theme.colors.border.strong,
  }),
});
