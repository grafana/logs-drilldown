import React, { memo } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { AdHocFilterWithLabels } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';

import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import { JSONLogsScene } from '../JSONLogsScene';
import { LogsListScene } from '../LogsListScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { FilterOp } from 'services/filterTypes';
import { addJsonFieldFilter, addJsonMetadataFilter } from 'services/JSONFilter';
import { VAR_FIELDS } from 'services/variables';

interface JsonFilterProps {
  addJsonFilter: typeof addJsonFieldFilter;
  existingFilter?: AdHocFilterWithLabels;
  fullKey: string;
  keyPath: KeyPath;
  label: string | number;
  model: JSONLogsScene;
  type: 'exclude' | 'include';
  value: string;
}

interface MetadataFilterProps {
  existingFilter?: AdHocFilterWithLabels;
  keyPath: KeyPath;
  label: string;
  logsListScene: LogsListScene;
  type: 'exclude' | 'include';
  value: string;
  variableType: InterpolatedFilterType;
}
export const JSONFilterValueButton = memo(
  ({ addJsonFilter, existingFilter, fullKey, keyPath, label, type, value, model }: JsonFilterProps) => {
    const operator = type === 'include' ? FilterOp.Equal : FilterOp.NotEqual;
    const isActive = existingFilter?.operator === operator;
    const styles = useStyles2(getStyles, isActive);

    return (
      <IconButton
        className={styles.button}
        tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines containing ${label}="${value}"`}
        onClick={(e) => {
          e.stopPropagation();
          addJsonFilter({
            keyPath: keyPath,
            key: fullKey,
            value,
            filterType: existingFilter?.operator === operator ? 'toggle' : type,
            logsJsonScene: model,
            variableType: VAR_FIELDS,
          });
        }}
        aria-selected={isActive}
        variant={isActive ? 'primary' : 'secondary'}
        size={'md'}
        name={type === 'include' ? 'search-plus' : 'search-minus'}
        aria-label={`${type} filter`}
      />
    );
  }
);
JSONFilterValueButton.displayName = 'JSONFilterValueButton';

export const JSONMetadataButton = memo(
  ({ existingFilter, label, type, value, variableType, logsListScene }: MetadataFilterProps) => {
    const operator = type === 'include' ? FilterOp.Equal : FilterOp.NotEqual;
    const isActive = existingFilter?.operator === operator;
    const styles = useStyles2(getStyles, isActive);

    return (
      <IconButton
        className={styles.button}
        tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines containing ${label}="${value}"`}
        onClick={(e) => {
          e.stopPropagation();

          addJsonMetadataFilter({
            label,
            value,
            filterType: existingFilter?.operator === operator ? 'toggle' : type,
            variableType,
            logsListScene,
          });
        }}
        aria-selected={existingFilter?.operator === operator}
        variant={existingFilter?.operator === operator ? 'primary' : 'secondary'}
        size={'md'}
        name={type === 'include' ? 'search-plus' : 'search-minus'}
        aria-label={`${type} filter`}
      />
    );
  }
);
JSONMetadataButton.displayName = 'FilterValueButton';

const getStyles = (theme: GrafanaTheme2, isActive: boolean) => {
  return {
    button: css({
      color: isActive ? undefined : theme.colors.text.secondary,
    }),
  };
};
