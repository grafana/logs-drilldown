import React, { ChangeEvent, KeyboardEvent, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { LineFilterCaseSensitive } from '../../services/filterTypes';
import { LineFilterEditor } from '../ServiceScene/LineFilter/LineFilterEditor';
import { RegexInputValue } from '../ServiceScene/LineFilter/RegexIconButton';

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

export function LineFilterVariable({ onClick, props }: { onClick: () => void; props: LineFilterProps }) {
  const [focus, setFocus] = useState(false);
  const styles = useStyles2(getLineFilterStyles);
  return (
    <>
      <span>
        <div className={styles.titleWrap}>
          <span>Line filter</span>
          <IconButton onClick={onClick} name={'times'} size={'xs'} aria-label={'Remove line filter'} />
        </div>
        <span className={styles.collapseWrap}>
          <LineFilterEditor {...props} focus={focus} setFocus={setFocus} type={'variable'} />
          {focus && (
            <IconButton
              className={styles.collapseBtn}
              tooltip={'Collapse'}
              size={'lg'}
              aria-label={'Collapse filter'}
              onClick={() => setFocus(false)}
              name={'table-collapse-all'}
            />
          )}
        </span>
      </span>
    </>
  );
}

const getLineFilterStyles = (theme: GrafanaTheme2) => ({
  collapseBtn: css({
    marginLeft: theme.spacing(1),
  }),
  collapseWrap: css({
    display: 'flex',
  }),
  titleWrap: css({
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  }),
});
