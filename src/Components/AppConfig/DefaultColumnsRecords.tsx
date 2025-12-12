import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { DefaultColumnsCollapsibleFields } from './DefaultColumnsCollapsibleFields';
import { useDefaultColumnsContext } from './DefaultColumnsContext';
import { DefaultColumnsDeleteRecord } from './DefaultColumnsDeleteRecord';
import { DefaultColumnsLabels } from './DefaultColumnsLabels';

interface RecordsProps {}

export const DefaultColumnsRecords = ({}: RecordsProps) => {
  const styles = useStyles2(getStyles);
  const { records, expandedRecords } = useDefaultColumnsContext();

  return (
    <div className={styles.recordsContainer}>
      {records?.map((record, recordIndex: number) => {
        const isOpen = expandedRecords.includes(recordIndex);
        return (
          <div className={styles.recordContainer} key={recordIndex}>
            <div className={styles.recordContainer__content}>
              <DefaultColumnsLabels recordIndex={recordIndex} />
            </div>

            <DefaultColumnsCollapsibleFields
              // Force re-render when isOpen changes as the `ControlledCollapse` component is not actually controlled?
              key={recordIndex + isOpen.toString()}
              record={record}
              isOpen={isOpen}
              recordIndex={recordIndex}
            />

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
  recordsContainer: css({
    paddingBottom: theme.spacing(2),
  }),
});
