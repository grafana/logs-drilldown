import React from 'react';

import { css, cx } from '@emotion/css';

import { colorManipulator, GrafanaTheme2 } from '@grafana/data';
import { IconButtonVariant, Tooltip, useTheme2 } from '@grafana/ui';

import { LineFilterCaseSensitive } from '../../../services/filterTypes';
import { getFocusStyles, getIconButtonBefore, getMouseFocusStyles } from '../../../services/mixins';

interface Props {
  caseSensitive: boolean;
  onCaseSensitiveToggle: (state: LineFilterCaseSensitive) => void;
}

export const LineFilterCaseSensitivityButton = (props: Props) => {
  const theme = useTheme2();
  const fill = props.caseSensitive ? theme.colors.text.maxContrast : theme.colors.text.disabled;
  const styles = getStyles(theme);
  const description = `${props.caseSensitive ? 'Disable' : 'Enable'} case match`;

  return (
    <Tooltip content={description}>
      <button
        onClick={() =>
          props.onCaseSensitiveToggle(
            props.caseSensitive ? LineFilterCaseSensitive.caseInsensitive : LineFilterCaseSensitive.caseSensitive
          )
        }
        className={cx(styles.button, props.caseSensitive ? styles.active : null)}
        aria-label={description}
      >
        <svg fill={fill} width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <text fontSize="13" width="16" height="16" x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
            Aa
          </text>
        </svg>
      </button>
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2, variant: IconButtonVariant = 'secondary') => {
  const hoverSize = 16 + theme.spacing.gridSize;

  return {
    active: css({
      '&:before': {
        backgroundColor:
          variant === 'secondary' ? theme.colors.action.hover : colorManipulator.alpha(theme.colors.text.primary, 0.12),
        opacity: 1,
      },
      '&:hover': {
        '&:before': {
          backgroundColor: 'none',
          opacity: 0,
        },
      },
    }),
    button: css({
      '&:before': {
        ...getIconButtonBefore(hoverSize, theme),
        position: 'absolute',
      },
      '&:focus, &:focus-visible': getFocusStyles(theme),
      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),
      '&:hover': {
        '&:before': {
          backgroundColor:
            variant === 'secondary'
              ? theme.colors.action.hover
              : colorManipulator.alpha(theme.colors.text.primary, 0.12),
          opacity: 1,
        },
      },
      alignItems: 'center',
      background: 'transparent',
      border: 'none',
      boxShadow: 'none',
      color: theme.colors.text.primary,
      display: 'inline-flex',
      justifyContent: 'center',

      margin: `0 ${theme.spacing.x0_5} 0 ${theme.spacing.x0_5}`,

      padding: 0,

      position: 'relative',
      zIndex: 0,
    }),
  };
};
