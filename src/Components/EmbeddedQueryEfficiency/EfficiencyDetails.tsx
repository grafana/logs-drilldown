import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconName, useStyles2 } from '@grafana/ui';

import { EfficiencyCheck, EfficiencyLevel } from './scoring';

interface Props {
  checks: EfficiencyCheck[];
  query: string;
}

const STATUS_ICON: Record<EfficiencyLevel, IconName> = {
  good: 'check-circle',
  poor: 'times-circle',
  warning: 'exclamation-triangle',
};

export function EfficiencyDetails({ checks, query }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <code className={styles.query}>{query}</code>
      <ul className={styles.list}>
        {checks.map((check) => (
          <li className={styles.item} key={check.id}>
            <Icon className={styles[check.status]} name={STATUS_ICON[check.status]} />
            <div>
              <div className={styles.title}>{check.title}</div>
              <div className={styles.detail}>{check.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  detail: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  good: css({ color: theme.colors.success.main }),
  item: css({
    alignItems: 'flex-start',
    display: 'flex',
    gap: theme.spacing(1),
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  poor: css({ color: theme.colors.error.main }),
  query: css({
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    display: 'block',
    fontFamily: 'monospace',
    marginBottom: theme.spacing(1),
    overflowWrap: 'anywhere',
    padding: theme.spacing(1),
  }),
  title: css({
    fontWeight: theme.typography.fontWeightMedium,
  }),
  warning: css({ color: theme.colors.warning.main }),
});
