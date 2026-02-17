import { DataFrame } from '@grafana/data';
import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';
import { ComboboxOption } from '@grafana/ui';

import { addToFilters, FilterType } from '../Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { getParserForField, getParserFromFieldsFilters } from './fields';
import { getLabelValueFromDataFrame } from './levels';
import { isOperatorExclusive, isOperatorInclusive } from './operatorHelpers';
import { buildDataQuery } from './query';
import { getLabelsKeys } from './TagKeysProviders';
import {
  getFieldsAndMetadataVariable,
  getFieldsVariable,
  getLabelsVariable,
  getLogsStreamSelector,
  getMetadataVariable,
  getValueFromFieldsFilter,
} from './variableGetters';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS, VAR_LABELS, VAR_METADATA } from './variables';
import { getDatasource } from 'Components/AppConfig/DefaultColumns/State';
import { DETECTED_LEVEL, LEVEL } from 'Components/Table/constants';

export const LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

export function buildLabelsQuery(sceneRef: SceneObject, optionValue: string, optionName: string) {
  let labelExpressionToAdd = '';
  let structuredMetadataToAdd = '';

  const fields = getFieldsVariable(sceneRef);
  const parser = getParserFromFieldsFilters(fields);

  if (optionName && optionName !== LEVEL_VARIABLE_VALUE) {
    labelExpressionToAdd = ` ,${optionName} != ""`;
  } else if (optionName && optionName === LEVEL_VARIABLE_VALUE) {
    structuredMetadataToAdd = ` | ${optionName} != ""`;
  }

  return buildDataQuery(
    `sum(count_over_time(${getLogsStreamSelector({
      labelExpressionToAdd,
      parser,
      structuredMetadataToAdd,
    })} [$__auto])) by (${optionValue})`,
    { legendFormat: `{{${optionValue}}}`, refId: 'LABEL_BREAKDOWN_VALUES' }
  );
}

export function getAllLabelsFromDataFrame(series: DataFrame[]): string[] {
  const allLabelKeys = new Set<string>();

  for (const dataFrame of series) {
    const labelsField = dataFrame.fields.find((field) => field.name === 'labels' && field.values);

    if (labelsField && labelsField.values && labelsField.values.length > 0) {
      for (const logEntry of labelsField.values) {
        if (logEntry && typeof logEntry === 'object') {
          const keys = Object.keys(logEntry);
          keys.forEach((key) => allLabelKeys.add(key));
        }
      }
    }
  }

  return Array.from(allLabelKeys);
}

export function getLabelsFromSeries(series: DataFrame[]): string[] {
  const labels = series.map((dataFrame) => getLabelValueFromDataFrame(dataFrame));
  return labels.flatMap((f) => (f ? [f] : []));
}

export function toggleFieldFromFilter(key: string, value: string, sceneRef: SceneObject): FilterType {
  const fieldsAndMetadataVariable = getFieldsAndMetadataVariable(sceneRef);
  const empty = fieldsAndMetadataVariable.state.filters.length === 0;
  const detectedFieldType = getParserForField(key, sceneRef);
  const isMetadata = detectedFieldType === 'structuredMetadata';

  const filterExists = fieldsAndMetadataVariable.state.filters.find((filter) => {
    if (isMetadata) {
      return isOperatorInclusive(filter.operator) && filter.value === value;
    }
    return isOperatorInclusive(filter.operator) && getValueFromFieldsFilter(filter).value === value;
  });

  if (empty || !filterExists) {
    addToFilters(key, value, 'include', sceneRef, isMetadata ? VAR_METADATA : VAR_FIELDS);
    return 'include';
  } else {
    addToFilters(key, value, 'toggle', sceneRef, isMetadata ? VAR_METADATA : VAR_FIELDS);
    return 'toggle';
  }
}

export function toggleLabelFromFilter(key: string, value: string, sceneRef: SceneObject): FilterType {
  const labelsVariable = getLabelsVariable(sceneRef);
  const empty = labelsVariable.state.filters.length === 0;
  const filterExists = labelsVariable.state.filters.find(
    (filter) => filter.value === value && isOperatorInclusive(filter.operator)
  );

  if (empty || !filterExists) {
    addToFilters(key, value, 'include', sceneRef, VAR_LABELS);
    return 'include';
  } else {
    addToFilters(key, value, 'toggle', sceneRef, VAR_LABELS);
    return 'toggle';
  }
}

export function getVisibleLabels(key: string, allLabels: string[], sceneRef: SceneObject) {
  const labelsVariable = getLabelsVariable(sceneRef);
  return getVisibleFilters(key, allLabels, labelsVariable);
}

export function getVisibleFields(key: string, allLabels: string[], sceneRef: SceneObject) {
  const fieldsVariable = getFieldsVariable(sceneRef);
  return getVisibleFilters(key, allLabels, fieldsVariable);
}

export function getVisibleMetadata(key: string, allLabels: string[], sceneRef: SceneObject) {
  const metadataVariable = getMetadataVariable(sceneRef);
  return getVisibleFilters(key, allLabels, metadataVariable);
}

export function getVisibleFilters(key: string, allLabels: string[], variable: AdHocFiltersVariable) {
  const inclusiveFilters = variable.state.filters
    .filter((filter) => filter.key === key && isOperatorInclusive(filter.operator))
    .map((filter) => (variable.state.name === VAR_FIELDS ? getValueFromFieldsFilter(filter).value : filter.value));
  const exclusiveLabels = variable.state.filters
    .filter((filter) => filter.key === key && isOperatorExclusive(filter.operator))
    .map((filter) => (variable.state.name === VAR_FIELDS ? getValueFromFieldsFilter(filter).value : filter.value));

  return allLabels.filter((label) => {
    if (exclusiveLabels.includes(label)) {
      return false;
    }
    return inclusiveFilters.length === 0 || inclusiveFilters.includes(label);
  });
}

// Regex that grabs invalid chars in a loki label name
// From https://grafana.com/docs/loki/latest/get-started/labels/#label-format
export const LABEL_NAME_INVALID_CHARS = /[^a-zA-Z0-9_:]/g;

export function isLabelLevel(label: string): boolean {
  if (label === DETECTED_LEVEL || label === LEVEL) {
    return true;
  }
  return false;
}

export async function getLabelsForCombobox(dsUID: string, excludeLabels: string[] = []): Promise<ComboboxOption[]> {
  const datasource = await getDatasource(dsUID);
  if (!datasource) {
    return [];
  }

  const getLabelsKeysPromise = getLabelsKeys([], datasource);
  const results = await getLabelsKeysPromise;
  return results.filter((label) => !excludeLabels.includes(label.text)).map((label) => ({ value: label.text }));
}
