/**
 * Plain-data fixtures for `{service_name="tempo-ingester"}`.
 *
 * Default per-service data registered by `mockExploreApi(page)`. Scenarios in
 * `tests/mocks/scenarios/` import these slices directly and call
 * `page.route(...)` themselves — there is no service dispatcher.
 */
import dsQueryData from './dsQuery.json';
import labelsBreakdownData from './labelsBreakdown.json';

import { detectedFields } from './detectedFields';
import { detectedLabels } from './detectedLabels';
import { fieldValues } from './fieldValues';
import { labelValues } from './labelValues';
import { patterns } from './patterns';

export type CapturedResponse = { frames?: unknown[]; status?: number };
export type DsQueryEntry = {
  refId: string;
  expr?: string;
  legendFormat?: string;
  response: CapturedResponse;
};
export type LabelsBreakdownFixture = Record<string, Record<string, CapturedResponse>>;

export const dsQuery = dsQueryData as DsQueryEntry[];
export const labelsBreakdown = labelsBreakdownData as unknown as LabelsBreakdownFixture;

export { detectedFields, detectedLabels, fieldValues, labelValues, patterns };
