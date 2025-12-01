import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Divider, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { DefaultColumnsFields } from './DefaultColumnsFields';
import { DefaultColumnsLabels } from './DefaultColumnsLabels';

interface RecordsProps {}

export const DefaultColumnsRecords = ({}: RecordsProps) => {
  const styles = useStyles2(getStyles);
  const { localDefaultColumnsState, dsUID, setLocalDefaultColumnsDatasourceState } = useDefaultColumnsContext();

  if (!localDefaultColumnsState?.[dsUID]) {
    throw new Error('Records::missing localDefaultColumnsState');
  }

  return (
    <div className={styles.recordsContainer}>
      {localDefaultColumnsState[dsUID]?.records.map((_, recordIndex: number) => {
        return (
          <div className={styles.recordContainer} key={recordIndex}>
            <div className={styles.recordContainer__content}>
              <DefaultColumnsLabels recordIndex={recordIndex} />
            </div>

            <Divider />

            <div className={styles.recordContainer__content}>
              <DefaultColumnsFields recordIndex={recordIndex} />
            </div>
          </div>
        );
      })}

      <Button
        variant={'secondary'}
        fill={'outline'}
        icon={'plus'}
        disabled={
          // @todo perf
          !!localDefaultColumnsState[dsUID]?.records.find(
            (r) => !(r.columns.length && r.labels.length && r.labels.some((l) => l.key === ''))
          )
        }
        onClick={() => {
          setLocalDefaultColumnsDatasourceState({
            // Add new record with empty label name
            records: [...(localDefaultColumnsState[dsUID]?.records ?? []), { columns: [], labels: [{ key: '' }] }],
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
  }),
  recordContainer__content: css({
    paddingLeft: theme.spacing(2),
  }),
  recordsContainer: css({
    paddingBottom: theme.spacing(2),
  }),
});
