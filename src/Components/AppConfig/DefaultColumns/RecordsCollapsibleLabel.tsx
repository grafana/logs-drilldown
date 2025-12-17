import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord } from './types';
import { getNormalizedFieldName } from 'Components/ServiceScene/LogOptionsScene';

interface Props {
  record: LocalLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord;
}

export function RecordsCollapsibleLabel({ record }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.label}>
      <h5 className={styles.label__title}>
        Display columns
        <Tooltip content={'Default columns to display in logs visualizations'}>
          <Icon className={styles.label__icon} name="info-circle" />
        </Tooltip>
      </h5>
      <span className={styles.label__pills}>
        {record.columns
          .filter((c) => c)
          .map((column) => (
            <span className={styles.label__pill} key={column}>
              {getNormalizedFieldName(column)}
            </span>
          ))}
      </span>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  label: css({
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  }),
  label__pills: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginLeft: theme.spacing(1),
  }),
  label__pill: css({
    mr: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(0.25, 1, 0.25, 1),
  }),
  label__icon: css({
    marginLeft: theme.spacing(0.5),
  }),
  label__title: css({
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    flex: '1 0 auto',
  }),
});
