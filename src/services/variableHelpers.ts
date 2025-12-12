import { AdHocVariableFilter } from '@grafana/data';
import { AdHocFiltersVariable, AdHocFilterWithLabels, sceneGraph, SceneObject } from '@grafana/scenes';

import { IndexScene } from '../Components/IndexScene/IndexScene';
import { ServiceScene } from '../Components/ServiceScene/ServiceScene';
import { areArraysEqual } from './comparison';
import { CustomConstantVariable } from './CustomConstantVariable';
import { FilterOp } from './filterTypes';
import { isOperatorInclusive } from './operatorHelpers';
import { includeOperators, numericOperators, operators } from './operators';
import { getRouteParams } from './routing';
import { getLabelsVariable } from './variableGetters';
import { SERVICE_NAME, SERVICE_UI_LABEL, VAR_FIELDS, VAR_LABELS } from './variables';

type ClearableVariable = AdHocFiltersVariable | CustomConstantVariable;
export function getVariablesThatCanBeCleared(
  indexScene: IndexScene,
  variableName?: typeof VAR_LABELS | typeof VAR_FIELDS
): ClearableVariable[] {
  const variables = sceneGraph.getVariables(indexScene);
  let variablesToClear: ClearableVariable[] = [];

  for (const variable of variables.state.variables) {
    if (variableName && variable.state.name !== variableName) {
      continue;
    }
    if (variable instanceof AdHocFiltersVariable && variable.state.filters.length) {
      const containsPrimaryLabelFilter = variable.state.filters.some((filter) =>
        isPrimaryLabelAdHocFilter(variable, filter, indexScene)
      );
      /**
       * If the variable doesn't contain the primary label filter, or has the primary label filter and other filters,
       * then it can be cleared.
       */
      if (!containsPrimaryLabelFilter || (containsPrimaryLabelFilter && variable.state.filters.length > 1)) {
        variablesToClear.push(variable);
      }
    }
    if (variable instanceof CustomConstantVariable && variable.state.value && variable.state.name !== 'logsFormat') {
      variablesToClear.push(variable);
    }
  }
  return variablesToClear;
}

export function clearVariables(sceneRef: SceneObject) {
  // clear patterns: needs to happen first, or it won't work as patterns is split into a variable and a state, and updating the variable triggers a state update
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  indexScene.setState({
    patterns: [],
  });

  const variablesToClear = getVariablesThatCanBeCleared(indexScene);

  variablesToClear.forEach((variable) => {
    if (variable instanceof AdHocFiltersVariable) {
      const filters = variable.state.filters.filter((filter) => isPrimaryLabelAdHocFilter(variable, filter, sceneRef));
      variable.setState({ filters });
    } else if (variable instanceof CustomConstantVariable) {
      variable.setState({
        text: '',
        value: '',
      });
    }
  });
}

function isPrimaryLabelAdHocFilter(
  variable: AdHocFiltersVariable,
  filter: AdHocFilterWithLabels,
  sceneRef: SceneObject
) {
  if (variable.state.name !== VAR_LABELS) {
    return false;
  }
  let { labelName, labelValue } = getRouteParams(sceneRef);
  if (!isOperatorInclusive(filter.operator) && filter.value === labelValue) {
    return false;
  }
  if (filter.key === labelName || (labelName === SERVICE_UI_LABEL && filter.key === SERVICE_NAME)) {
    return true;
  }
  return false;
}

export const operatorFunction = function (variable: AdHocFiltersVariable) {
  const wip = variable.state._wip;

  // If there is already a non-regex inclusion operator for this key, don't allow exclusion
  if (wip && variable.state.filters.some((filter) => filter.key === wip.key && filter.operator === FilterOp.Equal)) {
    return includeOperators;
  }

  const isLabelsVar = variable.state.name === VAR_LABELS;
  const inclusiveOperatorCount = variable.state.filters.filter((filter) => isOperatorInclusive(filter.operator)).length;
  const isEditingOnlyFilter = !wip?.key && inclusiveOperatorCount === 1;
  const isAddingFirstFilter = wip?.key && inclusiveOperatorCount < 1;

  // Should not be able to exclude the only operator
  if (isLabelsVar && (isEditingOnlyFilter || isAddingFirstFilter)) {
    return includeOperators;
  }

  // Only fields or metadata can have field types?
  if (wip?.meta) {
    const meta: Record<string, string> = wip.meta;
    const type = meta.type;

    if (type === 'int') {
      return [...operators, ...numericOperators];
    }

    if (type === 'float' || type === 'bytes' || type === 'duration') {
      return numericOperators;
    }
  }

  return operators;
};

export const getFilterSetKey = (filter: AdHocFilterWithLabels) =>
  filter.key + '_' + filter.operator + '_' + filter.value;
export const addFiltersToSet = (filters: AdHocFilterWithLabels[], set: Set<string>) =>
  filters.forEach((filter) => set.add(getFilterSetKey(filter)));

/**
 * For embedded contexts, return the first label as primary label
 */
export function getPrimaryLabelFromEmbeddedScene(scene: ServiceScene, variable = getLabelsVariable(scene)) {
  if (!scene.state.embedded) {
    throw new Error('getPrimaryLabelFromUrl should be used instead when embedded!');
  }
  return {
    breakdownLabel: scene.state.drillDownLabel,
    labelName: variable.state.filters[0].key,
    labelValue: variable.state.filters[0].value,
  };
}

export function areLabelFiltersEqual(a: AdHocVariableFilter[], b: AdHocVariableFilter[]) {
  // use only a subset of properties for comparison as more properties may be added in to filters comparing to reference labels
  const mapAdHocFilters = (a: AdHocVariableFilter) => ({ key: a.key, operator: a.operator, value: a.value });
  return areArraysEqual(a.map(mapAdHocFilters), b.map(mapAdHocFilters));
}
