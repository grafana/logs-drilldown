import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, LogLabelStatsModel } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

//Components
import { PatternFieldLabelStatsRow } from './PatternFieldLabelStatsRow';

const STATS_ROW_LIMIT = 10;

const getStyles = (theme: GrafanaTheme2) => ({
  logsStats: css({
    background: 'inherit',
    color: theme.colors.text.primary,
    marginTop: theme.spacing(1),
    maxHeight: '40vh',
    overflowY: 'auto',
    width: 'fit-content',
    wordBreak: 'break-all',
  }),
  logsStatsBody: css({
    padding: '5px 0px',
  }),
  logsStatsClose: css({
    cursor: 'pointer',
  }),
  logsStatsHeader: css({
    borderBottom: `1px solid ${theme.colors.border.medium}`,
    display: 'flex',
  }),
  logsStatsTitle: css({
    display: 'inline-block',
    flexGrow: 1,
    fontWeight: theme.typography.fontWeightMedium,
    paddingRight: theme.spacing(2),
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});

interface PatternFieldLabelStatsProps {
  stats: LogLabelStatsModel[];
  value: string;
}

export const PatternFieldLabelStats = (props: PatternFieldLabelStatsProps) => {
  const style = useStyles2(getStyles);

  const { stats, value } = props;

  const topRows = stats.slice(0, STATS_ROW_LIMIT);
  let activeRow = topRows.find((row) => row.value === value);
  let otherRows = stats.slice(STATS_ROW_LIMIT);
  const insertActiveRow = !activeRow;

  // Remove active row from other to show extra
  if (insertActiveRow) {
    activeRow = otherRows.find((row) => row.value === value);
    otherRows = otherRows.filter((row) => row.value !== value);
  }

  const otherCount = otherRows.reduce((sum, row) => sum + row.count, 0);
  const topCount = topRows.reduce((sum, row) => sum + row.count, 0);
  const total = topCount + otherCount;

  // Combine topRows and otherRows
  let combinedRows = [...topRows];

  // If there's an "Other" category, add it to combinedRows
  if (otherCount > 0) {
    combinedRows.push({ count: otherCount, proportion: otherCount / total, value: 'Other' });
  }

  // Sort combinedRows by count in descending order
  combinedRows.sort((a, b) => b.count - a.count);

  return (
    <div className={style.logsStats}>
      <div className={style.logsStatsHeader}>
        <div className={style.logsStatsTitle}>From a sample of {total} rows found</div>
      </div>
      <div className={style.logsStatsBody}>
        {combinedRows.map((stat) => (
          <PatternFieldLabelStatsRow key={stat.value} {...stat} active={stat.value === value} />
        ))}
      </div>
    </div>
  );
};
