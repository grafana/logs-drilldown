import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, useStyles2 } from '@grafana/ui';

import { ColumnsDragContext } from './ColumnsDragContext';
import { useDefaultColumnsContext } from './Context';
import { recordColumnsAreNotLogLine, recordColumnsHaveValues } from './Validation';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { logger } from 'services/logger';

interface Props {
  recordIndex: number;
}

export function Fields({ recordIndex }: Props) {
  const { dsUID, records, setRecords } = useDefaultColumnsContext();
  const record = records?.[recordIndex];
  const notOnlyLogLine = !record || recordColumnsAreNotLogLine(record);
  const recordHasValues = !record || recordColumnsHaveValues(record);
  const recordIsValid = !recordHasValues || !!record?.columns.length;
  const styles = useStyles2(getStyles, !recordIsValid);

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
      reportAppInteraction(
        USER_EVENTS_PAGES.default_columns_config,
        USER_EVENTS_ACTIONS.default_columns_config.add_column
      );
    }
  };

  const invalidColumnsLogLineOnlyText = t(
    'components.fields.invalid-columns-log-line-only',
    'Only selecting the log line is probably redundant!'
  );

  return (
    <div className={styles.fieldsContainer}>
      {!notOnlyLogLine && <Alert severity={'warning'} title={invalidColumnsLogLineOnlyText}></Alert>}

      <ColumnsDragContext recordIndex={recordIndex} />

      <Button
        disabled={!recordHasValues}
        tooltip={
          !notOnlyLogLine
            ? invalidColumnsLogLineOnlyText
            : !recordHasValues
              ? t('components.fields.invalid-columns', 'Invalid columns')
              : t('components.fields.add-column-tooltip', 'Add a default column to display in the logs')
        }
        variant={'secondary'}
        fill={'outline'}
        icon={'plus'}
        onClick={() => addDisplayField()}
        className={styles.fieldsContainer__button}
      >
        <Trans i18nKey="components.fields.add-column">Add column</Trans>
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
