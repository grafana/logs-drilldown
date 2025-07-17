import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import { LogsJsonScene } from '../LogsJsonScene';
import { FilterValueButton } from './JSONFilterValueButton';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { addJsonFilter } from 'services/JSONFilter';
import { jsonLabelButtonsWrapStyle, jsonLabelWrapStyles } from 'services/JSONViz';
import { isOperatorExclusive, isOperatorInclusive } from 'services/operatorHelpers';

interface Props {
  addJsonFilter: typeof addJsonFilter;
  elements: Array<string | React.JSX.Element>;
  existingFilter: AdHocFilterWithLabels[];
  keyPath: KeyPath;
  keyPathString: string | number;
  label: string | number;
  model: LogsJsonScene;
  value: string;
  variableType: InterpolatedFilterType;
}

export function FieldNodeLabelButtons({
  addJsonFilter,
  elements,
  existingFilter,
  keyPath,
  keyPathString,
  label,
  model,
  value,
  variableType,
}: Props) {
  const isFilterInclusive = (filter: AdHocFilterWithLabels) => isOperatorInclusive(filter.operator);
  const isFilterExclusive = (filter: AdHocFilterWithLabels) => isOperatorExclusive(filter.operator);
  return (
    <span className={jsonLabelButtonsWrapStyle}>
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
      <strong className={jsonLabelWrapStyles}>{elements.length ? elements : keyPathString}:</strong>
    </span>
  );
}
