import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const useSharedStyles = () => {
  return useStyles2((theme: GrafanaTheme2) => {
    return {
      emptyStateWrap: css({
        width: '100%',
        minHeight: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: theme.spacing(2),
      }),
      linkButton: css({
        '&:focus': {
          outline: 'none',
        },
        appearance: 'none',
        background: 'none',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        font: 'inherit',
        lineHeight: 'normal',
        margin: 0,
        MozOsxFontSmoothing: 'inherit',
        padding: 0,
        textAlign: 'inherit',
        WebkitAppearance: 'none',
        WebkitFontSmoothing: 'inherit',
      }),
    };
  });
};
