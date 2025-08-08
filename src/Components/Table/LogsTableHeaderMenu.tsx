import React, { PropsWithChildren, useEffect, useRef } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ClickOutsideWrapper, IconButton, useStyles2 } from '@grafana/ui';

interface LogsTableHeaderProps extends PropsWithChildren {
  setHeaderMenuActive: (active: boolean) => void;
}

export function LogsTableHeaderMenu({ setHeaderMenuActive, children }: LogsTableHeaderProps) {
  const styles = useStyles2(getStyles);
  const ref = useRef<null | HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <ClickOutsideWrapper includeButtonPress={false} onClick={() => setHeaderMenuActive(false)} useCapture={true}>
      <div className={styles.tableHeaderMenu}>
        <IconButton
          ref={ref}
          className={styles.closeButton}
          aria-label={t('logs.table.header.close', 'Close')}
          name={'times'}
          onClick={() => setHeaderMenuActive(false)}
        />
        {children}
      </div>
    </ClickOutsideWrapper>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  closeButton: css({
    position: 'absolute',
    top: '14px',
    right: '2px',
  }),
  tableHeaderMenu: css({
    display: 'block',
    position: 'static',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    height: '100%',
    label: 'tableHeaderMenu',
    margin: theme.spacing(1, 0),
    maxHeight: '400px',
    minWidth: '250px',
    padding: theme.spacing(2),
    width: '100%',
  }),
});
