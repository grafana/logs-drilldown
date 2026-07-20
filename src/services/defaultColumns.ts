import {
  LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord,
  LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
} from '@grafana/api-clients/rtkq/logsdrilldown/v1beta1';
import { SceneObject } from '@grafana/scenes';

import { isOperatorInclusive, isOperatorRegex } from './operatorHelpers';
import { getLabelsVariable } from './variableGetters';
import { isAdHocFilterValueUserInput, stripAdHocFilterUserInputPrefix } from './variables';

export function getDefaultColumnsForActiveFilters(
  records: LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords,
  sceneRef: SceneObject
): string[] | undefined {
  const labelsVariable = getLabelsVariable(sceneRef);
  const inclusiveFilters = labelsVariable.state.filters.filter((f) => isOperatorInclusive(f.operator));

  // Expand multi-value regex filters (e.g. `key=~__CVΩ__value1|value2`) into individual
  // key/value pairs so they score the same as `key=value1 key=value2`.
  const expandedFilters = inclusiveFilters.flatMap((f) => {
    if (isOperatorRegex(f.operator) && isAdHocFilterValueUserInput(f.value)) {
      return stripAdHocFilterUserInputPrefix(f.value)
        .split('|')
        .map((value) => ({ key: f.key, value }));
    }
    return [{ key: f.key, value: f.value }];
  });

  // Remove records that are more specific than our current label set
  const filteredRecords = records?.filter((f) => f.labels.length <= expandedFilters.length);

  // init map
  const filtersMap = new Set<string>();
  expandedFilters.forEach((f) => filtersMap.add(f.key + f.value));

  // Assign a score to each record
  const recordsScore: Array<LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord & { score: number }> | undefined =
    filteredRecords?.map((r) => {
      const score = r.labels.reduce((accumulator, label) => {
        const usedInQuery = filtersMap.has(label.key + label.value);
        if (usedInQuery) {
          return accumulator + 1;
        }
        return accumulator;
      }, 0);
      return { ...r, score };
    });

  let highScore = 0;
  let highScoreIdx = -1;
  recordsScore?.forEach((r, idx) => {
    if (r.score > highScore) {
      highScore = r.score;
      highScoreIdx = idx;
    }
  });

  const bestMatch = highScoreIdx !== -1 ? recordsScore?.[highScoreIdx] : undefined;

  return bestMatch?.columns;
}
