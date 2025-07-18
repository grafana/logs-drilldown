import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import { JSONLogsScene } from '../JSONLogsScene';
import { FilterValueButton } from './JSONFilterValueButton';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { addJsonFilter } from 'services/JSONFilter';
import { isOperatorExclusive, isOperatorInclusive } from 'services/operatorHelpers';

interface Props {
  addJsonFilter: typeof addJsonFilter;
  existingFilter: AdHocFilterWithLabels[];
  keyPath: KeyPath;
  label: string | number;
  model: JSONLogsScene;
  value: string;
  variableType: InterpolatedFilterType;
}

/**
 * Technically labels and metadata nodes
 * @param addJsonFilter
 * @param existingFilter
 * @param keyPath
 * @param label
 * @param model
 * @param value
 * @param variableType
 * @constructor
 */
export function JSONMetadataButtons({
  addJsonFilter,
  existingFilter,
  keyPath,
  label,
  model,
  value,
  variableType,
}: Props) {
  const isFilterInclusive = (filter: AdHocFilterWithLabels) => isOperatorInclusive(filter.operator);
  const isFilterExclusive = (filter: AdHocFilterWithLabels) => isOperatorExclusive(filter.operator);
  return (
    <>
      {/* Include */}
      <FilterValueButton
        label={label.toString()}
        value={value}
        variableType={variableType}
        addJsonFilter={addJsonFilter}
        existingFilter={existingFilter.find(isFilterInclusive)}
        type={'include'}
        model={model}
        keyPath={keyPath}
      />
      {/* Exclude */}
      <FilterValueButton
        label={label.toString()}
        value={value}
        variableType={variableType}
        addJsonFilter={addJsonFilter}
        existingFilter={existingFilter.find(isFilterExclusive)}
        type={'exclude'}
        model={model}
        keyPath={keyPath}
      />
    </>
  );
}
