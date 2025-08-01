import { DataQueryResponse } from '@grafana/data';

import { combineResponses } from './combineResponses';

export function combine(current: DataQueryResponse | null, partial: DataQueryResponse) {
  return combineResponses(current, partial);
}
