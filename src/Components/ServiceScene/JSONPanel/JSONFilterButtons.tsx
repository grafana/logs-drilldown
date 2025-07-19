import React, { memo } from 'react';

import { AdHocFilterWithLabels, SceneObject } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';

import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import { JSONLogsScene } from '../JSONLogsScene';
import { getJSONFilterButtonStyles } from './JSONNestedNodeFilterButton';
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

export const JSONFieldValueButton = memo(
  ({ addJsonFilter, existingFilter, fullKey, keyPath, label, type, value, model }: JsonFilterProps) => {
    const operator = type === 'include' ? FilterOp.Equal : FilterOp.NotEqual;
    const isActive = existingFilter?.operator === operator;
    const styles = useStyles2(getJSONFilterButtonStyles, isActive);

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
JSONFieldValueButton.displayName = 'JSONFilterValueButton';

interface MetadataFilterProps {
  existingFilter?: AdHocFilterWithLabels;
  label: string;
  sceneRef: SceneObject;
  type: 'exclude' | 'include';
  value: string;
  variableType: InterpolatedFilterType;
}

export const JSONMetadataButton = memo(
  ({ existingFilter, label, type, value, variableType, sceneRef }: MetadataFilterProps) => {
    const operator = type === 'include' ? FilterOp.Equal : FilterOp.NotEqual;
    const isActive = existingFilter?.operator === operator;
    const styles = useStyles2(getJSONFilterButtonStyles, isActive);

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
            sceneRef,
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
JSONMetadataButton.displayName = 'JSONMetadataButton';
