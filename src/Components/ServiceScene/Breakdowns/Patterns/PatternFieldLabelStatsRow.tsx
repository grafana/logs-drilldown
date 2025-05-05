import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  logsStatsRow: css({
    margin: `${theme.spacing(1.15)}px 0`,
  }),
  logsStatsRowActive: css({
    color: theme.colors.primary.text,
    position: 'relative',
  }),
  logsStatsRowBar: css({
    background: theme.colors.text.disabled,
    height: theme.spacing(0.5),
    overflow: 'hidden',
  }),
  logsStatsRowCount: css({
    marginLeft: theme.spacing(0.75),
    textAlign: 'right',
  }),
  logsStatsRowInnerBar: css({
    background: theme.colors.primary.main,
    height: theme.spacing(0.5),
    overflow: 'hidden',
  }),
  logsStatsRowLabel: css({
    display: 'flex',
    marginBottom: '1px',
  }),
  logsStatsRowPercent: css({
    marginLeft: theme.spacing(0.75),
    textAlign: 'right',
    width: theme.spacing(4.5),
  }),
  logsStatsRowValue: css({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});

export interface Props {
  active?: boolean;
  count: number;
  proportion: number;
  value?: string;
}

export const PatternFieldLabelStatsRow = ({ active, count, proportion, value }: Props) => {
  const style = useStyles2(getStyles);
  const percent = `${Math.round(proportion * 100)}%`;
  const barStyle = { width: percent };

  return (
    <div className={active ? `${style.logsStatsRow} ${style.logsStatsRowActive}` : style.logsStatsRow}>
      <div className={style.logsStatsRowLabel}>
        <div className={style.logsStatsRowValue} title={value}>
          {value}
        </div>
        <div className={style.logsStatsRowCount}>{count}</div>
        <div className={style.logsStatsRowPercent}>{percent}</div>
      </div>
      <div className={style.logsStatsRowBar}>
        <div className={style.logsStatsRowInnerBar} style={barStyle} />
      </div>
    </div>
  );
};
