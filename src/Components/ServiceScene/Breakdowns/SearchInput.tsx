import React, { HTMLProps } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, Input, useStyles2 } from '@grafana/ui';

interface Props extends Omit<HTMLProps<HTMLInputElement>, 'prefix' | 'width'> {
  onClear?: () => void;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const SearchInput = ({ onChange, onClear, placeholder, suffix, value, ...rest }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <Input
      value={value}
      onChange={onChange}
      suffix={
        <span className={styles.suffixWrapper}>
          {onClear && value ? (
            <IconButton
              aria-label={'Clear search'}
              tooltip={'Clear search'}
              onClick={onClear}
              name="times"
              className={styles.clearIcon}
            />
          ) : undefined}
          {suffix && suffix}
        </span>
      }
      prefix={<Icon name="search" />}
      placeholder={placeholder}
      {...rest}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  clearIcon: css({
    cursor: 'pointer',
  }),
  suffixWrapper: css({
    display: 'inline-flex',
    gap: theme.spacing(0.5),
  }),
});
