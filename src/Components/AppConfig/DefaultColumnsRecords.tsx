import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ControlledCollapse, useStyles2 } from '@grafana/ui';

import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { DefaultColumnsDeleteRecord } from './DefaultColumnsDeleteRecord';
import { DefaultColumnsFields } from './DefaultColumnsFields';
import { DefaultColumnsLabels } from './DefaultColumnsLabels';
import { DefaultColumnsLogsScene } from './DefaultColumnsLogsScene';
import { DefaultColumnsRecordsCollapsibleLabel } from './DefaultColumnsRecordsCollapsibleLabel';

interface RecordsProps {}

export const DefaultColumnsRecords = ({}: RecordsProps) => {
  const styles = useStyles2(getStyles);
  const { records } = useDefaultColumnsContext();

  return (
    <div className={styles.recordsContainer}>
      {records?.map((record, recordIndex: number) => {
        return (
          <div className={styles.recordContainer} key={recordIndex}>
            <div className={styles.recordContainer__content}>
              <DefaultColumnsLabels recordIndex={recordIndex} />
            </div>

            <ControlledCollapse
              className={styles.recordContainer__labelWrap}
              label={<DefaultColumnsRecordsCollapsibleLabel record={record} />}
              isOpen={false}
            >
              <div className={styles.recordContainer__content}>
                <DefaultColumnsFields recordIndex={recordIndex} />
              </div>

              {/*@todo with scan direction the duration of logs queries is less relevant? */}
              <DefaultColumnsLogsScene recordIndex={recordIndex} />
            </ControlledCollapse>
            <DefaultColumnsDeleteRecord recordIndex={recordIndex} />
          </div>
        );
      })}
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
  recordContainer__labelWrap: css({
    margin: theme.spacing(2),
    width: 'auto',
  }),
  recordsContainer: css({
    paddingBottom: theme.spacing(2),
  }),
});
