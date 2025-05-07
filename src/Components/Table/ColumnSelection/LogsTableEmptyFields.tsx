import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

function getStyles(theme: GrafanaTheme2) {
  return {
    empty: css({
      fontSize: theme.typography.fontSize,
      marginBottom: theme.spacing(2),
      marginLeft: theme.spacing(1.75),
    }),
  };
}

export function LogsTableEmptyFields() {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return <div className={styles.empty}>No fields</div>;
}
