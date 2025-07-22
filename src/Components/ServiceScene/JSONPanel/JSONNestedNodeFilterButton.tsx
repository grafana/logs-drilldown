import React, { useMemo } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { JSONLogsScene } from '../JSONLogsScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { addJSONFieldFilter } from 'services/JSONFilter';
import { EMPTY_VARIABLE_VALUE, VAR_FIELDS } from 'services/variables';

interface Props {
  active: boolean;
  fullKeyPath: string;
  keyPath: KeyPath;
  logsJsonScene: JSONLogsScene;
  type: 'exclude' | 'include';
}

export function JSONNestedNodeFilterButton({ active, fullKeyPath, keyPath, type, logsJsonScene }: Props) {
  const styles = useStyles2(getJSONFilterButtonStyles, active);
  return useMemo(
    () => (
      <IconButton
        className={styles.button}
        tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines that contain ${keyPath[0]}`}
        onClick={(e) => {
          e.stopPropagation();
          addJSONFieldFilter({
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
    ),
    [active, keyPath, fullKeyPath, logsJsonScene, styles.button, type]
  );
}

export const getJSONFilterButtonStyles = (theme: GrafanaTheme2, isActive: boolean) => {
  return {
    button: css({
      color: isActive ? undefined : theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.maxContrast,
      },
    }),
  };
};
