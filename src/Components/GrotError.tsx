import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { EmptyState, useStyles2 } from '@grafana/ui';

type Props = {
  children?: React.ReactNode;
};

export const GrotError = ({ children }: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrap}>
      <EmptyState variant="not-found" message={children ? '' : 'An error occurred'}>
        {children && children}
      </EmptyState>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrap: css({
      margin: '0 auto',
    }),
  };
};
