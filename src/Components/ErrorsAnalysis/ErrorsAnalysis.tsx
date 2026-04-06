import React from 'react';

import { DataFrame, DataQueryRequest, dateTime, FieldType } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

import { LokiDatasource, LokiQuery } from '../../services/lokiQuery';
import { AttributeConfig, AttributeDistribution, DatasetContext, LabelValueCount } from './AttributeDistribution';

// Appends a per-field metric aggregation around the base log query.
// The base query must already include logfmt and any hash filters so that
// [$__range] counts only events in this error group.
function buildDistributionQuery(baseQuery: string, field: string): string {
  return `sum by (${field}) (count_over_time(${baseQuery} | keep ${field} [$__range]))`;
}

function makeFetchAttributes(
  fieldsToExclude: string[],
  labelMap: Record<string, string>
): (context: DatasetContext) => Promise<AttributeConfig[]> {
  // Build the Set here, inside logs-drilldown's module, so Set.prototype methods
  // operate on a Set from this bundle's realm. Passing a Set across plugin
  // boundaries (different webpack bundles) causes cross-realm prototype errors.
  const excludeSet = new Set(fieldsToExclude);

  return async function fetchAttributes(context: DatasetContext): Promise<AttributeConfig[]> {
    const ds = (await getDataSourceSrv().get(context.datasourceUid)) as LokiDatasource;

    const response = (await (ds as any).getResource(
      'detected_fields',
      {
        end: dateTime(context.timeRange.to).utc().toISOString(),
        query: context.query,
        start: dateTime(context.timeRange.from).utc().toISOString(),
      },
      { requestId: 'errors-detected-fields' }
    )) as { fields?: Array<{ label: string }> };

    return (response.fields ?? [])
      .filter((f) => !excludeSet.has(f.label))
      .map((f) => ({
        field: f.label,
        label: labelMap[f.label] ?? f.label,
      }));
  };
}

async function fetchDistribution(context: DatasetContext, field: string): Promise<LabelValueCount[]> {
  const ds = (await getDataSourceSrv().get(context.datasourceUid)) as LokiDatasource;
  const rangeSec = Math.max(1, Math.round((context.timeRange.to - context.timeRange.from) / 1000));

  const target: LokiQuery = {
    datasource: { type: 'loki', uid: context.datasourceUid },
    expr: buildDistributionQuery(context.query, field),
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

  const response = await lastValueFrom(ds.query(request));

  const counts: Array<{ value: string; count: number }> = [];

  response.data.forEach((frame: DataFrame) => {
    // Loki returns numeric-multi frames in wide format: one row per unique label value.
    // The label values are in a string field named after the queried field.
    // The counts are in the corresponding number field.
    const labelField = frame.fields.find((f) => f.type === FieldType.string && f.name === field);
    const valueField = frame.fields.find((f) => f.type === FieldType.number);

    if (!labelField || !valueField) {
      return;
    }

    function getValue(values: unknown, i: number): unknown {
      if (typeof (values as any)?.get === 'function') {
        return (values as any).get(i);
      }
      return (values as any)[i];
    }

    for (let i = 0; i < frame.length; i++) {
      const labelValue = String(getValue(labelField.values, i) ?? '');
      const count = Number(getValue(valueField.values, i));
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

export interface ErrorsAnalysisProps {
  datasourceUid: string;
  // The full Loki log query for this error group, including any active filters.
  // Built and interpolated by the consuming app -- logs-drilldown does not construct
  // or modify it.
  query: string;
  timeRange: { from: number; to: number };
  // Fields to exclude from the distribution sidebar. The consuming app owns this
  // list because it has domain knowledge of which fields are noise for its dataset.
  // If not provided, all detected fields are shown.
  fieldsToExclude?: string[];
  // Display name overrides for raw field names. The consuming app owns this mapping
  // because it knows what its fields mean to users.
  // Unknown fields fall back to their raw field name.
  // If not provided, all fields display with their raw name.
  labelMap?: Record<string, string>;
  onFiltersChange?: (filters: Array<{ field: string; value: string }>) => void;
  // Optional ordered list of attributes to pin first in the distribution sidebar.
  // Defined by the consuming app -- logs-drilldown imposes no default ordering.
  // If not provided, detected fields appear in the order returned by fetchAttributes.
  priorityAttributes?: Array<{ field: string; label: string }>;
  // Optional label shown at the top of the sidebar communicating the dataset scope.
  // Set this when the underlying query caps the number of events so users understand
  // the distributions are based on a sample. Example: "Last 1000 logs"
  // The consuming app sets this -- it knows what limit its query applies.
  queryLimitLabel?: string;
}

export default function ErrorsAnalysis({
  datasourceUid,
  query,
  timeRange,
  fieldsToExclude = [],
  labelMap = {},
  onFiltersChange,
  priorityAttributes,
  queryLimitLabel,
}: ErrorsAnalysisProps) {
  const context: DatasetContext = { datasourceUid, query, timeRange };
  const fetchAttributes = makeFetchAttributes(fieldsToExclude, labelMap);

  return (
    <AttributeDistribution
      context={context}
      fetchAttributes={fetchAttributes}
      fetchDistribution={fetchDistribution}
      onFiltersChange={onFiltersChange}
      priorityAttributes={priorityAttributes}
      queryLimitLabel={queryLimitLabel}
    />
  );
}
