import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { DefaultColumnsAddRecord } from './DefaultColumnsAddRecord';
import { DefaultColumnsSubmit } from './DefaultColumnsSubmit';
import { DefaultColumnsUndo } from './DefaultColumnsUndo';

export function DefaultColumnsFooter() {
  const styles = useStyles2(getStyles);

  return (
    <footer className={styles.wrap}>
      <DefaultColumnsAddRecord />

      <div className={styles.submitWrap}>
        <DefaultColumnsUndo />
        <DefaultColumnsSubmit />
      </div>
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
  submitWrap: css({
    gap: theme.spacing(1),
    display: 'flex',
  }),
});
