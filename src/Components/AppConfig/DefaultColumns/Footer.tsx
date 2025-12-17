import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { AddRecord } from './AddRecord';
import { Submit } from './Submit';
import { Undo } from './Undo';

export function Footer() {
  const styles = useStyles2(getStyles);

  return (
    <footer className={styles.wrap}>
      <AddRecord />

      <div className={styles.submitWrap}>
        <Undo />
        <Submit />
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
