import React from 'react';

import { AdHocFilterWithLabels } from '@grafana/scenes';

import { addJsonFilter } from '../../../services/JSONFilter';
import { jsonLabelButtonsWrapStyle, jsonLabelWrapStyles } from '../../../services/JSONViz';
import { isOperatorExclusive, isOperatorInclusive } from '../../../services/operatorHelpers';
import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import { LogsJsonScene } from '../LogsJsonScene';
import { FilterValueButton } from './JSONFilterValueButton';
import { KeyPath } from '@gtk-grafana/react-json-tree';

export function FieldNodeLabelButtons(props: {
  addFilter: typeof addJsonFilter;
  elements: Array<string | React.JSX.Element>;
  existingFilter: AdHocFilterWithLabels[];
  keyPath: KeyPath;
  keyPathString: string | number;
  label: string | number;
  model: LogsJsonScene;
  value: string;
  variableType: InterpolatedFilterType;
}) {
  const isFilterInclusive = (filter: AdHocFilterWithLabels) => isOperatorInclusive(filter.operator);
  const isFilterExclusive = (filter: AdHocFilterWithLabels) => isOperatorExclusive(filter.operator);
  return (
    <span className={jsonLabelButtonsWrapStyle}>
      {/* Include */}
      <FilterValueButton
        label={props.label.toString()}
        value={props.value}
        variableType={props.variableType}
        addFilter={props.addFilter}
        existingFilter={props.existingFilter.find(isFilterInclusive)}
        type={'include'}
        model={props.model}
        keyPath={props.keyPath}
      />
      {/* Exclude */}
      <FilterValueButton
        label={props.label.toString()}
        value={props.value}
        variableType={props.variableType}
        addFilter={props.addFilter}
        existingFilter={props.existingFilter.find(isFilterExclusive)}
        type={'exclude'}
        model={props.model}
        keyPath={props.keyPath}
      />
      <strong className={jsonLabelWrapStyles}>{props.elements.length ? props.elements : props.keyPathString}:</strong>
    </span>
  );
}
