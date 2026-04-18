import React, { useMemo } from 'react';

import { Observable, from, map, switchMap } from 'rxjs';

import { DataQueryResponse, DataFrame, DataQueryRequest, TimeRange, dateTime, FieldType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';

import { ExpressionBuilder } from '../../services/ExpressionBuilder';
import { buildFieldLinkFromQuery, buildServiceLinkFromQuery } from '../../services/extensions/links';
import { LokiDatasource, LokiQuery } from '../../services/lokiQuery';
import { isRecord } from '../../services/narrowing';
import { ActiveFilter, AttributeConfig, AttributeDistribution, AttributeValueCount, DatasetContext } from './AttributeDistribution';

interface LokiLike {
  getResource(path: string, params: Record<string, string>, options: Record<string, string>): Promise<unknown>;
}

function narrowDetectedFields(response: unknown): Array<{ label: string }> {
  if (!isRecord(response)) {
    return [];
  }
  if (!Array.isArray(response['fields'])) {
    return [];
  }
  return response['fields'].filter((f): f is { label: string } => isRecord(f) && typeof f['label'] === 'string');
}

// Appends a per-field metric aggregation around the base log query.
// The base query must already include logfmt and any hash filters so that
// [$__range] counts only events in this error group.
function buildDistributionQuery(baseQuery: string, field: string): string {
  return `sum by (${field}) (count_over_time(${baseQuery} | keep ${field} [$__range]))`;
}

function makeFetchAttributes(
  fieldsToExclude: string[],
  attributeMap: Record<string, string>
): (context: DatasetContext) => Promise<AttributeConfig[]> {
  // Build the Set here, inside logs-drilldown's module, so Set.prototype methods
  // operate on a Set from this bundle's realm. Passing a Set across plugin
  // boundaries (different webpack bundles) causes cross-realm prototype errors.
  const excludeSet = new Set(fieldsToExclude);

  return async function fetchAttributes(context: DatasetContext): Promise<AttributeConfig[]> {
    const ds = (await getDataSourceSrv().get(context.datasourceUid)) as LokiDatasource;

    const start = dateTime(context.timeRange.from).utc().toISOString();
    const end = dateTime(context.timeRange.to).utc().toISOString();

    const response = await (ds as unknown as LokiLike).getResource(
      'detected_fields',
      { end, query: context.query, start },
      { requestId: 'errors-detected-fields' }
    );

    return narrowDetectedFields(response)
      .filter((f) => !excludeSet.has(f.label))
      .map((f) => ({
        attribute: f.label,
        attribute_name: attributeMap[f.label] ?? f.label,
      }));
  };
}

function processDistributionResponse(response: DataQueryResponse, field: string): AttributeValueCount[] {
  const counts: Array<{ count: number; value: string }> = [];

  response.data.forEach((frame: DataFrame) => {
    // Loki returns numeric-multi frames in wide format: one row per unique label value.
    // The label values are in a string field named after the queried field.
    // The counts are in the corresponding number field.
    const labelField = frame.fields.find((f) => f.type === FieldType.string && f.name === field);
    const valueField = frame.fields.find((f) => f.type === FieldType.number);

    if (!labelField || !valueField) {
      return;
    }

    function getStringValue(values: string[], i: number): string {
      return String(values[i]);
    }

    function getNumberValue(values: number[], i: number): number {
      return Number(values[i]);
    }

    for (let i = 0; i < frame.length; i++) {
      const labelValue = getStringValue(labelField.values as string[], i);
      const count = getNumberValue(valueField.values as number[], i);
      if (labelValue && !isNaN(count) && count > 0) {
        counts.push({ count, value: labelValue });
      }
    }
  });

  const total = counts.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) {
    return [];
  }

  return counts
    .map((c) => ({ ...c, percentage: Math.round((c.count / total) * 100) }))
    .sort((a, b) => b.percentage - a.percentage);
}

function fetchDistribution(
  context: DatasetContext,
  field: string,
  filters: ActiveFilter[]
): Observable<AttributeValueCount[]> {
  const rangeSec = Math.max(1, Math.round((context.timeRange.to - context.timeRange.from) / 1000));

  const effectiveQuery =
    filters.length > 0
      ? context.query +
        new ExpressionBuilder(filters.map((f) => ({ key: f.field, operator: f.operator, value: f.value }))).getFieldsExpr(
          { decodeFilters: false, joinMatchFilters: true }
        )
      : context.query;

  const target: LokiQuery = {
    datasource: { type: 'loki', uid: context.datasourceUid },
    expr: buildDistributionQuery(effectiveQuery, field),
    queryType: 'instant',
    refId: field,
  };

  const request: DataQueryRequest<LokiQuery> = {
    app: 'explore',
    interval: `${rangeSec}s`,
    intervalMs: rangeSec * 1000,
    range: {
      from: dateTime(context.timeRange.from),
      raw: {
        from: dateTime(context.timeRange.from).utc().toISOString(),
        to: dateTime(context.timeRange.to).utc().toISOString(),
      },
      to: dateTime(context.timeRange.to),
    },
    requestId: `errors-breakdown-${field}`,
    scopedVars: {},
    startTime: Date.now(),
    targets: [target],
    timezone: 'browser',
  };

  return from(getDataSourceSrv().get(context.datasourceUid)).pipe(
    switchMap((ds) => (ds as LokiDatasource).query(request)),
    map((response) => {
      const errMsg = response.error?.message ?? response.errors?.[0]?.message ?? '';
      if (errMsg) {
        throw new Error(errMsg);
      }
      return processDistributionResponse(response, field);
    })
  );
}

const EMPTY_FIELDS_TO_EXCLUDE: string[] = [];
const EMPTY_ATTRIBUTE_MAP: Record<string, string> = {};

export interface LokiFieldDistributionProps {
  // Display name overrides for raw field names. Unknown fields fall back to their raw name.
  attributeMap?: Record<string, string>;
  datasourceUid: string;
  // Fields excluded from the distribution sidebar.
  fieldsToExclude?: string[];
  onFiltersChange?: (filters: Array<{ field: string; operator: '!=' | '='; value: string }>) => void;
  // Attributes pinned to the top of the list.
  priorityAttributes?: AttributeConfig[];
  // The full Loki log query for this error group.
  query: string;
  // Label communicating dataset scope. Example: "Last 1000 logs".
  queryLimitLabel?: string;
  // Active filter set. Updated by the consumer when external filters change.
  selectedFilters?: Array<{ field: string; operator: '!=' | '='; value: string }>;
  // When true, shows a link to the full service log view in Logs Drilldown.
  showAllLink?: boolean;
  timeRange: TimeRange;
}

export default function LokiFieldDistribution({
  datasourceUid,
  fieldsToExclude = EMPTY_FIELDS_TO_EXCLUDE,
  selectedFilters,
  attributeMap = EMPTY_ATTRIBUTE_MAP,
  onFiltersChange,
  priorityAttributes,
  query,
  queryLimitLabel,
  showAllLink,
  timeRange,
}: LokiFieldDistributionProps) {
  const fetchAttributes = useMemo(
    () => makeFetchAttributes(fieldsToExclude, attributeMap),
    [fieldsToExclude, attributeMap]
  );

  const numericTimeRange = useMemo(
    () => ({ from: timeRange.from.valueOf(), to: timeRange.to.valueOf() }),
    [timeRange]
  );

  const getFieldLink = useMemo(
    () => (attribute: string) => buildFieldLinkFromQuery(query, datasourceUid, numericTimeRange, attribute),
    [query, datasourceUid, numericTimeRange]
  );

  const showAllLinkObj = useMemo(() => {
    if (!showAllLink) {
      return undefined;
    }
    const href = buildServiceLinkFromQuery(query, datasourceUid, numericTimeRange);
    if (!href) {
      return undefined;
    }
    return { href, title: t('errors-analysis.show-all-link-title', 'Open in Logs Drilldown') };
  }, [showAllLink, query, datasourceUid, numericTimeRange]);

  const context: DatasetContext = { datasourceUid, query, timeRange: numericTimeRange };

  return (
    <AttributeDistribution
      context={context}
      fetchAttributes={fetchAttributes}
      fetchDistribution={fetchDistribution}
      getFieldLink={getFieldLink}
      selectedFilters={selectedFilters}
      onFiltersChange={onFiltersChange}
      priorityAttributes={priorityAttributes}
      queryLimitLabel={queryLimitLabel}
      showAllLink={showAllLinkObj}
    />
  );
}
