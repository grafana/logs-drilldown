import React from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { LogsJsonScene } from '../LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { addJsonFilter } from 'services/JSONFilter';
import { EMPTY_VARIABLE_VALUE, VAR_FIELDS } from 'services/variables';

interface Props {
  active: boolean;
  fullKeyPath: string;
  keyPath: KeyPath;
  logsJsonScene: LogsJsonScene;
  type: 'exclude' | 'include';
}

export function JSONFilterNestedNodeButton({ active, fullKeyPath, keyPath, type, logsJsonScene }: Props) {
  const styles = useStyles2(getStyles, active);
  return (
    <IconButton
      className={styles.button}
      tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines that contain ${keyPath[0]}`}
      onClick={(e) => {
        e.stopPropagation();
        addJsonFilter({
          value: EMPTY_VARIABLE_VALUE,
          key: fullKeyPath,
          variableType: VAR_FIELDS,
          logsJsonScene,
          keyPath,
          filterType: active ? 'toggle' : type === 'include' ? 'exclude' : 'include',
        });
      }}
      aria-selected={active}
      variant={active ? 'primary' : 'secondary'}
      size={'md'}
      name={type === 'include' ? 'search-plus' : 'search-minus'}
      aria-label={`${type} filter`}
    />
  );
}

const getStyles = (theme: GrafanaTheme2, isActive: boolean) => {
  return {
    button: css({
      color: isActive ? undefined : theme.colors.text.secondary,
    }),
  };
};
