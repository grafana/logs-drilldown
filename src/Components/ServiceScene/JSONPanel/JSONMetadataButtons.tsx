import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import { JSONLogsScene } from '../JSONLogsScene';
import { JSONMetadataButton } from './JSONFilterValueButton';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { addJsonFieldFilter, addJsonMetadataFilter } from 'services/JSONFilter';
import { isOperatorExclusive, isOperatorInclusive } from 'services/operatorHelpers';

interface Props {
  addJsonFilter: typeof addJsonFieldFilter;
  existingFilter: AdHocFilterWithLabels[];
  keyPath: KeyPath;
  label: string | number;
  logsListScene: logsListScene;
  value: string;
  variableType: InterpolatedFilterType;
}

/**
 * Technically labels and metadata nodes
 * @param addJsonFilter
 * @param existingFilter
 * @param keyPath
 * @param label
 * @param logsListScene
 * @param value
 * @param variableType
 * @constructor
 */
export function JSONMetadataButtons({ existingFilter, keyPath, label, logsListScene, value, variableType }: Props) {
  const isFilterInclusive = (filter: AdHocFilterWithLabels) => isOperatorInclusive(filter.operator);
  const isFilterExclusive = (filter: AdHocFilterWithLabels) => isOperatorExclusive(filter.operator);
  return (
    <>
      {/* Include */}
      <JSONMetadataButton
        label={label.toString()}
        value={value}
        variableType={variableType}
        existingFilter={existingFilter.find(isFilterInclusive)}
        type={'include'}
        logsListScene={logsListScene}
        keyPath={keyPath}
      />
      {/* Exclude */}
      <JSONMetadataButton
        label={label.toString()}
        value={value}
        variableType={variableType}
        existingFilter={existingFilter.find(isFilterExclusive)}
        type={'exclude'}
        logsListScene={logsListScene}
        keyPath={keyPath}
      />
    </>
  );
}
