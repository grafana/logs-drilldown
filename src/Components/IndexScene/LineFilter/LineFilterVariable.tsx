import React, { ChangeEvent, KeyboardEvent, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, IconButton, Tooltip, useStyles2 } from '@grafana/ui';

import { LineFilterEditor } from './LineFilterEditor';
import { RegexInputValue } from './RegexIconButton';
import { LineFilterCaseSensitive } from 'services/filterTypes';

/** First filter only shows remove (×) when this is true. */
export const lineFilterHasValueToClear = (lineFilter: string | undefined): boolean =>
  (lineFilter?.trim() ?? '').length > 0;

export interface LineFilterProps {
  caseSensitive: boolean;
  exclusive: boolean;
  handleEnter: (e: KeyboardEvent<HTMLInputElement>, lineFilter: string) => void;
  lineFilter: string;
  onCaseSensitiveToggle: (caseSensitive: LineFilterCaseSensitive) => void;
  onClearLineFilter?: () => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRegexToggle: (regex: RegexInputValue) => void;
  onSubmitLineFilter?: () => void;
  regex: boolean;
  setExclusive: (exclusive: boolean) => void;
  updateFilter: (lineFilter: string, debounced: boolean) => void;
}

export function LineFilterVariable({
  isFirstLineFilterRow,
  onClick,
  props,
}: {
  isFirstLineFilterRow: boolean;
  onClick?: () => void;
  props: LineFilterProps;
}) {
  const [focus, setFocus] = useState(false);
  const styles = useStyles2(getLineFilterStyles);
  const showRemove = onClick != null && (isFirstLineFilterRow ? lineFilterHasValueToClear(props.lineFilter) : true);

  return (
    <>
      <div>
        <div className={styles.titleWrap}>
          <div className={styles.titleLabel}>
            <Trans i18nKey="components.index-scene.line-filter-variable.line-filter">Line filter</Trans>
            {isFirstLineFilterRow && (
              <Tooltip
                content={t(
                  'components.index-scene.line-filter-variable.description-line-filter',
                  'Match or exclude text in the log line body. You can use plain text, RE2 regular expressions, and case sensitivity.'
                )}
              >
                <Icon className={styles.titleInfoIcon} name="info-circle" />
              </Tooltip>
            )}
          </div>
          {showRemove && (
            <IconButton
              onClick={onClick}
              name={'times'}
              size={'xs'}
              aria-label={t(
                'components.index-scene.line-filter-variable.aria-label-remove-line-filter',
                'Remove line filter'
              )}
            />
          )}
        </div>
        <div className={styles.editorWrap}>
          <LineFilterEditor {...props} focus={focus} setFocus={setFocus} type={'variable'} />
        </div>
      </div>
    </>
  );
}

const getLineFilterStyles = (theme: GrafanaTheme2) => ({
  editorWrap: css({
    display: 'flex',
  }),
  titleInfoIcon: css({
    cursor: 'help',
    marginLeft: theme.spacing(0.5),
    verticalAlign: 'text-bottom',
    color: theme.colors.text.disabled,
  }),
  titleLabel: css({
    alignItems: 'center',
    display: 'inline-flex',
  }),
  titleWrap: css({
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  }),
});
