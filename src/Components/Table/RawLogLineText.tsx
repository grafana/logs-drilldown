import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { testIds } from '../../services/testIds';

export function RawLogLineText(props: { value: unknown }) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <div data-testid={testIds.table.rawLogLine} className={styles.rawLogLine}>
      <>{props.value}</>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2, bgColor?: string) => ({
  rawLogLine: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    height: '35px',
    lineHeight: '35px',
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1.5),
  }),
});
