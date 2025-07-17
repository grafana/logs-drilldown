import React, { memo } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { AdHocFilterWithLabels } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';

import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import { LogsJsonScene } from '../LogsJsonScene';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { FilterOp } from 'services/filterTypes';
import { addJsonFilter } from 'services/JSONFilter';
import { VAR_FIELDS } from 'services/variables';

interface JsonFilterProps {
  addFilter: typeof addJsonFilter;
  existingFilter?: AdHocFilterWithLabels;
  fullKey: string;
  keyPath: KeyPath;
  label: string | number;
  model: LogsJsonScene;
  type: 'exclude' | 'include';
  value: string;
}

interface MetadataFilterProps {
  addFilter: typeof addJsonFilter;
  existingFilter?: AdHocFilterWithLabels;
  keyPath: KeyPath;
  label: string;
  model: LogsJsonScene;
  type: 'exclude' | 'include';
  value: string;
  variableType: InterpolatedFilterType;
}
export const JSONFilterValueButton = memo(
  ({ addFilter, existingFilter, fullKey, keyPath, label, type, value, model }: JsonFilterProps) => {
    const operator = type === 'include' ? FilterOp.Equal : FilterOp.NotEqual;
    const isActive = existingFilter?.operator === operator;
    const styles = useStyles2(getStyles, isActive);

    return (
      <IconButton
        className={styles.button}
        tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines containing ${label}="${value}"`}
        onClick={(e) => {
          e.stopPropagation();
          addFilter({
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

export const FilterValueButton = memo(
  ({ addFilter, existingFilter, label, type, value, variableType, model, keyPath }: MetadataFilterProps) => {
    const operator = type === 'include' ? FilterOp.Equal : FilterOp.NotEqual;
    const isActive = existingFilter?.operator === operator;
    const styles = useStyles2(getStyles, isActive);

    return (
      <IconButton
        className={styles.button}
        tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines containing ${label}="${value}"`}
        onClick={(e) => {
          e.stopPropagation();
          addFilter({
            key: label,
            keyPath,
            value,
            filterType: existingFilter?.operator === operator ? 'toggle' : type,
            variableType,
            logsJsonScene: model,
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
FilterValueButton.displayName = 'FilterValueButton';

const getStyles = (theme: GrafanaTheme2, isActive: boolean) => {
  return {
    button: css({
      color: isActive ? undefined : theme.colors.text.secondary,
    }),
  };
};
