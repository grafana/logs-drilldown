import React from 'react';

import { AdHocFilterWithLabels, SceneObject } from '@grafana/scenes';

import { InterpolatedFilterType } from '../Breakdowns/AddToFiltersButton';
import { JSONMetadataButton } from './JSONFilterButtons';
import { addJsonFieldFilter } from 'services/JSONFilter';
import { isOperatorExclusive, isOperatorInclusive } from 'services/operatorHelpers';

interface Props {
  addJsonFilter: typeof addJsonFieldFilter;
  existingFilter: AdHocFilterWithLabels[];
  label: string | number;
  sceneRef: SceneObject;
  value: string;
  variableType: InterpolatedFilterType;
}

/**
 * Labels and metadata nodes
 */
export function JSONMetadataButtons({ existingFilter, label, sceneRef, value, variableType }: Props) {
  const isFilterInclusive = (filter: AdHocFilterWithLabels) => isOperatorInclusive(filter.operator);
  const isFilterExclusive = (filter: AdHocFilterWithLabels) => isOperatorExclusive(filter.operator);
  return (
    <>
      {/* Include */}
      <JSONMetadataButton
        type={'include'}
        label={label.toString()}
        value={value}
        variableType={variableType}
        existingFilter={existingFilter.find(isFilterInclusive)}
        sceneRef={sceneRef}
      />
      {/* Exclude */}
      <JSONMetadataButton
        type={'exclude'}
        label={label.toString()}
        value={value}
        variableType={variableType}
        existingFilter={existingFilter.find(isFilterExclusive)}
        sceneRef={sceneRef}
      />
    </>
  );
}
