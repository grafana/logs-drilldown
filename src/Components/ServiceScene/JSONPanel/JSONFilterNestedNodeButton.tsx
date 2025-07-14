import React, { memo } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { AddJSONFilter } from '../LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { EMPTY_VARIABLE_VALUE } from 'services/variables';

interface Props {
  active: boolean;
  addFilter: AddJSONFilter;
  jsonKey: string;
  keyPath: KeyPath;
  type: 'exclude' | 'include';
}

const JSONFilterNestedNodeButton = memo(({ active, addFilter, jsonKey, keyPath, type }: Props) => {
  const styles = useStyles2(getStyles, active);
  return (
    <IconButton
      className={styles.button}
      tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines that contain ${keyPath[0]}`}
      onClick={(e) => {
        e.stopPropagation();
        addFilter(
          keyPath,
          jsonKey,
          EMPTY_VARIABLE_VALUE,
          active ? 'toggle' : type === 'include' ? 'exclude' : 'include'
        );
      }}
      aria-selected={active}
      variant={active ? 'primary' : 'secondary'}
      size={'md'}
      name={type === 'include' ? 'search-plus' : 'search-minus'}
      aria-label={`${type} filter`}
    />
  );
});

const getStyles = (theme: GrafanaTheme2, isActive: boolean) => {
  return {
    button: css({
      color: isActive ? undefined : 'var(--json-tree-label-color)',
    }),
  };
};

JSONFilterNestedNodeButton.displayName = 'JSONFilterNestedNodeButton';
export default JSONFilterNestedNodeButton;
