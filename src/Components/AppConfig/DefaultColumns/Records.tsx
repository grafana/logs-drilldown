import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CollapsibleFields } from './CollapsibleFields';
import { useDefaultColumnsContext } from './Context';
import { DeleteRecord } from './DeleteRecord';
import { Labels } from './Labels';

interface RecordsProps {}

export const Records = ({}: RecordsProps) => {
  const styles = useStyles2(getStyles);
  const { records } = useDefaultColumnsContext();

  return (
    <div className={styles.recordsContainer}>
      {records?.map((_, recordIndex: number) => {
        return (
          <div className={styles.recordContainer} key={recordIndex}>
            <div className={styles.recordContainer__content}>
              <Labels recordIndex={recordIndex} />
            </div>
            <CollapsibleFields recordIndex={recordIndex} />
            <DeleteRecord recordIndex={recordIndex} />
          </div>
        );
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  recordContainer: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.sm,
    paddingBottom: theme.spacing(2),
    marginBottom: theme.spacing(3),
    position: 'relative',
    boxShadow: theme.shadows.z2,
  }),
  recordContainer__content: css({
    paddingLeft: theme.spacing(2),
  }),
  recordsContainer: css({
    paddingBottom: theme.spacing(2),
  }),
});
