import React, { lazy, useMemo } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { JSONLogsScene } from '../JSONLogsScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { addJSONFieldFilter } from 'services/JSONFilter';
import { EMPTY_VARIABLE_VALUE, VAR_FIELDS } from 'services/variables';
const ImgButton = lazy(() => import('../../UI/ImgButton'));

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
      <ImgButton
        className={styles.button}
        tooltip={
          type === 'include'
            ? t('components.json-nested-node-filter-button.tooltip.include', 'Include log lines that contain {{key}}', {
                key: keyPath[0],
              })
            : t('components.json-nested-node-filter-button.tooltip.exclude', 'Exclude log lines that contain {{key}}', {
                key: keyPath[0],
              })
        }
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
        name={type === 'include' ? 'search-plus' : 'search-minus'}
        aria-label={
          type === 'include'
            ? t('components.json-nested-node-filter-button.aria-label.include', 'include filter')
            : t('components.json-nested-node-filter-button.aria-label.exclude', 'exclude filter')
        }
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
