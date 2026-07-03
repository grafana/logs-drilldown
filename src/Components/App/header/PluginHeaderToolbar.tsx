import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { testIds } from '../../../services/testIds';

export function PluginHeaderToolbar({ children }: { children: React.ReactNode }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.toolbar} data-testid={testIds.header.pluginHeaderToolbar}>
      {children}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    toolbar: css`
      display: flex;
      align-items: stretch;
      height: ${theme.spacing(theme.components.height.md)};
      box-sizing: border-box;
      border: 1px solid ${theme.colors.border.weak};
      background-color: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default};
      overflow: hidden;

      & > * {
        display: flex;
        align-items: stretch;
        height: 100%;
      }

      & > * + * {
        border-left: 1px solid ${theme.colors.border.weak};
      }

      button {
        border: none;
        border-radius: 0;
        height: 100%;
        box-shadow: none;

        &:hover {
          border: none;
          box-shadow: none;
        }
      }
    `,
  };
}
