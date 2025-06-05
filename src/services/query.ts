import { AdHocVariableFilter, SelectableValue } from '@grafana/data';
import { AdHocFilterWithLabels, sceneGraph, SceneObject, sceneUtils } from '@grafana/scenes';

import { sortLineFilters } from '../Components/IndexScene/LineFilterVariablesScene';
import { SceneDataQueryResourceRequest, SceneDataQueryResourceRequestOptions } from './datasourceTypes';
import { ExpressionBuilder } from './ExpressionBuilder';
import { LineFilterCaseSensitive, LineFilterOp } from './filterTypes';
import { LokiQuery } from './lokiQuery';
import { PLUGIN_ID } from './plugin';
import {
  addAdHocFilterUserInputPrefix,
  AdHocFiltersWithLabelsAndMeta,
  FieldValue,
  VAR_DATASOURCE_EXPR,
  VAR_JSON_FIELDS_EXPR,
} from './variables';

/**
 * Builds the resource query
 * @param expr string to be interpolated and executed in the resource request
 * @param resource
 * @param queryParamsOverrides
 * @param primaryLabel
 */
export const buildResourceQuery = (
  expr: string,
  resource: SceneDataQueryResourceRequestOptions,
  queryParamsOverrides?: Partial<LokiQuery>,
  primaryLabel?: string
): LokiQuery & SceneDataQueryResourceRequest & { primaryLabel?: string } => {
  return {
    ...defaultQueryParams,
    refId: resource,
    resource,
    ...queryParamsOverrides,
    datasource: { uid: VAR_DATASOURCE_EXPR },
    expr,
    primaryLabel,
  };
};
/**
 * Builds a loki data query
 * @param expr
 * @param queryParamsOverrides
 * @returns LokiQuery
 */
export const buildDataQuery = (expr: string, queryParamsOverrides?: Partial<LokiQuery>): LokiQuery => {
  return {
    ...defaultQueryParams,
    ...queryParamsOverrides,
    expr,
  };
};

const defaultQueryParams = {
  editorMode: 'code',
  queryType: 'range',
  refId: 'A',
  supportingQueryType: PLUGIN_ID,
};

export const buildVolumeQuery = (
  expr: string,
  resource: 'detected_fields' | 'detected_labels' | 'labels' | 'patterns' | 'volume',
  primaryLabel: string,
  queryParamsOverrides?: Record<string, unknown>
): LokiQuery & SceneDataQueryResourceRequest => {
  return buildResourceQuery(expr, resource, { ...queryParamsOverrides }, primaryLabel);
};

export function renderLogQLLabelFilters(filters: AdHocFilterWithLabels[], ignoreKeys?: string[]) {
  const filtersTransformer = new ExpressionBuilder(filters);
  return filtersTransformer.getLabelsExpr({ ignoreKeys });
}

export function onAddCustomAdHocValue(item: SelectableValue<string>): {
  value: string | undefined;
  valueLabels: string[];
} {
  if (item.value) {
    return {
      value: addAdHocFilterUserInputPrefix(item.value),
      valueLabels: [item.label ?? item.value],
    };
  }

  return {
    value: item.value,
    valueLabels: [item.label ?? item.value ?? ''],
  };
}

export function onAddCustomFieldValue(
  item: SelectableValue<string> & { isCustom?: boolean },
  filter: AdHocFiltersWithLabelsAndMeta
): { value: string | undefined; valueLabels: string[] } {
  const field: FieldValue = {
    parser: filter?.meta?.parser ?? 'mixed',
    value: item.value ?? '',
  };

  // metadata is not encoded
  if (field.parser === 'structuredMetadata') {
    return {
      value: addAdHocFilterUserInputPrefix(field.value),
      valueLabels: [item.label ?? field.value],
    };
  }

  return {
    value: addAdHocFilterUserInputPrefix(JSON.stringify(field)),
    valueLabels: [item.label ?? field.value],
  };
}

export function renderLevelsFilter(filters: AdHocVariableFilter[], ignoreKeys?: string[]) {
  const filterTransformer = new ExpressionBuilder(filters);
  return filterTransformer.getLevelsExpr({ ignoreKeys });
}

export function renderLogQLMetadataFilters(filters: AdHocVariableFilter[], ignoreKeys?: string[]) {
  const filterTransformer = new ExpressionBuilder(filters);
  return filterTransformer.getMetadataExpr({ ignoreKeys });
}

export function renderLogQLFieldFilters(filters: AdHocVariableFilter[], ignoreKeys?: string[]) {
  const filterTransformer = new ExpressionBuilder(filters);
  return filterTransformer.getFieldsExpr({ ignoreKeys });
}

export function escapeDoubleQuotedLineFilter(filter: AdHocFilterWithLabels) {
  // Is not regex
  if (filter.operator === LineFilterOp.match || filter.operator === LineFilterOp.negativeMatch) {
    if (filter.key === LineFilterCaseSensitive.caseInsensitive) {
      return sceneUtils.escapeLabelValueInRegexSelector(filter.value ?? '');
    } else {
      return sceneUtils.escapeLabelValueInExactSelector(filter.value ?? '');
    }
  } else {
    return sceneUtils.escapeLabelValueInExactSelector(filter.value ?? '');
  }
}

/**
 * Builds line filter as a double-quoted LogQL string
 * Expects pre-escaped values
 */
function buildLogQlLineFilter(filter: AdHocFilterWithLabels, value: string) {
  // Change operator if needed and insert caseInsensitive flag
  if (filter.key === LineFilterCaseSensitive.caseInsensitive) {
    if (filter.operator === LineFilterOp.negativeRegex || filter.operator === LineFilterOp.negativeMatch) {
      return `${LineFilterOp.negativeRegex} "(?i)${value}"`;
    }
    return `${LineFilterOp.regex} "(?i)${value}"`;
  }

  return `${filter.operator} "${value}"`;
}

/**
 * Converts line filter ad-hoc filters to LogQL
 *
 * the filter key is LineFilterCaseSensitive
 * the filter operator is LineFilterOp
 * the value is the user input
 */
export function renderLogQLLineFilter(filters: AdHocFilterWithLabels[]) {
  sortLineFilters(filters);
  return filters
    .map((filter) => {
      if (!filter.value) {
        return '';
      }

      const value = escapeDoubleQuotedLineFilter(filter);
      return buildLogQlLineFilter(filter, value);
    })
    .join(' ');
}
export function wrapWildcardSearch(input: string) {
  if (input === '.+') {
    return input;
  } else if (input.substring(0, 6) !== '(?i).*') {
    return `(?i).*${input}.*`;
  }

  return input;
}

export function unwrapWildcardSearch(input: string) {
  if (input.substring(0, 6) === '(?i).*' && input.slice(-2) === '.*') {
    return input.slice(6).slice(0, -2);
  }

  return input;
}

export function sanitizeStreamSelector(expression: string) {
  return expression.replace(/\s*,\s*}/, '}');
}

/**
 * Variables that contain other variables are not interpolated, until interpolate is called again.
 */
export function interpolateExpression(sceneObject: SceneObject, uninterpolatedExpr: string | undefined) {
  let expr = sceneGraph.interpolate(sceneObject, uninterpolatedExpr);

  // interpolate doesn't interpolate nested variables, so we check to see if the un-interpolated variable is still present and run it again.
  if (expr.includes(VAR_JSON_FIELDS_EXPR)) {
    expr = sceneGraph.interpolate(sceneObject, expr);
  }

  return expr;
}

export function getJsonParserExpressionBuilder() {
  return (filters: AdHocFilterWithLabels[]) => {
    let jsonFilters = filters
      .map((filter) => {
        return `${filter.key}${filter.operator}"${filter.value}"`;
      })
      .join(',');

    // If we have JSON filters, add another JSON parser stage so the default fields are not removed
    if (jsonFilters.length) {
      jsonFilters += '| json';
    }
    return jsonFilters;
  };
}

export function getLineFormatExpressionBuilder() {
  return (filters: AdHocFilterWithLabels[]) => {
    if (filters.length) {
      // We should only have a single line_format, which saves the state of where we're currently "drilled in"
      // we're using an-ad-hoc variable instead of a regular text variable because we need to be able to delete the json parser value associated with this "drilldown",
      const key = filters.map((filter) => filter.key).join('_');
      return `| line_format "{{.${key}}}"`;
    }
    return '';
  };
}

// default line limit; each data source can define it's own line limit too
export const LINE_LIMIT = 1000;
