import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ConfirmButton, Stack, useStyles2 } from '@grafana/ui';

import { useServiceSelectionContext } from './Context';

export function Footer() {
  const styles = useStyles2(getStyles);
  const { hasUnsavedChanges, reset, save } = useServiceSelectionContext();

  return (
    <footer className={styles.wrap}>
      <Stack justifyContent="flex-end" flex={1}>
        <Stack>
          <ConfirmButton
            onConfirm={reset}
            closeOnConfirm={true}
            confirmText={'Reset'}
            confirmVariant={'destructive'}
            aria-disabled={!hasUnsavedChanges}
            disabled={!hasUnsavedChanges}
          >
            Reset
          </ConfirmButton>
          <Button variant="primary" disabled={!hasUnsavedChanges} onClick={save}>
            Save changes
          </Button>
        </Stack>
      </Stack>
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
    borderRadius: theme.shape.radius.sm,
  }),
});
