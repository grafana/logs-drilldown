import { LokiQuery } from 'services/lokiQuery';
import { PLUGIN_ID } from 'services/plugin';

// Matches Loki's `detected_level` label, same field the main app's volume panel groups by.
const LEVEL_LABEL = 'detected_level';
const DEFAULT_MAX_LOG_LINES = 100;

// Standalone equivalent of services/query.ts's buildDataQuery: that file also pulls in
// Components/IndexScene/LineFilter/LineFilterVariablesScene and other scene-tree-only code,
// which would drag the whole IndexScene stack into this lazy-loaded, from-scratch chunk.
function buildMiniDataQuery(expr: string, overrides: Partial<LokiQuery>): LokiQuery {
  return {
    editorMode: 'code',
    queryType: 'range',
    refId: 'A',
    supportingQueryType: PLUGIN_ID,
    ...overrides,
    expr,
  };
}

export function buildLogsQuery(query: string): LokiQuery {
  return buildMiniDataQuery(query, { maxLines: DEFAULT_MAX_LOG_LINES, refId: 'logs' });
}

// Open-ended level aggregation: one series per distinct `detected_level` value found, same
// expression shape as the main app's volume panel. Grouping by other fields is a later, configurable step.
export function buildVolumeQuery(query: string): LokiQuery {
  return buildMiniDataQuery(`sum(count_over_time(${query} [$__auto])) by (${LEVEL_LABEL})`, {
    legendFormat: `{{${LEVEL_LABEL}}}`,
    refId: 'volume',
  });
}
