import { DetectedLabel, isLogLineField } from './fields';
import {
  ALL_VARIABLE_VALUE,
  isAdHocFilterValueUserInput,
  LEVEL_VARIABLE_VALUE,
  stripAdHocFilterUserInputPrefix,
} from './variables';
import { SceneObject, VariableValueOption } from '@grafana/scenes';
import { getFieldsVariable, getJsonFieldsVariable, getLineFormatVariable } from './variableGetters';
import { FilterOp, JSONFilterOp } from './filterTypes';
import { KeyPath } from '@gtk-grafana/react-json-tree';
import { isNumber } from 'lodash';
import { LABEL_NAME_INVALID_CHARS } from './labels';

export const EMPTY_JSON_FILTER_VALUE = ' ';
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

/**
 * Filters json parser prop filters that are not currently used in either the line filters or the field filters
 *
 * We are looping through the field filters and line format filters for each json parser prop
 * While those arrays of filters don't have unbounded length,
 * we could make this much more performant by adding the values of those variables to a set
 */
export function filterUnusedJSONParserProps(sceneRef: SceneObject) {
  const lineFormatVar = getLineFormatVariable(sceneRef);
  const lineFormatFilters = lineFormatVar.state.filters;
  const fieldsVar = getFieldsVariable(sceneRef);
  const jsonVariable = getJsonFieldsVariable(sceneRef);

  // Loop through the json variable filters, remove them if there aren't any fields filters or line format filters
  const filters = jsonVariable.state.filters.filter((f) => {
    const hasLineFormat = lineFormatFilters.find((lineFormatFilter) => lineFormatFilter.key === f.key);

    if (!hasLineFormat) {
      return fieldsVar.state.filters.find((fieldsFilter) => fieldsFilter.key === f.key);
    }
    return true;
  });

  jsonVariable.setState({
    filters: filters,
  });
}

export function removeJsonDrilldownFilters(sceneRef: SceneObject) {
  const lineFormatVar = getLineFormatVariable(sceneRef);
  filterUnusedJSONParserProps(sceneRef);
  lineFormatVar.setState({
    filters: [],
  });
}

export function addJsonParserFieldValue(sceneRef: SceneObject, keyPath: KeyPath) {
  const jsonVariable = getJsonFieldsVariable(sceneRef);

  let value = getJsonKey(keyPath, '.');
  let key = getJsonKey(keyPath, '_');

  // @todo https://github.com/grafana/loki/issues/16817
  if (key.match(LABEL_NAME_INVALID_CHARS)) {
    key = key.replace(LABEL_NAME_INVALID_CHARS, '_');
    value = `[\\"${value}\\"]`;
  }

  const nextKeyPath = [...keyPath];
  let nextKey = nextKeyPath.shift();

  let filters = [
    ...jsonVariable.state.filters.filter((f) => f.key !== key),
    {
      value,
      key,
      operator: FilterOp.Equal,
    },
  ];

  while (nextKey && !isLogLineField(nextKey.toString()) && !isNumber(nextKey) && nextKey !== 'root') {
    const nextFullKey = getJsonKey(nextKeyPath, '_');
    const nextValue = getJsonKey(nextKeyPath, '.');

    if (
      nextFullKey &&
      !filters.find(
        (filter) => filter.key === nextFullKey && filter.value === nextValue && filter.operator === FilterOp.Equal
      )
    ) {
      filters = [
        ...filters.filter((f) => f.key !== nextFullKey),
        {
          value: nextValue,
          key: nextFullKey,
          operator: FilterOp.Equal,
        },
      ];
    }

    nextKey = nextKeyPath.shift();
  }

  jsonVariable.setState({
    filters,
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
