import { css } from '@emotion/css';
import { Icon, IconButton, Input, Tooltip, useStyles2 } from '@grafana/ui';
import React, { ChangeEvent, HTMLProps, useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { narrowErrorMessage } from '../../../services/narrowing';

interface Props extends Omit<HTMLProps<HTMLInputElement>, 'width' | 'prefix' | 'invalid' | 'onInvalid'> {
  onClear?: () => void;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
  width?: number;
  regex: boolean;
  value: string;
}

let re2JS: typeof import('re2js').RE2JS | undefined | null = undefined;

export const LineFilterInput = ({ value, onChange, placeholder, onClear, suffix, width, regex, ...rest }: Props) => {
  const styles = useStyles2(getStyles);
  const [invalid, setInvalid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const load = async () => {
    re2JS = null;
    re2JS = (await import('re2js')).RE2JS;
  };

  const initValidation = (value: string) => {
    if (re2JS === undefined && regex) {
      load().then(() => validate(value));
    } else if (regex && re2JS) {
      validate(value);
    }
  };

  const validate = (value: string) => {
    if (value) {
      try {
        re2JS?.compile(value);
        if (invalid) {
          setInvalid(false);
          setErrorMessage('');
        }
      } catch (e) {
        const msg = narrowErrorMessage(e);
        if (!invalid) {
          setInvalid(true);
        }

        if (msg && msg !== errorMessage) {
          setErrorMessage(msg);
        }
      }
    } else if (invalid) {
      setInvalid(false);
    }
  };

  initValidation(value);

  return (
    <Tooltip placement={'auto-start'} show={!!errorMessage && invalid} content={errorMessage}>
      <Input
        invalid={invalid}
        rows={2}
        width={width}
        value={value}
        onChange={async (e: ChangeEvent<HTMLInputElement>) => {
          if (onChange) {
            onChange(e);
          }
          initValidation(value);
        }}
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

const getStyles = (theme: GrafanaTheme2) => ({
  suffixWrapper: css({
    gap: theme.spacing(0.5),
    display: 'inline-flex',
  }),
  clearIcon: css({
    cursor: 'pointer',
  }),
});
