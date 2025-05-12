import React, { useEffect, useState } from 'react';

import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Select, useStyles2 } from '@grafana/ui';

import { testIds } from '../../../services/testIds';
import { LineFilterProps } from '../../IndexScene/LineFilterVariable';
import { LineFilterInput } from '../Breakdowns/LineFilterInput';
import { LineFilterCaseSensitivityButton } from './LineFilterCaseSensitivityButton';
import { RegexIconButton } from './RegexIconButton';

export interface LineFilterEditorProps extends LineFilterProps {
  focus: boolean;
  setFocus: (focus: boolean) => void;
  type: 'editor' | 'variable';
}

const INITIAL_INPUT_WIDTH = 30;

export function LineFilterEditor({
  caseSensitive,
  exclusive,
  focus,
  handleEnter,
  lineFilter,
  onCaseSensitiveToggle,
  onClearLineFilter,
  onInputChange,
  onRegexToggle,
  onSubmitLineFilter,
  regex,
  setExclusive,
  setFocus,
  type,
}: LineFilterEditorProps) {
  const styles = useStyles2((theme) => getStyles(theme, type));
  const [width, setWidth] = useState(INITIAL_INPUT_WIDTH);

  function resize(content?: string) {
    // The input width roughly corresponds to char count
    const width = Math.max(content?.length ?? 0, INITIAL_INPUT_WIDTH);
    // We add a few extra because the buttons are absolutely positioned within the input width
    setWidth(width + 9);
  }

  useEffect(() => {
    resize(lineFilter);
  }, [lineFilter, focus]);

  return (
    <div className={styles.wrapper}>
      {!onSubmitLineFilter && (
        <Select
          prefix={null}
          className={styles.select}
          value={exclusive ? 'exclusive' : 'inclusive'}
          options={[
            {
              label: 'Exclude',
              value: 'exclusive',
            },
            {
              label: 'Include',
              value: 'inclusive',
            },
          ]}
          onChange={() => setExclusive(!exclusive)}
        />
      )}
      <Field className={styles.field}>
        <LineFilterInput
          regex={regex}
          // Only set width if focused
          width={focus ? width : undefined}
          onFocus={() => setFocus(true)}
          data-testid={testIds.exploreServiceDetails.searchLogs}
          value={lineFilter ?? ''}
          className={cx(onSubmitLineFilter ? styles.inputNoBorderRight : undefined, styles.input)}
          onChange={onInputChange}
          suffix={
            <span className={`${styles.suffix} input-suffix`}>
              <LineFilterCaseSensitivityButton
                caseSensitive={caseSensitive}
                onCaseSensitiveToggle={onCaseSensitiveToggle}
              />
              <RegexIconButton regex={regex} onRegexToggle={onRegexToggle} />
            </span>
          }
          prefix={null}
          placeholder="Search in log lines"
          onClear={onClearLineFilter}
          onKeyUp={(e) => {
            handleEnter(e, lineFilter);
            resize(lineFilter);
          }}
        />
      </Field>
      {onSubmitLineFilter && (
        <span className={styles.buttonWrap}>
          <Button
            onClick={() => {
              setExclusive(false);
              onSubmitLineFilter();
            }}
            className={styles.includeButton}
            variant={'secondary'}
            fill={'outline'}
            disabled={!lineFilter}
          >
            Include
          </Button>
          <Button
            onClick={() => {
              setExclusive(true);
              onSubmitLineFilter();
            }}
            className={styles.excludeButton}
            variant={'secondary'}
            fill={'outline'}
            disabled={!lineFilter}
          >
            Exclude
          </Button>
        </span>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, type: 'editor' | 'variable') => ({
  buttonWrap: css({
    display: 'flex',
    justifyContent: 'center',
  }),
  excludeButton: css({
    '&[disabled]': {
      borderLeft: 'none',
    },
    borderLeft: 'none',
    borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
  }),
  exclusiveBtn: css({
    marginRight: '1rem',
  }),
  field: css({
    flex: '0 1 auto',
    label: 'field',
    marginBottom: 0,
  }),
  includeButton: css({
    '&[disabled]': {
      borderRight: 'none',
    },
    borderLeft: 'none',
    borderRadius: 0,
    borderRight: 'none',
  }),
  input: css({
    input: {
      borderBottomLeftRadius: 0,
      borderTopLeftRadius: 0,
      fontFamily: 'monospace',
      fontSize: theme.typography.bodySmall.fontSize,
      width: '100%',
    },
    label: 'line-filter-input-wrapper',

    // Keeps the input from overflowing container on resize
    maxWidth: type === 'editor' ? 'calc(100vw - 198px)' : 'calc(100vw - 288px)',

    minWidth: '200px',
  }),
  inputNoBorderRight: css({
    input: {
      borderBottomRightRadius: 0,
      borderTopRightRadius: 0,
    },
  }),
  removeBtn: css({
    borderBottomLeftRadius: 0,
    borderTopLeftRadius: 0,
  }),
  select: css({
    borderBottomRightRadius: '0',
    borderRight: 'none',
    borderTopRightRadius: '0',
    height: 'auto',
    label: 'line-filter-exclusion',
    marginLeft: 0,
    maxWidth: '95px',
    minHeight: '30px',
    minWidth: '95px',
    outline: 'none',
    paddingLeft: 0,
  }),
  submit: css({
    borderBottomLeftRadius: 0,
    borderTopLeftRadius: 0,
  }),
  suffix: css({
    display: 'inline-flex',
    gap: theme.spacing(0.5),
  }),
  wrapper: css({
    display: 'flex',
    width: '100%',
  }),
});
