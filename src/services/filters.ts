import { DetectedLabel, isLogLineField } from './fields';
import {
  ALL_VARIABLE_VALUE,
  isAdHocFilterValueUserInput,
  LEVEL_VARIABLE_VALUE,
  stripAdHocFilterUserInputPrefix,
} from './variables';
import { SceneObject, VariableValueOption } from '@grafana/scenes';
import { getJsonFieldsVariable, getLineFormatVariable } from './variableGetters';
import { FilterOp, JSONFilterOp } from './filterTypes';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { isNumber } from 'lodash';

// We want to show labels with cardinality 1 at the end of the list because they are less useful
// And then we want to sort by cardinality - from lowest to highest
export function sortLabelsByCardinality(a: DetectedLabel, b: DetectedLabel) {
  if (a.cardinality === 1) {
    return 1;
  }
  if (b.cardinality === 1) {
    return -1;
  }
  return a.cardinality - b.cardinality;
}

// Creates label options by taking all labels and if LEVEL_VARIABLE_VALUE is not in the list, it is added at the beginning.
// It also adds 'All' option at the beginning
export function getLabelOptions(labels: string[]) {
  const options = [...labels];
  if (!labels.includes(LEVEL_VARIABLE_VALUE)) {
    options.unshift(LEVEL_VARIABLE_VALUE);
  }

  const labelOptions: VariableValueOption[] = options.map((label) => ({
    label,
    value: String(label),
  }));

  return [{ label: 'All', value: ALL_VARIABLE_VALUE }, ...labelOptions];
}
export const LEVEL_INDEX_NAME = 'level';
export const FIELDS_TO_REMOVE = ['level_extracted', LEVEL_VARIABLE_VALUE, LEVEL_INDEX_NAME];

export const LABELS_TO_REMOVE = ['__aggregated_metric__', '__stream_shard__'];
export function getFieldOptions(labels: string[]) {
  const options = [...labels];
  const labelOptions: VariableValueOption[] = options.map((label) => ({
    label,
    value: String(label),
  }));

  return [{ label: 'All', value: ALL_VARIABLE_VALUE }, ...labelOptions];
}

// Since "meta" is not saved in the URL state, it's ephemeral and can only be used for wip keys, but we can differentiate fields from metadata if the value is not encoded (and therefore different then the label)
export function isFilterMetadata(filter: { value: string; valueLabels?: string[] }) {
  const value = isAdHocFilterValueUserInput(filter.value)
    ? stripAdHocFilterUserInputPrefix(filter.value)
    : filter.value;
  return value === filter.valueLabels?.[0];
}

export const EMPTY_JSON_FILTER_VALUE = ' ';

export function removeJsonDrilldownFilters(sceneRef: SceneObject) {
  const lineFormatVar = getLineFormatVariable(sceneRef);
  const lineFormatFilter = lineFormatVar.state.filters?.[0];
  if (!lineFormatFilter) {
    console.warn('Unexpected line format filter parse error. Line format filter is expected when drilling back up');
  }

  const jsonVariable = getJsonFieldsVariable(sceneRef);
  const filters = [...jsonVariable.state.filters.filter((f) => f.key !== lineFormatFilter?.key)];

  jsonVariable.setState({
    filters,
  });
  lineFormatVar.setState({
    filters: [],
  });
}

export function addJsonParserFields(sceneRef: SceneObject, keyPath: KeyPath, hasValue = true) {
  const jsonVariable = getJsonFieldsVariable(sceneRef);

  const value = hasValue ? getJsonKey(keyPath, '.') : EMPTY_JSON_FILTER_VALUE;
  const key = getJsonKey(keyPath, '_');

  const filters = [
    ...jsonVariable.state.filters.filter((f) => f.key !== key),
    {
      value,
      key,
      operator: hasValue ? FilterOp.Equal : JSONFilterOp.Empty,
    },
  ];

  jsonVariable.setState({
    filters,
  });
}

export function getJsonKey(keyPath: KeyPath, joinBy: '_' | '.' = '_') {
  let key: string | undefined | number;
  const keys = [...keyPath];
  const keysToConcat = [];

  while ((key = keys.shift())) {
    if (isLogLineField(key.toString()) || isNumber(key) || key === 'root') {
      break;
    }
    keysToConcat.unshift(key);
  }
  return keysToConcat.join(joinBy);
}
