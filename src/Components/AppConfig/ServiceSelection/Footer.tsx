import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export function Footer() {
  const styles = useStyles2(getStyles);

  return (
    <footer className={styles.wrap}>
      <div className={styles.submitWrap}></div>
    </footer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    bottom: 0,
    left: 0,
    background: theme.colors.background.secondary,
    zIndex: theme.zIndex.navbarFixed,
    padding: theme.spacing(1, 2),
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
    borderRadius: theme.shape.radius.sm,
  }),
  submitWrap: css({
    gap: theme.spacing(1),
    display: 'flex',
  }),
});
