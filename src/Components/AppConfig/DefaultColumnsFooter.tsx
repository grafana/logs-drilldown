import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { DefaultColumnsAddRecord } from './DefaultColumnsAddRecord';
import { DefaultColumnsSubmit } from './DefaultColumnsSubmit';

export function DefaultColumnsFooter() {
  const styles = useStyles2(getStyles);

  return (
    <footer className={styles.wrap}>
      <DefaultColumnsAddRecord />
      <DefaultColumnsSubmit />
    </footer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
});
