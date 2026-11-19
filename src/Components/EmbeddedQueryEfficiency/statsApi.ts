import { dateTime, TimeRange } from '@grafana/data';
import { Selector } from '@grafana/lezer-logql';
import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';

import { getNodesFromQuery } from 'services/logqlMatchers';
import { LokiDatasource } from 'services/lokiQuery';

export interface IndexStatsResponse {
  bytes: number;
  chunks: number;
  entries: number;
  streams: number;
}

// Loki's index/stats endpoint only understands a stream selector, not a full LogQL pipeline
// (parsers, line filters, etc.), so the selector has to be isolated from the rest of the query.
export function getStreamSelector(query: string): string {
  const [selector] = getNodesFromQuery(query, [Selector]);
  if (!selector) {
    return query;
  }
  return query.substring(selector.from, selector.to).replace(/\s*,\s*}/, '}');
}

export function fetchIndexStats(
  datasourceUid: string,
  query: string,
  timeRange: TimeRange
): Promise<IndexStatsResponse> {
  return getDataSourceInstance(datasourceUid).then((ds) =>
    (ds as LokiDatasource).getResource<IndexStatsResponse>(
      'index/stats',
      {
        end: dateTime(timeRange.to).utc().toISOString(),
        query: getStreamSelector(query),
        start: dateTime(timeRange.from).utc().toISOString(),
      },
      {
        requestId: `embedded-query-efficiency-stats-${datasourceUid}`,
      }
    )
  );
}
