import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

interface LogControlOptionProps {
  expanded: boolean;
  label?: string;
  stickToBottom?: boolean;
  tooltip: string;
}

export type Props = React.ComponentProps<typeof IconButton> & LogControlOptionProps;

export const LogListControlsOption = React.forwardRef<HTMLButtonElement, Props>(
  (
    {
      stickToBottom,
      expanded,
      label,
      tooltip,
      className: iconButtonClassName,
      name: iconButtonName,
      ...iconButtonProps
    }: Props,
    ref
  ) => {
    const styles = useStyles2(getStyles, expanded);

    return (
      <div className={`${styles.container} ${stickToBottom ? styles.marginTopAuto : ''}`}>
        <label className={styles.label}>
          <span className={styles.labelText}>{label ?? tooltip}</span>
          <span className={styles.iconContainer}>
            <IconButton
              name={iconButtonName}
              tooltip={tooltip}
              className={iconButtonClassName}
              ref={ref}
              {...iconButtonProps}
            />
          </span>
        </label>
      </div>
    );
  }
);

const getStyles = (theme: GrafanaTheme2, expanded: boolean) => {
  return {
    marginTopAuto: css({
      marginTop: 'auto',
      marginBottom: theme.spacing(1),
    }),
    labelText: css({
      display: expanded ? 'block' : 'none',
    }),
    iconContainer: css({
      display: 'flex',
      alignItems: 'center',
      height: '16px',
    }),
    container: css({
      fontSize: theme.typography.pxToRem(12),
      height: theme.spacing(2),
      width: 'auto',
    }),
    label: css({
      display: 'flex',
      justifyContent: expanded ? 'space-between' : 'center',
      marginRight: expanded ? '2.5px' : 0,
    }),
  };
};

LogListControlsOption.displayName = 'LogListControlsOption';
