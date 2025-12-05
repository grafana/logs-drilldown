import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { logger } from '../../services/logger';
import { DefaultColumnsColumns } from './DefaultColumnsColumns';
import { useDefaultColumnsContext } from './DefaultColumnsContext';

interface Props {
  recordIndex: number;
}

export function DefaultColumnsFields({ recordIndex }: Props) {
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();
  const record = localDefaultColumnsState?.[dsUID]?.records[recordIndex];
  const columns = record?.columns ?? [];
  const styles = useStyles2(getStyles, !columns.length);

  if (!record) {
    const error = new Error('DefaultColumnsFields: missing record!');
    logger.error(error, { msg: `DefaultColumnsFields: no record at ${recordIndex} for datasource ${dsUID}` });
    throw error;
  }

  const addDisplayField = () => {
    if (localDefaultColumnsState && localDefaultColumnsState[dsUID]) {
      const ds = localDefaultColumnsState[dsUID];
      const records = ds.records;
      const recordToUpdate = records[recordIndex];
      recordToUpdate.columns = [...recordToUpdate.columns, ''];
      setLocalDefaultColumnsDatasourceState({ records });
    }
  };

  return (
    <div className={styles.fieldsContainer}>
      <h5 className={styles.fieldsContainer__title}>
        Display columns
        <Tooltip content={'Default columns to display in logs visualizations'}>
          <Icon className={styles.fieldsContainer__icon} name="info-circle" />
        </Tooltip>
      </h5>

      <DefaultColumnsColumns recordIndex={recordIndex} />

      <Button
        tooltip={'Add a default column to display in the logs'}
        variant={'secondary'}
        fill={'outline'}
        aria-label={`Add label`}
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
  fieldsContainer__icon: css({
    marginLeft: theme.spacing(0.5),
  }),
  fieldsContainer__title: css({
    marginTop: theme.spacing(1.5),
    display: 'flex',
    alignItems: 'center',
  }),
  fieldsContainer__button: css({
    alignSelf: 'flex-start',
    marginTop: theme.spacing(1),
    borderColor: invalid ? theme.colors.error.border : theme.colors.border.strong,
  }),
});
