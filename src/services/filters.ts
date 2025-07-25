import { isNumber } from 'lodash';

import { SceneObject, VariableValueOption } from '@grafana/scenes';

import { DetectedLabel, getJsonPathArraySyntax, isLogLineField } from './fields';
import { FilterOp } from './filterTypes';
import { LABEL_NAME_INVALID_CHARS } from './labels';
import { getFieldsVariable, getJSONFieldsVariable, getLineFormatVariable } from './variableGetters';
import {
  ALL_VARIABLE_VALUE,
  isAdHocFilterValueUserInput,
  LEVEL_VARIABLE_VALUE,
  stripAdHocFilterUserInputPrefix,
} from './variables';
import { KeyPath } from '@gtk-grafana/react-json-tree';

// Ad-hoc variables added without values are not added to url state, so we add an empty value
export const EMPTY_AD_HOC_FILTER_VALUE = ' ';
export const LEVEL_INDEX_NAME = 'level';
export const FIELDS_TO_REMOVE = ['level_extracted', LEVEL_VARIABLE_VALUE, LEVEL_INDEX_NAME];

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

export const LABELS_TO_REMOVE = ['__aggregated_metric__', '__stream_shard__'];
export function getFieldOptions(labels: string[], all = true) {
  const options = [...labels];
  const labelOptions: VariableValueOption[] = options.map((label) => ({
    label,
    value: String(label),
  }));

  if (all) {
    return [{ label: 'All', value: ALL_VARIABLE_VALUE }, ...labelOptions];
  }
  return [{ label: 'level', value: LEVEL_VARIABLE_VALUE }, ...labelOptions];
}

// Since "meta" is not saved in the URL state, it's ephemeral and can only be used for wip keys, but we can differentiate fields from metadata if the value is not encoded (and therefore different then the label)
export function isFilterMetadata(filter: { value: string; valueLabels?: string[] }) {
  const value = isAdHocFilterValueUserInput(filter.value)
    ? stripAdHocFilterUserInputPrefix(filter.value)
    : filter.value;
  return value === filter.valueLabels?.[0];
}

/**
 * Filters json parser prop filters that are not currently used in either the line filters or the field filters
 * @todo unit test
 */
export function filterUnusedJSONFilters(sceneRef: SceneObject) {
  const lineFormatVar = getLineFormatVariable(sceneRef);
  const lineFormatFilters = lineFormatVar.state.filters;
  const fieldsVar = getFieldsVariable(sceneRef);
  const jsonVariable = getJSONFieldsVariable(sceneRef);
  const lineFormatSet = new Set();
  lineFormatFilters.forEach((lineFormatFilter) => {
    lineFormatSet.add(lineFormatFilter.key);
  });

  const fieldsFilterSet = new Set();
  fieldsVar.state.filters.forEach((fieldFilter) => fieldsFilterSet.add(fieldFilter.key));

  // Loop through the json variable filters, remove them if there aren't any fields filters or line format filters that match
  const filters = jsonVariable.state.filters.filter((jsonParserPropFilter) => {
    let hasLineFormat = false;
    let lineFormatKeys: string[] = [];

    // Concat the line format variables together and check to see if the json parser filter match
    hasLineFormat = lineFormatFilters.some((lineFormatFilter) => {
      lineFormatKeys.push(lineFormatFilter.key);
      const concatLineFormatKeys = lineFormatKeys.join('_');
      return concatLineFormatKeys === jsonParserPropFilter.key;
    });

    // And check if the fields contain a matching key
    const hasFieldFilter = fieldsFilterSet.has(jsonParserPropFilter.key);
    return hasFieldFilter || hasLineFormat;
  });

  jsonVariable.setState({
    filters: filters,
  });
}

export function removeLineFormatFilters(sceneRef: SceneObject) {
  const lineFormatVar = getLineFormatVariable(sceneRef);
  filterUnusedJSONFilters(sceneRef);
  lineFormatVar.setState({
    filters: [],
  });
}

export function formatJsonKey(key: string) {
  if (key.match(LABEL_NAME_INVALID_CHARS)) {
    key = key.replace(LABEL_NAME_INVALID_CHARS, '_');
  }
  return key;
}

export function addJsonParserFieldValue(sceneRef: SceneObject, keyPath: KeyPath) {
  const jsonVariable = getJSONFieldsVariable(sceneRef);

  const value = getJSONKeyPath(keyPath);
  const key = getJSONKey(keyPath);
  const filterKey = formatJsonKey(key);
  const nextKeyPath = [...keyPath];
  let nextKey = nextKeyPath.shift();

  let filters = [
    ...jsonVariable.state.filters.filter((f) => f.key !== filterKey),
    {
      key: filterKey,
      operator: FilterOp.Equal,
      value,
    },
  ];

  while (nextKey && !isLogLineField(nextKey.toString()) && !isNumber(nextKey) && nextKey !== 'root') {
    const nextFullKey = getJSONKey(nextKeyPath);
    const nextValue = getJSONKeyPath(nextKeyPath);

    if (
      nextFullKey &&
      !filters.find(
        (filter) => filter.key === nextFullKey && filter.value === nextValue && filter.operator === FilterOp.Equal
      )
    ) {
      filters = [
        ...filters.filter((f) => f.key !== nextFullKey),
        {
          key: nextFullKey,
          operator: FilterOp.Equal,
          value: nextValue,
        },
      ];
    }

    nextKey = nextKeyPath.shift();
  }

  jsonVariable.setState({
    filters,
  });
}

export function addJsonParserFields(sceneRef: SceneObject, keyPath: KeyPath) {
  const jsonVariable = getJSONFieldsVariable(sceneRef);
  const value = getJSONKeyPath(keyPath);
  const key = getJSONKey(keyPath);

  const filters = [
    ...jsonVariable.state.filters.filter((f) => f.key !== key),
    {
      key,
      operator: FilterOp.Equal,
      value,
    },
  ];

  jsonVariable.setState({
    filters,
  });
}

export function getJSONKey(keyPath: KeyPath) {
  const keysToConcat = getJSONKeysFromKeyPath(keyPath);
  return keysToConcat.join('_');
}

export function getJSONKeyPath(keyPath: KeyPath) {
  const keysToConcat = getJSONKeysFromKeyPath(keyPath);
  return getJsonPathArraySyntax(keysToConcat);
}

function getJSONKeysFromKeyPath(keyPath: ReadonlyArray<string | number>) {
  let key: string | undefined | number;
  const keys = [...keyPath];
  const keysToConcat = [];

  while ((key = keys.shift())) {
    if (isLogLineField(key.toString()) || isNumber(key) || key === 'root') {
      break;
    }
    keysToConcat.unshift(key);
  }
  return keysToConcat;
}
