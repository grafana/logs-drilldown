import { SceneObject } from '@grafana/scenes';

import { getParserForField, getParserFromFieldsFilters } from './fields';
import { logger } from './logger';
import { getParserEnabled } from './parserToggle';
import { renderLogQLFieldFilters, renderLogQLMetadataFilters } from './query';
import { getFieldsVariable, getMetadataVariable } from './variableGetters';
import {
  DETECTED_FIELD_AND_METADATA_VALUES_EXPR,
  DETECTED_LEVELS_VALUES_EXPR,
  JSON_FORMAT_EXPR,
  LEVEL_VARIABLE_VALUE,
  LOGS_FORMAT_EXPR,
  MIXED_FORMAT_EXPR,
  ParserType,
  VAR_FIELDS_AND_METADATA,
  VAR_FIELDS_EXPR,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_LINE_FILTERS_EXPR,
  VAR_LINE_FORMAT_EXPR,
  VAR_METADATA_EXPR,
  VAR_PATTERNS_EXPR,
} from './variables';
import type { UIVariableFilterType } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';

/**
 * Crafts count over time query for Logs Volume.
 * Will only add parsers if needed.
 * @param sceneRef
 * @param fieldName - the name of the stream selector we are aggregating by
 */
export function getLogsVolumeQuery(sceneRef: SceneObject, fieldName: string): string {
  const fieldsVariable = getFieldsVariable(sceneRef);

  const fieldFilters = fieldsVariable.state.filters;
  let parser: ParserType = 'mixed';
  if (fieldFilters.length > 0) {
    parser = getParserFromFieldsFilters(fieldsVariable);
  } else {
    parser =
      fieldName === LEVEL_VARIABLE_VALUE ? 'structuredMetadata' : (getParserForField(fieldName, sceneRef) ?? 'mixed');
  }

  switch (parser) {
    case 'mixed':
      return `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${MIXED_FORMAT_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${fieldName})`;
    case 'json':
      return `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${JSON_FORMAT_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${fieldName})`;
    case 'logfmt':
      return `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${fieldName})`;
  }

  return `sum(count_over_time({${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FORMAT_EXPR} [$__auto])) by (${fieldName})`;
}

/**
 * Drops the grouped-by field from volume interpolation so focusing a series does not re-query.
 */
export function excludeAggregateByFromLogsVolumeQuery(expr: string, fieldName: string, sceneRef: SceneObject): string {
  if (fieldName === LEVEL_VARIABLE_VALUE) {
    return expr;
  }
  if (getParserForField(fieldName, sceneRef) === 'structuredMetadata') {
    return expr.replace(
      VAR_METADATA_EXPR,
      renderLogQLMetadataFilters(getMetadataVariable(sceneRef).state.filters, [fieldName])
    );
  }
  return expr.replace(VAR_FIELDS_EXPR, renderLogQLFieldFilters(getFieldsVariable(sceneRef).state.filters, [fieldName]));
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
