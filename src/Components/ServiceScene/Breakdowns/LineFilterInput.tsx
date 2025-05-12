import React, { HTMLProps, useCallback, useEffect, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, Input, Tooltip, useStyles2 } from '@grafana/ui';

import { narrowErrorMessage } from '../../../services/narrowing';

interface Props extends Omit<HTMLProps<HTMLInputElement>, 'invalid' | 'onInvalid' | 'prefix' | 'width'> {
  onClear?: () => void;
  prefix?: React.ReactNode;
  regex: boolean;
  suffix?: React.ReactNode;
  value: string;
  width?: number;
}

let re2JS: typeof import('re2js').RE2JS | undefined | null = undefined;

export const LineFilterInput = ({ onChange, onClear, placeholder, regex, suffix, value, width, ...rest }: Props) => {
  const styles = useStyles2(getStyles);
  const [invalid, setInvalid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const validate = useCallback(
    (value: string) => {
      // Do we have a value that can be validated? Check this first before attempting to load the package.
      if (!value || !regex) {
        setErrorMessage('');
        setInvalid(false);
        return;
      }

      if (re2JS === undefined) {
        load().then(() => validate(value));
        return;
      }

      try {
        re2JS?.compile(value);
        setInvalid(false);
        setErrorMessage('');
      } catch (e) {
        const msg = narrowErrorMessage(e);
        setInvalid(true);
        if (msg) {
          setErrorMessage(msg);
        }
      }
    },
    [regex]
  );

  useEffect(() => {
    validate(value);
  }, [validate, value]);

  return (
    <Tooltip placement={'auto-start'} show={!!errorMessage && invalid} content={errorMessage}>
      <Input
        invalid={invalid}
        aria-invalid={invalid}
        rows={2}
        width={width}
        onFocusCapture={(e) => {
          if (rest.onFocus) {
            rest.onFocus(e);
          }
        }}
        value={value}
        onChange={onChange}
        suffix={
          <span className={styles.suffixWrapper}>
            {onClear && value ? (
              <IconButton
                aria-label={'Clear line filter'}
                tooltip={'Clear line filter'}
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
    </Tooltip>
  );
};

const load = async () => {
  re2JS = null;
  re2JS = (await import('re2js')).RE2JS;
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
