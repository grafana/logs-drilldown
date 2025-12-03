import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Divider, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { DefaultColumnsDeleteRecord } from './DefaultColumnsDeleteRecord';
import { DefaultColumnsFields } from './DefaultColumnsFields';
import { DefaultColumnsLabels } from './DefaultColumnsLabels';
import { DefaultColumnsLogsScene } from './DefaultColumnsLogsScene';

interface RecordsProps {}

export const DefaultColumnsRecords = ({}: RecordsProps) => {
  const styles = useStyles2(getStyles);
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();

  const ds = localDefaultColumnsState?.[dsUID];

  if (!ds) {
    throw new Error('Records::missing localDefaultColumnsState');
  }

  // @todo perf
  const invalidRecords = ds.records.filter(
    (r) =>
      !(
        r.columns.length &&
        r.labels.length &&
        r.labels.every(
          (l) => l.key !== '' //
        )
      )
  );

  const isInvalid = !!ds.records.length && !!invalidRecords.length;

  return (
    <div className={styles.recordsContainer}>
      {ds?.records.map((_, recordIndex: number) => {
        return (
          <div className={styles.recordContainer} key={recordIndex}>
            <div className={styles.recordContainer__content}>
              <DefaultColumnsLabels recordIndex={recordIndex} />
            </div>

            <Divider />

            <div className={styles.recordContainer__content}>
              <DefaultColumnsFields recordIndex={recordIndex} />
            </div>

            {/*@todo with scan direction the duration of logs queries is less relevant? */}
            <DefaultColumnsLogsScene recordIndex={recordIndex} />

            <DefaultColumnsDeleteRecord recordIndex={recordIndex} />
          </div>
        );
      })}

      <Button
        variant={'secondary'}
        fill={'outline'}
        icon={'plus'}
        disabled={isInvalid}
        onClick={() => {
          setLocalDefaultColumnsDatasourceState({
            // Add new record with empty label name
            records: [...(ds?.records ?? []), { columns: [], labels: [{ key: '' }] }],
          });
        }}
      >
        Add record
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  recordContainer: css({
    border: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(2),
    marginBottom: theme.spacing(3),
    position: 'relative',
  }),
  recordContainer__content: css({
    paddingLeft: theme.spacing(2),
  }),
  recordsContainer: css({
    paddingBottom: theme.spacing(2),
  }),
});
