import { SceneObject } from '@grafana/scenes';

import { UIVariableFilterType } from '../Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { getParserFromFieldsFilters } from './fields';
import { logger } from './logger';
import { getFieldsVariable } from './variableGetters';
import {
  DETECTED_FIELD_AND_METADATA_VALUES_EXPR,
  DETECTED_LEVELS_VALUES_EXPR,
  JSON_FORMAT_EXPR,
  LEVEL_VARIABLE_VALUE,
  LOGS_FORMAT_EXPR,
  MIXED_FORMAT_EXPR,
  VAR_FIELDS_AND_METADATA,
  VAR_FIELDS_EXPR,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_LINE_FILTERS_EXPR,
  VAR_LINE_FORMAT_EXPR,
  VAR_METADATA_EXPR,
  VAR_PATTERNS_EXPR,
} from './variables';

/**
 * Crafts count over time query that excludes empty values for stream selector name
 * Will only add parsers if there are filters that require them.
 * @param sceneRef
 * @param streamSelectorName - the name of the stream selector we are aggregating by
 * @param excludeEmpty - if true, the query will exclude empty values for the given streamSelectorName
 */
export function getTimeSeriesExpr(sceneRef: SceneObject, streamSelectorName: string): string {
  const fieldsVariable = getFieldsVariable(sceneRef);

  const fieldFilters = fieldsVariable.state.filters;
  const parser = getParserFromFieldsFilters(fieldsVariable);

  // if we have fields, we also need to add parsers
  if (fieldFilters.length) {
    if (parser === 'mixed') {
      return `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${MIXED_FORMAT_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${streamSelectorName})`;
    }
    if (parser === 'json') {
      return `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${JSON_FORMAT_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${streamSelectorName})`;
    }
    if (parser === 'logfmt') {
      return `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${streamSelectorName})`;
    }
  }
  return `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${streamSelectorName})`;
}

/**
 * Get expressions for UI variables
 * @param variableType
 */
export function getFieldsTagValuesExpression(variableType: UIVariableFilterType) {
  switch (variableType) {
    case VAR_LEVELS:
      return DETECTED_LEVELS_VALUES_EXPR;
    case VAR_FIELDS_AND_METADATA:
      return DETECTED_FIELD_AND_METADATA_VALUES_EXPR;
    default:
      const error = new Error(`Unknown variable type: ${variableType}`);
      logger.error(error, {
        msg: `getFieldsTagValuesExpression: Unknown variable type: ${variableType}`,
        variableType,
      });
      throw error;
  }
}
