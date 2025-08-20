import * as React from 'react';
import { useMemo } from 'react';

import { css, cx } from '@emotion/css';

import { colorManipulator, GrafanaTheme2 } from '@grafana/data';
import { PopoverContent, Tooltip, useStyles2 } from '@grafana/ui';

// Dark theme
import copyDark from 'img/icons/dark/copy.svg';
import copyHoverDark from 'img/icons/dark/copy--hover.svg';
import eyeDark from 'img/icons/dark/eye.svg';
import eyeHoverDark from 'img/icons/dark/eye--hover.svg';
import searchMinusDark from 'img/icons/dark/search-minus.svg';
import searchMinusHoverDark from 'img/icons/dark/search-minus--hover.svg';
import searchPlusDark from 'img/icons/dark/search-plus.svg';
import searchPlusHoverDark from 'img/icons/dark/search-plus--hover.svg';
import shareAltDark from 'img/icons/dark/share-alt.svg';
import shareAltHoverDark from 'img/icons/dark/share-alt--hover.svg';
import eyeActive from 'img/icons/eye--active.svg';
// Light theme
import copyLight from 'img/icons/light/copy.svg';
import copyHoverLight from 'img/icons/light/copy--hover.svg';
import eyeLight from 'img/icons/light/eye.svg';
import eyeHoverLight from 'img/icons/light/eye--hover.svg';
import searchMinusLight from 'img/icons/light/search-minus.svg';
import searchMinusHoverLight from 'img/icons/light/search-minus--hover.svg';
import searchPlusLight from 'img/icons/light/search-plus.svg';
import searchPlusHoverLight from 'img/icons/light/search-plus--hover.svg';
import shareAltLight from 'img/icons/light/share-alt.svg';
import shareAltHoverLight from 'img/icons/light/share-alt--hover.svg';
import searchMinusActive from 'img/icons/search-minus--active.svg';
import searchPlusActive from 'img/icons/search-plus--active.svg';

type ThemeVariant = 'dark' | 'light';
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

type Images = Record<IconName, Record<ThemeVariant, Record<IconButtonVariant | 'hover', string>>>;

const images: Images = {
  eye: {
    dark: {
      secondary: eyeDark,
      primary: eyeActive,
      hover: eyeHoverDark,
    },
    light: {
      secondary: eyeLight,
      primary: eyeActive,
      hover: eyeHoverLight,
    },
  },
  'search-minus': {
    dark: {
      secondary: searchMinusDark,
      primary: searchMinusActive,
      hover: searchMinusHoverDark,
    },
    light: {
      secondary: searchMinusLight,
      primary: searchMinusActive,
      hover: searchMinusHoverLight,
    },
  },
  'search-plus': {
    dark: {
      secondary: searchPlusDark,
      primary: searchPlusActive,
      hover: searchPlusHoverDark,
    },
    light: {
      secondary: searchPlusLight,
      primary: searchPlusActive,
      hover: searchPlusHoverLight,
    },
  },
  'share-alt': {
    dark: {
      secondary: shareAltDark,
      hover: shareAltHoverDark,
      // Unused
      primary: '',
    },
    light: {
      secondary: shareAltLight,
      hover: shareAltHoverLight,
      // Unused
      primary: '',
    },
  },
  copy: {
    dark: {
      secondary: copyDark,
      hover: copyHoverDark,
      // Unused
      primary: '',
    },
    light: {
      secondary: copyLight,
      hover: copyHoverLight,
      // Unused
      primary: '',
    },
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

  console.log('secondary theme.colors.action.hover', theme.colors.action.hover);
  console.log('primary colorManipulator.alpha(iconColor, 0.12)', colorManipulator.alpha(iconColor, 0.12));

  const themeType = theme.isDark ? 'dark' : 'light';

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
      backgroundImage:
        variant === 'primary' ? `url(${images[name][themeType].primary})` : `url(${images[name][themeType].secondary})`,
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
        backgroundImage: `url(${images[name][themeType].hover})`,
        '&:before': {
          backgroundColor:
            variant === 'secondary' ? theme.colors.action.hover : colorManipulator.alpha(iconColor, 0.12),
          opacity: 1,
        },
      },
    }),
  };
};
