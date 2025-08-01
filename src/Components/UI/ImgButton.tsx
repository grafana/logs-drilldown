import * as React from 'react';
import { useMemo } from 'react';

import { css, cx } from '@emotion/css';

import { colorManipulator, GrafanaTheme2 } from '@grafana/data';
import { PopoverContent, Tooltip, useStyles2 } from '@grafana/ui';

import copy from 'img/icons/copy.svg';
import copyHover from 'img/icons/copy--hover.svg';
import eye from 'img/icons/eye.svg';
import eyeActive from 'img/icons/eye--active.svg';
import eyeHover from 'img/icons/eye--hover.svg';
import searchMinus from 'img/icons/search-minus.svg';
import searchMinusActive from 'img/icons/search-minus--active.svg';
import searchMinusHover from 'img/icons/search-minus--hover.svg';
import searchPlus from 'img/icons/search-plus.svg';
import searchPlusActive from 'img/icons/search-plus--active.svg';
import searchPlusHover from 'img/icons/search-plus--hover.svg';
import shareAlt from 'img/icons/share-alt.svg';
import shareAltHover from 'img/icons/share-alt--hover.svg';

type IconButtonVariant = 'primary' | 'secondary';
type IconName = 'copy' | 'eye' | 'search-minus' | 'search-plus' | 'share-alt';

interface BaseProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Name of the icon **/
  name: IconName;
  /** Variant to change the color of the Icon */
  variant?: IconButtonVariant;
}

export interface BasePropsWithTooltip extends BaseProps {
  /** Tooltip content to display on hover and as the aria-label */
  tooltip: PopoverContent;
}

type Images = Record<IconName, Record<IconButtonVariant | 'hover', string>>;

const images: Images = {
  eye: {
    secondary: eye,
    primary: eyeActive,
    hover: eyeHover,
  },
  'search-minus': {
    secondary: searchMinus,
    primary: searchMinusActive,
    hover: searchMinusHover,
  },
  'search-plus': {
    secondary: searchPlus,
    primary: searchPlusActive,
    hover: searchPlusHover,
  },
  'share-alt': {
    secondary: shareAlt,
    hover: shareAltHover,
    // Unused
    primary: '',
  },
  copy: {
    secondary: copy,
    hover: copyHover,
    // Unused
    primary: '',
  },
};

const ImgButton = React.forwardRef<HTMLButtonElement, BasePropsWithTooltip>((props, ref) => {
  const { variant = 'secondary', name, className, tooltip, ...restProps } = props;

  const styles = useStyles2(getStyles, variant, name, images);

  let ariaLabel: string | undefined;
  let buttonRef: typeof ref | undefined;
  ariaLabel = typeof tooltip === 'string' ? tooltip : undefined;

  // When using tooltip, ref is forwarded to Tooltip component instead for https://github.com/grafana/grafana/issues/65632
  return useMemo(
    () => (
      <Tooltip ref={ref} content={tooltip}>
        <button
          {...restProps}
          ref={buttonRef}
          aria-label={ariaLabel}
          className={cx(styles.button, className)}
          type="button"
        >
          <span className={styles.img}></span>
        </button>
      </Tooltip>
    ),
    [ariaLabel, ref, className, restProps, styles, tooltip, buttonRef]
  );
});
ImgButton.displayName = 'ImgButton';
export default ImgButton;

const getStyles = (theme: GrafanaTheme2, variant: IconButtonVariant, name: IconName, images: Images) => {
  let iconColor = theme.colors.text.primary;

  if (variant === 'primary') {
    iconColor = theme.colors.primary.text;
  }

  return {
    button: css({
      zIndex: 0,
      position: 'relative',
      margin: `0 ${theme.spacing.x0_5} 0 0`,
      boxShadow: 'none',
      border: 'none',
      display: 'inline-flex',
      background: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 0,
      color: iconColor,

      '&[disabled], &:disabled': {
        cursor: 'not-allowed',
        color: theme.colors.action.disabledText,
        opacity: 0.65,
      },

      '&:focus, &:focus-visible': {
        outline: '2px dotted transparent',
        outlineOffset: '2px',
        boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main}`,
        transitionTimingFunction: `cubic-bezier(0.19, 1, 0.22, 1)`,
        transitionDuration: '0.2s',
        transitionProperty: 'outline, outline-offset, box-shadow',
      },

      '&:focus:not(:focus-visible)': {
        outline: 'none',
        boxShadow: `none`,
      },
    }),
    icon: css({
      verticalAlign: 'baseline',
    }),
    img: css({
      backgroundImage: variant === 'primary' ? `url(${images[name].primary})` : `url(${images[name].secondary})`,
      width: '16px',
      height: '16px',

      '&:before': {
        width: '16px',
        height: '16px',
        left: 0,
        zIndex: -1,
        position: 'absolute',
        opacity: 0,
        borderRadius: theme.shape.radius.default,
        content: '""',
        transform: 'scale(1.45)',
        [theme.transitions.handleMotion('no-preference', 'reduce')]: {
          transitionDuration: '0.2s',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          transitionProperty: 'opacity',
        },
      },

      '&:hover': {
        backgroundImage: `url(${images[name].hover})`,
        '&:before': {
          backgroundColor:
            variant === 'secondary' ? theme.colors.action.hover : colorManipulator.alpha(iconColor, 0.12),
          opacity: 1,
        },
      },
    }),
  };
};
