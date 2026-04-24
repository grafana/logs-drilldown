import React, { ChangeEvent, KeyboardEvent, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

import { LineFilterCaseSensitive } from '../../services/filterTypes';
import { LineFilterEditor } from '../ServiceScene/LineFilter/LineFilterEditor';
import { RegexInputValue } from '../ServiceScene/LineFilter/RegexIconButton';

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
      <span>
        <div className={styles.titleWrap}>
          <span>
            <Trans i18nKey="components.index-scene.line-filter-variable.line-filter">Line filter</Trans>
          </span>
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
        <span className={styles.editorWrap}>
          <LineFilterEditor {...props} focus={focus} setFocus={setFocus} type={'variable'} />
        </span>
      </span>
    </>
  );
}

const getLineFilterStyles = (theme: GrafanaTheme2) => ({
  editorWrap: css({
    display: 'flex',
  }),
  titleWrap: css({
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  }),
});
