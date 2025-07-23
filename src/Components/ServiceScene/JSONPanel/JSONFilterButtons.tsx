import React, { lazy, memo, useMemo } from 'react';

import { AdHocFilterWithLabels, SceneObject } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import { JSONLogsScene } from '../JSONLogsScene';
import { getJSONFilterButtonStyles } from './JSONNestedNodeFilterButton';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { FilterOp } from 'services/filterTypes';
import { addJSONFieldFilter, addJSONMetadataFilter } from 'services/JSONFilter';
import { VAR_FIELDS } from 'services/variables';

const ImgButton = lazy(() => import('../../UI/ImgButton'));

interface JsonFilterProps {
  existingFilter?: AdHocFilterWithLabels;
  fullKey: string;
  keyPath: KeyPath;
  label: string | number;
  model: JSONLogsScene;
  type: 'exclude' | 'include';
  value: string;
}

export const JSONFieldValueButton = memo(
  ({ existingFilter, fullKey, keyPath, label, type, value, model }: JsonFilterProps) => {
    const operator = type === 'include' ? FilterOp.Equal : FilterOp.NotEqual;
    const isActive = existingFilter?.operator === operator;
    const styles = useStyles2(getJSONFilterButtonStyles, isActive);
    const selected = existingFilter?.operator === operator;

    return useMemo(
      () => (
        <ImgButton
          className={styles.button}
          tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines containing ${label}="${value}"`}
          onClick={(e) => {
            e.stopPropagation();
            addJSONFieldFilter({
              keyPath: keyPath,
              key: fullKey,
              value,
              filterType: selected ? 'toggle' : type,
              logsJsonScene: model,
              variableType: VAR_FIELDS,
            });
          }}
          aria-selected={isActive}
          variant={isActive ? 'primary' : 'secondary'}
          name={type === 'include' ? 'search-plus' : 'search-minus'}
          aria-label={`${type} filter`}
        />
      ),
      [isActive, selected, type, styles.button, keyPath, fullKey, value, label, model]
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
    const selected = existingFilter?.operator === operator;

    return useMemo(
      () => (
        <ImgButton
          className={styles.button}
          tooltip={`${type === 'include' ? 'Include' : 'Exclude'} log lines containing ${label}="${value}"`}
          onClick={(e) => {
            e.stopPropagation();

            addJSONMetadataFilter({
              label,
              value,
              filterType: selected ? 'toggle' : type,
              variableType,
              sceneRef,
            });
          }}
          aria-selected={selected}
          variant={selected ? 'primary' : 'secondary'}
          name={type === 'include' ? 'search-plus' : 'search-minus'}
          aria-label={`${type} filter`}
        />
      ),
      [selected, label, sceneRef, styles.button, type, value, variableType]
    );
  }
);
JSONMetadataButton.displayName = 'JSONMetadataButton';
